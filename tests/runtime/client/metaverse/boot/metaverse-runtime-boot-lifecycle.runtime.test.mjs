import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { FakeMetaverseRenderer } from "../runtime/fixtures/fake-renderer.mjs";

let clientLoader;

function createFakeCanvas() {
  return {
    clientHeight: 720,
    clientWidth: 1280
  };
}

function createFakeSceneRuntime(callLog) {
  return {
    camera: {
      kind: "camera"
    },
    scene: {
      kind: "scene"
    },
    async boot() {
      callLog.push("boot");
    },
    async bootInteractivePresentation() {
      callLog.push("bootInteractivePresentation");
    },
    async bootScenicEnvironment() {
      callLog.push("bootScenicEnvironment");
    },
    async prewarm() {
      callLog.push("prewarm");
    },
    syncPresentation() {
      callLog.push("syncPresentation");
    },
    syncViewport() {
      callLog.push("syncViewport");
    }
  };
}

function createPreviewCameraSnapshot() {
  return Object.freeze({
    lookDirection: Object.freeze({
      x: 0,
      y: -0.5,
      z: -0.5
    }),
    pitchRadians: -0.72,
    position: Object.freeze({
      x: 0,
      y: 12,
      z: 10
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

test("MetaverseRuntimeBootLifecycle boots the direct path without preview rendering and resets input install state cleanly", async () => {
  const { MetaverseRuntimeBootLifecycle } = await clientLoader.load(
    "/src/metaverse/boot/metaverse-runtime-boot-lifecycle.ts"
  );
  const renderer = new FakeMetaverseRenderer();
  const callLog = [];
  const installCalls = [];
  const lifecycle = new MetaverseRuntimeBootLifecycle({
    cameraPhaseState: {
      entryPreviewEnabled: false,
      markEntryPreviewLiveReady() {
        callLog.push("cameraPhase:markReady");
      },
      reset() {
        callLog.push("cameraPhase:reset");
      },
      resolveBootPresentationSnapshot() {
        return null;
      },
      resolveRuntimeCameraPhaseState() {
        return null;
      },
      setDeathCameraSnapshot() {},
      setGameplayControlLocked() {},
      setRespawnControlLocked() {},
      startEntryPreview() {
        callLog.push("cameraPhase:start");
      }
    },
    devicePixelRatio: 2,
    readNowMs: () => 100,
    sceneRuntime: createFakeSceneRuntime(callLog)
  });

  await lifecycle.bootRuntime({
    bootGroundedRuntime: async () => {
      callLog.push("bootGroundedRuntime");
    },
    canvas: createFakeCanvas(),
    renderer
  });

  assert.equal(lifecycle.bootRendererInitialized, true);
  assert.equal(lifecycle.bootScenePrewarmed, true);
  assert.equal(renderer.initCalls, 1);
  assert.equal(renderer.renderCalls, 0);
  assert.deepEqual(callLog, [
    "cameraPhase:reset",
    "boot",
    "bootGroundedRuntime",
    "syncViewport",
    "prewarm"
  ]);

  lifecycle.ensureRuntimeInputInstalled(createFakeCanvas(), {
    install(canvas) {
      installCalls.push(canvas);
    }
  });
  lifecycle.ensureRuntimeInputInstalled(createFakeCanvas(), {
    install(canvas) {
      installCalls.push(canvas);
    }
  });

  assert.equal(installCalls.length, 1);

  lifecycle.reset();

  lifecycle.ensureRuntimeInputInstalled(createFakeCanvas(), {
    install(canvas) {
      installCalls.push(canvas);
    }
  });

  assert.equal(lifecycle.bootRendererInitialized, false);
  assert.equal(lifecycle.bootScenePrewarmed, false);
  assert.equal(installCalls.length, 2);
});

test("MetaverseRuntimeBootLifecycle stages the entry preview path and keeps rendering through prewarm before handing off to live runtime", async () => {
  const { MetaverseRuntimeBootLifecycle } = await clientLoader.load(
    "/src/metaverse/boot/metaverse-runtime-boot-lifecycle.ts"
  );
  const renderer = new FakeMetaverseRenderer();
  const callLog = [];
  let nowMs = 500;
  const previewSnapshot = {
    cameraSnapshot: createPreviewCameraSnapshot(),
    focusedPortal: null
  };
  const lifecycle = new MetaverseRuntimeBootLifecycle({
    cameraPhaseState: {
      entryPreviewEnabled: true,
      markEntryPreviewLiveReady(value) {
        callLog.push(`cameraPhase:markReady:${value}`);
      },
      reset() {
        callLog.push("cameraPhase:reset");
      },
      resolveBootPresentationSnapshot(value) {
        callLog.push(`cameraPhase:resolve:${value}`);
        return previewSnapshot;
      },
      resolveRuntimeCameraPhaseState() {
        return null;
      },
      setDeathCameraSnapshot() {},
      setGameplayControlLocked() {},
      setRespawnControlLocked() {},
      startEntryPreview(value) {
        callLog.push(`cameraPhase:start:${value}`);
      }
    },
    devicePixelRatio: 1,
    readNowMs: () => nowMs,
    sceneRuntime: createFakeSceneRuntime(callLog)
  });

  await lifecycle.bootRuntime({
    bootGroundedRuntime: async () => {
      callLog.push("bootGroundedRuntime");
    },
    canvas: createFakeCanvas(),
    renderer
  });

  assert.equal(lifecycle.bootRendererInitialized, true);
  assert.equal(lifecycle.bootScenePrewarmed, true);
  assert.equal(renderer.initCalls, 1);
  assert.equal(renderer.renderCalls, 3);
  assert.ok(callLog.indexOf("cameraPhase:start:500") !== -1);
  assert.ok(callLog.indexOf("bootScenicEnvironment") !== -1);
  assert.ok(callLog.indexOf("bootGroundedRuntime") !== -1);
  assert.ok(callLog.indexOf("bootInteractivePresentation") !== -1);
  assert.ok(
    callLog.indexOf("bootScenicEnvironment") <
      callLog.indexOf("bootGroundedRuntime")
  );
  assert.ok(
    callLog.indexOf("bootGroundedRuntime") <
      callLog.indexOf("bootInteractivePresentation")
  );
  assert.equal(
    callLog.filter((entry) => entry === "prewarm").length,
    2
  );
  assert.equal(
    callLog.filter((entry) => entry === "syncPresentation").length,
    3
  );
  assert.ok(
    callLog.some((entry) => entry === "cameraPhase:markReady:500")
  );
});
