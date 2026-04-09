import {
  createHandTriggerCalibrationSnapshot,
  createHandTriggerMetricSnapshot,
  createDegrees,
  type CalibrationShotSample,
  type Degrees,
  type HandTriggerCalibrationSnapshot,
  type HandTriggerMetricSnapshot
} from "@webgpu-metaverse/shared";

import type { HandTrackingPoseSnapshot } from "./hand-tracking";

export interface HandTriggerGestureConfig {
  readonly pressAxisAngleDegrees: Degrees;
  readonly pressEngagementRatio: number;
  readonly releaseAxisAngleDegrees: Degrees;
  readonly releaseEngagementRatio: number;
  readonly calibration: {
    readonly pressAxisWindowFraction: number;
    readonly pressEngagementWindowFraction: number;
    readonly releaseAxisWindowFraction: number;
    readonly releaseEngagementWindowFraction: number;
  };
}

export interface HandTriggerGestureSnapshot {
  readonly axisAngleDegrees: Degrees;
  readonly engagementRatio: number;
  readonly triggerPressed: boolean;
  readonly triggerReady: boolean;
}

interface HandVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface ResolvedHandTriggerGestureThresholds {
  readonly pressAxisAngleDegrees: Degrees;
  readonly pressEngagementRatio: number;
  readonly releaseAxisAngleDegrees: Degrees;
  readonly releaseEngagementRatio: number;
}

function subtractPoints(
  endPoint: HandVector3,
  startPoint: HandVector3
): HandVector3 {
  return {
    x: endPoint.x - startPoint.x,
    y: endPoint.y - startPoint.y,
    z: endPoint.z - startPoint.z
  };
}

function readVectorMagnitude(vector: HandVector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function readDistance(pointA: HandVector3, pointB: HandVector3): number {
  return readVectorMagnitude(subtractPoints(pointA, pointB));
}

function readAxisAngleDegrees(vectorA: HandVector3, vectorB: HandVector3): Degrees {
  const magnitudeA = readVectorMagnitude(vectorA);
  const magnitudeB = readVectorMagnitude(vectorB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return createDegrees(180);
  }

  const normalizedDotProduct =
    (vectorA.x * vectorB.x + vectorA.y * vectorB.y + vectorA.z * vectorB.z) /
    (magnitudeA * magnitudeB);
  const clampedDotProduct = Math.min(1, Math.max(-1, normalizedDotProduct));

  return createDegrees((Math.acos(clampedDotProduct) * 180) / Math.PI);
}

function readTriggerEngagementRatio(
  pose: HandTrackingPoseSnapshot
): number {
  const triggerScale = Math.max(
    readDistance(pose.thumbKnuckle, pose.indexKnuckle),
    0.0001
  );
  const thumbTipTriggerContactDistance = Math.min(
    readDistance(pose.thumbTip, pose.indexBase),
    readDistance(pose.thumbTip, pose.middlePip)
  );

  // Use the nearest trigger contact target so pitch and foreshortening matter
  // less than the actual thumb-to-trigger contact motion.
  return thumbTipTriggerContactDistance / triggerScale;
}

function readTriggerAxisAngleDegrees(
  pose: HandTrackingPoseSnapshot
): Degrees {
  return readAxisAngleDegrees(
    subtractPoints(pose.thumbTip, pose.thumbKnuckle),
    subtractPoints(pose.indexJoint, pose.thumbKnuckle)
  );
}

function clampWindowFraction(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.min(1, Math.max(0, rawValue));
}

function resolvePressThreshold(
  baseThreshold: number,
  pressedMax: number,
  readyMin: number,
  windowFraction: number
): number {
  const normalizedReadyMin = Math.max(pressedMax, readyMin);
  const gap = normalizedReadyMin - pressedMax;

  if (gap <= 0) {
    return baseThreshold;
  }

  return Math.min(
    baseThreshold,
    pressedMax + gap * clampWindowFraction(windowFraction)
  );
}

function resolveReleaseThreshold(
  baseThreshold: number,
  pressedMax: number,
  readyMin: number,
  windowFraction: number
): number {
  const normalizedReadyMin = Math.max(pressedMax, readyMin);
  const gap = normalizedReadyMin - pressedMax;

  if (gap <= 0) {
    return baseThreshold;
  }

  return Math.max(
    baseThreshold,
    pressedMax + gap * clampWindowFraction(windowFraction)
  );
}

export function readHandTriggerMetrics(
  pose: HandTrackingPoseSnapshot
): HandTriggerMetricSnapshot {
  return createHandTriggerMetricSnapshot({
    axisAngleDegrees: readTriggerAxisAngleDegrees(pose),
    engagementRatio: readTriggerEngagementRatio(pose)
  });
}

export function summarizeHandTriggerCalibration(
  samples: readonly CalibrationShotSample[]
): HandTriggerCalibrationSnapshot | null {
  let sampleCount = 0;
  let pressedAxisAngleDegreesMax = 0;
  let pressedEngagementRatioMax = 0;
  let readyAxisAngleDegreesMin = Number.POSITIVE_INFINITY;
  let readyEngagementRatioMin = Number.POSITIVE_INFINITY;

  for (const sample of samples) {
    if (
      sample.pressedTriggerMetrics === null ||
      sample.readyTriggerMetrics === null
    ) {
      continue;
    }

    sampleCount += 1;
    pressedAxisAngleDegreesMax = Math.max(
      pressedAxisAngleDegreesMax,
      sample.pressedTriggerMetrics.axisAngleDegrees
    );
    pressedEngagementRatioMax = Math.max(
      pressedEngagementRatioMax,
      sample.pressedTriggerMetrics.engagementRatio
    );
    readyAxisAngleDegreesMin = Math.min(
      readyAxisAngleDegreesMin,
      sample.readyTriggerMetrics.axisAngleDegrees
    );
    readyEngagementRatioMin = Math.min(
      readyEngagementRatioMin,
      sample.readyTriggerMetrics.engagementRatio
    );
  }

  if (sampleCount === 0) {
    return null;
  }

  return createHandTriggerCalibrationSnapshot({
    sampleCount,
    pressedAxisAngleDegreesMax,
    pressedEngagementRatioMax,
    readyAxisAngleDegreesMin:
      readyAxisAngleDegreesMin === Number.POSITIVE_INFINITY
        ? pressedAxisAngleDegreesMax
        : readyAxisAngleDegreesMin,
    readyEngagementRatioMin:
      readyEngagementRatioMin === Number.POSITIVE_INFINITY
        ? pressedEngagementRatioMax
        : readyEngagementRatioMin
  });
}

export function resolveHandTriggerGestureThresholds(
  config: HandTriggerGestureConfig,
  calibration: HandTriggerCalibrationSnapshot | null = null
): ResolvedHandTriggerGestureThresholds {
  if (calibration === null || calibration.sampleCount === 0) {
    return Object.freeze({
      pressAxisAngleDegrees: config.pressAxisAngleDegrees,
      pressEngagementRatio: config.pressEngagementRatio,
      releaseAxisAngleDegrees: config.releaseAxisAngleDegrees,
      releaseEngagementRatio: config.releaseEngagementRatio
    });
  }

  const pressAxisAngleDegrees = resolvePressThreshold(
    config.pressAxisAngleDegrees,
    calibration.pressedAxisAngleDegreesMax,
    calibration.readyAxisAngleDegreesMin,
    config.calibration.pressAxisWindowFraction
  );
  const pressEngagementRatio = resolvePressThreshold(
    config.pressEngagementRatio,
    calibration.pressedEngagementRatioMax,
    calibration.readyEngagementRatioMin,
    config.calibration.pressEngagementWindowFraction
  );

  return Object.freeze({
    pressAxisAngleDegrees: createDegrees(pressAxisAngleDegrees),
    pressEngagementRatio,
    releaseAxisAngleDegrees: createDegrees(
      resolveReleaseThreshold(
        config.releaseAxisAngleDegrees,
        calibration.pressedAxisAngleDegreesMax,
        calibration.readyAxisAngleDegreesMin,
        config.calibration.releaseAxisWindowFraction
      )
    ),
    releaseEngagementRatio: resolveReleaseThreshold(
      config.releaseEngagementRatio,
      calibration.pressedEngagementRatioMax,
      calibration.readyEngagementRatioMin,
      config.calibration.releaseEngagementWindowFraction
    )
  });
}

export function evaluateHandTriggerGesture(
  pose: HandTrackingPoseSnapshot,
  triggerHeld: boolean,
  config: HandTriggerGestureConfig,
  calibration: HandTriggerCalibrationSnapshot | null = null
): HandTriggerGestureSnapshot {
  const metrics = readHandTriggerMetrics(pose);
  const thresholds = resolveHandTriggerGestureThresholds(config, calibration);
  const hardContactPressSatisfied =
    metrics.engagementRatio <= thresholds.pressEngagementRatio * 0.6;
  const alignedContactPressSatisfied =
    metrics.engagementRatio <= thresholds.pressEngagementRatio &&
    metrics.axisAngleDegrees <= thresholds.pressAxisAngleDegrees;
  const pressSatisfied =
    hardContactPressSatisfied || alignedContactPressSatisfied;
  const releaseSatisfied =
    metrics.engagementRatio >= thresholds.releaseEngagementRatio ||
    metrics.axisAngleDegrees >= thresholds.releaseAxisAngleDegrees;
  const nextTriggerPressed = triggerHeld ? !releaseSatisfied : pressSatisfied;

  return Object.freeze({
    axisAngleDegrees: metrics.axisAngleDegrees,
    engagementRatio: metrics.engagementRatio,
    triggerPressed: nextTriggerPressed,
    triggerReady: !nextTriggerPressed && releaseSatisfied
  });
}
