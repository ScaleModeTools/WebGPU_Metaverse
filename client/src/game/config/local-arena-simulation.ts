import { localCombatSessionConfig } from "./local-combat-session";
import { firstPlayableWeaponDefinition } from "./weapon-manifest";
import type { LocalArenaSimulationConfig } from "../types/local-arena-simulation";

export const localArenaSimulationConfig = {
  arenaBounds: {
    minX: 0.08,
    maxX: 0.92,
    minY: 0.14,
    maxY: 0.86
  },
  enemySeeds: [
    {
      id: "bird-1",
      label: "Bird 1",
      spawn: { x: 0.22, y: 0.28 },
      glideVelocity: { x: 0.12, y: 0.03 },
      radius: 0.08,
      scale: 1.05,
      wingSpeed: 6.4
    },
    {
      id: "bird-2",
      label: "Bird 2",
      spawn: { x: 0.78, y: 0.24 },
      glideVelocity: { x: -0.11, y: 0.04 },
      radius: 0.082,
      scale: 0.98,
      wingSpeed: 5.8
    },
    {
      id: "bird-3",
      label: "Bird 3",
      spawn: { x: 0.32, y: 0.7 },
      glideVelocity: { x: 0.1, y: -0.05 },
      radius: 0.078,
      scale: 1.1,
      wingSpeed: 6.9
    },
    {
      id: "bird-4",
      label: "Bird 4",
      spawn: { x: 0.74, y: 0.74 },
      glideVelocity: { x: -0.12, y: -0.03 },
      radius: 0.08,
      scale: 1.02,
      wingSpeed: 6.1
    }
  ],
  feedback: {
    holdDurationMs: 380
  },
  movement: {
    maxStepMs: 48,
    scatterDurationMs: 820,
    scatterSpeed: 0.24,
    downedDurationMs: 960,
    downedDriftVelocityY: 0.18
  },
  session: localCombatSessionConfig,
  targeting: {
    acquireRadius: 0.1,
    hitRadius: 0.09,
    reticleScatterRadius: 0.17,
    shotScatterRadius: 0.24
  },
  weapon: firstPlayableWeaponDefinition
} as const satisfies LocalArenaSimulationConfig;
