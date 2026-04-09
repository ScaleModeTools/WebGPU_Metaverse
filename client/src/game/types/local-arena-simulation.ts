import type {
  Milliseconds,
  NormalizedViewportPoint,
  Radians
} from "@webgpu-metaverse/shared";

import type { HandTrackingPoseState } from "../../tracking";
import type {
  SinglePlayerGameplaySessionSnapshot
} from "./gameplay-session";
import type {
  LocalCombatSessionConfig,
} from "./local-combat-session";
import type { WeaponDefinition, WeaponHudSnapshot } from "./weapon-contract";

export const localArenaEnemyBehaviorStates = [
  "glide",
  "scatter",
  "downed"
] as const;
export const localArenaTargetFeedbackStates = [
  "tracking-lost",
  "offscreen",
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
  readonly orbitRadius: number;
  readonly spawn: {
    readonly altitude: number;
    readonly azimuthRadians: Radians;
  };
  readonly glideVelocity: {
    readonly altitudeUnitsPerSecond: number;
    readonly azimuthRadiansPerSecond: number;
  };
  readonly radius: number;
  readonly scale: number;
  readonly wingSpeed: number;
}

export interface LocalArenaEnemyRenderState {
  readonly behavior: LocalArenaEnemyBehaviorState;
  readonly headingRadians: Radians;
  readonly id: string;
  readonly label: string;
  readonly positionX: number;
  readonly positionY: number;
  readonly positionZ: number;
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

export type LocalArenaWeaponSnapshot = WeaponHudSnapshot;

export interface LocalArenaTargetFeedbackSnapshot {
  readonly enemyId: string | null;
  readonly enemyLabel: string | null;
  readonly state: LocalArenaTargetFeedbackState;
}

export interface LocalArenaHudSnapshot {
  readonly aimPoint: NormalizedViewportPoint | null;
  readonly arena: LocalArenaArenaSnapshot;
  readonly session: SinglePlayerGameplaySessionSnapshot;
  readonly targetFeedback: LocalArenaTargetFeedbackSnapshot;
  readonly trackingState: HandTrackingPoseState;
  readonly weapon: LocalArenaWeaponSnapshot;
}

export interface LocalArenaSimulationConfig {
  readonly birdAltitudeBounds: {
    readonly max: number;
    readonly min: number;
  };
  readonly camera: {
    readonly initialPitchRadians: Radians;
    readonly initialYawRadians: Radians;
    readonly lookBounds: {
      readonly maxPitchRadians: Radians;
      readonly minPitchRadians: Radians;
    };
    readonly lookMotion: {
      readonly deadZoneViewportFraction: number;
      readonly maxSpeedRadiansPerSecond: number;
      readonly responseExponent: number;
    };
    readonly position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
  };
  readonly enemySeeds: readonly LocalArenaEnemySeed[];
  readonly feedback: {
    readonly holdDurationMs: Milliseconds;
  };
  readonly movement: {
    readonly downedDriftSpeed: number;
    readonly maxStepMs: Milliseconds;
    readonly downedFallSpeed: number;
    readonly scatterAltitudeSpeed: number;
    readonly scatterAngularSpeed: number;
    readonly scatterDurationMs: Milliseconds;
    readonly downedDurationMs: Milliseconds;
  };
  readonly session: LocalCombatSessionConfig;
  readonly targeting: {
    readonly acquireRadius: number;
    readonly hitRadius: number;
    readonly reticleScatterRadius: number;
    readonly shotScatterRadius: number;
  };
  readonly weapon: WeaponDefinition;
}
