import assert from "node:assert/strict";
import test from "node:test";

import {
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
