import {
  createMilliseconds,
  metaverseRealtimeWorldCadenceConfig
} from "@webgpu-metaverse/shared";

import type { MetaverseAuthoritativeWorldRuntimeConfig } from "../types/metaverse-authoritative-world-runtime.js";

export const metaverseAuthoritativeWorldCadenceConfig = Object.freeze({
  tickIntervalMs: metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs
});

export const metaverseAuthoritativeWorldRuntimeConfig = {
  playerInactivityTimeoutMs: createMilliseconds(10_000),
  tickIntervalMs: metaverseAuthoritativeWorldCadenceConfig.tickIntervalMs
} as const satisfies MetaverseAuthoritativeWorldRuntimeConfig;
