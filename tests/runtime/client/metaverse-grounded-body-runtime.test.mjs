import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  resolveMetaverseGroundedBodyColliderTranslationSnapshot
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";
import {
  createFakePhysicsRuntimeWithWorld
} from "./fake-rapier-runtime.mjs";

let clientLoader;

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function createGroundedBodyConfig(overrides = {}) {
  return Object.freeze({
    accelerationCurveExponent: 1.2,
    accelerationUnitsPerSecondSquared: 20,
    airborneMovementDampingFactor: 0.42,
    baseSpeedUnitsPerSecond: 6,
    boostCurveExponent: 1.1,
    boostMultiplier: 1.65,
    capsuleHalfHeightMeters: 0.48,
    capsuleRadiusMeters: 0.34,
    controllerOffsetMeters: 0.01,
    decelerationUnitsPerSecondSquared: 26,
    dragCurveExponent: 1.45,
    eyeHeightMeters: 1.62,
    gravityUnitsPerSecond: 18,
    jumpGroundContactGraceSeconds: 0.2,
    jumpImpulseUnitsPerSecond: 6.8,
    maxSlopeClimbAngleRadians: Math.PI * 0.26,
    maxTurnSpeedRadiansPerSecond: 1.9,
    minSlopeSlideAngleRadians: Math.PI * 0.34,
    snapToGroundDistanceMeters: 0.22,
    spawnPosition: freezeVector3(0, 0, 0),
    stepHeightMeters: 0.28,
    stepWidthMeters: 0.24,
    worldRadius: 110,
    ...overrides
  });
}

function assertVectorEqual(actual, expected) {
  assert.deepEqual(
    {
      x: actual.x,
      y: actual.y,
      z: actual.z
    },
    expected
  );
}

function assertVectorApproxEqual(actual, expected, tolerance = 0.000001) {
  assert.ok(Math.abs(actual.x - expected.x) <= tolerance);
  assert.ok(Math.abs(actual.y - expected.y) <= tolerance);
  assert.ok(Math.abs(actual.z - expected.z) <= tolerance);
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseGroundedBodyRuntime initializes only the authoritative capsule collider", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const config = createGroundedBodyConfig({
    spawnPosition: freezeVector3(1.25, 10.34, -3.5)
  });
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    config,
    physicsRuntime
  );

  await groundedBodyRuntime.init(0.45);

  assert.equal(groundedBodyRuntime.isInitialized, true);
  assert.equal(world.colliders.length, 1);
  assert.equal(world.characterControllers.length, 0);
  assert.equal(groundedBodyRuntime.colliderHandle, world.colliders[0]);
  assert.equal(groundedBodyRuntime.snapshot.position.y, 10.34);
  assert.equal(groundedBodyRuntime.snapshot.yawRadians, 0.45);
  assertVectorEqual(
    world.colliders[0].translation(),
    resolveMetaverseGroundedBodyColliderTranslationSnapshot(
      config,
      config.spawnPosition
    )
  );

  groundedBodyRuntime.dispose();

  assert.equal(groundedBodyRuntime.isInitialized, false);
  assert.equal(world.colliders.length, 0);
});

test("MetaverseGroundedBodyRuntime syncs full authoritative grounded state at exported support height", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const config = createGroundedBodyConfig();
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    config,
    physicsRuntime
  );
  const supportPosition = freezeVector3(32.54, 10.34, 5.73);

  await groundedBodyRuntime.init(0);
  groundedBodyRuntime.syncAuthoritativeState({
    contact: Object.freeze({
      appliedMovementDelta: freezeVector3(0.1, 0, -0.2),
      blockedPlanarMovement: false,
      blockedVerticalMovement: false,
      desiredMovementDelta: freezeVector3(0.1, -0.01, -0.2),
      supportingContactDetected: true
    }),
    driveTarget: Object.freeze({
      boost: true,
      moveAxis: 0.8,
      movementMagnitude: 1,
      strafeAxis: -0.2,
      targetForwardSpeedUnitsPerSecond: 4.8,
      targetPlanarSpeedUnitsPerSecond: 5,
      targetStrafeSpeedUnitsPerSecond: -1
    }),
    grounded: true,
    interaction: Object.freeze({
      applyImpulsesToDynamicBodies: true
    }),
    linearVelocity: freezeVector3(-14.86, 0, -0.57),
    position: supportPosition,
    supportNormal: freezeVector3(0, 1, 0),
    yawRadians: 0.25
  });

  assert.equal(groundedBodyRuntime.snapshot.grounded, true);
  assert.equal(groundedBodyRuntime.snapshot.position.y, supportPosition.y);
  assertVectorApproxEqual(groundedBodyRuntime.linearVelocitySnapshot, {
    x: -14.86,
    y: 0,
    z: -0.57
  });
  assert.equal(groundedBodyRuntime.snapshot.driveTarget.boost, true);
  assert.equal(
    groundedBodyRuntime.snapshot.contact.supportingContactDetected,
    true
  );
  assert.equal(
    groundedBodyRuntime.snapshot.interaction.applyImpulsesToDynamicBodies,
    true
  );
  assertVectorEqual(
    world.colliders[0].translation(),
    resolveMetaverseGroundedBodyColliderTranslationSnapshot(
      config,
      supportPosition
    )
  );

  groundedBodyRuntime.dispose();
});

test("MetaverseGroundedBodyRuntime preserves authoritative airborne jump state during sync", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime } = createFakePhysicsRuntimeWithWorld(
    RapierPhysicsRuntime
  );
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    createGroundedBodyConfig(),
    physicsRuntime
  );

  await groundedBodyRuntime.init(0);
  groundedBodyRuntime.syncAuthoritativeState({
    grounded: false,
    jumpBody: Object.freeze({
      grounded: false,
      jumpGroundContactGraceSecondsRemaining: 0,
      jumpReady: false,
      jumpSnapSuppressionActive: true,
      verticalSpeedUnitsPerSecond: -3.75
    }),
    linearVelocity: freezeVector3(1.5, -3.2, -0.5),
    position: freezeVector3(1.1, 1.05, -2.05),
    yawRadians: Math.PI * 0.25
  });

  assert.equal(groundedBodyRuntime.snapshot.grounded, false);
  assert.equal(
    groundedBodyRuntime.snapshot.jumpBody.jumpSnapSuppressionActive,
    true
  );
  assert.equal(
    groundedBodyRuntime.snapshot.jumpBody.verticalSpeedUnitsPerSecond,
    -3.75
  );
  assert.equal(groundedBodyRuntime.snapshot.linearVelocity.y, -3.75);

  groundedBodyRuntime.dispose();
});

test("MetaverseGroundedBodyRuntime restores captured authoritative state without movement simulation", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const config = createGroundedBodyConfig();
  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    config,
    physicsRuntime
  );

  await groundedBodyRuntime.init(0);
  groundedBodyRuntime.syncAuthoritativeState({
    grounded: true,
    linearVelocity: freezeVector3(2, 0, 1),
    position: freezeVector3(3, 0.75, 4),
    yawRadians: 0.5
  });

  const capturedSnapshot = groundedBodyRuntime.captureStateSnapshot();

  groundedBodyRuntime.teleport(freezeVector3(-2, 1.5, -2), -0.25);
  groundedBodyRuntime.restoreStateSnapshot(capturedSnapshot);

  assert.deepEqual(groundedBodyRuntime.snapshot.position, {
    x: 3,
    y: 0.75,
    z: 4
  });
  assert.deepEqual(groundedBodyRuntime.snapshot.linearVelocity, {
    x: 2,
    y: 0,
    z: 1
  });
  assertVectorEqual(
    world.colliders[0].translation(),
    resolveMetaverseGroundedBodyColliderTranslationSnapshot(
      config,
      freezeVector3(3, 0.75, 4)
    )
  );

  groundedBodyRuntime.dispose();
});
