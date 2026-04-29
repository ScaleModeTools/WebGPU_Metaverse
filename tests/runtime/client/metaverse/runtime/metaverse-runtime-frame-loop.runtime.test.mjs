import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function directionFromYawPitch(yawRadians, pitchRadians) {
  const horizontalScale = Math.cos(pitchRadians);
  const x = Math.sin(yawRadians) * horizontalScale;
  const y = Math.sin(pitchRadians);
  const z = -Math.cos(yawRadians) * horizontalScale;
  const length = Math.hypot(x, y, z);

  return Object.freeze({
    x: x / length,
    y: y / length,
    z: z / length
  });
}

function createCameraSnapshot({
  lookDirection = null,
  x = 0,
  y = 1.62,
  z = 0,
  pitchRadians = 0,
  yawRadians = 0
} = {}) {
  const resolvedLookDirection =
    lookDirection ?? directionFromYawPitch(yawRadians, pitchRadians);

  return Object.freeze({
    lookDirection: Object.freeze(resolvedLookDirection),
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
  const sampledRemotePlayerBodyBlockers = Object.freeze([
    Object.freeze({
      capsuleHalfHeightMeters: 0.62,
      capsuleRadiusMeters: 0.32,
      playerId: "remote-player",
      position: Object.freeze({
        x: 5,
        y: 0.68,
        z: -3
      })
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
      syncSampledRemotePlayerBlockers(nextRemotePlayerBodyBlockers) {
        callLog.push("syncSampledRemotePlayerBlockers");
        assert.equal(nextRemotePlayerBodyBlockers, sampledRemotePlayerBodyBlockers);
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
      remotePlayerBodyBlockers: sampledRemotePlayerBodyBlockers,
      remoteCharacterPresentations,
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
        localWeaponState,
        localWeaponAdsBlend,
        nextRemoteCharacterPresentations,
        mountedEnvironment,
        cameraFieldOfViewDegrees
      ) {
        callLog.push("syncPresentation");
        scenePresentationCalls.push({
          cameraSnapshot,
          characterPresentationSnapshot,
          cameraFieldOfViewDegrees,
          deltaSeconds,
          focusedPortal,
          localWeaponAdsBlend,
          localWeaponState,
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
      syncSampledRemotePlayerBlockers() {}
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
      remotePlayerBodyBlockers: Object.freeze([]),
      remoteCharacterPresentations: Object.freeze([]),
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

test("MetaverseRuntimeFrameLoop routes local weapon fire, look sync, and presentation through one semantic aim frame", async () => {
  const { MetaverseRuntimeFrameLoop } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-frame-loop.ts"
  );
  const cameraSnapshot = createCameraSnapshot({
    pitchRadians: -0.32,
    yawRadians: 1.15,
    x: 2,
    y: 1.7,
    z: -4
  });
  const expectedRayForwardWorld = directionFromYawPitch(
    cameraSnapshot.yawRadians,
    cameraSnapshot.pitchRadians
  );
  const weaponState = Object.freeze({
    aimMode: "ads",
    weaponId: "metaverse-service-pistol-v2"
  });
  let firedWeapon = null;
  let syncedLook = null;
  let syncedWeaponState = null;
  let presentationAimFrame = null;
  let localShotActionSequence = null;
  let localShotOrigin = null;
  let localShotWeaponId = null;
  let presentationSynced = false;
  const projectionOrder = [];

  const frameLoop = new MetaverseRuntimeFrameLoop({
    authoritativeWorldSync: {
      syncAuthoritativeWorldSnapshots() {}
    },
    bootLifecycle: {
      resolveRuntimeCameraPhaseState({ liveCameraSnapshot, liveFocusedPortal }) {
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
    combatFeedbackRuntime: {
      capturePendingLocalShotOrigin({ actionSequence, originWorld, weaponId }) {
        projectionOrder.push("capture-local-muzzle");
        localShotActionSequence = actionSequence;
        localShotOrigin = originWorld;
        localShotWeaponId = weaponId;
      },
      drainQueuedVisualIntents({ resolveRenderedMuzzle }) {
        projectionOrder.push("drain-visual-intents");
        assert.equal(presentationSynced, true);
        assert.notEqual(localShotOrigin, null);
        assert.equal(
          resolveRenderedMuzzle?.({
            playerId: "local-player",
            role: "projectile.muzzle",
            weaponId: weaponState.weaponId
          })?.originWorld.z,
          -0.52
        );
      },
      registerPendingLocalShot() {},
      syncAuthoritativeWorld() {},
    },
    devicePixelRatio: 1,
    environmentPhysicsRuntime: {
      syncDebugPresentation() {},
      syncDynamicEnvironmentBodyPresentations() {},
      syncSampledRemotePlayerBlockers() {}
    },
    flightInputRuntime: {
      readSnapshot() {
        return Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 0,
          pitchAxis: 0,
          primaryAction: true,
          secondaryAction: true,
          strafeAxis: 0,
          yawAxis: 0
        });
      }
    },
    hudPublisher: {
      trackFrameTelemetry() {}
    },
    portals: Object.freeze([]),
    presenceRuntime: {
      connectionRequired: false,
      isJoined: true,
      syncPresencePose() {},
      syncRemoteCharacterPresentations() {}
    },
    remoteWorldRuntime: {
      connectionRequired: false,
      fireWeapon(input) {
        firedWeapon = input;
        return {
          actionSequence: 41,
          issuedAtAuthoritativeTimeMs: 100,
          weaponId: input.weaponId
        };
      },
      isConnected: true,
      readFreshAuthoritativeWorldSnapshot() {
        return null;
      },
      remoteCharacterPresentations: Object.freeze([]),
      remotePlayerBodyBlockers: Object.freeze([]),
      previewLocalTraversalIntent() {
        return "preview";
      },
      sampleRemoteWorld() {},
      syncConnection() {},
      syncLocalDriverVehicleControl() {},
      syncLocalPlayerLook(lookSnapshot) {
        syncedLook = lookSnapshot;
      },
      syncLocalPlayerWeaponState(nextWeaponState) {
        syncedWeaponState = nextWeaponState;
      },
      syncLocalTraversalIntent() {
        return "synced";
      }
    },
    sceneRuntime: {
      camera: {
        kind: "render-camera"
      },
      scene: {
        kind: "scene"
      },
      readLocalWeaponProjectileMuzzleWorldPosition() {
        assert.equal(presentationSynced, true);
        return Object.freeze({ x: 0.21, y: 1.44, z: -0.52 });
      },
      readRenderedWeaponMuzzleFrame(query) {
        assert.equal(presentationSynced, true);
        return Object.freeze({
          forwardWorld: null,
          originWorld: Object.freeze({ x: 0.21, y: 1.44, z: -0.52 }),
          playerId: query.playerId,
          sampledAtRenderFrame: 1,
          source: "rendered-projectile-muzzle",
          weaponId: query.weaponId,
          weaponInstanceId: query.weaponInstanceId ?? null
        });
      },
      syncCombatProjectiles() {
        projectionOrder.push("sync-combat-projectiles");
      },
      syncPresentation(
        _cameraSnapshot,
        _focusedPortal,
        _nowMs,
        _deltaSeconds,
        _characterPresentationSnapshot,
        _localWeaponState,
        _localWeaponAdsBlend,
        _remoteCharacterPresentations,
        _mountedEnvironment,
        _cameraFieldOfViewDegrees,
        localSemanticAimFrame
      ) {
        presentationSynced = true;
        presentationAimFrame = localSemanticAimFrame;
        return {
          focusedMountable: null
        };
      },
      syncViewport() {},
      triggerCombatPresentationEvent() {}
    },
    traversalRuntime: {
      cameraSnapshot,
      characterPresentationSnapshot: Object.freeze({
        playerId: "local-player",
        yawRadians: 0.8
      }),
      locomotionMode: "grounded",
      mountedEnvironmentSnapshot: null,
      routedDriverVehicleControlIntentSnapshot: null,
      resolveLocalTraversalIntentInput() {
        return null;
      },
      advance() {},
      syncIssuedTraversalIntentSnapshot() {}
    },
    weaponPresentationRuntime: {
      adsBlend: 0.7,
      cameraFieldOfViewDegrees: 54,
      firePressedThisFrame: true,
      weaponState,
      advance() {}
    }
  });

  frameLoop.syncFrame({
    canvas: {
      clientHeight: 720,
      clientWidth: 1280
    },
    nowMs: 100,
    renderer: createFakeRenderer([])
  });

  assert.deepEqual(syncedLook, {
    pitchRadians: cameraSnapshot.pitchRadians,
    yawRadians: cameraSnapshot.yawRadians
  });
  assert.equal(syncedWeaponState, weaponState);
  assert.deepEqual(firedWeapon, {
    aimMode: weaponState.aimMode,
    aimSnapshot: {
      pitchRadians: cameraSnapshot.pitchRadians,
      rayForwardWorld: {
        x: expectedRayForwardWorld.x,
        y: expectedRayForwardWorld.y,
        z: expectedRayForwardWorld.z
      },
      rayOriginWorld: {
        x: cameraSnapshot.position.x,
        y: cameraSnapshot.position.y,
        z: cameraSnapshot.position.z
      },
      yawRadians: cameraSnapshot.yawRadians
    },
    weaponId: weaponState.weaponId
  });
  assert.equal(localShotActionSequence, 41);
  assert.equal(localShotWeaponId, weaponState.weaponId);
  assert.deepEqual(localShotOrigin, {
    x: 0.21,
    y: 1.44,
    z: -0.52
  });
  assert.deepEqual(projectionOrder, [
    "capture-local-muzzle",
    "drain-visual-intents",
    "sync-combat-projectiles"
  ]);
  assert.equal(presentationAimFrame?.source, "local_camera");
  assert.equal(presentationAimFrame?.quality, "full_camera_ray");
  assert.equal(presentationAimFrame?.aimMode, weaponState.aimMode);
  assert.equal(presentationAimFrame?.adsBlend, 0.7);
  assert.equal(presentationAimFrame?.actorFacingYawRadians, 0.8);
  assert.equal(presentationAimFrame?.pitchRadians, cameraSnapshot.pitchRadians);
  assert.equal(presentationAimFrame?.yawRadians, cameraSnapshot.yawRadians);
  assert.equal(presentationAimFrame?.weaponId, weaponState.weaponId);
  assert.deepEqual(presentationAimFrame?.cameraForwardWorld, {
    x: expectedRayForwardWorld.x,
    y: expectedRayForwardWorld.y,
    z: expectedRayForwardWorld.z
  });
});

test("semantic fire aim snapshots use the camera look ray and reject invalid rays", async () => {
  const {
    createMetaverseFireAimSnapshotFromSemanticAimFrame,
    createMetaverseSemanticAimFrameFromCameraSnapshot
  } = await clientLoader.load("/src/metaverse/aim/metaverse-semantic-aim.ts");
  const pitchRadians = -0.24;
  const yawRadians = 0.52;
  const expectedRayForwardWorld = directionFromYawPitch(-0.34, 0.18);
  const cameraSnapshot = Object.freeze({
    lookDirection: expectedRayForwardWorld,
    pitchRadians,
    position: Object.freeze({
      x: 1.2,
      y: 1.68,
      z: -2.5
    }),
    yawRadians
  });
  const aimFrame = createMetaverseSemanticAimFrameFromCameraSnapshot({
    cameraSnapshot,
    quality: "full_camera_ray",
    source: "local_camera"
  });
  const fireAimSnapshot =
    createMetaverseFireAimSnapshotFromSemanticAimFrame(aimFrame);
  const rayForwardWorld = fireAimSnapshot.rayForwardWorld;
  const rayOriginWorld = fireAimSnapshot.rayOriginWorld;

  assert.notEqual(rayForwardWorld, null);
  assert.notEqual(rayOriginWorld, null);
  assert.ok(Math.abs(rayForwardWorld.x - expectedRayForwardWorld.x) < 0.000001);
  assert.ok(Math.abs(rayForwardWorld.y - expectedRayForwardWorld.y) < 0.000001);
  assert.ok(Math.abs(rayForwardWorld.z - expectedRayForwardWorld.z) < 0.000001);
  assert.deepEqual(rayOriginWorld, cameraSnapshot.position);
  assert.equal(fireAimSnapshot.pitchRadians, pitchRadians);
  assert.equal(fireAimSnapshot.yawRadians, yawRadians);

  const invalidAimFrame = createMetaverseSemanticAimFrameFromCameraSnapshot({
    cameraSnapshot: {
      ...cameraSnapshot,
      lookDirection: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      })
    },
    quality: "full_camera_ray",
    source: "local_camera"
  });

  assert.equal(
    createMetaverseFireAimSnapshotFromSemanticAimFrame(invalidAimFrame),
    null
  );
});
