import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceMetaverseDeterministicUnmountedGroundedBodyStep,
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaverseGroundedBodyStepStateSnapshot,
  prepareMetaverseGroundedBodyStep,
  resolveMetaverseGroundedBodyStep,
  syncMetaverseGroundedBodyStepState
} from "@webgpu-metaverse/shared";

const groundedBodyStepConfig = Object.freeze({
  accelerationCurveExponent: 1.22,
  accelerationUnitsPerSecondSquared: 22,
  airborneMovementDampingFactor: 0.42,
  baseSpeedUnitsPerSecond: 8.5,
  boostCurveExponent: 1.08,
  boostMultiplier: 1.75,
  decelerationUnitsPerSecondSquared: 30,
  dragCurveExponent: 1.5,
  gravityUnitsPerSecond: 18,
  jumpGroundContactGraceSeconds: 0.2,
  jumpImpulseUnitsPerSecond: 6.8,
  maxTurnSpeedRadiansPerSecond: 3.6,
  worldRadius: 110
});
const deterministicGroundedBodyConfig = Object.freeze({
  ...groundedBodyStepConfig,
  capsuleHalfHeightMeters: 0.48,
  capsuleRadiusMeters: 0.34,
  controllerOffsetMeters: 0.02,
  maxSlopeClimbAngleRadians: Math.PI * 0.26,
  minSlopeSlideAngleRadians: Math.PI * 0.34,
  snapToGroundDistanceMeters: 0.22,
  spawnPosition: Object.freeze({ x: 0, y: 0.6, z: 0 }),
  stepHeightMeters: 0.28,
  stepWidthMeters: 0.24
});
const surfacePolicyConfig = Object.freeze({
  capsuleHalfHeightMeters: deterministicGroundedBodyConfig.capsuleHalfHeightMeters,
  capsuleRadiusMeters: deterministicGroundedBodyConfig.capsuleRadiusMeters,
  gravityUnitsPerSecond: deterministicGroundedBodyConfig.gravityUnitsPerSecond,
  jumpImpulseUnitsPerSecond:
    deterministicGroundedBodyConfig.jumpImpulseUnitsPerSecond,
  oceanHeightMeters: 0,
  stepHeightMeters: deterministicGroundedBodyConfig.stepHeightMeters
});

function assertApprox(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function createSupportCollider(surfaceHeightMeters) {
  return Object.freeze({
    halfExtents: freezeVector3(8, 0.1, 8),
    ownerEnvironmentAssetId: null,
    rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
    rotationYRadians: 0,
    translation: freezeVector3(0, surfaceHeightMeters - 0.1, 0),
    traversalAffordance: "support"
  });
}

test("shared grounded traversal kernel keeps jump snap suppression active until touchdown", () => {
  const groundedStepState = createMetaverseGroundedBodyStepStateSnapshot({
    grounded: true,
    jumpReady: true,
    position: {
      x: 0,
      y: 0.6,
      z: 0
    }
  });
  const preparedJumpStep = prepareMetaverseGroundedBodyStep(
    groundedStepState,
    {
      boost: false,
      jump: true,
      moveAxis: 1,
      strafeAxis: 0,
      turnAxis: 0
    },
    groundedBodyStepConfig,
    0.033
  );

  assert.equal(preparedJumpStep.jumpRequested, true);
  assert.equal(preparedJumpStep.snapToGroundEnabled, false);

  const airborneResolvedStep = resolveMetaverseGroundedBodyStep(
    groundedStepState,
    preparedJumpStep,
    {
      x: 0.18,
      y: 0.82,
      z: 0
    },
    false,
    groundedBodyStepConfig,
    0.033
  );

  assert.equal(airborneResolvedStep.state.grounded, false);
  assert.equal(airborneResolvedStep.state.jumpReady, false);
  assert.equal(airborneResolvedStep.state.jumpSnapSuppressionActive, true);

  const descentPreparedStep = prepareMetaverseGroundedBodyStep(
    airborneResolvedStep.state,
    {
      boost: false,
      jump: false,
      moveAxis: 1,
      strafeAxis: 0,
      turnAxis: 0
    },
    groundedBodyStepConfig,
    0.033
  );

  assert.equal(descentPreparedStep.snapToGroundEnabled, false);

  const landedResolvedStep = resolveMetaverseGroundedBodyStep(
    airborneResolvedStep.state,
    descentPreparedStep,
    {
      x: 0.26,
      y: 0.6,
      z: 0
    },
    true,
    groundedBodyStepConfig,
    0.033
  );

  assert.equal(landedResolvedStep.state.grounded, true);
  assert.equal(landedResolvedStep.state.jumpReady, true);
  assert.equal(landedResolvedStep.state.jumpSnapSuppressionActive, false);
  assertApprox(
    landedResolvedStep.state.jumpGroundContactGraceSecondsRemaining,
    groundedBodyStepConfig.jumpGroundContactGraceSeconds
  );
});

test("shared grounded traversal kernel applies accepted jump impulse along support normal", () => {
  const deltaSeconds = 0.033;
  const groundedStepState = createMetaverseGroundedBodyStepStateSnapshot({
    grounded: true,
    jumpReady: true,
    position: {
      x: 0,
      y: 0.6,
      z: 0
    },
    supportNormal: {
      x: 0,
      y: 0.8,
      z: 0.6
    }
  });
  const preparedJumpStep = prepareMetaverseGroundedBodyStep(
    groundedStepState,
    {
      boost: false,
      jump: true,
      moveAxis: 0,
      strafeAxis: 0,
      turnAxis: 0
    },
    groundedBodyStepConfig,
    deltaSeconds
  );
  const expectedVerticalSpeed =
    groundedBodyStepConfig.jumpImpulseUnitsPerSecond * 0.8 -
    groundedBodyStepConfig.gravityUnitsPerSecond * deltaSeconds;

  assert.equal(preparedJumpStep.jumpRequested, true);
  assert.equal(preparedJumpStep.snapToGroundEnabled, false);
  assertApprox(
    preparedJumpStep.verticalSpeedUnitsPerSecond,
    expectedVerticalSpeed
  );
  assertApprox(preparedJumpStep.desiredMovementDelta.x, 0);
  assertApprox(
    preparedJumpStep.desiredMovementDelta.y,
    expectedVerticalSpeed * deltaSeconds
  );
  assertApprox(
    preparedJumpStep.desiredMovementDelta.z,
    groundedBodyStepConfig.jumpImpulseUnitsPerSecond * 0.6 * deltaSeconds
  );
});

test("shared grounded traversal kernel syncs authoritative state without discarding airborne snap suppression", () => {
  const previousState = createMetaverseGroundedBodyStepStateSnapshot({
    grounded: false,
    jumpGroundContactGraceSecondsRemaining: 0,
    jumpReady: false,
    jumpSnapSuppressionActive: true,
    position: {
      x: 1,
      y: 1.2,
      z: -2
    },
    verticalSpeedUnitsPerSecond: -2.4,
    yawRadians: Math.PI * 0.25
  });
  const syncedState = syncMetaverseGroundedBodyStepState(
    previousState,
    {
      grounded: false,
      linearVelocity: {
        x: 1.5,
        y: -3.2,
        z: -0.5
      },
      position: {
        x: 1.1,
        y: 1.05,
        z: -2.05
      },
      yawRadians: Math.PI * 0.25
    },
    groundedBodyStepConfig
  );

  assert.equal(syncedState.grounded, false);
  assert.equal(syncedState.jumpReady, false);
  assert.equal(syncedState.jumpSnapSuppressionActive, true);
  assertApprox(syncedState.position.x, 1.1);
  assertApprox(syncedState.position.y, 1.05);
  assertApprox(syncedState.position.z, -2.05);
});

test("shared grounded traversal kernel resolves deterministic support without controller movement", () => {
  const currentSnapshot = createMetaverseGroundedBodyRuntimeSnapshot({
    grounded: true,
    linearVelocity: freezeVector3(0, 0, 0),
    position: freezeVector3(1.4, 0.6, -0.8),
    yawRadians: Math.PI * 0.125
  });
  const resolvedSnapshot = advanceMetaverseDeterministicUnmountedGroundedBodyStep({
    autostepHeightMeters: null,
    bodyIntent: Object.freeze({
      boost: true,
      jump: false,
      moveAxis: 0.85,
      strafeAxis: -0.15,
      turnAxis: 0.3
    }),
    currentGroundedBodySnapshot: currentSnapshot,
    deltaSeconds: 0.033,
    groundedBodyConfig: deterministicGroundedBodyConfig,
    preferredLookYawRadians: null,
    surfaceColliderSnapshots: Object.freeze([createSupportCollider(0.6)]),
    surfacePolicyConfig
  });

  assert.equal(resolvedSnapshot.grounded, true);
  assertApprox(resolvedSnapshot.position.y, 0.6);
  assert.equal(resolvedSnapshot.driveTarget.boost, true);
  assert.equal(resolvedSnapshot.driveTarget.moveAxis, 0.85);
  assert.equal(resolvedSnapshot.driveTarget.strafeAxis, -0.15);
  assert.ok(resolvedSnapshot.driveTarget.targetPlanarSpeedUnitsPerSecond > 0);
  assert.equal(resolvedSnapshot.contact.supportingContactDetected, true);
  assert.equal(resolvedSnapshot.contact.blockedPlanarMovement, false);
  assert.equal(resolvedSnapshot.contact.blockedVerticalMovement, false);
});

test("shared grounded traversal kernel treats support lift as support, not blocked vertical movement", () => {
  const currentSnapshot = createMetaverseGroundedBodyRuntimeSnapshot({
    grounded: true,
    linearVelocity: freezeVector3(0, 0, -0.5),
    position: freezeVector3(0, 0.6, 0),
    yawRadians: 0
  });
  const resolvedSnapshot = advanceMetaverseDeterministicUnmountedGroundedBodyStep({
    autostepHeightMeters: null,
    bodyIntent: Object.freeze({
      boost: false,
      jump: false,
      moveAxis: 1,
      strafeAxis: 0,
      turnAxis: 0
    }),
    currentGroundedBodySnapshot: currentSnapshot,
    deltaSeconds: 0.033,
    groundedBodyConfig: deterministicGroundedBodyConfig,
    preferredLookYawRadians: null,
    surfaceColliderSnapshots: Object.freeze([createSupportCollider(0.6193)]),
    surfacePolicyConfig
  });

  assert.equal(resolvedSnapshot.grounded, true);
  assert.equal(resolvedSnapshot.contact.supportingContactDetected, true);
  assert.equal(resolvedSnapshot.contact.blockedVerticalMovement, false);
  assertApprox(resolvedSnapshot.position.y, 0.6193);
});
