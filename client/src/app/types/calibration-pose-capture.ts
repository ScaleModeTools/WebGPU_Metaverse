import { duckHuntCalibrationCaptureConfig } from "../../experiences/duck-hunt/config";
import { handAimObservationConfig } from "../../game/config/hand-aim-observation";
import { readObservedAimPoint } from "../../game/types/hand-aim-observation";
import { evaluateHandTriggerGesture } from "../../game/types/hand-trigger-gesture";
import type {
  HandTrackingPoseSnapshot,
  TrackedHandTrackingSnapshot
} from "../../game/types/hand-tracking";

export const calibrationOverlayLandmarkIds = {
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

export const calibrationCaptureOmittedLandmarkIds = [
  "thumbBase"
] as const satisfies readonly (keyof HandTrackingPoseSnapshot)[];

export type CalibrationPoseCaptureLandmarkId =
  (typeof calibrationOverlayLandmarkIds.capture)[number];

type CalibrationPoseCaptureLandmarkMap = {
  readonly [PointId in CalibrationPoseCaptureLandmarkId]: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
};

export interface CalibrationPoseCaptureSnapshot {
  readonly label: string;
  readonly capturedAtIso: string;
  readonly observedAimPoint: {
    readonly x: number;
    readonly y: number;
  };
  readonly pose: CalibrationPoseCaptureLandmarkMap;
  readonly sequenceNumber: number;
  readonly trackingTimestampMs: number;
  readonly triggerGesture: {
    readonly axisAngleDegrees: number;
    readonly engagementRatio: number;
    readonly triggerPressed: boolean;
    readonly triggerReady: boolean;
  };
}

export interface CalibrationPoseCaptureExportSnapshot {
  readonly captureLandmarkIds: readonly CalibrationPoseCaptureLandmarkId[];
  readonly omittedRuntimeLandmarkIds:
    readonly (typeof calibrationCaptureOmittedLandmarkIds)[number][];
  readonly captures: readonly CalibrationPoseCaptureSnapshot[];
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
): CalibrationPoseCaptureLandmarkMap {
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

export function createCalibrationPoseCapture(
  label: string,
  trackingSnapshot: TrackedHandTrackingSnapshot
): CalibrationPoseCaptureSnapshot {
  const observedAimPoint = readObservedAimPoint(
    trackingSnapshot.pose,
    handAimObservationConfig
  );
  const triggerGesture = evaluateHandTriggerGesture(
    trackingSnapshot.pose,
    false,
    duckHuntCalibrationCaptureConfig.triggerGesture
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

export function createCalibrationPoseCaptureExport(
  captures: readonly CalibrationPoseCaptureSnapshot[]
): CalibrationPoseCaptureExportSnapshot {
  return Object.freeze({
    captureLandmarkIds: calibrationOverlayLandmarkIds.capture,
    omittedRuntimeLandmarkIds: calibrationCaptureOmittedLandmarkIds,
    captures: Object.freeze([...captures])
  });
}
