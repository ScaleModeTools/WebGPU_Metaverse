import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncMountedOccupancyCommand,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "../../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";
import {
  authoredWaterBaySkiffPlacement,
  authoredWaterBaySkiffYawRadians
} from "../../metaverse-authored-world-test-fixtures.mjs";
import { createAuthoritativeRuntime, requireValue } from "./authoritative-world-test-fixtures.mjs";

test("MetaverseAuthoritativeWorldRuntime preserves explicit mounted passenger look through presence fallback snapshots", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("presence-look-passenger"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Presence Look Passenger"),
    "username"
  );

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        animationVocabulary: "seated",
        look: {
          pitchRadians: 0.3,
          yawRadians: 0.5
        },
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "passenger",
          seatId: "port-bench-seat"
        },
        position: {
          x: 0,
          y: 0.4,
          z: 24
        },
        yawRadians: 0.2
      },
      username
    }),
    0
  );

  const presenceSnapshot = runtime.readPresenceRosterSnapshot(0, playerId);

  assert.equal(presenceSnapshot.players[0]?.pose.yawRadians, 0.2);
  assert.equal(presenceSnapshot.players[0]?.pose.look.pitchRadians, 0.3);
  assert.equal(presenceSnapshot.players[0]?.pose.look.yawRadians, 0.5);
});

test("MetaverseAuthoritativeWorldRuntime accepts mounted occupancy updates through reliable world commands", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("world-mounted-occupancy-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("World Mounted Occupancy Pilot"),
    "username"
  );

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
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
    createMetaverseSyncMountedOccupancyCommand({
      mountedOccupancy: {
        environmentAssetId: "metaverse-hub-skiff-v1",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "driver",
        seatId: "driver-seat"
      },
      playerId
    }),
    100
  );

  const mountedWorldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(mountedWorldSnapshot.players[0]?.lastProcessedInputSequence, 1);
  assert.equal(mountedWorldSnapshot.players[0]?.locomotionMode, "mounted");
  assert.equal(
    mountedWorldSnapshot.players[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
  assert.equal(
    mountedWorldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    playerId
  );

  runtime.acceptWorldCommand(
    createMetaverseSyncMountedOccupancyCommand({
      mountedOccupancy: null,
      playerId
    }),
    200
  );

  const dismountedWorldSnapshot = runtime.readWorldSnapshot(200, playerId);

  assert.equal(dismountedWorldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(dismountedWorldSnapshot.players[0]?.mountedOccupancy, null);
  assert.equal(dismountedWorldSnapshot.players[0]?.position.y, 0);
  assert.equal(
    dismountedWorldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    null
  );
});
