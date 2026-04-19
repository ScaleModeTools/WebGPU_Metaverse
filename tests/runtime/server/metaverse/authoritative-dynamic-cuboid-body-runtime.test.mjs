import assert from "node:assert/strict";
import test from "node:test";

import { MetaverseAuthoritativeDynamicCuboidBodyRuntime } from "../../../../server/dist/metaverse/classes/metaverse-authoritative-dynamic-cuboid-body-runtime.js";
import { MetaverseAuthoritativeRapierPhysicsRuntime } from "../../../../server/dist/metaverse/classes/metaverse-authoritative-rapier-physics-runtime.js";

function assertApproxEqual(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}.`
  );
}

test("MetaverseAuthoritativeDynamicCuboidBodyRuntime syncs authoritative pushable body state and resets on dispose", () => {
  const spawnPosition = Object.freeze({
    x: 2,
    y: 3,
    z: -4
  });
  const spawnYawRadians = Math.PI * 1.75;
  const wrappedSpawnYawRadians = Math.PI * -0.25;
  const physicsRuntime = new MetaverseAuthoritativeRapierPhysicsRuntime();
  const bodyRuntime = new MetaverseAuthoritativeDynamicCuboidBodyRuntime(
    {
      additionalMass: 12,
      angularDamping: 10,
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
      linearDamping: 0,
      lockRotations: true,
      spawnPosition,
      spawnYawRadians
    },
    physicsRuntime
  );

  assert.deepEqual(bodyRuntime.snapshot.position, spawnPosition);
  assert.deepEqual(bodyRuntime.snapshot.linearVelocity, {
    x: 0,
    y: 0,
    z: 0
  });
  assertApproxEqual(bodyRuntime.snapshot.yawRadians, wrappedSpawnYawRadians);

  physicsRuntime.stepSimulation(0.5);

  const syncedSnapshot = bodyRuntime.syncSnapshot();

  assert.equal(bodyRuntime.snapshot, syncedSnapshot);
  assertApproxEqual(syncedSnapshot.yawRadians, wrappedSpawnYawRadians);
  assert.ok(syncedSnapshot.position.y < spawnPosition.y);
  assert.ok(syncedSnapshot.linearVelocity.y < 0);

  bodyRuntime.dispose();

  assert.deepEqual(bodyRuntime.snapshot.position, spawnPosition);
  assert.deepEqual(bodyRuntime.snapshot.linearVelocity, {
    x: 0,
    y: 0,
    z: 0
  });
  assertApproxEqual(bodyRuntime.snapshot.yawRadians, wrappedSpawnYawRadians);
  assert.throws(
    () => bodyRuntime.syncSnapshot(),
    /must be initialized before use/
  );
});
