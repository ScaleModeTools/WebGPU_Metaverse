import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaversePlayerId,
  createMetaverseRealtimeWorldEvent,
  createMetaverseVehicleId,
  createMilliseconds
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

function createWorldEvent({
  playerId,
  snapshotSequence,
  currentTick,
  serverTimeMs,
  vehicleX = 8
}) {
  const vehicleId = createMetaverseVehicleId("metaverse-hub-skiff-v1");

  assert.notEqual(vehicleId, null);

  return createMetaverseRealtimeWorldEvent({
    world: {
      players: [
        {
          characterId: "metaverse-mannequin-v1",
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          locomotionMode: "grounded",
          playerId,
          position: {
            x: 0,
            y: 1.62,
            z: 24
          },
          stateSequence: snapshotSequence,
          username: "Harbor Pilot",
          yawRadians: 0
        }
      ],
      snapshotSequence,
      tick: {
        currentTick,
        serverTimeMs,
        tickIntervalMs: 150
      },
      vehicles: [
        {
          angularVelocityRadiansPerSecond: 0,
          environmentAssetId: "metaverse-hub-skiff-v1",
          linearVelocity: {
            x: 0.5,
            y: 0,
            z: 0
          },
          position: {
            x: vehicleX,
            y: 0.4,
            z: 12
          },
          seats: [],
          vehicleId,
          yawRadians: 0
        }
      ]
    }
  });
}

test("MetaverseWorldClient connects, buffers newer snapshots, and disposes cleanly", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const requests = [];
  const scheduledTasks = [];
  const clearedTimers = [];
  const responseQueue = [
    createWorldEvent({
      currentTick: 10,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1,
      vehicleX: 8
    }),
    createWorldEvent({
      currentTick: 11,
      playerId,
      serverTimeMs: 10_150,
      snapshotSequence: 2,
      vehicleX: 8.5
    }),
    createWorldEvent({
      currentTick: 12,
      playerId,
      serverTimeMs: 10_300,
      snapshotSequence: 3,
      vehicleX: 9
    })
  ];
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(150),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      transport: {
        async pollWorldSnapshot(nextPlayerId) {
          const queuedResponse = responseQueue.shift();

          assert.notEqual(queuedResponse, undefined);
          requests.push({
            playerId: nextPlayerId,
            type: "poll"
          });

          return queuedResponse;
        },
        async sendCommand(command) {
          requests.push({
            command,
            type: "command"
          });

          return (
            responseQueue[0] ??
            createWorldEvent({
              currentTick: 12,
              playerId,
              serverTimeMs: 10_300,
              snapshotSequence: 3,
              vehicleX: 9
            })
          );
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

  const firstSnapshot = await client.ensureConnected(playerId);

  assert.equal(firstSnapshot.snapshotSequence, 1);
  assert.equal(client.statusSnapshot.connected, true);
  assert.equal(client.statusSnapshot.state, "connected");
  assert.equal(client.worldSnapshotBuffer.length, 1);
  assert.equal(requests[0]?.type, "poll");
  assert.equal(requests[0]?.playerId, playerId);
  assert.equal(scheduledTasks[0]?.delay, 0);

  scheduledTasks.shift()?.callback();
  await flushAsyncWork();

  assert.equal(client.worldSnapshotBuffer.length, 2);
  assert.equal(client.worldSnapshotBuffer[1]?.snapshotSequence, 2);
  assert.equal(client.statusSnapshot.lastWorldTick, 11);
  assert.equal(scheduledTasks[0]?.delay, 150);

  scheduledTasks.shift()?.callback();
  await flushAsyncWork();

  assert.equal(client.worldSnapshotBuffer.length, 2);
  assert.equal(client.worldSnapshotBuffer[0]?.snapshotSequence, 2);
  assert.equal(client.worldSnapshotBuffer[1]?.snapshotSequence, 3);

  client.dispose();

  assert.equal(client.statusSnapshot.state, "disposed");
  assert.ok(clearedTimers.length >= 1);
});

test("MetaverseWorldClient exposes driver-control datagram support as a separate seam", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  let datagramTransportDisposed = false;
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(150),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      driverVehicleControlDatagramTransport: {
        async sendDriverVehicleControlDatagram() {},
        dispose() {
          datagramTransportDisposed = true;
        }
      },
      transport: {
        async pollWorldSnapshot() {
          return createWorldEvent({
            currentTick: 10,
            playerId,
            serverTimeMs: 10_000,
            snapshotSequence: 1,
            vehicleX: 8
          });
        },
        async sendCommand() {
          return createWorldEvent({
            currentTick: 10,
            playerId,
            serverTimeMs: 10_000,
            snapshotSequence: 1,
            vehicleX: 8
          });
        }
      }
    }
  );

  assert.equal(client.supportsDriverVehicleControlDatagrams, true);

  client.dispose();

  assert.equal(datagramTransportDisposed, true);
});

test("MetaverseWorldClient coalesces latest driver vehicle control commands behind the transport seam", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduledTasks = [];
  const sentCommands = [];
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    playerId,
    serverTimeMs: 10_000,
    snapshotSequence: 1,
    vehicleX: 8
  });
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(150),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      transport: {
        async pollWorldSnapshot() {
          return initialWorldEvent;
        },
        async sendCommand(command) {
          sentCommands.push(command);
          return initialWorldEvent;
        }
      },
      clearTimeout() {},
      setTimeout(callback, delay) {
        scheduledTasks.push({
          callback,
          delay
        });
        return scheduledTasks.length;
      }
    }
  );

  await client.ensureConnected(playerId);
  client.syncDriverVehicleControl({
    controlIntent: {
      boost: false,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 0.5,
      strafeAxis: 0,
      yawAxis: 0.1
    },
    playerId
  });
  client.syncDriverVehicleControl({
    controlIntent: {
      boost: true,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.2
    },
    playerId
  });

  assert.equal(scheduledTasks.at(-1)?.delay, 50);

  scheduledTasks.pop()?.callback();
  await flushAsyncWork();

  assert.equal(sentCommands.length, 1);
  assert.deepEqual(
    sentCommands[0],
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: true,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0.2
      },
      controlSequence: 2,
      playerId
    })
  );
});

test("MetaverseWorldClient prefers driver-control datagrams over reliable command transport when available", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduledTasks = [];
  const sentCommands = [];
  const sentDatagrams = [];
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    playerId,
    serverTimeMs: 10_000,
    snapshotSequence: 1,
    vehicleX: 8
  });
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(150),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      driverVehicleControlDatagramTransport: {
        async sendDriverVehicleControlDatagram(command) {
          sentDatagrams.push(command);
        }
      },
      transport: {
        async pollWorldSnapshot() {
          return initialWorldEvent;
        },
        async sendCommand(command) {
          sentCommands.push(command);
          return initialWorldEvent;
        }
      },
      clearTimeout() {},
      setTimeout(callback, delay) {
        scheduledTasks.push({
          callback,
          delay
        });
        return scheduledTasks.length;
      }
    }
  );

  await client.ensureConnected(playerId);
  client.syncDriverVehicleControl({
    controlIntent: {
      boost: false,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 0.5,
      strafeAxis: 0,
      yawAxis: 0.1
    },
    playerId
  });
  client.syncDriverVehicleControl({
    controlIntent: {
      boost: true,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.2
    },
    playerId
  });

  scheduledTasks.pop()?.callback();
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentCommands.length, 0);
  assert.equal(client.worldSnapshotBuffer.length, 1);
  assert.equal(client.worldSnapshotBuffer[0]?.snapshotSequence, 1);
  assert.equal(client.worldSnapshotBuffer[0]?.vehicles[0]?.position.x, 8);
  assert.deepEqual(
    sentDatagrams[0],
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: true,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0.2
      },
      controlSequence: 2,
      playerId
    })
  );
});

test("MetaverseWorldClient falls back to reliable commands after a driver-control datagram send failure", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduledTasks = [];
  const sentCommands = [];
  const sentDatagrams = [];
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    playerId,
    serverTimeMs: 10_000,
    snapshotSequence: 1,
    vehicleX: 8
  });
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(150),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      driverVehicleControlDatagramTransport: {
        async sendDriverVehicleControlDatagram(command) {
          sentDatagrams.push(command);
          throw new Error("Datagram transport unavailable.");
        }
      },
      transport: {
        async pollWorldSnapshot() {
          return initialWorldEvent;
        },
        async sendCommand(command) {
          sentCommands.push(command);
          return initialWorldEvent;
        }
      },
      clearTimeout() {},
      setTimeout(callback, delay) {
        scheduledTasks.push({
          callback,
          delay
        });
        return scheduledTasks.length;
      }
    }
  );

  await client.ensureConnected(playerId);

  client.syncDriverVehicleControl({
    controlIntent: {
      boost: true,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.2
    },
    playerId
  });

  scheduledTasks.pop()?.callback();
  await flushAsyncWork();

  client.syncDriverVehicleControl({
    controlIntent: {
      boost: true,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 0.4,
      strafeAxis: 0.1,
      yawAxis: 0.1
    },
    playerId
  });

  scheduledTasks.pop()?.callback();
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentCommands.length, 2);
  assert.equal(client.supportsDriverVehicleControlDatagrams, false);
  assert.equal(client.worldSnapshotBuffer.length, 1);
  assert.equal(client.worldSnapshotBuffer[0]?.snapshotSequence, 1);
});

test("MetaverseWorldClient rejects stale world snapshots and keeps the newest accepted buffer", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduledTasks = [];
  const responseQueue = [
    createWorldEvent({
      currentTick: 10,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 3,
      vehicleX: 9
    }),
    createWorldEvent({
      currentTick: 9,
      playerId,
      serverTimeMs: 9_850,
      snapshotSequence: 2,
      vehicleX: 8
    })
  ];
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(150),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      transport: {
        async pollWorldSnapshot() {
          const queuedResponse = responseQueue.shift();

          assert.notEqual(queuedResponse, undefined);
          return queuedResponse;
        },
        async sendCommand() {
          throw new Error("Unexpected command send.");
        }
      },
      clearTimeout() {},
      setTimeout(callback, delay) {
        scheduledTasks.push({
          callback,
          delay
        });
        return scheduledTasks.length;
      }
    }
  );

  await client.ensureConnected(playerId);
  scheduledTasks.shift()?.callback();
  await flushAsyncWork();

  assert.equal(client.worldSnapshotBuffer.length, 1);
  assert.equal(client.worldSnapshotBuffer[0]?.snapshotSequence, 3);
  assert.equal(client.statusSnapshot.lastSnapshotSequence, 3);
  assert.equal(client.statusSnapshot.lastWorldTick, 10);
});

test("MetaverseWorldClient resyncs after an unknown-player poll failure when authoritative polling resumes", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduledTasks = [];
  const responseQueue = [
    createWorldEvent({
      currentTick: 10,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1,
      vehicleX: 8
    }),
    new Error("Unknown metaverse player: harbor-pilot-1"),
    createWorldEvent({
      currentTick: 11,
      playerId,
      serverTimeMs: 10_150,
      snapshotSequence: 2,
      vehicleX: 8.5
    })
  ];
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(150),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      transport: {
        async pollWorldSnapshot() {
          const queuedResponse = responseQueue.shift();

          assert.notEqual(queuedResponse, undefined);

          if (queuedResponse instanceof Error) {
            throw queuedResponse;
          }

          return queuedResponse;
        },
        async sendCommand() {
          throw new Error("Unexpected command send.");
        }
      },
      clearTimeout() {},
      setTimeout(callback, delay) {
        scheduledTasks.push({
          callback,
          delay
        });
        return scheduledTasks.length;
      }
    }
  );

  await client.ensureConnected(playerId);

  scheduledTasks.shift()?.callback();
  await flushAsyncWork();

  assert.equal(client.statusSnapshot.state, "error");
  assert.equal(client.statusSnapshot.connected, false);
  assert.equal(client.worldSnapshotBuffer.length, 0);
  assert.equal(scheduledTasks[0]?.delay, 150);

  scheduledTasks.shift()?.callback();
  await flushAsyncWork();

  assert.equal(client.statusSnapshot.state, "connected");
  assert.equal(client.statusSnapshot.connected, true);
  assert.equal(client.worldSnapshotBuffer.length, 1);
  assert.equal(client.worldSnapshotBuffer[0]?.snapshotSequence, 2);
});
