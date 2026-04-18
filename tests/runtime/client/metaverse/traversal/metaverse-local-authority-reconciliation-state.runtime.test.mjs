import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseTraversalAuthoritySnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  resolveMetaverseTraversalAuthoritySnapshotInput
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { freezeVector3 } from "./fixtures/traversal-test-fixtures.mjs";

let clientLoader;

function createGroundedTraversalAuthoritySnapshot(input = {}) {
  const {
    currentTick = 0,
    jumpAuthorityState = "grounded",
    pendingActionKind = "none",
    pendingActionSequence = 0,
    resolvedActionKind = "none",
    resolvedActionSequence = 0,
    resolvedActionState = "none"
  } = input;

  return resolveMetaverseTraversalAuthoritySnapshotInput({
    currentTick,
    jumpAuthorityState,
    locomotionMode: "grounded",
    mounted: false,
    pendingActionKind,
    pendingActionSequence,
    previousTraversalAuthority: createMetaverseTraversalAuthoritySnapshot(),
    resolvedActionKind,
    resolvedActionSequence,
    resolvedActionState
  });
}

function createGroundedTraversalState(actionState = undefined) {
  return createMetaverseUnmountedTraversalStateSnapshot({
    actionState,
    locomotionMode: "grounded"
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseLocalAuthorityReconciliationState ignores routine grounded drift", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  let applyCalls = 0;

  const appliedCorrection = reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose() {
      applyCalls += 1;
    },
    authoritativePlayerSnapshot: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(0.05, 0, 24.02),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: 0
    }),
    currentTick: 0,
    hardSnapDistanceMeters: 2.5,
    latestIssuedTraversalActionSequence: 0,
    localGroundedBodySnapshot: Object.freeze({ grounded: true }),
    localPredictedJumpAuthorityState: "grounded",
    localTraversalAuthority: createGroundedTraversalAuthoritySnapshot(),
    localTraversalPose: Object.freeze({
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    }),
    traversalState: createGroundedTraversalState()
  });

  assert.equal(appliedCorrection, false);
  assert.equal(applyCalls, 0);
  assert.equal(reconciliationState.localAuthorityPoseCorrectionCount, 0);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionReason,
    "none"
  );
  assert.equal(
    reconciliationState.authoritativeCorrectionTelemetrySnapshot.applied,
    false
  );
});

test("MetaverseLocalAuthorityReconciliationState preserves a locally predicted airborne jump arc against routine grounded authority", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  let applyCalls = 0;

  const appliedCorrection = reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose() {
      applyCalls += 1;
    },
    authoritativePlayerSnapshot: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(0, 0, 24),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot({
        currentTick: 1
      }),
      yawRadians: 0
    }),
    currentTick: 1,
    hardSnapDistanceMeters: 2.5,
    latestIssuedTraversalActionSequence: 1,
    localGroundedBodySnapshot: Object.freeze({ grounded: false }),
    localPredictedJumpAuthorityState: "rising",
    localTraversalAuthority: createGroundedTraversalAuthoritySnapshot({
      currentTick: 1,
      jumpAuthorityState: "rising"
    }),
    localTraversalPose: Object.freeze({
      locomotionMode: "grounded",
      position: freezeVector3(0, 1.2, 24),
      yawRadians: 0
    }),
    traversalState: createGroundedTraversalState(
      Object.freeze({
        pendingActionBufferSecondsRemaining: 0,
        pendingActionKind: "none",
        pendingActionSequence: 0,
        resolvedActionKind: "jump",
        resolvedActionSequence: 1,
        resolvedActionState: "accepted"
      })
    )
  });

  assert.equal(appliedCorrection, false);
  assert.equal(applyCalls, 0);
  assert.equal(reconciliationState.localAuthorityPoseCorrectionCount, 0);
  assert.equal(
    reconciliationState.authoritativeCorrectionTelemetrySnapshot.applied,
    false
  );
});

test("MetaverseLocalAuthorityReconciliationState snaps only on gross divergence and records correction detail", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  const appliedInputs = [];

  const appliedCorrection = reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose(input) {
      appliedInputs.push(input);
    },
    authoritativePlayerSnapshot: Object.freeze({
      linearVelocity: freezeVector3(0.1, 0, -0.2),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(3.2, 0.4, 24),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: Math.PI * 0.1
    }),
    currentTick: 0,
    hardSnapDistanceMeters: 2.5,
    latestIssuedTraversalActionSequence: 0,
    localGroundedBodySnapshot: Object.freeze({ grounded: true }),
    localPredictedJumpAuthorityState: "grounded",
    localTraversalAuthority: createGroundedTraversalAuthoritySnapshot(),
    localTraversalPose: Object.freeze({
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    }),
    traversalState: createGroundedTraversalState()
  });

  assert.equal(appliedCorrection, true);
  assert.equal(appliedInputs.length, 1);
  assert.equal(reconciliationState.localAuthorityPoseCorrectionCount, 1);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionReason,
    "gross-position-divergence"
  );
  assert.equal(
    reconciliationState.authoritativeCorrectionTelemetrySnapshot.applied,
    true
  );
  assert.ok(
    (reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .planarMagnitudeMeters ?? 0) > 3
  );
});
