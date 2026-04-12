import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

test("MetaverseAuthoritativeWorldRuntime simulates driver-controlled vehicles from authoritative world commands", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Harbor Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
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
        stateSequence: 1,
        yawRadians: 0
      }
    }),
    0
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 1,
      playerId,
    }),
    100
  );

  const worldSnapshot = runtime.readWorldSnapshot(1_000, playerId);

  assert.equal(worldSnapshot.tick.currentTick, 10);
  assert.equal(worldSnapshot.tick.serverTimeMs, 1_000);
  assert.equal(worldSnapshot.players.length, 1);
  assert.equal(worldSnapshot.players[0]?.animationVocabulary, "idle");
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "mounted");
  assert.equal(worldSnapshot.players[0]?.position.x, 0);
  assert.equal(worldSnapshot.players[0]?.position.y, 0.4);
  assert.ok(Math.abs(worldSnapshot.players[0]?.position.z - 18.63) < 0.000001);
  assert.equal(worldSnapshot.players[0]?.linearVelocity.x, 0);
  assert.ok(
    Math.abs(worldSnapshot.players[0]?.linearVelocity.z + 10.5) < 0.000001
  );
  assert.equal(
    worldSnapshot.players[0]?.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(worldSnapshot.players[0]?.mountedOccupancy?.seatId, "driver-seat");
  assert.equal(
    worldSnapshot.players[0]?.mountedOccupancy?.vehicleId,
    worldSnapshot.vehicles[0]?.vehicleId
  );
  assert.equal(worldSnapshot.vehicles.length, 1);
  assert.equal(
    worldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    playerId
  );
  assert.equal(worldSnapshot.vehicles[0]?.position.x, 0);
  assert.ok(Math.abs(worldSnapshot.vehicles[0]?.position.z - 18.63) < 0.000001);
  assert.equal(worldSnapshot.vehicles[0]?.yawRadians, 0);
  assert.ok(
    Math.abs(worldSnapshot.vehicles[0]?.linearVelocity.z + 10.5) < 0.000001
  );
});

test("MetaverseAuthoritativeWorldRuntime prunes inactive players while keeping vehicle state and presence projection coherent", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(500),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("watchful-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Watchful Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
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
        stateSequence: 1,
        yawRadians: 0
      },
      username
    }),
    0
  );

  assert.equal(runtime.readPresenceRosterSnapshot(200, playerId).players.length, 1);

  const prunedWorldSnapshot = runtime.readWorldSnapshot(800);

  assert.equal(prunedWorldSnapshot.players.length, 0);
  assert.equal(prunedWorldSnapshot.vehicles.length, 1);
  assert.equal(
    prunedWorldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    null
  );
  assert.equal(runtime.readPresenceRosterSnapshot(800).players.length, 0);
  assert.throws(
    () => runtime.readWorldSnapshot(800, playerId),
    /Unknown metaverse player: watchful-harbor-pilot/
  );
});

test("MetaverseAuthoritativeWorldRuntime coalesces driver control per tick and rejects duplicate or stale sequences", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("coalesced-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Coalesced Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
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
        stateSequence: 1,
        yawRadians: 0
      },
      username
    }),
    0
  );

  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 1,
      playerId
    }),
    10
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: -1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 2,
      playerId
    }),
    20
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 2,
      playerId
    }),
    30
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 1,
      playerId
    }),
    40
  );

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(worldSnapshot.tick.currentTick, 1);
  assert.ok((worldSnapshot.vehicles[0]?.position.z ?? 0) > 24);
  assert.ok((worldSnapshot.vehicles[0]?.linearVelocity.z ?? 0) > 0);
  assert.ok((worldSnapshot.players[0]?.position.z ?? 0) > 24);
  assert.ok((worldSnapshot.players[0]?.linearVelocity.z ?? 0) > 0);
});
