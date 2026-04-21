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
import {
  createAuthoritativeRuntime,
  createMetaverseSyncPlayerTraversalIntentCommand,
  readPrimaryPlayerActiveBodySnapshot,
  requireValue
} from "./authoritative-world-test-fixtures.mjs";

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

  assert.equal(
    presenceSnapshot.players[0]?.pose.yawRadians,
    authoredWaterBaySkiffYawRadians
  );
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

  assert.equal(mountedWorldSnapshot.observerPlayer?.lastProcessedInputSequence, 1);
  assert.equal(mountedWorldSnapshot.players[0]?.locomotionMode, "mounted");
  assert.equal(
    mountedWorldSnapshot.players[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
  assert.equal(
    mountedWorldSnapshot.vehicles[0]?.position.y,
    authoredWaterBaySkiffPlacement.y
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
  const dismountedActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(dismountedWorldSnapshot);

  assert.equal(dismountedWorldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(dismountedWorldSnapshot.players[0]?.mountedOccupancy, null);
  assert.equal(dismountedActiveBodySnapshot.position.y, 0);
  assert.equal(dismountedActiveBodySnapshot.linearVelocity.y, 0);
  assert.equal(
    dismountedWorldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    null
  );
});

test("MetaverseAuthoritativeWorldRuntime keeps authored entry occupancy grounded while preserving free-roam traversal input under reliable world authority", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("world-mounted-entry-free-roam"),
    "playerId"
  );
  const username = requireValue(
    createUsername("World Mounted Entry Free Roam"),
    "username"
  );
  const deckSupportHeightMeters = authoredWaterBaySkiffPlacement.y + 0.68;

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: authoredWaterBaySkiffPlacement.x,
          y: deckSupportHeightMeters,
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
        entryId: "deck-entry",
        occupancyKind: "entry",
        occupantRole: "passenger",
        seatId: null
      },
      playerId
    }),
    100
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    100
  );
  const entryWorldSnapshot = runtime.readWorldSnapshot(100, playerId);
  const entryActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(entryWorldSnapshot);

  assert.equal(entryWorldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok(
    Math.abs(entryActiveBodySnapshot.position.y - deckSupportHeightMeters) < 0.05,
    `expected free-roam deck occupancy acceptance to stay on authored deck support, received ${JSON.stringify(entryActiveBodySnapshot.position)}`
  );

  runtime.advanceToTime(200);

  const worldSnapshot = runtime.readWorldSnapshot(200, playerId);
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);
  assert.equal(worldSnapshot.observerPlayer?.lastProcessedInputSequence, 2);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.equal(
    worldSnapshot.players[0]?.mountedOccupancy?.occupancyKind,
    "entry"
  );
  assert.equal(worldSnapshot.players[0]?.mountedOccupancy?.entryId, "deck-entry");
  assert.equal(activeBodySnapshot.grounded, true);
  assert.equal(activeBodySnapshot.contact.supportingContactDetected, true);
  assert.equal(activeBodySnapshot.driveTarget.moveAxis, 1);
  assert.equal(
    activeBodySnapshot.driveTarget.targetPlanarSpeedUnitsPerSecond > 0,
    true
  );
});
