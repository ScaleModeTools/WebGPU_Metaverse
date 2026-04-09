import type { HandTrackingRuntimeConfig } from "../types/hand-tracking";

export const handTrackingRuntimeConfig = {
  landmarker: {
    wasmRoot: "/mediapipe/wasm",
    modelAssetPath: "/models/hand_landmarker.task",
    numHands: 1,
    runningMode: "video"
  },
  landmarks: {
    thumbBaseIndex: 1,
    thumbKnuckleIndex: 2,
    thumbJointIndex: 3,
    thumbTipIndex: 4,
    indexBaseIndex: 5,
    indexKnuckleIndex: 6,
    indexJointIndex: 7,
    indexTipIndex: 8,
    middlePipIndex: 10
  },
  framePump: {
    targetFps: 30
  }
} as const satisfies HandTrackingRuntimeConfig;
