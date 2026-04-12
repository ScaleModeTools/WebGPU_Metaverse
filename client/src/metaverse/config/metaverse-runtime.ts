import type { MetaverseRuntimeConfig } from "../types/metaverse-runtime";

export const metaverseRuntimeConfig = {
  camera: {
    far: 420,
    fieldOfViewDegrees: 62,
    initialPitchRadians: -0.08,
    initialYawRadians: 0,
    near: 0.1,
    spawnPosition: {
      x: 0,
      y: 6.5,
      z: 24
    }
  },
  bodyPresentation: {
    groundedFirstPersonForwardOffsetMeters: 0.24,
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
    worldRadius: 110
  },
  groundedBody: {
    accelerationCurveExponent: 1.22,
    accelerationUnitsPerSecondSquared: 22,
    airborneMovementDampingFactor: 0.42,
    baseSpeedUnitsPerSecond: 8.5,
    boostCurveExponent: 1.08,
    boostMultiplier: 1.75,
    capsuleHalfHeightMeters: 0.48,
    capsuleRadiusMeters: 0.34,
    controllerOffsetMeters: 0.02,
    decelerationUnitsPerSecondSquared: 30,
    dragCurveExponent: 1.5,
    eyeHeightMeters: 1.62,
    gravityUnitsPerSecond: 18,
    jumpImpulseUnitsPerSecond: 6.8,
    maxSlopeClimbAngleRadians: Math.PI * 0.26,
    minSlopeSlideAngleRadians: Math.PI * 0.34,
    maxTurnSpeedRadiansPerSecond: 3.6,
    snapToGroundDistanceMeters: 0.22,
    stepHeightMeters: 0.28,
    stepWidthMeters: 0.24,
    spawnPosition: {
      x: 0,
      y: 0,
      z: 24
    }
  },
  orientation: {
    maxPitchRadians: 0.6,
    maxTurnSpeedRadiansPerSecond: 3.6,
    minPitchRadians: -0.6,
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
    planeDepth: 520,
    planeWidth: 520,
    roughness: 0.16,
    segmentCount: 160,
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
    accelerationCurveExponent: 1.08,
    accelerationUnitsPerSecondSquared: 12,
    authoritativeCorrection: {
      grossSnapDistanceThresholdMeters: 3.5,
      grossSnapYawThresholdRadians: 0.75,
      routineBlendAlpha: 0.35,
      routinePositionBlendThresholdMeters: 0.9,
      routineYawBlendThresholdRadians: 0.18
    },
    baseSpeedUnitsPerSecond: 10.5,
    boostCurveExponent: 1.02,
    boostMultiplier: 1.55,
    cameraFollowDistanceMeters: 3.2,
    cameraHeightOffsetMeters: 0.92,
    cameraEyeHeightMeters: 1.74,
    decelerationUnitsPerSecondSquared: 14,
    dragCurveExponent: 1.3,
    maxTurnSpeedRadiansPerSecond: 0.95,
    waterContactProbeRadiusMeters: 1.75,
    waterlineHeightMeters: 0.12
  },
  swim: {
    accelerationCurveExponent: 1.15,
    accelerationUnitsPerSecondSquared: 11,
    baseSpeedUnitsPerSecond: 4.8,
    boostCurveExponent: 1.1,
    boostMultiplier: 1.35,
    cameraEyeHeightMeters: 1.38,
    decelerationUnitsPerSecondSquared: 12,
    dragCurveExponent: 1.35,
    maxTurnSpeedRadiansPerSecond: 3.2
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
        z: -52
      },
      ringColor: [0.96, 0.73, 0.25]
    }
  ]
} as const satisfies MetaverseRuntimeConfig;
