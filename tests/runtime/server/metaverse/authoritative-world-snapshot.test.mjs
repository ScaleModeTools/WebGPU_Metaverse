import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaversePlayerId,
  createUsername,
  metaverseHubPushableCrateEnvironmentAssetId
} from "@webgpu-metaverse/shared";

import {
  createAuthoritativeRuntime,
  createMetaverseSyncPlayerTraversalIntentCommand,
  joinSurfacePlayer,
  requireValue
} from "./authoritative-world-test-fixtures.mjs";

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
