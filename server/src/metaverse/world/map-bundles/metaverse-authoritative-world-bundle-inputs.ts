import {
  resolveMetaverseGameplayProfile,
  resolveMetaverseWorldDynamicSurfaceCollidersForAsset,
  resolveMetaverseWorldPlacedSurfaceColliders,
  resolveMetaverseWorldPlacedWaterRegions,
  resolveMetaverseWorldSurfaceScaleVector,
  type MetaverseMapBundleSnapshot,
  type MetaverseGameplayProfileSnapshot,
  type MetaverseWorldEnvironmentColliderAuthoring,
  type MetaverseWorldEnvironmentDynamicBodyAuthoring,
  type MetaverseWorldPlacedSurfaceColliderSnapshot,
  type MetaverseWorldPlacedWaterRegionSnapshot,
  type MetaverseWorldSurfaceAssetAuthoring,
  type MetaverseWorldSurfaceVector3Snapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import {
  loadAuthoritativeMetaverseMapBundle,
  type LoadedAuthoritativeMetaverseMapBundleSnapshot
} from "./load-authoritative-metaverse-map-bundle.js";
import {
  loadAuthoritativeCollisionTriMeshSnapshots,
  type MetaverseAuthoritativeCollisionTriMeshSnapshot
} from "../metaverse-authoritative-collision-mesh-loader.js";

export type MetaverseAuthoritativeSurfaceColliderSnapshot =
  MetaverseWorldPlacedSurfaceColliderSnapshot;

export interface MetaverseAuthoritativeDynamicSurfaceSeedSnapshot {
  readonly environmentAssetId: string;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseAuthoritativeEnvironmentBodySeedSnapshot {
  readonly colliderCenter: MetaverseWorldSurfaceVector3Snapshot;
  readonly dynamicBody: MetaverseWorldEnvironmentDynamicBodyAuthoring;
  readonly environmentAssetId: string;
  readonly halfExtents: MetaverseWorldSurfaceVector3Snapshot;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseAuthoritativeCollisionMeshSeedSnapshot {
  readonly environmentAssetId: string;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly triMeshes:
    readonly MetaverseAuthoritativeCollisionTriMeshSnapshot[];
  readonly yawRadians: number;
}

export interface MetaverseAuthoritativeDefaultSpawnSnapshot {
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly spawnId: string;
  readonly yawRadians: number;
}

export interface MetaverseAuthoritativeWorldBundleInputs {
  readonly bundle: MetaverseMapBundleSnapshot;
  readonly bundleId: string;
  readonly defaultSpawn: MetaverseAuthoritativeDefaultSpawnSnapshot;
  readonly dynamicSurfaceSeedSnapshots:
    readonly MetaverseAuthoritativeDynamicSurfaceSeedSnapshot[];
  readonly dynamicCollisionMeshSeedSnapshots:
    readonly MetaverseAuthoritativeCollisionMeshSeedSnapshot[];
  readonly environmentBodySeedSnapshots:
    readonly MetaverseAuthoritativeEnvironmentBodySeedSnapshot[];
  readonly gameplayProfile: MetaverseGameplayProfileSnapshot;
  readonly staticCollisionMeshSeedSnapshots:
    readonly MetaverseAuthoritativeCollisionMeshSeedSnapshot[];
  readonly staticSurfaceColliders:
    readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readSurfaceAsset(environmentAssetId: string): MetaverseWorldSurfaceAssetAuthoring | null;
  resolveDynamicSurfaceColliders(
    environmentAssetId: string,
    poseSnapshot: {
      readonly position: MetaverseWorldSurfaceVector3Snapshot;
      readonly yawRadians: number;
    }
  ): readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];
}

const emptyMetaverseAuthoritativeSurfaceColliders = Object.freeze(
  []
) as readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];

function freezeVector3(
  x: number,
  y: number,
  z: number
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x,
    y,
    z
  });
}

function resolveScaledColliderCenter(
  collider: MetaverseWorldEnvironmentColliderAuthoring,
  scale:
    | number
    | {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      }
): MetaverseWorldSurfaceVector3Snapshot {
  const scaleVector = resolveMetaverseWorldSurfaceScaleVector(scale);

  return freezeVector3(
    collider.center.x * scaleVector.x,
    collider.center.y * scaleVector.y,
    collider.center.z * scaleVector.z
  );
}

function resolveScaledColliderHalfExtents(
  collider: MetaverseWorldEnvironmentColliderAuthoring,
  scale:
    | number
    | {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      }
): MetaverseWorldSurfaceVector3Snapshot {
  const scaleVector = resolveMetaverseWorldSurfaceScaleVector(scale);

  return freezeVector3(
    Math.abs(collider.size.x * scaleVector.x) * 0.5,
    Math.abs(collider.size.y * scaleVector.y) * 0.5,
    Math.abs(collider.size.z * scaleVector.z) * 0.5
  );
}

function createSurfaceAssets(
  bundle: MetaverseMapBundleSnapshot
): readonly MetaverseWorldSurfaceAssetAuthoring[] {
  return Object.freeze(
    bundle.environmentAssets.map((environmentAsset) =>
      Object.freeze({
        collisionPath: environmentAsset.collisionPath,
        collider: environmentAsset.collider,
        dynamicBody: environmentAsset.dynamicBody,
        environmentAssetId: environmentAsset.assetId,
        entries: environmentAsset.entries,
        placement: environmentAsset.placementMode,
        placements: Object.freeze(
          environmentAsset.placements.map((placement) =>
            Object.freeze({
              position: placement.position,
              rotationYRadians: placement.rotationYRadians,
              scale: placement.scale
            })
          )
        ),
        seats: environmentAsset.seats,
        surfaceColliders: environmentAsset.surfaceColliders,
        traversalAffordance: environmentAsset.traversalAffordance
      } satisfies MetaverseWorldSurfaceAssetAuthoring)
    )
  );
}

function shouldUseCollisionMeshSurfaceSupport(
  surfaceAsset: Pick<
    MetaverseWorldSurfaceAssetAuthoring,
    "collisionPath" | "dynamicBody"
  >
): boolean {
  return surfaceAsset.dynamicBody === null && surfaceAsset.collisionPath !== null;
}

function createCollisionMeshSeedSnapshot(
  environmentAssetId: string,
  collisionPath: string,
  placement: {
    readonly position: MetaverseWorldSurfaceVector3Snapshot;
    readonly rotationYRadians: number;
    readonly scale:
      | number
      | {
          readonly x: number;
          readonly y: number;
          readonly z: number;
        };
  }
): MetaverseAuthoritativeCollisionMeshSeedSnapshot {
  return Object.freeze({
    environmentAssetId,
    position: placement.position,
    triMeshes: loadAuthoritativeCollisionTriMeshSnapshots(
      collisionPath,
      placement.scale
    ),
    yawRadians: placement.rotationYRadians
  });
}

function createDefaultSpawn(
  loadedBundle: LoadedAuthoritativeMetaverseMapBundleSnapshot
): MetaverseAuthoritativeDefaultSpawnSnapshot {
  const defaultSpawnNode = loadedBundle.bundle.playerSpawnNodes[0];

  if (defaultSpawnNode === undefined) {
    throw new Error(
      `Authoritative metaverse map bundle ${loadedBundle.bundleId} requires one player spawn node.`
    );
  }

  return Object.freeze({
    position: defaultSpawnNode.position,
    spawnId: defaultSpawnNode.spawnId,
    yawRadians: defaultSpawnNode.yawRadians
  });
}

export function createMetaverseAuthoritativeWorldBundleInputs(
  bundleId: string
): MetaverseAuthoritativeWorldBundleInputs {
  const loadedBundle = loadAuthoritativeMetaverseMapBundle(bundleId);
  const surfaceAssets = createSurfaceAssets(loadedBundle.bundle);
  const surfaceAssetsById = new Map(
    surfaceAssets.map((surfaceAsset) => [
      surfaceAsset.environmentAssetId,
      surfaceAsset
    ])
  );

  const staticSurfaceColliders = surfaceAssets
    .filter(
      (surfaceAsset) =>
        !shouldUseCollisionMeshSurfaceSupport(surfaceAsset) &&
        (surfaceAsset.placement === "static" ||
          surfaceAsset.placement === "instanced")
    )
    .flatMap((surfaceAsset) =>
      resolveMetaverseWorldPlacedSurfaceColliders(surfaceAsset)
    );

  return Object.freeze({
    bundle: loadedBundle.bundle,
    bundleId: loadedBundle.bundleId,
    defaultSpawn: createDefaultSpawn(loadedBundle),
    dynamicSurfaceSeedSnapshots: Object.freeze(
      surfaceAssets.flatMap((surfaceAsset) => {
        if (
          surfaceAsset.placement !== "dynamic" ||
          shouldUseCollisionMeshSurfaceSupport(surfaceAsset) ||
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
    ),
    dynamicCollisionMeshSeedSnapshots: Object.freeze(
      surfaceAssets.flatMap((surfaceAsset) => {
        if (
          surfaceAsset.placement !== "dynamic" ||
          !shouldUseCollisionMeshSurfaceSupport(surfaceAsset) ||
          surfaceAsset.collisionPath === null ||
          surfaceAsset.placements.length === 0
        ) {
          return [];
        }

        return [
          createCollisionMeshSeedSnapshot(
            surfaceAsset.environmentAssetId,
            surfaceAsset.collisionPath,
            surfaceAsset.placements[0]!
          )
        ];
      })
    ),
    environmentBodySeedSnapshots: Object.freeze(
      surfaceAssets.flatMap((surfaceAsset) => {
        if (
          surfaceAsset.placement !== "dynamic" ||
          surfaceAsset.dynamicBody === null ||
          surfaceAsset.collider === null ||
          surfaceAsset.placements.length === 0
        ) {
          return [];
        }

        const authoredPlacement = surfaceAsset.placements[0]!;

        return [
          Object.freeze({
            colliderCenter: resolveScaledColliderCenter(
              surfaceAsset.collider,
              authoredPlacement.scale
            ),
            dynamicBody: surfaceAsset.dynamicBody,
            environmentAssetId: surfaceAsset.environmentAssetId,
            halfExtents: resolveScaledColliderHalfExtents(
              surfaceAsset.collider,
              authoredPlacement.scale
            ),
            position: authoredPlacement.position,
            yawRadians: authoredPlacement.rotationYRadians
          } satisfies MetaverseAuthoritativeEnvironmentBodySeedSnapshot)
        ];
      })
    ),
    gameplayProfile: resolveMetaverseGameplayProfile(
      loadedBundle.bundle.gameplayProfileId
    ),
    staticCollisionMeshSeedSnapshots: Object.freeze(
      surfaceAssets.flatMap((surfaceAsset) => {
        if (
          (surfaceAsset.placement !== "static" &&
            surfaceAsset.placement !== "instanced") ||
          !shouldUseCollisionMeshSurfaceSupport(surfaceAsset) ||
          surfaceAsset.collisionPath === null
        ) {
          return [];
        }

        return surfaceAsset.placements.map((placement) =>
          createCollisionMeshSeedSnapshot(
            surfaceAsset.environmentAssetId,
            surfaceAsset.collisionPath!,
            placement
          )
        );
      })
    ),
    readSurfaceAsset(environmentAssetId: string) {
      return surfaceAssetsById.get(environmentAssetId) ?? null;
    },
    resolveDynamicSurfaceColliders(
      environmentAssetId: string,
      poseSnapshot: {
        readonly position: MetaverseWorldSurfaceVector3Snapshot;
        readonly yawRadians: number;
      }
    ) {
      const surfaceAsset = surfaceAssetsById.get(environmentAssetId) ?? null;
      const surfaceColliders =
        surfaceAsset === null
          ? emptyMetaverseAuthoritativeSurfaceColliders
          : surfaceAsset.placement === "dynamic"
            ? resolveMetaverseWorldDynamicSurfaceCollidersForAsset(
                surfaceAsset,
                poseSnapshot
              )
            : resolveMetaverseWorldPlacedSurfaceColliders(surfaceAsset);

      return surfaceColliders.length > 0
        ? surfaceColliders
        : emptyMetaverseAuthoritativeSurfaceColliders;
    },
    staticSurfaceColliders: Object.freeze(staticSurfaceColliders),
    waterRegionSnapshots: resolveMetaverseWorldPlacedWaterRegions(
      loadedBundle.bundle.waterRegions
    )
  });
}
