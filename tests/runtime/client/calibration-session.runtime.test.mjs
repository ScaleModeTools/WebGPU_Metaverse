import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createCalibrationShotSample } from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";
import { createTrackedHandSnapshot } from "./tracked-hand-pose-fixture.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("TrackedHandCalibrationSession captures one sample per trigger press and completes on the ninth anchor", async () => {
  const {
    TrackedHandCalibrationSession,
    trackedHandCalibrationConfig
  } = await clientLoader.load("/src/tracking/index.ts");
  const session = new TrackedHandCalibrationSession();
  const capturedAnchorIds = [];
  let fittedCalibration = null;
  let triggerCalibration = null;
  let sequenceNumber = 0;

  for (const anchor of trackedHandCalibrationConfig.anchors) {
    session.ingestTrackingSnapshot(
      createTrackedHandSnapshot(
        (sequenceNumber += 1),
        anchor.normalizedTarget.x,
        anchor.normalizedTarget.y
      )
    );

    const pressedResult = session.ingestTrackingSnapshot(
      createTrackedHandSnapshot(
        (sequenceNumber += 1),
        anchor.normalizedTarget.x,
        anchor.normalizedTarget.y,
        1
      )
    );

    if (pressedResult.capturedSample !== null) {
      capturedAnchorIds.push(pressedResult.capturedSample.anchorId);
      assert.notEqual(pressedResult.capturedSample.observedPose.aimPoint, null);
      assert.notEqual(pressedResult.capturedSample.readyTriggerMetrics, null);
      assert.notEqual(pressedResult.capturedSample.pressedTriggerMetrics, null);
    }

    if (pressedResult.fittedCalibration !== null) {
      fittedCalibration = pressedResult.fittedCalibration;
    }

    if (pressedResult.triggerCalibration !== null) {
      triggerCalibration = pressedResult.triggerCalibration;
    }

    const heldResult = session.ingestTrackingSnapshot(
      createTrackedHandSnapshot(
        (sequenceNumber += 1),
        anchor.normalizedTarget.x,
        anchor.normalizedTarget.y,
        1
      )
    );

    assert.equal(heldResult.capturedSample, null);

    session.ingestTrackingSnapshot(
      createTrackedHandSnapshot(
        (sequenceNumber += 1),
        anchor.normalizedTarget.x,
        anchor.normalizedTarget.y
      )
    );
  }

  assert.deepEqual(
    capturedAnchorIds,
    trackedHandCalibrationConfig.anchors.map((anchor) => anchor.id)
  );
  assert.notEqual(fittedCalibration, null);
  assert.notEqual(triggerCalibration, null);
  assert.equal(triggerCalibration?.sampleCount, 9);
  assert.equal(
    triggerCalibration?.readyAxisAngleDegreesMin >
      triggerCalibration?.pressedAxisAngleDegreesMax,
    true
  );
  assert.equal(session.snapshot.captureState, "complete");
  assert.equal(session.snapshot.currentAnchorId, null);
});

test("TrackedHandCalibrationSession resumes only the sequential stored anchor prefix", async () => {
  const { TrackedHandCalibrationSession } = await clientLoader.load(
    "/src/tracking/index.ts"
  );
  const session = new TrackedHandCalibrationSession([
    createCalibrationShotSample({
      anchorId: "center",
      intendedTarget: { x: 0.5, y: 0.5 },
      observedPose: {
        thumbTip: { x: 0.5, y: 0.6 },
        indexTip: { x: 0.5, y: 0.5 }
      }
    }),
    createCalibrationShotSample({
      anchorId: "top-left",
      intendedTarget: { x: 0.1, y: 0.1 },
      observedPose: {
        thumbTip: { x: 0.1, y: 0.2 },
        indexTip: { x: 0.1, y: 0.1 }
      }
    }),
    createCalibrationShotSample({
      anchorId: "bottom-center",
      intendedTarget: { x: 0.5, y: 0.9 },
      observedPose: {
        thumbTip: { x: 0.5, y: 1 },
        indexTip: { x: 0.5, y: 0.9 }
      }
    })
  ]);

  assert.equal(session.snapshot.capturedSampleCount, 2);
  assert.equal(session.snapshot.currentAnchorId, "top-right");
});
