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
    ) ?? Boolean(import.meta.env?.DEV ?? false),
  minimumDwellMs: resolvePositiveDurationMs(
    import.meta.env?.VITE_METAVERSE_BOOT_CINEMATIC_MIN_DWELL_MS,
    1600
  ),
  shots: Object.freeze([
    Object.freeze({
      durationMs: 1200,
      highlightPortalExperienceId: "duck-hunt",
      id: "portal-establishing",
      pitchRadians: -0.08,
      position: Object.freeze({
        x: 0,
        y: 6.9,
        z: 24
      }),
      requiresEnvironment: false,
      yawRadians: 0
    }),
    Object.freeze({
      durationMs: 1350,
      highlightPortalExperienceId: null,
      id: "dock-overlook",
      pitchRadians: -0.24,
      position: Object.freeze({
        x: -1.6,
        y: 8.2,
        z: 6.5
      }),
      requiresEnvironment: true,
      yawRadians: -0.58
    }),
    Object.freeze({
      durationMs: 1200,
      highlightPortalExperienceId: "duck-hunt",
      id: "harbor-handoff",
      pitchRadians: -0.1,
      position: Object.freeze({
        x: 1.4,
        y: 7.2,
        z: 21.5
      }),
      requiresEnvironment: true,
      yawRadians: -0.04
    })
  ])
} as const satisfies MetaverseBootCinematicConfig);
