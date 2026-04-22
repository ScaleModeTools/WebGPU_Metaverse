import type { MetaverseSurfaceTraversalConfig } from "./metaverse-surface-traversal-simulation.js";
import type { MetaverseWorldSurfacePolicyConfig } from "./metaverse-world-surface-policy.js";

export interface MetaverseGroundedBodyTraversalCoreConfig
  extends MetaverseSurfaceTraversalConfig {
  readonly airborneMovementDampingFactor: number;
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly controllerOffsetMeters: number;
  readonly gravityUnitsPerSecond: number;
  readonly jumpGroundContactGraceSeconds: number;
  readonly jumpImpulseUnitsPerSecond: number;
  readonly maxSlopeClimbAngleRadians: number;
  readonly minSlopeSlideAngleRadians: number;
  readonly snapToGroundDistanceMeters: number;
  readonly stepHeightMeters: number;
  readonly stepWidthMeters: number;
}

export interface MetaverseVehicleTraversalConfig
  extends MetaverseSurfaceTraversalConfig {
  readonly waterContactProbeRadiusMeters: number;
  readonly waterlineHeightMeters: number;
}

export const metaverseTraversalWorldRadius = 110;

export const metaverseVehicleSurfaceTraversalConfig = Object.freeze({
  accelerationCurveExponent: 1.08,
  accelerationUnitsPerSecondSquared: 12,
  baseSpeedUnitsPerSecond: 10.5,
  boostCurveExponent: 1.02,
  boostMultiplier: 1.55,
  decelerationUnitsPerSecondSquared: 14,
  dragCurveExponent: 1.3,
  maxTurnSpeedRadiansPerSecond: 0.95,
  waterContactProbeRadiusMeters: 1.75,
  waterlineHeightMeters: 0.12
} as const satisfies MetaverseVehicleTraversalConfig);

export const metaverseGroundedSurfaceTraversalConfig = Object.freeze({
  accelerationCurveExponent: 1.22,
  accelerationUnitsPerSecondSquared: 22,
  baseSpeedUnitsPerSecond: 8.5,
  boostCurveExponent: 1.08,
  boostMultiplier: 1.75,
  decelerationUnitsPerSecondSquared: 30,
  dragCurveExponent: 1.5,
  maxTurnSpeedRadiansPerSecond: 3.6
} as const satisfies MetaverseSurfaceTraversalConfig);

export const metaverseSwimSurfaceTraversalConfig = Object.freeze({
  accelerationCurveExponent: 1.15,
  accelerationUnitsPerSecondSquared: 13,
  baseSpeedUnitsPerSecond: 6.4,
  boostCurveExponent: 1.1,
  boostMultiplier: 1.45,
  decelerationUnitsPerSecondSquared: 12,
  dragCurveExponent: 1.35,
  maxTurnSpeedRadiansPerSecond: 3.2
} as const satisfies MetaverseSurfaceTraversalConfig);

export const metaverseGroundedBodyTraversalCoreConfig = Object.freeze({
  accelerationCurveExponent: 1.22,
  accelerationUnitsPerSecondSquared: 22,
  airborneMovementDampingFactor: 0.42,
  baseSpeedUnitsPerSecond: 6,
  boostCurveExponent: 1.08,
  boostMultiplier: 1.25,
  capsuleHalfHeightMeters: 0.48,
  capsuleRadiusMeters: 0.34,
  controllerOffsetMeters: 0.02,
  decelerationUnitsPerSecondSquared: 30,
  dragCurveExponent: 1.5,
  gravityUnitsPerSecond: 18,
  jumpGroundContactGraceSeconds: 0.2,
  jumpImpulseUnitsPerSecond: 7.1,
  maxSlopeClimbAngleRadians: Math.PI * 0.26,
  maxTurnSpeedRadiansPerSecond: 3.6,
  minSlopeSlideAngleRadians: Math.PI * 0.34,
  snapToGroundDistanceMeters: 0.22,
  stepHeightMeters: 0.28,
  stepWidthMeters: 0.24
} as const satisfies MetaverseGroundedBodyTraversalCoreConfig);

export const metaverseGroundedSurfacePolicyConfig = Object.freeze({
  capsuleHalfHeightMeters: metaverseGroundedBodyTraversalCoreConfig.capsuleHalfHeightMeters,
  capsuleRadiusMeters: metaverseGroundedBodyTraversalCoreConfig.capsuleRadiusMeters,
  gravityUnitsPerSecond: metaverseGroundedBodyTraversalCoreConfig.gravityUnitsPerSecond,
  jumpImpulseUnitsPerSecond:
    metaverseGroundedBodyTraversalCoreConfig.jumpImpulseUnitsPerSecond,
  oceanHeightMeters: 0,
  stepHeightMeters: metaverseGroundedBodyTraversalCoreConfig.stepHeightMeters
} as const satisfies MetaverseWorldSurfacePolicyConfig);
