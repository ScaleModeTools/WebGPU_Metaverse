import type { MetaverseRuntimeConfig } from "../types/metaverse-runtime";

export const metaverseRuntimeConfig = {
  camera: {
    far: 420,
    fieldOfViewDegrees: 62,
    initialPitchRadians: -0.08,
    initialYawRadians: Math.PI,
    near: 0.1,
    spawnPosition: {
      x: 0,
      y: 6.5,
      z: 24
    }
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
    baseSpeedUnitsPerSecond: 8.5,
    boostMultiplier: 1.75,
    capsuleHalfHeightMeters: 0.48,
    capsuleRadiusMeters: 0.34,
    controllerOffsetMeters: 0.02,
    eyeHeightMeters: 1.62,
    gravityUnitsPerSecond: 18,
    maxTurnSpeedRadiansPerSecond: 1.9,
    snapToGroundDistanceMeters: 0.22,
    spawnPosition: {
      x: 0,
      y: 0,
      z: 24
    }
  },
  orientation: {
    maxPitchRadians: 0.6,
    maxTurnSpeedRadiansPerSecond: 1.9,
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
