import { duckHuntLocalArenaSimulationConfig } from "./duck-hunt-local-arena-simulation";

import type { CoopArenaSimulationConfig } from "../types/duck-hunt-coop-arena-simulation";

export const duckHuntCoopArenaSimulationConfig = {
  camera: duckHuntLocalArenaSimulationConfig.camera,
  feedback: duckHuntLocalArenaSimulationConfig.feedback,
  targeting: {
    acquireRadius: duckHuntLocalArenaSimulationConfig.targeting.acquireRadius
  },
  weapon: duckHuntLocalArenaSimulationConfig.weapon
} as const satisfies CoopArenaSimulationConfig;
