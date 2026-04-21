import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveMetaverseMapPlayerSpawnNode
} from "@webgpu-metaverse/shared/metaverse/world";

function createSpawnNode(spawnId, teamId, x, z) {
  return Object.freeze({
    label: spawnId,
    position: Object.freeze({
      x,
      y: 0,
      z
    }),
    spawnId,
    teamId,
    yawRadians: 0
  });
}

function resolveTieBreakPlayerId(desiredTieIndex, candidateCount) {
  for (let suffix = 1; suffix < 200; suffix += 1) {
    const playerId = `spawn-tie-${suffix}`;
    let hash = 0;

    for (let index = 0; index < playerId.length; index += 1) {
      hash = ((hash << 5) - hash + playerId.charCodeAt(index)) | 0;
    }

    if (Math.abs(hash) % candidateCount === desiredTieIndex) {
      return playerId;
    }
  }

  throw new Error(`Unable to resolve player id for tie index ${desiredTieIndex}.`);
}

test("shared team-aware spawn resolver prefers home spawns until enemies enter the authored avoidance radius", () => {
  const playerSpawnNodes = Object.freeze([
    createSpawnNode("blue-base", "blue", -24, 0),
    createSpawnNode("red-base", "red", 24, 0)
  ]);
  const playerSpawnSelection = Object.freeze({
    enemyAvoidanceRadiusMeters: 12,
    homeTeamBiasMeters: 8
  });
  const openFieldSpawn = resolveMetaverseMapPlayerSpawnNode({
    occupiedPlayerSnapshots: Object.freeze([]),
    playerSpawnNodes,
    playerSpawnSelection,
    playerTeamId: "blue"
  });
  const reroutedSpawn = resolveMetaverseMapPlayerSpawnNode({
    occupiedPlayerSnapshots: Object.freeze([
      Object.freeze({
        position: Object.freeze({
          x: -20,
          y: 0,
          z: 0
        }),
        teamId: "red"
      })
    ]),
    playerSpawnNodes,
    playerSpawnSelection,
    playerTeamId: "blue"
  });

  assert.equal(openFieldSpawn?.spawnId, "blue-base");
  assert.equal(reroutedSpawn?.spawnId, "red-base");
});

test("shared team-aware spawn resolver spreads equally ranked home spawns across players before roster occupancy is known", () => {
  const playerSpawnNodes = Object.freeze([
    createSpawnNode("blue-base-a", "blue", -24, -8),
    createSpawnNode("blue-base-b", "blue", -24, 8),
    createSpawnNode("red-base-a", "red", 24, -8),
    createSpawnNode("red-base-b", "red", 24, 8)
  ]);
  const playerSpawnSelection = Object.freeze({
    enemyAvoidanceRadiusMeters: 12,
    homeTeamBiasMeters: 8
  });
  const firstBluePlayerId = resolveTieBreakPlayerId(0, 2);
  const secondBluePlayerId = resolveTieBreakPlayerId(1, 2);
  const firstBlueSpawn = resolveMetaverseMapPlayerSpawnNode({
    occupiedPlayerSnapshots: Object.freeze([]),
    playerId: firstBluePlayerId,
    playerSpawnNodes,
    playerSpawnSelection,
    playerTeamId: "blue"
  });
  const secondBlueSpawn = resolveMetaverseMapPlayerSpawnNode({
    occupiedPlayerSnapshots: Object.freeze([]),
    playerId: secondBluePlayerId,
    playerSpawnNodes,
    playerSpawnSelection,
    playerTeamId: "blue"
  });

  assert.equal(firstBlueSpawn?.spawnId, "blue-base-a");
  assert.equal(secondBlueSpawn?.spawnId, "blue-base-b");
});

test("shared team-aware spawn resolver avoids reusing an occupied home spawn when another home lane is free", () => {
  const playerSpawnNodes = Object.freeze([
    createSpawnNode("blue-base-a", "blue", -24, -8),
    createSpawnNode("blue-base-b", "blue", -24, 8),
    createSpawnNode("red-base-a", "red", 24, -8),
    createSpawnNode("red-base-b", "red", 24, 8)
  ]);
  const playerSpawnSelection = Object.freeze({
    enemyAvoidanceRadiusMeters: 12,
    homeTeamBiasMeters: 8
  });
  const reroutedBlueSpawn = resolveMetaverseMapPlayerSpawnNode({
    occupiedPlayerSnapshots: Object.freeze([
      Object.freeze({
        position: Object.freeze({
          x: -24,
          y: 0,
          z: -8
        }),
        teamId: "blue"
      })
    ]),
    playerId: "blue-rerouted-player",
    playerSpawnNodes,
    playerSpawnSelection,
    playerTeamId: "blue"
  });

  assert.equal(reroutedBlueSpawn?.spawnId, "blue-base-b");
});
