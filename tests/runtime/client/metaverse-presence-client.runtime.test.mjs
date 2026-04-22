import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaverseLeavePresenceCommand,
  createMetaversePlayerId,
  createMetaversePresenceRosterEvent,
  createMetaverseSyncPresenceCommand,
  createMilliseconds,
  createUsername,
  resolveMetaversePlayerTeamId
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function flushAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function createRosterEvent({
  localPlayerId,
  remotePlayerId = null,
  remoteUsername = "Remote Sailor",
  snapshotSequence,
  tickIntervalMs = 90,
  x = 0,
  yawRadians = 0
}) {
  const localTeamId = resolveMetaversePlayerTeamId(localPlayerId);
  const remoteTeamId =
    remotePlayerId === null ? null : resolveMetaversePlayerTeamId(remotePlayerId);

  return createMetaversePresenceRosterEvent({
    players: [
      {
        characterId: "mesh2motion-humanoid-v1",
        playerId: localPlayerId,
        pose: {
          animationVocabulary: x === 0 ? "idle" : "walk",
          locomotionMode: "grounded",
          position: {
            x,
            y: 1.62,
            z: 24
          },
          stateSequence: snapshotSequence,
          yawRadians
        },
        teamId: localTeamId,
        username: "Harbor Pilot"
      },
      ...(remotePlayerId === null
        ? []
        : [
            {
              characterId: "mesh2motion-humanoid-v1",
              playerId: remotePlayerId,
              pose: {
                animationVocabulary: "walk",
                locomotionMode: "swim",
                position: {
                  x: -3,
                  y: 0.2,
                  z: 8
                },
                stateSequence: snapshotSequence,
                yawRadians: 0.4
              },
              teamId: remoteTeamId,
              username: remoteUsername
            }
          ])
    ],
    snapshotSequence,
    tickIntervalMs
  });
}

test("MetaversePresenceClient joins, polls roster snapshots, syncs pose, and leaves on dispose", async () => {
  const { MetaversePresenceClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-pilot-2");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);

  const requests = [];
  const scheduledTasks = [];
  const clearedTimers = [];
  const responseQueue = [
    createRosterEvent({
      localPlayerId: playerId,
      snapshotSequence: 1
    }),
    createRosterEvent({
      localPlayerId: playerId,
      remotePlayerId,
      snapshotSequence: 2
    }),
    createRosterEvent({
      localPlayerId: playerId,
      remotePlayerId,
      snapshotSequence: 3,
      x: 2.5,
      yawRadians: 0.6
    }),
    createRosterEvent({
      localPlayerId: playerId,
      remotePlayerId,
      snapshotSequence: 4,
      x: 2.5,
      yawRadians: 0.6
    })
  ];
  const client = new MetaversePresenceClient(
    {
      defaultPollIntervalMs: createMilliseconds(150),
      presencePath: "/metaverse/presence",
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      transport: {
        async pollRosterSnapshot(nextPlayerId) {
          const queuedResponse = responseQueue.shift();

          assert.notEqual(queuedResponse, undefined);
          requests.push({
            playerId: nextPlayerId,
            type: "poll"
          });

          return queuedResponse;
        },
        async sendCommand(command, options) {
          const queuedResponse = responseQueue.shift();

          assert.notEqual(queuedResponse, undefined);
          requests.push({
            command,
            options: options ?? null,
            type: "command"
          });

          return queuedResponse;
        }
      },
      clearTimeout(handle) {
        clearedTimers.push(handle);
      },
      setTimeout(callback, delay) {
        scheduledTasks.push({
          callback,
          delay
        });
        return scheduledTasks.length;
      }
    }
  );

  const joinedSnapshot = await client.ensureJoined({
    characterId: "mesh2motion-humanoid-v1",
    playerId,
    pose: {
      animationVocabulary: "idle",
      locomotionMode: "grounded",
      position: {
        x: 0,
        y: 1.62,
        z: 24
      },
      yawRadians: 0
    },
    username
  });

  assert.equal(joinedSnapshot.players.length, 1);
  assert.equal(client.statusSnapshot.joined, true);
  assert.equal(client.statusSnapshot.state, "connected");
  assert.equal(requests[0]?.type, "command");
  assert.deepEqual(
    requests[0]?.command,
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "grounded",
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        yawRadians: 0
      },
      username
    })
  );
  assert.equal(scheduledTasks[0]?.delay, 0);

  scheduledTasks.shift()?.callback();
  await flushAsyncWork();

  assert.equal(client.rosterSnapshot?.players.length, 2);
  assert.equal(requests[1]?.type, "poll");
  assert.equal(requests[1]?.playerId, playerId);
  assert.equal(scheduledTasks[0]?.delay, 90);

  client.syncPresence({
    animationVocabulary: "walk",
    locomotionMode: "grounded",
    position: {
      x: 2.5,
      y: 1.62,
      z: 22
    },
    yawRadians: 0.6
  });

  scheduledTasks[1]?.callback();
  await flushAsyncWork();

  assert.equal(requests[2]?.type, "command");
  assert.deepEqual(
    requests[2]?.command,
    createMetaverseSyncPresenceCommand({
      playerId,
      pose: {
        animationVocabulary: "walk",
        locomotionMode: "grounded",
        position: {
          x: 2.5,
          y: 1.62,
          z: 22
        },
        stateSequence: 1,
        yawRadians: 0.6
      }
    })
  );
  assert.equal(client.rosterSnapshot?.players[0]?.pose.position.x, 2.5);
  assert.equal(client.statusSnapshot.lastSnapshotSequence, 3);

  client.dispose();
  await flushAsyncWork();

  assert.equal(client.statusSnapshot.state, "disposed");
  assert.ok(clearedTimers.length >= 1);
  assert.equal(requests[3]?.type, "command");
  assert.deepEqual(
    requests[3]?.command,
    createMetaverseLeavePresenceCommand({
      playerId
    })
  );
  assert.equal(requests[3]?.options?.deliveryHint, "best-effort-disconnect");
});

test("MetaversePresenceClient marks membership loss when the local player disappears from the roster", async () => {
  const { MetaversePresenceClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const scheduledTasks = [];
  const responseQueue = [
    createRosterEvent({
      localPlayerId: playerId,
      snapshotSequence: 1
    }),
    createMetaversePresenceRosterEvent({
      players: [],
      snapshotSequence: 2,
      tickIntervalMs: 90
    })
  ];
  const client = new MetaversePresenceClient(
    {
      defaultPollIntervalMs: createMilliseconds(150),
      presencePath: "/metaverse/presence",
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      transport: {
        async pollRosterSnapshot() {
          const queuedResponse = responseQueue.shift();

          assert.notEqual(queuedResponse, undefined);

          return queuedResponse;
        },
        async sendCommand() {
          const queuedResponse = responseQueue.shift();

          assert.notEqual(queuedResponse, undefined);

          return queuedResponse;
        }
      },
      setTimeout(callback, delay) {
        scheduledTasks.push({
          callback,
          delay
        });
        return scheduledTasks.length;
      }
    }
  );

  await client.ensureJoined({
    characterId: "mesh2motion-humanoid-v1",
    playerId,
    pose: {
      animationVocabulary: "idle",
      locomotionMode: "grounded",
      position: {
        x: 0,
        y: 1.62,
        z: 24
      },
      yawRadians: 0
    },
    username
  });

  scheduledTasks.shift()?.callback();
  await flushAsyncWork();

  assert.equal(client.statusSnapshot.state, "error");
  assert.equal(client.statusSnapshot.joined, false);
  assert.equal(
    client.statusSnapshot.lastError,
    "You are no longer in the metaverse presence roster."
  );
});

test("MetaversePresenceClient exposes reliable transport truth through its network-owned resolver", async () => {
  const { MetaversePresenceClient } = await clientLoader.load("/src/network/index.ts");
  const reliableTransportStatusSnapshot = Object.freeze({
    activeTransport: "http",
    browserWebTransportAvailable: false,
    enabled: true,
    fallbackActive: false,
    lastTransportError: null,
    preference: "http",
    webTransportConfigured: false,
    webTransportStatus: "not-requested"
  });
  const client = new MetaversePresenceClient(
    {
      defaultPollIntervalMs: createMilliseconds(150),
      presencePath: "/metaverse/presence",
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      resolveReliableTransportStatusSnapshot: () =>
        reliableTransportStatusSnapshot,
      transport: {
        async pollRosterSnapshot() {
          throw new Error("Unexpected roster poll.");
        },
        async sendCommand() {
          throw new Error("Unexpected command send.");
        }
      }
    }
  );

  assert.equal(
    client.reliableTransportStatusSnapshot,
    reliableTransportStatusSnapshot
  );

  client.dispose();
});

test("MetaversePresenceClient rejoins automatically after an unknown-player poll failure", async () => {
  const { MetaversePresenceClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const requests = [];
  const scheduledTasks = [];
  const responseQueue = [
    createRosterEvent({
      localPlayerId: playerId,
      snapshotSequence: 1
    }),
    createRosterEvent({
      localPlayerId: playerId,
      snapshotSequence: 2
    })
  ];
  const client = new MetaversePresenceClient(
    {
      defaultPollIntervalMs: createMilliseconds(150),
      presencePath: "/metaverse/presence",
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      transport: {
        async pollRosterSnapshot(nextPlayerId) {
          requests.push({
            playerId: nextPlayerId,
            type: "poll"
          });
          throw new Error(`Unknown metaverse player: ${nextPlayerId}`);
        },
        async sendCommand(command) {
          const queuedResponse = responseQueue.shift();

          assert.notEqual(queuedResponse, undefined);
          requests.push({
            command,
            type: "command"
          });

          return queuedResponse;
        }
      },
      setTimeout(callback, delay) {
        scheduledTasks.push({
          callback,
          delay
        });
        return scheduledTasks.length;
      }
    }
  );

  await client.ensureJoined({
    characterId: "mesh2motion-humanoid-v1",
    playerId,
    pose: {
      animationVocabulary: "idle",
      locomotionMode: "grounded",
      position: {
        x: 0,
        y: 1.62,
        z: 24
      },
      yawRadians: 0
    },
    username
  });

  scheduledTasks.shift()?.callback();
  await flushAsyncWork();

  assert.equal(client.statusSnapshot.state, "connected");
  assert.equal(client.statusSnapshot.joined, true);
  assert.equal(client.statusSnapshot.lastError, null);
  assert.equal(requests[1]?.type, "poll");
  assert.equal(requests[2]?.type, "command");
  assert.deepEqual(
    requests[2]?.command,
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "grounded",
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        yawRadians: 0
      },
      username
    })
  );
});
