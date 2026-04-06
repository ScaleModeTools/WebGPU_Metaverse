import type {
  NormalizedViewportPoint,
  NormalizedViewportPointInput
} from "@thumbshooter/shared";

import type { HandTrackingPoseState } from "./hand-tracking";
import type { LocalCombatSessionPhase } from "./local-combat-session";
import type { LocalArenaTargetFeedbackState } from "./local-arena-simulation";
import type { WeaponReadinessState } from "./weapon-contract";

export const gameplayDebugPanelModes = [
  "hidden",
  "telemetry",
  "aim-inspector"
] as const;
export const gameplayReticleStyledStates = [
  "tracking-unavailable",
  "neutral",
  "targeted",
  "hit",
  "reload-required",
  "reloading",
  "round-paused"
] as const;
export const gameplayReticleVisualStates = [
  "hidden",
  ...gameplayReticleStyledStates
] as const;

export type GameplayDebugPanelMode = (typeof gameplayDebugPanelModes)[number];
export type GameplayReticleStyledState =
  (typeof gameplayReticleStyledStates)[number];
export type GameplayReticleVisualState =
  (typeof gameplayReticleVisualStates)[number];

export interface HandTrackingTelemetrySnapshot {
  readonly framesDispatched: number;
  readonly framesProcessed: number;
  readonly inFlightFrameSkips: number;
  readonly latestPoseAgeMs: number | null;
  readonly latestSequenceNumber: number;
  readonly staleSnapshotsIgnored: number;
  readonly trackingState: HandTrackingPoseState;
  readonly workerLatencyMs: number | null;
}

export interface GameplayTelemetrySnapshot {
  readonly aimPoint: NormalizedViewportPoint | null;
  readonly frameDeltaMs: number;
  readonly frameRate: number;
  readonly observedAimPoint: NormalizedViewportPointInput | null;
  readonly renderedFrameCount: number;
  readonly reticleVisualState: GameplayReticleVisualState;
  readonly sessionPhase: LocalCombatSessionPhase;
  readonly targetFeedbackState: LocalArenaTargetFeedbackState;
  readonly thumbDropDistance: number | null;
  readonly trackingPoseAgeMs: number | null;
  readonly trackingSequenceNumber: number;
  readonly weaponReadiness: WeaponReadinessState;
  readonly worldTimeMs: number;
}
