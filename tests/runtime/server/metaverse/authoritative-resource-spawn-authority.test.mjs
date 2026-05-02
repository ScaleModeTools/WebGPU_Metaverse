import assert from "node:assert/strict";
import test from "node:test";

import { createMetaversePlayerId } from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeResourceSpawnAuthority } from "../../../../server/dist/metaverse/authority/resources/metaverse-authoritative-resource-spawn-authority.js";

function createPlayerRuntime(playerId, position) {
  const bodySnapshot = Object.freeze({
    linearVelocity: Object.freeze({ x: 0, y: 0, z: 0 }),
    position,
    yawRadians: 0
  });

  return {
    groundedBodyRuntime: {
      snapshot: bodySnapshot
    },
    locomotionMode: "grounded",
    playerId,
    swimBodyRuntime: {
      snapshot: bodySnapshot
    }
  };
}

function createWeaponPickup(overrides = {}) {
  return Object.freeze({
    ammoGrantRounds: 48,
    assetId: "metaverse-service-pistol-v2",
    label: "Pistol pickup",
    modeTags: Object.freeze(["team-deathmatch"]),
    pickupRadiusMeters: 1.4,
    position: Object.freeze({
      x: 0,
      y: 0.6,
      z: 0
    }),
    resourceKind: "weapon-pickup",
    respawnCooldownMs: 500,
    spawnId: "resource:pistol",
    weaponId: "metaverse-service-pistol-v2",
    yawRadians: 0,
    ...overrides
  });
}

test("MetaverseAuthoritativeResourceSpawnAuthority consumes only when ammo is granted and respawns once after cooldown", () => {
  const playerId = createMetaversePlayerId("resource-spawn-player");
  const pickup = createWeaponPickup();
  let grantAllowed = false;
  let grantCount = 0;
  let snapshotSequenceIncrements = 0;

  assert.notEqual(playerId, null);

  const authority = new MetaverseAuthoritativeResourceSpawnAuthority({
    grantWeaponResourcePickup() {
      grantCount += 1;
      return grantAllowed;
    },
    incrementSnapshotSequence() {
      snapshotSequenceIncrements += 1;
    },
    matchMode: "team-deathmatch",
    playersById: new Map([
      [
        playerId,
        createPlayerRuntime(playerId, {
          x: 0.4,
          y: 0.6,
          z: 0.2
        })
      ]
    ]),
    resourceSpawns: Object.freeze([pickup])
  });

  authority.advanceResourceSpawns(0.1, 1_000);

  let snapshots = authority.readResourceSpawnSnapshots();

  assert.equal(grantCount, 1);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.spawnId, "resource:pistol");
  assert.equal("available" in snapshots[0], false);
  assert.equal("nextRespawnAtServerTimeMs" in snapshots[0], false);
  assert.equal("ammoGrantRounds" in snapshots[0], false);
  assert.equal("modeTags" in snapshots[0], false);
  assert.equal(snapshotSequenceIncrements, 0);

  grantAllowed = true;
  authority.advanceResourceSpawns(0.1, 1_100);
  snapshots = authority.readResourceSpawnSnapshots();

  assert.equal(grantCount, 2);
  assert.equal(snapshots.length, 0);
  assert.equal(snapshotSequenceIncrements, 1);

  authority.advanceResourceSpawns(0.1, 1_500);
  snapshots = authority.readResourceSpawnSnapshots();

  assert.equal(snapshots.length, 0);
  assert.equal(grantCount, 2);

  authority.advanceResourceSpawns(0.1, 1_600);
  snapshots = authority.readResourceSpawnSnapshots();

  assert.equal(snapshots.length, 0);
  assert.equal(grantCount, 3);
  assert.equal(snapshotSequenceIncrements, 2);
});

test("MetaverseAuthoritativeResourceSpawnAuthority filters pickups by match mode and keeps available pickups singular", () => {
  const playerId = createMetaversePlayerId("resource-spawn-mode-filter");
  let grantCount = 0;

  assert.notEqual(playerId, null);

  const authority = new MetaverseAuthoritativeResourceSpawnAuthority({
    grantWeaponResourcePickup() {
      grantCount += 1;
      return false;
    },
    incrementSnapshotSequence() {},
    matchMode: "free-roam",
    playersById: new Map([
      [
        playerId,
        createPlayerRuntime(playerId, {
          x: 0,
          y: 0.6,
          z: 0
        })
      ]
    ]),
    resourceSpawns: Object.freeze([
      createWeaponPickup({
        spawnId: "resource:tdm-only",
        modeTags: Object.freeze(["team-deathmatch"])
      }),
      createWeaponPickup({
        spawnId: "resource:all-modes",
        modeTags: Object.freeze([])
      })
    ])
  });

  authority.advanceResourceSpawns(0.1, 100);
  authority.advanceResourceSpawns(0.1, 200);

  const snapshots = authority.readResourceSpawnSnapshots();

  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.spawnId),
    ["resource:all-modes"]
  );
  assert.equal("available" in snapshots[0], false);
  assert.equal("modeTags" in snapshots[0], false);
  assert.equal(grantCount, 2);
});
