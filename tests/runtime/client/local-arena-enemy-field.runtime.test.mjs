import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createArenaConfig() {
  return {
    arenaBounds: {
      minX: 0.05,
      maxX: 0.95,
      minY: 0.05,
      maxY: 0.95
    },
    enemySeeds: [
      {
        id: "bird-1",
        label: "Bird 1",
        spawn: { x: 0.25, y: 0.4 },
        glideVelocity: { x: 0.1, y: 0 },
        radius: 0.08,
        scale: 1,
        wingSpeed: 6
      },
      {
        id: "bird-2",
        label: "Bird 2",
        spawn: { x: 0.7, y: 0.7 },
        glideVelocity: { x: -0.08, y: 0.02 },
        radius: 0.08,
        scale: 1,
        wingSpeed: 7
      }
    ],
    feedback: {
      holdDurationMs: 280
    },
    movement: {
      maxStepMs: 64,
      scatterDurationMs: 120,
      scatterSpeed: 0.22,
      downedDurationMs: 220,
      downedDriftVelocityY: 0.18
    },
    session: {
      roundDurationMs: 4_000,
      scorePerKill: 100
    },
    targeting: {
      acquireRadius: 0.12,
      hitRadius: 0.1,
      reticleScatterRadius: 0.14,
      shotScatterRadius: 0.2
    },
    weapon: {
      weaponId: "semiautomatic-pistol",
      displayName: "Semiautomatic pistol",
      triggerMode: "single",
      triggerGesture: {
        pressAxisAngleDegrees: 26,
        pressEngagementRatio: 0.72,
        releaseAxisAngleDegrees: 32,
        releaseEngagementRatio: 0.92,
        calibration: {
          pressAxisWindowFraction: 0.4,
          pressEngagementWindowFraction: 0.4,
          releaseAxisWindowFraction: 0.82,
          releaseEngagementWindowFraction: 0.82
        }
      },
      cadence: {
        shotIntervalMs: 220
      },
      reload: {
        clipCapacity: 6,
        durationMs: 240,
        rule: "reticle-offscreen"
      },
      spread: {
        baseRadius: 0,
        maxRadius: 0.02,
        sprayGrowthPerShot: 0.0025,
        sprayRecoveryPerSecond: 6
      }
    }
  };
}

test("local arena enemy field keeps targeting and motion behavior on typed submodules", async () => {
  const enemyField = await clientLoader.load(
    "/src/game/states/local-arena-enemy-field.ts"
  );
  const config = createArenaConfig();
  const { enemyRuntimeStates } = enemyField.createEnemyField(config);

  const targetedEnemy = enemyField.findNearestEnemyState(
    enemyRuntimeStates,
    0.26,
    0.4,
    config.targeting.acquireRadius
  );

  assert.equal(targetedEnemy?.renderState.id, "bird-1");

  enemyField.applyReticleScatter(enemyRuntimeStates, config, 0.25, 0.4);

  assert.equal(enemyRuntimeStates[0]?.renderState.behavior, "scatter");

  enemyField.stepEnemyField(
    enemyRuntimeStates,
    config,
    config.movement.scatterDurationMs + 1
  );

  assert.equal(enemyRuntimeStates[0]?.renderState.behavior, "glide");

  enemyField.setEnemyDowned(enemyRuntimeStates[0], config);
  enemyField.stepEnemyField(
    enemyRuntimeStates,
    config,
    config.movement.downedDurationMs + 1
  );

  assert.equal(enemyRuntimeStates[0]?.renderState.behavior, "downed");
  assert.equal(enemyRuntimeStates[0]?.velocityX, 0);
  assert.equal(enemyRuntimeStates[0]?.velocityY, 0);
  assert.equal(enemyField.countDownedEnemies(enemyRuntimeStates), 1);
  assert.equal(enemyField.summarizeEnemyField(enemyRuntimeStates).downedEnemyCount, 1);

  enemyField.resetEnemyField(enemyRuntimeStates, config);

  assert.equal(enemyRuntimeStates[0]?.renderState.behavior, "glide");
  assert.equal(enemyRuntimeStates[0]?.renderState.positionX, 0.25);
  assert.equal(enemyRuntimeStates[0]?.renderState.positionY, 0.4);
  assert.equal(enemyField.countDownedEnemies(enemyRuntimeStates), 0);
});
