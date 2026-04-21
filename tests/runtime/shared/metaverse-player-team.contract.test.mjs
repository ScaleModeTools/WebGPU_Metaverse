import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseRealtimePlayerSnapshot,
  createUsername,
  normalizeMetaversePlayerTeamId,
  resolveMetaversePlayerTeamId
} from "@webgpu-metaverse/shared";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

test("shared metaverse player team helpers default joins and realtime snapshots to the deterministic team lane", () => {
  const playerId = requireValue(
    createMetaversePlayerId("shared-team-default-player"),
    "playerId"
  );
  const username = requireValue(createUsername("Shared Team"), "username");
  const expectedTeamId = resolveMetaversePlayerTeamId(playerId);
  const joinCommand = createMetaverseJoinPresenceCommand({
    characterId: "mesh2motion-humanoid-v1",
    playerId,
    pose: {
      position: {
        x: 0,
        y: 0,
        z: 0
      },
      yawRadians: 0
    },
    username
  });
  const playerSnapshot = createMetaverseRealtimePlayerSnapshot({
    characterId: "mesh2motion-humanoid-v1",
    groundedBody: {
      linearVelocity: {
        x: 0,
        y: 0,
        z: 0
      },
      position: {
        x: 0,
        y: 0,
        z: 0
      },
      yawRadians: 0
    },
    playerId,
    username
  });

  assert.equal(normalizeMetaversePlayerTeamId(undefined, playerId), expectedTeamId);
  assert.equal(joinCommand.teamId, expectedTeamId);
  assert.equal(playerSnapshot.teamId, expectedTeamId);
});

test("shared metaverse player team helpers preserve explicit team assignment when match policy sets it before spawn", () => {
  const playerId = requireValue(
    createMetaversePlayerId("shared-team-explicit-player"),
    "playerId"
  );
  const username = requireValue(createUsername("Explicit Team"), "username");
  const joinCommand = createMetaverseJoinPresenceCommand({
    characterId: "mesh2motion-humanoid-v1",
    playerId,
    pose: {
      position: {
        x: 0,
        y: 0,
        z: 0
      },
      yawRadians: 0
    },
    teamId: "blue",
    username
  });
  const playerSnapshot = createMetaverseRealtimePlayerSnapshot({
    characterId: "mesh2motion-humanoid-v1",
    groundedBody: {
      linearVelocity: {
        x: 0,
        y: 0,
        z: 0
      },
      position: {
        x: 0,
        y: 0,
        z: 0
      },
      yawRadians: 0
    },
    playerId,
    teamId: "red",
    username
  });

  assert.equal(joinCommand.teamId, "blue");
  assert.equal(playerSnapshot.teamId, "red");
});
