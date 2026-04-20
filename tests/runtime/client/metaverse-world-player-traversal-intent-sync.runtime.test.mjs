import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldEvent,
  createMetaverseSyncPlayerTraversalIntentCommand as createRawMetaverseSyncPlayerTraversalIntentCommand
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

function createTraversalIntentInput(input) {
  if ("bodyControl" in input || "actionIntent" in input) {
    return {
      ...input,
      facing: input.facing ?? {
        pitchRadians: input.pitchRadians ?? 0,
        yawRadians:
          input.bodyYawRadians ??
          input.lookYawRadians ??
          input.yawRadians ??
          0
      }
    };
  }

  return {
    actionIntent: {
      kind:
        input.jump === true || (input.jumpActionSequence ?? 0) > 0
          ? "jump"
          : "none",
      pressed: input.jump === true,
      ...(input.jumpActionSequence === undefined
        ? {}
        : { sequence: input.jumpActionSequence })
    },
    bodyControl: {
      boost: input.boost,
      moveAxis: input.moveAxis,
      strafeAxis: input.strafeAxis,
      turnAxis: input.yawAxis
    },
    facing: {
      pitchRadians: input.pitchRadians ?? 0,
      yawRadians:
        input.bodyYawRadians ??
        input.lookYawRadians ??
        input.yawRadians ??
        0
    },
    inputSequence: input.inputSequence,
    locomotionMode: input.locomotionMode,
    orientationSequence: input.orientationSequence
  };
}

function createMetaverseSyncPlayerTraversalIntentCommand(input) {
  const nextIntent = input.intent;
  const normalizedFacing =
    nextIntent.facing ?? {
      pitchRadians: nextIntent.pitchRadians ?? 0,
      yawRadians:
        nextIntent.bodyYawRadians ??
        nextIntent.lookYawRadians ??
        nextIntent.yawRadians ??
        0
    };

  if ("bodyControl" in nextIntent || "actionIntent" in nextIntent) {
    return createRawMetaverseSyncPlayerTraversalIntentCommand({
      ...input,
      intent: {
        ...nextIntent,
        facing: normalizedFacing
      }
    });
  }

  return createRawMetaverseSyncPlayerTraversalIntentCommand({
    ...input,
    intent: {
      actionIntent: {
        kind:
          nextIntent.jump === true || (nextIntent.jumpActionSequence ?? 0) > 0
            ? "jump"
            : "none",
        pressed: nextIntent.jump === true,
        ...(nextIntent.jumpActionSequence === undefined
          ? {}
          : { sequence: nextIntent.jumpActionSequence })
      },
      bodyControl: {
        boost: nextIntent.boost,
        moveAxis: nextIntent.moveAxis,
        strafeAxis: nextIntent.strafeAxis,
        turnAxis: nextIntent.yawAxis
      },
      facing: normalizedFacing,
      inputSequence: nextIntent.inputSequence,
      locomotionMode: nextIntent.locomotionMode,
      orientationSequence: nextIntent.orientationSequence
    }
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
  lastProcessedInputSequence = snapshotSequence,
  lastProcessedTraversalOrientationSequence = lastProcessedInputSequence,
  authoritativeJumpActionSequence = 0,
  serverTimeMs,
  tickIntervalMs = 50
}) {
  return createMetaverseRealtimeWorldEvent({
    world: {
      players: [
        {
          characterId: "mesh2motion-humanoid-v1",
          jumpDebug:
            authoritativeJumpActionSequence > 0
              ? {
                  resolvedActionSequence: authoritativeJumpActionSequence,
                  resolvedActionState: "accepted"
                }
              : undefined,
          lastProcessedInputSequence,
          lastProcessedLookSequence: 0,
          lastProcessedTraversalOrientationSequence,
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

test("MetaverseWorldPlayerTraversalIntentSync resends traversal intent until authoritative input and orientation acks catch up", async () => {
  const { MetaverseWorldPlayerTraversalIntentSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-player-traversal-intent-sync.ts"
  );
  const playerId = createMetaversePlayerId("intent-sync-traversal-ack-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentTraversalCommands = [];
  let localPlayerSnapshot = createWorldEvent({
    currentTick: 10,
    lastProcessedInputSequence: 0,
    lastProcessedTraversalOrientationSequence: 0,
    playerId,
    serverTimeMs: 10_000,
    snapshotSequence: 1
  }).world.players[0];
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

  localPlayerSnapshot = createWorldEvent({
    currentTick: 11,
    lastProcessedInputSequence: 1,
    lastProcessedTraversalOrientationSequence: 1,
    playerId,
    serverTimeMs: 10_050,
    snapshotSequence: 2
  }).world.players[0];
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
  let localPlayerSnapshot = createWorldEvent({
    authoritativeJumpActionSequence: 52,
    currentTick: 10,
    lastProcessedInputSequence: 734,
    lastProcessedTraversalOrientationSequence: 734,
    playerId,
    serverTimeMs: 10_000,
    snapshotSequence: 1
  }).world.players[0];
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
  assert.deepEqual(
    sentTraversalCommands[0],
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 735,
        jump: true,
        jumpActionSequence: 53,
        locomotionMode: "grounded",
        moveAxis: 1,
        orientationSequence: 735,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    })
  );
});
