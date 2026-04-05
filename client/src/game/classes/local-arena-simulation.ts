import {
  AffineAimTransform,
  type AffineAimTransformSnapshot,
  type NormalizedViewportPoint
} from "@thumbshooter/shared";

import { localArenaSimulationConfig } from "../config/local-arena-simulation";
import type { LatestHandTrackingSnapshot } from "../types/hand-tracking";
import type {
  LocalArenaArenaSnapshot,
  LocalArenaEnemyBehaviorState,
  LocalArenaEnemyRenderState,
  LocalArenaHudSnapshot,
  LocalArenaSimulationConfig,
  LocalArenaTargetFeedbackSnapshot,
  LocalArenaTargetFeedbackState,
  LocalArenaWeaponSnapshot
} from "../types/local-arena-simulation";

interface MutableEnemyRenderState {
  behavior: LocalArenaEnemyBehaviorState;
  headingRadians: number;
  id: string;
  label: string;
  positionX: number;
  positionY: number;
  radius: number;
  scale: number;
  visible: boolean;
  wingPhase: number;
}

interface LocalArenaEnemyRuntimeState {
  readonly glideScale: number;
  readonly downedScale: number;
  readonly homeVelocityX: number;
  readonly homeVelocityY: number;
  readonly renderState: MutableEnemyRenderState;
  readonly scatterScale: number;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly wingSpeed: number;
  behaviorRemainingMs: number;
  velocityX: number;
  velocityY: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function distanceSquared(
  leftX: number,
  leftY: number,
  rightX: number,
  rightY: number
): number {
  const deltaX = leftX - rightX;
  const deltaY = leftY - rightY;

  return deltaX * deltaX + deltaY * deltaY;
}

function normalizeVector(
  x: number,
  y: number,
  fallbackX: number,
  fallbackY: number
): { readonly x: number; readonly y: number } {
  const vectorLength = Math.hypot(x, y);

  if (vectorLength > 0.0001) {
    return Object.freeze({
      x: x / vectorLength,
      y: y / vectorLength
    });
  }

  const fallbackLength = Math.hypot(fallbackX, fallbackY);

  if (fallbackLength > 0.0001) {
    return Object.freeze({
      x: fallbackX / fallbackLength,
      y: fallbackY / fallbackLength
    });
  }

  return Object.freeze({
    x: 1,
    y: 0
  });
}

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
  arena: LocalArenaArenaSnapshot,
  weapon: LocalArenaWeaponSnapshot,
  targetFeedback: LocalArenaTargetFeedbackSnapshot
): LocalArenaHudSnapshot {
  return Object.freeze({
    aimPoint,
    arena,
    targetFeedback,
    trackingState,
    weapon
  });
}

function createEnemyRuntimeState(
  seed: LocalArenaSimulationConfig["enemySeeds"][number]
): LocalArenaEnemyRuntimeState {
  return {
    behaviorRemainingMs: 0,
    downedScale: seed.scale * 0.8,
    glideScale: seed.scale,
    homeVelocityX: seed.glideVelocity.x,
    homeVelocityY: seed.glideVelocity.y,
    renderState: {
      behavior: "glide",
      headingRadians: Math.atan2(seed.glideVelocity.y, seed.glideVelocity.x),
      id: seed.id,
      label: seed.label,
      positionX: seed.spawn.x,
      positionY: seed.spawn.y,
      radius: seed.radius,
      scale: seed.scale,
      visible: true,
      wingPhase: 0
    },
    scatterScale: seed.scale * 1.08,
    spawnX: seed.spawn.x,
    spawnY: seed.spawn.y,
    velocityX: seed.glideVelocity.x,
    velocityY: seed.glideVelocity.y,
    wingSpeed: seed.wingSpeed
  };
}

function readNowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

export class LocalArenaSimulation {
  readonly #affineAimTransform: AffineAimTransform;
  readonly #config: LocalArenaSimulationConfig;
  readonly #enemyRenderStates: readonly LocalArenaEnemyRenderState[];
  readonly #enemyRuntimeStates: LocalArenaEnemyRuntimeState[];

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
    config: LocalArenaSimulationConfig = localArenaSimulationConfig
  ) {
    this.#affineAimTransform = AffineAimTransform.fromSnapshot(aimCalibration);
    this.#config = config;
    this.#enemyRuntimeStates = config.enemySeeds.map((seed) =>
      createEnemyRuntimeState(seed)
    );
    this.#enemyRenderStates = this.#enemyRuntimeStates.map(
      (enemyState) => enemyState.renderState
    );
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
        : clamp(
            safeNowMs - this.#lastStepAtMs,
            0,
            this.#config.movement.maxStepMs
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

    if (aimPoint !== null) {
      this.#applyReticleScatter(aimPoint.x, aimPoint.y);
    } else {
      this.#triggerHeld = false;
    }

    if (
      aimPoint !== null &&
      triggerPressed &&
      !this.#triggerHeld &&
      safeNowMs >= this.#nextFireAtMs
    ) {
      this.#resolveShot(aimPoint.x, aimPoint.y, safeNowMs);
    }

    this.#triggerHeld = triggerPressed;
    this.#stepEnemies(deltaMs);
    this.#updateFeedback(aimPoint, safeNowMs);
    this.#hudSnapshot = this.#buildHudSnapshot(
      trackingSnapshot.trackingState,
      aimPoint,
      safeNowMs
    );

    return this.#hudSnapshot;
  }

  reset(): void {
    this.#feedbackEnemyId = null;
    this.#feedbackEnemyLabel = null;
    this.#feedbackHoldUntilMs = 0;
    this.#feedbackState = "tracking-lost";
    this.#lastStepAtMs = null;
    this.#nextFireAtMs = 0;
    this.#shotsFired = 0;
    this.#triggerHeld = false;
    this.#worldTimeMs = 0;
    this.#hitsLanded = 0;

    for (let index = 0; index < this.#enemyRuntimeStates.length; index += 1) {
      const enemyState = this.#enemyRuntimeStates[index]!;
      const seed = this.#config.enemySeeds[index]!;

      enemyState.behaviorRemainingMs = 0;
      enemyState.velocityX = enemyState.homeVelocityX;
      enemyState.velocityY = enemyState.homeVelocityY;
      enemyState.renderState.behavior = "glide";
      enemyState.renderState.headingRadians = Math.atan2(
        enemyState.homeVelocityY,
        enemyState.homeVelocityX
      );
      enemyState.renderState.positionX = seed.spawn.x;
      enemyState.renderState.positionY = seed.spawn.y;
      enemyState.renderState.scale = enemyState.glideScale;
      enemyState.renderState.visible = true;
      enemyState.renderState.wingPhase = 0;
    }

    this.#hudSnapshot = this.#buildHudSnapshot("unavailable", null);
  }

  #applyReticleScatter(aimX: number, aimY: number): void {
    const radiusSquared =
      this.#config.targeting.reticleScatterRadius *
      this.#config.targeting.reticleScatterRadius;

    for (const enemyState of this.#enemyRuntimeStates) {
      if (enemyState.renderState.behavior === "downed") {
        continue;
      }

      if (
        distanceSquared(
          enemyState.renderState.positionX,
          enemyState.renderState.positionY,
          aimX,
          aimY
        ) <= radiusSquared
      ) {
        this.#setEnemyScatter(enemyState, aimX, aimY);
      }
    }
  }

  #buildHudSnapshot(
    trackingState: LocalArenaHudSnapshot["trackingState"],
    aimPoint: NormalizedViewportPoint | null,
    nowMs: number = this.#worldTimeMs
  ): LocalArenaHudSnapshot {
    let liveEnemyCount = 0;
    let scatterEnemyCount = 0;
    let downedEnemyCount = 0;

    for (const enemyState of this.#enemyRuntimeStates) {
      if (enemyState.renderState.behavior === "downed") {
        downedEnemyCount += 1;
        continue;
      }

      liveEnemyCount += 1;

      if (enemyState.renderState.behavior === "scatter") {
        scatterEnemyCount += 1;
      }
    }

    const weapon = freezeWeaponSnapshot(
      this.#config.weapon.weaponId,
      this.#shotsFired,
      this.#hitsLanded,
      this.#triggerHeld,
      trackingState === "tracked" &&
        aimPoint !== null &&
        !this.#triggerHeld &&
        nowMs >= this.#nextFireAtMs,
      Math.max(0, this.#nextFireAtMs - nowMs)
    );

    return freezeHudSnapshot(
      trackingState,
      aimPoint,
      freezeArenaSnapshot(liveEnemyCount, scatterEnemyCount, downedEnemyCount),
      weapon,
      freezeTargetFeedbackSnapshot(
        this.#feedbackState,
        this.#feedbackEnemyId,
        this.#feedbackEnemyLabel
      )
    );
  }

  #findNearestEnemy(
    aimX: number,
    aimY: number,
    radius: number
  ): LocalArenaEnemyRuntimeState | null {
    const radiusSquared = radius * radius;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    let bestEnemy: LocalArenaEnemyRuntimeState | null = null;

    for (const enemyState of this.#enemyRuntimeStates) {
      if (enemyState.renderState.behavior === "downed") {
        continue;
      }

      const nextDistanceSquared = distanceSquared(
        enemyState.renderState.positionX,
        enemyState.renderState.positionY,
        aimX,
        aimY
      );

      if (
        nextDistanceSquared <= radiusSquared &&
        nextDistanceSquared < bestDistanceSquared
      ) {
        bestDistanceSquared = nextDistanceSquared;
        bestEnemy = enemyState;
      }
    }

    return bestEnemy;
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

    const hitEnemy = this.#findNearestEnemy(
      aimX,
      aimY,
      this.#config.targeting.hitRadius
    );

    if (hitEnemy !== null) {
      this.#hitsLanded += 1;
      this.#setEnemyDowned(hitEnemy);
      this.#setFeedback("hit", hitEnemy.renderState.id, hitEnemy.renderState.label, nowMs);
    } else {
      this.#setFeedback("miss", null, null, nowMs);
    }

    this.#scatterEnemiesFromShot(aimX, aimY);
  }

  #scatterEnemiesFromShot(aimX: number, aimY: number): void {
    const radiusSquared =
      this.#config.targeting.shotScatterRadius *
      this.#config.targeting.shotScatterRadius;

    for (const enemyState of this.#enemyRuntimeStates) {
      if (enemyState.renderState.behavior === "downed") {
        continue;
      }

      if (
        distanceSquared(
          enemyState.renderState.positionX,
          enemyState.renderState.positionY,
          aimX,
          aimY
        ) <= radiusSquared
      ) {
        this.#setEnemyScatter(enemyState, aimX, aimY);
      }
    }
  }

  #setEnemyDowned(enemyState: LocalArenaEnemyRuntimeState): void {
    enemyState.behaviorRemainingMs = this.#config.movement.downedDurationMs;
    enemyState.velocityX *= 0.35;
    enemyState.velocityY = this.#config.movement.downedDriftVelocityY;
    enemyState.renderState.behavior = "downed";
    enemyState.renderState.scale = enemyState.downedScale;
  }

  #setEnemyScatter(
    enemyState: LocalArenaEnemyRuntimeState,
    aimX: number,
    aimY: number
  ): void {
    const scatterDirection = normalizeVector(
      enemyState.renderState.positionX - aimX,
      enemyState.renderState.positionY - aimY,
      enemyState.homeVelocityX,
      enemyState.homeVelocityY
    );

    enemyState.behaviorRemainingMs = this.#config.movement.scatterDurationMs;
    enemyState.velocityX = scatterDirection.x * this.#config.movement.scatterSpeed;
    enemyState.velocityY = scatterDirection.y * this.#config.movement.scatterSpeed;
    enemyState.renderState.behavior = "scatter";
    enemyState.renderState.scale = enemyState.scatterScale;
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

  #stepEnemies(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    if (deltaSeconds <= 0) {
      return;
    }

    for (const enemyState of this.#enemyRuntimeStates) {
      enemyState.renderState.wingPhase += enemyState.wingSpeed * deltaSeconds;

      if (enemyState.renderState.behavior === "downed") {
        enemyState.behaviorRemainingMs -= deltaMs;
        enemyState.renderState.positionX = clamp(
          enemyState.renderState.positionX + enemyState.velocityX * deltaSeconds,
          this.#config.arenaBounds.minX,
          this.#config.arenaBounds.maxX
        );
        enemyState.renderState.positionY = clamp(
          enemyState.renderState.positionY + enemyState.velocityY * deltaSeconds,
          this.#config.arenaBounds.minY,
          this.#config.arenaBounds.maxY + 0.14
        );
        enemyState.renderState.headingRadians += deltaSeconds * 2.8;

        if (enemyState.behaviorRemainingMs <= 0) {
          this.#respawnEnemy(enemyState);
        }

        continue;
      }

      enemyState.renderState.positionX += enemyState.velocityX * deltaSeconds;
      enemyState.renderState.positionY += enemyState.velocityY * deltaSeconds;

      if (
        enemyState.renderState.positionX < this.#config.arenaBounds.minX ||
        enemyState.renderState.positionX > this.#config.arenaBounds.maxX
      ) {
        enemyState.velocityX *= -1;
        enemyState.renderState.positionX = clamp(
          enemyState.renderState.positionX,
          this.#config.arenaBounds.minX,
          this.#config.arenaBounds.maxX
        );
      }

      if (
        enemyState.renderState.positionY < this.#config.arenaBounds.minY ||
        enemyState.renderState.positionY > this.#config.arenaBounds.maxY
      ) {
        enemyState.velocityY *= -1;
        enemyState.renderState.positionY = clamp(
          enemyState.renderState.positionY,
          this.#config.arenaBounds.minY,
          this.#config.arenaBounds.maxY
        );
      }

      enemyState.renderState.headingRadians = Math.atan2(
        enemyState.velocityY,
        enemyState.velocityX
      );

      if (enemyState.renderState.behavior === "scatter") {
        enemyState.behaviorRemainingMs -= deltaMs;

        if (enemyState.behaviorRemainingMs <= 0) {
          this.#restoreEnemyGlide(enemyState);
        }
      }
    }
  }

  #respawnEnemy(enemyState: LocalArenaEnemyRuntimeState): void {
    enemyState.behaviorRemainingMs = 0;
    enemyState.velocityX = enemyState.homeVelocityX;
    enemyState.velocityY = enemyState.homeVelocityY;
    enemyState.renderState.behavior = "glide";
    enemyState.renderState.headingRadians = Math.atan2(
      enemyState.homeVelocityY,
      enemyState.homeVelocityX
    );
    enemyState.renderState.positionX = enemyState.spawnX;
    enemyState.renderState.positionY = enemyState.spawnY;
    enemyState.renderState.scale = enemyState.glideScale;
  }

  #restoreEnemyGlide(enemyState: LocalArenaEnemyRuntimeState): void {
    enemyState.behaviorRemainingMs = 0;
    enemyState.velocityX = enemyState.homeVelocityX;
    enemyState.velocityY = enemyState.homeVelocityY;
    enemyState.renderState.behavior = "glide";
    enemyState.renderState.headingRadians = Math.atan2(
      enemyState.homeVelocityY,
      enemyState.homeVelocityX
    );
    enemyState.renderState.scale = enemyState.glideScale;
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

    const targetedEnemy = this.#findNearestEnemy(
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
