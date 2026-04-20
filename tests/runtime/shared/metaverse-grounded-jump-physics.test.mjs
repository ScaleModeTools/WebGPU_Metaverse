import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseGroundedJumpBodySnapshot,
  createMetaverseGroundedJumpPhysicsConfigSnapshot,
  resolveMetaverseGroundedJumpBodyTraversalActionSnapshot,
  resolveMetaverseGroundedJumpContinuationSnapshot,
  resolveMetaverseGroundedJumpMovementDampingFactor,
  resolveMetaverseGroundedJumpSynchronizedState,
  resolveMetaverseGroundedJumpVerticalSpeedUnitsPerSecond
} from "@webgpu-metaverse/shared";

function assertApprox(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("shared grounded jump physics normalizes one reusable jump config snapshot", () => {
  const snapshot = createMetaverseGroundedJumpPhysicsConfigSnapshot({
    airborneMovementDampingFactor: 2,
    gravityUnitsPerSecond: -1,
    jumpGroundContactGraceSeconds: -5,
    jumpImpulseUnitsPerSecond: 7.4
  });

  assert.deepEqual(snapshot, {
    airborneMovementDampingFactor: 1,
    gravityUnitsPerSecond: 0,
    jumpGroundContactGraceSeconds: 0,
    jumpImpulseUnitsPerSecond: 7.4
  });
});

test("shared grounded jump physics resolves airborne damping impulse and continuity from one owner", () => {
  const config = createMetaverseGroundedJumpPhysicsConfigSnapshot({
    airborneMovementDampingFactor: 0.42,
    gravityUnitsPerSecond: 18,
    jumpGroundContactGraceSeconds: 0.2,
    jumpImpulseUnitsPerSecond: 6.8
  });

  assertApprox(
    resolveMetaverseGroundedJumpMovementDampingFactor(false, config),
    0.42
  );
  assertApprox(
    resolveMetaverseGroundedJumpVerticalSpeedUnitsPerSecond({
      config,
      currentVerticalSpeedUnitsPerSecond: 1.25,
      deltaSeconds: 0.1,
      jumpRequested: true
    }),
    5
  );

  const airborneContinuation = resolveMetaverseGroundedJumpContinuationSnapshot(
    {
      config,
      deltaSeconds: 0.033,
      grounded: false,
      jumpGroundContactGraceSecondsRemaining: 0.12,
      jumpRequested: false,
      jumpSnapSuppressionActive: true
    }
  );

  assert.equal(airborneContinuation.jumpReady, true);
  assert.equal(airborneContinuation.jumpSnapSuppressionActive, true);
  assertApprox(
    airborneContinuation.jumpGroundContactGraceSecondsRemaining,
    0.087
  );

  const landedContinuation = resolveMetaverseGroundedJumpSynchronizedState({
    config,
    currentJumpSnapSuppressionActive: true,
    grounded: true
  });

  assert.equal(landedContinuation.jumpReady, true);
  assert.equal(landedContinuation.jumpSnapSuppressionActive, false);
  assertApprox(
    landedContinuation.jumpGroundContactGraceSecondsRemaining,
    0.2
  );
});

test("shared grounded jump physics exposes one jump body snapshot for first action consumers", () => {
  const jumpBodySnapshot = createMetaverseGroundedJumpBodySnapshot({
    grounded: false,
    jumpGroundContactGraceSecondsRemaining: 0.08,
    jumpReady: true,
    jumpSnapSuppressionActive: true,
    verticalSpeedUnitsPerSecond: 1.25
  });

  assert.equal(jumpBodySnapshot.jumpReady, true);
  assert.equal(jumpBodySnapshot.jumpSnapSuppressionActive, true);
  assert.equal(
    resolveMetaverseGroundedJumpBodyTraversalActionSnapshot(jumpBodySnapshot)
      .phase,
    "rising"
  );
  assert.equal(
    resolveMetaverseGroundedJumpBodyTraversalActionSnapshot(
      createMetaverseGroundedJumpBodySnapshot({
        grounded: true,
        jumpGroundContactGraceSecondsRemaining: 0.2,
        jumpReady: true,
        verticalSpeedUnitsPerSecond: 3
      })
    ).kind,
    "none"
  );
});
