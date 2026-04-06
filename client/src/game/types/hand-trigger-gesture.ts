import {
  createHandTriggerCalibrationSnapshot,
  createHandTriggerMetricSnapshot,
  type CalibrationShotSample,
  type HandTriggerCalibrationSnapshot,
  type HandTriggerMetricSnapshot
} from "@thumbshooter/shared";

import type { HandTrackingPoseSnapshot } from "./hand-tracking";

export interface HandTriggerGestureConfig {
  readonly pressAxisAngleDegrees: number;
  readonly pressEngagementRatio: number;
  readonly releaseAxisAngleDegrees: number;
  readonly releaseEngagementRatio: number;
  readonly calibration: {
    readonly pressAxisWindowFraction: number;
    readonly pressEngagementWindowFraction: number;
    readonly releaseAxisWindowFraction: number;
    readonly releaseEngagementWindowFraction: number;
  };
}

export interface HandTriggerGestureSnapshot {
  readonly axisAngleDegrees: number;
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
  readonly pressAxisAngleDegrees: number;
  readonly pressEngagementRatio: number;
  readonly releaseAxisAngleDegrees: number;
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

function readNearestDistance(
  point: HandVector3,
  candidates: readonly HandVector3[]
): number {
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    nearestDistance = Math.min(nearestDistance, readDistance(point, candidate));
  }

  return nearestDistance;
}

function readAxisAngleDegrees(vectorA: HandVector3, vectorB: HandVector3): number {
  const magnitudeA = readVectorMagnitude(vectorA);
  const magnitudeB = readVectorMagnitude(vectorB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 180;
  }

  const normalizedDotProduct =
    (vectorA.x * vectorB.x + vectorA.y * vectorB.y + vectorA.z * vectorB.z) /
    (magnitudeA * magnitudeB);
  const clampedDotProduct = Math.min(1, Math.max(-1, normalizedDotProduct));

  return (Math.acos(clampedDotProduct) * 180) / Math.PI;
}

function readTriggerEngagementRatio(
  pose: HandTrackingPoseSnapshot
): number {
  const indexAxisLength = Math.max(
    readDistance(pose.indexBase, pose.indexTip),
    0.0001
  );
  const thumbChain = [
    pose.thumbBase,
    pose.thumbKnuckle,
    pose.thumbJoint,
    pose.thumbTip
  ];
  const indexChain = [pose.indexBase, pose.indexKnuckle, pose.indexJoint, pose.indexTip];
  const totalNearestDistance = thumbChain.reduce((distanceSum, thumbPoint) => {
    return distanceSum + readNearestDistance(thumbPoint, indexChain);
  }, 0);

  return totalNearestDistance / thumbChain.length / indexAxisLength;
}

function readTriggerAxisAngleDegrees(
  pose: HandTrackingPoseSnapshot
): number {
  return readAxisAngleDegrees(
    subtractPoints(pose.thumbTip, pose.thumbBase),
    subtractPoints(pose.indexTip, pose.indexBase)
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
    pressAxisAngleDegrees,
    pressEngagementRatio,
    releaseAxisAngleDegrees: resolveReleaseThreshold(
      config.releaseAxisAngleDegrees,
      calibration.pressedAxisAngleDegreesMax,
      calibration.readyAxisAngleDegreesMin,
      config.calibration.releaseAxisWindowFraction
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
  const pressSatisfied =
    metrics.engagementRatio <= thresholds.pressEngagementRatio &&
    metrics.axisAngleDegrees <= thresholds.pressAxisAngleDegrees;
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
