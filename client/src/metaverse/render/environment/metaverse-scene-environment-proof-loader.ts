import { resolveMetaverseWorldSurfaceScaleVector } from "@webgpu-metaverse/shared/metaverse/world";
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  BundleGroup,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PointLight,
  Quaternion,
  SpotLight,
  Vector3,
  type Object3D
} from "three/webgpu";
import { color, float } from "three/tsl";
import {
  createMetaverseSceneTerrainPatchPreviewTexture,
  resolveMetaverseSceneSemanticMaterialProfile,
  resolveMetaverseSceneSurfacePreviewTextureId,
  type MetaverseSceneSemanticPreviewTextureId
} from "./metaverse-scene-semantic-material-textures";
import {
  createMetaverseSceneSemanticRenderMaterial,
  resolveMetaverseSceneSemanticMaterialDefinition
} from "./metaverse-scene-semantic-materials";
import {
  createMetaverseSceneTerrainPatchGeometry
} from "./metaverse-scene-terrain-patch-geometry";

import type {
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentGameplayVolumeProofConfig,
  MetaverseEnvironmentLightProofConfig,
  MetaverseEnvironmentLodProofConfig,
  MetaverseEnvironmentPlacementProofConfig,
  MetaverseEnvironmentProceduralStructureProofConfig,
  MetaverseEnvironmentSurfaceMeshProofConfig,
  MetaverseEnvironmentTerrainPatchProofConfig,
  MetaverseEnvironmentProofConfig
} from "../../types/metaverse-runtime";
import type {
  MetaverseEnvironmentDynamicAssetRuntime,
  MetaverseEnvironmentProofRuntime,
  SceneAssetLoaderLike
} from "./metaverse-scene-environment-proof-runtime";
import type {
  MetaverseSceneMountableEnvironmentEntryRuntime,
  MetaverseSceneMountableEnvironmentSeatRuntime
} from "../mounts/metaverse-scene-mounts";
import { resolveEnvironmentRenderYawFromSimulationYaw } from "../../traversal/presentation/mount-presentation";

const dynamicEnvironmentSeatSocketPositionScratch = new Vector3();
const dynamicEnvironmentSeatSocketQuaternionScratch = new Quaternion();
const dynamicEnvironmentSeatSocketScaleScratch = new Vector3();

function createProceduralEnvironmentMaterial(
  materialPreset:
    | "training-range-accent"
    | "training-range-surface"
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();

  switch (materialPreset) {
    case "training-range-accent":
      material.colorNode = color(0.76, 0.42, 0.18);
      material.emissiveNode = color(0.05, 0.02, 0.01);
      material.roughnessNode = float(0.76);
      material.metalnessNode = float(0.08);
      break;
    default:
      material.colorNode = color(0.56, 0.55, 0.5);
      material.emissiveNode = color(0.015, 0.015, 0.018);
      material.roughnessNode = float(0.94);
      material.metalnessNode = float(0.02);
      break;
  }

  return material;
}

function readEnvironmentPlacementMaterialTextureId(
  materialReferenceId: string
): MetaverseSceneSemanticPreviewTextureId | null {
  switch (materialReferenceId) {
    case "__default__":
    case "alien-rock":
    case "concrete":
    case "glass":
    case "metal":
    case "shell-floor-grid":
    case "shell-metal-panel":
    case "shell-painted-trim":
    case "team-blue":
    case "team-red":
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
    case "warning":
      return materialReferenceId;
    default:
      return null;
  }
}

function createEnvironmentPlacementMaterialOverride(
  materialReferenceId: string | null,
  materialDefinitions: MetaverseEnvironmentProofConfig["materialDefinitions"]
): MeshStandardNodeMaterial | null {
  if (materialReferenceId === null) {
    return null;
  }

  const materialDefinition = resolveMetaverseSceneSemanticMaterialDefinition(
    materialDefinitions,
    materialReferenceId
  );
  const textureId =
    materialDefinition?.baseMaterialId ??
    readEnvironmentPlacementMaterialTextureId(materialReferenceId);

  return textureId === null
    ? null
    : createMetaverseSceneSemanticRenderMaterial(textureId, materialDefinition);
}

function applyEnvironmentPlacementMaterialOverride(
  scene: Group,
  materialReferenceId: string | null,
  materialDefinitions: MetaverseEnvironmentProofConfig["materialDefinitions"]
): void {
  const material = createEnvironmentPlacementMaterialOverride(
    materialReferenceId,
    materialDefinitions
  );

  if (material === null) {
    return;
  }

  scene.traverse((node) => {
    if (
      "isMesh" in node &&
      node.isMesh === true &&
      (!("isSkinnedMesh" in node) || node.isSkinnedMesh !== true)
    ) {
      (node as Mesh).material = material;
    }
  });
}

function groupEnvironmentPlacementsByMaterialReference(
  placements: readonly MetaverseEnvironmentPlacementProofConfig[]
): readonly {
  readonly materialReferenceId: string | null;
  readonly placements: readonly {
    readonly placement: MetaverseEnvironmentPlacementProofConfig;
    readonly placementIndex: number;
  }[];
}[] {
  const groups: {
    readonly materialReferenceId: string | null;
    readonly placements: {
      readonly placement: MetaverseEnvironmentPlacementProofConfig;
      readonly placementIndex: number;
    }[];
  }[] = [];
  const groupsByKey = new Map<string, (typeof groups)[number]>();

  placements.forEach((placement, placementIndex) => {
    const materialReferenceId = placement.materialReferenceId ?? null;
    const groupKey = materialReferenceId ?? "__source__";
    const existingGroup = groupsByKey.get(groupKey);
    const group =
      existingGroup ??
      {
        materialReferenceId,
        placements: []
      };

    if (existingGroup === undefined) {
      groupsByKey.set(groupKey, group);
      groups.push(group);
    }

    group.placements.push(
      Object.freeze({
        placement,
        placementIndex
      })
    );
  });

  return Object.freeze(
    groups.map((group) =>
      Object.freeze({
        materialReferenceId: group.materialReferenceId,
        placements: Object.freeze(group.placements)
      })
    )
  );
}

function resolveTerrainPatchPrimaryTextureId(
  terrainPatch: MetaverseEnvironmentTerrainPatchProofConfig
): MetaverseSceneSemanticPreviewTextureId {
  let selectedTextureId: MetaverseSceneSemanticPreviewTextureId = "terrain-grass";
  let selectedWeight = Number.NEGATIVE_INFINITY;

  for (const layer of terrainPatch.materialLayers) {
    const layerWeight = layer.weightSamples.reduce(
      (totalWeight, sampleWeight) => totalWeight + Math.max(0, sampleWeight),
      0
    );

    if (layerWeight > selectedWeight) {
      selectedTextureId = layer.materialId;
      selectedWeight = layerWeight;
    }
  }

  return selectedTextureId;
}

function createSemanticStructureMaterial(
  structure: MetaverseEnvironmentProceduralStructureProofConfig,
  materialDefinitions: MetaverseEnvironmentProofConfig["materialDefinitions"]
): MeshStandardNodeMaterial {
  const materialDefinition = resolveMetaverseSceneSemanticMaterialDefinition(
    materialDefinitions,
    structure.materialReferenceId
  );

  return createMetaverseSceneSemanticRenderMaterial(
    materialDefinition?.baseMaterialId ?? structure.materialId,
    materialDefinition
  );
}

function createSurfaceMeshMaterial(
  surfaceMesh: MetaverseEnvironmentSurfaceMeshProofConfig,
  materialDefinitions: MetaverseEnvironmentProofConfig["materialDefinitions"]
): MeshStandardNodeMaterial {
  const materialDefinition = resolveMetaverseSceneSemanticMaterialDefinition(
    materialDefinitions,
    surfaceMesh.materialReferenceId
  );
  const textureId =
    materialDefinition?.baseMaterialId ??
    resolveMetaverseSceneSurfacePreviewTextureId(surfaceMesh);
  const profile = resolveMetaverseSceneSemanticMaterialProfile(textureId);
  const material = createMetaverseSceneSemanticRenderMaterial(
    textureId,
    materialDefinition
  );

  material.metalnessNode = float(
    materialDefinition?.metalness ??
      (surfaceMesh.regionKind === "roof"
        ? Math.max(profile.metalness, 0.18)
        : profile.metalness)
  );
  material.roughnessNode = float(
    materialDefinition?.roughness ??
      (surfaceMesh.regionKind === "path"
        ? Math.min(0.72, profile.roughness)
        : profile.roughness)
  );
  material.side = DoubleSide;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;

  return material;
}

function createTerrainPatchMaterial(
  terrainPatch: MetaverseEnvironmentTerrainPatchProofConfig
): MeshStandardNodeMaterial {
  return createMetaverseSceneSemanticRenderMaterial(
    resolveTerrainPatchPrimaryTextureId(terrainPatch),
    null,
    {
      diffuseTexture: createMetaverseSceneTerrainPatchPreviewTexture(terrainPatch)
    }
  );
}

function createSemanticGameplayVolumeMaterial(
  volume: MetaverseEnvironmentGameplayVolumeProofConfig
): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();

  if (volume.teamId === "blue") {
    material.colorNode = color(0.22, 0.74, 0.97);
  } else if (volume.teamId === "red") {
    material.colorNode = color(0.98, 0.45, 0.52);
  } else if (volume.volumeKind === "kill-floor") {
    material.colorNode = color(0.86, 0.15, 0.15);
  } else if (volume.volumeKind === "vehicle-route") {
    material.colorNode = color(0.64, 0.9, 0.16);
  } else {
    material.colorNode = color(0.96, 0.62, 0.08);
  }

  material.transparent = true;
  material.opacity = volume.volumeKind === "cover-volume" ? 0.12 : 0.08;
  material.depthWrite = false;

  return material;
}

function createProceduralStructureGroup(
  structure: MetaverseEnvironmentProceduralStructureProofConfig,
  materialDefinitions: MetaverseEnvironmentProofConfig["materialDefinitions"]
): Group {
  const group = new Group();
  const mesh = new Mesh(
    new BoxGeometry(structure.size.x, structure.size.y, structure.size.z),
    createSemanticStructureMaterial(structure, materialDefinitions)
  );

  group.name = `metaverse_environment_procedural_structure/${structure.structureId}`;
  mesh.name = `${group.name}/mesh`;
  mesh.position.y = structure.size.y * 0.5;
  mesh.receiveShadow = true;
  mesh.castShadow = structure.traversalAffordance === "blocker";
  group.position.set(structure.center.x, structure.center.y, structure.center.z);
  group.rotation.y = structure.rotationYRadians;
  group.add(mesh);

  return group;
}

function createSurfaceUvAttribute(
  vertices: readonly number[]
): Float32BufferAttribute {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  const uvs: number[] = [];

  for (let index = 0; index < vertices.length; index += 3) {
    minX = Math.min(minX, vertices[index] ?? 0);
    minZ = Math.min(minZ, vertices[index + 2] ?? 0);
  }

  for (let index = 0; index < vertices.length; index += 3) {
    uvs.push(
      ((vertices[index] ?? 0) - minX) / 4,
      ((vertices[index + 2] ?? 0) - minZ) / 4
    );
  }

  return new Float32BufferAttribute(uvs, 2);
}

function createTerrainPatchGroup(
  terrainPatch: MetaverseEnvironmentTerrainPatchProofConfig
): Group {
  const group = new Group();
  const mesh = new Mesh(
    createMetaverseSceneTerrainPatchGeometry(terrainPatch),
    createTerrainPatchMaterial(terrainPatch)
  );

  group.name = `metaverse_environment_terrain_patch/${terrainPatch.terrainPatchId}`;
  mesh.name = `${group.name}/mesh`;
  mesh.receiveShadow = true;
  group.position.set(
    terrainPatch.origin.x,
    terrainPatch.origin.y,
    terrainPatch.origin.z
  );
  group.rotation.y = terrainPatch.rotationYRadians;
  group.add(mesh);

  return group;
}

function createSurfaceMeshGroup(
  surfaceMesh: MetaverseEnvironmentSurfaceMeshProofConfig,
  materialDefinitions: MetaverseEnvironmentProofConfig["materialDefinitions"]
): Group {
  const geometry = new BufferGeometry();
  const material = createSurfaceMeshMaterial(surfaceMesh, materialDefinitions);
  const group = new Group();
  const mesh = new Mesh(geometry, material);

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(surfaceMesh.vertices, 3)
  );
  geometry.setAttribute("uv", createSurfaceUvAttribute(surfaceMesh.vertices));
  geometry.setIndex(Array.from(surfaceMesh.indices));
  geometry.computeVertexNormals();

  group.name = `metaverse_environment_surface_mesh/${surfaceMesh.regionId}`;
  mesh.name = `${group.name}/mesh`;
  mesh.receiveShadow = true;
  mesh.castShadow = surfaceMesh.regionKind === "roof";
  group.position.set(
    surfaceMesh.translation.x,
    surfaceMesh.translation.y,
    surfaceMesh.translation.z
  );
  group.rotation.y = surfaceMesh.rotationYRadians;
  group.add(mesh);

  return group;
}

function createGameplayVolumeGroup(
  volume: MetaverseEnvironmentGameplayVolumeProofConfig
): Group {
  const group = new Group();
  const mesh = new Mesh(
    new BoxGeometry(volume.size.x, volume.size.y, volume.size.z),
    createSemanticGameplayVolumeMaterial(volume)
  );

  group.name = `metaverse_environment_gameplay_volume/${volume.volumeId}`;
  mesh.name = `${group.name}/mesh`;
  group.position.set(volume.center.x, volume.center.y, volume.center.z);
  group.add(mesh);

  return group;
}

function addSemanticLight(
  anchorGroup: Group,
  light: MetaverseEnvironmentLightProofConfig
): void {
  const lightColor = new Color(light.color[0], light.color[1], light.color[2]);

  switch (light.lightKind) {
    case "ambient":
      anchorGroup.add(new AmbientLight(lightColor, light.intensity));
      return;
    case "sun": {
      const sun = new DirectionalLight(lightColor, light.intensity);

      sun.position.set(light.position.x, light.position.y, light.position.z);
      anchorGroup.add(sun);
      return;
    }
    case "spot": {
      const spot = new SpotLight(
        lightColor,
        light.intensity,
        light.rangeMeters ?? 0,
        Math.PI * 0.25,
        0.4,
        1
      );

      spot.position.set(light.position.x, light.position.y, light.position.z);
      anchorGroup.add(spot);
      return;
    }
    case "area":
    case "point":
    default: {
      const point = new PointLight(
        lightColor,
        light.intensity,
        light.rangeMeters ?? 0,
        1
      );

      point.position.set(light.position.x, light.position.y, light.position.z);
      anchorGroup.add(point);
      return;
    }
  }
}

function createProceduralEnvironmentLodAsset(
  environmentAssetId: string,
  lodConfig: Extract<
    MetaverseEnvironmentLodProofConfig,
    { readonly kind: "procedural-box" }
  >
): {
  readonly scene: Group;
} {
  const scene = new Group();
  const geometry = new BoxGeometry(
    lodConfig.size.x,
    lodConfig.size.y,
    lodConfig.size.z
  );
  const material = createProceduralEnvironmentMaterial(lodConfig.materialPreset);
  const mesh = new Mesh(geometry, material);

  mesh.name = `metaverse_environment_procedural/${environmentAssetId}/${lodConfig.tier}`;
  mesh.position.y = lodConfig.size.y * 0.5;
  mesh.castShadow = lodConfig.materialPreset === "training-range-accent";
  mesh.receiveShadow = true;
  scene.add(mesh);

  return {
    scene
  };
}

function isProceduralEnvironmentLodConfig(
  lodConfig: MetaverseEnvironmentLodProofConfig
): lodConfig is Extract<
  MetaverseEnvironmentLodProofConfig,
  { readonly kind: "procedural-box" }
> {
  return "kind" in lodConfig && lodConfig.kind === "procedural-box";
}

function resolveEnvironmentLodModelPath(
  environmentAssetProofConfig: MetaverseEnvironmentAssetProofConfig,
  lodConfig: MetaverseEnvironmentLodProofConfig
): string {
  if (isProceduralEnvironmentLodConfig(lodConfig)) {
    throw new Error(
      `Metaverse dynamic environment asset ${environmentAssetProofConfig.label} cannot use procedural geometry.`
    );
  }

  return lodConfig.modelPath;
}

function collectRenderableMeshes(scene: Group, label: string): readonly Mesh[] {
  const meshes: Mesh[] = [];

  scene.traverse((node) => {
    if (
      "isMesh" in node &&
      node.isMesh === true &&
      (!("isSkinnedMesh" in node) || node.isSkinnedMesh !== true)
    ) {
      meshes.push(node as Mesh);
    }
  });

  if (meshes.length === 0) {
    throw new Error(`${label} requires at least one non-skinned mesh.`);
  }

  return meshes;
}

function cloneGroup(group: Group): Group {
  return group.clone(true);
}

function finalizeStaticSceneGraph(root: Object3D): void {
  root.traverse((node) => {
    node.updateMatrix();
    node.updateMatrixWorld(true);
    node.matrixAutoUpdate = false;
  });
}

function createStaticBundleGroup(name: string): BundleGroup {
  const bundleGroup = new BundleGroup();

  bundleGroup.name = name;
  bundleGroup.static = true;

  return bundleGroup;
}

function createEnvironmentLodContainer(
  name: string,
  bundleOwned: boolean
): Group {
  if (bundleOwned) {
    return createStaticBundleGroup(name);
  }

  const group = new Group();

  group.name = name;

  return group;
}

function applyPlacementTransform(
  object: Object3D,
  placement: MetaverseEnvironmentPlacementProofConfig
): void {
  const scaleVector = resolveMetaverseWorldSurfaceScaleVector(placement.scale);

  object.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  object.rotation.y = placement.rotationYRadians;
  object.scale.set(scaleVector.x, scaleVector.y, scaleVector.z);
  object.updateMatrix();
  object.updateMatrixWorld(true);
}

function applyDynamicPlacementTransform(
  object: Object3D,
  environmentAssetProofConfig: MetaverseEnvironmentAssetProofConfig,
  placement: MetaverseEnvironmentPlacementProofConfig
): void {
  applyPlacementTransform(object, placement);
  object.rotation.y = resolveEnvironmentRenderYawFromSimulationYaw(
    environmentAssetProofConfig,
    placement.rotationYRadians
  );
  object.updateMatrix();
  object.updateMatrixWorld(true);
}

async function loadEnvironmentLodObjects(
  environmentAssetProofConfig: MetaverseEnvironmentAssetProofConfig,
  createSceneAssetLoader: () => SceneAssetLoaderLike
): Promise<
  readonly ({
    readonly scene: Group;
  } & {
    readonly config: MetaverseEnvironmentLodProofConfig;
  })[]
> {
  const requiresSceneAssetLoader = environmentAssetProofConfig.lods.some(
    (lodConfig) => !isProceduralEnvironmentLodConfig(lodConfig)
  );
  const sceneAssetLoader = requiresSceneAssetLoader
    ? createSceneAssetLoader()
    : null;

  return Promise.all(
    environmentAssetProofConfig.lods.map(async (lodConfig) => ({
      config: lodConfig,
      ...(isProceduralEnvironmentLodConfig(lodConfig)
        ? createProceduralEnvironmentLodAsset(
            environmentAssetProofConfig.environmentAssetId,
            lodConfig
          )
        : await sceneAssetLoader!.loadAsync(lodConfig.modelPath))
    }))
  );
}

async function loadStaticEnvironmentAssetProofRuntime(
  environmentAssetProofConfig: MetaverseEnvironmentAssetProofConfig,
  createSceneAssetLoader: () => SceneAssetLoaderLike,
  materialDefinitions: MetaverseEnvironmentProofConfig["materialDefinitions"]
): Promise<{
  readonly anchorGroup: Group;
  readonly placements: readonly MetaverseEnvironmentProofRuntime["staticPlacements"][number][];
}> {
  const loadedLodAssets = await loadEnvironmentLodObjects(
    environmentAssetProofConfig,
    createSceneAssetLoader
  );
  const anchorGroup = new Group();
  const placements = environmentAssetProofConfig.placements.map(
    (placement, placementIndex) => {
      const placementAnchor = new Group();
      const lods = loadedLodAssets.map(({ config, scene: loadedScene }) => {
        const lodScene = cloneGroup(loadedScene);
        const lodBundle = createEnvironmentLodContainer(
          [
            "metaverse_environment_static",
            environmentAssetProofConfig.environmentAssetId,
            String(placementIndex),
            config.tier
          ].join("/"),
          !isProceduralEnvironmentLodConfig(config)
        );

        lodScene.name = `${lodBundle.name}/scene`;
        applyEnvironmentPlacementMaterialOverride(
          lodScene,
          placement.materialReferenceId ?? null,
          materialDefinitions
        );
        lodBundle.visible = false;
        lodBundle.add(lodScene);
        placementAnchor.add(lodBundle);

        return {
          maxDistanceMeters: config.maxDistanceMeters,
          object: lodBundle,
          tier: config.tier
        };
      });

      placementAnchor.name = [
        "metaverse_environment_anchor",
        environmentAssetProofConfig.environmentAssetId,
        String(placementIndex)
      ].join("/");
      applyPlacementTransform(placementAnchor, placement);
      anchorGroup.add(placementAnchor);

      return {
        activeLodIndex: -1,
        lastLodSwitchAtMs: Number.NEGATIVE_INFINITY,
        lods,
        placement
      };
    }
  );

  anchorGroup.name = `metaverse_environment_asset/${environmentAssetProofConfig.environmentAssetId}`;
  finalizeStaticSceneGraph(anchorGroup);

  return {
    anchorGroup,
    placements
  };
}

async function loadInstancedEnvironmentAssetProofRuntime(
  environmentAssetProofConfig: MetaverseEnvironmentAssetProofConfig,
  createSceneAssetLoader: () => SceneAssetLoaderLike,
  materialDefinitions: MetaverseEnvironmentProofConfig["materialDefinitions"]
): Promise<
  MetaverseEnvironmentProofRuntime["instancedAssets"][number] & {
    readonly anchorGroup: Group;
  }
> {
  const loadedLodAssets = await loadEnvironmentLodObjects(
    environmentAssetProofConfig,
    createSceneAssetLoader
  );
  const placementScratch = new Group();
  const anchorGroup = new Group();
  const placementGroups = groupEnvironmentPlacementsByMaterialReference(
    environmentAssetProofConfig.placements
  );
  const lods = loadedLodAssets.map(({ config, scene: loadedScene }) => {
    const sourceMeshes = collectRenderableMeshes(
      loadedScene,
      `Metaverse environment asset ${environmentAssetProofConfig.label} LOD ${config.tier}`
    );
    const lodGroup = createEnvironmentLodContainer(
      [
        "metaverse_environment_lod",
        environmentAssetProofConfig.environmentAssetId,
        config.tier
      ].join("/"),
      !isProceduralEnvironmentLodConfig(config)
    );
    lodGroup.visible = false;

    sourceMeshes.forEach((sourceMesh, meshIndex) => {
      if (Array.isArray(sourceMesh.material)) {
        throw new Error(
          `Metaverse instanced environment asset ${environmentAssetProofConfig.label} requires a single material per mesh.`
        );
      }

      placementGroups.forEach((placementGroup, placementGroupIndex) => {
        const instancedMesh = new InstancedMesh(
          sourceMesh.geometry,
          createEnvironmentPlacementMaterialOverride(
            placementGroup.materialReferenceId,
            materialDefinitions
          ) ?? sourceMesh.material,
          placementGroup.placements.length
        );

        instancedMesh.name = `${lodGroup.name}/mesh-${meshIndex}-${placementGroupIndex}`;

        placementGroup.placements.forEach(
          ({ placement }, placementGroupPlacementIndex) => {
            applyPlacementTransform(placementScratch, placement);
            instancedMesh.setMatrixAt(
              placementGroupPlacementIndex,
              placementScratch.matrix
            );
          }
        );

        instancedMesh.instanceMatrix.needsUpdate = true;
        lodGroup.add(instancedMesh);
      });
    });

    anchorGroup.add(lodGroup);

    return {
      maxDistanceMeters: config.maxDistanceMeters,
      object: lodGroup,
      tier: config.tier
    };
  });

  anchorGroup.name = `metaverse_environment_asset/${environmentAssetProofConfig.environmentAssetId}`;
  finalizeStaticSceneGraph(anchorGroup);

  return {
    activeLodIndex: -1,
    anchorGroup,
    lastLodSwitchAtMs: Number.NEGATIVE_INFINITY,
    lods,
    placements: environmentAssetProofConfig.placements
  };
}

async function loadDynamicEnvironmentAssetProofRuntime(
  environmentAssetProofConfig: MetaverseEnvironmentAssetProofConfig,
  createSceneAssetLoader: () => SceneAssetLoaderLike,
  materialDefinitions: MetaverseEnvironmentProofConfig["materialDefinitions"],
  dynamicAssetIndex: number,
  findNamedNode: (
    scene: Group,
    nodeName: string,
    label: string
  ) => Object3D
): Promise<MetaverseEnvironmentDynamicAssetRuntime> {
  if (environmentAssetProofConfig.placements.length !== 1) {
    throw new Error(
      `Metaverse dynamic environment asset ${environmentAssetProofConfig.label} requires exactly one placement.`
    );
  }

  if (environmentAssetProofConfig.lods.length !== 1) {
    throw new Error(
      `Metaverse dynamic environment asset ${environmentAssetProofConfig.label} requires exactly one LOD entry.`
    );
  }

  if (environmentAssetProofConfig.collider === null) {
    throw new Error(
      `Metaverse dynamic environment asset ${environmentAssetProofConfig.label} requires collider metadata.`
    );
  }

  const sceneAssetLoader = createSceneAssetLoader();
  const environmentAsset = await sceneAssetLoader.loadAsync(
    resolveEnvironmentLodModelPath(
      environmentAssetProofConfig,
      environmentAssetProofConfig.lods[0]!
    )
  );
  const anchorGroup = new Group();
  const presentationGroup = new Group();
  const placement = environmentAssetProofConfig.placements[0]!;
  const environmentScene = environmentAsset.scene;
  let entries: readonly MetaverseSceneMountableEnvironmentEntryRuntime[] | null =
    null;
  let seats: readonly MetaverseSceneMountableEnvironmentSeatRuntime[] | null =
    null;

  applyEnvironmentPlacementMaterialOverride(
    environmentScene,
    placement.materialReferenceId ?? null,
    materialDefinitions
  );

  if (environmentAssetProofConfig.traversalAffordance === "mount") {
    if (
      environmentAssetProofConfig.seats === null ||
      environmentAssetProofConfig.seats.length === 0
    ) {
      throw new Error(
        `Metaverse dynamic environment asset ${environmentAssetProofConfig.label} requires seat metadata.`
      );
    }

    environmentScene.updateMatrixWorld(true);
    entries = Object.freeze(
      (environmentAssetProofConfig.entries ?? []).map((entry) => {
        const authoredEntryNode = findNamedNode(
          environmentScene,
          entry.entryNodeName,
          `Metaverse dynamic environment asset ${environmentAssetProofConfig.label}`
        );
        const simulationEntryAnchor = new Group();

        simulationEntryAnchor.name = [
          "metaverse_environment_entry_anchor",
          environmentAssetProofConfig.environmentAssetId,
          entry.entryId
        ].join("/");
        simulationEntryAnchor.position.copy(
          authoredEntryNode.getWorldPosition(
            dynamicEnvironmentSeatSocketPositionScratch
          )
        );
        simulationEntryAnchor.quaternion.copy(
          authoredEntryNode.getWorldQuaternion(
            dynamicEnvironmentSeatSocketQuaternionScratch
          )
        );
        simulationEntryAnchor.scale.copy(
          authoredEntryNode.getWorldScale(dynamicEnvironmentSeatSocketScaleScratch)
        );

        return Object.freeze({
          anchorGroup: simulationEntryAnchor,
          entry
        });
      })
    );
    seats = Object.freeze(
      environmentAssetProofConfig.seats.map((seat) => {
        const authoredSeatNode = findNamedNode(
          environmentScene,
          seat.seatNodeName,
          `Metaverse dynamic environment asset ${environmentAssetProofConfig.label}`
        );
        const simulationSeatAnchor = new Group();

        simulationSeatAnchor.name = [
          "metaverse_environment_seat_anchor",
          environmentAssetProofConfig.environmentAssetId,
          seat.seatId
        ].join("/");
        simulationSeatAnchor.position.copy(
          authoredSeatNode.getWorldPosition(
            dynamicEnvironmentSeatSocketPositionScratch
          )
        );
        simulationSeatAnchor.quaternion.copy(
          authoredSeatNode.getWorldQuaternion(
            dynamicEnvironmentSeatSocketQuaternionScratch
          )
        );
        simulationSeatAnchor.scale.copy(
          authoredSeatNode.getWorldScale(dynamicEnvironmentSeatSocketScaleScratch)
        );

        return Object.freeze({
          anchorGroup: simulationSeatAnchor,
          seat
        });
      })
    );
  } else if (
    environmentAssetProofConfig.seats !== null ||
    environmentAssetProofConfig.entries !== null
  ) {
    throw new Error(
      `Metaverse non-mounted dynamic environment asset ${environmentAssetProofConfig.label} cannot expose mount metadata.`
    );
  }

  anchorGroup.name = `metaverse_environment_asset/${environmentAssetProofConfig.environmentAssetId}`;
  presentationGroup.name = [
    "metaverse_environment_presentation",
    environmentAssetProofConfig.environmentAssetId
  ].join("/");
  environmentScene.name = [
    "metaverse_environment_dynamic",
    environmentAssetProofConfig.environmentAssetId,
    environmentAssetProofConfig.lods[0]!.tier
  ].join("/");
  presentationGroup.add(environmentScene);
  anchorGroup.add(presentationGroup);
  for (const entry of entries ?? []) {
    presentationGroup.add(entry.anchorGroup);
  }
  for (const seat of seats ?? []) {
    presentationGroup.add(seat.anchorGroup);
  }
  applyDynamicPlacementTransform(
    anchorGroup,
    environmentAssetProofConfig,
    placement
  );

  return {
    anchorGroup,
    basePlacement: placement,
    collider: environmentAssetProofConfig.collider,
    entries,
    environmentAssetId: environmentAssetProofConfig.environmentAssetId,
    label: environmentAssetProofConfig.label,
    motionPhase: dynamicAssetIndex * 0.8,
    orientation: environmentAssetProofConfig.orientation,
    presentationGroup,
    scene: environmentScene,
    seats,
    traversalAffordance: environmentAssetProofConfig.traversalAffordance
  };
}

export async function loadMetaverseEnvironmentProofRuntime(
  environmentProofConfig: MetaverseEnvironmentProofConfig,
  createSceneAssetLoader: () => SceneAssetLoaderLike,
  findNamedNode: (
    scene: Group,
    nodeName: string,
    label: string
  ) => Object3D
): Promise<MetaverseEnvironmentProofRuntime> {
  const anchorGroup = new Group();
  const dynamicAssets: MetaverseEnvironmentDynamicAssetRuntime[] = [];
  const instancedAssets: MetaverseEnvironmentProofRuntime["instancedAssets"][number][] = [];
  const staticPlacements: MetaverseEnvironmentProofRuntime["staticPlacements"][number][] = [];
  const materialDefinitions =
    environmentProofConfig.materialDefinitions ?? Object.freeze([]);

  anchorGroup.name = "metaverse_environment";

  for (const terrainPatch of environmentProofConfig.terrainPatches ?? []) {
    anchorGroup.add(createTerrainPatchGroup(terrainPatch));
  }

  for (const surfaceMesh of environmentProofConfig.surfaceMeshes ?? []) {
    anchorGroup.add(
      createSurfaceMeshGroup(surfaceMesh, materialDefinitions)
    );
  }

  for (const structure of environmentProofConfig.proceduralStructures ?? []) {
    anchorGroup.add(
      createProceduralStructureGroup(structure, materialDefinitions)
    );
  }

  for (const volume of environmentProofConfig.gameplayVolumes ?? []) {
    anchorGroup.add(createGameplayVolumeGroup(volume));
  }

  for (const semanticLight of environmentProofConfig.lights ?? []) {
    addSemanticLight(anchorGroup, semanticLight);
  }

  for (const [
    environmentAssetIndex,
    environmentAssetProofConfig
  ] of (environmentProofConfig.assets ?? []).entries()) {
    if (environmentAssetProofConfig.placement === "dynamic") {
      const dynamicAssetRuntime = await loadDynamicEnvironmentAssetProofRuntime(
        environmentAssetProofConfig,
        createSceneAssetLoader,
        materialDefinitions,
        environmentAssetIndex,
        findNamedNode
      );

      dynamicAssets.push(dynamicAssetRuntime);
      anchorGroup.add(dynamicAssetRuntime.anchorGroup);
      continue;
    }

    if (environmentAssetProofConfig.placement === "instanced") {
      const instancedAssetRuntime =
        await loadInstancedEnvironmentAssetProofRuntime(
          environmentAssetProofConfig,
          createSceneAssetLoader,
          materialDefinitions
        );

      instancedAssets.push(instancedAssetRuntime);
      anchorGroup.add(instancedAssetRuntime.anchorGroup);
      continue;
    }

    const staticAssetRuntime = await loadStaticEnvironmentAssetProofRuntime(
      environmentAssetProofConfig,
      createSceneAssetLoader,
      materialDefinitions
    );

    staticPlacements.push(...staticAssetRuntime.placements);
    anchorGroup.add(staticAssetRuntime.anchorGroup);
  }

  return {
    anchorGroup,
    dynamicAssets,
    instancedAssets,
    staticPlacements
  };
}
