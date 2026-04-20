import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";
import {
  createFakePhysicsRuntime,
  createFakePhysicsRuntimeWithWorld,
  FakeRapierVector3
} from "./fake-rapier-runtime.mjs";

let clientLoader;

function readGroundedBodyJumpReady(snapshot) {
  return snapshot.jumpBody.jumpReady;
}

function readGroundedBodyPlanarSpeed(snapshot) {
  return Math.hypot(snapshot.linearVelocity.x, snapshot.linearVelocity.z);
}

function readGroundedBodyVerticalSpeed(snapshot) {
  return snapshot.jumpBody.verticalSpeedUnitsPerSecond;
}

function advanceGroundedBodyRuntime(
  physicsRuntime,
  groundedBodyRuntime,
  intentSnapshot,
  deltaSeconds,
  filterPredicate
) {
  physicsRuntime.stepSimulation(deltaSeconds);

  return groundedBodyRuntime.advance(
    intentSnapshot,
    deltaSeconds,
    filterPredicate
  );
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

  const advancedSnapshot = advanceGroundedBodyRuntime(
    physicsRuntime,
    groundedBodyRuntime,
    {
      boost: true,
      moveAxis: 1,
      turnAxis: 0
    },
    0.5
  );

  assert.equal(advancedSnapshot.grounded, true);
  assert.equal(advancedSnapshot.jumpBody.grounded, true);
  assert.equal(
    advancedSnapshot.jumpBody.jumpReady,
    readGroundedBodyJumpReady(advancedSnapshot)
  );
  assert.equal(advancedSnapshot.position.y, 0);
  assert.equal(advancedSnapshot.eyeHeightMeters, 1.62);
  assert.ok(readGroundedBodyPlanarSpeed(advancedSnapshot) > 0);
  assert.equal(advancedSnapshot.contact.supportingContactDetected, true);
  assert.equal(advancedSnapshot.contact.blockedPlanarMovement, false);
  assert.equal(advancedSnapshot.driveTarget.boost, true);
  assert.equal(advancedSnapshot.driveTarget.moveAxis, 1);
  assert.equal(advancedSnapshot.driveTarget.strafeAxis, 0);
  assert.ok(advancedSnapshot.driveTarget.targetPlanarSpeedUnitsPerSecond > 0);
  assert.deepEqual(
    advancedSnapshot.linearVelocity,
    groundedBodyRuntime.linearVelocitySnapshot
  );
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
      advanceGroundedBodyRuntime(
        physicsRuntime,
        groundedBodyRuntime,
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

    advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: false,
        moveAxis: 1,
        strafeAxis: 0,
        turnAxis: 0
      },
      0.25
    );

    const jumpSnapshot = advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: true,
        moveAxis: 1,
        strafeAxis: 0,
        turnAxis: 0
      },
      0.05
    );
    const airborneContinuationSnapshot = advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
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
    assert.ok(readGroundedBodyPlanarSpeed(jumpSnapshot) > 0);
    assert.ok(
      readGroundedBodyPlanarSpeed(airborneContinuationSnapshot) >=
        readGroundedBodyPlanarSpeed(jumpSnapshot) * 0.9
    );
  } finally {
    groundedBodyRuntime.dispose();
    physicsRuntime.removeCollider(groundCollider);
  }
});

test("MetaverseGroundedBodyRuntime does not let snap-to-ground clip the first grounded jump step", async () => {
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
      jumpImpulseUnitsPerSecond: 6.8,
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

    advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      },
      1 / 60
    );

    const jumpSnapshot = advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: true,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      },
      1 / 30
    );

    assert.equal(jumpSnapshot.grounded, false);
    assert.ok(jumpSnapshot.position.y > 0);
    assert.ok(readGroundedBodyVerticalSpeed(jumpSnapshot) > 0);
  } finally {
    groundedBodyRuntime.dispose();
    physicsRuntime.removeCollider(groundCollider);
  }
});

test("MetaverseGroundedBodyRuntime keeps a launched jump airborne below snap distance until touchdown", async () => {
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
      jumpImpulseUnitsPerSecond: 6.8,
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

    advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      },
      1 / 60
    );

    let snapshot = advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: true,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      },
      1 / 30
    );
    let sawDescendingNearGroundAirborne = false;

    for (let stepIndex = 0; stepIndex < 40 && snapshot.grounded !== true; stepIndex += 1) {
      snapshot = advanceGroundedBodyRuntime(
        physicsRuntime,
        groundedBodyRuntime,
        {
          boost: false,
          jump: false,
          moveAxis: 0,
          strafeAxis: 0,
          turnAxis: 0
        },
        1 / 30
      );

      if (
        snapshot.grounded !== true &&
        readGroundedBodyVerticalSpeed(snapshot) < 0 &&
        snapshot.position.y > 0 &&
        snapshot.position.y < 0.18
      ) {
        sawDescendingNearGroundAirborne = true;
      }
    }

    assert.equal(snapshot.grounded, true);
    assert.ok(sawDescendingNearGroundAirborne);
  } finally {
    groundedBodyRuntime.dispose();
    physicsRuntime.removeCollider(groundCollider);
  }
});

test("MetaverseGroundedBodyRuntime keeps jump readiness briefly after contact is lost", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);

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
      jumpGroundContactGraceSeconds: 0.125,
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

    advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      },
      1 / 60
    );

    world.removeCollider(groundCollider);

    const contactLostSnapshot = advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      },
      1 / 60
    );
    const coyoteJumpSnapshot = advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: true,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      },
      1 / 60
    );

    assert.equal(contactLostSnapshot.grounded, false);
    assert.equal(readGroundedBodyJumpReady(contactLostSnapshot), true);
    assert.equal(coyoteJumpSnapshot.grounded, false);
    assert.ok(coyoteJumpSnapshot.position.y > contactLostSnapshot.position.y);
    assert.ok(readGroundedBodyVerticalSpeed(coyoteJumpSnapshot) > 0);
    assert.equal(readGroundedBodyJumpReady(coyoteJumpSnapshot), false);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseGroundedBodyRuntime honors higher-level jump readiness overrides while support is within snap distance", async () => {
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
      jumpGroundContactGraceSeconds: 0.125,
      jumpImpulseUnitsPerSecond: 6.8,
      maxTurnSpeedRadiansPerSecond: Math.PI * 0.5,
      snapToGroundDistanceMeters: 0.22,
      spawnPosition: {
        x: 0,
        y: 0.12,
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
        y: 0.12,
        z: 0
      },
      0
    );

    let snapshot = advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: true,
        jumpReadyOverride: true,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      },
      1 / 60
    );

    for (let stepIndex = 0; stepIndex < 2; stepIndex += 1) {
      if (
        readGroundedBodyVerticalSpeed(snapshot) > 0 ||
        snapshot.position.y > 0.12
      ) {
        break;
      }

      snapshot = advanceGroundedBodyRuntime(
        physicsRuntime,
        groundedBodyRuntime,
        {
          boost: false,
          jump: false,
          moveAxis: 0,
          strafeAxis: 0,
          turnAxis: 0
        },
        1 / 60
      );
    }

    assert.ok(
      readGroundedBodyVerticalSpeed(snapshot) > 0 || snapshot.position.y > 0.12
    );
    assert.equal(readGroundedBodyJumpReady(snapshot), false);
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
      advanceGroundedBodyRuntime(
        physicsRuntime,
        groundedBodyRuntime,
        {
          boost: false,
          moveAxis: 1,
          turnAxis: 0
        },
        1 / 60
      );
    }

    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.equal(groundedBodyRuntime.snapshot.contact.blockedPlanarMovement, true);
    assert.equal(groundedBodyRuntime.snapshot.contact.supportingContactDetected, true);
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

    const snapshot = advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
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
    assert.equal(readGroundedBodyJumpReady(snapshot), true);
  } finally {
    groundedBodyRuntime.dispose();
    physicsRuntime.removeCollider(groundCollider);
  }
});

test("MetaverseGroundedBodyRuntime syncs dynamic-body interaction through the grounded body owner", async () => {
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

  groundedBodyRuntime.syncInteractionSnapshot({
    applyImpulsesToDynamicBodies: true
  });
  await groundedBodyRuntime.init();

  assert.equal(world.lastCharacterController?.applyImpulsesToDynamicBodies, true);

  groundedBodyRuntime.syncInteractionSnapshot({
    applyImpulsesToDynamicBodies: false
  });

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

test("MetaverseGroundedBodyRuntime consumes a host-stepped physics world instead of stepping it internally", async () => {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const { physicsRuntime } = createFakePhysicsRuntimeWithWorld(
    RapierPhysicsRuntime
  );

  await physicsRuntime.init();

  const groundCollider = physicsRuntime.createFixedCuboidCollider(
    { x: 4, y: 0.5, z: 4 },
    { x: 0, y: -0.5, z: 0 }
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

    const staleWorldSnapshot = groundedBodyRuntime.advance(
      {
        boost: false,
        jump: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      },
      1 / 60
    );

    assert.equal(staleWorldSnapshot.grounded, false);

    const steppedWorldSnapshot = advanceGroundedBodyRuntime(
      physicsRuntime,
      groundedBodyRuntime,
      {
        boost: false,
        jump: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      },
      1 / 60
    );

    assert.equal(steppedWorldSnapshot.grounded, true);
  } finally {
    groundedBodyRuntime.dispose();
    physicsRuntime.removeCollider(groundCollider);
  }
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
