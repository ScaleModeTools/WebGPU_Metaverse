import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMilliseconds,
  createMetaversePlayerId,
  createMetaverseRealtimeWorldWebTransportCommandRequest,
  createMetaverseRealtimeWorldWebTransportSnapshotRequest,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseWorldWebTransportAdapter } from "../../../server/dist/metaverse/adapters/metaverse-world-webtransport-adapter.js";
import { MetaverseAuthoritativeWorldRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";

function createDeferred() {
  let resolve = () => {};
  let reject = () => {};
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    reject,
    resolve
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

test("MetaverseWorldWebTransportAdapter serves authoritative world snapshots through one session owner", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime();
  const adapter = new MetaverseWorldWebTransportAdapter(runtime);
  const session = adapter.openSession();
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        position: {
          x: 0,
          y: 0.4,
          z: 24
        },
        yawRadians: 0
      },
      username
    }),
    0
  );

  const response = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportSnapshotRequest({
      observerPlayerId: playerId
    }),
    100
  );

  assert.equal(response.type, "world-server-event");
  assert.equal(response.event.world.players[0]?.playerId, "harbor-pilot-1");
  assert.equal(response.event.world.vehicles.length, 1);
});

test("MetaverseWorldWebTransportAdapter accepts typed driver vehicle control requests", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime();
  const adapter = new MetaverseWorldWebTransportAdapter(runtime);
  const session = adapter.openSession();
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        position: {
          x: 0,
          y: 0.4,
          z: 24
        },
        yawRadians: 0
      },
      username
    }),
    0
  );

  const response = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command: createMetaverseSyncDriverVehicleControlCommand({
        controlIntent: {
          boost: false,
          environmentAssetId: "metaverse-hub-skiff-v1",
          moveAxis: 1,
          strafeAxis: 0,
          yawAxis: 0
        },
        controlSequence: 1,
        playerId
      })
    }),
    100
  );

  assert.equal(response.type, "world-server-event");
  assert.equal(response.event.type, "world-snapshot");
});

test("MetaverseWorldWebTransportAdapter accepts typed mounted occupancy requests", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime();
  const adapter = new MetaverseWorldWebTransportAdapter(runtime);
  const session = adapter.openSession();
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        yawRadians: 0
      },
      username
    }),
    0
  );

  const response = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command: createMetaverseSyncMountedOccupancyCommand({
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        playerId
      })
    }),
    100
  );

  assert.equal(response.type, "world-server-event");
  assert.equal(response.event.world.players[0]?.locomotionMode, "mounted");
  assert.equal(
    response.event.world.players[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
});

test("MetaverseWorldWebTransportAdapter returns typed error frames for unknown observers", () => {
  const adapter = new MetaverseWorldWebTransportAdapter(
    new MetaverseAuthoritativeWorldRuntime()
  );
  const session = adapter.openSession();
  const playerId = createMetaversePlayerId("missing-player");

  assert.notEqual(playerId, null);

  const response = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportSnapshotRequest({
      observerPlayerId: playerId
    }),
    0
  );

  assert.equal(response.type, "world-error");
  assert.match(response.message, /Unknown metaverse player/);
});

test("MetaverseWorldWebTransportAdapter keeps a persistent snapshot subscription alive and pushes newer snapshots", async () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime();
  const adapter = new MetaverseWorldWebTransportAdapter(runtime);
  const session = adapter.openSession();
  const playerId = createMetaversePlayerId("stream-harbor-pilot");
  const username = createUsername("Stream Harbor Pilot");
  const writes = [];
  const closed = createDeferred();

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username
    }),
    0
  );

  const streamPromise = session.handleClientStream(
    {
      observerPlayerId: playerId,
      type: "world-snapshot-subscribe"
    },
    {
      closed: closed.promise,
      async writeResponse(response) {
        writes.push(response);
      }
    },
    0
  );

  await flushAsyncWork();

  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.type, "world-server-event");
  assert.equal(writes[0]?.event.world.tick.currentTick, 0);

  runtime.advanceToTime(100);
  adapter.publishWorldSnapshots(100);
  await flushAsyncWork();

  assert.equal(writes.length, 2);
  assert.equal(writes[1]?.type, "world-server-event");
  assert.equal(writes[1]?.event.world.tick.currentTick, 3);

  closed.resolve();
  await streamPromise;
});

test("MetaverseWorldWebTransportAdapter binds stream subscriptions to one player identity and keeps only the latest buffered publish for slow subscribers", async () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    tickIntervalMs: createMilliseconds(50)
  });
  const adapter = new MetaverseWorldWebTransportAdapter(runtime);
  const session = adapter.openSession();
  const playerId = createMetaversePlayerId("latest-wins-harbor-pilot");
  const otherPlayerId = createMetaversePlayerId("other-harbor-pilot");
  const username = createUsername("Latest Wins Pilot");
  const blockedWrite = createDeferred();
  const closed = createDeferred();
  const writes = [];
  let writeCount = 0;

  assert.notEqual(playerId, null);
  assert.notEqual(otherPlayerId, null);
  assert.notEqual(username, null);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username
    }),
    0
  );

  const streamPromise = session.handleClientStream(
    {
      observerPlayerId: playerId,
      type: "world-snapshot-subscribe"
    },
    {
      closed: closed.promise,
      async writeResponse(response) {
        writes.push(response);
        writeCount += 1;

        if (writeCount === 1) {
          await blockedWrite.promise;
        }
      }
    },
    0
  );

  await flushAsyncWork();

  const identityMismatchResponse = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportSnapshotRequest({
      observerPlayerId: otherPlayerId
    }),
    0
  );

  assert.equal(identityMismatchResponse.type, "world-error");
  assert.match(identityMismatchResponse.message, /already bound/);

  runtime.advanceToTime(50);
  adapter.publishWorldSnapshots(50);
  runtime.advanceToTime(100);
  adapter.publishWorldSnapshots(100);
  await flushAsyncWork();

  assert.equal(writes.length, 1);

  blockedWrite.resolve();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(writes.length, 2);
  assert.equal(writes[1]?.type, "world-server-event");
  assert.equal(writes[1]?.event.world.tick.currentTick, 2);

  closed.resolve();
  await streamPromise;
});
