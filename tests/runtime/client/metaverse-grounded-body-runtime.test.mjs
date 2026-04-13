import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

class FakeRapierVector3 {
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
  constructor(shape, payload, translation, parentBody = null) {
    this.parentBody = parentBody;
    this.payload = payload;
    this.shape = shape;
    this.translationVector = translation;
  }

  get standingOffset() {
    return this.shape === "capsule"
      ? this.payload.halfHeight + this.payload.radius
      : 0;
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

  computeColliderMovement(collider, desiredTranslationDelta) {
    const currentTranslation = collider.translation();
    const currentFootY = currentTranslation.y - collider.standingOffset;
    const capsuleRadius = collider.payload.radius ?? 0;
    let nextCenterX = currentTranslation.x + desiredTranslationDelta.x;
    let nextCenterZ = currentTranslation.z + desiredTranslationDelta.z;
    const proposedSurfaceY = this.findSurfaceY(
      nextCenterX,
      nextCenterZ,
      capsuleRadius
    );

    if (
      proposedSurfaceY !== null &&
      proposedSurfaceY - currentFootY > this.snapDistance &&
      (!this.autostepEnabled ||
        proposedSurfaceY - currentFootY > this.stepHeight)
    ) {
      nextCenterX = currentTranslation.x;
      nextCenterZ = currentTranslation.z;
    }

    const supportingSurfaceY = this.findSurfaceY(
      nextCenterX,
      nextCenterZ,
      capsuleRadius
    );
    const desiredFootY = currentFootY + desiredTranslationDelta.y;
    let nextFootY = desiredFootY;

    if (supportingSurfaceY !== null) {
      if (supportingSurfaceY > currentFootY) {
        const stepRise = supportingSurfaceY - currentFootY;

        if (this.autostepEnabled && stepRise <= this.stepHeight) {
          nextFootY = supportingSurfaceY;
        }
      }

      if (desiredFootY <= supportingSurfaceY + this.snapDistance) {
        nextFootY = supportingSurfaceY;
      }
    }

    const nextCenterY = nextFootY + collider.standingOffset;

    this.lastMovement = new FakeRapierVector3(
      nextCenterX - currentTranslation.x,
      nextCenterY - currentTranslation.y,
      nextCenterZ - currentTranslation.z
    );
    this.grounded =
      supportingSurfaceY !== null &&
      Math.abs(nextFootY - supportingSurfaceY) <= 0.0001;
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

  setMaxSlopeClimbAngle(angle) {
    this.maxSlopeClimbAngle = angle;
  }

  setMinSlopeSlideAngle(angle) {
    this.minSlopeSlideAngle = angle;
  }

  setApplyImpulsesToDynamicBodies(enabled) {
    this.applyImpulsesToDynamicBodies = enabled;
  }

  setCharacterMass() {}

  findSurfaceY(centerX, centerZ, capsuleRadius) {
    let highestSurfaceY = null;

    for (const candidate of this.world.queryColliders) {
      if (candidate.shape !== "cuboid") {
        continue;
      }

      const halfExtentX = candidate.payload.halfExtentX ?? 0;
      const halfExtentY = candidate.payload.halfExtentY ?? 0;
      const halfExtentZ = candidate.payload.halfExtentZ ?? 0;
      const candidateTranslation = candidate.translation();

      if (
        Math.abs(centerX - candidateTranslation.x) > halfExtentX + capsuleRadius ||
        Math.abs(centerZ - candidateTranslation.z) > halfExtentZ + capsuleRadius
      ) {
        continue;
      }

      const surfaceY = candidateTranslation.y + halfExtentY;

      if (highestSurfaceY === null || surfaceY > highestSurfaceY) {
        highestSurfaceY = surfaceY;
      }
    }

    return highestSurfaceY;
  }
}

class FakeRapierWorld {
  constructor() {
    this.colliders = [];
    this.lastCharacterController = null;
    this.queryColliders = [];
    this.rigidBodies = [];
    this.timestep = 1 / 60;
  }

  createCharacterController() {
    const controller = new FakeCharacterController(this);

    this.lastCharacterController = controller;

    return controller;
  }

  createCollider(colliderDesc, parentBody = null) {
    const collider = new FakeCollider(
      colliderDesc.shape,
      colliderDesc.payload,
      colliderDesc.translation,
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

function createFakePhysicsRuntime(RapierPhysicsRuntime) {
  return createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime).physicsRuntime;
}

function createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime) {
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

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseGroundedBodyRuntime advances a grounded capsule body and clamps it to the world radius", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();

  const groundCollider = physicsRuntime.createFixedCuboidCollider(
    {
      x: 4,
      y: 0.5,
      z: 4
    },
    {
      x: 0,
      y: -0.5,
      z: 0
    }
  );
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      baseSpeedUnitsPerSecond: 4,
      boostMultiplier: 2,
      capsuleHalfHeightMeters: 0.48,
      capsuleRadiusMeters: 0.34,
      controllerOffsetMeters: 0.02,
      eyeHeightMeters: 1.62,
      gravityUnitsPerSecond: 18,
      maxTurnSpeedRadiansPerSecond: Math.PI * 0.5,
      snapToGroundDistanceMeters: 0.22,
      spawnPosition: {
        x: 0,
        y: 0,
        z: 0
      },
      worldRadius: 2
    },
    physicsRuntime
  );

  await groundedBodyRuntime.init(0);
  groundedBodyRuntime.teleport(
    {
      x: 0,
      y: 0,
      z: 1.8
    },
    0
  );

  const advancedSnapshot = groundedBodyRuntime.advance(
    {
      boost: true,
      moveAxis: 1,
      turnAxis: 0
    },
    0.5
  );

  assert.equal(advancedSnapshot.grounded, true);
  assert.equal(advancedSnapshot.position.y, 0);
  assert.equal(advancedSnapshot.eyeHeightMeters, 1.62);
  assert.ok(advancedSnapshot.planarSpeedUnitsPerSecond > 0);
  assert.ok(
    Math.hypot(advancedSnapshot.position.x, advancedSnapshot.position.z) <= 2
  );
  assert.ok(advancedSnapshot.position.z < 1.8);
  assert.equal(groundedBodyRuntime.snapshot, advancedSnapshot);

  groundedBodyRuntime.dispose();
  physicsRuntime.removeCollider(groundCollider);
});

test("MetaverseGroundedBodyRuntime walks onto a low fixed step", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();

  const groundCollider = physicsRuntime.createFixedCuboidCollider(
    { x: 8, y: 0.5, z: 8 },
    { x: 0, y: -0.5, z: 0 }
  );
  const dockCollider = physicsRuntime.createFixedCuboidCollider(
    { x: 2.5, y: 0.17, z: 2.5 },
    { x: 0, y: 0, z: 0 }
  );
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      accelerationUnitsPerSecondSquared: 18,
      baseSpeedUnitsPerSecond: 4.5,
      boostMultiplier: 1.25,
      capsuleHalfHeightMeters: 0.48,
      capsuleRadiusMeters: 0.34,
      controllerOffsetMeters: 0.02,
      decelerationUnitsPerSecondSquared: 24,
      eyeHeightMeters: 1.62,
      gravityUnitsPerSecond: 18,
      maxTurnSpeedRadiansPerSecond: Math.PI * 0.5,
      snapToGroundDistanceMeters: 0.22,
      stepHeightMeters: 0.28,
      stepWidthMeters: 0.2,
      spawnPosition: {
        x: 0,
        y: 0,
        z: 4
      },
      worldRadius: 10
    },
    physicsRuntime
  );

  try {
    await groundedBodyRuntime.init(0);
    groundedBodyRuntime.teleport(
      {
        x: 0,
        y: 0,
        z: 4
      },
      0
    );

    for (let frame = 0; frame < 60; frame += 1) {
      groundedBodyRuntime.advance(
        {
          boost: false,
          moveAxis: 1,
          turnAxis: 0
        },
        1 / 60
      );
    }

    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.ok(groundedBodyRuntime.snapshot.position.y > 0.1);
    assert.ok(groundedBodyRuntime.snapshot.position.z < 2.2);
  } finally {
    groundedBodyRuntime.dispose();
    physicsRuntime.removeCollider(dockCollider);
    physicsRuntime.removeCollider(groundCollider);
  }
});

test("MetaverseGroundedBodyRuntime preserves planar momentum when jumping from grounded movement", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();

  const groundCollider = physicsRuntime.createFixedCuboidCollider(
    { x: 6, y: 0.5, z: 6 },
    { x: 0, y: -0.5, z: 0 }
  );
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      accelerationUnitsPerSecondSquared: 18,
      airborneMovementDampingFactor: 0.4,
      baseSpeedUnitsPerSecond: 4.5,
      boostMultiplier: 1.25,
      capsuleHalfHeightMeters: 0.48,
      capsuleRadiusMeters: 0.34,
      controllerOffsetMeters: 0.02,
      decelerationUnitsPerSecondSquared: 24,
      eyeHeightMeters: 1.62,
      gravityUnitsPerSecond: 18,
      maxTurnSpeedRadiansPerSecond: Math.PI * 0.5,
      snapToGroundDistanceMeters: 0.22,
      spawnPosition: {
        x: 0,
        y: 0,
        z: 0
      },
      worldRadius: 8
    },
    physicsRuntime
  );

  try {
    await groundedBodyRuntime.init(0);
    groundedBodyRuntime.teleport(
      {
        x: 0,
        y: 0,
        z: 0
      },
      0
    );

    groundedBodyRuntime.advance(
      {
        boost: false,
        jump: false,
        moveAxis: 1,
        strafeAxis: 0,
        turnAxis: 0
      },
      0.25
    );

    const jumpSnapshot = groundedBodyRuntime.advance(
      {
        boost: false,
        jump: true,
        moveAxis: 1,
        strafeAxis: 0,
        turnAxis: 0
      },
      0.05
    );
    const airborneContinuationSnapshot = groundedBodyRuntime.advance(
      {
        boost: false,
        jump: false,
        moveAxis: 1,
        strafeAxis: 0,
        turnAxis: 0
      },
      0.05
    );

    assert.equal(jumpSnapshot.grounded, false);
    assert.equal(airborneContinuationSnapshot.grounded, false);
    assert.ok(jumpSnapshot.planarSpeedUnitsPerSecond > 0);
    assert.ok(
      airborneContinuationSnapshot.planarSpeedUnitsPerSecond >=
        jumpSnapshot.planarSpeedUnitsPerSecond * 0.9
    );
  } finally {
    groundedBodyRuntime.dispose();
    physicsRuntime.removeCollider(groundCollider);
  }
});

test("MetaverseGroundedBodyRuntime stops at a tall blocker", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();

  const groundCollider = physicsRuntime.createFixedCuboidCollider(
    { x: 8, y: 0.5, z: 8 },
    { x: 0, y: -0.5, z: 0 }
  );
  const crateCollider = physicsRuntime.createFixedCuboidCollider(
    { x: 0.46, y: 0.46, z: 0.46 },
    { x: 0, y: 0, z: 0.4 }
  );
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      accelerationUnitsPerSecondSquared: 18,
      baseSpeedUnitsPerSecond: 4.5,
      boostMultiplier: 1.25,
      capsuleHalfHeightMeters: 0.48,
      capsuleRadiusMeters: 0.34,
      controllerOffsetMeters: 0.02,
      decelerationUnitsPerSecondSquared: 24,
      eyeHeightMeters: 1.62,
      gravityUnitsPerSecond: 18,
      maxTurnSpeedRadiansPerSecond: Math.PI * 0.5,
      snapToGroundDistanceMeters: 0.22,
      stepHeightMeters: 0.28,
      stepWidthMeters: 0.2,
      spawnPosition: {
        x: 0,
        y: 0,
        z: 3
      },
      worldRadius: 10
    },
    physicsRuntime
  );

  try {
    await groundedBodyRuntime.init(0);
    groundedBodyRuntime.teleport(
      {
        x: 0,
        y: 0,
        z: 3
      },
      0
    );

    for (let frame = 0; frame < 180; frame += 1) {
      groundedBodyRuntime.advance(
        {
          boost: false,
          moveAxis: 1,
          turnAxis: 0
        },
        1 / 60
      );
    }

    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.ok(groundedBodyRuntime.snapshot.position.y < 0.05);
    assert.ok(groundedBodyRuntime.snapshot.position.z > 0.7);
  } finally {
    groundedBodyRuntime.dispose();
    physicsRuntime.removeCollider(crateCollider);
    physicsRuntime.removeCollider(groundCollider);
  }
});

test("MetaverseGroundedBodyRuntime applies slope rules and exposes jump readiness from computed grounding", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);

  await physicsRuntime.init();

  const groundCollider = physicsRuntime.createFixedCuboidCollider(
    { x: 4, y: 0.5, z: 4 },
    { x: 0, y: -0.5, z: 0 }
  );
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      accelerationCurveExponent: 1.2,
      accelerationUnitsPerSecondSquared: 18,
      airborneMovementDampingFactor: 0.4,
      baseSpeedUnitsPerSecond: 4.5,
      boostCurveExponent: 1.1,
      boostMultiplier: 1.25,
      capsuleHalfHeightMeters: 0.48,
      capsuleRadiusMeters: 0.34,
      controllerOffsetMeters: 0.02,
      decelerationUnitsPerSecondSquared: 24,
      dragCurveExponent: 1.45,
      eyeHeightMeters: 1.62,
      gravityUnitsPerSecond: 18,
      maxSlopeClimbAngleRadians: Math.PI * 0.2,
      maxTurnSpeedRadiansPerSecond: Math.PI * 0.5,
      minSlopeSlideAngleRadians: Math.PI * 0.3,
      snapToGroundDistanceMeters: 0.22,
      stepHeightMeters: 0.28,
      stepWidthMeters: 0.2,
      spawnPosition: {
        x: 0,
        y: 0,
        z: 0
      },
      worldRadius: 10
    },
    physicsRuntime
  );

  try {
    await groundedBodyRuntime.init(0);
    groundedBodyRuntime.teleport(
      {
        x: 0,
        y: 0,
        z: 0
      },
      0
    );

    const snapshot = groundedBodyRuntime.advance(
      {
        boost: false,
        moveAxis: 0,
        turnAxis: 0
      },
      1 / 60
    );

    assert.equal(world.lastCharacterController.maxSlopeClimbAngle, Math.PI * 0.2);
    assert.equal(world.lastCharacterController.minSlopeSlideAngle, Math.PI * 0.3);
    assert.equal(snapshot.grounded, true);
    assert.equal(snapshot.jumpReady, true);
  } finally {
    groundedBodyRuntime.dispose();
    physicsRuntime.removeCollider(groundCollider);
  }
});

test("MetaverseGroundedBodyRuntime toggles dynamic-body impulses without moving locomotion policy out of physics", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      baseSpeedUnitsPerSecond: 4,
      boostMultiplier: 2,
      capsuleHalfHeightMeters: 0.48,
      capsuleRadiusMeters: 0.34,
      controllerOffsetMeters: 0.02,
      eyeHeightMeters: 1.62,
      gravityUnitsPerSecond: 18,
      maxTurnSpeedRadiansPerSecond: Math.PI * 0.5,
      snapToGroundDistanceMeters: 0.22,
      spawnPosition: {
        x: 0,
        y: 0,
        z: 0
      },
      worldRadius: 8
    },
    physicsRuntime
  );

  groundedBodyRuntime.setApplyImpulsesToDynamicBodies(true);
  await groundedBodyRuntime.init();

  assert.equal(world.lastCharacterController?.applyImpulsesToDynamicBodies, true);

  groundedBodyRuntime.setApplyImpulsesToDynamicBodies(false);

  assert.equal(world.lastCharacterController?.applyImpulsesToDynamicBodies, false);
  groundedBodyRuntime.dispose();
});

test("MetaverseGroundedBodyRuntime can disable and restore autostep without changing default grounded behavior", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      baseSpeedUnitsPerSecond: 4,
      boostMultiplier: 2,
      capsuleHalfHeightMeters: 0.48,
      capsuleRadiusMeters: 0.34,
      controllerOffsetMeters: 0.02,
      eyeHeightMeters: 1.62,
      gravityUnitsPerSecond: 18,
      maxTurnSpeedRadiansPerSecond: Math.PI * 0.5,
      snapToGroundDistanceMeters: 0.22,
      spawnPosition: {
        x: 0,
        y: 0,
        z: 0
      },
      worldRadius: 8
    },
    physicsRuntime
  );

  await groundedBodyRuntime.init();

  assert.equal(world.lastCharacterController?.autostepEnabled, true);

  groundedBodyRuntime.setAutostepEnabled(false);

  assert.equal(world.lastCharacterController?.autostepEnabled, false);

  groundedBodyRuntime.setAutostepEnabled(true);

  assert.equal(world.lastCharacterController?.autostepEnabled, true);
  groundedBodyRuntime.setAutostepEnabled(true, 0.62);
  assert.equal(world.lastCharacterController?.stepHeight, 0.62);
  groundedBodyRuntime.dispose();
});

test("MetaverseDynamicCuboidBodyRuntime snapshots a dynamic pushable body pose from physics", async () => {
  const { MetaverseDynamicCuboidBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const dynamicBodyRuntime = new MetaverseDynamicCuboidBodyRuntime(
    {
      additionalMass: 12,
      angularDamping: 8,
      colliderCenter: {
        x: 0,
        y: 0,
        z: 0
      },
      gravityScale: 1,
      halfExtents: {
        x: 0.46,
        y: 0.46,
        z: 0.46
      },
      linearDamping: 4,
      lockRotations: true,
      spawnPosition: {
        x: -3.8,
        y: 0.46,
        z: -14.4
      },
      spawnYawRadians: Math.PI * 0.04
    },
    physicsRuntime
  );

  await dynamicBodyRuntime.init();

  const rigidBody = world.rigidBodies[0];

  assert.ok(rigidBody);
  assert.equal(rigidBody.lockRotationsEnabled, true);
  assert.equal(rigidBody.additionalMass, 12);

  rigidBody.setTranslation(
    new FakeRapierVector3(-2.6, 0.46, -13.1)
  );
  rigidBody.setLinvel(
    new FakeRapierVector3(1.2, 0, 0.4)
  );

  assert.deepEqual(dynamicBodyRuntime.syncSnapshot(), {
    linearVelocity: {
      x: 1.2,
      y: 0,
      z: 0.4
    },
    position: {
      x: -2.6,
      y: 0.46,
      z: -13.1
    },
    yawRadians: Math.PI * 0.04
  });
  dynamicBodyRuntime.dispose();
});
