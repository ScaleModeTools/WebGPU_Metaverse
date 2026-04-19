import {
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
  MapEditorSceneObjectDraftSnapshot,
  MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import {
  createPortalMeshRuntime,
  createPortalSharedRenderResources,
  type PortalSharedRenderResources
} from "@/metaverse/render/portals/metaverse-scene-portals";

interface SceneDraftMeshUserData {
  mapEditorOwnsGeometry?: boolean;
  mapEditorOwnsMaterial?: boolean;
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
  geometry: ConeGeometry | CylinderGeometry | PlaneGeometry,
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

function createSceneObjectDraftGroup(
  sceneObjectDraft: MapEditorSceneObjectDraftSnapshot,
  sharedRenderResources: PortalSharedRenderResources
): Group | null {
  const launchTarget = sceneObjectDraft.launchTarget;

  if (launchTarget === null) {
    return null;
  }

  return createPortalMeshRuntime(
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
}

function createWaterRegionDraftGroup(
  waterRegionDraft: MapEditorWaterRegionDraftSnapshot
): Group {
  const root = new Group();
  const floor = createOwnedMesh(
    new PlaneGeometry(waterRegionDraft.size.x, waterRegionDraft.size.z),
    new MeshStandardMaterial({
      color: waterRegionDraft.previewColorHex,
      emissive: waterRegionDraft.previewColorHex,
      emissiveIntensity: 0.08,
      opacity: waterRegionDraft.previewOpacity,
      roughness: 0.18,
      side: DoubleSide,
      transparent: true
    })
  );
  const outline = createOwnedMesh(
    new PlaneGeometry(waterRegionDraft.size.x, waterRegionDraft.size.z),
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
  floor.rotation.x = -Math.PI / 2;
  outline.rotation.x = -Math.PI / 2;
  outline.position.y = 0.02;
  root.add(floor, outline);
  root.position.set(
    waterRegionDraft.center.x,
    waterRegionDraft.center.y,
    waterRegionDraft.center.z
  );
  root.rotation.y = waterRegionDraft.rotationYRadians;

  return root;
}

export interface MapEditorViewportSceneDraftHandles {
  readonly portalSharedRenderResources: PortalSharedRenderResources;
  readonly rootGroup: Group;
}

export function createMapEditorViewportSceneDraftHandles(): MapEditorViewportSceneDraftHandles {
  return Object.freeze({
    portalSharedRenderResources: createPortalSharedRenderResources(),
    rootGroup: new Group()
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
    readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
    readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
  }
): void {
  disposeOwnedGroup(handles.rootGroup, handles.portalSharedRenderResources);
  handles.rootGroup.clear();

  for (const spawnDraft of drafts.playerSpawnDrafts) {
    handles.rootGroup.add(createSpawnDraftGroup(spawnDraft));
  }

  for (const sceneObjectDraft of drafts.sceneObjectDrafts) {
    const sceneObjectGroup = createSceneObjectDraftGroup(
      sceneObjectDraft,
      handles.portalSharedRenderResources
    );

    if (sceneObjectGroup !== null) {
      handles.rootGroup.add(sceneObjectGroup);
    }
  }

  for (const waterRegionDraft of drafts.waterRegionDrafts) {
    handles.rootGroup.add(createWaterRegionDraftGroup(waterRegionDraft));
  }
}
