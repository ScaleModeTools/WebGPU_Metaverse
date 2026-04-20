import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createTraversalFixtureContext,
  freezeVector3,
  groundedFixedStepSeconds
} from "./fixtures/traversal-test-fixtures.mjs";

let fixtureContext;

const forwardTravelInput = Object.freeze({
  boost: false,
  jump: false,
  moveAxis: 1,
  pitchAxis: 0,
  primaryAction: false,
  secondaryAction: false,
  strafeAxis: 0,
  yawAxis: 0
});

const forwardJumpTravelInput = Object.freeze({
  ...forwardTravelInput,
  jump: true
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
    assertGroundedBodySnapshotsMatch(
      splitHarness.groundedBodyRuntime.snapshot,
      wholeHarness.groundedBodyRuntime.snapshot
    );
    assertCameraSnapshotsMatch(
      splitHarness.traversalRuntime.cameraSnapshot,
      wholeHarness.traversalRuntime.cameraSnapshot
    );
  } finally {
    splitHarness.groundedBodyRuntime.dispose();
    wholeHarness.groundedBodyRuntime.dispose();
  }
});
