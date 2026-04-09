import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createCoopPlayerId,
  createCoopRoomId,
  createCoopRoomSnapshotEvent,
  createCoopSessionId,
  createMilliseconds,
  createUsername
} from "@thumbshooter/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createJsonResponse(ok, payload) {
  return {
    ok,
    async json() {
      return payload;
    }
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function createRoomSnapshotEvent({
  playerId,
  roomId,
  sessionId,
  tick,
  phase = "active",
  playerHits = 0,
  playerShots = 0,
  lastAcknowledgedShotSequence = 0,
  lastOutcome = null,
  birdBehavior = "glide"
}) {
  return createCoopRoomSnapshotEvent({
    birds: [
      {
        behavior: birdBehavior,
        birdId: "shared-bird-1",
        headingRadians: 0,
        label: "Shared Bird 1",
        position: {
          x: 0,
          y: 1.35,
          z: -18
        },
        radius: 0.9,
        scale: 1,
        visible: true,
        wingPhase: tick * 0.4
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
      leaderPlayerId: playerId,
      phase,
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

test("CoopRoomClient joins, polls shared snapshots, and posts fire-shot commands", async () => {
  const { CoopRoomClient } = await clientLoader.load("/src/network/index.ts");
  const roomId = createCoopRoomId("co-op-harbor");
  const sessionId = createCoopSessionId("co-op-harbor-session-1");
  const playerId = createCoopPlayerId("coop-player-1");
  const username = createUsername("coop-user");

  assert.notEqual(roomId, null);
  assert.notEqual(sessionId, null);
  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const requests = [];
  const scheduledPolls = [];
  const clearedTimers = [];
  const responseQueue = [
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId,
      tick: 0,
      phase: "waiting-for-players"
    }),
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId,
      tick: 0,
      phase: "waiting-for-players"
    }),
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId,
      tick: 0,
      phase: "active"
    }),
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId,
      tick: 1
    }),
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId,
      tick: 2,
      playerHits: 1,
      playerShots: 1,
      lastAcknowledgedShotSequence: 1,
      lastOutcome: "hit",
      birdBehavior: "downed"
    }),
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId,
      tick: 2,
      playerHits: 1,
      playerShots: 1,
      lastAcknowledgedShotSequence: 1,
      lastOutcome: "hit",
      birdBehavior: "downed"
    })
  ];
  const roomClient = new CoopRoomClient(
    {
      defaultPollIntervalMs: createMilliseconds(75),
      roomCollectionPath: "/experiences/duck-hunt/coop/rooms",
      roomId,
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      clearTimeout(handle) {
        clearedTimers.push(handle);
      },
      async fetch(input, init) {
        const queuedResponse = responseQueue.shift();

        assert.notEqual(queuedResponse, undefined);
        requests.push({
          body: init?.body ?? null,
          method: init?.method ?? "GET",
          url: String(input)
        });

        return createJsonResponse(true, queuedResponse);
      },
      setTimeout(callback, delay) {
        scheduledPolls.push({
          callback,
          delay
        });
        return scheduledPolls.length;
      }
    }
  );

  const joinedSnapshot = await roomClient.ensureJoined({
    playerId,
    ready: false,
    username
  });

  assert.equal(joinedSnapshot.session.phase, "waiting-for-players");
  assert.equal(roomClient.statusSnapshot.joined, true);
  assert.equal(roomClient.statusSnapshot.state, "connected");
  assert.equal(requests[0]?.method, "POST");
  assert.match(String(requests[0]?.body), /"type":"join-room"/);
  assert.match(String(requests[0]?.body), /"ready":false/);
  assert.equal(scheduledPolls[0]?.delay, 0);

  const readySnapshot = await roomClient.setPlayerReady(true);

  assert.equal(readySnapshot.session.phase, "waiting-for-players");
  assert.equal(requests[1]?.method, "POST");
  assert.match(String(requests[1]?.body), /"type":"set-player-ready"/);

  const startedSnapshot = await roomClient.startSession();

  assert.equal(startedSnapshot.session.phase, "active");
  assert.equal(requests[2]?.method, "POST");
  assert.match(String(requests[2]?.body), /"type":"start-session"/);

  scheduledPolls.shift()?.callback();
  await flushAsyncWork();

  assert.equal(roomClient.roomSnapshot?.tick.currentTick, 1);
  assert.equal(requests[3]?.method, "GET");
  assert.equal(
    requests[3]?.url,
    "http://127.0.0.1:3210/experiences/duck-hunt/coop/rooms/co-op-harbor?playerId=coop-player-1"
  );
  assert.equal(scheduledPolls[0]?.delay, 50);

  roomClient.fireShot(
    { x: 0, y: 1.35, z: 0 },
    { x: 0, y: 0, z: -1 }
  );
  await flushAsyncWork();

  assert.equal(requests[4]?.method, "POST");
  assert.match(String(requests[4]?.body), /"type":"fire-shot"/);
  assert.equal(
    roomClient.roomSnapshot?.players[0]?.activity.lastAcknowledgedShotSequence,
    1
  );
  assert.equal(roomClient.roomSnapshot?.players[0]?.activity.lastOutcome, "hit");

  roomClient.dispose();
  await flushAsyncWork();

  assert.equal(roomClient.statusSnapshot.state, "disposed");
  assert.ok(clearedTimers.length >= 1);
  assert.equal(requests[5]?.method, "POST");
  assert.match(String(requests[5]?.body), /"type":"leave-room"/);
});

test("CoopRoomClient posts leader kick-player commands", async () => {
  const { CoopRoomClient } = await clientLoader.load("/src/network/index.ts");
  const roomId = createCoopRoomId("co-op-harbor");
  const sessionId = createCoopSessionId("co-op-harbor-session-1");
  const playerId = createCoopPlayerId("leader-player-1");
  const targetPlayerId = createCoopPlayerId("player-2");
  const username = createUsername("coop-user");

  assert.notEqual(roomId, null);
  assert.notEqual(sessionId, null);
  assert.notEqual(playerId, null);
  assert.notEqual(targetPlayerId, null);
  assert.notEqual(username, null);

  const requests = [];
  const responseQueue = [
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId,
      tick: 0,
      phase: "waiting-for-players"
    }),
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId,
      tick: 0,
      phase: "waiting-for-players"
    }),
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId,
      tick: 0,
      phase: "waiting-for-players"
    })
  ];
  const roomClient = new CoopRoomClient(
    {
      defaultPollIntervalMs: createMilliseconds(75),
      roomCollectionPath: "/experiences/duck-hunt/coop/rooms",
      roomId,
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      async fetch(input, init) {
        const queuedResponse = responseQueue.shift();

        assert.notEqual(queuedResponse, undefined);
        requests.push({
          body: init?.body ?? null,
          method: init?.method ?? "GET",
          url: String(input)
        });

        return createJsonResponse(true, queuedResponse);
      },
      setTimeout() {
        return 1;
      },
      clearTimeout() {}
    }
  );

  await roomClient.ensureJoined({
    playerId,
    ready: true,
    username
  });
  await roomClient.kickPlayer(targetPlayerId);
  roomClient.dispose();
  await flushAsyncWork();

  assert.match(String(requests[1]?.body), /"type":"kick-player"/);
  assert.match(String(requests[1]?.body), /"targetPlayerId":"player-2"/);
});

test("CoopRoomClient accepts a new room session even when its tick restarts", async () => {
  const { CoopRoomClient } = await clientLoader.load("/src/network/index.ts");
  const roomId = createCoopRoomId("co-op-harbor");
  const activeSessionId = createCoopSessionId("co-op-harbor-session-1");
  const freshSessionId = createCoopSessionId("co-op-harbor-session-2");
  const playerId = createCoopPlayerId("coop-player-1");
  const username = createUsername("coop-user");

  assert.notEqual(roomId, null);
  assert.notEqual(activeSessionId, null);
  assert.notEqual(freshSessionId, null);
  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const requests = [];
  const scheduledPolls = [];
  const responseQueue = [
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId: activeSessionId,
      tick: 4,
      phase: "active"
    }),
    createRoomSnapshotEvent({
      playerId,
      roomId,
      sessionId: freshSessionId,
      tick: 0,
      phase: "waiting-for-players"
    })
  ];
  const roomClient = new CoopRoomClient(
    {
      defaultPollIntervalMs: createMilliseconds(75),
      roomCollectionPath: "/experiences/duck-hunt/coop/rooms",
      roomId,
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      async fetch(input, init) {
        const queuedResponse = responseQueue.shift();

        assert.notEqual(queuedResponse, undefined);
        requests.push({
          cache: init?.cache ?? null,
          method: init?.method ?? "GET",
          url: String(input)
        });

        return createJsonResponse(true, queuedResponse);
      },
      setTimeout(callback, delay) {
        scheduledPolls.push({
          callback,
          delay
        });
        return scheduledPolls.length;
      },
      clearTimeout() {}
    }
  );

  await roomClient.ensureJoined({
    playerId,
    ready: false,
    username
  });

  scheduledPolls.shift()?.callback();
  await flushAsyncWork();

  assert.equal(requests[1]?.method, "GET");
  assert.equal(requests[1]?.cache, "no-store");
  assert.equal(roomClient.roomSnapshot?.session.sessionId, freshSessionId);
  assert.equal(roomClient.roomSnapshot?.tick.currentTick, 0);
  assert.equal(roomClient.roomSnapshot?.session.phase, "waiting-for-players");
});

test("CoopRoomClient stops polling when the server reports local room membership loss", async () => {
  const { CoopRoomClient } = await clientLoader.load("/src/network/index.ts");
  const roomId = createCoopRoomId("co-op-harbor");
  const sessionId = createCoopSessionId("co-op-harbor-session-1");
  const playerId = createCoopPlayerId("coop-player-1");
  const username = createUsername("coop-user");

  assert.notEqual(roomId, null);
  assert.notEqual(sessionId, null);
  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const scheduledPolls = [];
  const roomClient = new CoopRoomClient(
    {
      defaultPollIntervalMs: createMilliseconds(75),
      roomCollectionPath: "/experiences/duck-hunt/coop/rooms",
      roomId,
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      async fetch(input, init) {
        if (init?.method === "POST") {
          return createJsonResponse(
            true,
            createRoomSnapshotEvent({
              playerId,
              roomId,
              sessionId,
              tick: 0,
              phase: "waiting-for-players"
            })
          );
        }

        return createJsonResponse(false, {
          error: `Unknown co-op player: ${playerId}`
        });
      },
      setTimeout(callback, delay) {
        scheduledPolls.push({
          callback,
          delay
        });
        return scheduledPolls.length;
      },
      clearTimeout() {}
    }
  );

  await roomClient.ensureJoined({
    playerId,
    ready: false,
    username
  });

  assert.equal(scheduledPolls.length, 1);

  scheduledPolls.shift()?.callback();
  await flushAsyncWork();

  assert.equal(roomClient.statusSnapshot.joined, false);
  assert.equal(roomClient.statusSnapshot.state, "error");
  assert.equal(
    roomClient.statusSnapshot.lastError,
    "You are no longer in the co-op room."
  );
  assert.equal(scheduledPolls.length, 0);
});

test("CoopRoomClient reports an outdated room snapshot contract instead of accepting it", async () => {
  const { CoopRoomClient } = await clientLoader.load("/src/network/index.ts");
  const roomId = createCoopRoomId("co-op-harbor");
  const sessionId = createCoopSessionId("co-op-harbor-session-1");
  const playerId = createCoopPlayerId("coop-player-1");
  const username = createUsername("coop-user");

  assert.notEqual(roomId, null);
  assert.notEqual(sessionId, null);
  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const roomClient = new CoopRoomClient(
    {
      defaultPollIntervalMs: createMilliseconds(75),
      roomCollectionPath: "/experiences/duck-hunt/coop/rooms",
      roomId,
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      async fetch() {
        return createJsonResponse(true, {
          room: {
            birds: [],
            capacity: 4,
            players: [],
            roomId,
            session: {
              birdsCleared: 4,
              birdsRemaining: 0,
              phase: "completed",
              requiredReadyPlayerCount: 2,
              sessionId,
              teamHitsLanded: 4,
              teamShotsFired: 8
            },
            tick: {
              currentTick: 84,
              tickIntervalMs: 50
            }
          },
          type: "room-snapshot"
        });
      },
      setTimeout() {
        return 1;
      },
      clearTimeout() {}
    }
  );

  await assert.rejects(
    () =>
      roomClient.ensureJoined({
        playerId,
        ready: false,
        username
      }),
    /current room snapshot fields/
  );
  assert.equal(roomClient.statusSnapshot.state, "error");
  assert.match(roomClient.statusSnapshot.lastError ?? "", /current room snapshot fields/);
});
