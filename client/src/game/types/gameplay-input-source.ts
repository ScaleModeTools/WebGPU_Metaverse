import type { HandTrackingTelemetrySnapshot } from "./gameplay-presentation";
import type {
  HandTrackingRuntimeSnapshot,
  LatestHandTrackingSnapshot
} from "./hand-tracking";

export interface GameplayInputSource {
  readonly latestPose: LatestHandTrackingSnapshot;
  readonly snapshot: HandTrackingRuntimeSnapshot;
  readonly telemetrySnapshot: HandTrackingTelemetrySnapshot;
  ensureStarted(): Promise<HandTrackingRuntimeSnapshot>;
  dispose(): void;
  attachViewport?: (element: HTMLElement) => (() => void) | void;
}
