import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createMetaversePlayerId } from "@webgpu-metaverse/shared";

import {
  createConnectedStatusSnapshot,
  createManualTimerScheduler,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createTraversalIntentInput,
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

test("MetaverseWorldPlayerIntentSync coordinates delegated look and traversal lanes during authoritative reconnect rebase", async () => {
  const { MetaverseWorldPlayerIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-reconnect-rebase-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentLookCommands = [];
  const sentTraversalCommands = [];
  let connected = false;
  let localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      authoritativeJumpActionSequence: 52,
      currentTick: 10,
      lastProcessedLookSequence: 418,
      lastProcessedTraversalSequence: 734,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1
    })
  );
  const intentSync = new MetaverseWorldPlayerIntentSync({
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
    async sendPlayerTraversalIntentCommand(command) {
      sentTraversalCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  intentSync.syncPlayerTraversalIntent({
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
  intentSync.syncPlayerLookIntent({
    lookIntent: {
      pitchRadians: -0.2,
      yawRadians: 0.8
    },
    playerId
  });

  assert.equal(intentSync.latestPlayerTraversalSequence, 734);
  assert.equal(intentSync.latestPlayerLookSequence, 1);

  connected = true;
  intentSync.syncFromAuthoritativeWorld();

  assert.equal(intentSync.latestPlayerTraversalSequence, 734);
  assert.equal(intentSync.latestPlayerLookSequence, 419);
  assert.equal(scheduler.pendingTasks.length, 2);
  assert.equal(
    scheduler.pendingTasks.every((task) => task.delay === 0),
    true
  );

  scheduler.runNext(0);
  await flushAsyncWork();
  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 1);
  assert.equal(sentTraversalCommands[0]?.intent.sequence, 735);
  assert.equal(sentTraversalCommands[0]?.intent.bodyControl.moveAxis, 1);
  assert.equal(sentTraversalCommands[0]?.intent.actionIntent.kind, "none");
  assert.equal(sentTraversalCommands[0]?.intent.actionIntent.sequence, 0);
  assert.equal(sentTraversalCommands[0]?.estimatedServerTimeMs, undefined);
  assert.equal(sentLookCommands.length, 1);
  assert.equal(sentLookCommands[0]?.lookSequence, 419);
});
