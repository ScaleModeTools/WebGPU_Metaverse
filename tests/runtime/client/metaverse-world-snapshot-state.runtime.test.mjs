import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldEvent,
  createMetaverseVehicleId
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createManualTimerScheduler() {
  const clearedHandles = new Set();
  const scheduledTasks = [];
  let nextHandle = 1;

  return Object.freeze({
    clearTimeout(handle) {
      clearedHandles.add(handle);
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
  currentTick,
  playerId,
  snapshotSequence,
  serverTimeMs
}) {
  const vehicleId = createMetaverseVehicleId("metaverse-hub-skiff-v1");

  assert.notEqual(vehicleId, null);

  return createMetaverseRealtimeWorldEvent({
    world: {
      observerPlayer: {
        lastProcessedInputSequence: snapshotSequence,
        lastProcessedLookSequence: snapshotSequence,
        lastProcessedTraversalOrientationSequence: snapshotSequence,
        playerId
      },
      players: [
        {
          characterId: "mesh2motion-humanoid-v1",
          groundedBody: {
            linearVelocity: {
              x: 0,
              y: 0,
              z: 0
            },
            position: {
              x: 0,
              y: 1.62,
              z: 24
            },
            yawRadians: 0
          },
          locomotionMode: "grounded",
          playerId,
          stateSequence: snapshotSequence,
          username: "Harbor Pilot"
        }
      ],
      snapshotSequence,
      tick: {
        currentTick,
        serverTimeMs,
        tickIntervalMs: 50
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
            x: 8,
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

test("MetaverseWorldSnapshotState accepts newer snapshots, tracks update rate, and rejects stale frames", async () => {
  const { MetaverseWorldSnapshotState } = await clientLoader.load(
    "/src/network/classes/metaverse-world-snapshot-state.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const acceptedSources = [];
  const wallClockReads = [1_000, 1_100, 1_200];
  const state = new MetaverseWorldSnapshotState({
    clearTimeout() {},
    maxBufferedSnapshots: 2,
    notifyUpdates() {},
    onAcceptedWorldEvent(worldEvent, source) {
      acceptedSources.push({
        source,
        snapshotSequence: worldEvent.world.snapshotSequence
      });
    },
    readWallClockMs: () => wallClockReads.shift() ?? 1_200,
    setTimeout() {
      throw new Error("Reconnect timer should not schedule in this test.");
    },
    snapshotStreamReconnectDelayMs: 50,
    snapshotStreamTransport: null
  });

  state.beginConnect(playerId);
  assert.equal(state.statusSnapshot.state, "connecting");

  assert.equal(
    state.acceptWorldEvent(
      playerId,
      createWorldEvent({
        currentTick: 10,
        playerId,
        serverTimeMs: 10_000,
        snapshotSequence: 1
      }),
      "polling"
    ),
    true
  );
  assert.equal(state.statusSnapshot.state, "connected");
  assert.equal(state.worldSnapshotBuffer.length, 1);
  assert.equal(state.latestSnapshotUpdateRateHz, null);

  assert.equal(
    state.acceptWorldEvent(
      playerId,
      createWorldEvent({
        currentTick: 9,
        playerId,
        serverTimeMs: 9_900,
        snapshotSequence: 0
      }),
      "polling"
    ),
    false
  );
  assert.equal(state.worldSnapshotBuffer.length, 1);

  state.acceptWorldEvent(
    playerId,
    createWorldEvent({
      currentTick: 11,
      playerId,
      serverTimeMs: 10_100,
      snapshotSequence: 2
    }),
    "command"
  );
  state.acceptWorldEvent(
    playerId,
    createWorldEvent({
      currentTick: 12,
      playerId,
      serverTimeMs: 10_200,
      snapshotSequence: 3
    }),
    "command"
  );

  assert.deepEqual(
    state.worldSnapshotBuffer.map((snapshot) => snapshot.snapshotSequence),
    [2, 3]
  );
  assert.equal(state.statusSnapshot.lastSnapshotSequence, 3);
  assert.equal(state.statusSnapshot.lastWorldTick, 12);
  assert.equal(state.latestSnapshotUpdateRateHz, 10);
  assert.deepEqual(acceptedSources, [
    {
      snapshotSequence: 1,
      source: "polling"
    },
    {
      snapshotSequence: 2,
      source: "command"
    },
    {
      snapshotSequence: 3,
      source: "command"
    }
  ]);
});

test("MetaverseWorldSnapshotState falls back, reconnects, and only leaves polling after a live stream snapshot is accepted", async () => {
  const { MetaverseWorldSnapshotState } = await clientLoader.load(
    "/src/network/classes/metaverse-world-snapshot-state.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const acceptedSources = [];
  const streamFailures = [];
  const subscriptions = [];
  const state = new MetaverseWorldSnapshotState({
    clearTimeout: scheduler.clearTimeout,
    maxBufferedSnapshots: 3,
    notifyUpdates() {},
    onAcceptedWorldEvent(worldEvent, source) {
      acceptedSources.push({
        source,
        snapshotSequence: worldEvent.world.snapshotSequence
      });
    },
    onSnapshotStreamFailure(message) {
      streamFailures.push(message);
    },
    readWallClockMs: (() => {
      let wallClockMs = 10_000;

      return () => {
        wallClockMs += 100;
        return wallClockMs;
      };
    })(),
    setTimeout: scheduler.setTimeout,
    snapshotStreamReconnectDelayMs: 50,
    snapshotStreamTransport: {
      subscribeWorldSnapshots(_playerId, handlers) {
        subscriptions.push(handlers);

        return Object.freeze({
          close() {}
        });
      }
    }
  });

  state.beginConnect(playerId);
  state.acceptWorldEvent(
    playerId,
    createWorldEvent({
      currentTick: 10,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1
    }),
    "polling"
  );

  state.startSnapshotStream(playerId);
  assert.equal(state.shouldUsePollingHappyPath(), true);
  assert.equal(
    state.snapshotStreamTelemetrySnapshot.path,
    "reliable-snapshot-stream"
  );
  assert.equal(state.snapshotStreamTelemetrySnapshot.liveness, "subscribed");
  assert.equal(subscriptions.length, 1);

  subscriptions[0]?.onWorldEvent(
    createWorldEvent({
      currentTick: 9,
      playerId,
      serverTimeMs: 9_900,
      snapshotSequence: 0
    })
  );
  assert.equal(state.worldSnapshotBuffer.at(-1)?.snapshotSequence, 1);
  assert.equal(state.shouldUsePollingHappyPath(), true);

  subscriptions[0]?.onError(new Error("Metaverse world snapshot stream failed."));
  assert.deepEqual(streamFailures, ["Metaverse world snapshot stream failed."]);
  assert.equal(state.shouldUsePollingHappyPath(), true);
  assert.equal(state.snapshotStreamTelemetrySnapshot.path, "fallback-polling");
  assert.equal(
    state.snapshotStreamTelemetrySnapshot.liveness,
    "reconnecting"
  );
  assert.equal(state.snapshotStreamTelemetrySnapshot.reconnectCount, 1);
  assert.equal(
    state.snapshotStreamTelemetrySnapshot.lastTransportError,
    "Metaverse world snapshot stream failed."
  );

  scheduler.runNext(50);

  assert.equal(subscriptions.length, 2);

  subscriptions[1]?.onWorldEvent(
    createWorldEvent({
      currentTick: 12,
      playerId,
      serverTimeMs: 10_200,
      snapshotSequence: 2
    })
  );

  assert.equal(state.shouldUsePollingHappyPath(), false);
  assert.equal(
    state.snapshotStreamTelemetrySnapshot.path,
    "reliable-snapshot-stream"
  );
  assert.equal(state.snapshotStreamTelemetrySnapshot.liveness, "subscribed");
  assert.equal(state.snapshotStreamTelemetrySnapshot.lastTransportError, null);
  assert.deepEqual(acceptedSources, [
    {
      snapshotSequence: 1,
      source: "polling"
    },
    {
      snapshotSequence: 2,
      source: "snapshot-stream"
    }
  ]);
  assert.equal(state.worldSnapshotBuffer.at(-1)?.snapshotSequence, 2);
});
