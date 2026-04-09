import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoopBirdId,
  createCoopFireShotCommand,
  createCoopKickPlayerCommand,
  createCoopLeaveRoomCommand,
  createCoopRoomDirectorySnapshot,
  createCoopPlayerId,
  createCoopRoomId,
  createCoopRoomSnapshot,
  createCoopSessionId,
  createCoopStartSessionCommand,
  createUsername
} from "@webgpu-metaverse/shared";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

test("co-op ids trim surrounding whitespace and reject blanks", () => {
  assert.equal(createCoopRoomId("   "), null);
  assert.equal(createCoopPlayerId(""), null);
  assert.equal(createCoopBirdId("\n\t"), null);
  assert.equal(createCoopSessionId("   "), null);
  assert.equal(createCoopRoomId("  harbor-room  "), "harbor-room");
  assert.equal(createCoopPlayerId("  player-7 "), "player-7");
});

test("createCoopRoomSnapshot clones nested arrays and normalizes hot snapshot values", () => {
  const roomId = requireValue(createCoopRoomId("harbor-room"), "roomId");
  const sessionId = requireValue(
    createCoopSessionId("harbor-room-session"),
    "sessionId"
  );
  const birdId = requireValue(createCoopBirdId("bird-1"), "birdId");
  const playerId = requireValue(createCoopPlayerId("player-1"), "playerId");
  const username = requireValue(createUsername("coop-player"), "username");
  const input = {
    birds: [
      {
        behavior: "scatter",
        birdId,
        headingRadians: Number.POSITIVE_INFINITY,
        label: "Bird 1",
        lastInteractionByPlayerId: playerId,
        lastInteractionTick: 12.7,
        position: {
          x: 1.4,
          y: -2,
          z: Number.NaN
        },
        radius: -5,
        scale: 1.15,
        visible: true,
        wingPhase: Number.NaN
      }
    ],
    capacity: 0,
    players: [
      {
        activity: {
          hitsLanded: 1.8,
          lastAcknowledgedShotSequence: 4.9,
          lastHitBirdId: birdId,
          lastOutcome: "hit",
          lastShotTick: 8.2,
          scatterEventsCaused: 2.4,
          shotsFired: 5.6
        },
        connected: true,
        playerId,
        presence: {
          aimDirection: {
            x: 0,
            y: 0,
            z: -5
          },
          pitchRadians: Number.NaN,
          position: {
            x: 0,
            y: 1.35,
            z: 0
          },
          stateSequence: 2.6,
          weaponId: "  ",
          yawRadians: Number.POSITIVE_INFINITY
        },
        ready: true,
        username
      }
    ],
    roomId,
    session: {
      birdsCleared: 1.2,
      birdsRemaining: 3.9,
      phase: "active",
      roundDurationMs: 9_999.8,
      roundNumber: 3.6,
      roundPhase: "cooldown",
      roundPhaseRemainingMs: 1_249.4,
      requiredReadyPlayerCount: 0,
      sessionId,
      teamHitsLanded: 1.1,
      teamShotsFired: 5.8
    },
    tick: {
      currentTick: 19.9,
      tickIntervalMs: 50.4
    }
  };

  const snapshot = createCoopRoomSnapshot(input);

  input.birds[0].position.x = 0.2;
  input.players[0].activity.shotsFired = 99;

  assert.equal(snapshot.capacity, 1);
  assert.equal(snapshot.tick.owner, "server");
  assert.equal(snapshot.tick.currentTick, 19);
  assert.equal(snapshot.tick.tickIntervalMs, 50.4);
  assert.deepEqual(snapshot.birds[0]?.position, {
    x: 1.4,
    y: -2,
    z: 0
  });
  assert.equal(snapshot.birds[0]?.radius, 0);
  assert.equal(snapshot.birds[0]?.wingPhase, 0);
  assert.equal(snapshot.players[0]?.activity.lastAcknowledgedShotSequence, 4);
  assert.equal(snapshot.players[0]?.activity.shotsFired, 5);
  assert.equal(snapshot.players[0]?.presence.stateSequence, 2);
  assert.equal(snapshot.players[0]?.presence.weaponId, "semiautomatic-pistol");
  assert.equal(snapshot.session.roundDurationMs, 9_999.8);
  assert.equal(snapshot.session.roundNumber, 3);
  assert.equal(snapshot.session.roundPhase, "cooldown");
  assert.equal(snapshot.session.roundPhaseRemainingMs, 1_249.4);
  assert.equal(snapshot.session.requiredReadyPlayerCount, 1);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.birds), true);
  assert.equal(Object.isFrozen(snapshot.players), true);
});

test("createCoopFireShotCommand normalizes shot rays and floors client shot sequences", () => {
  const command = createCoopFireShotCommand({
    aimDirection: {
      x: 2.4,
      y: -0.4,
      z: -2.4
    },
    clientShotSequence: 7.8,
    origin: {
      x: 3,
      y: 1.35,
      z: 2
    },
    playerId: requireValue(createCoopPlayerId("player-2"), "playerId"),
    roomId: requireValue(createCoopRoomId("harbor-room"), "roomId")
  });

  assert.equal(command.type, "fire-shot");
  assert.equal(command.clientShotSequence, 7);
  assert.equal(command.origin.x, 3);
  assert.equal(command.origin.y, 1.35);
  assert.equal(command.origin.z, 2);
  assert.ok(Math.abs(Math.hypot(
    command.aimDirection.x,
    command.aimDirection.y,
    command.aimDirection.z
  ) - 1) < 0.000001);
});

test("createCoopLeaveRoomCommand preserves player identity for explicit disconnects", () => {
  const command = createCoopLeaveRoomCommand({
    playerId: requireValue(createCoopPlayerId("player-8"), "playerId"),
    roomId: requireValue(createCoopRoomId("harbor-room"), "roomId")
  });

  assert.equal(command.type, "leave-room");
  assert.equal(command.playerId, "player-8");
});

test("createCoopStartSessionCommand preserves the party leader identity", () => {
  const command = createCoopStartSessionCommand({
    playerId: requireValue(createCoopPlayerId("player-leader"), "playerId"),
    roomId: requireValue(createCoopRoomId("harbor-room"), "roomId")
  });

  assert.equal(command.type, "start-session");
  assert.equal(command.playerId, "player-leader");
});

test("createCoopKickPlayerCommand preserves both actor and target identities", () => {
  const command = createCoopKickPlayerCommand({
    playerId: requireValue(createCoopPlayerId("player-leader"), "playerId"),
    roomId: requireValue(createCoopRoomId("harbor-room"), "roomId"),
    targetPlayerId: requireValue(
      createCoopPlayerId("player-target"),
      "targetPlayerId"
    )
  });

  assert.equal(command.type, "kick-player");
  assert.equal(command.playerId, "player-leader");
  assert.equal(command.targetPlayerId, "player-target");
});

test("createCoopRoomDirectorySnapshot normalizes live room summaries", () => {
  const directorySnapshot = createCoopRoomDirectorySnapshot({
    coOpRooms: [
      {
        birdsRemaining: 2.8,
        capacity: 0,
        connectedPlayerCount: 2.6,
        phase: "waiting-for-players",
        readyPlayerCount: 1.9,
        roundNumber: 4.2,
        roundPhase: "cooldown",
        roundPhaseRemainingMs: 850.5,
        requiredReadyPlayerCount: 0,
        roomId: requireValue(createCoopRoomId("harbor-room"), "roomId"),
        sessionId: requireValue(
          createCoopSessionId("harbor-room-session"),
          "sessionId"
        ),
        tick: 7.4
      }
    ]
  });

  assert.equal(directorySnapshot.coOpRooms[0]?.capacity, 1);
  assert.equal(directorySnapshot.coOpRooms[0]?.connectedPlayerCount, 2);
  assert.equal(directorySnapshot.coOpRooms[0]?.readyPlayerCount, 1);
  assert.equal(directorySnapshot.coOpRooms[0]?.roundNumber, 4);
  assert.equal(directorySnapshot.coOpRooms[0]?.roundPhase, "cooldown");
  assert.equal(directorySnapshot.coOpRooms[0]?.roundPhaseRemainingMs, 850.5);
  assert.equal(directorySnapshot.coOpRooms[0]?.requiredReadyPlayerCount, 1);
  assert.equal(directorySnapshot.coOpRooms[0]?.tick, 7);
  assert.equal(directorySnapshot.service, "webgpu-metaverse-server");
  assert.equal(Object.isFrozen(directorySnapshot.coOpRooms), true);
});
