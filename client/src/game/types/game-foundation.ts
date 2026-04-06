import type {
  CalibrationAnchorId,
  NormalizedViewportPoint
} from "@thumbshooter/shared";

export const handTrackingExecutionModels = ["worker-first"] as const;
export const handTrackingTransportModes = ["latest-snapshot"] as const;
export const triggerGestureModes = ["single", "auto"] as const;
export const weaponReloadRules = ["reticle-offscreen"] as const;
export const webGpuFallbackPolicies = ["capability-gate"] as const;
export const calibrationTransformModels = ["affine-2d"] as const;
export const firstPlayableWeaponIds = ["semiautomatic-pistol"] as const;
export const threeGameplayImportSurfaces = ["three/webgpu"] as const;
export const shaderAuthoringModels = ["three-tsl-node-material"] as const;

export type { CalibrationAnchorId };

export type HandTrackingExecutionModel =
  (typeof handTrackingExecutionModels)[number];
export type HandTrackingTransportMode =
  (typeof handTrackingTransportModes)[number];
export type TriggerGestureMode = (typeof triggerGestureModes)[number];
export type WeaponReloadRule = (typeof weaponReloadRules)[number];
export type WebGpuFallbackPolicy = (typeof webGpuFallbackPolicies)[number];
export type CalibrationTransformModel =
  (typeof calibrationTransformModels)[number];
export type FirstPlayableWeaponId = (typeof firstPlayableWeaponIds)[number];
export type ThreeGameplayImportSurface =
  (typeof threeGameplayImportSurfaces)[number];
export type ShaderAuthoringModel = (typeof shaderAuthoringModels)[number];

export interface CalibrationAnchorDefinition {
  readonly id: CalibrationAnchorId;
  readonly label: string;
  readonly normalizedTarget: NormalizedViewportPoint;
}

export interface GameFoundationConfig {
  readonly runtime: {
    readonly handTrackingExecutionModel: HandTrackingExecutionModel;
    readonly handTrackingTransport: HandTrackingTransportMode;
    readonly webGpuFallbackPolicy: WebGpuFallbackPolicy;
  };
  readonly renderer: {
    readonly target: "webgpu";
    readonly threeImportSurface: ThreeGameplayImportSurface;
    readonly shaderAuthoringModel: ShaderAuthoringModel;
    readonly viewportMode: "single-fullscreen";
    readonly referenceExamples: readonly string[];
  };
  readonly input: {
    readonly tracker: "mediapipe-hand-landmarker";
    readonly primaryLandmarks: readonly ["thumb-chain", "index-chain"];
  };
  readonly calibration: {
    readonly transformModel: CalibrationTransformModel;
    readonly anchors: readonly CalibrationAnchorDefinition[];
  };
  readonly weapon: {
    readonly firstPlayableWeapon: FirstPlayableWeaponId;
    readonly supportedReloadRules: readonly WeaponReloadRule[];
    readonly supportedTriggerModes: readonly TriggerGestureMode[];
    readonly automaticWeaponsStatus: "planned-after-first-playable";
  };
  readonly prototype: {
    readonly enemyPrototype: "birds";
    readonly enemyMovementProfile: "slow-dodge";
    readonly supportsScatterState: true;
  };
}
