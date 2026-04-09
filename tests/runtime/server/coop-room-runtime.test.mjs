import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoopBirdId,
  createCoopFireShotCommand,
  createCoopJoinRoomCommand,
  createCoopKickPlayerCommand,
  createCoopLeaveRoomCommand,
  createCoopPlayerId,
  createCoopRoomId,
  createCoopSessionId,
  createCoopSetPlayerReadyCommand,
  createCoopStartSessionCommand,
  createCoopSyncPlayerPresenceCommand,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";

import { CoopRoomRuntime } from "../../../server/dist/experiences/duck-hunt/classes/coop-room-runtime.js";

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
    playerInactivityTimeoutMs: createMilliseconds(250),
    rounds: {
      behaviorSpeedScalePerRound: 0.08,
      birdCountIncreasePerRound: 0,
      birdSpeedScalePerRound: 0,
      cooldownDurationMs: createMilliseconds(100),
      durationLossPerRoundMs: createMilliseconds(500),
      initialBirdCount: 2,
      initialDurationMs: createMilliseconds(10_000),
      minimumDurationMs: createMilliseconds(3_000)
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
  assert.throws(
    () =>
      runtime.acceptCommand(
        createCoopStartSessionCommand({
          playerId: playerOneId,
          roomId
        }),
        55
      ),
    /every connected lobby player must be ready/
  );

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
  assert.equal(activeSnapshot.session.roundNumber, 1);
  assert.equal(activeSnapshot.session.roundPhase, "combat");
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

  assert.equal(resolvedSnapshot.session.phase, "active");
  assert.equal(resolvedSnapshot.session.roundPhase, "cooldown");
  assert.equal(resolvedSnapshot.session.roundNumber, 1);
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

test("CoopRoomRuntime keeps tracked-reticle scatter moving in one direction until the bird settles", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      birds: [createBirdSeed("bird-1", "Bird 1", 0, 1.35)],
      reticleScatterRadius: 0.08
    })
  );
  const roomId = runtime.roomId;
  const playerId = requireValue(createCoopPlayerId("player-steady-aim"), "playerId");

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId,
      ready: true,
      roomId,
      username: requireValue(createUsername("echo"), "username")
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
        x: 0.02,
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

  const firstScatterSnapshot = runtime.advanceTo(50);

  runtime.acceptCommand(
    createCoopSyncPlayerPresenceCommand({
      aimDirection: {
        x: -0.02,
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
      stateSequence: 2,
      weaponId: "semiautomatic-pistol",
      yawRadians: 0
    }),
    60
  );

  const continuedScatterSnapshot = runtime.advanceTo(100);

  assert.equal(firstScatterSnapshot.birds[0]?.behavior, "scatter");
  assert.equal(continuedScatterSnapshot.birds[0]?.behavior, "scatter");
  assert.equal(firstScatterSnapshot.birds[0]?.lastInteractionTick, 1);
  assert.equal(continuedScatterSnapshot.birds[0]?.lastInteractionTick, 1);
  assert.ok(
    (continuedScatterSnapshot.birds[0]?.position.x ?? 0) <
      (firstScatterSnapshot.birds[0]?.position.x ?? 0)
  );
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
    createCoopStartSessionCommand({
      playerId: leaderId,
      roomId
    }),
    10
  );
  runtime.advanceTo(50);
  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: observerId,
      ready: false,
      roomId,
      username: requireValue(createUsername("charlie"), "charlieUsername")
    }),
    55
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

test("CoopRoomRuntime lets the party leader remove lobby players before start", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      requiredReadyPlayerCount: 2
    })
  );
  const roomId = runtime.roomId;
  const leaderId = requireValue(createCoopPlayerId("leader-1"), "leaderId");
  const removedPlayerId = requireValue(
    createCoopPlayerId("player-2"),
    "removedPlayerId"
  );

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: leaderId,
      ready: true,
      roomId,
      username: requireValue(createUsername("alpha"), "leaderUsername")
    }),
    0
  );
  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: removedPlayerId,
      ready: false,
      roomId,
      username: requireValue(createUsername("bravo"), "removedUsername")
    }),
    0
  );

  runtime.acceptCommand(
    createCoopKickPlayerCommand({
      playerId: leaderId,
      roomId,
      targetPlayerId: removedPlayerId
    }),
    20
  );

  const waitingSnapshot = runtime.advanceTo(50);

  assert.equal(waitingSnapshot.session.phase, "waiting-for-players");
  assert.equal(waitingSnapshot.players.length, 1);
  assert.equal(waitingSnapshot.players[0]?.playerId, leaderId);
});

test("CoopRoomRuntime auto-progresses into the next round after cooldown", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      birds: [createBirdSeed("bird-1", "Bird 1", 0, 1.35)],
      rounds: {
        behaviorSpeedScalePerRound: 0,
        birdCountIncreasePerRound: 0,
        birdSpeedScalePerRound: 0,
        cooldownDurationMs: createMilliseconds(50),
        durationLossPerRoundMs: createMilliseconds(0),
        initialBirdCount: 1,
        initialDurationMs: createMilliseconds(100),
        minimumDurationMs: createMilliseconds(100)
      }
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

  const cooldownSnapshot = runtime.advanceTo(100);
  const nextRoundSnapshot = runtime.advanceTo(150);

  assert.equal(cooldownSnapshot.session.roundNumber, 1);
  assert.equal(cooldownSnapshot.session.roundPhase, "cooldown");
  assert.equal(nextRoundSnapshot.session.roundNumber, 2);
  assert.equal(nextRoundSnapshot.session.roundPhase, "combat");
  assert.equal(nextRoundSnapshot.session.birdsRemaining, 1);
  assert.equal(nextRoundSnapshot.birds[0]?.behavior, "glide");
});

test("CoopRoomRuntime fails the session when round time expires before the bird-clear condition", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      birds: [createBirdSeed("bird-1", "Bird 1", 0, 1.35)],
      rounds: {
        behaviorSpeedScalePerRound: 0,
        birdCountIncreasePerRound: 0,
        birdSpeedScalePerRound: 0,
        cooldownDurationMs: createMilliseconds(50),
        durationLossPerRoundMs: createMilliseconds(0),
        initialBirdCount: 1,
        initialDurationMs: createMilliseconds(100),
        minimumDurationMs: createMilliseconds(100)
      }
    })
  );
  const roomId = runtime.roomId;
  const playerId = requireValue(createCoopPlayerId("player-timeout"), "playerId");

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId,
      ready: true,
      roomId,
      username: requireValue(createUsername("timeout"), "username")
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
  const failedSnapshot = runtime.advanceTo(150);
  const laterSnapshot = runtime.advanceTo(250);

  assert.equal(failedSnapshot.session.phase, "failed");
  assert.equal(failedSnapshot.session.roundNumber, 1);
  assert.equal(failedSnapshot.session.roundPhase, "combat");
  assert.equal(failedSnapshot.session.roundPhaseRemainingMs, 0);
  assert.equal(failedSnapshot.session.birdsRemaining, 1);
  assert.equal(laterSnapshot.session.phase, "failed");
  assert.equal(laterSnapshot.session.roundNumber, 1);
});

test("CoopRoomRuntime resolves later rounds from an authoritative round plan", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      birds: [
        createBirdSeed("bird-1", "Bird 1", 0, 1.35),
        createBirdSeed("bird-2", "Bird 2", 0.6, 2.1, -0.08, 0.06, 22)
      ],
      rounds: {
        behaviorSpeedScalePerRound: 0.5,
        birdCountIncreasePerRound: 1,
        birdSpeedScalePerRound: 0.5,
        cooldownDurationMs: createMilliseconds(50),
        durationLossPerRoundMs: createMilliseconds(0),
        initialBirdCount: 1,
        initialDurationMs: createMilliseconds(200),
        minimumDurationMs: createMilliseconds(200)
      }
    })
  );
  const roomId = runtime.roomId;
  const playerId = requireValue(createCoopPlayerId("player-round-plan"), "playerId");

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId,
      ready: true,
      roomId,
      username: requireValue(createUsername("planner"), "username")
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

  const roundOneClearSnapshot = runtime.advanceTo(100);
  const roundTwoStartSnapshot = runtime.advanceTo(150);

  runtime.acceptCommand(
    createCoopFireShotCommand({
      aimDirection: {
        x: 0,
        y: 0,
        z: -1
      },
      clientShotSequence: 2,
      origin: {
        x: 0,
        y: 1.35,
        z: 0
      },
      playerId,
      roomId
    }),
    160
  );

  const roundTwoHitSnapshot = runtime.advanceTo(200);

  assert.equal(roundOneClearSnapshot.session.roundPhase, "cooldown");
  assert.equal(roundOneClearSnapshot.birds.length, 1);
  assert.equal(roundOneClearSnapshot.session.birdsRemaining, 0);
  assert.equal(roundTwoStartSnapshot.session.roundNumber, 2);
  assert.equal(roundTwoStartSnapshot.session.roundPhase, "combat");
  assert.equal(roundTwoStartSnapshot.birds.length, 2);
  assert.equal(roundTwoStartSnapshot.session.birdsRemaining, 2);
  assert.equal(roundTwoHitSnapshot.session.roundNumber, 2);
  assert.equal(roundTwoHitSnapshot.birds.length, 2);
  assert.ok(
    (roundTwoHitSnapshot.birds[0]?.position.y ?? 0) <
      (roundOneClearSnapshot.birds[0]?.position.y ?? 0)
  );
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

test("CoopRoomRuntime prunes players that stop sending room heartbeats", () => {
  const runtime = new CoopRoomRuntime(
    createRuntimeConfig({
      playerInactivityTimeoutMs: createMilliseconds(100)
    })
  );
  const roomId = runtime.roomId;
  const playerId = requireValue(createCoopPlayerId("player-1"), "playerId");

  runtime.acceptCommand(
    createCoopJoinRoomCommand({
      playerId,
      ready: false,
      roomId,
      username: requireValue(createUsername("alpha"), "username")
    }),
    0
  );

  runtime.advanceTo(150);

  assert.equal(runtime.snapshot.players.length, 0);
});
