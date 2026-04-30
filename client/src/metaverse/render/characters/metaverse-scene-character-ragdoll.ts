import {
  Bone,
  Group,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3
} from "three/webgpu";
import {
  humanoidV2BoneParentByName,
  type HumanoidV2BoneName
} from "@/assets/types/asset-socket";
import type {
  PhysicsQuaternionSnapshot,
  PhysicsVector3Snapshot,
  RapierColliderHandle,
  RapierImpulseJointHandle,
  RapierRigidBodyHandle
} from "@/physics";

import type { MetaverseCombatPresentationEvent } from "../../types/metaverse-runtime";

const ragdollSegmentDirectionEpsilon = 0.000001;
const ragdollDefaultLinearDamping = 0.72;
const ragdollDefaultAngularDamping = 1.16;
const ragdollDeathLinearImpulseMetersPerSecond = 2.35;
const ragdollDeathLiftMetersPerSecond = 0.72;
const ragdollDeathSpinRadiansPerSecond = 1.85;
const ragdollWorldUp = Object.freeze({ x: 0, y: 1, z: 0 });
const ragdollFallbackForward = Object.freeze({ x: 0, y: 0, z: -1 });

interface MetaverseCharacterRagdollBodyDescriptor {
  readonly boneName: HumanoidV2BoneName;
  readonly endBoneName: HumanoidV2BoneName;
  readonly mass: number;
  readonly radiusMeters: number;
}

interface MetaverseCharacterRagdollBodyRuntime {
  readonly body: RapierRigidBodyHandle;
  readonly bone: Bone;
  readonly bodyToBoneWorldMatrix: Matrix4;
  readonly descriptor: MetaverseCharacterRagdollBodyDescriptor;
  readonly initialPosition: Vector3;
  readonly initialQuaternion: Quaternion;
  readonly localScale: Vector3;
}

interface MetaverseCharacterRagdollBonePose {
  readonly bone: Bone;
  readonly localPosition: Vector3;
  readonly localQuaternion: Quaternion;
  readonly localScale: Vector3;
}

export interface MetaverseCharacterRagdollPhysicsRuntimeLike {
  readonly isInitialized: boolean;
  createDynamicCuboidBody(
    halfExtents: PhysicsVector3Snapshot,
    translation: PhysicsVector3Snapshot,
    options?: {
      readonly additionalMass?: number;
      readonly angularDamping?: number;
      readonly gravityScale?: number;
      readonly linearDamping?: number;
      readonly rotation?: PhysicsQuaternionSnapshot;
    }
  ): {
    readonly body: RapierRigidBodyHandle;
    readonly collider: RapierColliderHandle;
  };
  createSphericalImpulseJoint(
    parentBody: RapierRigidBodyHandle,
    childBody: RapierRigidBodyHandle,
    parentAnchor: PhysicsVector3Snapshot,
    childAnchor: PhysicsVector3Snapshot
  ): RapierImpulseJointHandle;
  createVector3(x: number, y: number, z: number): PhysicsVector3Snapshot;
  removeImpulseJoint(joint: RapierImpulseJointHandle): void;
  removeRigidBody(body: RapierRigidBodyHandle): void;
}

const metaverseCharacterRagdollBodyDescriptors = Object.freeze([
  {
    boneName: "pelvis",
    endBoneName: "spine_01",
    mass: 8.5,
    radiusMeters: 0.155
  },
  {
    boneName: "spine_01",
    endBoneName: "spine_02",
    mass: 5.4,
    radiusMeters: 0.14
  },
  {
    boneName: "spine_02",
    endBoneName: "spine_03",
    mass: 5.8,
    radiusMeters: 0.145
  },
  {
    boneName: "spine_03",
    endBoneName: "neck_01",
    mass: 6.4,
    radiusMeters: 0.15
  },
  {
    boneName: "head",
    endBoneName: "head_leaf",
    mass: 4.2,
    radiusMeters: 0.115
  },
  {
    boneName: "upperarm_l",
    endBoneName: "lowerarm_l",
    mass: 2.15,
    radiusMeters: 0.055
  },
  {
    boneName: "lowerarm_l",
    endBoneName: "hand_l",
    mass: 1.55,
    radiusMeters: 0.045
  },
  {
    boneName: "hand_l",
    endBoneName: "middle_01_l",
    mass: 0.78,
    radiusMeters: 0.04
  },
  {
    boneName: "upperarm_r",
    endBoneName: "lowerarm_r",
    mass: 2.15,
    radiusMeters: 0.055
  },
  {
    boneName: "lowerarm_r",
    endBoneName: "hand_r",
    mass: 1.55,
    radiusMeters: 0.045
  },
  {
    boneName: "hand_r",
    endBoneName: "middle_01_r",
    mass: 0.78,
    radiusMeters: 0.04
  },
  {
    boneName: "thigh_l",
    endBoneName: "calf_l",
    mass: 4.4,
    radiusMeters: 0.075
  },
  {
    boneName: "calf_l",
    endBoneName: "foot_l",
    mass: 3.05,
    radiusMeters: 0.062
  },
  {
    boneName: "foot_l",
    endBoneName: "ball_l",
    mass: 1.15,
    radiusMeters: 0.052
  },
  {
    boneName: "thigh_r",
    endBoneName: "calf_r",
    mass: 4.4,
    radiusMeters: 0.075
  },
  {
    boneName: "calf_r",
    endBoneName: "foot_r",
    mass: 3.05,
    radiusMeters: 0.062
  },
  {
    boneName: "foot_r",
    endBoneName: "ball_r",
    mass: 1.15,
    radiusMeters: 0.052
  }
] as const satisfies readonly MetaverseCharacterRagdollBodyDescriptor[]);

function isBoneNode(node: Object3D): node is Bone {
  return "isBone" in node && node.isBone === true;
}

function findRagdollBone(
  characterScene: Group,
  boneName: HumanoidV2BoneName
): Bone | null {
  let foundBone: Bone | null = null;

  characterScene.traverse((node) => {
    if (foundBone !== null || node.name !== boneName || !isBoneNode(node)) {
      return;
    }

    foundBone = node;
  });

  return foundBone;
}

function resolveFallbackDirection(sequence: number): {
  readonly x: number;
  readonly z: number;
} {
  const angle = sequence * 2.399963229728653;

  return Object.freeze({
    x: Math.sin(angle),
    z: -Math.cos(angle)
  });
}

function resolveDeathFallAwayDirection(
  event: MetaverseCombatPresentationEvent
): {
  readonly x: number;
  readonly z: number;
} {
  const sourceDirection = event.damageSourceDirectionWorld ?? null;
  const sourceLength =
    sourceDirection === null
      ? 0
      : Math.hypot(sourceDirection.x, sourceDirection.z);

  if (sourceDirection !== null && sourceLength > ragdollSegmentDirectionEpsilon) {
    return Object.freeze({
      x: -sourceDirection.x / sourceLength,
      z: -sourceDirection.z / sourceLength
    });
  }

  const fallbackDirection = resolveFallbackDirection(event.sequence);

  return Object.freeze({
    x: -fallbackDirection.x,
    z: -fallbackDirection.z
  });
}

function resolveSegmentQuaternion(
  startWorld: Vector3,
  endWorld: Vector3,
  target: Quaternion
): number {
  const segment = endWorld.clone().sub(startWorld);
  const segmentLength = segment.length();

  if (segmentLength <= ragdollSegmentDirectionEpsilon) {
    target.identity();
    return 0;
  }

  target.setFromUnitVectors(
    new Vector3(ragdollWorldUp.x, ragdollWorldUp.y, ragdollWorldUp.z),
    segment.multiplyScalar(1 / segmentLength)
  );

  return segmentLength;
}

function toQuaternionSnapshot(
  quaternion: Quaternion
): PhysicsQuaternionSnapshot {
  return Object.freeze({
    x: quaternion.x,
    y: quaternion.y,
    z: quaternion.z,
    w: quaternion.w
  });
}

function toVector3Snapshot(vector: Vector3): PhysicsVector3Snapshot {
  return Object.freeze({
    x: vector.x,
    y: vector.y,
    z: vector.z
  });
}

function setVectorFromSnapshot(
  target: Vector3,
  snapshot: PhysicsVector3Snapshot
): Vector3 {
  return target.set(snapshot.x, snapshot.y, snapshot.z);
}

function setQuaternionFromSnapshot(
  target: Quaternion,
  snapshot: PhysicsQuaternionSnapshot
): Quaternion {
  return target
    .set(snapshot.x, snapshot.y, snapshot.z, snapshot.w)
    .normalize();
}

function resolveRagdollCuboidHalfExtents(
  descriptor: MetaverseCharacterRagdollBodyDescriptor,
  segmentLengthMeters: number
): PhysicsVector3Snapshot {
  const halfLengthMeters = Math.max(0.02, segmentLengthMeters * 0.5);
  const halfWidthMeters = Math.max(0.025, descriptor.radiusMeters);
  const halfDepthMeters = Math.max(0.02, descriptor.radiusMeters * 0.82);

  return Object.freeze({
    x: halfWidthMeters,
    y: halfLengthMeters,
    z: halfDepthMeters
  });
}

function resolveRigidBodyLocalPoint(
  body: MetaverseCharacterRagdollBodyRuntime,
  worldPoint: Vector3
): PhysicsVector3Snapshot {
  const localPoint = worldPoint
    .clone()
    .sub(body.initialPosition)
    .applyQuaternion(body.initialQuaternion.clone().invert());

  return toVector3Snapshot(localPoint);
}

function resolveNearestParentRagdollBody(
  body: MetaverseCharacterRagdollBodyRuntime,
  bodiesByBoneName: ReadonlyMap<
    HumanoidV2BoneName,
    MetaverseCharacterRagdollBodyRuntime
  >
): MetaverseCharacterRagdollBodyRuntime | null {
  let parentBoneName = humanoidV2BoneParentByName[body.descriptor.boneName];

  while (parentBoneName !== null) {
    const parentBody = bodiesByBoneName.get(parentBoneName);

    if (parentBody !== undefined) {
      return parentBody;
    }

    parentBoneName = humanoidV2BoneParentByName[parentBoneName];
  }

  return null;
}

export class MetaverseCharacterRapierRagdollRuntime {
  readonly #bodyWorldMatrixScratch = new Matrix4();
  readonly #characterScene: Group;
  readonly #identityScale = new Vector3(1, 1, 1);
  readonly #localMatrixScratch = new Matrix4();
  readonly #parentWorldInverseScratch = new Matrix4();
  readonly #physicsRuntime: MetaverseCharacterRagdollPhysicsRuntimeLike;
  readonly #quaternionScratch = new Quaternion();
  readonly #targetWorldMatrixScratch = new Matrix4();
  readonly #vectorScratch = new Vector3();

  #activeSequence = -1;
  #bodies: readonly MetaverseCharacterRagdollBodyRuntime[] = Object.freeze([]);
  #joints: readonly RapierImpulseJointHandle[] = Object.freeze([]);
  #lastEvent: MetaverseCombatPresentationEvent | null = null;
  #restoreBonePoses: readonly MetaverseCharacterRagdollBonePose[] =
    Object.freeze([]);

  constructor(dependencies: {
    readonly characterScene: Group;
    readonly physicsRuntime: MetaverseCharacterRagdollPhysicsRuntimeLike;
  }) {
    this.#characterScene = dependencies.characterScene;
    this.#physicsRuntime = dependencies.physicsRuntime;
  }

  get isActive(): boolean {
    return this.#activeSequence >= 0;
  }

  clear(): void {
    for (const joint of this.#joints) {
      this.#physicsRuntime.removeImpulseJoint(joint);
    }

    for (const body of this.#bodies) {
      this.#physicsRuntime.removeRigidBody(body.body);
    }

    this.#restoreSkeletonPose();
    this.#activeSequence = -1;
    this.#bodies = Object.freeze([]);
    this.#joints = Object.freeze([]);
    this.#lastEvent = null;
    this.#restoreBonePoses = Object.freeze([]);
  }

  trigger(event: MetaverseCombatPresentationEvent): void {
    if (event.sequence < this.#activeSequence) {
      return;
    }

    this.clear();
    this.#activeSequence = event.sequence;
    this.#lastEvent = event;
    this.#restoreBonePoses = this.#captureSkeletonPose();

    if (this.#physicsRuntime.isInitialized) {
      this.#spawnRagdoll(event);
    }
  }

  apply(_nowMs: number): void {
    if (!this.isActive) {
      return;
    }

    if (this.#bodies.length === 0) {
      const lastEvent = this.#lastEvent;

      if (lastEvent !== null && this.#physicsRuntime.isInitialized) {
        this.#spawnRagdoll(lastEvent);
      }

      return;
    }

    for (const body of this.#bodies) {
      const bodyPosition = setVectorFromSnapshot(
        this.#vectorScratch,
        body.body.translation()
      );
      const bodyQuaternion = setQuaternionFromSnapshot(
        this.#quaternionScratch,
        body.body.rotation()
      );

      this.#bodyWorldMatrixScratch.compose(
        bodyPosition,
        bodyQuaternion,
        this.#identityScale
      );
      this.#targetWorldMatrixScratch.multiplyMatrices(
        this.#bodyWorldMatrixScratch,
        body.bodyToBoneWorldMatrix
      );

      const parent = body.bone.parent;

      if (parent === null) {
        this.#localMatrixScratch.copy(this.#targetWorldMatrixScratch);
      } else {
        parent.updateMatrixWorld(true);
        this.#parentWorldInverseScratch.copy(parent.matrixWorld).invert();
        this.#localMatrixScratch.multiplyMatrices(
          this.#parentWorldInverseScratch,
          this.#targetWorldMatrixScratch
        );
      }

      this.#localMatrixScratch.decompose(
        body.bone.position,
        body.bone.quaternion,
        this.#vectorScratch
      );
      body.bone.scale.copy(body.localScale);
      body.bone.updateMatrixWorld(true);
    }

    this.#characterScene.updateMatrixWorld(true);
  }

  #spawnRagdoll(event: MetaverseCombatPresentationEvent): void {
    this.#characterScene.updateMatrixWorld(true);

    const bodies: MetaverseCharacterRagdollBodyRuntime[] = [];
    const bodiesByBoneName = new Map<
      HumanoidV2BoneName,
      MetaverseCharacterRagdollBodyRuntime
    >();
    const fallAwayDirection = resolveDeathFallAwayDirection(event);
    const sideSign =
      Math.abs(fallAwayDirection.x) > 0.15
        ? Math.sign(fallAwayDirection.x)
        : Math.sign(resolveFallbackDirection(event.sequence).x) || 1;

    for (const descriptor of metaverseCharacterRagdollBodyDescriptors) {
      const bone = findRagdollBone(this.#characterScene, descriptor.boneName);
      const endBone = findRagdollBone(
        this.#characterScene,
        descriptor.endBoneName
      );

      if (bone === null || endBone === null) {
        continue;
      }

      const segmentStart = bone.getWorldPosition(new Vector3());
      const segmentEnd = endBone.getWorldPosition(new Vector3());
      const segmentLength = resolveSegmentQuaternion(
        segmentStart,
        segmentEnd,
        new Quaternion()
      );

      if (segmentLength <= ragdollSegmentDirectionEpsilon) {
        continue;
      }

      const segmentQuaternion = new Quaternion();
      const usableSegmentLength = resolveSegmentQuaternion(
        segmentStart,
        segmentEnd,
        segmentQuaternion
      );
      const bodyCenter = segmentStart
        .clone()
        .add(segmentEnd)
        .multiplyScalar(0.5);
      const dynamicBody = this.#physicsRuntime.createDynamicCuboidBody(
        resolveRagdollCuboidHalfExtents(descriptor, usableSegmentLength),
        toVector3Snapshot(bodyCenter),
        {
          additionalMass: descriptor.mass,
          angularDamping: ragdollDefaultAngularDamping,
          linearDamping: ragdollDefaultLinearDamping,
          rotation: toQuaternionSnapshot(segmentQuaternion)
        }
      );
      const bodyWorldMatrix = new Matrix4().compose(
        bodyCenter,
        segmentQuaternion,
        this.#identityScale
      );
      const bodyToBoneWorldMatrix = bodyWorldMatrix
        .clone()
        .invert()
        .multiply(bone.matrixWorld);
      const ragdollBody = Object.freeze({
        body: dynamicBody.body,
        bone,
        bodyToBoneWorldMatrix,
        descriptor,
        initialPosition: bodyCenter,
        initialQuaternion: segmentQuaternion,
        localScale: bone.scale.clone()
      });

      dynamicBody.body.setLinvel(
        this.#physicsRuntime.createVector3(
          fallAwayDirection.x * ragdollDeathLinearImpulseMetersPerSecond,
          ragdollDeathLiftMetersPerSecond,
          fallAwayDirection.z * ragdollDeathLinearImpulseMetersPerSecond
        ),
        true
      );
      dynamicBody.body.setAngvel(
        this.#physicsRuntime.createVector3(
          ragdollFallbackForward.x,
          sideSign * ragdollDeathSpinRadiansPerSecond,
          ragdollFallbackForward.z
        ),
        true
      );

      bodies.push(ragdollBody);
      bodiesByBoneName.set(descriptor.boneName, ragdollBody);
    }

    const joints: RapierImpulseJointHandle[] = [];

    for (const body of bodies) {
      const parentBody = resolveNearestParentRagdollBody(body, bodiesByBoneName);

      if (parentBody === null) {
        continue;
      }

      const jointAnchorWorld = body.bone.getWorldPosition(new Vector3());

      joints.push(
        this.#physicsRuntime.createSphericalImpulseJoint(
          parentBody.body,
          body.body,
          resolveRigidBodyLocalPoint(parentBody, jointAnchorWorld),
          resolveRigidBodyLocalPoint(body, jointAnchorWorld)
        )
      );
    }

    this.#bodies = Object.freeze(bodies);
    this.#joints = Object.freeze(joints);
  }

  #captureSkeletonPose(): readonly MetaverseCharacterRagdollBonePose[] {
    const bonePoses: MetaverseCharacterRagdollBonePose[] = [];

    this.#characterScene.traverse((node) => {
      if (!isBoneNode(node)) {
        return;
      }

      bonePoses.push(
        Object.freeze({
          bone: node,
          localPosition: node.position.clone(),
          localQuaternion: node.quaternion.clone(),
          localScale: node.scale.clone()
        })
      );
    });

    return Object.freeze(bonePoses);
  }

  #restoreSkeletonPose(): void {
    for (const bonePose of this.#restoreBonePoses) {
      bonePose.bone.position.copy(bonePose.localPosition);
      bonePose.bone.quaternion.copy(bonePose.localQuaternion);
      bonePose.bone.scale.copy(bonePose.localScale);
    }

    if (this.#restoreBonePoses.length > 0) {
      this.#characterScene.updateMatrixWorld(true);
    }
  }
}
