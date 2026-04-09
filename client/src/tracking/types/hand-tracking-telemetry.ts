import type { HandTrackingPoseState } from "./hand-tracking";

export interface HandTrackingTelemetrySnapshot {
  readonly framesDispatched: number;
  readonly framesProcessed: number;
  readonly inFlightFrameSkips: number;
  readonly latestPoseAgeMs: number | null;
  readonly latestSequenceNumber: number;
  readonly staleSnapshotsIgnored: number;
  readonly trackingState: HandTrackingPoseState;
  readonly workerLatencyMs: number | null;
}
