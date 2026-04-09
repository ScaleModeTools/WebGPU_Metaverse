import { createMilliseconds } from "@webgpu-metaverse/shared";

import type { LocalCombatSessionConfig } from "../types/duck-hunt-local-combat-session";

export const duckHuntLocalCombatSessionConfig = {
  durationLossPerRoundMs: createMilliseconds(1_000),
  minimumRoundDurationMs: createMilliseconds(12_000),
  roundDurationMs: createMilliseconds(20_000),
  scorePerKill: 100
} as const satisfies LocalCombatSessionConfig;
