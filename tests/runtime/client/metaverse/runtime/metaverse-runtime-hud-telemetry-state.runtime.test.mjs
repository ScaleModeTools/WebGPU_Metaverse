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
  assert.equal(telemetrySnapshot.renderer.drawCallCount, 7);
  assert.equal(telemetrySnapshot.renderer.triangleCount, 42);
  assert.equal(telemetrySnapshot.worldSnapshot.datagramSendFailureCount, 3);
});
