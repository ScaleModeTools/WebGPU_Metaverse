import {
  metaverseWorldPlacedWaterRegions,
  metaverseWorldSurfaceAssets,
  readMetaverseWorldSurfaceAssetAuthoring,
  resolveMetaverseWorldDynamicSurfaceColliders,
  resolveMetaverseWorldPlacedSurfaceColliders,
  type MetaverseWorldPlacedSurfaceColliderSnapshot,
  type MetaverseWorldPlacedWaterRegionSnapshot,
  type MetaverseWorldSurfaceAssetAuthoring,
  type MetaverseWorldSurfacePlacementId,
  type MetaverseWorldSurfacePlacementSnapshot,
  type MetaverseWorldSurfaceVector3Snapshot
} from "@webgpu-metaverse/shared";

export interface MetaverseWorldRenderPlacementAssetSnapshot {
  readonly environmentAssetId: string;
  readonly placement: MetaverseWorldSurfacePlacementId;
  readonly placements: readonly MetaverseWorldSurfacePlacementSnapshot[];
}

const emptyMetaverseWorldPlacedSurfaceColliders = Object.freeze(
  []
) as readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];

const renderPlacementAssets = Object.freeze(
  metaverseWorldSurfaceAssets.map((surfaceAsset) =>
    Object.freeze({
      environmentAssetId: surfaceAsset.environmentAssetId,
      placement: surfaceAsset.placement,
      placements: surfaceAsset.placements
    } satisfies MetaverseWorldRenderPlacementAssetSnapshot)
  )
);

const renderPlacementAssetsById = new Map<
  string,
  MetaverseWorldRenderPlacementAssetSnapshot
>(
  renderPlacementAssets.map((renderPlacementAsset) => [
    renderPlacementAsset.environmentAssetId,
    renderPlacementAsset
  ])
);

const staticSurfaceColliderSnapshots = Object.freeze(
  metaverseWorldSurfaceAssets
    .filter(
      (surfaceAsset) =>
        surfaceAsset.placement === "static" ||
        surfaceAsset.placement === "instanced"
    )
    .flatMap((surfaceAsset) =>
      resolveMetaverseWorldPlacedSurfaceColliders(surfaceAsset)
    )
);

export const metaverseWorldLayout = Object.freeze({
  readRenderPlacementAsset(
    environmentAssetId: string
  ): MetaverseWorldRenderPlacementAssetSnapshot | null {
    return renderPlacementAssetsById.get(environmentAssetId) ?? null;
  },

  readSurfaceAsset(
    environmentAssetId: string
  ): MetaverseWorldSurfaceAssetAuthoring | null {
    return readMetaverseWorldSurfaceAssetAuthoring(environmentAssetId);
  },

  renderPlacementAssets,

  resolveSurfaceColliderSnapshots(
    environmentAssetId: string,
    poseSnapshot?: {
      readonly position: MetaverseWorldSurfaceVector3Snapshot;
      readonly yawRadians: number;
    } | null
  ): readonly MetaverseWorldPlacedSurfaceColliderSnapshot[] {
    const surfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
      environmentAssetId
    );

    if (surfaceAsset === null) {
      return emptyMetaverseWorldPlacedSurfaceColliders;
    }

    if (surfaceAsset.placement === "dynamic") {
      if (poseSnapshot === undefined || poseSnapshot === null) {
        return emptyMetaverseWorldPlacedSurfaceColliders;
      }

      return resolveMetaverseWorldDynamicSurfaceColliders(
        environmentAssetId,
        poseSnapshot
      );
    }

    return resolveMetaverseWorldPlacedSurfaceColliders(surfaceAsset);
  },

  staticSurfaceColliderSnapshots,

  surfaceAssets: metaverseWorldSurfaceAssets as readonly MetaverseWorldSurfaceAssetAuthoring[],

  waterRegionSnapshots:
    metaverseWorldPlacedWaterRegions as readonly MetaverseWorldPlacedWaterRegionSnapshot[]
});
