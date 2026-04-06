import type { HandTriggerGestureConfig } from "./hand-trigger-gesture";
import type {
  AffineAimTransformSnapshot,
  CalibrationAnchorId,
  CalibrationShotSample,
  HandTriggerCalibrationSnapshot
} from "@thumbshooter/shared";

export const calibrationCaptureStates = [
  "waiting-for-hand",
  "ready-to-capture",
  "release-trigger",
  "complete",
  "failed"
] as const;

export type CalibrationCaptureState =
  (typeof calibrationCaptureStates)[number];

export interface CalibrationCaptureConfig {
  readonly triggerGesture: HandTriggerGestureConfig;
}

export interface NinePointCalibrationSnapshot {
  readonly captureState: CalibrationCaptureState;
  readonly currentAnchorId: CalibrationAnchorId | null;
  readonly currentAnchorLabel: string | null;
  readonly capturedSampleCount: number;
  readonly failureReason: string | null;
  readonly totalAnchorCount: number;
}

export interface NinePointCalibrationAdvanceResult {
  readonly didChange: boolean;
  readonly capturedSample: CalibrationShotSample | null;
  readonly fittedCalibration: AffineAimTransformSnapshot | null;
  readonly triggerCalibration: HandTriggerCalibrationSnapshot | null;
}
