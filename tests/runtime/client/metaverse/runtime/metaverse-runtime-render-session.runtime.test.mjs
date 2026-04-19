import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function createMountedInteractionSnapshot({
  focusedMountable = null,
  mountedEnvironment = null
} = {}) {
  return Object.freeze({
    boardingEntries:
      mountedEnvironment === null
        ? focusedMountable?.boardingEntries ?? Object.freeze([])
        : Object.freeze([]),
    focusedMountable,
    mountedEnvironment,
    seatTargetEnvironmentAssetId:
      mountedEnvironment?.environmentAssetId ??
      focusedMountable?.environmentAssetId ??
      null,
    selectableSeatTargets:
      mountedEnvironment === null
        ? focusedMountable?.directSeatTargets ?? Object.freeze([])
        : mountedEnvironment.seatId === null
          ? mountedEnvironment.seatTargets
          : Object.freeze(
              mountedEnvironment.seatTargets.filter(
                (seatTarget) => seatTarget.seatId !== mountedEnvironment.seatId
              )
            )
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRuntimeRenderSession syncs the active frame loop and publishes running HUD state from the live renderer session", async () => {
  const { MetaverseRuntimeRenderSession } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-render-session.ts"
  );
  const publishCalls = [];
  const frameSyncCalls = [];
  const renderer = {
    dispose() {},
    render() {},
    setPixelRatio() {},
    setSize() {}
  };
  const renderSession = new MetaverseRuntimeRenderSession({
    bootLifecycle: {
      bootRendererInitialized: true,
      bootScenePrewarmed: true
    },
    cancelAnimationFrame() {},
    frameLoop: {
      focusedPortal: null,
      frameDeltaMs: 16.6,
      frameRate: 60,
      mountedInteraction: createMountedInteractionSnapshot({
        focusedMountable: Object.freeze({
          boardingEntries: Object.freeze([]),
          directSeatTargets: Object.freeze([]),
          distanceFromCamera: 1,
          environmentAssetId: "harbor-skiff",
          label: "Harbor Skiff"
        })
      }),
      renderedFrameCount: 4,
      syncFrame(input) {
        frameSyncCalls.push(input);
      }
    },
    hudPublisher: {
      hudSnapshot: Object.freeze({
        boot: Object.freeze({}),
        camera: Object.freeze({}),
        controlMode: "keyboard",
        failureReason: null,
        focusedMountable: null,
        focusedPortal: null,
        lifecycle: "idle",
        locomotionMode: "grounded",
        mountedInteraction: createMountedInteractionSnapshot(),
        mountedEnvironment: null,
        presence: Object.freeze({}),
        telemetry: Object.freeze({}),
        transport: Object.freeze({})
      }),
      publishSnapshot(input, forceUiUpdate, nowMs) {
        publishCalls.push({
          forceUiUpdate,
          input,
          nowMs
        });
      }
    },
    readControlMode() {
      return "gamepad";
    },
    readNowMs() {
      return 1111;
    },
    requestAnimationFrame() {
      throw new Error("not expected");
    }
  });

  renderSession.activate(
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    renderer
  );
  renderSession.syncFrame(1000, true);

  assert.equal(frameSyncCalls.length, 1);
  assert.equal(frameSyncCalls[0]?.nowMs, 1000);
  assert.equal(frameSyncCalls[0]?.renderer, renderer);
  assert.equal(publishCalls.length, 1);
  assert.equal(publishCalls[0]?.input.lifecycle, "running");
  assert.equal(publishCalls[0]?.input.controlMode, "gamepad");
  assert.equal(publishCalls[0]?.input.bootRendererInitialized, true);
  assert.equal(publishCalls[0]?.input.bootScenePrewarmed, true);
  assert.equal(publishCalls[0]?.input.renderedFrameCount, 4);
  assert.equal(
    publishCalls[0]?.input.mountedInteraction.focusedMountable?.environmentAssetId,
    "harbor-skiff"
  );
  assert.equal(publishCalls[0]?.input.renderer, renderer);
  assert.equal(publishCalls[0]?.forceUiUpdate, true);
  assert.equal(publishCalls[0]?.nowMs, 1000);
});

test("MetaverseRuntimeRenderSession publishes the current HUD lifecycle when no live renderer session is active", async () => {
  const { MetaverseRuntimeRenderSession } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-render-session.ts"
  );
  const publishCalls = [];
  const renderSession = new MetaverseRuntimeRenderSession({
    bootLifecycle: {
      bootRendererInitialized: false,
      bootScenePrewarmed: false
    },
    cancelAnimationFrame() {},
    frameLoop: {
      focusedPortal: null,
      frameDeltaMs: 0,
      frameRate: 0,
      mountedInteraction: createMountedInteractionSnapshot(),
      renderedFrameCount: 0,
      syncFrame() {
        throw new Error("not expected");
      }
    },
    hudPublisher: {
      hudSnapshot: Object.freeze({
        boot: Object.freeze({}),
        camera: Object.freeze({}),
        controlMode: "keyboard",
        failureReason: "still-booting",
        focusedMountable: null,
        focusedPortal: null,
        lifecycle: "booting",
        locomotionMode: "grounded",
        mountedInteraction: createMountedInteractionSnapshot(),
        mountedEnvironment: null,
        presence: Object.freeze({}),
        telemetry: Object.freeze({}),
        transport: Object.freeze({})
      }),
      publishSnapshot(input, forceUiUpdate, nowMs) {
        publishCalls.push({
          forceUiUpdate,
          input,
          nowMs
        });
      }
    },
    readControlMode() {
      return "keyboard";
    },
    readNowMs() {
      return 2222;
    },
    requestAnimationFrame() {
      throw new Error("not expected");
    }
  });

  renderSession.syncOrPublishRuntimeState(true);
  renderSession.publishRuntimeHudSnapshot(false);

  assert.equal(publishCalls.length, 2);
  assert.equal(publishCalls[0]?.input.lifecycle, "booting");
  assert.equal(publishCalls[0]?.input.failureReason, "still-booting");
  assert.equal(publishCalls[0]?.forceUiUpdate, true);
  assert.equal(publishCalls[0]?.nowMs, null);
  assert.equal(publishCalls[1]?.input.lifecycle, "booting");
  assert.equal(publishCalls[1]?.forceUiUpdate, false);
});

test("MetaverseRuntimeRenderSession owns active-surface matching, frame scheduling, and renderer disposal", async () => {
  const { MetaverseRuntimeRenderSession } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-render-session.ts"
  );
  const publishCalls = [];
  const frameSyncCalls = [];
  const cancelCalls = [];
  const scheduledCallbacks = [];
  const renderer = {
    disposeCalls: 0,
    dispose() {
      this.disposeCalls += 1;
    },
    render() {},
    setPixelRatio() {},
    setSize() {}
  };
  const canvas = {
    clientHeight: 720,
    clientWidth: 1280
  };
  const renderSession = new MetaverseRuntimeRenderSession({
    bootLifecycle: {
      bootRendererInitialized: true,
      bootScenePrewarmed: true
    },
    cancelAnimationFrame(handle) {
      cancelCalls.push(handle);
    },
    frameLoop: {
      focusedPortal: null,
      frameDeltaMs: 16.6,
      frameRate: 60,
      mountedInteraction: createMountedInteractionSnapshot(),
      renderedFrameCount: 1,
      syncFrame(input) {
        frameSyncCalls.push(input.nowMs);
      }
    },
    hudPublisher: {
      hudSnapshot: Object.freeze({
        boot: Object.freeze({}),
        camera: Object.freeze({}),
        controlMode: "keyboard",
        failureReason: null,
        focusedMountable: null,
        focusedPortal: null,
        lifecycle: "running",
        locomotionMode: "grounded",
        mountedInteraction: createMountedInteractionSnapshot(),
        mountedEnvironment: null,
        presence: Object.freeze({}),
        telemetry: Object.freeze({}),
        transport: Object.freeze({})
      }),
      publishSnapshot(input) {
        publishCalls.push(input.lifecycle);
      }
    },
    readControlMode() {
      return "keyboard";
    },
    readNowMs() {
      return 3333;
    },
    requestAnimationFrame(callback) {
      scheduledCallbacks.push(callback);
      return scheduledCallbacks.length;
    }
  });

  renderSession.activate(canvas, renderer);
  assert.equal(renderSession.matchesActiveSurface(canvas, renderer), true);
  renderSession.queueNextFrame();
  assert.equal(scheduledCallbacks.length, 1);

  scheduledCallbacks[0](4444);
  assert.deepEqual(frameSyncCalls, [4444]);
  assert.deepEqual(publishCalls, ["running"]);
  assert.equal(scheduledCallbacks.length, 2);

  renderSession.cancelQueuedFrame();
  assert.deepEqual(cancelCalls, [2]);

  renderSession.clearActiveSurfaceIfMatching(canvas, renderer);
  assert.equal(renderSession.matchesActiveSurface(canvas, renderer), false);

  renderSession.activate(canvas, renderer);
  renderSession.disposeActiveRenderer();
  assert.equal(renderer.disposeCalls, 1);
  assert.equal(renderSession.matchesActiveSurface(canvas, renderer), false);
});
