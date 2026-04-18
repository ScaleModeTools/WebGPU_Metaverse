import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldEvent,
  createMetaverseSyncPlayerLookIntentCommand
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

function createManualTimerScheduler() {
  const clearedHandles = new Set();
  const scheduledTasks = [];
  let nextHandle = 1;

  return Object.freeze({
    clearTimeout(handle) {
      clearedHandles.add(handle);
    },
    get pendingTasks() {
      return scheduledTasks.filter((task) => !clearedHandles.has(task.handle));
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
  lastProcessedLookSequence = 0,
  serverTimeMs,
  tickIntervalMs = 50
}) {
  return createMetaverseRealtimeWorldEvent({
    world: {
      players: [
        {
          characterId: "metaverse-mannequin-v1",
          lastProcessedInputSequence: 0,
          lastProcessedLookSequence,
          lastProcessedTraversalOrientationSequence: 0,
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
        tickIntervalMs
      },
      vehicles: []
    }
  });
}

function createConnectedStatusSnapshot(playerId, connected = true) {
  return Object.freeze({
    connected,
    lastError: null,
    lastSnapshotSequence: null,
    lastWorldTick: null,
    playerId,
    state: connected ? "connected" : "connecting"
  });
}

test("MetaverseWorldPlayerLookSync resends player look until authoritative look acks catch up", async () => {
  const { MetaverseWorldPlayerLookSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-look-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-look-ack-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentLookCommands = [];
  let localPlayerSnapshot = createWorldEvent({
    currentTick: 10,
    lastProcessedLookSequence: 0,
    playerId,
    serverTimeMs: 10_000,
    snapshotSequence: 1
  }).world.players[0];
  const lookSync = new MetaverseWorldPlayerLookSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId),
    resolveCommandDelayMs: () => 50,
    async sendPlayerLookIntentCommand(command) {
      sentLookCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  lookSync.syncPlayerLookIntent({
    lookIntent: {
      pitchRadians: -0.35,
      yawRadians: 1.1
    },
    playerId
  });

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentLookCommands.length, 1);
  assert.deepEqual(
    sentLookCommands[0],
    createMetaverseSyncPlayerLookIntentCommand({
      lookIntent: {
        pitchRadians: -0.35,
        yawRadians: 1.1
      },
      lookSequence: 1,
      playerId
    })
  );
  assert.equal(scheduler.pendingTasks.at(-1)?.delay, 50);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentLookCommands.length, 2);
  assert.equal(sentLookCommands[1]?.lookSequence, 1);

  localPlayerSnapshot = createWorldEvent({
    currentTick: 11,
    lastProcessedLookSequence: 1,
    playerId,
    serverTimeMs: 10_050,
    snapshotSequence: 2
  }).world.players[0];
  lookSync.syncFromAuthoritativeWorld();

  assert.equal(scheduler.pendingTasks.length, 0);
});

test("MetaverseWorldPlayerLookSync rebases queued look sequences above authoritative reconnect state", async () => {
  const { MetaverseWorldPlayerLookSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-look-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-look-reconnect-rebase-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentLookCommands = [];
  let connected = false;
  let localPlayerSnapshot = createWorldEvent({
    currentTick: 10,
    lastProcessedLookSequence: 418,
    playerId,
    serverTimeMs: 10_000,
    snapshotSequence: 1
  }).world.players[0];
  const lookSync = new MetaverseWorldPlayerLookSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId, connected),
    resolveCommandDelayMs: () => 50,
    async sendPlayerLookIntentCommand(command) {
      sentLookCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  lookSync.syncPlayerLookIntent({
    lookIntent: {
      pitchRadians: -0.2,
      yawRadians: 0.8
    },
    playerId
  });

  assert.equal(lookSync.latestPlayerLookSequence, 1);

  connected = true;
  lookSync.syncFromAuthoritativeWorld();

  assert.equal(lookSync.latestPlayerLookSequence, 419);
  assert.equal(scheduler.pendingTasks.length, 1);
  assert.equal(scheduler.pendingTasks[0]?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentLookCommands.length, 1);
  assert.equal(sentLookCommands[0]?.lookSequence, 419);
});
