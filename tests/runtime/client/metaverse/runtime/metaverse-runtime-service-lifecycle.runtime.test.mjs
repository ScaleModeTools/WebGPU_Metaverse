import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

const characterPresentationSnapshot = Object.freeze({
  animationVocabulary: "idle",
  position: Object.freeze({
    x: 0,
    y: 1,
    z: 0
  }),
  yawRadians: 0.25
});

const cameraSnapshot = Object.freeze({
  lookDirection: Object.freeze({
    x: 0,
    y: 0,
    z: -1
  }),
  pitchRadians: 0.1,
  position: Object.freeze({
    x: 2,
    y: 3,
    z: 4
  }),
  yawRadians: 0.75
});

const mountedEnvironmentSnapshot = Object.freeze({
  cameraPolicyId: "skiff-follow",
  controlRoutingPolicyId: "driver-only",
  directSeatTargets: Object.freeze([]),
  entryId: "port-entry",
  environmentAssetId: "harbor-skiff",
  label: "Harbor Skiff",
  lookLimitPolicyId: "wide",
  occupancyAnimationId: "seated",
  occupancyKind: "entry",
  occupantLabel: "Driver",
  occupantRole: "driver",
  seatId: null,
  seatTargets: Object.freeze([])
});

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRuntimeServiceLifecycle resets stale services and runs direct boot sequencing outside the shell runtime", async () => {
  const { MetaverseRuntimeServiceLifecycle } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-service-lifecycle.ts"
  );
  const callLog = [];
  const lifecycle = new MetaverseRuntimeServiceLifecycle({
    authoritativeWorldSync: {
      reset() {
        callLog.push("authoritative:reset");
      }
    },
    bootLifecycle: {
      async bootRuntime(request) {
        callLog.push("bootLifecycle:bootRuntime");
        await request.bootGroundedRuntime();
      },
      ensureRuntimeInputInstalled(canvas, flightInputRuntime) {
        callLog.push(`bootLifecycle:install:${canvas.clientWidth}x${canvas.clientHeight}`);
        flightInputRuntime.install(canvas);
      },
      reset() {
        callLog.push("bootLifecycle:reset");
      }
    },
    environmentPhysicsRuntime: {
      async boot(initialYawRadians) {
        callLog.push(`environment:boot:${initialYawRadians}`);
      },
      dispose() {
        callLog.push("environment:dispose");
      }
    },
    flightInputRuntime: {
      install() {
        callLog.push("flightInput:install");
      },
      dispose() {
        callLog.push("flightInput:dispose");
      }
    },
    frameLoop: {
      reset() {
        callLog.push("frameLoop:reset");
      }
    },
    hudPublisher: {
      resetTelemetryState() {
        callLog.push("hud:resetTelemetry");
      }
    },
    presenceRuntime: {
      boot() {
        callLog.push("presence:boot");
      },
      dispose() {
        callLog.push("presence:dispose");
      }
    },
    readNowMs() {
      return 1234;
    },
    remoteWorldRuntime: {
      boot() {
        callLog.push("remoteWorld:boot");
      },
      dispose() {
        callLog.push("remoteWorld:dispose");
      }
    },
    sceneRuntime: {
      resetPresentation() {
        callLog.push("scene:resetPresentation");
      }
    },
    traversalRuntime: {
      cameraSnapshot,
      characterPresentationSnapshot,
      locomotionMode: "grounded",
      mountedEnvironmentSnapshot,
      boot() {
        callLog.push("traversal:boot");
      },
      reset() {
        callLog.push("traversal:reset");
      }
    }
  });

  lifecycle.resetForStart();
  await lifecycle.beginBootRuntimeServices({
    canvas: {
      clientHeight: 720,
      clientWidth: 1280
    },
    publishHudSnapshot(lifecyclePhase, failureReason, forceUiUpdate) {
      callLog.push(
        `hud:publish:${lifecyclePhase}:${failureReason ?? "none"}:${forceUiUpdate}`
      );
    },
    renderer: {
      dispose() {
        callLog.push("renderer:dispose");
      }
    }
  });

  assert.deepEqual(callLog, [
    "traversal:reset",
    "frameLoop:reset",
    "presence:dispose",
    "remoteWorld:dispose",
    "hud:publish:booting:none:true",
    "bootLifecycle:install:1280x720",
    "flightInput:install",
    "bootLifecycle:bootRuntime",
    "environment:boot:0.75",
    "traversal:boot",
    "hud:publish:booting:none:true"
  ]);
});

test("MetaverseRuntimeServiceLifecycle activates the booted runtime without moving presence or first-frame ownership back into the shell runtime", async () => {
  const { MetaverseRuntimeServiceLifecycle } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-service-lifecycle.ts"
  );
  const callLog = [];
  const lifecycle = new MetaverseRuntimeServiceLifecycle({
    authoritativeWorldSync: {
      reset() {
        callLog.push("authoritative:reset");
      }
    },
    bootLifecycle: {
      async bootRuntime() {
        callLog.push("bootLifecycle:bootRuntime");
      },
      ensureRuntimeInputInstalled(canvas, flightInputRuntime) {
        callLog.push(`bootLifecycle:install:${canvas.clientWidth}x${canvas.clientHeight}`);
        flightInputRuntime.install(canvas);
      },
      reset() {
        callLog.push("bootLifecycle:reset");
      }
    },
    environmentPhysicsRuntime: {
      async boot(initialYawRadians) {
        callLog.push(`environment:boot:${initialYawRadians}`);
      },
      dispose() {
        callLog.push("environment:dispose");
      }
    },
    flightInputRuntime: {
      install() {
        callLog.push("flightInput:install");
      },
      dispose() {
        callLog.push("flightInput:dispose");
      }
    },
    frameLoop: {
      reset() {
        callLog.push("frameLoop:reset");
      }
    },
    hudPublisher: {
      resetTelemetryState() {
        callLog.push("hud:resetTelemetry");
      }
    },
    presenceRuntime: {
      boot(
        nextCharacterPresentationSnapshot,
        nextCameraSnapshot,
        locomotionMode,
        nextMountedEnvironmentSnapshot
      ) {
        callLog.push("presence:boot");
        assert.equal(nextCharacterPresentationSnapshot, characterPresentationSnapshot);
        assert.equal(nextCameraSnapshot, cameraSnapshot);
        assert.equal(locomotionMode, "grounded");
        assert.equal(nextMountedEnvironmentSnapshot, mountedEnvironmentSnapshot);
      },
      dispose() {
        callLog.push("presence:dispose");
      }
    },
    readNowMs() {
      return 4321;
    },
    remoteWorldRuntime: {
      boot() {
        callLog.push("remoteWorld:boot");
      },
      dispose() {
        callLog.push("remoteWorld:dispose");
      }
    },
    sceneRuntime: {
      resetPresentation() {
        callLog.push("scene:resetPresentation");
      }
    },
    traversalRuntime: {
      cameraSnapshot,
      characterPresentationSnapshot,
      locomotionMode: "grounded",
      mountedEnvironmentSnapshot,
      boot() {
        callLog.push("traversal:boot");
      },
      reset() {
        callLog.push("traversal:reset");
      }
    }
  });

  lifecycle.activateBootedRuntimeServices({
    canvas: {
      clientHeight: 720,
      clientWidth: 1280
    },
    queueNextFrame() {
      callLog.push("frame:queue");
    },
    syncFrame(nowMs, forceUiUpdate) {
      callLog.push(`frame:sync:${nowMs}:${forceUiUpdate}`);
    }
  });

  assert.deepEqual(callLog, [
    "presence:boot",
    "remoteWorld:boot",
    "frame:sync:4321:true",
    "frame:queue"
  ]);
});

test("MetaverseRuntimeServiceLifecycle owns boot-attempt cleanup and runtime teardown ordering", async () => {
  const { MetaverseRuntimeServiceLifecycle } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-service-lifecycle.ts"
  );
  const callLog = [];
  const lifecycle = new MetaverseRuntimeServiceLifecycle({
    authoritativeWorldSync: {
      reset() {
        callLog.push("authoritative:reset");
      }
    },
    bootLifecycle: {
      async bootRuntime() {
        callLog.push("bootLifecycle:bootRuntime");
      },
      ensureRuntimeInputInstalled() {
        callLog.push("bootLifecycle:install");
      },
      reset() {
        callLog.push("bootLifecycle:reset");
      }
    },
    environmentPhysicsRuntime: {
      async boot(initialYawRadians) {
        callLog.push(`environment:boot:${initialYawRadians}`);
      },
      dispose() {
        callLog.push("environment:dispose");
      }
    },
    flightInputRuntime: {
      install() {
        callLog.push("flightInput:install");
      },
      dispose() {
        callLog.push("flightInput:dispose");
      }
    },
    frameLoop: {
      reset() {
        callLog.push("frameLoop:reset");
      }
    },
    hudPublisher: {
      resetTelemetryState() {
        callLog.push("hud:resetTelemetry");
      }
    },
    presenceRuntime: {
      boot() {
        callLog.push("presence:boot");
      },
      dispose() {
        callLog.push("presence:dispose");
      }
    },
    readNowMs() {
      return 100;
    },
    remoteWorldRuntime: {
      boot() {
        callLog.push("remoteWorld:boot");
      },
      dispose() {
        callLog.push("remoteWorld:dispose");
      }
    },
    sceneRuntime: {
      resetPresentation() {
        callLog.push("scene:resetPresentation");
      }
    },
    traversalRuntime: {
      cameraSnapshot,
      characterPresentationSnapshot,
      locomotionMode: "grounded",
      mountedEnvironmentSnapshot,
      boot() {
        callLog.push("traversal:boot");
      },
      reset() {
        callLog.push("traversal:reset");
      }
    }
  });

  lifecycle.cleanupBootAttempt({
    clearActiveSurface() {
      callLog.push("surface:clear");
    },
    renderer: {
      dispose() {
        callLog.push("renderer:dispose");
      }
    }
  });
  lifecycle.disposeRuntimeServices();

  assert.deepEqual(callLog, [
    "surface:clear",
    "renderer:dispose",
    "flightInput:dispose",
    "environment:dispose",
    "flightInput:dispose",
    "authoritative:reset",
    "frameLoop:reset",
    "environment:dispose",
    "presence:dispose",
    "remoteWorld:dispose",
    "traversal:reset",
    "scene:resetPresentation",
    "bootLifecycle:reset",
    "hud:resetTelemetry"
  ]);
});
