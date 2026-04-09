import type {
  AffineAimTransformSnapshot,
  CalibrationAnchorId,
  CalibrationShotSample,
  HandTriggerCalibrationSnapshot,
  NormalizedViewportPoint
} from "@webgpu-metaverse/shared";

import type { HandTriggerGestureConfig } from "./hand-trigger-gesture";

export const trackedHandCalibrationCaptureStates = [
  "waiting-for-hand",
  "ready-to-capture",
  "release-trigger",
  "complete",
  "failed"
] as const;

export type TrackedHandCalibrationCaptureState =
  (typeof trackedHandCalibrationCaptureStates)[number];

export interface TrackedHandCalibrationAnchorDefinition {
  readonly id: CalibrationAnchorId;
  readonly label: string;
  readonly normalizedTarget: NormalizedViewportPoint;
}

export interface TrackedHandCalibrationConfig {
  readonly transformModel: "affine-2d";
  readonly anchors: readonly TrackedHandCalibrationAnchorDefinition[];
  readonly triggerGesture: HandTriggerGestureConfig;
}

export interface TrackedHandCalibrationSnapshot {
  readonly captureState: TrackedHandCalibrationCaptureState;
  readonly currentAnchorId: CalibrationAnchorId | null;
  readonly currentAnchorLabel: string | null;
  readonly capturedSampleCount: number;
  readonly failureReason: string | null;
  readonly totalAnchorCount: number;
}

export interface TrackedHandCalibrationAdvanceResult {
  readonly didChange: boolean;
  readonly capturedSample: CalibrationShotSample | null;
  readonly fittedCalibration: AffineAimTransformSnapshot | null;
  readonly triggerCalibration: HandTriggerCalibrationSnapshot | null;
}
