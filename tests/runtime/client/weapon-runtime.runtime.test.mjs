import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("WeaponRuntime tracks semiautomatic cadence, clip state, and off-screen reload timing", async () => {
  const {
    DuckHuntWeaponRuntime: WeaponRuntime,
    duckHuntFirstPlayableWeaponDefinition: firstPlayableWeaponDefinition
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const weapon = new WeaponRuntime({
    ...firstPlayableWeaponDefinition,
    cadence: {
      shotIntervalMs: 120
    },
    reload: {
      ...firstPlayableWeaponDefinition.reload,
      clipCapacity: 2,
      durationMs: 180
    }
  });

  let snapshot = weapon.createHudSnapshot({
    hasTrackedHand: true,
    isReticleOffscreen: false,
    nowMs: 0,
    sessionActive: true,
    triggerPressed: false
  });

  assert.equal(snapshot.reload.clipRoundsRemaining, 2);
  assert.equal(snapshot.readiness, "ready");

  let frame = weapon.advance({
    hasTrackedHand: true,
    isReticleOffscreen: false,
    nowMs: 0,
    sessionActive: true,
    triggerPressed: true
  });

  assert.equal(frame.fired, true);
  weapon.recordConfirmedHit();

  snapshot = weapon.createHudSnapshot({
    hasTrackedHand: true,
    isReticleOffscreen: false,
    nowMs: 0,
    sessionActive: true,
    triggerPressed: true
  });

  assert.equal(snapshot.reload.clipRoundsRemaining, 1);
  assert.equal(snapshot.hitsLanded, 1);
  assert.equal(snapshot.readiness, "trigger-reset-required");

  weapon.advance({
    hasTrackedHand: true,
    isReticleOffscreen: false,
    nowMs: 40,
    sessionActive: true,
    triggerPressed: false
  });

  snapshot = weapon.createHudSnapshot({
    hasTrackedHand: true,
    isReticleOffscreen: false,
    nowMs: 40,
    sessionActive: true,
    triggerPressed: false
  });

  assert.equal(snapshot.readiness, "cooldown");
  assert.equal(snapshot.cooldownRemainingMs, 80);

  weapon.advance({
    hasTrackedHand: true,
    isReticleOffscreen: false,
    nowMs: 140,
    sessionActive: true,
    triggerPressed: false
  });
  frame = weapon.advance({
    hasTrackedHand: true,
    isReticleOffscreen: false,
    nowMs: 150,
    sessionActive: true,
    triggerPressed: true
  });

  assert.equal(frame.fired, true);

  snapshot = weapon.createHudSnapshot({
    hasTrackedHand: true,
    isReticleOffscreen: false,
    nowMs: 150,
    sessionActive: true,
    triggerPressed: true
  });

  assert.equal(snapshot.reload.clipRoundsRemaining, 0);
  assert.equal(snapshot.reload.requiresReload, true);
  assert.equal(snapshot.reload.state, "blocked");
  assert.equal(snapshot.readiness, "reload-required");

  frame = weapon.advance({
    hasTrackedHand: true,
    isReticleOffscreen: true,
    nowMs: 200,
    sessionActive: true,
    triggerPressed: false
  });

  assert.equal(frame.reloaded, false);

  snapshot = weapon.createHudSnapshot({
    hasTrackedHand: true,
    isReticleOffscreen: true,
    nowMs: 200,
    sessionActive: true,
    triggerPressed: false
  });

  assert.equal(snapshot.reload.state, "reloading");
  assert.equal(snapshot.reload.isReloadReady, true);
  assert.equal(snapshot.reload.reloadRemainingMs, 180);
  assert.equal(snapshot.readiness, "reloading");

  frame = weapon.advance({
    hasTrackedHand: true,
    isReticleOffscreen: false,
    nowMs: 260,
    sessionActive: true,
    triggerPressed: false
  });

  assert.equal(frame.reloaded, false);

  snapshot = weapon.createHudSnapshot({
    hasTrackedHand: true,
    isReticleOffscreen: false,
    nowMs: 260,
    sessionActive: true,
    triggerPressed: false
  });

  assert.equal(snapshot.reload.state, "blocked");
  assert.equal(snapshot.reload.reloadRemainingMs, 0);

  frame = weapon.advance({
    hasTrackedHand: true,
    isReticleOffscreen: true,
    nowMs: 320,
    sessionActive: true,
    triggerPressed: false
  });
  frame = weapon.advance({
    hasTrackedHand: true,
    isReticleOffscreen: true,
    nowMs: 500,
    sessionActive: true,
    triggerPressed: false
  });

  assert.equal(frame.reloaded, true);

  snapshot = weapon.createHudSnapshot({
    hasTrackedHand: true,
    isReticleOffscreen: true,
    nowMs: 500,
    sessionActive: true,
    triggerPressed: false
  });

  assert.equal(snapshot.reload.clipRoundsRemaining, 2);
  assert.equal(snapshot.reload.requiresReload, false);
  assert.equal(snapshot.reload.state, "full");
});
