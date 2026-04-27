import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createTraversalFixtureContext,
  forwardTravelInput,
  freezeVector3,
  groundedFixedStepSeconds
} from "./fixtures/traversal-test-fixtures.mjs";

let fixtureContext;

const forwardJumpTravelInput = Object.freeze({
  ...forwardTravelInput,
  jump: true
});
const idleTravelInput = Object.freeze({
  ...forwardTravelInput,
  moveAxis: 0
});

function assertApprox(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function readGroundedBodyJumpReady(snapshot) {
  return snapshot.jumpBody.jumpReady;
}

function readGroundedBodyPlanarSpeed(snapshot) {
  return Math.hypot(snapshot.linearVelocity.x, snapshot.linearVelocity.z);
}

function readGroundedBodyVerticalSpeed(snapshot) {
  return snapshot.jumpBody.verticalSpeedUnitsPerSecond;
}

function assertGroundedBodySnapshotsMatch(leftSnapshot, rightSnapshot) {
  assert.equal(leftSnapshot.grounded, rightSnapshot.grounded);
  assert.equal(
    readGroundedBodyJumpReady(leftSnapshot),
    readGroundedBodyJumpReady(rightSnapshot)
  );
  assertApprox(leftSnapshot.position.x, rightSnapshot.position.x);
  assertApprox(leftSnapshot.position.y, rightSnapshot.position.y);
  assertApprox(leftSnapshot.position.z, rightSnapshot.position.z);
  assertApprox(
    readGroundedBodyPlanarSpeed(leftSnapshot),
    readGroundedBodyPlanarSpeed(rightSnapshot)
  );
  assertApprox(
    readGroundedBodyVerticalSpeed(leftSnapshot),
    readGroundedBodyVerticalSpeed(rightSnapshot)
  );
  assertApprox(leftSnapshot.yawRadians, rightSnapshot.yawRadians);
}

function assertCameraSnapshotsMatch(leftSnapshot, rightSnapshot) {
  assertApprox(leftSnapshot.position.x, rightSnapshot.position.x);
  assertApprox(leftSnapshot.position.y, rightSnapshot.position.y);
  assertApprox(leftSnapshot.position.z, rightSnapshot.position.z);
  assertApprox(leftSnapshot.pitchRadians, rightSnapshot.pitchRadians);
  assertApprox(leftSnapshot.yawRadians, rightSnapshot.yawRadians);
}

function assertLocalTraversalPoseSnapshotsMatch(leftSnapshot, rightSnapshot) {
  assert.notEqual(leftSnapshot, null);
  assert.notEqual(rightSnapshot, null);
  assert.equal(leftSnapshot.locomotionMode, rightSnapshot.locomotionMode);
  assertApprox(leftSnapshot.position.x, rightSnapshot.position.x);
  assertApprox(leftSnapshot.position.y, rightSnapshot.position.y);
  assertApprox(leftSnapshot.position.z, rightSnapshot.position.z);
  assertApprox(leftSnapshot.yawRadians, rightSnapshot.yawRadians);
}

before(async () => {
  fixtureContext = await createTraversalFixtureContext();
});

after(async () => {
  await fixtureContext?.dispose();
});

test("MetaverseTraversalRuntime advances grounded prediction in authoritative fixed steps across split render frames", async () => {
  const surfaceColliderSnapshots = [
    Object.freeze({
      halfExtents: freezeVector3(4, 0.2, 4),
      rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
      translation: freezeVector3(0, -0.1, 24)
    })
  ];
  const splitHarness = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots
  });
  const wholeHarness = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots
  });

  try {
    splitHarness.traversalRuntime.boot();
    wholeHarness.traversalRuntime.boot();
    assert.equal(splitHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(wholeHarness.traversalRuntime.locomotionMode, "grounded");

    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    wholeHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds
    );

    assertGroundedBodySnapshotsMatch(
      splitHarness.groundedBodyRuntime.snapshot,
      wholeHarness.groundedBodyRuntime.snapshot
    );
    assertCameraSnapshotsMatch(
      splitHarness.traversalRuntime.cameraSnapshot,
      wholeHarness.traversalRuntime.cameraSnapshot
    );
    assert.equal(
      splitHarness.traversalRuntime.characterPresentationSnapshot
        ?.animationVocabulary,
      wholeHarness.traversalRuntime.characterPresentationSnapshot
        ?.animationVocabulary
    );
  } finally {
    splitHarness.groundedBodyRuntime.dispose();
    wholeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime sweeps sampled remote player blockers during fast grounded prediction", async () => {
  const blockerRootPosition = freezeVector3(0, 0, 22);
  let blockerSnapshot = null;
  const traversalHarness = await fixtureContext.createTraversalHarness({
    config: Object.freeze({
      groundedBody: Object.freeze({
        accelerationUnitsPerSecondSquared: 10000,
        baseSpeedUnitsPerSecond: 90,
        boostMultiplier: 1
      })
    }),
    readGroundedTraversalPlayerBlockers: () =>
      blockerSnapshot === null ? Object.freeze([]) : Object.freeze([blockerSnapshot])
  });

  try {
    blockerSnapshot = Object.freeze({
      capsuleHalfHeightMeters:
        traversalHarness.config.groundedBody.capsuleHalfHeightMeters,
      capsuleRadiusMeters:
        traversalHarness.config.groundedBody.capsuleRadiusMeters,
      playerId: "remote-player",
      position: blockerRootPosition
    });
    traversalHarness.traversalRuntime.boot();

    traversalHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds
    );

    const requiredClearanceMeters =
      traversalHarness.config.groundedBody.capsuleRadiusMeters * 2 +
      traversalHarness.config.groundedBody.controllerOffsetMeters;

    assert.ok(
      traversalHarness.groundedBodyRuntime.snapshot.position.z >=
        blockerRootPosition.z + requiredClearanceMeters - 0.02,
      `expected fast local prediction to stop at sampled remote player capsule, received ${JSON.stringify(traversalHarness.groundedBodyRuntime.snapshot.position)}`
    );
  } finally {
    traversalHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime advances swim prediction in authoritative fixed steps across split render frames", async () => {
  const splitHarness = await fixtureContext.createOpenWaterTraversalHarness();
  const wholeHarness = await fixtureContext.createOpenWaterTraversalHarness();

  try {
    splitHarness.traversalRuntime.boot();
    wholeHarness.traversalRuntime.boot();
    assert.equal(splitHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(wholeHarness.traversalRuntime.locomotionMode, "swim");

    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    wholeHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds
    );

    assertLocalTraversalPoseSnapshotsMatch(
      splitHarness.traversalRuntime.localTraversalPoseSnapshot,
      wholeHarness.traversalRuntime.localTraversalPoseSnapshot
    );
    assertCameraSnapshotsMatch(
      splitHarness.traversalRuntime.cameraSnapshot,
      wholeHarness.traversalRuntime.cameraSnapshot
    );
    assert.equal(
      splitHarness.traversalRuntime.characterPresentationSnapshot
        ?.animationVocabulary,
      wholeHarness.traversalRuntime.characterPresentationSnapshot
        ?.animationVocabulary
    );
  } finally {
    splitHarness.groundedBodyRuntime.dispose();
    wholeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves a grounded jump tap across split render frames before the next fixed step", async () => {
  const surfaceColliderSnapshots = [
    Object.freeze({
      halfExtents: freezeVector3(4, 0.2, 4),
      rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
      translation: freezeVector3(0, -0.1, 24)
    })
  ];
  const splitHarness = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots
  });
  const wholeHarness = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots
  });

  try {
    splitHarness.traversalRuntime.boot();
    wholeHarness.traversalRuntime.boot();
    assert.equal(splitHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(wholeHarness.traversalRuntime.locomotionMode, "grounded");

    splitHarness.traversalRuntime.advance(
      forwardJumpTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    assert.equal(splitHarness.groundedBodyRuntime.snapshot.grounded, true);

    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    wholeHarness.traversalRuntime.advance(
      forwardJumpTravelInput,
      groundedFixedStepSeconds
    );

    assert.equal(splitHarness.groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(splitHarness.groundedBodyRuntime.snapshot.position.y > 0);
    assertApprox(
      splitHarness.groundedBodyRuntime.snapshot.position.x,
      wholeHarness.groundedBodyRuntime.snapshot.position.x,
      0.01
    );
    assertApprox(
      splitHarness.groundedBodyRuntime.snapshot.position.y,
      wholeHarness.groundedBodyRuntime.snapshot.position.y,
      0.01
    );
    assertApprox(
      splitHarness.groundedBodyRuntime.snapshot.position.z,
      wholeHarness.groundedBodyRuntime.snapshot.position.z,
      0.01
    );
    assertApprox(
      readGroundedBodyVerticalSpeed(splitHarness.groundedBodyRuntime.snapshot),
      readGroundedBodyVerticalSpeed(wholeHarness.groundedBodyRuntime.snapshot),
      0.01
    );
    assertApprox(
      splitHarness.traversalRuntime.cameraSnapshot.position.x,
      wholeHarness.traversalRuntime.cameraSnapshot.position.x,
      0.01
    );
    assertApprox(
      splitHarness.traversalRuntime.cameraSnapshot.position.y,
      wholeHarness.traversalRuntime.cameraSnapshot.position.y,
      0.01
    );
    assertApprox(
      splitHarness.traversalRuntime.cameraSnapshot.position.z,
      wholeHarness.traversalRuntime.cameraSnapshot.position.z,
      0.01
    );
    assertApprox(
      splitHarness.traversalRuntime.cameraSnapshot.pitchRadians,
      wholeHarness.traversalRuntime.cameraSnapshot.pitchRadians,
      0.01
    );
    assertApprox(
      splitHarness.traversalRuntime.cameraSnapshot.yawRadians,
      wholeHarness.traversalRuntime.cameraSnapshot.yawRadians,
      0.01
    );
  } finally {
    splitHarness.groundedBodyRuntime.dispose();
    wholeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves a grounded movement tap across split render frames before the next fixed step", async () => {
  const surfaceColliderSnapshots = [
    Object.freeze({
      halfExtents: freezeVector3(4, 0.2, 4),
      rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
      translation: freezeVector3(0, -0.1, 24)
    })
  ];
  const splitHarness = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots
  });

  try {
    splitHarness.traversalRuntime.boot();
    assert.equal(splitHarness.traversalRuntime.locomotionMode, "grounded");

    const groundedStartPosition = splitHarness.groundedBodyRuntime.snapshot.position;

    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    splitHarness.traversalRuntime.advance(
      idleTravelInput,
      groundedFixedStepSeconds * 0.5
    );

    assert.equal(splitHarness.groundedBodyRuntime.snapshot.grounded, true);
    assert.ok(
      groundedStartPosition.z - splitHarness.groundedBodyRuntime.snapshot.position.z >
        0.01,
      `expected brief grounded movement tap to survive split render frames, received ${JSON.stringify(splitHarness.groundedBodyRuntime.snapshot)}`
    );
  } finally {
    splitHarness.groundedBodyRuntime.dispose();
  }
});
