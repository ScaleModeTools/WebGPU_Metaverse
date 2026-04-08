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
  const { readObservedAimPoint, evaluateHandTriggerGesture, firstPlayableWeaponDefinition } =
    await clientLoader.load("/src/game/index.ts");
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
        height: 100
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
    clientX: 260,
    clientY: 50
  });

  assert.equal(input.latestPose.trackingState, "no-hand");

  cleanup();
  input.dispose();
});
