import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createFakePhysicsRuntimeWithWorld } from "../fake-rapier-runtime.mjs";
import { createClientModuleLoader } from "../load-client-module.mjs";

let clientLoader;

function assertApprox(actual, expected, epsilon = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseSurfaceDriveBodyRuntime syncs authoritative cuboid vehicle state through the rotated local center", async () => {
  const { MetaverseSurfaceDriveBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime } = createFakePhysicsRuntimeWithWorld(
    RapierPhysicsRuntime
  );
  await physicsRuntime.init();
  const runtime = new MetaverseSurfaceDriveBodyRuntime(
    {
      controllerOffsetMeters: 0.02,
      shape: {
        halfExtents: {
          x: 0.75,
          y: 0.4,
          z: 1.4
        },
        kind: "cuboid",
        localCenter: {
          x: 1,
          y: 0.25,
          z: 0
        }
      },
      spawnPosition: {
        x: 0,
        y: 0,
        z: 0
      },
      spawnYawRadians: 0,
      worldRadius: 110
    },
    physicsRuntime
  );

  try {
    runtime.syncAuthoritativeState({
      linearVelocity: {
        x: 4,
        y: 1,
        z: 2
      },
      position: {
        x: 8,
        y: 1,
        z: -2
      },
      yawRadians: Math.PI * 0.5
    });

    const stateSnapshot = runtime.captureStateSnapshot();
    const colliderTranslation = runtime.colliderHandle.translation();

    assert.deepEqual(runtime.snapshot.position, {
      x: 8,
      y: 1,
      z: -2
    });
    assert.equal(runtime.snapshot.linearVelocity.x, 4);
    assert.equal(runtime.snapshot.linearVelocity.y, 1);
    assert.equal(runtime.snapshot.linearVelocity.z, 2);
    assertApprox(
      runtime.snapshot.planarSpeedUnitsPerSecond,
      Math.hypot(4, 2)
    );
    assertApprox(runtime.snapshot.yawRadians, Math.PI * 0.5);
    assertApprox(stateSnapshot.forwardSpeedUnitsPerSecond, 4);
    assertApprox(stateSnapshot.strafeSpeedUnitsPerSecond, 2);
    assertApprox(colliderTranslation.x, 8);
    assertApprox(colliderTranslation.y, 1.25);
    assertApprox(colliderTranslation.z, -3);
    assertApprox(runtime.colliderHandle.rotationQuaternion.y, Math.sin(Math.PI * 0.25));
    assertApprox(runtime.colliderHandle.rotationQuaternion.w, Math.cos(Math.PI * 0.25));
  } finally {
    runtime.dispose();
  }
});

test("MetaverseSurfaceDriveBodyRuntime restores a captured cuboid state without losing pose or local planar speeds", async () => {
  const { MetaverseSurfaceDriveBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime } = createFakePhysicsRuntimeWithWorld(
    RapierPhysicsRuntime
  );
  await physicsRuntime.init();
  const runtime = new MetaverseSurfaceDriveBodyRuntime(
    {
      controllerOffsetMeters: 0.02,
      shape: {
        halfExtents: {
          x: 0.75,
          y: 0.4,
          z: 1.4
        },
        kind: "cuboid",
        localCenter: {
          x: 0.5,
          y: 0.2,
          z: 0.5
        }
      },
      spawnPosition: {
        x: -3,
        y: 0.5,
        z: 4
      },
      spawnYawRadians: 0,
      worldRadius: 110
    },
    physicsRuntime
  );

  try {
    runtime.syncAuthoritativeState({
      linearVelocity: {
        x: 1.5,
        y: 0,
        z: -3
      },
      position: {
        x: 5,
        y: 0.75,
        z: -6
      },
      yawRadians: Math.PI
    });

    const capturedStateSnapshot = runtime.captureStateSnapshot();

    runtime.teleport(
      {
        x: 20,
        y: 3,
        z: 9
      },
      Math.PI * 0.25
    );
    runtime.restoreStateSnapshot(capturedStateSnapshot);

    const restoredStateSnapshot = runtime.captureStateSnapshot();
    const colliderTranslation = runtime.colliderHandle.translation();

    assert.equal(runtime.snapshot, capturedStateSnapshot.snapshot);
    assert.equal(
      restoredStateSnapshot.forwardSpeedUnitsPerSecond,
      capturedStateSnapshot.forwardSpeedUnitsPerSecond
    );
    assert.equal(
      restoredStateSnapshot.strafeSpeedUnitsPerSecond,
      capturedStateSnapshot.strafeSpeedUnitsPerSecond
    );
    assertApprox(runtime.snapshot.position.x, 5);
    assertApprox(runtime.snapshot.position.y, 0.75);
    assertApprox(runtime.snapshot.position.z, -6);
    assertApprox(runtime.snapshot.yawRadians, Math.PI);
    assertApprox(colliderTranslation.x, 4.5);
    assertApprox(colliderTranslation.y, 0.95);
    assertApprox(colliderTranslation.z, -6.5);
    assertApprox(runtime.colliderHandle.rotationQuaternion.y, 1);
    assertApprox(runtime.colliderHandle.rotationQuaternion.w, 0);
  } finally {
    runtime.dispose();
  }
});

test("MetaverseSurfaceDriveBodyRuntime resolves swim blocker overlap against shared authored surface colliders", async () => {
  const { MetaverseSurfaceDriveBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime } = createFakePhysicsRuntimeWithWorld(
    RapierPhysicsRuntime
  );
  const locomotionConfig = Object.freeze({
    accelerationCurveExponent: 1,
    accelerationUnitsPerSecondSquared: 24,
    baseSpeedUnitsPerSecond: 4,
    boostCurveExponent: 1,
    boostMultiplier: 1.4,
    decelerationUnitsPerSecondSquared: 24,
    dragCurveExponent: 1,
    maxTurnSpeedRadiansPerSecond: 3
  });
  const blockerSnapshot = Object.freeze({
    halfExtents: Object.freeze({
      x: 0.7,
      y: 0.9,
      z: 0.5
    }),
    ownerEnvironmentAssetId: null,
    rotation: Object.freeze({
      x: 0,
      y: 0,
      z: 0,
      w: 1
    }),
    rotationYRadians: 0,
    translation: Object.freeze({
      x: 0,
      y: 0.9,
      z: -1.2
    }),
    traversalAffordance: "blocker"
  });

  await physicsRuntime.init();
  const unconstrainedRuntime = new MetaverseSurfaceDriveBodyRuntime(
    {
      controllerOffsetMeters: 0.02,
      shape: {
        halfHeightMeters: 0.48,
        kind: "capsule",
        radiusMeters: 0.34
      },
      spawnPosition: {
        x: 0,
        y: 0,
        z: 0
      },
      spawnYawRadians: 0,
      worldRadius: 110
    },
    physicsRuntime
  );
  const constrainedRuntime = new MetaverseSurfaceDriveBodyRuntime(
    {
      controllerOffsetMeters: 0.02,
      shape: {
        halfHeightMeters: 0.48,
        kind: "capsule",
        radiusMeters: 0.34
      },
      spawnPosition: {
        x: 0,
        y: 0,
        z: 0
      },
      spawnYawRadians: 0,
      worldRadius: 110
    },
    physicsRuntime
  );

  try {
    const unconstrainedSnapshot = unconstrainedRuntime.advance(
      Object.freeze({
        boost: false,
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      }),
      locomotionConfig,
      1,
      0
    );
    const constrainedSnapshot = constrainedRuntime.advance(
      Object.freeze({
        boost: false,
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      }),
      locomotionConfig,
      1,
      0,
      null,
      undefined,
      Object.freeze({
        surfaceColliderSnapshots: Object.freeze([blockerSnapshot])
      })
    );

    assert.ok(
      unconstrainedSnapshot.position.z < -0.5,
      `expected unconstrained swim traversal to advance forward, received z=${unconstrainedSnapshot.position.z}`
    );
    assertApprox(constrainedSnapshot.position.x, 0);
    assertApprox(constrainedSnapshot.position.z, 0);
    assertApprox(constrainedSnapshot.linearVelocity.x, 0);
    assertApprox(constrainedSnapshot.linearVelocity.z, 0);
  } finally {
    unconstrainedRuntime.dispose();
    constrainedRuntime.dispose();
  }
});
