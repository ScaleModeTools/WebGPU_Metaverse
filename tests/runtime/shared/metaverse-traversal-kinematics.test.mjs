import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseTraversalKinematicStateSnapshot,
  resolveMetaverseTraversalKinematicState,
  resolveMetaverseTraversalAngularVelocityRadiansPerSecond,
  resolveMetaverseTraversalPlanarDirectionalSpeeds,
  resolveMetaverseTraversalPoseKinematics,
  syncMetaverseTraversalKinematicState
} from "@webgpu-metaverse/shared";

function assertApprox(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("shared traversal pose kinematics derives linear and directional speeds from pose delta", () => {
  const kinematicSnapshot = resolveMetaverseTraversalPoseKinematics(
    {
      position: {
        x: 0,
        y: 1,
        z: 0
      },
      yawRadians: 0
    },
    {
      position: {
        x: 2,
        y: 1.5,
        z: -4
      },
      yawRadians: Math.PI * 0.5
    },
    2
  );

  assertApprox(
    kinematicSnapshot.angularVelocityRadiansPerSecond,
    Math.PI * 0.25
  );
  assertApprox(kinematicSnapshot.linearVelocity.x, 1);
  assertApprox(kinematicSnapshot.linearVelocity.y, 0.25);
  assertApprox(kinematicSnapshot.linearVelocity.z, -2);
  assertApprox(kinematicSnapshot.forwardSpeedUnitsPerSecond, 1);
  assertApprox(kinematicSnapshot.strafeSpeedUnitsPerSecond, -2);
  assertApprox(kinematicSnapshot.planarSpeedUnitsPerSecond, Math.sqrt(5));
});

test("shared traversal planar directional speeds project world velocity into the current yaw basis", () => {
  const directionalSpeeds = resolveMetaverseTraversalPlanarDirectionalSpeeds(
    {
      x: 3,
      z: -4
    },
    0
  );

  assertApprox(directionalSpeeds.forwardSpeedUnitsPerSecond, 4);
  assertApprox(directionalSpeeds.strafeSpeedUnitsPerSecond, 3);
  assertApprox(directionalSpeeds.planarSpeedUnitsPerSecond, 5);
});

test("shared traversal angular velocity wraps across the signed yaw seam", () => {
  const angularVelocityRadiansPerSecond =
    resolveMetaverseTraversalAngularVelocityRadiansPerSecond(
      3,
      -3,
      0.5
    );

  assertApprox(
    angularVelocityRadiansPerSecond,
    (Math.PI * 2 - 6) / 0.5
  );
});

test("shared traversal kinematic state sync preserves pose while deriving planar directional speeds", () => {
  const kinematicStateSnapshot = syncMetaverseTraversalKinematicState({
    linearVelocity: {
      x: 3,
      y: 1.25,
      z: -4
    },
    position: {
      x: 8,
      y: 2,
      z: -5
    },
    yawRadians: 0
  });

  assertApprox(kinematicStateSnapshot.angularVelocityRadiansPerSecond, 0);
  assertApprox(kinematicStateSnapshot.forwardSpeedUnitsPerSecond, 4);
  assertApprox(kinematicStateSnapshot.strafeSpeedUnitsPerSecond, 3);
  assertApprox(kinematicStateSnapshot.planarSpeedUnitsPerSecond, 5);
  assert.deepEqual(kinematicStateSnapshot.position, {
    x: 8,
    y: 2,
    z: -5
  });
  assertApprox(kinematicStateSnapshot.yawRadians, 0);
});

test("shared traversal kinematic state resolve keeps the next pose together with derived kinematics", () => {
  const kinematicStateSnapshot = resolveMetaverseTraversalKinematicState(
    {
      position: {
        x: 1,
        y: 0.5,
        z: 2
      },
      yawRadians: 0
    },
    {
      position: {
        x: 5,
        y: 1.5,
        z: 2
      },
      yawRadians: Math.PI * 0.5
    },
    2
  );

  assertApprox(
    kinematicStateSnapshot.angularVelocityRadiansPerSecond,
    Math.PI * 0.25
  );
  assertApprox(kinematicStateSnapshot.linearVelocity.x, 2);
  assertApprox(kinematicStateSnapshot.linearVelocity.y, 0.5);
  assertApprox(kinematicStateSnapshot.linearVelocity.z, 0);
  assertApprox(kinematicStateSnapshot.forwardSpeedUnitsPerSecond, 2);
  assertApprox(kinematicStateSnapshot.strafeSpeedUnitsPerSecond, 0);
  assert.deepEqual(kinematicStateSnapshot.position, {
    x: 5,
    y: 1.5,
    z: 2
  });
  assertApprox(kinematicStateSnapshot.yawRadians, Math.PI * 0.5);
});

test("shared traversal kinematic state builder preserves explicit angular velocity and derives directional speeds", () => {
  const kinematicStateSnapshot = createMetaverseTraversalKinematicStateSnapshot({
    angularVelocityRadiansPerSecond: 1.5,
    linearVelocity: {
      x: 6,
      y: -2,
      z: 0
    },
    position: {
      x: -3,
      y: 4,
      z: 7
    },
    yawRadians: Math.PI * 0.5
  });

  assertApprox(kinematicStateSnapshot.angularVelocityRadiansPerSecond, 1.5);
  assertApprox(kinematicStateSnapshot.forwardSpeedUnitsPerSecond, 6);
  assertApprox(kinematicStateSnapshot.strafeSpeedUnitsPerSecond, 0);
  assertApprox(kinematicStateSnapshot.planarSpeedUnitsPerSecond, 6);
  assert.deepEqual(kinematicStateSnapshot.position, {
    x: -3,
    y: 4,
    z: 7
  });
  assertApprox(kinematicStateSnapshot.yawRadians, Math.PI * 0.5);
});
