import {
  AffineAimTransform,
  createNormalizedViewportPoint,
  createRadians,
  type AffineAimTransformSnapshot,
  type CoopBirdId,
  type CoopRoomSnapshot,
  type HandTriggerCalibrationSnapshot,
  type NormalizedViewportPoint
} from "@thumbshooter/shared";

import { gameplayRuntimeConfig } from "../config/gameplay-runtime";
import { handAimObservationConfig } from "../config/hand-aim-observation";
import { coopArenaSimulationConfig } from "../config/coop-arena-simulation";
import {
  advanceGameplayCameraSnapshot,
  createDistanceSquaredFromRay,
  createGameplayCameraSnapshot
} from "../states/gameplay-space";
import { evaluateHandTriggerGesture } from "../types/hand-trigger-gesture";
import { readObservedAimPoint } from "../types/hand-aim-observation";
import type { GameplaySignal } from "../types/gameplay-signal";
import type { LatestHandTrackingSnapshot } from "../types/hand-tracking";
import {
  createCoopGameplaySessionSnapshot,
  createPendingCoopGameplaySessionSnapshot
} from "../types/gameplay-session";
import type {
  CoopArenaLocalIdentity,
  CoopArenaRoomSource,
  CoopArenaSimulationConfig
} from "../types/coop-arena-simulation";
import type {
  GameplayArenaHudSnapshot,
  GameplayCameraSnapshot,
  GameplayViewportSnapshot
} from "../types/gameplay-runtime";
import type { MutableEnemyRenderState } from "../types/local-arena-enemy-field";
import type {
  LocalArenaArenaSnapshot,
  LocalArenaEnemyRenderState,
  LocalArenaTargetFeedbackSnapshot,
  LocalArenaTargetFeedbackState,
  LocalArenaWeaponSnapshot
} from "../types/local-arena-simulation";
import { WeaponRuntime } from "./weapon-runtime";

const defaultViewportSnapshot = Object.freeze({
  height: 1,
  width: 1
}) satisfies GameplayViewportSnapshot;

function freezeArenaSnapshot(
  liveEnemyCount: number,
  scatterEnemyCount: number,
  downedEnemyCount: number
): LocalArenaArenaSnapshot {
  return Object.freeze({
    downedEnemyCount,
    liveEnemyCount,
    scatterEnemyCount
  });
}

function freezeTargetFeedbackSnapshot(
  state: LocalArenaTargetFeedbackState,
  enemyId: string | null,
  enemyLabel: string | null
): LocalArenaTargetFeedbackSnapshot {
  return Object.freeze({
    enemyId,
    enemyLabel,
    state
  });
}

function freezeHudSnapshot(
  trackingState: GameplayArenaHudSnapshot["trackingState"],
  aimPoint: NormalizedViewportPoint | null,
  arena: LocalArenaArenaSnapshot,
  session: GameplayArenaHudSnapshot["session"],
  weapon: LocalArenaWeaponSnapshot,
  targetFeedback: LocalArenaTargetFeedbackSnapshot
): GameplayArenaHudSnapshot {
  return Object.freeze({
    aimPoint,
    arena,
    session,
    targetFeedback,
    trackingState,
    weapon
  });
}

function readNowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

interface CoopArenaSimulationDependencies extends CoopArenaLocalIdentity {
  readonly emitGameplaySignal?: (signal: GameplaySignal) => void;
  readonly triggerCalibration?: HandTriggerCalibrationSnapshot | null;
}

interface ProjectedAimPoint {
  readonly aimPoint: NormalizedViewportPoint | null;
  readonly isReticleOffscreen: boolean;
}

function createEnemyRenderState(
  birdId: string,
  label: string
): MutableEnemyRenderState {
  return {
    behavior: "glide",
    headingRadians: createRadians(0),
    id: birdId,
    label,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    radius: 0,
    scale: 1,
    visible: false,
    wingPhase: 0
  };
}

function summarizeEnemyRenderStates(
  enemyRenderStates: readonly LocalArenaEnemyRenderState[]
): LocalArenaArenaSnapshot {
  let liveEnemyCount = 0;
  let scatterEnemyCount = 0;
  let downedEnemyCount = 0;

  for (const enemyState of enemyRenderStates) {
    if (!enemyState.visible) {
      continue;
    }

    if (enemyState.behavior === "downed") {
      downedEnemyCount += 1;
      continue;
    }

    liveEnemyCount += 1;

    if (enemyState.behavior === "scatter") {
      scatterEnemyCount += 1;
    }
  }

  return freezeArenaSnapshot(liveEnemyCount, scatterEnemyCount, downedEnemyCount);
}

function findNearestVisibleEnemyRenderState(
  enemyRenderStates: readonly LocalArenaEnemyRenderState[],
  shotOrigin: GameplayCameraSnapshot["position"],
  shotDirection: GameplayCameraSnapshot["aimDirection"],
  radius: number
): LocalArenaEnemyRenderState | null {
  let nearestEnemyState: LocalArenaEnemyRenderState | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const enemyState of enemyRenderStates) {
    if (!enemyState.visible || enemyState.behavior === "downed") {
      continue;
    }

    const thresholdRadius = enemyState.radius + radius;
    const distanceToRay = createDistanceSquaredFromRay(
      shotOrigin,
      shotDirection,
      {
        x: enemyState.positionX,
        y: enemyState.positionY,
        z: enemyState.positionZ
      }
    );

    if (
      distanceToRay.distanceSquared > thresholdRadius * thresholdRadius ||
      distanceToRay.distanceSquared >= nearestDistanceSquared
    ) {
      continue;
    }

    nearestEnemyState = enemyState;
    nearestDistanceSquared = distanceToRay.distanceSquared;
  }

  return nearestEnemyState;
}

function resolveBirdLabel(
  roomSnapshot: CoopRoomSnapshot,
  birdId: CoopBirdId | null
): string | null {
  if (birdId === null) {
    return null;
  }

  return (
    roomSnapshot.birds.find((birdSnapshot) => birdSnapshot.birdId === birdId)?.label ??
    null
  );
}

export class CoopArenaSimulation {
  readonly #affineAimTransform: AffineAimTransform;
  readonly #config: CoopArenaSimulationConfig;
  readonly #enemyRenderStates: MutableEnemyRenderState[] = [];
  readonly #emitGameplaySignal: ((signal: GameplaySignal) => void) | null;
  readonly #localPlayerId: CoopArenaLocalIdentity["playerId"];
  readonly #roomSource: CoopArenaRoomSource;
  readonly #triggerCalibration: HandTriggerCalibrationSnapshot | null;
  readonly #weaponRuntime: WeaponRuntime;

  #cameraSnapshot: GameplayCameraSnapshot;
  #feedbackEnemyId: string | null = null;
  #feedbackEnemyLabel: string | null = null;
  #feedbackHoldUntilMs = 0;
  #feedbackState: LocalArenaTargetFeedbackState = "tracking-lost";
  #hudSnapshot: GameplayArenaHudSnapshot;
  #lastAcknowledgedShotSequence = 0;
  #lastKnownHitCount = 0;
  #lastStepAtMs: number | null = null;
  #triggerReadyLatch = false;
  #worldTimeMs = 0;

  constructor(
    aimCalibration: AffineAimTransformSnapshot,
    roomSource: CoopArenaRoomSource,
    config: CoopArenaSimulationConfig = coopArenaSimulationConfig,
    dependencies: CoopArenaSimulationDependencies
  ) {
    this.#affineAimTransform = AffineAimTransform.fromSnapshot(aimCalibration);
    this.#config = config;
    this.#emitGameplaySignal = dependencies.emitGameplaySignal ?? null;
    this.#localPlayerId = dependencies.playerId;
    this.#roomSource = roomSource;
    this.#triggerCalibration = dependencies.triggerCalibration ?? null;
    this.#weaponRuntime = new WeaponRuntime(config.weapon);
    this.#cameraSnapshot = createGameplayCameraSnapshot(config.camera);
    this.#hudSnapshot = this.#buildHudSnapshot("unavailable", null);
  }

  get cameraSnapshot(): GameplayCameraSnapshot {
    return this.#cameraSnapshot;
  }

  get enemyRenderStates(): readonly LocalArenaEnemyRenderState[] {
    return this.#enemyRenderStates;
  }

  get hudSnapshot(): GameplayArenaHudSnapshot {
    return this.#hudSnapshot;
  }

  get worldTimeMs(): number {
    return this.#worldTimeMs;
  }

  advance(
    trackingSnapshot: LatestHandTrackingSnapshot,
    nowMs: number = readNowMs(),
    viewportSnapshot: GameplayViewportSnapshot = defaultViewportSnapshot
  ): GameplayArenaHudSnapshot {
    const safeNowMs = Number.isFinite(nowMs) ? nowMs : readNowMs();
    const deltaMs =
      this.#lastStepAtMs === null
        ? 0
        : Math.max(0, Math.min(48, safeNowMs - this.#lastStepAtMs));
    const roomSnapshot = this.#roomSource.roomSnapshot;

    this.#lastStepAtMs = safeNowMs;
    this.#syncEnemyRenderStates(roomSnapshot);
    this.#worldTimeMs =
      roomSnapshot === null
        ? 0
        : roomSnapshot.tick.currentTick * Number(roomSnapshot.tick.tickIntervalMs);

    const projectedAimPoint =
      trackingSnapshot.trackingState === "tracked"
        ? this.#projectAimPoint(trackingSnapshot)
        : { aimPoint: null, isReticleOffscreen: false };

    this.#cameraSnapshot = advanceGameplayCameraSnapshot(
      this.#cameraSnapshot,
      projectedAimPoint.aimPoint,
      viewportSnapshot,
      gameplayRuntimeConfig.camera.fieldOfViewDegrees,
      this.#config.camera,
      deltaMs / 1000
    );

    const triggerPressed =
      trackingSnapshot.trackingState === "tracked"
        ? this.#readTriggerPressed(trackingSnapshot)
        : this.#clearTriggerReadyLatch();
    const session =
      roomSnapshot === null
        ? createPendingCoopGameplaySessionSnapshot(this.#roomSource.roomId)
        : createCoopGameplaySessionSnapshot(roomSnapshot, this.#localPlayerId);
    const sessionActive =
      session.phase === "active" && session.roundPhase === "combat";
    const weaponFrame = this.#weaponRuntime.advance({
      hasTrackedHand: trackingSnapshot.trackingState === "tracked",
      isReticleOffscreen: projectedAimPoint.isReticleOffscreen,
      nowMs: safeNowMs,
      sessionActive,
      triggerPressed
    });

    if (weaponFrame.fired && projectedAimPoint.aimPoint !== null) {
      this.#emitGameplaySignal?.({
        type: "weapon-fired",
        weaponId: this.#weaponRuntime.definition.weaponId
      });
      this.#roomSource.fireShot(
        this.#cameraSnapshot.position,
        this.#cameraSnapshot.aimDirection
      );
    }

    this.#roomSource.syncPlayerPresence?.({
      aimDirection: this.#cameraSnapshot.aimDirection,
      pitchRadians: this.#cameraSnapshot.pitchRadians,
      position: this.#cameraSnapshot.position,
      weaponId: this.#weaponRuntime.definition.weaponId,
      yawRadians: this.#cameraSnapshot.yawRadians
    });

    if (weaponFrame.reloaded) {
      this.#emitGameplaySignal?.({
        type: "weapon-reloaded",
        weaponId: this.#weaponRuntime.definition.weaponId
      });
    }

    if (roomSnapshot !== null) {
      this.#applyLocalPlayerActivity(roomSnapshot, safeNowMs);
    }

    this.#updateFeedback(
      trackingSnapshot.trackingState,
      projectedAimPoint.aimPoint,
      projectedAimPoint.isReticleOffscreen,
      safeNowMs
    );
    this.#hudSnapshot = freezeHudSnapshot(
      trackingSnapshot.trackingState,
      projectedAimPoint.aimPoint,
      summarizeEnemyRenderStates(this.#enemyRenderStates),
      session,
      this.#weaponRuntime.createHudSnapshot({
        hasTrackedHand: trackingSnapshot.trackingState === "tracked",
        isReticleOffscreen: projectedAimPoint.isReticleOffscreen,
        nowMs: safeNowMs,
        sessionActive,
        triggerPressed:
          trackingSnapshot.trackingState === "tracked" && this.#weaponRuntime.triggerHeld
      }),
      freezeTargetFeedbackSnapshot(
        this.#feedbackState,
        this.#feedbackEnemyId,
        this.#feedbackEnemyLabel
      )
    );

    return this.#hudSnapshot;
  }

  reset(trackingSnapshot?: LatestHandTrackingSnapshot): void {
    const roomSnapshot = this.#roomSource.roomSnapshot;
    const localPlayerSnapshot = roomSnapshot?.players.find(
      (playerSnapshot) => playerSnapshot.playerId === this.#localPlayerId
    );

    this.#cameraSnapshot = createGameplayCameraSnapshot(this.#config.camera);
    this.#feedbackEnemyId = null;
    this.#feedbackEnemyLabel = null;
    this.#feedbackHoldUntilMs = 0;
    this.#feedbackState = "tracking-lost";
    this.#lastAcknowledgedShotSequence =
      localPlayerSnapshot?.activity.lastAcknowledgedShotSequence ?? 0;
    this.#lastKnownHitCount = localPlayerSnapshot?.activity.hitsLanded ?? 0;
    this.#lastStepAtMs = null;
    this.#triggerReadyLatch = false;
    this.#weaponRuntime.reset(
      trackingSnapshot?.trackingState === "tracked"
        ? this.#readTriggerPressed(trackingSnapshot)
        : false
    );
    this.#syncEnemyRenderStates(roomSnapshot);
    this.#worldTimeMs =
      roomSnapshot === null
        ? 0
        : roomSnapshot.tick.currentTick * Number(roomSnapshot.tick.tickIntervalMs);
    this.#hudSnapshot = this.#buildHudSnapshot("unavailable", null);
  }

  #buildHudSnapshot(
    trackingState: GameplayArenaHudSnapshot["trackingState"],
    aimPoint: NormalizedViewportPoint | null,
    isReticleOffscreen = false,
    nowMs: number = readNowMs()
  ): GameplayArenaHudSnapshot {
    const roomSnapshot = this.#roomSource.roomSnapshot;
    const session =
      roomSnapshot === null
        ? createPendingCoopGameplaySessionSnapshot(this.#roomSource.roomId)
        : createCoopGameplaySessionSnapshot(roomSnapshot, this.#localPlayerId);

    return freezeHudSnapshot(
      trackingState,
      aimPoint,
      summarizeEnemyRenderStates(this.#enemyRenderStates),
      session,
      this.#weaponRuntime.createHudSnapshot({
        hasTrackedHand: trackingState === "tracked",
        isReticleOffscreen,
        nowMs,
        sessionActive: session.phase === "active" && session.roundPhase === "combat",
        triggerPressed: trackingState === "tracked" && this.#weaponRuntime.triggerHeld
      }),
      freezeTargetFeedbackSnapshot(
        this.#feedbackState,
        this.#feedbackEnemyId,
        this.#feedbackEnemyLabel
      )
    );
  }

  #applyLocalPlayerActivity(roomSnapshot: CoopRoomSnapshot, nowMs: number): void {
    const localPlayerSnapshot = roomSnapshot.players.find(
      (playerSnapshot) => playerSnapshot.playerId === this.#localPlayerId
    );

    if (localPlayerSnapshot === undefined) {
      return;
    }

    const nextHitCount = localPlayerSnapshot.activity.hitsLanded;

    if (nextHitCount > this.#lastKnownHitCount) {
      for (
        let hitCount = this.#lastKnownHitCount;
        hitCount < nextHitCount;
        hitCount += 1
      ) {
        this.#weaponRuntime.recordConfirmedHit();
      }

      this.#lastKnownHitCount = nextHitCount;
    }

    const nextAcknowledgedShotSequence =
      localPlayerSnapshot.activity.lastAcknowledgedShotSequence;

    if (nextAcknowledgedShotSequence <= this.#lastAcknowledgedShotSequence) {
      return;
    }

    this.#lastAcknowledgedShotSequence = nextAcknowledgedShotSequence;

    if (localPlayerSnapshot.activity.lastOutcome === "hit") {
      const enemyId = localPlayerSnapshot.activity.lastHitBirdId;
      const enemyLabel = resolveBirdLabel(roomSnapshot, enemyId);

      this.#emitGameplaySignal?.({
        enemyId: enemyId ?? "shared-bird",
        type: "enemy-hit-confirmed"
      });
      this.#setFeedback("hit", enemyId, enemyLabel, nowMs);
      return;
    }

    if (localPlayerSnapshot.activity.lastOutcome === "miss") {
      this.#setFeedback("miss", null, null, nowMs);
      return;
    }

    if (localPlayerSnapshot.activity.lastOutcome === "scatter") {
      this.#setFeedback("clear", null, null, nowMs);
    }
  }

  #syncEnemyRenderStates(roomSnapshot: CoopRoomSnapshot | null): void {
    const birdSnapshots = roomSnapshot?.birds ?? [];

    for (let index = this.#enemyRenderStates.length; index < birdSnapshots.length; index += 1) {
      const birdSnapshot = birdSnapshots[index]!;

      this.#enemyRenderStates.push(
        createEnemyRenderState(birdSnapshot.birdId, birdSnapshot.label)
      );
    }

    for (let index = 0; index < this.#enemyRenderStates.length; index += 1) {
      const enemyRenderState = this.#enemyRenderStates[index]!;
      const birdSnapshot = birdSnapshots[index];

      if (birdSnapshot === undefined) {
        enemyRenderState.visible = false;
        continue;
      }

      enemyRenderState.behavior = birdSnapshot.behavior;
      enemyRenderState.headingRadians = birdSnapshot.headingRadians;
      enemyRenderState.id = birdSnapshot.birdId;
      enemyRenderState.label = birdSnapshot.label;
      enemyRenderState.positionX = birdSnapshot.position.x;
      enemyRenderState.positionY = birdSnapshot.position.y;
      enemyRenderState.positionZ = birdSnapshot.position.z;
      enemyRenderState.radius = birdSnapshot.radius;
      enemyRenderState.scale = birdSnapshot.scale;
      enemyRenderState.visible = birdSnapshot.visible;
      enemyRenderState.wingPhase = birdSnapshot.wingPhase;
    }
  }

  #readTriggerPressed(
    trackingSnapshot: Extract<LatestHandTrackingSnapshot, {
      readonly trackingState: "tracked";
    }>
  ): boolean {
    const triggerGesture = evaluateHandTriggerGesture(
      trackingSnapshot.pose,
      this.#weaponRuntime.triggerHeld,
      this.#weaponRuntime.definition.triggerGesture,
      this.#triggerCalibration
    );

    if (triggerGesture.triggerReady) {
      this.#triggerReadyLatch = true;
    }

    const triggerPressed =
      this.#triggerReadyLatch && triggerGesture.triggerPressed;

    if (triggerGesture.triggerPressed) {
      this.#triggerReadyLatch = false;
    }

    return triggerPressed;
  }

  #clearTriggerReadyLatch(): false {
    this.#triggerReadyLatch = false;

    return false;
  }

  #setFeedback(
    state: LocalArenaTargetFeedbackState,
    enemyId: string | null,
    enemyLabel: string | null,
    nowMs: number
  ): void {
    this.#feedbackState = state;
    this.#feedbackEnemyId = enemyId;
    this.#feedbackEnemyLabel = enemyLabel;
    this.#feedbackHoldUntilMs = nowMs + this.#config.feedback.holdDurationMs;
  }

  #updateFeedback(
    trackingState: GameplayArenaHudSnapshot["trackingState"],
    aimPoint: NormalizedViewportPoint | null,
    isReticleOffscreen: boolean,
    nowMs: number
  ): void {
    if (this.#feedbackHoldUntilMs > nowMs) {
      return;
    }

    if (trackingState !== "tracked") {
      this.#feedbackState = "tracking-lost";
      this.#feedbackEnemyId = null;
      this.#feedbackEnemyLabel = null;
      return;
    }

    if (isReticleOffscreen) {
      this.#feedbackState = "offscreen";
      this.#feedbackEnemyId = null;
      this.#feedbackEnemyLabel = null;
      return;
    }

    if (aimPoint === null) {
      this.#feedbackState = "clear";
      this.#feedbackEnemyId = null;
      this.#feedbackEnemyLabel = null;
      return;
    }

    const targetedEnemy = findNearestVisibleEnemyRenderState(
      this.#enemyRenderStates,
      this.#cameraSnapshot.position,
      this.#cameraSnapshot.aimDirection,
      this.#config.targeting.acquireRadius
    );

    if (targetedEnemy === null) {
      this.#feedbackState = "clear";
      this.#feedbackEnemyId = null;
      this.#feedbackEnemyLabel = null;
      return;
    }

    this.#feedbackState = "targeted";
    this.#feedbackEnemyId = targetedEnemy.id;
    this.#feedbackEnemyLabel = targetedEnemy.label;
  }

  #projectAimPoint(
    trackingSnapshot: Extract<LatestHandTrackingSnapshot, {
      readonly trackingState: "tracked";
    }>
  ): ProjectedAimPoint {
    const observedAimPoint = readObservedAimPoint(
      trackingSnapshot.pose,
      handAimObservationConfig
    );
    const rawAimPoint = this.#affineAimTransform.projectUnclamped(observedAimPoint);
    const isReticleOffscreen =
      rawAimPoint.x < 0 ||
      rawAimPoint.x > 1 ||
      rawAimPoint.y < 0 ||
      rawAimPoint.y > 1;

    return Object.freeze({
      aimPoint: isReticleOffscreen
        ? null
        : createNormalizedViewportPoint(rawAimPoint),
      isReticleOffscreen
    });
  }
}
