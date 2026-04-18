import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function createCameraSnapshot({
  x = 0,
  y = 1.62,
  z = 0,
  pitchRadians = 0,
  yawRadians = 0
} = {}) {
  return Object.freeze({
    lookDirection: Object.freeze({
      x: 0,
      y: 0,
      z: -1
    }),
    pitchRadians,
    position: Object.freeze({
      x,
      y,
      z
    }),
    yawRadians
  });
}

function createFakeRenderer(callLog) {
  return {
    render(scene, camera) {
      callLog.push("render");
      this.lastCamera = camera;
      this.lastScene = scene;
    },
    setPixelRatio() {},
    setSize() {}
  };
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRuntimeFrameLoop owns the live frame sequencing and frame state outside the shell runtime", async () => {
  const { MetaverseRuntimeFrameLoop } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-frame-loop.ts"
  );
  const callLog = [];
  const renderer = createFakeRenderer(callLog);
  const localCharacterPresentation = Object.freeze({
    playerId: "local-player"
  });
  const remoteCharacterPresentations = Object.freeze([
    Object.freeze({
      playerId: "remote-player"
    })
  ]);
  const focusedMountable = Object.freeze({
    environmentAssetId: "harbor-skiff"
  });
  const traversalCameraSnapshot = createCameraSnapshot({
    x: 4,
    y: 2,
    z: 8,
    yawRadians: 0.5
  });
  const trackedTelemetry = [];
  const previewInputs = [];
  const syncedTraversalInputs = [];
  const issuedIntents = [];
  const scenePresentationCalls = [];
  const advancedDeltas = [];

  const frameLoop = new MetaverseRuntimeFrameLoop({
    authoritativeWorldSync: {
      syncAuthoritativeWorldSnapshots() {
        callLog.push("syncAuthoritativeWorldSnapshots");
      }
    },
    bootLifecycle: {
      isBootCinematicActive() {
        return false;
      },
      resolveBootCinematicPresentationSnapshot() {
        return null;
      }
    },
    devicePixelRatio: 2,
    environmentPhysicsRuntime: {
      syncDebugPresentation() {
        callLog.push("syncDebugPresentation");
      },
      syncPushableBodyPresentations() {
        callLog.push("syncPushableBodyPresentations");
      },
      syncRemoteCharacterBlockers(nextRemoteCharacterPresentations) {
        callLog.push("syncRemoteCharacterBlockers");
        assert.equal(
          nextRemoteCharacterPresentations,
          remoteCharacterPresentations
        );
      }
    },
    flightInputRuntime: {
      readSnapshot() {
        callLog.push("readSnapshot");
        return Object.freeze({
          boost: true,
          jump: true,
          moveAxis: 1,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: -0.25,
          yawAxis: 0.5
        });
      }
    },
    hudPublisher: {
      trackFrameTelemetry(nowMs, presentationCameraSnapshot, renderedCamera) {
        callLog.push("trackFrameTelemetry");
        trackedTelemetry.push({
          nowMs,
          presentationCameraSnapshot,
          renderedCamera
        });
      }
    },
    portals: Object.freeze([]),
    presenceRuntime: {
      isJoined: true,
      syncPresencePose(
        characterPresentationSnapshot,
        cameraSnapshot,
        locomotionMode,
        mountedEnvironment
      ) {
        callLog.push("syncPresencePose");
        assert.equal(characterPresentationSnapshot, localCharacterPresentation);
        assert.equal(cameraSnapshot, traversalCameraSnapshot);
        assert.equal(locomotionMode, "grounded");
        assert.equal(mountedEnvironment, null);
      },
      syncRemoteCharacterPresentations() {
        callLog.push("syncRemoteCharacterPresentations");
      }
    },
    remoteWorldRuntime: {
      remoteCharacterPresentations,
      previewLocalTraversalIntent(
        movementInput,
        traversalFacing,
        locomotionMode
      ) {
        callLog.push("previewLocalTraversalIntent");
        previewInputs.push({
          locomotionMode,
          movementInput,
          traversalFacing
        });
        return "preview-intent";
      },
      sampleRemoteWorld() {
        callLog.push("sampleRemoteWorld");
      },
      syncConnection(joined) {
        callLog.push("syncConnection");
        assert.equal(joined, true);
      },
      syncLocalDriverVehicleControl(controlIntentSnapshot) {
        callLog.push("syncLocalDriverVehicleControl");
        assert.equal(controlIntentSnapshot, null);
      },
      syncLocalPlayerLook(lookSnapshot) {
        callLog.push("syncLocalPlayerLook");
        assert.equal(lookSnapshot, null);
      },
      syncLocalTraversalIntent(
        movementInput,
        traversalFacing,
        locomotionMode
      ) {
        callLog.push("syncLocalTraversalIntent");
        syncedTraversalInputs.push({
          locomotionMode,
          movementInput,
          traversalFacing
        });
        return "synced-intent";
      }
    },
    sceneRuntime: {
      camera: {
        kind: "render-camera"
      },
      scene: {
        kind: "scene"
      },
      syncPresentation(
        cameraSnapshot,
        focusedPortal,
        nowMs,
        deltaSeconds,
        characterPresentationSnapshot,
        nextRemoteCharacterPresentations,
        mountedEnvironment
      ) {
        callLog.push("syncPresentation");
        scenePresentationCalls.push({
          cameraSnapshot,
          characterPresentationSnapshot,
          deltaSeconds,
          focusedPortal,
          mountedEnvironment,
          nextRemoteCharacterPresentations,
          nowMs
        });
        return {
          focusedMountable
        };
      },
      syncViewport() {
        callLog.push("syncViewport");
      }
    },
    traversalRuntime: {
      cameraSnapshot: traversalCameraSnapshot,
      characterPresentationSnapshot: localCharacterPresentation,
      locomotionMode: "grounded",
      mountedEnvironmentSnapshot: null,
      routedDriverVehicleControlIntentSnapshot: null,
      advance(movementInput, deltaSeconds) {
        callLog.push("advance");
        assert.equal(movementInput.moveAxis, 1);
        advancedDeltas.push(deltaSeconds);
      },
      syncIssuedTraversalIntentSnapshot(intentSnapshot) {
        callLog.push("syncIssuedTraversalIntentSnapshot");
        issuedIntents.push(intentSnapshot);
      }
    }
  });

  frameLoop.syncFrame({
    canvas: {
      clientHeight: 720,
      clientWidth: 1280
    },
    nowMs: 1000,
    renderer
  });

  frameLoop.syncFrame({
    canvas: {
      clientHeight: 720,
      clientWidth: 1280
    },
    nowMs: 1016,
    renderer
  });

  assert.ok(callLog.indexOf("previewLocalTraversalIntent") < callLog.indexOf("advance"));
  assert.ok(callLog.indexOf("advance") < callLog.indexOf("syncLocalTraversalIntent"));
  assert.ok(callLog.indexOf("syncViewport") < callLog.indexOf("syncPresentation"));
  assert.ok(callLog.indexOf("syncPresentation") < callLog.indexOf("render"));
  assert.deepEqual(issuedIntents.slice(0, 2), [
    "preview-intent",
    "synced-intent"
  ]);
  assert.deepEqual(advancedDeltas, [0, 0.016]);
  assert.equal(previewInputs[0].movementInput.moveAxis, 1);
  assert.equal(syncedTraversalInputs[0].movementInput.jump, true);
  assert.equal(scenePresentationCalls[0].characterPresentationSnapshot, localCharacterPresentation);
  assert.equal(scenePresentationCalls[0].nextRemoteCharacterPresentations, remoteCharacterPresentations);
  assert.equal(scenePresentationCalls[0].focusedPortal, null);
  assert.equal(trackedTelemetry[0].nowMs, 1000);
  assert.equal(trackedTelemetry[0].presentationCameraSnapshot, traversalCameraSnapshot);
  assert.equal(frameLoop.focusedMountable, focusedMountable);
  assert.equal(frameLoop.focusedPortal, null);
  assert.equal(frameLoop.mountedEnvironment, null);
  assert.equal(frameLoop.frameDeltaMs, 16);
  assert.equal(frameLoop.frameRate, 62.5);
  assert.equal(frameLoop.renderedFrameCount, 2);
});

test("MetaverseRuntimeFrameLoop keeps boot-cinematic frames neutral and suppresses live interaction focus", async () => {
  const { MetaverseRuntimeFrameLoop } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-frame-loop.ts"
  );
  const previewInputs = [];
  const scenePresentationCalls = [];
  let flightInputReadCount = 0;

  const frameLoop = new MetaverseRuntimeFrameLoop({
    authoritativeWorldSync: {
      syncAuthoritativeWorldSnapshots() {}
    },
    bootLifecycle: {
      isBootCinematicActive() {
        return true;
      },
      resolveBootCinematicPresentationSnapshot() {
        return {
          cameraSnapshot: createCameraSnapshot({
            x: 9,
            y: 4,
            z: 3,
            yawRadians: 1.2
          }),
          focusedPortal: Object.freeze({
            experienceId: "duck-hunt"
          })
        };
      }
    },
    devicePixelRatio: 1,
    environmentPhysicsRuntime: {
      syncDebugPresentation() {},
      syncPushableBodyPresentations() {},
      syncRemoteCharacterBlockers() {}
    },
    flightInputRuntime: {
      readSnapshot() {
        flightInputReadCount += 1;
        return Object.freeze({
          boost: true,
          jump: true,
          moveAxis: 1,
          pitchAxis: 1,
          primaryAction: true,
          secondaryAction: true,
          strafeAxis: 1,
          yawAxis: 1
        });
      }
    },
    hudPublisher: {
      trackFrameTelemetry() {}
    },
    portals: Object.freeze([]),
    presenceRuntime: {
      isJoined: false,
      syncPresencePose() {},
      syncRemoteCharacterPresentations() {}
    },
    remoteWorldRuntime: {
      remoteCharacterPresentations: Object.freeze([]),
      previewLocalTraversalIntent(movementInput) {
        previewInputs.push(movementInput);
        return "preview-intent";
      },
      sampleRemoteWorld() {},
      syncConnection() {},
      syncLocalDriverVehicleControl() {},
      syncLocalPlayerLook() {},
      syncLocalTraversalIntent() {
        return "synced-intent";
      }
    },
    sceneRuntime: {
      camera: {
        kind: "render-camera"
      },
      scene: {
        kind: "scene"
      },
      syncPresentation(
        cameraSnapshot,
        focusedPortal,
        nowMs,
        deltaSeconds,
        characterPresentationSnapshot
      ) {
        scenePresentationCalls.push({
          cameraSnapshot,
          characterPresentationSnapshot,
          deltaSeconds,
          focusedPortal,
          nowMs
        });
        return {
          focusedMountable: Object.freeze({
            environmentAssetId: "should-not-surface"
          })
        };
      },
      syncViewport() {}
    },
    traversalRuntime: {
      cameraSnapshot: createCameraSnapshot(),
      characterPresentationSnapshot: Object.freeze({
        playerId: "local-player"
      }),
      locomotionMode: "grounded",
      mountedEnvironmentSnapshot: null,
      routedDriverVehicleControlIntentSnapshot: null,
      advance() {},
      syncIssuedTraversalIntentSnapshot() {}
    }
  });

  frameLoop.syncFrame({
    canvas: {
      clientHeight: 720,
      clientWidth: 1280
    },
    nowMs: 250,
    renderer: createFakeRenderer([])
  });

  assert.equal(flightInputReadCount, 0);
  assert.equal(previewInputs[0].moveAxis, 0);
  assert.equal(previewInputs[0].jump, false);
  assert.equal(scenePresentationCalls[0].characterPresentationSnapshot, null);
  assert.equal(scenePresentationCalls[0].focusedPortal?.experienceId, "duck-hunt");
  assert.equal(frameLoop.focusedMountable, null);
  assert.equal(frameLoop.focusedPortal, null);
  assert.equal(frameLoop.renderedFrameCount, 1);
});
