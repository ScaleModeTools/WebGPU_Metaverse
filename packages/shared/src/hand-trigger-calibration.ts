export interface HandTriggerMetricSnapshot {
  readonly axisAngleDegrees: number;
  readonly engagementRatio: number;
}

export interface HandTriggerMetricInput {
  readonly axisAngleDegrees: number;
  readonly engagementRatio: number;
}

export interface HandTriggerCalibrationSnapshot {
  readonly sampleCount: number;
  readonly pressedAxisAngleDegreesMax: number;
  readonly pressedEngagementRatioMax: number;
  readonly readyAxisAngleDegreesMin: number;
  readonly readyEngagementRatioMin: number;
}

export interface HandTriggerCalibrationSnapshotInput {
  readonly sampleCount: number;
  readonly pressedAxisAngleDegreesMax: number;
  readonly pressedEngagementRatioMax: number;
  readonly readyAxisAngleDegreesMin: number;
  readonly readyEngagementRatioMin: number;
}

function normalizeFiniteNonNegativeNumber(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue < 0) {
    return 0;
  }

  return rawValue;
}

function normalizeSampleCount(rawValue: number): number {
  return Math.floor(normalizeFiniteNonNegativeNumber(rawValue));
}

export function createHandTriggerMetricSnapshot(
  input: HandTriggerMetricInput
): HandTriggerMetricSnapshot {
  return Object.freeze({
    axisAngleDegrees: normalizeFiniteNonNegativeNumber(input.axisAngleDegrees),
    engagementRatio: normalizeFiniteNonNegativeNumber(input.engagementRatio)
  });
}

export function createHandTriggerCalibrationSnapshot(
  input: HandTriggerCalibrationSnapshotInput
): HandTriggerCalibrationSnapshot {
  const pressedAxisAngleDegreesMax = normalizeFiniteNonNegativeNumber(
    input.pressedAxisAngleDegreesMax
  );
  const pressedEngagementRatioMax = normalizeFiniteNonNegativeNumber(
    input.pressedEngagementRatioMax
  );
  const readyAxisAngleDegreesMin = Math.max(
    pressedAxisAngleDegreesMax,
    normalizeFiniteNonNegativeNumber(input.readyAxisAngleDegreesMin)
  );
  const readyEngagementRatioMin = Math.max(
    pressedEngagementRatioMax,
    normalizeFiniteNonNegativeNumber(input.readyEngagementRatioMin)
  );

  return Object.freeze({
    sampleCount: normalizeSampleCount(input.sampleCount),
    pressedAxisAngleDegreesMax,
    pressedEngagementRatioMax,
    readyAxisAngleDegreesMin,
    readyEngagementRatioMin
  });
}
