import type { Milliseconds } from "@webgpu-metaverse/shared";

export const localCombatSessionPhases = [
  "active",
  "completed",
  "failed"
] as const;

export type LocalCombatSessionPhase =
  (typeof localCombatSessionPhases)[number];

export interface LocalCombatSessionSnapshot {
  readonly hitsThisSession: number;
  readonly killsThisSession: number;
  readonly phase: LocalCombatSessionPhase;
  readonly restartReady: boolean;
  readonly roundDurationMs: Milliseconds;
  readonly roundNumber: number;
  readonly roundTimeRemainingMs: Milliseconds;
  readonly score: number;
  readonly streak: number;
}

export interface LocalCombatSessionConfig {
  readonly durationLossPerRoundMs: Milliseconds;
  readonly minimumRoundDurationMs: Milliseconds;
  readonly roundDurationMs: Milliseconds;
  readonly scorePerKill: number;
}

export interface LocalCombatShotOutcome {
  readonly hitConfirmed: boolean;
  readonly killConfirmed: boolean;
}
