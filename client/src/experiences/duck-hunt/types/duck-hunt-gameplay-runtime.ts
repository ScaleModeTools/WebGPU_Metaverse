import type {
  Degrees,
  NormalizedViewportPoint,
  Radians
} from "@webgpu-metaverse/shared";

import type { HandTrackingPoseState } from "../../../tracking";
import type { GameplayReticleStyledState } from "./duck-hunt-gameplay-presentation";
import type { GameplaySessionSnapshot } from "./duck-hunt-gameplay-session";
import type {
  LocalArenaArenaSnapshot,
  LocalArenaTargetFeedbackSnapshot,
  LocalArenaWeaponSnapshot
} from "./duck-hunt-local-arena-simulation";

export const gameplayRuntimeLifecycleStates = [
  "idle",
  "booting",
  "running",
  "failed"
] as const;

export type GameplayRuntimeLifecycleState =
  (typeof gameplayRuntimeLifecycleStates)[number];

export interface GameplayArenaHudSnapshot {
  readonly aimPoint: NormalizedViewportPoint | null;
  readonly arena: LocalArenaArenaSnapshot;
  readonly session: GameplaySessionSnapshot;
  readonly targetFeedback: LocalArenaTargetFeedbackSnapshot;
  readonly trackingState: HandTrackingPoseState;
  readonly weapon: LocalArenaWeaponSnapshot;
}

export interface GameplayHudSnapshot extends GameplayArenaHudSnapshot {
  readonly failureReason: string | null;
  readonly lifecycle: GameplayRuntimeLifecycleState;
}

export interface GameplayViewportSnapshot {
  readonly height: number;
  readonly width: number;
}

export interface GameplayVector3Snapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface GameplayCameraSnapshot {
  readonly aimDirection: GameplayVector3Snapshot;
  readonly lookDirection: GameplayVector3Snapshot;
  readonly pitchRadians: Radians;
  readonly position: GameplayVector3Snapshot;
  readonly yawRadians: Radians;
}

export interface GameplayRuntimeConfig {
  readonly camera: {
    readonly far: number;
    readonly fieldOfViewDegrees: Degrees;
    readonly near: number;
  };
  readonly enemies: {
    readonly bodyColor: readonly [number, number, number];
    readonly bodySize: {
      readonly height: number;
      readonly width: number;
    };
    readonly downedColor: readonly [number, number, number];
    readonly scatterColor: readonly [number, number, number];
    readonly wingColor: readonly [number, number, number];
    readonly wingSize: {
      readonly height: number;
      readonly width: number;
    };
    readonly wingSweepRadians: Radians;
  };
  readonly environment: {
    readonly domeRadius: number;
    readonly fogColor: readonly [number, number, number];
    readonly fogDensity: number;
    readonly horizonColor: readonly [number, number, number];
    readonly sunColor: readonly [number, number, number];
    readonly sunDirection: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly zenithColor: readonly [number, number, number];
  };
  readonly ocean: {
    readonly emissiveColor: readonly [number, number, number];
    readonly farColor: readonly [number, number, number];
    readonly height: number;
    readonly nearColor: readonly [number, number, number];
    readonly planeDepth: number;
    readonly planeWidth: number;
    readonly roughness: number;
    readonly segmentCount: number;
    readonly waveAmplitude: number;
    readonly waveFrequencies: {
      readonly primary: number;
      readonly ripple: number;
      readonly secondary: number;
    };
    readonly waveSpeeds: {
      readonly primary: number;
      readonly ripple: number;
      readonly secondary: number;
    };
  };
  readonly reticle: {
    readonly depth: number;
    readonly haloInnerRadius: number;
    readonly haloOuterRadius: number;
    readonly innerRadius: number;
    readonly outerRadius: number;
    readonly horizontalBarSize: {
      readonly width: number;
      readonly height: number;
    };
    readonly stateStyles: Record<
      GameplayReticleStyledState,
      {
        readonly haloOpacity: number;
        readonly scale: number;
        readonly strokeColor: readonly [number, number, number];
        readonly strokeOpacity: number;
      }
    >;
    readonly verticalBarSize: {
      readonly width: number;
      readonly height: number;
    };
  };
}
