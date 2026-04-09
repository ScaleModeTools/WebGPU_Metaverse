import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";
import { createTrackedHandSnapshot } from "./tracked-hand-pose-fixture.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createTrackedHandCalibrationPoseCapture exports the focused trigger landmarks only", async () => {
  const {
    trackedHandCalibrationCaptureOmittedLandmarkIds,
    trackedHandCalibrationOverlayLandmarkIds,
    createTrackedHandCalibrationPoseCapture,
    createTrackedHandCalibrationPoseCaptureExport
  } = await clientLoader.load("/src/tracking/index.ts");
  const trackedSnapshot = createTrackedHandSnapshot(4, 0.48, 0.34, 0.9);
  const capture = createTrackedHandCalibrationPoseCapture("shoot", trackedSnapshot);
  const captureExport = createTrackedHandCalibrationPoseCaptureExport([capture]);

  assert.equal(capture.label, "shoot");
  assert.equal(typeof capture.capturedAtIso, "string");
  assert.equal(capture.sequenceNumber, trackedSnapshot.sequenceNumber);
  assert.equal(capture.trackingTimestampMs, trackedSnapshot.timestampMs);
  assert.equal(capture.observedAimPoint.y < trackedSnapshot.pose.indexTip.y, true);
  assert.deepEqual(Object.keys(capture.pose), [
    "thumbKnuckle",
    "thumbJoint",
    "thumbTip",
    "indexBase",
    "indexKnuckle",
    "indexJoint",
    "indexTip",
    "middlePip"
  ]);
  assert.equal("thumbBase" in capture.pose, false);
  assert.equal("indexBase" in capture.pose, true);
  assert.equal("middlePip" in capture.pose, true);
  assert.equal(typeof capture.triggerGesture.triggerPressed, "boolean");
  assert.equal(typeof capture.triggerGesture.triggerReady, "boolean");
  assert.equal(typeof capture.triggerGesture.axisAngleDegrees, "number");
  assert.equal(typeof capture.triggerGesture.engagementRatio, "number");
  assert.deepEqual(
    captureExport.captureLandmarkIds,
    trackedHandCalibrationOverlayLandmarkIds.capture
  );
  assert.deepEqual(
    captureExport.omittedRuntimeLandmarkIds,
    trackedHandCalibrationCaptureOmittedLandmarkIds
  );
  assert.equal(captureExport.captures.length, 1);
});

test("createTrackedHandCalibrationPoseCapture normalizes blank labels to sample", async () => {
  const { createTrackedHandCalibrationPoseCapture } = await clientLoader.load(
    "/src/tracking/index.ts"
  );
  const trackedSnapshot = createTrackedHandSnapshot(2, 0.3, 0.22);
  const capture = createTrackedHandCalibrationPoseCapture("   ", trackedSnapshot);

  assert.equal(capture.label, "sample");
});
