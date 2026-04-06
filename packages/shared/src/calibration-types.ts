import type {
  HandTriggerMetricInput,
  HandTriggerMetricSnapshot
} from "./hand-trigger-calibration.js";
import { createHandTriggerMetricSnapshot } from "./hand-trigger-calibration.js";
import type { TypeBrand } from "./type-branding.js";

export const calibrationAnchorIds = [
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "top-center",
  "mid-right",
  "mid-left",
  "bottom-center"
] as const;

export type CalibrationAnchorId = (typeof calibrationAnchorIds)[number];

export type NormalizedViewportScalar = TypeBrand<
  number,
  "NormalizedViewportScalar"
>;

export interface NormalizedViewportPoint {
  readonly x: NormalizedViewportScalar;
  readonly y: NormalizedViewportScalar;
}

export interface NormalizedViewportPointInput {
  readonly x: number;
  readonly y: number;
}

export interface HandTriggerPoseSample {
  readonly thumbTip: NormalizedViewportPoint;
  readonly indexTip: NormalizedViewportPoint;
  readonly aimPoint: NormalizedViewportPoint;
}

export interface HandTriggerPoseSampleInput {
  readonly thumbTip: NormalizedViewportPointInput;
  readonly indexTip: NormalizedViewportPointInput;
  readonly aimPoint?: NormalizedViewportPointInput;
}

export interface CalibrationShotSample {
  readonly anchorId: CalibrationAnchorId;
  readonly intendedTarget: NormalizedViewportPoint;
  readonly observedPose: HandTriggerPoseSample;
  readonly pressedTriggerMetrics: HandTriggerMetricSnapshot | null;
  readonly readyTriggerMetrics: HandTriggerMetricSnapshot | null;
}

export interface CalibrationShotSampleInput {
  readonly anchorId: CalibrationAnchorId;
  readonly intendedTarget: NormalizedViewportPointInput;
  readonly observedPose: HandTriggerPoseSampleInput;
  readonly pressedTriggerMetrics?: HandTriggerMetricInput | null;
  readonly readyTriggerMetrics?: HandTriggerMetricInput | null;
}

function clampNormalizedViewportScalar(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.min(1, Math.max(0, rawValue));
}

export function createNormalizedViewportScalar(
  rawValue: number
): NormalizedViewportScalar {
  return clampNormalizedViewportScalar(rawValue) as NormalizedViewportScalar;
}

export function createNormalizedViewportPoint(
  point: NormalizedViewportPointInput
): NormalizedViewportPoint {
  return Object.freeze({
    x: createNormalizedViewportScalar(point.x),
    y: createNormalizedViewportScalar(point.y)
  });
}

export function createHandTriggerPoseSample(
  input: HandTriggerPoseSampleInput
): HandTriggerPoseSample {
  return Object.freeze({
    thumbTip: createNormalizedViewportPoint(input.thumbTip),
    indexTip: createNormalizedViewportPoint(input.indexTip),
    aimPoint: createNormalizedViewportPoint(input.aimPoint ?? input.indexTip)
  });
}

export function createCalibrationShotSample(
  input: CalibrationShotSampleInput
): CalibrationShotSample {
  return Object.freeze({
    anchorId: input.anchorId,
    intendedTarget: createNormalizedViewportPoint(input.intendedTarget),
    observedPose: createHandTriggerPoseSample(input.observedPose),
    pressedTriggerMetrics:
      input.pressedTriggerMetrics == null
        ? null
        : createHandTriggerMetricSnapshot(input.pressedTriggerMetrics),
    readyTriggerMetrics:
      input.readyTriggerMetrics == null
        ? null
        : createHandTriggerMetricSnapshot(input.readyTriggerMetrics)
  });
}
