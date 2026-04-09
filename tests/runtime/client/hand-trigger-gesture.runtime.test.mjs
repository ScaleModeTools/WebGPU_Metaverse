import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createCalibrationShotSample,
  createHandTriggerCalibrationSnapshot
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";
import { createTrackedHandPose } from "./tracked-hand-pose-fixture.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createFocusedTriggerPose(pose) {
  return {
    thumbBase: pose.thumbBase ?? pose.thumbKnuckle,
    thumbKnuckle: pose.thumbKnuckle,
    thumbJoint: pose.thumbJoint,
    thumbTip: pose.thumbTip,
    indexBase: pose.indexBase,
    indexKnuckle: pose.indexKnuckle,
    indexJoint: pose.indexJoint,
    indexTip: pose.indexTip,
    middlePip: pose.middlePip
  };
}

function distortPoseAlongIndexAxis(pose, factor) {
  const anchor = pose.indexKnuckle;
  const axisVector = {
    x: pose.indexTip.x - pose.indexKnuckle.x,
    y: pose.indexTip.y - pose.indexKnuckle.y,
    z: pose.indexTip.z - pose.indexKnuckle.z
  };
  const axisMagnitude = Math.hypot(axisVector.x, axisVector.y, axisVector.z) || 1;
  const axis = {
    x: axisVector.x / axisMagnitude,
    y: axisVector.y / axisMagnitude,
    z: axisVector.z / axisMagnitude
  };

  return Object.fromEntries(
    Object.entries(pose).map(([landmarkId, point]) => {
      const relativePoint = {
        x: point.x - anchor.x,
        y: point.y - anchor.y,
        z: point.z - anchor.z
      };
      const alongAxis =
        relativePoint.x * axis.x +
        relativePoint.y * axis.y +
        relativePoint.z * axis.z;
      const orthogonalPoint = {
        x: relativePoint.x - axis.x * alongAxis,
        y: relativePoint.y - axis.y * alongAxis,
        z: relativePoint.z - axis.z * alongAxis
      };

      return [
        landmarkId,
        {
          x: anchor.x + orthogonalPoint.x + axis.x * alongAxis * factor,
          y: anchor.y + orthogonalPoint.y + axis.y * alongAxis * factor,
          z: anchor.z + orthogonalPoint.z + axis.z * alongAxis * factor
        }
      ];
    })
  );
}

test("evaluateHandTriggerGesture uses the thumb and index chains without a wrist pivot", async () => {
  const { cameraThumbTriggerGestureConfig, evaluateHandTriggerGesture } =
    await clientLoader.load("/src/tracking/index.ts");
  const triggerConfig = cameraThumbTriggerGestureConfig;
  const openPose = createTrackedHandPose(0.5, 0.4, 0);
  const pressedPose = createTrackedHandPose(0.5, 0.4, 1);

  const openGesture = evaluateHandTriggerGesture(openPose, false, triggerConfig);

  assert.equal(openGesture.triggerPressed, false);
  assert.equal(openGesture.triggerReady, true);
  assert.equal(
    openGesture.axisAngleDegrees >= triggerConfig.releaseAxisAngleDegrees ||
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

test("evaluateHandTriggerGesture fires from either index-base or middle-PIP contact", async () => {
  const { cameraThumbTriggerGestureConfig, evaluateHandTriggerGesture } =
    await clientLoader.load("/src/tracking/index.ts");
  const triggerConfig = cameraThumbTriggerGestureConfig;
  const readyPose = createFocusedTriggerPose({
    thumbBase: { x: 0.36, y: 0.58, z: 0.01 },
    thumbKnuckle: { x: 0.39, y: 0.54, z: 0.008 },
    thumbJoint: { x: 0.38, y: 0.48, z: 0.006 },
    thumbTip: { x: 0.34, y: 0.38, z: 0.004 },
    indexBase: { x: 0.48, y: 0.62, z: 0.01 },
    indexKnuckle: { x: 0.49, y: 0.56, z: 0.008 },
    indexJoint: { x: 0.53, y: 0.5, z: 0.006 },
    indexTip: { x: 0.57, y: 0.46, z: 0.004 },
    middlePip: { x: 0.43, y: 0.49, z: 0.008 }
  });
  const indexBaseContactPose = createFocusedTriggerPose({
    thumbBase: { x: 0.42, y: 0.59, z: 0.01 },
    thumbKnuckle: { x: 0.42, y: 0.55, z: 0.008 },
    thumbJoint: { x: 0.44, y: 0.57, z: 0.006 },
    thumbTip: { x: 0.48, y: 0.61, z: 0.004 },
    indexBase: { x: 0.48, y: 0.62, z: 0.01 },
    indexKnuckle: { x: 0.49, y: 0.56, z: 0.008 },
    indexJoint: { x: 0.53, y: 0.5, z: 0.006 },
    indexTip: { x: 0.57, y: 0.46, z: 0.004 },
    middlePip: { x: 0.31, y: 0.41, z: 0.008 }
  });
  const middlePipContactPose = createFocusedTriggerPose({
    thumbBase: { x: 0.42, y: 0.59, z: 0.01 },
    thumbKnuckle: { x: 0.42, y: 0.55, z: 0.008 },
    thumbJoint: { x: 0.4, y: 0.49, z: 0.006 },
    thumbTip: { x: 0.43, y: 0.485, z: 0.004 },
    indexBase: { x: 0.48, y: 0.62, z: 0.01 },
    indexKnuckle: { x: 0.49, y: 0.56, z: 0.008 },
    indexJoint: { x: 0.53, y: 0.5, z: 0.006 },
    indexTip: { x: 0.57, y: 0.46, z: 0.004 },
    middlePip: { x: 0.43, y: 0.49, z: 0.008 }
  });

  const readyGesture = evaluateHandTriggerGesture(readyPose, false, triggerConfig);
  const indexBaseContactGesture = evaluateHandTriggerGesture(
    indexBaseContactPose,
    false,
    triggerConfig
  );
  const middlePipContactGesture = evaluateHandTriggerGesture(
    middlePipContactPose,
    false,
    triggerConfig
  );

  assert.equal(readyGesture.triggerPressed, false);
  assert.equal(readyGesture.triggerReady, true);
  assert.equal(indexBaseContactGesture.triggerPressed, true);
  assert.equal(indexBaseContactGesture.triggerReady, false);
  assert.equal(middlePipContactGesture.triggerPressed, true);
  assert.equal(middlePipContactGesture.triggerReady, false);
  assert.equal(
    readyGesture.engagementRatio > indexBaseContactGesture.engagementRatio,
    true
  );
  assert.equal(
    readyGesture.engagementRatio > middlePipContactGesture.engagementRatio,
    true
  );
});

test("evaluateHandTriggerGesture keeps ready and pressed states stable under index-axis foreshortening", async () => {
  const { cameraThumbTriggerGestureConfig, evaluateHandTriggerGesture } =
    await clientLoader.load("/src/tracking/index.ts");
  const triggerConfig = cameraThumbTriggerGestureConfig;
  const readyPose = createTrackedHandPose(0.5, 0.4, 0);
  const pressedPose = createTrackedHandPose(0.5, 0.4, 1);

  for (const foreshorteningFactor of [1, 0.75, 0.5, 0.25]) {
    const readyGesture = evaluateHandTriggerGesture(
      distortPoseAlongIndexAxis(readyPose, foreshorteningFactor),
      false,
      triggerConfig
    );
    const pressedGesture = evaluateHandTriggerGesture(
      distortPoseAlongIndexAxis(pressedPose, foreshorteningFactor),
      false,
      triggerConfig
    );

    assert.equal(readyGesture.triggerPressed, false);
    assert.equal(readyGesture.triggerReady, true);
    assert.equal(pressedGesture.triggerPressed, true);
    assert.equal(pressedGesture.triggerReady, false);
  }
});

test("readObservedAimPoint projects from the index chain instead of using the raw tip", async () => {
  const { readObservedAimPoint } = await clientLoader.load("/src/tracking/index.ts");
  const { handAimObservationConfig } = await clientLoader.load(
    "/src/tracking/config/hand-aim-observation.ts"
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
  const { summarizeHandTriggerCalibration } = await clientLoader.load(
    "/src/tracking/index.ts"
  );
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
    cameraThumbTriggerGestureConfig,
    evaluateHandTriggerGesture,
    resolveHandTriggerGestureThresholds
  } = await clientLoader.load("/src/tracking/index.ts");
  const triggerConfig = cameraThumbTriggerGestureConfig;
  const calibration = createHandTriggerCalibrationSnapshot({
    sampleCount: 9,
    pressedAxisAngleDegreesMax: 20,
    pressedEngagementRatioMax: 0.31,
    readyAxisAngleDegreesMin: 34,
    readyEngagementRatioMin: 0.75
  });
  const borderlinePose = createTrackedHandPose(0.5, 0.4, 0.75);
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
