import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaversePlayerId,
  createMilliseconds
} from "@webgpu-metaverse/shared";

import {
  createManualTimerScheduler,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createTraversalIntentInput,
  createWorldEvent,
  flushAsyncWork
} from "./fixtures/metaverse-world-network-test-fixtures.mjs";
import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createPassiveSnapshotStreamTransport(initialWorldEvent = null) {
  return Object.freeze({
    subscribeWorldSnapshots(_playerId, handlers) {
      if (initialWorldEvent !== null) {
        handlers.onWorldEvent(initialWorldEvent);
      }

      return Object.freeze({
        close() {}
      });
    }
  });
}

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

test("MetaverseWorldClient prefers latest-wins traversal intent datagrams over reliable commands when available", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentCommands = [];
  const sentDatagrams = [];
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    lastProcessedInputSequence: 0,
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
      snapshotStreamTransport: createPassiveSnapshotStreamTransport(
        initialWorldEvent
      ),
      transport: {
        async pollWorldSnapshot() {
          return initialWorldEvent;
        },
        async sendCommand(command) {
          sentCommands.push(command);
          return initialWorldEvent;
        }
      },
      readWallClockMs: () => 0,
      clearTimeout: scheduler.clearTimeout,
      setTimeout: scheduler.setTimeout
    }
  );

  await client.ensureConnected(playerId);
  client.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0.5,
      strafeAxis: 0.2,
      yawAxis: 0.3
    }),
    playerId
  });
  client.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: true,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.5
    }),
    playerId,
  });

  assert.equal(client.latestPlayerInputSequence, 2);
  assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentCommands.length, 0);
  assert.deepEqual(
    sentDatagrams[0],
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        actionIntent: {
          kind: "none",
          pressed: false,
          sequence: 0
        },
        bodyControl: {
          boost: true,
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0.5
        },
        facing: {
          pitchRadians: 0,
          yawRadians: 0
        },
        inputSequence: 2,
        locomotionMode: "grounded",
        orientationSequence: 2,
        sampleId: 2,
      },
      playerId,
    })
  );
  assert.equal(
    client.telemetrySnapshot.playerTraversalInputDatagramSendFailureCount,
    0
  );
});

test("MetaverseWorldClient flushes traversal intent changes immediately and resends until authority acks the latest input sequence", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("turn-window-harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentDatagrams = [];
  let wallClockMs = 10_000;
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    lastProcessedInputSequence: 0,
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
      snapshotStreamTransport: createPassiveSnapshotStreamTransport(
        initialWorldEvent
      ),
      transport: {
        async pollWorldSnapshot() {
          return initialWorldEvent;
        },
        async sendCommand() {
          return initialWorldEvent;
        }
      },
      clearTimeout: scheduler.clearTimeout,
      readWallClockMs: () => wallClockMs,
      setTimeout: scheduler.setTimeout
    }
  );

  await client.ensureConnected(playerId);

  client.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.25
    }),
    playerId
  });

  assert.equal(scheduler.pendingTasks.length, 1);
  assert.equal(scheduler.pendingTasks[0]?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentDatagrams[0]?.intent.inputSequence, 1);
  assert.equal(scheduler.pendingTasks.at(-1)?.delay, 50);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 2);
  assert.equal(sentDatagrams[1]?.intent.inputSequence, 1);
});

test("MetaverseWorldClient keeps pure facing turns on the traversal lane without advancing movement ack sequence", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("turn-in-place-harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentDatagrams = [];
  let wallClockMs = 10_000;
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    lastProcessedInputSequence: 0,
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
      snapshotStreamTransport: createPassiveSnapshotStreamTransport(
        initialWorldEvent
      ),
      transport: {
        async pollWorldSnapshot() {
          return initialWorldEvent;
        },
        async sendCommand() {
          return initialWorldEvent;
        }
      },
      clearTimeout: scheduler.clearTimeout,
      readWallClockMs: () => wallClockMs,
      setTimeout: scheduler.setTimeout
    }
  );

  await client.ensureConnected(playerId);

  client.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0,
      yawRadians: 0
    }),
    playerId
  });
  wallClockMs += 16;
  client.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0.25,
      yawRadians: Math.PI * 0.5
    }),
    playerId
  });

  assert.equal(client.latestPlayerInputSequence, 1);
  assert.equal(client.latestPlayerTraversalOrientationSequence, 2);
  assert.equal(client.latestPlayerIssuedTraversalIntentSnapshot?.inputSequence, 1);
  assert.equal(
    client.latestPlayerIssuedTraversalIntentSnapshot?.orientationSequence,
    2
  );

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentDatagrams[0]?.intent.inputSequence, 1);
  assert.equal(sentDatagrams[0]?.intent.orientationSequence, 2);
  assert.equal(sentDatagrams[0]?.intent.bodyControl.turnAxis, 0.25);
  assert.equal(sentDatagrams[0]?.intent.facing.yawRadians, Math.PI * 0.5);
});

test("MetaverseWorldClient keeps resending stationary traversal facing refreshes until orientation ack catches up", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("stationary-facing-ack-harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentDatagrams = [];
  let snapshotStreamHandlers = null;
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    lastProcessedInputSequence: 0,
    lastProcessedTraversalOrientationSequence: 0,
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
      snapshotStreamTransport: {
        subscribeWorldSnapshots(_playerId, handlers) {
          snapshotStreamHandlers = handlers;
          handlers.onWorldEvent(initialWorldEvent);
          return Object.freeze({
            close() {}
          });
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
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0,
      yawRadians: 0
    }),
    playerId
  });

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentDatagrams[0]?.intent.inputSequence, 1);
  assert.equal(sentDatagrams[0]?.intent.orientationSequence, 1);

  snapshotStreamHandlers?.onWorldEvent(
    createWorldEvent({
      currentTick: 11,
      lastProcessedInputSequence: 1,
      lastProcessedTraversalOrientationSequence: 1,
      playerId,
      serverTimeMs: 10_050,
      snapshotSequence: 2,
      vehicleX: 8
    })
  );

  client.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0.4,
      yawRadians: Math.PI * 0.5
    }),
    playerId
  });

  assert.equal(client.latestPlayerInputSequence, 1);
  assert.equal(client.latestPlayerTraversalOrientationSequence, 2);
  assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 2);
  assert.equal(sentDatagrams[1]?.intent.inputSequence, 1);
  assert.equal(sentDatagrams[1]?.intent.orientationSequence, 2);
  assert.equal(scheduler.pendingTasks.at(-1)?.delay, 50);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 3);
  assert.equal(sentDatagrams[2]?.intent.inputSequence, 1);
  assert.equal(sentDatagrams[2]?.intent.orientationSequence, 2);

  snapshotStreamHandlers?.onWorldEvent(
    createWorldEvent({
      currentTick: 12,
      lastProcessedInputSequence: 1,
      lastProcessedTraversalOrientationSequence: 2,
      playerId,
      serverTimeMs: 10_100,
      snapshotSequence: 3,
      vehicleX: 8
    })
  );

  assert.equal(scheduler.pendingTasks.length, 0);
});

test("MetaverseWorldClient prefers latest-wins player look datagrams over reliable commands when available", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("look-harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentCommands = [];
  const sentDatagrams = [];
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    lastProcessedLookSequence: 0,
    playerId,
    serverTimeMs: 10_000,
    snapshotSequence: 1,
    vehicleX: 8
  });
  let snapshotStreamHandlers = null;
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
      snapshotStreamTransport: {
        subscribeWorldSnapshots(_playerId, handlers) {
          snapshotStreamHandlers = handlers;
          handlers.onWorldEvent(initialWorldEvent);
          return Object.freeze({
            close() {}
          });
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

  assert.equal(scheduler.pendingTasks.length, 1);
  assert.equal(scheduler.pendingTasks[0]?.delay, 0);

  scheduler.runNext(0);
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
  assert.equal(scheduler.pendingTasks.length, 1);
  assert.equal(scheduler.pendingTasks[0]?.delay, 50);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 2);
  assert.equal(sentDatagrams[1]?.lookSequence, 2);

  snapshotStreamHandlers?.onWorldEvent(
    createWorldEvent({
      currentTick: 11,
      lastProcessedLookSequence: 2,
      playerId,
      serverTimeMs: 10_050,
      snapshotSequence: 2,
      vehicleX: 8
    })
  );

  assert.equal(sentDatagrams.length, 2);
  assert.equal(
    client.telemetrySnapshot.playerTraversalInputDatagramSendFailureCount,
    0
  );
});

test("MetaverseWorldClient rebases queued traversal jump and look sequences above authoritative reconnect state", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("reconnect-sequence-harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentLookDatagrams = [];
  const sentTraversalDatagrams = [];
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    lastProcessedInputSequence: 734,
    authoritativeJumpActionSequence: 52,
    lastProcessedLookSequence: 418,
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
          sentLookDatagrams.push(command);
        },
        async sendPlayerTraversalIntentDatagram(command) {
          sentTraversalDatagrams.push(command);
        }
      },
      snapshotStreamTransport: createPassiveSnapshotStreamTransport(
        initialWorldEvent
      ),
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

  client.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: true,
      locomotionMode: "grounded",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0
    }),
    playerId
  });
  client.syncPlayerLookIntent({
    lookIntent: {
      pitchRadians: -0.2,
      yawRadians: 0.8
    },
    playerId
  });

  assert.equal(client.latestPlayerInputSequence, 1);

  await client.ensureConnected(playerId);

  assert.equal(client.latestPlayerInputSequence, 735);
  assert.equal(scheduler.pendingTasks.length, 2);
  assert.equal(
    scheduler.pendingTasks.every((task) => task.delay === 0),
    true
  );

  scheduler.runNext(0);
  await flushAsyncWork();
  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentTraversalDatagrams.length, 1);
  assert.equal(sentTraversalDatagrams[0]?.intent.inputSequence, 735);
  assert.equal(
    sentTraversalDatagrams[0]?.intent.actionIntent.sequence,
    53
  );
  assert.equal(sentLookDatagrams.length, 1);
  assert.equal(sentLookDatagrams[0]?.lookSequence, 419);
});

test("MetaverseWorldClient preserves a fast jump tap as an acknowledged edge through latest-wins traversal compression", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentDatagrams = [];
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    lastProcessedInputSequence: 0,
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
      snapshotStreamTransport: createPassiveSnapshotStreamTransport(
        initialWorldEvent
      ),
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
    intent: createTraversalIntentInput({
      boost: false,
      jump: true,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0
    }),
    playerId
  });
  client.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0
    }),
    playerId
  });

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentDatagrams[0]?.intent.inputSequence, 2);
  assert.equal(sentDatagrams[0]?.intent.orientationSequence, 1);
  assert.equal(sentDatagrams[0]?.intent.actionIntent.kind, "jump");
  assert.equal(sentDatagrams[0]?.intent.actionIntent.pressed, false);
  assert.equal(sentDatagrams[0]?.intent.actionIntent.sequence, 1);
  assert.equal(typeof sentDatagrams[0]?.estimatedServerTimeMs, "number");
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
    lastProcessedInputSequence: 0,
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
      snapshotStreamTransport: createPassiveSnapshotStreamTransport(
        initialWorldEvent
      ),
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
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.5
    }),
    playerId,
  });

  assert.equal(client.latestPlayerInputSequence, 1);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentCommands.length, 1);
  assert.equal(client.supportsDriverVehicleControlDatagrams, true);
  assert.equal(
    client.telemetrySnapshot.playerTraversalInputDatagramSendFailureCount,
    1
  );
  assert.equal(
    client.telemetrySnapshot.playerLookInputDatagramSendFailureCount,
    0
  );
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.state,
    "active"
  );
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
    null
  );

  scheduler.runNext(50);

  assert.equal(client.supportsDriverVehicleControlDatagrams, true);
  assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "active");

  client.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0.45
    }),
    playerId,
  });

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 2);
  assert.equal(sentCommands.length, 1);
  assert.equal(client.supportsDriverVehicleControlDatagrams, true);
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
    null
  );
});

test("MetaverseWorldClient keeps mounted look datagram fallback local to the look lane", async () => {
  const { MetaverseWorldClient } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("look-lane-harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentCommands = [];
  const sentLookDatagrams = [];
  let remainingLookFailures = 1;
  let snapshotStreamHandlers = null;
  const initialWorldEvent = createWorldEvent({
    currentTick: 10,
    lastProcessedLookSequence: 0,
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
          sentLookDatagrams.push(command);
          if (remainingLookFailures > 0) {
            remainingLookFailures -= 1;
            throw new Error("Mounted look datagram unavailable.");
          }
        },
        async sendPlayerTraversalIntentDatagram() {}
      },
      snapshotStreamTransport: {
        subscribeWorldSnapshots(_playerId, handlers) {
          snapshotStreamHandlers = handlers;
          handlers.onWorldEvent(initialWorldEvent);
          return Object.freeze({
            close() {}
          });
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

  client.syncPlayerLookIntent({
    lookIntent: {
      pitchRadians: -0.25,
      yawRadians: 0.9
    },
    playerId
  });

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentLookDatagrams.length, 1);
  assert.equal(sentCommands.length, 1);
  assert.equal(client.supportsDriverVehicleControlDatagrams, true);
  assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "active");
  assert.equal(
    client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
    null
  );
  assert.equal(
    client.telemetrySnapshot.playerLookInputDatagramSendFailureCount,
    1
  );
  assert.equal(
    client.telemetrySnapshot.playerTraversalInputDatagramSendFailureCount,
    0
  );

  scheduler.runNext(50);

  client.syncPlayerLookIntent({
    lookIntent: {
      pitchRadians: -0.4,
      yawRadians: 1.2
    },
    playerId
  });

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentLookDatagrams.length, 2);
  assert.equal(sentCommands.length, 1);

  snapshotStreamHandlers?.onWorldEvent(
    createWorldEvent({
      currentTick: 11,
      lastProcessedLookSequence: 2,
      playerId,
      serverTimeMs: 10_050,
      snapshotSequence: 2,
      vehicleX: 8
    })
  );

  assert.equal(
    client.telemetrySnapshot.playerLookInputDatagramSendFailureCount,
    1
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
