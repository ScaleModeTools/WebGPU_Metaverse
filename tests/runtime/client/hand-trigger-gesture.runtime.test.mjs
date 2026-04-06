import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createCalibrationShotSample,
  createHandTriggerCalibrationSnapshot
} from "@thumbshooter/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";
import { createTrackedHandPose } from "./tracked-hand-pose-fixture.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("evaluateHandTriggerGesture uses the thumb and index chains without a wrist pivot", async () => {
  const { calibrationCaptureConfig, evaluateHandTriggerGesture } = await clientLoader.load(
    "/src/game/index.ts"
  );
  const triggerConfig = calibrationCaptureConfig.triggerGesture;
  const openPose = createTrackedHandPose(0.5, 0.4, 0);
  const pressedPose = createTrackedHandPose(0.5, 0.4, 1);

  const openGesture = evaluateHandTriggerGesture(openPose, false, triggerConfig);

  assert.equal(openGesture.triggerPressed, false);
  assert.equal(openGesture.triggerReady, true);
  assert.equal(
    openGesture.axisAngleDegrees >= triggerConfig.releaseAxisAngleDegrees,
    true
  );
  assert.equal(
    openGesture.engagementRatio >= triggerConfig.releaseEngagementRatio,
    true
  );

  const pressedGesture = evaluateHandTriggerGesture(pressedPose, false, triggerConfig);

  assert.equal(pressedGesture.triggerPressed, true);
  assert.equal(pressedGesture.triggerReady, false);
  assert.equal(
    pressedGesture.axisAngleDegrees <= triggerConfig.pressAxisAngleDegrees,
    true
  );
  assert.equal(
    pressedGesture.engagementRatio <= triggerConfig.pressEngagementRatio,
    true
  );
  assert.equal(openGesture.axisAngleDegrees > pressedGesture.axisAngleDegrees, true);
  assert.equal(openGesture.engagementRatio > pressedGesture.engagementRatio, true);

  const releasedGesture = evaluateHandTriggerGesture(openPose, true, triggerConfig);

  assert.equal(releasedGesture.triggerPressed, false);
  assert.equal(releasedGesture.triggerReady, true);
});

test("readObservedAimPoint projects from the index chain instead of using the raw tip", async () => {
  const { readObservedAimPoint } = await clientLoader.load("/src/game/index.ts");
  const { handAimObservationConfig } = await clientLoader.load(
    "/src/game/config/hand-aim-observation.ts"
  );
  const pose = createTrackedHandPose(0.5, 0.4, 0);
  const observedAimPoint = readObservedAimPoint(pose, handAimObservationConfig);

  assert.equal(observedAimPoint.y < pose.indexTip.y, true);
  assert.equal(
    Math.hypot(
      observedAimPoint.x - pose.indexTip.x,
      observedAimPoint.y - pose.indexTip.y
    ) > 0.005,
    true
  );
});

test("summarizeHandTriggerCalibration captures the tightest ready-to-press viewport window", async () => {
  const { summarizeHandTriggerCalibration } = await clientLoader.load("/src/game/index.ts");
  const calibration = summarizeHandTriggerCalibration([
    createCalibrationShotSample({
      anchorId: "center",
      intendedTarget: { x: 0.5, y: 0.5 },
      observedPose: {
        thumbTip: { x: 0.4, y: 0.6 },
        indexTip: { x: 0.55, y: 0.35 }
      },
      readyTriggerMetrics: {
        axisAngleDegrees: 31,
        engagementRatio: 0.94
      },
      pressedTriggerMetrics: {
        axisAngleDegrees: 12,
        engagementRatio: 0.41
      }
    }),
    createCalibrationShotSample({
      anchorId: "top-left",
      intendedTarget: { x: 0.1, y: 0.1 },
      observedPose: {
        thumbTip: { x: 0.2, y: 0.3 },
        indexTip: { x: 0.22, y: 0.16 }
      },
      readyTriggerMetrics: {
        axisAngleDegrees: 26,
        engagementRatio: 0.81
      },
      pressedTriggerMetrics: {
        axisAngleDegrees: 15,
        engagementRatio: 0.47
      }
    })
  ]);

  assert.deepEqual(calibration, {
    sampleCount: 2,
    pressedAxisAngleDegreesMax: 15,
    pressedEngagementRatioMax: 0.47,
    readyAxisAngleDegreesMin: 26,
    readyEngagementRatioMin: 0.81
  });
});

test("evaluateHandTriggerGesture tightens press detection when calibration shows a narrow ready window", async () => {
  const {
    calibrationCaptureConfig,
    evaluateHandTriggerGesture,
    resolveHandTriggerGestureThresholds
  } = await clientLoader.load("/src/game/index.ts");
  const triggerConfig = calibrationCaptureConfig.triggerGesture;
  const calibration = createHandTriggerCalibrationSnapshot({
    sampleCount: 9,
    pressedAxisAngleDegreesMax: 20,
    pressedEngagementRatioMax: 0.31,
    readyAxisAngleDegreesMin: 34,
    readyEngagementRatioMin: 0.75
  });
  const borderlinePose = createTrackedHandPose(0.5, 0.4, 0.9);
  const baseGesture = evaluateHandTriggerGesture(borderlinePose, false, triggerConfig);
  const calibratedGesture = evaluateHandTriggerGesture(
    borderlinePose,
    false,
    triggerConfig,
    calibration
  );
  const thresholds = resolveHandTriggerGestureThresholds(triggerConfig, calibration);

  assert.equal(baseGesture.triggerPressed, true);
  assert.equal(calibratedGesture.triggerPressed, false);
  assert.equal(thresholds.pressAxisAngleDegrees < triggerConfig.pressAxisAngleDegrees, true);
  assert.equal(
    thresholds.pressEngagementRatio < triggerConfig.pressEngagementRatio,
    true
  );
});
