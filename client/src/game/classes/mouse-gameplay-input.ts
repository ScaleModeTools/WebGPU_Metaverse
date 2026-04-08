import type {
  AffineAimTransformSnapshot,
  NormalizedViewportPoint
} from "@thumbshooter/shared";
import { createNormalizedViewportPoint } from "@thumbshooter/shared";

import type { GameplayInputSource } from "../types/gameplay-input-source";
import type { HandTrackingTelemetrySnapshot } from "../types/gameplay-presentation";
import {
  createLatestHandTrackingSnapshot,
  createUnavailableHandTrackingSnapshot,
  type HandTrackingPoseCandidate,
  type HandTrackingRuntimeSnapshot,
  type LatestHandTrackingSnapshot
} from "../types/hand-tracking";

const mouseReferenceLength = 0.015;

export const mouseGameplayAimCalibrationSnapshot = Object.freeze({
  xCoefficients: [1, 0, 0] as const,
  yCoefficients: [0, 1, 0] as const
}) satisfies AffineAimTransformSnapshot;

interface MouseGameplayInputDependencies {
  readonly readNowMs?: () => number;
  readonly windowObject?: Window | null;
}

function readNowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function freezeRuntimeSnapshot(
  lifecycle: HandTrackingRuntimeSnapshot["lifecycle"],
  latestPose: LatestHandTrackingSnapshot
): HandTrackingRuntimeSnapshot {
  return Object.freeze({
    lifecycle,
    failureReason: null,
    latestPose
  });
}

function freezeTelemetrySnapshot(
  snapshot: HandTrackingTelemetrySnapshot
): HandTrackingTelemetrySnapshot {
  return Object.freeze({
    framesDispatched: snapshot.framesDispatched,
    framesProcessed: snapshot.framesProcessed,
    inFlightFrameSkips: snapshot.inFlightFrameSkips,
    latestPoseAgeMs: snapshot.latestPoseAgeMs,
    latestSequenceNumber: snapshot.latestSequenceNumber,
    staleSnapshotsIgnored: snapshot.staleSnapshotsIgnored,
    trackingState: snapshot.trackingState,
    workerLatencyMs: snapshot.workerLatencyMs
  });
}

function clampUnit(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.min(1, Math.max(0, rawValue));
}

function createMousePoseCandidate(
  aimPoint: NormalizedViewportPoint,
  pressed: boolean
): HandTrackingPoseCandidate {
  const aimAnchorX = aimPoint.x - mouseReferenceLength * 0.18;
  const aimAnchorY = aimPoint.y + mouseReferenceLength * 0.75;
  const thumbTip = pressed
    ? {
        x: aimAnchorX + mouseReferenceLength * 0.15,
        y: aimAnchorY + mouseReferenceLength * 2.2,
        z: 0
      }
    : {
        x: aimAnchorX + mouseReferenceLength * 2.4,
        y: aimAnchorY - mouseReferenceLength * 0.25,
        z: 0
      };

  return {
    thumbBase: {
      x: aimAnchorX + mouseReferenceLength * 2.2,
      y: aimAnchorY + mouseReferenceLength * 0.15,
      z: 0
    },
    thumbKnuckle: {
      x: aimAnchorX + mouseReferenceLength * 1.2,
      y: aimAnchorY + mouseReferenceLength * 0.15,
      z: 0
    },
    thumbJoint: {
      x: aimAnchorX + mouseReferenceLength * 0.8,
      y: aimAnchorY + mouseReferenceLength * 0.75,
      z: 0
    },
    thumbTip,
    indexBase: {
      x: aimAnchorX,
      y: aimAnchorY + mouseReferenceLength * 2.55,
      z: 0
    },
    indexKnuckle: {
      x: aimAnchorX,
      y: aimAnchorY + mouseReferenceLength * 1.55,
      z: 0
    },
    indexJoint: {
      x: aimAnchorX,
      y: aimAnchorY + mouseReferenceLength * 0.55,
      z: 0
    },
    indexTip: {
      x: aimAnchorX,
      y: aimAnchorY - mouseReferenceLength * 0.45,
      z: 0
    },
    middlePip: {
      x: aimAnchorX - mouseReferenceLength * 0.7,
      y: aimAnchorY + mouseReferenceLength * 1.85,
      z: 0
    }
  };
}

function createTrackedPoseSnapshot(input: {
  readonly aimPoint: NormalizedViewportPoint;
  readonly pressed: boolean;
  readonly sequenceNumber: number;
  readonly timestampMs: number;
}): LatestHandTrackingSnapshot {
  return createLatestHandTrackingSnapshot({
    sequenceNumber: input.sequenceNumber,
    timestampMs: input.timestampMs,
    pose: createMousePoseCandidate(input.aimPoint, input.pressed)
  });
}

export class MouseGameplayInput implements GameplayInputSource {
  readonly #readNowMs: () => number;
  readonly #windowObject: Window | null;

  #cleanupViewportListeners: (() => void) | null = null;
  #framesDispatched = 0;
  #framesProcessed = 0;
  #runtimeSnapshot = freezeRuntimeSnapshot(
    "idle",
    createUnavailableHandTrackingSnapshot()
  );
  #sequenceNumber = 0;
  #viewportElement: HTMLElement | null = null;

  constructor(dependencies: MouseGameplayInputDependencies = {}) {
    this.#readNowMs = dependencies.readNowMs ?? readNowMs;
    this.#windowObject = dependencies.windowObject ?? globalThis.window ?? null;
  }

  get latestPose(): LatestHandTrackingSnapshot {
    return this.#runtimeSnapshot.latestPose;
  }

  get snapshot(): HandTrackingRuntimeSnapshot {
    return this.#runtimeSnapshot;
  }

  get telemetrySnapshot(): HandTrackingTelemetrySnapshot {
    const latestPoseAgeMs =
      this.#runtimeSnapshot.latestPose.timestampMs === null
        ? null
        : Math.max(
            0,
            this.#readNowMs() - this.#runtimeSnapshot.latestPose.timestampMs
          );

    return freezeTelemetrySnapshot({
      framesDispatched: this.#framesDispatched,
      framesProcessed: this.#framesProcessed,
      inFlightFrameSkips: 0,
      latestPoseAgeMs,
      latestSequenceNumber: this.#runtimeSnapshot.latestPose.sequenceNumber,
      staleSnapshotsIgnored: 0,
      trackingState: this.#runtimeSnapshot.latestPose.trackingState,
      workerLatencyMs: null
    });
  }

  async ensureStarted(): Promise<HandTrackingRuntimeSnapshot> {
    if (this.#runtimeSnapshot.lifecycle === "ready") {
      return this.#runtimeSnapshot;
    }

    this.#runtimeSnapshot = freezeRuntimeSnapshot(
      "ready",
      createUnavailableHandTrackingSnapshot()
    );

    return this.#runtimeSnapshot;
  }

  attachViewport(element: HTMLElement): () => void {
    this.#cleanupViewportListeners?.();
    this.#viewportElement = element;

    const windowObject = this.#windowObject;

    if (windowObject === null) {
      return () => {
        this.#viewportElement = null;
      };
    }

    const updateTrackedPose = (
      clientX: number,
      clientY: number,
      pressed: boolean
    ) => {
      const aimPoint = this.#readViewportPoint(clientX, clientY);

      if (aimPoint === null) {
        this.#setNoHandSnapshot();
        return;
      }

      this.#sequenceNumber += 1;
      this.#framesDispatched += 1;
      this.#framesProcessed += 1;
      this.#runtimeSnapshot = freezeRuntimeSnapshot(
        this.#runtimeSnapshot.lifecycle === "idle" ? "ready" : this.#runtimeSnapshot.lifecycle,
        createTrackedPoseSnapshot({
          aimPoint,
          pressed,
          sequenceNumber: this.#sequenceNumber,
          timestampMs: this.#readNowMs()
        })
      );
    };

    const handleMouseMove = (event: MouseEvent) => {
      updateTrackedPose(event.clientX, event.clientY, (event.buttons & 1) === 1);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      updateTrackedPose(event.clientX, event.clientY, true);
    };

    const handleMouseUp = (event: MouseEvent) => {
      updateTrackedPose(event.clientX, event.clientY, false);
    };

    const handleBlur = () => {
      this.#setNoHandSnapshot();
    };

    windowObject.addEventListener("mousemove", handleMouseMove);
    windowObject.addEventListener("mousedown", handleMouseDown);
    windowObject.addEventListener("mouseup", handleMouseUp);
    windowObject.addEventListener("blur", handleBlur);

    const cleanup = () => {
      windowObject.removeEventListener("mousemove", handleMouseMove);
      windowObject.removeEventListener("mousedown", handleMouseDown);
      windowObject.removeEventListener("mouseup", handleMouseUp);
      windowObject.removeEventListener("blur", handleBlur);

      if (this.#cleanupViewportListeners === cleanup) {
        this.#cleanupViewportListeners = null;
      }

      this.#viewportElement = null;
      this.#setNoHandSnapshot();
    };

    this.#cleanupViewportListeners = cleanup;

    return cleanup;
  }

  dispose(): void {
    this.#cleanupViewportListeners?.();
    this.#cleanupViewportListeners = null;
    this.#viewportElement = null;
    this.#framesDispatched = 0;
    this.#framesProcessed = 0;
    this.#sequenceNumber = 0;
    this.#runtimeSnapshot = freezeRuntimeSnapshot(
      "idle",
      createUnavailableHandTrackingSnapshot()
    );
  }

  #readViewportPoint(
    clientX: number,
    clientY: number
  ): NormalizedViewportPoint | null {
    if (this.#viewportElement === null) {
      return null;
    }

    const bounds = this.#viewportElement.getBoundingClientRect();

    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    const normalizedX = (clientX - bounds.left) / bounds.width;
    const normalizedY = (clientY - bounds.top) / bounds.height;

    if (
      !Number.isFinite(normalizedX) ||
      !Number.isFinite(normalizedY) ||
      normalizedX < 0 ||
      normalizedX > 1 ||
      normalizedY < 0 ||
      normalizedY > 1
    ) {
      return null;
    }

    return createNormalizedViewportPoint({
      x: clampUnit(normalizedX),
      y: clampUnit(normalizedY)
    });
  }

  #setNoHandSnapshot(): void {
    if (this.#runtimeSnapshot.lifecycle === "idle") {
      return;
    }

    this.#sequenceNumber += 1;
    this.#framesDispatched += 1;
    this.#framesProcessed += 1;
    this.#runtimeSnapshot = freezeRuntimeSnapshot(
      this.#runtimeSnapshot.lifecycle,
      createLatestHandTrackingSnapshot({
        sequenceNumber: this.#sequenceNumber,
        timestampMs: this.#readNowMs(),
        pose: null
      })
    );
  }
}
