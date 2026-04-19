import {
  metaverseUnmountedPlayerLookConstraintBounds,
} from "@webgpu-metaverse/shared";
import { resolveMetaverseWorldPlacedWaterRegions } from "@webgpu-metaverse/shared/metaverse/world";
import { shellDefaultEnvironmentPresentationProfile } from "../render/environment/profiles";
import { resolveDefaultMetaverseWorldBundleId } from "../world/bundle-registry";
import { loadMetaverseMapBundle, resolveMetaversePortalConfigsFromBundle } from "../world/map-bundles";
import type { MetaverseRuntimeConfig } from "../types/runtime-config";

const metaverseGroundedFirstPersonFaceClearanceMeters = 0.12;
const metaverseGroundedFirstPersonHeadClearanceMeters = 0.05;
const metaverseGroundedFirstPersonHeadOcclusionRadiusMeters = 0.18;

function createMetaverseRuntimeSharedConfig(
  bundleId: string
): Omit<MetaverseRuntimeConfig, "portals"> {
  const loadedBundle = loadMetaverseMapBundle(bundleId);
  const defaultSpawnNode = loadedBundle.bundle.playerSpawnNodes[0];
  const environmentPresentationProfile =
    loadedBundle.environmentPresentationProfile ??
    shellDefaultEnvironmentPresentationProfile;
  const gameplayProfile = loadedBundle.gameplayProfile;

  if (defaultSpawnNode === undefined) {
    throw new Error(
      `Metaverse map bundle ${bundleId} requires at least one player spawn node.`
    );
  }

  return {
    camera: {
      far: 420,
      fieldOfViewDegrees: 62,
      initialPitchRadians: -0.08,
      initialYawRadians: defaultSpawnNode.yawRadians,
      near: 0.1,
      spawnPosition: {
        x: defaultSpawnNode.position.x,
        y: defaultSpawnNode.position.y + 1.62,
        z: defaultSpawnNode.position.z - 0.24
      }
    },
    bodyPresentation: {
      groundedFirstPersonHeadClearanceMeters:
        metaverseGroundedFirstPersonHeadClearanceMeters,
      groundedFirstPersonHeadOcclusionRadiusMeters:
        metaverseGroundedFirstPersonHeadOcclusionRadiusMeters,
      groundedFirstPersonForwardOffsetMeters:
        metaverseGroundedFirstPersonFaceClearanceMeters,
      swimIdleBodySubmersionDepthMeters: 1.02,
      swimMovingBodySubmersionDepthMeters: 0.94,
      swimThirdPersonFollowDistanceMeters: 2.8,
      swimThirdPersonHeightOffsetMeters: 0.52
    },
    environment: {
      ...environmentPresentationProfile.environment
    },
    movement: {
      baseSpeedUnitsPerSecond: 14,
      boostMultiplier: 2.15,
      maxAltitude: 22,
      minAltitude: 2.25,
      worldRadius: gameplayProfile.worldRadius
    },
    waterRegionSnapshots: resolveMetaverseWorldPlacedWaterRegions(
      loadedBundle.bundle.waterRegions
    ),
    groundedBody: {
      ...gameplayProfile.groundedBodyTraversal,
      eyeHeightMeters: 1.62,
      spawnPosition: defaultSpawnNode.position
    },
    orientation: {
      maxPitchRadians:
        metaverseUnmountedPlayerLookConstraintBounds.maxPitchRadians,
      maxTurnSpeedRadiansPerSecond:
        gameplayProfile.groundedBodyTraversal.maxTurnSpeedRadiansPerSecond,
      minPitchRadians:
        metaverseUnmountedPlayerLookConstraintBounds.minPitchRadians,
      mouseEdgeTurn: {
        deadZoneViewportFraction: 0.2,
        responseExponent: 1.55
      }
    },
    ocean: {
      ...environmentPresentationProfile.ocean
    },
    traversal: {
      groundedJumpSupportVerticalSpeedTolerance:
        gameplayProfile.groundedJumpSupportVerticalSpeedTolerance
    },
    skiff: {
      ...gameplayProfile.vehicleTraversal,
      authoritativeCorrection: {
        grossSnapDistanceThresholdMeters: 3.5,
        grossSnapYawThresholdRadians: 0.75,
        routineBlendAlpha: 0.35,
        routinePositionBlendThresholdMeters: 0.9,
        routineYawBlendThresholdRadians: 0.18
      },
      cameraFollowDistanceMeters: 3.2,
      cameraHeightOffsetMeters: 0.92,
      cameraEyeHeightMeters: 1.74
    },
    swim: {
      ...gameplayProfile.swimTraversal,
      cameraEyeHeightMeters: 1.38
    }
  };
}

export function createMetaverseRuntimeConfig(
  bundleId = resolveDefaultMetaverseWorldBundleId()
): MetaverseRuntimeConfig {
  const loadedBundle = loadMetaverseMapBundle(bundleId);

  return Object.freeze({
    ...createMetaverseRuntimeSharedConfig(bundleId),
    portals: resolveMetaversePortalConfigsFromBundle(loadedBundle.bundle)
  });
}

export const metaverseRuntimeConfig = createMetaverseRuntimeConfig();
