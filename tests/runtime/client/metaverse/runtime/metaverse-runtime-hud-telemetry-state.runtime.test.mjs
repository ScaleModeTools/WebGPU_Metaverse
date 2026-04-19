import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createFakeHudPublisherDependencies,
  createFakeRenderedCamera,
  createPublishInput
} from "./fixtures/metaverse-runtime-hud-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRuntimeHudTelemetryState tracks camera snap and local reconciliation telemetry behind the HUD seam", async () => {
  const { MetaverseRuntimeHudTelemetryState } = await clientLoader.load(
    "/src/metaverse/hud/debug/metaverse-runtime-hud-telemetry-state.ts"
  );
  let nowMs = 0;
  const dependencies = createFakeHudPublisherDependencies(() => nowMs);
  const telemetryState = new MetaverseRuntimeHudTelemetryState(dependencies);
  const renderedCamera = createFakeRenderedCamera();

  telemetryState.trackFrame(
    nowMs,
    dependencies.traversalRuntime.cameraSnapshot,
    renderedCamera
  );

  dependencies.traversalRuntime.lastLocalAuthorityPoseCorrectionDetail =
    Object.freeze({
      authoritativeGrounded: true,
      localGrounded: false,
      planarMagnitudeMeters: 1.2,
      verticalMagnitudeMeters: 0.3
    });
  dependencies.traversalRuntime.lastLocalAuthorityPoseCorrectionSnapshot =
    Object.freeze({
      authoritative: Object.freeze({
        lastProcessedInputSequence: 24,
        linearVelocity: Object.freeze({
          x: 2.4,
          y: 0,
          z: -0.7
        }),
        locomotionMode: "swim",
        position: Object.freeze({
          x: 1.1,
          y: 0.8,
          z: -4.2
        }),
        surfaceRouting: Object.freeze({
          blockingAffordanceDetected: false,
          decisionReason: "capability-transition-validated",
          resolvedSupportHeightMeters: null,
          supportingAffordanceSampleCount: 0
        })
      }),
      local: Object.freeze({
        issuedTraversalIntent: Object.freeze({
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
          inputSequence: 25,
          locomotionMode: "swim"
        }),
        linearVelocity: Object.freeze({
          x: 2.2,
          y: 0,
          z: -0.5
        }),
        locomotionMode: "grounded",
        position: Object.freeze({
          x: 0.4,
          y: 1.1,
          z: -3.6
        }),
        surfaceRouting: Object.freeze({
          autostepHeightMeters: 0.2,
          blockingAffordanceDetected: false,
          decisionReason: "capability-maintained",
          jumpDebug: Object.freeze({
            groundedBodyGrounded: false,
            groundedBodyJumpReady: true,
            surfaceJumpSupported: false,
            supported: true,
            verticalSpeedUnitsPerSecond: -0.4
          }),
          locomotionMode: "grounded",
          resolvedSupportHeightMeters: 0.6,
          supportingAffordanceSampleCount: 2,
          traversalAuthority: Object.freeze({
            currentActionKind: "none",
            currentActionPhase: "idle",
            currentActionSequence: 0,
            lastConsumedActionSequence: 0,
            lastRejectedActionReason: "none",
            lastRejectedActionSequence: 0,
            phaseStartedAtTick: 0
          })
        })
      })
    });
  dependencies.traversalRuntime.lastLocalAuthorityPoseCorrectionReason =
    "gross-position-divergence";
  dependencies.traversalRuntime.lastLocalReconciliationCorrectionSource =
    "local-authority-snap";
  dependencies.traversalRuntime.localAuthorityPoseCorrectionCount = 1;
  dependencies.traversalRuntime.localReconciliationCorrectionCount = 1;
  renderedCamera.position.x = 0.4;
  nowMs = 250;

  telemetryState.trackFrame(
    nowMs,
    dependencies.traversalRuntime.cameraSnapshot,
    renderedCamera
  );

  const telemetrySnapshot = telemetryState.createSnapshot(
    nowMs,
    createPublishInput()
  );

  assert.equal(
    telemetrySnapshot.worldSnapshot.cameraPresentation.renderedSnap.totalCount,
    1
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.cameraPresentation.renderedSnap
      .recentCountPast5Seconds,
    1
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.localReconciliation
      .recentCorrectionCountPast5Seconds,
    1
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.localReconciliation
      .recentLocalAuthorityPoseCorrectionCountPast5Seconds,
    1
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.localReconciliation.lastCorrectionSource,
    "local-authority-snap"
  );
  assert.equal(
    telemetrySnapshot.worldSnapshot.localReconciliation
      .lastLocalAuthorityPoseCorrectionReason,
    "gross-position-divergence"
  );
  assert.deepEqual(
    telemetrySnapshot.worldSnapshot.localReconciliation
      .lastLocalAuthorityPoseCorrectionSnapshot,
    {
      authoritative: {
        lastProcessedInputSequence: 24,
        linearVelocity: {
          x: 2.4,
          y: 0,
          z: -0.7
        },
        locomotionMode: "swim",
        position: {
          x: 1.1,
          y: 0.8,
          z: -4.2
        },
        surfaceRouting: {
          blockingAffordanceDetected: false,
          decisionReason: "capability-transition-validated",
          resolvedSupportHeightMeters: null,
          supportingAffordanceSampleCount: 0
        }
      },
      local: {
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
          inputSequence: 25,
          locomotionMode: "swim"
        },
        linearVelocity: {
          x: 2.2,
          y: 0,
          z: -0.5
        },
        locomotionMode: "grounded",
        position: {
          x: 0.4,
          y: 1.1,
          z: -3.6
        },
        surfaceRouting: {
          autostepHeightMeters: 0.2,
          blockingAffordanceDetected: false,
          decisionReason: "capability-maintained",
          jumpDebug: {
            groundedBodyGrounded: false,
            groundedBodyJumpReady: true,
            surfaceJumpSupported: false,
            supported: true,
            verticalSpeedUnitsPerSecond: -0.4
          },
          locomotionMode: "grounded",
          resolvedSupportHeightMeters: 0.6,
          supportingAffordanceSampleCount: 2,
          traversalAuthority: {
            currentActionKind: "none",
            currentActionPhase: "idle",
            currentActionSequence: 0,
            lastConsumedActionSequence: 0,
            lastRejectedActionReason: "none",
            lastRejectedActionSequence: 0,
            phaseStartedAtTick: 0
          }
        }
      }
    }
  );
  assert.equal(telemetrySnapshot.renderer.drawCallCount, 7);
  assert.equal(telemetrySnapshot.renderer.triangleCount, 42);
  assert.equal(telemetrySnapshot.worldSnapshot.datagramSendFailureCount, 3);
});
