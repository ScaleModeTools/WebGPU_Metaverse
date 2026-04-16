import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareMetaverseGroundedTraversalStep,
  resolveMetaverseGroundedTraversalDirectionalSpeeds,
  resolveMetaverseGroundedTraversalStep
} from "@webgpu-metaverse/shared";

const groundedTraversalConfig = Object.freeze({
  accelerationCurveExponent: 1.2,
  accelerationUnitsPerSecondSquared: 20,
  airborneMovementDampingFactor: 0.42,
  baseSpeedUnitsPerSecond: 6,
  boostCurveExponent: 1.1,
  boostMultiplier: 1.65,
  decelerationUnitsPerSecondSquared: 26,
  dragCurveExponent: 1.45,
  gravityUnitsPerSecond: 18,
  jumpImpulseUnitsPerSecond: 6.8,
  maxTurnSpeedRadiansPerSecond: Math.PI,
  worldRadius: 10
});

function assertApprox(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("shared grounded traversal kernel prepares jump intent and resolves world-radius-clamped movement", () => {
  const preparedStep = prepareMetaverseGroundedTraversalStep(
    {
      forwardSpeedUnitsPerSecond: 0,
      grounded: true,
      jumpReady: true,
      position: {
        x: 9.5,
        y: 0.4,
        z: 0
      },
      strafeSpeedUnitsPerSecond: 0,
      verticalSpeedUnitsPerSecond: 0,
      yawRadians: 0
    },
    {
      boost: false,
      jump: true,
      moveAxis: 1,
      strafeAxis: 0,
      turnAxis: -1
    },
    groundedTraversalConfig,
    0.25,
    Math.PI
  );

  assert.equal(preparedStep.jumpRequested, true);
  assertApprox(preparedStep.verticalSpeedUnitsPerSecond, 2.3);
  assertApprox(preparedStep.desiredMovementDelta.y, 0.575);
  assertApprox(preparedStep.yawRadians, Math.PI);

  const resolvedStep = resolveMetaverseGroundedTraversalStep(
    {
      x: 9.5,
      y: 0.4,
      z: 0
    },
    {
      x: 11.5,
      y: 1.4,
      z: 0
    },
    Math.PI * 0.5,
    false,
    0.5,
    groundedTraversalConfig.worldRadius
  );

  assertApprox(resolvedStep.position.x, 10);
  assertApprox(resolvedStep.position.y, 1.4);
  assertApprox(resolvedStep.position.z, 0);
  assertApprox(resolvedStep.forwardSpeedUnitsPerSecond, 1);
  assertApprox(resolvedStep.strafeSpeedUnitsPerSecond, 0);
  assertApprox(resolvedStep.planarSpeedUnitsPerSecond, 1);
  assertApprox(resolvedStep.verticalSpeedUnitsPerSecond, 2);
});

test("shared grounded traversal kernel decomposes authoritative linear velocity into yaw-relative directional speeds", () => {
  const directionalSpeedSnapshot =
    resolveMetaverseGroundedTraversalDirectionalSpeeds(
      {
        x: 3,
        y: 5,
        z: 4
      },
      Math.PI * 0.5,
      false
    );

  assertApprox(directionalSpeedSnapshot.forwardSpeedUnitsPerSecond, 3);
  assertApprox(directionalSpeedSnapshot.strafeSpeedUnitsPerSecond, 4);
  assertApprox(directionalSpeedSnapshot.planarSpeedUnitsPerSecond, 5);
  assertApprox(directionalSpeedSnapshot.verticalSpeedUnitsPerSecond, 5);
});
