import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    reject,
    resolve
  };
}

function createHudSnapshot(lifecycle = "idle", failureReason = null) {
  return Object.freeze({
    failureReason,
    lifecycle
  });
}

function createRenderSession(snapshotRef, callLog = []) {
  let activeCanvas = null;
  let activeRenderer = null;

  return {
    activate(canvas, renderer) {
      activeCanvas = canvas;
      activeRenderer = renderer;
      callLog.push("activate");
    },
    cancelQueuedFrame() {
      callLog.push("cancelQueuedFrame");
    },
    clearActiveSurfaceIfMatching(canvas, renderer) {
      callLog.push("clearActiveSurfaceIfMatching");

      if (activeCanvas === canvas && activeRenderer === renderer) {
        activeCanvas = null;
        activeRenderer = null;
      }
    },
    disposeActiveRenderer() {
      callLog.push("disposeActiveRenderer");
      activeRenderer?.dispose();
      activeCanvas = null;
      activeRenderer = null;
    },
    matchesActiveSurface(canvas, renderer) {
      return activeCanvas === canvas && activeRenderer === renderer;
    },
    publishLifecycleSnapshot(lifecycle, failureReason) {
      snapshotRef.current = createHudSnapshot(lifecycle, failureReason);
      callLog.push(`publish:${lifecycle}`);
    },
    queueNextFrame() {
      callLog.push("queueNextFrame");
    },
    syncFrame() {
      snapshotRef.current = createHudSnapshot("running", null);
      callLog.push("syncFrame");
    }
  };
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRuntimeStartCoordinator rejects missing WebGPU explicitly without activating the render surface", async () => {
  const { MetaverseRuntimeStartCoordinator } = await clientLoader.load(
    "/src/metaverse/boot/metaverse-runtime-start-coordinator.ts"
  );
  const snapshotRef = {
    current: createHudSnapshot()
  };
  const callLog = [];
  const coordinator = new MetaverseRuntimeStartCoordinator({
    createRenderer() {
      callLog.push("createRenderer");
      return {
        dispose() {}
      };
    },
    readHudSnapshot: () => snapshotRef.current,
    renderSession: createRenderSession(snapshotRef, callLog),
    serviceLifecycle: {
      activateBootedRuntimeServices() {
        callLog.push("activateBootedRuntimeServices");
      },
      async beginBootRuntimeServices() {
        callLog.push("beginBootRuntimeServices");
      },
      cleanupBootAttempt() {
        callLog.push("cleanupBootAttempt");
      },
      disposeRuntimeServices() {
        callLog.push("disposeRuntimeServices");
      },
      resetForStart() {
        callLog.push("resetForStart");
      }
    }
  });

  await assert.rejects(
    () => coordinator.start({}, {}),
    /WebGPU is unavailable for the metaverse runtime/
  );
  assert.equal(snapshotRef.current.lifecycle, "failed");
  assert.equal(
    snapshotRef.current.failureReason,
    "WebGPU is unavailable for the metaverse runtime."
  );
  assert.ok(callLog.includes("publish:failed"));
  assert.ok(!callLog.includes("createRenderer"));
});

test("MetaverseRuntimeStartCoordinator activates the booted runtime through the render-session and service-lifecycle owners", async () => {
  const { MetaverseRuntimeStartCoordinator } = await clientLoader.load(
    "/src/metaverse/boot/metaverse-runtime-start-coordinator.ts"
  );
  const snapshotRef = {
    current: createHudSnapshot()
  };
  const callLog = [];
  const canvas = {
    clientHeight: 720,
    clientWidth: 1280
  };
  const renderer = {
    dispose() {
      callLog.push("renderer.dispose");
    }
  };
  const renderSession = createRenderSession(snapshotRef, callLog);
  const coordinator = new MetaverseRuntimeStartCoordinator({
    createRenderer() {
      callLog.push("createRenderer");
      return renderer;
    },
    readHudSnapshot: () => snapshotRef.current,
    renderSession,
    serviceLifecycle: {
      activateBootedRuntimeServices({ queueNextFrame, syncFrame }) {
        callLog.push("activateBootedRuntimeServices");
        syncFrame(32, true);
        queueNextFrame();
      },
      async beginBootRuntimeServices({ publishHudSnapshot }) {
        callLog.push("beginBootRuntimeServices");
        publishHudSnapshot("booting", null, true);
      },
      cleanupBootAttempt() {
        callLog.push("cleanupBootAttempt");
      },
      disposeRuntimeServices() {
        callLog.push("disposeRuntimeServices");
      },
      resetForStart() {
        callLog.push("resetForStart");
      }
    }
  });

  const snapshot = await coordinator.start(canvas, {
    gpu: {}
  });

  assert.equal(snapshot.lifecycle, "running");
  assert.deepEqual(callLog, [
    "cancelQueuedFrame",
    "disposeActiveRenderer",
    "disposeRuntimeServices",
    "publish:idle",
    "resetForStart",
    "createRenderer",
    "activate",
    "beginBootRuntimeServices",
    "publish:booting",
    "activateBootedRuntimeServices",
    "syncFrame",
    "queueNextFrame"
  ]);
});

test("MetaverseRuntimeStartCoordinator cleans stale boot attempts after disposal instead of reviving a dead render session", async () => {
  const { MetaverseRuntimeStartCoordinator } = await clientLoader.load(
    "/src/metaverse/boot/metaverse-runtime-start-coordinator.ts"
  );
  const deferred = createDeferred();
  const snapshotRef = {
    current: createHudSnapshot()
  };
  const callLog = [];
  const canvas = {
    clientHeight: 720,
    clientWidth: 1280
  };
  const renderer = {
    disposed: false,
    dispose() {
      this.disposed = true;
      callLog.push("renderer.dispose");
    }
  };
  const renderSession = createRenderSession(snapshotRef, callLog);
  const coordinator = new MetaverseRuntimeStartCoordinator({
    createRenderer() {
      callLog.push("createRenderer");
      return renderer;
    },
    readHudSnapshot: () => snapshotRef.current,
    renderSession,
    serviceLifecycle: {
      activateBootedRuntimeServices() {
        callLog.push("activateBootedRuntimeServices");
      },
      async beginBootRuntimeServices({ publishHudSnapshot }) {
        callLog.push("beginBootRuntimeServices");
        publishHudSnapshot("booting", null, true);
        await deferred.promise;
      },
      cleanupBootAttempt({ clearActiveSurface, renderer: cleanupRenderer }) {
        callLog.push("cleanupBootAttempt");
        clearActiveSurface();
        cleanupRenderer.dispose();
      },
      disposeRuntimeServices() {
        callLog.push("disposeRuntimeServices");
      },
      resetForStart() {
        callLog.push("resetForStart");
      }
    }
  });

  const startPromise = coordinator.start(canvas, {
    gpu: {}
  });

  await Promise.resolve();
  coordinator.dispose();
  deferred.resolve();

  const snapshot = await startPromise;

  assert.equal(snapshot.lifecycle, "idle");
  assert.equal(renderer.disposed, true);
  assert.ok(callLog.includes("cleanupBootAttempt"));
  assert.ok(!callLog.includes("activateBootedRuntimeServices"));
});
