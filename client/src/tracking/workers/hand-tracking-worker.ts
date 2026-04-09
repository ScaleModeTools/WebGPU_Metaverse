import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult
} from "@mediapipe/tasks-vision";

import { installMediaPipeConsoleFilter } from "./mediapipe-console-filter";
import { buildMediaPipeLoaderScript } from "./mediapipe-loader-bridge";

import type {
  HandTrackingPoseCandidate,
  HandTrackingWorkerBootMessage,
  HandTrackingWorkerEvent,
  HandTrackingWorkerMessage
} from "../types/hand-tracking";

type WorkerDynamicImport = (moduleUrl: string) => Promise<unknown>;
type MediaPipeModuleFactory = (moduleArg?: object) => Promise<unknown>;
type WorkerScopeWithDynamicImport = typeof self & {
  import?: WorkerDynamicImport;
  ModuleFactory?: MediaPipeModuleFactory;
};

function ensureWorkerDynamicImportBridge(): void {
  const workerScope = self as WorkerScopeWithDynamicImport;

  if (typeof workerScope.import === "function") {
    return;
  }

  workerScope.import = async (moduleUrl: string) => {
    const response = await fetch(moduleUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch MediaPipe loader script: ${response.status}`);
    }

    const loaderSource = await response.text();

    try {
      (0, eval)(buildMediaPipeLoaderScript(loaderSource, moduleUrl));
      return undefined;
    } catch (error) {
      const moduleNamespace = (await import(
        /* @vite-ignore */ moduleUrl
      )) as {
        readonly default?: MediaPipeModuleFactory;
      };

      if (typeof moduleNamespace.default === "function") {
        workerScope.ModuleFactory = moduleNamespace.default;
      }

      return moduleNamespace;
    }
  };
}

let handLandmarker: HandLandmarker | null = null;
let landmarkIndices: HandTrackingWorkerBootMessage["landmarks"] = {
  thumbBaseIndex: 1,
  thumbKnuckleIndex: 2,
  thumbJointIndex: 3,
  thumbTipIndex: 4,
  indexBaseIndex: 5,
  indexKnuckleIndex: 6,
  indexJointIndex: 7,
  indexTipIndex: 8,
  middlePipIndex: 10
};

installMediaPipeConsoleFilter();
ensureWorkerDynamicImportBridge();

function postWorkerEvent(event: HandTrackingWorkerEvent): void {
  self.postMessage(event);
}

function readLandmarkCoordinate(
  value: number | undefined
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function readLandmarkPoint(
  landmark:
    | {
        readonly x?: number;
        readonly y?: number;
        readonly z?: number;
      }
    | undefined
): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} | null {
  const x = readLandmarkCoordinate(landmark?.x);
  const y = readLandmarkCoordinate(landmark?.y);
  const z = readLandmarkCoordinate(landmark?.z);

  if (x === null || y === null || z === null) {
    return null;
  }

  return {
    x,
    y,
    z
  };
}

function extractPoseCandidate(
  result: HandLandmarkerResult
): HandTrackingPoseCandidate | null {
  const landmarks = result.landmarks[0];
  const thumbBase = readLandmarkPoint(landmarks?.[landmarkIndices.thumbBaseIndex]);
  const thumbKnuckle = readLandmarkPoint(landmarks?.[landmarkIndices.thumbKnuckleIndex]);
  const thumbJoint = readLandmarkPoint(landmarks?.[landmarkIndices.thumbJointIndex]);
  const thumbTip = readLandmarkPoint(landmarks?.[landmarkIndices.thumbTipIndex]);
  const indexBase = readLandmarkPoint(landmarks?.[landmarkIndices.indexBaseIndex]);
  const indexKnuckle = readLandmarkPoint(landmarks?.[landmarkIndices.indexKnuckleIndex]);
  const indexJoint = readLandmarkPoint(landmarks?.[landmarkIndices.indexJointIndex]);
  const indexTip = readLandmarkPoint(landmarks?.[landmarkIndices.indexTipIndex]);
  const middlePip = readLandmarkPoint(landmarks?.[landmarkIndices.middlePipIndex]);

  if (
    thumbBase === null ||
    thumbKnuckle === null ||
    thumbJoint === null ||
    thumbTip === null ||
    indexBase === null ||
    indexKnuckle === null ||
    indexJoint === null ||
    indexTip === null ||
    middlePip === null
  ) {
    return null;
  }

  return {
    thumbBase,
    thumbKnuckle,
    thumbJoint,
    thumbTip,
    indexBase,
    indexKnuckle,
    indexJoint,
    indexTip,
    middlePip
  };
}

function describeWorkerFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message.length > 0
      ? `MediaPipe Hand Landmarker boot or inference failed: ${error.message}`
      : "MediaPipe Hand Landmarker boot or inference failed.";
  }

  if (typeof error === "string" && error.length > 0) {
    return `MediaPipe Hand Landmarker boot or inference failed: ${error}`;
  }

  return "MediaPipe Hand Landmarker boot or inference failed.";
}

async function bootHandLandmarker(message: HandTrackingWorkerBootMessage): Promise<void> {
  handLandmarker?.close();

  landmarkIndices = message.landmarks;

  const vision = await FilesetResolver.forVisionTasks(message.wasmRoot);

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: message.modelAssetPath
    },
    numHands: message.numHands,
    runningMode: message.runningMode.toUpperCase() as "VIDEO"
  });
}

async function handleWorkerMessage(
  message: HandTrackingWorkerMessage
): Promise<void> {
  if (message.kind === "shutdown") {
    handLandmarker?.close();
    handLandmarker = null;
    return;
  }

  try {
    if (message.kind === "boot") {
      await bootHandLandmarker(message);
      postWorkerEvent({ kind: "ready" });
      return;
    }

    if (handLandmarker === null) {
      postWorkerEvent({
        kind: "error",
        reason: "Hand Landmarker was not ready before frame processing."
      });
      return;
    }

    const result = handLandmarker.detectForVideo(message.frame, message.timestampMs);
    const pose = extractPoseCandidate(result);

    postWorkerEvent({
      kind: "snapshot",
      pose,
      sequenceNumber: message.sequenceNumber,
      timestampMs: message.timestampMs
    });
  } catch (error) {
    postWorkerEvent({
      kind: "error",
      reason: describeWorkerFailureReason(error)
    });
  } finally {
    if (message.kind === "process-frame") {
      message.frame.close();
    }
  }
}

self.addEventListener("message", (event: MessageEvent<HandTrackingWorkerMessage>) => {
  void handleWorkerMessage(event.data);
});
