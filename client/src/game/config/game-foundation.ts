import { createNormalizedViewportPoint } from "@thumbshooter/shared";

import type { GameFoundationConfig } from "../types/game-foundation";

export const gameFoundationConfig = {
  runtime: {
    handTrackingExecutionModel: "worker-first",
    handTrackingTransport: "latest-snapshot",
    webGpuFallbackPolicy: "capability-gate"
  },
  renderer: {
    target: "webgpu",
    threeImportSurface: "three/webgpu",
    shaderAuthoringModel: "three-tsl-node-material",
    viewportMode: "single-fullscreen",
    referenceExamples: [
      "examples/three/webgl-gpgpu-birds/reference.html",
      "examples/three/webgpu-compute-birds/README.md"
    ]
  },
  input: {
    tracker: "mediapipe-hand-landmarker",
    primaryLandmarks: ["thumb-tip", "index-fingertip"],
    reloadRule: "reticle-offscreen"
  },
  calibration: {
    transformModel: "affine-2d",
    anchors: [
      {
        id: "center",
        label: "Center",
        normalizedTarget: createNormalizedViewportPoint({ x: 0.5, y: 0.5 })
      },
      {
        id: "top-left",
        label: "Top Left",
        normalizedTarget: createNormalizedViewportPoint({ x: 0.1, y: 0.1 })
      },
      {
        id: "top-right",
        label: "Top Right",
        normalizedTarget: createNormalizedViewportPoint({ x: 0.9, y: 0.1 })
      },
      {
        id: "bottom-left",
        label: "Bottom Left",
        normalizedTarget: createNormalizedViewportPoint({ x: 0.1, y: 0.9 })
      },
      {
        id: "bottom-right",
        label: "Bottom Right",
        normalizedTarget: createNormalizedViewportPoint({ x: 0.9, y: 0.9 })
      },
      {
        id: "top-center",
        label: "Top Center",
        normalizedTarget: createNormalizedViewportPoint({ x: 0.5, y: 0.1 })
      },
      {
        id: "mid-right",
        label: "Mid Right",
        normalizedTarget: createNormalizedViewportPoint({ x: 0.9, y: 0.5 })
      },
      {
        id: "mid-left",
        label: "Mid Left",
        normalizedTarget: createNormalizedViewportPoint({ x: 0.1, y: 0.5 })
      },
      {
        id: "bottom-center",
        label: "Bottom Center",
        normalizedTarget: createNormalizedViewportPoint({ x: 0.5, y: 0.9 })
      }
    ]
  },
  weapon: {
    firstPlayableWeapon: "semiautomatic-pistol",
    supportedTriggerModes: ["single", "auto"],
    automaticWeaponsStatus: "planned-after-first-playable"
  },
  prototype: {
    enemyPrototype: "birds",
    enemyMovementProfile: "slow-dodge",
    supportsScatterState: true
  }
} as const satisfies GameFoundationConfig;
