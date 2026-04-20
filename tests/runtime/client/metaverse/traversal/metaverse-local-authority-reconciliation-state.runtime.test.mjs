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
        groundedBody: null,
        jumpDebug: Object.freeze({
          surfaceJumpSupported: true,
          supported: true
        }),
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
      lastProcessedInputSequence: 6,
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
      lastProcessedInputSequence: 7,
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
      lastProcessedInputSequence: 0,
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

test("MetaverseLocalAuthorityReconciliationState converges only on gross divergence and records correction detail", async () => {
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
        groundedBody: null,
        jumpDebug: Object.freeze({
          surfaceJumpSupported: true,
          supported: true
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
      groundedBody: createGroundedBodySnapshot({
        interaction: Object.freeze({
          applyImpulsesToDynamicBodies: true
        }),
        linearVelocity: freezeVector3(3.4, 0, -2.6),
        position: freezeVector3(3.2, 0.4, 24),
        yawRadians: Math.PI * 0.1
      }),
      lastProcessedInputSequence: 12,
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
    "gross-body-divergence"
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

test("MetaverseLocalAuthorityReconciliationState converges gross swim divergence when swim body contact and drive truth disagree", async () => {
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
      lastProcessedInputSequence: 38,
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
    "gross-body-divergence"
  );
});
