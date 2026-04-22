import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function createGroundedTraversalState(actionState = undefined) {
  return createMetaverseUnmountedTraversalStateSnapshot({
    actionState,
    locomotionMode: "grounded"
  });
}

function createActiveJumpAction(phase = "rising") {
  return Object.freeze({
    kind: "jump",
    phase
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseLocalTraversalAuthorityState derives traversal authority from grounded pending action state", async () => {
  const { MetaverseLocalTraversalAuthorityState } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-local-traversal-authority-state.ts"
  );
  const authorityState = new MetaverseLocalTraversalAuthorityState();

  authorityState.sync({
    advanceTick: true,
    localActiveTraversalAction: Object.freeze({
      kind: "none",
      phase: "idle"
    }),
    locomotionMode: "grounded",
    traversalState: createGroundedTraversalState(
      Object.freeze({
        pendingActionBufferSecondsRemaining: 0.2,
        pendingActionKind: "jump",
        pendingActionSequence: 3,
        resolvedActionKind: "none",
        resolvedActionSequence: 0,
        resolvedActionState: "none"
      })
    )
  });

  assert.equal(authorityState.currentTick, 1);
  assert.equal(authorityState.snapshot.currentActionKind, "jump");
  assert.equal(authorityState.snapshot.currentActionPhase, "startup");
  assert.equal(authorityState.snapshot.currentActionSequence, 3);
});

test("MetaverseLocalTraversalAuthorityState prefers an issued jump edge over local pending traversal state when minting the next jump sequence", async () => {
  const { MetaverseLocalTraversalAuthorityState } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-local-traversal-authority-state.ts"
  );
  const authorityState = new MetaverseLocalTraversalAuthorityState();
  const groundedTraversalState = createGroundedTraversalState(
    Object.freeze({
      pendingActionBufferSecondsRemaining: 0.2,
      pendingActionKind: "jump",
      pendingActionSequence: 2,
      resolvedActionKind: "none",
      resolvedActionSequence: 0,
      resolvedActionState: "none"
    })
  );

  authorityState.syncIssuedTraversalIntentSnapshot(
    Object.freeze({
      actionIntent: Object.freeze({
        kind: "jump",
        pressed: true,
        sequence: 5
      }),
      bodyControl: Object.freeze({
        boost: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      }),
      sequence: 9,
      locomotionMode: "grounded"
    }),
    {
      localActiveTraversalAction: createActiveJumpAction("startup"),
      locomotionMode: "grounded",
      traversalState: groundedTraversalState
    }
  );

  assert.equal(
    authorityState.resolveNextPredictedGroundedTraversalActionSequence({
      actionPressedThisFrame: true,
      localActiveTraversalAction: createActiveJumpAction("startup"),
      locomotionMode: "grounded",
      traversalState: groundedTraversalState
    }),
    5
  );
});

test("MetaverseLocalTraversalAuthorityState owns next grounded traversal action sequence issuance outside reconciliation", async () => {
  const { MetaverseLocalTraversalAuthorityState } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-local-traversal-authority-state.ts"
  );
  const authorityState = new MetaverseLocalTraversalAuthorityState();

  assert.equal(
    authorityState.resolveNextPredictedGroundedTraversalActionSequence({
      actionPressedThisFrame: true,
      localActiveTraversalAction: Object.freeze({
        kind: "none",
        phase: "idle"
      }),
      locomotionMode: "grounded",
      traversalState: createGroundedTraversalState()
    }),
    1
  );
});

test("MetaverseLocalTraversalAuthorityState falls back to resolved airborne jump state and resets cleanly when minting the next jump sequence", async () => {
  const { MetaverseLocalTraversalAuthorityState } = await clientLoader.load(
    "/src/metaverse/traversal/classes/metaverse-local-traversal-authority-state.ts"
  );
  const authorityState = new MetaverseLocalTraversalAuthorityState();
  const airborneTraversalState = createGroundedTraversalState(
    Object.freeze({
      pendingActionBufferSecondsRemaining: 0,
      pendingActionKind: "none",
      pendingActionSequence: 0,
      resolvedActionKind: "jump",
      resolvedActionSequence: 4,
      resolvedActionState: "accepted"
    })
  );

  authorityState.sync({
    advanceTick: true,
    localActiveTraversalAction: createActiveJumpAction("rising"),
    locomotionMode: "grounded",
    traversalState: airborneTraversalState
  });

  assert.equal(
    authorityState.resolveNextPredictedGroundedTraversalActionSequence({
      actionPressedThisFrame: true,
      localActiveTraversalAction: createActiveJumpAction("rising"),
      locomotionMode: "grounded",
      traversalState: airborneTraversalState
    }),
    4
  );

  authorityState.reset();

  assert.equal(authorityState.currentTick, 0);
  assert.equal(authorityState.snapshot.currentActionKind, "none");
  assert.equal(
    authorityState.resolveNextPredictedGroundedTraversalActionSequence({
      actionPressedThisFrame: false,
      localActiveTraversalAction: Object.freeze({
        kind: "none",
        phase: "idle"
      }),
      locomotionMode: "grounded",
      traversalState: createGroundedTraversalState()
    }),
    0
  );
});
