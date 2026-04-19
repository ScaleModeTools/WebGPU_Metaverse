import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseTraversalKinematicStateSnapshot,
  resolveMetaverseSurfaceDriveBodyStep
} from "@webgpu-metaverse/shared";

function assertApprox(actual, expected, epsilon = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

const locomotionConfig = Object.freeze({
  accelerationCurveExponent: 1,
  accelerationUnitsPerSecondSquared: 24,
  baseSpeedUnitsPerSecond: 4,
  boostCurveExponent: 1,
  boostMultiplier: 1.4,
  decelerationUnitsPerSecondSquared: 24,
  dragCurveExponent: 1,
  maxTurnSpeedRadiansPerSecond: 3
});

test("shared surface-drive body kernel resolves a callback-driven movement step into kinematic state", () => {
  const currentSnapshot = createMetaverseTraversalKinematicStateSnapshot({
    angularVelocityRadiansPerSecond: 0,
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0
    },
    position: {
      x: 0,
      y: 0,
      z: 0
    },
    yawRadians: 0
  });
  let capturedStepInput = null;

  const nextBodyStep = resolveMetaverseSurfaceDriveBodyStep({
    currentForwardSpeedUnitsPerSecond: 0,
    currentSnapshot,
    currentStrafeSpeedUnitsPerSecond: 0,
    deltaSeconds: 1,
    intentSnapshot: Object.freeze({
      boost: false,
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.5
    }),
    lockedHeightMeters: 2,
    locomotionConfig,
    preferredLookYawRadians: Math.PI * 0.5,
    resolveUnclampedRootPosition: (input) => {
      capturedStepInput = input;

      return Object.freeze({
        x: input.desiredDeltaX,
        y: 99,
        z: input.desiredDeltaZ
      });
    },
    worldRadius: 110
  });

  assert.notEqual(capturedStepInput, null);
  assertApprox(capturedStepInput.nextYawRadians, Math.PI * 0.5);
  assert.equal(nextBodyStep.resolvedRootPosition.y, 2);
  assertApprox(nextBodyStep.resolvedRootPosition.x, 4);
  assertApprox(nextBodyStep.resolvedRootPosition.z, 0);
  assertApprox(nextBodyStep.nextSnapshot.position.x, 4);
  assertApprox(nextBodyStep.nextSnapshot.position.y, 2);
  assertApprox(nextBodyStep.nextSnapshot.position.z, 0);
  assertApprox(nextBodyStep.nextSnapshot.yawRadians, Math.PI * 0.5);
  assertApprox(nextBodyStep.nextSnapshot.linearVelocity.x, 4);
  assertApprox(nextBodyStep.nextSnapshot.linearVelocity.y, 2);
  assertApprox(nextBodyStep.nextSnapshot.linearVelocity.z, 0);
  assertApprox(nextBodyStep.nextForwardSpeedUnitsPerSecond, 4);
  assertApprox(nextBodyStep.nextStrafeSpeedUnitsPerSecond, 0);
});

test("shared surface-drive body kernel applies world clamp before optional blocker resolution", () => {
  const currentSnapshot = createMetaverseTraversalKinematicStateSnapshot({
    angularVelocityRadiansPerSecond: 0,
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0
    },
    position: {
      x: 0,
      y: 0,
      z: 0
    },
    yawRadians: 0
  });
  let blockerInput = null;

  const nextBodyStep = resolveMetaverseSurfaceDriveBodyStep({
    currentForwardSpeedUnitsPerSecond: 0,
    currentSnapshot,
    currentStrafeSpeedUnitsPerSecond: 0,
    deltaSeconds: 1,
    intentSnapshot: Object.freeze({
      boost: false,
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0
    }),
    lockedHeightMeters: 1,
    locomotionConfig,
    resolveBlockedPlanarPosition: (rootPosition) => {
      blockerInput = rootPosition;

      return Object.freeze({
        x: 0.5,
        y: rootPosition.y,
        z: -0.25
      });
    },
    resolveUnclampedRootPosition: () =>
      Object.freeze({
        x: 8,
        y: 3,
        z: -6
      }),
    worldRadius: 2
  });

  assert.notEqual(blockerInput, null);
  assert.ok(
    Math.hypot(blockerInput.x, blockerInput.z) <= 2.000001,
    `expected blocker input to receive a world-clamped position, received (${blockerInput.x}, ${blockerInput.z})`
  );
  assertApprox(nextBodyStep.resolvedRootPosition.x, 0.5);
  assertApprox(nextBodyStep.resolvedRootPosition.y, 1);
  assertApprox(nextBodyStep.resolvedRootPosition.z, -0.25);
  assertApprox(nextBodyStep.nextSnapshot.linearVelocity.x, 0.5);
  assertApprox(nextBodyStep.nextSnapshot.linearVelocity.y, 1);
  assertApprox(nextBodyStep.nextSnapshot.linearVelocity.z, -0.25);
});
