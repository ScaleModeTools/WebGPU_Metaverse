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
  const authoritativeRemotePlayerSnapshots = Object.freeze([
    Object.freeze({
      locomotionMode: "grounded",
      mountedOccupancy: null,
      playerId: "remote-player",
      position: Object.freeze({
        x: 5,
        y: 0.68,
        z: -3
      }),
      yawRadians: 0.25
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
      resolveRuntimeCameraPhaseState({
        liveCameraSnapshot,
        liveFocusedPortal
      }) {
        return {
          blocksMovementInput: false,
          hidesLocalCharacter: false,
          phaseId: "live",
          presentationSnapshot: {
            cameraSnapshot: liveCameraSnapshot,
            focusedPortal: liveFocusedPortal
          },
          suppressesInteractionFocus: false
        };
      }
    },
    devicePixelRatio: 2,
    environmentPhysicsRuntime: {
      syncDebugPresentation() {
        callLog.push("syncDebugPresentation");
      },
      syncDynamicEnvironmentBodyPresentations() {
        callLog.push("syncDynamicEnvironmentBodyPresentations");
      },
      syncAuthoritativeRemotePlayerBlockers(nextRemotePlayerSnapshots) {
        callLog.push("syncAuthoritativeRemotePlayerBlockers");
        assert.equal(
          nextRemotePlayerSnapshots,
          authoritativeRemotePlayerSnapshots
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
      connectionRequired: false,
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
      connectionRequired: false,
      isConnected: true,
      remoteCharacterPresentations,
      readFreshAuthoritativeRemotePlayerSnapshots() {
        callLog.push("readFreshAuthoritativeRemotePlayerSnapshots");
        return authoritativeRemotePlayerSnapshots;
      },
      previewLocalTraversalIntent(traversalIntentInput) {
        callLog.push("previewLocalTraversalIntent");
        previewInputs.push(traversalIntentInput);
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
      syncLocalTraversalIntent(traversalIntentInput) {
        callLog.push("syncLocalTraversalIntent");
        syncedTraversalInputs.push(traversalIntentInput);
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
      resolveLocalTraversalIntentInput(movementInput) {
        return Object.freeze({
          actionIntent: Object.freeze({
            kind: movementInput.jump ? "jump" : "none",
            pressed: movementInput.jump
          }),
          bodyControl: Object.freeze({
            boost: movementInput.boost,
            moveAxis: movementInput.moveAxis,
            strafeAxis: movementInput.strafeAxis,
            turnAxis: movementInput.yawAxis
          }),
          facing: traversalCameraSnapshot,
          locomotionMode: "grounded"
        });
      },
      advance(movementInput, deltaSeconds, traversalIntentInput) {
        callLog.push("advance");
        assert.equal(movementInput.moveAxis, 1);
        assert.equal(traversalIntentInput?.bodyControl.moveAxis, 1);
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
  frameLoop.syncFrame({
    canvas: {
      clientHeight: 720,
      clientWidth: 1280
    },
    nowMs: 1034,
    renderer
  });

  assert.ok(
    callLog.indexOf("previewLocalTraversalIntent") <
      callLog.indexOf("syncAuthoritativeWorldSnapshots")
  );
  assert.ok(
    callLog.indexOf("syncIssuedTraversalIntentSnapshot") <
      callLog.indexOf("syncAuthoritativeWorldSnapshots")
  );
  assert.ok(
    callLog.indexOf("previewLocalTraversalIntent") < callLog.indexOf("advance")
  );
  assert.ok(callLog.indexOf("advance") < callLog.indexOf("syncLocalTraversalIntent"));
  assert.ok(callLog.indexOf("syncViewport") < callLog.indexOf("syncPresentation"));
  assert.ok(callLog.indexOf("syncPresentation") < callLog.indexOf("render"));
  assert.deepEqual(issuedIntents, [
    "preview-intent",
    "preview-intent",
    "preview-intent",
    "synced-intent"
  ]);
  assert.equal(advancedDeltas.length, 1);
  assert.ok(Math.abs(advancedDeltas[0] - 0.033) < 0.0001);
  assert.equal(previewInputs[0].bodyControl.moveAxis, 1);
  assert.equal(syncedTraversalInputs[0].actionIntent.pressed, true);
  assert.equal(scenePresentationCalls[0].characterPresentationSnapshot, localCharacterPresentation);
  assert.equal(scenePresentationCalls[0].nextRemoteCharacterPresentations, remoteCharacterPresentations);
  assert.equal(scenePresentationCalls[0].focusedPortal, null);
  assert.equal(trackedTelemetry[0].nowMs, 1000);
  assert.equal(trackedTelemetry[0].presentationCameraSnapshot, traversalCameraSnapshot);
  assert.equal(frameLoop.mountedInteraction.focusedMountable, focusedMountable);
  assert.equal(frameLoop.focusedPortal, null);
  assert.equal(frameLoop.mountedInteraction.mountedEnvironment, null);
  assert.equal(frameLoop.frameDeltaMs, 18);
  assert.equal(frameLoop.frameRate, 1000 / 18);
  assert.equal(frameLoop.renderedFrameCount, 3);
});

test("MetaverseRuntimeFrameLoop keeps blocked camera-phase frames neutral and suppresses live interaction focus", async () => {
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
      resolveRuntimeCameraPhaseState() {
        return {
          blocksMovementInput: true,
          hidesLocalCharacter: true,
          phaseId: "entry-preview",
          presentationSnapshot: {
            cameraSnapshot: createCameraSnapshot({
              x: 9,
              y: 4,
              z: 3,
              yawRadians: 1.2
            }),
            focusedPortal: Object.freeze({
              experienceId: "duck-hunt"
            })
          },
          suppressesInteractionFocus: true
        };
      }
    },
    devicePixelRatio: 1,
    environmentPhysicsRuntime: {
      syncDebugPresentation() {},
      syncDynamicEnvironmentBodyPresentations() {},
      syncAuthoritativeRemotePlayerBlockers() {}
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
      connectionRequired: true,
      isJoined: false,
      syncPresencePose() {},
      syncRemoteCharacterPresentations() {}
    },
    remoteWorldRuntime: {
      connectionRequired: true,
      isConnected: false,
      remoteCharacterPresentations: Object.freeze([]),
      readFreshAuthoritativeRemotePlayerSnapshots() {
        return Object.freeze([]);
      },
      previewLocalTraversalIntent(traversalIntentInput) {
        previewInputs.push(traversalIntentInput);
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
      resolveLocalTraversalIntentInput(movementInput) {
        return Object.freeze({
          actionIntent: Object.freeze({
            kind: "none",
            pressed: false
          }),
          bodyControl: Object.freeze({
            boost: movementInput.boost,
            moveAxis: movementInput.moveAxis,
            strafeAxis: movementInput.strafeAxis,
            turnAxis: movementInput.yawAxis
          }),
          facing: createCameraSnapshot(),
          locomotionMode: "grounded"
        });
      },
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
  assert.equal(previewInputs[0].bodyControl.moveAxis, 0);
  assert.equal(previewInputs[0].actionIntent.pressed, false);
  assert.equal(scenePresentationCalls[0].characterPresentationSnapshot, null);
  assert.equal(scenePresentationCalls[0].focusedPortal?.experienceId, "duck-hunt");
  assert.equal(frameLoop.mountedInteraction.focusedMountable, null);
  assert.equal(frameLoop.focusedPortal, null);
  assert.equal(frameLoop.renderedFrameCount, 1);
});
