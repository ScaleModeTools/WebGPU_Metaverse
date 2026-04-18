import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  FakeMetaverseRenderer,
  disabledBootCinematicConfig
} from "../runtime/fixtures/fake-renderer.mjs";

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

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRuntimeBootLifecycle boots the non-cinematic path without rendering boot shots and resets input install state cleanly", async () => {
  const { MetaverseRuntimeBootLifecycle } = await clientLoader.load(
    "/src/metaverse/boot/metaverse-runtime-boot-lifecycle.ts"
  );
  const renderer = new FakeMetaverseRenderer();
  const callLog = [];
  const installCalls = [];
  const lifecycle = new MetaverseRuntimeBootLifecycle({
    bootCinematicConfig: disabledBootCinematicConfig,
    devicePixelRatio: 2,
    portals: Object.freeze([]),
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
  assert.equal(lifecycle.isBootCinematicActive(100), false);
  assert.equal(renderer.initCalls, 1);
  assert.equal(renderer.renderCalls, 0);
  assert.deepEqual(callLog, [
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

test("MetaverseRuntimeBootLifecycle runs the cinematic boot path in staged order and keeps the cinematic active through minimum dwell", async () => {
  const { MetaverseRuntimeBootLifecycle } = await clientLoader.load(
    "/src/metaverse/boot/metaverse-runtime-boot-lifecycle.ts"
  );
  const renderer = new FakeMetaverseRenderer();
  const callLog = [];
  let nowMs = 500;
  const lifecycle = new MetaverseRuntimeBootLifecycle({
    bootCinematicConfig: Object.freeze({
      enabled: true,
      minimumDwellMs: 200,
      shots: Object.freeze([
        Object.freeze({
          durationMs: 800,
          highlightPortalExperienceId: null,
          id: "intro",
          pitchRadians: -0.1,
          position: Object.freeze({
            x: 0,
            y: 3,
            z: 6
          }),
          requiresEnvironment: false,
          yawRadians: 0.2
        })
      ])
    }),
    devicePixelRatio: 1,
    portals: Object.freeze([]),
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
  assert.equal(renderer.renderCalls, 4);
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
    4
  );
  assert.equal(lifecycle.isBootCinematicActive(500), true);

  nowMs = 699;
  assert.equal(lifecycle.isBootCinematicActive(nowMs), true);

  nowMs = 700;
  assert.equal(lifecycle.isBootCinematicActive(nowMs), false);
});
