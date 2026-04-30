import {
  AffineAimTransform,
  createNormalizedViewportPoint,
  type AffineAimTransformSnapshot,
  type HandTriggerCalibrationSnapshot,
  type NormalizedViewportPoint
} from "@webgpu-metaverse/shared";

import { duckHuntGameplayRuntimeConfig } from "../config/duck-hunt-gameplay-runtime";
import { duckHuntLocalArenaSimulationConfig } from "../config/duck-hunt-local-arena-simulation";
import {
  advanceGameplayCameraSnapshot,
  createGameplayCameraSnapshot
} from "../states/duck-hunt-gameplay-space";
import {
  applyReticleScatter,
  countDownedEnemies,
  createEnemyField,
  findNearestEnemyState,
  type LocalArenaEnemyRuntimeState,
  resetEnemyField,
  scatterEnemiesFromShot,
  setEnemyDowned,
  stepEnemyField,
  summarizeEnemyField
} from "../states/duck-hunt-local-arena-enemy-field";
import type { GameplaySignal } from "../types/duck-hunt-gameplay-signal";
import {
  createSinglePlayerGameplaySessionSnapshot
} from "../types/duck-hunt-gameplay-session";
import type {
  GameplayCameraSnapshot,
  GameplayViewportSnapshot
} from "../types/duck-hunt-gameplay-runtime";
import type {
  LocalArenaEnemyRenderState,
  LocalArenaHudSnapshot,
  LocalArenaSimulationConfig,
  LocalArenaTargetFeedbackSnapshot,
  LocalArenaTargetFeedbackState,
  LocalArenaWeaponSnapshot
} from "../types/duck-hunt-local-arena-simulation";
import {
  evaluateHandTriggerGesture,
  handAimObservationConfig,
  readObservedAimPoint,
  type LatestHandTrackingSnapshot
} from "../../../tracking";
import { DuckHuntLocalCombatSession } from "./duck-hunt-local-combat-session";
import { DuckHuntWeaponRuntime } from "./duck-hunt-weapon-runtime";

const defaultViewportSnapshot = Object.freeze({
  height: 1,
  width: 1
}) satisfies GameplayViewportSnapshot;

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
  trackingState: LocalArenaHudSnapshot["trackingState"],
  aimPoint: NormalizedViewportPoint | null,
  arena: LocalArenaHudSnapshot["arena"],
  session: LocalArenaHudSnapshot["session"],
  weapon: LocalArenaWeaponSnapshot,
  targetFeedback: LocalArenaTargetFeedbackSnapshot
): LocalArenaHudSnapshot {
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

interface LocalArenaSimulationDependencies {
  readonly emitGameplaySignal?: (signal: GameplaySignal) => void;
  readonly triggerCalibration?: HandTriggerCalibrationSnapshot | null;
}

interface ProjectedAimPoint {
  readonly aimPoint: NormalizedViewportPoint | null;
  readonly isReticleOffscreen: boolean;
}

export class DuckHuntLocalArenaSimulation {
  readonly #affineAimTransform: AffineAimTransform;
  readonly #combatSession: DuckHuntLocalCombatSession;
  readonly #config: LocalArenaSimulationConfig;
  readonly #enemyRenderStates: readonly LocalArenaEnemyRenderState[];
  readonly #enemyRuntimeStates: readonly LocalArenaEnemyRuntimeState[];
  readonly #emitGameplaySignal: ((signal: GameplaySignal) => void) | null;
  readonly #triggerCalibration: HandTriggerCalibrationSnapshot | null;
  readonly #weaponRuntime: DuckHuntWeaponRuntime;

  #cameraSnapshot: GameplayCameraSnapshot;
  #feedbackEnemyId: string | null = null;
  #feedbackEnemyLabel: string | null = null;
  #feedbackHoldUntilMs = 0;
  #feedbackState: LocalArenaTargetFeedbackState = "tracking-lost";
  #hudSnapshot: LocalArenaHudSnapshot;
  #lastStepAtMs: number | null = null;
  #triggerReadyLatch = false;
  #worldTimeMs = 0;

  constructor(
    aimCalibration: AffineAimTransformSnapshot,
    config: LocalArenaSimulationConfig = duckHuntLocalArenaSimulationConfig,
    dependencies: LocalArenaSimulationDependencies = {}
  ) {
    this.#affineAimTransform = AffineAimTransform.fromSnapshot(aimCalibration);
    this.#config = config;
    this.#emitGameplaySignal = dependencies.emitGameplaySignal ?? null;
    this.#triggerCalibration = dependencies.triggerCalibration ?? null;
    this.#combatSession = new DuckHuntLocalCombatSession(
      config.enemySeeds.length,
      config.session
    );
    this.#weaponRuntime = new DuckHuntWeaponRuntime(config.weapon);

    const enemyField = createEnemyField(config);

    this.#enemyRuntimeStates = enemyField.enemyRuntimeStates;
    this.#enemyRenderStates = enemyField.enemyRenderStates;
    this.#cameraSnapshot = createGameplayCameraSnapshot(config.camera);
    this.#hudSnapshot = this.#buildHudSnapshot("unavailable", null);
  }

  get cameraSnapshot(): GameplayCameraSnapshot {
    return this.#cameraSnapshot;
  }

  get enemyRenderStates(): readonly LocalArenaEnemyRenderState[] {
    return this.#enemyRenderStates;
  }

  get hudSnapshot(): LocalArenaHudSnapshot {
    return this.#hudSnapshot;
  }

  get worldTimeMs(): number {
    return this.#worldTimeMs;
  }

  advance(
    trackingSnapshot: LatestHandTrackingSnapshot,
    nowMs: number = readNowMs(),
    viewportSnapshot: GameplayViewportSnapshot = defaultViewportSnapshot
  ): LocalArenaHudSnapshot {
    const safeNowMs = Number.isFinite(nowMs) ? nowMs : this.#worldTimeMs;
    const deltaMs =
      this.#lastStepAtMs === null
        ? 0
        : Math.min(
            this.#config.movement.maxStepMs,
            Math.max(0, safeNowMs - this.#lastStepAtMs)
          );

    this.#lastStepAtMs = safeNowMs;
    this.#worldTimeMs += deltaMs;

    const projectedAimPoint =
      trackingSnapshot.trackingState === "tracked"
        ? this.#projectAimPoint(trackingSnapshot)
        : { aimPoint: null, isReticleOffscreen: false };
    const sessionPhase = this.#combatSession.beginFrame(safeNowMs).phase;
    const sessionActive = sessionPhase === "active";

    if (sessionActive) {
      this.#cameraSnapshot = advanceGameplayCameraSnapshot(
        this.#cameraSnapshot,
        projectedAimPoint.aimPoint,
        viewportSnapshot,
        duckHuntGameplayRuntimeConfig.camera.fieldOfViewDegrees,
        this.#config.camera,
        deltaMs / 1000
      );
    }

    const triggerPressed =
      trackingSnapshot.trackingState === "tracked"
        ? this.#readTriggerPressed(trackingSnapshot)
        : this.#clearTriggerReadyLatch();
    const weaponFrame = this.#weaponRuntime.advance({
      hasTrackedHand: trackingSnapshot.trackingState === "tracked",
      isReticleOffscreen: projectedAimPoint.isReticleOffscreen,
      nowMs: safeNowMs,
      sessionActive,
      triggerPressed
    });

    if (sessionActive && projectedAimPoint.aimPoint !== null) {
      applyReticleScatter(
        this.#enemyRuntimeStates,
        this.#config,
        this.#cameraSnapshot.position,
        this.#cameraSnapshot.aimDirection
      );
    }

    if (weaponFrame.fired && projectedAimPoint.aimPoint !== null) {
      this.#resolveShot(
        this.#cameraSnapshot.position,
        this.#cameraSnapshot.aimDirection,
        safeNowMs
      );
    }

    if (weaponFrame.reloaded) {
      this.#emitGameplaySignal?.({
        type: "weapon-reloaded",
        weaponId: this.#weaponRuntime.definition.weaponId
      });
    }

    if (sessionActive) {
      stepEnemyField(this.#enemyRuntimeStates, this.#config, deltaMs);
      this.#combatSession.syncEnemyProgress(
        countDownedEnemies(this.#enemyRuntimeStates)
      );
      this.#updateFeedback(
        trackingSnapshot.trackingState,
        projectedAimPoint.aimPoint,
        projectedAimPoint.isReticleOffscreen,
        safeNowMs
      );
    }

    this.#hudSnapshot = this.#buildHudSnapshot(
      trackingSnapshot.trackingState,
      projectedAimPoint.aimPoint,
      projectedAimPoint.isReticleOffscreen,
      safeNowMs
    );

    return this.#hudSnapshot;
  }

  reset(trackingSnapshot?: LatestHandTrackingSnapshot): void {
    this.#combatSession.reset();
    this.#resetRoundState(trackingSnapshot);
  }

  restartSession(trackingSnapshot?: LatestHandTrackingSnapshot): void {
    if (this.#combatSession.phase === "completed") {
      this.#combatSession.advanceRound();
    } else {
      this.#combatSession.reset();
    }

    this.#resetRoundState(trackingSnapshot);
  }

  #resetRoundState(trackingSnapshot?: LatestHandTrackingSnapshot): void {
    this.#cameraSnapshot = createGameplayCameraSnapshot(this.#config.camera);
    this.#feedbackEnemyId = null;
    this.#feedbackEnemyLabel = null;
    this.#feedbackHoldUntilMs = 0;
    this.#feedbackState = "tracking-lost";
    this.#lastStepAtMs = null;
    this.#triggerReadyLatch = false;
    this.#weaponRuntime.reset(
      trackingSnapshot?.trackingState === "tracked"
        ? this.#readTriggerPressed(trackingSnapshot)
        : false
    );
    this.#worldTimeMs = 0;

    resetEnemyField(this.#enemyRuntimeStates, this.#config);
    this.#hudSnapshot = this.#buildHudSnapshot("unavailable", null);
  }

  #buildHudSnapshot(
    trackingState: LocalArenaHudSnapshot["trackingState"],
    aimPoint: NormalizedViewportPoint | null,
    isReticleOffscreen = false,
    nowMs: number = this.#worldTimeMs
  ): LocalArenaHudSnapshot {
    const weapon = this.#weaponRuntime.createHudSnapshot({
      hasTrackedHand: trackingState === "tracked",
      isReticleOffscreen,
      nowMs,
      sessionActive: this.#combatSession.phase === "active",
      triggerPressed: trackingState === "tracked" && this.#weaponRuntime.triggerHeld
    });

    return freezeHudSnapshot(
      trackingState,
      aimPoint,
      summarizeEnemyField(this.#enemyRuntimeStates),
      createSinglePlayerGameplaySessionSnapshot(this.#combatSession.snapshot),
      weapon,
      freezeTargetFeedbackSnapshot(
        this.#feedbackState,
        this.#feedbackEnemyId,
        this.#feedbackEnemyLabel
      )
    );
  }

  #readTriggerPressed(trackingSnapshot: Extract<LatestHandTrackingSnapshot, {
    readonly trackingState: "tracked";
  }>): boolean {
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

  #resolveShot(
    shotOrigin: GameplayCameraSnapshot["position"],
    shotDirection: GameplayCameraSnapshot["aimDirection"],
    nowMs: number
  ): void {
    this.#emitGameplaySignal?.({
      type: "weapon-fired",
      weaponId: this.#weaponRuntime.definition.weaponId
    });

    const hitEnemy = findNearestEnemyState(
      this.#enemyRuntimeStates,
      shotOrigin,
      shotDirection,
      this.#config.targeting.hitRadius
    );

    if (hitEnemy !== null) {
      this.#weaponRuntime.recordConfirmedHit();
      setEnemyDowned(hitEnemy, this.#config);
      this.#combatSession.recordShotOutcome({
        hitConfirmed: true,
        killConfirmed: true
      });
      this.#emitGameplaySignal?.({
        enemyId: hitEnemy.renderState.id,
        type: "enemy-hit-confirmed"
      });
      this.#setFeedback(
        "hit",
        hitEnemy.renderState.id,
        hitEnemy.renderState.label,
        nowMs
      );
    } else {
      this.#combatSession.recordShotOutcome({
        hitConfirmed: false,
        killConfirmed: false
      });
      this.#setFeedback("miss", null, null, nowMs);
    }

    scatterEnemiesFromShot(
      this.#enemyRuntimeStates,
      this.#config,
      shotOrigin,
      shotDirection
    );
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
    trackingState: LocalArenaHudSnapshot["trackingState"],
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

    const targetedEnemy = findNearestEnemyState(
      this.#enemyRuntimeStates,
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
    this.#feedbackEnemyId = targetedEnemy.renderState.id;
    this.#feedbackEnemyLabel = targetedEnemy.renderState.label;
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
