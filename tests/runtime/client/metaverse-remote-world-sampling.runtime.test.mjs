import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldSnapshot,
  createMetaverseVehicleId,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

function createWorldSnapshot({
  currentTick,
  playerId,
  serverTimeMs,
  snapshotSequence,
  tickIntervalMs = 50,
  vehicleId,
  vehicleX = 0,
  worldPlayerX
}) {
  return createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        angularVelocityRadiansPerSecond: 0,
        characterId: "mesh2motion-humanoid-v1",
        jumpAuthorityState: "grounded",
        linearVelocity: {
          x: 2,
          y: 0,
          z: 0
        },
        look: {
          pitchRadians: 0,
          yawRadians: 0
        },
        locomotionMode: "grounded",
        mountedOccupancy: null,
        playerId,
        position: {
          x: worldPlayerX,
          y: 1,
          z: 0
        },
        stateSequence: snapshotSequence,
        username: createUsername("Harbor Pilot"),
        yawRadians: 0
      }
    ],
    snapshotSequence,
    tick: {
      currentTick,
      serverTimeMs,
      tickIntervalMs
    },
    vehicles: [
      {
        angularVelocityRadiansPerSecond: 0,
        driverPlayerId: null,
        environmentAssetId: "metaverse-hub-skiff-v1",
        linearVelocity: {
          x: 1,
          y: 0,
          z: 0
        },
        mountedOccupancyBySeatId: {},
        passengers: [],
        position: {
          x: vehicleX,
          y: 0,
          z: 0
        },
        seats: [],
        vehicleId,
        yawRadians: 0
      }
    ]
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("resolveMetaverseRemoteWorldSampledFrame interpolates between authoritative snapshots and extrapolates from the latest snapshot", async () => {
  const {
    resolveMetaverseRemoteWorldSampledFrame
  } = await clientLoader.load(
    "/src/metaverse/remote-world/metaverse-remote-world-sampling.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const vehicleId = createMetaverseVehicleId("metaverse-hub-skiff-v1");

  assert.notEqual(playerId, null);
  assert.notEqual(vehicleId, null);

  const firstSnapshot = createWorldSnapshot({
    currentTick: 10,
    playerId,
    serverTimeMs: 1_000,
    snapshotSequence: 10,
    vehicleId,
    vehicleX: 8,
    worldPlayerX: 4
  });
  const secondSnapshot = createWorldSnapshot({
    currentTick: 11,
    playerId,
    serverTimeMs: 1_050,
    snapshotSequence: 11,
    vehicleId,
    vehicleX: 10,
    worldPlayerX: 6
  });

  const interpolatedFrame = resolveMetaverseRemoteWorldSampledFrame(
    [firstSnapshot, secondSnapshot],
    1_025,
    120
  );

  assert.notEqual(interpolatedFrame, null);
  assert.equal(interpolatedFrame?.baseSnapshot.snapshotSequence, 10);
  assert.equal(interpolatedFrame?.nextSnapshot?.snapshotSequence, 11);
  assert.equal(interpolatedFrame?.extrapolationSeconds, 0);
  assert.ok(Math.abs((interpolatedFrame?.alpha ?? 0) - 0.5) < 0.0001);

  const extrapolatedFrame = resolveMetaverseRemoteWorldSampledFrame(
    [secondSnapshot],
    1_110,
    120
  );

  assert.notEqual(extrapolatedFrame, null);
  assert.equal(extrapolatedFrame?.baseSnapshot.snapshotSequence, 11);
  assert.equal(extrapolatedFrame?.nextSnapshot, null);
  assert.ok(Math.abs((extrapolatedFrame?.extrapolationSeconds ?? 0) - 0.06) < 0.0001);
});

test("resolveMetaverseRemoteWorldFreshLatestSnapshot gates stale latest snapshots and indexes player or vehicle lookups", async () => {
  const {
    indexMetaverseWorldPlayersByPlayerId,
    indexMetaverseWorldVehiclesByVehicleId,
    readMetaverseWorldPlayerSnapshotByPlayerId,
    resolveMetaverseRemoteWorldFreshLatestSnapshot
  } = await clientLoader.load(
    "/src/metaverse/remote-world/metaverse-remote-world-sampling.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const vehicleId = createMetaverseVehicleId("metaverse-hub-skiff-v1");

  assert.notEqual(playerId, null);
  assert.notEqual(vehicleId, null);

  const latestSnapshot = createWorldSnapshot({
    currentTick: 20,
    playerId,
    serverTimeMs: 2_000,
    snapshotSequence: 20,
    vehicleId,
    vehicleX: 12,
    worldPlayerX: 7
  });
  const playerSnapshotsByPlayerId = new Map();
  const vehicleSnapshotsByVehicleId = new Map();

  indexMetaverseWorldPlayersByPlayerId(
    latestSnapshot.players,
    playerSnapshotsByPlayerId
  );
  indexMetaverseWorldVehiclesByVehicleId(
    latestSnapshot.vehicles,
    vehicleSnapshotsByVehicleId
  );

  assert.equal(
    playerSnapshotsByPlayerId.get(playerId)?.position.x,
    7
  );
  assert.equal(vehicleSnapshotsByVehicleId.get(vehicleId)?.position.x, 12);
  assert.equal(
    readMetaverseWorldPlayerSnapshotByPlayerId(latestSnapshot, playerId)?.stateSequence,
    20
  );

  assert.equal(
    resolveMetaverseRemoteWorldFreshLatestSnapshot(
      [latestSnapshot],
      2_040,
      50
    )?.snapshotSequence,
    20
  );
  assert.equal(
    resolveMetaverseRemoteWorldFreshLatestSnapshot(
      [latestSnapshot],
      2_080,
      50
    ),
    null
  );
});
