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

class FakeHTMLElement {
  constructor(tagName) {
    this.isContentEditable = false;
    this.tagName = tagName;
  }
}

class FakeEventTarget {
  #listenersByType = new Map();

  addEventListener(type, listener) {
    const listeners = this.#listenersByType.get(type) ?? [];

    listeners.push(listener);
    this.#listenersByType.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.#listenersByType.get(type) ?? [];
    const nextListeners = listeners.filter((candidate) => candidate !== listener);

    this.#listenersByType.set(type, nextListeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.#listenersByType.get(type) ?? []) {
      listener({
        preventDefault() {},
        target: null,
        ...event
      });
    }
  }
}

class FakeCanvas extends FakeEventTarget {
  constructor(documentObject) {
    super();
    this.pointerLockRequests = 0;
    this.#documentObject = documentObject;
  }

  #documentObject;

  requestPointerLock() {
    this.pointerLockRequests += 1;
    this.#documentObject.pointerLockElement = this;

    return Promise.resolve();
  }
}

function normalizeSignedZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

function normalizeSnapshotSignedZeros(snapshot) {
  return {
    ...snapshot,
    pitchAxis: normalizeSignedZero(snapshot.pitchAxis),
    yawAxis: normalizeSignedZero(snapshot.yawAxis)
  };
}

test("MetaverseFlightInputRuntime owns browser flight input listeners and transient snapshots", async () => {
  const { MetaverseFlightInputRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-flight-input-runtime.ts"
  );
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalWindow = globalThis.window;
  const documentObject = {
    exitPointerLockCalls: 0,
    pointerLockElement: null,
    exitPointerLock() {
      this.exitPointerLockCalls += 1;
      this.pointerLockElement = null;
    }
  };
  const fakeCanvas = new FakeCanvas(documentObject);
  const fakeWindow = new FakeEventTarget();
  let nowMs = 0;
  const flightInputRuntime = new MetaverseFlightInputRuntime({
    readWallClockMs: () => nowMs
  });

  globalThis.document = documentObject;
  globalThis.HTMLElement = FakeHTMLElement;
  globalThis.window = fakeWindow;

  try {
    flightInputRuntime.install(fakeCanvas);

    fakeWindow.dispatch("keydown", {
      code: "KeyW"
    });
    fakeWindow.dispatch("keydown", {
      code: "KeyD"
    });
    fakeCanvas.dispatch("mousedown", {
      button: 0
    });
    fakeWindow.dispatch("mousemove", {
      movementX: 480,
      movementY: -120
    });
    nowMs = 1000 / 60;

    assert.equal(fakeCanvas.pointerLockRequests, 1);
    assert.deepEqual(normalizeSnapshotSignedZeros(flightInputRuntime.readSnapshot()), {
      boost: false,
      jump: false,
      moveAxis: 1,
      pitchAxis: 1,
      primaryAction: true,
      primaryActionPressedCount: 1,
      secondaryAction: false,
      strafeAxis: 1,
      weaponSwitchPressedCount: 0,
      yawAxis: 1
    });
    nowMs += 1000 / 60;
    assert.deepEqual(normalizeSnapshotSignedZeros(flightInputRuntime.readSnapshot()), {
      boost: false,
      jump: false,
      moveAxis: 1,
      pitchAxis: 0,
      primaryAction: true,
      primaryActionPressedCount: 0,
      secondaryAction: false,
      strafeAxis: 1,
      weaponSwitchPressedCount: 0,
      yawAxis: 0
    });

    fakeWindow.dispatch("keyup", {
      code: "KeyW"
    });
    fakeWindow.dispatch("mouseup", {
      button: 0
    });

    assert.deepEqual(normalizeSnapshotSignedZeros(flightInputRuntime.readSnapshot()), {
      boost: false,
      jump: false,
      moveAxis: 0,
      pitchAxis: 0,
      primaryAction: false,
      primaryActionPressedCount: 0,
      secondaryAction: false,
      strafeAxis: 1,
      weaponSwitchPressedCount: 0,
      yawAxis: 0
    });

    fakeWindow.dispatch("keydown", {
      code: "KeyW",
      target: new FakeHTMLElement("INPUT")
    });

    assert.equal(flightInputRuntime.readSnapshot().moveAxis, 0);

    fakeWindow.dispatch("keydown", {
      code: "KeyW"
    });
    fakeCanvas.dispatch("mousedown", {
      button: 2
    });
    fakeWindow.dispatch("blur");

    assert.deepEqual(normalizeSnapshotSignedZeros(flightInputRuntime.readSnapshot()), {
      boost: false,
      jump: false,
      moveAxis: 0,
      pitchAxis: 0,
      primaryAction: false,
      primaryActionPressedCount: 0,
      secondaryAction: false,
      strafeAxis: 0,
      weaponSwitchPressedCount: 0,
      yawAxis: 0
    });

    documentObject.pointerLockElement = fakeCanvas;
    flightInputRuntime.dispose();

    assert.equal(documentObject.exitPointerLockCalls, 1);

    fakeWindow.dispatch("keydown", {
      code: "KeyW"
    });
    fakeCanvas.dispatch("mousedown", {
      button: 0
    });

    assert.deepEqual(normalizeSnapshotSignedZeros(flightInputRuntime.readSnapshot()), {
      boost: false,
      jump: false,
      moveAxis: 0,
      pitchAxis: 0,
      primaryAction: false,
      primaryActionPressedCount: 0,
      secondaryAction: false,
      strafeAxis: 0,
      weaponSwitchPressedCount: 0,
      yawAxis: 0
    });
  } finally {
    globalThis.document = originalDocument;
    globalThis.HTMLElement = originalHTMLElement;
    globalThis.window = originalWindow;
  }
});

test("MetaverseFlightInputRuntime keeps pointer-lock mouse look travel frame-rate independent", async () => {
  const [
    { MetaverseFlightInputRuntime },
    { advanceMetaversePitchRadians, advanceMetaverseYawRadians },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/metaverse-flight-input-runtime.ts"),
    clientLoader.load("/src/metaverse/states/metaverse-flight.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalWindow = globalThis.window;
  const documentObject = {
    exitPointerLock() {},
    pointerLockElement: null
  };
  const fakeCanvas = new FakeCanvas(documentObject);
  const fakeWindow = new FakeEventTarget();
  let nowMs = 0;
  const flightInputRuntime = new MetaverseFlightInputRuntime({
    readWallClockMs: () => nowMs
  });

  globalThis.document = documentObject;
  globalThis.HTMLElement = FakeHTMLElement;
  globalThis.window = fakeWindow;

  try {
    flightInputRuntime.install(fakeCanvas);
    fakeCanvas.dispatch("mousedown", {
      button: 0
    });

    fakeWindow.dispatch("mousemove", {
      movementX: 12,
      movementY: -6
    });
    nowMs = 1000 / 60;
    const sixtyFpsSnapshot = flightInputRuntime.readSnapshot();
    const sixtyFpsYawRadians = advanceMetaverseYawRadians(
      0,
      sixtyFpsSnapshot.yawAxis,
      metaverseRuntimeConfig.orientation,
      1 / 60
    );
    const sixtyFpsPitchRadians = advanceMetaversePitchRadians(
      0,
      sixtyFpsSnapshot.pitchAxis,
      metaverseRuntimeConfig.orientation,
      1 / 60
    );

    fakeWindow.dispatch("mousemove", {
      movementX: 12,
      movementY: -6
    });
    nowMs += 1000 / 30;
    const thirtyFpsSnapshot = flightInputRuntime.readSnapshot();
    const thirtyFpsYawRadians = advanceMetaverseYawRadians(
      0,
      thirtyFpsSnapshot.yawAxis,
      metaverseRuntimeConfig.orientation,
      1 / 30
    );
    const thirtyFpsPitchRadians = advanceMetaversePitchRadians(
      0,
      thirtyFpsSnapshot.pitchAxis,
      metaverseRuntimeConfig.orientation,
      1 / 30
    );

    assert.ok(Math.abs(sixtyFpsYawRadians - thirtyFpsYawRadians) < 0.000001);
    assert.ok(Math.abs(sixtyFpsPitchRadians - thirtyFpsPitchRadians) < 0.000001);
  } finally {
    globalThis.document = originalDocument;
    globalThis.HTMLElement = originalHTMLElement;
    globalThis.window = originalWindow;
  }
});

test("MetaverseFlightInputRuntime maps gamepad triggers onto primary and secondary actions without changing movement axes", async () => {
  const { MetaverseFlightInputRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-flight-input-runtime.ts"
  );
  const originalNavigator = globalThis.navigator;
  const flightInputRuntime = new MetaverseFlightInputRuntime();

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      getGamepads() {
        return [
          {
            buttons: [
              { pressed: false, value: 0 },
              { pressed: false, value: 0 },
              { pressed: false, value: 0 },
              { pressed: false, value: 0 },
              { pressed: false, value: 0 },
              { pressed: false, value: 0 },
              { pressed: true, value: 1 },
              { pressed: true, value: 1 }
            ]
          }
        ];
      }
    },
    writable: true
  });

  try {
    assert.deepEqual(normalizeSnapshotSignedZeros(flightInputRuntime.readSnapshot()), {
      boost: false,
      jump: false,
      moveAxis: 0,
      pitchAxis: 0,
      primaryAction: true,
      primaryActionPressedCount: 1,
      secondaryAction: true,
      strafeAxis: 0,
      weaponSwitchPressedCount: 0,
      yawAxis: 0
    });
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
      writable: true
    });
  }
});
