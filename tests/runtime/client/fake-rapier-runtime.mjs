export class FakeRapierVector3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class FakeColliderDesc {
  constructor(shape, payload) {
    this.payload = payload;
    this.rotation = { x: 0, y: 0, z: 0, w: 1 };
    this.shape = shape;
    this.translation = new FakeRapierVector3(0, 0, 0);
  }

  setRotation(rotation) {
    this.rotation = rotation;

    return this;
  }

  setTranslation(x, y, z) {
    this.translation = new FakeRapierVector3(x, y, z);

    return this;
  }
}

class FakeRigidBodyDesc {
  constructor() {
    this.additionalMass = 0;
    this.angularDamping = 0;
    this.gravityScale = 1;
    this.linearDamping = 0;
    this.lockRotationsEnabled = false;
    this.rotation = { x: 0, y: 0, z: 0, w: 1 };
    this.translation = new FakeRapierVector3(0, 0, 0);
  }

  lockRotations() {
    this.lockRotationsEnabled = true;

    return this;
  }

  setAdditionalMass(mass) {
    this.additionalMass = mass;

    return this;
  }

  setAngularDamping(damping) {
    this.angularDamping = damping;

    return this;
  }

  setGravityScale(scale) {
    this.gravityScale = scale;

    return this;
  }

  setLinearDamping(damping) {
    this.linearDamping = damping;

    return this;
  }

  setRotation(rotation) {
    this.rotation = rotation;

    return this;
  }

  setTranslation(x, y, z) {
    this.translation = new FakeRapierVector3(x, y, z);

    return this;
  }
}

class FakeCollider {
  constructor(shape, payload, translation, rotation, parentBody = null) {
    this.parentBody = parentBody;
    this.payload = payload;
    this.rotationQuaternion = rotation;
    this.shape = shape;
    this.translationVector = translation;
  }

  get standingOffset() {
    return this.shape === "capsule"
      ? this.payload.halfHeight + this.payload.radius
      : 0;
  }

  get bottomOffset() {
    return this.shape === "capsule"
      ? this.standingOffset
      : (this.payload.halfExtentY ?? 0);
  }

  get topOffset() {
    return this.shape === "capsule"
      ? this.standingOffset
      : (this.payload.halfExtentY ?? 0);
  }

  setRotation(rotation) {
    this.rotationQuaternion = rotation;
  }

  setTranslation(translation) {
    this.translationVector = new FakeRapierVector3(
      translation.x,
      translation.y,
      translation.z
    );
  }

  translation() {
    if (this.parentBody !== null) {
      const parentTranslation = this.parentBody.translation();

      return new FakeRapierVector3(
        parentTranslation.x + this.translationVector.x,
        parentTranslation.y + this.translationVector.y,
        parentTranslation.z + this.translationVector.z
      );
    }

    return this.translationVector;
  }
}

class FakeRigidBody {
  constructor(bodyDesc) {
    this.additionalMass = bodyDesc.additionalMass;
    this.angularDamping = bodyDesc.angularDamping;
    this.gravityScale = bodyDesc.gravityScale;
    this.linearDamping = bodyDesc.linearDamping;
    this.linvelVector = new FakeRapierVector3(0, 0, 0);
    this.lockRotationsEnabled = bodyDesc.lockRotationsEnabled;
    this.rotationQuaternion = bodyDesc.rotation;
    this.translationVector = bodyDesc.translation;
  }

  linvel() {
    return this.linvelVector;
  }

  setLinvel(velocity) {
    this.linvelVector = new FakeRapierVector3(
      velocity.x,
      velocity.y,
      velocity.z
    );
  }

  setTranslation(translation) {
    this.translationVector = new FakeRapierVector3(
      translation.x,
      translation.y,
      translation.z
    );
  }

  translation() {
    return this.translationVector;
  }
}

function rotatePlanarPointByQuaternion(x, z, quaternion) {
  const tx = 2 * (quaternion.y * 0 - quaternion.z * z);
  const tz = 2 * (quaternion.x * 0 - quaternion.y * x);

  return {
    x: x + quaternion.w * tx + quaternion.y * tz,
    z: z + quaternion.w * tz - quaternion.y * tx
  };
}

class FakeCharacterController {
  constructor(world) {
    this.applyImpulsesToDynamicBodies = false;
    this.autostepEnabled = false;
    this.grounded = false;
    this.lastMovement = new FakeRapierVector3(0, 0, 0);
    this.maxSlopeClimbAngle = null;
    this.minSlopeSlideAngle = null;
    this.snapDistance = 0;
    this.stepHeight = 0;
    this.world = world;
  }

  computeColliderMovement(
    collider,
    desiredTranslationDelta,
    _filterFlags,
    _filterGroups,
    filterPredicate
  ) {
    const currentTranslation = collider.translation();
    const currentFootY = currentTranslation.y - collider.bottomOffset;
    const capsuleRadius =
      collider.payload.radius ??
      Math.max(collider.payload.halfExtentX ?? 0, collider.payload.halfExtentZ ?? 0);
    let nextCenterX = currentTranslation.x + desiredTranslationDelta.x;
    let nextCenterZ = currentTranslation.z + desiredTranslationDelta.z;
    const proposedSurfaceY = this.findSurfaceY(
      nextCenterX,
      nextCenterZ,
      capsuleRadius,
      filterPredicate
    );
    const effectiveProposedSurfaceY =
      this.snapDistance === 0 &&
      proposedSurfaceY !== null &&
      proposedSurfaceY < currentFootY
        ? null
        : proposedSurfaceY;

    if (
      effectiveProposedSurfaceY !== null &&
      effectiveProposedSurfaceY - currentFootY > this.snapDistance &&
      (!this.autostepEnabled ||
        effectiveProposedSurfaceY - currentFootY > this.stepHeight)
    ) {
      nextCenterX = currentTranslation.x;
      nextCenterZ = currentTranslation.z;
    }

    const supportingSurfaceY = this.findSurfaceY(
      nextCenterX,
      nextCenterZ,
      capsuleRadius,
      filterPredicate
    );
    const effectiveSupportingSurfaceY =
      this.snapDistance === 0 &&
      supportingSurfaceY !== null &&
      supportingSurfaceY < currentFootY
        ? null
        : supportingSurfaceY;
    const desiredFootY = currentFootY + desiredTranslationDelta.y;
    let nextFootY = desiredFootY;

    if (effectiveSupportingSurfaceY !== null) {
      if (effectiveSupportingSurfaceY > currentFootY) {
        const stepRise = effectiveSupportingSurfaceY - currentFootY;

        if (this.autostepEnabled && stepRise <= this.stepHeight) {
          nextFootY = effectiveSupportingSurfaceY;
        }
      }

      if (
        desiredTranslationDelta.y <= 0 &&
        desiredFootY <= effectiveSupportingSurfaceY + this.snapDistance
      ) {
        nextFootY = effectiveSupportingSurfaceY;
      }
    }

    const nextCenterY = nextFootY + collider.bottomOffset;
    const blockedPlanarPosition = this.resolveBlockedPlanarPosition(
      collider,
      currentTranslation,
      {
        x: nextCenterX,
        y: nextCenterY,
        z: nextCenterZ
      },
      filterPredicate
    );

    this.lastMovement = new FakeRapierVector3(
      blockedPlanarPosition.x - currentTranslation.x,
      nextCenterY - currentTranslation.y,
      blockedPlanarPosition.z - currentTranslation.z
    );
    this.grounded =
      effectiveSupportingSurfaceY !== null &&
      Math.abs(nextFootY - effectiveSupportingSurfaceY) <= 0.0001;
  }

  computedGrounded() {
    return this.grounded;
  }

  computedMovement() {
    return this.lastMovement;
  }

  enableSnapToGround(distance) {
    this.snapDistance = distance;
  }

  enableAutostep(maxHeight) {
    this.autostepEnabled = true;
    this.stepHeight = maxHeight;
  }

  disableAutostep() {
    this.autostepEnabled = false;
  }

  free() {}

  setApplyImpulsesToDynamicBodies(enabled) {
    this.applyImpulsesToDynamicBodies = enabled;
  }

  setCharacterMass() {}

  setMaxSlopeClimbAngle(angle) {
    this.maxSlopeClimbAngle = angle;
  }

  setMinSlopeSlideAngle(angle) {
    this.minSlopeSlideAngle = angle;
  }

  findSurfaceY(centerX, centerZ, capsuleRadius, filterPredicate = undefined) {
    let highestSurfaceY = null;

    for (const candidate of this.world.queryColliders) {
      if (
        candidate === undefined ||
        (filterPredicate !== undefined && !filterPredicate(candidate))
      ) {
        continue;
      }

      if (candidate.shape !== "cuboid") {
        continue;
      }

      const halfExtentX = candidate.payload.halfExtentX ?? 0;
      const halfExtentY = candidate.payload.halfExtentY ?? 0;
      const halfExtentZ = candidate.payload.halfExtentZ ?? 0;
      const candidateTranslation = candidate.translation();
      const candidateRotation = candidate.rotationQuaternion ?? {
        x: 0,
        y: 0,
        z: 0,
        w: 1
      };
      const localOffset = rotatePlanarPointByQuaternion(
        centerX - candidateTranslation.x,
        centerZ - candidateTranslation.z,
        {
          x: -candidateRotation.x,
          y: -candidateRotation.y,
          z: -candidateRotation.z,
          w: candidateRotation.w
        }
      );

      const surfaceY = candidateTranslation.y + halfExtentY;

      if (
        Math.abs(localOffset.x) > halfExtentX + capsuleRadius ||
        Math.abs(localOffset.z) > halfExtentZ + capsuleRadius
      ) {
        continue;
      }

      if (highestSurfaceY === null || surfaceY > highestSurfaceY) {
        highestSurfaceY = surfaceY;
      }
    }

    return highestSurfaceY;
  }

  resolveBlockedPlanarPosition(
    collider,
    currentTranslation,
    proposedTranslation,
    filterPredicate = undefined
  ) {
    const colliderHalfExtentX =
      collider.payload.radius ?? (collider.payload.halfExtentX ?? 0);
    const colliderHalfExtentY = collider.bottomOffset;
    const colliderHalfExtentZ =
      collider.payload.radius ?? (collider.payload.halfExtentZ ?? 0);
    const currentFootY = currentTranslation.y - colliderHalfExtentY;
    const proposedBottomY = proposedTranslation.y - colliderHalfExtentY;
    const proposedTopY = proposedTranslation.y + collider.topOffset;

    for (const candidate of this.world.queryColliders) {
      if (
        candidate === collider ||
        candidate.shape !== "cuboid" ||
        (filterPredicate !== undefined && !filterPredicate(candidate))
      ) {
        continue;
      }

      const candidateTranslation = candidate.translation();
      const candidateHalfExtentX = candidate.payload.halfExtentX ?? 0;
      const candidateHalfExtentY = candidate.payload.halfExtentY ?? 0;
      const candidateHalfExtentZ = candidate.payload.halfExtentZ ?? 0;
      const candidateBottomY = candidateTranslation.y - candidateHalfExtentY;
      const candidateTopY = candidateTranslation.y + candidateHalfExtentY;

      if (
        proposedTopY <= candidateBottomY ||
        proposedBottomY >= candidateTopY ||
        candidateTopY <= proposedBottomY + this.snapDistance ||
        candidateTopY <= currentFootY + this.snapDistance
      ) {
        continue;
      }

      const intersectsProposedPosition =
        Math.abs(proposedTranslation.x - candidateTranslation.x) <=
          candidateHalfExtentX + colliderHalfExtentX &&
        Math.abs(proposedTranslation.z - candidateTranslation.z) <=
          candidateHalfExtentZ + colliderHalfExtentZ;

      if (!intersectsProposedPosition) {
        continue;
      }

      return Object.freeze({
        x: currentTranslation.x,
        z: currentTranslation.z
      });
    }

    return Object.freeze({
      x: proposedTranslation.x,
      z: proposedTranslation.z
    });
  }
}

class FakeRapierWorld {
  constructor() {
    this.characterControllers = [];
    this.colliders = [];
    this.lastCharacterController = null;
    this.queryColliders = [];
    this.rigidBodies = [];
    this.timestep = 1 / 60;
  }

  createCharacterController() {
    const controller = new FakeCharacterController(this);

    this.characterControllers.push(controller);
    this.lastCharacterController = controller;

    return controller;
  }

  createCollider(colliderDesc, parentBody = null) {
    const collider = new FakeCollider(
      colliderDesc.shape,
      colliderDesc.payload,
      colliderDesc.translation,
      colliderDesc.rotation,
      parentBody
    );

    this.colliders.push(collider);

    return collider;
  }

  createRigidBody(bodyDesc) {
    const rigidBody = new FakeRigidBody(bodyDesc);

    this.rigidBodies.push(rigidBody);

    return rigidBody;
  }

  removeCollider(collider) {
    this.colliders = this.colliders.filter((candidate) => candidate !== collider);
    this.queryColliders = this.queryColliders.filter(
      (candidate) => candidate !== collider
    );
  }

  removeRigidBody(rigidBody) {
    this.rigidBodies = this.rigidBodies.filter((candidate) => candidate !== rigidBody);
    this.colliders = this.colliders.filter(
      (candidate) => candidate.parentBody !== rigidBody
    );
    this.queryColliders = this.queryColliders.filter(
      (candidate) => candidate.parentBody !== rigidBody
    );
  }

  step() {
    this.queryColliders = [...this.colliders];
  }
}

export function createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime) {
  const world = new FakeRapierWorld();

  return {
    physicsRuntime: new RapierPhysicsRuntime({
      async createPhysicsAddon() {
        return {
          RAPIER: {
            ColliderDesc: {
              capsule(halfHeight, radius) {
                return new FakeColliderDesc("capsule", {
                  halfHeight,
                  radius
                });
              },
              cuboid(halfExtentX, halfExtentY, halfExtentZ) {
                return new FakeColliderDesc("cuboid", {
                  halfExtentX,
                  halfExtentY,
                  halfExtentZ
                });
              },
              trimesh(vertices, indices) {
                return new FakeColliderDesc("trimesh", {
                  indices,
                  vertices
                });
              }
            },
            RigidBodyDesc: {
              dynamic() {
                return new FakeRigidBodyDesc();
              }
            },
            Vector3: FakeRapierVector3
          },
          world
        };
      }
    }),
    world
  };
}

export function createFakePhysicsRuntime(RapierPhysicsRuntime) {
  return createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime).physicsRuntime;
}
