import type {
  FirstPlayableWeaponId
} from "./game-foundation";
import type { HandTrackingPoseState } from "./hand-tracking";
import type { NormalizedViewportPoint } from "@thumbshooter/shared";

export const localArenaEnemyBehaviorStates = [
  "glide",
  "scatter",
  "downed"
] as const;
export const localArenaTargetFeedbackStates = [
  "tracking-lost",
  "clear",
  "targeted",
  "hit",
  "miss"
] as const;

export type LocalArenaEnemyBehaviorState =
  (typeof localArenaEnemyBehaviorStates)[number];
export type LocalArenaTargetFeedbackState =
  (typeof localArenaTargetFeedbackStates)[number];

export interface LocalArenaEnemySeed {
  readonly id: string;
  readonly label: string;
  readonly spawn: {
    readonly x: number;
    readonly y: number;
  };
  readonly glideVelocity: {
    readonly x: number;
    readonly y: number;
  };
  readonly radius: number;
  readonly scale: number;
  readonly wingSpeed: number;
}

export interface LocalArenaEnemyRenderState {
  readonly behavior: LocalArenaEnemyBehaviorState;
  readonly headingRadians: number;
  readonly id: string;
  readonly label: string;
  readonly positionX: number;
  readonly positionY: number;
  readonly radius: number;
  readonly scale: number;
  readonly visible: boolean;
  readonly wingPhase: number;
}

export interface LocalArenaArenaSnapshot {
  readonly downedEnemyCount: number;
  readonly liveEnemyCount: number;
  readonly scatterEnemyCount: number;
}

export interface LocalArenaWeaponSnapshot {
  readonly cooldownRemainingMs: number;
  readonly hitsLanded: number;
  readonly isFireReady: boolean;
  readonly requiresTriggerReset: boolean;
  readonly shotsFired: number;
  readonly triggerHeld: boolean;
  readonly weaponId: FirstPlayableWeaponId;
}

export interface LocalArenaTargetFeedbackSnapshot {
  readonly enemyId: string | null;
  readonly enemyLabel: string | null;
  readonly state: LocalArenaTargetFeedbackState;
}

export interface LocalArenaHudSnapshot {
  readonly aimPoint: NormalizedViewportPoint | null;
  readonly arena: LocalArenaArenaSnapshot;
  readonly targetFeedback: LocalArenaTargetFeedbackSnapshot;
  readonly trackingState: HandTrackingPoseState;
  readonly weapon: LocalArenaWeaponSnapshot;
}

export interface LocalArenaSimulationConfig {
  readonly arenaBounds: {
    readonly maxX: number;
    readonly maxY: number;
    readonly minX: number;
    readonly minY: number;
  };
  readonly enemySeeds: readonly LocalArenaEnemySeed[];
  readonly movement: {
    readonly downedDriftVelocityY: number;
    readonly maxStepMs: number;
    readonly scatterDurationMs: number;
    readonly scatterSpeed: number;
    readonly downedDurationMs: number;
  };
  readonly targeting: {
    readonly acquireRadius: number;
    readonly hitRadius: number;
    readonly reticleScatterRadius: number;
    readonly shotScatterRadius: number;
  };
  readonly weapon: {
    readonly feedbackHoldMs: number;
    readonly fireCooldownMs: number;
    readonly pressThreshold: number;
    readonly releaseThreshold: number;
    readonly weaponId: FirstPlayableWeaponId;
  };
}
