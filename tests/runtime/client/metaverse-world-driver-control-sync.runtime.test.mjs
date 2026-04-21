import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldEvent,
  createMetaverseSyncDriverVehicleControlCommand
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

function createStatusSnapshot(playerId, connected = true) {
  return Object.freeze({
    connected,
    lastError: null,
    lastSnapshotSequence: null,
    lastWorldTick: null,
    playerId,
    state: connected ? "connected" : "connecting"
  });
}

function createWorldEvent({
  playerId,
  snapshotSequence = 1,
  currentTick = 10,
  serverTimeMs = 10_000
}) {
  return createMetaverseRealtimeWorldEvent({
    world: {
      observerPlayer: {
        lastProcessedInputSequence: 0,
        lastProcessedLookSequence: 0,
        lastProcessedTraversalOrientationSequence: 0,
        playerId
      },
      players: [
        {
          characterId: "mesh2motion-humanoid-v1",
          groundedBody: {
            linearVelocity: {
              x: 0,
              y: 0,
              z: 0
            },
            position: {
              x: 0,
              y: 1.62,
              z: 24
            },
            yawRadians: 0
          },
          locomotionMode: "grounded",
          playerId,
          stateSequence: snapshotSequence,
          username: "Harbor Pilot"
        }
      ],
      snapshotSequence,
      tick: {
        currentTick,
        serverTimeMs,
        tickIntervalMs: 50
      },
      vehicles: []
    }
  });
}

test("MetaverseWorldDriverControlSync coalesces latest driver input onto one latest-wins send", async () => {
  const { MetaverseWorldDriverControlSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-driver-control-sync.ts"
  );
  const playerId = createMetaversePlayerId("driver-sync-latest-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentDatagrams = [];
  const owner = new MetaverseWorldDriverControlSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    latestWinsDatagramTransport: {
      async sendDriverVehicleControlDatagram(command) {
        sentDatagrams.push(command);
      }
    },
    notifyUpdates() {},
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createStatusSnapshot(playerId),
    readWallClockMs: () => 0,
    resolveCommandDelayMs: () => 50,
    async sendReliableCommand() {
      throw new Error("Expected datagram lane to own the send.");
    },
    setTimeout: scheduler.setTimeout
  });

  owner.syncDriverVehicleControl({
    controlIntent: {
      boost: false,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 0.5,
      strafeAxis: 0.2,
      yawAxis: 0.25
    },
    playerId
  });
  owner.syncDriverVehicleControl({
    controlIntent: {
      boost: true,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.5
    },
    playerId
  });

  assert.equal(owner.supportsDatagrams, true);
  assert.equal(scheduler.pendingTasks[0]?.delay, 50);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.deepEqual(
    sentDatagrams[0],
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: true,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0.5
      },
      controlSequence: 2,
      playerId
    })
  );
  assert.equal(owner.failureCount, 0);
  assert.equal(owner.datagramStatusContext.usingReliableFallback, false);
});

test("MetaverseWorldDriverControlSync preserves transient yaw through timed compression", async () => {
  const { MetaverseWorldDriverControlSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-driver-control-sync.ts"
  );
  const playerId = createMetaversePlayerId("driver-sync-yaw-window-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const sentDatagrams = [];
  let nowMs = 0;
  const owner = new MetaverseWorldDriverControlSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    latestWinsDatagramTransport: {
      async sendDriverVehicleControlDatagram(command) {
        sentDatagrams.push(command);
      }
    },
    notifyUpdates() {},
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createStatusSnapshot(playerId),
    readWallClockMs: () => nowMs,
    resolveCommandDelayMs: () => 50,
    async sendReliableCommand() {
      throw new Error("Expected datagram lane to own the send.");
    },
    setTimeout: scheduler.setTimeout
  });

  owner.syncDriverVehicleControl({
    controlIntent: {
      boost: false,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0.25
    },
    playerId
  });
  nowMs = 48;
  owner.syncDriverVehicleControl({
    controlIntent: {
      boost: false,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0
    },
    playerId
  });
  nowMs = 50;

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(sentDatagrams[0]?.controlSequence, 2);
  assert.ok(
    Math.abs((sentDatagrams[0]?.controlIntent.yawAxis ?? 0) - 0.24) < 0.000001
  );
});

test("MetaverseWorldDriverControlSync falls back to reliable commands after a datagram failure", async () => {
  const { MetaverseWorldDriverControlSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-driver-control-sync.ts"
  );
  const playerId = createMetaversePlayerId("driver-sync-fallback-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const reliableCommands = [];
  let remainingDatagramFailures = 1;
  const owner = new MetaverseWorldDriverControlSync({
    acceptWorldEvent() {},
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    latestWinsDatagramTransport: {
      async sendDriverVehicleControlDatagram() {
        if (remainingDatagramFailures > 0) {
          remainingDatagramFailures -= 1;
          throw new Error("driver lane down");
        }
      }
    },
    notifyUpdates() {},
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createStatusSnapshot(playerId),
    readWallClockMs: () => 0,
    resolveCommandDelayMs: () => 50,
    async sendReliableCommand(command) {
      reliableCommands.push(command);
      return createWorldEvent({ playerId });
    },
    setTimeout: scheduler.setTimeout
  });

  owner.syncDriverVehicleControl({
    controlIntent: {
      boost: false,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.5
    },
    playerId
  });

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(reliableCommands.length, 1);
  assert.equal(owner.failureCount, 1);
  assert.equal(owner.datagramStatusContext.usingReliableFallback, true);
  assert.equal(owner.datagramStatusContext.lastTransportError, "driver lane down");
});

test("MetaverseWorldDriverControlSync recovers datagram sends after the fallback cooldown", async () => {
  const { MetaverseWorldDriverControlSync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-driver-control-sync.ts"
  );
  const playerId = createMetaversePlayerId("driver-sync-recovery-1");

  assert.notEqual(playerId, null);

  const scheduler = createManualTimerScheduler();
  const acceptedWorldEvents = [];
  const reliableCommands = [];
  const sentDatagrams = [];
  let remainingDatagramFailures = 1;
  const owner = new MetaverseWorldDriverControlSync({
    acceptWorldEvent(nextPlayerId, worldEvent) {
      acceptedWorldEvents.push({
        playerId: nextPlayerId,
        worldEvent
      });
    },
    applyWorldAccessError(error) {
      throw error;
    },
    clearTimeout: scheduler.clearTimeout,
    latestWinsDatagramTransport: {
      async sendDriverVehicleControlDatagram(command) {
        sentDatagrams.push(command);

        if (remainingDatagramFailures > 0) {
          remainingDatagramFailures -= 1;
          throw new Error("driver lane down");
        }
      }
    },
    notifyUpdates() {},
    readPlayerId: () => playerId,
    readStatusSnapshot: () => createStatusSnapshot(playerId),
    readWallClockMs: () => 0,
    resolveCommandDelayMs: () => 50,
    async sendReliableCommand(command) {
      reliableCommands.push(command);
      return createWorldEvent({ playerId, snapshotSequence: reliableCommands.length });
    },
    setTimeout: scheduler.setTimeout
  });

  owner.syncDriverVehicleControl({
    controlIntent: {
      boost: false,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.5
    },
    playerId
  });

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 1);
  assert.equal(reliableCommands.length, 1);
  assert.equal(acceptedWorldEvents.length, 1);
  assert.equal(owner.datagramStatusContext.usingReliableFallback, true);

  scheduler.runNext(50);

  assert.equal(owner.supportsDatagrams, true);
  assert.equal(owner.datagramStatusContext.usingReliableFallback, false);
  assert.equal(owner.datagramStatusContext.lastTransportError, "driver lane down");

  owner.syncDriverVehicleControl({
    controlIntent: {
      boost: true,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 0.4,
      strafeAxis: 0.1,
      yawAxis: 0.1
    },
    playerId
  });

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(sentDatagrams.length, 2);
  assert.equal(reliableCommands.length, 1);
  assert.equal(owner.datagramStatusContext.lastTransportError, null);
});
