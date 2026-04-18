import assert from "node:assert/strict";

export function createInteractiveWindowHarness() {
  const listenersByType = new Map();
  let scheduledFrame = null;

  const windowHarness = {
    addEventListener(type, listener) {
      const listeners = listenersByType.get(type) ?? [];

      listeners.push(listener);
      listenersByType.set(type, listeners);
    },
    cancelAnimationFrame() {
      scheduledFrame = null;
    },
    devicePixelRatio: 1,
    removeEventListener(type, listener) {
      const listeners = listenersByType.get(type) ?? [];
      const nextListeners = listeners.filter((candidate) => candidate !== listener);

      listenersByType.set(type, nextListeners);
    },
    requestAnimationFrame(callback) {
      scheduledFrame = callback;
      return 1;
    }
  };

  return {
    advanceFrame(nowMs) {
      assert.ok(scheduledFrame);
      const pendingFrame = scheduledFrame;

      pendingFrame(nowMs);
    },
    dispatch(type, event = {}) {
      const listeners = listenersByType.get(type) ?? [];

      for (const listener of listeners) {
        listener({
          preventDefault() {},
          target: null,
          ...event
        });
      }
    },
    window: windowHarness
  };
}

export function createFakeRuntimeCanvas() {
  return {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
}
