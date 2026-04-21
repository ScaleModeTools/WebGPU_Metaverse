import {
  Bone,
  Group,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3
} from "three/webgpu";

import type { MetaverseAttachmentProofRuntime } from "../attachments/metaverse-scene-attachment-runtime";

import type { MetaverseCameraSnapshot } from "../../types/metaverse-runtime";

interface HeldWeaponSolveChainLink {
  readonly bone: Bone;
  readonly solveWeight: number;
}

export interface HumanoidV2HeldWeaponPoseRuntime {
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
  readonly rightHandBone: Bone;
  readonly rightHandSocketNode: Object3D;
  readonly rightLowerarmBone: Bone;
  readonly rightAimChain: readonly HeldWeaponSolveChainLink[];
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

const heldWeaponAimSolveIterations = 10;
const heldWeaponCoupledSolvePasses = 5;
const heldWeaponAimTargetDistanceMeters = 16;
const heldWeaponClavicleSolveWeight = 0.28;
const heldWeaponElbowPoleAcrossBias = 0.42;
const heldWeaponElbowPoleBiasWeight = 0.92;
const heldWeaponElbowPoleDownBias = 0.7;
const heldWeaponElbowPolePreferenceWeight = 1.4;
const heldWeaponForearmSolveWeight = 0.96;
const heldWeaponHandSolveWeight = 0;
export const heldWeaponSolveDirectionEpsilon = 0.000001;
const heldWeaponSupportHandPitchRadians = -0.3;
const heldWeaponSupportHandRollRadians = Math.PI * 0.38;
const heldWeaponTriggerContactSolveBias = 0.35;
const heldWeaponUpperarmSolveWeight = 0.9;
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
const heldWeaponTriggerContactLocalPositionScratch = new Vector3();
const heldWeaponTriggerContactWorldPositionScratch = new Vector3();
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
        bone: nodeResolvers.findBoneNode(
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
    leftGripSocketNode: nodeResolvers.findSocketNode(characterScene, "grip_l_socket"),
    leftHandBone,
    leftLowerarmBone,
    leftPalmSocketNode: nodeResolvers.findSocketNode(characterScene, "palm_l_socket"),
    leftSupportChain,
    leftUpperarmBone,
    rightHandBone,
    rightHandSocketNode: nodeResolvers.findSocketNode(characterScene, "hand_r_socket"),
    rightLowerarmBone,
    rightAimChain,
    rightTriggerContactNode: resolveRequiredHumanoidV2TriggerContactNode(
      characterScene
    ),
    rightUpperarmBone
  };
}

export function restoreHumanoidV2HeldWeaponPoseRuntime(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime
): void {
  for (const drivenBone of heldWeaponPoseRuntime.drivenBones) {
    drivenBone.bone.quaternion.copy(drivenBone.authoredLocalQuaternion);
  }
}

export function createHeldWeaponPoseRuntime(
  characterScene: Group,
  nodeResolvers: MetaverseHeldWeaponPoseRuntimeNodeResolvers
): HumanoidV2HeldWeaponPoseRuntime {
  return createHumanoidV2HeldWeaponPoseRuntime(characterScene, nodeResolvers);
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

function resolveRightHandWorldTargetPosition(
  heldWeaponPoseRuntime: HumanoidV2HeldWeaponPoseRuntime,
  attachmentRuntime: MetaverseAttachmentProofRuntime,
  handTargetWorldQuaternion: Quaternion,
  outputHandWorldPosition: Vector3
): void {
  const handEffectorLocalPosition = resolveHandEffectorLocalPosition(
    heldWeaponPoseRuntime.rightHandBone,
    heldWeaponPoseRuntime.rightHandSocketNode,
    heldWeaponHandEffectorLocalPositionScratch
  );

  attachmentRuntime.heldGripSocketNode.getWorldPosition(
    heldWeaponGripSocketWorldPositionScratch
  );

  if (attachmentRuntime.heldTriggerMarkerNode !== null) {
    heldWeaponGripSocketWorldPositionScratch.lerp(
      attachmentRuntime.heldTriggerMarkerNode.getWorldPosition(
        heldWeaponTriggerContactWorldPositionScratch
      ),
      heldWeaponTriggerContactSolveBias
    );
    handEffectorLocalPosition.lerp(
      resolveHandEffectorLocalPosition(
        heldWeaponPoseRuntime.rightHandBone,
        heldWeaponPoseRuntime.rightTriggerContactNode,
        heldWeaponTriggerContactLocalPositionScratch
      ),
      heldWeaponTriggerContactSolveBias
    );
  }

  resolveHandWorldTargetPosition(
    handTargetWorldQuaternion,
    handEffectorLocalPosition,
    heldWeaponGripSocketWorldPositionScratch,
    outputHandWorldPosition
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
    heldWeaponPoseRuntime.rightHandSocketNode,
    heldWeaponTargetWorldQuaternionScratch
  );
  resolveRightHandWorldTargetPosition(
    heldWeaponPoseRuntime,
    attachmentRuntime,
    heldWeaponTargetWorldQuaternionScratch,
    heldWeaponRightHandTargetWorldPositionScratch
  );
  solveTwoBoneArmToHandWorldTarget(
    heldWeaponPoseRuntime.rightUpperarmBone,
    heldWeaponPoseRuntime.rightLowerarmBone,
    heldWeaponPoseRuntime.rightHandBone,
    heldWeaponRightHandTargetWorldPositionScratch,
    heldWeaponRightElbowPoleTargetScratch
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
    heldWeaponPoseRuntime.rightHandSocketNode,
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
      heldWeaponLeftElbowPoleTargetScratch
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
      heldWeaponPoseRuntime.rightHandSocketNode,
      heldWeaponTargetWorldQuaternionScratch
    );
    resolveRightHandWorldTargetPosition(
      heldWeaponPoseRuntime,
      attachmentRuntime,
      heldWeaponTargetWorldQuaternionScratch,
      heldWeaponRightHandTargetWorldPositionScratch
    );
    solveTwoBoneArmToHandWorldTarget(
      heldWeaponPoseRuntime.rightUpperarmBone,
      heldWeaponPoseRuntime.rightLowerarmBone,
      heldWeaponPoseRuntime.rightHandBone,
      heldWeaponRightHandTargetWorldPositionScratch,
      heldWeaponRightElbowPoleTargetScratch
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
      heldWeaponPoseRuntime.rightHandSocketNode,
      heldWeaponTargetWorldQuaternionScratch
    );
    characterProofRuntime.anchorGroup.updateMatrixWorld(true);
  }
}
