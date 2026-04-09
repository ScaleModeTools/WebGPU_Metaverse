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
    birdAltitudeBounds: {
      min: 0.5,
      max: 6
    },
    camera: {
      initialPitchRadians: 0,
      initialYawRadians: 0,
      lookBounds: {
        maxPitchRadians: 1.2,
        minPitchRadians: -0.18
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
        orbitRadius: 18,
        spawn: {
          altitude: 1.35,
          azimuthRadians: 0
        },
        glideVelocity: {
          altitudeUnitsPerSecond: 0,
          azimuthRadiansPerSecond: 0.12
        },
        radius: 0.9,
        scale: 1,
        wingSpeed: 6
      },
      {
        id: "bird-2",
        label: "Bird 2",
        orbitRadius: 22,
        spawn: {
          altitude: 2.1,
          azimuthRadians: 0.7
        },
        glideVelocity: {
          altitudeUnitsPerSecond: 0.08,
          azimuthRadiansPerSecond: -0.1
        },
        radius: 0.85,
        scale: 1,
        wingSpeed: 7
      }
    ],
    feedback: {
      holdDurationMs: 280
    },
    movement: {
      maxStepMs: 64,
      downedDriftSpeed: 1.6,
      scatterDurationMs: 120,
      downedDurationMs: 220,
      downedFallSpeed: 4.6,
      scatterAltitudeSpeed: 1.8,
      scatterAngularSpeed: 0.5
    },
    session: {
      durationLossPerRoundMs: 500,
      minimumRoundDurationMs: 2_000,
      roundDurationMs: 4_000,
      scorePerKill: 100
    },
    targeting: {
      acquireRadius: 0.6,
      hitRadius: 0.42,
      reticleScatterRadius: 3.2,
      shotScatterRadius: 3.6
    },
    weapon: {
      weaponId: "semiautomatic-pistol",
      displayName: "Semiautomatic pistol",
      triggerMode: "single",
      triggerGesture: {
        pressAxisAngleDegrees: 68,
        pressEngagementRatio: 0.72,
        releaseAxisAngleDegrees: 72,
        releaseEngagementRatio: 0.95,
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
    "/src/experiences/duck-hunt/states/duck-hunt-local-arena-enemy-field.ts"
  );
  const config = createArenaConfig();
  const { enemyRuntimeStates } = enemyField.createEnemyField(config);
  const shotOrigin = { x: 0, y: 1.35, z: 0 };
  const shotDirection = { x: 0, y: 0, z: -1 };

  const targetedEnemy = enemyField.findNearestEnemyState(
    enemyRuntimeStates,
    shotOrigin,
    shotDirection,
    config.targeting.acquireRadius
  );

  assert.equal(targetedEnemy?.renderState.id, "bird-1");

  enemyField.applyReticleScatter(
    enemyRuntimeStates,
    config,
    shotOrigin,
    shotDirection
  );

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
  assert.equal(enemyRuntimeStates[0]?.downedVelocityX, 0);
  assert.equal(enemyRuntimeStates[0]?.downedVelocityY, 0);
  assert.equal(enemyField.countDownedEnemies(enemyRuntimeStates), 1);
  assert.equal(enemyField.summarizeEnemyField(enemyRuntimeStates).downedEnemyCount, 1);

  enemyField.resetEnemyField(enemyRuntimeStates, config);

  assert.equal(enemyRuntimeStates[0]?.renderState.behavior, "glide");
  assert.equal(enemyRuntimeStates[0]?.renderState.positionX, 0);
  assert.equal(enemyRuntimeStates[0]?.renderState.positionY, 1.35);
  assert.equal(enemyRuntimeStates[0]?.renderState.positionZ, -18);
  assert.equal(enemyField.countDownedEnemies(enemyRuntimeStates), 0);
});

test("local arena reticle scatter keeps its current escape direction until the scatter finishes", async () => {
  const enemyField = await clientLoader.load(
    "/src/experiences/duck-hunt/states/duck-hunt-local-arena-enemy-field.ts"
  );
  const config = createArenaConfig();
  const { enemyRuntimeStates } = enemyField.createEnemyField(config);
  const shotOrigin = { x: 0, y: 1.35, z: 0 };

  enemyField.applyReticleScatter(enemyRuntimeStates, config, shotOrigin, {
    x: 0.2,
    y: 0,
    z: -1
  });

  const firstScatterEnemy = enemyRuntimeStates[0];

  assert.equal(firstScatterEnemy?.renderState.behavior, "scatter");

  const firstAngularVelocity = firstScatterEnemy?.angularVelocity;
  const firstAltitudeVelocity = firstScatterEnemy?.altitudeVelocity;

  enemyField.applyReticleScatter(enemyRuntimeStates, config, shotOrigin, {
    x: -0.2,
    y: 0,
    z: -1
  });

  assert.equal(enemyRuntimeStates[0]?.angularVelocity, firstAngularVelocity);
  assert.equal(enemyRuntimeStates[0]?.altitudeVelocity, firstAltitudeVelocity);
});
