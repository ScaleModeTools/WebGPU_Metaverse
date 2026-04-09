import { createMilliseconds } from "@thumbshooter/shared";

import type { LocalCombatSessionConfig } from "../../../game/types/local-combat-session";

export const duckHuntLocalCombatSessionConfig = {
  durationLossPerRoundMs: createMilliseconds(1_000),
  minimumRoundDurationMs: createMilliseconds(12_000),
  roundDurationMs: createMilliseconds(20_000),
  scorePerKill: 100
} as const satisfies LocalCombatSessionConfig;
