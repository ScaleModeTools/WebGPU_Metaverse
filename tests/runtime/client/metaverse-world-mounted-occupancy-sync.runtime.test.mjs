import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldEvent,
  createMetaverseSyncMountedOccupancyCommand
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

function createDeferredPromise() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return Object.freeze({
    promise,
    reject,
    resolve
  });
}

function createStatusSnapshot(playerId, state = "connected", connected = true) {
  return Object.freeze({
    connected,
    lastError: null,
    lastSnapshotSequence: null,
    lastWorldTick: null,
    playerId,
    state
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
      players: [
        {
          characterId: "metaverse-mannequin-v1",
          lastProcessedInputSequence: 0,
          lastProcessedLookSequence: 0,
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
        tickIntervalMs: 50
      },
      vehicles: []
    }
  });
}

test("MetaverseWorldMountedOccupancySync serializes reliable occupancy commands in order", async () => {
  const { MetaverseWorldMountedOccupancySync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-mounted-occupancy-sync.ts"
  );
  const playerId = createMetaversePlayerId("mounted-occupancy-sync-1");

  assert.notEqual(playerId, null);

  const firstCommand = createDeferredPromise();
  const secondCommand = createDeferredPromise();
  const acceptedWorldEvents = [];
  const sentCommands = [];
  const owner = new MetaverseWorldMountedOccupancySync({
    acceptWorldEvent(nextPlayerId, worldEvent) {
      acceptedWorldEvents.push({
        playerId: nextPlayerId,
        worldEvent
      });
    },
    applyWorldAccessError(error) {
      throw error;
    },
    readStatusSnapshot: () => createStatusSnapshot(playerId),
    async sendReliableCommand(command) {
      sentCommands.push(command);

      return sentCommands.length === 1
        ? firstCommand.promise
        : secondCommand.promise;
    }
  });

  owner.syncMountedOccupancy({
    mountedOccupancy: {
      entryId: "deck-entry",
      environmentAssetId: "metaverse-hub-skiff-v1",
      occupancyKind: "entry",
      occupantRole: "driver",
      seatId: null
    },
    playerId
  });
  owner.syncMountedOccupancy({
    mountedOccupancy: {
      entryId: null,
      environmentAssetId: "metaverse-hub-skiff-v1",
      occupancyKind: "seat",
      occupantRole: "driver",
      seatId: "driver-seat"
    },
    playerId
  });

  await flushAsyncWork();

  assert.equal(sentCommands.length, 1);
  assert.deepEqual(
    sentCommands[0],
    createMetaverseSyncMountedOccupancyCommand({
      mountedOccupancy: {
        entryId: "deck-entry",
        environmentAssetId: "metaverse-hub-skiff-v1",
        occupancyKind: "entry",
        occupantRole: "driver",
        seatId: null
      },
      playerId
    })
  );

  firstCommand.resolve(createWorldEvent({ playerId, snapshotSequence: 1 }));
  await flushAsyncWork();

  assert.equal(sentCommands.length, 2);
  assert.deepEqual(
    sentCommands[1],
    createMetaverseSyncMountedOccupancyCommand({
      mountedOccupancy: {
        entryId: null,
        environmentAssetId: "metaverse-hub-skiff-v1",
        occupancyKind: "seat",
        occupantRole: "driver",
        seatId: "driver-seat"
      },
      playerId
    })
  );
  assert.equal(acceptedWorldEvents.length, 1);

  secondCommand.resolve(createWorldEvent({ playerId, snapshotSequence: 2 }));
  await flushAsyncWork();

  assert.equal(acceptedWorldEvents.length, 2);
  assert.equal(acceptedWorldEvents[1]?.playerId, playerId);
});

test("MetaverseWorldMountedOccupancySync stops draining queued commands after disposal", async () => {
  const { MetaverseWorldMountedOccupancySync } = await clientLoader.load(
    "/src/network/classes/metaverse-world-mounted-occupancy-sync.ts"
  );
  const playerId = createMetaversePlayerId("mounted-occupancy-sync-dispose-1");

  assert.notEqual(playerId, null);

  const firstCommand = createDeferredPromise();
  const acceptedWorldEvents = [];
  const sentCommands = [];
  let statusState = "connected";
  const owner = new MetaverseWorldMountedOccupancySync({
    acceptWorldEvent(nextPlayerId, worldEvent) {
      acceptedWorldEvents.push({
        playerId: nextPlayerId,
        worldEvent
      });
    },
    applyWorldAccessError(error) {
      throw error;
    },
    readStatusSnapshot: () => createStatusSnapshot(playerId, statusState),
    async sendReliableCommand(command) {
      sentCommands.push(command);
      return firstCommand.promise;
    }
  });

  owner.syncMountedOccupancy({
    mountedOccupancy: {
      entryId: "deck-entry",
      environmentAssetId: "metaverse-hub-skiff-v1",
      occupancyKind: "entry",
      occupantRole: "driver",
      seatId: null
    },
    playerId
  });
  owner.syncMountedOccupancy({
    mountedOccupancy: {
      entryId: null,
      environmentAssetId: "metaverse-hub-skiff-v1",
      occupancyKind: "seat",
      occupantRole: "driver",
      seatId: "driver-seat"
    },
    playerId
  });

  await flushAsyncWork();

  assert.equal(sentCommands.length, 1);

  statusState = "disposed";
  firstCommand.resolve(createWorldEvent({ playerId, snapshotSequence: 1 }));
  await flushAsyncWork();

  assert.equal(acceptedWorldEvents.length, 1);
  assert.equal(sentCommands.length, 1);
});
