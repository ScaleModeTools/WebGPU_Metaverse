import {
  metaverseWorldGroundedSpawnPosition,
  metaverseWorldInitialYawRadians
} from "@webgpu-metaverse/shared";

import type { MetaverseBootCinematicConfig } from "../types/metaverse-boot-cinematic";

function resolveBooleanEnvFlag(rawValue: string | undefined): boolean | null {
  if (rawValue === undefined) {
    return null;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  if (normalizedValue === "1" || normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "0" || normalizedValue === "false") {
    return false;
  }

  return null;
}

function resolvePositiveDurationMs(
  rawValue: string | undefined,
  fallback: number
): number {
  if (rawValue === undefined) {
    return fallback;
  }

  const parsedValue = Number(rawValue.trim());

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return fallback;
  }

  return parsedValue;
}

export const metaverseBootCinematicConfig = Object.freeze({
  enabled:
    resolveBooleanEnvFlag(
      import.meta.env?.VITE_METAVERSE_BOOT_CINEMATIC_ENABLED
    ) ?? false,
  minimumDwellMs: resolvePositiveDurationMs(
    import.meta.env?.VITE_METAVERSE_BOOT_CINEMATIC_MIN_DWELL_MS,
    1600
  ),
  shots: Object.freeze([
    Object.freeze({
      durationMs: 950,
      highlightPortalExperienceId: "duck-hunt",
      id: "range-overview",
      pitchRadians: -0.18,
      position: Object.freeze({
        x: metaverseWorldGroundedSpawnPosition.x + 2.6,
        y: 6.8,
        z: metaverseWorldGroundedSpawnPosition.z + 11.8
      }),
      requiresEnvironment: true,
      yawRadians: metaverseWorldInitialYawRadians + 0.1
    }),
    Object.freeze({
      durationMs: 900,
      highlightPortalExperienceId: "duck-hunt",
      id: "portal-lane",
      pitchRadians: -0.12,
      position: Object.freeze({
        x: metaverseWorldGroundedSpawnPosition.x - 1.4,
        y: 4.6,
        z: metaverseWorldGroundedSpawnPosition.z + 6.8
      }),
      requiresEnvironment: true,
      yawRadians: metaverseWorldInitialYawRadians
    }),
    Object.freeze({
      durationMs: 850,
      highlightPortalExperienceId: "duck-hunt",
      id: "range-handoff",
      pitchRadians: -0.08,
      position: Object.freeze({
        x: metaverseWorldGroundedSpawnPosition.x,
        y: 2.22,
        z: metaverseWorldGroundedSpawnPosition.z - 0.24
      }),
      requiresEnvironment: true,
      yawRadians: metaverseWorldInitialYawRadians
    })
  ])
} as const satisfies MetaverseBootCinematicConfig);
