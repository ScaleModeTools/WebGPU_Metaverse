import {
  metaverseGroundedBodyTraversalCoreConfig,
  metaverseGroundedSurfaceTraversalConfig,
  metaverseUnmountedPlayerLookConstraintBounds,
  metaverseSwimSurfaceTraversalConfig,
  metaverseTraversalWorldRadius,
  metaverseVehicleSurfaceTraversalConfig,
  metaverseWorldGroundedSpawnPosition,
  metaverseWorldInitialYawRadians
} from "@webgpu-metaverse/shared";
import type { MetaverseRuntimeConfig } from "../types/runtime-config";

const metaversePlaygroundFloorSupportHeightMeters =
  metaverseWorldGroundedSpawnPosition.y;
const metaverseGroundedFirstPersonFaceClearanceMeters = 0.12;
const metaverseGroundedFirstPersonHeadClearanceMeters = 0.05;
const metaverseGroundedFirstPersonHeadOcclusionRadiusMeters = 0.18;

export const metaverseRuntimeConfig = {
  camera: {
    far: 420,
    fieldOfViewDegrees: 62,
    initialPitchRadians: -0.08,
    initialYawRadians: metaverseWorldInitialYawRadians,
    near: 0.1,
    spawnPosition: {
      x: metaverseWorldGroundedSpawnPosition.x,
      y: metaversePlaygroundFloorSupportHeightMeters + 1.62,
      z: metaverseWorldGroundedSpawnPosition.z - 0.24
    }
  },
  bodyPresentation: {
    groundedFirstPersonHeadClearanceMeters:
      metaverseGroundedFirstPersonHeadClearanceMeters,
    groundedFirstPersonHeadOcclusionRadiusMeters:
      metaverseGroundedFirstPersonHeadOcclusionRadiusMeters,
    groundedFirstPersonForwardOffsetMeters:
      metaverseGroundedFirstPersonFaceClearanceMeters,
    swimIdleBodySubmersionDepthMeters: 1.02,
    swimMovingBodySubmersionDepthMeters: 0.94,
    swimThirdPersonFollowDistanceMeters: 2.8,
    swimThirdPersonHeightOffsetMeters: 0.52
  },
  environment: {
    domeRadius: 360,
    fogColor: [0.63, 0.76, 0.88],
    fogDensity: 0.0023,
    horizonColor: [0.74, 0.87, 0.97],
    sunColor: [1, 0.91, 0.74],
    sunDirection: {
      x: -0.38,
      y: 0.79,
      z: -0.48
    },
    zenithColor: [0.08, 0.2, 0.38]
  },
  movement: {
    baseSpeedUnitsPerSecond: 14,
    boostMultiplier: 2.15,
    maxAltitude: 22,
    minAltitude: 2.25,
    worldRadius: metaverseTraversalWorldRadius
  },
  groundedBody: {
    ...metaverseGroundedBodyTraversalCoreConfig,
    eyeHeightMeters: 1.62,
    spawnPosition: metaverseWorldGroundedSpawnPosition
  },
  orientation: {
    maxPitchRadians: metaverseUnmountedPlayerLookConstraintBounds.maxPitchRadians,
    maxTurnSpeedRadiansPerSecond:
      metaverseGroundedBodyTraversalCoreConfig.maxTurnSpeedRadiansPerSecond,
    minPitchRadians: metaverseUnmountedPlayerLookConstraintBounds.minPitchRadians,
    mouseEdgeTurn: {
      deadZoneViewportFraction: 0.2,
      responseExponent: 1.55
    }
  },
  ocean: {
    emissiveColor: [0.08, 0.28, 0.37],
    farColor: [0.05, 0.22, 0.34],
    height: 0,
    nearColor: [0.12, 0.45, 0.58],
    planeDepth: 72,
    planeWidth: 72,
    roughness: 0.16,
    segmentCount: 96,
    waveAmplitude: 0.32,
    waveFrequencies: {
      primary: 0.11,
      ripple: 0.38,
      secondary: 0.18
    },
    waveSpeeds: {
      primary: 0.62,
      ripple: 1.28,
      secondary: 0.87
    }
  },
  skiff: {
    ...metaverseVehicleSurfaceTraversalConfig,
    authoritativeCorrection: {
      grossSnapDistanceThresholdMeters: 3.5,
      grossSnapYawThresholdRadians: 0.75,
      routineBlendAlpha: 0.35,
      routinePositionBlendThresholdMeters: 0.9,
      routineYawBlendThresholdRadians: 0.18
    },
    cameraFollowDistanceMeters: 3.2,
    cameraHeightOffsetMeters: 0.92,
    cameraEyeHeightMeters: 1.74,
    waterContactProbeRadiusMeters: 1.75,
    waterlineHeightMeters: 0.12
  },
  swim: {
    ...metaverseSwimSurfaceTraversalConfig,
    cameraEyeHeightMeters: 1.38,
  },
  portals: [
    {
      beamColor: [0.96, 0.81, 0.38],
      experienceId: "duck-hunt",
      highlightRadius: 34,
      interactionRadius: 18,
      label: "Duck Hunt!",
      position: {
        x: 0,
        y: 6,
        z: -34
      },
      ringColor: [0.96, 0.73, 0.25]
    }
  ]
} as const satisfies MetaverseRuntimeConfig;
