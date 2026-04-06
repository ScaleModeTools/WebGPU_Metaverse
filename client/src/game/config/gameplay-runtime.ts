import type { GameplayRuntimeConfig } from "../types/gameplay-runtime";

export const gameplayRuntimeConfig = {
  background: {
    lowerColor: [0.02, 0.07, 0.16],
    upperColor: [0.03, 0.19, 0.29]
  },
  enemies: {
    bodyColor: [0.95, 0.98, 0.99],
    downedColor: [0.96, 0.39, 0.31],
    scatterColor: [0.98, 0.78, 0.36],
    wingColor: [0.82, 0.9, 0.97],
    bodySize: {
      width: 0.11,
      height: 0.026
    },
    wingSize: {
      width: 0.12,
      height: 0.024
    },
    wingSweepRadians: 0.58
  },
  reticle: {
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
