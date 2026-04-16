import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseTraversalActionIntentSnapshot,
  createMetaverseTraversalAuthoritySnapshot,
  createMetaverseTraversalBodyControlSnapshot
} from "@webgpu-metaverse/shared";

test("createMetaverseTraversalBodyControlSnapshot clamps axes and normalizes boost", () => {
  const snapshot = createMetaverseTraversalBodyControlSnapshot({
    boost: true,
    moveAxis: 1.8,
    strafeAxis: -2.4,
    turnAxis: Number.NaN
  });

  assert.deepEqual(snapshot, {
    boost: true,
    moveAxis: 1,
    strafeAxis: -1,
    turnAxis: 0
  });
});

test("createMetaverseTraversalActionIntentSnapshot and authority snapshot normalize action truth", () => {
  const actionIntent = createMetaverseTraversalActionIntentSnapshot(
    {
      kind: "jump",
      pressed: true
    },
    9.8
  );
  const authority = createMetaverseTraversalAuthoritySnapshot({
    currentActionKind: "jump",
    currentActionPhase: "falling",
    currentActionSequence: 9.8,
    lastConsumedActionKind: "jump",
    lastConsumedActionSequence: 9.8,
    lastRejectedActionKind: "jump",
    lastRejectedActionReason: "buffer-expired",
    lastRejectedActionSequence: 7.2,
    phaseStartedAtTick: 15.9
  });

  assert.deepEqual(actionIntent, {
    kind: "jump",
    pressed: true,
    sequence: 9
  });
  assert.deepEqual(authority, {
    currentActionKind: "jump",
    currentActionPhase: "falling",
    currentActionSequence: 9,
    lastConsumedActionKind: "jump",
    lastConsumedActionSequence: 9,
    lastRejectedActionKind: "jump",
    lastRejectedActionReason: "buffer-expired",
    lastRejectedActionSequence: 7,
    phaseStartedAtTick: 15
  });
});
