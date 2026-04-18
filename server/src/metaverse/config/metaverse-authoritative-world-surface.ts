import {
  metaverseWorldPlacedWaterRegions,
  metaverseWorldSurfaceAssets,
  readMetaverseWorldSurfaceAssetAuthoring,
  resolveMetaverseWorldDynamicSurfaceColliders,
  resolveMetaverseWorldPlacedSurfaceColliders,
  type MetaverseWorldPlacedSurfaceColliderSnapshot,
  type MetaverseWorldSurfaceVector3Snapshot
} from "@webgpu-metaverse/shared/metaverse/world";
import { metaverseDebugSimpleSpawnSupportCollider } from "./metaverse-debug-simple-spawn-support.js";

export type MetaverseAuthoritativeSurfaceColliderSnapshot =
  MetaverseWorldPlacedSurfaceColliderSnapshot;
export interface MetaverseAuthoritativeDynamicSurfaceSeedSnapshot {
  readonly environmentAssetId: string;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

const emptyMetaverseAuthoritativeSurfaceColliders = Object.freeze(
  []
) as readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];

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

function shouldUseSimpleSpawnSupportOverride(): boolean {
  return (
    resolveBooleanEnvFlag(
      process.env.METAVERSE_SIMPLE_SPAWN_SUPPORT_ENABLED
    ) ?? false
  );
}

const authoritativeStaticSurfaceColliders = [
  ...metaverseWorldSurfaceAssets
    .filter(
      (surfaceAsset) =>
        surfaceAsset.placement === "static" ||
        surfaceAsset.placement === "instanced"
    )
    .flatMap((surfaceAsset) =>
      resolveMetaverseWorldPlacedSurfaceColliders(surfaceAsset)
    )
];

if (shouldUseSimpleSpawnSupportOverride()) {
  authoritativeStaticSurfaceColliders.push(
    metaverseDebugSimpleSpawnSupportCollider
  );
}

export const metaverseAuthoritativeStaticSurfaceColliders = Object.freeze(
  authoritativeStaticSurfaceColliders
) satisfies readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];

export const metaverseAuthoritativeDynamicSurfaceSeedSnapshots = Object.freeze(
  metaverseWorldSurfaceAssets.flatMap((surfaceAsset) => {
    if (
      surfaceAsset.placement !== "dynamic" ||
      surfaceAsset.surfaceColliders.length === 0 ||
      surfaceAsset.placements.length === 0
    ) {
      return [];
    }

    const authoredPlacement = surfaceAsset.placements[0]!;

    return [
      Object.freeze({
        environmentAssetId: surfaceAsset.environmentAssetId,
        position: authoredPlacement.position,
        yawRadians: authoredPlacement.rotationYRadians
      } satisfies MetaverseAuthoritativeDynamicSurfaceSeedSnapshot)
    ];
  })
) satisfies readonly MetaverseAuthoritativeDynamicSurfaceSeedSnapshot[];

export const metaverseAuthoritativeWaterRegionSnapshots =
  metaverseWorldPlacedWaterRegions;

export function readMetaverseAuthoritativeSurfaceAsset(
  environmentAssetId: string
) {
  return readMetaverseWorldSurfaceAssetAuthoring(environmentAssetId);
}

export function resolveMetaverseAuthoritativeDynamicSurfaceColliders(
  environmentAssetId: string,
  poseSnapshot: {
    readonly position: MetaverseWorldSurfaceVector3Snapshot;
    readonly yawRadians: number;
  }
): readonly MetaverseAuthoritativeSurfaceColliderSnapshot[] {
  const surfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(environmentAssetId);
  const surfaceColliders =
    surfaceAsset === null
      ? emptyMetaverseAuthoritativeSurfaceColliders
      : surfaceAsset.placement === "dynamic"
        ? resolveMetaverseWorldDynamicSurfaceColliders(
            environmentAssetId,
            poseSnapshot
          )
        : resolveMetaverseWorldPlacedSurfaceColliders(surfaceAsset);

  return surfaceColliders.length > 0
    ? surfaceColliders
    : emptyMetaverseAuthoritativeSurfaceColliders;
}
