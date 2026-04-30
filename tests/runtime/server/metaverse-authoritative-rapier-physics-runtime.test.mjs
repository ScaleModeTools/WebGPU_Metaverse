import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createMetaverseIssuePlayerActionCommand,
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeRapierPhysicsRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-rapier-physics-runtime.js";
import { MetaverseAuthoritativeWorldRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";
import { registerAuthoritativeMetaverseMapBundlePreview } from "../../../server/dist/metaverse/world/map-bundles/load-authoritative-metaverse-map-bundle.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function createDirection(origin, target) {
  const deltaX = target.x - origin.x;
  const deltaY = target.y - origin.y;
  const deltaZ = target.z - origin.z;
  const length = Math.hypot(deltaX, deltaY, deltaZ);

  return Object.freeze({
    x: deltaX / length,
    y: deltaY / length,
    z: deltaZ / length
  });
}

function joinPlayer(runtime, playerId, username) {
  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: 0,
          y: 0.6,
          z: 0
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username
    }),
    0
  );
}

test("MetaverseAuthoritativeRapierPhysicsRuntime resolves finite ray hits from the current Rapier API", () => {
  const physicsRuntime = new MetaverseAuthoritativeRapierPhysicsRuntime();

  physicsRuntime.createCuboidCollider(
    {
      x: 36,
      y: 0.3,
      z: 41
    },
    {
      x: 0,
      y: 0.3,
      z: 0
    }
  );
  physicsRuntime.stepSimulation(1 / 60);

  const hit = physicsRuntime.castRay(
    {
      x: 0,
      y: 2,
      z: 0
    },
    {
      x: 0,
      y: -1,
      z: 0
    },
    8
  );

  assert.notEqual(hit, null);
  assert.ok(Math.abs((hit?.distanceMeters ?? 0) - 1.4) < 0.001);
  assert.deepEqual(hit?.point, {
    x: 0,
    y: 0.5999999046325684,
    z: 0
  });
  assert.deepEqual(hit?.normal, {
    x: 0,
    y: 1,
    z: 0
  });
});

test("private-build ground shots resolve to the floor hit point instead of world origin", () => {
  const privateBuildBundle = JSON.parse(
    readFileSync("client/public/map-editor/projects/private-build.json", "utf8")
  );

  registerAuthoritativeMetaverseMapBundlePreview(
    privateBuildBundle,
    "staging-ground"
  );

  const runtime = new MetaverseAuthoritativeWorldRuntime(
    {
      playerInactivityTimeoutMs: createMilliseconds(5_000),
      tickIntervalMs: createMilliseconds(50)
    },
    "private-build",
    "shell-team-deathmatch"
  );
  const redPlayerId = requireValue(
    createMetaversePlayerId("private-build-ground-shot-red"),
    "redPlayerId"
  );
  const bluePlayerId = requireValue(
    createMetaversePlayerId("private-build-ground-shot-blue"),
    "bluePlayerId"
  );

  joinPlayer(
    runtime,
    redPlayerId,
    requireValue(createUsername("Private Ground Red"), "redUsername")
  );
  joinPlayer(
    runtime,
    bluePlayerId,
    requireValue(createUsername("Private Ground Blue"), "blueUsername")
  );
  runtime.advanceToTime(3_500);

  const preShotSnapshot = runtime.readWorldSnapshot(3_500, redPlayerId);
  const redPosition = requireValue(
    preShotSnapshot.players.find((player) => player.playerId === redPlayerId)
      ?.groundedBody?.position ?? null,
    "redPosition"
  );
  const bluePosition = requireValue(
    preShotSnapshot.players.find((player) => player.playerId === bluePlayerId)
      ?.groundedBody?.position ?? null,
    "bluePosition"
  );
  const rayOriginWorld = {
    x: redPosition.x,
    y: redPosition.y + 1.62,
    z: redPosition.z
  };
  const floorTargetWorld = {
    x: bluePosition.x,
    y: 0.61,
    z: bluePosition.z + 3
  };
  const rayForwardWorld = createDirection(rayOriginWorld, floorTargetWorld);

  runtime.acceptWorldCommand(
    createMetaverseIssuePlayerActionCommand({
      action: {
        actionSequence: 1,
        aimMode: "hip-fire",
        aimSnapshot: {
          pitchRadians: Math.asin(rayForwardWorld.y),
          rayForwardWorld,
          rayOriginWorld,
          yawRadians: Math.atan2(rayForwardWorld.x, -rayForwardWorld.z)
        },
        issuedAtAuthoritativeTimeMs: 3_500,
        kind: "fire-weapon",
        weaponId: "metaverse-service-pistol-v2"
      },
      playerId: redPlayerId
    }),
    3_520
  );

  const postShotSnapshot = runtime.readWorldSnapshot(3_520, redPlayerId);
  const resolvedEvent = requireValue(
    postShotSnapshot.combatEvents.find(
      (event) => event.eventKind === "hitscan-resolved"
    ) ?? null,
    "resolvedEvent"
  );
  const hitPointWorld = requireValue(
    resolvedEvent.hitscan?.hitPointWorld ?? null,
    "hitPointWorld"
  );
  assert.equal(resolvedEvent.hitscan?.hitKind, "world");
  assert.equal(resolvedEvent.hitscan?.targetPlayerId, null);
  assert.ok(Math.abs(hitPointWorld.y - 0.6) < 0.01);
  assert.ok(
    Math.hypot(hitPointWorld.x, hitPointWorld.z) > 1,
    `expected floor shot to stay at the raycast hit point, received ${JSON.stringify(hitPointWorld)}`
  );
});
