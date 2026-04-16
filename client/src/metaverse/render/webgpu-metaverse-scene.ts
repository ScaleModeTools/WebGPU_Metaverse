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
  min,
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
import {
  metaverseWorldPlacedWaterRegions,
  resolveMetaverseWorldWaterRegionFloorHeightMeters,
  resolveMetaverseWorldWaterRegionSurfaceHeightMeters,
  type MetaverseWorldPlacedWaterRegionSnapshot
} from "@webgpu-metaverse/shared";

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
  MetaverseHumanoidV2PistolPoseId,
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
import { metaverseHumanoidV2PistolPoseIds } from "../types/metaverse-runtime";
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
  activeAnimationActionSetId: "full-body" | "humanoid_v2_pistol_lower_body";
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
  readonly heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime | null;
  readonly humanoidV2PistolLowerBodyActionsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationAction
  > | null;
  readonly humanoidV2PistolPoseRuntime: HumanoidV2PistolPoseRuntime | null;
  readonly mixer: AnimationMixer;
  readonly seatSocketNode: Object3D;
  readonly scene: Group;
  readonly skeletonId: MetaverseCharacterProofConfig["skeletonId"];
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
  readonly heldForwardReferenceNode: Object3D | null;
  readonly heldMount: MetaverseAttachmentMountRuntime;
  implicitOffHandGripLocalPosition: Vector3 | null;
  implicitOffHandGripLocalQuaternion: Quaternion | null;
  readonly mountedHolsterMount: MetaverseAttachmentMountRuntime | null;
  readonly offHandSupportNode: Object3D | null;
  readonly presentationGroup: Group;
}

interface HumanoidV2HeldWeaponPoseRuntime {
  readonly drivenBones: readonly {
    readonly authoredLocalQuaternion: Quaternion;
    readonly bone: Bone;
  }[];
  readonly leftGripSocketNode: Object3D;
  readonly leftHandBone: Bone;
  readonly leftLowerarmBone: Bone;
  readonly leftPalmSocketNode: Object3D;
  readonly leftSupportChain: readonly HeldWeaponSolveChainLink[];
  readonly leftUpperarmBone: Bone;
  readonly rightGripSocketNode: Object3D;
  readonly rightHandBone: Bone;
  readonly rightLowerarmBone: Bone;
  readonly rightAimChain: readonly HeldWeaponSolveChainLink[];
  readonly rightUpperarmBone: Bone;
}

interface HumanoidV2PistolPoseRuntime {
  readonly actionsByPoseId: ReadonlyMap<
    MetaverseHumanoidV2PistolPoseId,
    AnimationAction
  >;
  readonly clipsByPoseId: ReadonlyMap<
    MetaverseHumanoidV2PistolPoseId,
    AnimationClip
  >;
}

interface HeldWeaponSolveChainLink {
  readonly bone: Bone;
  readonly solveWeight: number;
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
  lastLodSwitchAtMs: number;
  readonly lods: readonly MetaverseEnvironmentLodObjectRuntime[];
  readonly placement: MetaverseEnvironmentPlacementProofConfig;
}

interface MetaverseEnvironmentInstancedAssetRuntime {
  activeLodIndex: number;
  lastLodSwitchAtMs: number;
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
  grip_l_socket: [0.18, 0.82, 1],
  grip_r_socket: [1, 0.52, 0.4],
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
const environmentLodSwitchCooldownMs = 180;
const remoteCharacterInterpolationRatePerSecond = 12;
const remoteCharacterTeleportSnapDistanceMeters = 3.5;
const heldWeaponAimSolveIterations = 10;
const heldWeaponCoupledSolvePasses = 5;
const heldWeaponAimTargetDistanceMeters = 16;
const heldWeaponClavicleSolveWeight = 0.28;
const heldWeaponElbowPoleAcrossBias = 0.42;
const heldWeaponElbowPoleBiasWeight = 0.92;
const heldWeaponElbowPoleDownBias = 0.7;
const heldWeaponElbowPoleFinalizeWeight = 0.75;
const heldWeaponElbowPolePreferenceWeight = 1.4;
const heldWeaponElbowPoleRefineIterations = 4;
const heldWeaponForearmSolveWeight = 0.96;
const heldWeaponHandSolveWeight = 0;
const heldWeaponSolveDirectionEpsilon = 0.000001;
const heldWeaponSupportHandPitchRadians = -0.3;
const heldWeaponSupportHandRollRadians = Math.PI * 0.38;
const heldWeaponUpperarmSolveWeight = 0.9;
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
const humanoidV2PistolOverlayExcludedTrackPrefixes = Object.freeze([
  "root",
  "pelvis",
  "thigh_",
  "calf_",
  "foot_",
  "ball_"
] as const);
const humanoidV2PistolLowerBodyVocabularyIds = Object.freeze([
  "idle",
  "walk"
] as const satisfies readonly MetaverseCharacterAnimationVocabularyId[]);
const humanoidV2PistolPoseWeightEpsilon = 0.000001;
const humanoidV1BackSocketLocalPosition = new Vector3(0, 0.14, -0.08);
const heldWeaponAttachmentGripWorldPositionScratch = new Vector3();
const heldWeaponClampedHandTargetWorldPositionScratch = new Vector3();
const heldWeaponEffectorWorldPositionScratch = new Vector3();
const heldWeaponTargetWorldPositionScratch = new Vector3();
const heldWeaponBoneWorldPositionScratch = new Vector3();
const heldWeaponElbowTargetWorldPositionScratch = new Vector3();
const heldWeaponEffectorDirectionScratch = new Vector3();
const heldWeaponTargetDirectionScratch = new Vector3();
const heldWeaponLookDirectionScratch = new Vector3();
const heldWeaponGripUpDirectionScratch = new Vector3();
const heldWeaponGripAcrossDirectionScratch = new Vector3();
const heldWeaponGripSocketWorldPositionScratch = new Vector3();
const heldWeaponLeftHandTargetWorldPositionScratch = new Vector3();
const heldWeaponShoulderWorldPositionScratch = new Vector3();
const heldWeaponElbowWorldPositionScratch = new Vector3();
const heldWeaponRightHandTargetWorldPositionScratch = new Vector3();
const heldWeaponSocketLocalOffsetScratch = new Vector3();
const heldWeaponWristWorldPositionScratch = new Vector3();
const heldWeaponArmAxisScratch = new Vector3();
const heldWeaponCurrentPoleDirectionScratch = new Vector3();
const heldWeaponPoleDirectionCrossScratch = new Vector3();
const heldWeaponTargetPoleDirectionScratch = new Vector3();
const heldWeaponRightElbowPolePreferenceScratch = new Vector3();
const heldWeaponLeftElbowPolePreferenceScratch = new Vector3();
const heldWeaponRightElbowPoleTargetScratch = new Vector3();
const heldWeaponLeftElbowPoleTargetScratch = new Vector3();
const heldWeaponParentWorldQuaternionScratch = new Quaternion();
const heldWeaponParentWorldQuaternionInverseScratch = new Quaternion();
const heldWeaponLocalDeltaQuaternionScratch = new Quaternion();
const heldWeaponSupportHandPitchWorldQuaternionScratch = new Quaternion();
const heldWeaponSupportHandTargetWorldQuaternionScratch = new Quaternion();
const heldWeaponSupportHandWorldRollQuaternionScratch = new Quaternion();
const heldWeaponImplicitOffHandTargetWorldQuaternionScratch = new Quaternion();
const heldWeaponAttachmentWorldQuaternionScratch = new Quaternion();
const heldWeaponAttachmentWorldQuaternionInverseScratch = new Quaternion();
const heldWeaponWeightedLocalDeltaQuaternionScratch = new Quaternion();
const heldWeaponTargetWorldQuaternionScratch = new Quaternion();
const heldWeaponCurrentWorldQuaternionScratch = new Quaternion();
const heldWeaponWorldDeltaQuaternionScratch = new Quaternion();
const heldWeaponParentLocalDeltaQuaternionScratch = new Quaternion();
const heldWeaponGripAlignmentMatrixScratch = new Matrix4();

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
      gripSocketName: "grip_l_socket",
      knuckleBaseBoneNames: [
        "index_01_l",
        "middle_01_l",
        "ring_01_l",
        "pinky_01_l"
      ] as const,
      parentBoneName: "hand_l",
      sourceSocketName: "hand_l_socket",
      thumbBaseBoneName: "thumb_01_l",
      synthesizedSocketName: "palm_l_socket"
    },
    {
      gripSocketName: "grip_r_socket",
      knuckleBaseBoneNames: [
        "index_01_r",
        "middle_01_r",
        "ring_01_r",
        "pinky_01_r"
      ] as const,
      parentBoneName: "hand_r",
      sourceSocketName: "hand_r_socket",
      thumbBaseBoneName: "thumb_01_r",
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
    const knuckleBaseCentroid = new Vector3();

    for (const knuckleBaseBoneName of palmSocketDescriptor.knuckleBaseBoneNames) {
      const knuckleBaseBone = findBoneNode(
        characterScene,
        knuckleBaseBoneName,
        "Metaverse humanoid_v2 palm socket synthesis"
      );

      knuckleBaseCentroid.add(
        parentBone.worldToLocal(knuckleBaseBone.getWorldPosition(new Vector3()))
      );
    }

    knuckleBaseCentroid.multiplyScalar(
      1 / palmSocketDescriptor.knuckleBaseBoneNames.length
    );
    const thumbBaseLocalPosition = parentBone.worldToLocal(
      findBoneNode(
        characterScene,
        palmSocketDescriptor.thumbBaseBoneName,
        "Metaverse humanoid_v2 palm socket synthesis"
      ).getWorldPosition(new Vector3())
    );
    const palmForwardAxis = knuckleBaseCentroid.clone().normalize();

    if (palmForwardAxis.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
      throw new Error(
        `Metaverse humanoid_v2 palm socket synthesis requires ${palmSocketDescriptor.synthesizedSocketName} knuckle bases to stay offset from the hand root.`
      );
    }

    const palmUpAxis = thumbBaseLocalPosition.clone().sub(knuckleBaseCentroid);

    palmUpAxis.addScaledVector(
      palmForwardAxis,
      -palmUpAxis.dot(palmForwardAxis)
    );

    if (palmUpAxis.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
      throw new Error(
        `Metaverse humanoid_v2 palm socket synthesis requires ${palmSocketDescriptor.synthesizedSocketName} thumb basis to stay non-collinear with the knuckle line.`
      );
    }

    palmUpAxis.normalize();

    const palmSideAxis = palmForwardAxis.clone().cross(palmUpAxis);

    if (palmSideAxis.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
      throw new Error(
        `Metaverse humanoid_v2 palm socket synthesis requires ${palmSocketDescriptor.synthesizedSocketName} side basis to stay non-degenerate.`
      );
    }

    palmSideAxis.normalize();
    const correctedPalmUpAxis = palmSideAxis
      .clone()
      .cross(palmForwardAxis)
      .normalize();

    // Bias the authored hand socket toward the knuckle line so the palm seam
    // inherits the rig's mirrored finger spread without drifting onto the
    // fingers. Derive a mirrored palm basis from the knuckle line plus thumb
    // direction so held weapons use one stable semantic orientation across the
    // whole humanoid_v2 rig instead of socket-specific authored twists.
    const palmLocalPosition = sourceSocketNode.position
      .clone()
      .lerp(knuckleBaseCentroid, humanoidV2PalmSocketBlendAlpha);
    const synthesizedHandQuaternion = new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(
        palmForwardAxis,
        correctedPalmUpAxis,
        palmSideAxis
      )
    );

    upsertSyntheticSocketNode(
      characterScene,
      parentBone,
      palmSocketDescriptor.synthesizedSocketName,
      palmLocalPosition,
      showSocketDebug,
      synthesizedHandQuaternion
    );
    upsertSyntheticSocketNode(
      characterScene,
      parentBone,
      palmSocketDescriptor.gripSocketName,
      knuckleBaseCentroid,
      showSocketDebug,
      synthesizedHandQuaternion
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createHumanoidV2HeldWeaponPoseRuntime(
  characterScene: Group
): HumanoidV2HeldWeaponPoseRuntime {
  const leftHandBone = findBoneNode(
    characterScene,
    "hand_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const rightHandBone = findBoneNode(
    characterScene,
    "hand_r",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftLowerarmBone = findBoneNode(
    characterScene,
    "lowerarm_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftUpperarmBone = findBoneNode(
    characterScene,
    "upperarm_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const rightLowerarmBone = findBoneNode(
    characterScene,
    "lowerarm_r",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const rightUpperarmBone = findBoneNode(
    characterScene,
    "upperarm_r",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const createSolveChain = (
    handBone: Bone,
    lowerarmBone: Bone,
    upperarmBone: Bone,
    clavicleBoneName: string
  ) =>
    [
      {
        bone: handBone,
        solveWeight: heldWeaponHandSolveWeight
      },
      {
        bone: lowerarmBone,
        solveWeight: heldWeaponForearmSolveWeight
      },
      {
        bone: upperarmBone,
        solveWeight: heldWeaponUpperarmSolveWeight
      },
      {
        bone: findBoneNode(
          characterScene,
          clavicleBoneName,
          "Metaverse humanoid_v2 held weapon pose"
        ),
        solveWeight: heldWeaponClavicleSolveWeight
      }
    ] as const;
  const leftSupportChain = createSolveChain(
    leftHandBone,
    leftLowerarmBone,
    leftUpperarmBone,
    "clavicle_l"
  );
  const rightAimChain = createSolveChain(
    rightHandBone,
    rightLowerarmBone,
    rightUpperarmBone,
    "clavicle_r"
  );
  const drivenBonesByName = new Map<string, Bone>();

  for (const bone of [...leftSupportChain, ...rightAimChain]) {
    if (!drivenBonesByName.has(bone.bone.name)) {
      drivenBonesByName.set(bone.bone.name, bone.bone);
    }
  }

  return {
    drivenBones: [...drivenBonesByName.values()].map((bone) => ({
      authoredLocalQuaternion: bone.quaternion.clone(),
      bone
    })),
    leftGripSocketNode: findSocketNode(characterScene, "grip_l_socket"),
    leftHandBone,
    leftLowerarmBone,
    leftPalmSocketNode: findSocketNode(characterScene, "palm_l_socket"),
    leftSupportChain,
    leftUpperarmBone,
    rightGripSocketNode: findSocketNode(characterScene, "grip_r_socket"),
    rightHandBone,
    rightLowerarmBone,
    rightAimChain,
    rightUpperarmBone
  };
}

function restoreHumanoidV2HeldWeaponPoseRuntime(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime
): void {
  for (const drivenBone of heldWeaponPoseRuntime.drivenBones) {
    drivenBone.bone.quaternion.copy(drivenBone.authoredLocalQuaternion);
  }
}

function createHeldWeaponPoseRuntime(
  skeletonId: MetaverseCharacterProofConfig["skeletonId"],
  characterScene: Group
): HumanoidV2HeldWeaponPoseRuntime | null {
  switch (skeletonId) {
    case "humanoid_v1":
      return null;
    case "humanoid_v2":
      return createHumanoidV2HeldWeaponPoseRuntime(characterScene);
  }
}

function solveBoneChainTowardWorldTarget(
  chainBones: readonly HeldWeaponSolveChainLink[],
  effectorNode: Object3D,
  targetWorldPosition: Vector3,
  iterations: number
): void {
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const chainLink of chainBones) {
      const solveWeight = clamp(chainLink.solveWeight, 0, 1);

      if (solveWeight <= heldWeaponSolveDirectionEpsilon) {
        continue;
      }

      const bone = chainLink.bone;
      const parentNode = bone.parent;

      if (parentNode === null) {
        continue;
      }

      bone.getWorldPosition(heldWeaponBoneWorldPositionScratch);
      effectorNode.getWorldPosition(heldWeaponEffectorWorldPositionScratch);
      heldWeaponEffectorDirectionScratch
        .copy(heldWeaponEffectorWorldPositionScratch)
        .sub(heldWeaponBoneWorldPositionScratch);
      heldWeaponTargetDirectionScratch
        .copy(targetWorldPosition)
        .sub(heldWeaponBoneWorldPositionScratch);

      if (
        heldWeaponEffectorDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon ||
        heldWeaponTargetDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon
      ) {
        continue;
      }

      heldWeaponParentWorldQuaternionInverseScratch
        .copy(parentNode.getWorldQuaternion(heldWeaponParentWorldQuaternionScratch))
        .invert();
      heldWeaponEffectorDirectionScratch
        .normalize()
        .applyQuaternion(heldWeaponParentWorldQuaternionInverseScratch);
      heldWeaponTargetDirectionScratch
        .normalize()
        .applyQuaternion(heldWeaponParentWorldQuaternionInverseScratch);

      const directionDot = clamp(
        heldWeaponEffectorDirectionScratch.dot(heldWeaponTargetDirectionScratch),
        -1,
        1
      );

      if (directionDot >= 0.999999) {
        continue;
      }

      heldWeaponLocalDeltaQuaternionScratch.setFromUnitVectors(
        heldWeaponEffectorDirectionScratch,
        heldWeaponTargetDirectionScratch
      );
      bone.quaternion.premultiply(
        solveWeight >= 0.999999
          ? heldWeaponLocalDeltaQuaternionScratch
          : heldWeaponWeightedLocalDeltaQuaternionScratch
              .identity()
              .slerp(heldWeaponLocalDeltaQuaternionScratch, solveWeight)
      );
      bone.updateMatrixWorld(true);
    }
  }
}

function alignBoneTowardEffectorWorldQuaternion(
  bone: Bone,
  effectorNode: Object3D,
  targetWorldQuaternion: Quaternion
): void {
  const parentNode = bone.parent;

  if (parentNode === null) {
    return;
  }

  effectorNode.updateMatrixWorld(true);
  heldWeaponCurrentWorldQuaternionScratch.copy(
    effectorNode.getWorldQuaternion(heldWeaponCurrentWorldQuaternionScratch)
  );

  if (
    heldWeaponCurrentWorldQuaternionScratch.angleTo(targetWorldQuaternion) <=
    heldWeaponSolveDirectionEpsilon
  ) {
    return;
  }

  heldWeaponWorldDeltaQuaternionScratch
    .copy(targetWorldQuaternion)
    .multiply(heldWeaponCurrentWorldQuaternionScratch.invert());
  heldWeaponParentWorldQuaternionScratch.copy(
    parentNode.getWorldQuaternion(heldWeaponParentWorldQuaternionScratch)
  );
  heldWeaponParentWorldQuaternionInverseScratch
    .copy(heldWeaponParentWorldQuaternionScratch)
    .invert();
  heldWeaponParentLocalDeltaQuaternionScratch
    .copy(heldWeaponParentWorldQuaternionInverseScratch)
    .multiply(heldWeaponWorldDeltaQuaternionScratch)
    .multiply(heldWeaponParentWorldQuaternionScratch);
  bone.quaternion.premultiply(heldWeaponParentLocalDeltaQuaternionScratch);
  bone.updateMatrixWorld(true);
}

function alignBoneTowardWorldPoint(
  bone: Bone,
  effectorNode: Object3D,
  targetWorldPosition: Vector3
): void {
  const parentNode = bone.parent;

  if (parentNode === null) {
    return;
  }

  bone.getWorldPosition(heldWeaponBoneWorldPositionScratch);
  effectorNode.getWorldPosition(heldWeaponEffectorWorldPositionScratch);
  heldWeaponEffectorDirectionScratch
    .copy(heldWeaponEffectorWorldPositionScratch)
    .sub(heldWeaponBoneWorldPositionScratch);
  heldWeaponTargetDirectionScratch
    .copy(targetWorldPosition)
    .sub(heldWeaponBoneWorldPositionScratch);

  if (
    heldWeaponEffectorDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon ||
    heldWeaponTargetDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon
  ) {
    return;
  }

  heldWeaponParentWorldQuaternionInverseScratch
    .copy(parentNode.getWorldQuaternion(heldWeaponParentWorldQuaternionScratch))
    .invert();
  heldWeaponEffectorDirectionScratch
    .normalize()
    .applyQuaternion(heldWeaponParentWorldQuaternionInverseScratch);
  heldWeaponTargetDirectionScratch
    .normalize()
    .applyQuaternion(heldWeaponParentWorldQuaternionInverseScratch);
  heldWeaponLocalDeltaQuaternionScratch.setFromUnitVectors(
    heldWeaponEffectorDirectionScratch,
    heldWeaponTargetDirectionScratch
  );
  bone.quaternion.premultiply(heldWeaponLocalDeltaQuaternionScratch);
  bone.updateMatrixWorld(true);
}

function resolveHandWorldTargetPosition(
  gripSocketNode: Object3D,
  handTargetWorldQuaternion: Quaternion,
  gripTargetWorldPosition: Vector3,
  outputHandWorldPosition: Vector3
): void {
  outputHandWorldPosition.copy(gripTargetWorldPosition).sub(
    heldWeaponSocketLocalOffsetScratch
      .copy(gripSocketNode.position)
      .applyQuaternion(handTargetWorldQuaternion)
  );
}

function solveTwoBoneArmToHandWorldTarget(
  upperarmBone: Bone,
  lowerarmBone: Bone,
  handBone: Bone,
  handWorldTargetPosition: Vector3,
  poleWorldDirection: Vector3
): void {
  upperarmBone.getWorldPosition(heldWeaponShoulderWorldPositionScratch);
  lowerarmBone.getWorldPosition(heldWeaponElbowWorldPositionScratch);
  handBone.getWorldPosition(heldWeaponWristWorldPositionScratch);
  const upperarmLength = heldWeaponShoulderWorldPositionScratch.distanceTo(
    heldWeaponElbowWorldPositionScratch
  );
  const lowerarmLength = heldWeaponElbowWorldPositionScratch.distanceTo(
    heldWeaponWristWorldPositionScratch
  );

  if (
    upperarmLength <= heldWeaponSolveDirectionEpsilon ||
    lowerarmLength <= heldWeaponSolveDirectionEpsilon
  ) {
    return;
  }

  heldWeaponTargetDirectionScratch
    .copy(handWorldTargetPosition)
    .sub(heldWeaponShoulderWorldPositionScratch);
  const targetDistance = heldWeaponTargetDirectionScratch.length();

  if (targetDistance <= heldWeaponSolveDirectionEpsilon) {
    return;
  }

  heldWeaponTargetDirectionScratch.normalize();
  heldWeaponTargetPoleDirectionScratch.copy(poleWorldDirection);
  heldWeaponTargetPoleDirectionScratch.addScaledVector(
    heldWeaponTargetDirectionScratch,
    -heldWeaponTargetPoleDirectionScratch.dot(heldWeaponTargetDirectionScratch)
  );

  if (
    heldWeaponTargetPoleDirectionScratch.lengthSq() <=
    heldWeaponSolveDirectionEpsilon
  ) {
    heldWeaponTargetPoleDirectionScratch
      .copy(heldWeaponElbowWorldPositionScratch)
      .sub(heldWeaponShoulderWorldPositionScratch);
    heldWeaponTargetPoleDirectionScratch.addScaledVector(
      heldWeaponTargetDirectionScratch,
      -heldWeaponTargetPoleDirectionScratch.dot(heldWeaponTargetDirectionScratch)
    );
  }

  if (
    heldWeaponTargetPoleDirectionScratch.lengthSq() <=
    heldWeaponSolveDirectionEpsilon
  ) {
    return;
  }

  heldWeaponTargetPoleDirectionScratch.normalize();
  const clampedTargetDistance = clamp(
    targetDistance,
    Math.max(
      heldWeaponSolveDirectionEpsilon,
      Math.abs(upperarmLength - lowerarmLength) + 0.0001
    ),
    Math.max(
      heldWeaponSolveDirectionEpsilon,
      upperarmLength + lowerarmLength - 0.0001
    )
  );
  heldWeaponClampedHandTargetWorldPositionScratch
    .copy(heldWeaponShoulderWorldPositionScratch)
    .addScaledVector(heldWeaponTargetDirectionScratch, clampedTargetDistance);
  const elbowProjectionDistance =
    (upperarmLength * upperarmLength -
      lowerarmLength * lowerarmLength +
      clampedTargetDistance * clampedTargetDistance) /
    (2 * clampedTargetDistance);
  const elbowHeight = Math.sqrt(
    Math.max(
      0,
      upperarmLength * upperarmLength -
        elbowProjectionDistance * elbowProjectionDistance
    )
  );

  heldWeaponElbowTargetWorldPositionScratch
    .copy(heldWeaponShoulderWorldPositionScratch)
    .addScaledVector(heldWeaponTargetDirectionScratch, elbowProjectionDistance)
    .addScaledVector(heldWeaponTargetPoleDirectionScratch, elbowHeight);
  alignBoneTowardWorldPoint(
    upperarmBone,
    lowerarmBone,
    heldWeaponElbowTargetWorldPositionScratch
  );
  alignBoneTowardWorldPoint(
    lowerarmBone,
    handBone,
    heldWeaponClampedHandTargetWorldPositionScratch
  );
}

function resolveElbowPoleDirection(
  upperarmBone: Bone,
  lowerarmBone: Bone,
  handBone: Bone,
  fallbackWorldDirection: Vector3,
  outputWorldDirection: Vector3
): void {
  upperarmBone.getWorldPosition(heldWeaponShoulderWorldPositionScratch);
  lowerarmBone.getWorldPosition(heldWeaponElbowWorldPositionScratch);
  handBone.getWorldPosition(heldWeaponWristWorldPositionScratch);
  heldWeaponArmAxisScratch
    .copy(heldWeaponWristWorldPositionScratch)
    .sub(heldWeaponShoulderWorldPositionScratch);

  if (heldWeaponArmAxisScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    outputWorldDirection.copy(fallbackWorldDirection).normalize();

    return;
  }

  heldWeaponArmAxisScratch.normalize();
  outputWorldDirection
    .copy(heldWeaponElbowWorldPositionScratch)
    .sub(heldWeaponShoulderWorldPositionScratch);
  outputWorldDirection.addScaledVector(
    heldWeaponArmAxisScratch,
    -outputWorldDirection.dot(heldWeaponArmAxisScratch)
  );

  if (outputWorldDirection.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    outputWorldDirection.copy(fallbackWorldDirection);
    outputWorldDirection.addScaledVector(
      heldWeaponArmAxisScratch,
      -outputWorldDirection.dot(heldWeaponArmAxisScratch)
    );
  }

  if (outputWorldDirection.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    outputWorldDirection.copy(fallbackWorldDirection).normalize();

    return;
  }

  outputWorldDirection.normalize();
}

function applyElbowPoleBias(
  upperarmBone: Bone,
  lowerarmBone: Bone,
  handBone: Bone,
  targetWorldDirection: Vector3,
  biasWeight: number
): void {
  const clampedBiasWeight = clamp(biasWeight, 0, 1);

  if (clampedBiasWeight <= heldWeaponSolveDirectionEpsilon) {
    return;
  }

  const parentNode = upperarmBone.parent;

  if (parentNode === null) {
    return;
  }

  upperarmBone.getWorldPosition(heldWeaponShoulderWorldPositionScratch);
  lowerarmBone.getWorldPosition(heldWeaponElbowWorldPositionScratch);
  handBone.getWorldPosition(heldWeaponWristWorldPositionScratch);
  heldWeaponArmAxisScratch
    .copy(heldWeaponWristWorldPositionScratch)
    .sub(heldWeaponShoulderWorldPositionScratch);

  if (heldWeaponArmAxisScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    return;
  }

  heldWeaponArmAxisScratch.normalize();
  heldWeaponCurrentPoleDirectionScratch
    .copy(heldWeaponElbowWorldPositionScratch)
    .sub(heldWeaponShoulderWorldPositionScratch);
  heldWeaponCurrentPoleDirectionScratch.addScaledVector(
    heldWeaponArmAxisScratch,
    -heldWeaponCurrentPoleDirectionScratch.dot(heldWeaponArmAxisScratch)
  );

  if (
    heldWeaponCurrentPoleDirectionScratch.lengthSq() <=
    heldWeaponSolveDirectionEpsilon
  ) {
    return;
  }

  heldWeaponCurrentPoleDirectionScratch.normalize();
  heldWeaponTargetPoleDirectionScratch.copy(targetWorldDirection);
  heldWeaponTargetPoleDirectionScratch.addScaledVector(
    heldWeaponArmAxisScratch,
    -heldWeaponTargetPoleDirectionScratch.dot(heldWeaponArmAxisScratch)
  );

  if (
    heldWeaponTargetPoleDirectionScratch.lengthSq() <=
    heldWeaponSolveDirectionEpsilon
  ) {
    return;
  }

  heldWeaponTargetPoleDirectionScratch.normalize();
  const signedPoleAngle = Math.atan2(
    heldWeaponArmAxisScratch.dot(
      heldWeaponPoleDirectionCrossScratch
        .copy(heldWeaponCurrentPoleDirectionScratch)
        .cross(heldWeaponTargetPoleDirectionScratch)
    ),
    clamp(
      heldWeaponCurrentPoleDirectionScratch.dot(
        heldWeaponTargetPoleDirectionScratch
      ),
      -1,
      1
    )
  );

  if (Math.abs(signedPoleAngle) <= heldWeaponSolveDirectionEpsilon) {
    return;
  }

  heldWeaponWorldDeltaQuaternionScratch.setFromAxisAngle(
    heldWeaponArmAxisScratch,
    signedPoleAngle * clampedBiasWeight
  );
  heldWeaponParentWorldQuaternionScratch.copy(
    parentNode.getWorldQuaternion(heldWeaponParentWorldQuaternionScratch)
  );
  heldWeaponParentWorldQuaternionInverseScratch
    .copy(heldWeaponParentWorldQuaternionScratch)
    .invert();
  heldWeaponParentLocalDeltaQuaternionScratch
    .copy(heldWeaponParentWorldQuaternionInverseScratch)
    .multiply(heldWeaponWorldDeltaQuaternionScratch)
    .multiply(heldWeaponParentWorldQuaternionScratch);
  upperarmBone.quaternion.premultiply(heldWeaponParentLocalDeltaQuaternionScratch);
  upperarmBone.updateMatrixWorld(true);
}

function syncHumanoidV2HeldWeaponPose(
  characterProofRuntime: MetaverseCharacterProofRuntime,
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  cameraSnapshot: MetaverseCameraSnapshot
): void {
  const heldForwardReferenceNode = attachmentRuntime.heldForwardReferenceNode;

  if (heldForwardReferenceNode === null) {
    return;
  }

  heldWeaponLookDirectionScratch.set(
    cameraSnapshot.lookDirection.x,
    cameraSnapshot.lookDirection.y,
    cameraSnapshot.lookDirection.z
  );

  if (heldWeaponLookDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    return;
  }

  heldWeaponLookDirectionScratch.normalize();
  heldWeaponGripUpDirectionScratch.set(0, 1, 0);
  heldWeaponGripUpDirectionScratch.addScaledVector(
    heldWeaponLookDirectionScratch,
    -heldWeaponGripUpDirectionScratch.dot(heldWeaponLookDirectionScratch)
  );

  if (heldWeaponGripUpDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    heldWeaponGripUpDirectionScratch.set(0, 0, 1);
    heldWeaponGripUpDirectionScratch.addScaledVector(
      heldWeaponLookDirectionScratch,
      -heldWeaponGripUpDirectionScratch.dot(heldWeaponLookDirectionScratch)
    );
  }

  if (heldWeaponGripUpDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    return;
  }

  heldWeaponGripUpDirectionScratch.normalize();
  heldWeaponGripAcrossDirectionScratch
    .copy(heldWeaponLookDirectionScratch)
    .cross(heldWeaponGripUpDirectionScratch);

  if (heldWeaponGripAcrossDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    return;
  }

  heldWeaponGripAcrossDirectionScratch.normalize();
  heldWeaponGripUpDirectionScratch
    .copy(heldWeaponGripAcrossDirectionScratch)
    .cross(heldWeaponLookDirectionScratch)
    .normalize();
  heldWeaponTargetWorldQuaternionScratch.setFromRotationMatrix(
    heldWeaponGripAlignmentMatrixScratch.makeBasis(
      heldWeaponLookDirectionScratch,
      heldWeaponGripUpDirectionScratch,
      heldWeaponGripAcrossDirectionScratch
    )
  );
  heldWeaponSupportHandTargetWorldQuaternionScratch
    .copy(
      heldWeaponSupportHandPitchWorldQuaternionScratch.setFromAxisAngle(
        heldWeaponGripAcrossDirectionScratch,
        heldWeaponSupportHandPitchRadians
      )
    )
    .multiply(
      heldWeaponSupportHandWorldRollQuaternionScratch.setFromAxisAngle(
        heldWeaponLookDirectionScratch,
        heldWeaponSupportHandRollRadians
      )
    )
    .multiply(heldWeaponTargetWorldQuaternionScratch);
  heldWeaponRightElbowPolePreferenceScratch
    .copy(heldWeaponGripAcrossDirectionScratch)
    .multiplyScalar(heldWeaponElbowPoleAcrossBias)
    .addScaledVector(
      heldWeaponGripUpDirectionScratch,
      -heldWeaponElbowPoleDownBias
    )
    .normalize();
  heldWeaponLeftElbowPolePreferenceScratch
    .copy(heldWeaponGripAcrossDirectionScratch)
    .multiplyScalar(-heldWeaponElbowPoleAcrossBias)
    .addScaledVector(
      heldWeaponGripUpDirectionScratch,
      -heldWeaponElbowPoleDownBias
    )
    .normalize();
  resolveElbowPoleDirection(
    heldWeaponPoseRuntime.rightUpperarmBone,
    heldWeaponPoseRuntime.rightLowerarmBone,
    heldWeaponPoseRuntime.rightHandBone,
    heldWeaponRightElbowPolePreferenceScratch,
    heldWeaponRightElbowPoleTargetScratch
  );
  heldWeaponRightElbowPoleTargetScratch.addScaledVector(
    heldWeaponRightElbowPolePreferenceScratch,
    heldWeaponElbowPolePreferenceWeight
  );
  heldWeaponRightElbowPoleTargetScratch.normalize();
  resolveElbowPoleDirection(
    heldWeaponPoseRuntime.leftUpperarmBone,
    heldWeaponPoseRuntime.leftLowerarmBone,
    heldWeaponPoseRuntime.leftHandBone,
    heldWeaponLeftElbowPolePreferenceScratch,
    heldWeaponLeftElbowPoleTargetScratch
  );
  heldWeaponLeftElbowPoleTargetScratch.addScaledVector(
    heldWeaponLeftElbowPolePreferenceScratch,
    heldWeaponElbowPolePreferenceWeight
  );
  heldWeaponLeftElbowPoleTargetScratch.normalize();
  // Keep the traversal camera authoritative by aiming the weapon toward a
  // point on the camera ray instead of a weapon-relative forward proxy.
  heldWeaponTargetWorldPositionScratch
    .set(
      cameraSnapshot.position.x,
      cameraSnapshot.position.y,
      cameraSnapshot.position.z
    )
    .addScaledVector(
      heldWeaponLookDirectionScratch,
      heldWeaponAimTargetDistanceMeters
    );

  solveBoneChainTowardWorldTarget(
    heldWeaponPoseRuntime.rightAimChain,
    heldForwardReferenceNode,
    heldWeaponTargetWorldPositionScratch,
    heldWeaponAimSolveIterations
  );
  alignBoneTowardEffectorWorldQuaternion(
    heldWeaponPoseRuntime.rightHandBone,
    heldWeaponPoseRuntime.rightGripSocketNode,
    heldWeaponTargetWorldQuaternionScratch
  );
  heldWeaponPoseRuntime.rightGripSocketNode.getWorldPosition(
    heldWeaponGripSocketWorldPositionScratch
  );
  resolveHandWorldTargetPosition(
    heldWeaponPoseRuntime.rightGripSocketNode,
    heldWeaponTargetWorldQuaternionScratch,
    heldWeaponGripSocketWorldPositionScratch,
    heldWeaponRightHandTargetWorldPositionScratch
  );
  solveTwoBoneArmToHandWorldTarget(
    heldWeaponPoseRuntime.rightUpperarmBone,
    heldWeaponPoseRuntime.rightLowerarmBone,
    heldWeaponPoseRuntime.rightHandBone,
    heldWeaponRightHandTargetWorldPositionScratch,
    heldWeaponRightElbowPoleTargetScratch
  );
  alignBoneTowardEffectorWorldQuaternion(
    heldWeaponPoseRuntime.rightHandBone,
    heldWeaponPoseRuntime.rightGripSocketNode,
    heldWeaponTargetWorldQuaternionScratch
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);

  if (attachmentRuntime.offHandSupportNode === null) {
    if (
      attachmentRuntime.implicitOffHandGripLocalPosition === null ||
      attachmentRuntime.implicitOffHandGripLocalQuaternion === null
    ) {
      attachmentRuntime.attachmentRoot.updateMatrixWorld(true);
      heldWeaponPoseRuntime.leftGripSocketNode.updateMatrixWorld(true);
      attachmentRuntime.implicitOffHandGripLocalPosition =
        attachmentRuntime.attachmentRoot.worldToLocal(
          heldWeaponPoseRuntime.leftGripSocketNode.getWorldPosition(
            heldWeaponGripSocketWorldPositionScratch
          )
        ).clone();
      attachmentRuntime.implicitOffHandGripLocalQuaternion =
        heldWeaponAttachmentWorldQuaternionInverseScratch
          .copy(
            attachmentRuntime.attachmentRoot.getWorldQuaternion(
              heldWeaponAttachmentWorldQuaternionScratch
            )
          )
          .invert()
          .multiply(
            heldWeaponPoseRuntime.leftGripSocketNode.getWorldQuaternion(
              heldWeaponImplicitOffHandTargetWorldQuaternionScratch
            )
          )
          .normalize()
          .clone();
    }

    if (
      attachmentRuntime.implicitOffHandGripLocalPosition === null ||
      attachmentRuntime.implicitOffHandGripLocalQuaternion === null
    ) {
      return;
    }
  }
  const implicitOffHandGripLocalPosition =
    attachmentRuntime.implicitOffHandGripLocalPosition!;
  const implicitOffHandGripLocalQuaternion =
    attachmentRuntime.implicitOffHandGripLocalQuaternion!;

  for (
    let solvePass = 0;
    solvePass < heldWeaponCoupledSolvePasses;
    solvePass += 1
  ) {
    if (attachmentRuntime.offHandSupportNode !== null) {
      attachmentRuntime.offHandSupportNode.getWorldPosition(
        heldWeaponGripSocketWorldPositionScratch
      );
    } else {
      attachmentRuntime.attachmentRoot.localToWorld(
        heldWeaponGripSocketWorldPositionScratch.copy(implicitOffHandGripLocalPosition)
      );
      heldWeaponSupportHandTargetWorldQuaternionScratch
        .copy(
          attachmentRuntime.attachmentRoot.getWorldQuaternion(
            heldWeaponAttachmentWorldQuaternionScratch
          )
        )
        .multiply(implicitOffHandGripLocalQuaternion)
        .normalize();
    }
    solveBoneChainTowardWorldTarget(
      heldWeaponPoseRuntime.leftSupportChain,
      heldWeaponPoseRuntime.leftGripSocketNode,
      heldWeaponGripSocketWorldPositionScratch,
      heldWeaponAimSolveIterations
    );
    alignBoneTowardEffectorWorldQuaternion(
      heldWeaponPoseRuntime.leftHandBone,
      heldWeaponPoseRuntime.leftGripSocketNode,
      heldWeaponSupportHandTargetWorldQuaternionScratch
    );
    resolveHandWorldTargetPosition(
      heldWeaponPoseRuntime.leftGripSocketNode,
      heldWeaponSupportHandTargetWorldQuaternionScratch,
      heldWeaponGripSocketWorldPositionScratch,
      heldWeaponLeftHandTargetWorldPositionScratch
    );
    solveTwoBoneArmToHandWorldTarget(
      heldWeaponPoseRuntime.leftUpperarmBone,
      heldWeaponPoseRuntime.leftLowerarmBone,
      heldWeaponPoseRuntime.leftHandBone,
      heldWeaponLeftHandTargetWorldPositionScratch,
      heldWeaponLeftElbowPoleTargetScratch
    );
    alignBoneTowardEffectorWorldQuaternion(
      heldWeaponPoseRuntime.leftHandBone,
      heldWeaponPoseRuntime.leftGripSocketNode,
      heldWeaponSupportHandTargetWorldQuaternionScratch
    );
    heldWeaponTargetWorldPositionScratch
      .set(
        cameraSnapshot.position.x,
        cameraSnapshot.position.y,
        cameraSnapshot.position.z
      )
      .addScaledVector(
        heldWeaponLookDirectionScratch,
        heldWeaponAimTargetDistanceMeters
      );
    solveBoneChainTowardWorldTarget(
      heldWeaponPoseRuntime.rightAimChain,
      heldForwardReferenceNode,
      heldWeaponTargetWorldPositionScratch,
      heldWeaponAimSolveIterations
    );
    alignBoneTowardEffectorWorldQuaternion(
      heldWeaponPoseRuntime.rightHandBone,
      heldWeaponPoseRuntime.rightGripSocketNode,
      heldWeaponTargetWorldQuaternionScratch
    );
    heldWeaponPoseRuntime.rightGripSocketNode.getWorldPosition(
      heldWeaponGripSocketWorldPositionScratch
    );
    resolveHandWorldTargetPosition(
      heldWeaponPoseRuntime.rightGripSocketNode,
      heldWeaponTargetWorldQuaternionScratch,
      heldWeaponGripSocketWorldPositionScratch,
      heldWeaponRightHandTargetWorldPositionScratch
    );
    solveTwoBoneArmToHandWorldTarget(
      heldWeaponPoseRuntime.rightUpperarmBone,
      heldWeaponPoseRuntime.rightLowerarmBone,
      heldWeaponPoseRuntime.rightHandBone,
      heldWeaponRightHandTargetWorldPositionScratch,
      heldWeaponRightElbowPoleTargetScratch
    );
    alignBoneTowardEffectorWorldQuaternion(
      heldWeaponPoseRuntime.rightHandBone,
      heldWeaponPoseRuntime.rightGripSocketNode,
      heldWeaponTargetWorldQuaternionScratch
    );
    characterProofRuntime.anchorGroup.updateMatrixWorld(true);
  }
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

function createHeldForwardReferenceNode(
  gripAlignment: MetaverseAttachmentProofConfig["heldMount"]["gripAlignment"],
  attachmentScene: Group
): Object3D | null {
  if ("attachmentForwardAxis" in gripAlignment) {
    const forwardAxis = new Vector3(
      gripAlignment.attachmentForwardAxis.x,
      gripAlignment.attachmentForwardAxis.y,
      gripAlignment.attachmentForwardAxis.z
    );

    if (forwardAxis.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
      return null;
    }

    const forwardReferenceNode = new Group();

    forwardReferenceNode.name = "metaverse_attachment_forward_reference";
    forwardReferenceNode.position.copy(forwardAxis.normalize());
    attachmentScene.add(forwardReferenceNode);

    return forwardReferenceNode;
  }

  return findNamedNode(
    attachmentScene,
    gripAlignment.attachmentForwardMarkerNodeName,
    "Metaverse attachment grip alignment"
  );
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
  distanceSquared: number,
  nowMs: number,
  lastLodSwitchAtMs: number
): number {
  const resolvedLodIndex = resolveEnvironmentLodIndexForDistance(lods, distanceSquared);

  if (
    activeLodIndex < 0 ||
    activeLodIndex >= lods.length ||
    resolvedLodIndex === activeLodIndex
  ) {
    return resolvedLodIndex;
  }

  if (
    Number.isFinite(lastLodSwitchAtMs) &&
    nowMs - lastLodSwitchAtMs < environmentLodSwitchCooldownMs
  ) {
    return activeLodIndex;
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
      measurePlacementDistanceSquared(cameraSnapshot, staticPlacementRuntime.placement),
      nowMs,
      staticPlacementRuntime.lastLodSwitchAtMs
    );

    if (lodIndex !== staticPlacementRuntime.activeLodIndex) {
      setEnvironmentLodVisibility(staticPlacementRuntime.lods, lodIndex);
      staticPlacementRuntime.activeLodIndex = lodIndex;
      staticPlacementRuntime.lastLodSwitchAtMs = nowMs;
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
      nearestDistanceSquared,
      nowMs,
      instancedAssetRuntime.lastLodSwitchAtMs
    );

    if (lodIndex !== instancedAssetRuntime.activeLodIndex) {
      setEnvironmentLodVisibility(instancedAssetRuntime.lods, lodIndex);
      instancedAssetRuntime.activeLodIndex = lodIndex;
      instancedAssetRuntime.lastLodSwitchAtMs = nowMs;
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
  const mountableFocusHeightLeewayMeters = 0.12;
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
    const halfExtentY =
      environmentAsset.collider.size.y * 0.5 + mountableFocusHeightLeewayMeters;
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

function resolveHeldCharacterAnimationVocabulary(
  characterProofRuntime: MetaverseCharacterProofRuntime,
  attachmentRuntime: MetaverseAttachmentProofRuntime | null,
  targetVocabulary: MetaverseCharacterAnimationVocabularyId,
  mountedCharacterRuntime: MountedCharacterRuntime | null
): MetaverseCharacterAnimationVocabularyId {
  if (
    mountedCharacterRuntime !== null ||
    attachmentRuntime === null ||
    attachmentRuntime.activeMountKind !== "held" ||
    characterProofRuntime.skeletonId !== "humanoid_v2" ||
    targetVocabulary !== "idle" ||
    !characterProofRuntime.actionsByVocabulary.has("aim")
  ) {
    return targetVocabulary;
  }

  return characterProofRuntime.humanoidV2PistolPoseRuntime === null
    ? "aim"
    : targetVocabulary;
}

function syncCharacterAnimation(
  characterProofRuntime: MetaverseCharacterProofRuntime,
  targetVocabulary: MetaverseCharacterAnimationVocabularyId,
  useHumanoidV2PistolLayering: boolean = false
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
  const resolveActionByVocabulary = (
    vocabulary: MetaverseCharacterAnimationVocabularyId,
    preferHumanoidV2PistolLayering: boolean
  ): {
    readonly action: AnimationAction;
    readonly actionSetId: MetaverseCharacterProofRuntime["activeAnimationActionSetId"];
  } | null => {
    if (preferHumanoidV2PistolLayering) {
      const lowerBodyAction =
        characterProofRuntime.humanoidV2PistolLowerBodyActionsByVocabulary?.get(
          vocabulary
        );

      if (lowerBodyAction !== undefined) {
        return {
          action: lowerBodyAction,
          actionSetId: "humanoid_v2_pistol_lower_body"
        };
      }
    }

    const fullBodyAction = characterProofRuntime.actionsByVocabulary.get(vocabulary);

    return fullBodyAction === undefined
      ? null
      : {
          action: fullBodyAction,
          actionSetId: "full-body"
        };
  };
  const nextActionSelection = resolveActionByVocabulary(
    nextVocabulary,
    useHumanoidV2PistolLayering
  );

  if (nextActionSelection === null) {
    return;
  }

  if (
    nextVocabulary === characterProofRuntime.activeAnimationVocabulary &&
    nextActionSelection.actionSetId ===
      characterProofRuntime.activeAnimationActionSetId
  ) {
    return;
  }

  const previousActionSelection = resolveActionByVocabulary(
    characterProofRuntime.activeAnimationVocabulary,
    characterProofRuntime.activeAnimationActionSetId ===
      "humanoid_v2_pistol_lower_body"
  );
  const nextAction = nextActionSelection.action;
  const previousAction = previousActionSelection?.action;
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

  characterProofRuntime.activeAnimationActionSetId = nextActionSelection.actionSetId;
  characterProofRuntime.activeAnimationVocabulary = nextVocabulary;
}

function matchesAnimationTrackPrefix(
  trackName: string,
  prefix: string
): boolean {
  return (
    trackName === prefix ||
    trackName.startsWith(prefix) ||
    trackName.includes(`[${prefix}`)
  );
}

function isHumanoidV2PistolOverlayTrack(trackName: string): boolean {
  return !humanoidV2PistolOverlayExcludedTrackPrefixes.some((prefix) =>
    matchesAnimationTrackPrefix(trackName, prefix)
  );
}

function createHumanoidV2LowerBodyLocomotionClip(
  clip: AnimationClip
): AnimationClip {
  const lowerBodyTracks = clip.tracks.filter(
    (track) => !isHumanoidV2PistolOverlayTrack(track.name)
  );

  if (lowerBodyTracks.length === 0) {
    throw new Error(
      `Metaverse humanoid_v2 lower-body locomotion clip ${clip.name} did not retain any lower-body tracks.`
    );
  }

  return new AnimationClip(
    `${clip.name}__metaverse_lower_body`,
    clip.duration,
    lowerBodyTracks,
    clip.blendMode
  );
}

function createHumanoidV2UpperBodyPistolPoseClip(
  clip: AnimationClip
): AnimationClip {
  const upperBodyTracks = clip.tracks.filter((track) =>
    isHumanoidV2PistolOverlayTrack(track.name)
  );

  if (upperBodyTracks.length === 0) {
    throw new Error(
      `Metaverse humanoid_v2 pistol pose clip ${clip.name} did not retain any upper-body tracks.`
    );
  }

  return new AnimationClip(
    `${clip.name}__metaverse_upper_body`,
    clip.duration,
    upperBodyTracks,
    clip.blendMode
  );
}

function createHumanoidV2PistolLowerBodyActionsByVocabulary(
  mixer: AnimationMixer,
  clipsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationClip
  >
): ReadonlyMap<MetaverseCharacterAnimationVocabularyId, AnimationAction> {
  const actionsByVocabulary = new Map<
    MetaverseCharacterAnimationVocabularyId,
    AnimationAction
  >();

  for (const vocabulary of humanoidV2PistolLowerBodyVocabularyIds) {
    const clip = clipsByVocabulary.get(vocabulary);

    if (clip === undefined) {
      continue;
    }

    actionsByVocabulary.set(
      vocabulary,
      mixer.clipAction(createHumanoidV2LowerBodyLocomotionClip(clip))
    );
  }

  return actionsByVocabulary;
}

function createHumanoidV2PistolPoseRuntime(
  mixer: AnimationMixer,
  clipsByPoseId: ReadonlyMap<MetaverseHumanoidV2PistolPoseId, AnimationClip>
): HumanoidV2PistolPoseRuntime {
  const actionsByPoseId = new Map<
    MetaverseHumanoidV2PistolPoseId,
    AnimationAction
  >();

  for (const poseId of metaverseHumanoidV2PistolPoseIds) {
    const clip = clipsByPoseId.get(poseId);

    if (clip === undefined) {
      throw new Error(
        `Metaverse humanoid_v2 pistol pose runtime is missing ${poseId}.`
      );
    }

    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(0);
    action.play();
    actionsByPoseId.set(poseId, action);
  }

  return {
    actionsByPoseId,
    clipsByPoseId
  };
}

function setHumanoidV2PistolPoseWeights(
  pistolPoseRuntime: HumanoidV2PistolPoseRuntime,
  weights: Readonly<Record<MetaverseHumanoidV2PistolPoseId, number>>
): void {
  for (const poseId of metaverseHumanoidV2PistolPoseIds) {
    const action = pistolPoseRuntime.actionsByPoseId.get(poseId);

    if (action === undefined) {
      continue;
    }

    const weight = clamp(weights[poseId], 0, 1);
    action.enabled = weight > humanoidV2PistolPoseWeightEpsilon;
    action.setEffectiveWeight(weight);
  }
}

function clearHumanoidV2PistolPoseWeights(
  pistolPoseRuntime: HumanoidV2PistolPoseRuntime
): void {
  setHumanoidV2PistolPoseWeights(pistolPoseRuntime, {
    down: 0,
    neutral: 0,
    up: 0
  });
}

function syncHumanoidV2PistolPoseWeights(
  pistolPoseRuntime: HumanoidV2PistolPoseRuntime,
  pitchRadians: number,
  orientation: Pick<
    MetaverseRuntimeConfig["orientation"],
    "maxPitchRadians" | "minPitchRadians"
  >
): void {
  const downRangeRadians = Math.max(
    Math.abs(orientation.minPitchRadians),
    humanoidV2PistolPoseWeightEpsilon
  );
  const upRangeRadians = Math.max(
    orientation.maxPitchRadians,
    humanoidV2PistolPoseWeightEpsilon
  );
  const clampedPitchRadians = clamp(
    pitchRadians,
    orientation.minPitchRadians,
    orientation.maxPitchRadians
  );
  const downWeight =
    clampedPitchRadians < 0
      ? clamp(Math.abs(clampedPitchRadians) / downRangeRadians, 0, 1)
      : 0;
  const upWeight =
    clampedPitchRadians > 0
      ? clamp(clampedPitchRadians / upRangeRadians, 0, 1)
      : 0;

  setHumanoidV2PistolPoseWeights(pistolPoseRuntime, {
    down: downWeight,
    neutral: clamp(1 - Math.max(downWeight, upWeight), 0, 1),
    up: upWeight
  });
}

function createCharacterProofRuntime(
  characterId: string,
  skeletonId: MetaverseCharacterProofConfig["skeletonId"],
  characterScene: Group,
  clipsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationClip
  >,
  humanoidV2PistolPoseClipsByPoseId:
    | ReadonlyMap<MetaverseHumanoidV2PistolPoseId, AnimationClip>
    | null
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
  const humanoidV2PistolLowerBodyActionsByVocabulary =
    skeletonId === "humanoid_v2" && humanoidV2PistolPoseClipsByPoseId !== null
      ? createHumanoidV2PistolLowerBodyActionsByVocabulary(
          mixer,
          clipsByVocabulary
        )
      : null;

  if (idleAction === undefined) {
    throw new Error(
      `Metaverse character ${characterId} requires an idle animation vocabulary.`
    );
  }

  idleAction.play();

  return {
    activeAnimationActionSetId: "full-body",
    activeAnimationVocabulary: "idle",
    actionsByVocabulary,
    anchorGroup,
    characterId,
    clipsByVocabulary,
    heldWeaponPoseRuntime: createHeldWeaponPoseRuntime(skeletonId, characterScene),
    humanoidV2PistolLowerBodyActionsByVocabulary,
    humanoidV2PistolPoseRuntime:
      skeletonId === "humanoid_v2" && humanoidV2PistolPoseClipsByPoseId !== null
        ? createHumanoidV2PistolPoseRuntime(
            mixer,
            humanoidV2PistolPoseClipsByPoseId
          )
        : null,
    mixer,
    seatSocketNode,
    scene: characterScene,
    skeletonId
  };
}

function cloneMetaverseCharacterProofRuntime(
  sourceRuntime: MetaverseCharacterProofRuntime,
  playerId: string
): MetaverseCharacterProofRuntime {
  const clonedRuntime = createCharacterProofRuntime(
    sourceRuntime.characterId,
    sourceRuntime.skeletonId,
    cloneCharacterScene(sourceRuntime.scene),
    sourceRuntime.clipsByVocabulary,
    sourceRuntime.humanoidV2PistolPoseRuntime?.clipsByPoseId ?? null
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
  orientation: Pick<
    MetaverseRuntimeConfig["orientation"],
    "maxPitchRadians" | "minPitchRadians"
  >,
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
    const useHumanoidV2PistolLayering =
      remoteCharacterRuntime.mountedCharacterRuntime === null &&
      remoteCharacterRuntime.characterRuntime.humanoidV2PistolPoseRuntime !== null;

    syncCharacterAnimation(
      remoteCharacterRuntime.characterRuntime,
      remoteCharacterPresentation.presentation.animationVocabulary,
      useHumanoidV2PistolLayering
    );
    if (remoteCharacterRuntime.characterRuntime.humanoidV2PistolPoseRuntime !== null) {
      if (useHumanoidV2PistolLayering) {
        syncHumanoidV2PistolPoseWeights(
          remoteCharacterRuntime.characterRuntime.humanoidV2PistolPoseRuntime,
          remoteCharacterPresentation.look.pitchRadians,
          orientation
        );
      } else {
        clearHumanoidV2PistolPoseWeights(
          remoteCharacterRuntime.characterRuntime.humanoidV2PistolPoseRuntime
        );
      }
    }
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

  let humanoidV2PistolPoseClipsByPoseId:
    | ReadonlyMap<MetaverseHumanoidV2PistolPoseId, AnimationClip>
    | null = null;

  if (
    characterProofConfig.skeletonId === "humanoid_v2" &&
    characterProofConfig.humanoidV2PistolPoseProofConfig !== null &&
    characterProofConfig.humanoidV2PistolPoseProofConfig !== undefined
  ) {
    const pistolPoseProofConfig = characterProofConfig.humanoidV2PistolPoseProofConfig;

    try {
      let pistolAnimationAsset = animationAssetsByPath.get(
        pistolPoseProofConfig.sourcePath
      );

      if (pistolAnimationAsset === undefined) {
        pistolAnimationAsset = await sceneAssetLoader.loadAsync(
          pistolPoseProofConfig.sourcePath
        );
        animationAssetsByPath.set(
          pistolPoseProofConfig.sourcePath,
          pistolAnimationAsset
        );
      }

      const clipsByPoseId = new Map<
        MetaverseHumanoidV2PistolPoseId,
        AnimationClip
      >();
      let missingClipName: string | null = null;

      for (const poseId of metaverseHumanoidV2PistolPoseIds) {
        const clipName = pistolPoseProofConfig.clipNamesByPoseId[poseId];
        const clip = pistolAnimationAsset.animations.find(
          (animation) => animation.name === clipName
        );

        if (clip === undefined) {
          missingClipName = clipName;
          break;
        }

        clipsByPoseId.set(poseId, createHumanoidV2UpperBodyPistolPoseClip(clip));
      }

      if (missingClipName === null) {
        humanoidV2PistolPoseClipsByPoseId = clipsByPoseId;
      } else {
        warn(
          `Metaverse humanoid_v2 pistol pose overlay disabled because ${pistolPoseProofConfig.sourcePath} is missing ${missingClipName}.`
        );
      }
    } catch (error) {
      warn(
        `Metaverse humanoid_v2 pistol pose overlay disabled because ${pistolPoseProofConfig.sourcePath} could not load.`
      );
    }
  }

  return createCharacterProofRuntime(
    characterProofConfig.characterId,
    characterProofConfig.skeletonId,
    characterAsset.scene,
    clipsByVocabulary,
    humanoidV2PistolPoseClipsByPoseId
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
  const heldForwardReferenceNode = createHeldForwardReferenceNode(
    attachmentProofConfig.heldMount.gripAlignment,
    attachmentAsset.scene
  );
  const mountedHolsterMount =
    attachmentProofConfig.mountedHolsterMount === null
      ? null
      : createAttachmentMountRuntime(
          attachmentProofConfig.mountedHolsterMount,
          attachmentAsset.scene
        );
  const heldOffHandSupportPointId =
    attachmentProofConfig.heldMount.offHandSupportPointId ?? null;
  let offHandSupportNode: Object3D | null = null;

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

    if (heldOffHandSupportPointId === supportPoint.supportPointId) {
      offHandSupportNode = supportPointAnchor;
    }
  }
  attachmentRoot.add(attachmentPresentationGroup);

  if (heldOffHandSupportPointId !== null && offHandSupportNode === null) {
    throw new Error(
      `Metaverse attachment ${attachmentProofConfig.attachmentId} is missing held off-hand support point ${heldOffHandSupportPointId}.`
    );
  }

  const attachmentRuntime: MetaverseAttachmentProofRuntime = {
    activeMountKind: null,
    attachmentRoot,
    heldForwardReferenceNode,
    heldMount,
    implicitOffHandGripLocalPosition: null,
    implicitOffHandGripLocalQuaternion: null,
    mountedHolsterMount,
    offHandSupportNode,
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
      lastLodSwitchAtMs: Number.NEGATIVE_INFINITY,
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
    lastLodSwitchAtMs: Number.NEGATIVE_INFINITY,
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

function createWaterRegionFloorMesh(
  waterRegion: MetaverseWorldPlacedWaterRegionSnapshot
): Mesh {
  const floorMaterial = new MeshStandardNodeMaterial({
    side: DoubleSide
  });
  const floorEdgeBlend = smoothstep(
    0.02,
    0.16,
    min(min(uv().x, oneMinus(uv().x)), min(uv().y, oneMinus(uv().y)))
  );

  floorMaterial.colorNode = mix(
    color(0.58, 0.54, 0.42),
    color(0.36, 0.39, 0.35),
    floorEdgeBlend
  );
  floorMaterial.emissiveNode = color(0.03, 0.09, 0.12).mul(
    oneMinus(floorEdgeBlend).mul(0.28)
  );
  floorMaterial.roughnessNode = float(0.96);
  floorMaterial.metalnessNode = float(0.02);

  const floorMesh = new Mesh(
    new PlaneGeometry(waterRegion.halfExtents.x * 2, waterRegion.halfExtents.z * 2),
    floorMaterial
  );

  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.rotation.y = waterRegion.rotationYRadians;
  floorMesh.position.set(
    waterRegion.translation.x,
    resolveMetaverseWorldWaterRegionFloorHeightMeters(waterRegion),
    waterRegion.translation.z
  );

  return floorMesh;
}

function createWaterRegionSurfaceMesh(
  config: MetaverseRuntimeConfig,
  waterRegion: MetaverseWorldPlacedWaterRegionSnapshot
): Mesh {
  const oceanMaterial = new MeshStandardNodeMaterial({
    side: DoubleSide,
    transparent: true
  });
  const shorelineBlend = smoothstep(
    0.015,
    0.12,
    min(min(uv().x, oneMinus(uv().x)), min(uv().y, oneMinus(uv().y)))
  );
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
  const waterDepthBlend = smoothstep(
    0.8,
    6,
    float(waterRegion.halfExtents.y * 2)
  );
  const viewDirection = cameraPosition.sub(positionWorld).normalize();
  const fresnel = pow(oneMinus(abs(dot(normalWorld, viewDirection))), 3);

  oceanMaterial.positionNode = positionLocal.add(vec3(0, 0, waveHeight));
  oceanMaterial.colorNode = mix(
    color(...config.ocean.nearColor),
    color(...config.ocean.farColor),
    depthBlend.mul(0.58).add(waterDepthBlend.mul(0.42))
  ).add(color(...config.environment.sunColor).mul(fresnel.mul(0.12)));
  oceanMaterial.emissiveNode = color(...config.ocean.emissiveColor).mul(
    fresnel.mul(0.48).add(abs(waveRipple).mul(0.03)).mul(shorelineBlend)
  );
  oceanMaterial.opacityNode = float(0.86).mul(shorelineBlend);
  oceanMaterial.roughnessNode = float(config.ocean.roughness);
  oceanMaterial.metalnessNode = float(0.02);

  const oceanMesh = new Mesh(
    new PlaneGeometry(
      waterRegion.halfExtents.x * 2,
      waterRegion.halfExtents.z * 2,
      config.ocean.segmentCount,
      config.ocean.segmentCount
    ),
    oceanMaterial
  );

  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.rotation.y = waterRegion.rotationYRadians;
  oceanMesh.position.set(
    waterRegion.translation.x,
    resolveMetaverseWorldWaterRegionSurfaceHeightMeters(waterRegion),
    waterRegion.translation.z
  );

  return oceanMesh;
}

function createOceanMesh(config: MetaverseRuntimeConfig): Group {
  const oceanGroup = new Group();

  for (const waterRegion of metaverseWorldPlacedWaterRegions) {
    oceanGroup.add(createWaterRegionFloorMesh(waterRegion));
    oceanGroup.add(createWaterRegionSurfaceMesh(config, waterRegion));
  }

  return oceanGroup;
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
        const useHumanoidV2PistolLayering =
          attachmentProofRuntime !== null &&
          attachmentProofRuntime.activeMountKind === "held" &&
          characterPresentation !== null &&
          mountedCharacterRuntime === null &&
          characterProofRuntime.humanoidV2PistolPoseRuntime !== null;

        syncCharacterAnimation(
          characterProofRuntime,
          resolveHeldCharacterAnimationVocabulary(
            characterProofRuntime,
            attachmentProofRuntime,
            characterPresentation?.animationVocabulary ?? "idle",
            mountedCharacterRuntime
          ),
          useHumanoidV2PistolLayering
        );
        if (characterProofRuntime.humanoidV2PistolPoseRuntime !== null) {
          if (useHumanoidV2PistolLayering) {
            syncHumanoidV2PistolPoseWeights(
              characterProofRuntime.humanoidV2PistolPoseRuntime,
              cameraSnapshot.pitchRadians,
              config.orientation
            );
          } else {
            clearHumanoidV2PistolPoseWeights(
              characterProofRuntime.humanoidV2PistolPoseRuntime
            );
          }
        }
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
      if (
        characterProofRuntime !== null &&
        attachmentProofRuntime !== null &&
        characterProofRuntime.heldWeaponPoseRuntime !== null &&
        attachmentProofRuntime.activeMountKind === "held" &&
        characterPresentation !== null &&
        mountedCharacterRuntime === null
      ) {
        restoreHumanoidV2HeldWeaponPoseRuntime(
          characterProofRuntime.heldWeaponPoseRuntime
        );
        characterProofRuntime.anchorGroup.updateMatrixWorld(true);
        syncHumanoidV2HeldWeaponPose(
          characterProofRuntime,
          characterProofRuntime.heldWeaponPoseRuntime,
          attachmentProofRuntime,
          cameraSnapshot
        );
      }
      syncRemoteCharacterPresentations(
        scene,
        characterProofRuntime,
        config.orientation,
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
