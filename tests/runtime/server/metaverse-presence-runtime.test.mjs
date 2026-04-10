import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaverseLeavePresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncPresenceCommand,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaversePresenceRuntime } from "../../../server/dist/metaverse/classes/metaverse-presence-runtime.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

test("MetaversePresenceRuntime tracks authoritative hub presence and ignores stale pose updates", () => {
  const runtime = new MetaversePresenceRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(120)
  });
  const playerId = requireValue(
    createMetaversePlayerId("harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Harbor Pilot"), "username");

  const joinedEvent = runtime.acceptCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "grounded",
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

  runtime.acceptCommand(
    createMetaverseSyncPresenceCommand({
      playerId,
      pose: {
        animationVocabulary: "walk",
        locomotionMode: "grounded",
        position: {
          x: 1.5,
          y: 1.62,
          z: 22
        },
        stateSequence: 4,
        yawRadians: 0.5
      }
    }),
    100
  );
  const staleSyncEvent = runtime.acceptCommand(
    createMetaverseSyncPresenceCommand({
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "grounded",
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: 2,
        yawRadians: 0
      }
    }),
    120
  );

  assert.equal(joinedEvent.type, "presence-roster");
  assert.equal(joinedEvent.roster.players.length, 1);
  assert.equal(staleSyncEvent.roster.players[0]?.pose.animationVocabulary, "walk");
  assert.equal(staleSyncEvent.roster.players[0]?.pose.position.x, 1.5);
  assert.equal(staleSyncEvent.roster.players[0]?.pose.stateSequence, 4);
  assert.equal(staleSyncEvent.roster.tickIntervalMs, 120);
});

test("MetaversePresenceRuntime prunes inactive players and rejects unknown-player access", () => {
  const runtime = new MetaversePresenceRuntime({
    playerInactivityTimeoutMs: createMilliseconds(500),
    tickIntervalMs: createMilliseconds(150)
  });
  const playerId = requireValue(
    createMetaversePlayerId("stale-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Stale Pilot"), "username");

  runtime.acceptCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "grounded",
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

  assert.equal(runtime.readRosterSnapshot(200, playerId).players.length, 1);
  assert.equal(runtime.readRosterSnapshot(800).players.length, 0);
  assert.throws(
    () => runtime.readRosterSnapshot(800, playerId),
    /Unknown metaverse player: stale-harbor-pilot/
  );
  assert.throws(
    () =>
      runtime.acceptCommand(
        createMetaverseLeavePresenceCommand({
          playerId
        }),
        900
      ),
    /Unknown metaverse player: stale-harbor-pilot/
  );
});

test("MetaversePresenceRuntime treats observer polling as presence activity", () => {
  const runtime = new MetaversePresenceRuntime({
    playerInactivityTimeoutMs: createMilliseconds(500),
    tickIntervalMs: createMilliseconds(150)
  });
  const playerId = requireValue(
    createMetaversePlayerId("watchful-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Watchful Pilot"), "username");

  runtime.acceptCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "grounded",
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

  assert.equal(runtime.readRosterSnapshot(200, playerId).players.length, 1);
  assert.equal(runtime.readRosterSnapshot(400, playerId).players.length, 1);
  assert.equal(runtime.readRosterSnapshot(800, playerId).players.length, 1);
  assert.equal(runtime.readRosterSnapshot(1_301).players.length, 0);
});
