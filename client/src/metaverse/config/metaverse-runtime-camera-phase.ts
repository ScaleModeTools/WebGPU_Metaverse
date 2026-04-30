import type { MetaverseRuntimeCameraPhaseConfig } from "../types/metaverse-runtime-camera-phase";

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

function resolvePositiveNumber(
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

function resolveFiniteNumber(
  rawValue: string | undefined,
  fallback: number
): number {
  if (rawValue === undefined) {
    return fallback;
  }

  const parsedValue = Number(rawValue.trim());

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return parsedValue;
}

export const metaverseRuntimeCameraPhaseConfig = Object.freeze({
  entryPreview: Object.freeze({
    enabled:
      resolveBooleanEnvFlag(
        import.meta.env?.VITE_METAVERSE_ENTRY_PREVIEW_ENABLED
      ) ?? true,
    framingPadding: resolvePositiveNumber(
      import.meta.env?.VITE_METAVERSE_ENTRY_PREVIEW_FRAMING_PADDING,
      1.35
    ),
    minDistanceMeters: resolvePositiveNumber(
      import.meta.env?.VITE_METAVERSE_ENTRY_PREVIEW_MIN_DISTANCE_METERS,
      16
    ),
    minHeightMeters: resolvePositiveNumber(
      import.meta.env?.VITE_METAVERSE_ENTRY_PREVIEW_MIN_HEIGHT_METERS,
      10
    ),
    minimumDwellMs: resolvePositiveNumber(
      import.meta.env?.VITE_METAVERSE_ENTRY_PREVIEW_MIN_DWELL_MS,
      1200
    ),
    orbitAngularSpeedRadiansPerSecond: resolveFiniteNumber(
      import.meta.env?.VITE_METAVERSE_ENTRY_PREVIEW_ORBIT_SPEED_RADIANS_PER_SECOND,
      0.085
    ),
    pitchRadians: resolveFiniteNumber(
      import.meta.env?.VITE_METAVERSE_ENTRY_PREVIEW_PITCH_RADIANS,
      -0.72
    )
  })
} as const satisfies MetaverseRuntimeCameraPhaseConfig);
