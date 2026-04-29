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

test("MetaverseWorldPlayerActionSync sequences and retires reliable player actions from receipts", async () => {
  const { MetaverseWorldPlayerActionSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-action-sync.ts"
  );
  const playerId = createMetaversePlayerId("player-action-sync-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentCommands = [];
  let nowMs = 10_000;
  let localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 10,
      highestProcessedPlayerActionSequence: 7,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1
    })
  );
  const actionSync = new MetaverseWorldPlayerActionSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId, true),
    readWallClockMs: () => nowMs,
    resolveCommandDelayMs: () => 50,
    async sendIssuePlayerActionCommand(command) {
      sentCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  const actionSequence = actionSync.issuePlayerAction({
    action: {
      aimMode: "hip-fire",
      aimSnapshot: Object.freeze({
        pitchRadians: 0,
        yawRadians: 0
      }),
      issuedAtAuthoritativeTimeMs: 10_000,
      kind: "fire-weapon",
      weaponId: "metaverse-service-pistol-v2"
    },
    playerId
  });

  assert.equal(actionSequence, 8);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentCommands.length, 1);
  assert.equal(sentCommands[0]?.action.actionSequence, 8);
  assert.equal(scheduler.pendingTasks.length, 1);

  nowMs = 10_050;
  localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 11,
      highestProcessedPlayerActionSequence: 8,
      playerId,
      recentPlayerActionReceipts: Object.freeze([
        Object.freeze({
          actionSequence: 8,
          kind: "fire-weapon",
          processedAtTimeMs: 10_040,
          sourceProjectileId: `${playerId}:8`,
          status: "accepted",
          weaponId: "metaverse-service-pistol-v2"
        })
      ]),
      serverTimeMs: 10_050,
      snapshotSequence: 2
    })
  );

  actionSync.syncFromAuthoritativeWorld();

  assert.equal(scheduler.pendingTasks.length, 0);

  actionSync.dispose();
});

test("MetaverseWorldPlayerActionSync treats weapon slot switches as exclusive action barriers", async () => {
  const { MetaverseWorldPlayerActionSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-action-sync.ts"
  );
  const playerId = createMetaversePlayerId("player-action-sync-switch-barrier");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentCommands = [];
  let nowMs = 20_000;
  let localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 20,
      highestProcessedPlayerActionSequence: 0,
      playerId,
      serverTimeMs: 20_000,
      snapshotSequence: 1
    })
  );
  const actionSync = new MetaverseWorldPlayerActionSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId, true),
    readWallClockMs: () => nowMs,
    resolveCommandDelayMs: () => 50,
    async sendIssuePlayerActionCommand(command) {
      sentCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  actionSync.issuePlayerAction({
    action: {
      aimMode: "hip-fire",
      aimSnapshot: Object.freeze({ pitchRadians: 0, yawRadians: 0 }),
      issuedAtAuthoritativeTimeMs: 20_000,
      kind: "fire-weapon",
      weaponId: "metaverse-service-pistol-v2"
    },
    playerId
  });
  actionSync.issuePlayerAction({
    action: {
      intendedWeaponInstanceId:
        "player-action-sync-switch-barrier:secondary:metaverse-rocket-launcher-v1",
      issuedAtAuthoritativeTimeMs: 20_010,
      kind: "switch-active-weapon-slot",
      requestedActiveSlotId: "secondary"
    },
    playerId
  });
  actionSync.issuePlayerAction({
    action: {
      aimMode: "hip-fire",
      aimSnapshot: Object.freeze({ pitchRadians: 0, yawRadians: 0 }),
      issuedAtAuthoritativeTimeMs: 20_020,
      kind: "fire-weapon",
      weaponId: "metaverse-rocket-launcher-v1"
    },
    playerId
  });

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.deepEqual(
    sentCommands.map((command) => command.action.kind),
    ["fire-weapon"]
  );

  localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 21,
      highestProcessedPlayerActionSequence: 1,
      playerId,
      recentPlayerActionReceipts: Object.freeze([
        Object.freeze({
          actionSequence: 1,
          kind: "fire-weapon",
          processedAtTimeMs: 20_040,
          sourceProjectileId: null,
          status: "accepted",
          weaponId: "metaverse-service-pistol-v2"
        })
      ]),
      serverTimeMs: 20_050,
      snapshotSequence: 2
    })
  );
  nowMs = 20_050;
  actionSync.syncFromAuthoritativeWorld();
  scheduler.runNext(50);
  await flushAsyncWork();

  assert.deepEqual(
    sentCommands.map((command) => command.action.kind),
    ["fire-weapon", "switch-active-weapon-slot"]
  );

  nowMs = 20_100;
  scheduler.runNext(50);
  await flushAsyncWork();

  assert.deepEqual(
    sentCommands.map((command) => command.action.kind),
    [
      "fire-weapon",
      "switch-active-weapon-slot",
      "switch-active-weapon-slot"
    ]
  );

  localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 22,
      highestProcessedPlayerActionSequence: 2,
      playerId,
      recentPlayerActionReceipts: Object.freeze([
        Object.freeze({
          actionSequence: 2,
          activeSlotId: "secondary",
          intendedWeaponInstanceId:
            "player-action-sync-switch-barrier:secondary:metaverse-rocket-launcher-v1",
          kind: "switch-active-weapon-slot",
          processedAtTimeMs: 20_080,
          requestedActiveSlotId: "secondary",
          status: "accepted",
          weaponId: "metaverse-rocket-launcher-v1",
          weaponInstanceId:
            "player-action-sync-switch-barrier:secondary:metaverse-rocket-launcher-v1"
        })
      ]),
      serverTimeMs: 20_100,
      snapshotSequence: 3
    })
  );
  actionSync.syncFromAuthoritativeWorld();
  scheduler.runNext(50);
  await flushAsyncWork();

  assert.deepEqual(
    sentCommands.map((command) => command.action.kind),
    [
      "fire-weapon",
      "switch-active-weapon-slot",
      "switch-active-weapon-slot",
      "fire-weapon"
    ]
  );
  assert.equal(sentCommands[3]?.action.weaponId, "metaverse-rocket-launcher-v1");

  actionSync.dispose();
});
