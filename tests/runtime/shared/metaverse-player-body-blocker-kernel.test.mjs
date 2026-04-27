import assert from "node:assert/strict";
import test from "node:test";

import {
  constrainMetaverseTraversalPlayerBodyBlockers
} from "@webgpu-metaverse/shared";

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function assertApprox(actual, expected, epsilon = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

test("shared player body blocker kernel keeps capsule clearance instead of point contact", () => {
  const currentPosition = freezeVector3(0, 0, 1.2);
  const nextPosition = freezeVector3(0, 0, 0.1);
  const resolvedPosition = constrainMetaverseTraversalPlayerBodyBlockers({
    blockers: [
      Object.freeze({
        capsuleHalfHeightMeters: 0.48,
        capsuleRadiusMeters: 0.34,
        playerId: "blocker-a",
        position: freezeVector3(0, 0, 0)
      })
    ],
    capsuleHalfHeightMeters: 0.48,
    capsuleRadiusMeters: 0.34,
    controllerOffsetMeters: 0.01,
    currentPosition,
    nextPosition
  });

  assertApprox(resolvedPosition.x, 0);
  assertApprox(resolvedPosition.y, 0);
  assertApprox(resolvedPosition.z, 0.69);
});

test("shared player body blocker kernel sweeps across the whole step instead of tunneling through", () => {
  const currentPosition = freezeVector3(0, 0, 1.2);
  const resolvedPosition = constrainMetaverseTraversalPlayerBodyBlockers({
    blockers: [
      Object.freeze({
        capsuleHalfHeightMeters: 0.48,
        capsuleRadiusMeters: 0.34,
        playerId: "blocker-a",
        position: freezeVector3(0, 0, 0)
      })
    ],
    capsuleHalfHeightMeters: 0.48,
    capsuleRadiusMeters: 0.34,
    controllerOffsetMeters: 0.01,
    currentPosition,
    nextPosition: freezeVector3(0, 0, -1.2)
  });

  assertApprox(resolvedPosition.x, 0);
  assertApprox(resolvedPosition.y, 0);
  assertApprox(resolvedPosition.z, 0.69);
});

test("shared player body blocker kernel preserves slide around capsule shoulders", () => {
  const resolvedPosition = constrainMetaverseTraversalPlayerBodyBlockers({
    blockers: [
      Object.freeze({
        capsuleHalfHeightMeters: 0.48,
        capsuleRadiusMeters: 0.34,
        playerId: "blocker-a",
        position: freezeVector3(0, 0, 0)
      })
    ],
    capsuleHalfHeightMeters: 0.48,
    capsuleRadiusMeters: 0.34,
    controllerOffsetMeters: 0.01,
    currentPosition: freezeVector3(0.35, 0, 1.2),
    nextPosition: freezeVector3(0.35, 0, 0.15)
  });

  assert.ok(resolvedPosition.x > 0.5);
  assert.ok(resolvedPosition.z > 0);
  assert.ok(
    Math.hypot(resolvedPosition.x, resolvedPosition.z) >=
      0.69 - 0.000001
  );
});

test("shared player body blocker kernel ignores vertically separated capsules", () => {
  const nextPosition = freezeVector3(0, 3, 0.1);
  const resolvedPosition = constrainMetaverseTraversalPlayerBodyBlockers({
    blockers: [
      Object.freeze({
        capsuleHalfHeightMeters: 0.48,
        capsuleRadiusMeters: 0.34,
        playerId: "blocker-a",
        position: freezeVector3(0, 0, 0)
      })
    ],
    capsuleHalfHeightMeters: 0.48,
    capsuleRadiusMeters: 0.34,
    controllerOffsetMeters: 0.01,
    currentPosition: freezeVector3(0, 3, 1.2),
    nextPosition
  });

  assert.deepEqual(resolvedPosition, nextPosition);
});
