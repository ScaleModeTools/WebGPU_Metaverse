import {
  metaverseHubDockEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId,
  metaverseWorldGroundedSpawnPosition,
  metaverseWorldInitialYawRadians,
  metaverseWorldSurfaceAssets,
  metaverseWorldWaterRegions
} from "@webgpu-metaverse/shared";

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function requireValue(value, label) {
  if (value === undefined || value === null) {
    throw new Error(`${label} should resolve`);
  }

  return value;
}

function findSurfaceAsset(environmentAssetId) {
  return requireValue(
    metaverseWorldSurfaceAssets.find(
      (surfaceAsset) => surfaceAsset.environmentAssetId === environmentAssetId
    ),
    `${environmentAssetId} surface asset`
  );
}

function resolveClosestPlacement(surfaceAsset, targetPosition) {
  return requireValue(
    surfaceAsset.placements.reduce((closestPlacement, placement) => {
      if (closestPlacement === null) {
        return placement;
      }

      const closestDistanceSquared =
        (closestPlacement.position.x - targetPosition.x) ** 2 +
        (closestPlacement.position.z - targetPosition.z) ** 2;
      const nextDistanceSquared =
        (placement.position.x - targetPosition.x) ** 2 +
        (placement.position.z - targetPosition.z) ** 2;

      return nextDistanceSquared < closestDistanceSquared
        ? placement
        : closestPlacement;
    }, null),
    `${surfaceAsset.environmentAssetId} placement`
  );
}

function resolveSupportTopHeightMeters(surfaceAsset) {
  const supportTopHeightMeters = surfaceAsset.surfaceColliders.reduce(
    (maximumSupportTopHeightMeters, collider) => {
      if (collider.traversalAffordance !== "support") {
        return maximumSupportTopHeightMeters;
      }

      return Math.max(
        maximumSupportTopHeightMeters,
        collider.center.y + collider.size.y * 0.5
      );
    },
    Number.NEGATIVE_INFINITY
  );

  return requireValue(
    Number.isFinite(supportTopHeightMeters) ? supportTopHeightMeters : null,
    `${surfaceAsset.environmentAssetId} support top height`
  );
}

function offsetLocalPlanarPosition(position, rotationYRadians, localX, localZ, y) {
  const sine = Math.sin(rotationYRadians);
  const cosine = Math.cos(rotationYRadians);

  return freezeVector3(
    position.x + localX * cosine + localZ * sine,
    y,
    position.z - localX * sine + localZ * cosine
  );
}

function resolveFacingYawRadians(origin, target) {
  return Math.atan2(target.x - origin.x, -(target.z - origin.z));
}

const authoredWaterBayRegion = requireValue(
  metaverseWorldWaterRegions.find(
    (waterRegion) => waterRegion.waterRegionId === "metaverse-playground-water-bay-v1"
  ),
  "authored water bay region"
);
const authoredWaterBayWaterSurfaceHeightMeters =
  authoredWaterBayRegion.center.y + authoredWaterBayRegion.size.y * 0.5;
const authoredDockAsset = findSurfaceAsset(metaverseHubDockEnvironmentAssetId);
const authoredWaterBayDockPlacement = resolveClosestPlacement(
  authoredDockAsset,
  authoredWaterBayRegion.center
);
const authoredSkiffAsset = findSurfaceAsset(metaverseHubSkiffEnvironmentAssetId);
const authoredWaterBaySkiffPlacementSnapshot = resolveClosestPlacement(
  authoredSkiffAsset,
  authoredWaterBayRegion.center
);

export const authoredGroundedSpawnPosition = freezeVector3(
  metaverseWorldGroundedSpawnPosition.x,
  metaverseWorldGroundedSpawnPosition.y,
  metaverseWorldGroundedSpawnPosition.z
);
export const authoredGroundedSpawnYawRadians = metaverseWorldInitialYawRadians;
export const authoredWaterBayOpenWaterSpawn = freezeVector3(
  authoredWaterBayRegion.center.x,
  authoredWaterBayWaterSurfaceHeightMeters,
  authoredWaterBayRegion.center.z
);
export const authoredWaterBayDockEntryPosition = freezeVector3(
  authoredWaterBayDockPlacement.position.x,
  authoredWaterBayDockPlacement.position.y +
    resolveSupportTopHeightMeters(authoredDockAsset),
  authoredWaterBayDockPlacement.position.z
);
export const authoredWaterBayDockEntryYawRadians = resolveFacingYawRadians(
  authoredWaterBayDockEntryPosition,
  authoredWaterBayOpenWaterSpawn
);
export const authoredWaterBaySkiffPlacement = freezeVector3(
  authoredWaterBaySkiffPlacementSnapshot.position.x,
  authoredWaterBaySkiffPlacementSnapshot.position.y,
  authoredWaterBaySkiffPlacementSnapshot.position.z
);
export const authoredWaterBaySkiffYawRadians =
  authoredWaterBaySkiffPlacementSnapshot.rotationYRadians;
export const authoredWaterBaySkiffBoardingGroundedSpawnPosition =
  offsetLocalPlanarPosition(
    authoredWaterBaySkiffPlacement,
    authoredWaterBaySkiffYawRadians,
    -3.25,
    0,
    authoredWaterBayOpenWaterSpawn.y
  );
export const authoredWaterBaySkiffBoardingYawRadians = resolveFacingYawRadians(
  authoredWaterBaySkiffBoardingGroundedSpawnPosition,
  authoredWaterBaySkiffPlacement
);
