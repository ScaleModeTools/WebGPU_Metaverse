import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseGroundedBodyStepStateSnapshot,
  prepareMetaverseGroundedBodyStep,
  resolveMetaverseGroundedBodyControllerStep,
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

function assertApprox(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
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

test("shared grounded traversal kernel resolves controller results into the same grounded step state", () => {
  const groundedStepState = createMetaverseGroundedBodyStepStateSnapshot({
    grounded: false,
    jumpGroundContactGraceSecondsRemaining: 0.12,
    jumpReady: true,
    position: {
      x: 1.4,
      y: 0.72,
      z: -0.8
    },
    strafeSpeedUnitsPerSecond: 0.75,
    verticalSpeedUnitsPerSecond: -1.4,
    yawRadians: Math.PI * 0.125
  });
  const preparedStep = prepareMetaverseGroundedBodyStep(
    groundedStepState,
    {
      boost: true,
      jump: false,
      moveAxis: 0.85,
      strafeAxis: -0.15,
      turnAxis: 0.3
    },
    groundedBodyStepConfig,
    0.033
  );

  assert.equal(preparedStep.driveTarget.boost, true);
  assert.equal(preparedStep.driveTarget.moveAxis, 0.85);
  assert.equal(preparedStep.driveTarget.strafeAxis, -0.15);
  assert.ok(preparedStep.driveTarget.targetPlanarSpeedUnitsPerSecond > 0);
  const directResolvedStep = resolveMetaverseGroundedBodyStep(
    groundedStepState,
    preparedStep,
    {
      x: 1.62,
      y: 0.6,
      z: -0.73
    },
    true,
    groundedBodyStepConfig,
    0.033
  );
  const controllerResolvedStep = resolveMetaverseGroundedBodyControllerStep(
    groundedStepState,
    preparedStep,
    {
      colliderCenterPosition: {
        x: 1.55,
        y: 1.41,
        z: -0.78
      },
      computedGrounded: true,
      computedMovementDelta: {
        x: 0.07,
        y: 0.01,
        z: 0.05
      },
      standingOffsetMeters: 0.82
    },
    groundedBodyStepConfig,
    0.033
  );

  assert.deepEqual(
    {
      ...controllerResolvedStep,
      state: {
        ...controllerResolvedStep.state,
        contact: undefined
      }
    },
    {
      ...directResolvedStep,
      state: {
        ...directResolvedStep.state,
        contact: undefined
      }
    }
  );
  assert.deepEqual(controllerResolvedStep.state.contact, {
    appliedMovementDelta: {
      x: 0.07,
      y: 0.01,
      z: 0.05
    },
    blockedPlanarMovement: true,
    blockedVerticalMovement: true,
    desiredMovementDelta: preparedStep.desiredMovementDelta,
    supportingContactDetected: true
  });
  assert.deepEqual(
    controllerResolvedStep.state.driveTarget,
    preparedStep.driveTarget
  );
});
