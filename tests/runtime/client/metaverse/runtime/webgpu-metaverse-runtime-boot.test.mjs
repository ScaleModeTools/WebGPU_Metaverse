import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePresenceRosterSnapshot,
  createMetaversePlayerId,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createFakePhysicsRuntime } from "../../fake-rapier-runtime.mjs";
import {
  FakeMetaverseRenderer
} from "./fixtures/fake-renderer.mjs";
import {
  createRealtimeWorldSnapshot
} from "./fixtures/fake-world-client.mjs";

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

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("WebGpuMetaverseRuntime starts from an idle snapshot and rejects missing navigator.gpu explicitly", async () => {
  const { WebGpuMetaverseRuntime } = await clientLoader.load(
    "/src/metaverse/classes/webgpu-metaverse-runtime.ts"
  );
  const runtime = new WebGpuMetaverseRuntime();

  assert.equal(runtime.hudSnapshot.lifecycle, "idle");
  assert.equal(runtime.hudSnapshot.mountedInteraction.focusedMountable, null);
  assert.equal(runtime.hudSnapshot.mountedInteractionHud.visible, false);
  assert.equal(runtime.hudSnapshot.focusedPortal, null);
  assert.equal(runtime.hudSnapshot.mountedInteraction.mountedEnvironment, null);
  assert.equal(runtime.hudSnapshot.controlMode, "keyboard");
  assert.equal(runtime.hudSnapshot.locomotionMode, "grounded");
  assert.equal(runtime.hudSnapshot.boot.phase, "idle");
  assert.equal(runtime.hudSnapshot.boot.rendererInitialized, false);
  assert.equal(runtime.hudSnapshot.telemetry.renderer.active, false);
  assert.equal(runtime.hudSnapshot.telemetry.renderer.label, "WebGPU");
  assert.equal(runtime.hudSnapshot.telemetry.worldCadence.worldPollIntervalMs, 33);
  assert.equal(
    runtime.hudSnapshot.telemetry.worldCadence.remoteInterpolationDelayMs,
    66
  );
  assert.equal(runtime.hudSnapshot.telemetry.worldCadence.maxExtrapolationMs, 66);
  assert.equal(
    runtime.hudSnapshot.telemetry.worldCadence.localAuthoritativeFreshnessMaxAgeMs,
    66
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs,
    null
  );
  assert.equal(runtime.hudSnapshot.telemetry.worldSnapshot.bufferDepth, 0);
  assert.equal(runtime.hudSnapshot.telemetry.worldSnapshot.clockOffsetEstimateMs, null);
  assert.equal(runtime.hudSnapshot.telemetry.worldSnapshot.currentExtrapolationMs, 0);
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.datagramSendFailureCount,
    0
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.extrapolatedFramePercent,
    0
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
    0
  );
  assert.deepEqual(
    runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation,
    Object.freeze({
      lastLocalAuthorityPoseCorrectionDetail: Object.freeze({
        authoritativeGrounded: null,
        localGrounded: null,
        planarMagnitudeMeters: null,
        verticalMagnitudeMeters: null
      }),
      lastLocalAuthorityPoseCorrectionSnapshot: null,
      lastLocalAuthorityPoseCorrectionReason: "none",
      lastCorrectionAgeMs: null,
      lastCorrectionSource: "none",
      localAuthorityPoseCorrectionCount: 0,
      mountedVehicleAuthorityCorrectionCount: 0,
      recentCorrectionCountPast5Seconds: 0,
      recentLocalAuthorityPoseCorrectionCountPast5Seconds: 0,
      recentMountedVehicleAuthorityCorrectionCountPast5Seconds: 0,
      totalCorrectionCount: 0
    })
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.locomotionMode,
    "grounded"
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.decisionReason,
    "capability-maintained"
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
      .resolvedSupportHeightMeters,
    0.6
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
      .blockingAffordanceDetected,
    false
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
      .supportingAffordanceSampleCount,
    0
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.autostepHeightMeters,
    null
  );
  assert.deepEqual(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.jumpDebug,
    Object.freeze({
      groundedBodyGrounded: null,
      groundedBodyJumpReady: null,
      surfaceJumpSupported: null,
      supported: null,
      verticalSpeedUnitsPerSecond: null
    })
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.issuedTraversalIntent,
    null
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .surfaceRouting.decisionReason,
    null
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .surfaceRouting.resolvedSupportHeightMeters,
    null
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .surfaceRouting.supportingAffordanceSampleCount,
    null
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .surfaceRouting.blockingAffordanceDetected,
    null
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
      .lastProcessedInputSequence,
    null
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeCorrection
      .planarMagnitudeMeters,
    0
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.latestSimulationAgeMs,
    null
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldSnapshot.latestSnapshotUpdateRateHz,
    null
  );
  assert.equal(runtime.hudSnapshot.transport.presenceReliable.enabled, false);
  assert.equal(runtime.hudSnapshot.transport.worldReliable.enabled, false);
  assert.equal(runtime.hudSnapshot.transport.worldDriverDatagram.enabled, false);
  assert.equal(runtime.hudSnapshot.transport.worldSnapshotStream.available, false);
  assert.equal(runtime.hudSnapshot.transport.worldSnapshotStream.path, "http-polling");
  assert.equal(runtime.hudSnapshot.transport.worldSnapshotStream.liveness, "inactive");
  assert.equal(runtime.hudSnapshot.transport.worldSnapshotStream.reconnectCount, 0);
  assert.equal(runtime.hudSnapshot.presence.state, "disabled");
  assert.equal(runtime.hudSnapshot.presence.remotePlayerCount, 0);

  await assert.rejects(
    () => runtime.start({}, {}),
    /WebGPU is unavailable for the metaverse runtime/
  );
  assert.equal(runtime.hudSnapshot.lifecycle, "failed");
});

test("default metaverse staging-ground spawn resolves to grounded floor support in the shipped environment slice", async () => {
  const [
    { metaverseRuntimeConfig },
    { metaverseEnvironmentProofConfig },
    { resolvePlacedCuboidColliders },
    {
      resolveAutomaticSurfaceLocomotionMode,
      resolveSurfaceHeightMeters
    }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/world/proof/index.ts"),
    clientLoader.load("/src/metaverse/states/metaverse-environment-collision.ts"),
    clientLoader.load("/src/metaverse/traversal/policies/surface-routing.ts")
  ]);

  const surfaceColliderSnapshots = Object.freeze(
    metaverseEnvironmentProofConfig.assets.flatMap((environmentAsset) =>
      environmentAsset.placement === "dynamic"
        ? []
        : resolvePlacedCuboidColliders(environmentAsset)
    )
  );
  const spawnPosition = Object.freeze({
    x: metaverseRuntimeConfig.groundedBody.spawnPosition.x,
    y: metaverseRuntimeConfig.groundedBody.spawnPosition.y,
    z: metaverseRuntimeConfig.groundedBody.spawnPosition.z
  });
  const locomotionDecision = resolveAutomaticSurfaceLocomotionMode(
    metaverseRuntimeConfig,
    surfaceColliderSnapshots,
    spawnPosition,
    metaverseRuntimeConfig.camera.initialYawRadians,
    "grounded"
  );
  const supportHeightMeters = resolveSurfaceHeightMeters(
    metaverseRuntimeConfig,
    surfaceColliderSnapshots,
    spawnPosition.x,
    spawnPosition.z
  );

  assert.equal(locomotionDecision.locomotionMode, "grounded");
  assert.ok(supportHeightMeters !== null);
  assert.equal(supportHeightMeters, spawnPosition.y);
});

test("WebGpuMetaverseRuntime publishes boot-phase progression and per-lane transport truth", async () => {
  const [{ WebGpuMetaverseRuntime }, { RapierPhysicsRuntime }] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const joinDeferred = createDeferred();
  const connectDeferred = createDeferred();
  const presenceListeners = new Set();
  const worldListeners = new Set();

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

  let presenceStatusSnapshot = Object.freeze({
    joined: false,
    lastError: null,
    lastSnapshotSequence: null,
    playerId: null,
    state: "joining"
  });
  let presenceRosterSnapshot = null;
  const fakePresenceClient = {
    get reliableTransportStatusSnapshot() {
      return Object.freeze({
        activeTransport: "http",
        browserWebTransportAvailable: false,
        enabled: true,
        fallbackActive: false,
        lastTransportError: null,
        preference: "http",
        webTransportConfigured: false,
        webTransportStatus: "not-requested"
      });
    },
    get rosterSnapshot() {
      return presenceRosterSnapshot;
    },
    get statusSnapshot() {
      return presenceStatusSnapshot;
    },
    dispose() {},
    ensureJoined(request) {
      return joinDeferred.promise.then(() => {
        presenceStatusSnapshot = Object.freeze({
          joined: true,
          lastError: null,
          lastSnapshotSequence: 1,
          playerId: localPlayerId,
          state: "connected"
        });
        presenceRosterSnapshot = createMetaversePresenceRosterSnapshot({
          players: [
            {
              characterId: request.characterId,
              playerId: localPlayerId,
              pose: {
                ...request.pose,
                stateSequence: 1
              },
              username
            },
            {
              characterId: "metaverse-mannequin-v1",
              playerId: remotePlayerId,
              pose: {
                animationVocabulary: "walk",
                locomotionMode: "swim",
                position: {
                  x: -3,
                  y: 0.2,
                  z: 8
                },
                stateSequence: 1,
                yawRadians: 0.45
              },
              username: remoteUsername
            }
          ],
          snapshotSequence: 1,
          tickIntervalMs: 120
        });
        for (const listener of presenceListeners) {
          listener();
        }

        return presenceRosterSnapshot;
      });
    },
    subscribeUpdates(listener) {
      presenceListeners.add(listener);

      return () => {
        presenceListeners.delete(listener);
      };
    },
    syncPresence() {}
  };

  const authoritativeWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    localPlayerId,
    localUsername: username,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: Date.now(),
    snapshotSequence: 1,
    vehicleX: 8
  });
  let worldStatusSnapshot = Object.freeze({
    connected: false,
    lastError: null,
    lastSnapshotSequence: null,
    lastWorldTick: null,
    playerId: null,
    state: "connecting"
  });
  let worldSnapshotBuffer = Object.freeze([]);
  let worldTelemetrySnapshot = Object.freeze({
    driverVehicleControlDatagramSendFailureCount: 1,
    latestSnapshotUpdateRateHz: null,
    playerLookInputDatagramSendFailureCount: 0,
    playerTraversalInputDatagramSendFailureCount: 0,
    snapshotStream: Object.freeze({
      available: true,
      fallbackActive: true,
      lastTransportError: "Metaverse world snapshot stream failed.",
      liveness: "reconnecting",
      path: "fallback-polling",
      reconnectCount: 1
    })
  });
  const fakeWorldClient = {
    ensureConnectedRequests: [],
    get currentPollIntervalMs() {
      return 33;
    },
    get latestPlayerInputSequence() {
      return 0;
    },
    get driverVehicleControlDatagramStatusSnapshot() {
      return Object.freeze({
        activeTransport: "reliable-command-fallback",
        browserWebTransportAvailable: true,
        enabled: true,
        lastTransportError: "Datagram transport unavailable.",
        preference: "webtransport-preferred",
        state: "degraded-to-reliable",
        webTransportConfigured: true,
        webTransportStatus: "runtime-fallback"
      });
    },
    get reliableTransportStatusSnapshot() {
      return Object.freeze({
        activeTransport: "http",
        browserWebTransportAvailable: true,
        enabled: true,
        fallbackActive: true,
        lastTransportError:
          "Reliable WebTransport JSON request channel closed before a response frame arrived.",
        preference: "webtransport-preferred",
        webTransportConfigured: true,
        webTransportStatus: "localdev-host-unavailable"
      });
    },
    get statusSnapshot() {
      return worldStatusSnapshot;
    },
    get telemetrySnapshot() {
      return worldTelemetrySnapshot;
    },
    get worldSnapshotBuffer() {
      return worldSnapshotBuffer;
    },
    dispose() {},
    ensureConnected(playerId) {
      this.ensureConnectedRequests.push(playerId);

      return connectDeferred.promise.then(() => {
        worldSnapshotBuffer = Object.freeze([authoritativeWorldSnapshot]);
        worldTelemetrySnapshot = Object.freeze({
          driverVehicleControlDatagramSendFailureCount: 1,
          latestSnapshotUpdateRateHz: 20,
          playerLookInputDatagramSendFailureCount: 0,
          playerTraversalInputDatagramSendFailureCount: 0,
          snapshotStream: Object.freeze({
            available: true,
            fallbackActive: false,
            lastTransportError: null,
            liveness: "subscribed",
            path: "reliable-snapshot-stream",
            reconnectCount: 1
          })
        });
        worldStatusSnapshot = Object.freeze({
          connected: true,
          lastError: null,
          lastSnapshotSequence: authoritativeWorldSnapshot.snapshotSequence,
          lastWorldTick: authoritativeWorldSnapshot.tick.currentTick,
          playerId,
          state: "connected"
        });
        for (const listener of worldListeners) {
          listener();
        }

        return authoritativeWorldSnapshot;
      });
    },
    subscribeUpdates(listener) {
      worldListeners.add(listener);

      return () => {
        worldListeners.delete(listener);
      };
    },
    syncDriverVehicleControl() {},
    previewPlayerTraversalIntent() {
      return null;
    },
    syncPlayerLookIntent() {},
    syncPlayerTraversalIntent() {
      return null;
    }
  };

  globalThis.window = {
    addEventListener() {},
    cancelAnimationFrame() {},
    devicePixelRatio: 1,
    removeEventListener() {},
    requestAnimationFrame() {
      return 1;
    }
  };

  try {
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame:
        globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createMetaversePresenceClient: () => fakePresenceClient,
      createMetaverseWorldClient: () => fakeWorldClient,
      createRenderer: () => renderer,
      localPlayerIdentity: {
        characterId: "metaverse-mannequin-v1",
        playerId: localPlayerId,
        username
      },
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      requestAnimationFrame:
        globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(runtime.hudSnapshot.boot.rendererInitialized, true);
    assert.equal(runtime.hudSnapshot.boot.scenePrewarmed, true);
    assert.equal(runtime.hudSnapshot.telemetry.renderer.active, true);
    assert.equal(runtime.hudSnapshot.telemetry.renderer.drawCallCount, 7);
    assert.equal(runtime.hudSnapshot.telemetry.renderer.triangleCount, 1440);
    assert.equal(runtime.hudSnapshot.telemetry.worldCadence.worldPollIntervalMs, 33);
    assert.equal(
      runtime.hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs,
      null
    );
    assert.equal(runtime.hudSnapshot.boot.phase, "presence-joining");
    assert.equal(
      runtime.hudSnapshot.transport.presenceReliable.webTransportStatus,
      "not-requested"
    );
    assert.equal(
      runtime.hudSnapshot.transport.worldReliable.webTransportStatus,
      "localdev-host-unavailable"
    );
    assert.equal(
      runtime.hudSnapshot.transport.worldDriverDatagram.state,
      "degraded-to-reliable"
    );
    assert.equal(runtime.hudSnapshot.transport.worldSnapshotStream.path, "fallback-polling");
    assert.equal(
      runtime.hudSnapshot.transport.worldSnapshotStream.liveness,
      "reconnecting"
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.datagramSendFailureCount,
      1
    );

    joinDeferred.resolve();
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(fakeWorldClient.ensureConnectedRequests, [localPlayerId]);
    assert.equal(runtime.hudSnapshot.boot.presenceJoined, true);
    assert.equal(runtime.hudSnapshot.boot.phase, "world-connecting");

    connectDeferred.resolve();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(runtime.hudSnapshot.boot.authoritativeWorldConnected, true);
    assert.equal(runtime.hudSnapshot.boot.phase, "ready");
    assert.equal(
      runtime.hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs,
      50
    );
    assert.equal(
      runtime.hudSnapshot.transport.worldSnapshotStream.path,
      "reliable-snapshot-stream"
    );
    assert.equal(
      runtime.hudSnapshot.transport.worldSnapshotStream.liveness,
      "subscribed"
    );
    assert.equal(runtime.hudSnapshot.telemetry.worldSnapshot.bufferDepth, 1);
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.latestSnapshotUpdateRateHz,
      20
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});

test("WebGpuMetaverseRuntime prewarms the booted scene before the first render when compileAsync is available", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { RapierPhysicsRuntime },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  let scheduledFrame = null;
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };

  globalThis.window = {
    addEventListener() {},
    cancelAnimationFrame() {
      scheduledFrame = null;
    },
    devicePixelRatio: 1.5,
    removeEventListener() {},
    requestAnimationFrame(callback) {
      scheduledFrame = callback;
      return 1;
    }
  };

  try {
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createRenderer: () => renderer,
      devicePixelRatio: 1.5,
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });
    const startSnapshot = await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(startSnapshot.lifecycle, "running");
    assert.equal(startSnapshot.locomotionMode, "grounded");
    assert.equal(startSnapshot.telemetry.renderer.active, true);
    assert.equal(startSnapshot.telemetry.renderer.drawCallCount, 7);
    assert.equal(startSnapshot.telemetry.renderer.triangleCount, 1440);
    assert.equal(startSnapshot.telemetry.renderer.label, "WebGPU");
    assert.equal(startSnapshot.telemetry.renderedFrameCount, 1);
    assert.equal(renderer.initCalls, 1);
    assert.equal(renderer.compileAsyncCalls.length, 2);
    assert.equal(renderer.renderCalls, 4);
    assert.equal(renderer.pixelRatio, 1.5);
    assert.deepEqual(renderer.sizes.at(0), [1280, 720]);
    assert.equal(renderer.compileAsyncCalls[0]?.scene?.isScene, true);
    assert.equal(renderer.compileAsyncCalls[0]?.camera?.isPerspectiveCamera, true);
    assert.equal(renderer.compileAsyncCalls[1]?.scene?.isScene, true);
    assert.equal(renderer.compileAsyncCalls[1]?.camera?.isPerspectiveCamera, true);
    assert.ok(
      Math.abs(
        startSnapshot.camera.position.y -
          metaverseRuntimeConfig.camera.spawnPosition.y
      ) < 0.02
    );
    assert.equal(typeof scheduledFrame, "function");

    runtime.dispose();

    assert.equal(renderer.disposed, true);
  } finally {
    globalThis.window = originalWindow;
  }
});
