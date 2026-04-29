import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createMetaversePlayerId } from "@webgpu-metaverse/shared";

import {
  createConnectedStatusSnapshot,
  createManualTimerScheduler,
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

test("MetaverseWorldPlayerSync delegates player actions and look intent through one facade", async () => {
  const { MetaverseWorldPlayerSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-sync.ts"
  );
  const playerId = createMetaversePlayerId("player-sync-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentActionCommands = [];
  const sentLookCommands = [];
  const localPlayerSnapshot = Object.freeze({
    highestProcessedPlayerActionSequence: 0,
    lastProcessedLookSequence: 0,
    lastProcessedTraversalSequence: 0,
    lastProcessedWeaponSequence: 0,
    recentPlayerActionReceipts: Object.freeze([]),
    traversalAuthority: Object.freeze({
      lastConsumedActionKind: "none",
      lastConsumedActionSequence: 0
    })
  });
  const playerSync = new MetaverseWorldPlayerSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId, true),
    readWallClockMs: () => 5_000,
    resolveCommandDelayMs: () => 50,
    async sendIssuePlayerActionCommand(command) {
      sentActionCommands.push(command);
      return null;
    },
    async sendPlayerLookIntentCommand(command) {
      sentLookCommands.push(command);
      return null;
    },
    async sendPlayerTraversalIntentCommand() {
      return null;
    },
    async sendPlayerWeaponStateCommand() {
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  const actionSequence = playerSync.issuePlayerAction({
    action: {
      aimSnapshot: Object.freeze({
        pitchRadians: 0,
        yawRadians: 0
      }),
      issuedAtAuthoritativeTimeMs: 5_000,
      kind: "fire-weapon",
      weaponId: "metaverse-service-pistol-v2"
    },
    playerId
  });
  assert.equal(actionSequence, 1);
  playerSync.syncPlayerLookIntent({
    lookIntent: Object.freeze({
      pitchRadians: -0.15,
      yawRadians: 0.75
    }),
    playerId
  });

  while (scheduler.pendingTasks.some((task) => task.delay === 0)) {
    scheduler.runNext(0);
    await flushAsyncWork();
  }

  assert.equal(sentActionCommands.length, 1);
  assert.equal(sentActionCommands[0]?.action.actionSequence, 1);
  assert.equal(sentLookCommands.length, 1);
  assert.equal(sentLookCommands[0]?.lookSequence, 1);
  assert.equal(playerSync.latestPlayerLookSequence, 1);

  playerSync.dispose();
});
