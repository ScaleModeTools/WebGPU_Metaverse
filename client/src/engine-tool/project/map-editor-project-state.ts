import type { LoadedMetaverseMapBundleSnapshot } from "@/metaverse/world/map-bundles";
import {
  cloneMetaverseEnvironmentPresentationSnapshot,
  createMetaverseEnvironmentPresentationSnapshotFromProfile,
  readMetaverseEnvironmentPresentationProfile
} from "@/metaverse/render/environment/profiles";
import type { EnvironmentAssetDescriptor } from "@/assets/types/environment-asset-manifest";
import {
  metaverseBuilderFloorTileEnvironmentAssetId,
  metaverseBuilderStepTileEnvironmentAssetId,
  metaverseBuilderWallTileEnvironmentAssetId
} from "@/assets/config/environment-prop-manifest";
import {
  resolveMapEditorBuildAssetPlacementPosition,
  mapEditorBuildGridUnitMeters,
  resolveMapEditorBuildFootprintCenterPosition,
  resolveMapEditorBuildGroundPosition,
  resolveMapEditorBuildRectangleFromGridPoints,
  resolveMapEditorBuildSizedCenterPosition,
  resolveMapEditorBuildWallSegment,
  snapMapEditorBuildCoordinateToGrid,
  type MapEditorBuildPlacementPositionSnapshot
} from "@/engine-tool/build/map-editor-build-placement";
import { readMapEditorBuildPrimitiveCatalogEntry } from "@/engine-tool/build/map-editor-build-primitives";
import {
  createLaunchVariationDrafts,
  freezeLaunchVariationDraft,
  type MapEditorLaunchVariationDraftSnapshot
} from "@/engine-tool/project/map-editor-project-launch-variations";
import {
  createPlayerSpawnSelectionDraft,
  freezePlayerSpawnSelectionDraft,
  type MapEditorPlayerSpawnSelectionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-player-spawn-selection";
import {
  createMapEditorConnectorDrafts,
  createMapEditorEdgeDrafts,
  createMapEditorGameplayVolumeDrafts,
  createMapEditorLightDrafts,
  createMapEditorMaterialDefinitionDrafts,
  createMapEditorRegionDrafts,
  createMapEditorStructuralDrafts,
  createMapEditorSurfaceDrafts,
  createMapEditorTerrainPatchDrafts,
  createSemanticConnectorSnapshotFromDraft,
  createSemanticEdgeSnapshotFromDraft,
  createSemanticGameplayVolumeSnapshotFromDraft,
  createSemanticLightSnapshotFromDraft,
  createSemanticMaterialDefinitionSnapshotFromDraft,
  createSemanticRegionSnapshotFromDraft,
  createSemanticStructureSnapshotFromDraft,
  createSemanticSurfaceSnapshotFromDraft,
  createSemanticTerrainPatchSnapshotFromDraft,
  freezeConnectorDraft,
  freezeEdgeDraft,
  freezeGameplayVolumeDraft,
  freezeLightDraft,
  freezeMaterialDefinitionDraft,
  freezeRegionDraft,
  freezeStructuralDraft,
  freezeSurfaceDraft,
  freezeTerrainPatchDraft,
  type MapEditorConnectorDraftSnapshot,
  type MapEditorEdgeDraftSnapshot,
  type MapEditorGameplayVolumeDraftSnapshot,
  type MapEditorLightDraftSnapshot,
  type MapEditorMaterialDefinitionDraftSnapshot,
  type MapEditorRegionDraftSnapshot,
  type MapEditorStructuralDraftSnapshot,
  type MapEditorSurfaceDraftSnapshot,
  type MapEditorTerrainPatchDraftSnapshot
} from "@/engine-tool/project/map-editor-project-semantic-drafts";
import {
  createPlayerSpawnDrafts,
  createResourceSpawnDrafts,
  createSceneObjectDrafts,
  createWaterRegionDrafts,
  freezePlayerSpawnDraft,
  freezeResourceSpawnDraft,
  freezeSceneObjectDraft,
  freezeWaterRegionDraft,
  resolveMapEditorWaterRegionTopCenter,
  type MapEditorPlayerSpawnDraftSnapshot,
  type MapEditorResourceSpawnDraftSnapshot,
  type MapEditorSceneObjectDraftSnapshot,
  type MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import {
  type MetaverseMapBundleSemanticCompatibilityAssetIdsSnapshot,
  type MetaverseMapBundleEnvironmentPresentationSnapshot,
  type MetaverseMapBundleSemanticPlanarLoopSnapshot,
  type MetaverseMapBundleSemanticPlanarPointSnapshot,
  type MetaverseMapBundleSemanticModuleSnapshot,
  type MetaverseWorldEnvironmentColliderAuthoring,
  type MetaverseWorldEnvironmentDynamicBodyAuthoring,
  type MetaverseWorldEnvironmentTraversalAffordanceId,
  type MetaverseWorldMountedEntryAuthoring,
  type MetaverseWorldMountedSeatAuthoring,
  type MetaverseWorldSurfaceColliderAuthoring,
  type MetaverseWorldSurfacePlacementId,
  type MetaverseWorldSurfaceScaleSnapshot,
  type MetaverseWorldSurfaceVector3Snapshot,
  resolveMetaverseMapBundleSemanticSurfaceLocalHeightMeters,
  resolveMetaverseWorldPlacedSurfaceColliders,
  resolveMetaverseWorldSurfaceScaleVector
} from "@webgpu-metaverse/shared/metaverse/world";
import type {
  MapEditorProjectSettingsSnapshot,
  MapEditorTerrainBrushMode,
  MapEditorTerrainBrushSizeCells
} from "@/engine-tool/types/map-editor";
import {
  createMapEditorProjectSettingsSnapshot
} from "@/engine-tool/types/map-editor";

export type {
  MapEditorConnectorDraftSnapshot,
  MapEditorEdgeDraftSnapshot,
  MapEditorGameplayVolumeDraftSnapshot,
  MapEditorLightDraftSnapshot,
  MapEditorMaterialDefinitionDraftSnapshot,
  MapEditorRegionDraftSnapshot,
  MapEditorStructuralDraftSnapshot,
  MapEditorSurfaceDraftSnapshot,
  MapEditorTerrainPatchDraftSnapshot
} from "@/engine-tool/project/map-editor-project-semantic-drafts";
export type {
  MapEditorPlayerSpawnDraftSnapshot,
  MapEditorResourceSpawnDraftSnapshot,
  MapEditorSceneObjectDraftSnapshot,
  MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
export type {
  MapEditorPlayerSpawnSelectionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-player-spawn-selection";

export interface MapEditorPlacementDraftSnapshot {
  readonly assetId: string;
  readonly colliderCount: number;
  readonly collisionEnabled: boolean;
  readonly collisionPath: string | null;
  readonly collider: MetaverseWorldEnvironmentColliderAuthoring | null;
  readonly dynamicBody: MetaverseWorldEnvironmentDynamicBodyAuthoring | null;
  readonly entries: readonly MetaverseWorldMountedEntryAuthoring[] | null;
  readonly isVisible: boolean;
  readonly materialReferenceId: string | null;
  readonly moduleId: string;
  readonly notes: string;
  readonly placementId: string;
  readonly placementMode: MetaverseWorldSurfacePlacementId;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly rotationYRadians: number;
  readonly scale: MetaverseWorldSurfaceVector3Snapshot;
  readonly seats: readonly MetaverseWorldMountedSeatAuthoring[] | null;
  readonly surfaceColliders: readonly MetaverseWorldSurfaceColliderAuthoring[];
  readonly traversalAffordance: MetaverseWorldEnvironmentTraversalAffordanceId;
}

export type MapEditorEntityKind =
  | "connector"
  | "edge"
  | "gameplay-volume"
  | "light"
  | "module"
  | "player-spawn"
  | "region"
  | "resource-spawn"
  | "scene-object"
  | "structure"
  | "surface"
  | "terrain-patch"
  | "world-atmosphere"
  | "world-sky"
  | "world-sun"
  | "water-region";

export interface MapEditorSelectedEntityRef {
  readonly id: string;
  readonly kind: MapEditorEntityKind;
}

export interface MapEditorProjectSnapshot {
  readonly bundleId: string;
  readonly bundleLabel: string;
  readonly cameraProfileId: string | null;
  readonly characterPresentationProfileId: string | null;
  readonly connectorDrafts: readonly MapEditorConnectorDraftSnapshot[];
  readonly description: string;
  readonly edgeDrafts: readonly MapEditorEdgeDraftSnapshot[];
  readonly environmentPresentation:
    MetaverseMapBundleEnvironmentPresentationSnapshot;
  readonly environmentPresentationProfileId: string | null;
  readonly gameplayProfileId: string;
  readonly gameplayVolumeDrafts: readonly MapEditorGameplayVolumeDraftSnapshot[];
  readonly hudProfileId: string | null;
  readonly launchVariationDrafts: readonly MapEditorLaunchVariationDraftSnapshot[];
  readonly lightDrafts: readonly MapEditorLightDraftSnapshot[];
  readonly materialDefinitionDrafts:
    readonly MapEditorMaterialDefinitionDraftSnapshot[];
  readonly placementDrafts: readonly MapEditorPlacementDraftSnapshot[];
  readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
  readonly playerSpawnSelectionDraft: MapEditorPlayerSpawnSelectionDraftSnapshot;
  readonly projectSettings: MapEditorProjectSettingsSnapshot;
  readonly regionDrafts: readonly MapEditorRegionDraftSnapshot[];
  readonly resourceSpawnDrafts: readonly MapEditorResourceSpawnDraftSnapshot[];
  readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
  readonly selectedEntityRef: MapEditorSelectedEntityRef | null;
  readonly selectedLaunchVariationId: string | null;
  readonly selectedPlacementId: string | null;
  readonly semanticCompatibilityAssetIds:
    MetaverseMapBundleSemanticCompatibilityAssetIdsSnapshot;
  readonly surfaceDrafts: readonly MapEditorSurfaceDraftSnapshot[];
  readonly structuralDrafts: readonly MapEditorStructuralDraftSnapshot[];
  readonly terrainPatchDrafts: readonly MapEditorTerrainPatchDraftSnapshot[];
  readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
}

function freezePlacementScale(
  scale: MetaverseWorldSurfaceScaleSnapshot
): MetaverseWorldSurfaceVector3Snapshot {
  const resolvedScale = resolveMetaverseWorldSurfaceScaleVector(scale);

  return Object.freeze({
    x: Math.max(0.1, resolvedScale.x),
    y: Math.max(0.1, resolvedScale.y),
    z: Math.max(0.1, resolvedScale.z)
  });
}

function freezePlacementDraft(
  draft: MapEditorPlacementDraftSnapshot
): MapEditorPlacementDraftSnapshot {
  return Object.freeze({
    ...draft,
    collider:
      draft.collider === null
        ? null
        : Object.freeze({
            center: Object.freeze({
              x: draft.collider.center.x,
              y: draft.collider.center.y,
              z: draft.collider.center.z
            }),
            size: Object.freeze({
              x: draft.collider.size.x,
              y: draft.collider.size.y,
              z: draft.collider.size.z
            })
          }),
    dynamicBody:
      draft.dynamicBody === null
        ? null
        : Object.freeze({
            ...draft.dynamicBody
          }),
    entries:
      draft.entries === null ? null : Object.freeze([...draft.entries]),
    position: Object.freeze({
      x: draft.position.x,
      y: draft.position.y,
      z: draft.position.z
    }),
    scale: freezePlacementScale(draft.scale),
    seats: draft.seats === null ? null : Object.freeze([...draft.seats]),
    surfaceColliders: Object.freeze([...draft.surfaceColliders])
  });
}

function resolveModuleColliderCount(
  surfaceColliders: readonly MetaverseWorldSurfaceColliderAuthoring[],
  collider: MetaverseWorldEnvironmentColliderAuthoring | null
): number {
  return surfaceColliders.length + (collider === null ? 0 : 1);
}

function createModuleDraftFromSemanticModule(
  module: MetaverseMapBundleSemanticModuleSnapshot
): MapEditorPlacementDraftSnapshot {
  return freezePlacementDraft({
    assetId: module.assetId,
    colliderCount: resolveModuleColliderCount(module.surfaceColliders, module.collider),
    collisionEnabled: module.collisionEnabled,
    collisionPath: module.collisionPath,
    collider: module.collider,
    dynamicBody: module.dynamicBody,
    entries: module.entries,
    isVisible: module.isVisible,
    materialReferenceId: module.materialReferenceId,
    moduleId: module.moduleId,
    notes: module.notes,
    placementId: module.moduleId,
    placementMode: module.placementMode,
    position: module.position,
    rotationYRadians: module.rotationYRadians,
    scale: freezePlacementScale(module.scale),
    seats: module.seats,
    surfaceColliders: module.surfaceColliders,
    traversalAffordance: module.traversalAffordance
  });
}

function createModuleDraftFromLegacyPlacement(
  environmentAsset: LoadedMetaverseMapBundleSnapshot["bundle"]["environmentAssets"][number],
  placement: LoadedMetaverseMapBundleSnapshot["bundle"]["environmentAssets"][number]["placements"][number]
): MapEditorPlacementDraftSnapshot {
  return freezePlacementDraft({
    assetId: environmentAsset.assetId,
    colliderCount: resolveModuleColliderCount(
      environmentAsset.surfaceColliders,
      environmentAsset.collider
    ),
    collisionEnabled: placement.collisionEnabled,
    collisionPath: environmentAsset.collisionPath,
    collider: environmentAsset.collider,
    dynamicBody: environmentAsset.dynamicBody,
    entries: environmentAsset.entries,
    isVisible: placement.isVisible,
    materialReferenceId: placement.materialReferenceId,
    moduleId: placement.placementId,
    notes: placement.notes,
    placementId: placement.placementId,
    placementMode: environmentAsset.placementMode,
    position: placement.position,
    rotationYRadians: placement.rotationYRadians,
    scale: freezePlacementScale(placement.scale),
    seats: environmentAsset.seats,
    surfaceColliders: environmentAsset.surfaceColliders,
    traversalAffordance: environmentAsset.traversalAffordance
  });
}

function createLegacySemanticDrafts(
  loadedBundle: LoadedMetaverseMapBundleSnapshot
): Pick<
  MapEditorProjectSnapshot,
  | "connectorDrafts"
  | "edgeDrafts"
  | "gameplayVolumeDrafts"
  | "lightDrafts"
  | "materialDefinitionDrafts"
  | "placementDrafts"
  | "regionDrafts"
  | "semanticCompatibilityAssetIds"
  | "structuralDrafts"
  | "surfaceDrafts"
  | "terrainPatchDrafts"
> {
  const surfaces: MapEditorSurfaceDraftSnapshot[] = [];
  const regions: MapEditorRegionDraftSnapshot[] = [];
  const edges: MapEditorEdgeDraftSnapshot[] = [];
  const modules: MapEditorPlacementDraftSnapshot[] = [];

  for (const environmentAsset of loadedBundle.bundle.environmentAssets) {
    for (const placement of environmentAsset.placements) {
      if (environmentAsset.assetId === metaverseBuilderFloorTileEnvironmentAssetId) {
        const surfaceId = `surface:${placement.placementId}`;
        const scale = freezePlacementScale(placement.scale);
        const size = Object.freeze({
          x: 4 * scale.x,
          y: 0.5 * scale.y,
          z: 4 * scale.z
        });

        surfaces.push(
          freezeSurfaceDraft({
            center: placement.position,
            elevation: placement.position.y,
            kind: "flat-slab",
            label: environmentAsset.assetId,
            rotationYRadians: placement.rotationYRadians,
            size,
            slopeRiseMeters: 0,
            surfaceId,
            terrainPatchId: null
          })
        );
        regions.push(
          freezeRegionDraft({
            center: placement.position,
            label: environmentAsset.assetId,
            materialReferenceId: placement.materialReferenceId,
            outerLoop: createRectangularSurfaceLoop(size),
            regionId: `region:${placement.placementId}`,
            regionKind: "floor",
            rotationYRadians: placement.rotationYRadians,
            size,
            surfaceId
          })
        );
        continue;
      }

      if (environmentAsset.assetId === metaverseBuilderWallTileEnvironmentAssetId) {
        const surfaceId = `surface:${placement.placementId}`;
        const scale = freezePlacementScale(placement.scale);
        const size = Object.freeze({
          x: 4 * scale.x,
          y: 4 * scale.y,
          z: 0.5 * scale.z
        });

        surfaces.push(
          freezeSurfaceDraft({
            center: placement.position,
            elevation: placement.position.y,
            kind: "flat-slab",
            label: environmentAsset.assetId,
            rotationYRadians: placement.rotationYRadians,
            size,
            slopeRiseMeters: 0,
            surfaceId,
            terrainPatchId: null
          })
        );
        edges.push(
          freezeEdgeDraft({
            center: Object.freeze({
              x: placement.position.x,
              y: placement.position.y + size.y * 0.5,
              z: placement.position.z
            }),
            edgeId: `edge:${placement.placementId}`,
            edgeKind: "wall",
            heightMeters: size.y,
            label: environmentAsset.assetId,
            lengthMeters: size.x,
            materialReferenceId: placement.materialReferenceId,
            path: Object.freeze([
              createPlanarPoint(-size.x * 0.5, 0),
              createPlanarPoint(size.x * 0.5, 0)
            ]),
            rotationYRadians: placement.rotationYRadians,
            surfaceId,
            thicknessMeters: size.z
          })
        );
        continue;
      }

      modules.push(createModuleDraftFromLegacyPlacement(environmentAsset, placement));
    }
  }

  return Object.freeze({
    connectorDrafts: Object.freeze([]),
    edgeDrafts: Object.freeze(edges),
    gameplayVolumeDrafts: Object.freeze([]),
    lightDrafts: Object.freeze([]),
    materialDefinitionDrafts: createMapEditorMaterialDefinitionDrafts(
      loadedBundle.bundle.semanticWorld
    ),
    placementDrafts: Object.freeze(modules),
    regionDrafts: Object.freeze(regions),
    semanticCompatibilityAssetIds: Object.freeze({
      connectorAssetId: metaverseBuilderStepTileEnvironmentAssetId,
      floorAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      wallAssetId: metaverseBuilderWallTileEnvironmentAssetId
    }),
    structuralDrafts: Object.freeze([]),
    surfaceDrafts: Object.freeze(surfaces),
    terrainPatchDrafts: Object.freeze([])
  });
}

function createSemanticDraftsFromBundle(
  loadedBundle: LoadedMetaverseMapBundleSnapshot
): Pick<
  MapEditorProjectSnapshot,
  | "connectorDrafts"
  | "edgeDrafts"
  | "gameplayVolumeDrafts"
  | "lightDrafts"
  | "materialDefinitionDrafts"
  | "placementDrafts"
  | "regionDrafts"
  | "semanticCompatibilityAssetIds"
  | "structuralDrafts"
  | "surfaceDrafts"
  | "terrainPatchDrafts"
> {
  const semanticWorld = loadedBundle.bundle.semanticWorld;

  if (
    semanticWorld.terrainPatches.length === 0 &&
    semanticWorld.surfaces.length === 0 &&
    semanticWorld.regions.length === 0 &&
    semanticWorld.edges.length === 0 &&
    semanticWorld.connectors.length === 0 &&
    semanticWorld.structures.length === 0 &&
    semanticWorld.gameplayVolumes.length === 0 &&
    semanticWorld.lights.length === 0 &&
    semanticWorld.modules.length === 0
  ) {
    return createLegacySemanticDrafts(loadedBundle);
  }

  const surfaceDrafts = createMapEditorSurfaceDrafts(semanticWorld);

  return Object.freeze({
    connectorDrafts: createMapEditorConnectorDrafts(semanticWorld),
    edgeDrafts: createMapEditorEdgeDrafts(semanticWorld, surfaceDrafts),
    gameplayVolumeDrafts: createMapEditorGameplayVolumeDrafts(semanticWorld),
    lightDrafts: createMapEditorLightDrafts(semanticWorld),
    materialDefinitionDrafts:
      createMapEditorMaterialDefinitionDrafts(semanticWorld),
    placementDrafts: Object.freeze(
      semanticWorld.modules.map(createModuleDraftFromSemanticModule)
    ),
    regionDrafts: createMapEditorRegionDrafts(semanticWorld, surfaceDrafts),
    semanticCompatibilityAssetIds: semanticWorld.compatibilityAssetIds,
    structuralDrafts: createMapEditorStructuralDrafts(semanticWorld),
    surfaceDrafts,
    terrainPatchDrafts: createMapEditorTerrainPatchDrafts(semanticWorld)
  });
}

function createSelectedPlacementId(
  selectedEntityRef: MapEditorSelectedEntityRef | null
): string | null {
  return selectedEntityRef?.kind === "module" ? selectedEntityRef.id : null;
}

function resolveInitialSelectedEntityRef(
  semanticDrafts: Pick<
    MapEditorProjectSnapshot,
    | "connectorDrafts"
    | "edgeDrafts"
    | "gameplayVolumeDrafts"
    | "lightDrafts"
    | "placementDrafts"
    | "regionDrafts"
    | "structuralDrafts"
    | "surfaceDrafts"
    | "terrainPatchDrafts"
  >
): MapEditorSelectedEntityRef | null {
  return (
    semanticDrafts.regionDrafts[0] !== undefined
      ? Object.freeze({
          id: semanticDrafts.regionDrafts[0].regionId,
          kind: "region" as const
        })
      : semanticDrafts.structuralDrafts[0] !== undefined
        ? Object.freeze({
            id: semanticDrafts.structuralDrafts[0].structureId,
            kind: "structure" as const
          })
        : semanticDrafts.edgeDrafts[0] !== undefined
        ? Object.freeze({
            id: semanticDrafts.edgeDrafts[0].edgeId,
            kind: "edge" as const
          })
        : semanticDrafts.placementDrafts[0] !== undefined
          ? Object.freeze({
              id: semanticDrafts.placementDrafts[0].placementId,
              kind: "module" as const
            })
          : semanticDrafts.surfaceDrafts[0] !== undefined
            ? Object.freeze({
                id: semanticDrafts.surfaceDrafts[0].surfaceId,
                kind: "surface" as const
              })
            : semanticDrafts.terrainPatchDrafts[0] !== undefined
              ? Object.freeze({
                  id: semanticDrafts.terrainPatchDrafts[0].terrainPatchId,
                  kind: "terrain-patch" as const
                })
              : semanticDrafts.connectorDrafts[0] !== undefined
                ? Object.freeze({
                    id: semanticDrafts.connectorDrafts[0].connectorId,
                    kind: "connector" as const
                  })
                : null
  );
}

function createMapEditorPlacementId(
  project: MapEditorProjectSnapshot,
  assetId: string
): string {
  const prefix = `${assetId}:module:`;
  let nextNumber = 1;

  for (const placement of project.placementDrafts) {
    if (!placement.placementId.startsWith(prefix)) {
      continue;
    }

    const numericSuffix = Number(placement.placementId.slice(prefix.length));

    if (Number.isFinite(numericSuffix)) {
      nextNumber = Math.max(nextNumber, numericSuffix + 1);
    }
  }

  return `${prefix}${nextNumber}`;
}

function createMapEditorSurfaceId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:surface:${project.surfaceDrafts.length + 1}`;
}

function createMapEditorRegionId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:region:${project.regionDrafts.length + 1}`;
}

function createMapEditorEdgeId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:edge:${project.edgeDrafts.length + 1}`;
}

function createMapEditorConnectorId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:connector:${project.connectorDrafts.length + 1}`;
}

function createMapEditorTerrainPatchId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:terrain:${project.terrainPatchDrafts.length + 1}`;
}

function createMapEditorStructureId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:structure:${project.structuralDrafts.length + 1}`;
}

function createMapEditorGameplayVolumeId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:gameplay-volume:${project.gameplayVolumeDrafts.length + 1}`;
}

function createManagedMapEditorKillFloorVolumeId(bundleId: string): string {
  return `${bundleId}:gameplay-volume:kill-floor`;
}

function createMapEditorLightId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:light:${project.lightDrafts.length + 1}`;
}

export function createNextMapEditorMaterialDefinitionId(
  project: Pick<
    MapEditorProjectSnapshot,
    "bundleId" | "materialDefinitionDrafts"
  >
): string {
  const prefix = `${project.bundleId}:material:`;
  let nextNumber = project.materialDefinitionDrafts.length + 1;

  for (const materialDefinition of project.materialDefinitionDrafts) {
    if (!materialDefinition.materialId.startsWith(prefix)) {
      continue;
    }

    const numericSuffix = Number(
      materialDefinition.materialId.slice(prefix.length)
    );

    if (Number.isFinite(numericSuffix)) {
      nextNumber = Math.max(nextNumber, Math.round(numericSuffix) + 1);
    }
  }

  return `${prefix}${nextNumber}`;
}

function createMapEditorPlayerSpawnId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:spawn:${project.playerSpawnDrafts.length + 1}`;
}

function createMapEditorResourceSpawnId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:resource:${project.resourceSpawnDrafts.length + 1}`;
}

function createMapEditorSceneObjectId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:scene-object:${project.sceneObjectDrafts.length + 1}`;
}

function createMapEditorWaterRegionId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:water-region:${project.waterRegionDrafts.length + 1}`;
}

function createMapEditorLaunchVariationId(project: MapEditorProjectSnapshot): string {
  return `${project.bundleId}:variation:${project.launchVariationDrafts.length + 1}`;
}

function createMapEditorKillFloorSize(
  projectSettings: MapEditorProjectSettingsSnapshot
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x: projectSettings.helperGridSizeMeters * 2,
    y: defaultKillFloorThicknessMeters,
    z: projectSettings.helperGridSizeMeters * 2
  });
}

function resolveMapEditorProjectDefaultKillFloorElevation(
  project: Pick<
    MapEditorProjectSnapshot,
    | "placementDrafts"
    | "playerSpawnDrafts"
    | "resourceSpawnDrafts"
    | "sceneObjectDrafts"
    | "structuralDrafts"
    | "surfaceDrafts"
    | "terrainPatchDrafts"
    | "waterRegionDrafts"
  >
): number {
  let minimumElevationMeters = 0;

  for (const surface of project.surfaceDrafts) {
    minimumElevationMeters = Math.min(minimumElevationMeters, surface.elevation);
  }

  for (const structure of project.structuralDrafts) {
    minimumElevationMeters = Math.min(
      minimumElevationMeters,
      structure.center.y - structure.size.y * 0.5
    );
  }

  for (const terrainPatch of project.terrainPatchDrafts) {
    let minimumHeightSampleMeters = 0;

    for (const heightSample of terrainPatch.heightSamples) {
      minimumHeightSampleMeters = Math.min(
        minimumHeightSampleMeters,
        heightSample
      );
    }

    minimumElevationMeters = Math.min(
      minimumElevationMeters,
      terrainPatch.origin.y + minimumHeightSampleMeters
    );
  }

  for (const placement of project.placementDrafts) {
    minimumElevationMeters = Math.min(minimumElevationMeters, placement.position.y);
  }

  for (const playerSpawn of project.playerSpawnDrafts) {
    minimumElevationMeters = Math.min(
      minimumElevationMeters,
      playerSpawn.position.y
    );
  }

  for (const resourceSpawn of project.resourceSpawnDrafts) {
    minimumElevationMeters = Math.min(
      minimumElevationMeters,
      resourceSpawn.position.y
    );
  }

  for (const sceneObject of project.sceneObjectDrafts) {
    minimumElevationMeters = Math.min(
      minimumElevationMeters,
      sceneObject.position.y
    );
  }

  for (const waterRegion of project.waterRegionDrafts) {
    minimumElevationMeters = Math.min(
      minimumElevationMeters,
      waterRegion.topElevationMeters
    );
  }

  return minimumElevationMeters - defaultKillFloorClearanceMeters;
}

function createManagedMapEditorKillFloorDraft(
  project: Pick<
    MapEditorProjectSnapshot,
    | "bundleId"
    | "placementDrafts"
    | "playerSpawnDrafts"
    | "projectSettings"
    | "resourceSpawnDrafts"
    | "sceneObjectDrafts"
    | "structuralDrafts"
    | "surfaceDrafts"
    | "terrainPatchDrafts"
    | "waterRegionDrafts"
  >
): MapEditorGameplayVolumeDraftSnapshot {
  return freezeGameplayVolumeDraft({
    center: Object.freeze({
      x: 0,
      y: resolveMapEditorProjectDefaultKillFloorElevation(project),
      z: 0
    }),
    label: "Kill Floor",
    priority: -1,
    rotationYRadians: 0,
    routePoints: Object.freeze([]),
    size: createMapEditorKillFloorSize(project.projectSettings),
    tags: Object.freeze(["environment", "kill-floor"]),
    teamId: null,
    volumeId: createManagedMapEditorKillFloorVolumeId(project.bundleId),
    volumeKind: "kill-floor"
  });
}

function readMapEditorKillFloorDraftIndex(
  project: Pick<MapEditorProjectSnapshot, "gameplayVolumeDrafts">
): number {
  return project.gameplayVolumeDrafts.findIndex(
    (volumeDraft) => volumeDraft.volumeKind === "kill-floor"
  );
}

function syncMapEditorProjectKillFloorDraft(
  project: MapEditorProjectSnapshot,
  options: {
    readonly createIfMissing?: boolean;
    readonly synchronizeFootprintFromHelperGrid?: boolean;
  } = {}
): MapEditorProjectSnapshot {
  const killFloorIndex = readMapEditorKillFloorDraftIndex(project);

  if (killFloorIndex < 0) {
    if (options.createIfMissing === false) {
      return project;
    }

    return Object.freeze({
      ...project,
      gameplayVolumeDrafts: Object.freeze([
        ...project.gameplayVolumeDrafts,
        createManagedMapEditorKillFloorDraft(project)
      ])
    });
  }

  if (options.synchronizeFootprintFromHelperGrid !== true) {
    return project;
  }

  const killFloorDraft = project.gameplayVolumeDrafts[killFloorIndex]!;
  const nextSize = createMapEditorKillFloorSize(project.projectSettings);

  if (
    killFloorDraft.size.x === nextSize.x &&
    killFloorDraft.size.z === nextSize.z
  ) {
    return project;
  }

  return Object.freeze({
    ...project,
    gameplayVolumeDrafts: Object.freeze(
      project.gameplayVolumeDrafts.map((volumeDraft, volumeIndex) =>
        volumeIndex === killFloorIndex
          ? freezeGameplayVolumeDraft({
              ...volumeDraft,
              size: Object.freeze({
                ...volumeDraft.size,
                x: nextSize.x,
                z: nextSize.z
              })
            })
          : volumeDraft
      )
    )
  });
}

function readSelectedEntityPosition(
  project: MapEditorProjectSnapshot
): MetaverseWorldSurfaceVector3Snapshot | null {
  const selectedEntityRef = project.selectedEntityRef;

  if (selectedEntityRef === null) {
    return null;
  }

  switch (selectedEntityRef.kind) {
    case "module":
      return (
        project.placementDrafts.find(
          (placement) => placement.placementId === selectedEntityRef.id
        )?.position ?? null
      );
    case "region":
      return (
        project.regionDrafts.find((region) => region.regionId === selectedEntityRef.id)
          ?.center ?? null
      );
    case "edge":
      return (
        project.edgeDrafts.find((edge) => edge.edgeId === selectedEntityRef.id)?.center ??
        null
      );
    case "connector":
      return (
        project.connectorDrafts.find(
          (connector) => connector.connectorId === selectedEntityRef.id
        )?.center ?? null
      );
    case "structure":
      return (
        project.structuralDrafts.find(
          (structure) => structure.structureId === selectedEntityRef.id
        )?.center ?? null
      );
    case "gameplay-volume":
      return (
        project.gameplayVolumeDrafts.find(
          (volume) => volume.volumeId === selectedEntityRef.id
        )?.center ?? null
      );
    case "light":
      return (
        project.lightDrafts.find((light) => light.lightId === selectedEntityRef.id)
          ?.position ?? null
      );
    case "surface":
      return (
        project.surfaceDrafts.find((surface) => surface.surfaceId === selectedEntityRef.id)
          ?.center ?? null
      );
    case "terrain-patch":
      return (
        project.terrainPatchDrafts.find(
          (terrainPatch) => terrainPatch.terrainPatchId === selectedEntityRef.id
        )?.origin ?? null
      );
    case "player-spawn":
      return (
        project.playerSpawnDrafts.find(
          (spawnDraft) => spawnDraft.spawnId === selectedEntityRef.id
        )?.position ?? null
      );
    case "resource-spawn":
      return (
        project.resourceSpawnDrafts.find(
          (resourceSpawnDraft) =>
            resourceSpawnDraft.spawnId === selectedEntityRef.id
        )?.position ?? null
      );
    case "scene-object":
      return (
        project.sceneObjectDrafts.find(
          (sceneObjectDraft) => sceneObjectDraft.objectId === selectedEntityRef.id
        )?.position ?? null
      );
    case "water-region": {
      const waterRegionDraft =
        project.waterRegionDrafts.find(
          (candidateWaterRegionDraft) =>
            candidateWaterRegionDraft.waterRegionId === selectedEntityRef.id
        ) ?? null;

      return waterRegionDraft === null
        ? null
        : resolveMapEditorWaterRegionTopCenter(waterRegionDraft);
    }
    case "world-atmosphere":
    case "world-sky":
    case "world-sun":
      return null;
  }
}

function createMapEditorSceneDraftPosition(
  project: MapEditorProjectSnapshot,
  offset: MetaverseWorldSurfaceVector3Snapshot
): MapEditorBuildPlacementPositionSnapshot {
  const selectedPosition = readSelectedEntityPosition(project);

  if (selectedPosition !== null) {
    return Object.freeze({
      x: selectedPosition.x + offset.x,
      y: selectedPosition.y + offset.y,
      z: selectedPosition.z + offset.z
    });
  }

  const lastModule = project.placementDrafts[project.placementDrafts.length - 1] ?? null;

  if (lastModule !== null) {
    return Object.freeze({
      x: lastModule.position.x + offset.x,
      y: lastModule.position.y + offset.y,
      z: lastModule.position.z + offset.z
    });
  }

  return Object.freeze({
    x: offset.x,
    y: offset.y,
    z: offset.z
  });
}

function resolveNewPlacementPosition(
  project: MapEditorProjectSnapshot,
  assetId: string
): MetaverseWorldSurfaceVector3Snapshot {
  const existingPlacements = project.placementDrafts.filter(
    (placement) => placement.assetId === assetId
  );
  const selectedPlacement = readSelectedMapEditorPlacement(project);
  const lastPlacement = existingPlacements[existingPlacements.length - 1] ?? null;
  const buildPrimitiveCatalogEntry = readMapEditorBuildPrimitiveCatalogEntry(assetId);

  if (buildPrimitiveCatalogEntry !== null && (selectedPlacement ?? lastPlacement) !== null) {
    const anchor = selectedPlacement ?? lastPlacement!;

    return Object.freeze({
      x: anchor.position.x + buildPrimitiveCatalogEntry.footprint.x,
      y: anchor.position.y,
      z: anchor.position.z
    });
  }

  if (lastPlacement !== null) {
    return Object.freeze({
      x: lastPlacement.position.x + 4,
      y: lastPlacement.position.y,
      z: lastPlacement.position.z
    });
  }

  const placementIndex = project.placementDrafts.length;
  const column = placementIndex % 4;
  const row = Math.floor(placementIndex / 4);

  return Object.freeze({
    x: (column - 1.5) * 6,
    y: 0,
    z: row * 6
  });
}

function withSelectedEntity(
  project: MapEditorProjectSnapshot,
  selectedEntityRef: MapEditorSelectedEntityRef | null
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    selectedEntityRef,
    selectedPlacementId: createSelectedPlacementId(selectedEntityRef)
  });
}

type MapEditorOutlinerGroupId =
  | "advanced-semantics"
  | "connectors"
  | "floors-paths"
  | "gameplay-anchors"
  | "modules"
  | "terrain"
  | "walls-boundaries"
  | "world"
  | "water";

const defaultTerrainPatchSampleCount = 9;
const defaultTerrainBrushHeightDeltaMeters = 1;
const defaultPathSurfaceSize = Object.freeze({
  x: mapEditorBuildGridUnitMeters,
  y: 0.5,
  z: mapEditorBuildGridUnitMeters
});
const defaultKillFloorClearanceMeters = 5;
const defaultKillFloorThicknessMeters = 0.5;
const defaultWallThicknessMeters = 0.5;
const defaultWallHeightMeters = 4;

function resolveWallPresetDimensions(
  edgeKind: MapEditorEdgeDraftSnapshot["edgeKind"]
): {
  readonly heightMeters: number;
  readonly thicknessMeters: number;
} {
  switch (edgeKind) {
    case "curb":
      return Object.freeze({
        heightMeters: 0.75,
        thicknessMeters: 0.75
      });
    case "rail":
      return Object.freeze({
        heightMeters: 1.25,
        thicknessMeters: 0.3
      });
    case "fence":
      return Object.freeze({
        heightMeters: 2.5,
        thicknessMeters: 0.35
      });
    case "retaining-wall":
      return Object.freeze({
        heightMeters: 5,
        thicknessMeters: 0.75
      });
    case "wall":
      return Object.freeze({
        heightMeters: defaultWallHeightMeters,
        thicknessMeters: defaultWallThicknessMeters
      });
  }
}

function freezeBuildPosition(
  position: MetaverseWorldSurfaceVector3Snapshot
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x: position.x,
    y: position.y,
    z: position.z
  });
}

function createPlanarPoint(
  x: number,
  z: number
): MetaverseMapBundleSemanticPlanarPointSnapshot {
  return Object.freeze({ x, z });
}

function createRectangularSurfaceLoop(
  size: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "z">
): MetaverseMapBundleSemanticPlanarLoopSnapshot {
  return Object.freeze({
    points: Object.freeze([
      createPlanarPoint(-size.x * 0.5, -size.z * 0.5),
      createPlanarPoint(size.x * 0.5, -size.z * 0.5),
      createPlanarPoint(size.x * 0.5, size.z * 0.5),
      createPlanarPoint(-size.x * 0.5, size.z * 0.5)
    ])
  });
}

function snapMapEditorPositionToGrid(
  position: MetaverseWorldSurfaceVector3Snapshot
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x: snapMapEditorBuildCoordinateToGrid(position.x),
    y: position.y,
    z: snapMapEditorBuildCoordinateToGrid(position.z)
  });
}

function findSurfaceDraftById(
  project: MapEditorProjectSnapshot,
  surfaceId: string
): MapEditorSurfaceDraftSnapshot | null {
  return project.surfaceDrafts.find((surface) => surface.surfaceId === surfaceId) ?? null;
}

function findSurfaceDraftAtPosition(
  project: MapEditorProjectSnapshot,
  position: MetaverseWorldSurfaceVector3Snapshot,
  elevation: number,
  toleranceMeters = 0.01
): MapEditorSurfaceDraftSnapshot | null {
  return (
    project.surfaceDrafts.find(
      (surface) =>
        Math.abs(surface.center.x - position.x) <= toleranceMeters &&
        Math.abs(surface.center.z - position.z) <= toleranceMeters &&
        Math.abs(surface.elevation - elevation) <= toleranceMeters
    ) ?? null
  );
}

function findPathRegionDraftAtPosition(
  project: MapEditorProjectSnapshot,
  position: MetaverseWorldSurfaceVector3Snapshot,
  elevation: number,
  toleranceMeters = 0.01
): MapEditorRegionDraftSnapshot | null {
  return (
    project.regionDrafts.find((region) => {
      if (region.regionKind !== "path") {
        return false;
      }

      const surface = findSurfaceDraftById(project, region.surfaceId);

      return (
        surface !== null &&
        Math.abs(region.center.x - position.x) <= toleranceMeters &&
        Math.abs(region.center.z - position.z) <= toleranceMeters &&
        Math.abs(surface.elevation - elevation) <= toleranceMeters
      );
    }) ?? null
  );
}

export function readNearestMapEditorPathAnchor(
  project: MapEditorProjectSnapshot,
  position: MetaverseWorldSurfaceVector3Snapshot,
  horizontalToleranceMeters = mapEditorBuildGridUnitMeters,
  verticalToleranceMeters = defaultWallHeightMeters
): {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly elevation: number;
} | null {
  let nearestAnchor:
    | {
        readonly center: MetaverseWorldSurfaceVector3Snapshot;
        readonly distanceSquared: number;
        readonly elevation: number;
      }
    | null = null;

  for (const region of project.regionDrafts) {
    if (region.regionKind !== "path") {
      continue;
    }

    const surface = findSurfaceDraftById(project, region.surfaceId);

    if (surface === null) {
      continue;
    }

    const localHalfLength = Math.max(
      mapEditorBuildGridUnitMeters * 0.5,
      surface.size.z * 0.5
    );
    const candidateAnchors = [
      Object.freeze({
        center: Object.freeze({
          x: region.center.x + Math.sin(surface.rotationYRadians) * -localHalfLength,
          y: surface.elevation - surface.slopeRiseMeters * 0.5,
          z: region.center.z + Math.cos(surface.rotationYRadians) * -localHalfLength
        }),
        elevation: surface.elevation - surface.slopeRiseMeters * 0.5
      }),
      Object.freeze({
        center: Object.freeze({
          x: region.center.x + Math.sin(surface.rotationYRadians) * localHalfLength,
          y: surface.elevation + surface.slopeRiseMeters * 0.5,
          z: region.center.z + Math.cos(surface.rotationYRadians) * localHalfLength
        }),
        elevation: surface.elevation + surface.slopeRiseMeters * 0.5
      })
    ];

    for (const candidateAnchor of candidateAnchors) {
      const deltaX = candidateAnchor.center.x - position.x;
      const deltaZ = candidateAnchor.center.z - position.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;

      if (
        distanceSquared >
          horizontalToleranceMeters * horizontalToleranceMeters ||
        Math.abs(candidateAnchor.elevation - position.y) > verticalToleranceMeters
      ) {
        continue;
      }

      if (
        nearestAnchor === null ||
        distanceSquared < nearestAnchor.distanceSquared
      ) {
        nearestAnchor = Object.freeze({
          center: freezeBuildPosition(candidateAnchor.center),
          distanceSquared,
          elevation: candidateAnchor.elevation
        });
      }
    }
  }

  return nearestAnchor === null
    ? null
    : Object.freeze({
        center: nearestAnchor.center,
        elevation: nearestAnchor.elevation
      });
}

function createTerrainPatchHeights(
  sampleCountX: number,
  sampleCountZ: number
): readonly number[] {
  return Object.freeze(
    Array.from({ length: sampleCountX * sampleCountZ }, () => 0)
  );
}

function createTerrainPatchMaterialLayers(
  terrainPatchId: string,
  sampleCountX: number,
  sampleCountZ: number,
  materialId: MapEditorStructuralDraftSnapshot["materialId"] = "terrain-grass"
): MapEditorTerrainPatchDraftSnapshot["materialLayers"] {
  return Object.freeze([
    Object.freeze({
      layerId: `${terrainPatchId}:${materialId}`,
      materialId,
      weightSamples: Object.freeze(
        Array.from({ length: sampleCountX * sampleCountZ }, () => 1)
      )
    })
  ]);
}

function resolveTerrainHalfSpanMeters(
  sampleCount: number,
  sampleSpacingMeters: number
): number {
  return Math.max(0, sampleCount - 1) * sampleSpacingMeters * 0.5;
}

function isPointInsideTerrainPatch(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot,
  position: MetaverseWorldSurfaceVector3Snapshot
): boolean {
  return (
    Math.abs(position.x - terrainPatch.origin.x) <=
      resolveTerrainHalfSpanMeters(
        terrainPatch.sampleCountX,
        terrainPatch.sampleSpacingMeters
      ) &&
    Math.abs(position.z - terrainPatch.origin.z) <=
      resolveTerrainHalfSpanMeters(
        terrainPatch.sampleCountZ,
        terrainPatch.sampleSpacingMeters
      )
  );
}

function findTerrainPatchAtPosition(
  project: MapEditorProjectSnapshot,
  position: MetaverseWorldSurfaceVector3Snapshot
): MapEditorTerrainPatchDraftSnapshot | null {
  return (
    project.terrainPatchDrafts.find((terrainPatch) =>
      isPointInsideTerrainPatch(terrainPatch, position)
    ) ?? null
  );
}

function resolveTerrainCellIndex(
  coordinate: number,
  centerCoordinate: number,
  sampleCount: number,
  sampleSpacingMeters: number
): number | null {
  const halfSpan = (sampleCount - 1) * 0.5;
  const localCoordinate =
    (coordinate - centerCoordinate) / sampleSpacingMeters + halfSpan;
  const snappedIndex = Math.round(localCoordinate);

  return snappedIndex >= 0 && snappedIndex < sampleCount ? snappedIndex : null;
}

export function resolveMapEditorTerrainCellPosition(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot,
  cellX: number,
  cellZ: number
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x:
      terrainPatch.origin.x +
      (cellX - (terrainPatch.sampleCountX - 1) * 0.5) *
        terrainPatch.sampleSpacingMeters,
    y: terrainPatch.origin.y,
    z:
      terrainPatch.origin.z +
      (cellZ - (terrainPatch.sampleCountZ - 1) * 0.5) *
        terrainPatch.sampleSpacingMeters
  });
}

function resolveTerrainCellIndices(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot,
  position: MetaverseWorldSurfaceVector3Snapshot
): {
  readonly cellX: number;
  readonly cellZ: number;
} | null {
  const cellX = resolveTerrainCellIndex(
    position.x,
    terrainPatch.origin.x,
    terrainPatch.sampleCountX,
    terrainPatch.sampleSpacingMeters
  );
  const cellZ = resolveTerrainCellIndex(
    position.z,
    terrainPatch.origin.z,
    terrainPatch.sampleCountZ,
    terrainPatch.sampleSpacingMeters
  );

  return cellX === null || cellZ === null
    ? null
    : Object.freeze({
        cellX,
        cellZ
      });
}

function createTerrainHeightIndex(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot,
  cellX: number,
  cellZ: number
): number {
  return cellZ * terrainPatch.sampleCountX + cellX;
}

export function createNaturalTerrainHeightSamples(
  draft: MapEditorTerrainPatchDraftSnapshot
): readonly number[] {
  const halfX = (draft.sampleCountX - 1) * 0.5;
  const halfZ = (draft.sampleCountZ - 1) * 0.5;

  return Object.freeze(
    Array.from(
      { length: draft.sampleCountX * draft.sampleCountZ },
      (_entry, sampleIndex) => {
        const sampleX = sampleIndex % draft.sampleCountX;
        const sampleZ = Math.floor(sampleIndex / draft.sampleCountX);
        const x = (sampleX - halfX) / Math.max(1, halfX);
        const z = (sampleZ - halfZ) / Math.max(1, halfZ);
        const ridge =
          Math.sin((x + draft.origin.x * 0.01) * 4.1) * 0.9 +
          Math.cos((z + draft.origin.z * 0.01) * 3.7) * 0.7;
        const basin = Math.max(0, 1 - Math.hypot(x, z)) * 1.1;

        return Math.round((ridge + basin) * 100) / 100;
      }
    )
  );
}

const terrainSupportAlignmentHeightToleranceMeters = mapEditorBuildGridUnitMeters;
const terrainSurfaceAlignmentEpsilon = 0.001;

function resolveLocalPlanarPosition(
  center: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "z">,
  rotationYRadians: number,
  position: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "z">
): {
  readonly x: number;
  readonly z: number;
} {
  const deltaX = position.x - center.x;
  const deltaZ = position.z - center.z;
  const sine = Math.sin(rotationYRadians);
  const cosine = Math.cos(rotationYRadians);

  return Object.freeze({
    x: deltaX * cosine - deltaZ * sine,
    z: deltaX * sine + deltaZ * cosine
  });
}

function isPointOnPlanarSegment(
  position: Pick<MetaverseMapBundleSemanticPlanarPointSnapshot, "x" | "z">,
  start: MetaverseMapBundleSemanticPlanarPointSnapshot,
  end: MetaverseMapBundleSemanticPlanarPointSnapshot
): boolean {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const cross =
    (position.x - start.x) * deltaZ - (position.z - start.z) * deltaX;

  if (Math.abs(cross) > terrainSurfaceAlignmentEpsilon) {
    return false;
  }

  const dot =
    (position.x - start.x) * deltaX + (position.z - start.z) * deltaZ;

  if (dot < -terrainSurfaceAlignmentEpsilon) {
    return false;
  }

  const squaredLength = deltaX * deltaX + deltaZ * deltaZ;

  return dot <= squaredLength + terrainSurfaceAlignmentEpsilon;
}

function isPointInsidePlanarLoop(
  loop: MetaverseMapBundleSemanticPlanarLoopSnapshot,
  position: Pick<MetaverseMapBundleSemanticPlanarPointSnapshot, "x" | "z">
): boolean {
  const points = loop.points;

  if (points.length < 3) {
    return false;
  }

  let isInside = false;

  for (let index = 0, previousIndex = points.length - 1; index < points.length; index += 1) {
    const point = points[index]!;
    const previousPoint = points[previousIndex]!;

    if (isPointOnPlanarSegment(position, previousPoint, point)) {
      return true;
    }

    const intersects =
      (point.z > position.z) !== (previousPoint.z > position.z) &&
      position.x <
        ((previousPoint.x - point.x) * (position.z - point.z)) /
          (previousPoint.z - point.z + terrainSurfaceAlignmentEpsilon) +
          point.x;

    if (intersects) {
      isInside = !isInside;
    }

    previousIndex = index;
  }

  return isInside;
}

function resolvePlacedSupportSurfaceHeight(
  collider: {
    readonly halfExtents: MetaverseWorldSurfaceVector3Snapshot;
    readonly rotationYRadians: number;
    readonly translation: MetaverseWorldSurfaceVector3Snapshot;
  },
  position: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "z">
): number | null {
  const localPosition = resolveLocalPlanarPosition(
    collider.translation,
    collider.rotationYRadians,
    position
  );

  if (
    Math.abs(localPosition.x) > collider.halfExtents.x + terrainSurfaceAlignmentEpsilon ||
    Math.abs(localPosition.z) > collider.halfExtents.z + terrainSurfaceAlignmentEpsilon
  ) {
    return null;
  }

  return collider.translation.y + collider.halfExtents.y;
}

function resolveSemanticSupportSurfaceHeight(
  region: Pick<MapEditorRegionDraftSnapshot, "outerLoop">,
  surface: Pick<
    MapEditorSurfaceDraftSnapshot,
    "center" | "elevation" | "kind" | "rotationYRadians" | "size" | "slopeRiseMeters"
  >,
  position: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "z">
): number | null {
  const localPosition = resolveLocalPlanarPosition(
    surface.center,
    surface.rotationYRadians,
    position
  );

  if (
    !isPointInsidePlanarLoop(region.outerLoop, {
      x: localPosition.x,
      z: localPosition.z
    })
  ) {
    return null;
  }

  return (
    surface.elevation +
    resolveMetaverseMapBundleSemanticSurfaceLocalHeightMeters(
      surface,
      localPosition.x,
      localPosition.z
    )
  );
}

export function conformMapEditorTerrainPatchDraftToSupportSurfaces(
  project: MapEditorProjectSnapshot,
  terrainPatch: MapEditorTerrainPatchDraftSnapshot
): MapEditorTerrainPatchDraftSnapshot {
  const supportColliders = project.placementDrafts.flatMap((placement) =>
    resolveMetaverseWorldPlacedSurfaceColliders({
      environmentAssetId: placement.assetId,
      placements: Object.freeze([
        Object.freeze({
          position: placement.position,
          rotationYRadians: placement.rotationYRadians,
          scale: placement.scale
        })
      ]),
      surfaceColliders: placement.surfaceColliders
    }).filter((collider) => collider.traversalAffordance === "support")
  );
  const supportRegions = project.regionDrafts.flatMap((region) => {
    if (
      region.regionKind !== "floor" &&
      region.regionKind !== "path" &&
      region.regionKind !== "roof"
    ) {
      return [];
    }

    const surface = findSurfaceDraftById(project, region.surfaceId);

    return surface === null
      ? []
      : [
          Object.freeze({
            region,
            surface
          })
        ];
  });

  if (supportColliders.length === 0 && supportRegions.length === 0) {
    return terrainPatch;
  }

  let didChange = false;
  const nextHeightSamples = terrainPatch.heightSamples.map((heightSample, sampleIndex) => {
    const sampleX = sampleIndex % terrainPatch.sampleCountX;
    const sampleZ = Math.floor(sampleIndex / terrainPatch.sampleCountX);
    const samplePosition = resolveMapEditorTerrainCellPosition(
      terrainPatch,
      sampleX,
      sampleZ
    );
    const currentWorldHeight = terrainPatch.origin.y + (heightSample ?? 0);
    let selectedSupportHeight: number | null = null;
    let selectedHeightDelta = Number.POSITIVE_INFINITY;

    for (const collider of supportColliders) {
      const supportHeight = resolvePlacedSupportSurfaceHeight(
        collider,
        samplePosition
      );

      if (supportHeight === null) {
        continue;
      }

      const heightDelta = Math.abs(supportHeight - currentWorldHeight);

      if (
        heightDelta <= terrainSupportAlignmentHeightToleranceMeters &&
        heightDelta < selectedHeightDelta
      ) {
        selectedSupportHeight = supportHeight;
        selectedHeightDelta = heightDelta;
      }
    }

    for (const supportRegion of supportRegions) {
      const supportHeight = resolveSemanticSupportSurfaceHeight(
        supportRegion.region,
        supportRegion.surface,
        samplePosition
      );

      if (supportHeight === null) {
        continue;
      }

      const heightDelta = Math.abs(supportHeight - currentWorldHeight);

      if (
        heightDelta <= terrainSupportAlignmentHeightToleranceMeters &&
        heightDelta < selectedHeightDelta
      ) {
        selectedSupportHeight = supportHeight;
        selectedHeightDelta = heightDelta;
      }
    }

    if (selectedSupportHeight === null) {
      return heightSample;
    }

    const nextHeightSample =
      Math.round((selectedSupportHeight - terrainPatch.origin.y) * 100) / 100;

    if (nextHeightSample !== heightSample) {
      didChange = true;
    }

    return nextHeightSample;
  });

  return didChange
    ? freezeTerrainPatchDraft({
        ...terrainPatch,
        heightSamples: Object.freeze(nextHeightSamples)
      })
    : terrainPatch;
}

function normalizeTerrainBrushSizeCells(
  brushSizeCells: MapEditorTerrainBrushSizeCells
): number {
  return Math.max(1, Math.min(16, Math.round(brushSizeCells)));
}

function normalizeTerrainCliffSpanCells(cliffSpanCells: number): number {
  return Math.max(0, Math.min(8, Math.round(cliffSpanCells)));
}

const minimumTerrainCliffPitchRadians = 70 * (Math.PI / 180);

function resolveTerrainCliffHeight(
  input: {
    readonly brushStrengthMeters: number;
    readonly cellX: number;
    readonly normalizedNoise: number;
    readonly sampleSpacingMeters: number;
    readonly targetCellX: number;
    readonly targetHeightMeters: number;
    readonly terrainCliffSpanCells: number;
  }
): number {
  const lowHeight = input.targetHeightMeters - input.brushStrengthMeters;
  const highHeight = input.targetHeightMeters + input.brushStrengthMeters;
  const heightDelta = Math.max(0, highHeight - lowHeight);
  const requestedSpanCells = normalizeTerrainCliffSpanCells(
    input.terrainCliffSpanCells
  );
  const maxPitchSafeSpanCells =
    heightDelta <= 0
      ? 0
      : Math.floor(
          heightDelta /
            (Math.tan(minimumTerrainCliffPitchRadians) *
              Math.max(0.001, input.sampleSpacingMeters))
        );
  const spanCells = Math.max(
    0,
    Math.min(requestedSpanCells, maxPitchSafeSpanCells)
  );
  const signedCellDistance = input.cellX - input.targetCellX;

  if (spanCells <= 0) {
    return signedCellDistance >= 0 ? highHeight : lowHeight;
  }

  const alpha = Math.min(1, Math.max(0, signedCellDistance / spanCells));
  const shapedAlpha = alpha * alpha * (3 - 2 * alpha);
  const strataNoise =
    (input.normalizedNoise - 0.5) *
    Math.min(0.45, Math.max(0.08, input.brushStrengthMeters * 0.16)) *
    (1 - Math.abs(shapedAlpha - 0.5));

  return lowHeight + heightDelta * shapedAlpha + strataNoise;
}

function isTerrainBoundaryCell(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot,
  cellX: number,
  cellZ: number
): boolean {
  return (
    cellX === 0 ||
    cellZ === 0 ||
    cellX === terrainPatch.sampleCountX - 1 ||
    cellZ === terrainPatch.sampleCountZ - 1
  );
}

function createTerrainBoundarySampleKey(
  position: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "z">
): string {
  return `${Math.round(position.x * 1000)}:${Math.round(position.z * 1000)}`;
}

function cloneTerrainMaterialLayersForEditing(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot
): {
  readonly layerId: string;
  readonly materialId: MapEditorStructuralDraftSnapshot["materialId"];
  readonly weightSamples: number[];
}[] {
  return terrainPatch.materialLayers.map((layer) => ({
    layerId: layer.layerId,
    materialId: layer.materialId,
    weightSamples: [...layer.weightSamples]
  }));
}

function freezeTerrainMaterialLayers(
  materialLayers: readonly {
    readonly layerId: string;
    readonly materialId: MapEditorStructuralDraftSnapshot["materialId"];
    readonly weightSamples: readonly number[];
  }[]
): MapEditorTerrainPatchDraftSnapshot["materialLayers"] {
  return Object.freeze(
    materialLayers.map((layer) =>
      Object.freeze({
        layerId: layer.layerId,
        materialId: layer.materialId,
        weightSamples: Object.freeze([...layer.weightSamples])
      })
    )
  );
}

function ensureEditableTerrainMaterialLayer(
  terrainPatchId: string,
  sampleCount: number,
  materialLayers: {
    readonly layerId: string;
    readonly materialId: MapEditorStructuralDraftSnapshot["materialId"];
    readonly weightSamples: number[];
  }[],
  materialId: MapEditorStructuralDraftSnapshot["materialId"]
): {
  readonly layerId: string;
  readonly materialId: MapEditorStructuralDraftSnapshot["materialId"];
  readonly weightSamples: number[];
} {
  const existingLayer = materialLayers.find((layer) => layer.materialId === materialId);

  if (existingLayer !== undefined) {
    return existingLayer;
  }

  const nextLayer = {
    layerId: `${terrainPatchId}:${materialId}`,
    materialId,
    weightSamples: Array.from({ length: sampleCount }, () => 0)
  };

  materialLayers.push(nextLayer);

  return nextLayer;
}

function transferTerrainBoundarySamples(
  project: MapEditorProjectSnapshot,
  sourceTerrainPatchIds: readonly string[],
  targetTerrainPatchIds: readonly string[]
): MapEditorProjectSnapshot {
  if (sourceTerrainPatchIds.length === 0 || targetTerrainPatchIds.length === 0) {
    return project;
  }

  const sourcePatchIdSet = new Set(sourceTerrainPatchIds);
  const sourceSamplesByKey = new Map<
    string,
    {
      readonly height: number;
      readonly materialWeights: ReadonlyMap<
        MapEditorStructuralDraftSnapshot["materialId"],
        number
      >;
    }
  >();

  for (const terrainPatch of project.terrainPatchDrafts) {
    if (!sourcePatchIdSet.has(terrainPatch.terrainPatchId)) {
      continue;
    }

    for (let cellZ = 0; cellZ < terrainPatch.sampleCountZ; cellZ += 1) {
      for (let cellX = 0; cellX < terrainPatch.sampleCountX; cellX += 1) {
        if (!isTerrainBoundaryCell(terrainPatch, cellX, cellZ)) {
          continue;
        }

        const sampleIndex = createTerrainHeightIndex(terrainPatch, cellX, cellZ);
        const key = createTerrainBoundarySampleKey(
          resolveMapEditorTerrainCellPosition(terrainPatch, cellX, cellZ)
        );
        const materialWeights = new Map<
          MapEditorStructuralDraftSnapshot["materialId"],
          number
        >();

        for (const layer of terrainPatch.materialLayers) {
          const sampleWeight = Math.max(0, layer.weightSamples[sampleIndex] ?? 0);

          if (sampleWeight > 0) {
            materialWeights.set(layer.materialId, sampleWeight);
          }
        }

        sourceSamplesByKey.set(
          key,
          Object.freeze({
            height: terrainPatch.heightSamples[sampleIndex] ?? 0,
            materialWeights
          })
        );
      }
    }
  }

  if (sourceSamplesByKey.size === 0) {
    return project;
  }

  const targetPatchIdSet = new Set(targetTerrainPatchIds);
  let didChange = false;
  const nextTerrainPatchDrafts = project.terrainPatchDrafts.map((terrainPatch) => {
    if (
      !targetPatchIdSet.has(terrainPatch.terrainPatchId) ||
      sourcePatchIdSet.has(terrainPatch.terrainPatchId)
    ) {
      return terrainPatch;
    }

    let patchChanged = false;
    const nextHeights = [...terrainPatch.heightSamples];
    const nextMaterialLayers = cloneTerrainMaterialLayersForEditing(terrainPatch);

    for (let cellZ = 0; cellZ < terrainPatch.sampleCountZ; cellZ += 1) {
      for (let cellX = 0; cellX < terrainPatch.sampleCountX; cellX += 1) {
        if (!isTerrainBoundaryCell(terrainPatch, cellX, cellZ)) {
          continue;
        }

        const sampleIndex = createTerrainHeightIndex(terrainPatch, cellX, cellZ);
        const sourceSample =
          sourceSamplesByKey.get(
            createTerrainBoundarySampleKey(
              resolveMapEditorTerrainCellPosition(terrainPatch, cellX, cellZ)
            )
          ) ?? null;

        if (sourceSample === null) {
          continue;
        }

        const sourceHeight = Math.round(sourceSample.height * 100) / 100;

        if ((nextHeights[sampleIndex] ?? 0) !== sourceHeight) {
          nextHeights[sampleIndex] = sourceHeight;
          patchChanged = true;
        }

        for (const layer of nextMaterialLayers) {
          const nextWeight = Math.max(
            0,
            sourceSample.materialWeights.get(layer.materialId) ?? 0
          );

          if ((layer.weightSamples[sampleIndex] ?? 0) !== nextWeight) {
            layer.weightSamples[sampleIndex] = nextWeight;
            patchChanged = true;
          }
        }

        for (const [materialId, sampleWeight] of sourceSample.materialWeights) {
          const targetLayer = ensureEditableTerrainMaterialLayer(
            terrainPatch.terrainPatchId,
            terrainPatch.sampleCountX * terrainPatch.sampleCountZ,
            nextMaterialLayers,
            materialId
          );
          const nextWeight = Math.max(0, sampleWeight);

          if ((targetLayer.weightSamples[sampleIndex] ?? 0) !== nextWeight) {
            targetLayer.weightSamples[sampleIndex] = nextWeight;
            patchChanged = true;
          }
        }
      }
    }

    if (!patchChanged) {
      return terrainPatch;
    }

    didChange = true;

    return freezeTerrainPatchDraft({
      ...terrainPatch,
      heightSamples: Object.freeze(nextHeights),
      materialLayers: freezeTerrainMaterialLayers(nextMaterialLayers)
    });
  });

  return didChange
    ? Object.freeze({
        ...project,
        terrainPatchDrafts: Object.freeze(nextTerrainPatchDrafts)
      })
    : project;
}

function seedTerrainPatchBoundariesFromNeighbors(
  project: MapEditorProjectSnapshot,
  terrainPatchId: string
): MapEditorProjectSnapshot {
  return transferTerrainBoundarySamples(
    project,
    project.terrainPatchDrafts
      .filter((terrainPatch) => terrainPatch.terrainPatchId !== terrainPatchId)
      .map((terrainPatch) => terrainPatch.terrainPatchId),
    [terrainPatchId]
  );
}

function propagateTerrainPatchBoundariesToNeighbors(
  project: MapEditorProjectSnapshot,
  terrainPatchId: string
): MapEditorProjectSnapshot {
  return transferTerrainBoundarySamples(
    project,
    [terrainPatchId],
    project.terrainPatchDrafts
      .filter((terrainPatch) => terrainPatch.terrainPatchId !== terrainPatchId)
      .map((terrainPatch) => terrainPatch.terrainPatchId)
  );
}

function areTerrainPatchMergeInputsCompatible(
  terrainPatches: readonly MapEditorTerrainPatchDraftSnapshot[]
): boolean {
  const firstTerrainPatch = terrainPatches[0] ?? null;

  if (firstTerrainPatch === null) {
    return false;
  }

  return terrainPatches.every(
    (terrainPatch) =>
      Math.abs(terrainPatch.sampleSpacingMeters - firstTerrainPatch.sampleSpacingMeters) <=
        0.001 &&
      Math.abs(terrainPatch.rotationYRadians - firstTerrainPatch.rotationYRadians) <=
        0.001
  );
}

function resolveTerrainPatchWorldBounds(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot
): {
  readonly maxX: number;
  readonly maxZ: number;
  readonly minX: number;
  readonly minZ: number;
} {
  const halfSpanX = resolveTerrainHalfSpanMeters(
    terrainPatch.sampleCountX,
    terrainPatch.sampleSpacingMeters
  );
  const halfSpanZ = resolveTerrainHalfSpanMeters(
    terrainPatch.sampleCountZ,
    terrainPatch.sampleSpacingMeters
  );

  return Object.freeze({
    maxX: terrainPatch.origin.x + halfSpanX,
    maxZ: terrainPatch.origin.z + halfSpanZ,
    minX: terrainPatch.origin.x - halfSpanX,
    minZ: terrainPatch.origin.z - halfSpanZ
  });
}

function mergeTerrainMaterialLayerSamples(
  terrainPatches: readonly MapEditorTerrainPatchDraftSnapshot[],
  mergedTerrainPatchId: string,
  mergedSampleCount: number
): {
  readonly materialId: MapEditorStructuralDraftSnapshot["materialId"];
  readonly layerId: string;
  readonly weightSamples: number[];
}[] {
  const materialIds = [
    ...new Set(
      terrainPatches.flatMap((terrainPatch) =>
        terrainPatch.materialLayers.map((layer) => layer.materialId)
      )
    )
  ];

  return materialIds.map((materialId) => ({
    layerId: `${mergedTerrainPatchId}:${materialId}`,
    materialId,
    weightSamples: Array.from({ length: mergedSampleCount }, () => 0)
  }));
}

export function mergeMapEditorTerrainPatches(
  project: MapEditorProjectSnapshot,
  terrainPatchIds: readonly string[]
): MapEditorProjectSnapshot {
  const terrainPatchIdSet = new Set(terrainPatchIds);
  const terrainPatches = project.terrainPatchDrafts.filter((terrainPatch) =>
    terrainPatchIdSet.has(terrainPatch.terrainPatchId)
  );

  if (
    terrainPatches.length < 2 ||
    !areTerrainPatchMergeInputsCompatible(terrainPatches)
  ) {
    return project;
  }

  const sampleSpacingMeters = terrainPatches[0]!.sampleSpacingMeters;
  const bounds = terrainPatches.reduce(
    (currentBounds, terrainPatch) => {
      const terrainBounds = resolveTerrainPatchWorldBounds(terrainPatch);

      return Object.freeze({
        maxX: Math.max(currentBounds.maxX, terrainBounds.maxX),
        maxZ: Math.max(currentBounds.maxZ, terrainBounds.maxZ),
        minX: Math.min(currentBounds.minX, terrainBounds.minX),
        minZ: Math.min(currentBounds.minZ, terrainBounds.minZ)
      });
    },
    Object.freeze({
      maxX: Number.NEGATIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY
    })
  );

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minZ)) {
    return project;
  }

  const mergedSampleCountX =
    Math.max(1, Math.round((bounds.maxX - bounds.minX) / sampleSpacingMeters)) + 1;
  const mergedSampleCountZ =
    Math.max(1, Math.round((bounds.maxZ - bounds.minZ) / sampleSpacingMeters)) + 1;
  const mergedSampleCount = mergedSampleCountX * mergedSampleCountZ;
  const mergedTerrainPatchId = terrainPatches[0]!.terrainPatchId;
  const mergedOrigin = Object.freeze({
    x: (bounds.minX + bounds.maxX) * 0.5,
    y: Math.min(...terrainPatches.map((terrainPatch) => terrainPatch.origin.y)),
    z: (bounds.minZ + bounds.maxZ) * 0.5
  });
  const mergedHeights = Array.from({ length: mergedSampleCount }, () => 0);
  const mergedMaterialLayers = mergeTerrainMaterialLayerSamples(
    terrainPatches,
    mergedTerrainPatchId,
    mergedSampleCount
  );
  const mergedMaterialLayersByMaterialId = new Map(
    mergedMaterialLayers.map((layer) => [layer.materialId, layer] as const)
  );
  const mergedWrittenSamples = new Set<number>();

  for (const terrainPatch of terrainPatches) {
    for (let cellZ = 0; cellZ < terrainPatch.sampleCountZ; cellZ += 1) {
      for (let cellX = 0; cellX < terrainPatch.sampleCountX; cellX += 1) {
        const sourceIndex = createTerrainHeightIndex(terrainPatch, cellX, cellZ);
        const sourcePosition = resolveMapEditorTerrainCellPosition(
          terrainPatch,
          cellX,
          cellZ
        );
        const mergedCellX = Math.round(
          (sourcePosition.x - bounds.minX) / sampleSpacingMeters
        );
        const mergedCellZ = Math.round(
          (sourcePosition.z - bounds.minZ) / sampleSpacingMeters
        );

        if (
          mergedCellX < 0 ||
          mergedCellX >= mergedSampleCountX ||
          mergedCellZ < 0 ||
          mergedCellZ >= mergedSampleCountZ
        ) {
          continue;
        }

        const mergedIndex = mergedCellZ * mergedSampleCountX + mergedCellX;

        mergedHeights[mergedIndex] =
          Math.round(
            ((terrainPatch.origin.y + (terrainPatch.heightSamples[sourceIndex] ?? 0)) -
              mergedOrigin.y) *
              100
          ) / 100;
        mergedWrittenSamples.add(mergedIndex);

        for (const sourceLayer of terrainPatch.materialLayers) {
          const mergedLayer =
            mergedMaterialLayersByMaterialId.get(sourceLayer.materialId) ?? null;

          if (mergedLayer === null) {
            continue;
          }

          mergedLayer.weightSamples[mergedIndex] = Math.max(
            mergedLayer.weightSamples[mergedIndex] ?? 0,
            sourceLayer.weightSamples[sourceIndex] ?? 0
          );
        }
      }
    }
  }

  const fallbackLayer =
    mergedMaterialLayers[0] ??
    ensureEditableTerrainMaterialLayer(
      mergedTerrainPatchId,
      mergedSampleCount,
      mergedMaterialLayers,
      "terrain-grass"
    );

  for (let sampleIndex = 0; sampleIndex < mergedSampleCount; sampleIndex += 1) {
    if (mergedWrittenSamples.has(sampleIndex)) {
      continue;
    }

    fallbackLayer.weightSamples[sampleIndex] = 1;
  }

  const mergedSize = Object.freeze({
    x: Math.max(mapEditorBuildGridUnitMeters, bounds.maxX - bounds.minX),
    y: 0.5,
    z: Math.max(mapEditorBuildGridUnitMeters, bounds.maxZ - bounds.minZ)
  });
  const mergedTerrainPatch = freezeTerrainPatchDraft({
    grid: createMapEditorStructuralGrid(mergedOrigin, mergedSize),
    heightSamples: Object.freeze(mergedHeights),
    label: terrainPatches[0]!.label,
    materialLayers: freezeTerrainMaterialLayers(mergedMaterialLayers),
    origin: mergedOrigin,
    rotationYRadians: terrainPatches[0]!.rotationYRadians,
    sampleCountX: mergedSampleCountX,
    sampleCountZ: mergedSampleCountZ,
    sampleSpacingMeters,
    terrainPatchId: mergedTerrainPatchId,
    waterLevelMeters:
      terrainPatches.find((terrainPatch) => terrainPatch.waterLevelMeters !== null)
        ?.waterLevelMeters ?? null
  });
  const removedTerrainPatchIds = new Set(
    terrainPatches
      .slice(1)
      .map((terrainPatch) => terrainPatch.terrainPatchId)
  );
  const mergedProject = Object.freeze({
    ...project,
    surfaceDrafts: Object.freeze(
      project.surfaceDrafts.map((surface) =>
        surface.terrainPatchId !== null &&
        terrainPatchIdSet.has(surface.terrainPatchId)
          ? freezeSurfaceDraft({
              ...surface,
              terrainPatchId: mergedTerrainPatchId
            })
          : surface
      )
    ),
    terrainPatchDrafts: Object.freeze([
      ...project.terrainPatchDrafts
        .filter(
          (terrainPatch) =>
            terrainPatch.terrainPatchId !== mergedTerrainPatchId &&
            !removedTerrainPatchIds.has(terrainPatch.terrainPatchId)
        ),
      mergedTerrainPatch
    ])
  });

  return withSelectedEntity(
    mergedProject,
    Object.freeze({
      id: mergedTerrainPatchId,
      kind: "terrain-patch"
    })
  );
}

function listEntityRefsForOutlinerGroup(
  project: MapEditorProjectSnapshot,
  groupId: MapEditorOutlinerGroupId
): readonly MapEditorSelectedEntityRef[] {
  switch (groupId) {
    case "world":
      return Object.freeze([
        Object.freeze({
          id: "global-sun",
          kind: "world-sun" as const
        }),
        Object.freeze({
          id: "sky",
          kind: "world-sky" as const
        }),
        Object.freeze({
          id: "atmosphere",
          kind: "world-atmosphere" as const
        })
      ]);
    case "terrain":
      return Object.freeze(
        project.terrainPatchDrafts.map((terrainPatch) =>
          Object.freeze({
            id: terrainPatch.terrainPatchId,
            kind: "terrain-patch" as const
          })
        )
      );
    case "floors-paths":
      return Object.freeze([
        ...project.regionDrafts
          .filter(
            (region) =>
              region.regionKind === "floor" ||
              region.regionKind === "path" ||
              region.regionKind === "roof"
          )
          .map((region) =>
            Object.freeze({
              id: region.regionId,
              kind: "region" as const
            })
          ),
        ...project.structuralDrafts
          .filter((structure) =>
            structure.structureKind === "bridge" ||
            structure.structureKind === "catwalk" ||
            structure.structureKind === "floor" ||
            structure.structureKind === "pad" ||
            structure.structureKind === "path" ||
            structure.structureKind === "ramp" ||
            structure.structureKind === "vehicle-bay"
          )
          .map((structure) =>
            Object.freeze({
              id: structure.structureId,
              kind: "structure" as const
            })
          )
      ]);
    case "walls-boundaries":
      return Object.freeze([
        ...project.edgeDrafts.map((edge) =>
          Object.freeze({
            id: edge.edgeId,
            kind: "edge" as const
          })
        ),
        ...project.structuralDrafts
          .filter((structure) =>
            structure.structureKind === "cover" ||
            structure.structureKind === "tower" ||
            structure.structureKind === "wall"
          )
          .map((structure) =>
            Object.freeze({
              id: structure.structureId,
              kind: "structure" as const
            })
          )
      ]);
    case "connectors":
      return Object.freeze([
        ...project.connectorDrafts.map((connector) =>
          Object.freeze({
            id: connector.connectorId,
            kind: "connector" as const
          })
        ),
        ...project.structuralDrafts
          .filter((structure) => structure.structureKind === "ramp")
          .map((structure) =>
            Object.freeze({
              id: structure.structureId,
              kind: "structure" as const
            })
          )
      ]);
    case "modules":
      return Object.freeze(
        project.placementDrafts.map((placement) =>
          Object.freeze({
            id: placement.placementId,
            kind: "module" as const
          })
        )
      );
    case "gameplay-anchors":
      return Object.freeze([
        ...project.playerSpawnDrafts.map((spawnDraft) =>
          Object.freeze({
            id: spawnDraft.spawnId,
            kind: "player-spawn" as const
          })
        ),
        ...project.resourceSpawnDrafts.map((resourceSpawnDraft) =>
          Object.freeze({
            id: resourceSpawnDraft.spawnId,
            kind: "resource-spawn" as const
          })
        ),
        ...project.sceneObjectDrafts.map((sceneObjectDraft) =>
          Object.freeze({
            id: sceneObjectDraft.objectId,
            kind: "scene-object" as const
          })
        ),
        ...project.gameplayVolumeDrafts.map((volume) =>
          Object.freeze({
            id: volume.volumeId,
            kind: "gameplay-volume" as const
          })
        ),
        ...project.lightDrafts.map((light) =>
          Object.freeze({
            id: light.lightId,
            kind: "light" as const
          })
        )
      ]);
    case "water":
      return Object.freeze(
        project.waterRegionDrafts.map((waterRegionDraft) =>
          Object.freeze({
            id: waterRegionDraft.waterRegionId,
            kind: "water-region" as const
          })
        )
      );
    case "advanced-semantics":
      return Object.freeze([
        ...project.surfaceDrafts.map((surface) =>
          Object.freeze({
            id: surface.surfaceId,
            kind: "surface" as const
          })
        ),
        ...project.regionDrafts
          .filter((region) => region.regionKind === "arena")
          .map((region) =>
            Object.freeze({
              id: region.regionId,
              kind: "region" as const
            })
          ),
        ...project.structuralDrafts.map((structure) =>
          Object.freeze({
            id: structure.structureId,
            kind: "structure" as const
          })
        ),
        ...project.gameplayVolumeDrafts.map((volume) =>
          Object.freeze({
            id: volume.volumeId,
            kind: "gameplay-volume" as const
          })
        ),
        ...project.lightDrafts.map((light) =>
          Object.freeze({
            id: light.lightId,
            kind: "light" as const
          })
          )
      ]);
  }
}

function resolveEntityOutlinerGroup(
  project: MapEditorProjectSnapshot,
  entityRef: MapEditorSelectedEntityRef
): MapEditorOutlinerGroupId {
  switch (entityRef.kind) {
    case "terrain-patch":
      return "terrain";
    case "edge":
      return "walls-boundaries";
    case "connector":
      return "connectors";
    case "structure": {
      const structure = project.structuralDrafts.find(
        (candidate) => candidate.structureId === entityRef.id
      );

      return structure?.structureKind === "wall" ||
        structure?.structureKind === "cover" ||
        structure?.structureKind === "tower"
        ? "walls-boundaries"
        : "floors-paths";
    }
    case "module":
      return "modules";
    case "gameplay-volume":
    case "light":
    case "player-spawn":
    case "resource-spawn":
    case "scene-object":
      return "gameplay-anchors";
    case "water-region":
      return "water";
    case "world-atmosphere":
    case "world-sky":
    case "world-sun":
      return "world";
    case "surface":
      return "advanced-semantics";
    case "region":
      return (
        project.regionDrafts.find((region) => region.regionId === entityRef.id)?.regionKind ===
          "arena"
          ? "advanced-semantics"
          : "floors-paths"
      );
  }
}

function resolveNextSelectionAfterRemoval(
  previousProject: MapEditorProjectSnapshot,
  nextProject: MapEditorProjectSnapshot,
  removedEntityRef: MapEditorSelectedEntityRef
): MapEditorSelectedEntityRef | null {
  const groupId = resolveEntityOutlinerGroup(previousProject, removedEntityRef);
  const previousRefs = listEntityRefsForOutlinerGroup(previousProject, groupId);
  const removedIndex = previousRefs.findIndex(
    (entityRef) =>
      entityRef.kind === removedEntityRef.kind && entityRef.id === removedEntityRef.id
  );

  if (removedIndex < 0) {
    return nextProject.selectedEntityRef;
  }

  const nextRefs = listEntityRefsForOutlinerGroup(nextProject, groupId);

  return nextRefs[Math.min(removedIndex, nextRefs.length - 1)] ?? null;
}

function createSemanticSurfaceForPlacement(
  project: MapEditorProjectSnapshot,
  label: string,
  position: MetaverseWorldSurfaceVector3Snapshot,
  rotationYRadians: number,
  size: MetaverseWorldSurfaceVector3Snapshot,
  options?: {
    readonly kind?: MapEditorSurfaceDraftSnapshot["kind"];
    readonly slopeRiseMeters?: number;
  }
): {
  readonly project: MapEditorProjectSnapshot;
  readonly surfaceId: string;
} {
  const surfaceId = createMapEditorSurfaceId(project);
  const nextSurface = freezeSurfaceDraft({
    center: Object.freeze({
      x: position.x,
      y: position.y,
      z: position.z
    }),
    elevation: position.y,
    kind: options?.kind ?? "flat-slab",
    label,
    rotationYRadians,
    size,
    slopeRiseMeters: options?.slopeRiseMeters ?? 0,
    surfaceId,
    terrainPatchId: null
  });

  return Object.freeze({
    project: Object.freeze({
      ...project,
      surfaceDrafts: Object.freeze([...project.surfaceDrafts, nextSurface])
    }),
    surfaceId
  });
}

function ensurePathSurfaceAndRegion(
  project: MapEditorProjectSnapshot,
  center: MetaverseWorldSurfaceVector3Snapshot,
  elevation: number,
  pathWidthCells = 1,
  materialId: MapEditorStructuralDraftSnapshot["materialId"] = "warning",
  materialReferenceId: string = materialId,
  options?: {
    readonly snapCenter?: boolean;
  }
): {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly project: MapEditorProjectSnapshot;
  readonly regionId: string;
  readonly surfaceId: string;
} {
  const snappedCenter =
    options?.snapCenter === false
      ? freezeBuildPosition({
          x: center.x,
          y: elevation,
          z: center.z
        })
      : resolveMapEditorBuildFootprintCenterPosition(
          center,
          elevation,
          pathWidthCells,
          pathWidthCells
        );
  const existingSurface = findSurfaceDraftAtPosition(
    project,
    snappedCenter,
    elevation
  );
  const existingPathRegion = findPathRegionDraftAtPosition(
    project,
    snappedCenter,
    elevation
  );

  if (existingSurface !== null && existingPathRegion !== null) {
    return Object.freeze({
      center: snappedCenter,
      project,
      regionId: existingPathRegion.regionId,
      surfaceId: existingSurface.surfaceId
    });
  }

  const surfaceId = existingSurface?.surfaceId ?? createMapEditorSurfaceId(project);
  const pathSurfaceSize = Object.freeze({
    ...defaultPathSurfaceSize,
    x: Math.max(1, pathWidthCells) * mapEditorBuildGridUnitMeters,
    z: Math.max(1, pathWidthCells) * mapEditorBuildGridUnitMeters
  });
  const nextSurface =
    existingSurface ??
    freezeSurfaceDraft({
      center: snappedCenter,
      elevation,
      kind: "flat-slab",
      label: `Path Surface ${project.surfaceDrafts.length + 1}`,
      rotationYRadians: 0,
      size: pathSurfaceSize,
      slopeRiseMeters: 0,
      surfaceId,
      terrainPatchId: null
    });
  const surfaceProject =
    existingSurface !== null
      ? project
      : Object.freeze({
          ...project,
          surfaceDrafts: Object.freeze([...project.surfaceDrafts, nextSurface])
        });
  const regionId = existingPathRegion?.regionId ?? createMapEditorRegionId(surfaceProject);
  const nextRegion =
    existingPathRegion ??
    freezeRegionDraft({
      center: snappedCenter,
      label: `Path ${surfaceProject.regionDrafts.length + 1}`,
      materialReferenceId,
      outerLoop: createRectangularSurfaceLoop(pathSurfaceSize),
      regionId,
      regionKind: "path",
      rotationYRadians: 0,
      size: pathSurfaceSize,
      surfaceId
    });
  const nextProject =
    existingPathRegion !== null
      ? surfaceProject
      : Object.freeze({
          ...surfaceProject,
          regionDrafts: Object.freeze([...surfaceProject.regionDrafts, nextRegion])
        });

  return Object.freeze({
    center: snappedCenter,
    project: nextProject,
    regionId,
    surfaceId
  });
}

type MapEditorPathRampEndpointSign = -1 | 1;

interface MapEditorPathRampEndpoint {
  readonly elevation: number;
  readonly endpointSign: MapEditorPathRampEndpointSign;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
}

interface MapEditorPathRampTarget {
  readonly region: MapEditorRegionDraftSnapshot;
  readonly surface: MapEditorSurfaceDraftSnapshot;
}

function resolvePathSurfaceEndpoint(
  surface: MapEditorSurfaceDraftSnapshot,
  endpointSign: MapEditorPathRampEndpointSign
): MapEditorPathRampEndpoint {
  const halfLength = Math.max(
    mapEditorBuildGridUnitMeters * 0.5,
    Math.abs(surface.size.z) * 0.5
  );
  const elevation = surface.elevation + surface.slopeRiseMeters * endpointSign * 0.5;

  return Object.freeze({
    elevation,
    endpointSign,
    position: freezeBuildPosition({
      x:
        surface.center.x +
        Math.sin(surface.rotationYRadians) * halfLength * endpointSign,
      y: elevation,
      z:
        surface.center.z +
        Math.cos(surface.rotationYRadians) * halfLength * endpointSign
    })
  });
}

function resolvePathSurfaceConnectionAnchors(
  surface: MapEditorSurfaceDraftSnapshot
): readonly {
  readonly elevation: number;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
}[] {
  const negativeEndpoint = resolvePathSurfaceEndpoint(surface, -1);
  const positiveEndpoint = resolvePathSurfaceEndpoint(surface, 1);

  return Object.freeze([
    Object.freeze({
      elevation: negativeEndpoint.elevation,
      position: negativeEndpoint.position
    }),
    Object.freeze({
      elevation: positiveEndpoint.elevation,
      position: positiveEndpoint.position
    }),
    Object.freeze({
      elevation: surface.elevation,
      position: freezeBuildPosition({
        x: surface.center.x,
        y: surface.elevation,
        z: surface.center.z
      })
    })
  ]);
}

function resolvePathSurfaceConnectionDistanceSquared(
  firstSurface: MapEditorSurfaceDraftSnapshot,
  secondSurface: MapEditorSurfaceDraftSnapshot
): number {
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const firstAnchor of resolvePathSurfaceConnectionAnchors(firstSurface)) {
    for (const secondAnchor of resolvePathSurfaceConnectionAnchors(secondSurface)) {
      const deltaX = firstAnchor.position.x - secondAnchor.position.x;
      const deltaZ = firstAnchor.position.z - secondAnchor.position.z;

      nearestDistanceSquared = Math.min(
        nearestDistanceSquared,
        deltaX * deltaX + deltaZ * deltaZ
      );
    }
  }

  return nearestDistanceSquared;
}

function isPathSurfaceLongRampCandidate(
  surface: MapEditorSurfaceDraftSnapshot
): boolean {
  return (
    surface.kind === "sloped-plane" ||
    Math.abs(surface.size.z) > Math.abs(surface.size.x) + 0.01
  );
}

function readPathRampTargetFromEntity(
  project: MapEditorProjectSnapshot,
  entityRef: MapEditorSelectedEntityRef | null
): MapEditorPathRampTarget | null {
  if (entityRef === null) {
    return null;
  }

  const selectedRegion =
    entityRef.kind === "region"
      ? (project.regionDrafts.find(
          (region) =>
            region.regionId === entityRef.id && region.regionKind === "path"
        ) ?? null)
      : null;
  const selectedSurface =
    entityRef.kind === "surface"
      ? findSurfaceDraftById(project, entityRef.id)
      : selectedRegion === null
        ? null
        : findSurfaceDraftById(project, selectedRegion.surfaceId);
  const selectedSurfacePathRegion =
    selectedSurface === null
      ? null
      : (selectedRegion ??
        project.regionDrafts.find(
          (region) =>
            region.regionKind === "path" &&
            region.surfaceId === selectedSurface.surfaceId
        ) ??
        null);

  if (selectedSurface === null || selectedSurfacePathRegion === null) {
    return null;
  }

  const selectedTarget = Object.freeze({
    region: selectedSurfacePathRegion,
    surface: selectedSurface
  });

  if (isPathSurfaceLongRampCandidate(selectedSurface)) {
    return selectedTarget;
  }

  const connectionToleranceMeters = mapEditorBuildGridUnitMeters + 0.01;
  let nearestConnectedTarget:
    | {
        readonly distanceSquared: number;
        readonly target: MapEditorPathRampTarget;
      }
    | null = null;

  for (const region of project.regionDrafts) {
    if (
      region.regionKind !== "path" ||
      region.surfaceId === selectedSurface.surfaceId
    ) {
      continue;
    }

    const surface = findSurfaceDraftById(project, region.surfaceId);

    if (surface === null || !isPathSurfaceLongRampCandidate(surface)) {
      continue;
    }

    const distanceSquared = resolvePathSurfaceConnectionDistanceSquared(
      selectedSurface,
      surface
    );

    if (
      distanceSquared >
      connectionToleranceMeters * connectionToleranceMeters
    ) {
      continue;
    }

    if (
      nearestConnectedTarget === null ||
      distanceSquared < nearestConnectedTarget.distanceSquared
    ) {
      nearestConnectedTarget = Object.freeze({
        distanceSquared,
        target: Object.freeze({
          region,
          surface
        })
      });
    }
  }

  return nearestConnectedTarget?.target ?? selectedTarget;
}

function readNearestPathNeighborElevation(
  project: MapEditorProjectSnapshot,
  position: MetaverseWorldSurfaceVector3Snapshot,
  excludedSurfaceIds: ReadonlySet<string>
): {
  readonly distanceSquared: number;
  readonly elevation: number;
} | null {
  const connectionToleranceMeters = mapEditorBuildGridUnitMeters + 0.01;
  let nearestNeighbor:
    | {
        readonly distanceSquared: number;
        readonly elevation: number;
      }
    | null = null;

  for (const region of project.regionDrafts) {
    if (region.regionKind !== "path" || excludedSurfaceIds.has(region.surfaceId)) {
      continue;
    }

    const surface = findSurfaceDraftById(project, region.surfaceId);

    if (surface === null) {
      continue;
    }

    for (const anchor of resolvePathSurfaceConnectionAnchors(surface)) {
      const deltaX = anchor.position.x - position.x;
      const deltaZ = anchor.position.z - position.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;

      if (
        distanceSquared >
        connectionToleranceMeters * connectionToleranceMeters
      ) {
        continue;
      }

      if (
        nearestNeighbor === null ||
        distanceSquared < nearestNeighbor.distanceSquared
      ) {
        nearestNeighbor = Object.freeze({
          distanceSquared,
          elevation: anchor.elevation
        });
      }
    }
  }

  return nearestNeighbor;
}

export function applyMapEditorPathRampToSelection(
  project: MapEditorProjectSnapshot,
  riseMeters: number,
  entityRef = project.selectedEntityRef
): MapEditorProjectSnapshot {
  if (!Number.isFinite(riseMeters)) {
    return project;
  }

  const target = readPathRampTargetFromEntity(project, entityRef);

  if (target === null) {
    return project;
  }

  const absoluteRiseMeters = Math.abs(riseMeters);
  const nextSurface = (() => {
    if (absoluteRiseMeters <= 0.01) {
      return freezeSurfaceDraft({
        ...target.surface,
        center: Object.freeze({
          ...target.surface.center,
          y: target.surface.elevation
        }),
        kind: "flat-slab",
        slopeRiseMeters: 0
      });
    }

    const negativeEndpoint = resolvePathSurfaceEndpoint(target.surface, -1);
    const positiveEndpoint = resolvePathSurfaceEndpoint(target.surface, 1);
    const excludedSurfaceIds = new Set([target.surface.surfaceId]);
    const negativeNeighbor = readNearestPathNeighborElevation(
      project,
      negativeEndpoint.position,
      excludedSurfaceIds
    );
    const positiveNeighbor = readNearestPathNeighborElevation(
      project,
      positiveEndpoint.position,
      excludedSurfaceIds
    );
    const lowerEndpoint =
      negativeNeighbor !== null && positiveNeighbor !== null
        ? negativeNeighbor.elevation <= positiveNeighbor.elevation
          ? Object.freeze({
              elevation: negativeNeighbor.elevation,
              endpointSign: -1 as const
            })
          : Object.freeze({
              elevation: positiveNeighbor.elevation,
              endpointSign: 1 as const
            })
        : negativeNeighbor !== null
          ? Object.freeze({
              elevation: negativeNeighbor.elevation,
              endpointSign: -1 as const
            })
          : positiveNeighbor !== null
            ? Object.freeze({
                elevation: positiveNeighbor.elevation,
                endpointSign: 1 as const
              })
            : negativeEndpoint.elevation <= positiveEndpoint.elevation
              ? Object.freeze({
                  elevation: negativeEndpoint.elevation,
                  endpointSign: -1 as const
                })
              : Object.freeze({
                  elevation: positiveEndpoint.elevation,
                  endpointSign: 1 as const
                });
    const centerElevation = lowerEndpoint.elevation + absoluteRiseMeters * 0.5;
    const signedRiseMeters =
      lowerEndpoint.endpointSign === -1
        ? absoluteRiseMeters
        : -absoluteRiseMeters;

    return freezeSurfaceDraft({
      ...target.surface,
      center: Object.freeze({
        ...target.surface.center,
        y: centerElevation
      }),
      elevation: centerElevation,
      kind: "sloped-plane",
      slopeRiseMeters: signedRiseMeters
    });
  })();
  const nextProject = Object.freeze({
    ...project,
    regionDrafts: Object.freeze(
      project.regionDrafts.map((region) =>
        region.surfaceId === target.surface.surfaceId
          ? freezeRegionDraft({
              ...region,
              center: Object.freeze({
                ...region.center,
                y: nextSurface.elevation
              })
            })
          : region
      )
    ),
    surfaceDrafts: Object.freeze(
      project.surfaceDrafts.map((surface) =>
        surface.surfaceId === target.surface.surfaceId ? nextSurface : surface
      )
    )
  });

  return withSelectedEntity(
    nextProject,
    Object.freeze({
      id: target.region.regionId,
      kind: "region"
    })
  );
}

function createMapEditorWallDraftsForSegment(
  project: MapEditorProjectSnapshot,
  start: MetaverseWorldSurfaceVector3Snapshot,
  end: MetaverseWorldSurfaceVector3Snapshot,
  edgeKind: MapEditorEdgeDraftSnapshot["edgeKind"],
  dimensionsOverride?: {
    readonly heightMeters: number;
    readonly thicknessMeters: number;
  },
  materialReferenceId: string | null = null
): {
  readonly edgeId: string;
  readonly project: MapEditorProjectSnapshot;
} | null {
  const wallSegment = resolveMapEditorBuildWallSegment(start, end);

  if (wallSegment === null) {
    return null;
  }

  const dimensions =
    dimensionsOverride ??
    resolveWallPresetDimensions(edgeKind);
  const { center, lengthMeters, rotationYRadians } = wallSegment;
  const surfaceSize = Object.freeze({
    x: lengthMeters,
    y: dimensions.heightMeters,
    z: dimensions.thicknessMeters
  });
  const { project: projectWithSurface, surfaceId } = createSemanticSurfaceForPlacement(
    project,
    `Wall Surface ${project.surfaceDrafts.length + 1}`,
    Object.freeze({
      x: center.x,
      y: center.y,
      z: center.z
    }),
    rotationYRadians,
    surfaceSize
  );
  const nextEdge = freezeEdgeDraft({
    center: Object.freeze({
      x: center.x,
      y: center.y + dimensions.heightMeters * 0.5,
      z: center.z
    }),
    edgeId: createMapEditorEdgeId(projectWithSurface),
    edgeKind,
    heightMeters: dimensions.heightMeters,
    label: `${edgeKind[0]?.toUpperCase()}${edgeKind.slice(1)} ${project.edgeDrafts.length + 1}`,
    lengthMeters,
    materialReferenceId,
    path: Object.freeze([
      createPlanarPoint(-lengthMeters * 0.5, 0),
      createPlanarPoint(lengthMeters * 0.5, 0)
    ]),
    rotationYRadians,
    surfaceId,
    thicknessMeters: dimensions.thicknessMeters
  });

  return Object.freeze({
    edgeId: nextEdge.edgeId,
    project: Object.freeze({
      ...projectWithSurface,
      edgeDrafts: Object.freeze([...projectWithSurface.edgeDrafts, nextEdge])
    })
  });
}

function createModuleDraftFromAsset(
  project: MapEditorProjectSnapshot,
  asset: EnvironmentAssetDescriptor,
  position: MetaverseWorldSurfaceVector3Snapshot
): MapEditorPlacementDraftSnapshot {
  const placementId = createMapEditorPlacementId(project, asset.id);

  return freezePlacementDraft({
    assetId: asset.id,
    colliderCount: resolveModuleColliderCount(
      asset.physicsColliders ?? Object.freeze([]),
      asset.collider
    ),
    collisionEnabled: true,
    collisionPath: asset.collisionPath,
    collider: asset.collider,
    dynamicBody: asset.dynamicBody ?? null,
    entries: asset.entries,
    isVisible: true,
    materialReferenceId: null,
    moduleId: placementId,
    notes: "",
    placementId,
    placementMode: asset.placement,
    position,
    rotationYRadians: 0,
    scale: freezePlacementScale(1),
    seats: asset.seats,
    surfaceColliders:
      asset.physicsColliders === null
        ? Object.freeze([])
        : Object.freeze(
            asset.physicsColliders.map((collider) =>
              Object.freeze({
                center: Object.freeze({
                  x: collider.center.x,
                  y: collider.center.y,
                  z: collider.center.z
                }),
                size: Object.freeze({
                  x: collider.size.x,
                  y: collider.size.y,
                  z: collider.size.z
                }),
                traversalAffordance: collider.traversalAffordance
              })
            )
          ),
    traversalAffordance: asset.traversalAffordance
  });
}

export interface MapEditorProjectCreationOptions {
  readonly projectSettings?: Partial<MapEditorProjectSettingsSnapshot>;
}

function resolveInitialSelectedLaunchVariationId(
  launchVariationDrafts: readonly MapEditorLaunchVariationDraftSnapshot[],
  resourceSpawnDrafts: readonly MapEditorResourceSpawnDraftSnapshot[]
): string | null {
  const hasTeamDeathmatchResourceSpawns = resourceSpawnDrafts.some(
    (resourceSpawnDraft) =>
      resourceSpawnDraft.modeTags.includes("team-deathmatch")
  );

  if (hasTeamDeathmatchResourceSpawns) {
    const teamDeathmatchLaunchVariation = launchVariationDrafts.find(
      (launchVariationDraft) =>
        launchVariationDraft.matchMode === "team-deathmatch"
    );

    if (teamDeathmatchLaunchVariation !== undefined) {
      return teamDeathmatchLaunchVariation.variationId;
    }
  }

  return launchVariationDrafts[0]?.variationId ?? null;
}

export function createMapEditorProject(
  loadedBundle: LoadedMetaverseMapBundleSnapshot,
  options: MapEditorProjectCreationOptions = {}
): MapEditorProjectSnapshot {
  const semanticDrafts = createSemanticDraftsFromBundle(loadedBundle);
  const launchVariationDrafts = createLaunchVariationDrafts(loadedBundle);
  const resourceSpawnDrafts = createResourceSpawnDrafts(loadedBundle);
  const selectedLaunchVariationId = resolveInitialSelectedLaunchVariationId(
    launchVariationDrafts,
    resourceSpawnDrafts
  );
  const selectedEntityRef = resolveInitialSelectedEntityRef(semanticDrafts);

  const project = Object.freeze({
    bundleId: loadedBundle.bundle.mapId,
    bundleLabel: loadedBundle.bundle.label,
    cameraProfileId: loadedBundle.cameraProfile?.id ?? null,
    characterPresentationProfileId:
      loadedBundle.characterPresentationProfile?.id ?? null,
    connectorDrafts: semanticDrafts.connectorDrafts,
    description: loadedBundle.bundle.description,
    edgeDrafts: semanticDrafts.edgeDrafts,
    environmentPresentation: cloneMetaverseEnvironmentPresentationSnapshot(
      loadedBundle.environmentPresentation
    ),
    environmentPresentationProfileId:
      loadedBundle.environmentPresentationProfile?.id ?? null,
    gameplayVolumeDrafts: semanticDrafts.gameplayVolumeDrafts,
    gameplayProfileId: loadedBundle.gameplayProfile.id,
    hudProfileId: loadedBundle.hudProfile?.id ?? null,
    launchVariationDrafts,
    lightDrafts: semanticDrafts.lightDrafts,
    materialDefinitionDrafts: semanticDrafts.materialDefinitionDrafts,
    placementDrafts: semanticDrafts.placementDrafts,
    playerSpawnDrafts: createPlayerSpawnDrafts(loadedBundle),
    playerSpawnSelectionDraft: createPlayerSpawnSelectionDraft(loadedBundle),
    projectSettings: createMapEditorProjectSettingsSnapshot(
      options.projectSettings
    ),
    regionDrafts: semanticDrafts.regionDrafts,
    resourceSpawnDrafts,
    sceneObjectDrafts: createSceneObjectDrafts(loadedBundle),
    selectedEntityRef,
    selectedLaunchVariationId,
    selectedPlacementId: createSelectedPlacementId(selectedEntityRef),
    semanticCompatibilityAssetIds: semanticDrafts.semanticCompatibilityAssetIds,
    structuralDrafts: semanticDrafts.structuralDrafts,
    surfaceDrafts: semanticDrafts.surfaceDrafts,
    terrainPatchDrafts: semanticDrafts.terrainPatchDrafts,
    waterRegionDrafts: createWaterRegionDrafts(loadedBundle)
  });

  return syncMapEditorProjectKillFloorDraft(project);
}

export function updateMapEditorProjectIdentity(
  project: MapEditorProjectSnapshot,
  identity: {
    readonly bundleId: string;
    readonly bundleLabel: string;
    readonly description?: string;
  }
): MapEditorProjectSnapshot {
  const nextBundleId = identity.bundleId.trim();
  const nextBundleLabel = identity.bundleLabel.trim();

  if (nextBundleId.length === 0 || nextBundleLabel.length === 0) {
    return project;
  }

  return Object.freeze({
    ...project,
    bundleId: nextBundleId,
    bundleLabel: nextBundleLabel,
    description: identity.description ?? project.description
  });
}

export function updateMapEditorProjectSettings(
  project: MapEditorProjectSnapshot,
  update: (
    settings: MapEditorProjectSettingsSnapshot
  ) => Partial<MapEditorProjectSettingsSnapshot>
): MapEditorProjectSnapshot {
  const nextProjectSettings = createMapEditorProjectSettingsSnapshot(
    update(project.projectSettings)
  );

  if (
    project.projectSettings.helperGridSizeMeters ===
    nextProjectSettings.helperGridSizeMeters
  ) {
    return project;
  }

  return syncMapEditorProjectKillFloorDraft(
    Object.freeze({
      ...project,
      projectSettings: nextProjectSettings
    }),
    {
      synchronizeFootprintFromHelperGrid: true
    }
  );
}

function areEnvironmentPresentationsEqual(
  left: MetaverseMapBundleEnvironmentPresentationSnapshot,
  right: MetaverseMapBundleEnvironmentPresentationSnapshot
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function readSelectedMapEditorLaunchVariation(
  project: MapEditorProjectSnapshot
): MapEditorLaunchVariationDraftSnapshot | null {
  if (project.selectedLaunchVariationId === null) {
    return null;
  }

  return (
    project.launchVariationDrafts.find(
      (variation) => variation.variationId === project.selectedLaunchVariationId
    ) ?? null
  );
}

export function readSelectedMapEditorPlacement(
  project: MapEditorProjectSnapshot
): MapEditorPlacementDraftSnapshot | null {
  if (project.selectedEntityRef?.kind !== "module") {
    return null;
  }

  return (
    project.placementDrafts.find(
      (placement) => placement.placementId === project.selectedEntityRef?.id
    ) ?? null
  );
}

export function selectMapEditorEntity(
  project: MapEditorProjectSnapshot,
  entityRef: MapEditorSelectedEntityRef | null
): MapEditorProjectSnapshot {
  if (entityRef === null) {
    return withSelectedEntity(project, null);
  }

  const exists =
    (entityRef.kind === "module" &&
      project.placementDrafts.some(
        (placement) => placement.placementId === entityRef.id
      )) ||
    (entityRef.kind === "surface" &&
      project.surfaceDrafts.some((surface) => surface.surfaceId === entityRef.id)) ||
    (entityRef.kind === "region" &&
      project.regionDrafts.some((region) => region.regionId === entityRef.id)) ||
    (entityRef.kind === "edge" &&
      project.edgeDrafts.some((edge) => edge.edgeId === entityRef.id)) ||
    (entityRef.kind === "connector" &&
      project.connectorDrafts.some(
        (connector) => connector.connectorId === entityRef.id
      )) ||
    (entityRef.kind === "structure" &&
      project.structuralDrafts.some(
        (structure) => structure.structureId === entityRef.id
      )) ||
    (entityRef.kind === "gameplay-volume" &&
      project.gameplayVolumeDrafts.some(
        (volume) => volume.volumeId === entityRef.id
      )) ||
    (entityRef.kind === "light" &&
      project.lightDrafts.some((light) => light.lightId === entityRef.id)) ||
    (entityRef.kind === "terrain-patch" &&
      project.terrainPatchDrafts.some(
        (terrainPatch) => terrainPatch.terrainPatchId === entityRef.id
      )) ||
    (entityRef.kind === "player-spawn" &&
      project.playerSpawnDrafts.some((spawn) => spawn.spawnId === entityRef.id)) ||
    (entityRef.kind === "resource-spawn" &&
      project.resourceSpawnDrafts.some(
        (resourceSpawn) => resourceSpawn.spawnId === entityRef.id
      )) ||
    (entityRef.kind === "scene-object" &&
      project.sceneObjectDrafts.some((object) => object.objectId === entityRef.id)) ||
    (entityRef.kind === "water-region" &&
      project.waterRegionDrafts.some(
        (waterRegion) => waterRegion.waterRegionId === entityRef.id
      )) ||
    entityRef.kind === "world-atmosphere" ||
    entityRef.kind === "world-sky" ||
    entityRef.kind === "world-sun";

  return exists ? withSelectedEntity(project, entityRef) : project;
}

export function selectMapEditorPlacement(
  project: MapEditorProjectSnapshot,
  placementId: string
): MapEditorProjectSnapshot {
  return selectMapEditorEntity(
    project,
    Object.freeze({
      id: placementId,
      kind: "module"
    })
  );
}

export function selectMapEditorLaunchVariation(
  project: MapEditorProjectSnapshot,
  variationId: string
): MapEditorProjectSnapshot {
  if (
    !project.launchVariationDrafts.some(
      (variation) => variation.variationId === variationId
    )
  ) {
    return project;
  }

  return Object.freeze({
    ...project,
    selectedLaunchVariationId: variationId
  });
}

export function updateMapEditorPlacement(
  project: MapEditorProjectSnapshot,
  placementId: string,
  update: (
    draft: MapEditorPlacementDraftSnapshot
  ) => MapEditorPlacementDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    placementDrafts: Object.freeze(
      project.placementDrafts.map((placement) =>
        placement.placementId === placementId
          ? freezePlacementDraft(update(placement))
          : placement
      )
    )
  });
}

export function updateMapEditorRegionDraft(
  project: MapEditorProjectSnapshot,
  regionId: string,
  update: (
    draft: MapEditorRegionDraftSnapshot
  ) => MapEditorRegionDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    regionDrafts: Object.freeze(
      project.regionDrafts.map((region) =>
        region.regionId === regionId ? freezeRegionDraft(update(region)) : region
      )
    )
  });
}

export function updateMapEditorEdgeDraft(
  project: MapEditorProjectSnapshot,
  edgeId: string,
  update: (draft: MapEditorEdgeDraftSnapshot) => MapEditorEdgeDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    edgeDrafts: Object.freeze(
      project.edgeDrafts.map((edge) =>
        edge.edgeId === edgeId ? freezeEdgeDraft(update(edge)) : edge
      )
    )
  });
}

export function updateMapEditorSurfaceDraft(
  project: MapEditorProjectSnapshot,
  surfaceId: string,
  update: (
    draft: MapEditorSurfaceDraftSnapshot
  ) => MapEditorSurfaceDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    surfaceDrafts: Object.freeze(
      project.surfaceDrafts.map((surface) =>
        surface.surfaceId === surfaceId ? freezeSurfaceDraft(update(surface)) : surface
      )
    )
  });
}

export function updateMapEditorConnectorDraft(
  project: MapEditorProjectSnapshot,
  connectorId: string,
  update: (
    draft: MapEditorConnectorDraftSnapshot
  ) => MapEditorConnectorDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    connectorDrafts: Object.freeze(
      project.connectorDrafts.map((connector) =>
        connector.connectorId === connectorId
          ? freezeConnectorDraft(update(connector))
          : connector
      )
    )
  });
}

export function updateMapEditorStructuralDraft(
  project: MapEditorProjectSnapshot,
  structureId: string,
  update: (
    draft: MapEditorStructuralDraftSnapshot
  ) => MapEditorStructuralDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    structuralDrafts: Object.freeze(
      project.structuralDrafts.map((structure) =>
        structure.structureId === structureId
          ? freezeStructuralDraft(update(structure))
          : structure
      )
    )
  });
}

export function updateMapEditorGameplayVolumeDraft(
  project: MapEditorProjectSnapshot,
  volumeId: string,
  update: (
    draft: MapEditorGameplayVolumeDraftSnapshot
  ) => MapEditorGameplayVolumeDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    gameplayVolumeDrafts: Object.freeze(
      project.gameplayVolumeDrafts.map((volume) =>
        volume.volumeId === volumeId
          ? freezeGameplayVolumeDraft(update(volume))
          : volume
      )
    )
  });
}

export function updateMapEditorLightDraft(
  project: MapEditorProjectSnapshot,
  lightId: string,
  update: (draft: MapEditorLightDraftSnapshot) => MapEditorLightDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    lightDrafts: Object.freeze(
      project.lightDrafts.map((light) =>
        light.lightId === lightId ? freezeLightDraft(update(light)) : light
      )
    )
  });
}

export function updateMapEditorMaterialDefinitionDraft(
  project: MapEditorProjectSnapshot,
  materialId: string,
  update: (
    draft: MapEditorMaterialDefinitionDraftSnapshot
  ) => MapEditorMaterialDefinitionDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    materialDefinitionDrafts: Object.freeze(
      project.materialDefinitionDrafts.map((materialDefinition) =>
        materialDefinition.materialId === materialId
          ? freezeMaterialDefinitionDraft(update(materialDefinition))
          : materialDefinition
      )
    )
  });
}

export function updateMapEditorTerrainPatchDraft(
  project: MapEditorProjectSnapshot,
  terrainPatchId: string,
  update: (
    draft: MapEditorTerrainPatchDraftSnapshot
  ) => MapEditorTerrainPatchDraftSnapshot
): MapEditorProjectSnapshot {
  return propagateTerrainPatchBoundariesToNeighbors(
    Object.freeze({
      ...project,
      terrainPatchDrafts: Object.freeze(
        project.terrainPatchDrafts.map((terrainPatch) =>
          terrainPatch.terrainPatchId === terrainPatchId
            ? freezeTerrainPatchDraft(update(terrainPatch))
            : terrainPatch
        )
      )
    }),
    terrainPatchId
  );
}

export function removeMapEditorPlacement(
  project: MapEditorProjectSnapshot,
  placementId: string
): MapEditorProjectSnapshot {
  const nextPlacements = Object.freeze(
    project.placementDrafts.filter((placement) => placement.placementId !== placementId)
  );

  return withSelectedEntity(
    Object.freeze({
      ...project,
      placementDrafts: nextPlacements
    }),
    project.selectedEntityRef?.kind === "module" &&
      project.selectedEntityRef.id === placementId
      ? (nextPlacements[0] === undefined
          ? null
          : Object.freeze({
              id: nextPlacements[0].placementId,
              kind: "module"
            }))
      : project.selectedEntityRef
  );
}

export function removeMapEditorPlacementsByAssetId(
  project: MapEditorProjectSnapshot,
  assetId: string
): MapEditorProjectSnapshot {
  const nextPlacements = Object.freeze(
    project.placementDrafts.filter((placement) => placement.assetId !== assetId)
  );

  return withSelectedEntity(
    Object.freeze({
      ...project,
      placementDrafts: nextPlacements
    }),
    project.selectedEntityRef?.kind === "module" &&
      !nextPlacements.some(
        (placement) => placement.placementId === project.selectedEntityRef?.id
      )
      ? (nextPlacements[0] === undefined
          ? null
          : Object.freeze({
              id: nextPlacements[0].placementId,
              kind: "module"
            }))
      : project.selectedEntityRef
  );
}

const generatedEdgeSurfaceMatchEpsilon = 0.001;

function nearlyEqualGeneratedEdgeSurfaceValue(a: number, b: number): boolean {
  return Math.abs(a - b) <= generatedEdgeSurfaceMatchEpsilon;
}

function isGeneratedEdgeBackingSurface(
  edge: MapEditorEdgeDraftSnapshot,
  surface: MapEditorSurfaceDraftSnapshot
): boolean {
  const edgeBaseElevation = edge.center.y - edge.heightMeters * 0.5;

  return (
    surface.terrainPatchId === null &&
    nearlyEqualGeneratedEdgeSurfaceValue(surface.center.x, edge.center.x) &&
    (nearlyEqualGeneratedEdgeSurfaceValue(surface.center.y, edgeBaseElevation) ||
      nearlyEqualGeneratedEdgeSurfaceValue(surface.center.y, edge.center.y)) &&
    nearlyEqualGeneratedEdgeSurfaceValue(surface.center.z, edge.center.z) &&
    (nearlyEqualGeneratedEdgeSurfaceValue(surface.elevation, edgeBaseElevation) ||
      nearlyEqualGeneratedEdgeSurfaceValue(surface.elevation, edge.center.y)) &&
    nearlyEqualGeneratedEdgeSurfaceValue(
      surface.rotationYRadians,
      edge.rotationYRadians
    ) &&
    nearlyEqualGeneratedEdgeSurfaceValue(surface.size.x, edge.lengthMeters) &&
    nearlyEqualGeneratedEdgeSurfaceValue(surface.size.y, edge.heightMeters) &&
    nearlyEqualGeneratedEdgeSurfaceValue(surface.size.z, edge.thicknessMeters)
  );
}

function shouldRemoveGeneratedEdgeBackingSurface(
  project: MapEditorProjectSnapshot,
  removedEdge: MapEditorEdgeDraftSnapshot,
  nextEdgeDrafts: readonly MapEditorEdgeDraftSnapshot[]
): boolean {
  const surface = findSurfaceDraftById(project, removedEdge.surfaceId);

  return (
    surface !== null &&
    isGeneratedEdgeBackingSurface(removedEdge, surface) &&
    !nextEdgeDrafts.some((edge) => edge.surfaceId === removedEdge.surfaceId) &&
    !project.regionDrafts.some(
      (region) => region.surfaceId === removedEdge.surfaceId
    ) &&
    !project.connectorDrafts.some(
      (connector) =>
        connector.fromSurfaceId === removedEdge.surfaceId ||
        connector.toSurfaceId === removedEdge.surfaceId
    )
  );
}

function shouldRemoveOrphanedRegionSurface(
  project: MapEditorProjectSnapshot,
  removedRegion: MapEditorRegionDraftSnapshot,
  nextRegionDrafts: readonly MapEditorRegionDraftSnapshot[]
): boolean {
  return (
    findSurfaceDraftById(project, removedRegion.surfaceId) !== null &&
    !nextRegionDrafts.some(
      (region) => region.surfaceId === removedRegion.surfaceId
    ) &&
    !project.edgeDrafts.some((edge) => edge.surfaceId === removedRegion.surfaceId) &&
    !project.connectorDrafts.some(
      (connector) =>
        connector.fromSurfaceId === removedRegion.surfaceId ||
        connector.toSurfaceId === removedRegion.surfaceId
    )
  );
}

export function removeMapEditorEntity(
  project: MapEditorProjectSnapshot,
  entityRef = project.selectedEntityRef
): MapEditorProjectSnapshot {
  if (entityRef === null) {
    return project;
  }

  switch (entityRef.kind) {
    case "world-atmosphere":
    case "world-sky":
    case "world-sun":
      return project;
    case "module":
      return removeMapEditorPlacement(project, entityRef.id);
    case "player-spawn": {
      const nextProject = Object.freeze({
        ...project,
        playerSpawnDrafts: Object.freeze(
          project.playerSpawnDrafts.filter((spawnDraft) => spawnDraft.spawnId !== entityRef.id)
        )
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "resource-spawn": {
      const nextProject = Object.freeze({
        ...project,
        resourceSpawnDrafts: Object.freeze(
          project.resourceSpawnDrafts.filter(
            (resourceSpawnDraft) => resourceSpawnDraft.spawnId !== entityRef.id
          )
        )
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "scene-object": {
      const nextProject = Object.freeze({
        ...project,
        sceneObjectDrafts: Object.freeze(
          project.sceneObjectDrafts.filter(
            (sceneObjectDraft) => sceneObjectDraft.objectId !== entityRef.id
          )
        )
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "water-region": {
      const nextProject = Object.freeze({
        ...project,
        waterRegionDrafts: Object.freeze(
          project.waterRegionDrafts.filter(
            (waterRegionDraft) => waterRegionDraft.waterRegionId !== entityRef.id
          )
        )
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "region": {
      const removedRegion =
        project.regionDrafts.find(
          (regionDraft) => regionDraft.regionId === entityRef.id
        ) ?? null;
      const nextRegionDrafts = Object.freeze(
        project.regionDrafts.filter(
          (regionDraft) => regionDraft.regionId !== entityRef.id
        )
      );
      const removeOrphanedSurface =
        removedRegion !== null &&
        shouldRemoveOrphanedRegionSurface(
          project,
          removedRegion,
          nextRegionDrafts
        );
      const nextProject = Object.freeze({
        ...project,
        regionDrafts: nextRegionDrafts,
        surfaceDrafts: removeOrphanedSurface
          ? Object.freeze(
              project.surfaceDrafts.filter(
                (surfaceDraft) => surfaceDraft.surfaceId !== removedRegion.surfaceId
              )
            )
          : project.surfaceDrafts
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "edge": {
      const removedEdge =
        project.edgeDrafts.find((edgeDraft) => edgeDraft.edgeId === entityRef.id) ??
        null;
      const nextEdgeDrafts = Object.freeze(
        project.edgeDrafts.filter((edgeDraft) => edgeDraft.edgeId !== entityRef.id)
      );
      const removeBackingSurface =
        removedEdge !== null &&
        shouldRemoveGeneratedEdgeBackingSurface(
          project,
          removedEdge,
          nextEdgeDrafts
        );
      const nextProject = Object.freeze({
        ...project,
        edgeDrafts: nextEdgeDrafts,
        surfaceDrafts: removeBackingSurface
          ? Object.freeze(
              project.surfaceDrafts.filter(
                (surfaceDraft) => surfaceDraft.surfaceId !== removedEdge.surfaceId
              )
            )
          : project.surfaceDrafts
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "connector": {
      const nextProject = Object.freeze({
        ...project,
        connectorDrafts: Object.freeze(
          project.connectorDrafts.filter(
            (connectorDraft) => connectorDraft.connectorId !== entityRef.id
          )
        )
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "structure": {
      const nextProject = Object.freeze({
        ...project,
        structuralDrafts: Object.freeze(
          project.structuralDrafts.filter(
            (structureDraft) => structureDraft.structureId !== entityRef.id
          )
        )
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "gameplay-volume": {
      const selectedGameplayVolume =
        project.gameplayVolumeDrafts.find(
          (volumeDraft) => volumeDraft.volumeId === entityRef.id
        ) ?? null;

      if (selectedGameplayVolume?.volumeKind === "kill-floor") {
        return project;
      }

      const nextProject = Object.freeze({
        ...project,
        gameplayVolumeDrafts: Object.freeze(
          project.gameplayVolumeDrafts.filter(
            (volumeDraft) => volumeDraft.volumeId !== entityRef.id
          )
        )
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "light": {
      const nextProject = Object.freeze({
        ...project,
        lightDrafts: Object.freeze(
          project.lightDrafts.filter((lightDraft) => lightDraft.lightId !== entityRef.id)
        )
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "surface": {
      const removedSurfaceId = entityRef.id;
      const removedRegionIds = new Set(
        project.regionDrafts
          .filter((regionDraft) => regionDraft.surfaceId === removedSurfaceId)
          .map((regionDraft) => regionDraft.regionId)
      );
      const removedEdgeIds = new Set(
        project.edgeDrafts
          .filter((edgeDraft) => edgeDraft.surfaceId === removedSurfaceId)
          .map((edgeDraft) => edgeDraft.edgeId)
      );
      const removedConnectorIds = new Set(
        project.connectorDrafts
          .filter(
            (connectorDraft) =>
              connectorDraft.fromSurfaceId === removedSurfaceId ||
              connectorDraft.toSurfaceId === removedSurfaceId
          )
          .map((connectorDraft) => connectorDraft.connectorId)
      );
      const nextProject = Object.freeze({
        ...project,
        connectorDrafts: Object.freeze(
          project.connectorDrafts.filter(
            (connectorDraft) => !removedConnectorIds.has(connectorDraft.connectorId)
          )
        ),
        edgeDrafts: Object.freeze(
          project.edgeDrafts.filter((edgeDraft) => !removedEdgeIds.has(edgeDraft.edgeId))
        ),
        regionDrafts: Object.freeze(
          project.regionDrafts.filter(
            (regionDraft) => !removedRegionIds.has(regionDraft.regionId)
          )
        ),
        surfaceDrafts: Object.freeze(
          project.surfaceDrafts.filter((surfaceDraft) => surfaceDraft.surfaceId !== removedSurfaceId)
        )
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
    case "terrain-patch": {
      const removedChunkId = entityRef.id;
      const removedSurfaceIds = new Set(
        project.surfaceDrafts
          .filter((surfaceDraft) => surfaceDraft.terrainPatchId === removedChunkId)
          .map((surfaceDraft) => surfaceDraft.surfaceId)
      );
      const removedRegionIds = new Set(
        project.regionDrafts
          .filter((regionDraft) => removedSurfaceIds.has(regionDraft.surfaceId))
          .map((regionDraft) => regionDraft.regionId)
      );
      const removedEdgeIds = new Set(
        project.edgeDrafts
          .filter((edgeDraft) => removedSurfaceIds.has(edgeDraft.surfaceId))
          .map((edgeDraft) => edgeDraft.edgeId)
      );
      const removedConnectorIds = new Set(
        project.connectorDrafts
          .filter(
            (connectorDraft) =>
              removedSurfaceIds.has(connectorDraft.fromSurfaceId) ||
              removedSurfaceIds.has(connectorDraft.toSurfaceId)
          )
          .map((connectorDraft) => connectorDraft.connectorId)
      );
      const nextProject = Object.freeze({
        ...project,
        connectorDrafts: Object.freeze(
          project.connectorDrafts.filter(
            (connectorDraft) => !removedConnectorIds.has(connectorDraft.connectorId)
          )
        ),
        edgeDrafts: Object.freeze(
          project.edgeDrafts.filter((edgeDraft) => !removedEdgeIds.has(edgeDraft.edgeId))
        ),
        regionDrafts: Object.freeze(
          project.regionDrafts.filter(
            (regionDraft) => !removedRegionIds.has(regionDraft.regionId)
          )
        ),
        surfaceDrafts: Object.freeze(
          project.surfaceDrafts.filter(
            (surfaceDraft) => !removedSurfaceIds.has(surfaceDraft.surfaceId)
          )
        ),
        terrainPatchDrafts: Object.freeze(
          project.terrainPatchDrafts.filter(
            (terrainPatchDraft) => terrainPatchDraft.terrainPatchId !== removedChunkId
          )
        )
      });

      return withSelectedEntity(
        nextProject,
        resolveNextSelectionAfterRemoval(project, nextProject, entityRef)
      );
    }
  }
}

export function addMapEditorLaunchVariationDraft(
  project: MapEditorProjectSnapshot
): MapEditorProjectSnapshot {
  const nextVariation = freezeLaunchVariationDraft({
    description: "",
    experienceId: null,
    gameplayVariationId: null,
    label: "New Setup",
    matchMode: "free-roam",
    variationId: createMapEditorLaunchVariationId(project),
    vehicleLayoutId: null,
    weaponLayoutId: null
  });

  return Object.freeze({
    ...project,
    launchVariationDrafts: Object.freeze([
      ...project.launchVariationDrafts,
      nextVariation
    ]),
    selectedLaunchVariationId: nextVariation.variationId
  });
}

export function addMapEditorPlayerSpawnDraft(
  project: MapEditorProjectSnapshot,
  position = createMapEditorSceneDraftPosition(project, Object.freeze({
    x: 4,
    y: 0,
    z: 0
  }))
): MapEditorProjectSnapshot {
  const nextSpawn = freezePlayerSpawnDraft({
    label: `Player Spawn ${project.playerSpawnDrafts.length + 1}`,
    position,
    spawnId: createMapEditorPlayerSpawnId(project),
    teamId: "neutral",
    yawRadians: 0
  });

  return withSelectedEntity(
    Object.freeze({
      ...project,
      playerSpawnDrafts: Object.freeze([...project.playerSpawnDrafts, nextSpawn])
    }),
    Object.freeze({
      id: nextSpawn.spawnId,
      kind: "player-spawn"
    })
  );
}

export function addMapEditorResourceSpawnDraft(
  project: MapEditorProjectSnapshot,
  position = createMapEditorSceneDraftPosition(project, Object.freeze({
    x: 0,
    y: 0,
    z: 4
  }))
): MapEditorProjectSnapshot {
  const nextResourceSpawn = freezeResourceSpawnDraft({
    ammoGrantRounds: 48,
    assetId: "metaverse-service-pistol-v2",
    label: `Weapon Pickup ${project.resourceSpawnDrafts.length + 1}`,
    modeTags: Object.freeze(["team-deathmatch"]),
    pickupRadiusMeters: 1.4,
    position,
    respawnCooldownMs: 30_000,
    spawnId: createMapEditorResourceSpawnId(project),
    weaponId: "metaverse-service-pistol-v2",
    yawRadians: 0
  });

  return withSelectedEntity(
    Object.freeze({
      ...project,
      resourceSpawnDrafts: Object.freeze([
        ...project.resourceSpawnDrafts,
        nextResourceSpawn
      ])
    }),
    Object.freeze({
      id: nextResourceSpawn.spawnId,
      kind: "resource-spawn"
    })
  );
}

export function addMapEditorSceneObjectDraft(
  project: MapEditorProjectSnapshot,
  position = createMapEditorSceneDraftPosition(project, Object.freeze({
    x: 0,
    y: 6,
    z: -12
  }))
): MapEditorProjectSnapshot {
  const nextSceneObject = freezeSceneObjectDraft({
    assetId: null,
    label: `Portal ${project.sceneObjectDrafts.length + 1}`,
    launchTarget: Object.freeze({
      beamColorHex: "#f4ba2b",
      experienceId: "duck-hunt",
      highlightRadius: 22,
      interactionRadius: 10,
      ringColorHex: "#f6d06a"
    }),
    objectId: createMapEditorSceneObjectId(project),
    position,
    rotationYRadians: 0,
    scale: 1
  });

  return withSelectedEntity(
    Object.freeze({
      ...project,
      sceneObjectDrafts: Object.freeze([
        ...project.sceneObjectDrafts,
        nextSceneObject
      ])
    }),
    Object.freeze({
      id: nextSceneObject.objectId,
      kind: "scene-object"
    })
  );
}

export function addMapEditorWaterRegionDraft(
  project: MapEditorProjectSnapshot,
  position = createMapEditorSceneDraftPosition(project, Object.freeze({
    x: 0,
    y: 0,
    z: 0
  })),
  options?: {
    readonly depthMeters?: number;
    readonly endPosition?: MetaverseWorldSurfaceVector3Snapshot;
    readonly topElevationMeters?: number;
    readonly widthCells?: number;
    readonly zCells?: number;
  }
): MapEditorProjectSnapshot {
  const fallbackCellsX = Math.max(1, options?.widthCells ?? 1);
  const fallbackCellsZ = Math.max(1, options?.zCells ?? 1);
  const topElevation = options?.topElevationMeters ?? position.y;
  const endPosition = options?.endPosition ?? position;
  const snappedStart = resolveMapEditorBuildGroundPosition(
    position,
    topElevation
  );
  const snappedEnd = resolveMapEditorBuildGroundPosition(
    endPosition,
    topElevation
  );
  const rectangle =
    snappedStart.x === snappedEnd.x && snappedStart.z === snappedEnd.z
      ? Object.freeze({
          center: resolveMapEditorBuildFootprintCenterPosition(
            position,
            topElevation,
            fallbackCellsX,
            fallbackCellsZ
          ),
          size: Object.freeze({
            x: fallbackCellsX * mapEditorBuildGridUnitMeters,
            y: Math.max(0.5, options?.depthMeters ?? 4),
            z: fallbackCellsZ * mapEditorBuildGridUnitMeters
          })
        })
      : resolveMapEditorBuildRectangleFromGridPoints(
          snappedStart,
          snappedEnd,
          Math.max(0.5, options?.depthMeters ?? 4)
        );
  const sizeCellsX = Math.max(
    1,
    Math.round(rectangle.size.x / mapEditorBuildGridUnitMeters)
  );
  const sizeCellsZ = Math.max(
    1,
    Math.round(rectangle.size.z / mapEditorBuildGridUnitMeters)
  );
  const nextWaterRegion = freezeWaterRegionDraft({
    depthMeters: Math.max(0.5, options?.depthMeters ?? 4),
    footprint: Object.freeze({
      centerX: rectangle.center.x,
      centerZ: rectangle.center.z,
      sizeCellsX,
      sizeCellsZ
    }),
    previewColorHex:
      project.waterRegionDrafts[project.waterRegionDrafts.length - 1]?.previewColorHex ??
      "#2f7f9c",
    previewOpacity: 0.58,
    topElevationMeters: topElevation,
    waterRegionId: createMapEditorWaterRegionId(project)
  });

  return withSelectedEntity(
    Object.freeze({
      ...project,
      waterRegionDrafts: Object.freeze([
        ...project.waterRegionDrafts,
        nextWaterRegion
      ])
    }),
    Object.freeze({
      id: nextWaterRegion.waterRegionId,
      kind: "water-region"
    })
  );
}

export function addMapEditorTerrainPatchDraft(
  project: MapEditorProjectSnapshot,
  position = createMapEditorSceneDraftPosition(project, Object.freeze({
    x: 0,
    y: 0,
    z: 0
  })),
  materialId: MapEditorStructuralDraftSnapshot["materialId"] = "terrain-grass",
  options?: {
    readonly endPosition?: MetaverseWorldSurfaceVector3Snapshot;
  }
): MapEditorProjectSnapshot {
  const fallbackTerrainCellsX = defaultTerrainPatchSampleCount - 1;
  const fallbackTerrainCellsZ = defaultTerrainPatchSampleCount - 1;
  const endPosition = options?.endPosition ?? position;
  const snappedStart = resolveMapEditorBuildGroundPosition(position, position.y);
  const snappedEnd = resolveMapEditorBuildGroundPosition(endPosition, position.y);
  const rectangle =
    snappedStart.x === snappedEnd.x && snappedStart.z === snappedEnd.z
      ? Object.freeze({
          center: resolveMapEditorBuildFootprintCenterPosition(
            position,
            position.y,
            fallbackTerrainCellsX,
            fallbackTerrainCellsZ
          ),
          size: Object.freeze({
            x: fallbackTerrainCellsX * mapEditorBuildGridUnitMeters,
            y: 0.5,
            z: fallbackTerrainCellsZ * mapEditorBuildGridUnitMeters
          })
        })
      : resolveMapEditorBuildRectangleFromGridPoints(snappedStart, snappedEnd, 0.5);
  const terrainCellsX = Math.max(
    1,
    Math.round(rectangle.size.x / mapEditorBuildGridUnitMeters)
  );
  const terrainCellsZ = Math.max(
    1,
    Math.round(rectangle.size.z / mapEditorBuildGridUnitMeters)
  );
  const sampleCountX = terrainCellsX + 1;
  const sampleCountZ = terrainCellsZ + 1;
  const terrainPatchId = createMapEditorTerrainPatchId(project);
  const patchSize = Object.freeze({
    x: terrainCellsX * mapEditorBuildGridUnitMeters,
    y: 0.5,
    z: terrainCellsZ * mapEditorBuildGridUnitMeters
  });
  const nextTerrainPatch = Object.freeze({
    grid: createMapEditorStructuralGrid(rectangle.center, patchSize),
    heightSamples: createTerrainPatchHeights(
      sampleCountX,
      sampleCountZ
    ),
    label: `Terrain ${project.terrainPatchDrafts.length + 1}`,
    materialLayers: createTerrainPatchMaterialLayers(
      terrainPatchId,
      sampleCountX,
      sampleCountZ,
      materialId
    ),
    origin: rectangle.center,
    rotationYRadians: 0,
    sampleCountX,
    sampleCountZ,
    sampleSpacingMeters: mapEditorBuildGridUnitMeters,
    terrainPatchId,
    waterLevelMeters: null
  } satisfies MapEditorTerrainPatchDraftSnapshot);

  return withSelectedEntity(
    seedTerrainPatchBoundariesFromNeighbors(
      Object.freeze({
        ...project,
        terrainPatchDrafts: Object.freeze([
          ...project.terrainPatchDrafts,
          nextTerrainPatch
        ])
      }),
      terrainPatchId
    ),
    Object.freeze({
      id: nextTerrainPatch.terrainPatchId,
      kind: "terrain-patch"
    })
  );
}

export function addMapEditorSurfaceDraft(
  project: MapEditorProjectSnapshot
): MapEditorProjectSnapshot {
  const nextSurface = freezeSurfaceDraft({
    center: createMapEditorSceneDraftPosition(project, Object.freeze({
      x: 0,
      y: 0,
      z: 0
    })),
    elevation: 0,
    kind: "flat-slab",
    label: `Surface ${project.surfaceDrafts.length + 1}`,
    rotationYRadians: 0,
    size: Object.freeze({
      x: 8,
      y: 0.5,
      z: 8
    }),
    slopeRiseMeters: 0,
    surfaceId: createMapEditorSurfaceId(project),
    terrainPatchId: null
  });

  return withSelectedEntity(
    Object.freeze({
      ...project,
      surfaceDrafts: Object.freeze([...project.surfaceDrafts, nextSurface])
    }),
    Object.freeze({
      id: nextSurface.surfaceId,
      kind: "surface"
    })
  );
}

export function addMapEditorRegionDraft(
  project: MapEditorProjectSnapshot,
  position = createMapEditorSceneDraftPosition(project, Object.freeze({
    x: 0,
    y: 0,
    z: 0
  }))
): MapEditorProjectSnapshot {
  const { project: projectWithSurface, surfaceId } = createSemanticSurfaceForPlacement(
    project,
    `Surface ${project.surfaceDrafts.length + 1}`,
    position,
    0,
    Object.freeze({
      x: 8,
      y: 0.5,
      z: 8
    })
  );
  const nextRegion = freezeRegionDraft({
    center: position,
    label: `Region ${project.regionDrafts.length + 1}`,
    materialReferenceId: null,
    outerLoop: createRectangularSurfaceLoop({
      x: 8,
      z: 8
    }),
    regionId: createMapEditorRegionId(projectWithSurface),
    regionKind: "floor",
    rotationYRadians: 0,
    size: Object.freeze({
      x: 8,
      y: 0.5,
      z: 8
    }),
    surfaceId
  });

  return withSelectedEntity(
    Object.freeze({
      ...projectWithSurface,
      regionDrafts: Object.freeze([...projectWithSurface.regionDrafts, nextRegion])
    }),
    Object.freeze({
      id: nextRegion.regionId,
      kind: "region"
    })
  );
}

export function addMapEditorFloorRegionDraft(
  project: MapEditorProjectSnapshot,
  startPosition: MetaverseWorldSurfaceVector3Snapshot,
  endPosition: MetaverseWorldSurfaceVector3Snapshot,
  options?: {
    readonly elevationMeters?: number;
    readonly footprintCellsX?: number;
    readonly footprintCellsZ?: number;
    readonly materialId?: MapEditorStructuralDraftSnapshot["materialId"];
    readonly materialReferenceId?: string | null;
    readonly outerLoop?: MetaverseMapBundleSemanticPlanarLoopSnapshot;
    readonly regionKind?: MapEditorRegionDraftSnapshot["regionKind"];
    readonly rotationYRadians?: number;
    readonly slopeRiseMeters?: number;
    readonly surfaceKind?: MapEditorSurfaceDraftSnapshot["kind"];
    readonly surfaceCenter?: MetaverseWorldSurfaceVector3Snapshot;
  }
): MapEditorProjectSnapshot {
  const elevation = options?.elevationMeters ?? startPosition.y;
  const snappedStart = resolveMapEditorBuildGroundPosition(startPosition, elevation);
  const snappedEnd = resolveMapEditorBuildGroundPosition(endPosition, elevation);
  const explicitLoop = options?.outerLoop ?? null;
  const rectangle =
    explicitLoop === null
      ? snappedStart.x === snappedEnd.x && snappedStart.z === snappedEnd.z
        ? Object.freeze({
            center: resolveMapEditorBuildFootprintCenterPosition(
              startPosition,
              elevation,
              Math.max(1, options?.footprintCellsX ?? 2),
              Math.max(1, options?.footprintCellsZ ?? 2)
            ),
            size: Object.freeze({
              x:
                Math.max(1, options?.footprintCellsX ?? 2) *
                mapEditorBuildGridUnitMeters,
              y: 0.5,
              z:
                Math.max(1, options?.footprintCellsZ ?? 2) *
                mapEditorBuildGridUnitMeters
            })
          })
        : resolveMapEditorBuildRectangleFromGridPoints(snappedStart, snappedEnd, 0.5)
      : null;
  const outerLoop =
    explicitLoop ?? createRectangularSurfaceLoop(rectangle!.size);
  const loopBounds = outerLoop.points.reduce(
    (bounds, point) =>
      Object.freeze({
        maxX: Math.max(bounds.maxX, point.x),
        maxZ: Math.max(bounds.maxZ, point.z),
        minX: Math.min(bounds.minX, point.x),
        minZ: Math.min(bounds.minZ, point.z)
      }),
    Object.freeze({
      maxX: Number.NEGATIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY
    })
  );
  const surfaceCenter =
    options?.surfaceCenter ??
    rectangle?.center ??
    Object.freeze({
      x: startPosition.x,
      y: elevation,
      z: startPosition.z
    });
  const surfaceSize = Object.freeze({
    x: Math.max(0.5, loopBounds.maxX - loopBounds.minX),
    y: 0.5,
    z: Math.max(0.5, loopBounds.maxZ - loopBounds.minZ)
  });
  const { project: projectWithSurface, surfaceId } =
    createSemanticSurfaceForPlacement(
      project,
      `${options?.regionKind === "roof" ? "Roof" : "Floor"} Surface ${project.surfaceDrafts.length + 1}`,
      surfaceCenter,
      options?.rotationYRadians ?? 0,
      surfaceSize,
      {
        kind: options?.surfaceKind ?? "flat-slab",
        slopeRiseMeters: options?.slopeRiseMeters ?? 0
      }
    );
  const nextRegion = freezeRegionDraft({
    center: surfaceCenter,
    label: `${options?.regionKind === "roof" ? "Roof" : "Floor"} ${projectWithSurface.regionDrafts.length + 1}`,
    materialReferenceId:
      options?.materialReferenceId ?? options?.materialId ?? "concrete",
    outerLoop,
    regionId: createMapEditorRegionId(projectWithSurface),
    regionKind: options?.regionKind ?? "floor",
    rotationYRadians: options?.rotationYRadians ?? 0,
    size: surfaceSize,
    surfaceId
  });

  return withSelectedEntity(
    Object.freeze({
      ...projectWithSurface,
      regionDrafts: Object.freeze([...projectWithSurface.regionDrafts, nextRegion])
    }),
    Object.freeze({
      id: nextRegion.regionId,
      kind: "region"
    })
  );
}

export function addMapEditorFloorPolygonRegionDraft(
  project: MapEditorProjectSnapshot,
  worldPoints: readonly MetaverseWorldSurfaceVector3Snapshot[],
  options?: {
    readonly elevationMeters?: number;
    readonly materialId?: MapEditorStructuralDraftSnapshot["materialId"];
    readonly materialReferenceId?: string | null;
    readonly regionKind?: MapEditorRegionDraftSnapshot["regionKind"];
    readonly slopeRiseMeters?: number;
    readonly surfaceKind?: MapEditorSurfaceDraftSnapshot["kind"];
  }
): MapEditorProjectSnapshot {
  if (worldPoints.length < 3) {
    return project;
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of worldPoints) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minZ)) {
    return project;
  }

  const elevation = options?.elevationMeters ?? worldPoints[0]!.y;
  const center = Object.freeze({
    x: (minX + maxX) * 0.5,
    y: elevation,
    z: (minZ + maxZ) * 0.5
  });
  const regionOptions = {
    elevationMeters: elevation,
    outerLoop: Object.freeze({
      points: Object.freeze(
        worldPoints.map((point) =>
          createPlanarPoint(point.x - center.x, point.z - center.z)
        )
      )
    }),
    surfaceCenter: center
  } satisfies {
    readonly elevationMeters: number;
    readonly outerLoop: MetaverseMapBundleSemanticPlanarLoopSnapshot;
    readonly surfaceCenter: MetaverseWorldSurfaceVector3Snapshot;
  };

  return addMapEditorFloorRegionDraft(project, center, center, {
    ...regionOptions,
    ...(options?.materialId === undefined
      ? null
      : { materialId: options.materialId }),
    ...(options?.materialReferenceId === undefined
      ? null
      : { materialReferenceId: options.materialReferenceId }),
    ...(options?.regionKind === undefined
      ? null
      : { regionKind: options.regionKind }),
    ...(options?.slopeRiseMeters === undefined
      ? null
      : { slopeRiseMeters: options.slopeRiseMeters }),
    ...(options?.surfaceKind === undefined
      ? null
      : { surfaceKind: options.surfaceKind })
  });
}

export function addMapEditorEdgeDraft(
  project: MapEditorProjectSnapshot,
  position = createMapEditorSceneDraftPosition(project, Object.freeze({
    x: 0,
    y: 0,
    z: 0
  }))
): MapEditorProjectSnapshot {
  const { project: projectWithSurface, surfaceId } = createSemanticSurfaceForPlacement(
    project,
    `Edge Surface ${project.surfaceDrafts.length + 1}`,
    Object.freeze({
      x: position.x,
      y: position.y,
      z: position.z
    }),
    0,
    Object.freeze({
      x: 8,
      y: 4,
      z: 0.5
    })
  );
  const nextEdge = freezeEdgeDraft({
    center: Object.freeze({
      x: position.x,
      y: position.y + 2,
      z: position.z
    }),
    edgeId: createMapEditorEdgeId(projectWithSurface),
    edgeKind: "wall",
    heightMeters: 4,
    label: `Edge ${project.edgeDrafts.length + 1}`,
    lengthMeters: 8,
    materialReferenceId: null,
    path: Object.freeze([
      createPlanarPoint(-4, 0),
      createPlanarPoint(4, 0)
    ]),
    rotationYRadians: 0,
    surfaceId,
    thicknessMeters: 0.5
  });

  return withSelectedEntity(
    Object.freeze({
      ...projectWithSurface,
      edgeDrafts: Object.freeze([...projectWithSurface.edgeDrafts, nextEdge])
    }),
    Object.freeze({
      id: nextEdge.edgeId,
      kind: "edge"
    })
  );
}

export function addMapEditorConnectorDraft(
  project: MapEditorProjectSnapshot,
  position = createMapEditorSceneDraftPosition(project, Object.freeze({
    x: 0,
    y: 0.5,
    z: 0
  }))
): MapEditorProjectSnapshot {
  const fromSurfaceId = project.surfaceDrafts[0]?.surfaceId ?? createMapEditorSurfaceId(project);
  const toSurfaceId = project.surfaceDrafts[1]?.surfaceId ?? fromSurfaceId;
  const nextConnector = freezeConnectorDraft({
    center: position,
    connectorId: createMapEditorConnectorId(project),
    connectorKind: "ramp",
    fromSurfaceId,
    label: `Connector ${project.connectorDrafts.length + 1}`,
    rotationYRadians: 0,
    size: Object.freeze({
      x: 4,
      y: 1,
      z: 4
    }),
    toSurfaceId
  });

  return withSelectedEntity(
    Object.freeze({
      ...project,
      connectorDrafts: Object.freeze([
        ...project.connectorDrafts,
        nextConnector
      ])
    }),
    Object.freeze({
      id: nextConnector.connectorId,
      kind: "connector"
    })
  );
}

export function createMapEditorStructuralGrid(
  center: MetaverseWorldSurfaceVector3Snapshot,
  size: MetaverseWorldSurfaceVector3Snapshot
): MapEditorStructuralDraftSnapshot["grid"] {
  return Object.freeze({
    cellX: Math.round((center.x - size.x * 0.5) / mapEditorBuildGridUnitMeters),
    cellZ: Math.round((center.z - size.z * 0.5) / mapEditorBuildGridUnitMeters),
    cellsX: Math.max(1, Math.round(size.x / mapEditorBuildGridUnitMeters)),
    cellsZ: Math.max(1, Math.round(size.z / mapEditorBuildGridUnitMeters)),
    layer: Math.round(center.y / mapEditorBuildGridUnitMeters)
  });
}

export function addMapEditorStructuralDraft(
  project: MapEditorProjectSnapshot,
  input: {
    readonly center: MetaverseWorldSurfaceVector3Snapshot;
    readonly label?: string;
    readonly materialId?: MapEditorStructuralDraftSnapshot["materialId"];
    readonly materialReferenceId?: string | null;
    readonly rotationYRadians?: number;
    readonly size: MetaverseWorldSurfaceVector3Snapshot;
    readonly structureKind: MapEditorStructuralDraftSnapshot["structureKind"];
    readonly traversalAffordance?: MapEditorStructuralDraftSnapshot["traversalAffordance"];
  }
): MapEditorProjectSnapshot {
  const structureId = createMapEditorStructureId(project);
  const nextStructure = freezeStructuralDraft({
    center: input.center,
    grid: createMapEditorStructuralGrid(input.center, input.size),
    label:
      input.label ??
      `${input.structureKind[0]?.toUpperCase()}${input.structureKind.slice(1)} ${project.structuralDrafts.length + 1}`,
    materialId: input.materialId ?? "concrete",
    materialReferenceId: input.materialReferenceId ?? input.materialId ?? "concrete",
    rotationYRadians: input.rotationYRadians ?? 0,
    size: input.size,
    structureId,
    structureKind: input.structureKind,
    traversalAffordance:
      input.traversalAffordance ??
      (input.structureKind === "cover" || input.structureKind === "wall"
        ? "blocker"
        : "support")
  });

  return withSelectedEntity(
    Object.freeze({
      ...project,
      structuralDrafts: Object.freeze([
        ...project.structuralDrafts,
        nextStructure
      ])
    }),
    Object.freeze({
      id: structureId,
      kind: "structure"
    })
  );
}

export function addMapEditorGameplayVolumeDraft(
  project: MapEditorProjectSnapshot,
  input: {
    readonly center: MetaverseWorldSurfaceVector3Snapshot;
    readonly label?: string;
    readonly priority?: number;
    readonly rotationYRadians?: number;
    readonly routePoints?: readonly MetaverseWorldSurfaceVector3Snapshot[];
    readonly size: MetaverseWorldSurfaceVector3Snapshot;
    readonly tags?: readonly string[];
    readonly teamId?: MapEditorGameplayVolumeDraftSnapshot["teamId"];
    readonly volumeKind: MapEditorGameplayVolumeDraftSnapshot["volumeKind"];
  }
): MapEditorProjectSnapshot {
  const volumeId = createMapEditorGameplayVolumeId(project);
  const nextVolume = freezeGameplayVolumeDraft({
    center: input.center,
    label:
      input.label ??
      `${input.volumeKind[0]?.toUpperCase()}${input.volumeKind.slice(1)} ${project.gameplayVolumeDrafts.length + 1}`,
    priority: input.priority ?? 0,
    rotationYRadians: input.rotationYRadians ?? 0,
    routePoints: input.routePoints ?? Object.freeze([]),
    size: input.size,
    tags: input.tags ?? Object.freeze([]),
    teamId: input.teamId ?? null,
    volumeId,
    volumeKind: input.volumeKind
  });

  return withSelectedEntity(
    Object.freeze({
      ...project,
      gameplayVolumeDrafts: Object.freeze([
        ...project.gameplayVolumeDrafts,
        nextVolume
      ])
    }),
    Object.freeze({
      id: volumeId,
      kind: "gameplay-volume"
    })
  );
}

export function addMapEditorLightDraft(
  project: MapEditorProjectSnapshot,
  position: MetaverseWorldSurfaceVector3Snapshot,
  input?: {
    readonly color?: readonly [number, number, number];
    readonly intensity?: number;
    readonly lightKind?: MapEditorLightDraftSnapshot["lightKind"];
    readonly rangeMeters?: number | null;
  }
): MapEditorProjectSnapshot {
  const lightId = createMapEditorLightId(project);
  const nextLight = freezeLightDraft({
    color: input?.color ?? Object.freeze([1, 0.86, 0.62] as const),
    intensity: input?.intensity ?? 2.5,
    label: `Light ${project.lightDrafts.length + 1}`,
    lightId,
    lightKind: input?.lightKind ?? "point",
    position,
    rangeMeters: input?.rangeMeters ?? 20,
    rotationYRadians: 0,
    target: null
  });

  return withSelectedEntity(
    Object.freeze({
      ...project,
      lightDrafts: Object.freeze([...project.lightDrafts, nextLight])
    }),
    Object.freeze({
      id: lightId,
      kind: "light"
    })
  );
}

export function addMapEditorMaterialDefinitionDraft(
  project: MapEditorProjectSnapshot,
  input: {
    readonly accentColorHex?: string | null;
    readonly baseColorHex: string;
    readonly baseMaterialId: MapEditorStructuralDraftSnapshot["materialId"];
    readonly label?: string;
    readonly materialId?: string;
    readonly metalness?: number;
    readonly opacity?: number;
    readonly roughness?: number;
    readonly textureBrightness?: number;
    readonly textureContrast?: number;
    readonly textureImageDataUrl?: string | null;
    readonly texturePatternStrength?: number;
    readonly textureRepeat?: number;
  }
): MapEditorProjectSnapshot {
  const materialId =
    input.materialId ?? createNextMapEditorMaterialDefinitionId(project);
  const existingDefinition = project.materialDefinitionDrafts.find(
    (materialDefinition) => materialDefinition.materialId === materialId
  );
  const nextDefinition = freezeMaterialDefinitionDraft({
    accentColorHex: input.accentColorHex ?? null,
    baseColorHex: input.baseColorHex,
    baseMaterialId: input.baseMaterialId,
    label: input.label ?? `Material ${project.materialDefinitionDrafts.length + 1}`,
    materialId,
    metalness: Math.min(1, Math.max(0, input.metalness ?? 0.04)),
    opacity: Math.min(1, Math.max(0, input.opacity ?? 1)),
    roughness: Math.min(1, Math.max(0, input.roughness ?? 0.82)),
    textureBrightness: Math.min(2, Math.max(0, input.textureBrightness ?? 1)),
    textureContrast: Math.min(2, Math.max(0, input.textureContrast ?? 1)),
    textureImageDataUrl: input.textureImageDataUrl ?? null,
    texturePatternStrength: Math.min(
      1,
      Math.max(0, input.texturePatternStrength ?? 1)
    ),
    textureRepeat: Math.min(32, Math.max(0.25, input.textureRepeat ?? 1))
  });

  return Object.freeze({
    ...project,
    materialDefinitionDrafts:
      existingDefinition === undefined
        ? Object.freeze([
            ...project.materialDefinitionDrafts,
            nextDefinition
          ])
        : Object.freeze(
            project.materialDefinitionDrafts.map((materialDefinition) =>
              materialDefinition.materialId === materialId
                ? nextDefinition
                : materialDefinition
            )
          )
  });
}

function resolveBuildRectangle(
  startPosition: MetaverseWorldSurfaceVector3Snapshot,
  endPosition: MetaverseWorldSurfaceVector3Snapshot,
  elevationMeters: number,
  heightMeters: number,
  fallbackCellsX = 1,
  fallbackCellsZ = 1
): {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
} {
  const snappedStart = resolveMapEditorBuildGroundPosition(
    startPosition,
    elevationMeters
  );
  const snappedEnd = resolveMapEditorBuildGroundPosition(
    endPosition,
    elevationMeters
  );

  return snappedStart.x === snappedEnd.x && snappedStart.z === snappedEnd.z
    ? Object.freeze({
        center: resolveMapEditorBuildFootprintCenterPosition(
          startPosition,
          elevationMeters,
          fallbackCellsX,
          fallbackCellsZ
        ),
        size: Object.freeze({
          x: Math.max(1, fallbackCellsX) * mapEditorBuildGridUnitMeters,
          y: heightMeters,
          z: Math.max(1, fallbackCellsZ) * mapEditorBuildGridUnitMeters
        })
      })
    : resolveMapEditorBuildRectangleFromGridPoints(
        snappedStart,
        snappedEnd,
        heightMeters
      );
}

function resolveSegmentDraftShape(
  startPosition: MetaverseWorldSurfaceVector3Snapshot,
  endPosition: MetaverseWorldSurfaceVector3Snapshot,
  widthMeters: number,
  heightMeters: number
): {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly lengthMeters: number;
  readonly rotationYRadians: number;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly start: MetaverseWorldSurfaceVector3Snapshot;
  readonly end: MetaverseWorldSurfaceVector3Snapshot;
} | null {
  const snappedStart = resolveMapEditorBuildSizedCenterPosition(
    startPosition,
    startPosition.y,
    widthMeters,
    widthMeters
  );
  const snappedEnd = resolveMapEditorBuildSizedCenterPosition(
    endPosition,
    endPosition.y,
    widthMeters,
    widthMeters
  );
  const deltaX = snappedEnd.x - snappedStart.x;
  const deltaZ = snappedEnd.z - snappedStart.z;
  const lengthMeters = Math.hypot(deltaX, deltaZ);

  if (lengthMeters <= 0.01) {
    return null;
  }

  return Object.freeze({
    center: Object.freeze({
      x: (snappedStart.x + snappedEnd.x) * 0.5,
      y: Math.min(snappedStart.y, snappedEnd.y),
      z: (snappedStart.z + snappedEnd.z) * 0.5
    }),
    end: snappedEnd,
    lengthMeters,
    rotationYRadians: Math.atan2(deltaX, deltaZ),
    size: Object.freeze({
      x: widthMeters,
      y: heightMeters,
      z: Math.max(mapEditorBuildGridUnitMeters, lengthMeters)
    }),
    start: snappedStart
  });
}

function createRoutePoint(
  position: MetaverseWorldSurfaceVector3Snapshot
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x: position.x,
    y: position.y,
    z: position.z
  });
}

function addMapEditorSpawnRoomGeometryDraft(
  project: MapEditorProjectSnapshot,
  startPosition: MetaverseWorldSurfaceVector3Snapshot,
  endPosition: MetaverseWorldSurfaceVector3Snapshot,
  options?: {
    readonly elevationMeters?: number;
    readonly materialId?: MapEditorStructuralDraftSnapshot["materialId"];
  }
): MapEditorProjectSnapshot {
  const elevation = options?.elevationMeters ?? startPosition.y;
  const firstRoomStructureIndex = project.structuralDrafts.length;
  const rectangle = resolveBuildRectangle(
    startPosition,
    endPosition,
    elevation,
    0.5,
    3,
    3
  );
  const floorOptionsBase = Object.freeze({
    elevationMeters: elevation,
    footprintCellsX: Math.max(
      1,
      Math.round(rectangle.size.x / mapEditorBuildGridUnitMeters)
    ),
    footprintCellsZ: Math.max(
      1,
      Math.round(rectangle.size.z / mapEditorBuildGridUnitMeters)
    )
  });
  let nextProject = addMapEditorFloorRegionDraft(
    project,
    startPosition,
    endPosition,
    options?.materialId === undefined
      ? floorOptionsBase
      : Object.freeze({
          ...floorOptionsBase,
          materialId: options.materialId
        })
  );
  const minX = rectangle.center.x - rectangle.size.x * 0.5;
  const maxX = rectangle.center.x + rectangle.size.x * 0.5;
  const minZ = rectangle.center.z - rectangle.size.z * 0.5;
  const maxZ = rectangle.center.z + rectangle.size.z * 0.5;
  const baseY = elevation;
  const perimeterSegments = [
    [minX, minZ, maxX, minZ],
    [maxX, minZ, maxX, maxZ],
    [maxX, maxZ, minX, maxZ],
    [minX, maxZ, minX, minZ]
  ] as const;

  for (const [startX, startZ, endX, endZ] of perimeterSegments) {
    nextProject = addMapEditorWallSegment(
      nextProject,
      Object.freeze({
        x: startX,
        y: baseY,
        z: startZ
      }),
      Object.freeze({
        x: endX,
        y: baseY,
        z: endZ
      }),
      "wall"
    );
  }

  const roomMaterialId = options?.materialId;

  if (roomMaterialId !== undefined) {
    nextProject = Object.freeze({
      ...nextProject,
      structuralDrafts: Object.freeze(
        nextProject.structuralDrafts.map((structure, structureIndex) =>
          structureIndex >= firstRoomStructureIndex &&
          (structure.structureKind === "floor" || structure.structureKind === "wall")
            ? freezeStructuralDraft({
                ...structure,
                materialId: roomMaterialId,
                materialReferenceId: roomMaterialId
              })
            : structure
        )
      )
    });
  }

  return nextProject;
}

export function addMapEditorCoverDraft(
  project: MapEditorProjectSnapshot,
  position: MetaverseWorldSurfaceVector3Snapshot,
  options?: {
    readonly footprintCellsX?: number;
    readonly footprintCellsZ?: number;
    readonly heightCells?: number;
    readonly materialId?: MapEditorStructuralDraftSnapshot["materialId"];
    readonly materialReferenceId?: string | null;
  }
): MapEditorProjectSnapshot {
  const footprintCellsX = Math.max(1, options?.footprintCellsX ?? 1);
  const footprintCellsZ = Math.max(1, options?.footprintCellsZ ?? 1);
  const heightCells = Math.max(1, options?.heightCells ?? 1);
  const snappedPosition = resolveMapEditorBuildFootprintCenterPosition(
    position,
    position.y,
    footprintCellsX,
    footprintCellsZ
  );
  const size = Object.freeze({
    x: footprintCellsX * mapEditorBuildGridUnitMeters,
    y: heightCells * mapEditorBuildGridUnitMeters,
    z: footprintCellsZ * mapEditorBuildGridUnitMeters
  });
  const structureId = createMapEditorStructureId(project);
  const structure = freezeStructuralDraft({
    center: snappedPosition,
    grid: createMapEditorStructuralGrid(snappedPosition, size),
    label: `Cover Block ${project.structuralDrafts.length + 1}`,
    materialId: options?.materialId ?? "metal",
    materialReferenceId:
      options?.materialReferenceId ?? options?.materialId ?? "metal",
    rotationYRadians: 0,
    size,
    structureId,
    structureKind: "cover",
    traversalAffordance: "blocker"
  });
  const volumeId = createMapEditorGameplayVolumeId(project);
  const volume = freezeGameplayVolumeDraft({
    center: Object.freeze({
      x: snappedPosition.x,
      y: snappedPosition.y + size.y * 0.5,
      z: snappedPosition.z
    }),
    label: `Cover Volume ${project.gameplayVolumeDrafts.length + 1}`,
    priority: 1,
    rotationYRadians: 0,
    routePoints: Object.freeze([]),
    size,
    tags: Object.freeze(size.y <= mapEditorBuildGridUnitMeters ? ["low", "hard"] : ["high", "hard"]),
    teamId: null,
    volumeId,
    volumeKind: "cover-volume"
  });

  return withSelectedEntity(
    Object.freeze({
      ...project,
      gameplayVolumeDrafts: Object.freeze([
        ...project.gameplayVolumeDrafts,
        volume
      ]),
      structuralDrafts: Object.freeze([
        ...project.structuralDrafts,
        structure
      ])
    }),
    Object.freeze({
      id: structureId,
      kind: "structure"
    })
  );
}

export function addMapEditorTeamZoneDraft(
  project: MapEditorProjectSnapshot,
  startPosition: MetaverseWorldSurfaceVector3Snapshot,
  endPosition: MetaverseWorldSurfaceVector3Snapshot,
  teamId: MapEditorGameplayVolumeDraftSnapshot["teamId"] = "neutral"
): MapEditorProjectSnapshot {
  const rectangle = resolveBuildRectangle(
    startPosition,
    endPosition,
    startPosition.y + 1.5,
    3,
    4,
    4
  );

  return addMapEditorGameplayVolumeDraft(project, {
    center: rectangle.center,
    label: `${teamId ?? "neutral"} Team Zone ${project.gameplayVolumeDrafts.length + 1}`,
    priority: teamId === "neutral" ? 0 : 2,
    size: rectangle.size,
    tags: Object.freeze(["spawn-support", "team-control"]),
    teamId,
    volumeKind: "team-zone"
  });
}

export function addMapEditorSpawnRoomDraft(
  project: MapEditorProjectSnapshot,
  startPosition: MetaverseWorldSurfaceVector3Snapshot,
  endPosition: MetaverseWorldSurfaceVector3Snapshot,
  teamId: MapEditorGameplayVolumeDraftSnapshot["teamId"] = "neutral"
): MapEditorProjectSnapshot {
  const roomProject = addMapEditorSpawnRoomGeometryDraft(project, startPosition, endPosition, {
    elevationMeters: startPosition.y,
    materialId: teamId === "blue" ? "team-blue" : teamId === "red" ? "team-red" : "concrete"
  });
  const rectangle = resolveBuildRectangle(
    startPosition,
    endPosition,
    startPosition.y + 1.5,
    3,
    4,
    4
  );

  return addMapEditorGameplayVolumeDraft(roomProject, {
    center: rectangle.center,
    label: `${teamId ?? "neutral"} Spawn Room ${roomProject.gameplayVolumeDrafts.length + 1}`,
    priority: teamId === "neutral" ? 1 : 3,
    size: rectangle.size,
    tags: Object.freeze(["protected-spawn", "spawn-room"]),
    teamId,
    volumeKind: "spawn-room"
  });
}

export function addMapEditorCombatLaneDraft(
  project: MapEditorProjectSnapshot,
  startPosition: MetaverseWorldSurfaceVector3Snapshot,
  endPosition: MetaverseWorldSurfaceVector3Snapshot,
  widthCells = 3
): MapEditorProjectSnapshot {
  const widthMeters = Math.max(1, widthCells) * mapEditorBuildGridUnitMeters;
  const segment = resolveSegmentDraftShape(
    startPosition,
    endPosition,
    widthMeters,
    3
  );

  if (segment === null) {
    return project;
  }

  return addMapEditorGameplayVolumeDraft(project, {
    center: Object.freeze({
      ...segment.center,
      y: Math.min(startPosition.y, endPosition.y) + 1.5
    }),
    label: `Combat Lane ${project.gameplayVolumeDrafts.length + 1}`,
    priority: 1,
    rotationYRadians: segment.rotationYRadians,
    routePoints: Object.freeze([
      createRoutePoint(segment.start),
      createRoutePoint(segment.end)
    ]),
    size: segment.size,
    tags: Object.freeze(["lane", "combat"]),
    teamId: null,
    volumeKind: "combat-lane"
  });
}

export function addMapEditorVehicleRouteDraft(
  project: MapEditorProjectSnapshot,
  startPosition: MetaverseWorldSurfaceVector3Snapshot,
  endPosition: MetaverseWorldSurfaceVector3Snapshot,
  widthCells = 3
): MapEditorProjectSnapshot {
  const widthMeters = Math.max(1, widthCells) * mapEditorBuildGridUnitMeters;
  const segment = resolveSegmentDraftShape(
    startPosition,
    endPosition,
    widthMeters,
    3
  );

  if (segment === null) {
    return project;
  }

  return addMapEditorGameplayVolumeDraft(project, {
    center: Object.freeze({
      ...segment.center,
      y: Math.min(startPosition.y, endPosition.y) + 1.5
    }),
    label: `Vehicle Route ${project.gameplayVolumeDrafts.length + 1}`,
    priority: 1,
    rotationYRadians: segment.rotationYRadians,
    routePoints: Object.freeze([
      createRoutePoint(segment.start),
      createRoutePoint(segment.end)
    ]),
    size: segment.size,
    tags: Object.freeze(["vehicle", "route"]),
    teamId: null,
    volumeKind: "vehicle-route"
  });
}

export function paintMapEditorEntityMaterial(
  project: MapEditorProjectSnapshot,
  entityRef: MapEditorSelectedEntityRef | null,
  materialId: MapEditorStructuralDraftSnapshot["materialId"],
  materialReferenceId: string = materialId
): MapEditorProjectSnapshot {
  if (entityRef === null) {
    return project;
  }

  switch (entityRef.kind) {
    case "structure":
      return updateMapEditorStructuralDraft(project, entityRef.id, (structure) => ({
        ...structure,
        materialId,
        materialReferenceId
      }));
    case "module":
      return updateMapEditorPlacement(project, entityRef.id, (placement) => ({
        ...placement,
        materialReferenceId
      }));
    case "region":
      return updateMapEditorRegionDraft(project, entityRef.id, (region) => ({
        ...region,
        materialReferenceId
      }));
    default:
      return project;
  }
}

export function applyMapEditorTerrainBrush(
  project: MapEditorProjectSnapshot,
  position: MetaverseWorldSurfaceVector3Snapshot,
  brushMode: MapEditorTerrainBrushMode,
  brushSizeCells: MapEditorTerrainBrushSizeCells,
  smoothEdges: boolean,
  brushStrengthMeters = defaultTerrainBrushHeightDeltaMeters,
  targetHeightMeters = 0,
  materialId: MapEditorStructuralDraftSnapshot["materialId"] = "terrain-grass",
  noiseSeed = 0,
  terrainCliffSpanCells = 2
): MapEditorProjectSnapshot {
  const snappedPosition = snapMapEditorPositionToGrid(position);
  const normalizedBrushSizeCells = normalizeTerrainBrushSizeCells(brushSizeCells);
  let nextProject = project;
  let terrainPatch = findTerrainPatchAtPosition(nextProject, snappedPosition);

  if (terrainPatch === null) {
    return nextProject;
  }

  const targetCell = resolveTerrainCellIndices(terrainPatch, snappedPosition);

  if (targetCell === null) {
    return nextProject;
  }

  const nextHeights = [...terrainPatch.heightSamples];
  const nextMaterialLayers = cloneTerrainMaterialLayersForEditing(terrainPatch);
  let materialLayerIndex = nextMaterialLayers.findIndex(
    (layer) => layer.materialId === materialId
  );

  if (materialLayerIndex < 0) {
    materialLayerIndex = nextMaterialLayers.length;
    nextMaterialLayers.push(
      Object.freeze({
        layerId: `${terrainPatch.terrainPatchId}:${materialId}`,
        materialId,
        weightSamples: Array.from(
          { length: terrainPatch.sampleCountX * terrainPatch.sampleCountZ },
          () => 0
        )
      })
    );
  }

  const brushOffsetX = Math.floor(normalizedBrushSizeCells * 0.5);
  const brushOffsetZ = Math.floor(normalizedBrushSizeCells * 0.5);
  const minCellX = targetCell.cellX - brushOffsetX;
  const minCellZ = targetCell.cellZ - brushOffsetZ;
  const maxCellX = minCellX + normalizedBrushSizeCells - 1;
  const maxCellZ = minCellZ + normalizedBrushSizeCells - 1;

  for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
    if (cellZ < 0 || cellZ >= terrainPatch.sampleCountZ) {
      continue;
    }

    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      if (cellX < 0 || cellX >= terrainPatch.sampleCountX) {
        continue;
      }

      const heightIndex = createTerrainHeightIndex(terrainPatch, cellX, cellZ);
      const currentHeight = nextHeights[heightIndex] ?? 0;
      const cellDistance = Math.max(
        Math.abs(cellX - targetCell.cellX),
        Math.abs(cellZ - targetCell.cellZ)
      );
      const falloffRadius = Math.max(1, normalizedBrushSizeCells - 1);
      const weight =
        smoothEdges === true
          ? Math.max(0.2, 1 - cellDistance / falloffRadius)
          : 1;
      const ridgeWeight =
        1 -
        Math.min(
          1,
          Math.min(
            Math.abs(cellX - targetCell.cellX),
            Math.abs(cellZ - targetCell.cellZ)
          ) / falloffRadius
        );
      const noise =
        Math.sin(
          (cellX + 17) * 12.9898 +
            (cellZ + 31) * 78.233 +
            noiseSeed * 0.143
        ) * 43758.5453;
      const normalizedNoise = noise - Math.floor(noise);
      let nextHeight = currentHeight;

      switch (brushMode) {
        case "flatten":
        case "flatten-pad":
          nextHeight = currentHeight + (targetHeightMeters - currentHeight) * weight;
          break;
        case "cliff":
          nextHeight = resolveTerrainCliffHeight({
            brushStrengthMeters,
            cellX,
            normalizedNoise,
            sampleSpacingMeters: terrainPatch.sampleSpacingMeters,
            targetCellX: targetCell.cellX,
            targetHeightMeters,
            terrainCliffSpanCells
          });
          {
            const activeLayer = nextMaterialLayers[materialLayerIndex];

            if (activeLayer !== undefined) {
              activeLayer.weightSamples[heightIndex] = Math.min(
                1,
                Math.max(activeLayer.weightSamples[heightIndex] ?? 0, weight)
              );
            }
          }
          break;
        case "material": {
          const activeLayer = nextMaterialLayers[materialLayerIndex];

          if (activeLayer !== undefined) {
            activeLayer.weightSamples[heightIndex] = Math.min(
              1,
              Math.max(activeLayer.weightSamples[heightIndex] ?? 0, weight)
            );
          }
          break;
        }
        case "noise":
          nextHeight =
            currentHeight + (normalizedNoise - 0.5) * brushStrengthMeters * weight;
          break;
        case "plateau":
          nextHeight =
            currentHeight + (targetHeightMeters + brushStrengthMeters - currentHeight) * weight;
          break;
        case "raise":
          nextHeight = currentHeight + brushStrengthMeters * weight;
          break;
        case "ridge":
          nextHeight = currentHeight + brushStrengthMeters * Math.max(weight, ridgeWeight);
          break;
        case "lower":
          nextHeight = currentHeight - brushStrengthMeters * weight;
          break;
        case "valley":
          nextHeight = currentHeight - brushStrengthMeters * Math.max(weight, ridgeWeight);
          break;
        case "smooth": {
          let totalHeight = 0;
          let neighborCount = 0;

          for (let neighborZ = cellZ - 1; neighborZ <= cellZ + 1; neighborZ += 1) {
            if (neighborZ < 0 || neighborZ >= terrainPatch.sampleCountZ) {
              continue;
            }

            for (let neighborX = cellX - 1; neighborX <= cellX + 1; neighborX += 1) {
              if (neighborX < 0 || neighborX >= terrainPatch.sampleCountX) {
                continue;
              }

              totalHeight +=
                nextHeights[
                  createTerrainHeightIndex(terrainPatch, neighborX, neighborZ)
                ] ?? 0;
              neighborCount += 1;
            }
          }

          const averageHeight = neighborCount > 0 ? totalHeight / neighborCount : currentHeight;

          nextHeight = currentHeight + (averageHeight - currentHeight) * weight;
          break;
        }
      }

      nextHeights[heightIndex] = Math.round(nextHeight * 100) / 100;
    }
  }

  return withSelectedEntity(
    updateMapEditorTerrainPatchDraft(nextProject, terrainPatch.terrainPatchId, (draft) => ({
      ...draft,
      heightSamples: Object.freeze(nextHeights),
      materialLayers: freezeTerrainMaterialLayers(nextMaterialLayers)
    })),
    Object.freeze({
      id: terrainPatch.terrainPatchId,
      kind: "terrain-patch"
    })
  );
}

export function addMapEditorWallSegment(
  project: MapEditorProjectSnapshot,
  startPosition: MetaverseWorldSurfaceVector3Snapshot,
  endPosition: MetaverseWorldSurfaceVector3Snapshot,
  edgeKind: MapEditorEdgeDraftSnapshot["edgeKind"],
  options?: {
    readonly heightMeters?: number;
    readonly materialReferenceId?: string | null;
    readonly thicknessMeters?: number;
  }
): MapEditorProjectSnapshot {
  const wallSegment = resolveMapEditorBuildWallSegment(
    startPosition,
    endPosition
  );

  if (wallSegment === null) {
    return project;
  }

  const nextDrafts = createMapEditorWallDraftsForSegment(
    project,
    wallSegment.start,
    wallSegment.end,
    edgeKind,
    options?.heightMeters !== undefined || options?.thicknessMeters !== undefined
      ? Object.freeze({
          heightMeters: Math.max(
            0.25,
            options?.heightMeters ?? resolveWallPresetDimensions(edgeKind).heightMeters
          ),
          thicknessMeters: Math.max(
            0.1,
            options?.thicknessMeters ??
              resolveWallPresetDimensions(edgeKind).thicknessMeters
          )
        })
      : undefined,
    options?.materialReferenceId ?? null
  );

  return nextDrafts === null
    ? project
    : withSelectedEntity(
        nextDrafts.project,
        Object.freeze({
          id: nextDrafts.edgeId,
          kind: "edge"
        })
      );
}

export function addMapEditorPathSegment(
  project: MapEditorProjectSnapshot,
  targetPosition: MetaverseWorldSurfaceVector3Snapshot,
  targetElevationMeters: number,
  fromAnchor:
    | {
        readonly center: MetaverseWorldSurfaceVector3Snapshot;
        readonly elevation: number;
      }
    | null,
  pathWidthCells = 1,
  materialId: MapEditorStructuralDraftSnapshot["materialId"] = "warning",
  materialReferenceId: string = materialId
): MapEditorProjectSnapshot {
  if (fromAnchor === null) {
    const { project: nextProject, regionId } = ensurePathSurfaceAndRegion(
      project,
      targetPosition,
      targetElevationMeters,
      pathWidthCells,
      materialId,
      materialReferenceId
    );

    return withSelectedEntity(
      nextProject,
      Object.freeze({
        id: regionId,
        kind: "region"
      })
    );
  }

  const { project: projectWithStartLanding } = ensurePathSurfaceAndRegion(
    project,
    fromAnchor.center,
    fromAnchor.elevation,
    pathWidthCells,
    materialId,
    materialReferenceId,
    {
      snapCenter: false
    }
  );
  const { project: projectWithEndpointLandings } = ensurePathSurfaceAndRegion(
    projectWithStartLanding,
    targetPosition,
    targetElevationMeters,
    pathWidthCells,
    materialId,
    materialReferenceId,
    {
      snapCenter: false
    }
  );
  const deltaX = targetPosition.x - fromAnchor.center.x;
  const deltaZ = targetPosition.z - fromAnchor.center.z;
  const segmentLengthMeters = Math.hypot(deltaX, deltaZ);

  if (segmentLengthMeters <= 0.01) {
    return projectWithEndpointLandings;
  }

  const pathWidthMeters =
    Math.max(1, pathWidthCells) * mapEditorBuildGridUnitMeters;
  const rotationYRadians = Math.atan2(deltaX, deltaZ);
  const riseMeters = targetElevationMeters - fromAnchor.elevation;
  const surfaceSize = Object.freeze({
    x: pathWidthMeters,
    y: 0.25,
    z: Math.max(mapEditorBuildGridUnitMeters, segmentLengthMeters)
  });
  const surfaceCenter = Object.freeze({
    x: (fromAnchor.center.x + targetPosition.x) * 0.5,
    y: (fromAnchor.elevation + targetElevationMeters) * 0.5,
    z: (fromAnchor.center.z + targetPosition.z) * 0.5
  });
  const { project: projectWithSurface, surfaceId } = createSemanticSurfaceForPlacement(
    projectWithEndpointLandings,
    `Path Surface ${projectWithEndpointLandings.surfaceDrafts.length + 1}`,
    surfaceCenter,
    rotationYRadians,
    surfaceSize,
    {
      kind: Math.abs(riseMeters) > 0.01 ? "sloped-plane" : "flat-slab",
      slopeRiseMeters: riseMeters
    }
  );
  const nextRegion = freezeRegionDraft({
    center: surfaceCenter,
    label: `Path ${projectWithSurface.regionDrafts.length + 1}`,
    materialReferenceId,
    outerLoop: createRectangularSurfaceLoop(surfaceSize),
    regionId: createMapEditorRegionId(projectWithSurface),
    regionKind: "path",
    rotationYRadians,
    size: surfaceSize,
    surfaceId
  });

  return withSelectedEntity(
    Object.freeze({
      ...projectWithSurface,
      regionDrafts: Object.freeze([...projectWithSurface.regionDrafts, nextRegion])
    }),
    Object.freeze({
      id: nextRegion.regionId,
      kind: "region"
    })
  );
}

export function addMapEditorPlacementFromAsset(
  project: MapEditorProjectSnapshot,
  asset: EnvironmentAssetDescriptor
): MapEditorProjectSnapshot {
  return addMapEditorPlacementAtPositionFromAsset(
    project,
    asset,
    resolveNewPlacementPosition(project, asset.id)
  );
}

export function addMapEditorPlacementAtPositionFromAsset(
  project: MapEditorProjectSnapshot,
  asset: EnvironmentAssetDescriptor,
  position: MapEditorBuildPlacementPositionSnapshot
): MapEditorProjectSnapshot {
  const snappedPosition = resolveMapEditorBuildAssetPlacementPosition(
    position,
    asset,
    position.y
  );

  if (asset.id === metaverseBuilderFloorTileEnvironmentAssetId) {
    return addMapEditorRegionDraft(project, snappedPosition);
  }

  if (asset.id === metaverseBuilderWallTileEnvironmentAssetId) {
    return addMapEditorEdgeDraft(project, snappedPosition);
  }

  const nextModule = createModuleDraftFromAsset(project, asset, snappedPosition);

  return withSelectedEntity(
    Object.freeze({
      ...project,
      placementDrafts: Object.freeze([...project.placementDrafts, nextModule])
    }),
    Object.freeze({
      id: nextModule.placementId,
      kind: "module"
    })
  );
}

export function updateMapEditorPlayerSpawnDraft(
  project: MapEditorProjectSnapshot,
  spawnId: string,
  update: (
    draft: MapEditorPlayerSpawnDraftSnapshot
  ) => MapEditorPlayerSpawnDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    playerSpawnDrafts: Object.freeze(
      project.playerSpawnDrafts.map((spawnDraft) =>
        spawnDraft.spawnId === spawnId
          ? freezePlayerSpawnDraft(update(spawnDraft))
          : spawnDraft
      )
    )
  });
}

export function updateMapEditorResourceSpawnDraft(
  project: MapEditorProjectSnapshot,
  spawnId: string,
  update: (
    draft: MapEditorResourceSpawnDraftSnapshot
  ) => MapEditorResourceSpawnDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    resourceSpawnDrafts: Object.freeze(
      project.resourceSpawnDrafts.map((resourceSpawnDraft) =>
        resourceSpawnDraft.spawnId === spawnId
          ? freezeResourceSpawnDraft(update(resourceSpawnDraft))
          : resourceSpawnDraft
      )
    )
  });
}

export function updateMapEditorPlayerSpawnSelectionDraft(
  project: MapEditorProjectSnapshot,
  update: (
    draft: MapEditorPlayerSpawnSelectionDraftSnapshot
  ) => MapEditorPlayerSpawnSelectionDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    playerSpawnSelectionDraft: freezePlayerSpawnSelectionDraft(
      update(project.playerSpawnSelectionDraft)
    )
  });
}

export function updateMapEditorSceneObjectDraft(
  project: MapEditorProjectSnapshot,
  objectId: string,
  update: (
    draft: MapEditorSceneObjectDraftSnapshot
  ) => MapEditorSceneObjectDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    sceneObjectDrafts: Object.freeze(
      project.sceneObjectDrafts.map((sceneObjectDraft) =>
        sceneObjectDraft.objectId === objectId
          ? freezeSceneObjectDraft(update(sceneObjectDraft))
          : sceneObjectDraft
      )
    )
  });
}

export function updateMapEditorWaterRegionDraft(
  project: MapEditorProjectSnapshot,
  waterRegionId: string,
  update: (
    draft: MapEditorWaterRegionDraftSnapshot
  ) => MapEditorWaterRegionDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    waterRegionDrafts: Object.freeze(
      project.waterRegionDrafts.map((waterRegionDraft) =>
        waterRegionDraft.waterRegionId === waterRegionId
          ? freezeWaterRegionDraft(update(waterRegionDraft))
          : waterRegionDraft
      )
    )
  });
}

export function updateMapEditorEnvironmentPresentationProfileId(
  project: MapEditorProjectSnapshot,
  environmentPresentationProfileId: string | null
): MapEditorProjectSnapshot {
  const nextEnvironmentPresentation =
    environmentPresentationProfileId === null
      ? project.environmentPresentation
      : createMetaverseEnvironmentPresentationSnapshotFromProfile(
          readMetaverseEnvironmentPresentationProfile(
            environmentPresentationProfileId
          ) ??
            (() => {
              throw new Error(
                `Unknown environment presentation profile: ${environmentPresentationProfileId}`
              );
            })()
        );

  if (
    project.environmentPresentationProfileId ===
      environmentPresentationProfileId &&
    areEnvironmentPresentationsEqual(
      project.environmentPresentation,
      nextEnvironmentPresentation
    )
  ) {
    return project;
  }

  return Object.freeze({
    ...project,
    environmentPresentation: nextEnvironmentPresentation,
    environmentPresentationProfileId
  });
}

export function updateMapEditorEnvironmentPresentation(
  project: MapEditorProjectSnapshot,
  update: (
    environmentPresentation: MetaverseMapBundleEnvironmentPresentationSnapshot
  ) => MetaverseMapBundleEnvironmentPresentationSnapshot
): MapEditorProjectSnapshot {
  const nextEnvironmentPresentation =
    cloneMetaverseEnvironmentPresentationSnapshot(
      update(project.environmentPresentation)
    );

  if (
    areEnvironmentPresentationsEqual(
      nextEnvironmentPresentation,
      project.environmentPresentation
    ) &&
    project.environmentPresentationProfileId === null
  ) {
    return project;
  }

  return Object.freeze({
    ...project,
    environmentPresentation: nextEnvironmentPresentation,
    environmentPresentationProfileId: null
  });
}

export function updateMapEditorGameplayProfileId(
  project: MapEditorProjectSnapshot,
  gameplayProfileId: string
): MapEditorProjectSnapshot {
  if (project.gameplayProfileId === gameplayProfileId) {
    return project;
  }

  return Object.freeze({
    ...project,
    gameplayProfileId
  });
}

export function updateMapEditorLaunchVariationDraft(
  project: MapEditorProjectSnapshot,
  variationId: string,
  update: (
    draft: MapEditorLaunchVariationDraftSnapshot
  ) => MapEditorLaunchVariationDraftSnapshot
): MapEditorProjectSnapshot {
  return Object.freeze({
    ...project,
    launchVariationDrafts: Object.freeze(
      project.launchVariationDrafts.map((launchVariation) =>
        launchVariation.variationId === variationId
          ? freezeLaunchVariationDraft(update(launchVariation))
          : launchVariation
      )
    )
  });
}

function createEdgeSurfaceBaseElevationLookup(
  edges: readonly MapEditorEdgeDraftSnapshot[]
): ReadonlyMap<string, number> {
  const baseElevationBySurfaceId = new Map<string, number>();

  for (const edge of edges) {
    baseElevationBySurfaceId.set(
      edge.surfaceId,
      edge.center.y - edge.heightMeters * 0.5
    );
  }

  return baseElevationBySurfaceId;
}

function normalizeEdgeSurfaceDraftForExport(
  surface: MapEditorSurfaceDraftSnapshot,
  edgeSurfaceBaseElevationBySurfaceId: ReadonlyMap<string, number>
): MapEditorSurfaceDraftSnapshot {
  const edgeBaseElevation =
    edgeSurfaceBaseElevationBySurfaceId.get(surface.surfaceId);

  if (edgeBaseElevation === undefined) {
    return surface;
  }

  return freezeSurfaceDraft({
    ...surface,
    center: Object.freeze({
      ...surface.center,
      y: edgeBaseElevation
    }),
    elevation: edgeBaseElevation
  });
}

export function createSemanticWorldFromProject(
  project: MapEditorProjectSnapshot
) {
  const normalizedProject = syncMapEditorProjectKillFloorDraft(project);
  const edgeSurfaceBaseElevationBySurfaceId =
    createEdgeSurfaceBaseElevationLookup(normalizedProject.edgeDrafts);

  return Object.freeze({
    compatibilityAssetIds: normalizedProject.semanticCompatibilityAssetIds,
    connectors: Object.freeze(
      normalizedProject.connectorDrafts.map(
        createSemanticConnectorSnapshotFromDraft
      )
    ),
    edges: Object.freeze(
      normalizedProject.edgeDrafts.map(createSemanticEdgeSnapshotFromDraft)
    ),
    gameplayVolumes: Object.freeze(
      normalizedProject.gameplayVolumeDrafts.map(
        createSemanticGameplayVolumeSnapshotFromDraft
      )
    ),
    lights: Object.freeze(
      normalizedProject.lightDrafts.map(createSemanticLightSnapshotFromDraft)
    ),
    materialDefinitions: Object.freeze(
      normalizedProject.materialDefinitionDrafts.map(
        createSemanticMaterialDefinitionSnapshotFromDraft
      )
    ),
    modules: Object.freeze(
      normalizedProject.placementDrafts.map((placement) =>
        Object.freeze({
          assetId: placement.assetId,
          collisionEnabled: placement.collisionEnabled,
          collisionPath: placement.collisionPath,
          collider: placement.collider,
          dynamicBody: placement.dynamicBody,
          entries: placement.entries,
          isVisible: placement.isVisible,
          label: placement.assetId,
          materialReferenceId: placement.materialReferenceId,
          moduleId: placement.moduleId,
          notes: placement.notes,
          placementMode: placement.placementMode,
          position: placement.position,
          rotationYRadians: placement.rotationYRadians,
          scale: placement.scale,
          seats: placement.seats,
          surfaceColliders: placement.surfaceColliders,
          traversalAffordance: placement.traversalAffordance
        } satisfies MetaverseMapBundleSemanticModuleSnapshot)
      )
    ),
    regions: Object.freeze(
      normalizedProject.regionDrafts.map(createSemanticRegionSnapshotFromDraft)
    ),
    surfaces: Object.freeze(
      normalizedProject.surfaceDrafts.map((surface) =>
        createSemanticSurfaceSnapshotFromDraft(
          normalizeEdgeSurfaceDraftForExport(
            surface,
            edgeSurfaceBaseElevationBySurfaceId
          )
        )
      )
    ),
    structures: Object.freeze(
      normalizedProject.structuralDrafts.map(
        createSemanticStructureSnapshotFromDraft
      )
    ),
    terrainPatches: Object.freeze(
      normalizedProject.terrainPatchDrafts.map(
        createSemanticTerrainPatchSnapshotFromDraft
      )
    )
  });
}
