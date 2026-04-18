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
      snapshot: createMetaverseTraversalAuthoritySnapshot()
    },
    readLocomotionMode: () => "grounded",
    surfaceColliderSnapshots: Object.freeze([]),
    surfaceLocomotionState: {
      latestAutomaticSurfaceDecisionReason: "none",
      latestAutostepHeightMeters: null,
      latestBlockerOverlap: null,
      latestResolvedSupportHeightMeters: null,
      latestStepSupportedProbeCount: 0
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
      snapshot: traversalAuthoritySnapshot
    },
    readLocomotionMode: () => "swim",
    surfaceColliderSnapshots: Object.freeze([]),
    surfaceLocomotionState: {
      latestAutomaticSurfaceDecisionReason: "capability-transition-validated",
      latestAutostepHeightMeters: 0.18,
      latestBlockerOverlap: false,
      latestResolvedSupportHeightMeters: 0.42,
      latestStepSupportedProbeCount: 2
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
    blockerOverlap: false,
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
    stepSupportedProbeCount: 2,
    traversalAuthority: traversalAuthoritySnapshot
  });
});
