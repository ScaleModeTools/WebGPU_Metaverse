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
    session: {
      roundDurationMs: 4_000,
      scorePerKill: 100
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
  assert.equal(snapshot.session.phase, "active");
  assert.equal(snapshot.targetFeedback.state, "targeted");
  assert.equal(snapshot.targetFeedback.enemyLabel, "Bird 1");
  assert.equal(simulation.enemyRenderStates[0]?.behavior, "scatter");
});

test("LocalArenaSimulation completes the round on a kill and reset starts a fresh session", async () => {
  const { LocalArenaSimulation } = await clientLoader.load("/src/game/index.ts");
  const emittedSignals = [];
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig(),
    {
      emitGameplaySignal(signal) {
        emittedSignals.push(signal);
      }
    }
  );

  simulation.advance(createTrackedSnapshot(1, 0.25, 0.4), 0);

  const firedSnapshot = simulation.advance(
    createTrackedSnapshot(2, 0.25, 0.4, 0.08),
    16
  );

  assert.equal(firedSnapshot.weapon.shotsFired, 1);
  assert.equal(firedSnapshot.weapon.hitsLanded, 1);
  assert.equal(firedSnapshot.session.score, 100);
  assert.equal(firedSnapshot.session.killsThisSession, 1);
  assert.equal(firedSnapshot.session.streak, 1);
  assert.equal(firedSnapshot.session.phase, "completed");
  assert.equal(firedSnapshot.session.restartReady, true);
  assert.equal(firedSnapshot.targetFeedback.state, "hit");
  assert.equal(firedSnapshot.targetFeedback.enemyLabel, "Bird 1");
  assert.deepEqual(emittedSignals, [
    {
      type: "weapon-fired",
      weaponId: "semiautomatic-pistol"
    }
  ]);
  assert.equal(simulation.enemyRenderStates[0]?.behavior, "downed");

  const postCompletionSnapshot = simulation.advance(
    createTrackedSnapshot(3, 0.25, 0.4, 0.08),
    1_200
  );

  assert.equal(postCompletionSnapshot.weapon.shotsFired, 1);
  assert.equal(simulation.enemyRenderStates[0]?.behavior, "downed");

  simulation.reset();

  const resetSnapshot = simulation.hudSnapshot;

  assert.equal(resetSnapshot.session.phase, "active");
  assert.equal(resetSnapshot.session.score, 0);
  assert.equal(resetSnapshot.session.killsThisSession, 0);
  assert.equal(resetSnapshot.arena.liveEnemyCount, 1);
  assert.equal(resetSnapshot.weapon.triggerHeld, false);
  assert.equal(resetSnapshot.weapon.hitsLanded, 0);
});
