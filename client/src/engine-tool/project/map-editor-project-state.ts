import type { EnvironmentAssetDescriptor } from "@/assets/types/environment-asset-manifest";
import type { MapEditorBuildPlacementPositionSnapshot } from "@/engine-tool/build/map-editor-build-placement";
import { readMapEditorBuildPrimitiveCatalogEntry } from "@/engine-tool/build/map-editor-build-primitives";
import {
  createLaunchVariationDrafts,
  freezeLaunchVariationDraft,
  type MapEditorLaunchVariationDraftSnapshot
} from "@/engine-tool/project/map-editor-project-launch-variations";
import {
  createPlayerSpawnDrafts,
  createSceneObjectDrafts,
  createWaterRegionDrafts,
  freezePlayerSpawnDraft,
  freezeSceneObjectDraft,
  freezeWaterRegionDraft,
  type MapEditorPlayerSpawnDraftSnapshot,
  type MapEditorSceneObjectDraftSnapshot,
  type MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import type { LoadedMetaverseMapBundleSnapshot } from "@/metaverse/world/map-bundles";
import {
  resolveMetaverseWorldSurfaceScaleVector,
  type MetaverseWorldSurfaceScaleSnapshot,
  type MetaverseWorldSurfaceVector3Snapshot
} from "@webgpu-metaverse/shared/metaverse/world";

export interface MapEditorPlacementDraftSnapshot {
  readonly assetId: string;
  readonly colliderCount: number;
  readonly collisionEnabled: boolean;
  readonly isVisible: boolean;
  readonly materialReferenceId: string | null;
  readonly notes: string;
  readonly placementId: string;
  readonly placementMode: string;
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly rotationYRadians: number;
  readonly scale: MetaverseWorldSurfaceVector3Snapshot;
}

export interface MapEditorProjectSnapshot {
  readonly bundleId: string;
  readonly bundleLabel: string;
  readonly cameraProfileId: string | null;
  readonly characterPresentationProfileId: string | null;
  readonly description: string;
  readonly environmentPresentationProfileId: string | null;
  readonly gameplayProfileId: string;
  readonly hudProfileId: string | null;
  readonly launchVariationDrafts: readonly MapEditorLaunchVariationDraftSnapshot[];
  readonly placementDrafts: readonly MapEditorPlacementDraftSnapshot[];
  readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
  readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
  readonly selectedLaunchVariationId: string | null;
  readonly selectedPlacementId: string | null;
  readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
}

function createMapEditorSceneDraftPosition(
  project: MapEditorProjectSnapshot,
  offset: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }
): MapEditorBuildPlacementPositionSnapshot {
  const selectedPlacement = readSelectedMapEditorPlacement(project);

  if (selectedPlacement !== null) {
    return Object.freeze({
      x: selectedPlacement.position.x + offset.x,
      y: selectedPlacement.position.y + offset.y,
      z: selectedPlacement.position.z + offset.z
    });
  }

  const lastPlayerSpawn = project.playerSpawnDrafts[project.playerSpawnDrafts.length - 1] ?? null;

  if (lastPlayerSpawn !== null) {
    return Object.freeze({
      x: lastPlayerSpawn.position.x + offset.x,
      y: lastPlayerSpawn.position.y + offset.y,
      z: lastPlayerSpawn.position.z + offset.z
    });
  }

  const lastPlacement = project.placementDrafts[project.placementDrafts.length - 1] ?? null;

  if (lastPlacement !== null) {
    return Object.freeze({
      x: lastPlacement.position.x + offset.x,
      y: lastPlacement.position.y + offset.y,
      z: lastPlacement.position.z + offset.z
    });
  }

  return Object.freeze({
    x: offset.x,
    y: offset.y,
    z: offset.z
  });
}

function freezePlacementDraft(
  draft: MapEditorPlacementDraftSnapshot
): MapEditorPlacementDraftSnapshot {
  const scaleVector = freezePlacementScale(draft.scale);

  return Object.freeze({
    ...draft,
    position: Object.freeze({
      x: draft.position.x,
      y: draft.position.y,
      z: draft.position.z
    }),
    scale: Object.freeze({
      x: scaleVector.x,
      y: scaleVector.y,
      z: scaleVector.z
    })
  });
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

function createMapEditorPlacementId(
  project: MapEditorProjectSnapshot,
  assetId: string
): string {
  const placementIdPrefix = `${assetId}:placement:`;
  let nextPlacementNumber = 1;

  for (const placement of project.placementDrafts) {
    if (!placement.placementId.startsWith(placementIdPrefix)) {
      continue;
    }

    const numericSuffix = Number(
      placement.placementId.slice(placementIdPrefix.length)
    );

    if (Number.isFinite(numericSuffix)) {
      nextPlacementNumber = Math.max(nextPlacementNumber, numericSuffix + 1);
    }
  }

  return `${placementIdPrefix}${nextPlacementNumber}`;
}

function createMapEditorLaunchVariationId(
  project: MapEditorProjectSnapshot
): string {
  const variationIdPrefix = `${project.bundleId}:variation:`;
  let nextVariationNumber = 1;

  for (const launchVariation of project.launchVariationDrafts) {
    if (!launchVariation.variationId.startsWith(variationIdPrefix)) {
      continue;
    }

    const numericSuffix = Number(
      launchVariation.variationId.slice(variationIdPrefix.length)
    );

    if (Number.isFinite(numericSuffix)) {
      nextVariationNumber = Math.max(nextVariationNumber, numericSuffix + 1);
    }
  }

  return `${variationIdPrefix}${nextVariationNumber}`;
}

function createMapEditorPlayerSpawnId(project: MapEditorProjectSnapshot): string {
  const spawnIdPrefix = `${project.bundleId}:spawn:`;
  let nextSpawnNumber = 1;

  for (const spawnDraft of project.playerSpawnDrafts) {
    if (!spawnDraft.spawnId.startsWith(spawnIdPrefix)) {
      continue;
    }

    const numericSuffix = Number(spawnDraft.spawnId.slice(spawnIdPrefix.length));

    if (Number.isFinite(numericSuffix)) {
      nextSpawnNumber = Math.max(nextSpawnNumber, numericSuffix + 1);
    }
  }

  return `${spawnIdPrefix}${nextSpawnNumber}`;
}

function createMapEditorSceneObjectId(project: MapEditorProjectSnapshot): string {
  const objectIdPrefix = `${project.bundleId}:scene-object:`;
  let nextObjectNumber = 1;

  for (const sceneObjectDraft of project.sceneObjectDrafts) {
    if (!sceneObjectDraft.objectId.startsWith(objectIdPrefix)) {
      continue;
    }

    const numericSuffix = Number(
      sceneObjectDraft.objectId.slice(objectIdPrefix.length)
    );

    if (Number.isFinite(numericSuffix)) {
      nextObjectNumber = Math.max(nextObjectNumber, numericSuffix + 1);
    }
  }

  return `${objectIdPrefix}${nextObjectNumber}`;
}

function createMapEditorWaterRegionId(project: MapEditorProjectSnapshot): string {
  const waterRegionIdPrefix = `${project.bundleId}:water-region:`;
  let nextWaterRegionNumber = 1;

  for (const waterRegionDraft of project.waterRegionDrafts) {
    if (!waterRegionDraft.waterRegionId.startsWith(waterRegionIdPrefix)) {
      continue;
    }

    const numericSuffix = Number(
      waterRegionDraft.waterRegionId.slice(waterRegionIdPrefix.length)
    );

    if (Number.isFinite(numericSuffix)) {
      nextWaterRegionNumber = Math.max(nextWaterRegionNumber, numericSuffix + 1);
    }
  }

  return `${waterRegionIdPrefix}${nextWaterRegionNumber}`;
}

function resolveNewPlacementPosition(
  project: MapEditorProjectSnapshot,
  assetId: string
): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  const existingPlacementsForAsset = project.placementDrafts.filter(
    (placement) => placement.assetId === assetId
  );
  const buildPrimitiveCatalogEntry = readMapEditorBuildPrimitiveCatalogEntry(assetId);
  const lastPlacementForAsset =
    existingPlacementsForAsset[existingPlacementsForAsset.length - 1] ?? null;

  if (buildPrimitiveCatalogEntry !== null) {
    const selectedPlacement =
      project.selectedPlacementId === null
        ? null
        : (project.placementDrafts.find(
            (placement) => placement.placementId === project.selectedPlacementId
          ) ?? null);
    const selectedPrimitiveCatalogEntry =
      selectedPlacement === null
        ? null
        : readMapEditorBuildPrimitiveCatalogEntry(selectedPlacement.assetId);
    const placementAnchor =
      selectedPlacement ?? lastPlacementForAsset ?? null;

    if (placementAnchor !== null) {
      const horizontalFootprint = Math.max(
        buildPrimitiveCatalogEntry.footprint.x,
        selectedPrimitiveCatalogEntry?.footprint.x ??
          buildPrimitiveCatalogEntry.footprint.x
      );

      return Object.freeze({
        x: placementAnchor.position.x + horizontalFootprint,
        y: placementAnchor.position.y,
        z: placementAnchor.position.z
      });
    }
  }

  if (lastPlacementForAsset !== null) {
    return Object.freeze({
      x: lastPlacementForAsset.position.x + 4,
      y: lastPlacementForAsset.position.y,
      z: lastPlacementForAsset.position.z
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

export function createMapEditorProject(
  loadedBundle: LoadedMetaverseMapBundleSnapshot
): MapEditorProjectSnapshot {
  const placementDrafts = Object.freeze(
    loadedBundle.bundle.environmentAssets.flatMap((asset) =>
      asset.placements.map((placement) =>
        freezePlacementDraft({
          assetId: asset.assetId,
          colliderCount: asset.surfaceColliders.length,
          collisionEnabled: placement.collisionEnabled,
          isVisible: placement.isVisible,
          materialReferenceId: placement.materialReferenceId,
          notes: placement.notes,
          placementId: placement.placementId,
          placementMode: asset.placementMode,
          position: placement.position,
          rotationYRadians: placement.rotationYRadians,
          scale: freezePlacementScale(placement.scale)
        })
      )
    )
  );
  const selectedPlacementId = placementDrafts[0]?.placementId ?? null;
  const launchVariationDrafts = createLaunchVariationDrafts(loadedBundle);
  const selectedLaunchVariationId =
    launchVariationDrafts[0]?.variationId ?? null;

  return Object.freeze({
    bundleId: loadedBundle.bundle.mapId,
    bundleLabel: loadedBundle.bundle.label,
    cameraProfileId: loadedBundle.cameraProfile?.id ?? null,
    characterPresentationProfileId:
      loadedBundle.characterPresentationProfile?.id ?? null,
    description: loadedBundle.bundle.description,
    environmentPresentationProfileId:
      loadedBundle.environmentPresentationProfile?.id ?? null,
    gameplayProfileId: loadedBundle.gameplayProfile.id,
    hudProfileId: loadedBundle.hudProfile?.id ?? null,
    launchVariationDrafts,
    placementDrafts,
    playerSpawnDrafts: createPlayerSpawnDrafts(loadedBundle),
    sceneObjectDrafts: createSceneObjectDrafts(loadedBundle),
    selectedLaunchVariationId,
    selectedPlacementId,
    waterRegionDrafts: createWaterRegionDrafts(loadedBundle)
  });
}

export function readSelectedMapEditorLaunchVariation(
  project: MapEditorProjectSnapshot
): MapEditorLaunchVariationDraftSnapshot | null {
  if (project.selectedLaunchVariationId === null) {
    return null;
  }

  return (
    project.launchVariationDrafts.find(
      (launchVariation) =>
        launchVariation.variationId === project.selectedLaunchVariationId
    ) ?? null
  );
}

export function readSelectedMapEditorPlacement(
  project: MapEditorProjectSnapshot
): MapEditorPlacementDraftSnapshot | null {
  if (project.selectedPlacementId === null) {
    return null;
  }

  return (
    project.placementDrafts.find(
      (placement) => placement.placementId === project.selectedPlacementId
    ) ?? null
  );
}

export function selectMapEditorPlacement(
  project: MapEditorProjectSnapshot,
  placementId: string
): MapEditorProjectSnapshot {
  if (
    !project.placementDrafts.some(
      (placement) => placement.placementId === placementId
    )
  ) {
    return project;
  }

  return Object.freeze({
    ...project,
    selectedPlacementId: placementId
  });
}

export function selectMapEditorLaunchVariation(
  project: MapEditorProjectSnapshot,
  variationId: string
): MapEditorProjectSnapshot {
  if (
    !project.launchVariationDrafts.some(
      (launchVariation) => launchVariation.variationId === variationId
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

export function addMapEditorLaunchVariationDraft(
  project: MapEditorProjectSnapshot
): MapEditorProjectSnapshot {
  const nextVariation = freezeLaunchVariationDraft({
    description: "",
    experienceId: null,
    gameplayVariationId: null,
    label: "New Variation",
    sessionMode: null,
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
  project: MapEditorProjectSnapshot
): MapEditorProjectSnapshot {
  const nextPosition = createMapEditorSceneDraftPosition(project, {
    x: 4,
    y: 0,
    z: 0
  });
  const nextSpawnNumber = project.playerSpawnDrafts.length + 1;
  const nextSpawn = freezePlayerSpawnDraft({
    label: `Player Spawn ${nextSpawnNumber}`,
    position: nextPosition,
    spawnId: createMapEditorPlayerSpawnId(project),
    yawRadians: 0
  });

  return Object.freeze({
    ...project,
    playerSpawnDrafts: Object.freeze([...project.playerSpawnDrafts, nextSpawn])
  });
}

export function addMapEditorSceneObjectDraft(
  project: MapEditorProjectSnapshot
): MapEditorProjectSnapshot {
  const nextPosition = createMapEditorSceneDraftPosition(project, {
    x: 0,
    y: 6,
    z: -12
  });
  const nextSceneObjectNumber = project.sceneObjectDrafts.length + 1;
  const nextSceneObject = freezeSceneObjectDraft({
    assetId: null,
    label: `Launch Object ${nextSceneObjectNumber}`,
    launchTarget: Object.freeze({
      beamColorHex: "#f4ba2b",
      experienceId: "duck-hunt",
      highlightRadius: 22,
      interactionRadius: 10,
      ringColorHex: "#f6d06a"
    }),
    objectId: createMapEditorSceneObjectId(project),
    position: nextPosition,
    rotationYRadians: 0,
    scale: 1
  });

  return Object.freeze({
    ...project,
    sceneObjectDrafts: Object.freeze([
      ...project.sceneObjectDrafts,
      nextSceneObject
    ])
  });
}

export function addMapEditorWaterRegionDraft(
  project: MapEditorProjectSnapshot
): MapEditorProjectSnapshot {
  const nextCenter = createMapEditorSceneDraftPosition(project, {
    x: 0,
    y: 0,
    z: 0
  });
  const previewColorHex =
    project.waterRegionDrafts[project.waterRegionDrafts.length - 1]?.previewColorHex ??
    "#2f7f9c";
  const nextWaterRegion = freezeWaterRegionDraft({
    center: nextCenter,
    previewColorHex,
    previewOpacity: 0.58,
    rotationYRadians: 0,
    size: Object.freeze({
      x: 24,
      y: 4,
      z: 24
    }),
    waterRegionId: createMapEditorWaterRegionId(project)
  });

  return Object.freeze({
    ...project,
    waterRegionDrafts: Object.freeze([
      ...project.waterRegionDrafts,
      nextWaterRegion
    ])
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
  const nextPlacementId = createMapEditorPlacementId(project, asset.id);
  const nextPlacement = freezePlacementDraft({
    assetId: asset.id,
    colliderCount: asset.physicsColliders?.length ?? 0,
    collisionEnabled: true,
    isVisible: true,
    materialReferenceId: null,
    notes: "",
    placementId: nextPlacementId,
    placementMode: asset.placement,
    position,
    rotationYRadians: 0,
    scale: freezePlacementScale(1)
  });

  return Object.freeze({
    ...project,
    placementDrafts: Object.freeze([...project.placementDrafts, nextPlacement]),
    selectedPlacementId: nextPlacement.placementId
  });
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
  if (
    project.environmentPresentationProfileId ===
    environmentPresentationProfileId
  ) {
    return project;
  }

  return Object.freeze({
    ...project,
    environmentPresentationProfileId
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
