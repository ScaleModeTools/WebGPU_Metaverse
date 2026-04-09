import { trackedHandCalibrationConfig } from "../config/tracked-hand-calibration";
import { handAimObservationConfig } from "../config/hand-aim-observation";
import { readObservedAimPoint } from "./hand-aim-observation";
import { evaluateHandTriggerGesture } from "./hand-trigger-gesture";
import type {
  HandTrackingPoseSnapshot,
  TrackedHandTrackingSnapshot
} from "./hand-tracking";

export const trackedHandCalibrationOverlayLandmarkIds = {
  thumb: ["thumbKnuckle", "thumbJoint", "thumbTip"],
  index: ["indexBase", "indexKnuckle", "indexJoint", "indexTip"],
  capture: [
    "thumbKnuckle",
    "thumbJoint",
    "thumbTip",
    "indexBase",
    "indexKnuckle",
    "indexJoint",
    "indexTip",
    "middlePip"
  ]
} as const satisfies {
  readonly thumb: readonly (keyof HandTrackingPoseSnapshot)[];
  readonly index: readonly (keyof HandTrackingPoseSnapshot)[];
  readonly capture: readonly (keyof HandTrackingPoseSnapshot)[];
};

export const trackedHandCalibrationCaptureOmittedLandmarkIds = [
  "thumbBase"
] as const satisfies readonly (keyof HandTrackingPoseSnapshot)[];

export type TrackedHandCalibrationPoseCaptureLandmarkId =
  (typeof trackedHandCalibrationOverlayLandmarkIds.capture)[number];

type TrackedHandCalibrationPoseCaptureLandmarkMap = {
  readonly [PointId in TrackedHandCalibrationPoseCaptureLandmarkId]: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
};

export interface TrackedHandCalibrationPoseCaptureSnapshot {
  readonly label: string;
  readonly capturedAtIso: string;
  readonly observedAimPoint: {
    readonly x: number;
    readonly y: number;
  };
  readonly pose: TrackedHandCalibrationPoseCaptureLandmarkMap;
  readonly sequenceNumber: number;
  readonly trackingTimestampMs: number;
  readonly triggerGesture: {
    readonly axisAngleDegrees: number;
    readonly engagementRatio: number;
    readonly triggerPressed: boolean;
    readonly triggerReady: boolean;
  };
}

export interface TrackedHandCalibrationPoseCaptureExportSnapshot {
  readonly captureLandmarkIds:
    readonly TrackedHandCalibrationPoseCaptureLandmarkId[];
  readonly omittedRuntimeLandmarkIds:
    readonly (typeof trackedHandCalibrationCaptureOmittedLandmarkIds)[number][];
  readonly captures: readonly TrackedHandCalibrationPoseCaptureSnapshot[];
}

function cloneLandmarkPoint(
  point: HandTrackingPoseSnapshot[keyof HandTrackingPoseSnapshot]
): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  return Object.freeze({
    x: point.x,
    y: point.y,
    z: point.z
  });
}

function createPoseCaptureLandmarkMap(
  pose: HandTrackingPoseSnapshot
): TrackedHandCalibrationPoseCaptureLandmarkMap {
  return Object.freeze({
    thumbKnuckle: cloneLandmarkPoint(pose.thumbKnuckle),
    thumbJoint: cloneLandmarkPoint(pose.thumbJoint),
    thumbTip: cloneLandmarkPoint(pose.thumbTip),
    indexBase: cloneLandmarkPoint(pose.indexBase),
    indexKnuckle: cloneLandmarkPoint(pose.indexKnuckle),
    indexJoint: cloneLandmarkPoint(pose.indexJoint),
    indexTip: cloneLandmarkPoint(pose.indexTip),
    middlePip: cloneLandmarkPoint(pose.middlePip)
  });
}

function normalizeCaptureLabel(label: string): string {
  const trimmedLabel = label.trim();

  return trimmedLabel.length > 0 ? trimmedLabel : "sample";
}

export function createTrackedHandCalibrationPoseCapture(
  label: string,
  trackingSnapshot: TrackedHandTrackingSnapshot
): TrackedHandCalibrationPoseCaptureSnapshot {
  const observedAimPoint = readObservedAimPoint(
    trackingSnapshot.pose,
    handAimObservationConfig
  );
  const triggerGesture = evaluateHandTriggerGesture(
    trackingSnapshot.pose,
    false,
    trackedHandCalibrationConfig.triggerGesture
  );

  return Object.freeze({
    label: normalizeCaptureLabel(label),
    capturedAtIso: new Date().toISOString(),
    observedAimPoint: Object.freeze({
      x: observedAimPoint.x,
      y: observedAimPoint.y
    }),
    pose: createPoseCaptureLandmarkMap(trackingSnapshot.pose),
    sequenceNumber: trackingSnapshot.sequenceNumber,
    trackingTimestampMs: trackingSnapshot.timestampMs,
    triggerGesture: Object.freeze({
      axisAngleDegrees: triggerGesture.axisAngleDegrees,
      engagementRatio: triggerGesture.engagementRatio,
      triggerPressed: triggerGesture.triggerPressed,
      triggerReady: triggerGesture.triggerReady
    })
  });
}

export function createTrackedHandCalibrationPoseCaptureExport(
  captures: readonly TrackedHandCalibrationPoseCaptureSnapshot[]
): TrackedHandCalibrationPoseCaptureExportSnapshot {
  return Object.freeze({
    captureLandmarkIds: trackedHandCalibrationOverlayLandmarkIds.capture,
    omittedRuntimeLandmarkIds: trackedHandCalibrationCaptureOmittedLandmarkIds,
    captures: Object.freeze([...captures])
  });
}
