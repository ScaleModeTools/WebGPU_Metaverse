import {
  metaverseWorldSurfaceAssets,
  metaverseWorldWaterRegions
} from "./metaverse-world-surface-authoring-data.js";
import {
  resolveMetaverseWorldDynamicSurfaceCollidersForAsset,
  readMetaverseWorldMountedEntryAuthoring,
  readMetaverseWorldMountedSeatAuthoring,
  resolveMetaverseWorldPlacedWaterRegions,
  type MetaverseWorldPlacedWaterRegionSnapshot,
  type MetaverseWorldPlacedSurfaceColliderSnapshot,
  type MetaverseWorldSurfaceAssetAuthoring,
  type MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";

export {
  metaverseBuilderBlockTileEnvironmentAssetId,
  metaverseBuilderFloorTileEnvironmentAssetId,
  metaverseBuilderStepTileEnvironmentAssetId,
  metaverseBuilderWallTileEnvironmentAssetId,
  metaverseHubDockEnvironmentAssetId,
  metaverseHubDiveBoatEnvironmentAssetId,
  metaverseHubPushableCrateEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId,
  metaversePlaygroundRangeBarrierEnvironmentAssetId,
  metaversePlaygroundRangeFloorEnvironmentAssetId,
  metaverseWorldSurfaceAssets,
  metaverseWorldWaterRegions
} from "./metaverse-world-surface-authoring-data.js";
export type {
  MetaverseWorldEnvironmentColliderAuthoring,
  MetaverseWorldEnvironmentDynamicBodyAuthoring,
  MetaverseWorldEnvironmentDynamicBodyKindId,
  MetaverseWorldMountedEntryAuthoring,
  MetaverseWorldMountedSeatAuthoring,
  MetaverseWorldEnvironmentTraversalAffordanceId,
  MetaverseWorldPlacedSurfaceColliderSnapshot,
  MetaverseWorldPlacedWaterRegionSnapshot,
  MetaverseWorldSurfaceAssetAuthoring,
  MetaverseWorldSurfaceColliderAuthoring,
  MetaverseWorldSurfacePlacementId,
  MetaverseWorldSurfacePlacementSnapshot,
  MetaverseWorldSurfaceQuaternionSnapshot,
  MetaverseWorldSurfaceTraversalAffordanceId,
  MetaverseWorldSurfaceVector3Snapshot,
  MetaverseWorldWaterRegionAuthoring
} from "./metaverse-world-surface-query.js";

export const metaverseWorldStaticSurfaceAssets = Object.freeze(
  metaverseWorldSurfaceAssets.filter(
    (asset) => asset.placement === "static" || asset.placement === "instanced"
  )
) as readonly MetaverseWorldSurfaceAssetAuthoring[];

export const metaverseWorldDynamicSurfaceAssets = Object.freeze(
  metaverseWorldSurfaceAssets.filter((asset) => asset.placement === "dynamic")
) as readonly MetaverseWorldSurfaceAssetAuthoring[];

export const metaverseWorldPlacedWaterRegions = resolveMetaverseWorldPlacedWaterRegions(
  metaverseWorldWaterRegions
);

const metaverseWorldSurfaceAssetsById = new Map<
  string,
  MetaverseWorldSurfaceAssetAuthoring
>(metaverseWorldSurfaceAssets.map((asset) => [asset.environmentAssetId, asset]));

const metaverseWorldPlacedWaterRegionsById = new Map<
  string,
  MetaverseWorldPlacedWaterRegionSnapshot
>(
  metaverseWorldPlacedWaterRegions.map((waterRegion) => [
    waterRegion.waterRegionId,
    waterRegion
  ])
);

const emptyMetaverseWorldPlacedSurfaceColliders = Object.freeze(
  []
) as readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];

export function readMetaverseWorldSurfaceAssetAuthoring(
  environmentAssetId: string
): MetaverseWorldSurfaceAssetAuthoring | null {
  return metaverseWorldSurfaceAssetsById.get(environmentAssetId) ?? null;
}

export function readMetaverseWorldPlacedWaterRegionSnapshot(
  waterRegionId: string
): MetaverseWorldPlacedWaterRegionSnapshot | null {
  return metaverseWorldPlacedWaterRegionsById.get(waterRegionId) ?? null;
}

export function readMetaverseWorldMountedSeatAuthoringForAsset(
  environmentAssetId: string,
  seatId: string
) {
  return readMetaverseWorldMountedSeatAuthoring(
    metaverseWorldSurfaceAssetsById.get(environmentAssetId),
    seatId
  );
}

export function readMetaverseWorldMountedEntryAuthoringForAsset(
  environmentAssetId: string,
  entryId: string
) {
  return readMetaverseWorldMountedEntryAuthoring(
    metaverseWorldSurfaceAssetsById.get(environmentAssetId),
    entryId
  );
}

export function resolveMetaverseWorldDynamicSurfaceColliders(
  environmentAssetId: string,
  poseSnapshot: {
    readonly position: MetaverseWorldSurfaceVector3Snapshot;
    readonly yawRadians: number;
  }
): readonly MetaverseWorldPlacedSurfaceColliderSnapshot[] {
  const dynamicSurfaceAsset = metaverseWorldSurfaceAssetsById.get(
    environmentAssetId
  );

  if (
    dynamicSurfaceAsset === undefined ||
    dynamicSurfaceAsset.placement !== "dynamic"
  ) {
    return emptyMetaverseWorldPlacedSurfaceColliders;
  }

  return resolveMetaverseWorldDynamicSurfaceCollidersForAsset(
    dynamicSurfaceAsset,
    poseSnapshot
  );
}
