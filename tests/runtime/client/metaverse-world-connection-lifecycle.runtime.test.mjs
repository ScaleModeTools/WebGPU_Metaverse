import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createMetaversePlayerId } from "@webgpu-metaverse/shared";

import {
  createManualTimerScheduler,
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

test("MetaverseWorldConnectionLifecycle binds one player, polls, and cancels scheduled polling on dispose", async () => {
  const { MetaverseWorldConnectionLifecycle } = await clientLoader.load(
    "/src/network/classes/metaverse-world-connection-lifecycle.ts"
  );
  const { MetaverseWorldSnapshotState } = await clientLoader.load(
    "/src/network/classes/metaverse-world-snapshot-state.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const requests = [];
  const pollResponses = [
    createWorldEvent({
      currentTick: 10,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1
    }),
    createWorldEvent({
      currentTick: 11,
      playerId,
      serverTimeMs: 10_050,
      snapshotSequence: 2,
      vehicleX: 8.5
    })
  ];
  const snapshotState = new MetaverseWorldSnapshotState({
    clearTimeout: scheduler.clearTimeout,
    maxBufferedSnapshots: 2,
    notifyUpdates() {},
    onSnapshotStreamFailure() {},
    readWallClockMs: () => 10_000,
    setTimeout: scheduler.setTimeout,
    snapshotStreamReconnectDelayMs: 20,
    snapshotStreamTransport: null
  });
  const lifecycle = new MetaverseWorldConnectionLifecycle({
    acceptWorldEvent(nextPlayerId, worldEvent, source) {
      snapshotState.acceptWorldEvent(nextPlayerId, worldEvent, source);
    },
    applyWorldAccessError(error) {
      throw error;
    },
    beginConnect(nextPlayerId) {
      snapshotState.beginConnect(nextPlayerId);
    },
    clearTimeout: scheduler.clearTimeout,
    async pollWorldSnapshot(nextPlayerId) {
      const response = pollResponses.shift();

      assert.notEqual(response, undefined);
      requests.push({
        playerId: nextPlayerId,
        type: "poll"
      });
      return response;
    },
    readStatusSnapshot: () => snapshotState.statusSnapshot,
    readWorldSnapshotBuffer: () => snapshotState.worldSnapshotBuffer,
    resolvePollDelayMs: () => snapshotState.resolvePollDelayMs(50),
    setError(playerIdForError, message) {
      snapshotState.setError(playerIdForError, message);
    },
    setTimeout: scheduler.setTimeout,
    shouldUsePollingHappyPath: () => snapshotState.shouldUsePollingHappyPath(),
    startSnapshotStream(nextPlayerId) {
      snapshotState.startSnapshotStream(nextPlayerId);
    },
    supportsSnapshotStream: () => snapshotState.supportsSnapshotStream,
    syncConnectedOwners() {}
  });

  const firstSnapshot = await lifecycle.ensureConnected(playerId);

  assert.equal(firstSnapshot.snapshotSequence, 1);
  assert.equal(snapshotState.statusSnapshot.connected, true);
  assert.equal(snapshotState.statusSnapshot.state, "connected");
  assert.equal(snapshotState.worldSnapshotBuffer.length, 1);
  assert.equal(requests[0]?.type, "poll");
  assert.equal(requests[0]?.playerId, playerId);
  assert.equal(scheduler.pendingTasks[0]?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(snapshotState.worldSnapshotBuffer.length, 2);
  assert.equal(snapshotState.worldSnapshotBuffer[1]?.snapshotSequence, 2);
  assert.equal(snapshotState.statusSnapshot.lastWorldTick, 11);
  assert.equal(scheduler.pendingTasks[0]?.delay, 50);

  lifecycle.dispose();

  assert.equal(scheduler.clearedCount >= 1, true);
});

test("MetaverseWorldConnectionLifecycle keeps polling until the snapshot stream proves live, falls back on stream failure, and reconnects without accepting stale stream frames", async () => {
  const { MetaverseWorldConnectionLifecycle } = await clientLoader.load(
    "/src/network/classes/metaverse-world-connection-lifecycle.ts"
  );
  const { MetaverseWorldSnapshotState } = await clientLoader.load(
    "/src/network/classes/metaverse-world-snapshot-state.ts"
  );
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
  let lifecycle = null;
  const snapshotState = new MetaverseWorldSnapshotState({
    clearTimeout: scheduler.clearTimeout,
    maxBufferedSnapshots: 3,
    notifyUpdates() {},
    onAcceptedWorldEvent(_worldEvent, source) {
      if (source === "snapshot-stream") {
        lifecycle?.cancelPolling();
      }
    },
    onSnapshotStreamFailure(message) {
      lifecycle?.handleSnapshotStreamFailure(message);
    },
    readWallClockMs: () => 10_000,
    setTimeout: scheduler.setTimeout,
    snapshotStreamReconnectDelayMs: 20,
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
    }
  });
  lifecycle = new MetaverseWorldConnectionLifecycle({
    acceptWorldEvent(nextPlayerId, worldEvent, source) {
      snapshotState.acceptWorldEvent(nextPlayerId, worldEvent, source);
    },
    applyWorldAccessError(error, fallbackMessage) {
      const message = error instanceof Error ? error.message : fallbackMessage;

      snapshotState.setError(lifecycle.playerId, message);
    },
    beginConnect(nextPlayerId) {
      snapshotState.beginConnect(nextPlayerId);
    },
    clearTimeout: scheduler.clearTimeout,
    async pollWorldSnapshot(nextPlayerId) {
      const response = pollResponses.shift();

      assert.notEqual(response, undefined);
      polledPlayerIds.push(nextPlayerId);
      return response;
    },
    readStatusSnapshot: () => snapshotState.statusSnapshot,
    readWorldSnapshotBuffer: () => snapshotState.worldSnapshotBuffer,
    resolvePollDelayMs: () => snapshotState.resolvePollDelayMs(50),
    setError(playerIdForError, message) {
      snapshotState.setError(playerIdForError, message);
    },
    setTimeout: scheduler.setTimeout,
    shouldUsePollingHappyPath: () => snapshotState.shouldUsePollingHappyPath(),
    startSnapshotStream(nextPlayerId) {
      snapshotState.startSnapshotStream(nextPlayerId);
    },
    supportsSnapshotStream: () => snapshotState.supportsSnapshotStream,
    syncConnectedOwners() {}
  });

  await lifecycle.ensureConnected(playerId);

  assert.deepEqual(polledPlayerIds, [playerId]);
  assert.equal(streamSubscriptions.length, 1);
  assert.equal(streamSubscriptions[0]?.playerId, playerId);
  assert.equal(scheduler.pendingTasks.filter((task) => task.delay === 50).length, 1);
  assert.equal(snapshotState.snapshotStreamTelemetrySnapshot.path, "reliable-snapshot-stream");
  assert.equal(snapshotState.snapshotStreamTelemetrySnapshot.liveness, "subscribed");
  assert.equal(snapshotState.snapshotStreamTelemetrySnapshot.reconnectCount, 0);

  streamSubscriptions[0]?.handlers.onWorldEvent(
    createWorldEvent({
      currentTick: 9,
      playerId,
      serverTimeMs: 9_950,
      snapshotSequence: 0,
      vehicleX: 7.5
    })
  );

  assert.equal(snapshotState.worldSnapshotBuffer[0]?.snapshotSequence, 1);
  assert.equal(scheduler.pendingTasks.filter((task) => task.delay === 50).length, 1);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.deepEqual(polledPlayerIds, [playerId, playerId]);
  assert.equal(snapshotState.worldSnapshotBuffer[1]?.snapshotSequence, 2);
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

  assert.equal(snapshotState.worldSnapshotBuffer[2]?.snapshotSequence, 3);
  assert.equal(
    scheduler.pendingTasks.filter((task) => task.delay === 50).length,
    0
  );

  streamSubscriptions[0]?.handlers.onError(
    new Error("Metaverse world snapshot stream failed.")
  );

  assert.equal(snapshotState.statusSnapshot.state, "error");
  assert.equal(snapshotState.statusSnapshot.connected, true);
  assert.equal(scheduler.pendingTasks.filter((task) => task.delay === 0).length, 1);
  assert.equal(
    scheduler.pendingTasks.filter((task) => task.delay === 20).length,
    1
  );
  assert.equal(snapshotState.snapshotStreamTelemetrySnapshot.path, "fallback-polling");
  assert.equal(snapshotState.snapshotStreamTelemetrySnapshot.liveness, "reconnecting");
  assert.equal(snapshotState.snapshotStreamTelemetrySnapshot.reconnectCount, 1);
  assert.equal(
    snapshotState.snapshotStreamTelemetrySnapshot.lastTransportError,
    "Metaverse world snapshot stream failed."
  );

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.deepEqual(polledPlayerIds, [playerId, playerId, playerId]);
  assert.equal(snapshotState.statusSnapshot.state, "connected");
  assert.equal(snapshotState.worldSnapshotBuffer[2]?.snapshotSequence, 4);
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
    snapshotState.snapshotStreamTelemetrySnapshot.path,
    "reliable-snapshot-stream"
  );
  assert.equal(snapshotState.snapshotStreamTelemetrySnapshot.liveness, "subscribed");

  streamSubscriptions[1]?.handlers.onWorldEvent(
    createWorldEvent({
      currentTick: 14,
      playerId,
      serverTimeMs: 10_200,
      snapshotSequence: 5,
      vehicleX: 10
    })
  );

  assert.equal(snapshotState.statusSnapshot.state, "connected");
  assert.equal(snapshotState.statusSnapshot.lastSnapshotSequence, 5);
  assert.equal(snapshotState.worldSnapshotBuffer[2]?.snapshotSequence, 5);
  assert.equal(
    scheduler.pendingTasks.filter((task) => task.delay === 50).length,
    0
  );
  assert.equal(snapshotState.snapshotStreamTelemetrySnapshot.lastTransportError, null);

  lifecycle.dispose();
  snapshotState.dispose(lifecycle.playerId);

  assert.equal(streamSubscriptions[1]?.closeCallCount, 1);
});

test("MetaverseWorldConnectionLifecycle rejects a second player binding after the first player is claimed", async () => {
  const { MetaverseWorldConnectionLifecycle } = await clientLoader.load(
    "/src/network/classes/metaverse-world-connection-lifecycle.ts"
  );
  const firstPlayerId = createMetaversePlayerId("bound-harbor-pilot-1");
  const secondPlayerId = createMetaversePlayerId("bound-harbor-pilot-2");

  assert.notEqual(firstPlayerId, null);
  assert.notEqual(secondPlayerId, null);

  let statusSnapshot = Object.freeze({
    connected: false,
    lastError: null,
    lastSnapshotSequence: null,
    lastWorldTick: null,
    playerId: null,
    state: "idle"
  });
  const lifecycle = new MetaverseWorldConnectionLifecycle({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    beginConnect(playerId) {
      statusSnapshot = Object.freeze({
        ...statusSnapshot,
        playerId,
        state: "connecting"
      });
    },
    clearTimeout() {},
    async pollWorldSnapshot() {
      throw new Error("Unexpected poll.");
    },
    readStatusSnapshot: () => statusSnapshot,
    readWorldSnapshotBuffer: () => Object.freeze([]),
    resolvePollDelayMs: () => 50,
    setError(playerId, message) {
      statusSnapshot = Object.freeze({
        ...statusSnapshot,
        lastError: message,
        playerId,
        state: "error"
      });
    },
    setTimeout() {
      throw new Error("Unexpected timer.");
    },
    shouldUsePollingHappyPath: () => false,
    startSnapshotStream() {},
    supportsSnapshotStream: () => false,
    syncConnectedOwners() {}
  });

  lifecycle.bindPlayer(firstPlayerId);

  assert.throws(() => {
    lifecycle.bindPlayer(secondPlayerId);
  }, /already connected with a different player/);
});
