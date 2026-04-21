import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseSyncPlayerWeaponStateCommand
} from "@webgpu-metaverse/shared";

import {
  MetaverseAuthoritativePlayerWeaponStateAuthority
} from "../../../../server/dist/metaverse/authority/players/metaverse-authoritative-player-weapon-state-authority.js";

function createPlayerRuntime(playerId) {
  return {
    lastProcessedWeaponSequence: 0,
    lastSeenAtMs: 0,
    playerId,
    realtimeWorldAuthorityActive: false,
    weaponState: null
  };
}

test("Metaverse authoritative player weapon-state authority applies newer weapon state and bumps snapshot sequence on change", () => {
  const playerId = createMetaversePlayerId("authoritative-weapon-state-1");

  assert.notEqual(playerId, null);

  const playerRuntime = createPlayerRuntime(playerId);
  let snapshotSequenceBumps = 0;
  const authority = new MetaverseAuthoritativePlayerWeaponStateAuthority({
    incrementSnapshotSequence() {
      snapshotSequenceBumps += 1;
    },
    playersById: new Map([[playerId, playerRuntime]])
  });

  authority.acceptSyncPlayerWeaponStateCommand(
    createMetaverseSyncPlayerWeaponStateCommand({
      playerId,
      weaponSequence: 2,
      weaponState: {
        aimMode: "ads",
        weaponId: "duck-hunt-pistol"
      }
    }),
    125
  );

  assert.equal(playerRuntime.realtimeWorldAuthorityActive, true);
  assert.equal(playerRuntime.lastSeenAtMs, 125);
  assert.equal(playerRuntime.lastProcessedWeaponSequence, 2);
  assert.equal(playerRuntime.weaponState?.aimMode, "ads");
  assert.equal(playerRuntime.weaponState?.weaponId, "duck-hunt-pistol");
  assert.equal(snapshotSequenceBumps, 1);
});

test("Metaverse authoritative player weapon-state authority ignores stale sequences and avoids sequence bumps when weapon state is unchanged", () => {
  const playerId = createMetaversePlayerId("authoritative-weapon-state-2");

  assert.notEqual(playerId, null);

  const playerRuntime = createPlayerRuntime(playerId);
  let snapshotSequenceBumps = 0;
  const authority = new MetaverseAuthoritativePlayerWeaponStateAuthority({
    incrementSnapshotSequence() {
      snapshotSequenceBumps += 1;
    },
    playersById: new Map([[playerId, playerRuntime]])
  });

  authority.acceptSyncPlayerWeaponStateCommand(
    createMetaverseSyncPlayerWeaponStateCommand({
      playerId,
      weaponSequence: 3,
      weaponState: {
        aimMode: "ads",
        weaponId: "duck-hunt-pistol"
      }
    }),
    200
  );
  authority.acceptSyncPlayerWeaponStateCommand(
    createMetaverseSyncPlayerWeaponStateCommand({
      playerId,
      weaponSequence: 4,
      weaponState: {
        aimMode: "ads",
        weaponId: "duck-hunt-pistol"
      }
    }),
    220
  );
  authority.acceptSyncPlayerWeaponStateCommand(
    createMetaverseSyncPlayerWeaponStateCommand({
      playerId,
      weaponSequence: 2,
      weaponState: {
        aimMode: "hip-fire",
        weaponId: "duck-hunt-pistol"
      }
    }),
    240
  );

  assert.equal(playerRuntime.lastSeenAtMs, 240);
  assert.equal(playerRuntime.lastProcessedWeaponSequence, 4);
  assert.equal(playerRuntime.weaponState?.aimMode, "ads");
  assert.equal(snapshotSequenceBumps, 1);
});
