import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseCombatMatchSnapshot,
  createMetaversePlayerId
} from "@webgpu-metaverse/shared";

import { createWorldEvent } from "../../fixtures/metaverse-world-network-test-fixtures.mjs";
import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createCombatSnapshot(overrides = {}) {
  return Object.freeze({
    activeWeapon: Object.freeze({
      ammoInMagazine: 8,
      ammoInReserve: 40,
      reloadRemainingMs: 0,
      weaponId: "metaverse-service-pistol-v2"
    }),
    alive: true,
    assists: 0,
    damageLedger: Object.freeze([]),
    deaths: 0,
    headshotKills: 0,
    health: 100,
    kills: 0,
    maxHealth: 100,
    respawnRemainingMs: 0,
    spawnProtectionRemainingMs: 0,
    weaponInventory: Object.freeze([]),
    weaponStats: Object.freeze([]),
    ...overrides
  });
}

test("MetaverseFireWeaponActionPolicy gates local fire commands against authoritative combat state", async () => {
  const { MetaverseFireWeaponActionPolicy } = await clientLoader.load(
    "/src/metaverse/remote-world/metaverse-fire-weapon-action-policy.ts"
  );
  const playerId = createMetaversePlayerId("fire-policy-local-player-1");

  assert.notEqual(playerId, null);

  let worldSnapshot = createWorldEvent({
    currentTick: 12,
    playerCombat: createCombatSnapshot(),
    playerId,
    serverTimeMs: 12_000,
    snapshotSequence: 1
  }).world;
  const policy = new MetaverseFireWeaponActionPolicy({
    readEstimatedServerTimeMs: (localWallClockMs) => localWallClockMs + 250,
    readLocalPlayerId: () => playerId,
    readWallClockMs: () => 5_000,
    readWorldClient: () =>
      Object.freeze({
        worldSnapshotBuffer: Object.freeze([worldSnapshot])
      })
  });

  const acceptedAction = policy.createFireWeaponAction({
    aimMode: "hip-fire",
    aimSnapshot: Object.freeze({
      pitchRadians: -0.05,
      yawRadians: 0.4
    }),
    weaponId: "metaverse-service-pistol-v2"
  });

  assert.notEqual(acceptedAction, null);
  assert.equal(acceptedAction.issuedAtAuthoritativeTimeMs, 5_250);
  assert.equal(acceptedAction.weaponId, "metaverse-service-pistol-v2");
  policy.registerPendingFireAction({
    actionSequence: 1,
    issuedAtAuthoritativeTimeMs: acceptedAction.issuedAtAuthoritativeTimeMs,
    weaponId: acceptedAction.weaponId
  });
  assert.equal(
    policy.createFireWeaponAction({
      aimMode: "hip-fire",
      aimSnapshot: Object.freeze({
        pitchRadians: -0.05,
        yawRadians: 0.4
      }),
      weaponId: "metaverse-service-pistol-v2"
    }),
    null
  );

  worldSnapshot = createWorldEvent({
    combatMatch: createMetaverseCombatMatchSnapshot({
      phase: "completed"
    }),
    currentTick: 13,
    playerCombat: createCombatSnapshot(),
    playerId,
    serverTimeMs: 12_050,
    snapshotSequence: 2
  }).world;

  assert.equal(
    policy.createFireWeaponAction({
      aimSnapshot: Object.freeze({
        pitchRadians: 0,
        yawRadians: 0
      }),
      weaponId: "metaverse-service-pistol-v2"
    }),
    null
  );

  worldSnapshot = createWorldEvent({
    currentTick: 14,
    playerCombat: createCombatSnapshot({
      activeWeapon: Object.freeze({
        ammoInMagazine: 8,
        ammoInReserve: 40,
        reloadRemainingMs: 300,
        weaponId: "metaverse-service-pistol-v2"
      })
    }),
    playerId,
    serverTimeMs: 12_100,
    snapshotSequence: 3
  }).world;

  assert.equal(
    policy.createFireWeaponAction({
      aimSnapshot: Object.freeze({
        pitchRadians: 0,
        yawRadians: 0
      }),
      weaponId: "metaverse-service-pistol-v2"
    }),
    null
  );

  worldSnapshot = createWorldEvent({
    currentTick: 15,
    playerCombat: createCombatSnapshot(),
    playerId,
    serverTimeMs: 12_150,
    snapshotSequence: 4
  }).world;

  assert.equal(
    policy.createFireWeaponAction({
      aimSnapshot: Object.freeze({
        pitchRadians: 0,
        yawRadians: 0
      }),
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    null
  );

  policy.registerPendingWeaponSwitchAction({
    actionSequence: 2,
    weaponId: "metaverse-rocket-launcher-v1"
  });
  const queuedRocketAction = policy.createFireWeaponAction({
    aimSnapshot: Object.freeze({
      pitchRadians: 0,
      yawRadians: 0
    }),
    weaponId: "metaverse-rocket-launcher-v1"
  });

  assert.notEqual(queuedRocketAction, null);
  assert.equal(queuedRocketAction?.weaponId, "metaverse-rocket-launcher-v1");

  worldSnapshot = createWorldEvent({
    currentTick: 16,
    playerCombat: createCombatSnapshot({
      activeWeapon: Object.freeze({
        ammoInMagazine: 2,
        ammoInReserve: 6,
        reloadRemainingMs: 0,
        weaponId: "metaverse-rocket-launcher-v1"
      })
    }),
    playerId,
    serverTimeMs: 12_200,
    snapshotSequence: 5
  }).world;

  const acceptedRocketAction = policy.createFireWeaponAction({
    aimSnapshot: Object.freeze({
      pitchRadians: 0,
      yawRadians: 0
    }),
    weaponId: "metaverse-rocket-launcher-v1"
  });

  assert.notEqual(acceptedRocketAction, null);
  assert.equal(acceptedRocketAction.weaponId, "metaverse-rocket-launcher-v1");
});
