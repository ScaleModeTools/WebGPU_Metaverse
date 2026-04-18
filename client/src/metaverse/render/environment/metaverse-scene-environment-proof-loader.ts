import {
  BoxGeometry,
  BundleGroup,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Object3D
} from "three/webgpu";
import { color, float } from "three/tsl";

import type {
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentLodProofConfig,
  MetaverseEnvironmentPlacementProofConfig,
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
  object.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  object.rotation.y = placement.rotationYRadians;
  object.scale.setScalar(placement.scale);
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
  createSceneAssetLoader: () => SceneAssetLoaderLike
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
  createSceneAssetLoader: () => SceneAssetLoaderLike
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

      const instancedMesh = new InstancedMesh(
        sourceMesh.geometry,
        sourceMesh.material,
        environmentAssetProofConfig.placements.length
      );

      instancedMesh.name = `${lodGroup.name}/mesh-${meshIndex}`;

      environmentAssetProofConfig.placements.forEach(
        (placement, placementIndex) => {
          applyPlacementTransform(placementScratch, placement);
          instancedMesh.setMatrixAt(placementIndex, placementScratch.matrix);
        }
      );

      instancedMesh.instanceMatrix.needsUpdate = true;
      lodGroup.add(instancedMesh);
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
  dynamicAssetIndex: number,
  findNamedNode: (
    scene: Group,
    nodeName: string,
    label: string
  ) => Object3D,
  showSocketDebug: boolean
): Promise<MetaverseEnvironmentDynamicAssetRuntime> {
  if (
    environmentAssetProofConfig.traversalAffordance !== "mount" &&
    environmentAssetProofConfig.traversalAffordance !== "pushable"
  ) {
    throw new Error(
      `Metaverse dynamic environment asset ${environmentAssetProofConfig.label} must use mount or pushable affordance.`
    );
  }

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

        if (showSocketDebug) {
          const material = new MeshBasicNodeMaterial();

          material.colorNode = color(0.62, 0.96, 0.96);
          material.depthWrite = false;

          const marker = new Mesh(
            new SphereGeometry(0.08, 12, 10),
            material
          );

          marker.name = `seat_debug/${seat.seatId}`;
          authoredSeatNode.add(marker);
        }

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
      `Metaverse pushable environment asset ${environmentAssetProofConfig.label} cannot expose mount metadata.`
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
  applyPlacementTransform(anchorGroup, placement);

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
  ) => Object3D,
  showSocketDebug: boolean
): Promise<MetaverseEnvironmentProofRuntime> {
  const anchorGroup = new Group();
  const dynamicAssets: MetaverseEnvironmentDynamicAssetRuntime[] = [];
  const instancedAssets: MetaverseEnvironmentProofRuntime["instancedAssets"][number][] = [];
  const staticPlacements: MetaverseEnvironmentProofRuntime["staticPlacements"][number][] = [];

  anchorGroup.name = "metaverse_environment";

  for (const [
    environmentAssetIndex,
    environmentAssetProofConfig
  ] of environmentProofConfig.assets.entries()) {
    if (environmentAssetProofConfig.placement === "dynamic") {
      const dynamicAssetRuntime = await loadDynamicEnvironmentAssetProofRuntime(
        environmentAssetProofConfig,
        createSceneAssetLoader,
        environmentAssetIndex,
        findNamedNode,
        showSocketDebug
      );

      dynamicAssets.push(dynamicAssetRuntime);
      anchorGroup.add(dynamicAssetRuntime.anchorGroup);
      continue;
    }

    if (environmentAssetProofConfig.placement === "instanced") {
      const instancedAssetRuntime =
        await loadInstancedEnvironmentAssetProofRuntime(
          environmentAssetProofConfig,
          createSceneAssetLoader
        );

      instancedAssets.push(instancedAssetRuntime);
      anchorGroup.add(instancedAssetRuntime.anchorGroup);
      continue;
    }

    const staticAssetRuntime = await loadStaticEnvironmentAssetProofRuntime(
      environmentAssetProofConfig,
      createSceneAssetLoader
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
