import type {
  FocusedExperiencePortalSnapshot,
  MetaverseCameraSnapshot,
  MetaversePortalConfig
} from "../types/metaverse-runtime";
import type {
  MetaverseBootCinematicConfig,
  MetaverseBootCinematicShotConfig
} from "../types/metaverse-boot-cinematic";
import { directionFromYawPitch } from "./metaverse-flight";

export interface MetaverseBootCinematicAvailability {
  readonly environmentReady: boolean;
}

export interface MetaverseBootCinematicPresentationSnapshot {
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
  readonly shot: MetaverseBootCinematicShotConfig;
}

function resolveAvailableShots(
  config: MetaverseBootCinematicConfig,
  availability: MetaverseBootCinematicAvailability
): readonly MetaverseBootCinematicShotConfig[] {
  const availableShots = config.shots.filter(
    (shot) => availability.environmentReady || !shot.requiresEnvironment
  );

  return availableShots.length > 0 ? availableShots : config.shots;
}

function resolveActiveShot(
  config: MetaverseBootCinematicConfig,
  elapsedMs: number,
  availability: MetaverseBootCinematicAvailability
): MetaverseBootCinematicShotConfig | null {
  const availableShots = resolveAvailableShots(config, availability);
  const clampedElapsedMs = Math.max(0, elapsedMs);
  let elapsedBudgetMs = 0;

  for (const shot of availableShots) {
    elapsedBudgetMs += Math.max(0, shot.durationMs);

    if (clampedElapsedMs < elapsedBudgetMs) {
      return shot;
    }
  }

  return availableShots[availableShots.length - 1] ?? null;
}

function createFocusedPortalSnapshot(
  cameraSnapshot: MetaverseCameraSnapshot,
  portalConfig: MetaversePortalConfig | null
): FocusedExperiencePortalSnapshot | null {
  if (portalConfig === null) {
    return null;
  }

  const dx = cameraSnapshot.position.x - portalConfig.position.x;
  const dy = cameraSnapshot.position.y - portalConfig.position.y;
  const dz = cameraSnapshot.position.z - portalConfig.position.z;

  return Object.freeze({
    distanceFromCamera: Math.hypot(dx, dy, dz),
    experienceId: portalConfig.experienceId,
    label: portalConfig.label
  });
}

export function resolveMetaverseBootCinematicPresentationSnapshot(
  config: MetaverseBootCinematicConfig,
  elapsedMs: number,
  availability: MetaverseBootCinematicAvailability,
  portals: readonly MetaversePortalConfig[]
): MetaverseBootCinematicPresentationSnapshot | null {
  if (!config.enabled) {
    return null;
  }

  const activeShot = resolveActiveShot(config, elapsedMs, availability);

  if (activeShot === null) {
    return null;
  }

  const cameraSnapshot = Object.freeze({
    lookDirection: directionFromYawPitch(
      activeShot.yawRadians,
      activeShot.pitchRadians
    ),
    pitchRadians: activeShot.pitchRadians,
    position: activeShot.position,
    yawRadians: activeShot.yawRadians
  }) satisfies MetaverseCameraSnapshot;

  return Object.freeze({
    cameraSnapshot,
    focusedPortal: createFocusedPortalSnapshot(
      cameraSnapshot,
      activeShot.highlightPortalExperienceId === null
        ? null
        : portals.find(
            (portal) =>
              portal.experienceId === activeShot.highlightPortalExperienceId
          ) ?? null
    ),
    shot: activeShot
  });
}
