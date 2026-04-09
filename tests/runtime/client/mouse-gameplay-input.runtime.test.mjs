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

class FakeWindow {
  #listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.#listeners.get(type) ?? [];

    listeners.push(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.#listeners.get(type) ?? [];
    const nextListeners = listeners.filter((candidate) => candidate !== listener);

    this.#listeners.set(type, nextListeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

test("MouseGameplayInput emits tracked snapshots that preserve direct cursor aim", async () => {
  const { MouseGameplayInput } = await clientLoader.load(
    "/src/game/classes/mouse-gameplay-input.ts"
  );
  const { readObservedAimPoint, evaluateHandTriggerGesture } = await clientLoader.load(
    "/src/game/index.ts"
  );
  const {
    duckHuntFirstPlayableWeaponDefinition: firstPlayableWeaponDefinition
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const { handAimObservationConfig } = await clientLoader.load(
    "/src/game/config/hand-aim-observation.ts"
  );
  const fakeWindow = new FakeWindow();
  let nowMs = 100;
  const input = new MouseGameplayInput({
    readNowMs: () => nowMs,
    windowObject: fakeWindow
  });

  await input.ensureStarted();
  const cleanup = input.attachViewport({
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        right: 200,
        bottom: 100
      };
    }
  });

  fakeWindow.dispatch("mousemove", {
    buttons: 0,
    clientX: 100,
    clientY: 50
  });

  assert.equal(input.latestPose.trackingState, "tracked");
  const readyGesture = evaluateHandTriggerGesture(
    input.latestPose.pose,
    false,
    firstPlayableWeaponDefinition.triggerGesture,
    null
  );
  const observedAim = readObservedAimPoint(
    input.latestPose.pose,
    handAimObservationConfig
  );

  assert.equal(readyGesture.triggerPressed, false);
  assert.equal(readyGesture.triggerReady, true);
  assert.ok(Math.abs(observedAim.x - 0.5) < 0.02);
  assert.ok(Math.abs(observedAim.y - 0.5) < 0.02);

  nowMs += 16;
  fakeWindow.dispatch("mousedown", {
    button: 0,
    clientX: 100,
    clientY: 50
  });

  assert.equal(input.latestPose.trackingState, "tracked");
  const pressedGesture = evaluateHandTriggerGesture(
    input.latestPose.pose,
    false,
    firstPlayableWeaponDefinition.triggerGesture,
    null
  );

  assert.equal(pressedGesture.triggerPressed, true);
  assert.ok(input.telemetrySnapshot.framesProcessed >= 2);

  nowMs += 16;
  fakeWindow.dispatch("mousemove", {
    buttons: 0,
    clientX: 199,
    clientY: 50
  });

  assert.equal(input.latestPose.trackingState, "tracked");
  const edgeObservedAim = readObservedAimPoint(
    input.latestPose.pose,
    handAimObservationConfig
  );

  assert.ok(edgeObservedAim.x > 1);

  nowMs += 16;
  fakeWindow.dispatch("mousemove", {
    buttons: 0,
    clientX: 180,
    clientY: 50
  });

  assert.equal(input.latestPose.trackingState, "tracked");
  const latchedObservedAim = readObservedAimPoint(
    input.latestPose.pose,
    handAimObservationConfig
  );

  assert.ok(latchedObservedAim.x > 1);

  nowMs += 16;
  fakeWindow.dispatch("mousemove", {
    buttons: 0,
    clientX: 140,
    clientY: 50
  });

  assert.equal(input.latestPose.trackingState, "tracked");
  const restoredObservedAim = readObservedAimPoint(
    input.latestPose.pose,
    handAimObservationConfig
  );

  assert.ok(restoredObservedAim.x < 1);

  nowMs += 16;
  fakeWindow.dispatch("mousemove", {
    buttons: 0,
    clientX: 260,
    clientY: 50
  });

  assert.equal(input.latestPose.trackingState, "tracked");
  const outsideObservedAim = readObservedAimPoint(
    input.latestPose.pose,
    handAimObservationConfig
  );

  assert.ok(outsideObservedAim.x > 1);

  nowMs += 16;
  fakeWindow.dispatch("blur");

  assert.equal(input.latestPose.trackingState, "no-hand");

  cleanup();
  input.dispose();
});

test("MouseGameplayInput lets the fullscreen viewport edge drive off-screen reloads", async () => {
  const { MouseGameplayInput } = await clientLoader.load("/src/game/index.ts");
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    duckHuntLocalArenaSimulationConfig: localArenaSimulationConfig
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const fakeWindow = new FakeWindow();
  let nowMs = 100;
  const input = new MouseGameplayInput({
    readNowMs: () => nowMs,
    windowObject: fakeWindow
  });
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    {
      ...localArenaSimulationConfig,
      weapon: {
        ...localArenaSimulationConfig.weapon,
        reload: {
          ...localArenaSimulationConfig.weapon.reload,
          clipCapacity: 1,
          durationMs: 180
        }
      }
    }
  );

  await input.ensureStarted();
  const cleanup = input.attachViewport({
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        right: 200,
        bottom: 100
      };
    }
  });

  fakeWindow.dispatch("mousemove", {
    buttons: 0,
    clientX: 100,
    clientY: 50
  });
  simulation.advance(input.latestPose, nowMs, {
    width: 200,
    height: 100
  });

  nowMs += 16;
  fakeWindow.dispatch("mousedown", {
    button: 0,
    clientX: 100,
    clientY: 50
  });
  const emptyClipSnapshot = simulation.advance(input.latestPose, nowMs, {
    width: 200,
    height: 100
  });

  assert.equal(emptyClipSnapshot.weapon.reload.clipRoundsRemaining, 0);
  assert.equal(emptyClipSnapshot.weapon.readiness, "reload-required");

  nowMs += 16;
  fakeWindow.dispatch("mouseup", {
    button: 0,
    clientX: 100,
    clientY: 50
  });

  nowMs = 200;
  fakeWindow.dispatch("mousemove", {
    buttons: 0,
    clientX: 199,
    clientY: 50
  });
  const reloadingSnapshot = simulation.advance(input.latestPose, nowMs, {
    width: 200,
    height: 100
  });

  assert.equal(reloadingSnapshot.aimPoint, null);
  assert.equal(reloadingSnapshot.weapon.reload.state, "reloading");
  assert.equal(reloadingSnapshot.weapon.reload.isReloadReady, true);

  nowMs = 240;
  fakeWindow.dispatch("mousemove", {
    buttons: 0,
    clientX: 180,
    clientY: 50
  });
  const latchedReloadSnapshot = simulation.advance(input.latestPose, nowMs, {
    width: 200,
    height: 100
  });

  assert.equal(latchedReloadSnapshot.aimPoint, null);
  assert.equal(latchedReloadSnapshot.weapon.reload.state, "reloading");

  nowMs = 400;
  const reloadedSnapshot = simulation.advance(input.latestPose, nowMs, {
    width: 200,
    height: 100
  });

  assert.equal(reloadedSnapshot.weapon.reload.clipRoundsRemaining, 1);
  assert.equal(reloadedSnapshot.weapon.reload.requiresReload, false);
  assert.equal(reloadedSnapshot.weapon.reload.state, "full");

  cleanup();
  input.dispose();
});
