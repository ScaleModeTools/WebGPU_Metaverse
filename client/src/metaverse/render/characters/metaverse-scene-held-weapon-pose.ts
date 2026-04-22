import {
  Bone,
  Group,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3
} from "three/webgpu";

import { isHumanoidV2PistolAimOverlayTrack } from "../humanoid-v2-rig";

import type { MetaverseAttachmentProofRuntime } from "../attachments/metaverse-scene-attachment-runtime";

import type { MetaverseCameraSnapshot } from "../../types/metaverse-runtime";

export interface HumanoidV2HeldWeaponPoseRuntime {
  readonly drivenBones: readonly {
    readonly authoredLocalQuaternion: Quaternion;
    readonly bone: Bone;
    readonly restoreSource: "authored" | "sampled";
    readonly sampledLocalQuaternion: Quaternion;
  }[];
  readonly leftClavicleBone: Bone;
  readonly leftGripSocketNode: Object3D;
  readonly leftHandBone: Bone;
  readonly leftLowerarmBone: Bone;
  readonly leftUpperarmBone: Bone;
  readonly rightClavicleBone: Bone;
  readonly rightHandBone: Bone;
  readonly rightGripSocketNode: Object3D;
  readonly rightLowerarmBone: Bone;
  readonly rightTriggerContactNode: Object3D;
  readonly rightUpperarmBone: Bone;
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
const heldWeaponChestForwardMeters = 0.42;
const heldWeaponLeftArmReachSlackMeters = 0.001;
const heldWeaponRightArmReachSlackMeters = 0.045;
const heldWeaponSampledRestoreBoneNames = Object.freeze([
  "clavicle_l",
  "upperarm_l",
  "lowerarm_l",
  "hand_l",
  "clavicle_r",
  "upperarm_r",
  "lowerarm_r",
  "hand_r"
] as const);
export const heldWeaponSolveDirectionEpsilon = 0.000001;
const heldWeaponClampedHandTargetWorldPositionScratch = new Vector3();
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
const heldWeaponImplicitOffHandTargetWorldQuaternionScratch = new Quaternion();
const heldWeaponAttachmentWorldQuaternionScratch = new Quaternion();
const heldWeaponAttachmentWorldQuaternionInverseScratch = new Quaternion();
const heldWeaponGripLocalAimQuaternionScratch = new Quaternion();
const heldWeaponTargetWorldQuaternionScratch = new Quaternion();
const heldWeaponCurrentWorldQuaternionScratch = new Quaternion();
const heldWeaponWorldDeltaQuaternionScratch = new Quaternion();
const heldWeaponParentLocalDeltaQuaternionScratch = new Quaternion();
const heldWeaponGripAlignmentMatrixScratch = new Matrix4();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveRequiredHumanoidV2TriggerContactNode(characterScene: Group): Object3D {
  const triggerContactNode =
    characterScene.getObjectByName("index_03_r") ??
    characterScene.getObjectByName("index_02_r") ??
    characterScene.getObjectByName("index_01_r");

  if (triggerContactNode === undefined) {
    throw new Error(
      "Metaverse humanoid_v2 held weapon pose requires an authored right index trigger-contact bone."
    );
  }

  return triggerContactNode;
}

function resolveHumanoidV2HeldWeaponDrivenBoneRestoreSource(
  boneName: string
): "authored" | "sampled" {
  return (
    isHumanoidV2PistolAimOverlayTrack(`${boneName}.quaternion`) &&
    heldWeaponSampledRestoreBoneNames.includes(
      boneName as (typeof heldWeaponSampledRestoreBoneNames)[number]
    )
  )
    ? "sampled"
    : "authored";
}

function ensureImplicitOffHandGripLocalTransform(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  attachmentRuntime: MetaverseAttachmentProofRuntime
): boolean {
  if (
    attachmentRuntime.implicitOffHandGripLocalPosition !== null &&
    attachmentRuntime.implicitOffHandGripLocalQuaternion !== null
  ) {
    return true;
  }

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

  return (
    attachmentRuntime.implicitOffHandGripLocalPosition !== null &&
    attachmentRuntime.implicitOffHandGripLocalQuaternion !== null
  );
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
  const drivenBones = [
    leftClavicleBone,
    leftUpperarmBone,
    leftLowerarmBone,
    leftHandBone,
    rightClavicleBone,
    rightUpperarmBone,
    rightLowerarmBone,
    rightHandBone
  ] as const;

  return {
    drivenBones: drivenBones.map((bone) => ({
      authoredLocalQuaternion: bone.quaternion.clone(),
      bone,
      restoreSource: resolveHumanoidV2HeldWeaponDrivenBoneRestoreSource(
        bone.name
      ),
      sampledLocalQuaternion: bone.quaternion.clone()
    })),
    leftClavicleBone,
    leftGripSocketNode: nodeResolvers.findSocketNode(characterScene, "grip_l_socket"),
    leftHandBone,
    leftLowerarmBone,
    leftUpperarmBone,
    rightClavicleBone,
    rightHandBone,
    rightGripSocketNode: nodeResolvers.findSocketNode(characterScene, "grip_r_socket"),
    rightLowerarmBone,
    rightTriggerContactNode: resolveRequiredHumanoidV2TriggerContactNode(
      characterScene
    ),
    rightUpperarmBone
  };
}

export function createHeldWeaponPoseRuntime(
  characterScene: Group,
  nodeResolvers: MetaverseHeldWeaponPoseRuntimeNodeResolvers
): HumanoidV2HeldWeaponPoseRuntime {
  return createHumanoidV2HeldWeaponPoseRuntime(characterScene, nodeResolvers);
}

export function captureHumanoidV2HeldWeaponPoseRuntime(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  attachmentRuntime: MetaverseAttachmentProofRuntime | null = null
): void {
  for (const drivenBone of heldWeaponPoseRuntime.drivenBones) {
    if (drivenBone.restoreSource !== "sampled") {
      continue;
    }

    drivenBone.sampledLocalQuaternion.copy(drivenBone.bone.quaternion);
  }

  if (attachmentRuntime === null) {
    return;
  }

  if (
    attachmentRuntime.implicitOffHandGripLocalPosition !== null &&
    attachmentRuntime.implicitOffHandGripLocalQuaternion !== null
  ) {
    return;
  }

  attachmentRuntime.attachmentRoot.updateMatrixWorld(true);
  heldWeaponPoseRuntime.leftGripSocketNode.updateMatrixWorld(true);
  (
    attachmentRuntime.implicitOffHandGripLocalPosition ??=
      new Vector3()
  ).copy(
    attachmentRuntime.attachmentRoot.worldToLocal(
      heldWeaponPoseRuntime.leftGripSocketNode.getWorldPosition(
        heldWeaponGripSocketWorldPositionScratch
      )
    )
  );
  (
    attachmentRuntime.implicitOffHandGripLocalQuaternion ??=
      new Quaternion()
  )
    .copy(
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
    )
    .normalize();
}

export function restoreHumanoidV2HeldWeaponPoseRuntime(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime
): void {
  for (const drivenBone of heldWeaponPoseRuntime.drivenBones) {
    drivenBone.bone.quaternion.copy(
      drivenBone.restoreSource === "sampled"
        ? drivenBone.sampledLocalQuaternion
        : drivenBone.authoredLocalQuaternion
    );
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

function resolveAttachmentNodeWorldPositionFromGripTarget(
  heldGripSocketNode: Object3D,
  attachmentNode: Object3D,
  gripTargetWorldPosition: Vector3,
  gripTargetWorldQuaternion: Quaternion,
  outputWorldPosition: Vector3
): Vector3 {
  const gripToAttachmentLocalPosition = heldGripSocketNode.worldToLocal(
    outputWorldPosition.copy(
      attachmentNode.getWorldPosition(heldWeaponEffectorWorldPositionScratch)
    )
  );

  return outputWorldPosition
    .copy(gripTargetWorldPosition)
    .add(
      heldWeaponSocketLocalOffsetScratch
        .copy(gripToAttachmentLocalPosition)
        .applyQuaternion(gripTargetWorldQuaternion)
    );
}

function resolveHeldWeaponGripAimTarget(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  cameraSnapshot: MetaverseCameraSnapshot,
  outputGripWorldPosition: Vector3,
  outputGripWorldQuaternion: Quaternion
): boolean {
  heldWeaponLookDirectionScratch.set(
    cameraSnapshot.lookDirection.x,
    cameraSnapshot.lookDirection.y,
    cameraSnapshot.lookDirection.z
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
  outputGripWorldPosition.copy(
    heldWeaponPoseRuntime.rightClavicleBone.getWorldPosition(
      outputGripWorldPosition
    )
  );
  outputGripWorldPosition.addScaledVector(
    heldWeaponLookDirectionScratch,
    heldWeaponChestForwardMeters
  );

  return true;
}

function resolveRightHandWorldTargetPosition(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  gripTargetWorldPosition: Vector3,
  handTargetWorldQuaternion: Quaternion,
  outputHandWorldPosition: Vector3
): void {
  const handEffectorLocalPosition = resolveHandEffectorLocalPosition(
    heldWeaponPoseRuntime.rightHandBone,
    heldWeaponPoseRuntime.rightGripSocketNode,
    heldWeaponHandEffectorLocalPositionScratch
  );

  resolveHandWorldTargetPosition(
    handTargetWorldQuaternion,
    handEffectorLocalPosition,
    gripTargetWorldPosition,
    outputHandWorldPosition
  );
}

function solveTwoBoneArmToHandWorldTarget(
  upperarmBone: Bone,
  lowerarmBone: Bone,
  handBone: Bone,
  handWorldTargetPosition: Vector3,
  poleWorldDirection: Vector3,
  reachSlackMeters: number
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

export function syncHumanoidV2HeldWeaponPose<
  TCharacterRuntime extends {
    readonly anchorGroup: Group;
  }
>(
  characterProofRuntime: TCharacterRuntime,
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  cameraSnapshot: MetaverseCameraSnapshot
): void {
  if (
    !resolveHeldWeaponGripAimTarget(
      heldWeaponPoseRuntime,
      attachmentRuntime,
      cameraSnapshot,
      heldWeaponGripSocketWorldPositionScratch,
      heldWeaponTargetWorldQuaternionScratch
    )
  ) {
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
  resolveRightHandWorldTargetPosition(
    heldWeaponPoseRuntime,
    heldWeaponGripSocketWorldPositionScratch,
    heldWeaponTargetWorldQuaternionScratch,
    heldWeaponRightHandTargetWorldPositionScratch
  );
  solveTwoBoneArmToHandWorldTarget(
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
    heldWeaponPoseRuntime.rightGripSocketNode,
    heldWeaponTargetWorldQuaternionScratch
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);

  if (
    !ensureImplicitOffHandGripLocalTransform(
      heldWeaponPoseRuntime,
      attachmentRuntime
    )
  ) {
    return;
  }

  const implicitOffHandGripLocalPosition =
    attachmentRuntime.implicitOffHandGripLocalPosition!;
  const implicitOffHandGripLocalQuaternion =
    attachmentRuntime.implicitOffHandGripLocalQuaternion!;

  if (attachmentRuntime.offHandSupportNode !== null) {
    attachmentRuntime.offHandSupportNode.getWorldPosition(
      heldWeaponGripSocketWorldPositionScratch
    );
    heldWeaponSupportHandTargetWorldQuaternionScratch.copy(
      attachmentRuntime.offHandSupportNode.getWorldQuaternion(
        heldWeaponAttachmentWorldQuaternionScratch
      )
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
  resolveHandWorldTargetPosition(
    heldWeaponSupportHandTargetWorldQuaternionScratch,
    resolveHandEffectorLocalPosition(
      heldWeaponPoseRuntime.leftHandBone,
      heldWeaponPoseRuntime.leftGripSocketNode,
      heldWeaponHandEffectorLocalPositionScratch
    ),
    heldWeaponGripSocketWorldPositionScratch,
    heldWeaponLeftHandTargetWorldPositionScratch
  );
  solveTwoBoneArmToHandWorldTarget(
    heldWeaponPoseRuntime.leftUpperarmBone,
    heldWeaponPoseRuntime.leftLowerarmBone,
    heldWeaponPoseRuntime.leftHandBone,
    heldWeaponLeftHandTargetWorldPositionScratch,
    heldWeaponLeftElbowPoleTargetScratch,
    heldWeaponLeftArmReachSlackMeters
  );
  applyElbowPoleBias(
    heldWeaponPoseRuntime.leftUpperarmBone,
    heldWeaponPoseRuntime.leftLowerarmBone,
    heldWeaponPoseRuntime.leftHandBone,
    heldWeaponLeftElbowPoleTargetScratch,
    heldWeaponElbowPoleBiasWeight
  );
  alignBoneTowardEffectorWorldQuaternion(
    heldWeaponPoseRuntime.leftHandBone,
    heldWeaponPoseRuntime.leftGripSocketNode,
    heldWeaponSupportHandTargetWorldQuaternionScratch
  );
  characterProofRuntime.anchorGroup.updateMatrixWorld(true);
}
