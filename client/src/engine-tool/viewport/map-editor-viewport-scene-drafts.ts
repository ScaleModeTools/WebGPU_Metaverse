import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry
} from "three/webgpu";

import type {
  MapEditorPlayerSpawnDraftSnapshot,
  MapEditorResourceSpawnDraftSnapshot,
  MapEditorSceneObjectDraftSnapshot,
  MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import {
  resolveMapEditorWaterRegionCenter,
  resolveMapEditorWaterRegionSize,
  resolveMapEditorWaterRegionTopCenter
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import {
  createPortalMeshRuntime,
  createPortalSharedRenderResources,
  type PortalSharedRenderResources
} from "@/metaverse/render/portals/metaverse-scene-portals";
import { createDefaultMetaverseSceneAssetLoader } from "@/metaverse/render/metaverse-scene-asset-loader";
import {
  cloneMetaverseResourceSpawnModel,
  loadMetaverseResourceSpawnModel,
  resolveMetaverseResourceSpawnAssetKey,
  resolveMetaverseResourceSpawnAttachmentModelPath,
  type LoadedMetaverseResourceSpawnModel
} from "@/metaverse/render/resources/metaverse-resource-spawn-models";
import type { MetaverseSceneAssetLoader } from "@/metaverse/render/characters/metaverse-scene-interactive-presentation-state";

interface SceneDraftMeshUserData {
  mapEditorOwnsGeometry?: boolean;
  mapEditorOwnsMaterial?: boolean;
  playerSpawnId?: string;
  resourceSpawnId?: string;
  sceneObjectId?: string;
  waterRegionId?: string;
}

export class MapEditorResourceSpawnPreviewLibrary {
  readonly #createSceneAssetLoader: () => MetaverseSceneAssetLoader;
  readonly #loadedModelsByAssetKey = new Map<
    string,
    Promise<LoadedMetaverseResourceSpawnModel | null>
  >();

  constructor(
    createSceneAssetLoader: () => MetaverseSceneAssetLoader =
      createDefaultMetaverseSceneAssetLoader
  ) {
    this.#createSceneAssetLoader = createSceneAssetLoader;
  }

  attachResourceSpawnModel(
    resourceSpawnDraft: MapEditorResourceSpawnDraftSnapshot,
    resourceSpawnGroup: Group,
    isCurrentGroup: () => boolean
  ): void {
    const assetKey = resolveMetaverseResourceSpawnAssetKey(resourceSpawnDraft);

    if (resolveMetaverseResourceSpawnAttachmentModelPath(assetKey) === null) {
      return;
    }

    void this.#loadModel(assetKey).then((loadedModel) => {
      if (loadedModel === null || !isCurrentGroup()) {
        return;
      }

      const modelGroup = cloneMetaverseResourceSpawnModel(loadedModel);

      tagResourceSpawnNodes(modelGroup, resourceSpawnDraft.spawnId);
      resourceSpawnGroup.add(modelGroup);
    });
  }

  #loadModel(
    assetKey: string
  ): Promise<LoadedMetaverseResourceSpawnModel | null> {
    const cachedModel = this.#loadedModelsByAssetKey.get(assetKey);

    if (cachedModel !== undefined) {
      return cachedModel;
    }

    const modelPromise = loadMetaverseResourceSpawnModel(
      assetKey,
      this.#createSceneAssetLoader
    ).catch(() => null);

    this.#loadedModelsByAssetKey.set(assetKey, modelPromise);

    return modelPromise;
  }
}

function tagResourceSpawnNodes(group: Group, resourceSpawnId: string): void {
  group.traverse((node) => {
    const userData = node.userData as SceneDraftMeshUserData;

    userData.resourceSpawnId = resourceSpawnId;
  });
}

function disposeOwnedMesh(mesh: Mesh): void {
  const userData = mesh.userData as SceneDraftMeshUserData;

  if (userData.mapEditorOwnsGeometry === true) {
    mesh.geometry.dispose();
  }

  if (userData.mapEditorOwnsMaterial === true) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const material of materials) {
      material.dispose();
    }
  }
}

function disposePortalMaterials(
  mesh: Mesh,
  sharedRenderResources: PortalSharedRenderResources
): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  for (const material of materials) {
    if (material === sharedRenderResources.supportMaterial) {
      continue;
    }

    material.dispose();
  }
}

function disposeOwnedGroup(
  group: Group,
  sharedRenderResources?: PortalSharedRenderResources
): void {
  group.traverse((node) => {
    if ("isMesh" in node && node.isMesh === true) {
      const mesh = node as Mesh;

      if (
        sharedRenderResources !== undefined &&
        mesh.name.startsWith("metaverse_portal/")
      ) {
        disposePortalMaterials(mesh, sharedRenderResources);
        return;
      }

      disposeOwnedMesh(mesh);
    }
  });
}

function disposePortalSharedRenderResources(
  sharedRenderResources: PortalSharedRenderResources
): void {
  sharedRenderResources.baseGeometry.dispose();
  sharedRenderResources.beamGeometry.dispose();
  sharedRenderResources.beaconGeometry.dispose();
  sharedRenderResources.innerHaloGeometry.dispose();
  sharedRenderResources.ringGeometry.dispose();
  sharedRenderResources.supportMaterial.dispose();
}

function createOwnedMesh(
  geometry: BoxGeometry | ConeGeometry | CylinderGeometry | PlaneGeometry,
  material: MeshStandardMaterial
): Mesh {
  const mesh = new Mesh(geometry, material);
  const userData = mesh.userData as SceneDraftMeshUserData;

  userData.mapEditorOwnsGeometry = true;
  userData.mapEditorOwnsMaterial = true;

  return mesh;
}

function createSpawnDraftGroup(
  spawnDraft: MapEditorPlayerSpawnDraftSnapshot
): Group {
  const root = new Group();
  const userData = root.userData as SceneDraftMeshUserData;
  const base = createOwnedMesh(
    new CylinderGeometry(0.65, 0.8, 0.18, 16),
    new MeshStandardMaterial({
      color: "#84cc16",
      emissive: "#203204",
      roughness: 0.78
    })
  );
  const arrow = createOwnedMesh(
    new ConeGeometry(0.42, 1.1, 16),
    new MeshStandardMaterial({
      color: "#d9f99d",
      emissive: "#365314",
      roughness: 0.42
    })
  );

  root.name = `map_editor_spawn/${spawnDraft.spawnId}`;
  userData.playerSpawnId = spawnDraft.spawnId;
  base.position.y = 0.09;
  arrow.position.set(0, 1.05, 0);
  arrow.rotation.z = Math.PI;
  root.add(base, arrow);
  root.position.set(
    spawnDraft.position.x,
    spawnDraft.position.y,
    spawnDraft.position.z
  );
  root.rotation.y = spawnDraft.yawRadians;

  return root;
}

function createResourceSpawnDraftGroup(
  resourceSpawnDraft: MapEditorResourceSpawnDraftSnapshot
): Group {
  const root = new Group();
  const userData = root.userData as SceneDraftMeshUserData;
  const base = createOwnedMesh(
    new CylinderGeometry(
      resourceSpawnDraft.pickupRadiusMeters,
      resourceSpawnDraft.pickupRadiusMeters,
      0.08,
      32
    ),
    new MeshStandardMaterial({
      color: "#38bdf8",
      emissive: "#075985",
      opacity: 0.22,
      roughness: 0.65,
      transparent: true
    })
  );

  root.name = `map_editor_resource_spawn/${resourceSpawnDraft.spawnId}`;
  userData.resourceSpawnId = resourceSpawnDraft.spawnId;
  base.position.y = 0.04;
  root.add(base);
  root.position.set(
    resourceSpawnDraft.position.x,
    resourceSpawnDraft.position.y,
    resourceSpawnDraft.position.z
  );
  root.rotation.y = resourceSpawnDraft.yawRadians;

  return root;
}

function createSceneObjectDraftGroup(
  sceneObjectDraft: MapEditorSceneObjectDraftSnapshot,
  sharedRenderResources: PortalSharedRenderResources
): Group | null {
  const launchTarget = sceneObjectDraft.launchTarget;

  if (launchTarget === null) {
    return null;
  }

  const portalGroup = createPortalMeshRuntime(
    {
      beamColor: new Color(launchTarget.beamColorHex).toArray().slice(0, 3) as [
        number,
        number,
        number
      ],
      experienceId: launchTarget.experienceId,
      highlightRadius: launchTarget.highlightRadius,
      interactionRadius: launchTarget.interactionRadius,
      label: sceneObjectDraft.label,
      position: sceneObjectDraft.position,
      ringColor: new Color(launchTarget.ringColorHex).toArray().slice(0, 3) as [
        number,
        number,
        number
      ]
    },
    sharedRenderResources
  ).anchorGroup;
  const userData = portalGroup.userData as SceneDraftMeshUserData;

  portalGroup.name = `map_editor_scene_object/${sceneObjectDraft.objectId}`;
  userData.sceneObjectId = sceneObjectDraft.objectId;
  portalGroup.rotation.y = sceneObjectDraft.rotationYRadians;
  portalGroup.scale.setScalar(sceneObjectDraft.scale);

  return portalGroup;
}

function createWaterRegionDraftGroup(
  waterRegionDraft: MapEditorWaterRegionDraftSnapshot
): Group {
  const root = new Group();
  const userData = root.userData as SceneDraftMeshUserData;
  const size = resolveMapEditorWaterRegionSize(waterRegionDraft);
  const center = resolveMapEditorWaterRegionCenter(waterRegionDraft);
  const topCenter = resolveMapEditorWaterRegionTopCenter(waterRegionDraft);
  const volume = createOwnedMesh(
    new BoxGeometry(size.x, size.y, size.z),
    new MeshStandardMaterial({
      color: waterRegionDraft.previewColorHex,
      emissive: waterRegionDraft.previewColorHex,
      emissiveIntensity: 0.08,
      opacity: waterRegionDraft.previewOpacity,
      side: DoubleSide,
      roughness: 0.18,
      transparent: true
    })
  );
  const outline = createOwnedMesh(
    new PlaneGeometry(size.x, size.z),
    new MeshStandardMaterial({
      color: "#d5f3ff",
      emissive: "#b3ecff",
      emissiveIntensity: 0.24,
      opacity: 0.1,
      roughness: 0.5,
      side: DoubleSide,
      transparent: true
    })
  );

  root.name = `map_editor_water/${waterRegionDraft.waterRegionId}`;
  userData.waterRegionId = waterRegionDraft.waterRegionId;
  volume.position.y = 0;
  outline.rotation.x = -Math.PI / 2;
  outline.position.y = size.y * 0.5 + 0.02;
  root.add(volume, outline);
  root.position.set(center.x, center.y, center.z);
  outline.position.set(0, topCenter.y - center.y + 0.02, 0);

  return root;
}

export interface MapEditorViewportSceneDraftHandles {
  readonly sceneObjectGroupsById: Map<string, Group>;
  readonly playerSpawnGroupsById: Map<string, Group>;
  readonly portalSharedRenderResources: PortalSharedRenderResources;
  readonly resourceSpawnPreviewLibrary: MapEditorResourceSpawnPreviewLibrary;
  readonly resourceSpawnGroupsById: Map<string, Group>;
  readonly rootGroup: Group;
  readonly waterRegionGroupsById: Map<string, Group>;
}

export function createMapEditorViewportSceneDraftHandles(): MapEditorViewportSceneDraftHandles {
  return Object.freeze({
    sceneObjectGroupsById: new Map<string, Group>(),
    playerSpawnGroupsById: new Map<string, Group>(),
    portalSharedRenderResources: createPortalSharedRenderResources(),
    resourceSpawnPreviewLibrary: new MapEditorResourceSpawnPreviewLibrary(),
    resourceSpawnGroupsById: new Map<string, Group>(),
    rootGroup: new Group(),
    waterRegionGroupsById: new Map<string, Group>()
  });
}

export function disposeMapEditorViewportSceneDraftHandles(
  handles: MapEditorViewportSceneDraftHandles
): void {
  disposeOwnedGroup(handles.rootGroup, handles.portalSharedRenderResources);
  disposePortalSharedRenderResources(handles.portalSharedRenderResources);
}

export function syncMapEditorViewportSceneDrafts(
  handles: MapEditorViewportSceneDraftHandles,
  drafts: {
    readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
    readonly resourceSpawnDrafts?: readonly MapEditorResourceSpawnDraftSnapshot[];
    readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
    readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
  }
): void {
  disposeOwnedGroup(handles.rootGroup, handles.portalSharedRenderResources);
  handles.rootGroup.clear();
  handles.playerSpawnGroupsById.clear();
  handles.resourceSpawnGroupsById.clear();
  handles.sceneObjectGroupsById.clear();
  handles.waterRegionGroupsById.clear();

  for (const spawnDraft of drafts.playerSpawnDrafts) {
    const spawnGroup = createSpawnDraftGroup(spawnDraft);

    handles.playerSpawnGroupsById.set(spawnDraft.spawnId, spawnGroup);
    handles.rootGroup.add(spawnGroup);
  }

  for (const resourceSpawnDraft of drafts.resourceSpawnDrafts ?? []) {
    const resourceSpawnGroup = createResourceSpawnDraftGroup(resourceSpawnDraft);

    handles.resourceSpawnGroupsById.set(
      resourceSpawnDraft.spawnId,
      resourceSpawnGroup
    );
    handles.rootGroup.add(resourceSpawnGroup);
    handles.resourceSpawnPreviewLibrary.attachResourceSpawnModel(
      resourceSpawnDraft,
      resourceSpawnGroup,
      () =>
        handles.resourceSpawnGroupsById.get(resourceSpawnDraft.spawnId) ===
        resourceSpawnGroup
    );
  }

  for (const sceneObjectDraft of drafts.sceneObjectDrafts) {
    const sceneObjectGroup = createSceneObjectDraftGroup(
      sceneObjectDraft,
      handles.portalSharedRenderResources
    );

    if (sceneObjectGroup !== null) {
      handles.sceneObjectGroupsById.set(sceneObjectDraft.objectId, sceneObjectGroup);
      handles.rootGroup.add(sceneObjectGroup);
    }
  }

  for (const waterRegionDraft of drafts.waterRegionDrafts) {
    const waterRegionGroup = createWaterRegionDraftGroup(waterRegionDraft);

    handles.waterRegionGroupsById.set(
      waterRegionDraft.waterRegionId,
      waterRegionGroup
    );
    handles.rootGroup.add(waterRegionGroup);
  }
}
