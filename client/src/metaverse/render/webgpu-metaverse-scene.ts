import {
  AnimationClip,
  AnimationMixer,
  BackSide,
  Box3,
  BundleGroup,
  type Camera,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardNodeMaterial,
  MeshBasicNodeMaterial,
  type Object3D,
  PerspectiveCamera,
  Quaternion,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3
} from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  abs,
  cameraPosition,
  color,
  dot,
  float,
  mix,
  normalWorld,
  oneMinus,
  positionLocal,
  positionWorld,
  pow,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec3
} from "three/tsl";

import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
  MetaverseCharacterPresentationSnapshot,
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentColliderProofConfig,
  MetaverseEnvironmentLodProofConfig,
  MetaverseEnvironmentMountProofConfig,
  MetaverseEnvironmentPlacementProofConfig,
  MetaverseEnvironmentProofConfig,
  FocusedExperiencePortalSnapshot,
  FocusedMountableSnapshot,
  MetaverseCameraSnapshot,
  MountedEnvironmentSnapshot,
  MetaversePortalConfig,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";

export interface MetaverseSceneCanvasHost {
  readonly clientHeight: number;
  readonly clientWidth: number;
}

export interface MetaverseSceneRendererHost {
  compileAsync?(scene: Scene, camera: Camera): Promise<void>;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

interface PortalMeshRuntime {
  readonly anchorGroup: Group;
  readonly beamEmissiveStrengthNode: MutableNodeValue<number>;
  readonly beamMaterial: MeshStandardNodeMaterial;
  readonly beamOpacityNode: MutableNodeValue<number>;
  readonly experienceId: MetaversePortalConfig["experienceId"];
  readonly ringEmissiveStrengthNode: MutableNodeValue<number>;
  readonly ringMaterial: MeshStandardNodeMaterial;
  readonly rotorGroup: Group;
}

interface MutableNodeValue<TValue> {
  value: TValue;
}

interface PortalSharedRenderResources {
  readonly baseGeometry: CylinderGeometry;
  readonly beamGeometry: CylinderGeometry;
  readonly beaconGeometry: SphereGeometry;
  readonly innerHaloGeometry: TorusGeometry;
  readonly ringGeometry: TorusGeometry;
  readonly supportMaterial: MeshStandardNodeMaterial;
}

interface LoadedSceneAsset {
  readonly animations: readonly AnimationClip[];
  readonly scene: Group;
}

interface SceneAssetLoader {
  loadAsync(path: string): Promise<LoadedSceneAsset>;
}

interface MetaverseCharacterProofRuntime {
  readonly anchorGroup: Group;
  readonly mixer: AnimationMixer;
  readonly seatSocketNode: Object3D;
  readonly scene: Group;
}

interface MetaverseEnvironmentLodObjectRuntime {
  readonly maxDistanceMeters: number | null;
  readonly object: Group;
  readonly tier: string;
}

interface MetaverseEnvironmentStaticPlacementRuntime {
  activeLodIndex: number;
  readonly lods: readonly MetaverseEnvironmentLodObjectRuntime[];
  readonly placement: MetaverseEnvironmentPlacementProofConfig;
}

interface MetaverseEnvironmentInstancedAssetRuntime {
  activeLodIndex: number;
  readonly lods: readonly MetaverseEnvironmentLodObjectRuntime[];
  readonly placements: readonly MetaverseEnvironmentPlacementProofConfig[];
}

interface MetaverseEnvironmentProofRuntime {
  readonly anchorGroup: Group;
  readonly dynamicAssets: readonly MetaverseEnvironmentDynamicAssetRuntime[];
  readonly instancedAssets: readonly MetaverseEnvironmentInstancedAssetRuntime[];
  readonly staticPlacements: readonly MetaverseEnvironmentStaticPlacementRuntime[];
}

interface MetaverseEnvironmentDynamicAssetRuntime {
  readonly anchorGroup: Group;
  readonly basePlacement: MetaverseEnvironmentPlacementProofConfig;
  readonly collider: MetaverseEnvironmentColliderProofConfig;
  readonly environmentAssetId: string;
  readonly label: string;
  readonly motionPhase: number;
  readonly mount: MetaverseEnvironmentMountProofConfig;
  readonly scene: Group;
  readonly seatSocketNode: Object3D;
}

interface MountedCharacterRuntime {
  readonly environmentAsset: MetaverseEnvironmentDynamicAssetRuntime;
  readonly previousParent: Object3D;
  readonly previousPosition: Vector3;
  readonly previousQuaternion: Quaternion;
  readonly previousScale: Vector3;
}

interface MetaverseSceneInteractionSnapshot {
  readonly focusedMountable: FocusedMountableSnapshot | null;
  readonly mountedEnvironment: MountedEnvironmentSnapshot | null;
}

interface MetaverseSceneDependencies {
  attachmentProofConfig?: MetaverseAttachmentProofConfig | null;
  characterProofConfig?: MetaverseCharacterProofConfig | null;
  environmentProofConfig?: MetaverseEnvironmentProofConfig | null;
  createSceneAssetLoader?: () => SceneAssetLoader;
  warn?: (message: string) => void;
}

const socketDebugMarkerColors = {
  hand_l_socket: [0.28, 0.72, 1],
  hand_r_socket: [1, 0.42, 0.34],
  head_socket: [1, 0.92, 0.34],
  hip_socket: [0.45, 1, 0.56],
  seat_socket: [0.62, 0.96, 0.96]
} as const satisfies Readonly<Record<string, readonly [number, number, number]>>;

const metaverseCharacterAnchorPosition = Object.freeze({
  x: 11,
  y: 0,
  z: -18
});

const metaverseCharacterProofAnchorRotationYRadians = Math.PI * 0.86;

const metaverseCharacterScaleBoundsMeters = Object.freeze({
  max: 2.4,
  min: 1.2
});

const environmentLodSwitchHysteresisMeters = 1.25;

function createDefaultSceneAssetLoader(): SceneAssetLoader {
  return new GLTFLoader() as SceneAssetLoader;
}

function toThreeColor(rgb: readonly [number, number, number]): Color {
  return new Color(rgb[0], rgb[1], rgb[2]);
}

function createSocketDebugMarker(socketName: string): Mesh {
  const material = new MeshBasicNodeMaterial();
  const markerColor =
    socketDebugMarkerColors[socketName as keyof typeof socketDebugMarkerColors];

  if (markerColor === undefined) {
    throw new Error(`Metaverse character proof slice is missing a debug color for ${socketName}.`);
  }

  material.colorNode = color(...markerColor);
  material.depthWrite = false;

  const marker = new Mesh(new SphereGeometry(0.08, 12, 10), material);

  marker.name = `socket_debug/${socketName}`;

  return marker;
}

function findSocketNode(characterScene: Group, socketName: string): Object3D {
  const socketNode = characterScene.getObjectByName(socketName);

  if (
    socketNode === undefined ||
    !("isBone" in socketNode) ||
    socketNode.isBone !== true
  ) {
    throw new Error(`Metaverse character is missing required socket bone: ${socketName}`);
  }

  return socketNode;
}

function findNamedNode(scene: Group, nodeName: string, label: string): Object3D {
  const node = scene.getObjectByName(nodeName);

  if (node === undefined) {
    throw new Error(`${label} is missing required node ${nodeName}.`);
  }

  return node;
}

function ensureSkinnedMesh(characterScene: Group): void {
  let hasSkinnedMesh = false;

  characterScene.traverse((node) => {
    if ("isSkinnedMesh" in node && node.isSkinnedMesh === true) {
      hasSkinnedMesh = true;
    }
  });

  if (!hasSkinnedMesh) {
    throw new Error("Metaverse character proof slice requires at least one skinned mesh.");
  }
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
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    node.matrixAutoUpdate = false;
    node.matrixWorldAutoUpdate = false;
  });
}

function createStaticBundleGroup(name: string): BundleGroup {
  const bundleGroup = new BundleGroup();

  bundleGroup.name = name;
  bundleGroup.static = true;

  return bundleGroup;
}

function markSceneBundleGroupsDirty(scene: Scene): void {
  scene.traverse((node) => {
    if ("isBundleGroup" in node && node.isBundleGroup === true) {
      (node as BundleGroup).needsUpdate = true;
    }
  });
}

function applyPlacementTransform(
  object: Group,
  placement: MetaverseEnvironmentPlacementProofConfig
): void {
  object.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  object.rotation.y = placement.rotationYRadians;
  object.scale.setScalar(placement.scale);
  object.updateMatrixWorld(true);
}

function resolveEnvironmentLodIndexForDistance(
  lods: readonly MetaverseEnvironmentLodObjectRuntime[],
  distanceSquared: number
): number {
  for (let lodIndex = 0; lodIndex < lods.length; lodIndex += 1) {
    const maxDistanceMeters = lods[lodIndex]?.maxDistanceMeters;

    if (maxDistanceMeters === null) {
      return lodIndex;
    }

    if (
      maxDistanceMeters !== undefined &&
      distanceSquared <= maxDistanceMeters * maxDistanceMeters
    ) {
      return lodIndex;
    }
  }

  return Math.max(0, lods.length - 1);
}

function resolveEnvironmentLodIndex(
  lods: readonly MetaverseEnvironmentLodObjectRuntime[],
  activeLodIndex: number,
  distanceSquared: number
): number {
  const resolvedLodIndex = resolveEnvironmentLodIndexForDistance(lods, distanceSquared);

  if (
    activeLodIndex < 0 ||
    activeLodIndex >= lods.length ||
    resolvedLodIndex === activeLodIndex
  ) {
    return resolvedLodIndex;
  }

  if (resolvedLodIndex > activeLodIndex) {
    const activeMaxDistanceMeters = lods[activeLodIndex]?.maxDistanceMeters;

    if (
      activeMaxDistanceMeters !== null &&
      activeMaxDistanceMeters !== undefined &&
      distanceSquared <=
        (activeMaxDistanceMeters + environmentLodSwitchHysteresisMeters) ** 2
    ) {
      return activeLodIndex;
    }

    return resolvedLodIndex;
  }

  const nextSharperLodMaxDistanceMeters = lods[activeLodIndex - 1]?.maxDistanceMeters;

  if (
    nextSharperLodMaxDistanceMeters !== null &&
    nextSharperLodMaxDistanceMeters !== undefined &&
    distanceSquared >=
      Math.max(
        0,
        nextSharperLodMaxDistanceMeters - environmentLodSwitchHysteresisMeters
      ) ** 2
  ) {
    return activeLodIndex;
  }

  return resolvedLodIndex;
}

function setEnvironmentLodVisibility(
  lods: readonly MetaverseEnvironmentLodObjectRuntime[],
  lodIndex: number
): void {
  for (let index = 0; index < lods.length; index += 1) {
    lods[index]!.object.visible = index === lodIndex;
  }
}

function measurePlacementDistanceSquared(
  cameraSnapshot: MetaverseCameraSnapshot,
  placement: MetaverseEnvironmentPlacementProofConfig
): number {
  const dx = cameraSnapshot.position.x - placement.position.x;
  const dy = cameraSnapshot.position.y - placement.position.y;
  const dz = cameraSnapshot.position.z - placement.position.z;

  return dx * dx + dy * dy + dz * dz;
}

function syncEnvironmentProofRuntime(
  environmentProofRuntime: MetaverseEnvironmentProofRuntime,
  cameraSnapshot: MetaverseCameraSnapshot,
  nowMs: number
): void {
  for (const staticPlacementRuntime of environmentProofRuntime.staticPlacements) {
    const lodIndex = resolveEnvironmentLodIndex(
      staticPlacementRuntime.lods,
      staticPlacementRuntime.activeLodIndex,
      measurePlacementDistanceSquared(cameraSnapshot, staticPlacementRuntime.placement)
    );

    if (lodIndex !== staticPlacementRuntime.activeLodIndex) {
      setEnvironmentLodVisibility(staticPlacementRuntime.lods, lodIndex);
      staticPlacementRuntime.activeLodIndex = lodIndex;
    }
  }

  for (const instancedAssetRuntime of environmentProofRuntime.instancedAssets) {
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;

    for (const placement of instancedAssetRuntime.placements) {
      const distanceSquared = measurePlacementDistanceSquared(cameraSnapshot, placement);

      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
      }
    }

    const lodIndex = resolveEnvironmentLodIndex(
      instancedAssetRuntime.lods,
      instancedAssetRuntime.activeLodIndex,
      nearestDistanceSquared
    );

    if (lodIndex !== instancedAssetRuntime.activeLodIndex) {
      setEnvironmentLodVisibility(instancedAssetRuntime.lods, lodIndex);
      instancedAssetRuntime.activeLodIndex = lodIndex;
    }
  }

  for (const dynamicAssetRuntime of environmentProofRuntime.dynamicAssets) {
    dynamicAssetRuntime.anchorGroup.position.set(
      dynamicAssetRuntime.basePlacement.position.x,
      dynamicAssetRuntime.basePlacement.position.y +
        Math.sin(nowMs * 0.0014 + dynamicAssetRuntime.motionPhase) * 0.18,
      dynamicAssetRuntime.basePlacement.position.z
    );
    dynamicAssetRuntime.anchorGroup.rotation.set(
      Math.sin(nowMs * 0.001 + dynamicAssetRuntime.motionPhase) * 0.03,
      dynamicAssetRuntime.basePlacement.rotationYRadians +
        Math.sin(nowMs * 0.0008 + dynamicAssetRuntime.motionPhase) * 0.05,
      Math.sin(nowMs * 0.0011 + dynamicAssetRuntime.motionPhase) * 0.04
    );
    dynamicAssetRuntime.anchorGroup.scale.setScalar(dynamicAssetRuntime.basePlacement.scale);
    dynamicAssetRuntime.anchorGroup.updateMatrixWorld(true);
  }
}

function createSceneInteractionSnapshot(
  focusedMountable: FocusedMountableSnapshot | null,
  mountedEnvironment: MountedEnvironmentSnapshot | null
): MetaverseSceneInteractionSnapshot {
  return Object.freeze({
    focusedMountable,
    mountedEnvironment
  });
}

function resolveMountedEnvironmentSnapshot(
  mountedCharacterRuntime: MountedCharacterRuntime | null
): MountedEnvironmentSnapshot | null {
  if (mountedCharacterRuntime === null) {
    return null;
  }

  return Object.freeze({
    environmentAssetId: mountedCharacterRuntime.environmentAsset.environmentAssetId,
    label: mountedCharacterRuntime.environmentAsset.label
  });
}

function resolveFocusedMountableEnvironmentRuntime(
  environmentProofRuntime: MetaverseEnvironmentProofRuntime,
  cameraSnapshot: MetaverseCameraSnapshot
): {
  readonly distanceFromCamera: number;
  readonly environmentAsset: MetaverseEnvironmentDynamicAssetRuntime;
} | null {
  let nearestEnvironmentAsset:
    | {
        readonly distanceFromCamera: number;
        readonly environmentAsset: MetaverseEnvironmentDynamicAssetRuntime;
      }
    | null = null;

  for (const environmentAsset of environmentProofRuntime.dynamicAssets) {
    const localCameraPosition = environmentAsset.anchorGroup.worldToLocal(
      new Vector3(
        cameraSnapshot.position.x,
        cameraSnapshot.position.y,
        cameraSnapshot.position.z
      )
    );
    const halfExtentX = environmentAsset.collider.size.x * 0.5;
    const halfExtentY = environmentAsset.collider.size.y * 0.5;
    const halfExtentZ = environmentAsset.collider.size.z * 0.5;
    const offsetX = Math.abs(localCameraPosition.x - environmentAsset.collider.center.x);
    const offsetY = Math.abs(localCameraPosition.y - environmentAsset.collider.center.y);
    const offsetZ = Math.abs(localCameraPosition.z - environmentAsset.collider.center.z);

    if (
      offsetX > halfExtentX ||
      offsetY > halfExtentY ||
      offsetZ > halfExtentZ
    ) {
      continue;
    }

    const distanceFromCamera = Math.hypot(
      localCameraPosition.x - environmentAsset.collider.center.x,
      localCameraPosition.y - environmentAsset.collider.center.y,
      localCameraPosition.z - environmentAsset.collider.center.z
    );

    if (
      nearestEnvironmentAsset === null ||
      distanceFromCamera < nearestEnvironmentAsset.distanceFromCamera
    ) {
      nearestEnvironmentAsset = {
        distanceFromCamera,
        environmentAsset
      };
    }
  }

  return nearestEnvironmentAsset;
}

function resolveFocusedMountableSnapshot(
  environmentProofRuntime: MetaverseEnvironmentProofRuntime | null,
  mountedCharacterRuntime: MountedCharacterRuntime | null,
  cameraSnapshot: MetaverseCameraSnapshot
): FocusedMountableSnapshot | null {
  if (
    environmentProofRuntime === null ||
    mountedCharacterRuntime !== null
  ) {
    return null;
  }

  const focusedEnvironment = resolveFocusedMountableEnvironmentRuntime(
    environmentProofRuntime,
    cameraSnapshot
  );

  if (focusedEnvironment === null) {
    return null;
  }

  return Object.freeze({
    distanceFromCamera: focusedEnvironment.distanceFromCamera,
    environmentAssetId: focusedEnvironment.environmentAsset.environmentAssetId,
    label: focusedEnvironment.environmentAsset.label
  });
}

function applyCharacterSeatMountTransform(
  characterProofRuntime: MetaverseCharacterProofRuntime
): void {
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
  characterProofRuntime.anchorGroup.matrixWorld
    .clone()
    .invert()
    .multiply(characterProofRuntime.seatSocketNode.matrixWorld)
    .invert()
    .decompose(
    characterProofRuntime.anchorGroup.position,
    characterProofRuntime.anchorGroup.quaternion,
    characterProofRuntime.anchorGroup.scale
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
}

function syncCharacterPresentation(
  characterProofRuntime: MetaverseCharacterProofRuntime,
  characterPresentation: MetaverseCharacterPresentationSnapshot | null,
  mountedCharacterRuntime: MountedCharacterRuntime | null
): void {
  const shouldShowCharacter =
    characterPresentation !== null || mountedCharacterRuntime !== null;

  characterProofRuntime.anchorGroup.visible = shouldShowCharacter;

  if (characterPresentation === null || mountedCharacterRuntime !== null) {
    return;
  }

  characterProofRuntime.anchorGroup.position.set(
    characterPresentation.position.x,
    characterPresentation.position.y,
    characterPresentation.position.z
  );
  characterProofRuntime.anchorGroup.rotation.set(
    0,
    characterPresentation.yawRadians,
    0
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
}

function mountCharacterOnEnvironmentAsset(
  characterProofRuntime: MetaverseCharacterProofRuntime,
  environmentAsset: MetaverseEnvironmentDynamicAssetRuntime
): MountedCharacterRuntime {
  const previousParent = characterProofRuntime.anchorGroup.parent;

  if (previousParent === null) {
    throw new Error("Metaverse character proof slice cannot mount without a parent anchor.");
  }

  const mountedCharacterRuntime = {
    environmentAsset,
    previousParent,
    previousPosition: characterProofRuntime.anchorGroup.position.clone(),
    previousQuaternion: characterProofRuntime.anchorGroup.quaternion.clone(),
    previousScale: characterProofRuntime.anchorGroup.scale.clone()
  } as const satisfies MountedCharacterRuntime;

  environmentAsset.seatSocketNode.add(characterProofRuntime.anchorGroup);
  applyCharacterSeatMountTransform(characterProofRuntime);

  return mountedCharacterRuntime;
}

function dismountCharacterFromEnvironmentAsset(
  characterProofRuntime: MetaverseCharacterProofRuntime,
  mountedCharacterRuntime: MountedCharacterRuntime
): void {
  mountedCharacterRuntime.previousParent.add(characterProofRuntime.anchorGroup);
  characterProofRuntime.anchorGroup.position.copy(mountedCharacterRuntime.previousPosition);
  characterProofRuntime.anchorGroup.quaternion.copy(
    mountedCharacterRuntime.previousQuaternion
  );
  characterProofRuntime.anchorGroup.scale.copy(mountedCharacterRuntime.previousScale);
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
}

function validateCharacterScale(
  characterScene: Group,
  label: string,
  warn: (message: string) => void
): void {
  const bounds = new Box3().setFromObject(characterScene);
  const size = bounds.getSize(new Vector3());

  if (size.y <= 0) {
    throw new Error(`Metaverse character ${label} produced an empty render bounds box.`);
  }

  if (
    size.y < metaverseCharacterScaleBoundsMeters.min ||
    size.y > metaverseCharacterScaleBoundsMeters.max
  ) {
    warn(
      `Metaverse character ${label} rendered at ${size.y.toFixed(2)}m tall; expected ${metaverseCharacterScaleBoundsMeters.min.toFixed(2)}-${metaverseCharacterScaleBoundsMeters.max.toFixed(2)}m.`
    );
  }
}

async function loadMetaverseCharacterProofRuntime(
  characterProofConfig: MetaverseCharacterProofConfig,
  createSceneAssetLoader: () => SceneAssetLoader,
  warn: (message: string) => void
): Promise<MetaverseCharacterProofRuntime> {
  const sceneAssetLoader = createSceneAssetLoader();
  const characterAsset = await sceneAssetLoader.loadAsync(characterProofConfig.modelPath);
  const animationAsset =
    characterProofConfig.animationSourcePath === characterProofConfig.modelPath
      ? characterAsset
      : await sceneAssetLoader.loadAsync(characterProofConfig.animationSourcePath);
  const idleClip = animationAsset.animations.find(
    (animation) => animation.name === characterProofConfig.animationClipName
  );

  if (idleClip === undefined) {
    throw new Error(
      `Metaverse character ${characterProofConfig.characterId} is missing animation ${characterProofConfig.animationClipName}.`
    );
  }

  ensureSkinnedMesh(characterAsset.scene);

  for (const socketName of characterProofConfig.socketNames) {
    const socketNode = findSocketNode(characterAsset.scene, socketName);

    socketNode.add(createSocketDebugMarker(socketName));
  }

  validateCharacterScale(characterAsset.scene, characterProofConfig.label, warn);

  const anchorGroup = new Group();
  const seatSocketNode = findSocketNode(characterAsset.scene, "seat_socket");

  anchorGroup.name = `metaverse_character/${characterProofConfig.characterId}`;
  anchorGroup.position.set(
    metaverseCharacterAnchorPosition.x,
    metaverseCharacterAnchorPosition.y,
    metaverseCharacterAnchorPosition.z
  );
  anchorGroup.rotation.y = metaverseCharacterProofAnchorRotationYRadians;
  anchorGroup.add(characterAsset.scene);
  anchorGroup.updateMatrixWorld(true);
  const mixer = new AnimationMixer(characterAsset.scene);
  const idleAction = mixer.clipAction(idleClip);

  idleAction.play();

  return {
    anchorGroup,
    mixer,
    seatSocketNode,
    scene: characterAsset.scene
  };
}

async function loadMetaverseAttachmentProofRuntime(
  attachmentProofConfig: MetaverseAttachmentProofConfig,
  characterProofRuntime: MetaverseCharacterProofRuntime,
  createSceneAssetLoader: () => SceneAssetLoader
): Promise<void> {
  const sceneAssetLoader = createSceneAssetLoader();
  const attachmentAsset = await sceneAssetLoader.loadAsync(attachmentProofConfig.modelPath);
  const socketNode = findSocketNode(
    characterProofRuntime.scene,
    attachmentProofConfig.socketName
  );
  const attachmentRoot = new Group();

  attachmentRoot.name = `metaverse_attachment/${attachmentProofConfig.attachmentId}`;
  attachmentRoot.add(attachmentAsset.scene);
  socketNode.add(attachmentRoot);
}

async function loadEnvironmentLodObjects(
  environmentAssetProofConfig: MetaverseEnvironmentAssetProofConfig,
  createSceneAssetLoader: () => SceneAssetLoader
): Promise<readonly (LoadedSceneAsset & { readonly config: MetaverseEnvironmentLodProofConfig })[]> {
  const sceneAssetLoader = createSceneAssetLoader();

  return Promise.all(
    environmentAssetProofConfig.lods.map(async (lodConfig) => ({
      config: lodConfig,
      ...(await sceneAssetLoader.loadAsync(lodConfig.modelPath))
    }))
  );
}

async function loadStaticEnvironmentAssetProofRuntime(
  environmentAssetProofConfig: MetaverseEnvironmentAssetProofConfig,
  createSceneAssetLoader: () => SceneAssetLoader
): Promise<{
  readonly anchorGroup: Group;
  readonly placements: readonly MetaverseEnvironmentStaticPlacementRuntime[];
}> {
  const loadedLodAssets = await loadEnvironmentLodObjects(
    environmentAssetProofConfig,
    createSceneAssetLoader
  );
  const anchorGroup = new Group();
  const placements = environmentAssetProofConfig.placements.map((placement, placementIndex) => {
    const placementAnchor = new Group();
    const lods = loadedLodAssets.map(({ config, scene: loadedScene }) => {
      const lodScene = cloneGroup(loadedScene);
      const lodBundle = createStaticBundleGroup(
        [
          "metaverse_environment_static",
          environmentAssetProofConfig.environmentAssetId,
          String(placementIndex),
          config.tier
        ].join("/")
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
      lods,
      placement
    };
  });

  anchorGroup.name = `metaverse_environment_asset/${environmentAssetProofConfig.environmentAssetId}`;
  finalizeStaticSceneGraph(anchorGroup);

  return {
    anchorGroup,
    placements
  };
}

async function loadInstancedEnvironmentAssetProofRuntime(
  environmentAssetProofConfig: MetaverseEnvironmentAssetProofConfig,
  createSceneAssetLoader: () => SceneAssetLoader
): Promise<MetaverseEnvironmentInstancedAssetRuntime & { readonly anchorGroup: Group }> {
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
    const lodGroup = createStaticBundleGroup(
      [
        "metaverse_environment_lod",
        environmentAssetProofConfig.environmentAssetId,
        config.tier
      ].join("/")
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

      environmentAssetProofConfig.placements.forEach((placement, placementIndex) => {
        applyPlacementTransform(placementScratch, placement);
        instancedMesh.setMatrixAt(placementIndex, placementScratch.matrix);
      });

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
    lods,
    placements: environmentAssetProofConfig.placements
  };
}

async function loadDynamicEnvironmentAssetProofRuntime(
  environmentAssetProofConfig: MetaverseEnvironmentAssetProofConfig,
  createSceneAssetLoader: () => SceneAssetLoader,
  dynamicAssetIndex: number
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

  if (environmentAssetProofConfig.mount === null) {
    throw new Error(
      `Metaverse dynamic environment asset ${environmentAssetProofConfig.label} requires mount metadata.`
    );
  }

  const sceneAssetLoader = createSceneAssetLoader();
  const environmentAsset = await sceneAssetLoader.loadAsync(
    environmentAssetProofConfig.lods[0]!.modelPath
  );
  const anchorGroup = new Group();
  const placement = environmentAssetProofConfig.placements[0]!;
  const environmentScene = environmentAsset.scene;
  const seatSocketNode = findNamedNode(
    environmentScene,
    environmentAssetProofConfig.mount.seatSocketName,
    `Metaverse dynamic environment asset ${environmentAssetProofConfig.label}`
  );

  anchorGroup.name = `metaverse_environment_asset/${environmentAssetProofConfig.environmentAssetId}`;
  environmentScene.name = [
    "metaverse_environment_dynamic",
    environmentAssetProofConfig.environmentAssetId,
    environmentAssetProofConfig.lods[0]!.tier
  ].join("/");
  seatSocketNode.add(createSocketDebugMarker(environmentAssetProofConfig.mount.seatSocketName));
  anchorGroup.add(environmentScene);
  applyPlacementTransform(anchorGroup, placement);

  return {
    anchorGroup,
    basePlacement: placement,
    collider: environmentAssetProofConfig.collider,
    environmentAssetId: environmentAssetProofConfig.environmentAssetId,
    label: environmentAssetProofConfig.label,
    motionPhase: dynamicAssetIndex * 0.8,
    mount: environmentAssetProofConfig.mount,
    scene: environmentScene,
    seatSocketNode
  };
}

async function loadMetaverseEnvironmentProofRuntime(
  environmentProofConfig: MetaverseEnvironmentProofConfig,
  createSceneAssetLoader: () => SceneAssetLoader
): Promise<MetaverseEnvironmentProofRuntime> {
  const anchorGroup = new Group();
  const dynamicAssets: MetaverseEnvironmentDynamicAssetRuntime[] = [];
  const instancedAssets: MetaverseEnvironmentInstancedAssetRuntime[] = [];
  const staticPlacements: MetaverseEnvironmentStaticPlacementRuntime[] = [];

  anchorGroup.name = "metaverse_environment";

  for (const [environmentAssetIndex, environmentAssetProofConfig] of environmentProofConfig.assets.entries()) {
    if (environmentAssetProofConfig.placement === "dynamic") {
      const dynamicAssetRuntime = await loadDynamicEnvironmentAssetProofRuntime(
        environmentAssetProofConfig,
        createSceneAssetLoader,
        environmentAssetIndex
      );

      dynamicAssets.push(dynamicAssetRuntime);
      anchorGroup.add(dynamicAssetRuntime.anchorGroup);
      continue;
    }

    if (environmentAssetProofConfig.placement === "instanced") {
      const instancedAssetRuntime = await loadInstancedEnvironmentAssetProofRuntime(
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

function syncCamera(
  camera: PerspectiveCamera,
  cameraSnapshot: MetaverseCameraSnapshot
): void {
  camera.position.set(
    cameraSnapshot.position.x,
    cameraSnapshot.position.y,
    cameraSnapshot.position.z
  );
  camera.lookAt(
    cameraSnapshot.position.x + cameraSnapshot.lookDirection.x,
    cameraSnapshot.position.y + cameraSnapshot.lookDirection.y,
    cameraSnapshot.position.z + cameraSnapshot.lookDirection.z
  );
  camera.updateMatrixWorld(true);
}

function createHemisphereLight(
  config: MetaverseRuntimeConfig
): HemisphereLight {
  const light = new HemisphereLight(
    toThreeColor(config.environment.zenithColor),
    toThreeColor(config.ocean.farColor),
    1.8
  );

  light.position.set(0, 1, 0);

  return light;
}

function createSunLight(config: MetaverseRuntimeConfig): DirectionalLight {
  const light = new DirectionalLight(
    toThreeColor(config.environment.sunColor),
    2.2
  );
  const { sunDirection } = config.environment;
  const sunOffset = new Vector3(
    -sunDirection.x * 120,
    -sunDirection.y * 120,
    -sunDirection.z * 120
  );

  light.position.copy(sunOffset);
  light.target.position.set(0, 0, 0);
  light.target.updateMatrixWorld();

  return light;
}

function createSkyMesh(config: MetaverseRuntimeConfig): Mesh {
  const skyMaterial = new MeshBasicNodeMaterial({
    side: BackSide
  });
  const sunDirection = vec3(
    config.environment.sunDirection.x,
    config.environment.sunDirection.y,
    config.environment.sunDirection.z
  ).normalize();
  const horizonBlend = smoothstep(-0.15, 0.85, normalWorld.y);
  const sunAmount = dot(normalWorld, sunDirection).max(0);
  const sunHalo = pow(sunAmount, 18).mul(0.36);
  const sunDisc = pow(sunAmount, 120).mul(0.92);

  skyMaterial.colorNode = mix(
    color(...config.environment.horizonColor),
    color(...config.environment.zenithColor),
    horizonBlend
  ).add(color(...config.environment.sunColor).mul(sunHalo.add(sunDisc)));
  skyMaterial.depthWrite = false;

  return new Mesh(
    new SphereGeometry(config.environment.domeRadius, 48, 24),
    skyMaterial
  );
}

function createOceanMesh(config: MetaverseRuntimeConfig): Mesh {
  const oceanMaterial = new MeshStandardNodeMaterial({
    side: DoubleSide
  });
  const wavePrimary = sin(
    positionLocal.x
      .mul(config.ocean.waveFrequencies.primary)
      .add(time.mul(config.ocean.waveSpeeds.primary))
  );
  const waveSecondary = sin(
    positionLocal.y
      .mul(config.ocean.waveFrequencies.secondary)
      .add(time.mul(config.ocean.waveSpeeds.secondary))
  );
  const waveRipple = sin(
    positionLocal.x
      .add(positionLocal.y)
      .mul(config.ocean.waveFrequencies.ripple)
      .add(time.mul(config.ocean.waveSpeeds.ripple))
  );
  const waveHeight = wavePrimary
    .mul(0.56)
    .add(waveSecondary.mul(0.34))
    .add(waveRipple.mul(0.18))
    .mul(config.ocean.waveAmplitude);
  const depthBlend = smoothstep(0.08, 1, uv().y);
  const viewDirection = cameraPosition.sub(positionWorld).normalize();
  const fresnel = pow(oneMinus(abs(dot(normalWorld, viewDirection))), 3);

  oceanMaterial.positionNode = positionLocal.add(vec3(0, 0, waveHeight));
  oceanMaterial.colorNode = mix(
    color(...config.ocean.nearColor),
    color(...config.ocean.farColor),
    depthBlend
  ).add(color(...config.environment.sunColor).mul(fresnel.mul(0.12)));
  oceanMaterial.emissiveNode = color(...config.ocean.emissiveColor).mul(
    fresnel.mul(0.48).add(abs(waveRipple).mul(0.03))
  );
  oceanMaterial.roughnessNode = float(config.ocean.roughness);
  oceanMaterial.metalnessNode = float(0.02);

  const oceanMesh = new Mesh(
    new PlaneGeometry(
      config.ocean.planeWidth,
      config.ocean.planeDepth,
      config.ocean.segmentCount,
      config.ocean.segmentCount
    ),
    oceanMaterial
  );

  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.y = config.ocean.height;

  return oceanMesh;
}

function createPortalSharedRenderResources(): PortalSharedRenderResources {
  const supportMaterial = new MeshStandardNodeMaterial();

  supportMaterial.colorNode = color(0.18, 0.23, 0.29);
  supportMaterial.emissiveNode = color(0.06, 0.09, 0.12);
  supportMaterial.roughnessNode = float(0.36);
  supportMaterial.metalnessNode = float(0.12);

  return {
    baseGeometry: new CylinderGeometry(4.4, 6.2, 1.2, 32),
    beamGeometry: new CylinderGeometry(1.2, 2.1, 9.4, 24),
    beaconGeometry: new SphereGeometry(0.72, 18, 12),
    innerHaloGeometry: new TorusGeometry(3.7, 0.08, 16, 40),
    ringGeometry: new TorusGeometry(4.9, 0.44, 20, 48),
    supportMaterial
  };
}

function createPortalMeshRuntime(
  portalConfig: MetaversePortalConfig,
  sharedRenderResources: PortalSharedRenderResources
): PortalMeshRuntime {
  const anchorGroup = new Group();
  const rotorGroup = new Group();
  const ringMaterial = new MeshStandardNodeMaterial();
  const beamMaterial = new MeshStandardNodeMaterial({
    transparent: true
  });
  const ringColorNode = uniform(toThreeColor(portalConfig.ringColor));
  const beamColorNode = uniform(toThreeColor(portalConfig.beamColor));
  const ringEmissiveStrengthNode = uniform(0.24);
  const beamEmissiveStrengthNode = uniform(0.34);
  const beamOpacityNode = uniform(0.76);
  const portalNamePrefix = `metaverse_portal/${portalConfig.experienceId}`;
  const baseMesh = new Mesh(
    sharedRenderResources.baseGeometry,
    sharedRenderResources.supportMaterial
  );
  const ringMesh = new Mesh(sharedRenderResources.ringGeometry, ringMaterial);
  const innerHaloMesh = new Mesh(
    sharedRenderResources.innerHaloGeometry,
    beamMaterial
  );
  const beamMesh = new Mesh(sharedRenderResources.beamGeometry, beamMaterial);
  const beaconMesh = new Mesh(sharedRenderResources.beaconGeometry, ringMaterial);

  anchorGroup.name = portalNamePrefix;
  rotorGroup.name = `${portalNamePrefix}/rotor`;
  baseMesh.name = `${portalNamePrefix}/base`;
  ringMesh.name = `${portalNamePrefix}/ring`;
  innerHaloMesh.name = `${portalNamePrefix}/inner-halo`;
  beamMesh.name = `${portalNamePrefix}/beam`;
  beaconMesh.name = `${portalNamePrefix}/beacon`;

  ringMaterial.colorNode = ringColorNode;
  ringMaterial.emissiveNode = ringColorNode.mul(ringEmissiveStrengthNode);
  ringMaterial.roughnessNode = float(0.18);
  ringMaterial.metalnessNode = float(0.08);
  beamMaterial.colorNode = beamColorNode;
  beamMaterial.emissiveNode = beamColorNode.mul(beamEmissiveStrengthNode);
  beamMaterial.roughnessNode = float(0.3);
  beamMaterial.metalnessNode = float(0);
  beamMaterial.opacityNode = beamOpacityNode;

  baseMesh.position.y = 0.3;
  ringMesh.position.y = 5.4;
  ringMesh.rotation.y = Math.PI * 0.08;
  innerHaloMesh.position.y = 5.4;
  innerHaloMesh.rotation.y = Math.PI * 0.08;
  beamMesh.position.y = 5.2;
  beaconMesh.position.y = 10.6;

  rotorGroup.add(ringMesh, innerHaloMesh, beamMesh, beaconMesh);
  anchorGroup.add(baseMesh, rotorGroup);
  anchorGroup.position.set(
    portalConfig.position.x,
    portalConfig.position.y,
    portalConfig.position.z
  );

  return {
    anchorGroup,
    beamEmissiveStrengthNode,
    beamMaterial,
    beamOpacityNode,
    experienceId: portalConfig.experienceId,
    ringEmissiveStrengthNode,
    ringMaterial,
    rotorGroup
  };
}

function syncPortalPresentation(
  portalRuntime: PortalMeshRuntime,
  focusedPortal: FocusedExperiencePortalSnapshot | null,
  nowMs: number
): void {
  const isFocused = focusedPortal?.experienceId === portalRuntime.experienceId;
  const pulse = 0.85 + Math.sin(nowMs * 0.004) * 0.08;
  const focusBoost = isFocused ? 1.45 : 1;

  portalRuntime.rotorGroup.rotation.y = nowMs * 0.00032;
  portalRuntime.rotorGroup.position.y = Math.sin(nowMs * 0.0024) * 0.2;
  portalRuntime.anchorGroup.scale.setScalar(isFocused ? 1.06 : 1);
  portalRuntime.ringEmissiveStrengthNode.value = 0.22 * pulse * focusBoost;
  portalRuntime.beamEmissiveStrengthNode.value = 0.28 * pulse * focusBoost;
  portalRuntime.beamOpacityNode.value = isFocused ? 0.92 : 0.76;
}

export function createMetaverseScene(
  config: MetaverseRuntimeConfig,
  dependencies: MetaverseSceneDependencies = {}
): {
  readonly camera: PerspectiveCamera;
  readonly scene: Scene;
  boot(): Promise<void>;
  resetPresentation(): void;
  prewarm(renderer: MetaverseSceneRendererHost): Promise<void>;
  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    focusedPortal: FocusedExperiencePortalSnapshot | null,
    nowMs: number,
    deltaSeconds: number,
    characterPresentation?: MetaverseCharacterPresentationSnapshot | null
  ): MetaverseSceneInteractionSnapshot;
  syncViewport(
    renderer: MetaverseSceneRendererHost,
    canvasHost: MetaverseSceneCanvasHost,
    devicePixelRatio: number
  ): void;
  toggleMount(cameraSnapshot: MetaverseCameraSnapshot): MetaverseSceneInteractionSnapshot;
} {
  const camera = new PerspectiveCamera(
    config.camera.fieldOfViewDegrees,
    1,
    config.camera.near,
    config.camera.far
  );
  const scene = new Scene();
  const skyMesh = createSkyMesh(config);
  const oceanMesh = createOceanMesh(config);
  const portalSharedRenderResources = createPortalSharedRenderResources();
  const portalMeshes = config.portals.map((portalConfig) =>
    createPortalMeshRuntime(portalConfig, portalSharedRenderResources)
  );
  let characterProofRuntime: MetaverseCharacterProofRuntime | null = null;
  let environmentProofRuntime: MetaverseEnvironmentProofRuntime | null = null;
  let mountedCharacterRuntime: MountedCharacterRuntime | null = null;
  let previousViewportHeight: number | null = null;
  let previousViewportWidth: number | null = null;
  let proofSliceBootPromise: Promise<void> | null = null;
  let proofSliceBooted = false;
  let sceneInteractionSnapshot = createSceneInteractionSnapshot(null, null);

  camera.position.set(
    config.camera.spawnPosition.x,
    config.camera.spawnPosition.y,
    config.camera.spawnPosition.z
  );
  camera.lookAt(0, config.camera.spawnPosition.y, -1);
  camera.updateMatrixWorld(true);

  scene.background = toThreeColor(config.environment.horizonColor);
  scene.fog = new FogExp2(
    toThreeColor(config.environment.fogColor),
    config.environment.fogDensity
  );
  scene.add(
    createHemisphereLight(config),
    createSunLight(config),
    skyMesh,
    oceanMesh
  );

  for (const portalMesh of portalMeshes) {
    scene.add(portalMesh.anchorGroup);
  }

  return {
    camera,
    scene,
    async boot() {
      if (proofSliceBooted) {
        return;
      }

      if (proofSliceBootPromise !== null) {
        await proofSliceBootPromise;
        return;
      }

      proofSliceBootPromise = (async () => {
        const createSceneAssetLoader =
          dependencies.createSceneAssetLoader ?? createDefaultSceneAssetLoader;

        if (
          dependencies.attachmentProofConfig !== null &&
          dependencies.attachmentProofConfig !== undefined &&
          dependencies.characterProofConfig !== undefined &&
          dependencies.characterProofConfig !== null
        ) {
          const loadedCharacterProofRuntime = await loadMetaverseCharacterProofRuntime(
            dependencies.characterProofConfig,
            createSceneAssetLoader,
            dependencies.warn ?? ((message) => globalThis.console?.warn(message))
          );

          characterProofRuntime = loadedCharacterProofRuntime;
          scene.add(loadedCharacterProofRuntime.anchorGroup);
          await loadMetaverseAttachmentProofRuntime(
            dependencies.attachmentProofConfig,
            loadedCharacterProofRuntime,
            createSceneAssetLoader
          );
        } else if (
          dependencies.characterProofConfig !== null &&
          dependencies.characterProofConfig !== undefined
        ) {
          const loadedCharacterProofRuntime = await loadMetaverseCharacterProofRuntime(
            dependencies.characterProofConfig,
            createSceneAssetLoader,
            dependencies.warn ?? ((message) => globalThis.console?.warn(message))
          );

          characterProofRuntime = loadedCharacterProofRuntime;
          scene.add(loadedCharacterProofRuntime.anchorGroup);
        } else if (
          dependencies.attachmentProofConfig !== null &&
          dependencies.attachmentProofConfig !== undefined
        ) {
          throw new Error(
            "Metaverse scene cannot boot an attachment proof slice without a character proof slice."
          );
        }

        if (
          dependencies.environmentProofConfig !== null &&
          dependencies.environmentProofConfig !== undefined
        ) {
          environmentProofRuntime = await loadMetaverseEnvironmentProofRuntime(
            dependencies.environmentProofConfig,
            createSceneAssetLoader
          );
          scene.add(environmentProofRuntime.anchorGroup);
          syncEnvironmentProofRuntime(environmentProofRuntime, {
            lookDirection: {
              x: -camera.position.x,
              y: 0,
              z: -camera.position.z
            },
            pitchRadians: 0,
            position: {
              x: camera.position.x,
              y: camera.position.y,
              z: camera.position.z
            },
            yawRadians: 0
          }, 0);
        }

        sceneInteractionSnapshot = createSceneInteractionSnapshot(
          resolveFocusedMountableSnapshot(
            environmentProofRuntime,
            mountedCharacterRuntime,
            {
              lookDirection: {
                x: -camera.position.x,
                y: 0,
                z: -camera.position.z
              },
              pitchRadians: 0,
              position: {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
              },
              yawRadians: 0
            }
          ),
          resolveMountedEnvironmentSnapshot(mountedCharacterRuntime)
        );

        proofSliceBooted = true;
      })();

      try {
        await proofSliceBootPromise;
      } finally {
        if (proofSliceBootPromise !== null) {
          proofSliceBootPromise = null;
        }
      }
    },
    resetPresentation() {
      if (characterProofRuntime !== null && mountedCharacterRuntime !== null) {
        dismountCharacterFromEnvironmentAsset(
          characterProofRuntime,
          mountedCharacterRuntime
        );
        mountedCharacterRuntime = null;
      }

      for (const portalMesh of portalMeshes) {
        portalMesh.anchorGroup.scale.setScalar(1);
      }

      sceneInteractionSnapshot = createSceneInteractionSnapshot(null, null);
    },
    async prewarm(renderer) {
      if (typeof renderer.compileAsync !== "function") {
        return;
      }

      await renderer.compileAsync(scene, camera);
    },
    syncPresentation(
      cameraSnapshot,
      focusedPortal,
      nowMs,
      deltaSeconds,
      characterPresentation = null
    ) {
      syncCamera(camera, cameraSnapshot);
      characterProofRuntime?.mixer.update(deltaSeconds);
      if (environmentProofRuntime !== null) {
        syncEnvironmentProofRuntime(environmentProofRuntime, cameraSnapshot, nowMs);
      }
      if (characterProofRuntime !== null) {
        syncCharacterPresentation(
          characterProofRuntime,
          characterPresentation,
          mountedCharacterRuntime
        );
      }
      if (characterProofRuntime !== null && mountedCharacterRuntime !== null) {
        applyCharacterSeatMountTransform(characterProofRuntime);
      }

      for (const portalMesh of portalMeshes) {
        syncPortalPresentation(portalMesh, focusedPortal, nowMs);
      }

      sceneInteractionSnapshot = createSceneInteractionSnapshot(
        resolveFocusedMountableSnapshot(
          environmentProofRuntime,
          mountedCharacterRuntime,
          cameraSnapshot
        ),
        resolveMountedEnvironmentSnapshot(mountedCharacterRuntime)
      );

      return sceneInteractionSnapshot;
    },
    syncViewport(renderer, canvasHost, devicePixelRatio) {
      const width = Math.max(1, canvasHost.clientWidth);
      const height = Math.max(1, canvasHost.clientHeight);
      const viewportChanged =
        previousViewportWidth !== null &&
        previousViewportHeight !== null &&
        (width !== previousViewportWidth || height !== previousViewportHeight);

      renderer.setPixelRatio(devicePixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      previousViewportWidth = width;
      previousViewportHeight = height;

      if (viewportChanged) {
        markSceneBundleGroupsDirty(scene);
      }
    },
    toggleMount(cameraSnapshot) {
      if (characterProofRuntime === null || environmentProofRuntime === null) {
        return sceneInteractionSnapshot;
      }

      if (mountedCharacterRuntime !== null) {
        dismountCharacterFromEnvironmentAsset(
          characterProofRuntime,
          mountedCharacterRuntime
        );
        mountedCharacterRuntime = null;
      } else {
        const focusedEnvironment = resolveFocusedMountableEnvironmentRuntime(
          environmentProofRuntime,
          cameraSnapshot
        );

        if (focusedEnvironment !== null) {
          mountedCharacterRuntime = mountCharacterOnEnvironmentAsset(
            characterProofRuntime,
            focusedEnvironment.environmentAsset
          );
        }
      }

      sceneInteractionSnapshot = createSceneInteractionSnapshot(
        resolveFocusedMountableSnapshot(
          environmentProofRuntime,
          mountedCharacterRuntime,
          cameraSnapshot
        ),
        resolveMountedEnvironmentSnapshot(mountedCharacterRuntime)
      );

      return sceneInteractionSnapshot;
    }
  };
}
