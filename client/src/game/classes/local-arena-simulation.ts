import {
  AffineAimTransform,
  createNormalizedViewportPoint,
  type AffineAimTransformSnapshot,
  type NormalizedViewportPoint
} from "@thumbshooter/shared";

import { localArenaSimulationConfig } from "../config/local-arena-simulation";
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
} from "../states/local-arena-enemy-field";
import type { GameplaySignal } from "../types/gameplay-signal";
import type { LatestHandTrackingSnapshot } from "../types/hand-tracking";
import type {
  LocalArenaEnemyRenderState,
  LocalArenaHudSnapshot,
  LocalArenaSimulationConfig,
  LocalArenaTargetFeedbackSnapshot,
  LocalArenaTargetFeedbackState,
  LocalArenaWeaponSnapshot
} from "../types/local-arena-simulation";
import { LocalCombatSession } from "./local-combat-session";
import { WeaponRuntime } from "./weapon-runtime";

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
}

interface ProjectedAimPoint {
  readonly aimPoint: NormalizedViewportPoint | null;
  readonly isReticleOffscreen: boolean;
}

export class LocalArenaSimulation {
  readonly #affineAimTransform: AffineAimTransform;
  readonly #combatSession: LocalCombatSession;
  readonly #config: LocalArenaSimulationConfig;
  readonly #enemyRenderStates: readonly LocalArenaEnemyRenderState[];
  readonly #enemyRuntimeStates: readonly LocalArenaEnemyRuntimeState[];
  readonly #emitGameplaySignal: ((signal: GameplaySignal) => void) | null;
  readonly #weaponRuntime: WeaponRuntime;

  #feedbackEnemyId: string | null = null;
  #feedbackEnemyLabel: string | null = null;
  #feedbackHoldUntilMs = 0;
  #feedbackState: LocalArenaTargetFeedbackState = "tracking-lost";
  #hudSnapshot: LocalArenaHudSnapshot;
  #lastStepAtMs: number | null = null;
  #worldTimeMs = 0;

  constructor(
    aimCalibration: AffineAimTransformSnapshot,
    config: LocalArenaSimulationConfig = localArenaSimulationConfig,
    dependencies: LocalArenaSimulationDependencies = {}
  ) {
    this.#affineAimTransform = AffineAimTransform.fromSnapshot(aimCalibration);
    this.#config = config;
    this.#emitGameplaySignal = dependencies.emitGameplaySignal ?? null;
    this.#combatSession = new LocalCombatSession(
      config.enemySeeds.length,
      config.session
    );
    this.#weaponRuntime = new WeaponRuntime(config.weapon);

    const enemyField = createEnemyField(config);

    this.#enemyRuntimeStates = enemyField.enemyRuntimeStates;
    this.#enemyRenderStates = enemyField.enemyRenderStates;
    this.#hudSnapshot = this.#buildHudSnapshot("unavailable", null);
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
    nowMs: number = readNowMs()
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
    const triggerPressed =
      trackingSnapshot.trackingState === "tracked"
        ? this.#readTriggerPressed(trackingSnapshot)
        : false;
    const sessionPhase = this.#combatSession.beginFrame(safeNowMs).phase;
    const sessionActive = sessionPhase === "active";
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
        projectedAimPoint.aimPoint.x,
        projectedAimPoint.aimPoint.y
      );
    }

    if (weaponFrame.fired && projectedAimPoint.aimPoint !== null) {
      this.#resolveShot(
        projectedAimPoint.aimPoint.x,
        projectedAimPoint.aimPoint.y,
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
    this.#feedbackEnemyId = null;
    this.#feedbackEnemyLabel = null;
    this.#feedbackHoldUntilMs = 0;
    this.#feedbackState = "tracking-lost";
    this.#lastStepAtMs = null;
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
      this.#combatSession.snapshot,
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
    const thumbDropDistance =
      trackingSnapshot.pose.thumbTip.y - trackingSnapshot.pose.indexTip.y;

    return this.#weaponRuntime.triggerHeld
      ? thumbDropDistance >= this.#config.trigger.releaseThreshold
      : thumbDropDistance >= this.#config.trigger.pressThreshold;
  }

  #resolveShot(aimX: number, aimY: number, nowMs: number): void {
    this.#emitGameplaySignal?.({
      type: "weapon-fired",
      weaponId: this.#weaponRuntime.definition.weaponId
    });

    const hitEnemy = findNearestEnemyState(
      this.#enemyRuntimeStates,
      aimX,
      aimY,
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

    scatterEnemiesFromShot(this.#enemyRuntimeStates, this.#config, aimX, aimY);
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
      aimPoint.x,
      aimPoint.y,
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
    const rawAimPoint = this.#affineAimTransform.projectUnclamped(
      trackingSnapshot.pose.indexTip
    );
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
