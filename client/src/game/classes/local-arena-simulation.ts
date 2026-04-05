import {
  AffineAimTransform,
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

function freezeWeaponSnapshot(
  weaponId: LocalArenaWeaponSnapshot["weaponId"],
  shotsFired: number,
  hitsLanded: number,
  triggerHeld: boolean,
  isFireReady: boolean,
  cooldownRemainingMs: number
): LocalArenaWeaponSnapshot {
  return Object.freeze({
    cooldownRemainingMs,
    hitsLanded,
    isFireReady,
    requiresTriggerReset: triggerHeld,
    shotsFired,
    triggerHeld,
    weaponId
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

export class LocalArenaSimulation {
  readonly #affineAimTransform: AffineAimTransform;
  readonly #combatSession: LocalCombatSession;
  readonly #config: LocalArenaSimulationConfig;
  readonly #enemyRenderStates: readonly LocalArenaEnemyRenderState[];
  readonly #enemyRuntimeStates: readonly LocalArenaEnemyRuntimeState[];
  readonly #emitGameplaySignal: ((signal: GameplaySignal) => void) | null;

  #feedbackEnemyId: string | null = null;
  #feedbackEnemyLabel: string | null = null;
  #feedbackHoldUntilMs = 0;
  #feedbackState: LocalArenaTargetFeedbackState = "tracking-lost";
  #hudSnapshot: LocalArenaHudSnapshot;
  #lastStepAtMs: number | null = null;
  #nextFireAtMs = 0;
  #shotsFired = 0;
  #triggerHeld = false;
  #worldTimeMs = 0;
  #hitsLanded = 0;

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

    const aimPoint =
      trackingSnapshot.trackingState === "tracked"
        ? this.#affineAimTransform.apply(trackingSnapshot.pose.indexTip)
        : null;
    const triggerPressed =
      trackingSnapshot.trackingState === "tracked"
        ? this.#readTriggerPressed(trackingSnapshot)
        : false;
    const sessionPhase = this.#combatSession.beginFrame(safeNowMs).phase;
    const sessionActive = sessionPhase === "active";

    if (sessionActive && aimPoint !== null) {
      applyReticleScatter(this.#enemyRuntimeStates, this.#config, aimPoint.x, aimPoint.y);
    } else if (aimPoint === null || !sessionActive) {
      this.#triggerHeld = false;
    }

    if (
      sessionActive &&
      aimPoint !== null &&
      triggerPressed &&
      !this.#triggerHeld &&
      safeNowMs >= this.#nextFireAtMs
    ) {
      this.#resolveShot(aimPoint.x, aimPoint.y, safeNowMs);
    }

    this.#triggerHeld = sessionActive ? triggerPressed : false;

    if (sessionActive) {
      stepEnemyField(this.#enemyRuntimeStates, this.#config, deltaMs);
      this.#combatSession.syncEnemyProgress(
        countDownedEnemies(this.#enemyRuntimeStates)
      );
      this.#updateFeedback(aimPoint, safeNowMs);
    }

    this.#hudSnapshot = this.#buildHudSnapshot(
      trackingSnapshot.trackingState,
      aimPoint,
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
    this.#nextFireAtMs = 0;
    this.#shotsFired = 0;
    this.#triggerHeld =
      trackingSnapshot?.trackingState === "tracked"
        ? this.#readTriggerPressed(trackingSnapshot)
        : false;
    this.#worldTimeMs = 0;
    this.#hitsLanded = 0;

    resetEnemyField(this.#enemyRuntimeStates, this.#config);
    this.#hudSnapshot = this.#buildHudSnapshot("unavailable", null);
  }

  #buildHudSnapshot(
    trackingState: LocalArenaHudSnapshot["trackingState"],
    aimPoint: NormalizedViewportPoint | null,
    nowMs: number = this.#worldTimeMs
  ): LocalArenaHudSnapshot {
    const weapon = freezeWeaponSnapshot(
      this.#config.weapon.weaponId,
      this.#shotsFired,
      this.#hitsLanded,
      this.#triggerHeld,
      this.#combatSession.phase === "active" &&
        trackingState === "tracked" &&
        aimPoint !== null &&
        !this.#triggerHeld &&
        nowMs >= this.#nextFireAtMs,
      Math.max(0, this.#nextFireAtMs - nowMs)
    );

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

    return this.#triggerHeld
      ? thumbDropDistance >= this.#config.weapon.releaseThreshold
      : thumbDropDistance >= this.#config.weapon.pressThreshold;
  }

  #resolveShot(aimX: number, aimY: number, nowMs: number): void {
    this.#shotsFired += 1;
    this.#nextFireAtMs = nowMs + this.#config.weapon.fireCooldownMs;
    this.#emitGameplaySignal?.({
      type: "weapon-fired",
      weaponId: this.#config.weapon.weaponId
    });

    const hitEnemy = findNearestEnemyState(
      this.#enemyRuntimeStates,
      aimX,
      aimY,
      this.#config.targeting.hitRadius
    );

    if (hitEnemy !== null) {
      this.#hitsLanded += 1;
      setEnemyDowned(hitEnemy, this.#config);
      this.#combatSession.recordShotOutcome({
        hitConfirmed: true,
        killConfirmed: true
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
    this.#feedbackHoldUntilMs = nowMs + this.#config.weapon.feedbackHoldMs;
  }

  #updateFeedback(
    aimPoint: NormalizedViewportPoint | null,
    nowMs: number
  ): void {
    if (this.#feedbackHoldUntilMs > nowMs) {
      return;
    }

    if (aimPoint === null) {
      this.#feedbackState = "tracking-lost";
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
}
