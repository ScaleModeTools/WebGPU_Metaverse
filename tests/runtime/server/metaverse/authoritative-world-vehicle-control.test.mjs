import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createUsername
} from "@webgpu-metaverse/shared";

import {
  authoredWaterBayDockEntryPosition,
  authoredWaterBaySkiffPlacement,
  authoredWaterBaySkiffYawRadians
} from "../../metaverse-authored-world-test-fixtures.mjs";
import {
  createAuthoritativeRuntime,
  readPlayerActiveBodySnapshot,
  readPrimaryPlayerActiveBodySnapshot,
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
      characterId: "mesh2motion-humanoid-v1",
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
    100
  );
  runtime.advanceToTime(1_000);

  const worldSnapshot = runtime.readWorldSnapshot(1_000, playerId);
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.equal(worldSnapshot.tick.currentTick, 10);
  assert.equal(worldSnapshot.tick.emittedAtServerTimeMs, 1_000);
  assert.equal(worldSnapshot.tick.simulationTimeMs, 1_000);
  assert.equal(worldSnapshot.players.length, 1);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "mounted");
  assert.equal(activeBodySnapshot.position.y, 0.4);
  assert.ok(activeBodySnapshot.position.x > authoredWaterBaySkiffPlacement.x);
  assert.ok(activeBodySnapshot.linearVelocity.x > 0);
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
  assert.ok(
    (worldSnapshot.vehicles[0]?.position.x ?? Number.NEGATIVE_INFINITY) >
      authoredWaterBaySkiffPlacement.x
  );
  assert.equal(
    worldSnapshot.vehicles[0]?.yawRadians,
    authoredWaterBaySkiffYawRadians
  );
  assert.ok(
    (worldSnapshot.vehicles[0]?.linearVelocity.x ?? 0) > 0
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
      characterId: "mesh2motion-humanoid-v1",
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
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.equal(worldSnapshot.tick.currentTick, 1);
  assert.ok(
    (worldSnapshot.vehicles[0]?.position.x ?? Number.POSITIVE_INFINITY) <
      authoredWaterBaySkiffPlacement.x
  );
  assert.ok((worldSnapshot.vehicles[0]?.linearVelocity.x ?? 0) < 0);
  assert.ok(activeBodySnapshot.position.x < authoredWaterBaySkiffPlacement.x);
  assert.ok(activeBodySnapshot.linearVelocity.x < 0);
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
      characterId: "mesh2motion-humanoid-v1",
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
      characterId: "mesh2motion-humanoid-v1",
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
  assert.equal(readPlayerActiveBodySnapshot(firstDriverSnapshot).position.x, authoredWaterBaySkiffPlacement.x);
});

test("MetaverseAuthoritativeWorldRuntime rejects mounted occupancy for unauthored seats", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("invalid-seat-pilot"),
    "invalid seat playerId"
  );
  const username = requireValue(createUsername("Invalid Seat Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "imaginary-seat"
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
  runtime.advanceToTime(100);

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(worldSnapshot.players[0]?.mountedOccupancy, null);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(worldSnapshot.vehicles.length, 0);
});

test("MetaverseAuthoritativeWorldRuntime ignores mounted driver propulsion when the vehicle is beached out of authored water", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("beached-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Beached Harbor Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
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
        position: authoredWaterBayDockEntryPosition,
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
    100
  );
  runtime.advanceToTime(1_000);

  const worldSnapshot = runtime.readWorldSnapshot(1_000, playerId);
  const authoritativeVehicle = worldSnapshot.vehicles[0];

  assert.ok(
    Math.abs(
      (authoritativeVehicle?.position.x ?? Number.POSITIVE_INFINITY) -
        authoredWaterBayDockEntryPosition.x
    ) < 0.00001
  );
  assert.ok(
    Math.abs(
      (authoritativeVehicle?.position.z ?? Number.POSITIVE_INFINITY) -
        authoredWaterBayDockEntryPosition.z
    ) < 0.00001
  );
  assert.equal(authoritativeVehicle?.linearVelocity.x, 0);
  assert.equal(authoritativeVehicle?.linearVelocity.z, 0);
});
