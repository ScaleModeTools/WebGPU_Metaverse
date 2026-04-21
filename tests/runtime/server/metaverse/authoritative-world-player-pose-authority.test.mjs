import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncPresenceCommand,
  createUsername
} from "@webgpu-metaverse/shared";

import {
  createAuthoritativeRuntime,
  createMetaverseSyncPlayerTraversalIntentCommand,
  joinSurfacePlayer,
  readPlayerActiveBodySnapshot,
  requireValue
} from "./authoritative-world-test-fixtures.mjs";

test("MetaverseAuthoritativeWorldRuntime keeps presence resyncs from overriding realtime world pose authority", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("presence-authority-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Presence Authority Pilot"),
    "username"
  );

  joinSurfacePlayer(runtime, playerId, username);
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        yawRadians: Math.PI * 0.06,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(200);

  const authoritativeWorldSnapshot = runtime.readWorldSnapshot(200, playerId);
  const authoritativePlayerSnapshot = authoritativeWorldSnapshot.players[0];

  assert.notEqual(authoritativePlayerSnapshot, undefined);
  assert.equal(
    authoritativeWorldSnapshot.observerPlayer?.lastProcessedInputSequence,
    2
  );
  assert.equal(authoritativePlayerSnapshot?.stateSequence, 2);

  runtime.acceptPresenceCommand(
    createMetaverseSyncPresenceCommand({
      playerId,
      pose: {
        animationVocabulary: "jump-down",
        locomotionMode: "swim",
        look: {
          pitchRadians: 0.45,
          yawRadians: 1.1
        },
        position: {
          x: 42,
          y: 12,
          z: 96
        },
        stateSequence: 99,
        yawRadians: 1.4
      }
    }),
    200
  );

  let worldSnapshot = runtime.readWorldSnapshot(200, playerId);

  assert.deepEqual(
    readPlayerActiveBodySnapshot(worldSnapshot.players[0]).position,
    readPlayerActiveBodySnapshot(authoritativePlayerSnapshot).position
  );
  assert.equal(worldSnapshot.observerPlayer?.lastProcessedInputSequence, 2);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.equal(worldSnapshot.players[0]?.stateSequence, 2);

  let presenceSnapshot = runtime.readPresenceRosterSnapshot(200, playerId);

  assert.deepEqual(
    presenceSnapshot.players[0]?.pose.position,
    readPlayerActiveBodySnapshot(authoritativePlayerSnapshot).position
  );
  assert.equal(presenceSnapshot.players[0]?.pose.stateSequence, 2);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        animationVocabulary: "swim",
        locomotionMode: "swim",
        look: {
          pitchRadians: -0.25,
          yawRadians: -1.2
        },
        position: {
          x: -33,
          y: 4,
          z: 18
        },
        stateSequence: 100,
        yawRadians: -0.7
      },
      username
    }),
    200
  );

  worldSnapshot = runtime.readWorldSnapshot(200, playerId);
  presenceSnapshot = runtime.readPresenceRosterSnapshot(200, playerId);

  assert.deepEqual(
    readPlayerActiveBodySnapshot(worldSnapshot.players[0]).position,
    readPlayerActiveBodySnapshot(authoritativePlayerSnapshot).position
  );
  assert.equal(worldSnapshot.observerPlayer?.lastProcessedInputSequence, 2);
  assert.equal(worldSnapshot.players[0]?.stateSequence, 2);
  assert.deepEqual(
    presenceSnapshot.players[0]?.pose.position,
    readPlayerActiveBodySnapshot(authoritativePlayerSnapshot).position
  );
  assert.equal(presenceSnapshot.players[0]?.pose.stateSequence, 2);
});
