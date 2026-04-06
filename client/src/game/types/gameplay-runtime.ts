import type {
  NormalizedViewportPoint
} from "@thumbshooter/shared";

import type { GameplayReticleStyledState } from "./gameplay-presentation";
import type { HandTrackingPoseState } from "./hand-tracking";
import type { LocalCombatSessionSnapshot } from "./local-combat-session";
import type {
  LocalArenaArenaSnapshot,
  LocalArenaTargetFeedbackSnapshot,
  LocalArenaWeaponSnapshot
} from "./local-arena-simulation";

export const gameplayRuntimeLifecycleStates = [
  "idle",
  "booting",
  "running",
  "failed"
] as const;

export type GameplayRuntimeLifecycleState =
  (typeof gameplayRuntimeLifecycleStates)[number];

export interface GameplayHudSnapshot {
  readonly aimPoint: NormalizedViewportPoint | null;
  readonly arena: LocalArenaArenaSnapshot;
  readonly failureReason: string | null;
  readonly lifecycle: GameplayRuntimeLifecycleState;
  readonly session: LocalCombatSessionSnapshot;
  readonly targetFeedback: LocalArenaTargetFeedbackSnapshot;
  readonly trackingState: HandTrackingPoseState;
  readonly weapon: LocalArenaWeaponSnapshot;
}

export interface GameplayRuntimeConfig {
  readonly background: {
    readonly lowerColor: readonly [number, number, number];
    readonly upperColor: readonly [number, number, number];
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
    readonly wingSweepRadians: number;
  };
  readonly reticle: {
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
