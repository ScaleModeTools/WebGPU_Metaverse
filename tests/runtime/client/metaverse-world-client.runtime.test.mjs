import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
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

function createDeferredPromise() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return Object.freeze({
    promise,
    reject,
    resolve
  });
}

function createManualTimerScheduler() {
  const clearedHandles = new Set();
  const scheduledTasks = [];
  let nextHandle = 1;

  return Object.freeze({
    clearTimeout(handle) {
      clearedHandles.add(handle);
    },
    get pendingTasks() {
      return scheduledTasks.filter(
        (task) => !clearedHandles.has(task.handle)
      );
    },
    runNext(delay) {
      const taskIndex = scheduledTasks.findIndex(
        (task) =>
          !clearedHandles.has(task.handle) &&
          (delay === undefined || task.delay === delay)
      );

      assert.notEqual(taskIndex, -1);

      const [task] = scheduledTasks.splice(taskIndex, 1);

      assert.notEqual(task, undefined);
      clearedHandles.add(task.handle);
      task.callback();
    },
    setTimeout(callback, delay) {
      const handle = nextHandle;

      nextHandle += 1;
      scheduledTasks.push({
        callback,
        delay,
        handle
      });

      return handle;
    }
  });
}

function createWorldEvent({
  playerId,
  snapshotSequence,
  currentTick,
  lastProcessedInputSequence = snapshotSequence,
  serverTimeMs,
  tickIntervalMs = 50,
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
          lastProcessedInputSequence,
          stateSequence: snapshotSequence,
          username: "Harbor Pilot",
          yawRadians: 0
        }
      ],
      snapshotSequence,
      tick: {
        currentTick,
        serverTimeMs,
        tickIntervalMs
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
      defaultPollIntervalMs: createMilliseconds(50),
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
  assert.equal(firstSnapshot.players[0]?.lastProcessedInputSequence, 1);
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
  assert.equal(
    client.worldSnapshotBuffer[1]?.players[0]?.lastProcessedInputSequence,
    2
  );
  assert.equal(client.statusSnapshot.lastWorldTick, 11);
  assert.equal(scheduledTasks[0]?.delay, 50);

  scheduledTasks.shift()?.callback();
  await flushAsyncWork();

  assert.equal(client.worldSnapshotBuffer.length, 2);
  assert.equal(client.worldSnapshotBuffer[0]?.snapshotSequence, 2);
  assert.equal(client.worldSnapshotBuffer[1]?.snapshotSequence, 3);

  client.dispose();

  assert.equal(client.statusSnapshot.state, "disposed");
  assert.ok(clearedTimers.length >= 1);
});

test("MetaverseWorldClient serializes reliable mounted occupancy commands through the authoritative world seam", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const sentCommands = [];
  const firstCommandResponse = createDeferredPromise();
  const secondCommandResponse = createDeferredPromise();
  let sendCommandCount = 0;
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
      defaultPollIntervalMs: createMilliseconds(50),
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
          sendCommandCount += 1;

          return sendCommandCount === 1
            ? firstCommandResponse.promise
            : secondCommandResponse.promise;
        }
      }
    }
  );

  await client.ensureConnected(playerId);

  client.syncMountedOccupancy({
    mountedOccupancy: {
      environmentAssetId: "metaverse-hub-skiff-v1",
      entryId: "deck-entry",
      occupancyKind: "entry",
      occupantRole: "passenger",
      seatId: null
    },
    playerId
  });
  client.syncMountedOccupancy({
    mountedOccupancy: {
      environmentAssetId: "metaverse-hub-skiff-v1",
      entryId: null,
      occupancyKind: "seat",
      occupantRole: "driver",
      seatId: "driver-seat"
    },
    playerId
  });
  await flushAsyncWork();

  assert.equal(sentCommands.length, 1);
  assert.equal(sentCommands[0]?.type, "sync-mounted-occupancy");
  assert.equal(sentCommands[0]?.mountedOccupancy?.entryId, "deck-entry");

  firstCommandResponse.resolve(initialWorldEvent);
  await flushAsyncWork();

  assert.equal(sentCommands.length, 2);
  assert.equal(sentCommands[1]?.type, "sync-mounted-occupancy");
  assert.equal(sentCommands[1]?.mountedOccupancy?.seatId, "driver-seat");

  secondCommandResponse.resolve(initialWorldEvent);
  await flushAsyncWork();

  client.dispose();
});

test("MetaverseWorldClient exposes driver-control datagram support as a separate seam", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  let datagramTransportDisposed = false;
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      latestWinsDatagramTransport: {
        async sendDriverVehicleControlDatagram() {},
        async sendPlayerTraversalIntentDatagram() {},
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
  assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "active");
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.activeTransport,
    "webtransport-datagram"
  );

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
      defaultPollIntervalMs: createMilliseconds(50),
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
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      latestWinsDatagramTransport: {
        async sendDriverVehicleControlDatagram(command) {
          sentDatagrams.push(command);
        },
        async sendPlayerTraversalIntentDatagram() {}
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
  assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "active");
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
    null
  );
  assert.equal(
    client.telemetrySnapshot.driverVehicleControlDatagramSendFailureCount,
    0
  );
});

test("MetaverseWorldClient falls back to reliable commands after a driver-control datagram send failure and recovers datagram sends after the cooldown", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentCommands = [];
  const sentDatagrams = [];
  let remainingDatagramFailures = 1;
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
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      latestWinsDatagramTransport: {
        async sendDriverVehicleControlDatagram(command) {
          sentDatagrams.push(command);
          if (remainingDatagramFailures > 0) {
            remainingDatagramFailures -= 1;
            throw new Error("Datagram transport unavailable.");
          }
        },
        async sendPlayerTraversalIntentDatagram() {}
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
      clearTimeout: scheduler.clearTimeout,
      setTimeout: scheduler.setTimeout
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

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentCommands.length, 1);
  assert.equal(client.supportsDriverVehicleControlDatagrams, false);
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.state,
    "degraded-to-reliable"
  );
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.activeTransport,
    "reliable-command-fallback"
  );
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
    "Datagram transport unavailable."
  );
  assert.equal(client.worldSnapshotBuffer.length, 1);
  assert.equal(client.worldSnapshotBuffer[0]?.snapshotSequence, 1);
  assert.equal(
    client.telemetrySnapshot.driverVehicleControlDatagramSendFailureCount,
    1
  );

  scheduler.runNext(50);

  assert.equal(client.supportsDriverVehicleControlDatagrams, true);
  assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "active");
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.activeTransport,
    "webtransport-datagram"
  );
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
    "Datagram transport unavailable."
  );

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

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 2);
  assert.equal(sentCommands.length, 1);
  assert.equal(client.supportsDriverVehicleControlDatagrams, true);
  assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "active");
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
    null
  );
});

test("MetaverseWorldClient prefers latest-wins traversal intent datagrams over reliable commands when available", async () => {
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
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      latestWinsDatagramTransport: {
        async sendDriverVehicleControlDatagram() {},
        async sendPlayerTraversalIntentDatagram(command) {
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
  client.syncPlayerTraversalIntent({
    intent: {
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0.5,
      strafeAxis: 0.2,
      yawAxis: 0.3
    },
    playerId
  });
  client.syncPlayerTraversalIntent({
    intent: {
      boost: true,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.5
    },
    playerId,
  });

  assert.equal(client.latestPlayerInputSequence, 2);

  scheduledTasks.pop()?.callback();
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentCommands.length, 0);
  assert.deepEqual(
    sentDatagrams[0],
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: true,
        inputSequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0.5
      },
      playerId,
    })
  );
  assert.equal(
    client.telemetrySnapshot.playerTraversalInputDatagramSendFailureCount,
    0
  );
});

test("MetaverseWorldClient prefers latest-wins player look datagrams over reliable commands when available", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("look-harbor-pilot-1");

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
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      latestWinsDatagramTransport: {
        async sendDriverVehicleControlDatagram() {},
        async sendPlayerLookIntentDatagram(command) {
          sentDatagrams.push(command);
        },
        async sendPlayerTraversalIntentDatagram() {}
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
  client.syncPlayerLookIntent({
    lookIntent: {
      pitchRadians: -0.2,
      yawRadians: 0.8
    },
    playerId
  });
  client.syncPlayerLookIntent({
    lookIntent: {
      pitchRadians: -0.35,
      yawRadians: 1.1
    },
    playerId
  });

  scheduledTasks.pop()?.callback();
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentCommands.length, 0);
  assert.deepEqual(
    sentDatagrams[0],
    createMetaverseSyncPlayerLookIntentCommand({
      lookIntent: {
        pitchRadians: -0.35,
        yawRadians: 1.1
      },
      lookSequence: 2,
      playerId
    })
  );
  assert.equal(
    client.telemetrySnapshot.playerTraversalInputDatagramSendFailureCount,
    0
  );
});

test("MetaverseWorldClient preserves a fast jump tap as an acknowledged edge through latest-wins traversal compression", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
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
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      latestWinsDatagramTransport: {
        async sendDriverVehicleControlDatagram() {},
        async sendPlayerTraversalIntentDatagram(command) {
          sentDatagrams.push(command);
        }
      },
      transport: {
        async pollWorldSnapshot() {
          return initialWorldEvent;
        },
        async sendCommand() {
          return initialWorldEvent;
        }
      },
      clearTimeout: scheduler.clearTimeout,
      setTimeout: scheduler.setTimeout
    }
  );

  await client.ensureConnected(playerId);

  client.syncPlayerTraversalIntent({
    intent: {
      boost: false,
      jump: true,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0
    },
    playerId
  });
  client.syncPlayerTraversalIntent({
    intent: {
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0
    },
    playerId
  });

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.deepEqual(
    sentDatagrams[0],
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        jumpActionSequence: 1,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    })
  );
});

test("MetaverseWorldClient falls back to reliable commands after a traversal intent datagram send failure and recovers datagram sends after the cooldown", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentCommands = [];
  const sentDatagrams = [];
  let remainingDatagramFailures = 1;
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
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      latestWinsDatagramTransport: {
        async sendDriverVehicleControlDatagram() {},
        async sendPlayerTraversalIntentDatagram(command) {
          sentDatagrams.push(command);
          if (remainingDatagramFailures > 0) {
            remainingDatagramFailures -= 1;
            throw new Error("Datagram transport unavailable.");
          }
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
      clearTimeout: scheduler.clearTimeout,
      setTimeout: scheduler.setTimeout
    }
  );

  await client.ensureConnected(playerId);

  client.syncPlayerTraversalIntent({
    intent: {
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.5
    },
    playerId,
  });

  assert.equal(client.latestPlayerInputSequence, 1);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentCommands.length, 1);
  assert.equal(client.supportsDriverVehicleControlDatagrams, false);
  assert.equal(
    client.telemetrySnapshot.playerTraversalInputDatagramSendFailureCount,
    1
  );
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.state,
    "degraded-to-reliable"
  );
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
    "Datagram transport unavailable."
  );

  scheduler.runNext(50);

  assert.equal(client.supportsDriverVehicleControlDatagrams, true);
  assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "active");

  client.syncPlayerTraversalIntent({
    intent: {
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0.45
    },
    playerId,
  });

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 2);
  assert.equal(sentCommands.length, 1);
  assert.equal(client.supportsDriverVehicleControlDatagrams, true);
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
    null
  );
});

test("MetaverseWorldClient exposes reliable transport truth through its network-owned resolver", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
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
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 2,
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      resolveReliableTransportStatusSnapshot: () =>
        reliableTransportStatusSnapshot,
      transport: {
        async pollWorldSnapshot() {
          throw new Error("Unexpected world poll.");
        },
        async sendCommand() {
          throw new Error("Unexpected world command.");
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
      defaultPollIntervalMs: createMilliseconds(50),
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
      defaultPollIntervalMs: createMilliseconds(50),
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
  assert.equal(scheduledTasks[0]?.delay, 50);

  scheduledTasks.shift()?.callback();
  await flushAsyncWork();

  assert.equal(client.statusSnapshot.state, "connected");
  assert.equal(client.statusSnapshot.connected, true);
  assert.equal(client.worldSnapshotBuffer.length, 1);
  assert.equal(client.worldSnapshotBuffer[0]?.snapshotSequence, 2);
});

test("MetaverseWorldClient keeps polling until the snapshot stream proves live, falls back on stream failure, and reconnects without accepting stale stream frames", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("stream-harbor-pilot");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const polledPlayerIds = [];
  const streamSubscriptions = [];
  const pollResponses = [
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
      serverTimeMs: 10_050,
      snapshotSequence: 2,
      vehicleX: 8.5
    }),
    createWorldEvent({
      currentTick: 13,
      playerId,
      serverTimeMs: 10_150,
      snapshotSequence: 4,
      vehicleX: 9.5
    })
  ];
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 3,
      serverOrigin: "http://127.0.0.1:3210",
      snapshotStreamReconnectDelayMs: createMilliseconds(20),
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      clearTimeout: scheduler.clearTimeout,
      setTimeout: scheduler.setTimeout,
      snapshotStreamTransport: {
        dispose() {},
        subscribeWorldSnapshots(nextPlayerId, handlers) {
          const subscription = {
            closeCallCount: 0,
            handlers,
            playerId: nextPlayerId
          };

          streamSubscriptions.push(subscription);

          return {
            closed: Promise.resolve(),
            close() {
              subscription.closeCallCount += 1;
            }
          };
        }
      },
      transport: {
        async pollWorldSnapshot(nextPlayerId) {
          const response = pollResponses.shift();

          assert.notEqual(response, undefined);
          polledPlayerIds.push(nextPlayerId);
          return response;
        },
        async sendCommand() {
          return createWorldEvent({
            currentTick: 12,
            playerId,
            serverTimeMs: 10_100,
            snapshotSequence: 3,
            vehicleX: 9
          });
        }
      }
    }
  );

  await client.ensureConnected(playerId);

  assert.deepEqual(polledPlayerIds, [playerId]);
  assert.equal(streamSubscriptions.length, 1);
  assert.equal(streamSubscriptions[0]?.playerId, playerId);
  assert.equal(scheduler.pendingTasks.filter((task) => task.delay === 50).length, 1);
  assert.equal(
    client.telemetrySnapshot.snapshotStream.path,
    "reliable-snapshot-stream"
  );
  assert.equal(client.telemetrySnapshot.snapshotStream.liveness, "subscribed");
  assert.equal(client.telemetrySnapshot.snapshotStream.reconnectCount, 0);

  streamSubscriptions[0]?.handlers.onWorldEvent(
    createWorldEvent({
      currentTick: 9,
      playerId,
      serverTimeMs: 9_950,
      snapshotSequence: 0,
      vehicleX: 7.5
    })
  );

  assert.equal(client.worldSnapshotBuffer[0]?.snapshotSequence, 1);
  assert.equal(scheduler.pendingTasks.filter((task) => task.delay === 50).length, 1);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.deepEqual(polledPlayerIds, [playerId, playerId]);
  assert.equal(client.worldSnapshotBuffer[1]?.snapshotSequence, 2);
  assert.equal(scheduler.pendingTasks.filter((task) => task.delay === 50).length, 1);

  streamSubscriptions[0]?.handlers.onWorldEvent(
    createWorldEvent({
      currentTick: 12,
      playerId,
      serverTimeMs: 10_100,
      snapshotSequence: 3,
      vehicleX: 9
    })
  );

  assert.equal(client.worldSnapshotBuffer[2]?.snapshotSequence, 3);
  assert.equal(
    scheduler.pendingTasks.filter((task) => task.delay === 50).length,
    0
  );

  streamSubscriptions[0]?.handlers.onError(
    new Error("Metaverse world snapshot stream failed.")
  );

  assert.equal(client.statusSnapshot.state, "error");
  assert.equal(client.statusSnapshot.connected, true);
  assert.equal(scheduler.pendingTasks.filter((task) => task.delay === 0).length, 1);
  assert.equal(
    scheduler.pendingTasks.filter((task) => task.delay === 20).length,
    1
  );
  assert.equal(client.telemetrySnapshot.snapshotStream.path, "fallback-polling");
  assert.equal(client.telemetrySnapshot.snapshotStream.liveness, "reconnecting");
  assert.equal(client.telemetrySnapshot.snapshotStream.reconnectCount, 1);
  assert.equal(
    client.telemetrySnapshot.snapshotStream.lastTransportError,
    "Metaverse world snapshot stream failed."
  );

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.deepEqual(polledPlayerIds, [playerId, playerId, playerId]);
  assert.equal(client.statusSnapshot.state, "connected");
  assert.equal(client.worldSnapshotBuffer[2]?.snapshotSequence, 4);
  assert.equal(
    scheduler.pendingTasks.filter((task) => task.delay === 50).length,
    1
  );

  scheduler.runNext(20);

  assert.equal(streamSubscriptions.length, 2);
  assert.equal(
    scheduler.pendingTasks.filter((task) => task.delay === 50).length,
    1
  );
  assert.equal(
    client.telemetrySnapshot.snapshotStream.path,
    "reliable-snapshot-stream"
  );
  assert.equal(client.telemetrySnapshot.snapshotStream.liveness, "subscribed");

  streamSubscriptions[1]?.handlers.onWorldEvent(
    createWorldEvent({
      currentTick: 14,
      playerId,
      serverTimeMs: 10_200,
      snapshotSequence: 5,
      vehicleX: 10
    })
  );

  assert.equal(client.statusSnapshot.state, "connected");
  assert.equal(client.statusSnapshot.lastSnapshotSequence, 5);
  assert.equal(client.worldSnapshotBuffer[2]?.snapshotSequence, 5);
  assert.equal(
    scheduler.pendingTasks.filter((task) => task.delay === 50).length,
    0
  );
  assert.equal(client.telemetrySnapshot.snapshotStream.lastTransportError, null);

  client.dispose();

  assert.equal(streamSubscriptions[1]?.closeCallCount, 1);
});
