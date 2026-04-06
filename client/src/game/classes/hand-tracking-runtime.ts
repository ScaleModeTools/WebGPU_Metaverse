import { handTrackingRuntimeConfig } from "../config/hand-tracking-runtime";
import type { HandTrackingTelemetrySnapshot } from "../types/gameplay-presentation";
import {
  createLatestHandTrackingSnapshot,
  createUnavailableHandTrackingSnapshot,
  type HandTrackingRuntimeConfig,
  type HandTrackingRuntimeSnapshot,
  type HandTrackingWorkerEvent,
  type HandTrackingWorkerMessage,
  type LatestHandTrackingSnapshot
} from "../types/hand-tracking";

interface HandTrackingWorkerHost {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<HandTrackingWorkerEvent>) => void
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<HandTrackingWorkerEvent>) => void
  ): void;
  postMessage(message: HandTrackingWorkerMessage, transfer?: Transferable[]): void;
  terminate(): void;
}

interface TrackingVideoElement {
  autoplay: boolean;
  muted: boolean;
  playsInline: boolean;
  readyState: number;
  srcObject: HTMLVideoElement["srcObject"];
  videoHeight: number;
  videoWidth: number;
  play(): Promise<void>;
  pause(): void;
}

interface HandTrackingRuntimeDependencies {
  readonly cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame;
  readonly createImageBitmap?: typeof globalThis.createImageBitmap;
  readonly createVideoElement?: () => TrackingVideoElement;
  readonly createWorker?: () => HandTrackingWorkerHost;
  readonly mediaDevices?: MediaDevices | null;
  readonly requestAnimationFrame?: typeof globalThis.requestAnimationFrame;
}

function createDefaultWorker(): HandTrackingWorkerHost {
  return new Worker(new URL("../workers/hand-tracking-worker.ts", import.meta.url), {
    type: "module"
  });
}

function createDefaultVideoElement(): TrackingVideoElement {
  const videoElement = document.createElement("video");

  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.playsInline = true;

  return videoElement;
}

function freezeRuntimeSnapshot(
  lifecycle: HandTrackingRuntimeSnapshot["lifecycle"],
  latestPose: LatestHandTrackingSnapshot,
  failureReason: string | null
): HandTrackingRuntimeSnapshot {
  return Object.freeze({
    lifecycle,
    failureReason,
    latestPose
  });
}

function readFrameTimestampMs(): number {
  return globalThis.performance?.now() ?? Date.now();
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

export class HandTrackingRuntime {
  readonly #cancelAnimationFrame: typeof globalThis.cancelAnimationFrame;
  readonly #config: HandTrackingRuntimeConfig;
  readonly #createImageBitmap: typeof globalThis.createImageBitmap;
  readonly #createVideoElement: () => TrackingVideoElement;
  readonly #createWorker: () => HandTrackingWorkerHost;
  readonly #mediaDevices: MediaDevices | null;
  readonly #requestAnimationFrame: typeof globalThis.requestAnimationFrame;

  #bootPromise: Promise<HandTrackingRuntimeSnapshot> | null = null;
  #framesDispatched = 0;
  #framesProcessed = 0;
  #frameHandle = 0;
  #frameInFlight = false;
  #inFlightFrameSkips = 0;
  #lastDispatchedFrameAt = 0;
  #lastWorkerLatencyMs: number | null = null;
  #latestSequenceNumber = 0;
  #pendingBootReject:
    | ((reason?: unknown) => void)
    | null = null;
  #pendingBootResolve:
    | ((snapshot: HandTrackingRuntimeSnapshot) => void)
    | null = null;
  #runtimeSnapshot = freezeRuntimeSnapshot(
    "idle",
    createUnavailableHandTrackingSnapshot(),
    null
  );
  #stream: MediaStream | null = null;
  #staleSnapshotsIgnored = 0;
  #videoElement: TrackingVideoElement | null = null;
  #worker: HandTrackingWorkerHost | null = null;

  readonly #handleWorkerMessage = (
    event: MessageEvent<HandTrackingWorkerEvent>
  ) => {
    this.#processWorkerEvent(event.data);
  };

  constructor(
    config: HandTrackingRuntimeConfig = handTrackingRuntimeConfig,
    dependencies: HandTrackingRuntimeDependencies = {}
  ) {
    this.#config = config;
    this.#cancelAnimationFrame =
      dependencies.cancelAnimationFrame ?? globalThis.cancelAnimationFrame;
    this.#createImageBitmap =
      dependencies.createImageBitmap ?? globalThis.createImageBitmap;
    this.#createVideoElement =
      dependencies.createVideoElement ?? createDefaultVideoElement;
    this.#createWorker = dependencies.createWorker ?? createDefaultWorker;
    this.#mediaDevices =
      dependencies.mediaDevices ?? globalThis.navigator?.mediaDevices ?? null;
    this.#requestAnimationFrame =
      dependencies.requestAnimationFrame ?? globalThis.requestAnimationFrame;
  }

  get snapshot(): HandTrackingRuntimeSnapshot {
    return this.#runtimeSnapshot;
  }

  get latestPose(): LatestHandTrackingSnapshot {
    return this.#runtimeSnapshot.latestPose;
  }

  get telemetrySnapshot(): HandTrackingTelemetrySnapshot {
    const latestPoseAgeMs =
      this.#runtimeSnapshot.latestPose.timestampMs === null
        ? null
        : Math.max(0, readFrameTimestampMs() - this.#runtimeSnapshot.latestPose.timestampMs);

    return freezeTelemetrySnapshot({
      framesDispatched: this.#framesDispatched,
      framesProcessed: this.#framesProcessed,
      inFlightFrameSkips: this.#inFlightFrameSkips,
      latestPoseAgeMs,
      latestSequenceNumber: this.#latestSequenceNumber,
      staleSnapshotsIgnored: this.#staleSnapshotsIgnored,
      trackingState: this.#runtimeSnapshot.latestPose.trackingState,
      workerLatencyMs: this.#lastWorkerLatencyMs
    });
  }

  async ensureStarted(): Promise<HandTrackingRuntimeSnapshot> {
    if (this.#runtimeSnapshot.lifecycle === "ready") {
      return this.#runtimeSnapshot;
    }

    if (this.#bootPromise !== null) {
      return this.#bootPromise;
    }

    this.#setRuntimeSnapshot("booting", createUnavailableHandTrackingSnapshot(), null);

    this.#bootPromise = this.#startRuntime().finally(() => {
      this.#bootPromise = null;
    });

    return this.#bootPromise;
  }

  dispose(): void {
    if (this.#frameHandle !== 0) {
      this.#cancelAnimationFrame(this.#frameHandle);
      this.#frameHandle = 0;
    }

    if (this.#worker !== null) {
      this.#worker.removeEventListener("message", this.#handleWorkerMessage);
      this.#worker.postMessage({ kind: "shutdown" });
      this.#worker.terminate();
      this.#worker = null;
    }

    if (this.#stream !== null) {
      for (const track of this.#stream.getTracks()) {
        track.stop();
      }

      this.#stream = null;
    }

    if (this.#videoElement !== null) {
      this.#videoElement.pause();
      this.#videoElement.srcObject = null;
    }

    this.#frameInFlight = false;
    this.#framesDispatched = 0;
    this.#framesProcessed = 0;
    this.#inFlightFrameSkips = 0;
    this.#lastDispatchedFrameAt = 0;
    this.#lastWorkerLatencyMs = null;
    this.#latestSequenceNumber = 0;
    this.#staleSnapshotsIgnored = 0;

    if (this.#pendingBootReject !== null) {
      this.#pendingBootReject(new Error("Hand tracking runtime was disposed."));
    }

    this.#pendingBootReject = null;
    this.#pendingBootResolve = null;
    this.#setRuntimeSnapshot("idle", createUnavailableHandTrackingSnapshot(), null);
  }

  async #startRuntime(): Promise<HandTrackingRuntimeSnapshot> {
    this.dispose();
    this.#setRuntimeSnapshot("booting", createUnavailableHandTrackingSnapshot(), null);

    if (typeof this.#createImageBitmap !== "function") {
      return this.#failStartup(
        "ImageBitmap creation is unavailable for worker-based hand tracking."
      );
    }

    if (typeof this.#requestAnimationFrame !== "function") {
      return this.#failStartup(
        "requestAnimationFrame is unavailable for worker-based hand tracking."
      );
    }

    if (this.#mediaDevices?.getUserMedia === undefined) {
      return this.#failStartup("Webcam mediaDevices.getUserMedia is unavailable.");
    }

    const videoElement = this.#createVideoElement();

    this.#videoElement = videoElement;

    try {
      const stream = await this.#mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user"
        }
      });

      this.#stream = stream;
      videoElement.srcObject = stream;
      await videoElement.play();
    } catch {
      return this.#failStartup("The webcam stream could not be started.");
    }

    const worker = this.#createWorker();
    const readyPromise = new Promise<HandTrackingRuntimeSnapshot>(
      (resolve, reject) => {
        this.#pendingBootResolve = resolve;
        this.#pendingBootReject = reject;
      }
    );

    this.#worker = worker;
    worker.addEventListener("message", this.#handleWorkerMessage);
    worker.postMessage({
      kind: "boot",
      wasmRoot: this.#config.landmarker.wasmRoot,
      modelAssetPath: this.#config.landmarker.modelAssetPath,
      numHands: this.#config.landmarker.numHands,
      runningMode: this.#config.landmarker.runningMode,
      landmarks: this.#config.landmarks
    });

    return readyPromise;
  }

  #failStartup(reason: string): never {
    this.dispose();
    this.#setRuntimeSnapshot("failed", createUnavailableHandTrackingSnapshot(), reason);
    throw new Error(reason);
  }

  #processWorkerEvent(event: HandTrackingWorkerEvent): void {
    if (event.kind === "ready") {
      const nextSnapshot = freezeRuntimeSnapshot(
        "ready",
        createUnavailableHandTrackingSnapshot(),
        null
      );

      this.#runtimeSnapshot = nextSnapshot;
      this.#pendingBootResolve?.(nextSnapshot);
      this.#pendingBootResolve = null;
      this.#pendingBootReject = null;
      this.#queueNextFrame();
      return;
    }

    if (event.kind === "error") {
      const error = new Error(event.reason);
      const rejectBoot = this.#pendingBootReject;

      this.dispose();
      this.#setRuntimeSnapshot(
        "failed",
        createUnavailableHandTrackingSnapshot(),
        event.reason
      );
      rejectBoot?.(error);
      this.#pendingBootResolve = null;
      this.#pendingBootReject = null;
      return;
    }

    this.#frameInFlight = false;

    if (event.sequenceNumber < this.#latestSequenceNumber) {
      this.#staleSnapshotsIgnored += 1;
      return;
    }

    this.#framesProcessed += 1;
    this.#lastWorkerLatencyMs = Math.max(
      0,
      readFrameTimestampMs() - event.timestampMs
    );
    this.#latestSequenceNumber = event.sequenceNumber;
    this.#setRuntimeSnapshot(
      this.#runtimeSnapshot.lifecycle,
      createLatestHandTrackingSnapshot({
        sequenceNumber: event.sequenceNumber,
        timestampMs: event.timestampMs,
        pose: event.pose
      }),
      null
    );
  }

  #queueNextFrame(): void {
    if (this.#frameHandle !== 0 || this.#runtimeSnapshot.lifecycle !== "ready") {
      return;
    }

    this.#frameHandle = this.#requestAnimationFrame(() => {
      this.#frameHandle = 0;
      void this.#dispatchFrameToWorker();
      this.#queueNextFrame();
    });
  }

  async #dispatchFrameToWorker(): Promise<void> {
    if (
      this.#worker === null ||
      this.#videoElement === null ||
      this.#runtimeSnapshot.lifecycle !== "ready"
    ) {
      return;
    }

    if (this.#frameInFlight) {
      this.#inFlightFrameSkips += 1;
      return;
    }

    if (
      this.#videoElement.readyState < 2 ||
      this.#videoElement.videoWidth === 0 ||
      this.#videoElement.videoHeight === 0
    ) {
      return;
    }

    const timestampMs = readFrameTimestampMs();
    const minimumFrameDelay = 1000 / this.#config.framePump.targetFps;

    if (timestampMs - this.#lastDispatchedFrameAt < minimumFrameDelay) {
      return;
    }

    this.#frameInFlight = true;
    this.#lastDispatchedFrameAt = timestampMs;

    try {
      const frame = await this.#createImageBitmap(this.#videoElement as never);

      this.#worker.postMessage(
        {
          kind: "process-frame",
          frame,
          sequenceNumber: this.#latestSequenceNumber + 1,
          timestampMs
        },
        [frame]
      );
      this.#framesDispatched += 1;
    } catch {
      this.#frameInFlight = false;
    }
  }

  #setRuntimeSnapshot(
    lifecycle: HandTrackingRuntimeSnapshot["lifecycle"],
    latestPose: LatestHandTrackingSnapshot,
    failureReason: string | null
  ): void {
    this.#runtimeSnapshot = freezeRuntimeSnapshot(
      lifecycle,
      latestPose,
      failureReason
    );
  }
}
