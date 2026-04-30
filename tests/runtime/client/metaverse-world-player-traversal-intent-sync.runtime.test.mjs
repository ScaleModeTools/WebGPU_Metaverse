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

test("MetaverseWorldPlayerTraversalIntentSync resends traversal intent until authoritative traversal ack catches up", async () => {
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
      lastProcessedTraversalSequence: 0,
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
  assert.equal(sentTraversalCommands[0]?.intent.sequence, 1);
  assert.equal(scheduler.pendingTasks.at(-1)?.delay, 50);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 2);
  assert.equal(sentTraversalCommands[1]?.intent.sequence, 1);

  localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 11,
      lastProcessedTraversalSequence: 1,
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
      lastProcessedTraversalSequence: 734,
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

  assert.equal(traversalSync.latestPlayerTraversalSequence, 734);
  assert.equal(traversalSync.latestPlayerTraversalSequence, 734);

  connected = true;
  traversalSync.syncFromAuthoritativeWorld();

  assert.equal(traversalSync.latestPlayerTraversalSequence, 734);
  assert.equal(traversalSync.latestPlayerTraversalSequence, 734);
  assert.equal(scheduler.pendingTasks.length, 1);
  assert.equal(scheduler.pendingTasks[0]?.delay, 0);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 1);
  assert.equal(sentTraversalCommands[0]?.intent.sequence, 735);
  assert.equal(sentTraversalCommands[0]?.intent.bodyControl.moveAxis, 1);
  assert.equal(sentTraversalCommands[0]?.intent.actionIntent.kind, "none");
  assert.equal(sentTraversalCommands[0]?.intent.actionIntent.sequence, 0);
  assert.equal(sentTraversalCommands[0]?.estimatedServerTimeMs, undefined);
});

test("MetaverseWorldPlayerTraversalIntentSync keeps previewed traversal sequences out of issued authority state until the command is synced", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-preview-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const traversalSync = new MetaverseWorldPlayerTraversalIntentSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () =>
      readLocalPlayerSnapshot(
        createWorldEvent({
          currentTick: 10,
          lastProcessedTraversalSequence: 0,
          playerId,
          serverTimeMs: 10_000,
          snapshotSequence: 1
        })
      ),
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId),
    resolveCommandDelayMs: () => 50,
    async sendPlayerTraversalIntentCommand() {
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  const previewIntent = traversalSync.previewPlayerTraversalIntent({
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

  assert.notEqual(previewIntent, null);
  assert.equal(traversalSync.latestPlayerTraversalSequence, 0);
  assert.equal(traversalSync.latestPlayerTraversalIntentSnapshot, null);

  const syncedIntent = traversalSync.syncPlayerTraversalIntent({
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

  assert.equal(syncedIntent?.sequence, previewIntent?.sequence);
  assert.equal(traversalSync.latestPlayerTraversalSequence, 0);
  assert.equal(
    traversalSync.latestPlayerTraversalIntentSnapshot?.sequence,
    undefined
  );
});

test("MetaverseWorldPlayerTraversalIntentSync reuses the latest traversal sample when held input is unchanged", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-fixed-tick-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentTraversalCommands = [];
  const traversalSync = new MetaverseWorldPlayerTraversalIntentSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () =>
      readLocalPlayerSnapshot(
        createWorldEvent({
          currentTick: 10,
          lastProcessedTraversalSequence: 0,
          playerId,
          serverTimeMs: 10_000,
          snapshotSequence: 1
        })
      ),
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId),
    resolveCommandDelayMs: () => 50,
    async sendPlayerTraversalIntentCommand(command) {
      sentTraversalCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  const firstIntent = traversalSync.syncPlayerTraversalIntent({
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
  const secondIntent = traversalSync.syncPlayerTraversalIntent({
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

  assert.equal(firstIntent?.sequence, 1);
  assert.equal(secondIntent?.sequence, 1);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 1);
  assert.equal(sentTraversalCommands[0]?.intent.sequence, 1);
  assert.equal(sentTraversalCommands[0]?.pendingIntentSamples, undefined);
});

test("MetaverseWorldPlayerTraversalIntentSync collapses a fast jump tap into one sequenced traversal sample", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-jump-tap-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentTraversalCommands = [];
  const traversalSync = new MetaverseWorldPlayerTraversalIntentSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () =>
      readLocalPlayerSnapshot(
        createWorldEvent({
          currentTick: 10,
          lastProcessedTraversalSequence: 0,
          playerId,
          serverTimeMs: 10_000,
          snapshotSequence: 1
        })
      ),
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createConnectedStatusSnapshot(playerId),
    resolveCommandDelayMs: () => 50,
    async sendPlayerTraversalIntentCommand(command) {
      sentTraversalCommands.push(command);
      return null;
    },
    setTimeout: scheduler.setTimeout
  });

  const pressedIntent = traversalSync.syncPlayerTraversalIntent({
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
  const releasedIntent = traversalSync.syncPlayerTraversalIntent({
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

  assert.equal(pressedIntent?.sequence, 1);
  assert.equal(releasedIntent?.sequence, 1);
  assert.equal(releasedIntent?.actionIntent.kind, "jump");
  assert.equal(releasedIntent?.actionIntent.pressed, false);
  assert.equal(releasedIntent?.actionIntent.sequence, 1);

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 1);
  assert.equal(sentTraversalCommands[0]?.intent.sequence, 1);
  assert.equal(sentTraversalCommands[0]?.intent.actionIntent.kind, "jump");
  assert.equal(sentTraversalCommands[0]?.intent.actionIntent.pressed, false);
  assert.equal(sentTraversalCommands[0]?.intent.actionIntent.sequence, 1);
  assert.equal(sentTraversalCommands[0]?.pendingIntentSamples, undefined);
});

test("MetaverseWorldPlayerTraversalIntentSync bundles unacked traversal samples inside the latest sent command", async () => {
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
      lastProcessedTraversalSequence: 0,
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
  assert.equal(sentTraversalCommands[0]?.intent.sequence, 3);
  assert.deepEqual(
    sentTraversalCommands[0]?.pendingIntentSamples,
    Object.freeze([
      Object.freeze({
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
        locomotionMode: "grounded",
        sequence: 1
      }),
      Object.freeze({
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
        locomotionMode: "grounded",
        sequence: 2
      })
    ])
  );

  localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 11,
      lastProcessedTraversalSequence: 3,
      playerId,
      serverTimeMs: 10_050,
      snapshotSequence: 2
    })
  );
  traversalSync.syncFromAuthoritativeWorld();

  assert.equal(scheduler.pendingTasks.length, 0);
});

test("MetaverseWorldPlayerTraversalIntentSync keeps a bounded boosted WASD history window", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-history-window-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentTraversalCommands = [];
  const traversalSync = new MetaverseWorldPlayerTraversalIntentSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () =>
      readLocalPlayerSnapshot(
        createWorldEvent({
          currentTick: 10,
          lastProcessedTraversalSequence: 0,
          playerId,
          serverTimeMs: 10_000,
          snapshotSequence: 1
        })
      ),
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
      yawAxis: 0
    }),
    playerId
  });
  traversalSync.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 1,
      yawAxis: 0.1
    }),
    playerId
  });
  traversalSync.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: true,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: -1,
      strafeAxis: 0,
      yawAxis: 0.2
    }),
    playerId
  });
  traversalSync.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: true,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: -1,
      yawAxis: 0.3
    }),
    playerId
  });
  traversalSync.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: true,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 1,
      strafeAxis: -1,
      yawAxis: 0.4
    }),
    playerId
  });
  traversalSync.syncPlayerTraversalIntent({
    intent: createTraversalIntentInput({
      boost: true,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 1,
      strafeAxis: 1,
      yawAxis: 0.5
    }),
    playerId
  });

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 1);
  assert.deepEqual(
    sentTraversalCommands[0]?.pendingIntentSamples?.map((sample) => sample.sequence),
    [1, 2, 3, 4, 5]
  );
  assert.equal(sentTraversalCommands[0]?.intent.sequence, 6);
  assert.equal(
    sentTraversalCommands[0]?.pendingIntentSamples?.some(
      (sample) =>
        sample.bodyControl.boost &&
        sample.bodyControl.moveAxis === -1 &&
        sample.bodyControl.strafeAxis === 0
    ),
    true
  );
});

test("MetaverseWorldPlayerTraversalIntentSync resends the exact previously sent traversal command so bundled traversal samples do not reorder", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-history-resend-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentTraversalCommands = [];
  let nowMs = 0;
  let localPlayerSnapshot = readLocalPlayerSnapshot(
    createWorldEvent({
      currentTick: 10,
      lastProcessedTraversalSequence: 0,
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

  scheduler.runNext(0);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 1);

  const firstSentCommand = sentTraversalCommands[0];

  assert.notEqual(firstSentCommand, undefined);

  nowMs = 80;
  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentTraversalCommands.length, 2);
  assert.equal(sentTraversalCommands[1], firstSentCommand);
  assert.deepEqual(
    sentTraversalCommands[1]?.pendingIntentSamples,
    firstSentCommand.pendingIntentSamples
  );
});

test("MetaverseWorldPlayerTraversalIntentSync emits explicit pending traversal samples without traversal timestamps", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-history-anchor-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentTraversalCommands = [];
  const traversalSync = new MetaverseWorldPlayerTraversalIntentSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    readLatestLocalPlayerSnapshot: () =>
      readLocalPlayerSnapshot(
        createWorldEvent({
          currentTick: 10,
          lastProcessedTraversalSequence: 0,
          playerId,
          serverTimeMs: 10_000,
          snapshotSequence: 1
        })
      ),
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
      yawAxis: 0
    }),
    playerId
  });
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
  assert.equal(sentTraversalCommands[0]?.estimatedServerTimeMs, undefined);
  assert.deepEqual(sentTraversalCommands[0]?.pendingIntentSamples, [
    Object.freeze({
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
      locomotionMode: "grounded",
      sequence: 1
    })
  ]);
});
