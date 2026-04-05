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
    innerRadius: 0.045,
    outerRadius: 0.065,
    strokeColor: [0.97, 0.98, 0.99],
    horizontalBarSize: {
      width: 0.18,
      height: 0.006
    },
    verticalBarSize: {
      width: 0.006,
      height: 0.18
    }
  }
} as const satisfies GameplayRuntimeConfig;
