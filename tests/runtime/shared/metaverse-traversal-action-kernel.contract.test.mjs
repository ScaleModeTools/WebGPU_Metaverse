import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceMetaverseTraversalActionState,
  createMetaverseTraversalActionStateSnapshot,
  isMetaverseGroundedTraversalSurfaceJumpSupported,
  queueMetaverseTraversalAction,
  stepMetaverseGroundedTraversalAction
} from "@webgpu-metaverse/shared";

test("shared traversal action kernel queues only newer jump sequences", () => {
  const queuedState = queueMetaverseTraversalAction(
    createMetaverseTraversalActionStateSnapshot({
      resolvedActionKind: "jump",
      resolvedActionSequence: 3,
      resolvedActionState: "accepted"
    }),
    {
      actionIntent: {
        kind: "jump",
        pressed: true,
        sequence: 4
      },
      bufferSeconds: 0.2
    }
  );

  assert.equal(queuedState.pendingActionKind, "jump");
  assert.equal(queuedState.pendingActionSequence, 4);
  assert.equal(queuedState.resolvedActionSequence, 3);

  const unchangedState = queueMetaverseTraversalAction(queuedState, {
    actionIntent: {
      kind: "jump",
      pressed: true,
      sequence: 4
    },
    bufferSeconds: 0.2
  });

  assert.equal(unchangedState.pendingActionSequence, 4);
  assert.equal(unchangedState.pendingActionBufferSecondsRemaining, 0.2);
});

test("shared grounded traversal kernel consumes an accepted jump into one body intent snapshot", () => {
  const queuedState = queueMetaverseTraversalAction(
    createMetaverseTraversalActionStateSnapshot(),
    {
      actionIntent: {
        kind: "jump",
        pressed: true,
        sequence: 7
      },
      bufferSeconds: 0.2
    }
  );
  const steppedState = stepMetaverseGroundedTraversalAction({
    actionState: queuedState,
    bodyControl: Object.freeze({
      boost: true,
      moveAxis: 1,
      strafeAxis: 0.25,
      turnAxis: -0.5
    }),
    deltaSeconds: 1 / 30,
    groundedBodyJumpReady: false,
    surfaceJumpSupported: true
  });

  assert.equal(steppedState.groundedJumpSupported, true);
  assert.equal(steppedState.jumpRequested, true);
  assert.deepEqual(steppedState.bodyIntent, {
    boost: true,
    jump: true,
    jumpReadyOverride: true,
    moveAxis: 1,
    strafeAxis: 0.25,
    turnAxis: -0.5
  });
  assert.equal(steppedState.actionState.pendingActionSequence, 0);
  assert.equal(steppedState.actionState.resolvedActionKind, "jump");
  assert.equal(steppedState.actionState.resolvedActionSequence, 7);
  assert.equal(steppedState.actionState.resolvedActionState, "accepted");
});

test("shared traversal action kernel expires a buffered jump from fixed-step time alone", () => {
  let actionState = queueMetaverseTraversalAction(
    createMetaverseTraversalActionStateSnapshot(),
    {
      actionIntent: {
        kind: "jump",
        pressed: true,
        sequence: 9
      },
      bufferSeconds: 0.2
    }
  );

  actionState = advanceMetaverseTraversalActionState(actionState, {
    canConsumePendingAction: false,
    deltaSeconds: 0.1
  }).state;
  assert.equal(actionState.pendingActionSequence, 9);
  assert.equal(actionState.resolvedActionSequence, 0);

  actionState = advanceMetaverseTraversalActionState(actionState, {
    canConsumePendingAction: false,
    deltaSeconds: 0.1
  }).state;

  assert.equal(actionState.pendingActionSequence, 0);
  assert.equal(actionState.resolvedActionKind, "jump");
  assert.equal(actionState.resolvedActionSequence, 9);
  assert.equal(actionState.resolvedActionState, "rejected-buffer-expired");
});

test("shared grounded traversal surface jump support keeps the support heuristic explicit and reusable", () => {
  assert.equal(
    isMetaverseGroundedTraversalSurfaceJumpSupported({
      controllerOffsetMeters: 0.01,
      positionY: 0.14,
      snapToGroundDistanceMeters: 0.22,
      supportHeightMeters: 0,
      verticalSpeedTolerance: 0.5,
      verticalSpeedUnitsPerSecond: 0.2
    }),
    true
  );
  assert.equal(
    isMetaverseGroundedTraversalSurfaceJumpSupported({
      controllerOffsetMeters: 0.01,
      positionY: 0.14,
      snapToGroundDistanceMeters: 0.22,
      supportHeightMeters: 0,
      verticalSpeedTolerance: 0.5,
      verticalSpeedUnitsPerSecond: 0.8
    }),
    false
  );
});
