import {
  createMilliseconds,
  createRadians
} from "@thumbshooter/shared";

import { duckHuntLocalCombatSessionConfig } from "./duck-hunt-local-combat-session";
import { duckHuntFirstPlayableWeaponDefinition } from "./duck-hunt-weapon-manifest";
import type { LocalArenaSimulationConfig } from "../../../game/types/local-arena-simulation";

export const duckHuntLocalArenaSimulationConfig = {
  birdAltitudeBounds: {
    min: 4.5,
    max: 18.5
  },
  camera: {
    initialPitchRadians: createRadians(0.08),
    initialYawRadians: createRadians(0),
    lookBounds: {
      maxPitchRadians: createRadians(1.2),
      minPitchRadians: createRadians(-0.18)
    },
    lookMotion: {
      deadZoneViewportFraction: 0.22,
      maxSpeedRadiansPerSecond: 1.6,
      responseExponent: 1.55
    },
    position: {
      x: 0,
      y: 1.35,
      z: 0
    }
  },
  enemySeeds: [
    {
      id: "bird-1",
      label: "Bird 1",
      orbitRadius: 32,
      spawn: {
        altitude: 9.2,
        azimuthRadians: createRadians(-0.42)
      },
      glideVelocity: {
        altitudeUnitsPerSecond: 0.42,
        azimuthRadiansPerSecond: 0.24
      },
      radius: 1.35,
      scale: 1.1,
      wingSpeed: 6.4
    },
    {
      id: "bird-2",
      label: "Bird 2",
      orbitRadius: 36,
      spawn: {
        altitude: 11.8,
        azimuthRadians: createRadians(0.28)
      },
      glideVelocity: {
        altitudeUnitsPerSecond: -0.36,
        azimuthRadiansPerSecond: -0.18
      },
      radius: 1.3,
      scale: 1.03,
      wingSpeed: 5.8
    },
    {
      id: "bird-3",
      label: "Bird 3",
      orbitRadius: 30,
      spawn: {
        altitude: 7.6,
        azimuthRadians: createRadians(-0.86)
      },
      glideVelocity: {
        altitudeUnitsPerSecond: 0.28,
        azimuthRadiansPerSecond: 0.27
      },
      radius: 1.28,
      scale: 1.08,
      wingSpeed: 6.9
    },
    {
      id: "bird-4",
      label: "Bird 4",
      orbitRadius: 34,
      spawn: {
        altitude: 10.4,
        azimuthRadians: createRadians(0.74)
      },
      glideVelocity: {
        altitudeUnitsPerSecond: 0.24,
        azimuthRadiansPerSecond: -0.23
      },
      radius: 1.32,
      scale: 1.05,
      wingSpeed: 6.1
    }
  ],
  feedback: {
    holdDurationMs: createMilliseconds(380)
  },
  movement: {
    maxStepMs: createMilliseconds(48),
    downedDriftSpeed: 2.8,
    downedDurationMs: createMilliseconds(960),
    downedFallSpeed: 5.6,
    scatterAltitudeSpeed: 3.2,
    scatterAngularSpeed: 0.78,
    scatterDurationMs: createMilliseconds(820),
  },
  session: duckHuntLocalCombatSessionConfig,
  targeting: {
    acquireRadius: 0.68,
    hitRadius: 0.42,
    reticleScatterRadius: 4.2,
    shotScatterRadius: 5.2
  },
  weapon: duckHuntFirstPlayableWeaponDefinition
} as const satisfies LocalArenaSimulationConfig;
