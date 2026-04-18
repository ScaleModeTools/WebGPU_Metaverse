import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceMetaverseTraversalActionState,
  createMetaverseTraversalActionStateSnapshot,
  isMetaverseGroundedTraversalSurfaceJumpSupported,
  metaverseTraversalActionBufferSeconds,
  queueMetaverseTraversalAction,
  readMetaverseTraversalPendingActionBufferAgeMs,
  syncMetaverseTraversalActionStateFromAcceptedActionSequence,
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
      bufferSeconds: metaverseTraversalActionBufferSeconds
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
    bufferSeconds: metaverseTraversalActionBufferSeconds
  });

  assert.equal(unchangedState.pendingActionSequence, 4);
  assert.equal(
    unchangedState.pendingActionBufferSecondsRemaining,
    metaverseTraversalActionBufferSeconds
  );
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
      bufferSeconds: metaverseTraversalActionBufferSeconds
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
      bufferSeconds: metaverseTraversalActionBufferSeconds
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

test("shared traversal action kernel derives pending jump buffer age from one shared duration", () => {
  const queuedState = queueMetaverseTraversalAction(
    createMetaverseTraversalActionStateSnapshot(),
    {
      actionIntent: {
        kind: "jump",
        pressed: true,
        sequence: 11
      },
      bufferSeconds: metaverseTraversalActionBufferSeconds
    }
  );

  const halfExpiredState = advanceMetaverseTraversalActionState(queuedState, {
    canConsumePendingAction: false,
    deltaSeconds: metaverseTraversalActionBufferSeconds / 2
  }).state;

  assert.equal(
    readMetaverseTraversalPendingActionBufferAgeMs(
      halfExpiredState,
      metaverseTraversalActionBufferSeconds
    ),
    100
  );
  assert.equal(
    readMetaverseTraversalPendingActionBufferAgeMs(
      createMetaverseTraversalActionStateSnapshot(),
      metaverseTraversalActionBufferSeconds
    ),
    null
  );
});

test("shared traversal action kernel syncs accepted action sequences without discarding newer pending action", () => {
  const syncedState = syncMetaverseTraversalActionStateFromAcceptedActionSequence(
    createMetaverseTraversalActionStateSnapshot({
      pendingActionBufferSecondsRemaining: 0.12,
      pendingActionKind: "jump",
      pendingActionSequence: 12,
      resolvedActionKind: "jump",
      resolvedActionSequence: 10,
      resolvedActionState: "rejected-buffer-expired"
    }),
    {
      acceptedActionKind: "jump",
      acceptedActionSequence: 11
    }
  );

  assert.equal(syncedState.pendingActionKind, "jump");
  assert.equal(syncedState.pendingActionSequence, 12);
  assert.equal(syncedState.pendingActionBufferSecondsRemaining, 0.12);
  assert.equal(syncedState.resolvedActionKind, "jump");
  assert.equal(syncedState.resolvedActionSequence, 11);
  assert.equal(syncedState.resolvedActionState, "accepted");
});

test("shared traversal action kernel lets authoritative acceptance recover a locally expired action sequence", () => {
  const syncedState = syncMetaverseTraversalActionStateFromAcceptedActionSequence(
    createMetaverseTraversalActionStateSnapshot({
      resolvedActionKind: "jump",
      resolvedActionSequence: 13,
      resolvedActionState: "rejected-buffer-expired"
    }),
    {
      acceptedActionKind: "jump",
      acceptedActionSequence: 13
    }
  );

  assert.equal(syncedState.resolvedActionKind, "jump");
  assert.equal(syncedState.resolvedActionSequence, 13);
  assert.equal(syncedState.resolvedActionState, "accepted");
});

test("shared traversal action kernel does not let an older accepted action overwrite newer resolved state", () => {
  const state = createMetaverseTraversalActionStateSnapshot({
    resolvedActionKind: "jump",
    resolvedActionSequence: 14,
    resolvedActionState: "accepted"
  });
  const syncedState = syncMetaverseTraversalActionStateFromAcceptedActionSequence(
    state,
    {
      acceptedActionKind: "jump",
      acceptedActionSequence: 13
    }
  );

  assert.equal(syncedState, state);
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
