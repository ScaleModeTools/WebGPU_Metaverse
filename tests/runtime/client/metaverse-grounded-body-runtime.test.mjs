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
    this.shape = shape;
    this.translation = new FakeRapierVector3(0, 0, 0);
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
  constructor() {
    this.grounded = false;
    this.lastMovement = new FakeRapierVector3(0, 0, 0);
    this.snapDistance = 0;
  }

  computeColliderMovement(collider, desiredTranslationDelta) {
    const currentTranslation = collider.translation();
    const minCenterY = collider.standingOffset;
    const unclampedCenterY = currentTranslation.y + desiredTranslationDelta.y;
    const nextCenterY =
      unclampedCenterY <= minCenterY + this.snapDistance
        ? minCenterY
        : unclampedCenterY;

    this.lastMovement = new FakeRapierVector3(
      desiredTranslationDelta.x,
      nextCenterY - currentTranslation.y,
      desiredTranslationDelta.z
    );
    this.grounded = nextCenterY === minCenterY;
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

  free() {}

  setApplyImpulsesToDynamicBodies() {}

  setCharacterMass() {}
}

class FakeRapierWorld {
  createCharacterController() {
    return new FakeCharacterController();
  }

  createCollider(colliderDesc) {
    return new FakeCollider(
      colliderDesc.shape,
      colliderDesc.payload,
      colliderDesc.translation
    );
  }

  removeCollider() {}
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
    createFakePhysicsRuntime(RapierPhysicsRuntime)
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
  assert.ok(
    Math.hypot(advancedSnapshot.position.x, advancedSnapshot.position.z) <= 2
  );
  assert.ok(advancedSnapshot.position.z < 1.8);
  assert.equal(groundedBodyRuntime.snapshot, advancedSnapshot);

  groundedBodyRuntime.dispose();
});
