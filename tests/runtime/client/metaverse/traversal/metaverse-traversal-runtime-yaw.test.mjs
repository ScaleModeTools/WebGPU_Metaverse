import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createFlatGroundSurfaceColliderSnapshot,
  createTraversalFixtureContext,
  freezeVector3,
  groundedFixedStepSeconds,
  syncAuthoritativeLocalPlayerPose
} from "./fixtures/traversal-test-fixtures.mjs";

const lookRightInput = Object.freeze({
  boost: false,
  jump: false,
  moveAxis: 0,
  pitchAxis: 0,
  primaryAction: false,
  secondaryAction: false,
  strafeAxis: 0,
  yawAxis: 1
});

let fixtureContext;

before(async () => {
  fixtureContext = await createTraversalFixtureContext();
});

after(async () => {
  await fixtureContext?.dispose();
});

test("MetaverseTraversalRuntime steers grounded and swim character yaw from look input", async () => {
  const groundedHarness = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
  });
  const swimHarness = await fixtureContext.createOpenWaterTraversalHarness();

  try {
    groundedHarness.traversalRuntime.boot();
    assert.equal(groundedHarness.traversalRuntime.locomotionMode, "grounded");

    const groundedStartYaw =
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians;
    groundedHarness.traversalRuntime.advance(
      lookRightInput,
      groundedFixedStepSeconds
    );

    assert.ok(
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians >
        groundedStartYaw
    );
    assert.equal(
      groundedHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians,
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians
    );

    swimHarness.traversalRuntime.boot();
    assert.equal(swimHarness.traversalRuntime.locomotionMode, "swim");

    const swimStartYaw = swimHarness.traversalRuntime.cameraSnapshot.yawRadians;
    swimHarness.traversalRuntime.advance(lookRightInput, 1 / 60);

    assert.ok(swimHarness.traversalRuntime.cameraSnapshot.yawRadians > swimStartYaw);
    assert.equal(
      swimHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians,
      swimHarness.traversalRuntime.cameraSnapshot.yawRadians
    );
  } finally {
    groundedHarness.groundedBodyRuntime.dispose();
    swimHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps grounded character yaw reticle-aligned between authoritative fixed steps", async () => {
  const groundedHarness = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
  });

  try {
    groundedHarness.traversalRuntime.boot();
    assert.equal(groundedHarness.traversalRuntime.locomotionMode, "grounded");

    const groundedBodyYawBeforeTurn =
      groundedHarness.groundedBodyRuntime.snapshot.yawRadians;

    groundedHarness.traversalRuntime.advance(
      lookRightInput,
      groundedFixedStepSeconds * 0.5
    );

    assert.ok(
      Math.abs(
        groundedHarness.groundedBodyRuntime.snapshot.yawRadians -
          groundedBodyYawBeforeTurn
      ) < 0.000001
    );
    assert.equal(
      groundedHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians,
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians
    );
    assert.ok(
      Math.abs(
        groundedHarness.traversalRuntime.characterPresentationSnapshot.yawRadians -
          groundedBodyYawBeforeTurn
      ) > 0.000001
    );
  } finally {
    groundedHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores routine authoritative unmounted yaw drift while keeping local look client-owned", async () => {
  const groundedHarness = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
  });
  const swimHarness = await fixtureContext.createOpenWaterTraversalHarness();

  try {
    groundedHarness.traversalRuntime.boot();
    groundedHarness.traversalRuntime.advance(lookRightInput, 1 / 60);

    const groundedCameraYawBeforeCorrection =
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians;
    const groundedBodyYawBeforeCorrection =
      groundedHarness.groundedBodyRuntime.snapshot.yawRadians;
    const groundedTraversalPose =
      groundedHarness.traversalRuntime.localTraversalPoseSnapshot;

    assert.ok(groundedTraversalPose !== null);

    syncAuthoritativeLocalPlayerPose(groundedHarness.traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedTraversalPose.position,
      yawRadians: groundedTraversalPose.yawRadians - 0.3
    });

    assert.ok(
      Math.abs(
        groundedHarness.traversalRuntime.cameraSnapshot.yawRadians -
          groundedCameraYawBeforeCorrection
      ) < 0.000001
    );
    assert.equal(groundedHarness.traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.ok(
      Math.abs(
        groundedHarness.groundedBodyRuntime.snapshot.yawRadians -
          groundedBodyYawBeforeCorrection
      ) < 0.000001
    );

    swimHarness.traversalRuntime.boot();
    swimHarness.traversalRuntime.advance(lookRightInput, 1 / 60);

    const swimCameraYawBeforeCorrection =
      swimHarness.traversalRuntime.cameraSnapshot.yawRadians;
    const swimPresentationYawBeforeCorrection =
      swimHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians ?? 0;
    const swimTraversalPose = swimHarness.traversalRuntime.localTraversalPoseSnapshot;

    assert.ok(swimTraversalPose !== null);
    assert.equal(swimTraversalPose.locomotionMode, "swim");

    syncAuthoritativeLocalPlayerPose(swimHarness.traversalRuntime, {
      jumpAuthorityState: "none",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, -2.2),
      locomotionMode: "swim",
      mountedOccupancy: null,
      position: swimTraversalPose.position,
      yawRadians: swimTraversalPose.yawRadians - 0.3
    });

    assert.ok(
      Math.abs(
        swimHarness.traversalRuntime.cameraSnapshot.yawRadians -
          swimCameraYawBeforeCorrection
      ) < 0.000001
    );
    assert.equal(swimHarness.traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.ok(
      Math.abs(
        (swimHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians ?? 0) -
          swimPresentationYawBeforeCorrection
      ) < 0.000001
    );
  } finally {
    groundedHarness.groundedBodyRuntime.dispose();
    swimHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores gross authoritative unmounted yaw drift while keeping local look client-owned", async () => {
  const groundedHarness = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
  });
  const swimHarness = await fixtureContext.createOpenWaterTraversalHarness();

  try {
    groundedHarness.traversalRuntime.boot();
    groundedHarness.traversalRuntime.advance(
      lookRightInput,
      groundedFixedStepSeconds
    );

    const groundedLookYaw =
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians;
    const groundedTraversalPoseBeforeCorrection =
      groundedHarness.traversalRuntime.localTraversalPoseSnapshot;

    assert.ok(groundedTraversalPoseBeforeCorrection !== null);

    syncAuthoritativeLocalPlayerPose(groundedHarness.traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedTraversalPoseBeforeCorrection.position,
      yawRadians: groundedTraversalPoseBeforeCorrection.yawRadians - 0.7
    });

    assert.equal(
      groundedHarness.traversalRuntime.localReconciliationCorrectionCount,
      0
    );
    assert.ok(
      Math.abs(groundedHarness.groundedBodyRuntime.snapshot.yawRadians - groundedLookYaw) <
        0.000001
    );

    swimHarness.traversalRuntime.boot();
    swimHarness.traversalRuntime.advance(lookRightInput, 1 / 60);

    const swimLookYaw = swimHarness.traversalRuntime.cameraSnapshot.yawRadians;
    const swimTraversalPoseBeforeCorrection =
      swimHarness.traversalRuntime.localTraversalPoseSnapshot;

    assert.ok(swimTraversalPoseBeforeCorrection !== null);
    assert.equal(swimTraversalPoseBeforeCorrection.locomotionMode, "swim");

    syncAuthoritativeLocalPlayerPose(swimHarness.traversalRuntime, {
      jumpAuthorityState: "none",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, -2.2),
      locomotionMode: "swim",
      mountedOccupancy: null,
      position: swimTraversalPoseBeforeCorrection.position,
      yawRadians: swimTraversalPoseBeforeCorrection.yawRadians - 0.7
    });

    assert.equal(
      swimHarness.traversalRuntime.localReconciliationCorrectionCount,
      0
    );
    assert.ok(
      Math.abs(
        (swimHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians ?? 0) -
          swimLookYaw
      ) < 0.000001
    );
  } finally {
    groundedHarness.groundedBodyRuntime.dispose();
    swimHarness.groundedBodyRuntime.dispose();
  }
});
