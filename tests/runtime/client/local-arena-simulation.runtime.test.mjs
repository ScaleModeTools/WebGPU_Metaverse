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
        glideVelocity: { x: 0, y: 0 },
        radius: 0.08,
        scale: 1,
        wingSpeed: 6
      }
    ],
    movement: {
      maxStepMs: 64,
      scatterDurationMs: 280,
      scatterSpeed: 0.22,
      downedDurationMs: 520,
      downedDriftVelocityY: 0.18
    },
    targeting: {
      acquireRadius: 0.1,
      hitRadius: 0.1,
      reticleScatterRadius: 0.14,
      shotScatterRadius: 0.2
    },
    weapon: {
      weaponId: "semiautomatic-pistol",
      pressThreshold: 0.055,
      releaseThreshold: 0.02,
      fireCooldownMs: 220,
      feedbackHoldMs: 280
    }
  };
}

function createTrackedSnapshot(sequenceNumber, x, y, thumbDrop = 0) {
  return {
    trackingState: "tracked",
    sequenceNumber,
    timestampMs: sequenceNumber * 10,
    pose: {
      thumbTip: {
        x,
        y: y + thumbDrop
      },
      indexTip: {
        x,
        y
      }
    }
  };
}

test("LocalArenaSimulation publishes calibrated aim, arena counts, and early scatter state", async () => {
  const { LocalArenaSimulation } = await clientLoader.load("/src/game/index.ts");
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );

  const snapshot = simulation.advance(createTrackedSnapshot(1, 0.25, 0.4), 0);

  assert.deepEqual(snapshot.aimPoint, { x: 0.25, y: 0.4 });
  assert.equal(snapshot.arena.liveEnemyCount, 1);
  assert.equal(snapshot.targetFeedback.state, "targeted");
  assert.equal(snapshot.targetFeedback.enemyLabel, "Bird 1");
  assert.equal(simulation.enemyRenderStates[0]?.behavior, "scatter");
});

test("LocalArenaSimulation enforces the semiautomatic trigger reset loop and local hit reaction", async () => {
  const { LocalArenaSimulation } = await clientLoader.load("/src/game/index.ts");
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );

  simulation.advance(createTrackedSnapshot(1, 0.25, 0.4), 0);

  const firedSnapshot = simulation.advance(
    createTrackedSnapshot(2, 0.25, 0.4, 0.08),
    16
  );

  assert.equal(firedSnapshot.weapon.shotsFired, 1);
  assert.equal(firedSnapshot.weapon.hitsLanded, 1);
  assert.equal(firedSnapshot.weapon.requiresTriggerReset, true);
  assert.equal(firedSnapshot.targetFeedback.state, "hit");
  assert.equal(firedSnapshot.targetFeedback.enemyLabel, "Bird 1");
  assert.equal(simulation.enemyRenderStates[0]?.behavior, "downed");

  const heldSnapshot = simulation.advance(
    createTrackedSnapshot(3, 0.25, 0.4, 0.08),
    48
  );

  assert.equal(heldSnapshot.weapon.shotsFired, 1);
  assert.equal(heldSnapshot.weapon.triggerHeld, true);

  const resetSnapshot = simulation.advance(
    createTrackedSnapshot(4, 0.25, 0.4),
    320
  );

  assert.equal(resetSnapshot.weapon.triggerHeld, false);
  assert.equal(resetSnapshot.weapon.isFireReady, true);
  assert.equal(resetSnapshot.weapon.hitsLanded, 1);
});
