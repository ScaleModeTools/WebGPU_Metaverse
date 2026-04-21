import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  metaverseRealtimeWorldCadenceConfig
} from "@webgpu-metaverse/shared";

import { createFakePhysicsRuntime } from "../../fake-rapier-runtime.mjs";
import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseUnmountedSurfaceLocomotionState settles grounded locomotion entry on the authoritative fixed step cadence", async () => {
  const authoritativeFixedStepSeconds =
    Number(metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs) /
    1_000;
  const [
    { MetaverseUnmountedSurfaceLocomotionState },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load(
      "/src/metaverse/traversal/surface/metaverse-unmounted-surface-locomotion-state.ts"
    ),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const stepSimulationCalls = [];
  const advanceCalls = [];
  const autostepCalls = [];
  let groundedBodySnapshot = Object.freeze({
    capsuleHalfHeightMeters:
      metaverseRuntimeConfig.groundedBody.capsuleHalfHeightMeters,
    capsuleRadiusMeters: metaverseRuntimeConfig.groundedBody.capsuleRadiusMeters,
    eyeHeightMeters: metaverseRuntimeConfig.groundedBody.eyeHeightMeters,
    grounded: true,
    jumpReady: true,
    planarSpeedUnitsPerSecond: 0,
    position: freezeVector3(0, 0, 24),
    verticalSpeedUnitsPerSecond: 0,
    yawRadians: 0
  });
  const groundedBodyRuntime = {
    colliderHandle: null,
    get isInitialized() {
      return true;
    },
    get snapshot() {
      return groundedBodySnapshot;
    },
    advance(_intentSnapshot, deltaSeconds) {
      advanceCalls.push(deltaSeconds);

      return groundedBodySnapshot;
    },
    setAutostepEnabled(enabled, maxHeightMeters) {
      autostepCalls.push(
        Object.freeze({
          enabled,
          maxHeightMeters
        })
      );
    },
    teleport(position, yawRadians) {
      groundedBodySnapshot = Object.freeze({
        ...groundedBodySnapshot,
        position,
        yawRadians
      });
    }
  };
  const surfaceLocomotionState = new MetaverseUnmountedSurfaceLocomotionState({
    config: metaverseRuntimeConfig,
    dependencies: {
      resolveGroundedTraversalFilterPredicate() {
        return () => true;
      },
      resolveWaterborneTraversalFilterPredicate() {
        return () => true;
      },
      surfaceColliderSnapshots: Object.freeze([])
    },
    groundedBodyRuntime,
    physicsRuntime: {
      stepSimulation(deltaSeconds) {
        stepSimulationCalls.push(deltaSeconds);
      }
    },
    readMountedVehicleColliderHandle: () => null
  });

  const cameraSnapshot = surfaceLocomotionState.enterGroundedLocomotion({
    lookYawRadians: 0.35,
    position: freezeVector3(2, 0.4, 18),
    resolveGroundedPresentationPosition: () => freezeVector3(2, 0.4, 18),
    supportHeightMeters: 0.4,
    traversalCameraPitchRadians: 0,
    yawRadians: 0.35
  });

  assert.notEqual(cameraSnapshot, null);
  assert.deepEqual(stepSimulationCalls, [authoritativeFixedStepSeconds]);
  assert.deepEqual(advanceCalls, [authoritativeFixedStepSeconds]);
  assert.deepEqual(autostepCalls, [
    Object.freeze({
      enabled: false,
      maxHeightMeters: undefined
    })
  ]);
});

test("MetaverseUnmountedSurfaceLocomotionState preserves planar carry velocity when entering swim locomotion", async () => {
  const [
    { MetaverseUnmountedSurfaceLocomotionState },
    { metaverseRuntimeConfig },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load(
      "/src/metaverse/traversal/surface/metaverse-unmounted-surface-locomotion-state.ts"
    ),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();

  const surfaceLocomotionState = new MetaverseUnmountedSurfaceLocomotionState({
    config: metaverseRuntimeConfig,
    dependencies: {
      resolveGroundedTraversalFilterPredicate() {
        return () => true;
      },
      resolveWaterborneTraversalFilterPredicate() {
        return () => true;
      },
      surfaceColliderSnapshots: Object.freeze([])
    },
    groundedBodyRuntime: {
      colliderHandle: null,
      setAutostepEnabled() {}
    },
    physicsRuntime,
    readMountedVehicleColliderHandle: () => null
  });
  const swimEntryPosition = freezeVector3(49.47, 0, 17.92);
  const carriedLinearVelocity = freezeVector3(8.46, 0, -7.05);

  surfaceLocomotionState.enterSwimLocomotion({
    linearVelocity: carriedLinearVelocity,
    lookYawRadians: 0,
    position: swimEntryPosition,
    resolveSwimPresentationPosition: (swimSnapshot) => swimSnapshot.position,
    traversalCameraPitchRadians: 0,
    yawRadians: 0
  });

  assert.deepEqual(surfaceLocomotionState.readSwimSnapshot()?.linearVelocity, {
    x: 8.46,
    y: 0,
    z: -7.05
  });
  assert.equal(
    surfaceLocomotionState.readSwimSnapshot()?.position.y,
    surfaceLocomotionState.resolveWaterSurfaceHeightMeters(swimEntryPosition)
  );
});

test("MetaverseUnmountedSurfaceLocomotionState preserves planar carry velocity when entering grounded locomotion", async () => {
  const [
    { MetaverseUnmountedSurfaceLocomotionState },
    { metaverseRuntimeConfig },
    { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load(
      "/src/metaverse/traversal/surface/metaverse-unmounted-surface-locomotion-state.ts"
    ),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();

  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      ...metaverseRuntimeConfig.groundedBody,
      worldRadius: metaverseRuntimeConfig.movement.worldRadius
    },
    physicsRuntime
  );

  await groundedBodyRuntime.init(0);

  try {
    const surfaceLocomotionState = new MetaverseUnmountedSurfaceLocomotionState({
      config: metaverseRuntimeConfig,
      dependencies: {
        resolveGroundedTraversalFilterPredicate() {
          return () => true;
        },
        resolveWaterborneTraversalFilterPredicate() {
          return () => true;
        },
        surfaceColliderSnapshots: Object.freeze([])
      },
      groundedBodyRuntime,
      physicsRuntime,
      readMountedVehicleColliderHandle: () => null
    });
    const groundedEntryPosition = freezeVector3(32.54, 0.59, 5.73);
    const carriedLinearVelocity = freezeVector3(-14.86, 0, -0.57);

    surfaceLocomotionState.enterGroundedLocomotion({
      linearVelocity: carriedLinearVelocity,
      lookYawRadians: 0,
      position: groundedEntryPosition,
      resolveGroundedPresentationPosition: () => groundedEntryPosition,
      supportHeightMeters: 0.59,
      traversalCameraPitchRadians: 0,
      yawRadians: 0
    });

    assert.deepEqual(groundedBodyRuntime.linearVelocitySnapshot, {
      x: -14.86,
      y: 0,
      z: -0.57
    });
    assert.deepEqual(groundedBodyRuntime.snapshot.linearVelocity, {
      x: -14.86,
      y: 0,
      z: -0.57
    });
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.equal(groundedBodyRuntime.snapshot.position.y, 0.59);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseUnmountedSurfaceLocomotionState routes grounded-body automatic surface sync into swim without discarding planar carry velocity", async () => {
  const [
    { MetaverseUnmountedSurfaceLocomotionState },
    { metaverseRuntimeConfig },
    { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load(
      "/src/metaverse/traversal/surface/metaverse-unmounted-surface-locomotion-state.ts"
    ),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();

  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      ...metaverseRuntimeConfig.groundedBody,
      worldRadius: metaverseRuntimeConfig.movement.worldRadius
    },
    physicsRuntime
  );

  await groundedBodyRuntime.init(0);

  try {
    const surfaceLocomotionState = new MetaverseUnmountedSurfaceLocomotionState({
      config: metaverseRuntimeConfig,
      dependencies: {
        resolveGroundedTraversalFilterPredicate() {
          return () => true;
        },
        resolveWaterborneTraversalFilterPredicate() {
          return () => true;
        },
        surfaceColliderSnapshots: Object.freeze([])
      },
      groundedBodyRuntime,
      physicsRuntime,
      readMountedVehicleColliderHandle: () => null
    });
    const waterbornePosition = freezeVector3(49.47, 0, 17.92);
    const carriedLinearVelocity = freezeVector3(8.46, 0.35, -7.05);

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      linearVelocity: carriedLinearVelocity,
      position: waterbornePosition,
      yawRadians: 0.25
    });

    const automaticSurfaceSyncResult =
      surfaceLocomotionState.syncAutomaticSurfaceLocomotionFromGroundedBody({
        currentLocomotionMode: "grounded",
        lookYawRadians: 0.1,
        resolveGroundedPresentationPosition: () => waterbornePosition,
        resolveSwimPresentationPosition: (swimSnapshot) => swimSnapshot.position,
        traversalCameraPitchRadians: 0
      });

    assert.equal(automaticSurfaceSyncResult.locomotionMode, "swim");
    assert.notEqual(automaticSurfaceSyncResult.cameraSnapshot, null);
    assert.ok(
      Math.abs(
        (surfaceLocomotionState.readSwimSnapshot()?.linearVelocity.x ?? 0) -
          8.46
      ) < 0.000001
    );
    assert.equal(surfaceLocomotionState.readSwimSnapshot()?.linearVelocity.y, 0);
    assert.ok(
      Math.abs(
        (surfaceLocomotionState.readSwimSnapshot()?.linearVelocity.z ?? 0) +
          7.05
      ) < 0.000001
    );
    assert.equal(
      surfaceLocomotionState.readSwimSnapshot()?.position.y,
      surfaceLocomotionState.resolveWaterSurfaceHeightMeters(waterbornePosition)
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});
