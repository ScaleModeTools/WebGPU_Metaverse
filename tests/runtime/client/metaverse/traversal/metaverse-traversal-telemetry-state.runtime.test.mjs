import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaverseTraversalAuthoritySnapshot
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createReconciliationStateStub() {
  let resetCalls = 0;

  return {
    authoritativeCorrectionTelemetrySnapshot: Object.freeze({
      applied: false
    }),
    get resetCalls() {
      return resetCalls;
    },
    lastLocalAuthorityPoseCorrectionDetail: Object.freeze({
      convergenceEpisodeStartIntentionalDiscontinuityCause: "none",
      convergenceEpisodeStartHistoricalLocalSampleMatched: null,
      convergenceEpisodeStartHistoricalLocalSampleSelectionReason: null,
      convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs: null,
      planarMagnitudeMeters: null
    }),
    lastLocalAuthorityPoseCorrectionSnapshot: null,
    lastLocalAuthorityPoseCorrectionReason: "none",
    localAuthorityPoseCorrectionCount: 0,
    localAuthorityPoseConvergenceEpisodeCount: 0,
    localAuthorityPoseConvergenceStepCount: 0,
    reset() {
      resetCalls += 1;
    }
  };
}

test("MetaverseTraversalTelemetryState tracks correction counts and resets delegated reconciliation state", async () => {
  const [{ MetaverseTraversalTelemetryState }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load(
        "/src/metaverse/traversal/classes/metaverse-traversal-telemetry-state.ts"
      ),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);
  const reconciliationState = createReconciliationStateStub();
  const telemetryState = new MetaverseTraversalTelemetryState({
    config: metaverseRuntimeConfig,
    groundedBodyRuntime: {
      isInitialized: false
    },
    localAuthorityReconciliationState: reconciliationState,
    localTraversalAuthorityState: {
      latestIssuedTraversalIntentSnapshot: null,
      snapshot: createMetaverseTraversalAuthoritySnapshot()
    },
    readLocomotionMode: () => "grounded",
    surfaceColliderSnapshots: Object.freeze([]),
    surfaceLocomotionState: {
      latestAutomaticSurfaceTelemetrySnapshot: Object.freeze({
        automaticSurfaceSnapshot: Object.freeze({
          debug: Object.freeze({
            blockingAffordanceDetected: null,
            reason: "none",
            resolvedSupportHeightMeters: null,
            supportingAffordanceSampleCount: 0
          })
        }),
        autostepHeightMeters: null
      }),
      readSwimSnapshot() {
        return null;
      }
    }
  });

  telemetryState.recordMountedVehicleAuthorityCorrection();
  telemetryState.recordLocalAuthorityConvergence({ episodeStarted: false });

  assert.equal(telemetryState.localReconciliationCorrectionCount, 2);
  assert.equal(telemetryState.mountedVehicleAuthorityCorrectionCount, 1);
  assert.equal(
    telemetryState.lastLocalReconciliationCorrectionSource,
    "local-authority-convergence-step"
  );
  assert.equal(telemetryState.localAuthorityPoseCorrectionCount, 0);
  assert.equal(
    telemetryState.authoritativeCorrectionTelemetrySnapshot.applied,
    false
  );

  telemetryState.reset();

  assert.equal(telemetryState.localReconciliationCorrectionCount, 0);
  assert.equal(telemetryState.mountedVehicleAuthorityCorrectionCount, 0);
  assert.equal(
    telemetryState.lastLocalReconciliationCorrectionSource,
    "none"
  );
  assert.equal(reconciliationState.resetCalls, 1);
});

test("MetaverseTraversalTelemetryState publishes surface-routing telemetry without fabricating grounded-only body telemetry off the swim path", async () => {
  const [{ MetaverseTraversalTelemetryState }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load(
        "/src/metaverse/traversal/classes/metaverse-traversal-telemetry-state.ts"
      ),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);
  const traversalAuthoritySnapshot = createMetaverseTraversalAuthoritySnapshot();
  const telemetryState = new MetaverseTraversalTelemetryState({
    config: metaverseRuntimeConfig,
    groundedBodyRuntime: {
      isInitialized: false
    },
    localAuthorityReconciliationState: createReconciliationStateStub(),
    localTraversalAuthorityState: {
      latestIssuedTraversalIntentSnapshot: null,
      snapshot: traversalAuthoritySnapshot
    },
    readLocomotionMode: () => "swim",
    surfaceColliderSnapshots: Object.freeze([]),
    surfaceLocomotionState: {
      latestAutomaticSurfaceTelemetrySnapshot: Object.freeze({
        automaticSurfaceSnapshot: Object.freeze({
          debug: Object.freeze({
            blockingAffordanceDetected: false,
            reason: "capability-transition-validated",
            resolvedSupportHeightMeters: 0.42,
            supportingAffordanceSampleCount: 2
          })
        }),
        autostepHeightMeters: 0.18
      }),
      readSwimSnapshot() {
        return null;
      }
    }
  });

  assert.deepEqual(telemetryState.surfaceRoutingLocalTelemetrySnapshot, {
    autostepHeightMeters: 0.18,
    blockingAffordanceDetected: false,
    decisionReason: "capability-transition-validated",
    groundedBody: null,
    locomotionMode: "swim",
    resolvedSupportHeightMeters: 0.42,
    swimBody: null,
    supportingAffordanceSampleCount: 2,
    traversalAuthority: traversalAuthoritySnapshot
  });
});

test("MetaverseTraversalTelemetryState captures local and authoritative surface-routing context for local-authority convergence", async () => {
  const [{ MetaverseTraversalTelemetryState }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load(
        "/src/metaverse/traversal/classes/metaverse-traversal-telemetry-state.ts"
      ),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);
  const telemetryState = new MetaverseTraversalTelemetryState({
    config: metaverseRuntimeConfig,
    groundedBodyRuntime: {
      isInitialized: false
    },
    localAuthorityReconciliationState: createReconciliationStateStub(),
    localTraversalAuthorityState: {
      latestIssuedTraversalIntentSnapshot: Object.freeze({
        actionIntent: Object.freeze({
          kind: "none",
          pressed: false,
          sequence: 0
        }),
        bodyControl: Object.freeze({
          boost: true,
          moveAxis: 1,
          strafeAxis: -0.25,
          turnAxis: 0.5
        }),
        sequence: 19,
        locomotionMode: "grounded"
      }),
      snapshot: createMetaverseTraversalAuthoritySnapshot()
    },
    readLocomotionMode: () => "grounded",
    surfaceColliderSnapshots: Object.freeze([
      Object.freeze({
        halfExtents: Object.freeze({ x: 4, y: 0.2, z: 4 }),
        ownerEnvironmentAssetId: null,
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        rotationYRadians: 0,
        translation: Object.freeze({ x: 0, y: -0.1, z: 24 }),
        traversalAffordance: "support"
      })
    ]),
    surfaceLocomotionState: {
      latestAutomaticSurfaceTelemetrySnapshot: Object.freeze({
        automaticSurfaceSnapshot: Object.freeze({
          debug: Object.freeze({
            blockingAffordanceDetected: false,
            reason: "capability-maintained",
            resolvedSupportHeightMeters: 0.1,
            supportingAffordanceSampleCount: 1
          })
        }),
        autostepHeightMeters: 0.12
      }),
      readSwimSnapshot() {
        return null;
      }
    }
  });

  const snapshot = telemetryState.createLocalAuthorityPoseCorrectionSnapshot({
    authoritativePlayerSnapshot: Object.freeze({
      groundedBody: createMetaverseGroundedBodyRuntimeSnapshot({
        grounded: true,
        linearVelocity: Object.freeze({ x: 0.5, y: 0, z: -1.2 }),
        position: Object.freeze({ x: 0, y: 0, z: 24 }),
        yawRadians: 0
      }),
      lastProcessedTraversalSequence: 18,
      linearVelocity: Object.freeze({ x: 0.5, y: 0, z: -1.2 }),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: Object.freeze({ x: 0, y: 0, z: 24 }),
      traversalAuthority: createMetaverseTraversalAuthoritySnapshot(),
      yawRadians: 0
    }),
    localGroundedBodySnapshot: null,
    localIssuedTraversalIntentSnapshot: Object.freeze({
      actionIntent: Object.freeze({
        kind: "none",
        pressed: false,
        sequence: 0
      }),
      bodyControl: Object.freeze({
        boost: true,
        moveAxis: 1,
        strafeAxis: -0.25,
        turnAxis: 0.5
      }),
      sequence: 19,
      locomotionMode: "grounded"
    }),
    localSwimBodySnapshot: null,
    localTraversalPose: Object.freeze({
      linearVelocity: Object.freeze({ x: 0, y: 0, z: 0 }),
      locomotionMode: "grounded",
      position: Object.freeze({ x: 0.4, y: 0.2, z: 23.7 }),
      yawRadians: 0
    })
  });

  assert.deepEqual(snapshot.local, {
    groundedBody: null,
    issuedTraversalIntent: {
      actionIntent: {
        kind: "none",
        pressed: false,
        sequence: 0
      },
      bodyControl: {
        boost: true,
        moveAxis: 1,
        strafeAxis: -0.25,
        turnAxis: 0.5
      },
      sequence: 19,
      locomotionMode: "grounded"
    },
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0
    },
    locomotionMode: "grounded",
    position: {
      x: 0.4,
      y: 0.2,
      z: 23.7
    },
    swimBody: null,
    surfaceRouting: {
      autostepHeightMeters: 0.12,
      blockingAffordanceDetected: false,
      decisionReason: "capability-maintained",
      groundedBody: null,
      locomotionMode: "grounded",
      resolvedSupportHeightMeters: 0.1,
      swimBody: null,
      supportingAffordanceSampleCount: 1,
      traversalAuthority: createMetaverseTraversalAuthoritySnapshot()
    }
  });
  assert.deepEqual(snapshot.authoritative.linearVelocity, {
    x: 0.5,
    y: 0,
    z: -1.2
  });
  assert.deepEqual(snapshot.authoritative.groundedBody, {
    contact: {
      appliedMovementDelta: {
        x: 0,
        y: 0,
        z: 0
      },
      blockedPlanarMovement: false,
      blockedVerticalMovement: false,
      desiredMovementDelta: {
        x: 0,
        y: 0,
        z: 0
      },
      supportingContactDetected: true
    },
    driveTarget: {
      boost: false,
      moveAxis: 0,
      movementMagnitude: 0,
      strafeAxis: 0,
      targetForwardSpeedUnitsPerSecond: 0,
      targetPlanarSpeedUnitsPerSecond: 0,
      targetStrafeSpeedUnitsPerSecond: 0
    },
    interaction: {
      applyImpulsesToDynamicBodies: false
    },
    jumpBody: {
      grounded: true,
      jumpGroundContactGraceSecondsRemaining: 0,
      jumpReady: true,
      jumpSnapSuppressionActive: false,
      verticalSpeedUnitsPerSecond: 0
    }
  });
  assert.equal(snapshot.authoritative.lastProcessedTraversalSequence, 18);
  assert.equal(snapshot.authoritative.locomotionMode, "grounded");
  assert.equal(snapshot.authoritative.swimBody, null);
  assert.equal(
    snapshot.authoritative.surfaceRouting.decisionReason,
    "capability-maintained"
  );
  assert.equal(
    snapshot.authoritative.surfaceRouting.resolvedSupportHeightMeters,
    0
  );
});
