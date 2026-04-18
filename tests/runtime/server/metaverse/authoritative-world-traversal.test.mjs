import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createUsername
} from "@webgpu-metaverse/shared";

import { authoredWaterBayOpenWaterSpawn } from "../../metaverse-authored-world-test-fixtures.mjs";
import {
  createAuthoritativeRuntime,
  createMetaverseSyncPlayerTraversalIntentCommand,
  joinSurfacePlayer,
  requireValue,
  shippedGroundedSpawnSupportHeightMeters
} from "./authoritative-world-test-fixtures.mjs";

test("MetaverseAuthoritativeWorldRuntime simulates unmounted grounded and swim traversal from authoritative traversal intent commands", () => {
  const groundedRuntime = createAuthoritativeRuntime();
  const groundedPlayerId = requireValue(
    createMetaversePlayerId("world-traversal-harbor-pilot"),
    "playerId"
  );
  const groundedUsername = requireValue(
    createUsername("World Traversal Pilot"),
    "username"
  );

  joinSurfacePlayer(groundedRuntime, groundedPlayerId, groundedUsername, {
    yawRadians: 0
  });
  groundedRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "swim",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId: groundedPlayerId
    }),
    0
  );
  groundedRuntime.advanceToTime(200);

  const groundedWorldSnapshot =
    groundedRuntime.readWorldSnapshot(200, groundedPlayerId);

  assert.equal(groundedWorldSnapshot.tick.currentTick, 2);
  assert.equal(groundedWorldSnapshot.players[0]?.lastProcessedInputSequence, 2);
  assert.equal(groundedWorldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok((groundedWorldSnapshot.players[0]?.position.y ?? 0) > 0.4);
  assert.ok(
    (groundedWorldSnapshot.players[0]?.position.y ?? 0) <
      shippedGroundedSpawnSupportHeightMeters
  );
  assert.ok((groundedWorldSnapshot.players[0]?.position.z ?? -14.8) < -14.8);
  assert.ok((groundedWorldSnapshot.players[0]?.linearVelocity.z ?? 0) < 0);
  assert.equal(groundedWorldSnapshot.players[0]?.stateSequence, 2);

  const swimRuntime = createAuthoritativeRuntime();
  const swimPlayerId = requireValue(
    createMetaversePlayerId("world-swim-harbor-pilot"),
    "swimPlayerId"
  );
  const swimUsername = requireValue(
    createUsername("World Swim Pilot"),
    "swimUsername"
  );

  swimRuntime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId: swimPlayerId,
      pose: {
        position: authoredWaterBayOpenWaterSpawn,
        stateSequence: 1,
        yawRadians: 0
      },
      username: swimUsername
    }),
    0
  );
  swimRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: true,
        inputSequence: 3,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId: swimPlayerId
    }),
    0
  );
  swimRuntime.advanceToTime(500);

  const swimWorldSnapshot = swimRuntime.readWorldSnapshot(500, swimPlayerId);

  assert.equal(swimWorldSnapshot.players[0]?.lastProcessedInputSequence, 3);
  assert.equal(swimWorldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(swimWorldSnapshot.players[0]?.position.y, 0);
  assert.ok(
    (swimWorldSnapshot.players[0]?.position.z ?? Number.POSITIVE_INFINITY) <
      authoredWaterBayOpenWaterSpawn.z
  );
  assert.ok((swimWorldSnapshot.players[0]?.linearVelocity.z ?? 0) < 0);
  assert.equal(swimWorldSnapshot.players[0]?.stateSequence, 3);
});
