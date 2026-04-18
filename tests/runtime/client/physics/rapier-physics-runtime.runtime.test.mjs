import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createFakePhysicsRuntimeWithWorld } from "../fake-rapier-runtime.mjs";
import { createClientModuleLoader } from "../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("RapierPhysicsRuntime serializes overlapping init calls and reuses the initialized addon for debug helpers", async () => {
  const { RapierPhysicsRuntime } = await clientLoader.load("/src/physics/index.ts");
  const addon = Object.freeze({
    RAPIER: Object.freeze({}),
    world: Object.freeze({
      kind: "fake-world"
    })
  });
  const helper = Object.freeze({
    dispose() {},
    update() {}
  });
  let createPhysicsAddonCallCount = 0;
  let resolveAddon;
  let capturedDebugHelperAddon = null;
  const addonReadyPromise = new Promise((resolve) => {
    resolveAddon = resolve;
  });
  const physicsRuntime = new RapierPhysicsRuntime({
    createDebugHelper(nextAddon) {
      capturedDebugHelperAddon = nextAddon;

      return helper;
    },
    async createPhysicsAddon() {
      createPhysicsAddonCallCount += 1;
      await addonReadyPromise;

      return addon;
    }
  });

  assert.equal(physicsRuntime.isInitialized, false);

  const firstInitPromise = physicsRuntime.init();
  const secondInitPromise = physicsRuntime.init();

  await Promise.resolve();
  assert.equal(createPhysicsAddonCallCount, 1);

  resolveAddon();
  await Promise.all([firstInitPromise, secondInitPromise]);
  await physicsRuntime.init();

  assert.equal(createPhysicsAddonCallCount, 1);
  assert.equal(physicsRuntime.isInitialized, true);
  assert.equal(physicsRuntime.createDebugHelper(), helper);
  assert.equal(capturedDebugHelperAddon, addon);
});

test("RapierPhysicsRuntime sanitizes dynamic body config, clamps invalid timesteps, and removes owned bodies", async () => {
  const { RapierPhysicsRuntime } = await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime, world } = createFakePhysicsRuntimeWithWorld(
    RapierPhysicsRuntime
  );

  await physicsRuntime.init();

  const fixedCollider = physicsRuntime.createFixedCuboidCollider(
    {
      x: Number.NaN,
      y: -2,
      z: 1.2
    },
    {
      x: 4,
      y: Number.POSITIVE_INFINITY,
      z: -3
    },
    {
      x: 0,
      y: 0,
      z: 0,
      w: 0
    }
  );
  const { body, collider } = physicsRuntime.createDynamicCuboidBody(
    {
      x: Number.NaN,
      y: -2,
      z: 0.4
    },
    {
      x: 5,
      y: Number.POSITIVE_INFINITY,
      z: -3
    },
    {
      additionalMass: -5,
      angularDamping: -1,
      colliderTranslation: {
        x: 2,
        y: 3,
        z: Number.NaN
      },
      gravityScale: -3,
      linearDamping: -2,
      lockRotations: true,
      rotation: {
        x: 0,
        y: 0,
        z: 0,
        w: 0
      }
    }
  );
  const vector = physicsRuntime.createVector3(Number.NaN, 2, Number.POSITIVE_INFINITY);

  physicsRuntime.stepSimulation(-5);

  assert.equal(fixedCollider.payload.halfExtentX, 0.5);
  assert.equal(fixedCollider.payload.halfExtentY, 0.01);
  assert.equal(fixedCollider.payload.halfExtentZ, 1.2);
  assert.equal(fixedCollider.translationVector.x, 4);
  assert.equal(fixedCollider.translationVector.y, 0);
  assert.equal(fixedCollider.translationVector.z, -3);
  assert.deepEqual(fixedCollider.rotationQuaternion, {
    x: 0,
    y: 0,
    z: 0,
    w: 1
  });

  assert.equal(body.additionalMass, 0);
  assert.equal(body.angularDamping, 0);
  assert.equal(body.gravityScale, 0);
  assert.equal(body.linearDamping, 0);
  assert.equal(body.lockRotationsEnabled, true);
  assert.deepEqual(body.rotationQuaternion, {
    x: 0,
    y: 0,
    z: 0,
    w: 1
  });
  assert.equal(body.translationVector.x, 5);
  assert.equal(body.translationVector.y, 0);
  assert.equal(body.translationVector.z, -3);

  assert.equal(collider.parentBody, body);
  assert.equal(collider.payload.halfExtentX, 0.5);
  assert.equal(collider.payload.halfExtentY, 0.01);
  assert.equal(collider.payload.halfExtentZ, 0.4);
  assert.equal(collider.translationVector.x, 2);
  assert.equal(collider.translationVector.y, 3);
  assert.equal(collider.translationVector.z, 0);

  assert.equal(vector.x, 0);
  assert.equal(vector.y, 2);
  assert.equal(vector.z, 0);
  assert.equal(world.timestep, 1 / 60);
  assert.ok(world.queryColliders.includes(fixedCollider));
  assert.ok(world.queryColliders.includes(collider));

  physicsRuntime.removeCollider(fixedCollider);

  assert.equal(world.colliders.includes(fixedCollider), false);
  assert.equal(world.queryColliders.includes(fixedCollider), false);

  physicsRuntime.removeRigidBody(body);

  assert.equal(world.rigidBodies.includes(body), false);
  assert.equal(world.colliders.includes(collider), false);
  assert.equal(world.queryColliders.includes(collider), false);
});
