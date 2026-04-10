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

class FakeCollider {
  constructor(shape, payload, translation) {
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
    return this.translationVector;
  }
}

class FakeCharacterController {
  constructor(world) {
    this.grounded = false;
    this.lastMovement = new FakeRapierVector3(0, 0, 0);
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
      proposedSurfaceY - currentFootY > this.stepHeight
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

        if (stepRise <= this.stepHeight) {
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
    this.stepHeight = maxHeight;
  }

  free() {}

  setApplyImpulsesToDynamicBodies() {}

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
    this.queryColliders = [];
    this.timestep = 1 / 60;
  }

  createCharacterController() {
    return new FakeCharacterController(this);
  }

  createCollider(colliderDesc) {
    const collider = new FakeCollider(
      colliderDesc.shape,
      colliderDesc.payload,
      colliderDesc.translation
    );

    this.colliders.push(collider);

    return collider;
  }

  removeCollider(collider) {
    this.colliders = this.colliders.filter((candidate) => candidate !== collider);
    this.queryColliders = this.queryColliders.filter(
      (candidate) => candidate !== collider
    );
  }

  step() {
    this.queryColliders = [...this.colliders];
  }
}

function createFakePhysicsRuntime(RapierPhysicsRuntime) {
  return new RapierPhysicsRuntime({
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
          Vector3: FakeRapierVector3
        },
        world: new FakeRapierWorld()
      };
    }
  });
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
