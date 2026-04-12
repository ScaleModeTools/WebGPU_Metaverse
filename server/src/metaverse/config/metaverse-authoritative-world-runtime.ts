import { createMilliseconds } from "@webgpu-metaverse/shared";

import type { MetaverseAuthoritativeWorldRuntimeConfig } from "../types/metaverse-authoritative-world-runtime.js";

export const metaverseAuthoritativeWorldRuntimeConfig = {
  playerInactivityTimeoutMs: createMilliseconds(10_000),
  tickIntervalMs: createMilliseconds(50)
} as const satisfies MetaverseAuthoritativeWorldRuntimeConfig;
