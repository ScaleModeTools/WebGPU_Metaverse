import {
  Bone,
  Euler,
  Group,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3
} from "three/webgpu";
import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";
import type { MetaverseSemanticAimFrame } from "../../aim/metaverse-semantic-aim";

import {
  resolveMetaverseHeldObjectSolverProfile,
  type MetaverseHeldObjectFingerPoseId,
  type MetaverseHeldObjectSolverHandId,
  type MetaverseHeldObjectSolverProfile
} from "./metaverse-held-object-solver-profile";

import type { MetaverseAttachmentProofRuntime } from "../attachments/metaverse-scene-attachment-runtime";

import type {
  MetaverseLocalHeldObjectContactFrameId,
  MetaverseRuntimeConfig,
  MetaverseVector3Snapshot
} from "../../types/metaverse-runtime";

interface HumanoidV2HeldWeaponDrivenBoneRuntime {
  readonly bone: Bone;
  readonly rigNeutralLocalPosition: Vector3;
  readonly rigNeutralLocalQuaternion: Quaternion;
  readonly rigNeutralLocalScale: Vector3;
  readonly sampledLocalPosition: Vector3;
  readonly sampledLocalQuaternion: Quaternion;
  readonly sampledLocalScale: Vector3;
  readonly solveStartLocalPosition: Vector3;
  readonly solveStartLocalQuaternion: Quaternion;
  readonly solveStartLocalScale: Vector3;
}

export interface HeldWeaponContactFrameRuntime {
  readonly node: Object3D;
  readonly wristLimitRadians: number;
}

type HeldWeaponContactFrameRuntimeById = Readonly<
  Record<MetaverseLocalHeldObjectContactFrameId, HeldWeaponContactFrameRuntime>
>;

export interface HumanoidV2HeldWeaponPoseRuntime {
  readonly contactFrameRuntimeByHand: Readonly<Record<
    MetaverseHeldObjectSolverHandId,
    HeldWeaponContactFrameRuntimeById
  >>;
  readonly drivenBoneRuntimeByBone: ReadonlyMap<
    Bone,
    HumanoidV2HeldWeaponDrivenBoneRuntime
  >;
  readonly drivenBones: readonly HumanoidV2HeldWeaponDrivenBoneRuntime[];
  readonly fingerChainsByHand: Readonly<Record<
    MetaverseHeldObjectSolverHandId,
    HeldWeaponFingerChainsRuntime
  >>;
  readonly leftClavicleBone: Bone;
  readonly leftIndexBaseBone: Bone;
  readonly leftIndexGripContactNode: Object3D;
  readonly leftIndexGripGuideNode: Object3D;
  readonly leftIndexMiddleBone: Bone;
  readonly leftIndexTipBone: Bone;
  readonly leftGripSocketNode: Object3D;
  readonly leftHandBone: Bone;
  readonly leftLowerarmBone: Bone;
  readonly leftMiddleBaseBone: Bone;
  readonly leftMiddleGripContactNode: Object3D;
  readonly leftMiddleGripGuideNode: Object3D;
  readonly leftMiddleMiddleBone: Bone;
  readonly leftMiddleTipBone: Bone;
  readonly leftPalmSocketNode: Object3D;
  readonly leftSupportSocketNode: Object3D;
  readonly leftUpperarmBone: Bone;
  readonly rightClavicleBone: Bone;
  readonly rightHandBone: Bone;
  readonly rightIndexBaseBone: Bone;
  readonly rightIndexMiddleBone: Bone;
  readonly rightIndexTipBone: Bone;
  readonly rightGripSocketNode: Object3D;
  readonly rightLowerarmBone: Bone;
  readonly rightTriggerContactNode: Object3D;
  readonly rightPalmSocketNode: Object3D;
  readonly rightSupportSocketNode: Object3D;
  readonly rightTriggerGuideNode: Object3D;
  readonly rightUpperarmBone: Bone;
}

interface HeldWeaponFingerChainRuntime {
  readonly baseBone: Bone;
  readonly middleBone: Bone;
  readonly tipBone: Bone;
}

interface HeldWeaponFingerChainsRuntime {
  readonly index: HeldWeaponFingerChainRuntime;
  readonly middle: HeldWeaponFingerChainRuntime;
  readonly pinky: HeldWeaponFingerChainRuntime;
  readonly ring: HeldWeaponFingerChainRuntime;
  readonly thumb: HeldWeaponFingerChainRuntime;
}

export interface ActiveGripAssignment {
  readonly primaryCharacterSocketRole:
    | "grip_l_socket"
    | "grip_r_socket"
    | "palm_l_socket"
    | "palm_r_socket";
  readonly primaryHand: MetaverseHeldObjectSolverHandId;
  readonly secondaryCharacterSocketRole:
    | "grip_l_socket"
    | "grip_r_socket"
    | "palm_l_socket"
    | "palm_r_socket"
    | "support_l_socket"
    | "support_r_socket"
    | null;
  readonly secondaryHand: MetaverseHeldObjectSolverHandId | null;
}

export type HeldObjectAimState = MetaverseSemanticAimFrame;

interface HeldWeaponContactFrameDescriptor {
  readonly baseSocket: "grip" | "palm" | "support";
  readonly handOverrides?: Partial<
    Readonly<
      Record<
        MetaverseHeldObjectSolverHandId,
        Readonly<{
          readonly localPositionOffset?: readonly [number, number, number];
          readonly localRotationOffsetRadians?: readonly [number, number, number];
        }>
      >
    >
  >;
  readonly localPositionOffset: readonly [number, number, number];
  readonly localRotationOffsetRadians: readonly [number, number, number];
  readonly wristLimitRadians: number;
}

export interface MetaverseHeldWeaponPoseRuntimeNodeResolvers {
  readonly findBoneNode: (
    characterScene: Group,
    boneName: string,
    label: string
  ) => Bone;
  readonly findSocketNode: (
    characterScene: Group,
    socketName: string
  ) => Object3D;
}

const heldWeaponElbowPoleAcrossBias = 0.42;
const heldWeaponElbowPoleBiasWeight = 0.92;
const heldWeaponElbowPoleDownBias = 0.7;
const heldWeaponElbowPolePreferenceWeight = 1.4;
const heldWeaponChestForwardMeters = 0.34;
const heldWeaponHipFireAcrossMeters = 0.2;
const heldWeaponHipFireDownMeters = 0;
const heldWeaponLeftArmReachSlackMeters = 0.001;
const heldWeaponRightArmReachSlackMeters = 0.045;
const heldWeaponSupportPalmHintLeftArmReachSlackMeters = 0.005;
const heldWeaponSupportPalmHintRotationInfluence = 0.48;
const heldWeaponSecondaryGripRefinementPassCount = 3;
const heldWeaponGripFingerContactLocalOffsetMeters = 0.014;
const heldWeaponRightTriggerContactLocalExtensionScale = 0.36;
export const heldWeaponSolveDirectionEpsilon = 0.000001;
const heldWeaponFingerCurlAxis = new Vector3(0, 0, 1);
const heldWeaponContactFrameDescriptors = Object.freeze({
  primary_trigger_grip: Object.freeze({
    baseSocket: "grip",
    localPositionOffset: [-0.012, -0.01, 0.006] as const,
    localRotationOffsetRadians: [0.08, 0, -0.1] as const,
    wristLimitRadians: 0.95
  }),
  heavy_trigger_grip: Object.freeze({
    baseSocket: "grip",
    localPositionOffset: [-0.018, -0.014, 0.006] as const,
    localRotationOffsetRadians: [0.1, 0, -0.08] as const,
    wristLimitRadians: 0.9
  }),
  support_palm: Object.freeze({
    baseSocket: "palm",
    handOverrides: Object.freeze({
      left: Object.freeze({
        localPositionOffset: [0.01, -0.004, -0.014] as const,
        localRotationOffsetRadians: [-0.12, -0.08, -0.22] as const
      })
    }),
    localPositionOffset: [0.01, -0.004, 0.014] as const,
    localRotationOffsetRadians: [-0.12, 0.08, 0.22] as const,
    wristLimitRadians: 0.7
  }),
  support_handle_grip: Object.freeze({
    baseSocket: "support",
    localPositionOffset: [-0.006, -0.016, 0] as const,
    localRotationOffsetRadians: [0.06, 0, 0.08] as const,
    wristLimitRadians: 0.85
  }),
  barrel_cradle: Object.freeze({
    baseSocket: "support",
    localPositionOffset: [0.018, -0.02, 0.018] as const,
    localRotationOffsetRadians: [-0.24, 0.1, 0.18] as const,
    wristLimitRadians: 0.75
  }),
  sword_grip: Object.freeze({
    baseSocket: "grip",
    localPositionOffset: [0, 0, 0] as const,
    localRotationOffsetRadians: [0, 0, 0] as const,
    wristLimitRadians: 0.9
  }),
  tool_grip: Object.freeze({
    baseSocket: "grip",
    localPositionOffset: [0, 0, 0] as const,
    localRotationOffsetRadians: [0, 0, 0] as const,
    wristLimitRadians: 0.9
  })
} as const satisfies Readonly<
  Record<MetaverseLocalHeldObjectContactFrameId, HeldWeaponContactFrameDescriptor>
>);
const heldWeaponClampedHandTargetWorldPositionScratch = new Vector3();
const heldWeaponCameraWorldPositionScratch = new Vector3();
const heldWeaponHipFireGripWorldPositionScratch = new Vector3();
const heldWeaponAdsGripWorldPositionScratch = new Vector3();
const heldWeaponAdsGripDeltaScratch = new Vector3();
const heldWeaponHeadToCameraScratch = new Vector3();
const heldWeaponHeadWorldPositionScratch = new Vector3();
const heldWeaponEffectorWorldPositionScratch = new Vector3();
const heldWeaponBoneWorldPositionScratch = new Vector3();
const heldWeaponElbowTargetWorldPositionScratch = new Vector3();
const heldWeaponEffectorDirectionScratch = new Vector3();
const heldWeaponTargetDirectionScratch = new Vector3();
const heldWeaponLookDirectionScratch = new Vector3();
const heldWeaponGripUpDirectionScratch = new Vector3();
const heldWeaponGripAcrossDirectionScratch = new Vector3();
const heldWeaponGripSocketWorldPositionScratch = new Vector3();
const heldWeaponLeftHandTargetWorldPositionScratch = new Vector3();
const heldWeaponSupportPalmFadeStartWorldPositionScratch = new Vector3();
const heldWeaponLocalChainAxisScratch = new Vector3();
const heldWeaponLocalChainRootPositionScratch = new Vector3();
const heldWeaponFingerContactTargetWorldPositionScratch = new Vector3();
const heldWeaponFingerTargetGripLocalPositionScratch = new Vector3();
const heldWeaponFingerBaseGripLocalPositionScratch = new Vector3();
const heldWeaponFingerMiddleGripLocalPositionScratch = new Vector3();
const heldWeaponFingerTipGripLocalPositionScratch = new Vector3();
const heldWeaponFingerGuideGripLocalPositionScratch = new Vector3();
const heldWeaponFingerGuideAlternateGripLocalPositionScratch = new Vector3();
const heldWeaponTriggerMarkerWorldPositionScratch = new Vector3();
const heldWeaponShoulderWorldPositionScratch = new Vector3();
const heldWeaponElbowWorldPositionScratch = new Vector3();
const heldWeaponHandEffectorLocalPositionScratch = new Vector3();
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
const heldWeaponSupportHandTargetWorldQuaternionScratch = new Quaternion();
const heldWeaponAttachmentWorldQuaternionScratch = new Quaternion();
const heldWeaponGripLocalAimQuaternionScratch = new Quaternion();
const heldWeaponHandTargetWorldQuaternionScratch = new Quaternion();
const heldWeaponHandEffectorLocalQuaternionScratch = new Quaternion();
const heldWeaponTargetWorldQuaternionScratch = new Quaternion();
const heldWeaponCurrentWorldQuaternionScratch = new Quaternion();
const heldWeaponEffectorWorldQuaternionScratch = new Quaternion();
const heldWeaponWorldDeltaQuaternionScratch = new Quaternion();
const heldWeaponParentLocalDeltaQuaternionScratch = new Quaternion();
const heldWeaponSupportPalmPreAlignLocalQuaternionScratch = new Quaternion();
const heldWeaponGripAlignmentMatrixScratch = new Matrix4();
const heldWeaponFingerCurlQuaternionScratch = new Quaternion();
const heldWeaponSolveInfluencePositionScratch = new Vector3();
const heldWeaponSolveInfluenceQuaternionScratch = new Quaternion();
const heldWeaponSolveInfluenceScaleScratch = new Vector3();
const heldWeaponContactFrameOffsetPositionScratch = new Vector3();
const heldWeaponContactFrameOffsetQuaternionScratch = new Quaternion();
const heldWeaponContactFrameOffsetEulerScratch = new Euler();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createHeldWeaponFingerContactNode(
  nodeName: string,
  tipBone: Bone,
  localXOffset: number
): Object3D {
  const contactNode = new Object3D();

  contactNode.name = nodeName;
  contactNode.position.set(localXOffset, 0, 0);
  contactNode.quaternion.identity();
  tipBone.add(contactNode);

  return contactNode;
}

function createHeldWeaponFingerGuideNode(
  nodeName: string,
  baseBone: Bone
): Object3D {
  const guideNode = new Object3D();

  guideNode.name = nodeName;
  guideNode.position.set(0, 0, 0);
  guideNode.quaternion.identity();
  baseBone.add(guideNode);

  return guideNode;
}

function resolveHeldWeaponContactFrameBaseSocketNode(
  descriptor: Pick<HeldWeaponContactFrameDescriptor, "baseSocket">,
  sockets: Readonly<Record<"grip" | "palm" | "support", Object3D>>
): Object3D {
  switch (descriptor.baseSocket) {
    case "grip":
      return sockets.grip;
    case "palm":
      return sockets.palm;
    case "support":
      return sockets.support;
  }
}

function createHeldWeaponContactFrameRuntime(
  handId: MetaverseHeldObjectSolverHandId,
  contactFrameId: MetaverseLocalHeldObjectContactFrameId,
  handBone: Bone,
  sockets: Readonly<Record<"grip" | "palm" | "support", Object3D>>
): HeldWeaponContactFrameRuntime {
  const descriptor: HeldWeaponContactFrameDescriptor =
    heldWeaponContactFrameDescriptors[contactFrameId];
  const baseSocketNode = resolveHeldWeaponContactFrameBaseSocketNode(
    descriptor,
    sockets
  );
  const handOverride = descriptor.handOverrides?.[handId];
  const localPositionOffset =
    handOverride?.localPositionOffset ?? descriptor.localPositionOffset;
  const localRotationOffsetRadians =
    handOverride?.localRotationOffsetRadians ??
    descriptor.localRotationOffsetRadians;
  const contactFrameNode = new Object3D();

  contactFrameNode.name = `metaverse_${handId}_${contactFrameId}_contact_frame`;
  heldWeaponContactFrameOffsetPositionScratch.fromArray(localPositionOffset);
  heldWeaponContactFrameOffsetQuaternionScratch.setFromEuler(
    heldWeaponContactFrameOffsetEulerScratch.set(
      localRotationOffsetRadians[0],
      localRotationOffsetRadians[1],
      localRotationOffsetRadians[2],
      "XYZ"
    )
  );
  contactFrameNode.position
    .copy(baseSocketNode.position)
    .add(
      heldWeaponContactFrameOffsetPositionScratch.applyQuaternion(
        baseSocketNode.quaternion
      )
    );
  contactFrameNode.quaternion
    .copy(baseSocketNode.quaternion)
    .multiply(heldWeaponContactFrameOffsetQuaternionScratch)
    .normalize();
  handBone.add(contactFrameNode);

  return Object.freeze({
    node: contactFrameNode,
    wristLimitRadians: descriptor.wristLimitRadians
  });
}

function createHeldWeaponContactFrameRuntimes(
  handId: MetaverseHeldObjectSolverHandId,
  handBone: Bone,
  sockets: Readonly<Record<"grip" | "palm" | "support", Object3D>>
): HeldWeaponContactFrameRuntimeById {
  return Object.freeze({
    barrel_cradle: createHeldWeaponContactFrameRuntime(
      handId,
      "barrel_cradle",
      handBone,
      sockets
    ),
    heavy_trigger_grip: createHeldWeaponContactFrameRuntime(
      handId,
      "heavy_trigger_grip",
      handBone,
      sockets
    ),
    primary_trigger_grip: createHeldWeaponContactFrameRuntime(
      handId,
      "primary_trigger_grip",
      handBone,
      sockets
    ),
    support_handle_grip: createHeldWeaponContactFrameRuntime(
      handId,
      "support_handle_grip",
      handBone,
      sockets
    ),
    support_palm: createHeldWeaponContactFrameRuntime(
      handId,
      "support_palm",
      handBone,
      sockets
    ),
    sword_grip: createHeldWeaponContactFrameRuntime(
      handId,
      "sword_grip",
      handBone,
      sockets
    ),
    tool_grip: createHeldWeaponContactFrameRuntime(
      handId,
      "tool_grip",
      handBone,
      sockets
    )
  });
}

function createHumanoidV2HeldWeaponPoseRuntime(
  characterScene: Group,
  nodeResolvers: MetaverseHeldWeaponPoseRuntimeNodeResolvers
): HumanoidV2HeldWeaponPoseRuntime {
  const leftHandBone = nodeResolvers.findBoneNode(
    characterScene,
    "hand_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const rightHandBone = nodeResolvers.findBoneNode(
    characterScene,
    "hand_r",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftLowerarmBone = nodeResolvers.findBoneNode(
    characterScene,
    "lowerarm_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftUpperarmBone = nodeResolvers.findBoneNode(
    characterScene,
    "upperarm_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const rightLowerarmBone = nodeResolvers.findBoneNode(
    characterScene,
    "lowerarm_r",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const rightUpperarmBone = nodeResolvers.findBoneNode(
    characterScene,
    "upperarm_r",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftClavicleBone = nodeResolvers.findBoneNode(
    characterScene,
    "clavicle_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const rightClavicleBone = nodeResolvers.findBoneNode(
    characterScene,
    "clavicle_r",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftIndexBaseBone = nodeResolvers.findBoneNode(
    characterScene,
    "index_01_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftIndexMiddleBone = nodeResolvers.findBoneNode(
    characterScene,
    "index_02_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftIndexTipBone = nodeResolvers.findBoneNode(
    characterScene,
    "index_03_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftMiddleBaseBone = nodeResolvers.findBoneNode(
    characterScene,
    "middle_01_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftMiddleMiddleBone = nodeResolvers.findBoneNode(
    characterScene,
    "middle_02_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const leftMiddleTipBone = nodeResolvers.findBoneNode(
    characterScene,
    "middle_03_l",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const rightIndexBaseBone = nodeResolvers.findBoneNode(
    characterScene,
    "index_01_r",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const rightIndexMiddleBone = nodeResolvers.findBoneNode(
    characterScene,
    "index_02_r",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const rightIndexTipBone = nodeResolvers.findBoneNode(
    characterScene,
    "index_03_r",
    "Metaverse humanoid_v2 held weapon pose"
  );
  const findFingerChain = (
    handSuffix: "l" | "r",
    fingerName: "thumb" | "index" | "middle" | "ring" | "pinky"
  ): HeldWeaponFingerChainRuntime => ({
    baseBone: nodeResolvers.findBoneNode(
      characterScene,
      `${fingerName}_01_${handSuffix}`,
      "Metaverse humanoid_v2 held weapon finger pose"
    ),
    middleBone: nodeResolvers.findBoneNode(
      characterScene,
      `${fingerName}_02_${handSuffix}`,
      "Metaverse humanoid_v2 held weapon finger pose"
    ),
    tipBone: nodeResolvers.findBoneNode(
      characterScene,
      `${fingerName}_03_${handSuffix}`,
      "Metaverse humanoid_v2 held weapon finger pose"
    )
  });
  const fingerChainsByHand = Object.freeze({
    left: Object.freeze({
      index: findFingerChain("l", "index"),
      middle: findFingerChain("l", "middle"),
      pinky: findFingerChain("l", "pinky"),
      ring: findFingerChain("l", "ring"),
      thumb: findFingerChain("l", "thumb")
    }),
    right: Object.freeze({
      index: findFingerChain("r", "index"),
      middle: findFingerChain("r", "middle"),
      pinky: findFingerChain("r", "pinky"),
      ring: findFingerChain("r", "ring"),
      thumb: findFingerChain("r", "thumb")
    })
  } as const satisfies Readonly<Record<
    MetaverseHeldObjectSolverHandId,
    HeldWeaponFingerChainsRuntime
  >>);
  const leftGripSocketNode = nodeResolvers.findSocketNode(
    characterScene,
    "grip_l_socket"
  );
  const leftPalmSocketNode = nodeResolvers.findSocketNode(
    characterScene,
    "palm_l_socket"
  );
  const leftSupportSocketNode = nodeResolvers.findSocketNode(
    characterScene,
    "support_l_socket"
  );
  const rightPalmSocketNode = nodeResolvers.findSocketNode(
    characterScene,
    "palm_r_socket"
  );
  const rightSupportSocketNode = nodeResolvers.findSocketNode(
    characterScene,
    "support_r_socket"
  );
  const rightGripSocketNode = nodeResolvers.findSocketNode(
    characterScene,
    "grip_r_socket"
  );
  const contactFrameRuntimeByHand = Object.freeze({
    left: createHeldWeaponContactFrameRuntimes("left", leftHandBone, {
      grip: leftGripSocketNode,
      palm: leftPalmSocketNode,
      support: leftSupportSocketNode
    }),
    right: createHeldWeaponContactFrameRuntimes("right", rightHandBone, {
      grip: rightGripSocketNode,
      palm: rightPalmSocketNode,
      support: rightSupportSocketNode
    })
  } as const satisfies Readonly<Record<
    MetaverseHeldObjectSolverHandId,
    HeldWeaponContactFrameRuntimeById
  >>);
  const leftIndexGripContactNode = createHeldWeaponFingerContactNode(
    "metaverse_left_index_grip_contact",
    leftIndexTipBone,
    heldWeaponGripFingerContactLocalOffsetMeters
  );
  const leftIndexGripGuideNode = createHeldWeaponFingerGuideNode(
    "metaverse_left_index_grip_guide",
    leftIndexBaseBone
  );
  const leftMiddleGripContactNode = createHeldWeaponFingerContactNode(
    "metaverse_left_middle_grip_contact",
    leftMiddleTipBone,
    heldWeaponGripFingerContactLocalOffsetMeters
  );
  const leftMiddleGripGuideNode = createHeldWeaponFingerGuideNode(
    "metaverse_left_middle_grip_guide",
    leftMiddleBaseBone
  );
  const rightTriggerContactNode = createHeldWeaponFingerContactNode(
    "metaverse_right_trigger_contact",
    rightIndexTipBone,
    Math.max(
      heldWeaponGripFingerContactLocalOffsetMeters,
      Math.abs(rightIndexTipBone.position.x) *
        heldWeaponRightTriggerContactLocalExtensionScale
    )
  );
  const rightTriggerGuideNode = createHeldWeaponFingerGuideNode(
    "metaverse_right_trigger_guide",
    rightIndexBaseBone
  );
  const drivenBones = [
    leftClavicleBone,
    leftUpperarmBone,
    leftLowerarmBone,
    leftHandBone,
    leftIndexBaseBone,
    leftIndexMiddleBone,
    leftIndexTipBone,
    leftMiddleBaseBone,
    leftMiddleMiddleBone,
    leftMiddleTipBone,
    rightClavicleBone,
    rightUpperarmBone,
    rightLowerarmBone,
    rightHandBone,
    rightIndexBaseBone,
    rightIndexMiddleBone,
    rightIndexTipBone,
    fingerChainsByHand.left.thumb.baseBone,
    fingerChainsByHand.left.thumb.middleBone,
    fingerChainsByHand.left.thumb.tipBone,
    fingerChainsByHand.left.ring.baseBone,
    fingerChainsByHand.left.ring.middleBone,
    fingerChainsByHand.left.ring.tipBone,
    fingerChainsByHand.left.pinky.baseBone,
    fingerChainsByHand.left.pinky.middleBone,
    fingerChainsByHand.left.pinky.tipBone,
    fingerChainsByHand.right.thumb.baseBone,
    fingerChainsByHand.right.thumb.middleBone,
    fingerChainsByHand.right.thumb.tipBone,
    fingerChainsByHand.right.middle.baseBone,
    fingerChainsByHand.right.middle.middleBone,
    fingerChainsByHand.right.middle.tipBone,
    fingerChainsByHand.right.ring.baseBone,
    fingerChainsByHand.right.ring.middleBone,
    fingerChainsByHand.right.ring.tipBone,
    fingerChainsByHand.right.pinky.baseBone,
    fingerChainsByHand.right.pinky.middleBone,
    fingerChainsByHand.right.pinky.tipBone
  ] as const;
  const uniqueDrivenBones = [...new Set(drivenBones)];
  const drivenBoneRuntimes = uniqueDrivenBones.map((bone) => ({
    bone,
    rigNeutralLocalPosition: bone.position.clone(),
    rigNeutralLocalQuaternion: bone.quaternion.clone().normalize(),
    rigNeutralLocalScale: bone.scale.clone(),
    sampledLocalPosition: bone.position.clone(),
    sampledLocalQuaternion: bone.quaternion.clone().normalize(),
    sampledLocalScale: bone.scale.clone(),
    solveStartLocalPosition: bone.position.clone(),
    solveStartLocalQuaternion: bone.quaternion.clone().normalize(),
    solveStartLocalScale: bone.scale.clone()
  } satisfies HumanoidV2HeldWeaponDrivenBoneRuntime));

  return {
    contactFrameRuntimeByHand,
    drivenBoneRuntimeByBone: new Map(
      drivenBoneRuntimes.map((drivenBoneRuntime) => [
        drivenBoneRuntime.bone,
        drivenBoneRuntime
      ])
    ),
    drivenBones: drivenBoneRuntimes,
    fingerChainsByHand,
    leftClavicleBone,
    leftIndexBaseBone,
    leftIndexGripContactNode,
    leftIndexGripGuideNode,
    leftIndexMiddleBone,
    leftIndexTipBone,
    leftGripSocketNode,
    leftHandBone,
    leftLowerarmBone,
    leftMiddleBaseBone,
    leftMiddleGripContactNode,
    leftMiddleGripGuideNode,
    leftMiddleMiddleBone,
    leftMiddleTipBone,
    leftPalmSocketNode,
    leftSupportSocketNode,
    leftUpperarmBone,
    rightClavicleBone,
    rightHandBone,
    rightIndexBaseBone,
    rightIndexMiddleBone,
    rightIndexTipBone,
    rightGripSocketNode,
    rightLowerarmBone,
    rightTriggerContactNode,
    rightPalmSocketNode,
    rightSupportSocketNode,
    rightTriggerGuideNode,
    rightUpperarmBone
  };
}

export function createHeldWeaponPoseRuntime(
  characterScene: Group,
  nodeResolvers: MetaverseHeldWeaponPoseRuntimeNodeResolvers
): HumanoidV2HeldWeaponPoseRuntime {
  return createHumanoidV2HeldWeaponPoseRuntime(characterScene, nodeResolvers);
}

function normalizeBoneLocalQuaternion(bone: Bone): void {
  const lengthSq =
    bone.quaternion.x * bone.quaternion.x +
    bone.quaternion.y * bone.quaternion.y +
    bone.quaternion.z * bone.quaternion.z +
    bone.quaternion.w * bone.quaternion.w;

  if (
    !Number.isFinite(lengthSq) ||
    lengthSq <= heldWeaponSolveDirectionEpsilon
  ) {
    bone.quaternion.identity();
    return;
  }

  bone.quaternion.normalize();
}

function restoreHeldWeaponDrivenBoneRigNeutral(
  drivenBone: HumanoidV2HeldWeaponDrivenBoneRuntime
): void {
  drivenBone.bone.position.copy(drivenBone.rigNeutralLocalPosition);
  drivenBone.bone.quaternion.copy(drivenBone.rigNeutralLocalQuaternion);
  drivenBone.bone.scale.copy(drivenBone.rigNeutralLocalScale);
}

export function prepareHumanoidV2HeldWeaponPoseRuntime(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime
): void {
  for (const drivenBone of heldWeaponPoseRuntime.drivenBones) {
    restoreHeldWeaponDrivenBoneRigNeutral(drivenBone);
  }
}

export function captureHumanoidV2HeldWeaponPoseRuntime(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime
): void {
  for (const drivenBone of heldWeaponPoseRuntime.drivenBones) {
    drivenBone.sampledLocalPosition.copy(drivenBone.bone.position);
    drivenBone.sampledLocalQuaternion.copy(drivenBone.bone.quaternion).normalize();
    drivenBone.sampledLocalScale.copy(drivenBone.bone.scale);
  }
}

export function restoreHumanoidV2HeldWeaponPoseRuntime(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime
): void {
  for (const drivenBone of heldWeaponPoseRuntime.drivenBones) {
    drivenBone.bone.position.copy(drivenBone.sampledLocalPosition);
    drivenBone.bone.quaternion.copy(drivenBone.sampledLocalQuaternion);
    drivenBone.bone.scale.copy(drivenBone.sampledLocalScale);
    normalizeBoneLocalQuaternion(drivenBone.bone);
  }
}

function normalizeHumanoidV2HeldWeaponDrivenBoneQuaternions(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime
): void {
  for (const drivenBone of heldWeaponPoseRuntime.drivenBones) {
    normalizeBoneLocalQuaternion(drivenBone.bone);
  }
}

function isFingerBoneName(boneName: string): boolean {
  return (
    boneName.startsWith("thumb_") ||
    boneName.startsWith("index_") ||
    boneName.startsWith("middle_") ||
    boneName.startsWith("ring_") ||
    boneName.startsWith("pinky_")
  );
}

function resolveBoneHandId(
  boneName: string
): MetaverseHeldObjectSolverHandId | null {
  if (boneName.endsWith("_l")) {
    return "left";
  }

  if (boneName.endsWith("_r")) {
    return "right";
  }

  return null;
}

function resolveHeldWeaponDrivenBoneSampledInfluence(
  drivenBone: HumanoidV2HeldWeaponDrivenBoneRuntime,
  solverProfile: MetaverseHeldObjectSolverProfile,
  gripAssignment: ActiveGripAssignment
): number {
  const boneName = drivenBone.bone.name;
  const boneHandId = resolveBoneHandId(boneName);
  const isPrimaryBone = boneHandId === gripAssignment.primaryHand;

  if (isFingerBoneName(boneName)) {
    return clamp(solverProfile.sampledInfluence.fingers, 0, 1);
  }

  if (boneName.startsWith("clavicle_")) {
    return clamp(
      isPrimaryBone
        ? solverProfile.sampledInfluence.claviclePrimary
        : solverProfile.sampledInfluence.clavicleSecondary,
      0,
      1
    );
  }

  if (boneName.startsWith("upperarm_")) {
    return clamp(
      isPrimaryBone
        ? solverProfile.sampledInfluence.upperArmPrimary
        : solverProfile.sampledInfluence.upperArmSecondary,
      0,
      1
    );
  }

  if (boneName.startsWith("lowerarm_")) {
    return clamp(
      isPrimaryBone
        ? solverProfile.sampledInfluence.lowerArmPrimary
        : solverProfile.sampledInfluence.lowerArmSecondary,
      0,
      1
    );
  }

  if (boneName.startsWith("hand_")) {
    return clamp(
      isPrimaryBone
        ? solverProfile.sampledInfluence.handPrimary
        : solverProfile.sampledInfluence.handSecondary,
      0,
      1
    );
  }

  return 0;
}

function restoreHumanoidV2HeldWeaponSolveBaseline(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  solverProfile: MetaverseHeldObjectSolverProfile,
  gripAssignment: ActiveGripAssignment
): void {
  for (const drivenBone of heldWeaponPoseRuntime.drivenBones) {
    const sampledInfluence = resolveHeldWeaponDrivenBoneSampledInfluence(
      drivenBone,
      solverProfile,
      gripAssignment
    );

    drivenBone.solveStartLocalPosition
      .copy(drivenBone.rigNeutralLocalPosition)
      .lerp(
        heldWeaponSolveInfluencePositionScratch.copy(
          drivenBone.sampledLocalPosition
        ),
        sampledInfluence
      );
    drivenBone.solveStartLocalQuaternion
      .copy(drivenBone.rigNeutralLocalQuaternion)
      .slerp(
        heldWeaponSolveInfluenceQuaternionScratch.copy(
          drivenBone.sampledLocalQuaternion
        ),
        sampledInfluence
      )
      .normalize();
    drivenBone.solveStartLocalScale
      .copy(drivenBone.rigNeutralLocalScale)
      .lerp(
        heldWeaponSolveInfluenceScaleScratch.copy(
          drivenBone.sampledLocalScale
        ),
        sampledInfluence
      );
    drivenBone.bone.position.copy(drivenBone.solveStartLocalPosition);
    drivenBone.bone.quaternion.copy(drivenBone.solveStartLocalQuaternion);
    drivenBone.bone.scale.copy(drivenBone.solveStartLocalScale);
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

  bone.updateMatrixWorld(true);
  effectorNode.updateMatrixWorld(true);
  resolveHandBoneTargetWorldQuaternion(
    bone,
    effectorNode,
    targetWorldQuaternion,
    heldWeaponHandTargetWorldQuaternionScratch
  );
  heldWeaponParentWorldQuaternionInverseScratch
    .copy(parentNode.getWorldQuaternion(heldWeaponParentWorldQuaternionScratch))
    .invert();
  bone.quaternion
    .copy(heldWeaponParentWorldQuaternionInverseScratch)
    .multiply(heldWeaponHandTargetWorldQuaternionScratch)
    .normalize();
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
  handTargetWorldQuaternion: Quaternion,
  handEffectorLocalPosition: Vector3,
  handEffectorTargetWorldPosition: Vector3,
  outputHandWorldPosition: Vector3
): void {
  outputHandWorldPosition.copy(handEffectorTargetWorldPosition).sub(
    heldWeaponSocketLocalOffsetScratch
      .copy(handEffectorLocalPosition)
      .applyQuaternion(handTargetWorldQuaternion)
  );
}

function resolveHandBoneTargetWorldQuaternion(
  handBone: Bone,
  handEffectorNode: Object3D,
  handEffectorTargetWorldQuaternion: Quaternion,
  outputHandWorldQuaternion: Quaternion
): Quaternion {
  heldWeaponHandEffectorLocalQuaternionScratch
    .copy(handBone.getWorldQuaternion(heldWeaponCurrentWorldQuaternionScratch))
    .invert()
    .multiply(
      handEffectorNode.getWorldQuaternion(heldWeaponEffectorWorldQuaternionScratch)
    )
    .normalize();

  return outputHandWorldQuaternion
    .copy(handEffectorTargetWorldQuaternion)
    .multiply(heldWeaponHandEffectorLocalQuaternionScratch.invert())
    .normalize();
}

function resolveHandEffectorLocalPosition(
  handBone: Bone,
  handEffectorNode: Object3D,
  outputLocalPosition: Vector3
): Vector3 {
  return handBone.worldToLocal(
    outputLocalPosition.copy(
      handEffectorNode.getWorldPosition(heldWeaponEffectorWorldPositionScratch)
    )
  );
}

function resolveClosestPointOnSegmentToTarget(
  segmentStart: Vector3,
  segmentEnd: Vector3,
  target: Vector3,
  outputClosestPoint: Vector3
): number {
  heldWeaponLocalChainAxisScratch.copy(segmentEnd).sub(segmentStart);
  const segmentLengthSq = heldWeaponLocalChainAxisScratch.lengthSq();

  if (segmentLengthSq <= heldWeaponSolveDirectionEpsilon) {
    outputClosestPoint.copy(segmentStart);

    return outputClosestPoint.distanceTo(target);
  }

  const closestPointAlpha = clamp(
    heldWeaponLocalChainRootPositionScratch
      .copy(target)
      .sub(segmentStart)
      .dot(heldWeaponLocalChainAxisScratch) / segmentLengthSq,
    0,
    1
  );

  outputClosestPoint.copy(segmentStart).addScaledVector(
    heldWeaponLocalChainAxisScratch,
    closestPointAlpha
  );

  return outputClosestPoint.distanceTo(target);
}

function resolveGripLocalPositionWorldPositionFromTarget(
  gripTargetWorldPosition: Vector3,
  gripTargetWorldQuaternion: Quaternion,
  gripLocalPosition: Vector3,
  outputWorldPosition: Vector3
): Vector3 {
  return outputWorldPosition
    .copy(gripTargetWorldPosition)
    .add(
      heldWeaponSocketLocalOffsetScratch
        .copy(gripLocalPosition)
        .applyQuaternion(gripTargetWorldQuaternion)
    );
}

function resolveGripTargetWorldPositionFromLocalGripOffset(
  targetNodeWorldPosition: Vector3,
  gripTargetWorldQuaternion: Quaternion,
  gripLocalPosition: Vector3,
  outputWorldPosition: Vector3
): Vector3 {
  return outputWorldPosition
    .copy(targetNodeWorldPosition)
    .sub(
      heldWeaponSocketLocalOffsetScratch
        .copy(gripLocalPosition)
        .applyQuaternion(gripTargetWorldQuaternion)
    );
}

function shouldUseAdsAnchorPose(
  attachmentRuntime: Pick<
    MetaverseAttachmentProofRuntime,
    "heldGripToAdsCameraAnchorLocalPosition" | "holdProfile"
  >,
  aimState: Pick<HeldObjectAimState, "adsBlend" | "aimMode">
): boolean {
  const adsPolicy = attachmentRuntime.holdProfile.adsPolicy;

  return (
    adsPolicy !== "none" &&
    adsPolicy !== "third_person_hint_only" &&
    (aimState.aimMode === "ads" ||
      Math.abs(aimState.adsBlend ?? 0) > heldWeaponSolveDirectionEpsilon) &&
    attachmentRuntime.heldGripToAdsCameraAnchorLocalPosition !== null
  );
}

function shouldUseSupportPalmHintPose(
  attachmentRuntime: Pick<MetaverseAttachmentProofRuntime, "offHandTargetKind">
): boolean {
  return attachmentRuntime.offHandTargetKind === "support-palm-hint";
}

function resolveSupportPalmFade(
  solverProfile: Pick<MetaverseHeldObjectSolverProfile, "adsCalibration">,
  aimState: Pick<HeldObjectAimState, "pitchRadians">
): number {
  const fadeStart =
    solverProfile.adsCalibration.supportPalmFadeStartPitchRadians;
  const fadeEnd = solverProfile.adsCalibration.supportPalmFadeEndPitchRadians;

  if (fadeStart === null || fadeEnd === null) {
    return 1;
  }

  if (Math.abs(fadeStart - fadeEnd) <= heldWeaponSolveDirectionEpsilon) {
    return aimState.pitchRadians <= fadeEnd ? 0 : 1;
  }

  return clamp(
    (aimState.pitchRadians - fadeEnd) / (fadeStart - fadeEnd),
    0,
    1
  );
}

function resolveHipFireGripTargetWorldPosition(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  lookDirection: Vector3,
  outputGripWorldPosition: Vector3
): void {
  outputGripWorldPosition.copy(
    heldWeaponPoseRuntime.rightClavicleBone.getWorldPosition(
      outputGripWorldPosition
    )
  );
  outputGripWorldPosition.addScaledVector(
    lookDirection,
    heldWeaponChestForwardMeters
  );
  heldWeaponGripUpDirectionScratch.set(0, 1, 0);
  heldWeaponGripUpDirectionScratch.addScaledVector(
    lookDirection,
    -heldWeaponGripUpDirectionScratch.dot(lookDirection)
  );

  if (heldWeaponGripUpDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    heldWeaponGripUpDirectionScratch.set(0, 0, 1);
    heldWeaponGripUpDirectionScratch.addScaledVector(
      lookDirection,
      -heldWeaponGripUpDirectionScratch.dot(lookDirection)
    );
  }

  if (heldWeaponGripUpDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    return;
  }

  heldWeaponGripUpDirectionScratch.normalize();
  heldWeaponGripAcrossDirectionScratch
    .copy(lookDirection)
    .cross(heldWeaponGripUpDirectionScratch);

  if (heldWeaponGripAcrossDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    return;
  }

  heldWeaponGripAcrossDirectionScratch.normalize();
  outputGripWorldPosition
    .addScaledVector(heldWeaponGripAcrossDirectionScratch, heldWeaponHipFireAcrossMeters)
    .addScaledVector(heldWeaponGripUpDirectionScratch, -heldWeaponHipFireDownMeters);
}

function resolveCameraWorldPositionWithHeadClearance(
  cameraRayOriginWorld: MetaverseVector3Snapshot,
  lookDirection: Vector3,
  headAnchorNodes: readonly Object3D[],
  bodyPresentation: Pick<
    MetaverseRuntimeConfig["bodyPresentation"],
    | "groundedFirstPersonHeadClearanceMeters"
    | "groundedFirstPersonHeadOcclusionRadiusMeters"
  >,
  outputWorldPosition: Vector3
): Vector3 {
  outputWorldPosition.set(
    cameraRayOriginWorld.x,
    cameraRayOriginWorld.y,
    cameraRayOriginWorld.z
  );

  if (headAnchorNodes.length === 0) {
    return outputWorldPosition;
  }

  let selectedForwardDistanceMeters = Number.NEGATIVE_INFINITY;
  let selectedLateralDistanceMeters = Number.POSITIVE_INFINITY;

  for (const headAnchorNode of headAnchorNodes) {
    headAnchorNode.getWorldPosition(heldWeaponHeadWorldPositionScratch);
    heldWeaponHeadToCameraScratch.set(
      heldWeaponHeadWorldPositionScratch.x - cameraRayOriginWorld.x,
      heldWeaponHeadWorldPositionScratch.y - cameraRayOriginWorld.y,
      heldWeaponHeadWorldPositionScratch.z - cameraRayOriginWorld.z
    );
    const forwardDistanceMeters =
      heldWeaponHeadToCameraScratch.dot(lookDirection);
    const lateralDistanceMeters = Math.sqrt(
      Math.max(
        0,
        heldWeaponHeadToCameraScratch.lengthSq() -
          forwardDistanceMeters * forwardDistanceMeters
      )
    );

    if (lateralDistanceMeters > selectedLateralDistanceMeters) {
      continue;
    }

    if (
      lateralDistanceMeters === selectedLateralDistanceMeters &&
      forwardDistanceMeters <= selectedForwardDistanceMeters
    ) {
      continue;
    }

    selectedForwardDistanceMeters = forwardDistanceMeters;
    selectedLateralDistanceMeters = lateralDistanceMeters;
  }

  if (
    !Number.isFinite(selectedLateralDistanceMeters) ||
    selectedLateralDistanceMeters >
      bodyPresentation.groundedFirstPersonHeadOcclusionRadiusMeters
  ) {
    return outputWorldPosition;
  }

  const requiredForwardShiftMeters =
    selectedForwardDistanceMeters +
    bodyPresentation.groundedFirstPersonHeadClearanceMeters;

  if (requiredForwardShiftMeters <= 0) {
    return outputWorldPosition;
  }

  outputWorldPosition.addScaledVector(lookDirection, requiredForwardShiftMeters);

  return outputWorldPosition;
}

function resolveHeldWeaponGripAimTarget(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  firstPersonHeadAnchorNodes: readonly Object3D[],
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  solverProfile: Pick<MetaverseHeldObjectSolverProfile, "adsCalibration">,
  aimState: HeldObjectAimState,
  bodyPresentation:
    | Pick<
        MetaverseRuntimeConfig["bodyPresentation"],
        | "groundedFirstPersonHeadClearanceMeters"
        | "groundedFirstPersonHeadOcclusionRadiusMeters"
      >
    | null,
  outputGripWorldPosition: Vector3,
  outputGripWorldQuaternion: Quaternion
): boolean {
  heldWeaponLookDirectionScratch.set(
    aimState.cameraForwardWorld.x,
    aimState.cameraForwardWorld.y,
    aimState.cameraForwardWorld.z
  );

  if (heldWeaponLookDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    return false;
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
    return false;
  }

  heldWeaponGripUpDirectionScratch.normalize();
  heldWeaponGripAcrossDirectionScratch
    .copy(heldWeaponLookDirectionScratch)
    .cross(heldWeaponGripUpDirectionScratch);

  if (heldWeaponGripAcrossDirectionScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    return false;
  }

  heldWeaponGripAcrossDirectionScratch.normalize();
  heldWeaponGripUpDirectionScratch
    .copy(heldWeaponGripAcrossDirectionScratch)
    .cross(heldWeaponLookDirectionScratch)
    .normalize();
  outputGripWorldQuaternion.setFromRotationMatrix(
    heldWeaponGripAlignmentMatrixScratch.makeBasis(
      heldWeaponLookDirectionScratch,
      heldWeaponGripUpDirectionScratch,
      heldWeaponGripAcrossDirectionScratch
    )
  );
  outputGripWorldQuaternion.multiply(
    heldWeaponGripLocalAimQuaternionScratch
      .copy(attachmentRuntime.heldGripLocalAimQuaternion)
      .invert()
  ).normalize();
  resolveHipFireGripTargetWorldPosition(
    heldWeaponPoseRuntime,
    heldWeaponLookDirectionScratch,
    heldWeaponHipFireGripWorldPositionScratch
  );
  outputGripWorldPosition.copy(heldWeaponHipFireGripWorldPositionScratch);

  if (shouldUseAdsAnchorPose(attachmentRuntime, aimState)) {
    // Align the authored ADS camera anchor to the camera so the rendered held
    // object follows the same line as the gameplay reticle.
    const resolvedAdsBlend = clamp(
      aimState.adsBlend ?? (aimState.aimMode === "ads" ? 1 : 0),
      0,
      1
    );

    if (aimState.adsBlend === null && bodyPresentation !== null) {
      resolveCameraWorldPositionWithHeadClearance(
        aimState.cameraRayOriginWorld,
        heldWeaponLookDirectionScratch,
        firstPersonHeadAnchorNodes,
        bodyPresentation,
        heldWeaponCameraWorldPositionScratch
      );
    } else {
      heldWeaponCameraWorldPositionScratch.set(
        aimState.cameraRayOriginWorld.x,
        aimState.cameraRayOriginWorld.y,
        aimState.cameraRayOriginWorld.z
      );
    }
    if (attachmentRuntime.heldAdsCameraTargetOffset !== null) {
      heldWeaponCameraWorldPositionScratch
        .addScaledVector(
          heldWeaponLookDirectionScratch,
          attachmentRuntime.heldAdsCameraTargetOffset.forward
        )
        .addScaledVector(
          heldWeaponGripUpDirectionScratch,
          attachmentRuntime.heldAdsCameraTargetOffset.up
        )
        .addScaledVector(
          heldWeaponGripAcrossDirectionScratch,
          attachmentRuntime.heldAdsCameraTargetOffset.across
        );
    }
    resolveGripTargetWorldPositionFromLocalGripOffset(
      heldWeaponCameraWorldPositionScratch,
      outputGripWorldQuaternion,
      attachmentRuntime.heldGripToAdsCameraAnchorLocalPosition!,
      heldWeaponAdsGripWorldPositionScratch
    );
    heldWeaponAdsGripDeltaScratch
      .copy(heldWeaponAdsGripWorldPositionScratch)
      .sub(heldWeaponHipFireGripWorldPositionScratch);
    const rawAdsGripDeltaMeters = heldWeaponAdsGripDeltaScratch.length();
    const adsPositionalWeight =
      resolvedAdsBlend *
      clamp(solverProfile.adsCalibration.adsAnchorPositionalWeight, 0, 1);
    const requestedAdsGripDeltaMeters =
      rawAdsGripDeltaMeters * adsPositionalWeight;
    const maxAdsGripTargetDeltaMeters = Math.max(
      0,
      solverProfile.adsCalibration.maxAdsGripTargetDeltaMeters
    );
    const appliedAdsGripDeltaMeters = Math.min(
      requestedAdsGripDeltaMeters,
      maxAdsGripTargetDeltaMeters
    );

    outputGripWorldPosition.copy(heldWeaponHipFireGripWorldPositionScratch);

    if (
      rawAdsGripDeltaMeters > heldWeaponSolveDirectionEpsilon &&
      appliedAdsGripDeltaMeters > heldWeaponSolveDirectionEpsilon
    ) {
      outputGripWorldPosition.addScaledVector(
        heldWeaponAdsGripDeltaScratch.normalize(),
        appliedAdsGripDeltaMeters
      );
    }

    return true;
  }

  return true;
}

function alignOffHandBoneTowardHeldWeaponTarget(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  offHandEffectorNode: Object3D,
  offHandTargetWorldQuaternion: Quaternion,
  useSupportPalmHintPose: boolean,
  supportPalmHintActive: boolean
): void {
  if (useSupportPalmHintPose && !supportPalmHintActive) {
    return;
  }

  if (useSupportPalmHintPose) {
    heldWeaponSupportPalmPreAlignLocalQuaternionScratch.copy(
      heldWeaponPoseRuntime.leftHandBone.quaternion
    );
    alignBoneTowardEffectorWorldQuaternion(
      heldWeaponPoseRuntime.leftHandBone,
      offHandEffectorNode,
      offHandTargetWorldQuaternion
    );
    heldWeaponPoseRuntime.leftHandBone.quaternion
      .slerpQuaternions(
        heldWeaponSupportPalmPreAlignLocalQuaternionScratch,
        heldWeaponPoseRuntime.leftHandBone.quaternion,
        heldWeaponSupportPalmHintRotationInfluence
      )
      .normalize();
    return;
  }

  alignBoneTowardEffectorWorldQuaternion(
    heldWeaponPoseRuntime.leftHandBone,
    offHandEffectorNode,
    offHandTargetWorldQuaternion
  );
}

function resolveRightHandWorldTargetPosition(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  handEffectorNode: Object3D,
  gripTargetWorldPosition: Vector3,
  handEffectorTargetWorldQuaternion: Quaternion,
  outputHandWorldPosition: Vector3
): void {
  const handEffectorLocalPosition = resolveHandEffectorLocalPosition(
    heldWeaponPoseRuntime.rightHandBone,
    handEffectorNode,
    heldWeaponHandEffectorLocalPositionScratch
  );
  const handTargetWorldQuaternion = resolveHandBoneTargetWorldQuaternion(
    heldWeaponPoseRuntime.rightHandBone,
    handEffectorNode,
    handEffectorTargetWorldQuaternion,
    heldWeaponHandTargetWorldQuaternionScratch
  );

  resolveHandWorldTargetPosition(
    handTargetWorldQuaternion,
    handEffectorLocalPosition,
    gripTargetWorldPosition,
    outputHandWorldPosition
  );
}

function solveTwoBoneChainToWorldTarget(
  rootBone: Bone,
  middleBone: Bone,
  effectorNode: Object3D,
  effectorWorldTargetPosition: Vector3,
  poleWorldDirection: Vector3,
  reachSlackMeters: number
): void {
  rootBone.getWorldPosition(heldWeaponShoulderWorldPositionScratch);
  middleBone.getWorldPosition(heldWeaponElbowWorldPositionScratch);
  effectorNode.getWorldPosition(heldWeaponWristWorldPositionScratch);
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
    .copy(effectorWorldTargetPosition)
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
      upperarmLength + lowerarmLength - reachSlackMeters
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
    rootBone,
    middleBone,
    heldWeaponElbowTargetWorldPositionScratch
  );
  alignBoneTowardWorldPoint(
    middleBone,
    effectorNode,
    heldWeaponClampedHandTargetWorldPositionScratch
  );
}

function solveBoneChainCcdToWorldTarget(
  rotatingBones: readonly Bone[],
  effectorNode: Object3D,
  effectorWorldTargetPosition: Vector3,
  maxIterations: number
): void {
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    for (
      let boneIndex = rotatingBones.length - 1;
      boneIndex >= 0;
      boneIndex -= 1
    ) {
      const rotatingBone = rotatingBones[boneIndex];

      if (rotatingBone === undefined) {
        continue;
      }

      alignBoneTowardWorldPoint(
        rotatingBone,
        effectorNode,
        effectorWorldTargetPosition
      );
    }

    if (
      effectorNode.getWorldPosition(heldWeaponWristWorldPositionScratch).distanceTo(
        effectorWorldTargetPosition
      ) <= heldWeaponSolveDirectionEpsilon
    ) {
      return;
    }
  }
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

function measureElbowPoleAngleRadians(
  upperarmBone: Bone,
  lowerarmBone: Bone,
  handBone: Bone,
  targetWorldDirection: Vector3
): number | null {
  upperarmBone.getWorldPosition(heldWeaponShoulderWorldPositionScratch);
  lowerarmBone.getWorldPosition(heldWeaponElbowWorldPositionScratch);
  handBone.getWorldPosition(heldWeaponWristWorldPositionScratch);
  heldWeaponArmAxisScratch
    .copy(heldWeaponWristWorldPositionScratch)
    .sub(heldWeaponShoulderWorldPositionScratch);

  if (heldWeaponArmAxisScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    return null;
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
    return null;
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
    return null;
  }

  heldWeaponTargetPoleDirectionScratch.normalize();

  return Math.atan2(
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
  handBone.getWorldPosition(heldWeaponWristWorldPositionScratch);
  heldWeaponArmAxisScratch
    .copy(heldWeaponWristWorldPositionScratch)
    .sub(heldWeaponShoulderWorldPositionScratch);

  if (heldWeaponArmAxisScratch.lengthSq() <= heldWeaponSolveDirectionEpsilon) {
    return;
  }

  heldWeaponArmAxisScratch.normalize();
  const signedPoleAngle = measureElbowPoleAngleRadians(
    upperarmBone,
    lowerarmBone,
    handBone,
    targetWorldDirection
  );

  if (
    signedPoleAngle === null ||
    Math.abs(signedPoleAngle) <= heldWeaponSolveDirectionEpsilon
  ) {
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

function syncFingerChainContactPose(
  baseBone: Bone,
  middleBone: Bone,
  tipBone: Bone,
  guideNode: Object3D,
  contactNode: Object3D,
  handEffectorNode: Object3D,
  contactTargetWorldPosition: Vector3
): void {
  heldWeaponFingerTargetGripLocalPositionScratch.copy(
    handEffectorNode.worldToLocal(
      heldWeaponEffectorWorldPositionScratch.copy(contactTargetWorldPosition)
    )
  );
  heldWeaponFingerBaseGripLocalPositionScratch.copy(
    handEffectorNode.worldToLocal(
      heldWeaponBoneWorldPositionScratch.copy(
        baseBone.getWorldPosition(heldWeaponBoneWorldPositionScratch)
      )
    )
  );
  heldWeaponFingerMiddleGripLocalPositionScratch.copy(
    handEffectorNode.worldToLocal(
      heldWeaponWristWorldPositionScratch.copy(
        middleBone.getWorldPosition(heldWeaponWristWorldPositionScratch)
      )
    )
  );
  heldWeaponFingerTipGripLocalPositionScratch.copy(
    handEffectorNode.worldToLocal(
      heldWeaponShoulderWorldPositionScratch.copy(
        tipBone.getWorldPosition(heldWeaponShoulderWorldPositionScratch)
      )
    )
  );
  const baseSegmentDistance = resolveClosestPointOnSegmentToTarget(
    heldWeaponFingerBaseGripLocalPositionScratch,
    heldWeaponFingerMiddleGripLocalPositionScratch,
    heldWeaponFingerTargetGripLocalPositionScratch,
    heldWeaponFingerGuideGripLocalPositionScratch
  );
  const tipSegmentDistance = resolveClosestPointOnSegmentToTarget(
    heldWeaponFingerMiddleGripLocalPositionScratch,
    heldWeaponFingerTipGripLocalPositionScratch,
    heldWeaponFingerTargetGripLocalPositionScratch,
    heldWeaponFingerGuideAlternateGripLocalPositionScratch
  );

  if (tipSegmentDistance < baseSegmentDistance) {
    heldWeaponFingerGuideGripLocalPositionScratch.copy(
      heldWeaponFingerGuideAlternateGripLocalPositionScratch
    );
  }
  const guideParentBone = tipSegmentDistance < baseSegmentDistance
    ? middleBone
    : baseBone;

  if (guideNode.parent !== guideParentBone) {
    guideNode.removeFromParent();
    guideParentBone.add(guideNode);
  }

  guideNode.position.copy(
    guideParentBone.worldToLocal(
      handEffectorNode.localToWorld(
        heldWeaponEffectorWorldPositionScratch.copy(
          heldWeaponFingerGuideGripLocalPositionScratch
        )
      )
    )
  );
  guideNode.updateMatrixWorld(true);

  solveBoneChainCcdToWorldTarget(
    tipSegmentDistance < baseSegmentDistance
      ? [baseBone, middleBone]
      : [baseBone],
    guideNode,
    contactTargetWorldPosition,
    4
  );
  solveBoneChainCcdToWorldTarget(
    [baseBone, middleBone, tipBone],
    contactNode,
    contactTargetWorldPosition,
    6
  );
}

function applyFingerBoneCurl(
  heldWeaponPoseRuntime: Pick<
    HumanoidV2HeldWeaponPoseRuntime,
    "drivenBoneRuntimeByBone"
  >,
  bone: Bone,
  curlRadians: number
): void {
  const drivenBone = heldWeaponPoseRuntime.drivenBoneRuntimeByBone.get(bone);

  if (drivenBone === undefined) {
    throw new Error(
      `Metaverse held-object finger pose cannot resolve neutral baseline for ${bone.name}.`
    );
  }

  bone.quaternion.copy(drivenBone.rigNeutralLocalQuaternion);

  if (Math.abs(curlRadians) <= heldWeaponSolveDirectionEpsilon) {
    normalizeBoneLocalQuaternion(bone);
    bone.updateMatrixWorld(true);
    return;
  }

  bone.quaternion.multiply(
    heldWeaponFingerCurlQuaternionScratch.setFromAxisAngle(
      heldWeaponFingerCurlAxis,
      curlRadians
    )
  );
  normalizeBoneLocalQuaternion(bone);
  bone.updateMatrixWorld(true);
}

function applyFingerChainCurlPose(
  heldWeaponPoseRuntime: Pick<
    HumanoidV2HeldWeaponPoseRuntime,
    "drivenBoneRuntimeByBone"
  >,
  fingerChain: HeldWeaponFingerChainRuntime,
  baseCurlRadians: number,
  middleCurlRadians: number,
  tipCurlRadians: number
): void {
  applyFingerBoneCurl(
    heldWeaponPoseRuntime,
    fingerChain.baseBone,
    baseCurlRadians
  );
  applyFingerBoneCurl(
    heldWeaponPoseRuntime,
    fingerChain.middleBone,
    middleCurlRadians
  );
  applyFingerBoneCurl(
    heldWeaponPoseRuntime,
    fingerChain.tipBone,
    tipCurlRadians
  );
}

function applyHeldObjectFingerPose(
  heldWeaponPoseRuntime: Pick<
    HumanoidV2HeldWeaponPoseRuntime,
    "drivenBoneRuntimeByBone"
  >,
  fingerChains: HeldWeaponFingerChainsRuntime,
  fingerPoseId: MetaverseHeldObjectFingerPoseId
): void {
  switch (fingerPoseId) {
    case "relaxed_open":
      for (const fingerChain of Object.values(fingerChains)) {
        applyFingerChainCurlPose(
          heldWeaponPoseRuntime,
          fingerChain,
          0,
          0,
          0
        );
      }
      return;
    case "pistol_grip_trigger_index":
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.thumb,
        0.32,
        0.24,
        0.14
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.index,
        0.12,
        0.06,
        0.03
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.middle,
        0.58,
        0.46,
        0.32
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.ring,
        0.62,
        0.5,
        0.36
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.pinky,
        0.66,
        0.52,
        0.38
      );
      return;
    case "support_palm_optional":
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.thumb,
        0.1,
        0.06,
        0.04
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.index,
        0.12,
        0.08,
        0.06
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.middle,
        0.14,
        0.1,
        0.06
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.ring,
        0.12,
        0.08,
        0.06
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.pinky,
        0.1,
        0.08,
        0.04
      );
      return;
    case "long_gun_trigger_grip":
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.thumb,
        0.26,
        0.2,
        0.12
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.index,
        0.1,
        0.06,
        0.03
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.middle,
        0.54,
        0.42,
        0.3
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.ring,
        0.56,
        0.44,
        0.32
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.pinky,
        0.58,
        0.46,
        0.34
      );
      return;
    case "foregrip_support":
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.thumb,
        0.22,
        0.18,
        0.1
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.index,
        0.42,
        0.34,
        0.24
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.middle,
        0.46,
        0.38,
        0.26
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.ring,
        0.46,
        0.38,
        0.26
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.pinky,
        0.42,
        0.34,
        0.24
      );
      return;
    case "heavy_trigger_grip":
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.thumb,
        0.24,
        0.18,
        0.1
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.index,
        0.1,
        0.06,
        0.03
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.middle,
        0.48,
        0.38,
        0.26
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.ring,
        0.5,
        0.4,
        0.28
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.pinky,
        0.52,
        0.42,
        0.3
      );
      return;
    case "support_handle_grip":
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.thumb,
        0.28,
        0.22,
        0.12
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.index,
        0.5,
        0.4,
        0.28
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.middle,
        0.54,
        0.44,
        0.3
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.ring,
        0.54,
        0.44,
        0.3
      );
      applyFingerChainCurlPose(
        heldWeaponPoseRuntime,
        fingerChains.pinky,
        0.5,
        0.4,
        0.28
      );
      return;
  }
}

function syncRightTriggerFingerPose(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  mainHandEffectorNode: Object3D,
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  gripTargetWorldPosition: Vector3,
  gripTargetWorldQuaternion: Quaternion
): void {
  if (
    attachmentRuntime.heldTriggerMarkerNode === null &&
    attachmentRuntime.heldGripToTriggerMarkerLocalPosition === null
  ) {
    return;
  }

  if (attachmentRuntime.heldTriggerMarkerNode !== null) {
    attachmentRuntime.heldTriggerMarkerNode.getWorldPosition(
      heldWeaponTriggerMarkerWorldPositionScratch
    );
  } else {
    resolveGripLocalPositionWorldPositionFromTarget(
      gripTargetWorldPosition,
      gripTargetWorldQuaternion,
      attachmentRuntime.heldGripToTriggerMarkerLocalPosition!,
      heldWeaponTriggerMarkerWorldPositionScratch
    );
  }
  syncFingerChainContactPose(
    heldWeaponPoseRuntime.rightIndexBaseBone,
    heldWeaponPoseRuntime.rightIndexMiddleBone,
    heldWeaponPoseRuntime.rightIndexTipBone,
    heldWeaponPoseRuntime.rightTriggerGuideNode,
    heldWeaponPoseRuntime.rightTriggerContactNode,
    mainHandEffectorNode,
    heldWeaponTriggerMarkerWorldPositionScratch,
  );
}

function syncLeftSupportGripFingerPose(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  offHandEffectorNode: Object3D,
  attachmentRuntime: Pick<
    MetaverseAttachmentProofRuntime,
    "offHandGripAnchorNode"
  >
): void {
  if (attachmentRuntime.offHandGripAnchorNode === null) {
    return;
  }

  attachmentRuntime.offHandGripAnchorNode.getWorldPosition(
    heldWeaponFingerContactTargetWorldPositionScratch
  );
  syncFingerChainContactPose(
    heldWeaponPoseRuntime.leftIndexBaseBone,
    heldWeaponPoseRuntime.leftIndexMiddleBone,
    heldWeaponPoseRuntime.leftIndexTipBone,
    heldWeaponPoseRuntime.leftIndexGripGuideNode,
    heldWeaponPoseRuntime.leftIndexGripContactNode,
    offHandEffectorNode,
    heldWeaponFingerContactTargetWorldPositionScratch
  );
  syncFingerChainContactPose(
    heldWeaponPoseRuntime.leftMiddleBaseBone,
    heldWeaponPoseRuntime.leftMiddleMiddleBone,
    heldWeaponPoseRuntime.leftMiddleTipBone,
    heldWeaponPoseRuntime.leftMiddleGripGuideNode,
    heldWeaponPoseRuntime.leftMiddleGripContactNode,
    offHandEffectorNode,
    heldWeaponFingerContactTargetWorldPositionScratch
  );
}

export function resolveHeldWeaponMainHandEffectorNode(
  heldWeaponPoseRuntime: Pick<
    HumanoidV2HeldWeaponPoseRuntime,
    | "leftGripSocketNode"
    | "leftPalmSocketNode"
    | "rightGripSocketNode"
    | "rightPalmSocketNode"
  >,
  gripAssignment: Pick<ActiveGripAssignment, "primaryCharacterSocketRole">
): Object3D {
  switch (gripAssignment.primaryCharacterSocketRole) {
    case "grip_l_socket":
      return heldWeaponPoseRuntime.leftGripSocketNode;
    case "grip_r_socket":
      return heldWeaponPoseRuntime.rightGripSocketNode;
    case "palm_l_socket":
      return heldWeaponPoseRuntime.leftPalmSocketNode;
    case "palm_r_socket":
      return heldWeaponPoseRuntime.rightPalmSocketNode;
  }
}

export function resolveHeldWeaponMainHandContactFrameRuntime(
  heldWeaponPoseRuntime: Pick<HumanoidV2HeldWeaponPoseRuntime, "contactFrameRuntimeByHand">,
  gripAssignment: Pick<ActiveGripAssignment, "primaryHand">,
  solverProfile: Pick<MetaverseHeldObjectSolverProfile, "contactBindings">
): HeldWeaponContactFrameRuntime {
  return heldWeaponPoseRuntime.contactFrameRuntimeByHand[
    gripAssignment.primaryHand
  ][solverProfile.contactBindings.primary.contactFrameId];
}

export function resolveHeldWeaponOffHandEffectorNode(
  heldWeaponPoseRuntime: Pick<
    HumanoidV2HeldWeaponPoseRuntime,
    | "leftGripSocketNode"
    | "leftPalmSocketNode"
    | "leftSupportSocketNode"
    | "rightGripSocketNode"
    | "rightPalmSocketNode"
    | "rightSupportSocketNode"
  >,
  gripAssignment: Pick<ActiveGripAssignment, "secondaryCharacterSocketRole">
): Object3D {
  switch (gripAssignment.secondaryCharacterSocketRole) {
    case "grip_l_socket":
      return heldWeaponPoseRuntime.leftGripSocketNode;
    case "grip_r_socket":
      return heldWeaponPoseRuntime.rightGripSocketNode;
    case "palm_l_socket":
      return heldWeaponPoseRuntime.leftPalmSocketNode;
    case "palm_r_socket":
      return heldWeaponPoseRuntime.rightPalmSocketNode;
    case "support_l_socket":
      return heldWeaponPoseRuntime.leftSupportSocketNode;
    case "support_r_socket":
      return heldWeaponPoseRuntime.rightSupportSocketNode;
    case null:
      return heldWeaponPoseRuntime.leftGripSocketNode;
  }
}

export function resolveHeldWeaponOffHandContactFrameRuntime(
  heldWeaponPoseRuntime: Pick<HumanoidV2HeldWeaponPoseRuntime, "contactFrameRuntimeByHand">,
  gripAssignment: Pick<ActiveGripAssignment, "secondaryHand">,
  solverProfile: Pick<MetaverseHeldObjectSolverProfile, "contactBindings">
): HeldWeaponContactFrameRuntime | null {
  const secondaryBinding = solverProfile.contactBindings.secondary;

  if (gripAssignment.secondaryHand === null || secondaryBinding === null) {
    return null;
  }

  return heldWeaponPoseRuntime.contactFrameRuntimeByHand[
    gripAssignment.secondaryHand
  ][secondaryBinding.contactFrameId];
}

function resolvePrimaryGripHand(
  attachmentRuntime: Pick<MetaverseAttachmentProofRuntime, "holdProfile">,
  solverProfile: Pick<MetaverseHeldObjectSolverProfile, "primaryHand">
): MetaverseHeldObjectSolverHandId {
  const primaryHandDefault = attachmentRuntime.holdProfile.primaryHandDefault;
  const primaryHand =
    primaryHandDefault === "either"
      ? solverProfile.primaryHand
      : primaryHandDefault;

  if (primaryHand !== solverProfile.primaryHand) {
    throw new Error(
      `Metaverse held-object solver profile ${attachmentRuntime.holdProfile.poseProfileId} expects ${solverProfile.primaryHand} primary hand, not ${primaryHand}.`
    );
  }

  return primaryHand;
}

function resolvePrimaryCharacterSocketRole(
  primaryHand: MetaverseHeldObjectSolverHandId,
  attachmentRuntime: Pick<MetaverseAttachmentProofRuntime, "heldMount">
): ActiveGripAssignment["primaryCharacterSocketRole"] {
  switch (attachmentRuntime.heldMount.socketName) {
    case "grip_l_socket":
    case "grip_r_socket":
    case "palm_l_socket":
    case "palm_r_socket":
      break;
    default:
      throw new Error(
        `Metaverse held-object primary mount requires a grip or palm presentation socket, not ${attachmentRuntime.heldMount.socketName}.`
      );
  }

  switch (primaryHand) {
    case "left":
      return attachmentRuntime.heldMount.socketName === "palm_l_socket"
        ? "palm_l_socket"
        : "grip_l_socket";
    case "right":
      return attachmentRuntime.heldMount.socketName === "palm_r_socket"
        ? "palm_r_socket"
        : "grip_r_socket";
  }
}

function resolveSecondaryGripHand(
  primaryHand: MetaverseHeldObjectSolverHandId
): MetaverseHeldObjectSolverHandId {
  return primaryHand === "right" ? "left" : "right";
}

function resolveSecondaryCharacterSocketRole(
  secondaryHand: MetaverseHeldObjectSolverHandId,
  offHandTargetKind: MetaverseAttachmentProofRuntime["offHandTargetKind"]
): ActiveGripAssignment["secondaryCharacterSocketRole"] {
  switch (offHandTargetKind) {
    case "none":
      return null;
    case "support-palm-hint":
      return secondaryHand === "right" ? "palm_r_socket" : "palm_l_socket";
    case "secondary-grip":
      return secondaryHand === "right"
        ? "support_r_socket"
        : "support_l_socket";
  }
}

export function resolveActiveGripAssignment(
  attachmentRuntime: Pick<
    MetaverseAttachmentProofRuntime,
    "heldMount" | "holdProfile" | "offHandGripMount" | "offHandTargetKind"
  >,
  solverProfile: MetaverseHeldObjectSolverProfile =
    resolveMetaverseHeldObjectSolverProfile(attachmentRuntime.holdProfile)
): ActiveGripAssignment {
  const primaryHand = resolvePrimaryGripHand(attachmentRuntime, solverProfile);

  if (
    attachmentRuntime.offHandGripMount === null ||
    attachmentRuntime.offHandTargetKind === "none"
  ) {
    return {
      primaryCharacterSocketRole: resolvePrimaryCharacterSocketRole(
        primaryHand,
        attachmentRuntime
      ),
      primaryHand,
      secondaryCharacterSocketRole: null,
      secondaryHand: null
    };
  }

  const secondaryHand = resolveSecondaryGripHand(primaryHand);

  return {
    primaryCharacterSocketRole: resolvePrimaryCharacterSocketRole(
      primaryHand,
      attachmentRuntime
    ),
    primaryHand,
    secondaryCharacterSocketRole: resolveSecondaryCharacterSocketRole(
      secondaryHand,
      attachmentRuntime.offHandTargetKind
    ),
    secondaryHand
  };
}

function assertCurrentHeldObjectSolverHandSupport(
  gripAssignment: ActiveGripAssignment
): void {
  if (gripAssignment.primaryHand !== "right") {
    throw new Error(
      `Metaverse held-object solver currently supports right primary hand only, not ${gripAssignment.primaryHand}.`
    );
  }

  if (
    gripAssignment.secondaryHand !== null &&
    gripAssignment.secondaryHand !== "left"
  ) {
    throw new Error(
      `Metaverse held-object solver currently supports left secondary hand only, not ${gripAssignment.secondaryHand}.`
    );
  }
}

export function syncHumanoidV2HeldWeaponPose<
  TCharacterRuntime extends {
    readonly anchorGroup: Group;
    readonly firstPersonHeadAnchorNodes: readonly Object3D[];
  }
>(
  characterProofRuntime: TCharacterRuntime,
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  aimState: HeldObjectAimState,
  _weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null = null,
  bodyPresentation:
    | Pick<
        MetaverseRuntimeConfig["bodyPresentation"],
        | "groundedFirstPersonHeadClearanceMeters"
        | "groundedFirstPersonHeadOcclusionRadiusMeters"
      >
    | null = null
): void {
  const solverProfile =
    resolveMetaverseHeldObjectSolverProfile(attachmentRuntime.holdProfile);
  const gripAssignment = resolveActiveGripAssignment(
    attachmentRuntime,
    solverProfile
  );

  assertCurrentHeldObjectSolverHandSupport(gripAssignment);
  restoreHumanoidV2HeldWeaponSolveBaseline(
    heldWeaponPoseRuntime,
    solverProfile,
    gripAssignment
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);

  const gripTargetResolved = resolveHeldWeaponGripAimTarget(
    heldWeaponPoseRuntime,
    characterProofRuntime.firstPersonHeadAnchorNodes,
    attachmentRuntime,
    solverProfile,
    aimState,
    bodyPresentation,
    heldWeaponGripSocketWorldPositionScratch,
    heldWeaponTargetWorldQuaternionScratch
  );

  if (!gripTargetResolved) {
    return;
  }

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
  const mainHandContactFrameRuntime = resolveHeldWeaponMainHandContactFrameRuntime(
    heldWeaponPoseRuntime,
    gripAssignment,
    solverProfile
  );
  const mainHandEffectorNode = mainHandContactFrameRuntime.node;

  resolveRightHandWorldTargetPosition(
    heldWeaponPoseRuntime,
    mainHandEffectorNode,
    heldWeaponGripSocketWorldPositionScratch,
    heldWeaponTargetWorldQuaternionScratch,
    heldWeaponRightHandTargetWorldPositionScratch
  );
  solveTwoBoneChainToWorldTarget(
    heldWeaponPoseRuntime.rightUpperarmBone,
    heldWeaponPoseRuntime.rightLowerarmBone,
    heldWeaponPoseRuntime.rightHandBone,
    heldWeaponRightHandTargetWorldPositionScratch,
    heldWeaponRightElbowPoleTargetScratch,
    heldWeaponRightArmReachSlackMeters
  );
  applyElbowPoleBias(
    heldWeaponPoseRuntime.rightUpperarmBone,
    heldWeaponPoseRuntime.rightLowerarmBone,
    heldWeaponPoseRuntime.rightHandBone,
    heldWeaponRightElbowPoleTargetScratch,
    heldWeaponElbowPoleBiasWeight
  );
  alignBoneTowardEffectorWorldQuaternion(
    heldWeaponPoseRuntime.rightHandBone,
    mainHandEffectorNode,
    heldWeaponTargetWorldQuaternionScratch
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
  applyHeldObjectFingerPose(
    heldWeaponPoseRuntime,
    heldWeaponPoseRuntime.fingerChainsByHand[gripAssignment.primaryHand],
    solverProfile.fingerPose.primary
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
  syncRightTriggerFingerPose(
    heldWeaponPoseRuntime,
    mainHandEffectorNode,
    attachmentRuntime,
    heldWeaponGripSocketWorldPositionScratch,
    heldWeaponTargetWorldQuaternionScratch
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);

  if (attachmentRuntime.offHandGripMount === null) {
    normalizeHumanoidV2HeldWeaponDrivenBoneQuaternions(heldWeaponPoseRuntime);
    characterProofRuntime.anchorGroup.updateMatrixWorld(true);
    return;
  }

  const {
    localPosition: offHandGripLocalPosition,
    localQuaternion: offHandGripLocalQuaternion
  } = attachmentRuntime.offHandGripMount;
  const offHandContactFrameRuntime =
    resolveHeldWeaponOffHandContactFrameRuntime(
      heldWeaponPoseRuntime,
      gripAssignment,
      solverProfile
    );
  const offHandEffectorNode =
    offHandContactFrameRuntime?.node ??
    resolveHeldWeaponOffHandEffectorNode(
      heldWeaponPoseRuntime,
      gripAssignment
    );
  attachmentRuntime.attachmentRoot.localToWorld(
    heldWeaponGripSocketWorldPositionScratch.copy(offHandGripLocalPosition)
  );
  const useSupportPalmHintPose = shouldUseSupportPalmHintPose(attachmentRuntime);
  const supportPalmFade = useSupportPalmHintPose
    ? resolveSupportPalmFade(solverProfile, aimState)
    : 1;
  const supportPalmHintActive =
    useSupportPalmHintPose &&
    supportPalmFade > heldWeaponSolveDirectionEpsilon;

  if (useSupportPalmHintPose && supportPalmFade < 1) {
    offHandEffectorNode.getWorldPosition(
      heldWeaponSupportPalmFadeStartWorldPositionScratch
    );
    heldWeaponGripSocketWorldPositionScratch.lerpVectors(
      heldWeaponSupportPalmFadeStartWorldPositionScratch,
      heldWeaponGripSocketWorldPositionScratch,
      supportPalmFade
    );
  }
  heldWeaponSupportHandTargetWorldQuaternionScratch
    .copy(
      attachmentRuntime.attachmentRoot.getWorldQuaternion(
        heldWeaponAttachmentWorldQuaternionScratch
      )
    )
    .multiply(offHandGripLocalQuaternion)
    .normalize();
  resolveHandWorldTargetPosition(
    heldWeaponSupportHandTargetWorldQuaternionScratch,
    resolveHandEffectorLocalPosition(
      heldWeaponPoseRuntime.leftHandBone,
      offHandEffectorNode,
      heldWeaponHandEffectorLocalPositionScratch
    ),
    heldWeaponGripSocketWorldPositionScratch,
    heldWeaponLeftHandTargetWorldPositionScratch
  );
  solveTwoBoneChainToWorldTarget(
      heldWeaponPoseRuntime.leftUpperarmBone,
      heldWeaponPoseRuntime.leftLowerarmBone,
      heldWeaponPoseRuntime.leftHandBone,
      heldWeaponLeftHandTargetWorldPositionScratch,
      heldWeaponLeftElbowPoleTargetScratch,
      useSupportPalmHintPose
        ? heldWeaponSupportPalmHintLeftArmReachSlackMeters
        : heldWeaponLeftArmReachSlackMeters
    );
  applyElbowPoleBias(
    heldWeaponPoseRuntime.leftUpperarmBone,
    heldWeaponPoseRuntime.leftLowerarmBone,
    heldWeaponPoseRuntime.leftHandBone,
    heldWeaponLeftElbowPoleTargetScratch,
    heldWeaponElbowPoleBiasWeight
  );
  alignOffHandBoneTowardHeldWeaponTarget(
    heldWeaponPoseRuntime,
    offHandEffectorNode,
    heldWeaponSupportHandTargetWorldQuaternionScratch,
    useSupportPalmHintPose,
    supportPalmHintActive
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
  if (
    gripAssignment.secondaryHand !== null &&
    solverProfile.fingerPose.secondary !== null &&
    (!useSupportPalmHintPose || supportPalmHintActive)
  ) {
    applyHeldObjectFingerPose(
      heldWeaponPoseRuntime,
      heldWeaponPoseRuntime.fingerChainsByHand[gripAssignment.secondaryHand],
      solverProfile.fingerPose.secondary
    );
    characterProofRuntime.anchorGroup.updateMatrixWorld(true);
  }

  if (
    attachmentRuntime.offHandGripAnchorNode !== null ||
    supportPalmHintActive
  ) {
    // Re-solve after the first pass so the palm stays centered on the authored
    // off-hand grip target instead of drifting when the arm settles.
    for (
      let refinementPass = 0;
      refinementPass < heldWeaponSecondaryGripRefinementPassCount;
      refinementPass += 1
    ) {
      heldWeaponTargetDirectionScratch
        .copy(heldWeaponGripSocketWorldPositionScratch)
        .sub(
          offHandEffectorNode.getWorldPosition(
            heldWeaponEffectorWorldPositionScratch
          )
        );

      if (
        heldWeaponTargetDirectionScratch.lengthSq() <=
        heldWeaponSolveDirectionEpsilon
      ) {
        break;
      }

      heldWeaponLeftHandTargetWorldPositionScratch.add(
        heldWeaponTargetDirectionScratch
      );
      solveTwoBoneChainToWorldTarget(
        heldWeaponPoseRuntime.leftUpperarmBone,
        heldWeaponPoseRuntime.leftLowerarmBone,
        heldWeaponPoseRuntime.leftHandBone,
        heldWeaponLeftHandTargetWorldPositionScratch,
        heldWeaponLeftElbowPoleTargetScratch,
        useSupportPalmHintPose
          ? heldWeaponSupportPalmHintLeftArmReachSlackMeters
          : heldWeaponLeftArmReachSlackMeters
      );
      applyElbowPoleBias(
        heldWeaponPoseRuntime.leftUpperarmBone,
        heldWeaponPoseRuntime.leftLowerarmBone,
        heldWeaponPoseRuntime.leftHandBone,
        heldWeaponLeftElbowPoleTargetScratch,
        heldWeaponElbowPoleBiasWeight
      );
      alignOffHandBoneTowardHeldWeaponTarget(
        heldWeaponPoseRuntime,
        offHandEffectorNode,
        heldWeaponSupportHandTargetWorldQuaternionScratch,
        useSupportPalmHintPose,
        supportPalmHintActive
      );
      characterProofRuntime.anchorGroup.updateMatrixWorld(true);
    }
  }
  syncLeftSupportGripFingerPose(
    heldWeaponPoseRuntime,
    offHandEffectorNode,
    attachmentRuntime
  );
  normalizeHumanoidV2HeldWeaponDrivenBoneQuaternions(heldWeaponPoseRuntime);
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
}
