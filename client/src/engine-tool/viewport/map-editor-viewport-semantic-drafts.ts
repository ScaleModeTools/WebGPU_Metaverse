import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  SpotLight
} from "three/webgpu";
import { createMetaverseMapBundleSemanticRegionSurfaceMesh } from "@webgpu-metaverse/shared/metaverse/world";

import { mapEditorBuildGridUnitMeters } from "@/engine-tool/build/map-editor-build-placement";
import type {
  MapEditorConnectorDraftSnapshot,
  MapEditorEdgeDraftSnapshot,
  MapEditorGameplayVolumeDraftSnapshot,
  MapEditorLightDraftSnapshot,
  MapEditorMaterialDefinitionDraftSnapshot,
  MapEditorRegionDraftSnapshot,
  MapEditorStructuralDraftSnapshot,
  MapEditorSurfaceDraftSnapshot,
  MapEditorTerrainPatchDraftSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import {
  createMetaverseSceneTerrainPatchPreviewTexture,
  resolveMetaverseSceneSemanticMaterialProfile,
  resolveMetaverseSceneSurfacePreviewTextureId,
  type MetaverseSceneSemanticPreviewTextureId
} from "@/metaverse/render/environment/metaverse-scene-semantic-material-textures";
import {
  createMetaverseSceneSemanticRenderMaterial,
  resolveMetaverseSceneSemanticMaterialDefinition
} from "@/metaverse/render/environment/metaverse-scene-semantic-materials";
import {
  createMetaverseSceneTerrainPatchGeometry
} from "@/metaverse/render/environment/metaverse-scene-terrain-patch-geometry";

interface SemanticDraftMeshUserData {
  connectorId?: string;
  edgeId?: string;
  gameplayVolumeId?: string;
  lightId?: string;
  mapEditorOwnsGeometry?: boolean;
  mapEditorOwnsMaterial?: boolean;
  regionId?: string;
  structureId?: string;
  surfaceId?: string;
  terrainPatchId?: string;
}

type MapEditorSemanticPreviewMaterial =
  | MeshStandardMaterial
  | MeshStandardNodeMaterial;

function createOwnedMesh(
  geometry: BufferGeometry,
  material: MapEditorSemanticPreviewMaterial
): Mesh {
  const mesh = new Mesh(geometry, material);
  const userData = mesh.userData as SemanticDraftMeshUserData;

  userData.mapEditorOwnsGeometry = true;
  userData.mapEditorOwnsMaterial = true;

  return mesh;
}

function disposeOwnedGroup(group: Group): void {
  group.traverse((node) => {
    if (!("isMesh" in node) || node.isMesh !== true) {
      return;
    }

    const mesh = node as Mesh;
    const userData = mesh.userData as SemanticDraftMeshUserData;

    if (userData.mapEditorOwnsGeometry === true) {
      mesh.geometry.dispose();
    }

    if (userData.mapEditorOwnsMaterial === true) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      for (const material of materials) {
        const texturedMaterial = material as MeshStandardMaterial & {
          readonly alphaMap?: { dispose: () => void } | null;
          readonly bumpMap?: { dispose: () => void } | null;
          readonly emissiveMap?: { dispose: () => void } | null;
          readonly map?: { dispose: () => void } | null;
        };

        texturedMaterial.map?.dispose();
        if (texturedMaterial.bumpMap !== texturedMaterial.map) {
          texturedMaterial.bumpMap?.dispose();
        }
        texturedMaterial.emissiveMap?.dispose();
        texturedMaterial.alphaMap?.dispose();
        material.dispose();
      }
    }
  });
}

function resolveTerrainPatchMaterialId(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot
): MapEditorTerrainPatchDraftSnapshot["materialLayers"][number]["materialId"] {
  let selectedMaterialId: MapEditorTerrainPatchDraftSnapshot["materialLayers"][number]["materialId"] =
    "terrain-grass";
  let selectedWeight = Number.NEGATIVE_INFINITY;

  for (const layer of terrainPatch.materialLayers) {
    const layerWeight = layer.weightSamples.reduce(
      (totalWeight, sampleWeight) => totalWeight + Math.max(0, sampleWeight),
      0
    );

    if (layerWeight > selectedWeight) {
      selectedWeight = layerWeight;
      selectedMaterialId = layer.materialId;
    }
  }

  return selectedMaterialId;
}

function applyTextureScale(
  material: MapEditorSemanticPreviewMaterial,
  repeatX: number,
  repeatY: number
): void {
  if (material.map === null) {
    return;
  }

  material.map.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
  material.map.needsUpdate = true;
}

function createRegionUvAttribute(
  vertices: readonly number[]
): Float32BufferAttribute {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < vertices.length; index += 3) {
    minX = Math.min(minX, vertices[index] ?? 0);
    maxX = Math.max(maxX, vertices[index] ?? 0);
    minZ = Math.min(minZ, vertices[index + 2] ?? 0);
    maxZ = Math.max(maxZ, vertices[index + 2] ?? 0);
  }

  const uvs: number[] = [];

  for (let index = 0; index < vertices.length; index += 3) {
    uvs.push(
      ((vertices[index] ?? 0) - minX) / mapEditorBuildGridUnitMeters,
      ((vertices[index + 2] ?? 0) - minZ) / mapEditorBuildGridUnitMeters
    );
  }

  return new Float32BufferAttribute(uvs, 2);
}

function resolveRegionTextureId(
  region: MapEditorRegionDraftSnapshot
): MetaverseSceneSemanticPreviewTextureId {
  return resolveMetaverseSceneSurfacePreviewTextureId(region);
}

function resolveEdgeTextureId(
  edge: MapEditorEdgeDraftSnapshot
): MetaverseSceneSemanticPreviewTextureId {
  switch (edge.materialReferenceId) {
    case "alien-rock":
    case "concrete":
    case "glass":
    case "metal":
    case "terrain-ash":
    case "terrain-basalt":
    case "terrain-cliff":
    case "terrain-dirt":
    case "terrain-gravel":
    case "terrain-grass":
    case "terrain-moss":
    case "terrain-rock":
    case "terrain-sand":
    case "terrain-snow":
    case "team-blue":
    case "team-red":
    case "warning":
    case "shell-floor-grid":
    case "shell-metal-panel":
    case "shell-painted-trim":
      return edge.materialReferenceId;
    default:
      break;
  }

  switch (edge.edgeKind) {
    case "fence":
    case "rail":
      return "metal";
    case "retaining-wall":
      return "terrain-rock";
    case "curb":
      return "concrete";
    case "wall":
    default:
      return "shell-floor-grid";
  }
}

function resolveConnectorTextureId(
  connector: MapEditorConnectorDraftSnapshot
): MetaverseSceneSemanticPreviewTextureId {
  switch (connector.connectorKind) {
    case "door":
      return "shell-metal-panel";
    case "gate":
      return "metal";
    case "ramp":
    default:
      return "warning";
  }
}

function createTerrainPatchGroup(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot
): Group {
  const root = new Group();
  const userData = root.userData as SemanticDraftMeshUserData;
  const materialId = resolveTerrainPatchMaterialId(terrainPatch);
  const terrainTexture = createMetaverseSceneTerrainPatchPreviewTexture(terrainPatch);
  const material = createMetaverseSceneSemanticRenderMaterial(materialId, null, {
    diffuseTexture: terrainTexture
  });
  material.side = DoubleSide;
  const mesh = createOwnedMesh(
    createMetaverseSceneTerrainPatchGeometry(terrainPatch),
    material
  );

  root.name = `map_editor_semantic/terrain/${terrainPatch.terrainPatchId}`;
  userData.terrainPatchId = terrainPatch.terrainPatchId;
  userData.mapEditorOwnsGeometry = true;
  userData.mapEditorOwnsMaterial = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  root.position.set(terrainPatch.origin.x, terrainPatch.origin.y, terrainPatch.origin.z);
  root.rotation.y = terrainPatch.rotationYRadians;

  return root;
}

function createSurfaceGroup(surface: MapEditorSurfaceDraftSnapshot): Group {
  const root = new Group();
  const userData = root.userData as SemanticDraftMeshUserData;
  const mesh = createOwnedMesh(
    new BoxGeometry(surface.size.x, Math.max(0.12, surface.size.y), surface.size.z),
    new MeshStandardMaterial({
      color: "#1e3a5f",
      emissive: "#07111b",
      metalness: 0.02,
      opacity: 0.45,
      roughness: 0.88,
      transparent: true
    })
  );

  root.name = `map_editor_semantic/surface/${surface.surfaceId}`;
  userData.surfaceId = surface.surfaceId;
  root.add(mesh);
  root.position.set(surface.center.x, surface.center.y, surface.center.z);
  root.rotation.y = surface.rotationYRadians;

  return root;
}

function createRegionGroup(
  region: MapEditorRegionDraftSnapshot,
  surface: MapEditorSurfaceDraftSnapshot | null,
  materialDefinitions: readonly MapEditorMaterialDefinitionDraftSnapshot[]
): Group {
  const root = new Group();
  const userData = root.userData as SemanticDraftMeshUserData;
  const materialDefinition = resolveMetaverseSceneSemanticMaterialDefinition(
    materialDefinitions,
    region.materialReferenceId
  );
  const textureId = materialDefinition?.baseMaterialId ?? resolveRegionTextureId(region);
  const profile = resolveMetaverseSceneSemanticMaterialProfile(textureId);
  const material = createMetaverseSceneSemanticRenderMaterial(textureId, materialDefinition, {
    ...(materialDefinition === null ? { metalness: profile.metalness } : {}),
    ...(materialDefinition === null && textureId !== "glass" ? { opacity: 0.96 } : {}),
    ...(materialDefinition === null && region.regionKind === "path"
      ? { roughness: Math.min(0.72, profile.roughness) }
      : {})
  });
  material.side = DoubleSide;
  const meshData =
    surface === null
      ? null
      : createMetaverseMapBundleSemanticRegionSurfaceMesh(
          {
            outerLoop: region.outerLoop,
            surfaceId: region.surfaceId
          },
          {
            center: surface.center,
            elevation: surface.elevation,
            kind: surface.kind,
            rotationYRadians: surface.rotationYRadians,
            size: surface.size,
            slopeRiseMeters: surface.slopeRiseMeters,
            surfaceId: surface.surfaceId
          }
        );
  const geometry =
    meshData === null
      ? new BoxGeometry(
          region.size.x,
          Math.max(0.08, region.size.y * 0.35),
          region.size.z
        )
      : (() => {
          const nextGeometry = new BufferGeometry();

          nextGeometry.setAttribute(
            "position",
            new Float32BufferAttribute(meshData.vertices, 3)
          );
          nextGeometry.setAttribute(
            "uv",
            createRegionUvAttribute(meshData.vertices)
          );
          nextGeometry.setIndex(Array.from(meshData.indices));
          nextGeometry.computeVertexNormals();

          return nextGeometry;
        })();
  if (meshData === null) {
    applyTextureScale(
      material,
      region.size.x / mapEditorBuildGridUnitMeters,
      region.size.z / mapEditorBuildGridUnitMeters
    );
  }

  const mesh = createOwnedMesh(geometry, material);

  root.name = `map_editor_semantic/region/${region.regionId}`;
  userData.regionId = region.regionId;
  root.add(mesh);
  if (meshData === null) {
    root.position.set(region.center.x, region.center.y + 0.06, region.center.z);
    root.rotation.y = region.rotationYRadians;
  } else {
    root.position.set(
      meshData.translation.x,
      meshData.translation.y + 0.06,
      meshData.translation.z
    );
    root.rotation.y = meshData.rotationYRadians;
  }

  return root;
}

function createEdgeGroup(
  edge: MapEditorEdgeDraftSnapshot,
  materialDefinitions: readonly MapEditorMaterialDefinitionDraftSnapshot[]
): Group {
  const root = new Group();
  const userData = root.userData as SemanticDraftMeshUserData;
  const materialDefinition = resolveMetaverseSceneSemanticMaterialDefinition(
    materialDefinitions,
    edge.materialReferenceId
  );
  const textureId = materialDefinition?.baseMaterialId ?? resolveEdgeTextureId(edge);
  const profile = resolveMetaverseSceneSemanticMaterialProfile(textureId);
  const material = createMetaverseSceneSemanticRenderMaterial(textureId, materialDefinition, {
    emissive: "#160d08",
    ...(materialDefinition === null
      ? { metalness: edge.edgeKind === "fence" || edge.edgeKind === "rail" ? 0.18 : profile.metalness }
      : {}),
    ...(materialDefinition === null ? { roughness: Math.min(0.78, profile.roughness) } : {})
  });

  applyTextureScale(
    material,
    edge.lengthMeters / mapEditorBuildGridUnitMeters,
    edge.heightMeters / mapEditorBuildGridUnitMeters
  );
  const mesh = createOwnedMesh(
    new BoxGeometry(
      Math.max(0.25, edge.lengthMeters),
      Math.max(0.25, edge.heightMeters),
      Math.max(0.1, edge.thicknessMeters)
    ),
    material
  );

  root.name = `map_editor_semantic/edge/${edge.edgeId}`;
  userData.edgeId = edge.edgeId;
  root.add(mesh);
  root.position.set(edge.center.x, edge.center.y, edge.center.z);
  root.rotation.y = edge.rotationYRadians;

  return root;
}

function createConnectorGroup(
  connector: MapEditorConnectorDraftSnapshot
): Group {
  const root = new Group();
  const userData = root.userData as SemanticDraftMeshUserData;
  const material = createMetaverseSceneSemanticRenderMaterial(
    resolveConnectorTextureId(connector),
    null,
    {
      emissive: "#13091f",
      metalness: connector.connectorKind === "gate" ? 0.18 : 0.06,
      roughness: 0.7
    }
  );

  applyTextureScale(
    material,
    connector.size.x / mapEditorBuildGridUnitMeters,
    connector.size.z / mapEditorBuildGridUnitMeters
  );
  const mesh = createOwnedMesh(
    new BoxGeometry(
      Math.max(0.25, connector.size.x),
      Math.max(0.25, connector.size.y),
      Math.max(0.25, connector.size.z)
    ),
    material
  );

  root.name = `map_editor_semantic/connector/${connector.connectorId}`;
  userData.connectorId = connector.connectorId;
  root.add(mesh);
  root.position.set(connector.center.x, connector.center.y, connector.center.z);
  root.rotation.y = connector.rotationYRadians;

  return root;
}

function createStructureGroup(
  structure: MapEditorStructuralDraftSnapshot,
  materialDefinitions: readonly MapEditorMaterialDefinitionDraftSnapshot[]
): Group {
  const root = new Group();
  const userData = root.userData as SemanticDraftMeshUserData;
  const materialDefinition = resolveMetaverseSceneSemanticMaterialDefinition(
    materialDefinitions,
    structure.materialReferenceId
  );
  const textureId = materialDefinition?.baseMaterialId ?? structure.materialId;
  const material = createMetaverseSceneSemanticRenderMaterial(textureId, materialDefinition, {
    emissive: structure.structureKind === "ramp" ? "#15102a" : "#101214",
    ...(materialDefinition === null && textureId === "metal" ? { metalness: 0.35 } : {}),
    ...(materialDefinition === null && structure.traversalAffordance === "support"
      ? { opacity: 0.94 }
      : {}),
    ...(materialDefinition === null && textureId !== "glass" ? { roughness: 0.76 } : {})
  });

  applyTextureScale(
    material,
    Math.max(structure.size.x, structure.size.z) / mapEditorBuildGridUnitMeters,
    Math.max(structure.size.y, structure.size.z) / mapEditorBuildGridUnitMeters
  );
  const mesh = createOwnedMesh(
    new BoxGeometry(
      Math.max(0.12, structure.size.x),
      Math.max(0.08, structure.size.y),
      Math.max(0.12, structure.size.z)
    ),
    material
  );

  root.name = `map_editor_semantic/structure/${structure.structureId}`;
  userData.structureId = structure.structureId;
  mesh.position.y = structure.size.y * 0.5;
  root.add(mesh);
  root.position.set(structure.center.x, structure.center.y, structure.center.z);
  root.rotation.y = structure.rotationYRadians;

  return root;
}

function createGameplayVolumeGroup(
  volume: MapEditorGameplayVolumeDraftSnapshot
): Group {
  const root = new Group();
  const userData = root.userData as SemanticDraftMeshUserData;
  const mesh = createOwnedMesh(
    new BoxGeometry(
      Math.max(0.12, volume.size.x),
      Math.max(0.12, volume.size.y),
      Math.max(0.12, volume.size.z)
    ),
    new MeshStandardMaterial({
      color:
        volume.teamId === "blue"
          ? "#38bdf8"
          : volume.teamId === "red"
            ? "#fb7185"
            : volume.volumeKind === "kill-floor"
              ? "#dc2626"
            : volume.volumeKind === "vehicle-route"
              ? "#a3e635"
              : "#f59e0b",
      emissive: "#0f172a",
      metalness: 0,
      opacity: volume.volumeKind === "cover-volume" ? 0.24 : 0.18,
      roughness: 0.8,
      transparent: true
    })
  );

  root.name = `map_editor_semantic/gameplay-volume/${volume.volumeId}`;
  userData.gameplayVolumeId = volume.volumeId;
  root.add(mesh);
  root.position.set(volume.center.x, volume.center.y, volume.center.z);
  root.rotation.y = volume.rotationYRadians;

  return root;
}

function createLightGroup(light: MapEditorLightDraftSnapshot): Group {
  const root = new Group();
  const userData = root.userData as SemanticDraftMeshUserData;
  const helperRadius = light.lightKind === "sun" ? 0.34 : 0.24;
  const helperMesh = createOwnedMesh(
    new SphereGeometry(helperRadius, 18, 12),
    new MeshStandardMaterial({
      color: `rgb(${Math.round(light.color[0] * 255)} ${Math.round(
        light.color[1] * 255
      )} ${Math.round(light.color[2] * 255)})`,
      emissive: `rgb(${Math.round(light.color[0] * 255)} ${Math.round(
        light.color[1] * 255
      )} ${Math.round(light.color[2] * 255)})`,
      emissiveIntensity:
        light.lightKind === "ambient"
          ? Math.max(0.18, light.intensity * 0.06)
          : Math.max(0.25, light.intensity * 0.1),
      metalness: 0.02,
      roughness: 0.28
    })
  );
  const lightColor = `rgb(${Math.round(light.color[0] * 255)} ${Math.round(
    light.color[1] * 255
  )} ${Math.round(light.color[2] * 255)})`;

  root.rotation.y = light.rotationYRadians;

  switch (light.lightKind) {
    case "ambient":
      root.add(new AmbientLight(lightColor, light.intensity));
      break;
    case "sun": {
      const directionalLight = new DirectionalLight(lightColor, light.intensity);
      const target = new Group();

      target.position.set(
        light.target?.x === undefined ? 0 : light.target.x - light.position.x,
        light.target?.y === undefined ? -8 : light.target.y - light.position.y,
        light.target?.z === undefined ? -8 : light.target.z - light.position.z
      );
      directionalLight.target = target;
      root.add(directionalLight, target);
      break;
    }
    case "spot": {
      const spotLight = new SpotLight(
        lightColor,
        light.intensity,
        light.rangeMeters ?? 0,
        Math.PI * 0.25,
        0.4,
        1
      );
      const target = new Group();

      target.position.set(
        light.target?.x === undefined ? 0 : light.target.x - light.position.x,
        light.target?.y === undefined ? -2 : light.target.y - light.position.y,
        light.target?.z === undefined
          ? -Math.max(4, (light.rangeMeters ?? 8) * 0.5)
          : light.target.z - light.position.z
      );
      spotLight.target = target;
      root.add(spotLight, target);
      break;
    }
    case "area":
    case "point":
    default:
      root.add(
        new PointLight(lightColor, light.intensity, light.rangeMeters ?? 0, 1)
      );
      break;
  }

  root.name = `map_editor_semantic/light/${light.lightId}`;
  userData.lightId = light.lightId;
  root.add(helperMesh);
  root.position.set(light.position.x, light.position.y, light.position.z);

  return root;
}

export interface MapEditorViewportSemanticDraftHandles {
  readonly connectorGroupsById: Map<string, Group>;
  readonly edgeGroupsById: Map<string, Group>;
  readonly gameplayVolumeGroupsById: Map<string, Group>;
  readonly lightGroupsById: Map<string, Group>;
  readonly regionGroupsById: Map<string, Group>;
  readonly rootGroup: Group;
  readonly structureGroupsById: Map<string, Group>;
  readonly surfaceGroupsById: Map<string, Group>;
  readonly terrainPatchGroupsById: Map<string, Group>;
}

export function createMapEditorViewportSemanticDraftHandles(): MapEditorViewportSemanticDraftHandles {
  return Object.freeze({
    connectorGroupsById: new Map<string, Group>(),
    edgeGroupsById: new Map<string, Group>(),
    gameplayVolumeGroupsById: new Map<string, Group>(),
    lightGroupsById: new Map<string, Group>(),
    regionGroupsById: new Map<string, Group>(),
    rootGroup: new Group(),
    structureGroupsById: new Map<string, Group>(),
    surfaceGroupsById: new Map<string, Group>(),
    terrainPatchGroupsById: new Map<string, Group>()
  });
}

export function disposeMapEditorViewportSemanticDraftHandles(
  handles: MapEditorViewportSemanticDraftHandles
): void {
  disposeOwnedGroup(handles.rootGroup);
}

export function syncMapEditorViewportSemanticDrafts(
  handles: MapEditorViewportSemanticDraftHandles,
  drafts: {
    readonly connectorDrafts: readonly MapEditorConnectorDraftSnapshot[];
    readonly edgeDrafts: readonly MapEditorEdgeDraftSnapshot[];
    readonly gameplayVolumeDrafts: readonly MapEditorGameplayVolumeDraftSnapshot[];
    readonly lightDrafts: readonly MapEditorLightDraftSnapshot[];
    readonly materialDefinitionDrafts?:
      readonly MapEditorMaterialDefinitionDraftSnapshot[];
    readonly regionDrafts: readonly MapEditorRegionDraftSnapshot[];
    readonly structuralDrafts: readonly MapEditorStructuralDraftSnapshot[];
    readonly surfaceDrafts: readonly MapEditorSurfaceDraftSnapshot[];
    readonly terrainPatchDrafts: readonly MapEditorTerrainPatchDraftSnapshot[];
  }
): void {
  disposeOwnedGroup(handles.rootGroup);
  handles.rootGroup.clear();
  handles.connectorGroupsById.clear();
  handles.edgeGroupsById.clear();
  handles.gameplayVolumeGroupsById.clear();
  handles.lightGroupsById.clear();
  handles.regionGroupsById.clear();
  handles.structureGroupsById.clear();
  handles.surfaceGroupsById.clear();
  handles.terrainPatchGroupsById.clear();
  const surfacesById = new Map(
    drafts.surfaceDrafts.map((surfaceDraft) => [surfaceDraft.surfaceId, surfaceDraft] as const)
  );
  const ownedSurfaceIds = new Set<string>([
    ...drafts.regionDrafts.map((regionDraft) => regionDraft.surfaceId),
    ...drafts.edgeDrafts.map((edgeDraft) => edgeDraft.surfaceId)
  ]);

  for (const terrainPatch of drafts.terrainPatchDrafts) {
    const group = createTerrainPatchGroup(terrainPatch);

    handles.terrainPatchGroupsById.set(terrainPatch.terrainPatchId, group);
    handles.rootGroup.add(group);
  }

  for (const surface of drafts.surfaceDrafts) {
    if (ownedSurfaceIds.has(surface.surfaceId)) {
      continue;
    }

    const group = createSurfaceGroup(surface);

    handles.surfaceGroupsById.set(surface.surfaceId, group);
    handles.rootGroup.add(group);
  }

  for (const region of drafts.regionDrafts) {
    const group = createRegionGroup(
      region,
      surfacesById.get(region.surfaceId) ?? null,
      drafts.materialDefinitionDrafts ?? Object.freeze([])
    );

    handles.regionGroupsById.set(region.regionId, group);
    handles.rootGroup.add(group);
  }

  for (const edge of drafts.edgeDrafts) {
    const group = createEdgeGroup(
      edge,
      drafts.materialDefinitionDrafts ?? Object.freeze([])
    );

    handles.edgeGroupsById.set(edge.edgeId, group);
    handles.rootGroup.add(group);
  }

  for (const connector of drafts.connectorDrafts) {
    const group = createConnectorGroup(connector);

    handles.connectorGroupsById.set(connector.connectorId, group);
    handles.rootGroup.add(group);
  }

  for (const structure of drafts.structuralDrafts) {
    const group = createStructureGroup(
      structure,
      drafts.materialDefinitionDrafts ?? Object.freeze([])
    );

    handles.structureGroupsById.set(structure.structureId, group);
    handles.rootGroup.add(group);
  }

  for (const volume of drafts.gameplayVolumeDrafts) {
    const group = createGameplayVolumeGroup(volume);

    handles.gameplayVolumeGroupsById.set(volume.volumeId, group);
    handles.rootGroup.add(group);
  }

  for (const light of drafts.lightDrafts) {
    const group = createLightGroup(light);

    handles.lightGroupsById.set(light.lightId, group);
    handles.rootGroup.add(group);
  }
}
