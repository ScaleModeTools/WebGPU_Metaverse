import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseTraversalActiveActionSnapshot,
  hasMetaverseTraversalAuthorityConsumedAction,
  hasMetaverseTraversalAuthorityLocallyPredictedIssuedAction,
  hasMetaverseTraversalAuthorityRejectedAction,
  isMetaverseTraversalAuthorityActionAirborne,
  isMetaverseTraversalAuthorityActionPendingOrActive,
  readMetaverseTraversalAuthorityLatestActionSequence,
  resolveMetaverseTraversalAuthorityIssuedActionResolution,
  resolveMetaverseTraversalAuthoritySnapshotForActionState,
  resolveMetaverseTraversalAuthoritySnapshotForIssuedAction,
  resolveMetaverseTraversalAuthoritySnapshotInput,
  resolveMetaverseTraversalKinematicActionSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

function resolveActiveAction(phase = "idle", kind = phase === "idle" ? "none" : "jump") {
  return createMetaverseTraversalActiveActionSnapshot({
    kind,
    phase
  });
}

function resolveTraversalAuthority(input) {
  const pendingActionSequence = input.pendingActionSequence ?? 0;
  const resolvedActionSequence = input.resolvedActionSequence ?? 0;
  const activeActionPhase = input.activeActionPhase ?? "idle";
  const activeActionKind =
    input.activeActionKind ?? (activeActionPhase === "idle" ? "none" : "jump");

  return resolveMetaverseTraversalAuthoritySnapshotInput({
    activeAction: resolveActiveAction(activeActionPhase, activeActionKind),
    currentTick: input.currentTick,
    locomotionMode: input.locomotionMode,
    mounted: input.mounted,
    pendingActionKind: pendingActionSequence > 0 ? "jump" : "none",
    pendingActionSequence,
    previousTraversalAuthority: input.previousTraversalAuthority,
    resolvedActionKind: resolvedActionSequence > 0 ? "jump" : "none",
    resolvedActionSequence,
    resolvedActionState: input.resolvedActionState ?? "none"
  });
}

test("shared traversal authority resolver advances jump startup into rising and falling with stable consumed sequencing", () => {
  const startup = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 11,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 4,
    resolvedActionSequence: 0,
    resolvedActionState: "none"
  });

  assert.equal(startup.currentActionKind, "jump");
  assert.equal(startup.currentActionPhase, "startup");
  assert.equal(startup.currentActionSequence, 4);
  assert.equal(startup.phaseStartedAtTick, 11);

  const rising = resolveTraversalAuthority({
    activeActionPhase: "rising",
    currentTick: 12,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 4,
    previousTraversalAuthority: startup,
    resolvedActionSequence: 4,
    resolvedActionState: "accepted"
  });

  assert.equal(rising.currentActionKind, "jump");
  assert.equal(rising.currentActionPhase, "rising");
  assert.equal(rising.currentActionSequence, 4);
  assert.equal(rising.phaseStartedAtTick, 12);
  assert.equal(rising.lastConsumedActionKind, "jump");
  assert.equal(rising.lastConsumedActionSequence, 4);

  const falling = resolveTraversalAuthority({
    activeActionPhase: "falling",
    currentTick: 13,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    previousTraversalAuthority: rising,
    resolvedActionSequence: 4,
    resolvedActionState: "accepted"
  });

  assert.equal(falling.currentActionKind, "jump");
  assert.equal(falling.currentActionPhase, "falling");
  assert.equal(falling.currentActionSequence, 4);
  assert.equal(falling.phaseStartedAtTick, 13);

  const grounded = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 14,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    previousTraversalAuthority: falling,
    resolvedActionSequence: 4,
    resolvedActionState: "accepted"
  });

  assert.equal(grounded.currentActionKind, "none");
  assert.equal(grounded.currentActionPhase, "idle");
  assert.equal(grounded.currentActionSequence, 0);
  assert.equal(grounded.lastConsumedActionKind, "jump");
  assert.equal(grounded.lastConsumedActionSequence, 4);
});

test("shared traversal authority resolver preserves the last rejected jump when later ticks are otherwise idle", () => {
  const rejected = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 20,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    resolvedActionSequence: 5,
    resolvedActionState: "rejected-buffer-expired"
  });

  assert.equal(rejected.lastRejectedActionKind, "jump");
  assert.equal(rejected.lastRejectedActionReason, "buffer-expired");
  assert.equal(rejected.lastRejectedActionSequence, 5);

  const idleLater = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 21,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    previousTraversalAuthority: rejected,
    resolvedActionSequence: 0,
    resolvedActionState: "none"
  });

  assert.equal(idleLater.currentActionKind, "none");
  assert.equal(idleLater.lastRejectedActionKind, "jump");
  assert.equal(idleLater.lastRejectedActionReason, "buffer-expired");
  assert.equal(idleLater.lastRejectedActionSequence, 5);
});

test("shared traversal authority helpers expose coarse gameplay-relevant action truth", () => {
  const startup = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 11,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 4,
    resolvedActionSequence: 0,
    resolvedActionState: "none"
  });

  assert.equal(
    isMetaverseTraversalAuthorityActionPendingOrActive(startup, "jump"),
    true
  );
  assert.equal(
    isMetaverseTraversalAuthorityActionPendingOrActive(startup, "jump", 4),
    true
  );
  assert.equal(
    isMetaverseTraversalAuthorityActionAirborne(startup, "jump"),
    false
  );
  assert.equal(
    hasMetaverseTraversalAuthorityConsumedAction(startup, "jump", 4),
    false
  );
  assert.equal(
    hasMetaverseTraversalAuthorityRejectedAction(startup, "jump", 4),
    false
  );

  const falling = resolveTraversalAuthority({
    activeActionPhase: "falling",
    currentTick: 12,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    previousTraversalAuthority: startup,
    resolvedActionSequence: 4,
    resolvedActionState: "accepted"
  });

  assert.equal(
    isMetaverseTraversalAuthorityActionPendingOrActive(falling, "jump"),
    true
  );
  assert.equal(
    isMetaverseTraversalAuthorityActionAirborne(falling, "jump"),
    true
  );
  assert.equal(
    hasMetaverseTraversalAuthorityConsumedAction(falling, "jump", 4),
    true
  );
  assert.equal(
    hasMetaverseTraversalAuthorityRejectedAction(falling, "jump", 4),
    false
  );

  const rejected = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 13,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    resolvedActionSequence: 5,
    resolvedActionState: "rejected-buffer-expired"
  });

  assert.equal(
    isMetaverseTraversalAuthorityActionPendingOrActive(rejected, "jump", 5),
    false
  );
  assert.equal(
    hasMetaverseTraversalAuthorityConsumedAction(rejected, "jump", 5),
    false
  );
  assert.equal(
    hasMetaverseTraversalAuthorityRejectedAction(rejected, "jump", 5),
    true
  );
});

test("shared traversal authority resolver preserves coarse airborne action state even when no action sequence is available", () => {
  const airborneWithoutSequence = resolveTraversalAuthority({
    activeActionPhase: "rising",
    currentTick: 30,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    resolvedActionSequence: 0,
    resolvedActionState: "none"
  });

  assert.equal(airborneWithoutSequence.currentActionKind, "jump");
  assert.equal(airborneWithoutSequence.currentActionPhase, "rising");
  assert.equal(airborneWithoutSequence.currentActionSequence, 0);
  assert.equal(
    isMetaverseTraversalAuthorityActionPendingOrActive(
      airborneWithoutSequence,
      "jump"
    ),
    true
  );
  assert.equal(
    isMetaverseTraversalAuthorityActionAirborne(
      airborneWithoutSequence,
      "jump"
    ),
    true
  );
});

test("shared traversal authority action-state adapter keeps client and server authority assembly on one path", () => {
  const authority = resolveMetaverseTraversalAuthoritySnapshotForActionState({
    activeAction: resolveActiveAction("idle"),
    actionState: Object.freeze({
      pendingActionKind: "jump",
      pendingActionSequence: 8,
      resolvedActionKind: "jump",
      resolvedActionSequence: 7,
      resolvedActionState: "accepted"
    }),
    currentTick: 51,
    locomotionMode: "grounded",
    mounted: false
  });

  assert.equal(authority.currentActionKind, "jump");
  assert.equal(authority.currentActionPhase, "startup");
  assert.equal(authority.currentActionSequence, 8);
  assert.equal(authority.lastConsumedActionKind, "jump");
  assert.equal(authority.lastConsumedActionSequence, 7);
  assert.equal(authority.phaseStartedAtTick, 51);
});

test("shared traversal authority helper resolves issued action sequencing without runtime-local heuristics", () => {
  const startup = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 40,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 6,
    resolvedActionSequence: 0,
    resolvedActionState: "none"
  });

  assert.deepEqual(
    resolveMetaverseTraversalAuthorityIssuedActionResolution(
      startup,
      "jump",
      6
    ),
    {
      actionSequence: 6,
      resolution: "pending-or-active"
    }
  );

  const acceptedGrounded = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 41,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    previousTraversalAuthority: startup,
    resolvedActionSequence: 6,
    resolvedActionState: "accepted"
  });

  assert.deepEqual(
    resolveMetaverseTraversalAuthorityIssuedActionResolution(
      acceptedGrounded,
      "jump",
      6
    ),
    {
      actionSequence: 6,
      resolution: "accepted"
    }
  );
  assert.deepEqual(
    resolveMetaverseTraversalAuthorityIssuedActionResolution(
      acceptedGrounded,
      "jump",
      6,
      6
    ),
    {
      actionSequence: 0,
      resolution: "none"
    }
  );

  const rejected = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 42,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    resolvedActionSequence: 7,
    resolvedActionState: "rejected-buffer-expired"
  });

  assert.deepEqual(
    resolveMetaverseTraversalAuthorityIssuedActionResolution(
      rejected,
      "jump",
      7
    ),
    {
      actionSequence: 7,
      resolution: "rejected"
    }
  );
});

test("shared traversal authority helper reuses current action authority when the issued action is already pending", () => {
  const startup = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 60,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 9,
    resolvedActionSequence: 0,
    resolvedActionState: "none"
  });

  const resolved = resolveMetaverseTraversalAuthoritySnapshotForIssuedAction({
    activeAction: resolveActiveAction("idle"),
    actionState: Object.freeze({
      pendingActionKind: "jump",
      pendingActionSequence: 9,
      resolvedActionKind: "none",
      resolvedActionSequence: 0,
      resolvedActionState: "none"
    }),
    currentTick: 61,
    issuedActionKind: "jump",
    issuedActionSequence: 9,
    locomotionMode: "grounded",
    mounted: false,
    previousTraversalAuthority: startup
  });

  assert.equal(resolved, startup);
});

test("shared traversal authority helper reconstructs an airborne accepted action from local action state", () => {
  const acceptedGrounded = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 70,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    resolvedActionSequence: 10,
    resolvedActionState: "accepted"
  });

  const resolved = resolveMetaverseTraversalAuthoritySnapshotForIssuedAction({
    activeAction: resolveActiveAction("rising"),
    actionState: Object.freeze({
      pendingActionKind: "none",
      pendingActionSequence: 0,
      resolvedActionKind: "jump",
      resolvedActionSequence: 10,
      resolvedActionState: "accepted"
    }),
    currentTick: 71,
    issuedActionKind: "jump",
    issuedActionSequence: 10,
    locomotionMode: "grounded",
    mounted: false,
    previousTraversalAuthority: acceptedGrounded
  });

  assert.equal(resolved.currentActionKind, "jump");
  assert.equal(resolved.currentActionPhase, "rising");
  assert.equal(resolved.currentActionSequence, 10);
  assert.equal(resolved.lastConsumedActionKind, "jump");
  assert.equal(resolved.lastConsumedActionSequence, 10);
});

test("shared traversal authority helper reports whether an issued action should still count as locally predicted", () => {
  const acceptedGrounded = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 80,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    resolvedActionSequence: 12,
    resolvedActionState: "accepted"
  });

  assert.equal(
    hasMetaverseTraversalAuthorityLocallyPredictedIssuedAction({
      activeAction: resolveActiveAction("rising"),
      actionState: Object.freeze({
        pendingActionKind: "none",
        pendingActionSequence: 0,
        resolvedActionKind: "jump",
        resolvedActionSequence: 12,
        resolvedActionState: "accepted"
      }),
      currentTick: 81,
      issuedActionKind: "jump",
      issuedActionSequence: 12,
      locomotionMode: "grounded",
      mounted: false,
      previousTraversalAuthority: acceptedGrounded
    }),
    true
  );

  assert.equal(
    hasMetaverseTraversalAuthorityLocallyPredictedIssuedAction({
      activeAction: resolveActiveAction("idle"),
      actionState: Object.freeze({
        pendingActionKind: "none",
        pendingActionSequence: 0,
        resolvedActionKind: "jump",
        resolvedActionSequence: 12,
        resolvedActionState: "accepted"
      }),
      currentTick: 81,
      issuedActionKind: "jump",
      issuedActionSequence: 12,
      locomotionMode: "grounded",
      mounted: false,
      previousTraversalAuthority: acceptedGrounded
    }),
    false
  );
});

test("shared traversal authority resolves coarse grounded traversal action from kinematics without runtime-local heuristics", () => {
  assert.deepEqual(
    resolveMetaverseTraversalKinematicActionSnapshot({
      grounded: true,
      locomotionMode: "grounded",
      mounted: false,
      verticalSpeedUnitsPerSecond: 0
    }),
    resolveActiveAction("idle")
  );

  assert.deepEqual(
    resolveMetaverseTraversalKinematicActionSnapshot({
      grounded: false,
      locomotionMode: "grounded",
      mounted: false,
      verticalSpeedUnitsPerSecond: 0.2
    }),
    resolveActiveAction("rising")
  );

  assert.deepEqual(
    resolveMetaverseTraversalKinematicActionSnapshot({
      grounded: false,
      locomotionMode: "grounded",
      mounted: false,
      verticalSpeedUnitsPerSecond: -0.2
    }),
    resolveActiveAction("falling")
  );

  assert.deepEqual(
    resolveMetaverseTraversalKinematicActionSnapshot({
      grounded: true,
      locomotionMode: "swim",
      mounted: false,
      verticalSpeedUnitsPerSecond: 0
    }),
    resolveActiveAction("idle")
  );

  assert.deepEqual(
    resolveMetaverseTraversalKinematicActionSnapshot({
      grounded: true,
      locomotionMode: "grounded",
      mounted: true,
      verticalSpeedUnitsPerSecond: 0
    }),
    resolveActiveAction("idle")
  );
});

test("shared traversal authority exposes the latest authoritative action sequence from coarse gameplay truth", () => {
  const startup = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 50,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 8,
    resolvedActionSequence: 0,
    resolvedActionState: "none"
  });
  const accepted = resolveTraversalAuthority({
    activeActionPhase: "rising",
    currentTick: 51,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 8,
    previousTraversalAuthority: startup,
    resolvedActionSequence: 8,
    resolvedActionState: "accepted"
  });
  const rejected = resolveTraversalAuthority({
    activeActionPhase: "idle",
    currentTick: 52,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionSequence: 0,
    previousTraversalAuthority: accepted,
    resolvedActionSequence: 11,
    resolvedActionState: "rejected-buffer-expired"
  });

  assert.equal(
    readMetaverseTraversalAuthorityLatestActionSequence(startup, "jump"),
    8
  );
  assert.equal(
    readMetaverseTraversalAuthorityLatestActionSequence(accepted, "jump"),
    8
  );
  assert.equal(
    readMetaverseTraversalAuthorityLatestActionSequence(rejected, "jump"),
    11
  );
});
