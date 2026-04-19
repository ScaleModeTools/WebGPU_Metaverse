import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
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
      planarMagnitudeMeters: null
    }),
    lastLocalAuthorityPoseCorrectionSnapshot: null,
    lastLocalAuthorityPoseCorrectionReason: "none",
    localAuthorityPoseCorrectionCount: 0,
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
      latestAutomaticSurfaceDecisionReason: "none",
      latestAutostepHeightMeters: null,
      latestBlockingAffordanceDetected: null,
      latestResolvedSupportHeightMeters: null,
      latestSupportingAffordanceSampleCount: 0,
      readSwimSnapshot() {
        return null;
      }
    }
  });

  telemetryState.recordMountedVehicleAuthorityCorrection();
  telemetryState.recordLocalAuthoritySnap();

  assert.equal(telemetryState.localReconciliationCorrectionCount, 2);
  assert.equal(telemetryState.mountedVehicleAuthorityCorrectionCount, 1);
  assert.equal(
    telemetryState.lastLocalReconciliationCorrectionSource,
    "local-authority-snap"
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

test("MetaverseTraversalTelemetryState publishes surface-routing telemetry without fabricating jump support off grounded traversal", async () => {
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
      latestAutomaticSurfaceDecisionReason: "capability-transition-validated",
      latestAutostepHeightMeters: 0.18,
      latestBlockingAffordanceDetected: false,
      latestResolvedSupportHeightMeters: 0.42,
      latestSupportingAffordanceSampleCount: 2,
      readSwimSnapshot() {
        return null;
      }
    }
  });

  assert.deepEqual(telemetryState.localGroundedJumpGateTelemetrySnapshot, {
    groundedBodyGrounded: null,
    groundedBodyJumpReady: null,
    surfaceJumpSupported: null,
    supported: null,
    verticalSpeedUnitsPerSecond: null
  });
  assert.deepEqual(telemetryState.surfaceRoutingLocalTelemetrySnapshot, {
    autostepHeightMeters: 0.18,
    blockingAffordanceDetected: false,
    decisionReason: "capability-transition-validated",
    jumpDebug: {
      groundedBodyGrounded: null,
      groundedBodyJumpReady: null,
      surfaceJumpSupported: null,
      supported: null,
      verticalSpeedUnitsPerSecond: null
    },
    locomotionMode: "swim",
    resolvedSupportHeightMeters: 0.42,
    supportingAffordanceSampleCount: 2,
    traversalAuthority: traversalAuthoritySnapshot
  });
});

test("MetaverseTraversalTelemetryState captures local and authoritative surface-routing context for a local-authority snap", async () => {
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
        inputSequence: 19,
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
      latestAutomaticSurfaceDecisionReason: "capability-maintained",
      latestAutostepHeightMeters: 0.12,
      latestBlockingAffordanceDetected: false,
      latestResolvedSupportHeightMeters: 0.1,
      latestSupportingAffordanceSampleCount: 1,
      readSwimSnapshot() {
        return null;
      }
    }
  });

  const snapshot = telemetryState.createLocalAuthorityPoseCorrectionSnapshot({
    authoritativePlayerSnapshot: Object.freeze({
      lastProcessedInputSequence: 18,
      linearVelocity: Object.freeze({ x: 0.5, y: 0, z: -1.2 }),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: Object.freeze({ x: 0, y: 0, z: 24 }),
      traversalAuthority: createMetaverseTraversalAuthoritySnapshot(),
      yawRadians: 0
    }),
    localTraversalPose: Object.freeze({
      locomotionMode: "grounded",
      position: Object.freeze({ x: 0.4, y: 0.2, z: 23.7 }),
      yawRadians: 0
    })
  });

  assert.deepEqual(snapshot.local, {
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
      inputSequence: 19,
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
    surfaceRouting: {
      autostepHeightMeters: 0.12,
      blockingAffordanceDetected: false,
      decisionReason: "capability-maintained",
      jumpDebug: {
        groundedBodyGrounded: null,
        groundedBodyJumpReady: null,
        surfaceJumpSupported: null,
        supported: null,
        verticalSpeedUnitsPerSecond: null
      },
      locomotionMode: "grounded",
      resolvedSupportHeightMeters: 0.1,
      supportingAffordanceSampleCount: 1,
      traversalAuthority: createMetaverseTraversalAuthoritySnapshot()
    }
  });
  assert.deepEqual(snapshot.authoritative.linearVelocity, {
    x: 0.5,
    y: 0,
    z: -1.2
  });
  assert.equal(snapshot.authoritative.lastProcessedInputSequence, 18);
  assert.equal(snapshot.authoritative.locomotionMode, "grounded");
  assert.equal(
    snapshot.authoritative.surfaceRouting.decisionReason,
    "capability-maintained"
  );
  assert.equal(
    snapshot.authoritative.surfaceRouting.resolvedSupportHeightMeters,
    0.1
  );
});
