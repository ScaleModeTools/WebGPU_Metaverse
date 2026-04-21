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

test("MetaverseWorldPlayerTraversalIntentSync resends traversal intent until authoritative input and orientation acks catch up", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-ack-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentTraversalCommands = [];
  let localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 10,
      lastProcessedInputSequence: 0,
      lastProcessedTraversalOrientationSequence: 0,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1
    })
  );
  const traversalSync = new MetaverseWorldPlayerTraversalIntentSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId),
    resolveCommandDelayMs: () => 50,
    async sendPlayerTraversalIntentCommand(command) {
      sentTraversalCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  traversalSync.syncPlayerTraversalIntent({
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

  assert.equal(sentTraversalCommands.length, 1);
  assert.equal(sentTraversalCommands[0]?.intent.inputSequence, 1);
  assert.equal(sentTraversalCommands[0]?.intent.orientationSequence, 1);
  assert.equal(scheduler.pendingTasks.at(-1)?.delay, 50);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 2);
  assert.equal(sentTraversalCommands[1]?.intent.inputSequence, 1);
  assert.equal(sentTraversalCommands[1]?.intent.orientationSequence, 1);

  localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 11,
      lastProcessedInputSequence: 1,
      lastProcessedTraversalOrientationSequence: 1,
      playerId,
      serverTimeMs: 10_050,
      snapshotSequence: 2
    })
  );
  traversalSync.syncFromAuthoritativeWorld();

  assert.equal(scheduler.pendingTasks.length, 0);
});

test("MetaverseWorldPlayerTraversalIntentSync rebases queued traversal sequences above authoritative reconnect state", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-reconnect-rebase-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentTraversalCommands = [];
  let connected = false;
  let localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      authoritativeJumpActionSequence: 52,
      currentTick: 10,
      lastProcessedInputSequence: 734,
      lastProcessedTraversalOrientationSequence: 734,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1
    })
  );
  const traversalSync = new MetaverseWorldPlayerTraversalIntentSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId, connected),
    resolveCommandDelayMs: () => 50,
    async sendPlayerTraversalIntentCommand(command) {
      sentTraversalCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  traversalSync.syncPlayerTraversalIntent({
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

  assert.equal(traversalSync.latestPlayerInputSequence, 1);
  assert.equal(traversalSync.latestPlayerTraversalOrientationSequence, 1);

  connected = true;
  traversalSync.syncFromAuthoritativeWorld();

  assert.equal(traversalSync.latestPlayerInputSequence, 735);
  assert.equal(traversalSync.latestPlayerTraversalOrientationSequence, 735);
  assert.equal(scheduler.pendingTasks.length, 1);
  assert.equal(scheduler.pendingTasks[0]?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 1);
  assert.equal(sentTraversalCommands[0]?.intent.inputSequence, 735);
  assert.equal(sentTraversalCommands[0]?.intent.orientationSequence, 735);
  assert.equal(sentTraversalCommands[0]?.intent.bodyControl.moveAxis, 1);
  assert.equal(sentTraversalCommands[0]?.intent.actionIntent.kind, "jump");
  assert.equal(sentTraversalCommands[0]?.intent.actionIntent.sequence, 53);
  assert.equal(typeof sentTraversalCommands[0]?.estimatedServerTimeMs, "number");
});

test("MetaverseWorldPlayerTraversalIntentSync preserves rapid short-lived traversal edges inside the latest sent command", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-history-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentTraversalCommands = [];
  let nowMs = 0;
  let localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 10,
      lastProcessedInputSequence: 0,
      lastProcessedTraversalOrientationSequence: 0,
      playerId,
      serverTimeMs: 10_000,
      snapshotSequence: 1
    })
  );
  const traversalSync = new MetaverseWorldPlayerTraversalIntentSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () => localPlayerSnapshot,
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId),
    readWallClockMs: () => nowMs,
    resolveCommandDelayMs: () => 50,
    async sendPlayerTraversalIntentCommand(command) {
      sentTraversalCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  traversalSync.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0
    }),
    playerId
  });
  nowMs = 8;
  traversalSync.syncPlayerTraversalIntent({
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
  nowMs = 16;
  traversalSync.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 1,
      yawAxis: 0.25
    }),
    playerId
  });

  assert.equal(scheduler.pendingTasks.length, 1);
  assert.equal(scheduler.pendingTasks[0]?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 1);
  assert.equal(sentTraversalCommands[0]?.intent.inputSequence, 3);
  assert.equal(sentTraversalCommands[0]?.intent.orientationSequence, 2);
  assert.deepEqual(
    sentTraversalCommands[0]?.recentIntentHistory,
    Object.freeze([
      Object.freeze({
        durationMs: 8,
        intent: Object.freeze({
          actionIntent: Object.freeze({
            kind: "none",
            pressed: false,
            sequence: 0
          }),
          bodyControl: Object.freeze({
            boost: false,
            moveAxis: 1,
            strafeAxis: 0,
            turnAxis: 0
          }),
          facing: Object.freeze({
            pitchRadians: 0,
            yawRadians: 0
          }),
          inputSequence: 1,
          locomotionMode: "grounded",
          orientationSequence: 1,
          sampleId: 1
        })
      }),
      Object.freeze({
        durationMs: 8,
        intent: Object.freeze({
          actionIntent: Object.freeze({
            kind: "none",
            pressed: false,
            sequence: 0
          }),
          bodyControl: Object.freeze({
            boost: false,
            moveAxis: 0,
            strafeAxis: 0,
            turnAxis: 0
          }),
          facing: Object.freeze({
            pitchRadians: 0,
            yawRadians: 0
          }),
          inputSequence: 2,
          locomotionMode: "grounded",
          orientationSequence: 1,
          sampleId: 2
        })
      })
    ])
  );

  localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 11,
      lastProcessedInputSequence: 3,
      lastProcessedTraversalOrientationSequence: 2,
      playerId,
      serverTimeMs: 10_050,
      snapshotSequence: 2
    })
  );
  traversalSync.syncFromAuthoritativeWorld();

  assert.equal(scheduler.pendingTasks.length, 0);
});

test("MetaverseWorldPlayerTraversalIntentSync anchors recent traversal history to estimated server time", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-history-anchor-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentTraversalCommands = [];
  let nowMs = 0;
  const traversalSync = new MetaverseWorldPlayerTraversalIntentSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readEstimatedServerTimeMs: (localWallClockMs) => localWallClockMs + 37.9,
    readLatestLocalPlayerSnapshot: () =>
      readLocalPlayerSnapshot(
        createWorldEvent({
          currentTick: 10,
          lastProcessedInputSequence: 0,
          lastProcessedTraversalOrientationSequence: 0,
          playerId,
          serverTimeMs: 10_000,
          snapshotSequence: 1
        })
      ),
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId),
    readWallClockMs: () => nowMs,
    resolveCommandDelayMs: () => 50,
    async sendPlayerTraversalIntentCommand(command) {
      sentTraversalCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  traversalSync.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0
    }),
    playerId
  });
  nowMs = 12;
  traversalSync.syncPlayerTraversalIntent({
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

  assert.equal(sentTraversalCommands.length, 1);
  assert.equal(sentTraversalCommands[0]?.estimatedServerTimeMs, 49);
  assert.deepEqual(sentTraversalCommands[0]?.recentIntentHistory, [
    {
      durationMs: 12,
      intent: sentTraversalCommands[0]?.recentIntentHistory?.[0]?.intent
    }
  ]);
});
