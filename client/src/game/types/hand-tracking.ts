import {
  createNormalizedViewportPoint,
  type NormalizedViewportPoint
} from "@thumbshooter/shared";

export const handTrackingLifecycleStates = [
  "idle",
  "booting",
  "ready",
  "failed"
] as const;
export const handTrackingPoseStates = [
  "unavailable",
  "no-hand",
  "tracked"
] as const;

export type HandTrackingLifecycleState =
  (typeof handTrackingLifecycleStates)[number];
export type HandTrackingPoseState = (typeof handTrackingPoseStates)[number];

export interface HandTrackingLandmarkCandidate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface HandTrackingLandmarkPoint {
  readonly x: NormalizedViewportPoint["x"];
  readonly y: NormalizedViewportPoint["y"];
  readonly z: number;
}

export interface HandTrackingPoseCandidate {
  readonly thumbBase: HandTrackingLandmarkCandidate;
  readonly thumbKnuckle: HandTrackingLandmarkCandidate;
  readonly thumbJoint: HandTrackingLandmarkCandidate;
  readonly thumbTip: HandTrackingLandmarkCandidate;
  readonly indexBase: HandTrackingLandmarkCandidate;
  readonly indexKnuckle: HandTrackingLandmarkCandidate;
  readonly indexJoint: HandTrackingLandmarkCandidate;
  readonly indexTip: HandTrackingLandmarkCandidate;
}

export interface HandTrackingPoseSnapshot {
  readonly thumbBase: HandTrackingLandmarkPoint;
  readonly thumbKnuckle: HandTrackingLandmarkPoint;
  readonly thumbJoint: HandTrackingLandmarkPoint;
  readonly thumbTip: HandTrackingLandmarkPoint;
  readonly indexBase: HandTrackingLandmarkPoint;
  readonly indexKnuckle: HandTrackingLandmarkPoint;
  readonly indexJoint: HandTrackingLandmarkPoint;
  readonly indexTip: HandTrackingLandmarkPoint;
}

export interface UnavailableHandTrackingSnapshot {
  readonly trackingState: "unavailable";
  readonly sequenceNumber: 0;
  readonly timestampMs: null;
  readonly pose: null;
}

export interface NoHandTrackingSnapshot {
  readonly trackingState: "no-hand";
  readonly sequenceNumber: number;
  readonly timestampMs: number;
  readonly pose: null;
}

export interface TrackedHandTrackingSnapshot {
  readonly trackingState: "tracked";
  readonly sequenceNumber: number;
  readonly timestampMs: number;
  readonly pose: HandTrackingPoseSnapshot;
}

export type LatestHandTrackingSnapshot =
  | UnavailableHandTrackingSnapshot
  | NoHandTrackingSnapshot
  | TrackedHandTrackingSnapshot;

export interface HandTrackingRuntimeSnapshot {
  readonly lifecycle: HandTrackingLifecycleState;
  readonly failureReason: string | null;
  readonly latestPose: LatestHandTrackingSnapshot;
}

export interface HandTrackingRuntimeConfig {
  readonly landmarker: {
    readonly wasmRoot: string;
    readonly modelAssetPath: string;
    readonly numHands: 1;
    readonly runningMode: "video";
  };
  readonly landmarks: {
    readonly thumbBaseIndex: 1;
    readonly thumbKnuckleIndex: 2;
    readonly thumbJointIndex: 3;
    readonly thumbTipIndex: 4;
    readonly indexBaseIndex: 5;
    readonly indexKnuckleIndex: 6;
    readonly indexJointIndex: 7;
    readonly indexTipIndex: 8;
  };
  readonly framePump: {
    readonly targetFps: number;
  };
}

export interface HandTrackingWorkerBootMessage {
  readonly kind: "boot";
  readonly wasmRoot: string;
  readonly modelAssetPath: string;
  readonly numHands: 1;
  readonly runningMode: "video";
  readonly landmarks: {
    readonly thumbBaseIndex: 1;
    readonly thumbKnuckleIndex: 2;
    readonly thumbJointIndex: 3;
    readonly thumbTipIndex: 4;
    readonly indexBaseIndex: 5;
    readonly indexKnuckleIndex: 6;
    readonly indexJointIndex: 7;
    readonly indexTipIndex: 8;
  };
}

function normalizeLandmarkDepth(rawValue: number | undefined): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return rawValue ?? 0;
}

function createHandTrackingLandmarkPoint(input: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}): HandTrackingLandmarkPoint {
  const normalizedPoint = createNormalizedViewportPoint(input);

  return Object.freeze({
    x: normalizedPoint.x,
    y: normalizedPoint.y,
    z: normalizeLandmarkDepth(input.z)
  });
}

export interface HandTrackingWorkerProcessFrameMessage {
  readonly kind: "process-frame";
  readonly frame: ImageBitmap | VideoFrame;
  readonly sequenceNumber: number;
  readonly timestampMs: number;
}

export interface HandTrackingWorkerShutdownMessage {
  readonly kind: "shutdown";
}

export type HandTrackingWorkerMessage =
  | HandTrackingWorkerBootMessage
  | HandTrackingWorkerProcessFrameMessage
  | HandTrackingWorkerShutdownMessage;

export interface HandTrackingWorkerReadyEvent {
  readonly kind: "ready";
}

export interface HandTrackingWorkerSnapshotEvent {
  readonly kind: "snapshot";
  readonly sequenceNumber: number;
  readonly timestampMs: number;
  readonly pose: HandTrackingPoseCandidate | null;
}

export interface HandTrackingWorkerErrorEvent {
  readonly kind: "error";
  readonly reason: string;
}

export type HandTrackingWorkerEvent =
  | HandTrackingWorkerReadyEvent
  | HandTrackingWorkerSnapshotEvent
  | HandTrackingWorkerErrorEvent;

function normalizeSequenceNumber(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue < 0) {
    return 0;
  }

  return Math.floor(rawValue);
}

function normalizeTimestamp(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue < 0) {
    return 0;
  }

  return rawValue;
}

export function createUnavailableHandTrackingSnapshot(): UnavailableHandTrackingSnapshot {
  return Object.freeze({
    trackingState: "unavailable",
    sequenceNumber: 0,
    timestampMs: null,
    pose: null
  });
}

export function createLatestHandTrackingSnapshot(input: {
  readonly sequenceNumber: number;
  readonly timestampMs: number;
  readonly pose: HandTrackingPoseCandidate | null;
}): LatestHandTrackingSnapshot {
  const sequenceNumber = normalizeSequenceNumber(input.sequenceNumber);
  const timestampMs = normalizeTimestamp(input.timestampMs);

  if (input.pose === null) {
    return Object.freeze({
      trackingState: "no-hand",
      sequenceNumber,
      timestampMs,
      pose: null
    });
  }

  return Object.freeze({
    trackingState: "tracked",
    sequenceNumber,
    timestampMs,
    pose: Object.freeze({
      thumbBase: createHandTrackingLandmarkPoint(input.pose.thumbBase),
      thumbKnuckle: createHandTrackingLandmarkPoint(input.pose.thumbKnuckle),
      thumbJoint: createHandTrackingLandmarkPoint(input.pose.thumbJoint),
      thumbTip: createHandTrackingLandmarkPoint(input.pose.thumbTip),
      indexBase: createHandTrackingLandmarkPoint(input.pose.indexBase),
      indexKnuckle: createHandTrackingLandmarkPoint(input.pose.indexKnuckle),
      indexJoint: createHandTrackingLandmarkPoint(input.pose.indexJoint),
      indexTip: createHandTrackingLandmarkPoint(input.pose.indexTip)
    })
  });
}

export function isTrackedHandTrackingSnapshot(
  snapshot: LatestHandTrackingSnapshot
): snapshot is TrackedHandTrackingSnapshot {
  return snapshot.trackingState === "tracked";
}
