import {
  metaverseUnmountedPlayerLookConstraintBounds,
  type MetaversePlayerId,
  type MetaversePlayerTeamId
} from "@webgpu-metaverse/shared";
import {
  resolveMetaverseMapPlayerSpawnNode,
  resolveMetaverseWorldPlacedWaterRegions,
  type MetaverseMapBundleSpawnNodeSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";
import { shellDefaultEnvironmentPresentationProfile } from "../render/environment/profiles";
import { resolveDefaultMetaverseWorldBundleId } from "../world/bundle-registry";
import { loadMetaverseMapBundle, resolveMetaversePortalConfigsFromBundle } from "../world/map-bundles";
import type { MetaverseRuntimeConfig } from "../types/runtime-config";

const metaverseGroundedFirstPersonFaceClearanceMeters = 0.12;
const metaverseGroundedFirstPersonHeadClearanceMeters = 0.05;
const metaverseGroundedFirstPersonHeadOcclusionRadiusMeters = 0.18;

function createMetaverseRuntimeSharedConfig(
  bundleId: string,
  localPlayerId: MetaversePlayerId | null,
  localPlayerTeamId: MetaversePlayerTeamId | null = null
): Omit<MetaverseRuntimeConfig, "portals"> {
  const loadedBundle = loadMetaverseMapBundle(bundleId);
  const defaultSpawnNode = resolveClientDefaultSpawnNode(
    loadedBundle.bundle.playerSpawnNodes[0] ?? null,
    {
      localPlayerId,
      localPlayerTeamId,
      loadedBundle
    }
  );
  const environmentPresentationProfile =
    loadedBundle.environmentPresentationProfile ??
    shellDefaultEnvironmentPresentationProfile;
  const gameplayProfile = loadedBundle.gameplayProfile;
  const groundedJumpPhysics = gameplayProfile.groundedJumpPhysics;

  if (defaultSpawnNode === null) {
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
      airborneMovementDampingFactor:
        groundedJumpPhysics.airborneMovementDampingFactor,
      eyeHeightMeters: 1.62,
      gravityUnitsPerSecond: groundedJumpPhysics.gravityUnitsPerSecond,
      jumpGroundContactGraceSeconds:
        groundedJumpPhysics.jumpGroundContactGraceSeconds,
      jumpImpulseUnitsPerSecond:
        groundedJumpPhysics.jumpImpulseUnitsPerSecond,
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

function resolveClientDefaultSpawnNode(
  fallbackSpawnNode: MetaverseMapBundleSpawnNodeSnapshot | null,
  {
    localPlayerId,
    localPlayerTeamId,
    loadedBundle
  }: {
    readonly localPlayerId: MetaversePlayerId | null;
    readonly localPlayerTeamId: MetaversePlayerTeamId | null;
    readonly loadedBundle: ReturnType<typeof loadMetaverseMapBundle>;
  }
): MetaverseMapBundleSpawnNodeSnapshot | null {
  if (
    fallbackSpawnNode === null ||
    localPlayerId === null ||
    localPlayerTeamId === null
  ) {
    return fallbackSpawnNode;
  }

  return (
    resolveMetaverseMapPlayerSpawnNode({
      occupiedPlayerSnapshots: Object.freeze([]),
      playerId: localPlayerId,
      playerSpawnNodes: loadedBundle.bundle.playerSpawnNodes,
      playerSpawnSelection: loadedBundle.bundle.playerSpawnSelection,
      playerTeamId: localPlayerTeamId
    }) ?? fallbackSpawnNode
  );
}

export function createMetaverseRuntimeConfig(
  bundleId = resolveDefaultMetaverseWorldBundleId(),
  localPlayerId: MetaversePlayerId | null = null,
  localPlayerTeamId: MetaversePlayerTeamId | null = null
): MetaverseRuntimeConfig {
  const loadedBundle = loadMetaverseMapBundle(bundleId);

  return Object.freeze({
    ...createMetaverseRuntimeSharedConfig(
      bundleId,
      localPlayerId,
      localPlayerTeamId
    ),
    portals: resolveMetaversePortalConfigsFromBundle(loadedBundle.bundle)
  });
}

export const metaverseRuntimeConfig = createMetaverseRuntimeConfig();
