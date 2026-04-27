import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createMetaversePlayerId } from "@webgpu-metaverse/shared";

import {
  createConnectedStatusSnapshot,
  createManualTimerScheduler,
  createWorldEvent,
  flushAsyncWork,
  readLocalPlayerSnapshot
} from "./fixtures/metaverse-world-network-test-fixtures.mjs";
import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseWorldPlayerWeaponStateSync sends an initial null weapon state", async () => {
  const { MetaverseWorldPlayerWeaponStateSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-weapon-state-sync.ts"
  );
  const playerId = createMetaversePlayerId("weapon-sync-no-weapon-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentWeaponCommands = [];
  const localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 10,
      lastProcessedWeaponSequence: 0,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1
    })
  );
  const weaponStateSync = new MetaverseWorldPlayerWeaponStateSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId),
    resolveCommandDelayMs: () => 50,
    async sendPlayerWeaponStateCommand(command) {
      sentWeaponCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  weaponStateSync.syncPlayerWeaponState({
    playerId,
    weaponState: null
  });

  assert.equal(weaponStateSync.latestPlayerWeaponSequence, 1);
  assert.equal(scheduler.pendingTasks.length, 1);
  assert.equal(scheduler.pendingTasks[0]?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentWeaponCommands.length, 1);
  assert.equal(sentWeaponCommands[0]?.weaponSequence, 1);
  assert.equal(sentWeaponCommands[0]?.weaponState, null);

  weaponStateSync.syncPlayerWeaponState({
    playerId,
    weaponState: null
  });

  assert.equal(weaponStateSync.latestPlayerWeaponSequence, 1);
});

test("MetaverseWorldPlayerWeaponStateSync resends weapon state until authoritative weapon ack catches up", async () => {
  const { MetaverseWorldPlayerWeaponStateSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-weapon-state-sync.ts"
  );
  const playerId = createMetaversePlayerId("weapon-sync-ack-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentWeaponCommands = [];
  let localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 10,
      lastProcessedWeaponSequence: 0,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1
    })
  );
  const weaponStateSync = new MetaverseWorldPlayerWeaponStateSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId),
    resolveCommandDelayMs: () => 50,
    async sendPlayerWeaponStateCommand(command) {
      sentWeaponCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  weaponStateSync.syncPlayerWeaponState({
    playerId,
    weaponState: {
      aimMode: "ads",
      weaponId: "duck-hunt-pistol"
    }
  });

  assert.equal(weaponStateSync.latestPlayerWeaponSequence, 1);
  assert.equal(scheduler.pendingTasks.length, 1);
  assert.equal(scheduler.pendingTasks[0]?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentWeaponCommands.length, 1);
  assert.equal(sentWeaponCommands[0]?.weaponSequence, 1);
  assert.equal(sentWeaponCommands[0]?.weaponState?.aimMode, "ads");
  assert.equal(sentWeaponCommands[0]?.weaponState?.weaponId, "duck-hunt-pistol");
  assert.equal(scheduler.pendingTasks.at(-1)?.delay, 50);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentWeaponCommands.length, 2);
  assert.equal(sentWeaponCommands[1]?.weaponSequence, 1);

  localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 11,
      lastProcessedWeaponSequence: 1,
      playerId,
      serverTimeMs: 10_050,
      snapshotSequence: 2
    })
  );
  weaponStateSync.syncFromAuthoritativeWorld();

  assert.equal(scheduler.pendingTasks.length, 0);
});

test("MetaverseWorldPlayerWeaponStateSync rebases queued weapon sequences above authoritative reconnect state", async () => {
  const { MetaverseWorldPlayerWeaponStateSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-weapon-state-sync.ts"
  );
  const playerId = createMetaversePlayerId("weapon-sync-reconnect-rebase-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentWeaponCommands = [];
  let connected = false;
  let localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 10,
      lastProcessedWeaponSequence: 41,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1
    })
  );
  const weaponStateSync = new MetaverseWorldPlayerWeaponStateSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId, connected),
    resolveCommandDelayMs: () => 50,
    async sendPlayerWeaponStateCommand(command) {
      sentWeaponCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  weaponStateSync.syncPlayerWeaponState({
    playerId,
    weaponState: {
      aimMode: "ads",
      weaponId: "duck-hunt-pistol"
    }
  });

  assert.equal(weaponStateSync.latestPlayerWeaponSequence, 1);

  connected = true;
  weaponStateSync.syncFromAuthoritativeWorld();

  assert.equal(weaponStateSync.latestPlayerWeaponSequence, 42);
  assert.equal(scheduler.pendingTasks.length, 1);
  assert.equal(scheduler.pendingTasks[0]?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentWeaponCommands.length, 1);
  assert.equal(sentWeaponCommands[0]?.weaponSequence, 42);
  assert.equal(sentWeaponCommands[0]?.weaponState?.weaponId, "duck-hunt-pistol");
});
