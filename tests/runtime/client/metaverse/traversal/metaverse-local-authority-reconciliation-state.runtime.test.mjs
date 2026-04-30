import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaverseSurfaceDriveBodyRuntimeSnapshot,
  createMetaverseTraversalAuthoritySnapshot,
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

function createGroundedBodySnapshot(input = {}) {
  return createMetaverseGroundedBodyRuntimeSnapshot({
    grounded: true,
    linearVelocity: freezeVector3(0, 0, 0),
    position: freezeVector3(0, 0, 24),
    yawRadians: 0,
    ...input
  });
}

function createSwimBodySnapshot(input = {}) {
  return createMetaverseSurfaceDriveBodyRuntimeSnapshot({
    linearVelocity: freezeVector3(0, 0, 0),
    position: freezeVector3(0, 0, 24),
    yawRadians: 0,
    ...input
  });
}

function createCorrectionSnapshotStub() {
  return Object.freeze({
    authoritative: Object.freeze({
      lastProcessedTraversalSequence: 0,
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
        groundedBody: null,
        resolvedSupportHeightMeters: 0,
        supportingAffordanceSampleCount: 0
      })
    })
  });
}

function createConvergenceConfig(overrides = {}) {
  return {
    convergenceMaxPositionStepMeters: 0.2,
    convergenceMaxYawStepRadians: 0.08,
    convergenceSettlePlanarDistanceMeters: 0.05,
    convergenceSettleVerticalDistanceMeters: 0.05,
    convergenceSettleYawRadians: 0.02,
    convergenceStartPlanarDistanceMeters: 1.25,
    convergenceStartVerticalDistanceMeters: 1.5,
    convergenceStartYawRadians: 0.12,
    ...overrides
  };
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
      groundedBody: createGroundedBodySnapshot({
        position: freezeVector3(0.05, 0, 24.02)
      }),
      lastProcessedTraversalSequence: 0,
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
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot(),
    localSwimBodySnapshot: null,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    })
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
      groundedBody: createGroundedBodySnapshot({
        grounded: false
      }),
      lastProcessedTraversalSequence: 1,
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
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot({
      grounded: false,
      position: freezeVector3(0, 1.2, 24)
    }),
    localSwimBodySnapshot: null,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 1.2, 24),
      yawRadians: 0
    })
  });

  assert.equal(appliedCorrection, false);
  assert.equal(applyCalls, 0);
  assert.equal(reconciliationState.localAuthorityPoseCorrectionCount, 0);
  assert.equal(
    reconciliationState.authoritativeCorrectionTelemetrySnapshot.applied,
    false
  );
});

test("MetaverseLocalAuthorityReconciliationState force-snaps a locally predicted jump back to authority once the jump edge is rejected", async () => {
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
      groundedBody: createGroundedBodySnapshot({
        grounded: true
      }),
      lastProcessedTraversalSequence: 4,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(0, 0, 24),
      traversalAuthority: Object.freeze({
        currentActionKind: "none",
        currentActionPhase: "idle",
        currentActionSequence: 0,
        lastConsumedActionKind: "none",
        lastConsumedActionSequence: 0,
        lastRejectedActionKind: "jump",
        lastRejectedActionReason: "buffer-expired",
        lastRejectedActionSequence: 3,
        phaseStartedAtTick: 6
      }),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot({
      grounded: false,
      position: freezeVector3(0, 0.8, 24)
    }),
    localIssuedTraversalIntentSnapshot: Object.freeze({
      actionIntent: Object.freeze({
        kind: "jump",
        pressed: true,
        sequence: 3
      }),
      bodyControl: Object.freeze({
        boost: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      }),
      locomotionMode: "grounded",
      sequence: 9
    }),
    localSwimBodySnapshot: null,
    localGrounded: false,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0.2, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0.8, 24),
      yawRadians: 0
    })
  });

  assert.equal(appliedCorrection, true);
  assert.equal(appliedInputs.length, 1);
  assert.equal(appliedInputs[0]?.positionBlendAlpha, 1);
  assert.equal(appliedInputs[0]?.yawBlendAlpha, 1);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionReason,
    "gross-body-divergence"
  );
});

test("MetaverseLocalAuthorityReconciliationState ignores a stale rejected jump sequence once a newer local jump is already predicted", async () => {
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
      groundedBody: createGroundedBodySnapshot({
        grounded: true
      }),
      lastProcessedTraversalSequence: 8,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(0, 0, 24),
      traversalAuthority: Object.freeze({
        currentActionKind: "none",
        currentActionPhase: "idle",
        currentActionSequence: 0,
        lastConsumedActionKind: "none",
        lastConsumedActionSequence: 0,
        lastRejectedActionKind: "jump",
        lastRejectedActionReason: "buffer-expired",
        lastRejectedActionSequence: 1,
        phaseStartedAtTick: 8
      }),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot({
      grounded: false,
      position: freezeVector3(0, 0.8, 24)
    }),
    localIssuedTraversalIntentSnapshot: Object.freeze({
      actionIntent: Object.freeze({
        kind: "jump",
        pressed: true,
        sequence: 2
      }),
      bodyControl: Object.freeze({
        boost: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      }),
      locomotionMode: "grounded",
      sequence: 10
    }),
    localTraversalAuthoritySnapshot: Object.freeze({
      currentActionKind: "jump",
      currentActionPhase: "rising",
      currentActionSequence: 2,
      lastConsumedActionKind: "jump",
      lastConsumedActionSequence: 2,
      lastRejectedActionKind: "none",
      lastRejectedActionReason: "none",
      lastRejectedActionSequence: 0,
      phaseStartedAtTick: 7
    }),
    localSwimBodySnapshot: null,
    localGrounded: false,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0.2, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0.8, 24),
      yawRadians: 0
    })
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

test("MetaverseLocalAuthorityReconciliationState reconciles to grounded active body truth when traversal action phase is stale airborne", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  const appliedInputs = [];
  const authoritativePosition = freezeVector3(2, 0, 24);

  const appliedCorrection = reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose(input) {
      appliedInputs.push(input);
    },
    authoritativePlayerSnapshot: Object.freeze({
      groundedBody: createGroundedBodySnapshot({
        grounded: true,
        position: authoritativePosition
      }),
      lastProcessedTraversalSequence: 12,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: authoritativePosition,
      traversalAuthority: createGroundedTraversalAuthoritySnapshot({
        currentTick: 12,
        jumpAuthorityState: "falling"
      }),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot(),
    localSwimBodySnapshot: null,
    localGrounded: true,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    })
  });

  assert.equal(appliedCorrection, true);
  assert.equal(appliedInputs.length, 1);
  assert.equal(appliedInputs[0]?.authoritativeGrounded, true);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionReason,
    "gross-position-divergence"
  );
});

test("MetaverseLocalAuthorityReconciliationState reconciles grounded free-roam mounted entry occupancy through the active body owner", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  const applyCalls = [];

  const appliedCorrection = reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose(input) {
      applyCalls.push(input);
    },
    authoritativePlayerSnapshot: Object.freeze({
      groundedBody: createGroundedBodySnapshot({
        position: freezeVector3(1.6, 0, 24)
      }),
      lastProcessedTraversalSequence: 5,
      linearVelocity: freezeVector3(0.4, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: Object.freeze({
        environmentAssetId: "metaverse-test-shuttle-v1",
        entryId: "deck-entry",
        occupancyKind: "entry",
        occupantRole: "passenger",
        seatId: null
      }),
      position: freezeVector3(1.6, 0, 24),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot({
        currentTick: 5
      }),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot(),
    localSwimBodySnapshot: null,
    localGrounded: true,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    })
  });

  assert.equal(appliedCorrection, true);
  assert.equal(applyCalls.length, 1);
  assert.equal(applyCalls[0]?.authoritativeGrounded, true);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionReason,
    "gross-position-divergence"
  );
});

test("MetaverseLocalAuthorityReconciliationState starts bounded convergence on gross position-only divergence while body state matches", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  const appliedInputs = [];
  const authoritativePosition = freezeVector3(3.2, 0, 24);

  const appliedCorrection = reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose(input) {
      appliedInputs.push(input);
    },
    authoritativePlayerSnapshot: Object.freeze({
      groundedBody: createGroundedBodySnapshot({
        position: authoritativePosition
      }),
      lastProcessedTraversalSequence: 6,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: authoritativePosition,
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot(),
    localSwimBodySnapshot: null,
    localGrounded: true,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    })
  });

  assert.equal(appliedCorrection, true);
  assert.equal(appliedInputs.length, 1);
  assert.ok(appliedInputs[0]?.positionBlendAlpha < 0.1);
  assert.equal(appliedInputs[0]?.yawBlendAlpha, 1);
  assert.equal(reconciliationState.localAuthorityPoseCorrectionCount, 1);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionReason,
    "gross-position-divergence"
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .bodyStateDivergence,
    false
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .groundedBodyStateDivergence,
    false
  );
  assert.equal(
    reconciliationState.authoritativeCorrectionTelemetrySnapshot.applied,
    true
  );
});

test("MetaverseLocalAuthorityReconciliationState starts bounded convergence on gross yaw-only divergence", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  const appliedInputs = [];
  const authoritativeYawRadians = 0.3;

  const appliedCorrection = reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose(input) {
      appliedInputs.push(input);
    },
    authoritativePlayerSnapshot: Object.freeze({
      groundedBody: createGroundedBodySnapshot({
        yawRadians: authoritativeYawRadians
      }),
      lastProcessedTraversalSequence: 7,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(0, 0, 24),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: authoritativeYawRadians
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot(),
    localSwimBodySnapshot: null,
    localGrounded: true,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    })
  });

  assert.equal(appliedCorrection, true);
  assert.equal(appliedInputs.length, 1);
  assert.equal(appliedInputs[0]?.positionBlendAlpha, 1);
  assert.ok(appliedInputs[0]?.yawBlendAlpha < 0.3);
  assert.equal(reconciliationState.localAuthorityPoseCorrectionCount, 1);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionReason,
    "gross-yaw-divergence"
  );
});

test("MetaverseLocalAuthorityReconciliationState preserves episode start context across settle steps", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  let applyCalls = 0;
  const authoritativePosition = freezeVector3(1.3, 0, 24);
  const createAuthoritativePlayerSnapshot = () =>
    Object.freeze({
      groundedBody: createGroundedBodySnapshot({
        position: authoritativePosition
      }),
      lastProcessedTraversalSequence: 12,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: authoritativePosition,
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: 0
    });

  const startedCorrection =
    reconciliationState.syncAuthoritativeLocalPlayerPose({
      applyAuthoritativeUnmountedPose() {
        applyCalls += 1;
      },
      authoritativePlayerSnapshot: createAuthoritativePlayerSnapshot(),
      authoritativeSnapshotAgeMs: 34,
      authoritativeSnapshotSequence: 3,
      authoritativeTick: 19,
      createLocalAuthorityPoseCorrectionSnapshot() {
        return createCorrectionSnapshotStub();
      },
      ...createConvergenceConfig(),
      historicalLocalSampleMatched: true,
      historicalLocalSampleSelectionReason:
        "latest-at-or-before-authoritative-time",
      historicalLocalSampleTimeDeltaMs: -4,
      localGroundedBodySnapshot: createGroundedBodySnapshot(),
      localSwimBodySnapshot: null,
      localGrounded: true,
      localTraversalPose: Object.freeze({
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        position: freezeVector3(0, 0, 24),
        yawRadians: 0
      })
    });

  assert.equal(startedCorrection, true);
  assert.equal(applyCalls, 1);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStarted,
    true
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartReason,
    "gross-position-divergence"
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartIntentionalDiscontinuityCause,
    "none"
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartHistoricalLocalSampleMatched,
    true
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartHistoricalLocalSampleSelectionReason,
    "latest-at-or-before-authoritative-time"
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs,
    -4
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartPlanarMagnitudeMeters,
    1.3
  );

  const settleStepCorrection =
    reconciliationState.syncAuthoritativeLocalPlayerPose({
      applyAuthoritativeUnmountedPose() {
        applyCalls += 1;
      },
      authoritativePlayerSnapshot: createAuthoritativePlayerSnapshot(),
      authoritativeSnapshotAgeMs: 50,
      authoritativeSnapshotSequence: 4,
      authoritativeTick: 20,
      createLocalAuthorityPoseCorrectionSnapshot() {
        return createCorrectionSnapshotStub();
      },
      ...createConvergenceConfig(),
      historicalLocalSampleMatched: false,
      localGroundedBodySnapshot: createGroundedBodySnapshot({
        position: freezeVector3(1.22, 0, 24)
      }),
      localSwimBodySnapshot: null,
      localGrounded: true,
      localTraversalPose: Object.freeze({
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        position: freezeVector3(1.22, 0, 24),
        yawRadians: 0
      })
    });

  assert.equal(settleStepCorrection, true);
  assert.equal(applyCalls, 2);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStarted,
    false
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionReason,
    "none"
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartReason,
    "gross-position-divergence"
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartIntentionalDiscontinuityCause,
    "none"
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartHistoricalLocalSampleMatched,
    true
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartHistoricalLocalSampleSelectionReason,
    "latest-at-or-before-authoritative-time"
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs,
    -4
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartPlanarMagnitudeMeters,
    1.3
  );
});

test("MetaverseLocalAuthorityReconciliationState preserves the last intentional discontinuity cause across settle steps", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  let applyCalls = 0;
  const authoritativePosition = freezeVector3(1.3, 0, 24);
  const createAuthoritativePlayerSnapshot = () =>
    Object.freeze({
      groundedBody: createGroundedBodySnapshot({
        position: authoritativePosition
      }),
      lastProcessedTraversalSequence: 12,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: authoritativePosition,
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: 0
    });

  reconciliationState.noteIntentionalDiscontinuity("mounted-unboarding");

  reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose() {
      applyCalls += 1;
    },
    authoritativePlayerSnapshot: createAuthoritativePlayerSnapshot(),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    historicalLocalSampleMatched: true,
    localGroundedBodySnapshot: createGroundedBodySnapshot(),
    localSwimBodySnapshot: null,
    localGrounded: true,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    })
  });

  assert.equal(applyCalls, 1);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartIntentionalDiscontinuityCause,
    "mounted-unboarding"
  );

  reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose() {
      applyCalls += 1;
    },
    authoritativePlayerSnapshot: createAuthoritativePlayerSnapshot(),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    historicalLocalSampleMatched: false,
    localGroundedBodySnapshot: createGroundedBodySnapshot({
      position: freezeVector3(1.22, 0, 24)
    }),
    localSwimBodySnapshot: null,
    localGrounded: true,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(1.22, 0, 24),
      yawRadians: 0
    })
  });

  assert.equal(applyCalls, 2);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartIntentionalDiscontinuityCause,
    "mounted-unboarding"
  );
});

test("MetaverseLocalAuthorityReconciliationState clears a pending intentional discontinuity when no episode starts", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();

  reconciliationState.noteIntentionalDiscontinuity("mounted-unboarding");

  const ignoredCorrection =
    reconciliationState.syncAuthoritativeLocalPlayerPose({
      applyAuthoritativeUnmountedPose() {},
      authoritativePlayerSnapshot: Object.freeze({
        groundedBody: createGroundedBodySnapshot({
          position: freezeVector3(0.05, 0, 24.02)
        }),
        lastProcessedTraversalSequence: 0,
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
      ...createConvergenceConfig(),
      localGroundedBodySnapshot: createGroundedBodySnapshot(),
      localSwimBodySnapshot: null,
      localGrounded: true,
      localTraversalPose: Object.freeze({
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        position: freezeVector3(0, 0, 24),
        yawRadians: 0
      })
    });

  assert.equal(ignoredCorrection, false);

  reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose() {},
    authoritativePlayerSnapshot: Object.freeze({
      groundedBody: createGroundedBodySnapshot({
        position: freezeVector3(3.2, 0, 24)
      }),
      lastProcessedTraversalSequence: 6,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(3.2, 0, 24),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot(),
    localSwimBodySnapshot: null,
    localGrounded: true,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    })
  });

  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartIntentionalDiscontinuityCause,
    "none"
  );
});

test("MetaverseLocalAuthorityReconciliationState carries moving-support discontinuity causes into the next convergence episode", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  let applyCalls = 0;
  const authoritativePosition = freezeVector3(1.45, 0, 24);

  reconciliationState.noteIntentionalDiscontinuity("moving-support-carry");

  reconciliationState.syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose() {
      applyCalls += 1;
    },
    authoritativePlayerSnapshot: Object.freeze({
      groundedBody: createGroundedBodySnapshot({
        position: authoritativePosition
      }),
      lastProcessedTraversalSequence: 14,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: authoritativePosition,
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot(),
    localSwimBodySnapshot: null,
    localGrounded: true,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    })
  });

  assert.equal(applyCalls, 1);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .convergenceEpisodeStartIntentionalDiscontinuityCause,
    "moving-support-carry"
  );
});

test("MetaverseLocalAuthorityReconciliationState leaves routine planar and vertical drift below the convergence start thresholds alone", async () => {
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
      groundedBody: createGroundedBodySnapshot({
        position: freezeVector3(0.2, 1.2, 24)
      }),
      lastProcessedTraversalSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(0.2, 1.2, 24),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot(),
    localSwimBodySnapshot: null,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    })
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

test("MetaverseLocalAuthorityReconciliationState converges on gross pose divergence and records body diagnostics", async () => {
  const { MetaverseLocalAuthorityReconciliationState } = await clientLoader.load(
    "/src/metaverse/traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state.ts"
  );
  const reconciliationState =
    new MetaverseLocalAuthorityReconciliationState();
  const appliedInputs = [];
  const correctionSnapshot = Object.freeze({
    authoritative: Object.freeze({
      lastProcessedTraversalSequence: 12,
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
        groundedBody: null,
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
      groundedBody: createGroundedBodySnapshot({
        interaction: Object.freeze({
          applyImpulsesToDynamicBodies: true
        }),
        linearVelocity: freezeVector3(3.4, 0, -2.6),
        position: freezeVector3(3.2, 0.4, 24),
        yawRadians: Math.PI * 0.1
      }),
      lastProcessedTraversalSequence: 12,
      linearVelocity: freezeVector3(3.4, 0, -2.6),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(3.2, 0.4, 24),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: Math.PI * 0.1
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return correctionSnapshot;
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: createGroundedBodySnapshot(),
    localSwimBodySnapshot: null,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      position: freezeVector3(0, 0, 24),
      yawRadians: 0
    })
  });

  assert.equal(appliedCorrection, true);
  assert.equal(appliedInputs.length, 1);
  assert.equal(reconciliationState.localAuthorityPoseCorrectionCount, 1);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionReason,
    "gross-position-divergence"
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .bodyStateDivergence,
    true
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .groundedBodyStateDivergence,
    true
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

test("MetaverseLocalAuthorityReconciliationState keeps blocked-planar swim contact mismatch out of body divergence", async () => {
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
      groundedBody: createGroundedBodySnapshot(),
      lastProcessedTraversalSequence: 38,
      linearVelocity: freezeVector3(-3.26, 0, 0),
      locomotionMode: "swim",
      mountedOccupancy: null,
      position: freezeVector3(59.64, 0, 3.96),
      swimBody: createSwimBodySnapshot({
        contact: Object.freeze({
          appliedMovementDelta: freezeVector3(-0.11, 0, 0),
          blockedPlanarMovement: true,
          desiredMovementDelta: freezeVector3(-0.11, 0, -0.29)
        }),
        driveTarget: Object.freeze({
          boost: true,
          moveAxis: 1,
          movementMagnitude: 1,
          strafeAxis: 0,
          targetForwardSpeedUnitsPerSecond: 9.3,
          targetPlanarSpeedUnitsPerSecond: 9.3,
          targetStrafeSpeedUnitsPerSecond: 0
        }),
        linearVelocity: freezeVector3(-3.26, 0, 0),
        position: freezeVector3(59.64, 0, 3.96)
      }),
      traversalAuthority: createGroundedTraversalAuthoritySnapshot(),
      yawRadians: 0
    }),
    createLocalAuthorityPoseCorrectionSnapshot() {
      return createCorrectionSnapshotStub();
    },
    ...createConvergenceConfig(),
    localGroundedBodySnapshot: null,
    localSwimBodySnapshot: createSwimBodySnapshot({
      contact: Object.freeze({
        appliedMovementDelta: freezeVector3(-0.11, 0, -0.29),
        blockedPlanarMovement: false,
        desiredMovementDelta: freezeVector3(-0.11, 0, -0.29)
      }),
      driveTarget: Object.freeze({
        boost: true,
        moveAxis: 1,
        movementMagnitude: 1,
        strafeAxis: 0,
        targetForwardSpeedUnitsPerSecond: 9.3,
        targetPlanarSpeedUnitsPerSecond: 9.3,
        targetStrafeSpeedUnitsPerSecond: 0
      }),
      linearVelocity: freezeVector3(-3.16, 0, -8.73),
      position: freezeVector3(61.65, 0, 2.34)
    }),
    localGrounded: null,
    localTraversalPose: Object.freeze({
      linearVelocity: freezeVector3(-3.16, 0, -8.73),
      locomotionMode: "swim",
      position: freezeVector3(61.65, 0, 2.34),
      yawRadians: 0
    })
  });

  assert.equal(appliedCorrection, true);
  assert.equal(applyCalls, 1);
  assert.equal(reconciliationState.localAuthorityPoseCorrectionCount, 1);
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionReason,
    "gross-position-divergence"
  );
  assert.equal(
    reconciliationState.lastLocalAuthorityPoseCorrectionDetail
      .bodyStateDivergence,
    false
  );
});
