import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaversePlayerId,
  createMetaverseSurfaceDriveBodyRuntimeSnapshot,
  createMetaverseTraversalAuthoritySnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  createUsername,
  metaverseHubPushableCrateEnvironmentAssetId
} from "@webgpu-metaverse/shared";
import {
  createMetaverseAuthoritativeWorldSnapshot
} from "../../../../server/dist/metaverse/authority/snapshots/metaverse-authoritative-world-snapshot-assembly.js";

import {
  createAuthoritativeRuntime,
  createMetaverseSyncPlayerTraversalIntentCommand,
  joinSurfacePlayer,
  requireValue
} from "./authoritative-world-test-fixtures.mjs";

function createVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

test("MetaverseAuthoritativeWorldRuntime includes player turn rate in authoritative world snapshots", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("turn-rate-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Turn Rate Pilot"), "username");

  joinSurfacePlayer(runtime, playerId, username, {
    yawRadians: 0
  });
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        sequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawRadians: 0.36,
        yawAxis: 1
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(100);

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.ok(
    Math.abs(
      (worldSnapshot.players[0]?.angularVelocityRadiansPerSecond ?? 0) - 3.6
    ) < 0.000001
  );
});

test("Metaverse authoritative world snapshots publish grounded body capsule pose", () => {
  const playerId = requireValue(
    createMetaversePlayerId("snapshot-capsule-authority-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Snapshot Capsule Authority Pilot"),
    "username"
  );
  const capsulePosition = createVector3(2.5, 1.2, -4);
  const capsuleVelocity = createVector3(1, 0, -2);
  const groundedBodySnapshot = createMetaverseGroundedBodyRuntimeSnapshot({
    grounded: true,
    linearVelocity: capsuleVelocity,
    position: capsulePosition,
    yawRadians: 0.75
  });

  const worldSnapshot = createMetaverseAuthoritativeWorldSnapshot({
    combatEvents: [],
    combatFeed: [],
    combatMatch: null,
    currentTick: 3,
    environmentBodies: [],
    lastAdvancedAtMs: 300,
    nowMs: 300,
    playerCombatActionObserverSnapshotsByPlayerId: new Map(),
    playerCombatSnapshotsByPlayerId: new Map(),
    players: [
      {
        angularVelocityRadiansPerSecond: 0,
        characterId: "mesh2motion-humanoid-v1",
        groundedBodyRuntime: {
          snapshot: groundedBodySnapshot
        },
        lastProcessedLookSequence: 0,
        lastProcessedTraversalSequence: 0,
        lastProcessedWeaponSequence: 0,
        lookPitchRadians: 0,
        lookYawRadians: 0.75,
        locomotionMode: "grounded",
        mountedOccupancy: null,
        playerId,
        presenceAnimationVocabulary: "idle",
        stateSequence: 4,
        swimBodyRuntime: {
          snapshot: createMetaverseSurfaceDriveBodyRuntimeSnapshot()
        },
        teamId: "neutral",
        traversalAuthorityState: createMetaverseTraversalAuthoritySnapshot(),
        unmountedTraversalState: createMetaverseUnmountedTraversalStateSnapshot({
          locomotionMode: "grounded"
        }),
        username,
        weaponState: null
      }
    ],
    projectiles: [],
    resourceSpawns: [],
    snapshotSequence: 7,
    tickIntervalMs: 100,
    traversalIntentsByPlayerId: new Map(),
    vehicles: []
  });
  const playerSnapshot = worldSnapshot.players[0];

  assert.deepEqual(playerSnapshot?.groundedBody.position, capsulePosition);
  assert.deepEqual(playerSnapshot?.groundedBody.linearVelocity, capsuleVelocity);
  assert.equal(playerSnapshot?.groundedBody.yawRadians, 0.75);
});

test("MetaverseAuthoritativeWorldRuntime keeps simulation time stable between repeated reads inside one tick", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("stable-tick-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Stable Tick Pilot"), "username");

  joinSurfacePlayer(runtime, playerId, username, {
    position: {
      x: 0,
      y: 1.62,
      z: 24
    },
    yawRadians: 0
  });

  runtime.advanceToTime(150);

  const firstSnapshot = runtime.readWorldSnapshot(160, playerId);
  const secondSnapshot = runtime.readWorldSnapshot(190, playerId);

  assert.equal(firstSnapshot.tick.currentTick, 1);
  assert.equal(secondSnapshot.tick.currentTick, 1);
  assert.equal(firstSnapshot.tick.simulationTimeMs, 100);
  assert.equal(secondSnapshot.tick.simulationTimeMs, 100);
  assert.equal(firstSnapshot.tick.emittedAtServerTimeMs, 160);
  assert.equal(secondSnapshot.tick.emittedAtServerTimeMs, 190);
});

test("MetaverseAuthoritativeWorldRuntime publishes the authoritative grounded support token", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("support-token-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Support Token Pilot"), "username");

  joinSurfacePlayer(runtime, playerId, username, {
    position: {
      x: 0,
      y: 1.62,
      z: 24
    },
    yawRadians: 0
  });
  runtime.advanceToTime(100);

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);
  const playerSnapshot = worldSnapshot.players[0];

  assert.equal(playerSnapshot?.locomotionMode, "grounded");
  assert.equal(playerSnapshot?.groundedSupport?.walkable, true);
  assert.equal(playerSnapshot?.groundedSupport?.supportKind, "box");
  assert.ok((playerSnapshot?.groundedSupport?.supportHeightMeters ?? 0) > 0);
  assert.ok(
    (playerSnapshot?.groundedSupport?.supportHeightMeters ?? 0) <
      (playerSnapshot?.groundedBody.position.y ?? 0)
  );
});

test("MetaverseAuthoritativeWorldRuntime does not advance simulation when snapshots are only read", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("read-only-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Read Only Pilot"), "username");

  joinSurfacePlayer(runtime, playerId, username, {
    position: {
      x: 0,
      y: 1.62,
      z: 24
    },
    yawRadians: 0
  });
  runtime.advanceToTime(150);

  const firstSnapshot = runtime.readWorldSnapshot(260, playerId);
  const secondSnapshot = runtime.readWorldSnapshot(290, playerId);

  assert.equal(firstSnapshot.tick.currentTick, 1);
  assert.equal(secondSnapshot.tick.currentTick, 1);
  assert.equal(firstSnapshot.tick.simulationTimeMs, 100);
  assert.equal(secondSnapshot.tick.simulationTimeMs, 100);
});

test("MetaverseAuthoritativeWorldRuntime includes authored environment bodies in world snapshots", () => {
  const runtime = createAuthoritativeRuntime();
  const worldSnapshot = runtime.readWorldSnapshot(0);
  const crateBodySnapshot = worldSnapshot.environmentBodies[0];

  assert.equal(worldSnapshot.environmentBodies.length, 1);
  assert.equal(
    crateBodySnapshot?.environmentAssetId,
    metaverseHubPushableCrateEnvironmentAssetId
  );
  assert.deepEqual(crateBodySnapshot?.linearVelocity, {
    x: 0,
    y: 0,
    z: 0
  });
  assert.deepEqual(
    {
      x: crateBodySnapshot?.position.x,
      z: crateBodySnapshot?.position.z
    },
    {
      x: -8,
      z: 14
    }
  );
  assert.ok(Math.abs((crateBodySnapshot?.position.y ?? 0) - 0.931151807308197) < 0.000001);
  assert.equal(crateBodySnapshot?.yawRadians, Math.PI * -0.08);
});
