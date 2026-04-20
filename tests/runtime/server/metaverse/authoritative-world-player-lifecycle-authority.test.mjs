import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaverseLeavePresenceCommand,
  createMetaversePlayerId,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "../../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";
import { createAuthoritativeRuntime, requireValue } from "./authoritative-world-test-fixtures.mjs";

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
  runtime.advanceToTime(200);

  assert.equal(runtime.readPresenceRosterSnapshot(200, playerId).players.length, 1);

  runtime.advanceToTime(800);
  const prunedWorldSnapshot = runtime.readWorldSnapshot(800);

  assert.equal(prunedWorldSnapshot.players.length, 0);
  assert.equal(prunedWorldSnapshot.vehicles.length, 1);
  assert.equal(prunedWorldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId, null);
  assert.equal(runtime.readPresenceRosterSnapshot(800).players.length, 0);
  assert.throws(
    () => runtime.readWorldSnapshot(800, playerId),
    /Unknown metaverse player: watchful-harbor-pilot/
  );
});

test("MetaverseAuthoritativeWorldRuntime removes a leaving player and clears claimed vehicle occupancy", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("departing-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Departing Pilot"), "username");

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

  const mountedSnapshot = runtime.readWorldSnapshot(0, playerId);

  assert.equal(mountedSnapshot.players.length, 1);
  assert.equal(mountedSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId, playerId);

  runtime.acceptPresenceCommand(
    createMetaverseLeavePresenceCommand({ playerId }),
    100
  );

  const worldSnapshot = runtime.readWorldSnapshot(100);
  const presenceSnapshot = runtime.readPresenceRosterSnapshot(100);

  assert.equal(worldSnapshot.players.length, 0);
  assert.equal(worldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId, null);
  assert.equal(presenceSnapshot.players.length, 0);
  assert.throws(
    () => runtime.readWorldSnapshot(100, playerId),
    /Unknown metaverse player: departing-harbor-pilot/
  );
});
