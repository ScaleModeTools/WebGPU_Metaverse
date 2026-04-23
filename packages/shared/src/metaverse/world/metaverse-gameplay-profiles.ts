import {
  metaverseGroundedBodyTraversalCoreConfig,
  metaverseSwimSurfaceTraversalConfig,
  metaverseTraversalWorldRadius,
  metaverseVehicleSurfaceTraversalConfig,
  type MetaverseGroundedBodyTraversalCoreConfig,
  type MetaverseVehicleTraversalConfig
} from "../metaverse-authoritative-traversal-config.js";
import {
  createMetaverseGroundedJumpPhysicsConfigSnapshot,
  type MetaverseGroundedJumpPhysicsConfigSnapshot
} from "../metaverse-grounded-jump-physics.js";
import type { MetaverseSurfaceTraversalConfig } from "../metaverse-surface-traversal-simulation.js";
import type { MetaverseWorldSurfacePolicyConfig } from "../metaverse-world-surface-policy.js";

export interface MetaverseGameplayProfileSnapshot {
  readonly groundedBodyTraversal: MetaverseGroundedBodyTraversalCoreConfig;
  readonly groundedJumpPhysics: MetaverseGroundedJumpPhysicsConfigSnapshot;
  readonly groundedSurfacePolicy: MetaverseWorldSurfacePolicyConfig;
  readonly id: string;
  readonly label: string;
  readonly swimTraversal: MetaverseSurfaceTraversalConfig;
  readonly vehicleTraversal: MetaverseVehicleTraversalConfig;
  readonly worldRadius: number;
}

function freezeSurfaceTraversalConfig(
  config: MetaverseSurfaceTraversalConfig
): MetaverseSurfaceTraversalConfig {
  return Object.freeze({
    accelerationCurveExponent: config.accelerationCurveExponent,
    accelerationUnitsPerSecondSquared: config.accelerationUnitsPerSecondSquared,
    baseSpeedUnitsPerSecond: config.baseSpeedUnitsPerSecond,
    boostCurveExponent: config.boostCurveExponent,
    boostMultiplier: config.boostMultiplier,
    decelerationUnitsPerSecondSquared: config.decelerationUnitsPerSecondSquared,
    dragCurveExponent: config.dragCurveExponent,
    maxTurnSpeedRadiansPerSecond: config.maxTurnSpeedRadiansPerSecond
  });
}

function freezeGroundedBodyTraversalConfig(
  config: MetaverseGroundedBodyTraversalCoreConfig
): MetaverseGroundedBodyTraversalCoreConfig {
  return Object.freeze({
    accelerationCurveExponent: config.accelerationCurveExponent,
    accelerationUnitsPerSecondSquared: config.accelerationUnitsPerSecondSquared,
    airborneMovementDampingFactor: config.airborneMovementDampingFactor,
    baseSpeedUnitsPerSecond: config.baseSpeedUnitsPerSecond,
    boostCurveExponent: config.boostCurveExponent,
    boostMultiplier: config.boostMultiplier,
    capsuleHalfHeightMeters: config.capsuleHalfHeightMeters,
    capsuleRadiusMeters: config.capsuleRadiusMeters,
    controllerOffsetMeters: config.controllerOffsetMeters,
    decelerationUnitsPerSecondSquared: config.decelerationUnitsPerSecondSquared,
    dragCurveExponent: config.dragCurveExponent,
    gravityUnitsPerSecond: config.gravityUnitsPerSecond,
    jumpGroundContactGraceSeconds: config.jumpGroundContactGraceSeconds,
    jumpImpulseUnitsPerSecond: config.jumpImpulseUnitsPerSecond,
    maxSlopeClimbAngleRadians: config.maxSlopeClimbAngleRadians,
    maxTurnSpeedRadiansPerSecond: config.maxTurnSpeedRadiansPerSecond,
    minSlopeSlideAngleRadians: config.minSlopeSlideAngleRadians,
    snapToGroundDistanceMeters: config.snapToGroundDistanceMeters,
    stepHeightMeters: config.stepHeightMeters,
    stepWidthMeters: config.stepWidthMeters
  });
}

function freezeVehicleTraversalConfig(
  config: MetaverseVehicleTraversalConfig
): MetaverseVehicleTraversalConfig {
  return Object.freeze({
    accelerationCurveExponent: config.accelerationCurveExponent,
    accelerationUnitsPerSecondSquared: config.accelerationUnitsPerSecondSquared,
    baseSpeedUnitsPerSecond: config.baseSpeedUnitsPerSecond,
    boostCurveExponent: config.boostCurveExponent,
    boostMultiplier: config.boostMultiplier,
    decelerationUnitsPerSecondSquared: config.decelerationUnitsPerSecondSquared,
    dragCurveExponent: config.dragCurveExponent,
    maxTurnSpeedRadiansPerSecond: config.maxTurnSpeedRadiansPerSecond,
    waterContactProbeRadiusMeters: config.waterContactProbeRadiusMeters,
    waterlineHeightMeters: config.waterlineHeightMeters
  });
}

function freezeSurfacePolicyConfig(
  config: MetaverseWorldSurfacePolicyConfig
): MetaverseWorldSurfacePolicyConfig {
  return Object.freeze({
    capsuleHalfHeightMeters: config.capsuleHalfHeightMeters,
    capsuleRadiusMeters: config.capsuleRadiusMeters,
    gravityUnitsPerSecond: config.gravityUnitsPerSecond,
    jumpImpulseUnitsPerSecond: config.jumpImpulseUnitsPerSecond,
    oceanHeightMeters: config.oceanHeightMeters,
    stepHeightMeters: config.stepHeightMeters
  });
}

function createSurfacePolicyConfig(
  groundedBodyTraversal: MetaverseGroundedBodyTraversalCoreConfig
): MetaverseWorldSurfacePolicyConfig {
  return freezeSurfacePolicyConfig({
    capsuleHalfHeightMeters: groundedBodyTraversal.capsuleHalfHeightMeters,
    capsuleRadiusMeters: groundedBodyTraversal.capsuleRadiusMeters,
    gravityUnitsPerSecond: groundedBodyTraversal.gravityUnitsPerSecond,
    jumpImpulseUnitsPerSecond: groundedBodyTraversal.jumpImpulseUnitsPerSecond,
    oceanHeightMeters: 0,
    stepHeightMeters: groundedBodyTraversal.stepHeightMeters
  });
}

function createGameplayProfile(input: {
  readonly groundedBodyTraversal: MetaverseGroundedBodyTraversalCoreConfig;
  readonly id: string;
  readonly label: string;
  readonly swimTraversal: MetaverseSurfaceTraversalConfig;
  readonly vehicleTraversal: MetaverseVehicleTraversalConfig;
  readonly worldRadius: number;
}): MetaverseGameplayProfileSnapshot {
  const groundedBodyTraversal = freezeGroundedBodyTraversalConfig(
    input.groundedBodyTraversal
  );

  return Object.freeze({
    groundedBodyTraversal,
    groundedJumpPhysics:
      createMetaverseGroundedJumpPhysicsConfigSnapshot(groundedBodyTraversal),
    groundedSurfacePolicy: createSurfacePolicyConfig(groundedBodyTraversal),
    id: input.id,
    label: input.label,
    swimTraversal: freezeSurfaceTraversalConfig(input.swimTraversal),
    vehicleTraversal: freezeVehicleTraversalConfig(input.vehicleTraversal),
    worldRadius: input.worldRadius
  });
}

export const shellDefaultGameplayProfile = createGameplayProfile({
  groundedBodyTraversal: metaverseGroundedBodyTraversalCoreConfig,
  id: "shell-default-gameplay",
  label: "Shell Default",
  swimTraversal: metaverseSwimSurfaceTraversalConfig,
  vehicleTraversal: metaverseVehicleSurfaceTraversalConfig,
  worldRadius: metaverseTraversalWorldRadius
});

export const shellArcadeGameplayProfile = createGameplayProfile({
  groundedBodyTraversal: Object.freeze({
    ...metaverseGroundedBodyTraversalCoreConfig,
    accelerationUnitsPerSecondSquared: 24,
    baseSpeedUnitsPerSecond: 9.1,
    boostMultiplier: 1.92,
    gravityUnitsPerSecond: 15.6,
    jumpImpulseUnitsPerSecond: 9.68,
    maxTurnSpeedRadiansPerSecond: 3.95
  }),
  id: "shell-arcade-gameplay",
  label: "Shell Arcade",
  swimTraversal: Object.freeze({
    ...metaverseSwimSurfaceTraversalConfig,
    accelerationUnitsPerSecondSquared: 14.5,
    baseSpeedUnitsPerSecond: 7.1,
    boostMultiplier: 1.58,
    maxTurnSpeedRadiansPerSecond: 3.45
  }),
  vehicleTraversal: Object.freeze({
    ...metaverseVehicleSurfaceTraversalConfig,
    accelerationUnitsPerSecondSquared: 13.5,
    baseSpeedUnitsPerSecond: 11.8,
    boostMultiplier: 1.68,
    maxTurnSpeedRadiansPerSecond: 1.04
  }),
  worldRadius: 132
});

const metaverseGameplayProfiles = Object.freeze([
  shellDefaultGameplayProfile,
  shellArcadeGameplayProfile
]);

const metaverseGameplayProfilesById = new Map(
  metaverseGameplayProfiles.map((profile) => [profile.id, profile])
);

export const defaultMetaverseGameplayProfileId = shellDefaultGameplayProfile.id;

export function listMetaverseGameplayProfiles():
  readonly MetaverseGameplayProfileSnapshot[] {
  return metaverseGameplayProfiles;
}

export function readMetaverseGameplayProfile(
  profileId: string | null
): MetaverseGameplayProfileSnapshot | null {
  if (profileId === null) {
    return null;
  }

  return metaverseGameplayProfilesById.get(profileId) ?? null;
}

export function resolveMetaverseGameplayProfile(
  profileId: string | null | undefined
): MetaverseGameplayProfileSnapshot {
  return readMetaverseGameplayProfile(profileId ?? null) ??
    shellDefaultGameplayProfile;
}
