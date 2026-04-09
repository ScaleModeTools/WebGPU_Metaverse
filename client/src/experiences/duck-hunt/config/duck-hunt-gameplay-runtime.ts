import {
  createDegrees,
  createRadians
} from "@webgpu-metaverse/shared";

import type { GameplayRuntimeConfig } from "../types/duck-hunt-gameplay-runtime";

export const duckHuntGameplayRuntimeConfig = {
  camera: {
    far: 260,
    fieldOfViewDegrees: createDegrees(58),
    near: 0.1,
  },
  enemies: {
    bodyColor: [0.95, 0.98, 0.99],
    downedColor: [0.96, 0.39, 0.31],
    scatterColor: [0.98, 0.78, 0.36],
    wingColor: [0.82, 0.9, 0.97],
    bodySize: {
      width: 1.5,
      height: 0.38
    },
    wingSize: {
      width: 1.6,
      height: 0.24
    },
    wingSweepRadians: createRadians(0.58)
  },
  environment: {
    domeRadius: 240,
    fogColor: [0.67, 0.79, 0.9],
    fogDensity: 0.003,
    horizonColor: [0.78, 0.89, 0.98],
    sunColor: [1, 0.9, 0.72],
    sunDirection: {
      x: -0.38,
      y: 0.79,
      z: -0.48
    },
    zenithColor: [0.11, 0.23, 0.42]
  },
  ocean: {
    emissiveColor: [0.08, 0.28, 0.37],
    farColor: [0.05, 0.22, 0.34],
    height: 0,
    nearColor: [0.12, 0.45, 0.58],
    planeDepth: 320,
    planeWidth: 320,
    roughness: 0.16,
    segmentCount: 120,
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
  reticle: {
    depth: 7.5,
    haloInnerRadius: 0.071,
    haloOuterRadius: 0.125,
    innerRadius: 0.045,
    outerRadius: 0.065,
    horizontalBarSize: {
      width: 0.18,
      height: 0.006
    },
    stateStyles: {
      "tracking-unavailable": {
        haloOpacity: 0.05,
        scale: 0.94,
        strokeColor: [0.73, 0.81, 0.9],
        strokeOpacity: 0.46
      },
      neutral: {
        haloOpacity: 0.1,
        scale: 1,
        strokeColor: [0.97, 0.98, 0.99],
        strokeOpacity: 0.9
      },
      targeted: {
        haloOpacity: 0.18,
        scale: 1.05,
        strokeColor: [0.47, 0.9, 0.98],
        strokeOpacity: 0.98
      },
      hit: {
        haloOpacity: 0.24,
        scale: 1.12,
        strokeColor: [0.98, 0.79, 0.36],
        strokeOpacity: 1
      },
      "reload-required": {
        haloOpacity: 0.16,
        scale: 0.93,
        strokeColor: [0.99, 0.64, 0.35],
        strokeOpacity: 0.94
      },
      reloading: {
        haloOpacity: 0.1,
        scale: 0.88,
        strokeColor: [0.74, 0.87, 0.96],
        strokeOpacity: 0.72
      },
      "round-paused": {
        haloOpacity: 0.08,
        scale: 0.96,
        strokeColor: [0.8, 0.83, 0.88],
        strokeOpacity: 0.64
      }
    },
    verticalBarSize: {
      width: 0.006,
      height: 0.18
    }
  }
} as const satisfies GameplayRuntimeConfig;
