import type {
  TriggerGestureMode,
  WeaponReloadRule
} from "../../../game/types/game-foundation";

const supportedReloadRules = [
  "reticle-offscreen"
] as const satisfies readonly WeaponReloadRule[];

const supportedTriggerModes = [
  "single",
  "auto"
] as const satisfies readonly TriggerGestureMode[];

export const duckHuntGameFoundationConfig = {
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
    primaryLandmarks: ["thumb-chain", "index-chain"]
  },
  weapon: {
    firstPlayableWeapon: "semiautomatic-pistol",
    supportedReloadRules,
    supportedTriggerModes,
    automaticWeaponsStatus: "planned-after-first-playable"
  },
  prototype: {
    enemyPrototype: "birds",
    enemyMovementProfile: "slow-dodge",
    supportsScatterState: true
  }
} as const;
