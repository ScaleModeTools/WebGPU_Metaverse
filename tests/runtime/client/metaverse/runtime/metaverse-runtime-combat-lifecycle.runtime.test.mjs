import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function createCameraSnapshot({
  x = 0,
  y = 1.62,
  z = 0
} = {}) {
  return Object.freeze({
    lookDirection: Object.freeze({
      x: 0,
      y: 0,
      z: -1
    }),
    pitchRadians: 0,
    position: Object.freeze({
      x,
      y,
      z
    }),
    yawRadians: 0
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRuntimeCombatLifecycle freezes on death, resets weapon presentation, and rearms respawn snap on authoritative respawn", async () => {
  const { MetaverseRuntimeCombatLifecycle } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-combat-lifecycle.ts"
  );
  const deathCameraCalls = [];
  const respawnLockCalls = [];
  const weaponSuppressionCalls = [];
  let clearLocalDeathAnimationCount = 0;
  let spawnBootstrapCount = 0;
  let weaponResetCount = 0;
  let combatSnapshot = Object.freeze({
    alive: true,
    health: 100
  });
  let combatMatchSnapshot = Object.freeze({
    phase: "active"
  });
  const combatLifecycle = new MetaverseRuntimeCombatLifecycle({
    authoritativeWorldSync: {
      armLocalSpawnBootstrap() {
        spawnBootstrapCount += 1;
      }
    },
    bootLifecycle: {
      setDeathCameraSnapshot(snapshot) {
        deathCameraCalls.push(snapshot);
      },
      setRespawnControlLocked(locked) {
        respawnLockCalls.push(locked);
      }
    },
    clearLocalCombatDeathAnimation() {
      clearLocalDeathAnimationCount += 1;
    },
    remoteWorldRuntime: {
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          combat: combatSnapshot
        });
      },
      readFreshAuthoritativeWorldSnapshot() {
        return Object.freeze({
          combatMatch: combatMatchSnapshot
        });
      }
    },
    weaponPresentationRuntime: {
      reset() {
        weaponResetCount += 1;
      },
      setCombatPresentationSuppressed(suppressed) {
        weaponSuppressionCalls.push(suppressed);
      }
    }
  });

  const liveCameraSnapshot = createCameraSnapshot({
    x: 4,
    y: 2,
    z: 8
  });

  combatLifecycle.syncLocalCombatState(liveCameraSnapshot);

  assert.deepEqual(deathCameraCalls, []);
  assert.deepEqual(respawnLockCalls, []);
  assert.equal(spawnBootstrapCount, 0);
  assert.deepEqual(weaponSuppressionCalls, [false]);
  assert.equal(weaponResetCount, 0);
  assert.equal(clearLocalDeathAnimationCount, 0);

  combatSnapshot = Object.freeze({
    alive: false,
    health: 0,
    respawnRemainingMs: 3_000
  });
  combatLifecycle.syncLocalCombatState(liveCameraSnapshot);

  assert.equal(deathCameraCalls.length, 1);
  assert.equal(deathCameraCalls[0], liveCameraSnapshot);
  assert.deepEqual(respawnLockCalls, [true]);
  assert.equal(spawnBootstrapCount, 0);
  assert.deepEqual(weaponSuppressionCalls, [false, true]);
  assert.equal(weaponResetCount, 1);
  assert.equal(clearLocalDeathAnimationCount, 0);

  combatLifecycle.syncLocalCombatState(
    createCameraSnapshot({
      x: 30,
      y: 7,
      z: -12
    })
  );

  assert.equal(deathCameraCalls.length, 1);
  assert.deepEqual(respawnLockCalls, [true]);
  assert.deepEqual(weaponSuppressionCalls, [false, true]);
  assert.equal(weaponResetCount, 1);

  combatSnapshot = Object.freeze({
    alive: true,
    health: 100,
    spawnProtectionRemainingMs: 1_000
  });
  combatLifecycle.syncLocalCombatState(
    createCameraSnapshot({
      x: 12,
      y: 2,
      z: 18
    })
  );

  assert.equal(deathCameraCalls.length, 2);
  assert.equal(deathCameraCalls[1], null);
  assert.deepEqual(respawnLockCalls, [true, false]);
  assert.deepEqual(weaponSuppressionCalls, [false, true, false]);
  assert.equal(spawnBootstrapCount, 1);
  assert.equal(weaponResetCount, 1);
  assert.equal(clearLocalDeathAnimationCount, 1);
});

test("MetaverseRuntimeCombatLifecycle rearms the spawn snap when team deathmatch starts", async () => {
  const { MetaverseRuntimeCombatLifecycle } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-combat-lifecycle.ts"
  );
  let spawnBootstrapCount = 0;
  let combatMatchSnapshot = Object.freeze({
    phase: "waiting-for-players"
  });
  const combatSnapshot = Object.freeze({
    alive: true,
    health: 100,
    spawnProtectionRemainingMs: 0
  });
  const combatLifecycle = new MetaverseRuntimeCombatLifecycle({
    authoritativeWorldSync: {
      armLocalSpawnBootstrap() {
        spawnBootstrapCount += 1;
      }
    },
    bootLifecycle: {
      setDeathCameraSnapshot() {
        throw new Error("death camera should stay unchanged at match start.");
      },
      setRespawnControlLocked() {
        throw new Error("respawn lock should stay unchanged at match start.");
      }
    },
    remoteWorldRuntime: {
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          combat: combatSnapshot
        });
      },
      readFreshAuthoritativeWorldSnapshot() {
        return Object.freeze({
          combatMatch: combatMatchSnapshot
        });
      }
    }
  });
  const liveCameraSnapshot = createCameraSnapshot();

  combatLifecycle.syncLocalCombatState(liveCameraSnapshot);
  assert.equal(spawnBootstrapCount, 0);

  combatMatchSnapshot = Object.freeze({
    phase: "active"
  });
  combatLifecycle.syncLocalCombatState(liveCameraSnapshot);
  assert.equal(spawnBootstrapCount, 1);

  combatLifecycle.syncLocalCombatState(liveCameraSnapshot);
  assert.equal(spawnBootstrapCount, 1);
});
