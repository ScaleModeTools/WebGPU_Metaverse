import type {
  AffineAimTransformSnapshot,
  NormalizedViewportPoint
} from "@webgpu-metaverse/shared";
import { createNormalizedViewportPoint } from "@webgpu-metaverse/shared";

import type { GameplayInputSource } from "../types/gameplay-input-source";
import type { HandTrackingTelemetrySnapshot } from "../types/hand-tracking-telemetry";
import {
  createLatestHandTrackingSnapshot,
  createUnavailableHandTrackingSnapshot,
  type HandTrackingPoseCandidate,
  type HandTrackingRuntimeSnapshot,
  type LatestHandTrackingSnapshot
} from "../types/hand-tracking";

const mouseReferenceLength = 0.015;
const mouseReloadEdgeBandPixels = 8;
const mouseReloadTriggerDistancePixels = 18;
const mouseReloadReleaseDistancePixels = 28;
const mouseReloadRearmDistancePixels = 42;
const mouseForwardProjectionDistance = mouseReferenceLength * 0.75;
const mouseSideProjectionDistance = mouseReferenceLength * 0.18;
const mouseOffscreenTipInset = mouseReferenceLength * 0.45;
const mouseOffscreenMinSideDistance = mouseReferenceLength * -0.7;
const mouseOffscreenMaxSideDistance = mouseReferenceLength * 2.4;

type MouseViewportEdge = "left" | "right" | "top" | "bottom";

interface MousePoseBasis {
  readonly aimAnchorX: number;
  readonly aimAnchorY: number;
  readonly forwardX: number;
  readonly forwardY: number;
  readonly sideX: number;
  readonly sideY: number;
}

interface MouseViewportTarget {
  readonly aimPoint: NormalizedViewportPoint;
  readonly offscreenEdge: MouseViewportEdge | null;
}

interface MouseClientPoint {
  readonly clientX: number;
  readonly clientY: number;
}

interface MouseViewportEdgeDistance {
  readonly distancePx: number;
  readonly edge: MouseViewportEdge;
}

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

function clampRange(rawValue: number, min: number, max: number): number {
  if (!Number.isFinite(rawValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, rawValue));
}

function createMouseLandmarkCandidate(
  basis: MousePoseBasis,
  forwardDistance: number,
  sideDistance: number
): HandTrackingPoseCandidate["thumbBase"] {
  return {
    x:
      basis.aimAnchorX +
      basis.forwardX * forwardDistance +
      basis.sideX * sideDistance,
    y:
      basis.aimAnchorY +
      basis.forwardY * forwardDistance +
      basis.sideY * sideDistance,
    z: 0
  };
}

function readDistanceFromViewportEdge(
  clientX: number,
  clientY: number,
  bounds: DOMRect,
  edge: MouseViewportEdge
): number {
  switch (edge) {
    case "left":
      return clientX - bounds.left;
    case "right":
      return bounds.right - clientX;
    case "top":
      return clientY - bounds.top;
    case "bottom":
      return bounds.bottom - clientY;
  }
}

function resolveNearestViewportEdge(
  clientX: number,
  clientY: number,
  bounds: DOMRect
): MouseViewportEdgeDistance {
  const edgeDistances: readonly MouseViewportEdgeDistance[] = [
    {
      distancePx: readDistanceFromViewportEdge(clientX, clientY, bounds, "left"),
      edge: "left"
    },
    {
      distancePx: readDistanceFromViewportEdge(clientX, clientY, bounds, "right"),
      edge: "right"
    },
    {
      distancePx: readDistanceFromViewportEdge(clientX, clientY, bounds, "top"),
      edge: "top"
    },
    {
      distancePx: readDistanceFromViewportEdge(clientX, clientY, bounds, "bottom"),
      edge: "bottom"
    }
  ];

  return edgeDistances.reduce<MouseViewportEdgeDistance>(
    (nearest, candidate) =>
      candidate.distancePx < nearest.distancePx
        ? candidate
        : nearest,
    {
      distancePx: Number.POSITIVE_INFINITY,
      edge: "right"
    }
  );
}

function resolveMouseOffscreenSideSign(
  edge: MouseViewportEdge,
  aimPoint: NormalizedViewportPoint
): -1 | 1 {
  if (edge === "left" || edge === "right") {
    return aimPoint.y >= 0.5 ? -1 : 1;
  }

  return aimPoint.x >= 0.5 ? -1 : 1;
}

function resolveMousePoseBasis(
  aimPoint: NormalizedViewportPoint,
  offscreenEdge: MouseViewportEdge | null
): MousePoseBasis {
  if (offscreenEdge === null) {
    return {
      aimAnchorX: aimPoint.x - mouseSideProjectionDistance,
      aimAnchorY: aimPoint.y + mouseForwardProjectionDistance,
      forwardX: 0,
      forwardY: -1,
      sideX: 1,
      sideY: 0
    };
  }

  const sideSign = resolveMouseOffscreenSideSign(offscreenEdge, aimPoint);

  if (offscreenEdge === "left" || offscreenEdge === "right") {
    const sideMin =
      sideSign > 0 ? -mouseOffscreenMinSideDistance : mouseOffscreenMaxSideDistance;
    const sideMax =
      sideSign > 0 ? 1 - mouseOffscreenMaxSideDistance : 1 + mouseOffscreenMinSideDistance;

    return {
      aimAnchorX:
        offscreenEdge === "left"
          ? mouseOffscreenTipInset
          : 1 - mouseOffscreenTipInset,
      aimAnchorY: clampRange(
        aimPoint.y - sideSign * mouseSideProjectionDistance,
        sideMin,
        sideMax
      ),
      forwardX: offscreenEdge === "left" ? -1 : 1,
      forwardY: 0,
      sideX: 0,
      sideY: sideSign
    };
  }

  const sideMin =
    sideSign > 0 ? -mouseOffscreenMinSideDistance : mouseOffscreenMaxSideDistance;
  const sideMax =
    sideSign > 0 ? 1 - mouseOffscreenMaxSideDistance : 1 + mouseOffscreenMinSideDistance;

  return {
    aimAnchorX: clampRange(
      aimPoint.x - sideSign * mouseSideProjectionDistance,
      sideMin,
      sideMax
    ),
    aimAnchorY:
      offscreenEdge === "top"
        ? mouseOffscreenTipInset
        : 1 - mouseOffscreenTipInset,
    forwardX: 0,
    forwardY: offscreenEdge === "top" ? -1 : 1,
    sideX: sideSign,
    sideY: 0
  };
}

function createMousePoseCandidate(
  aimPoint: NormalizedViewportPoint,
  pressed: boolean,
  offscreenEdge: MouseViewportEdge | null = null
): HandTrackingPoseCandidate {
  const poseBasis = resolveMousePoseBasis(aimPoint, offscreenEdge);
  const thumbTip = pressed
    ? createMouseLandmarkCandidate(
        poseBasis,
        mouseReferenceLength * -2.2,
        mouseReferenceLength * 0.15
      )
    : createMouseLandmarkCandidate(
        poseBasis,
        mouseReferenceLength * 0.25,
        mouseReferenceLength * 2.4
      );

  return {
    thumbBase: createMouseLandmarkCandidate(
      poseBasis,
      mouseReferenceLength * -0.15,
      mouseReferenceLength * 2.2
    ),
    thumbKnuckle: createMouseLandmarkCandidate(
      poseBasis,
      mouseReferenceLength * -0.15,
      mouseReferenceLength * 1.2
    ),
    thumbJoint: createMouseLandmarkCandidate(
      poseBasis,
      mouseReferenceLength * -0.75,
      mouseReferenceLength * 0.8
    ),
    thumbTip,
    indexBase: createMouseLandmarkCandidate(
      poseBasis,
      mouseReferenceLength * -2.55,
      0
    ),
    indexKnuckle: createMouseLandmarkCandidate(
      poseBasis,
      mouseReferenceLength * -1.55,
      0
    ),
    indexJoint: createMouseLandmarkCandidate(
      poseBasis,
      mouseReferenceLength * -0.55,
      0
    ),
    indexTip: createMouseLandmarkCandidate(
      poseBasis,
      mouseReferenceLength * 0.45,
      0
    ),
    middlePip: createMouseLandmarkCandidate(
      poseBasis,
      mouseReferenceLength * -1.85,
      mouseReferenceLength * -0.7
    )
  };
}

function createTrackedPoseSnapshot(input: {
  readonly aimPoint: NormalizedViewportPoint;
  readonly offscreenEdge: MouseViewportEdge | null;
  readonly pressed: boolean;
  readonly sequenceNumber: number;
  readonly timestampMs: number;
}): LatestHandTrackingSnapshot {
  return createLatestHandTrackingSnapshot({
    sequenceNumber: input.sequenceNumber,
    timestampMs: input.timestampMs,
    pose: createMousePoseCandidate(
      input.aimPoint,
      input.pressed,
      input.offscreenEdge
    )
  });
}

export class MouseGameplayInput implements GameplayInputSource {
  readonly #readNowMs: () => number;
  readonly #windowObject: Window | null;

  #cleanupViewportListeners: (() => void) | null = null;
  #framesDispatched = 0;
  #framesProcessed = 0;
  #reloadGestureAnchor: MouseClientPoint | null = null;
  #reloadOffscreenEdge: MouseViewportEdge | null = null;
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
      const viewportTarget = this.#readViewportPoint(clientX, clientY);

      if (viewportTarget === null) {
        this.#setNoHandSnapshot();
        return;
      }

      this.#sequenceNumber += 1;
      this.#framesDispatched += 1;
      this.#framesProcessed += 1;
      this.#runtimeSnapshot = freezeRuntimeSnapshot(
        this.#runtimeSnapshot.lifecycle === "idle" ? "ready" : this.#runtimeSnapshot.lifecycle,
        createTrackedPoseSnapshot({
          aimPoint: viewportTarget.aimPoint,
          offscreenEdge: viewportTarget.offscreenEdge,
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
    this.#reloadGestureAnchor = null;
    this.#reloadOffscreenEdge = null;
    this.#sequenceNumber = 0;
    this.#runtimeSnapshot = freezeRuntimeSnapshot(
      "idle",
      createUnavailableHandTrackingSnapshot()
    );
  }

  #readViewportPoint(
    clientX: number,
    clientY: number
  ): MouseViewportTarget | null {
    if (this.#viewportElement === null) {
      return null;
    }

    const bounds = this.#viewportElement.getBoundingClientRect();

    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    const normalizedX = (clientX - bounds.left) / bounds.width;
    const normalizedY = (clientY - bounds.top) / bounds.height;
    const inBounds =
      Number.isFinite(normalizedX) &&
      Number.isFinite(normalizedY) &&
      normalizedX >= 0 &&
      normalizedX <= 1 &&
      normalizedY >= 0 &&
      normalizedY <= 1;

    const aimPoint = createNormalizedViewportPoint({
      x: clampUnit(normalizedX),
      y: clampUnit(normalizedY)
    });
    const nearestEdge = resolveNearestViewportEdge(clientX, clientY, bounds);

    if (
      this.#reloadOffscreenEdge !== null &&
      inBounds &&
      readDistanceFromViewportEdge(
        clientX,
        clientY,
        bounds,
        this.#reloadOffscreenEdge
      ) >= mouseReloadReleaseDistancePixels
    ) {
      this.#reloadOffscreenEdge = null;
    }

    if (inBounds && nearestEdge.distancePx >= mouseReloadRearmDistancePixels) {
      this.#reloadGestureAnchor = Object.freeze({
        clientX,
        clientY
      });
    }

    const shouldTriggerReload =
      this.#reloadOffscreenEdge === null &&
      (nearestEdge.distancePx < 0 ||
        (nearestEdge.distancePx <= mouseReloadEdgeBandPixels &&
          this.#reloadGestureAnchor !== null &&
          readDistanceFromViewportEdge(
            this.#reloadGestureAnchor.clientX,
            this.#reloadGestureAnchor.clientY,
            bounds,
            nearestEdge.edge
          ) -
            nearestEdge.distancePx >=
            mouseReloadTriggerDistancePixels));

    if (shouldTriggerReload) {
      this.#reloadOffscreenEdge = nearestEdge.edge;
    }

    if (!inBounds && this.#reloadOffscreenEdge === null) {
      return null;
    }

    return Object.freeze({
      aimPoint,
      offscreenEdge: this.#reloadOffscreenEdge
    });
  }

  #setNoHandSnapshot(): void {
    if (this.#runtimeSnapshot.lifecycle === "idle") {
      return;
    }

    this.#reloadGestureAnchor = null;
    this.#reloadOffscreenEdge = null;
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
