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
    activeAction = undefined,
    currentTick = 0,
    jumpAuthorityState = "grounded",
    pendingActionKind = "none",
    pendingActionSequence = 0,
    resolvedActionKind = "none",
    resolvedActionSequence = 0,
    resolvedActionState = "none"
  } = input;

  return resolveMetaverseTraversalAuthoritySnapshotInput({
    activeAction,
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

function createCorrectionSnapshotStub() {
  return Object.freeze({
    authoritative: Object.freeze({
      lastProcessedInputSequence: 0,
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 0),
      surfaceRouting: Object.freeze({
        blockingAffordanceDetected: false,
        decisionReason: "capability-maintained",
        resolvedSupportHeightMeters: 0,
        supportingAffordanceSampleCount: 0
      })
    }),
    local: Object.freeze({
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 0),
      surfaceRouting: Object.freeze({
        autostepHeightMeters: null,
        blockingAffordanceDetected: false,
        decisionReason: "capability-maintained",
        jumpDebug: Object.freeze({
          groundedBodyGrounded: true,
          groundedBodyJumpReady: true,
          surfaceJumpSupported: true,
          supported: true,
          verticalSpeedUnitsPerSecond: 0
        }),
        resolvedSupportHeightMeters: 0,
        supportingAffordanceSampleCount: 0
      })
    })
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
      lastProcessedInputSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(0.05, 0, 24.02),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
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
      lastProcessedInputSequence: 1,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(0, 0, 24),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot({
        currentTick: 1
      }),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
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

test("MetaverseLocalAuthorityReconciliationState preserves a locally predicted airborne jump arc while authoritative jump continuity is still airborne", async () => {
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
      lastProcessedInputSequence: 30,
      linearVelocity: freezeVector3(2.57, 0.86, -11.63),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(-16.11, 1.78, -4.73),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot({
        activeAction: Object.freeze({
          kind: "jump",
          phase: "rising"
        }),
        currentTick: 30,
        jumpAuthorityState: "rising",
        resolvedActionKind: "jump",
        resolvedActionSequence: 5,
        resolvedActionState: "accepted"
      }),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    currentTick: 30,
    hardSnapDistanceMeters: 2.5,
    latestIssuedTraversalActionSequence: 5,
    localGroundedBodySnapshot: Object.freeze({ grounded: false }),
    localPredictedTraversalAction: Object.freeze({
      kind: "jump",
      phase: "rising"
    }),
    localTraversalAuthority: createGroundedTraversalAuthoritySnapshot({
      activeAction: Object.freeze({
        kind: "jump",
        phase: "rising"
      }),
      currentTick: 30,
      jumpAuthorityState: "rising",
      resolvedActionKind: "jump",
      resolvedActionSequence: 5,
      resolvedActionState: "accepted"
    }),
    localTraversalPose: Object.freeze({
      locomotionMode: "grounded",
      position: freezeVector3(-13.67, 1.77, -3.94),
      yawRadians: 0
    }),
    traversalState: createGroundedTraversalState(
      Object.freeze({
        pendingActionBufferSecondsRemaining: 0,
        pendingActionKind: "none",
        pendingActionSequence: 0,
        resolvedActionKind: "jump",
        resolvedActionSequence: 5,
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

test("MetaverseLocalAuthorityReconciliationState does not hard-snap when mixed planar and vertical drift stays below the true distance threshold", async () => {
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
      lastProcessedInputSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(1, 1.78, 24),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    currentTick: 0,
    hardSnapDistanceMeters: 2.5,
    latestIssuedTraversalActionSequence: 0,
    localGroundedBodySnapshot: Object.freeze({ grounded: true }),
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

test("MetaverseLocalAuthorityReconciliationState snaps only on gross divergence and records correction detail", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  const appliedInputs = [];
  const correctionSnapshot = Object.freeze({
    authoritative: Object.freeze({
      lastProcessedInputSequence: 12,
      locomotionMode: "grounded",
      position: freezeVector3(3.2, 0.4, 24),
      surfaceRouting: Object.freeze({
        blockingAffordanceDetected: false,
        decisionReason: "capability-maintained",
        resolvedSupportHeightMeters: 0.4,
        supportingAffordanceSampleCount: 1
      })
    }),
    local: Object.freeze({
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      surfaceRouting: Object.freeze({
        autostepHeightMeters: null,
        blockingAffordanceDetected: false,
        decisionReason: "capability-maintained",
        jumpDebug: Object.freeze({
          groundedBodyGrounded: true,
          groundedBodyJumpReady: true,
          surfaceJumpSupported: true,
          supported: true,
          verticalSpeedUnitsPerSecond: 0
        }),
        resolvedSupportHeightMeters: 0,
        supportingAffordanceSampleCount: 0
      })
    })
  });

  const appliedCorrection = reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose(input) {
      appliedInputs.push(input);
    },
    authoritativePlayerSnapshot: Object.freeze({
      lastProcessedInputSequence: 12,
      linearVelocity: freezeVector3(0.1, 0, -0.2),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(3.2, 0.4, 24),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: Math.PI * 0.1
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return correctionSnapshot;
    },
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
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionSnapshot,
    correctionSnapshot
  );
});
