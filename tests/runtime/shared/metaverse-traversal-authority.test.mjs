import assert from "node:assert/strict";
import test from "node:test";

import {
  hasMetaverseTraversalAuthorityConsumedJump,
  hasMetaverseTraversalAuthorityRejectedJump,
  isMetaverseTraversalAuthorityJumpAirborne,
  isMetaverseTraversalAuthorityJumpPendingOrActive,
  readMetaverseTraversalAuthorityLatestJumpActionSequence,
  resolveMetaverseTraversalAuthorityIssuedJumpResolution,
  resolveMetaverseTraversalAuthoritySnapshotInput
} from "@webgpu-metaverse/shared";

function resolveTraversalAuthority(input) {
  const pendingActionSequence =
    input.pendingActionSequence ?? input.pendingJumpActionSequence ?? 0;
  const resolvedActionSequence =
    input.resolvedActionSequence ?? input.resolvedJumpActionSequence ?? 0;

  return resolveMetaverseTraversalAuthoritySnapshotInput({
    ...input,
    pendingActionKind: pendingActionSequence > 0 ? "jump" : "none",
    pendingActionSequence,
    resolvedActionKind: resolvedActionSequence > 0 ? "jump" : "none",
    resolvedActionSequence,
    resolvedActionState:
      input.resolvedActionState ?? input.resolvedJumpActionState ?? "none"
  });
}

test("shared traversal authority resolver advances jump startup into rising and falling with stable consumed sequencing", () => {
  const startup = resolveTraversalAuthority({
    currentTick: 11,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 4,
    resolvedJumpActionSequence: 0,
    resolvedJumpActionState: "none"
  });

  assert.equal(startup.currentActionKind, "jump");
  assert.equal(startup.currentActionPhase, "startup");
  assert.equal(startup.currentActionSequence, 4);
  assert.equal(startup.phaseStartedAtTick, 11);

  const rising = resolveTraversalAuthority({
    currentTick: 12,
    jumpAuthorityState: "rising",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 4,
    previousTraversalAuthority: startup,
    resolvedJumpActionSequence: 4,
    resolvedJumpActionState: "accepted"
  });

  assert.equal(rising.currentActionKind, "jump");
  assert.equal(rising.currentActionPhase, "rising");
  assert.equal(rising.currentActionSequence, 4);
  assert.equal(rising.phaseStartedAtTick, 12);
  assert.equal(rising.lastConsumedActionKind, "jump");
  assert.equal(rising.lastConsumedActionSequence, 4);

  const falling = resolveTraversalAuthority({
    currentTick: 13,
    jumpAuthorityState: "falling",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 0,
    previousTraversalAuthority: rising,
    resolvedJumpActionSequence: 4,
    resolvedJumpActionState: "accepted"
  });

  assert.equal(falling.currentActionKind, "jump");
  assert.equal(falling.currentActionPhase, "falling");
  assert.equal(falling.currentActionSequence, 4);
  assert.equal(falling.phaseStartedAtTick, 13);

  const grounded = resolveTraversalAuthority({
    currentTick: 14,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 0,
    previousTraversalAuthority: falling,
    resolvedJumpActionSequence: 4,
    resolvedJumpActionState: "accepted"
  });

  assert.equal(grounded.currentActionKind, "none");
  assert.equal(grounded.currentActionPhase, "idle");
  assert.equal(grounded.currentActionSequence, 0);
  assert.equal(grounded.lastConsumedActionKind, "jump");
  assert.equal(grounded.lastConsumedActionSequence, 4);
});

test("shared traversal authority resolver preserves the last rejected jump when later ticks are otherwise idle", () => {
  const rejected = resolveTraversalAuthority({
    currentTick: 20,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 0,
    resolvedJumpActionSequence: 5,
    resolvedJumpActionState: "rejected-buffer-expired"
  });

  assert.equal(rejected.lastRejectedActionKind, "jump");
  assert.equal(rejected.lastRejectedActionReason, "buffer-expired");
  assert.equal(rejected.lastRejectedActionSequence, 5);

  const idleLater = resolveTraversalAuthority({
    currentTick: 21,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 0,
    previousTraversalAuthority: rejected,
    resolvedJumpActionSequence: 0,
    resolvedJumpActionState: "none"
  });

  assert.equal(idleLater.currentActionKind, "none");
  assert.equal(idleLater.lastRejectedActionKind, "jump");
  assert.equal(idleLater.lastRejectedActionReason, "buffer-expired");
  assert.equal(idleLater.lastRejectedActionSequence, 5);
});

test("shared traversal authority helpers expose coarse gameplay-relevant jump truth", () => {
  const startup = resolveTraversalAuthority({
    currentTick: 11,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 4,
    resolvedJumpActionSequence: 0,
    resolvedJumpActionState: "none"
  });

  assert.equal(isMetaverseTraversalAuthorityJumpPendingOrActive(startup), true);
  assert.equal(isMetaverseTraversalAuthorityJumpPendingOrActive(startup, 4), true);
  assert.equal(isMetaverseTraversalAuthorityJumpAirborne(startup), false);
  assert.equal(hasMetaverseTraversalAuthorityConsumedJump(startup, 4), false);
  assert.equal(hasMetaverseTraversalAuthorityRejectedJump(startup, 4), false);

  const falling = resolveTraversalAuthority({
    currentTick: 12,
    jumpAuthorityState: "falling",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 0,
    previousTraversalAuthority: startup,
    resolvedJumpActionSequence: 4,
    resolvedJumpActionState: "accepted"
  });

  assert.equal(isMetaverseTraversalAuthorityJumpPendingOrActive(falling), true);
  assert.equal(isMetaverseTraversalAuthorityJumpAirborne(falling), true);
  assert.equal(hasMetaverseTraversalAuthorityConsumedJump(falling, 4), true);
  assert.equal(hasMetaverseTraversalAuthorityRejectedJump(falling, 4), false);

  const rejected = resolveTraversalAuthority({
    currentTick: 13,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 0,
    resolvedJumpActionSequence: 5,
    resolvedJumpActionState: "rejected-buffer-expired"
  });

  assert.equal(isMetaverseTraversalAuthorityJumpPendingOrActive(rejected, 5), false);
  assert.equal(hasMetaverseTraversalAuthorityConsumedJump(rejected, 5), false);
  assert.equal(hasMetaverseTraversalAuthorityRejectedJump(rejected, 5), true);
});

test("shared traversal authority resolver preserves coarse airborne jump state even when no jump sequence is available", () => {
  const airborneWithoutSequence = resolveTraversalAuthority({
    currentTick: 30,
    jumpAuthorityState: "rising",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 0,
    resolvedJumpActionSequence: 0,
    resolvedJumpActionState: "none"
  });

  assert.equal(airborneWithoutSequence.currentActionKind, "jump");
  assert.equal(airborneWithoutSequence.currentActionPhase, "rising");
  assert.equal(airborneWithoutSequence.currentActionSequence, 0);
  assert.equal(
    isMetaverseTraversalAuthorityJumpPendingOrActive(airborneWithoutSequence),
    true
  );
  assert.equal(
    isMetaverseTraversalAuthorityJumpAirborne(airborneWithoutSequence),
    true
  );
});

test("shared traversal authority helper resolves issued jump sequencing without runtime-local heuristics", () => {
  const startup = resolveTraversalAuthority({
    currentTick: 40,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 6,
    resolvedJumpActionSequence: 0,
    resolvedJumpActionState: "none"
  });

  assert.deepEqual(
    resolveMetaverseTraversalAuthorityIssuedJumpResolution(startup, 6),
    {
      jumpActionSequence: 6,
      resolution: "pending-or-active"
    }
  );

  const acceptedGrounded = resolveTraversalAuthority({
    currentTick: 41,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 0,
    previousTraversalAuthority: startup,
    resolvedJumpActionSequence: 6,
    resolvedJumpActionState: "accepted"
  });

  assert.deepEqual(
    resolveMetaverseTraversalAuthorityIssuedJumpResolution(
      acceptedGrounded,
      6
    ),
    {
      jumpActionSequence: 6,
      resolution: "accepted"
    }
  );
  assert.deepEqual(
    resolveMetaverseTraversalAuthorityIssuedJumpResolution(
      acceptedGrounded,
      6,
      6
    ),
    {
      jumpActionSequence: 0,
      resolution: "none"
    }
  );

  const rejected = resolveTraversalAuthority({
    currentTick: 42,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 0,
    resolvedJumpActionSequence: 7,
    resolvedJumpActionState: "rejected-buffer-expired"
  });

  assert.deepEqual(
    resolveMetaverseTraversalAuthorityIssuedJumpResolution(rejected, 7),
    {
      jumpActionSequence: 7,
      resolution: "rejected"
    }
  );
});

test("shared traversal authority exposes the latest authoritative jump action sequence from coarse gameplay truth", () => {
  const startup = resolveTraversalAuthority({
    currentTick: 50,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 8,
    resolvedJumpActionSequence: 0,
    resolvedJumpActionState: "none"
  });
  const accepted = resolveTraversalAuthority({
    currentTick: 51,
    jumpAuthorityState: "rising",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 8,
    previousTraversalAuthority: startup,
    resolvedJumpActionSequence: 8,
    resolvedJumpActionState: "accepted"
  });
  const rejected = resolveTraversalAuthority({
    currentTick: 52,
    jumpAuthorityState: "grounded",
    locomotionMode: "grounded",
    mounted: false,
    pendingJumpActionSequence: 0,
    previousTraversalAuthority: accepted,
    resolvedJumpActionSequence: 11,
    resolvedJumpActionState: "rejected-buffer-expired"
  });

  assert.equal(readMetaverseTraversalAuthorityLatestJumpActionSequence(startup), 8);
  assert.equal(readMetaverseTraversalAuthorityLatestJumpActionSequence(accepted), 8);
  assert.equal(readMetaverseTraversalAuthorityLatestJumpActionSequence(rejected), 11);
});
