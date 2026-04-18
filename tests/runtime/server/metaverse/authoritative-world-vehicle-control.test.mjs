import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createUsername
} from "@webgpu-metaverse/shared";

import {
  authoredWaterBaySkiffPlacement,
  authoredWaterBaySkiffYawRadians
} from "../../metaverse-authored-world-test-fixtures.mjs";
import {
  createAuthoritativeRuntime,
  requireValue
} from "./authoritative-world-test-fixtures.mjs";

test("MetaverseAuthoritativeWorldRuntime simulates driver-controlled vehicles from authoritative world commands", () => {
  const runtime = createAuthoritativeRuntime();
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
      playerId
    }),
    100
  );
  runtime.advanceToTime(1_000);

  const worldSnapshot = runtime.readWorldSnapshot(1_000, playerId);

  assert.equal(worldSnapshot.tick.currentTick, 10);
  assert.equal(worldSnapshot.tick.emittedAtServerTimeMs, 1_000);
  assert.equal(worldSnapshot.tick.simulationTimeMs, 1_000);
  assert.equal(worldSnapshot.players.length, 1);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "mounted");
  assert.equal(worldSnapshot.players[0]?.position.x, 0);
  assert.equal(worldSnapshot.players[0]?.position.y, 0.4);
  assert.ok(Math.abs(worldSnapshot.players[0]?.position.z - 18.63) < 0.0001);
  assert.equal(worldSnapshot.players[0]?.linearVelocity.x, 0);
  assert.ok(
    Math.abs(worldSnapshot.players[0]?.linearVelocity.z + 10.5) < 0.0001
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
  assert.equal(worldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId, playerId);
  assert.equal(worldSnapshot.vehicles[0]?.position.x, 0);
  assert.ok(Math.abs(worldSnapshot.vehicles[0]?.position.z - 18.63) < 0.0001);
  assert.equal(worldSnapshot.vehicles[0]?.yawRadians, 0);
  assert.ok(
    Math.abs(worldSnapshot.vehicles[0]?.linearVelocity.z + 10.5) < 0.0001
  );
});

test("MetaverseAuthoritativeWorldRuntime coalesces driver control per tick and rejects duplicate or stale sequences", () => {
  const runtime = createAuthoritativeRuntime();
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
          x: authoredWaterBaySkiffPlacement.x,
          y: 0.4,
          z: authoredWaterBaySkiffPlacement.z
        },
        stateSequence: 1,
        yawRadians: authoredWaterBaySkiffYawRadians
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
  runtime.advanceToTime(100);

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(worldSnapshot.tick.currentTick, 1);
  assert.ok(
    (worldSnapshot.vehicles[0]?.position.x ?? Number.POSITIVE_INFINITY) <
      authoredWaterBaySkiffPlacement.x
  );
  assert.ok((worldSnapshot.vehicles[0]?.linearVelocity.x ?? 0) < 0);
  assert.ok(
    (worldSnapshot.players[0]?.position.x ?? Number.POSITIVE_INFINITY) <
      authoredWaterBaySkiffPlacement.x
  );
  assert.ok((worldSnapshot.players[0]?.linearVelocity.x ?? 0) < 0);
});

test("MetaverseAuthoritativeWorldRuntime keeps a claimed driver seat exclusive and ignores conflicting driver control", () => {
  const runtime = createAuthoritativeRuntime();
  const firstDriverPlayerId = requireValue(
    createMetaversePlayerId("first-harbor-pilot"),
    "first driver playerId"
  );
  const conflictingDriverPlayerId = requireValue(
    createMetaversePlayerId("conflicting-harbor-pilot"),
    "conflicting driver playerId"
  );
  const firstDriverUsername = requireValue(
    createUsername("First Harbor Pilot"),
    "first driver username"
  );
  const conflictingDriverUsername = requireValue(
    createUsername("Conflicting Harbor Pilot"),
    "conflicting driver username"
  );

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId: firstDriverPlayerId,
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
          x: authoredWaterBaySkiffPlacement.x,
          y: 0.4,
          z: authoredWaterBaySkiffPlacement.z
        },
        stateSequence: 1,
        yawRadians: authoredWaterBaySkiffYawRadians
      },
      username: firstDriverUsername
    }),
    0
  );
  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId: conflictingDriverPlayerId,
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
          x: authoredWaterBaySkiffPlacement.x + 1,
          y: 0.4,
          z: authoredWaterBaySkiffPlacement.z
        },
        stateSequence: 1,
        yawRadians: authoredWaterBaySkiffYawRadians
      },
      username: conflictingDriverUsername
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
      controlSequence: 1,
      playerId: conflictingDriverPlayerId
    }),
    20
  );
  runtime.advanceToTime(200);

  const worldSnapshot = runtime.readWorldSnapshot(200, firstDriverPlayerId);
  const firstDriverSnapshot = worldSnapshot.players.find(
    (playerSnapshot) => playerSnapshot.playerId === firstDriverPlayerId
  );
  const conflictingDriverSnapshot = worldSnapshot.players.find(
    (playerSnapshot) => playerSnapshot.playerId === conflictingDriverPlayerId
  );

  assert.equal(worldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId, firstDriverPlayerId);
  assert.equal(worldSnapshot.vehicles[0]?.position.x, authoredWaterBaySkiffPlacement.x);
  assert.equal(worldSnapshot.vehicles[0]?.linearVelocity.x, 0);
  assert.equal(firstDriverSnapshot?.mountedOccupancy?.seatId, "driver-seat");
  assert.equal(conflictingDriverSnapshot?.mountedOccupancy, null);
  assert.equal(conflictingDriverSnapshot?.locomotionMode, "swim");
});
