import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoopBirdId,
  createCoopFireShotCommand,
  createCoopJoinRoomCommand,
  createCoopLeaveRoomCommand,
  createCoopPlayerId,
  createCoopRoomId,
  createCoopSessionId,
  createCoopSetPlayerReadyCommand,
  createCoopStartSessionCommand,
  createCoopSyncPlayerPresenceCommand,
  createMilliseconds,
  createUsername
} from "@thumbshooter/shared";

import { CoopRoomRuntime } from "../../../server/dist/classes/coop-room-runtime.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function createBirdSeed(
  id,
  label,
  azimuthRadians,
  altitude,
  angularVelocity = 0,
  altitudeVelocity = 0,
  orbitRadius = 18
) {
  return {
    birdId: requireValue(createCoopBirdId(id), "birdId"),
    glideVelocity: {
      altitudeUnitsPerSecond: altitudeVelocity,
      azimuthRadiansPerSecond: angularVelocity
    },
    label,
    orbitRadius,
    radius: 0.9,
    scale: 1,
    spawn: {
      altitude,
      azimuthRadians
    },
    wingSpeed: 6
  };
}

function createRuntimeConfig(overrides = {}) {
  return {
    birdAltitudeBounds: {
      min: 0.5,
      max: 6
    },
    birds: [
      createBirdSeed("bird-1", "Bird 1", 0, 1.35),
      createBirdSeed("bird-2", "Bird 2", 0.65, 2.1, -0.08, 0.06, 22)
    ],
    capacity: 4,
    hitRadius: 0.42,
    movement: {
      downedDriftSpeed: 1.6,
      downedDurationMs: createMilliseconds(320),
      downedFallSpeed: 4.6,
      scatterAltitudeSpeed: 1.8,
      scatterAngularSpeed: 0.5,
      scatterDurationMs: createMilliseconds(180),
    },
    playerSpawnPosition: {
      x: 0,
      y: 1.35,
      z: 0
    },
    requiredReadyPlayerCount: 1,
    reticleScatterRadius: 0.72,
    roomId: requireValue(createCoopRoomId("harbor-room"), "roomId"),
    scatterRadius: 2.4,
    sessionId: requireValue(
      createCoopSessionId("harbor-room-session"),
      "sessionId"
    ),
    tickIntervalMs: createMilliseconds(50),
    ...overrides
  };
}

test("CoopRoomRuntime waits for enough ready players and an explicit leader start before activation", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      birds: [createBirdSeed("bird-1", "Bird 1", 0, 1.35)],
      requiredReadyPlayerCount: 2
    })
  );
  const roomId = runtime.roomId;
  const playerOneId = requireValue(createCoopPlayerId("player-1"), "playerOneId");
  const playerTwoId = requireValue(createCoopPlayerId("player-2"), "playerTwoId");

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: playerOneId,
      ready: true,
      roomId,
      username: requireValue(createUsername("alpha"), "username")
    }),
    0
  );
  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: playerTwoId,
      ready: false,
      roomId,
      username: requireValue(createUsername("bravo"), "username")
    }),
    0
  );

  const waitingSnapshot = runtime.advanceTo(50);

  assert.equal(waitingSnapshot.tick.currentTick, 1);
  assert.equal(waitingSnapshot.tick.owner, "server");
  assert.equal(waitingSnapshot.session.phase, "waiting-for-players");

  runtime.acceptCommand(
    createCoopSetPlayerReadyCommand({
      playerId: playerTwoId,
      ready: true,
      roomId
    }),
    60
  );

  const stillWaitingSnapshot = runtime.advanceTo(100);

  assert.equal(stillWaitingSnapshot.tick.currentTick, 2);
  assert.equal(stillWaitingSnapshot.session.phase, "waiting-for-players");

  runtime.acceptCommand(
    createCoopStartSessionCommand({
      playerId: playerOneId,
      roomId
    }),
    110
  );

  const activeSnapshot = runtime.advanceTo(150);

  assert.equal(activeSnapshot.tick.currentTick, 3);
  assert.equal(activeSnapshot.session.phase, "active");
  assert.equal(activeSnapshot.players.filter((player) => player.ready).length, 2);
  assert.equal(activeSnapshot.session.leaderPlayerId, playerOneId);
});

test("CoopRoomRuntime applies shared hits once per acknowledged client shot sequence", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      birds: [createBirdSeed("bird-1", "Bird 1", 0, 1.35)]
    })
  );
  const roomId = runtime.roomId;
  const playerId = requireValue(createCoopPlayerId("player-1"), "playerId");

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId,
      ready: true,
      roomId,
      username: requireValue(createUsername("alpha"), "username")
    }),
    0
  );
  runtime.acceptCommand(
    createCoopStartSessionCommand({
      playerId,
      roomId
    }),
    10
  );
  runtime.advanceTo(50);
  runtime.acceptCommand(
    createCoopFireShotCommand({
      aimDirection: {
        x: 0,
        y: 0,
        z: -1
      },
      clientShotSequence: 1,
      origin: {
        x: 0,
        y: 1.35,
        z: 0
      },
      playerId,
      roomId
    }),
    60
  );
  runtime.acceptCommand(
    createCoopFireShotCommand({
      aimDirection: {
        x: 0,
        y: 0,
        z: -1
      },
      clientShotSequence: 1,
      origin: {
        x: 0,
        y: 1.35,
        z: 0
      },
      playerId,
      roomId
    }),
    65
  );

  const resolvedSnapshot = runtime.advanceTo(100);
  const playerSnapshot = resolvedSnapshot.players[0];
  const birdSnapshot = resolvedSnapshot.birds[0];

  assert.equal(resolvedSnapshot.session.phase, "completed");
  assert.equal(resolvedSnapshot.session.teamShotsFired, 1);
  assert.equal(resolvedSnapshot.session.teamHitsLanded, 1);
  assert.equal(playerSnapshot?.activity.shotsFired, 1);
  assert.equal(playerSnapshot?.activity.hitsLanded, 1);
  assert.equal(playerSnapshot?.activity.lastAcknowledgedShotSequence, 1);
  assert.equal(playerSnapshot?.activity.lastOutcome, "hit");
  assert.equal(birdSnapshot?.behavior, "downed");
  assert.equal(birdSnapshot?.lastInteractionByPlayerId, playerId);
  assert.equal(birdSnapshot?.lastInteractionTick, 2);
});

test("CoopRoomRuntime records scatter outcomes against the shared bird field", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      hitRadius: 0.03,
      scatterRadius: 2.4
    })
  );
  const roomId = runtime.roomId;
  const playerId = requireValue(createCoopPlayerId("player-9"), "playerId");

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId,
      ready: true,
      roomId,
      username: requireValue(createUsername("charlie"), "username")
    }),
    0
  );
  runtime.acceptCommand(
    createCoopStartSessionCommand({
      playerId,
      roomId
    }),
    10
  );
  runtime.advanceTo(50);
  runtime.acceptCommand(
    createCoopFireShotCommand({
      aimDirection: {
        x: 0.08,
        y: 0,
        z: -1
      },
      clientShotSequence: 3,
      origin: {
        x: 0,
        y: 1.35,
        z: 0
      },
      playerId,
      roomId
    }),
    60
  );

  const scatterSnapshot = runtime.advanceTo(100);
  const playerSnapshot = scatterSnapshot.players[0];
  const scatteredBird = scatterSnapshot.birds.find(
    (bird) => bird.lastInteractionByPlayerId === playerId
  );

  assert.equal(scatterSnapshot.session.phase, "active");
  assert.equal(scatterSnapshot.session.teamShotsFired, 1);
  assert.equal(scatterSnapshot.session.teamHitsLanded, 0);
  assert.equal(playerSnapshot?.activity.lastOutcome, "scatter");
  assert.equal(playerSnapshot?.activity.scatterEventsCaused, 1);
  assert.equal(scatteredBird?.behavior, "scatter");
  assert.equal(scatteredBird?.lastInteractionTick, 2);
});

test("CoopRoomRuntime scatters shared birds from synced reticle presence without consuming shots", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      birds: [createBirdSeed("bird-1", "Bird 1", 0, 1.35)],
      reticleScatterRadius: 0.08
    })
  );
  const roomId = runtime.roomId;
  const playerId = requireValue(createCoopPlayerId("player-aim"), "playerId");

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId,
      ready: true,
      roomId,
      username: requireValue(createUsername("delta"), "username")
    }),
    0
  );
  runtime.acceptCommand(
    createCoopStartSessionCommand({
      playerId,
      roomId
    }),
    10
  );
  runtime.acceptCommand(
    createCoopSyncPlayerPresenceCommand({
      aimDirection: {
        x: 0,
        y: 0,
        z: -1
      },
      pitchRadians: 0,
      playerId,
      position: {
        x: 0,
        y: 1.35,
        z: 0
      },
      roomId,
      stateSequence: 1,
      weaponId: "semiautomatic-pistol",
      yawRadians: 0
    }),
    20
  );

  const scatterSnapshot = runtime.advanceTo(50);

  assert.equal(scatterSnapshot.session.phase, "active");
  assert.equal(scatterSnapshot.session.teamShotsFired, 0);
  assert.equal(scatterSnapshot.birds[0]?.behavior, "scatter");
  assert.equal(scatterSnapshot.birds[0]?.lastInteractionByPlayerId, playerId);
});

test("CoopRoomRuntime blocks non-ready observers from affecting an active session", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      birds: [createBirdSeed("bird-1", "Bird 1", 0, 1.35)],
      requiredReadyPlayerCount: 2
    })
  );
  const roomId = runtime.roomId;
  const leaderId = requireValue(createCoopPlayerId("leader-1"), "leaderId");
  const readyPlayerId = requireValue(createCoopPlayerId("player-2"), "readyPlayerId");
  const observerId = requireValue(createCoopPlayerId("observer-3"), "observerId");

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: leaderId,
      ready: true,
      roomId,
      username: requireValue(createUsername("alpha"), "alphaUsername")
    }),
    0
  );
  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: readyPlayerId,
      ready: true,
      roomId,
      username: requireValue(createUsername("bravo"), "bravoUsername")
    }),
    0
  );
  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: observerId,
      ready: false,
      roomId,
      username: requireValue(createUsername("charlie"), "charlieUsername")
    }),
    0
  );
  runtime.acceptCommand(
    createCoopStartSessionCommand({
      playerId: leaderId,
      roomId
    }),
    10
  );
  runtime.advanceTo(50);
  runtime.acceptCommand(
    createCoopFireShotCommand({
      aimDirection: {
        x: 0,
        y: 0,
        z: -1
      },
      clientShotSequence: 1,
      origin: {
        x: 0,
        y: 1.35,
        z: 0
      },
      playerId: observerId,
      roomId
    }),
    60
  );

  const observerSnapshot = runtime.advanceTo(100);
  const observerPlayer = observerSnapshot.players.find(
    (playerSnapshot) => playerSnapshot.playerId === observerId
  );

  assert.equal(observerSnapshot.session.phase, "active");
  assert.equal(observerSnapshot.session.teamShotsFired, 0);
  assert.equal(observerPlayer?.activity.shotsFired, 0);
  assert.equal(observerSnapshot.birds[0]?.behavior, "glide");
});

test("CoopRoomRuntime removes room leavers from snapshots before and after activation", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      birds: [createBirdSeed("bird-1", "Bird 1", 0, 1.35)],
      requiredReadyPlayerCount: 2
    })
  );
  const roomId = runtime.roomId;
  const playerOneId = requireValue(createCoopPlayerId("player-1"), "playerOneId");
  const playerTwoId = requireValue(createCoopPlayerId("player-2"), "playerTwoId");

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: playerOneId,
      ready: true,
      roomId,
      username: requireValue(createUsername("alpha"), "username")
    }),
    0
  );
  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: playerTwoId,
      ready: false,
      roomId,
      username: requireValue(createUsername("bravo"), "username")
    }),
    0
  );
  runtime.acceptCommand(
    createCoopLeaveRoomCommand({
      playerId: playerTwoId,
      roomId
    }),
    10
  );

  const waitingSnapshot = runtime.advanceTo(50);

  assert.equal(waitingSnapshot.session.phase, "waiting-for-players");
  assert.equal(waitingSnapshot.players.length, 1);

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: playerTwoId,
      ready: true,
      roomId,
      username: requireValue(createUsername("bravo"), "username")
    }),
    60
  );
  runtime.acceptCommand(
    createCoopStartSessionCommand({
      playerId: playerOneId,
      roomId
    }),
    70
  );

  const activeSnapshot = runtime.advanceTo(120);

  assert.equal(activeSnapshot.session.phase, "active");

  runtime.acceptCommand(
    createCoopLeaveRoomCommand({
      playerId: playerTwoId,
      roomId
    }),
    130
  );

  const disconnectedSnapshot = runtime.advanceTo(150);
  const disconnectedPlayer = disconnectedSnapshot.players.find(
    (playerSnapshot) => playerSnapshot.playerId === playerTwoId
  );

  assert.equal(disconnectedPlayer, undefined);
  assert.equal(disconnectedSnapshot.players.length, 1);
  assert.equal(disconnectedSnapshot.session.phase, "active");
});
