import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createCoopPlayerId,
  createCoopRoomId,
  createCoopRoomSnapshot,
  createCoopSessionId,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";
import { createTrackedHandSnapshot } from "./tracked-hand-pose-fixture.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createRoomSnapshot({
  playerId,
  roomId,
  sessionId,
  tick,
  phase = "active",
  roundPhase = "combat",
  roundPhaseRemainingMs = 0,
  playerHits = 0,
  playerShots = 0,
  lastAcknowledgedShotSequence = 0,
  lastOutcome = null,
  birdBehavior = "glide",
  birdPositionX = 0,
  birdPositionY = 2.8,
  birdPositionZ = -18,
  birdWingPhase = tick * 0.3
}) {
  return createCoopRoomSnapshot({
    birds: [
      {
        behavior: birdBehavior,
        birdId: "shared-bird-1",
        headingRadians: 0,
        label: "Shared Bird 1",
        position: {
          x: birdPositionX,
          y: birdPositionY,
          z: birdPositionZ
        },
        radius: 0.9,
        scale: 1,
        visible: true,
        wingPhase: birdWingPhase
      }
    ],
    capacity: 4,
    players: [
      {
        activity: {
          hitsLanded: playerHits,
          lastAcknowledgedShotSequence,
          lastHitBirdId: playerHits > 0 ? "shared-bird-1" : null,
          lastOutcome,
          lastShotTick: lastAcknowledgedShotSequence > 0 ? tick : null,
          scatterEventsCaused: lastOutcome === "scatter" ? 1 : 0,
          shotsFired: playerShots
        },
        connected: true,
        playerId,
        presence: {
          aimDirection: {
            x: 0,
            y: 0,
            z: -1
          },
          pitchRadians: 0,
          position: {
            x: 0,
            y: 1.35,
            z: 0
          },
          weaponId: "semiautomatic-pistol",
          yawRadians: 0
        },
        ready: true,
        username: "coop-user"
      }
    ],
    roomId,
    session: {
      birdsCleared: birdBehavior === "downed" ? 1 : 0,
      birdsRemaining: birdBehavior === "downed" ? 0 : 1,
      phase,
      roundPhase,
      roundPhaseRemainingMs,
      requiredReadyPlayerCount: 2,
      sessionId,
      teamHitsLanded: playerHits,
      teamShotsFired: playerShots
    },
    tick: {
      currentTick: tick,
      tickIntervalMs: 50
    }
  });
}

test("CoopArenaSimulation projects authoritative birds and confirms hits from room snapshots", async () => {
  const {
    DuckHuntCoopArenaSimulation: CoopArenaSimulation
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const roomId = createCoopRoomId("co-op-harbor");
  const sessionId = createCoopSessionId("co-op-harbor-session-1");
  const playerId = createCoopPlayerId("coop-player-1");
  const username = createUsername("coop-user");

  assert.notEqual(roomId, null);
  assert.notEqual(sessionId, null);
  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const firedShots = [];
  const emittedSignals = [];
  const roomSource = {
    roomId,
    roomSnapshot: createRoomSnapshot({
      playerId,
      roomId,
      sessionId,
      tick: 0
    }),
    fireShot(origin, aimDirection) {
      firedShots.push({
        aimDirection,
        origin
      });
    },
    syncPlayerPresence() {
      // Presence sync is exercised through the room client runtime tests.
    }
  };
  const simulation = new CoopArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    roomSource,
    undefined,
    {
      emitGameplaySignal(signal) {
        emittedSignals.push(signal);
      },
      playerId
    }
  );

  const targetedSnapshot = simulation.advance(
    createTrackedHandSnapshot(1, 0.5, 0.5),
    0
  );

  assert.equal(targetedSnapshot.session.mode, "co-op");
  assert.equal(targetedSnapshot.session.phase, "active");
  assert.equal(targetedSnapshot.targetFeedback.state, "targeted");
  assert.equal(simulation.enemyRenderStates[0]?.behavior, "glide");

  const firedSnapshot = simulation.advance(
    createTrackedHandSnapshot(2, 0.5, 0.5, 1),
    16
  );

  assert.equal(firedSnapshot.weapon.shotsFired, 1);
  assert.equal(firedShots.length, 1);
  assert.deepEqual(emittedSignals, [
    {
      type: "weapon-fired",
      weaponId: "semiautomatic-pistol"
    }
  ]);

  roomSource.roomSnapshot = createRoomSnapshot({
    playerId,
    roomId,
    sessionId,
    tick: 1,
    playerHits: 1,
    playerShots: 1,
    lastAcknowledgedShotSequence: 1,
    lastOutcome: "hit",
    birdBehavior: "downed"
  });

  const resolvedSnapshot = simulation.advance(
    createTrackedHandSnapshot(3, 0.5, 0.5),
    64
  );

  assert.equal(resolvedSnapshot.weapon.hitsLanded, 1);
  assert.equal(resolvedSnapshot.targetFeedback.state, "hit");
  assert.equal(simulation.enemyRenderStates[0]?.behavior, "downed");
  assert.equal(simulation.worldTimeMs, 50);
  assert.deepEqual(emittedSignals, [
    {
      type: "weapon-fired",
      weaponId: "semiautomatic-pistol"
    },
    {
      enemyId: "shared-bird-1",
      type: "enemy-hit-confirmed"
    }
  ]);
});

test("CoopArenaSimulation projects authoritative birds forward between shared room ticks", async () => {
  const {
    DuckHuntCoopArenaSimulation: CoopArenaSimulation
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const roomId = createCoopRoomId("co-op-harbor");
  const sessionId = createCoopSessionId("co-op-harbor-session-1");
  const playerId = createCoopPlayerId("coop-player-1");

  assert.notEqual(roomId, null);
  assert.notEqual(sessionId, null);
  assert.notEqual(playerId, null);

  const roomSource = {
    roomId,
    roomSnapshot: createRoomSnapshot({
      playerId,
      roomId,
      sessionId,
      tick: 0,
      birdPositionZ: -18,
      birdWingPhase: 0
    }),
    fireShot() {},
    syncPlayerPresence() {}
  };
  const simulation = new CoopArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    roomSource,
    undefined,
    {
      playerId
    }
  );

  simulation.advance(createTrackedHandSnapshot(1, 0.5, 0.5), 0);

  roomSource.roomSnapshot = createRoomSnapshot({
    playerId,
    roomId,
    sessionId,
    tick: 1,
    birdPositionZ: -17,
    birdWingPhase: 0.3
  });

  simulation.advance(createTrackedHandSnapshot(2, 0.5, 0.5), 50);

  const projectedSnapshot = simulation.advance(
    createTrackedHandSnapshot(3, 0.5, 0.5),
    75
  );

  assert.equal(projectedSnapshot.session.phase, "active");
  assert.ok((simulation.enemyRenderStates[0]?.positionZ ?? 0) > -17);
  assert.ok((simulation.enemyRenderStates[0]?.positionZ ?? 0) < -16.4);
  assert.ok((simulation.enemyRenderStates[0]?.wingPhase ?? 0) > 0.3);
});

test("CoopArenaSimulation keeps the camera fixed while the round is not in combat", async () => {
  const {
    DuckHuntCoopArenaSimulation: CoopArenaSimulation
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const roomId = createCoopRoomId("co-op-harbor");
  const sessionId = createCoopSessionId("co-op-harbor-session-1");
  const playerId = createCoopPlayerId("coop-player-1");

  assert.notEqual(roomId, null);
  assert.notEqual(sessionId, null);
  assert.notEqual(playerId, null);

  const roomSource = {
    roomId,
    roomSnapshot: createRoomSnapshot({
      playerId,
      roomId,
      sessionId,
      tick: 0,
      phase: "active",
      roundPhase: "combat"
    }),
    fireShot() {},
    syncPlayerPresence() {}
  };
  const simulation = new CoopArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    roomSource,
    undefined,
    {
      playerId
    }
  );

  simulation.advance(
    createTrackedHandSnapshot(1, 0.5, 0.5),
    0,
    { width: 1280, height: 720 }
  );
  simulation.advance(
    createTrackedHandSnapshot(2, 0.92, 0.5),
    50,
    { width: 1280, height: 720 }
  );

  assert.ok(simulation.cameraSnapshot.yawRadians > 0.02);

  const yawBeforeCooldownAdvance = simulation.cameraSnapshot.yawRadians;
  const pitchBeforeCooldownAdvance = simulation.cameraSnapshot.pitchRadians;

  roomSource.roomSnapshot = createRoomSnapshot({
    playerId,
    roomId,
    sessionId,
    tick: 2,
    phase: "active",
    roundPhase: "cooldown",
    roundPhaseRemainingMs: 1_500
  });

  const cooldownSnapshot = simulation.advance(
    createTrackedHandSnapshot(3, 0.08, 0.12),
    100,
    { width: 1280, height: 720 }
  );

  assert.equal(cooldownSnapshot.session.phase, "active");
  assert.equal(cooldownSnapshot.session.roundPhase, "cooldown");
  assert.equal(simulation.cameraSnapshot.yawRadians, yawBeforeCooldownAdvance);
  assert.equal(simulation.cameraSnapshot.pitchRadians, pitchBeforeCooldownAdvance);
});
