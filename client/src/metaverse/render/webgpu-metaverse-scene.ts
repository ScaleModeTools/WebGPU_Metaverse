import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  BackSide,
  Bone,
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
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3
} from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinnedGroup } from "three/addons/utils/SkeletonUtils.js";
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
  MetaverseCharacterAnimationVocabularyId,
  MetaverseCharacterProofConfig,
  MetaverseCharacterPresentationSnapshot,
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentColliderProofConfig,
  MetaverseEnvironmentEntryProofConfig,
  MetaverseEnvironmentLodProofConfig,
  MetaverseEnvironmentPlacementProofConfig,
  MetaverseEnvironmentProofConfig,
  MetaverseEnvironmentSeatProofConfig,
  FocusedExperiencePortalSnapshot,
  FocusedMountableSnapshot,
  MountableBoardingEntrySnapshot,
  MountableSeatSelectionSnapshot,
  MetaverseCameraSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseVector3Snapshot,
  MountedEnvironmentSnapshot,
  MetaversePortalConfig,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";
import {
  shouldConstrainMountedOccupancyToAnchor,
  shouldHolsterHeldAttachmentWhileMounted
} from "../states/mounted-occupancy";
import {
  createMountedCharacterSeatTransformSnapshot,
  resolveEnvironmentRenderYawFromSimulationYaw,
  resolveEnvironmentSimulationYawFromRenderYaw,
  resolveMountedCharacterSeatTransform
} from "../traversal/presentation/mount-presentation";
import type { MountedEnvironmentAnchorSnapshot } from "../traversal/types/traversal";

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

export interface LoadedSceneAsset {
  readonly animations: readonly AnimationClip[];
  readonly scene: Group;
}

export interface SceneAssetLoader {
  loadAsync(path: string): Promise<LoadedSceneAsset>;
}

interface MetaverseCharacterProofRuntime {
  activeAnimationVocabulary: MetaverseCharacterAnimationVocabularyId;
  readonly actionsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationAction
  >;
  readonly anchorGroup: Group;
  readonly characterId: string;
  readonly clipsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationClip
  >;
  readonly mixer: AnimationMixer;
  readonly seatSocketNode: Object3D;
  readonly scene: Group;
}

interface MetaverseAttachmentMountRuntime {
  readonly gripMarkerTranslation: Vector3 | null;
  readonly localQuaternion: Quaternion;
  readonly socketName: MetaverseAttachmentProofConfig["heldMount"]["socketName"];
  readonly socketOffset: Vector3;
}

interface MetaverseAttachmentProofRuntime {
  activeMountKind: "held" | "mounted-holster" | null;
  readonly attachmentRoot: Group;
  readonly heldMount: MetaverseAttachmentMountRuntime;
  readonly mountedHolsterMount: MetaverseAttachmentMountRuntime | null;
  readonly presentationGroup: Group;
}

interface MetaverseRemoteCharacterPresentationRuntime {
  readonly characterRuntime: MetaverseCharacterProofRuntime;
  mountedCharacterRuntime: MountedCharacterRuntime | null;
  targetMountedOccupancy:
    MetaverseRemoteCharacterPresentationSnapshot["mountedOccupancy"];
  targetPresentation: MetaverseCharacterPresentationSnapshot;
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
  readonly entries: readonly MetaverseEnvironmentEntryRuntime[] | null;
  readonly label: string;
  readonly motionPhase: number;
  readonly orientation: MetaverseEnvironmentAssetProofConfig["orientation"];
  readonly presentationGroup: Group;
  readonly scene: Group;
  readonly seats: readonly MetaverseEnvironmentSeatRuntime[] | null;
  readonly traversalAffordance: MetaverseEnvironmentAssetProofConfig["traversalAffordance"];
}

interface MetaverseMountableEnvironmentDynamicAssetRuntime
  extends MetaverseEnvironmentDynamicAssetRuntime {
  readonly entries: readonly MetaverseEnvironmentEntryRuntime[] | null;
  readonly seats: readonly MetaverseEnvironmentSeatRuntime[];
  readonly traversalAffordance: "mount";
}

interface MetaverseEnvironmentSeatRuntime {
  readonly anchorGroup: Object3D;
  readonly seat: MetaverseEnvironmentSeatProofConfig;
}

interface MetaverseEnvironmentEntryRuntime {
  readonly anchorGroup: Object3D;
  readonly entry: MetaverseEnvironmentEntryProofConfig;
}

interface MountedCharacterRuntime {
  readonly cameraPolicyId: MountedEnvironmentSnapshot["cameraPolicyId"];
  readonly controlRoutingPolicyId: MountedEnvironmentSnapshot["controlRoutingPolicyId"];
  readonly entryId: string | null;
  readonly environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime;
  readonly lookLimitPolicyId: MountedEnvironmentSnapshot["lookLimitPolicyId"];
  readonly occupancyAnimationId: MountedEnvironmentSnapshot["occupancyAnimationId"];
  readonly occupancyKind: MountedEnvironmentSnapshot["occupancyKind"];
  readonly occupiedAnchorGroup: Object3D;
  readonly occupantLabel: MountedEnvironmentSnapshot["occupantLabel"];
  readonly occupantRole: MountedEnvironmentSnapshot["occupantRole"];
  readonly previousParent: Object3D;
  readonly previousPosition: Vector3;
  readonly previousQuaternion: Quaternion;
  readonly previousScale: Vector3;
  readonly seatId: string | null;
}

interface ResolvedMountedEnvironmentSelection {
  readonly anchorGroup: Object3D;
  readonly cameraPolicyId: MountedEnvironmentSnapshot["cameraPolicyId"];
  readonly controlRoutingPolicyId: MountedEnvironmentSnapshot["controlRoutingPolicyId"];
  readonly entryId: string | null;
  readonly lookLimitPolicyId: MountedEnvironmentSnapshot["lookLimitPolicyId"];
  readonly occupancyAnimationId: MountedEnvironmentSnapshot["occupancyAnimationId"];
  readonly occupancyKind: MountedEnvironmentSnapshot["occupancyKind"];
  readonly occupantLabel: MountedEnvironmentSnapshot["occupantLabel"];
  readonly occupantRole: MountedEnvironmentSnapshot["occupantRole"];
  readonly seatId: string | null;
}

interface MountedEnvironmentSelectionReference {
  readonly environmentAssetId: string;
  readonly entryId: string | null;
  readonly occupancyKind: MountedEnvironmentSnapshot["occupancyKind"];
  readonly occupantRole: MountedEnvironmentSnapshot["occupantRole"];
  readonly seatId: string | null;
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
  showSocketDebug?: boolean;
  warn?: (message: string) => void;
}

interface DynamicEnvironmentPoseSnapshot {
  readonly position: MetaverseVector3Snapshot;
  readonly yawRadians: number;
}

const socketDebugMarkerColors = {
  back_socket: [1, 0.72, 0.26],
  hand_l_socket: [0.28, 0.72, 1],
  hand_r_socket: [1, 0.42, 0.34],
  head_socket: [1, 0.92, 0.34],
  hip_socket: [0.45, 1, 0.56],
  palm_l_socket: [0.28, 0.9, 1],
  palm_r_socket: [1, 0.6, 0.48],
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

const metaverseCharacterRenderYawOffsetRadians = Math.PI;

const environmentLodSwitchHysteresisMeters = 1.25;
const remoteCharacterInterpolationRatePerSecond = 12;
const remoteCharacterTeleportSnapDistanceMeters = 3.5;
const mountedCharacterSeatTransformScratch =
  createMountedCharacterSeatTransformSnapshot();
const dynamicEnvironmentSeatSocketPositionScratch = new Vector3();
const dynamicEnvironmentSeatSocketQuaternionScratch = new Quaternion();
const dynamicEnvironmentSeatSocketScaleScratch = new Vector3();
const mountedEnvironmentAnchorForwardScratch = new Vector3();
const mountedEnvironmentAnchorPositionScratch = new Vector3();
const mountedEnvironmentAnchorQuaternionScratch = new Quaternion();
const humanoidV2PalmSocketBlendAlpha = 0.45;
const humanoidV2BackSocketLowerOffsetMeters = 0.02;
const humanoidV2BackSocketRearwardScale = 0.7;
const humanoidV1BackSocketLocalPosition = new Vector3(0, 0.14, -0.08);

function createDefaultSceneAssetLoader(): SceneAssetLoader {
  return new GLTFLoader() as SceneAssetLoader;
}

function freezeVector3(
  x: number,
  y: number,
  z: number
): MetaverseVector3Snapshot {
  return Object.freeze({
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0
  });
}

function wrapRadians(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let nextValue = rawValue;

  while (nextValue > Math.PI) {
    nextValue -= Math.PI * 2;
  }

  while (nextValue <= -Math.PI) {
    nextValue += Math.PI * 2;
  }

  return nextValue;
}

function resolveCharacterRenderYawRadians(yawRadians: number): number {
  return wrapRadians(metaverseCharacterRenderYawOffsetRadians - yawRadians);
}

function resolveMetaverseYawFromObjectQuaternion(object: Object3D): number {
  const forward = mountedEnvironmentAnchorForwardScratch
    .set(0, 0, 1)
    .applyQuaternion(object.getWorldQuaternion(mountedEnvironmentAnchorQuaternionScratch))
    .normalize();

  return wrapRadians(Math.atan2(forward.x, -forward.z));
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

function createSeatDebugMarker(seatId: string): Mesh {
  const material = new MeshBasicNodeMaterial();

  material.colorNode = color(0.62, 0.96, 0.96);
  material.depthWrite = false;

  const marker = new Mesh(new SphereGeometry(0.08, 12, 10), material);

  marker.name = `seat_debug/${seatId}`;

  return marker;
}

function ensureSocketDebugMarker(socketNode: Object3D, socketName: string): void {
  if (socketNode.getObjectByName(`socket_debug/${socketName}`) !== undefined) {
    return;
  }

  socketNode.add(createSocketDebugMarker(socketName));
}

function isBoneNode(node: Object3D | undefined): node is Bone {
  return node !== undefined && "isBone" in node && node.isBone === true;
}

function findBoneNode(characterScene: Group, boneName: string, label: string): Bone {
  const boneNode = characterScene.getObjectByName(boneName);

  if (!isBoneNode(boneNode)) {
    throw new Error(`${label} is missing required bone ${boneName}.`);
  }

  return boneNode;
}

function findSocketNode(characterScene: Group, socketName: string): Object3D {
  const socketNode = characterScene.getObjectByName(socketName);

  if (!isBoneNode(socketNode)) {
    throw new Error(`Metaverse character is missing required socket bone: ${socketName}`);
  }

  return socketNode;
}

function upsertSyntheticSocketNode(
  characterScene: Group,
  parentBone: Bone,
  socketName: string,
  localPosition: Vector3,
  showSocketDebug: boolean,
  localQuaternion?: Quaternion
): Bone {
  const existingSocketNode = characterScene.getObjectByName(socketName);
  const socketNode = (() => {
    if (existingSocketNode === undefined) {
      const syntheticSocketNode = new Bone();

      syntheticSocketNode.name = socketName;
      parentBone.add(syntheticSocketNode);

      return syntheticSocketNode;
    }

    if (!isBoneNode(existingSocketNode)) {
      throw new Error(`Metaverse character socket ${socketName} must stay a bone.`);
    }

    if (existingSocketNode.parent !== parentBone) {
      throw new Error(
        `Metaverse character socket ${socketName} must stay parented to ${parentBone.name}.`
      );
    }

    return existingSocketNode;
  })();

  socketNode.position.copy(localPosition);
  if (localQuaternion === undefined) {
    socketNode.quaternion.identity();
  } else {
    socketNode.quaternion.copy(localQuaternion);
  }
  socketNode.scale.setScalar(1);

  if (showSocketDebug) {
    ensureSocketDebugMarker(socketNode, socketName);
  }

  return socketNode;
}

function synthesizeHumanoidV2PalmSockets(
  characterScene: Group,
  showSocketDebug: boolean
): void {
  const palmSocketDescriptors = [
    {
      fingerBaseBoneNames: [
        "thumb_01_l",
        "index_01_l",
        "middle_01_l",
        "ring_01_l",
        "pinky_01_l"
      ] as const,
      parentBoneName: "hand_l",
      sourceSocketName: "hand_l_socket",
      synthesizedSocketName: "palm_l_socket"
    },
    {
      fingerBaseBoneNames: [
        "thumb_01_r",
        "index_01_r",
        "middle_01_r",
        "ring_01_r",
        "pinky_01_r"
      ] as const,
      parentBoneName: "hand_r",
      sourceSocketName: "hand_r_socket",
      synthesizedSocketName: "palm_r_socket"
    }
  ] as const;

  for (const palmSocketDescriptor of palmSocketDescriptors) {
    const parentBone = findBoneNode(
      characterScene,
      palmSocketDescriptor.parentBoneName,
      "Metaverse humanoid_v2 palm socket synthesis"
    );
    const sourceSocketNode = findSocketNode(
      characterScene,
      palmSocketDescriptor.sourceSocketName
    );
    const fingerBaseCentroid = new Vector3();

    for (const fingerBaseBoneName of palmSocketDescriptor.fingerBaseBoneNames) {
      const fingerBaseBone = findBoneNode(
        characterScene,
        fingerBaseBoneName,
        "Metaverse humanoid_v2 palm socket synthesis"
      );

      fingerBaseCentroid.add(
        parentBone.worldToLocal(fingerBaseBone.getWorldPosition(new Vector3()))
      );
    }

    fingerBaseCentroid.multiplyScalar(
      1 / palmSocketDescriptor.fingerBaseBoneNames.length
    );

    // Bias the authored hand socket toward the knuckle line so the palm seam
    // inherits the rig's mirrored finger spread without drifting onto the
    // fingers. Keep the authored hand socket rotation so attachment grip basis
    // follows the rig-specific socket orientation.
    const palmLocalPosition = sourceSocketNode.position
      .clone()
      .lerp(fingerBaseCentroid, humanoidV2PalmSocketBlendAlpha);

    upsertSyntheticSocketNode(
      characterScene,
      parentBone,
      palmSocketDescriptor.synthesizedSocketName,
      palmLocalPosition,
      showSocketDebug,
      sourceSocketNode.quaternion
    );
  }
}

function synthesizeHumanoidV2BackSocket(
  characterScene: Group,
  showSocketDebug: boolean
): void {
  const spineBone = findBoneNode(
    characterScene,
    "spine_03",
    "Metaverse humanoid_v2 back socket synthesis"
  );
  const clavicleLBone = findBoneNode(
    characterScene,
    "clavicle_l",
    "Metaverse humanoid_v2 back socket synthesis"
  );
  const clavicleRBone = findBoneNode(
    characterScene,
    "clavicle_r",
    "Metaverse humanoid_v2 back socket synthesis"
  );
  const clavicleMidpointLocal = spineBone.worldToLocal(
    clavicleLBone
      .getWorldPosition(new Vector3())
      .add(clavicleRBone.getWorldPosition(new Vector3()))
      .multiplyScalar(0.5)
  );

  clavicleMidpointLocal.x = 0;
  clavicleMidpointLocal.y = Math.max(
    0.08,
    clavicleMidpointLocal.y - humanoidV2BackSocketLowerOffsetMeters
  );
  clavicleMidpointLocal.z =
    -Math.max(0.06, Math.abs(clavicleMidpointLocal.z) * humanoidV2BackSocketRearwardScale);

  upsertSyntheticSocketNode(
    characterScene,
    spineBone,
    "back_socket",
    clavicleMidpointLocal,
    showSocketDebug
  );
}

function synthesizeHumanoidV1BackSocket(
  characterScene: Group,
  showSocketDebug: boolean
): void {
  upsertSyntheticSocketNode(
    characterScene,
    findBoneNode(
      characterScene,
      "chest",
      "Metaverse humanoid_v1 back socket synthesis"
    ),
    "back_socket",
    humanoidV1BackSocketLocalPosition,
    showSocketDebug
  );
}

function synthesizeRuntimeSocketNodes(
  characterProofConfig: MetaverseCharacterProofConfig,
  characterScene: Group,
  showSocketDebug: boolean
): void {
  characterScene.updateMatrixWorld(true);

  switch (characterProofConfig.skeletonId) {
    case "humanoid_v1":
      synthesizeHumanoidV1BackSocket(characterScene, showSocketDebug);
      break;
    case "humanoid_v2":
      synthesizeHumanoidV2PalmSockets(characterScene, showSocketDebug);
      synthesizeHumanoidV2BackSocket(characterScene, showSocketDebug);
      break;
  }

  characterScene.updateMatrixWorld(true);
}

function resolveAttachmentAlignmentQuaternion(
  gripAlignment: MetaverseAttachmentProofConfig["heldMount"]["gripAlignment"],
  attachmentScene: Group
): Quaternion {
  const resolveAlignmentAxisVector = (axis: MetaverseVector3Snapshot) =>
    new Vector3(axis.x, axis.y, axis.z).normalize();
  const resolveAttachmentMarkerOffset = (
    markerNodeName: string,
    label: string
  ) => {
    const markerNode = findNamedNode(
      attachmentScene,
      markerNodeName,
      "Metaverse attachment grip alignment"
    );
    const markerOffset = attachmentScene.worldToLocal(
      markerNode.getWorldPosition(new Vector3())
    );

    if (markerOffset.lengthSq() <= 0.000001) {
      throw new Error(
        `Metaverse attachment grip alignment requires ${label} to stay offset from the attachment root.`
      );
    }

    return markerOffset;
  };
  const resolveAttachmentMarkerAxis = (
    markerNodeName: string,
    label: string
  ) =>
    resolveAttachmentMarkerOffset(
      markerNodeName,
      label
    ).normalize();
  const createBasisQuaternion = (
    forwardAxis: Vector3,
    upAxis: Vector3
  ) => {
    const forward = forwardAxis.clone().normalize();
    const provisionalUp = upAxis.clone().normalize();
    const right = new Vector3().crossVectors(provisionalUp, forward);

    if (right.lengthSq() <= 0.000001) {
      throw new Error(
        "Metaverse attachment grip alignment requires non-collinear forward and up axes."
      );
    }

    right.normalize();

    const correctedUp = new Vector3().crossVectors(forward, right).normalize();

    return new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(right, correctedUp, forward)
    );
  };
  attachmentScene.updateMatrixWorld(true);

  const attachmentForwardAxis =
    "attachmentForwardAxis" in gripAlignment
      ? resolveAlignmentAxisVector(gripAlignment.attachmentForwardAxis)
      : resolveAttachmentMarkerAxis(
          gripAlignment.attachmentForwardMarkerNodeName,
          "attachment forward marker"
        );
  const attachmentUpAxis =
    "attachmentForwardAxis" in gripAlignment
      ? resolveAlignmentAxisVector(gripAlignment.attachmentUpAxis)
      : resolveAttachmentMarkerAxis(
          gripAlignment.attachmentUpMarkerNodeName,
          "attachment up marker"
        );
  const attachmentBasisQuaternion = createBasisQuaternion(
    attachmentForwardAxis,
    attachmentUpAxis
  );
  const socketBasisQuaternion = createBasisQuaternion(
    resolveAlignmentAxisVector(gripAlignment.socketForwardAxis),
    resolveAlignmentAxisVector(gripAlignment.socketUpAxis)
  );

  return socketBasisQuaternion.multiply(attachmentBasisQuaternion.invert());
}

function resolveAttachmentGripMarkerTranslation(
  gripAlignment: MetaverseAttachmentProofConfig["heldMount"]["gripAlignment"],
  attachmentScene: Group
): Vector3 | null {
  const gripMarkerNodeName =
    gripAlignment.attachmentGripMarkerNodeName ?? null;

  if (gripMarkerNodeName === null) {
    return null;
  }

  attachmentScene.updateMatrixWorld(true);

  const gripMarkerNode = findNamedNode(
    attachmentScene,
    gripMarkerNodeName,
    "Metaverse attachment grip alignment"
  );
  const gripMarkerOffset = attachmentScene.worldToLocal(
    gripMarkerNode.getWorldPosition(new Vector3())
  );

  if (gripMarkerOffset.lengthSq() <= 0.000001) {
    throw new Error(
      "Metaverse attachment grip alignment requires attachment grip marker to stay offset from the attachment root."
    );
  }

  return gripMarkerOffset.multiplyScalar(-1);
}

function createAttachmentMountRuntime(
  mountConfig: MetaverseAttachmentProofConfig["heldMount"],
  attachmentScene: Group
): MetaverseAttachmentMountRuntime {
  return {
    gripMarkerTranslation: resolveAttachmentGripMarkerTranslation(
      mountConfig.gripAlignment,
      attachmentScene
    ),
    localQuaternion: resolveAttachmentAlignmentQuaternion(
      mountConfig.gripAlignment,
      attachmentScene
    ),
    socketName: mountConfig.socketName,
    socketOffset: new Vector3(
      mountConfig.gripAlignment.socketOffset.x,
      mountConfig.gripAlignment.socketOffset.y,
      mountConfig.gripAlignment.socketOffset.z
    )
  };
}

function applyAttachmentMountRuntime(
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  characterProofRuntime: MetaverseCharacterProofRuntime,
  mountRuntime: MetaverseAttachmentMountRuntime
): void {
  const socketNode = findSocketNode(characterProofRuntime.scene, mountRuntime.socketName);

  if (attachmentRuntime.attachmentRoot.parent !== socketNode) {
    attachmentRuntime.attachmentRoot.parent?.remove(attachmentRuntime.attachmentRoot);
    socketNode.add(attachmentRuntime.attachmentRoot);
  }

  attachmentRuntime.attachmentRoot.position.copy(mountRuntime.socketOffset);
  attachmentRuntime.attachmentRoot.quaternion.copy(mountRuntime.localQuaternion);
  if (mountRuntime.gripMarkerTranslation === null) {
    attachmentRuntime.presentationGroup.position.set(0, 0, 0);
  } else {
    attachmentRuntime.presentationGroup.position.copy(
      mountRuntime.gripMarkerTranslation
    );
  }
  attachmentRuntime.attachmentRoot.updateMatrixWorld(true);
}

function syncAttachmentProofRuntimeMount(
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  characterProofRuntime: MetaverseCharacterProofRuntime,
  mountedEnvironment: MountedEnvironmentSnapshot | null
): void {
  const nextMountKind =
    shouldHolsterHeldAttachmentWhileMounted(mountedEnvironment) &&
    attachmentRuntime.mountedHolsterMount !== null
      ? "mounted-holster"
      : "held";

  if (attachmentRuntime.activeMountKind === nextMountKind) {
    return;
  }

  applyAttachmentMountRuntime(
    attachmentRuntime,
    characterProofRuntime,
    nextMountKind === "mounted-holster"
      ? attachmentRuntime.mountedHolsterMount ?? attachmentRuntime.heldMount
      : attachmentRuntime.heldMount
  );
  attachmentRuntime.activeMountKind = nextMountKind;
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

function cloneCharacterScene(scene: Group): Group {
  return cloneSkinnedGroup(scene) as Group;
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

function resolveDynamicEnvironmentBasePose(
  dynamicAssetRuntime: MetaverseEnvironmentDynamicAssetRuntime,
  dynamicEnvironmentPoseOverrides: ReadonlyMap<string, DynamicEnvironmentPoseSnapshot>
): DynamicEnvironmentPoseSnapshot {
  const overriddenPose = dynamicEnvironmentPoseOverrides.get(
    dynamicAssetRuntime.environmentAssetId
  );

  if (overriddenPose !== undefined) {
    return overriddenPose;
  }

  return Object.freeze({
    position: freezeVector3(
      dynamicAssetRuntime.basePlacement.position.x,
      dynamicAssetRuntime.basePlacement.position.y,
      dynamicAssetRuntime.basePlacement.position.z
    ),
    yawRadians: resolveEnvironmentSimulationYawFromRenderYaw(
      dynamicAssetRuntime,
      dynamicAssetRuntime.basePlacement.rotationYRadians
    )
  });
}

function syncDynamicEnvironmentSimulationPose(
  dynamicAssetRuntime: MetaverseEnvironmentDynamicAssetRuntime,
  dynamicEnvironmentPoseOverrides: ReadonlyMap<string, DynamicEnvironmentPoseSnapshot>
): void {
  const basePose = resolveDynamicEnvironmentBasePose(
    dynamicAssetRuntime,
    dynamicEnvironmentPoseOverrides
  );
  const renderYawRadians = resolveEnvironmentRenderYawFromSimulationYaw(
    dynamicAssetRuntime,
    basePose.yawRadians
  );

  dynamicAssetRuntime.anchorGroup.position.set(
    basePose.position.x,
    basePose.position.y,
    basePose.position.z
  );
  dynamicAssetRuntime.anchorGroup.rotation.set(0, renderYawRadians, 0);
  dynamicAssetRuntime.anchorGroup.scale.setScalar(
    dynamicAssetRuntime.basePlacement.scale
  );
}

function syncEnvironmentProofRuntime(
  environmentProofRuntime: MetaverseEnvironmentProofRuntime,
  cameraSnapshot: MetaverseCameraSnapshot,
  nowMs: number,
  dynamicEnvironmentPoseOverrides: ReadonlyMap<string, DynamicEnvironmentPoseSnapshot> =
    new Map()
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
    syncDynamicEnvironmentSimulationPose(
      dynamicAssetRuntime,
      dynamicEnvironmentPoseOverrides
    );

    if (dynamicAssetRuntime.traversalAffordance === "mount") {
      dynamicAssetRuntime.presentationGroup.position.set(
        0,
        Math.sin(nowMs * 0.0014 + dynamicAssetRuntime.motionPhase) * 0.18,
        0
      );
      dynamicAssetRuntime.presentationGroup.rotation.set(
        Math.sin(nowMs * 0.001 + dynamicAssetRuntime.motionPhase) * 0.03,
        0,
        Math.sin(nowMs * 0.0011 + dynamicAssetRuntime.motionPhase) * 0.04
      );
    } else {
      dynamicAssetRuntime.presentationGroup.position.set(0, 0, 0);
      dynamicAssetRuntime.presentationGroup.rotation.set(0, 0, 0);
    }
    dynamicAssetRuntime.presentationGroup.scale.setScalar(1);
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

function resolveDirectSeatTargetSnapshots(
  environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime
): readonly MountableSeatSelectionSnapshot[] {
  return Object.freeze(
    environmentAsset.seats
      .filter((seat) => seat.seat.directEntryEnabled)
      .map((seat) =>
        Object.freeze({
          label: seat.seat.label,
          seatId: seat.seat.seatId,
          seatRole: seat.seat.seatRole
        })
      )
  );
}

function resolveSeatTargetSnapshots(
  environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime
): readonly MountableSeatSelectionSnapshot[] {
  return Object.freeze(
    environmentAsset.seats.map((seat) =>
      Object.freeze({
        label: seat.seat.label,
        seatId: seat.seat.seatId,
        seatRole: seat.seat.seatRole
      })
    )
  );
}

function resolveBoardingEntrySnapshots(
  environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime
): readonly MountableBoardingEntrySnapshot[] {
  return Object.freeze(
    (environmentAsset.entries ?? []).map((entry) =>
      Object.freeze({
        entryId: entry.entry.entryId,
        label: entry.entry.label
      })
    )
  );
}

function createMountedEnvironmentSnapshot(
  environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime,
  occupiedSelection: Omit<ResolvedMountedEnvironmentSelection, "anchorGroup">
): MountedEnvironmentSnapshot {
  return Object.freeze({
    cameraPolicyId: occupiedSelection.cameraPolicyId,
    controlRoutingPolicyId: occupiedSelection.controlRoutingPolicyId,
    directSeatTargets: resolveDirectSeatTargetSnapshots(environmentAsset),
    entryId: occupiedSelection.entryId,
    environmentAssetId: environmentAsset.environmentAssetId,
    label: environmentAsset.label,
    lookLimitPolicyId: occupiedSelection.lookLimitPolicyId,
    occupancyAnimationId: occupiedSelection.occupancyAnimationId,
    occupancyKind: occupiedSelection.occupancyKind,
    occupantLabel: occupiedSelection.occupantLabel,
    occupantRole: occupiedSelection.occupantRole,
    seatTargets: resolveSeatTargetSnapshots(environmentAsset),
    seatId: occupiedSelection.seatId
  });
}

function resolveFocusedMountableEnvironmentRuntime(
  environmentProofRuntime: MetaverseEnvironmentProofRuntime,
  cameraSnapshot: MetaverseCameraSnapshot,
  focusProbeForwardMeters = 0
): {
  readonly distanceFromCamera: number;
  readonly environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime;
} | null {
  let nearestEnvironmentAsset:
    | {
        readonly distanceFromCamera: number;
        readonly environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime;
      }
    | null = null;

  for (const environmentAsset of environmentProofRuntime.dynamicAssets) {
    if (!isMountableDynamicEnvironmentAssetRuntime(environmentAsset)) {
      continue;
    }

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
    let focusLocalPosition = localCameraPosition;
    let offsetX = Math.abs(
      focusLocalPosition.x - environmentAsset.collider.center.x
    );
    let offsetY = Math.abs(
      focusLocalPosition.y - environmentAsset.collider.center.y
    );
    let offsetZ = Math.abs(
      focusLocalPosition.z - environmentAsset.collider.center.z
    );

    if (
      offsetX > halfExtentX ||
      offsetY > halfExtentY ||
      offsetZ > halfExtentZ
    ) {
      if (focusProbeForwardMeters <= 0) {
        continue;
      }

      focusLocalPosition = environmentAsset.anchorGroup.worldToLocal(
        new Vector3(
          cameraSnapshot.position.x +
            cameraSnapshot.lookDirection.x * focusProbeForwardMeters,
          cameraSnapshot.position.y +
            cameraSnapshot.lookDirection.y * focusProbeForwardMeters,
          cameraSnapshot.position.z +
            cameraSnapshot.lookDirection.z * focusProbeForwardMeters
        )
      );
      offsetX = Math.abs(
        focusLocalPosition.x - environmentAsset.collider.center.x
      );
      offsetY = Math.abs(
        focusLocalPosition.y - environmentAsset.collider.center.y
      );
      offsetZ = Math.abs(
        focusLocalPosition.z - environmentAsset.collider.center.z
      );

      if (
        offsetX > halfExtentX ||
        offsetY > halfExtentY ||
        offsetZ > halfExtentZ
      ) {
        continue;
      }
    }

    const distanceFromCamera = Math.hypot(
      focusLocalPosition.x - environmentAsset.collider.center.x,
      focusLocalPosition.y - environmentAsset.collider.center.y,
      focusLocalPosition.z - environmentAsset.collider.center.z
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

function isMountableDynamicEnvironmentAssetRuntime(
  environmentAsset: MetaverseEnvironmentDynamicAssetRuntime
): environmentAsset is MetaverseMountableEnvironmentDynamicAssetRuntime {
  return (
    environmentAsset.traversalAffordance === "mount" &&
    environmentAsset.seats !== null &&
    environmentAsset.seats.length > 0
  );
}

function resolveFocusedMountableSnapshot(
  environmentProofRuntime: MetaverseEnvironmentProofRuntime | null,
  mountedEnvironment: MountedEnvironmentSnapshot | null,
  cameraSnapshot: MetaverseCameraSnapshot,
  config: MetaverseRuntimeConfig
): FocusedMountableSnapshot | null {
  if (
    environmentProofRuntime === null ||
    mountedEnvironment !== null
  ) {
    return null;
  }

  const focusedEnvironment = resolveFocusedMountableEnvironmentRuntime(
    environmentProofRuntime,
    cameraSnapshot,
    config.bodyPresentation.swimThirdPersonFollowDistanceMeters
  );

  if (focusedEnvironment === null) {
    return null;
  }

  return Object.freeze({
    boardingEntries: resolveBoardingEntrySnapshots(
      focusedEnvironment.environmentAsset
    ),
    distanceFromCamera: focusedEnvironment.distanceFromCamera,
    directSeatTargets: resolveDirectSeatTargetSnapshots(
      focusedEnvironment.environmentAsset
    ),
    environmentAssetId: focusedEnvironment.environmentAsset.environmentAssetId,
    label: focusedEnvironment.environmentAsset.label
  });
}

function applyCharacterMountedAnchorTransform(
  characterProofRuntime: MetaverseCharacterProofRuntime,
  mountedCharacterRuntime: MountedCharacterRuntime
): void {
  characterProofRuntime.anchorGroup.scale.copy(mountedCharacterRuntime.previousScale);
  const mountTransform = resolveMountedCharacterSeatTransform(
    {
      characterAnchorGroup: characterProofRuntime.anchorGroup,
      characterSeatSocketNode: characterProofRuntime.seatSocketNode,
      seatAnchorNode: mountedCharacterRuntime.occupiedAnchorGroup
    },
    mountedCharacterSeatTransformScratch
  );
  characterProofRuntime.anchorGroup.position.copy(mountTransform.localPosition);
  characterProofRuntime.anchorGroup.quaternion.copy(mountTransform.localQuaternion);
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
}

function resolveMountedEnvironmentSelectionByRequest(
  environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime,
  {
    requestedEntryId = null,
    requestedSeatId = null
  }: {
    readonly requestedEntryId?: string | null;
    readonly requestedSeatId?: string | null;
  } = {}
): ResolvedMountedEnvironmentSelection | null {
  if (requestedSeatId !== null) {
    const occupiedSeat =
      environmentAsset.seats.find((seat) => seat.seat.seatId === requestedSeatId) ??
      null;

    return occupiedSeat === null
      ? null
      : {
          anchorGroup: occupiedSeat.anchorGroup,
          cameraPolicyId: occupiedSeat.seat.cameraPolicyId,
          controlRoutingPolicyId: occupiedSeat.seat.controlRoutingPolicyId,
          entryId: null,
          lookLimitPolicyId: occupiedSeat.seat.lookLimitPolicyId,
          occupancyAnimationId: occupiedSeat.seat.occupancyAnimationId,
          occupancyKind: "seat",
          occupantLabel: occupiedSeat.seat.label,
          occupantRole: occupiedSeat.seat.seatRole,
          seatId: occupiedSeat.seat.seatId
        };
  }

  if (requestedEntryId !== null) {
    const occupiedEntry =
      environmentAsset.entries?.find(
        (entry) => entry.entry.entryId === requestedEntryId
      ) ?? null;

    return occupiedEntry === null
      ? null
      : {
          anchorGroup: occupiedEntry.anchorGroup,
          cameraPolicyId: occupiedEntry.entry.cameraPolicyId,
          controlRoutingPolicyId: occupiedEntry.entry.controlRoutingPolicyId,
          entryId: occupiedEntry.entry.entryId,
          lookLimitPolicyId: occupiedEntry.entry.lookLimitPolicyId,
          occupancyAnimationId: occupiedEntry.entry.occupancyAnimationId,
          occupancyKind: "entry",
          occupantLabel: occupiedEntry.entry.label,
          occupantRole: occupiedEntry.entry.occupantRole,
          seatId: null
        };
  }

  const defaultEntry = environmentAsset.entries?.[0] ?? null;

  if (defaultEntry !== null) {
    return {
      anchorGroup: defaultEntry.anchorGroup,
      cameraPolicyId: defaultEntry.entry.cameraPolicyId,
      controlRoutingPolicyId: defaultEntry.entry.controlRoutingPolicyId,
      entryId: defaultEntry.entry.entryId,
      lookLimitPolicyId: defaultEntry.entry.lookLimitPolicyId,
      occupancyAnimationId: defaultEntry.entry.occupancyAnimationId,
      occupancyKind: "entry",
      occupantLabel: defaultEntry.entry.label,
      occupantRole: defaultEntry.entry.occupantRole,
      seatId: null
    };
  }

  const directSeat =
    environmentAsset.seats.find((seat) => seat.seat.directEntryEnabled) ?? null;

  return directSeat === null
    ? null
    : {
        anchorGroup: directSeat.anchorGroup,
        cameraPolicyId: directSeat.seat.cameraPolicyId,
        controlRoutingPolicyId: directSeat.seat.controlRoutingPolicyId,
        entryId: null,
        lookLimitPolicyId: directSeat.seat.lookLimitPolicyId,
        occupancyAnimationId: directSeat.seat.occupancyAnimationId,
        occupancyKind: "seat",
        occupantLabel: directSeat.seat.label,
        occupantRole: directSeat.seat.seatRole,
        seatId: directSeat.seat.seatId
      };
}

function resolveMountedEnvironmentSelectionFromSnapshot(
  environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime,
  mountedEnvironment: MountedEnvironmentSelectionReference
): ResolvedMountedEnvironmentSelection | null {
  if (
    mountedEnvironment.occupancyKind === "seat" &&
    mountedEnvironment.seatId !== null
  ) {
    return resolveMountedEnvironmentSelectionByRequest(environmentAsset, {
      requestedSeatId: mountedEnvironment.seatId
    });
  }

  if (
    mountedEnvironment.occupancyKind === "entry" &&
    mountedEnvironment.entryId !== null
  ) {
    return resolveMountedEnvironmentSelectionByRequest(environmentAsset, {
      requestedEntryId: mountedEnvironment.entryId
    });
  }

  return null;
}

function syncMountedCharacterRuntimeFromSelectionReference(
  characterProofRuntime: MetaverseCharacterProofRuntime,
  mountedCharacterRuntime: MountedCharacterRuntime | null,
  mountedEnvironment: MountedEnvironmentSelectionReference | null | undefined,
  resolveMountedEnvironmentRuntime: (
    environmentAssetId: string
  ) => MetaverseMountableEnvironmentDynamicAssetRuntime | null
): MountedCharacterRuntime | null {
  if (!shouldConstrainMountedOccupancyToAnchor(mountedEnvironment)) {
    if (mountedCharacterRuntime !== null) {
      dismountCharacterFromEnvironmentAsset(
        characterProofRuntime,
        mountedCharacterRuntime
      );
    }

    return null;
  }

  if (mountedEnvironment === null || mountedEnvironment === undefined) {
    if (mountedCharacterRuntime !== null) {
      dismountCharacterFromEnvironmentAsset(
        characterProofRuntime,
        mountedCharacterRuntime
      );
    }

    return null;
  }

  const targetEnvironment = resolveMountedEnvironmentRuntime(
    mountedEnvironment.environmentAssetId
  );

  if (targetEnvironment === null) {
    if (mountedCharacterRuntime !== null) {
      dismountCharacterFromEnvironmentAsset(
        characterProofRuntime,
        mountedCharacterRuntime
      );
    }

    return null;
  }

  const occupiedSelection = resolveMountedEnvironmentSelectionFromSnapshot(
    targetEnvironment,
    mountedEnvironment
  );

  if (occupiedSelection === null) {
    if (mountedCharacterRuntime !== null) {
      dismountCharacterFromEnvironmentAsset(
        characterProofRuntime,
        mountedCharacterRuntime
      );
    }

    return null;
  }

  const mountTargetChanged =
    mountedCharacterRuntime === null ||
    mountedCharacterRuntime.environmentAsset.environmentAssetId !==
      mountedEnvironment.environmentAssetId ||
    mountedCharacterRuntime.entryId !== mountedEnvironment.entryId ||
    mountedCharacterRuntime.seatId !== mountedEnvironment.seatId;

  if (!mountTargetChanged) {
    return mountedCharacterRuntime;
  }

  if (mountedCharacterRuntime !== null) {
    dismountCharacterFromEnvironmentAsset(
      characterProofRuntime,
      mountedCharacterRuntime
    );
  }

  return mountCharacterOnEnvironmentAsset(
    characterProofRuntime,
    targetEnvironment,
    occupiedSelection
  );
}

function resolveMountedEnvironmentAnchorSnapshot(
  environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime,
  mountedEnvironment: MountedEnvironmentSnapshot,
  dynamicEnvironmentPoseOverrides: ReadonlyMap<string, DynamicEnvironmentPoseSnapshot>
): MountedEnvironmentAnchorSnapshot | null {
  const occupiedSelection = resolveMountedEnvironmentSelectionFromSnapshot(
    environmentAsset,
    mountedEnvironment
  );

  if (occupiedSelection === null) {
    return null;
  }

  syncDynamicEnvironmentSimulationPose(
    environmentAsset,
    dynamicEnvironmentPoseOverrides
  );
  environmentAsset.anchorGroup.updateMatrixWorld(true);
  const anchorWorldPosition = occupiedSelection.anchorGroup.getWorldPosition(
    mountedEnvironmentAnchorPositionScratch
  );

  return Object.freeze({
    position: freezeVector3(
      anchorWorldPosition.x,
      anchorWorldPosition.y,
      anchorWorldPosition.z
    ),
    yawRadians: resolveMetaverseYawFromObjectQuaternion(
      occupiedSelection.anchorGroup
    )
  });
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
    resolveCharacterRenderYawRadians(characterPresentation.yawRadians),
    0
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
}

function syncCharacterAnimation(
  characterProofRuntime: MetaverseCharacterProofRuntime,
  targetVocabulary: MetaverseCharacterAnimationVocabularyId
): void {
  const resolveNextVocabulary = (): MetaverseCharacterAnimationVocabularyId => {
    const fallbackCandidates: readonly MetaverseCharacterAnimationVocabularyId[] =
      targetVocabulary === "swim-idle"
        ? ["swim-idle", "idle"]
        : targetVocabulary === "swim"
          ? ["swim", "walk", "idle"]
          : targetVocabulary === "jump-up" ||
              targetVocabulary === "jump-mid" ||
              targetVocabulary === "jump-down"
            ? [targetVocabulary, "walk", "idle"]
            : [targetVocabulary, "idle"];

    for (const vocabulary of fallbackCandidates) {
      if (characterProofRuntime.actionsByVocabulary.has(vocabulary)) {
        return vocabulary;
      }
    }

    return "idle";
  };
  const nextVocabulary = resolveNextVocabulary();

  if (nextVocabulary === characterProofRuntime.activeAnimationVocabulary) {
    return;
  }

  const nextAction = characterProofRuntime.actionsByVocabulary.get(nextVocabulary);
  const previousAction = characterProofRuntime.actionsByVocabulary.get(
    characterProofRuntime.activeAnimationVocabulary
  );

  if (nextAction === undefined) {
    return;
  }

  const previousVocabulary = characterProofRuntime.activeAnimationVocabulary;

  nextAction.enabled = true;
  nextAction.setEffectiveTimeScale(1);
  nextAction.setEffectiveWeight(1);
  nextAction.zeroSlopeAtStart = true;
  nextAction.zeroSlopeAtEnd = nextVocabulary === "idle";
  nextAction.reset().play();

  if (previousAction !== undefined && previousAction !== nextAction) {
    previousAction.zeroSlopeAtEnd = nextVocabulary === "idle";

    if (
      previousVocabulary === "idle" &&
      (nextVocabulary === "walk" || nextVocabulary === "swim")
    ) {
      nextAction.setEffectiveTimeScale(1.08);
      nextAction.crossFadeFrom(previousAction, 0.24, true);
    } else if (
      (previousVocabulary === "walk" || previousVocabulary === "swim") &&
      nextVocabulary === "idle"
    ) {
      previousAction.setEffectiveTimeScale(0.92);
      nextAction.crossFadeFrom(previousAction, 0.32, false);
    } else {
      nextAction.crossFadeFrom(previousAction, 0.18, true);
    }
  }

  characterProofRuntime.activeAnimationVocabulary = nextVocabulary;
}

function createCharacterProofRuntime(
  characterId: string,
  characterScene: Group,
  clipsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationClip
  >
): MetaverseCharacterProofRuntime {
  const anchorGroup = new Group();
  const seatSocketNode = findSocketNode(characterScene, "seat_socket");
  const mixer = new AnimationMixer(characterScene);
  const actionsByVocabulary = new Map<
    MetaverseCharacterAnimationVocabularyId,
    AnimationAction
  >();

  anchorGroup.name = `metaverse_character/${characterId}`;
  anchorGroup.position.set(
    metaverseCharacterAnchorPosition.x,
    metaverseCharacterAnchorPosition.y,
    metaverseCharacterAnchorPosition.z
  );
  anchorGroup.rotation.y = metaverseCharacterProofAnchorRotationYRadians;
  anchorGroup.add(characterScene);
  anchorGroup.updateMatrixWorld(true);

  for (const [vocabulary, clip] of clipsByVocabulary) {
    actionsByVocabulary.set(vocabulary, mixer.clipAction(clip));
  }

  const idleAction = actionsByVocabulary.get("idle");

  if (idleAction === undefined) {
    throw new Error(
      `Metaverse character ${characterId} requires an idle animation vocabulary.`
    );
  }

  idleAction.play();

  return {
    activeAnimationVocabulary: "idle",
    actionsByVocabulary,
    anchorGroup,
    characterId,
    clipsByVocabulary,
    mixer,
    seatSocketNode,
    scene: characterScene
  };
}

function cloneMetaverseCharacterProofRuntime(
  sourceRuntime: MetaverseCharacterProofRuntime,
  playerId: string
): MetaverseCharacterProofRuntime {
  const clonedRuntime = createCharacterProofRuntime(
    sourceRuntime.characterId,
    cloneCharacterScene(sourceRuntime.scene),
    sourceRuntime.clipsByVocabulary
  );

  clonedRuntime.anchorGroup.name = `metaverse_character/${sourceRuntime.characterId}/${playerId}`;

  return clonedRuntime;
}

function resolveRemoteCharacterInterpolationAlpha(deltaSeconds: number): number {
  if (deltaSeconds <= 0) {
    return 0;
  }

  return 1 - Math.exp(-remoteCharacterInterpolationRatePerSecond * deltaSeconds);
}

function syncInterpolatedRemoteCharacterPresentation(
  remoteCharacterRuntime: MetaverseRemoteCharacterPresentationRuntime,
  deltaSeconds: number
): void {
  const anchorGroup = remoteCharacterRuntime.characterRuntime.anchorGroup;
  const targetPresentation = remoteCharacterRuntime.targetPresentation;
  const positionDeltaX = targetPresentation.position.x - anchorGroup.position.x;
  const positionDeltaY = targetPresentation.position.y - anchorGroup.position.y;
  const positionDeltaZ = targetPresentation.position.z - anchorGroup.position.z;
  const positionDistance = Math.hypot(
    positionDeltaX,
    positionDeltaY,
    positionDeltaZ
  );

  anchorGroup.visible = true;

  if (positionDistance >= remoteCharacterTeleportSnapDistanceMeters) {
    anchorGroup.position.set(
      targetPresentation.position.x,
      targetPresentation.position.y,
      targetPresentation.position.z
    );
    anchorGroup.rotation.set(
      0,
      resolveCharacterRenderYawRadians(targetPresentation.yawRadians),
      0
    );
    anchorGroup.updateMatrixWorld(true);
    return;
  }

  const interpolationAlpha =
    resolveRemoteCharacterInterpolationAlpha(deltaSeconds);

  if (interpolationAlpha <= 0) {
    return;
  }

  const yawDifference = wrapRadians(
    resolveCharacterRenderYawRadians(targetPresentation.yawRadians) -
      anchorGroup.rotation.y
  );

  anchorGroup.position.set(
    anchorGroup.position.x + positionDeltaX * interpolationAlpha,
    anchorGroup.position.y + positionDeltaY * interpolationAlpha,
    anchorGroup.position.z + positionDeltaZ * interpolationAlpha
  );
  anchorGroup.rotation.set(
    0,
    wrapRadians(anchorGroup.rotation.y + yawDifference * interpolationAlpha),
    0
  );
  anchorGroup.updateMatrixWorld(true);
}

function syncRemoteCharacterPresentations(
  scene: Scene,
  sourceCharacterRuntime: MetaverseCharacterProofRuntime | null,
  resolveMountedEnvironmentRuntime: (
    environmentAssetId: string
  ) => MetaverseMountableEnvironmentDynamicAssetRuntime | null,
  remoteCharacterRuntimesByPlayerId: Map<
    string,
    MetaverseRemoteCharacterPresentationRuntime
  >,
  remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[],
  deltaSeconds: number
): void {
  if (sourceCharacterRuntime === null) {
    for (const remoteCharacterRuntime of remoteCharacterRuntimesByPlayerId.values()) {
      remoteCharacterRuntime.characterRuntime.anchorGroup.parent?.remove(
        remoteCharacterRuntime.characterRuntime.anchorGroup
      );
    }

    remoteCharacterRuntimesByPlayerId.clear();
    return;
  }

  const activePlayerIds = new Set<string>();

  for (const remoteCharacterPresentation of remoteCharacterPresentations) {
    activePlayerIds.add(remoteCharacterPresentation.playerId);

    let remoteCharacterRuntime = remoteCharacterRuntimesByPlayerId.get(
      remoteCharacterPresentation.playerId
    );
    const remoteCharacterRuntimeCreated = remoteCharacterRuntime === undefined;

    if (remoteCharacterRuntimeCreated) {
      const characterRuntime = cloneMetaverseCharacterProofRuntime(
        sourceCharacterRuntime,
        remoteCharacterPresentation.playerId
      );
      remoteCharacterRuntime = {
        characterRuntime,
        mountedCharacterRuntime: null,
        targetMountedOccupancy: remoteCharacterPresentation.mountedOccupancy ?? null,
        targetPresentation: remoteCharacterPresentation.presentation
      };
      remoteCharacterRuntimesByPlayerId.set(
        remoteCharacterPresentation.playerId,
        remoteCharacterRuntime
      );
      scene.add(characterRuntime.anchorGroup);
    } else {
      const existingRemoteCharacterRuntime = remoteCharacterRuntime;

      if (existingRemoteCharacterRuntime === undefined) {
        continue;
      }

      existingRemoteCharacterRuntime.targetMountedOccupancy =
        remoteCharacterPresentation.mountedOccupancy ?? null;
      existingRemoteCharacterRuntime.targetPresentation =
        remoteCharacterPresentation.presentation;
    }

    if (remoteCharacterRuntime === undefined) {
      continue;
    }

    remoteCharacterRuntime.mountedCharacterRuntime =
      syncMountedCharacterRuntimeFromSelectionReference(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterRuntime.mountedCharacterRuntime,
        remoteCharacterRuntime.targetMountedOccupancy,
        resolveMountedEnvironmentRuntime
      );

    syncCharacterAnimation(
      remoteCharacterRuntime.characterRuntime,
      remoteCharacterPresentation.presentation.animationVocabulary
    );
    remoteCharacterRuntime.characterRuntime.mixer.update(deltaSeconds);

    if (remoteCharacterRuntime.mountedCharacterRuntime !== null) {
      syncCharacterPresentation(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterPresentation.presentation,
        remoteCharacterRuntime.mountedCharacterRuntime
      );
      applyCharacterMountedAnchorTransform(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterRuntime.mountedCharacterRuntime
      );
      continue;
    }

    if (remoteCharacterPresentation.poseSyncMode === "runtime-server-sampled") {
      syncCharacterPresentation(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterPresentation.presentation,
        null
      );
      continue;
    }

    if (remoteCharacterRuntimeCreated) {
      syncCharacterPresentation(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterPresentation.presentation,
        null
      );
    }

    syncInterpolatedRemoteCharacterPresentation(remoteCharacterRuntime, deltaSeconds);
  }

  for (const [playerId, remoteCharacterRuntime] of remoteCharacterRuntimesByPlayerId) {
    if (activePlayerIds.has(playerId)) {
      continue;
    }

    remoteCharacterRuntime.characterRuntime.anchorGroup.parent?.remove(
      remoteCharacterRuntime.characterRuntime.anchorGroup
    );
    remoteCharacterRuntimesByPlayerId.delete(playerId);
  }
}

function mountCharacterOnEnvironmentAsset(
  characterProofRuntime: MetaverseCharacterProofRuntime,
  environmentAsset: MetaverseMountableEnvironmentDynamicAssetRuntime,
  occupiedSelection: ResolvedMountedEnvironmentSelection
): MountedCharacterRuntime | null {
  const previousParent = characterProofRuntime.anchorGroup.parent;

  if (previousParent === null) {
    throw new Error("Metaverse character proof slice cannot mount without a parent anchor.");
  }

  const previousPosition = characterProofRuntime.anchorGroup.position.clone();
  const previousQuaternion = characterProofRuntime.anchorGroup.quaternion.clone();
  const previousScale = characterProofRuntime.anchorGroup.scale.clone();

  occupiedSelection.anchorGroup.add(characterProofRuntime.anchorGroup);

  const mountTransform = resolveMountedCharacterSeatTransform(
    {
      characterAnchorGroup: characterProofRuntime.anchorGroup,
      characterSeatSocketNode: characterProofRuntime.seatSocketNode,
      seatAnchorNode: occupiedSelection.anchorGroup
    },
    mountedCharacterSeatTransformScratch
  );
  const mountedCharacterRuntime = {
    cameraPolicyId: occupiedSelection.cameraPolicyId,
    controlRoutingPolicyId: occupiedSelection.controlRoutingPolicyId,
    entryId: occupiedSelection.entryId,
    environmentAsset,
    lookLimitPolicyId: occupiedSelection.lookLimitPolicyId,
    occupancyAnimationId: occupiedSelection.occupancyAnimationId,
    occupancyKind: occupiedSelection.occupancyKind,
    occupiedAnchorGroup: occupiedSelection.anchorGroup,
    occupantLabel: occupiedSelection.occupantLabel,
    occupantRole: occupiedSelection.occupantRole,
    previousParent,
    previousPosition,
    previousQuaternion,
    previousScale,
    seatId: occupiedSelection.seatId
  } as const satisfies MountedCharacterRuntime;

  characterProofRuntime.anchorGroup.position.copy(mountTransform.localPosition);
  characterProofRuntime.anchorGroup.quaternion.copy(mountTransform.localQuaternion);
  characterProofRuntime.anchorGroup.scale.copy(mountedCharacterRuntime.previousScale);
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);

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
  showSocketDebug: boolean,
  warn: (message: string) => void
): Promise<MetaverseCharacterProofRuntime> {
  const sceneAssetLoader = createSceneAssetLoader();
  const characterAsset = await sceneAssetLoader.loadAsync(characterProofConfig.modelPath);
  const animationAssetsByPath = new Map<string, LoadedSceneAsset>([
    [characterProofConfig.modelPath, characterAsset]
  ]);

  ensureSkinnedMesh(characterAsset.scene);

  for (const socketName of characterProofConfig.socketNames) {
    const socketNode = findSocketNode(characterAsset.scene, socketName);

    if (showSocketDebug) {
      ensureSocketDebugMarker(socketNode, socketName);
    }
  }

  synthesizeRuntimeSocketNodes(
    characterProofConfig,
    characterAsset.scene,
    showSocketDebug
  );

  validateCharacterScale(characterAsset.scene, characterProofConfig.label, warn);

  const clipsByVocabulary = new Map<
    MetaverseCharacterAnimationVocabularyId,
    AnimationClip
  >();

  for (const animationClipConfig of characterProofConfig.animationClips) {
    let animationAsset = animationAssetsByPath.get(animationClipConfig.sourcePath);

    if (animationAsset === undefined) {
      animationAsset = await sceneAssetLoader.loadAsync(animationClipConfig.sourcePath);
      animationAssetsByPath.set(animationClipConfig.sourcePath, animationAsset);
    }

    const clip = animationAsset.animations.find(
      (animation) => animation.name === animationClipConfig.clipName
    );

    if (clip === undefined) {
      throw new Error(
        `Metaverse character ${characterProofConfig.characterId} is missing animation ${animationClipConfig.clipName}.`
      );
    }

    if (clipsByVocabulary.has(animationClipConfig.vocabulary)) {
      throw new Error(
        `Metaverse character ${characterProofConfig.characterId} has duplicate animation vocabulary ${animationClipConfig.vocabulary}.`
      );
    }

    clipsByVocabulary.set(animationClipConfig.vocabulary, clip);
  }

  return createCharacterProofRuntime(
    characterProofConfig.characterId,
    characterAsset.scene,
    clipsByVocabulary
  );
}

async function loadMetaverseAttachmentProofRuntime(
  attachmentProofConfig: MetaverseAttachmentProofConfig,
  characterProofRuntime: MetaverseCharacterProofRuntime,
  createSceneAssetLoader: () => SceneAssetLoader
): Promise<MetaverseAttachmentProofRuntime> {
  const sceneAssetLoader = createSceneAssetLoader();
  const attachmentAsset = await sceneAssetLoader.loadAsync(attachmentProofConfig.modelPath);
  const attachmentRoot = new Group();
  const attachmentPresentationGroup = new Group();
  const heldMount = createAttachmentMountRuntime(
    attachmentProofConfig.heldMount,
    attachmentAsset.scene
  );
  const mountedHolsterMount =
    attachmentProofConfig.mountedHolsterMount === null
      ? null
      : createAttachmentMountRuntime(
          attachmentProofConfig.mountedHolsterMount,
          attachmentAsset.scene
        );

  attachmentRoot.name = `metaverse_attachment/${attachmentProofConfig.attachmentId}`;
  attachmentPresentationGroup.name = `${attachmentRoot.name}/presentation`;
  attachmentPresentationGroup.add(attachmentAsset.scene);
  for (const supportPoint of attachmentProofConfig.supportPoints ?? []) {
    const supportPointAnchor = new Group();

    supportPointAnchor.name = [
      "metaverse_attachment_support_point",
      attachmentProofConfig.attachmentId,
      supportPoint.supportPointId
    ].join("/");
    supportPointAnchor.position.set(
      supportPoint.localPosition.x,
      supportPoint.localPosition.y,
      supportPoint.localPosition.z
    );
    attachmentPresentationGroup.add(supportPointAnchor);
  }
  attachmentRoot.add(attachmentPresentationGroup);

  const attachmentRuntime: MetaverseAttachmentProofRuntime = {
    activeMountKind: null,
    attachmentRoot,
    heldMount,
    mountedHolsterMount,
    presentationGroup: attachmentPresentationGroup
  };

  syncAttachmentProofRuntimeMount(
    attachmentRuntime,
    characterProofRuntime,
    null
  );

  return attachmentRuntime;
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
  dynamicAssetIndex: number,
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
    environmentAssetProofConfig.lods[0]!.modelPath
  );
  const anchorGroup = new Group();
  const presentationGroup = new Group();
  const placement = environmentAssetProofConfig.placements[0]!;
  const environmentScene = environmentAsset.scene;
  let entries: readonly MetaverseEnvironmentEntryRuntime[] | null = null;
  let seats: readonly MetaverseEnvironmentSeatRuntime[] | null = null;

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
          authoredEntryNode.getWorldPosition(dynamicEnvironmentSeatSocketPositionScratch)
        );
        simulationEntryAnchor.quaternion.copy(
          authoredEntryNode.getWorldQuaternion(dynamicEnvironmentSeatSocketQuaternionScratch)
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
          authoredSeatNode.getWorldPosition(dynamicEnvironmentSeatSocketPositionScratch)
        );
        simulationSeatAnchor.quaternion.copy(
          authoredSeatNode.getWorldQuaternion(dynamicEnvironmentSeatSocketQuaternionScratch)
        );
        simulationSeatAnchor.scale.copy(
          authoredSeatNode.getWorldScale(dynamicEnvironmentSeatSocketScaleScratch)
        );

        if (showSocketDebug) {
          authoredSeatNode.add(createSeatDebugMarker(seat.seatId));
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

async function loadMetaverseEnvironmentProofRuntime(
  environmentProofConfig: MetaverseEnvironmentProofConfig,
  createSceneAssetLoader: () => SceneAssetLoader,
  showSocketDebug: boolean
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
        environmentAssetIndex,
        showSocketDebug
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
  bootInteractivePresentation(): Promise<void>;
  bootScenicEnvironment(): Promise<void>;
  resetPresentation(): void;
  prewarm(renderer: MetaverseSceneRendererHost): Promise<void>;
  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    focusedPortal: FocusedExperiencePortalSnapshot | null,
    nowMs: number,
    deltaSeconds: number,
    characterPresentation?: MetaverseCharacterPresentationSnapshot | null,
    remoteCharacterPresentations?: readonly MetaverseRemoteCharacterPresentationSnapshot[],
    mountedEnvironment?: MountedEnvironmentSnapshot | null
  ): MetaverseSceneInteractionSnapshot;
  readDynamicEnvironmentPose(
    environmentAssetId: string
  ): DynamicEnvironmentPoseSnapshot | null;
  readMountedEnvironmentAnchorSnapshot(
    mountedEnvironment: MountedEnvironmentSnapshot
  ): MountedEnvironmentAnchorSnapshot | null;
  setDynamicEnvironmentPose(
    environmentAssetId: string,
    poseSnapshot: DynamicEnvironmentPoseSnapshot | null
  ): void;
  syncViewport(
    renderer: MetaverseSceneRendererHost,
    canvasHost: MetaverseSceneCanvasHost,
    devicePixelRatio: number
  ): void;
  resolveBoardFocusedMountable(
    cameraSnapshot: MetaverseCameraSnapshot,
    requestedEntryId?: string | null
  ): MountedEnvironmentSnapshot | null;
  resolveSeatOccupancy(
    cameraSnapshot: MetaverseCameraSnapshot,
    requestedSeatId: string
  ): MountedEnvironmentSnapshot | null;
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
  let attachmentProofRuntime: MetaverseAttachmentProofRuntime | null = null;
  let characterProofRuntime: MetaverseCharacterProofRuntime | null = null;
  let environmentProofRuntime: MetaverseEnvironmentProofRuntime | null = null;
  let mountedCharacterRuntime: MountedCharacterRuntime | null = null;
  let previousViewportHeight: number | null = null;
  let previousViewportWidth: number | null = null;
  let interactivePresentationBootPromise: Promise<void> | null = null;
  let interactivePresentationBooted = false;
  let scenicEnvironmentBootPromise: Promise<void> | null = null;
  let scenicEnvironmentBooted = false;
  let sceneInteractionSnapshot = createSceneInteractionSnapshot(null, null);
  const dynamicEnvironmentPoseOverrides = new Map<
    string,
    DynamicEnvironmentPoseSnapshot
  >();
  const remoteCharacterRuntimesByPlayerId = new Map<
    string,
    MetaverseRemoteCharacterPresentationRuntime
  >();

  function syncSceneInteractionSnapshot(
    cameraSnapshot: MetaverseCameraSnapshot,
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): MetaverseSceneInteractionSnapshot {
    sceneInteractionSnapshot = createSceneInteractionSnapshot(
      resolveFocusedMountableSnapshot(
        environmentProofRuntime,
        mountedEnvironment,
        cameraSnapshot,
        config
      ),
      mountedEnvironment
    );

    return sceneInteractionSnapshot;
  }

  function resolveMountedEnvironmentRuntime(
    environmentAssetId: string
  ): MetaverseMountableEnvironmentDynamicAssetRuntime | null {
    if (environmentProofRuntime === null) {
      return null;
    }

    for (const environmentAsset of environmentProofRuntime.dynamicAssets) {
      if (
        environmentAsset.environmentAssetId === environmentAssetId &&
        isMountableDynamicEnvironmentAssetRuntime(environmentAsset)
      ) {
        return environmentAsset;
      }
    }

    return null;
  }

  function resolveBoardFocusedMountableInternal(
    cameraSnapshot: MetaverseCameraSnapshot,
    requestedEntryId: string | null = null
  ): MountedEnvironmentSnapshot | null {
    if (environmentProofRuntime === null) {
      return null;
    }

    const focusedEnvironment = resolveFocusedMountableEnvironmentRuntime(
      environmentProofRuntime,
      cameraSnapshot,
      config.bodyPresentation.swimThirdPersonFollowDistanceMeters
    );

    if (focusedEnvironment === null) {
      return null;
    }

    const occupiedSelection = resolveMountedEnvironmentSelectionByRequest(
      focusedEnvironment.environmentAsset,
      {
        requestedEntryId
      }
    );

    return occupiedSelection === null
      ? null
      : createMountedEnvironmentSnapshot(
          focusedEnvironment.environmentAsset,
          occupiedSelection
        );
  }

  function resolveSeatOccupancyInternal(
    cameraSnapshot: MetaverseCameraSnapshot,
    requestedSeatId: string
  ): MountedEnvironmentSnapshot | null {
    if (environmentProofRuntime === null) {
      return null;
    }

    const targetEnvironment =
      mountedCharacterRuntime?.environmentAsset ??
      resolveFocusedMountableEnvironmentRuntime(
        environmentProofRuntime,
        cameraSnapshot,
        config.bodyPresentation.swimThirdPersonFollowDistanceMeters
      )?.environmentAsset ??
      null;

    if (targetEnvironment === null) {
      return null;
    }

    const occupiedSelection = resolveMountedEnvironmentSelectionByRequest(
      targetEnvironment,
      {
        requestedSeatId
      }
    );

    return occupiedSelection === null
      ? null
      : createMountedEnvironmentSnapshot(targetEnvironment, occupiedSelection);
  }

  function syncMountedCharacterRuntimeFromSnapshot(
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void {
    if (characterProofRuntime === null || environmentProofRuntime === null) {
      return;
    }
    mountedCharacterRuntime = syncMountedCharacterRuntimeFromSelectionReference(
      characterProofRuntime,
      mountedCharacterRuntime,
      mountedEnvironment,
      resolveMountedEnvironmentRuntime
    );
  }

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

  function createCurrentCameraSnapshot(): MetaverseCameraSnapshot {
    return Object.freeze({
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
    });
  }

  async function bootScenicEnvironment(): Promise<void> {
    if (scenicEnvironmentBooted) {
      return;
    }

    if (scenicEnvironmentBootPromise !== null) {
      await scenicEnvironmentBootPromise;
      return;
    }

    scenicEnvironmentBootPromise = (async () => {
      const createSceneAssetLoader =
        dependencies.createSceneAssetLoader ?? createDefaultSceneAssetLoader;

      if (
        dependencies.environmentProofConfig !== null &&
        dependencies.environmentProofConfig !== undefined &&
        environmentProofRuntime === null
      ) {
        environmentProofRuntime = await loadMetaverseEnvironmentProofRuntime(
          dependencies.environmentProofConfig,
          createSceneAssetLoader,
          dependencies.showSocketDebug ?? false
        );
        scene.add(environmentProofRuntime.anchorGroup);
      }

      if (environmentProofRuntime !== null) {
        syncEnvironmentProofRuntime(
          environmentProofRuntime,
          createCurrentCameraSnapshot(),
          0,
          dynamicEnvironmentPoseOverrides
        );
      }

      syncSceneInteractionSnapshot(createCurrentCameraSnapshot(), null);
      scenicEnvironmentBooted = true;
    })();

    try {
      await scenicEnvironmentBootPromise;
    } finally {
      if (scenicEnvironmentBootPromise !== null) {
        scenicEnvironmentBootPromise = null;
      }
    }
  }

  async function bootInteractivePresentation(): Promise<void> {
    await bootScenicEnvironment();

    if (interactivePresentationBooted) {
      return;
    }

    if (interactivePresentationBootPromise !== null) {
      await interactivePresentationBootPromise;
      return;
    }

    interactivePresentationBootPromise = (async () => {
      const createSceneAssetLoader =
        dependencies.createSceneAssetLoader ?? createDefaultSceneAssetLoader;

      if (
        dependencies.attachmentProofConfig !== null &&
        dependencies.attachmentProofConfig !== undefined &&
        dependencies.characterProofConfig !== undefined &&
        dependencies.characterProofConfig !== null
      ) {
        const loadedCharacterProofRuntime =
          await loadMetaverseCharacterProofRuntime(
            dependencies.characterProofConfig,
            createSceneAssetLoader,
            dependencies.showSocketDebug ?? false,
            dependencies.warn ?? ((message) => globalThis.console?.warn(message))
          );

        characterProofRuntime = loadedCharacterProofRuntime;
        scene.add(loadedCharacterProofRuntime.anchorGroup);
        attachmentProofRuntime = await loadMetaverseAttachmentProofRuntime(
          dependencies.attachmentProofConfig,
          loadedCharacterProofRuntime,
          createSceneAssetLoader
        );
      } else if (
        dependencies.characterProofConfig !== null &&
        dependencies.characterProofConfig !== undefined
      ) {
        const loadedCharacterProofRuntime =
          await loadMetaverseCharacterProofRuntime(
            dependencies.characterProofConfig,
            createSceneAssetLoader,
            dependencies.showSocketDebug ?? false,
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

      interactivePresentationBooted = true;
    })();

    try {
      await interactivePresentationBootPromise;
    } finally {
      if (interactivePresentationBootPromise !== null) {
        interactivePresentationBootPromise = null;
      }
    }
  }

  return {
    camera,
    scene,
    async boot() {
      await bootScenicEnvironment();
      await bootInteractivePresentation();
    },
    bootInteractivePresentation,
    bootScenicEnvironment,
    resetPresentation() {
      if (characterProofRuntime !== null && mountedCharacterRuntime !== null) {
        dismountCharacterFromEnvironmentAsset(
          characterProofRuntime,
          mountedCharacterRuntime
        );
        mountedCharacterRuntime = null;
      }
      if (
        characterProofRuntime !== null &&
        attachmentProofRuntime !== null
      ) {
        syncAttachmentProofRuntimeMount(
          attachmentProofRuntime,
          characterProofRuntime,
          null
        );
      }

      for (const portalMesh of portalMeshes) {
        portalMesh.anchorGroup.scale.setScalar(1);
      }

      dynamicEnvironmentPoseOverrides.clear();
      for (const remoteCharacterRuntime of remoteCharacterRuntimesByPlayerId.values()) {
        remoteCharacterRuntime.characterRuntime.anchorGroup.parent?.remove(
          remoteCharacterRuntime.characterRuntime.anchorGroup
        );
      }
      remoteCharacterRuntimesByPlayerId.clear();

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
      characterPresentation = null,
      remoteCharacterPresentations = [],
      mountedEnvironment = null
    ) {
      syncCamera(camera, cameraSnapshot);
      if (characterProofRuntime !== null) {
        syncCharacterAnimation(
          characterProofRuntime,
          characterPresentation?.animationVocabulary ?? "idle"
        );
        characterProofRuntime.mixer.update(deltaSeconds);
      }
      if (environmentProofRuntime !== null) {
        syncEnvironmentProofRuntime(
          environmentProofRuntime,
          cameraSnapshot,
          nowMs,
          dynamicEnvironmentPoseOverrides
        );
      }
      syncMountedCharacterRuntimeFromSnapshot(mountedEnvironment);
      if (
        attachmentProofRuntime !== null &&
        characterProofRuntime !== null
      ) {
        syncAttachmentProofRuntimeMount(
          attachmentProofRuntime,
          characterProofRuntime,
          mountedEnvironment
        );
      }
      if (characterProofRuntime !== null) {
        syncCharacterPresentation(
          characterProofRuntime,
          characterPresentation,
          mountedCharacterRuntime
        );
      }
      if (characterProofRuntime !== null && mountedCharacterRuntime !== null) {
        applyCharacterMountedAnchorTransform(
          characterProofRuntime,
          mountedCharacterRuntime
        );
      }
      syncRemoteCharacterPresentations(
        scene,
        characterProofRuntime,
        resolveMountedEnvironmentRuntime,
        remoteCharacterRuntimesByPlayerId,
        remoteCharacterPresentations,
        deltaSeconds
      );

      for (const portalMesh of portalMeshes) {
        syncPortalPresentation(portalMesh, focusedPortal, nowMs);
      }

      return syncSceneInteractionSnapshot(cameraSnapshot, mountedEnvironment);
    },
    readDynamicEnvironmentPose(environmentAssetId) {
      if (environmentProofRuntime === null) {
        return null;
      }

      const dynamicEnvironment = environmentProofRuntime.dynamicAssets.find(
        (candidate) => candidate.environmentAssetId === environmentAssetId
      );

      if (dynamicEnvironment === undefined) {
        return null;
      }

      return resolveDynamicEnvironmentBasePose(
        dynamicEnvironment,
        dynamicEnvironmentPoseOverrides
      );
    },
    readMountedEnvironmentAnchorSnapshot(mountedEnvironment) {
      const environmentAsset = resolveMountedEnvironmentRuntime(
        mountedEnvironment.environmentAssetId
      );

      if (environmentAsset === null) {
        return null;
      }

      return resolveMountedEnvironmentAnchorSnapshot(
        environmentAsset,
        mountedEnvironment,
        dynamicEnvironmentPoseOverrides
      );
    },
    setDynamicEnvironmentPose(environmentAssetId, poseSnapshot) {
      if (poseSnapshot === null) {
        dynamicEnvironmentPoseOverrides.delete(environmentAssetId);
        return;
      }

      dynamicEnvironmentPoseOverrides.set(
        environmentAssetId,
        Object.freeze({
          position: freezeVector3(
            poseSnapshot.position.x,
            poseSnapshot.position.y,
            poseSnapshot.position.z
          ),
          yawRadians: wrapRadians(poseSnapshot.yawRadians)
        })
      );
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
    resolveBoardFocusedMountable(cameraSnapshot, requestedEntryId = null) {
      return resolveBoardFocusedMountableInternal(cameraSnapshot, requestedEntryId);
    },
    resolveSeatOccupancy(cameraSnapshot, requestedSeatId) {
      return resolveSeatOccupancyInternal(cameraSnapshot, requestedSeatId);
    }
  };
}
