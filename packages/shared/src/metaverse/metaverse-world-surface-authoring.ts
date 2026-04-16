import {
  metaverseWorldSurfaceAssets,
  metaverseWorldWaterRegions,
  metaverseHubCrateEnvironmentAssetId,
  metaverseHubDockEnvironmentAssetId,
  metaverseHubDiveBoatEnvironmentAssetId,
  metaverseHubPushableCrateEnvironmentAssetId,
  metaverseHubShorelineEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId
} from "./metaverse-world-surface-authoring-data.js";
import {
  resolveMetaverseWorldDynamicSurfaceCollidersForAsset,
  resolveMetaverseWorldPlacedWaterRegions,
  type MetaverseWorldPlacedWaterRegionSnapshot,
  type MetaverseWorldPlacedSurfaceColliderSnapshot,
  type MetaverseWorldSurfaceAssetAuthoring,
  type MetaverseWorldSurfaceVector3Snapshot,
  type MetaverseWorldWaterRegionAuthoring
} from "./metaverse-world-surface-query.js";

export {
  metaverseHubCrateEnvironmentAssetId,
  metaverseHubDockEnvironmentAssetId,
  metaverseHubDiveBoatEnvironmentAssetId,
  metaverseHubPushableCrateEnvironmentAssetId,
  metaverseHubShorelineEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId,
  metaverseWorldSurfaceAssets,
  metaverseWorldWaterRegions
} from "./metaverse-world-surface-authoring-data.js";
export type {
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
