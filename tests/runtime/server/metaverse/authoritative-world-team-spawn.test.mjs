import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createUsername,
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot,
  resolveMetaversePlayerTeamId,
  stagingGroundMapBundle
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "../../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";
import {
  registerAuthoritativeMetaverseMapBundlePreview
} from "../../../../server/dist/metaverse/world/map-bundles/load-authoritative-metaverse-map-bundle.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function requirePlayerIdForTeam(prefix, teamId) {
  for (let index = 1; index < 200; index += 1) {
    const playerId = createMetaversePlayerId(`${prefix}-${index}`);

    if (playerId !== null && resolveMetaversePlayerTeamId(playerId) === teamId) {
      return playerId;
    }
  }

  throw new Error(`Unable to resolve player id for team ${teamId}.`);
}

function createTeamSpawnPreviewBundle(mapId) {
  return Object.freeze({
    ...stagingGroundMapBundle,
    label: `Preview ${mapId}`,
    mapId,
    playerSpawnNodes: Object.freeze([
      Object.freeze({
        label: "Blue Base North",
        position: Object.freeze({
          x: -24,
          y: 0,
          z: -8
        }),
        spawnId: "blue-base-north",
        teamId: "blue",
        yawRadians: 0
      }),
      Object.freeze({
        label: "Blue Base South",
        position: Object.freeze({
          x: -24,
          y: 0,
          z: 8
        }),
        spawnId: "blue-base-south",
        teamId: "blue",
        yawRadians: 0
      }),
      Object.freeze({
        label: "Red Base North",
        position: Object.freeze({
          x: 24,
          y: 0,
          z: -8
        }),
        spawnId: "red-base-north",
        teamId: "red",
        yawRadians: Math.PI
      }),
      Object.freeze({
        label: "Red Base South",
        position: Object.freeze({
          x: 24,
          y: 0,
          z: 8
        }),
        spawnId: "red-base-south",
        teamId: "red",
        yawRadians: Math.PI
      })
    ]),
    playerSpawnSelection: Object.freeze({
      enemyAvoidanceRadiusMeters: 12,
      homeTeamBiasMeters: 8
    })
  });
}

function createDefaultSpawnJoinCommand(bundle, playerId, teamId, username) {
  return createMetaverseJoinPresenceCommand({
    characterId: "mesh2motion-humanoid-v1",
    playerId,
    pose: {
      position: bundle.playerSpawnNodes[0].position,
      stateSequence: 1,
      yawRadians: bundle.playerSpawnNodes[0].yawRadians
    },
    teamId,
    username
  });
}

function readPlayerSnapshot(worldSnapshot, playerId) {
  return requireValue(
    worldSnapshot.players.find((playerSnapshot) => playerSnapshot.playerId === playerId),
    "playerSnapshot"
  );
}

test("authoritative default joins land on the authored home base for each deterministic team lane", () => {
  const bundle = createTeamSpawnPreviewBundle("server-team-spawn-home-base-test");

  registerAuthoritativeMetaverseMapBundlePreview(bundle, "staging-ground");

  const runtime = new MetaverseAuthoritativeWorldRuntime({}, bundle.mapId);
  const bluePlayerId = requireValue(createMetaversePlayerId("blue-home"), "bluePlayerId");
  const redPlayerId = requireValue(createMetaversePlayerId("red-home"), "redPlayerId");
  const blueUsername = requireValue(createUsername("Blue Home"), "blueUsername");
  const redUsername = requireValue(createUsername("Red Home"), "redUsername");

  runtime.acceptPresenceCommand(
    createDefaultSpawnJoinCommand(bundle, bluePlayerId, "blue", blueUsername),
    0
  );
  runtime.acceptPresenceCommand(
    createDefaultSpawnJoinCommand(bundle, redPlayerId, "red", redUsername),
    0
  );

  const worldSnapshot = runtime.readWorldSnapshot(0);
  const blueSnapshot = readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
    readPlayerSnapshot(worldSnapshot, bluePlayerId)
  );
  const redSnapshot = readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
    readPlayerSnapshot(worldSnapshot, redPlayerId)
  );

  assert.equal(blueSnapshot.position.x, -24);
  assert.equal(Math.abs(blueSnapshot.position.z), 8);
  assert.equal(redSnapshot.position.x, 24);
  assert.equal(Math.abs(redSnapshot.position.z), 8);
});

test("authoritative default joins reroute to the safer enemy-free base when the home base is camped", () => {
  const bundle = createTeamSpawnPreviewBundle("server-team-spawn-reroute-test");

  registerAuthoritativeMetaverseMapBundlePreview(bundle, "staging-ground");

  const runtime = new MetaverseAuthoritativeWorldRuntime({}, bundle.mapId);
  const redCamperId = requireValue(createMetaversePlayerId("red-camper"), "redCamperId");
  const blueJoinerId = requireValue(createMetaversePlayerId("blue-joiner"), "blueJoinerId");
  const redUsername = requireValue(createUsername("Red Camper"), "redUsername");
  const blueUsername = requireValue(createUsername("Blue Joiner"), "blueUsername");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId: redCamperId,
      pose: {
        position: {
          x: -20,
          y: 0,
          z: 0
        },
        stateSequence: 1,
        yawRadians: 0
      },
      teamId: "red",
      username: redUsername
    }),
    0
  );
  runtime.acceptPresenceCommand(
    createDefaultSpawnJoinCommand(bundle, blueJoinerId, "blue", blueUsername),
    0
  );

  const worldSnapshot = runtime.readWorldSnapshot(0);
  const blueSnapshot = readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
    readPlayerSnapshot(worldSnapshot, blueJoinerId)
  );

  assert.equal(blueSnapshot.position.x, 24);
  assert.equal(Math.abs(blueSnapshot.position.z), 8);
});

test("authoritative world and presence snapshots preserve the explicitly assigned player teams", () => {
  const bundle = createTeamSpawnPreviewBundle("server-team-snapshot-team-id-test");

  registerAuthoritativeMetaverseMapBundlePreview(bundle, "staging-ground");

  const runtime = new MetaverseAuthoritativeWorldRuntime({}, bundle.mapId);
  const bluePlayerId = requireValue(
    createMetaversePlayerId("snapshot-blue-player"),
    "bluePlayerId"
  );
  const redPlayerId = requireValue(
    createMetaversePlayerId("snapshot-red-player"),
    "redPlayerId"
  );
  const blueUsername = requireValue(createUsername("Snapshot Blue"), "blueUsername");
  const redUsername = requireValue(createUsername("Snapshot Red"), "redUsername");

  runtime.acceptPresenceCommand(
    createDefaultSpawnJoinCommand(bundle, bluePlayerId, "blue", blueUsername),
    0
  );
  runtime.acceptPresenceCommand(
    createDefaultSpawnJoinCommand(bundle, redPlayerId, "red", redUsername),
    0
  );

  const worldSnapshot = runtime.readWorldSnapshot(0);
  const presenceSnapshot = runtime.readPresenceRosterSnapshot(0);

  assert.equal(readPlayerSnapshot(worldSnapshot, bluePlayerId).teamId, "blue");
  assert.equal(readPlayerSnapshot(worldSnapshot, redPlayerId).teamId, "red");
  assert.equal(
    presenceSnapshot.players.find((playerSnapshot) => playerSnapshot.playerId === bluePlayerId)
      ?.teamId,
    "blue"
  );
  assert.equal(
    presenceSnapshot.players.find((playerSnapshot) => playerSnapshot.playerId === redPlayerId)
      ?.teamId,
    "red"
  );
});

test("authoritative default joins rebalance deterministic default lanes so the second same-lane player fills the opposite team", () => {
  const bundle = createTeamSpawnPreviewBundle("server-team-spawn-balance-test");

  registerAuthoritativeMetaverseMapBundlePreview(bundle, "staging-ground");

  const runtime = new MetaverseAuthoritativeWorldRuntime({}, bundle.mapId);
  const firstBluePlayerId = requirePlayerIdForTeam("balanced-blue", "blue");
  const secondBluePlayerId = requirePlayerIdForTeam(
    "balanced-blue-later",
    "blue"
  );
  const firstBlueUsername = requireValue(
    createUsername("Balanced Blue One"),
    "firstBlueUsername"
  );
  const secondBlueUsername = requireValue(
    createUsername("Balanced Blue Two"),
    "secondBlueUsername"
  );

  runtime.acceptPresenceCommand(
    createDefaultSpawnJoinCommand(bundle, firstBluePlayerId, "blue", firstBlueUsername),
    0
  );
  runtime.acceptPresenceCommand(
    createDefaultSpawnJoinCommand(bundle, secondBluePlayerId, "blue", secondBlueUsername),
    0
  );

  const worldSnapshot = runtime.readWorldSnapshot(0);
  const firstSnapshot = readPlayerSnapshot(worldSnapshot, firstBluePlayerId);
  const secondSnapshot = readPlayerSnapshot(worldSnapshot, secondBluePlayerId);

  assert.equal(firstSnapshot.teamId, "blue");
  assert.equal(secondSnapshot.teamId, "red");
  assert.equal(
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(secondSnapshot).position.x,
    24
  );
});

test("authoritative default joins fan same-team players across authored home spawns instead of reusing one occupied start", () => {
  const bundle = createTeamSpawnPreviewBundle("server-team-spawn-friendly-fanout-test");

  registerAuthoritativeMetaverseMapBundlePreview(bundle, "staging-ground");

  const runtime = new MetaverseAuthoritativeWorldRuntime({}, bundle.mapId);
  const firstBluePlayerId = requirePlayerIdForTeam("blue-fanout", "blue");
  const secondBluePlayerId = requirePlayerIdForTeam(
    "blue-fanout-later",
    "red"
  );
  const firstBlueUsername = requireValue(createUsername("Blue Fanout One"), "firstBlueUsername");
  const secondBlueUsername = requireValue(createUsername("Blue Fanout Two"), "secondBlueUsername");

  runtime.acceptPresenceCommand(
    createDefaultSpawnJoinCommand(bundle, firstBluePlayerId, "blue", firstBlueUsername),
    0
  );
  runtime.acceptPresenceCommand(
    createDefaultSpawnJoinCommand(bundle, secondBluePlayerId, "blue", secondBlueUsername),
    0
  );

  const worldSnapshot = runtime.readWorldSnapshot(0);
  assert.equal(readPlayerSnapshot(worldSnapshot, firstBluePlayerId).teamId, "blue");
  assert.equal(readPlayerSnapshot(worldSnapshot, secondBluePlayerId).teamId, "blue");
  const firstBlueSnapshot = readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
    readPlayerSnapshot(worldSnapshot, firstBluePlayerId)
  );
  const secondBlueSnapshot = readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
    readPlayerSnapshot(worldSnapshot, secondBluePlayerId)
  );

  assert.equal(firstBlueSnapshot.position.x, -24);
  assert.equal(secondBlueSnapshot.position.x, -24);
  assert.equal(Math.abs(firstBlueSnapshot.position.z), 8);
  assert.equal(Math.abs(secondBlueSnapshot.position.z), 8);
  assert.notEqual(firstBlueSnapshot.position.z, secondBlueSnapshot.position.z);
});
