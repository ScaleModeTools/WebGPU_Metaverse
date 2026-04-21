import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseSyncPlayerLookIntentCommand
} from "@webgpu-metaverse/shared";

import {
  createConnectedStatusSnapshot,
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
  }).world.observerPlayer;
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
  }).world.observerPlayer;
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
  }).world.observerPlayer;
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
