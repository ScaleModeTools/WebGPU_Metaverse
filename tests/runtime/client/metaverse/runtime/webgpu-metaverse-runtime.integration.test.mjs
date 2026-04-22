import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createMilliseconds,
  metaverseWorldGroundedSpawnPosition,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createFakePhysicsRuntime,
  createFakePhysicsRuntimeWithWorld
} from "../../fake-rapier-runtime.mjs";
import {
  authoredGroundedSpawnYawRadians,
  authoredWaterBayOpenWaterSpawn,
  authoredWaterBayDockEntryPosition,
  authoredWaterBayDockEntryYawRadians
} from "../../../metaverse-authored-world-test-fixtures.mjs";
import {
  createInteractiveWindowHarness,
  createOpenWaterSpawnRuntimeConfig,
  createRealtimeWorldSnapshot,
  createSkiffBoardingRuntimeConfig,
  createStartedWebGpuMetaverseRuntimeHarness,
  disabledRuntimeCameraPhaseConfig,
  FakeMetaversePresenceClient,
  FakeMetaverseRenderer,
  FakeMetaverseWorldClient
} from "../../metaverse-runtime-test-fixtures.mjs";
import {
  createEmptySceneAssetLoader,
  createHeldWeaponProofSlice,
  createPushableCrateProofSlice,
  createSkiffMountProofSlice,
  createStaticSurfaceProofSlice
} from "../../metaverse-runtime-proof-slice-fixtures.mjs";

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

async function createStartedClientMetaverseRuntimeHarness(options) {
  return createStartedWebGpuMetaverseRuntimeHarness({
    clientModuleLoader: clientLoader,
    ...options
  });
}

function captureCurrentGroundedBodySample({
  capturedSamples,
  fakeWorldClient,
  metaverseRuntimeConfig,
  runtime,
  wallClockMs
}) {
  const groundedBody =
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
      .groundedBody;

  assert.notEqual(groundedBody, null);

  const cameraSnapshot = runtime.hudSnapshot.camera;
  const forwardOffsetMeters =
    metaverseRuntimeConfig.bodyPresentation
      .groundedFirstPersonForwardOffsetMeters;
  const eyeHeightMeters = metaverseRuntimeConfig.groundedBody.eyeHeightMeters;
  const position = Object.freeze({
    x:
      cameraSnapshot.position.x -
      Math.sin(cameraSnapshot.yawRadians) * forwardOffsetMeters,
    y: cameraSnapshot.position.y - eyeHeightMeters,
    z:
      cameraSnapshot.position.z +
      Math.cos(cameraSnapshot.yawRadians) * forwardOffsetMeters
  });
  const previousSample = capturedSamples[capturedSamples.length - 1] ?? null;
  const deltaSeconds =
    previousSample === null
      ? 1 / 60
      : Math.max(1 / 120, (wallClockMs - previousSample.wallClockMs) / 1000);
  const linearVelocity = Object.freeze({
    x:
      previousSample === null
        ? 0
        : (position.x - previousSample.groundedBody.position.x) / deltaSeconds,
    y:
      previousSample === null
        ? 0
        : (position.y - previousSample.groundedBody.position.y) / deltaSeconds,
    z:
      previousSample === null
        ? 0
        : (position.z - previousSample.groundedBody.position.z) / deltaSeconds
  });

  return Object.freeze({
    groundedBody: Object.freeze({
      contact: groundedBody.contact,
      driveTarget: groundedBody.driveTarget,
      interaction: groundedBody.interaction,
      jumpBody: groundedBody.jumpBody,
      linearVelocity,
      position,
      yawRadians: cameraSnapshot.yawRadians
    }),
    sequence:
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.sequence ??
      0,
    lookYawRadians: cameraSnapshot.yawRadians,
    sequence:
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot
        ?.sequence ?? 0,
    wallClockMs
  });
}

function assertQuaternionArraysEquivalent(actual, expected, tolerance, message) {
  assert.equal(actual.length, expected.length, `${message} length mismatch.`);

  let maxDirectDelta = 0;
  let maxNegatedDelta = 0;

  for (let index = 0; index < actual.length; index += 1) {
    maxDirectDelta = Math.max(maxDirectDelta, Math.abs(actual[index] - expected[index]));
    maxNegatedDelta = Math.max(maxNegatedDelta, Math.abs(actual[index] + expected[index]));
  }

  assert.ok(
    Math.min(maxDirectDelta, maxNegatedDelta) <= tolerance,
    `${message}: expected ${expected.join(",")}, received ${actual.join(",")}.`
  );
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("WebGpuMetaverseRuntime boots metaverse presence without moving traversal policy out of the runtime owner", async () => {
  const [{ WebGpuMetaverseRuntime }, { RapierPhysicsRuntime }] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const renderer = new FakeMetaverseRenderer();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const originalWindow = globalThis.window;
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);

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
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const fakeWorldClient = new FakeMetaverseWorldClient();
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createMetaversePresenceClient: () => fakePresenceClient,
      createMetaverseWorldClient: () => fakeWorldClient,
      createRenderer: () => renderer,
      localPlayerIdentity: {
        characterId: "mesh2motion-humanoid-v1",
        playerId: localPlayerId,
        username
      },
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(fakePresenceClient.ensureJoinedRequests.length, 1);
    assert.ok(fakeWorldClient.playerLookIntentRequests.length >= 1);
    assert.ok(fakeWorldClient.playerTraversalIntentRequests.length >= 1);
    assert.equal(runtime.hudSnapshot.presence.state, "connected");
    assert.equal(runtime.hudSnapshot.presence.remotePlayerCount, 1);
    assert.equal(
      fakeWorldClient.playerLookIntentRequests.at(-1),
      null
    );
    assert.equal(
      fakeWorldClient.playerTraversalIntentRequests.at(-1)?.playerId,
      localPlayerId
    );
    assert.equal(
      fakeWorldClient.playerTraversalIntentRequests.at(-1)?.intent
        .locomotionMode,
      runtime.hudSnapshot.locomotionMode
    );

    runtime.dispose();

    assert.equal(fakePresenceClient.disposeCalls, 1);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("WebGpuMetaverseRuntime starts authoritative world polling after local presence joins", async () => {
  const [{ WebGpuMetaverseRuntime }, { RapierPhysicsRuntime }] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

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
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const fakeWorldClient = new FakeMetaverseWorldClient();
    fakeWorldClient.worldSnapshotBuffer = Object.freeze([
      createRealtimeWorldSnapshot({
        currentTick: 10,
        localPlayerId,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 8,
        remoteUsername,
        serverTimeMs: Date.now(),
        snapshotSequence: 1,
        vehicleX: 8
      })
    ]);
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame:
        globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createMetaversePresenceClient: () => fakePresenceClient,
      createMetaverseWorldClient: () => fakeWorldClient,
      createRenderer: () => renderer,
      localPlayerIdentity: {
        characterId: "mesh2motion-humanoid-v1",
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

    assert.deepEqual(fakeWorldClient.ensureConnectedRequests, [localPlayerId]);

    runtime.dispose();

    assert.equal(fakeWorldClient.disposeCalls, 1);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("WebGpuMetaverseRuntime waits for authoritative world snapshots before rendering remote metaverse characters", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { characterProofConfig, createSceneAssetLoader, environmentProofConfig } =
    await createSkiffMountProofSlice();
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowHarness = createInteractiveWindowHarness();
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_000;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const fakeWorldClient = new FakeMetaverseWorldClient();
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      runtimeCameraPhaseConfig: disabledRuntimeCameraPhaseConfig,
      cancelAnimationFrame:
        globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      characterProofConfig,
      createMetaversePresenceClient: () => fakePresenceClient,
      createMetaverseWorldClient: () => fakeWorldClient,
      createRenderer: () => renderer,
      createSceneAssetLoader,
      environmentProofConfig,
      localPlayerIdentity: {
        characterId: "mesh2motion-humanoid-v1",
        playerId: localPlayerId,
        username
      },
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      readNowMs: () => nowMs,
      readWallClockMs: () => wallClockMs,
      requestAnimationFrame:
        globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(runtime.hudSnapshot.presence.remotePlayerCount, 1);
    assert.equal(
      renderer.lastScene?.getObjectByName(
        `metaverse_character/mesh2motion-humanoid-v1/${remotePlayerId}`
      ),
      undefined
    );

    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 10,
        localPlayerId,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 8,
        remoteUsername,
        serverTimeMs: 1_000,
        snapshotSequence: 1,
        vehicleX: 8
      })
    ]);
    wallClockMs = 1_050;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.ok(
      renderer.lastScene?.getObjectByName(
        `metaverse_character/mesh2motion-humanoid-v1/${remotePlayerId}`
      )
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime resolves grounded surface travel automatically when solid support is present", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { metaverseRuntimeConfig },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createStaticSurfaceProofSlice(clientLoader);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
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
    const runtime = new WebGpuMetaverseRuntime(
      {
        ...metaverseRuntimeConfig,
        camera: {
          ...metaverseRuntimeConfig.camera,
          initialYawRadians: 0,
          spawnPosition: {
            x: -8.2,
            y: 1.62,
            z: -14.8
          }
        },
        groundedBody: {
          ...metaverseRuntimeConfig.groundedBody,
          spawnPosition: {
            x: -8.2,
            y: 0.15,
            z: -14.8
          }
        },
        portals: []
      },
      {
        cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
        createRenderer: () => renderer,
        createSceneAssetLoader,
        environmentProofConfig,
        physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
        requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
      }
    );
    const startSnapshot = await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(startSnapshot.locomotionMode, "grounded");
    assert.ok(runtime.hudSnapshot.camera.position.y > 1.62);
    assert.ok(Math.abs(runtime.hudSnapshot.camera.position.x + 8.2) < 0.000001);
    assert.equal(
      runtime.hudSnapshot.camera.position.z,
      -14.8 -
        metaverseRuntimeConfig.bodyPresentation.groundedFirstPersonForwardOffsetMeters
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
        .groundedBody?.jumpBody.grounded,
      true
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
        .groundedBody?.jumpBody.jumpReady,
      true
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});

test("WebGpuMetaverseRuntime starts in swim locomotion over open water and advances waterborne movement", async () => {
  const [{ WebGpuMetaverseRuntime }, { metaverseRuntimeConfig }, { RapierPhysicsRuntime }] =
    await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowHarness = createInteractiveWindowHarness();
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  let nowMs = 0;

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const runtime = new WebGpuMetaverseRuntime(
      createOpenWaterSpawnRuntimeConfig(metaverseRuntimeConfig),
      {
      runtimeCameraPhaseConfig: disabledRuntimeCameraPhaseConfig,
      cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createRenderer: () => renderer,
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      readNowMs: () => nowMs,
      requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
      }
    );

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(runtime.hudSnapshot.locomotionMode, "swim");
    assert.ok(Math.abs(runtime.hudSnapshot.camera.position.y - 1.9) < 0.001);

    const startingYaw = runtime.hudSnapshot.camera.yawRadians;

    windowHarness.dispatch("mousemove", {
      movementX: 240,
      movementY: 0
    });
    nowMs = 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.ok(runtime.hudSnapshot.camera.yawRadians > startingYaw);

    const startingPosition = runtime.hudSnapshot.camera.position;

    windowHarness.dispatch("keydown", {
      code: "KeyD"
    });
    nowMs = 2000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.ok(
      Math.hypot(
        runtime.hudSnapshot.camera.position.x - startingPosition.x,
        runtime.hudSnapshot.camera.position.z - startingPosition.z
      ) > 0.001
    );
    assert.ok(Math.abs(runtime.hudSnapshot.camera.position.y - 1.9) < 0.001);
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedOffset.planarMagnitudeMeters,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedOffset.verticalMagnitudeMeters,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedOffset.lookAngleRadians,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedSnap.totalCount,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedSnap.maxPlanarMagnitudeMetersPast5Seconds,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedSnap.maxVerticalMagnitudeMetersPast5Seconds,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedSnap.maxLookAngleRadiansPast5Seconds,
      0
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime stamps and syncs a grounded jump intent before local traversal advances it", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { metaverseRuntimeConfig },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createStaticSurfaceProofSlice(clientLoader);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowHarness = createInteractiveWindowHarness();
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const fakeWorldClient = new FakeMetaverseWorldClient();
    const runtime = new WebGpuMetaverseRuntime(
      {
        ...metaverseRuntimeConfig,
        camera: {
          ...metaverseRuntimeConfig.camera,
          initialYawRadians: 0,
          spawnPosition: {
            x: -8.2,
            y: 1.62,
            z: -14.8
          }
        },
        groundedBody: {
          ...metaverseRuntimeConfig.groundedBody,
          spawnPosition: {
            x: -8.2,
            y: 0.15,
            z: -14.8
          }
        },
        portals: []
      },
      {
        authoritativePlayerMovementEnabled: true,
        runtimeCameraPhaseConfig: disabledRuntimeCameraPhaseConfig,
        cancelAnimationFrame:
          globalThis.window.cancelAnimationFrame.bind(globalThis.window),
        createMetaversePresenceClient: () => fakePresenceClient,
        createMetaverseWorldClient: () => fakeWorldClient,
        createRenderer: () => renderer,
        createSceneAssetLoader,
        environmentProofConfig,
        localPlayerIdentity: {
          characterId: "mesh2motion-humanoid-v1",
          playerId: localPlayerId,
          username
        },
        physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
        readNowMs: () => nowMs,
        requestAnimationFrame:
          globalThis.window.requestAnimationFrame.bind(globalThis.window)
      }
    );

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(runtime.hudSnapshot.locomotionMode, "grounded");

    windowHarness.dispatch("keydown", {
      code: "Space"
    });
    nowMs = 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent.kind ===
        "jump",
      true
    );
    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent
        .sequence ?? 0,
      1
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
        .traversalAuthority.currentActionKind,
      "jump"
    );

    windowHarness.dispatch("keyup", {
      code: "Space"
    });
    nowMs = 2000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent.kind ===
        "jump",
      true
    );
    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent.pressed,
      false
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
        .traversalAuthority.currentActionKind,
      "jump"
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
        .traversalAuthority.currentActionSequence,
      1
    );

    nowMs = 3000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent.kind ===
        "jump",
      true
    );
    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent.pressed,
      false
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime keeps swim jump input off the authoritative traversal lane while local swim authority stays idle", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { metaverseRuntimeConfig },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowHarness = createInteractiveWindowHarness();
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const fakeWorldClient = new FakeMetaverseWorldClient();
    const runtime = new WebGpuMetaverseRuntime(
      createOpenWaterSpawnRuntimeConfig(metaverseRuntimeConfig),
      {
        authoritativePlayerMovementEnabled: true,
        runtimeCameraPhaseConfig: disabledRuntimeCameraPhaseConfig,
        cancelAnimationFrame:
          globalThis.window.cancelAnimationFrame.bind(globalThis.window),
        createMetaversePresenceClient: () => fakePresenceClient,
        createMetaverseWorldClient: () => fakeWorldClient,
        createRenderer: () => renderer,
        localPlayerIdentity: {
          characterId: "mesh2motion-humanoid-v1",
          playerId: localPlayerId,
          username
        },
        physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
        readNowMs: () => nowMs,
        requestAnimationFrame:
          globalThis.window.requestAnimationFrame.bind(globalThis.window)
      },
    );

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(runtime.hudSnapshot.locomotionMode, "swim");

    windowHarness.dispatch("keydown", {
      code: "Space"
    });
    nowMs = 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent.kind ===
        "jump",
      false
    );
    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent
        .sequence ?? 0,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
        .traversalAuthority.currentActionKind,
      "none"
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime keeps the held-weapon render camera traversal-owned while reconciliation stays quiet", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { metaverseRuntimeConfig },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const {
    attachmentProofConfig,
    characterProofConfig,
    createSceneAssetLoader,
    environmentProofConfig
  } = await createHeldWeaponProofSlice();
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowHarness = createInteractiveWindowHarness();
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  const localPlayerId = createMetaversePlayerId("held-weapon-local-player");
  const remotePlayerId = createMetaversePlayerId("held-weapon-remote-player");
  const username = createUsername("Held Weapon Local");
  let nowMs = 0;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const fakeWorldClient = new FakeMetaverseWorldClient();
    const runtime = new WebGpuMetaverseRuntime(
      {
        ...metaverseRuntimeConfig,
        portals: []
      },
      {
        attachmentProofConfig,
        runtimeCameraPhaseConfig: disabledRuntimeCameraPhaseConfig,
        cancelAnimationFrame:
          globalThis.window.cancelAnimationFrame.bind(globalThis.window),
        characterProofConfig,
        createMetaversePresenceClient: () => fakePresenceClient,
        createMetaverseWorldClient: () => fakeWorldClient,
        createRenderer: () => renderer,
        createSceneAssetLoader,
        environmentProofConfig,
        localPlayerIdentity: {
          characterId: characterProofConfig.characterId,
          playerId: localPlayerId,
          username
        },
        physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
        readNowMs: () => nowMs,
        requestAnimationFrame:
          globalThis.window.requestAnimationFrame.bind(globalThis.window)
      }
    );

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedOffset.planarMagnitudeMeters,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedOffset.verticalMagnitudeMeters,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedOffset.lookAngleRadians,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .recentCorrectionCountPast5Seconds,
      0
    );

    windowHarness.dispatch("mousemove", {
      movementX: 240,
      movementY: 0
    });
    nowMs = 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    nowMs = 2000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedOffset.planarMagnitudeMeters,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedOffset.verticalMagnitudeMeters,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedOffset.lookAngleRadians,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedSnap.totalCount,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.cameraPresentation
        .renderedSnap.recentCountPast5Seconds,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .recentCorrectionCountPast5Seconds,
      0
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime routes an authored dock entry into sustained swim in the shared water bay", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { metaverseRuntimeConfig },
    { RapierPhysicsRuntime },
    { metaverseEnvironmentProofConfig },
    createSceneAssetLoader
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts"),
    clientLoader.load("/src/metaverse/world/proof/index.ts"),
    createEmptySceneAssetLoader()
  ]);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowHarness = createInteractiveWindowHarness();
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  const dockEdgeEntryPosition = Object.freeze({
    x: authoredWaterBayDockEntryPosition.x + 3.5,
    y: authoredWaterBayDockEntryPosition.y,
    z: authoredWaterBayDockEntryPosition.z
  });
  const dockEntryRuntimeConfig = {
    ...metaverseRuntimeConfig,
    camera: {
      ...metaverseRuntimeConfig.camera,
      initialYawRadians: authoredWaterBayDockEntryYawRadians,
      spawnPosition: {
        x: dockEdgeEntryPosition.x - 0.24,
        y:
          dockEdgeEntryPosition.y +
          metaverseRuntimeConfig.groundedBody.eyeHeightMeters,
        z: dockEdgeEntryPosition.z
      }
    },
    groundedBody: {
      ...metaverseRuntimeConfig.groundedBody,
      spawnPosition: dockEdgeEntryPosition
    }
  };
  let nowMs = 0;

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const runtime = new WebGpuMetaverseRuntime(dockEntryRuntimeConfig, {
      runtimeCameraPhaseConfig: disabledRuntimeCameraPhaseConfig,
      cancelAnimationFrame:
        globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createRenderer: () => renderer,
      createSceneAssetLoader,
      environmentProofConfig: metaverseEnvironmentProofConfig,
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      readNowMs: () => nowMs,
      requestAnimationFrame:
        globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(runtime.hudSnapshot.locomotionMode, "grounded");
    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });

    let waterEntryFrame = null;

    for (let frame = 0; frame < 300; frame += 1) {
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);

      if (runtime.hudSnapshot.locomotionMode === "swim") {
        waterEntryFrame = frame + 1;
        break;
      }
    }

    assert.notEqual(waterEntryFrame, null);
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.decisionReason,
      "capability-transition-validated"
    );

    const swimStartX = runtime.hudSnapshot.camera.position.x;

    for (let frame = 0; frame < 24; frame += 1) {
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
      assert.equal(runtime.hudSnapshot.locomotionMode, "swim");
    }

    assert.ok(runtime.hudSnapshot.camera.position.x > swimStartX + 0.6);

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime derives authoritative surface-routing telemetry from the latest local-player snapshot", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { metaverseRuntimeConfig },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { characterProofConfig, createSceneAssetLoader, environmentProofConfig } =
    await createSkiffMountProofSlice();
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowHarness = createInteractiveWindowHarness();
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const fakeWorldClient = new FakeMetaverseWorldClient([
      createRealtimeWorldSnapshot({
        currentTick: 11,
        includeRemotePlayer: false,
        includeVehicle: false,
        localAnimationVocabulary: "swim",
        localJumpDebug: {
          pendingActionSequence: 7,
          pendingActionBufferAgeMs: 84,
          resolvedActionSequence: 6,
          resolvedActionState: "rejected-buffer-expired"
        },
        localJumpAuthorityState: "none",
        localLastAcceptedJumpActionSequence: 0,
        localLastProcessedTraversalSequence: 0,
        localLastProcessedJumpActionSequence: 0,
        localLinearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        localLocomotionMode: "swim",
        localPlayerId,
        localPlayerX: metaverseRuntimeConfig.groundedBody.spawnPosition.x,
        localPlayerY: 0,
        localPlayerZ: metaverseRuntimeConfig.groundedBody.spawnPosition.z,
        localUsername: username,
        localYawRadians: metaverseRuntimeConfig.camera.initialYawRadians,
        remotePlayerId,
        remotePlayerX: 10,
        remoteUsername,
        serverTimeMs: wallClockMs,
        snapshotSequence: 1,
        vehicleX: 10
      })
    ]);
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      authoritativePlayerMovementEnabled: true,
      runtimeCameraPhaseConfig: disabledRuntimeCameraPhaseConfig,
      cancelAnimationFrame:
        globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      characterProofConfig,
      createMetaversePresenceClient: () => fakePresenceClient,
      createMetaverseWorldClient: () => fakeWorldClient,
      createRenderer: () => renderer,
      createSceneAssetLoader,
      environmentProofConfig,
      localPlayerIdentity: {
        characterId: "mesh2motion-humanoid-v1",
        playerId: localPlayerId,
        username
      },
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      readNowMs: () => nowMs,
      readWallClockMs: () => wallClockMs,
      requestAnimationFrame:
        globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .locomotionMode,
      "swim"
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .surfaceRouting.decisionReason,
      "capability-maintained"
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .surfaceRouting.blockingAffordanceDetected,
      false
    );
    assert.notEqual(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .surfaceRouting.resolvedSupportHeightMeters,
      null
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .surfaceRouting.supportingAffordanceSampleCount,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting
        .authoritativeLocalPlayer.groundedBody,
      null
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .jumpDebug.pendingActionSequence,
      null
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .jumpDebug.pendingActionBufferAgeMs,
      null
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .jumpDebug.resolvedActionSequence,
      null
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .jumpDebug.resolvedActionState,
      null
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .traversalAuthority.currentActionKind,
      "none"
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .traversalAuthority.currentActionPhase,
      "idle"
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .traversalAuthority.lastRejectedActionReason,
      "buffer-expired"
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime routes mounted hub input through skiff locomotion and camera yaw", async () => {
  const localPlayerId = createMetaversePlayerId("mounted-entry-pilot-1");
  const remotePlayerId = createMetaversePlayerId("mounted-entry-remote-2");
  const username = createUsername("Mounted Entry Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;
  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 1,
      localLocomotionMode: "mounted",
      localMountedOccupancy: Object.freeze({
        environmentAssetId: "metaverse-hub-skiff-v1",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "driver",
        seatId: "driver-seat"
      }),
      localPlayerId,
      localUsername: username,
      remotePlayerId,
      remotePlayerX: 8,
      remoteUsername,
      serverTimeMs: 1_000,
      snapshotSequence: 1,
      vehicleSeatOccupantPlayerId: localPlayerId,
      vehicleX: authoredWaterBayOpenWaterSpawn.x
    })
  ]);
  const harness = await createStartedClientMetaverseRuntimeHarness({
    buildRuntimeConfig: createSkiffBoardingRuntimeConfig,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    for (let frame = 0; frame < 5; frame += 1) {
      nowMs += 1000 / 60;
      wallClockMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

    assert.equal(
      runtime.hudSnapshot.mountedInteraction.mountedEnvironment?.environmentAssetId,
      "metaverse-hub-skiff-v1"
    );
    assert.equal(
      runtime.hudSnapshot.mountedInteraction.mountedEnvironment?.occupancyKind,
      "seat"
    );
    assert.equal(
      runtime.hudSnapshot.mountedInteraction.mountedEnvironment?.seatId,
      "driver-seat"
    );
    assert.equal(runtime.hudSnapshot.locomotionMode, "mounted");

    const mountedCamera = runtime.hudSnapshot.camera;

    windowHarness.dispatch("mousemove", {
      movementX: 120
    });
    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    nowMs += 1000 / 60;
    wallClockMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.ok(
      Math.abs(runtime.hudSnapshot.camera.yawRadians - mountedCamera.yawRadians) >
        0.01
    );
    assert.equal(
      runtime.hudSnapshot.mountedInteraction.mountedEnvironment?.occupancyKind,
      "seat"
    );
    assert.equal(
      runtime.hudSnapshot.mountedInteraction.mountedEnvironment?.seatId,
      "driver-seat"
    );
    assert.equal(runtime.hudSnapshot.locomotionMode, "mounted");

    const mountedDriverCamera = runtime.hudSnapshot.camera;

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    nowMs += 1000 / 60;
    wallClockMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.ok(
      Math.hypot(
        runtime.hudSnapshot.camera.position.x - mountedDriverCamera.position.x,
        runtime.hudSnapshot.camera.position.z - mountedDriverCamera.position.z
      ) > 0.001
    );

    runtime.leaveMountedEnvironment();

    assert.equal(runtime.hudSnapshot.mountedInteraction.mountedEnvironment, null);
    assert.equal(runtime.hudSnapshot.locomotionMode, "swim");

  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime publishes reliable mounted occupancy changes and routed driver vehicle control through the authoritative world client seam", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 1,
      localLocomotionMode: "mounted",
      localMountedOccupancy: Object.freeze({
        environmentAssetId: "metaverse-hub-skiff-v1",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "driver",
        seatId: "driver-seat"
      }),
      localPlayerId,
      localUsername: username,
      remotePlayerId,
      remotePlayerX: 8,
      remoteUsername: createUsername("Remote Sailor"),
      serverTimeMs: 1_000,
      snapshotSequence: 1,
      vehicleSeatOccupantPlayerId: localPlayerId,
      vehicleX: authoredWaterBayOpenWaterSpawn.x
    })
  ]);
  const harness = await createStartedClientMetaverseRuntimeHarness({
    buildRuntimeConfig: createSkiffBoardingRuntimeConfig,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    for (let frame = 0; frame < 5; frame += 1) {
      nowMs += 1000 / 60;
      wallClockMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

    assert.equal(
      runtime.hudSnapshot.mountedInteraction.mountedEnvironment?.seatId,
      "driver-seat"
    );

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(fakeWorldClient.driverVehicleControlRequests.length > 0, true);
    assert.equal(
      fakeWorldClient.playerTraversalIntentRequests.length > 0,
      true
    );
    assert.equal(
      fakeWorldClient.driverVehicleControlRequests.at(-1)?.playerId,
      localPlayerId
    );
    assert.equal(
      fakeWorldClient.driverVehicleControlRequests.at(-1)?.controlIntent
        .environmentAssetId,
      "metaverse-hub-skiff-v1"
    );
    assert.equal(
      fakeWorldClient.driverVehicleControlRequests.at(-1)?.controlIntent.moveAxis,
      1
    );
    assert.equal(fakeWorldClient.playerLookIntentRequests.length > 0, true);
    assert.equal(
      fakeWorldClient.playerLookIntentRequests.at(-1)?.playerId,
      localPlayerId
    );
    assert.equal(fakeWorldClient.playerTraversalIntentRequests.at(-1), null);

    runtime.leaveMountedEnvironment();

    assert.equal(fakeWorldClient.mountedOccupancyRequests.length > 0, true);
    assert.equal(
      fakeWorldClient.mountedOccupancyRequests.at(-1)?.mountedOccupancy,
      null
    );

  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime converges acked pose-only traversal drift without hard camera jumps", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    const localPoseInputSequence = fakeWorldClient.latestPlayerTraversalSequence;
    const localWeaponSequence = fakeWorldClient.latestPlayerWeaponSequence;
    const capturedGroundedSamples = [];

    assert.ok(localPoseInputSequence > 0);
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.issuedTraversalIntent
        ?.sequence,
      localPoseInputSequence
    );

    const bootstrapAuthoritativeSample = captureCurrentGroundedBodySample({
      capturedSamples: capturedGroundedSamples,
      fakeWorldClient,
      metaverseRuntimeConfig,
      runtime,
      wallClockMs
    });

    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 10,
        includeRemotePlayer: false,
        includeVehicle: false,
        localGroundedBody: bootstrapAuthoritativeSample.groundedBody,
        localLastProcessedTraversalSequence: bootstrapAuthoritativeSample.sequence,
        localLastProcessedTraversalSequence:
          bootstrapAuthoritativeSample.sequence,
        localLastProcessedWeaponSequence: localWeaponSequence,
        localLookYawRadians: bootstrapAuthoritativeSample.lookYawRadians,
        localPlayerId,
        localPlayerX: bootstrapAuthoritativeSample.groundedBody.position.x,
        localPlayerY: bootstrapAuthoritativeSample.groundedBody.position.y,
        localPlayerZ: bootstrapAuthoritativeSample.groundedBody.position.z,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 10,
        remoteUsername,
        serverTimeMs: 1_050,
        snapshotSequence: 1,
        vehicleX: 10
      })
    ]);

    wallClockMs = 1_120;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);
    const baselineCorrectionCount =
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount;
    const baselineAuthoritativeSample = captureCurrentGroundedBodySample({
      capturedSamples: capturedGroundedSamples,
      fakeWorldClient,
      metaverseRuntimeConfig,
      runtime,
      wallClockMs
    });
    const localCameraXBeforeCorrection = runtime.hudSnapshot.camera.position.x;

    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 11,
        includeRemotePlayer: false,
        includeVehicle: false,
        localGroundedBody: {
          ...baselineAuthoritativeSample.groundedBody,
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 3,
            y: baselineAuthoritativeSample.groundedBody.position.y,
            z: baselineAuthoritativeSample.groundedBody.position.z
          }
        },
        localLastProcessedTraversalSequence: baselineAuthoritativeSample.sequence,
        localLastProcessedTraversalSequence:
          baselineAuthoritativeSample.sequence,
        localLastProcessedWeaponSequence: localWeaponSequence,
        localLookYawRadians: baselineAuthoritativeSample.lookYawRadians,
        localLinearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        localPlayerId,
        localPlayerX: 3,
        localPlayerY: baselineAuthoritativeSample.groundedBody.position.y,
        localPlayerZ: baselineAuthoritativeSample.groundedBody.position.z,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 10,
        remoteUsername,
        serverTimeMs: 1_140,
        snapshotSequence: 2,
        vehicleX: 10
      })
    ]);

    wallClockMs = 1_170;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);
    wallClockMs = 1_190;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      baselineCorrectionCount + 1
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .lastCorrectionSource,
      "local-authority-convergence-step"
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .lastLocalAuthorityPoseCorrectionReason,
      "gross-position-divergence"
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .lastProcessedTraversalSequence,
      localPoseInputSequence
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeCorrection
        .applied,
      true
    );
    assert.ok(
      (runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeCorrection
        .planarMagnitudeMeters ?? 0) > 1.5
    );
    assert.ok(
      Math.abs(runtime.hudSnapshot.camera.position.x - localCameraXBeforeCorrection) <
        1
    );

  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime rearms the spawn-labeled authority snap when respawn wait resolves mid-session", async () => {
  const localPlayerId = createMetaversePlayerId("respawn-pilot-1");
  const remotePlayerId = createMetaversePlayerId("respawn-remote-2");
  const username = createUsername("Respawn Pilot");
  const remoteUsername = createUsername("Respawn Remote");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: () => createStaticSurfaceProofSlice(clientLoader),
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    const localPoseInputSequence = fakeWorldClient.latestPlayerTraversalSequence;
    const localWeaponSequence = fakeWorldClient.latestPlayerWeaponSequence;
    const localGroundedBodyTelemetry =
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.groundedBody;
    const localBodyY =
      runtime.hudSnapshot.camera.position.y -
      metaverseRuntimeConfig.groundedBody.eyeHeightMeters;

    assert.ok(localPoseInputSequence > 0);
    assert.notEqual(localGroundedBodyTelemetry, null);

    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 10,
        includeRemotePlayer: false,
        includeVehicle: false,
        localLastProcessedTraversalSequence: localPoseInputSequence,
        localLastProcessedTraversalSequence:
          fakeWorldClient.latestPlayerTraversalSequence,
        localLastProcessedWeaponSequence: localWeaponSequence,
        localLinearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        localGroundedBody: {
          contact: localGroundedBodyTelemetry.contact,
          driveTarget: localGroundedBodyTelemetry.driveTarget,
          interaction: localGroundedBodyTelemetry.interaction,
          jumpBody: localGroundedBodyTelemetry.jumpBody,
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: metaverseRuntimeConfig.groundedBody.spawnPosition.x,
            y: localBodyY,
            z: metaverseRuntimeConfig.groundedBody.spawnPosition.z
          },
          yawRadians: runtime.hudSnapshot.camera.yawRadians
        },
        localPlayerId,
        localPlayerX: metaverseRuntimeConfig.groundedBody.spawnPosition.x,
        localPlayerY: localBodyY,
        localPlayerZ: metaverseRuntimeConfig.groundedBody.spawnPosition.z,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 10,
        remoteUsername,
        serverTimeMs: 1_140,
        snapshotSequence: 1,
        vehicleX: 10
      })
    ]);

    wallClockMs = 1_160;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      1
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .lastLocalAuthorityPoseCorrectionDetail
        .convergenceEpisodeStartIntentionalDiscontinuityCause,
      "spawn"
    );

    runtime.setRespawnControlLocked(true);
    runtime.setRespawnControlLocked(false);

    const respawnPosition = {
      x: 8,
      y: localBodyY,
      z: 18
    };
    const respawnInputSequence = fakeWorldClient.latestPlayerTraversalSequence;
    const respawnOrientationSequence =
      fakeWorldClient.latestPlayerTraversalSequence;
    const respawnWeaponSequence = fakeWorldClient.latestPlayerWeaponSequence;
    const respawnGroundedBodyTelemetry =
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.groundedBody;

    assert.notEqual(respawnGroundedBodyTelemetry, null);

    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 11,
        includeRemotePlayer: false,
        includeVehicle: false,
        localLastProcessedTraversalSequence: respawnInputSequence,
        localLastProcessedTraversalSequence:
          respawnOrientationSequence,
        localLastProcessedWeaponSequence: respawnWeaponSequence,
        localLinearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        localGroundedBody: {
          contact: respawnGroundedBodyTelemetry.contact,
          driveTarget: respawnGroundedBodyTelemetry.driveTarget,
          interaction: respawnGroundedBodyTelemetry.interaction,
          jumpBody: respawnGroundedBodyTelemetry.jumpBody,
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: respawnPosition,
          yawRadians: runtime.hudSnapshot.camera.yawRadians
        },
        localPlayerId,
        localPlayerX: respawnPosition.x,
        localPlayerY: respawnPosition.y,
        localPlayerZ: respawnPosition.z,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 10,
        remoteUsername,
        serverTimeMs: 1_220,
        snapshotSequence: 2,
        vehicleX: 10
      })
    ]);

    wallClockMs = 1_240;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      2
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .lastLocalAuthorityPoseCorrectionDetail
        .convergenceEpisodeStartIntentionalDiscontinuityCause,
      "spawn"
    );
    assert.ok(
      Math.abs(runtime.hudSnapshot.camera.position.x - respawnPosition.x) < 0.3,
      `expected respawn snap to move directly onto the new authoritative spawn, received ${JSON.stringify(runtime.hudSnapshot.camera)}`
    );
  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime keeps neutral authoritative local updates correction-free", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    const localPoseInputSequence = fakeWorldClient.latestPlayerTraversalSequence;
    const localWeaponSequence = fakeWorldClient.latestPlayerWeaponSequence;

    assert.ok(localPoseInputSequence > 0);
    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.bodyControl.moveAxis ??
        0,
      0
    );
    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.bodyControl
        .strafeAxis ?? 0,
      0
    );
    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent.kind ===
        "jump",
      false
    );

    const localLocomotionModeBeforeAuthority = runtime.hudSnapshot.locomotionMode;
    const localCameraXBeforeAuthority = runtime.hudSnapshot.camera.position.x;
    const localCameraYBeforeAuthority = runtime.hudSnapshot.camera.position.y;
    const localCameraZBeforeAuthority = runtime.hudSnapshot.camera.position.z;
    const localCameraYawBeforeAuthority = runtime.hudSnapshot.camera.yawRadians;
    const localForwardOffsetMeters =
      localLocomotionModeBeforeAuthority === "swim"
        ? -metaverseRuntimeConfig.bodyPresentation.swimThirdPersonFollowDistanceMeters
        : metaverseRuntimeConfig.bodyPresentation
            .groundedFirstPersonForwardOffsetMeters;
    const localEyeHeightMeters =
      localLocomotionModeBeforeAuthority === "swim"
        ? metaverseRuntimeConfig.swim.cameraEyeHeightMeters +
          metaverseRuntimeConfig.bodyPresentation
            .swimThirdPersonHeightOffsetMeters
        : metaverseRuntimeConfig.groundedBody.eyeHeightMeters;
    const localBodyXBeforeAuthority =
      localCameraXBeforeAuthority -
      Math.sin(localCameraYawBeforeAuthority) * localForwardOffsetMeters;
    const localBodyYBeforeAuthority =
      localCameraYBeforeAuthority - localEyeHeightMeters;
    const localBodyZBeforeAuthority =
      localCameraZBeforeAuthority +
      Math.cos(localCameraYawBeforeAuthority) * localForwardOffsetMeters;

    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 11,
        includeRemotePlayer: false,
        includeVehicle: false,
        localJumpAuthorityState:
          localLocomotionModeBeforeAuthority === "grounded" ? "grounded" : "none",
        localLastProcessedTraversalSequence: localPoseInputSequence,
        localLastProcessedWeaponSequence: localWeaponSequence,
        localLookYawRadians: localCameraYawBeforeAuthority,
        localLinearVelocity: {
          x: 70,
          y: 0,
          z: 0
        },
        localLocomotionMode: localLocomotionModeBeforeAuthority,
        localPlayerId,
        localPlayerX: localBodyXBeforeAuthority - 2.1,
        localPlayerY: localBodyYBeforeAuthority,
        localPlayerZ: localBodyZBeforeAuthority,
        localYawRadians: localCameraYawBeforeAuthority,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 10,
        remoteUsername,
        serverTimeMs: 1_140,
        snapshotSequence: 1,
        vehicleX: 10
      })
    ]);

    wallClockMs = 1_170;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.notEqual(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .lastCorrectionSource,
      "local-authority-convergence-episode"
    );

  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime keeps local traversal client-owned under routine acked authoritative drift", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    const localPoseInputSequence = fakeWorldClient.latestPlayerTraversalSequence;
    const localWeaponSequence = fakeWorldClient.latestPlayerWeaponSequence;

    assert.ok(localPoseInputSequence > 0);

    const localLocomotionModeBeforeAuthority = runtime.hudSnapshot.locomotionMode;
    const localCameraXBeforeAuthority = runtime.hudSnapshot.camera.position.x;
    const localCameraZBeforeAuthority = runtime.hudSnapshot.camera.position.z;
    const localCameraYawBeforeAuthority = runtime.hudSnapshot.camera.yawRadians;
    const localForwardOffsetMeters =
      localLocomotionModeBeforeAuthority === "swim"
        ? -metaverseRuntimeConfig.bodyPresentation.swimThirdPersonFollowDistanceMeters
        : metaverseRuntimeConfig.bodyPresentation
            .groundedFirstPersonForwardOffsetMeters;
    const localEyeHeightMeters =
      localLocomotionModeBeforeAuthority === "swim"
        ? metaverseRuntimeConfig.swim.cameraEyeHeightMeters +
          metaverseRuntimeConfig.bodyPresentation
            .swimThirdPersonHeightOffsetMeters
        : metaverseRuntimeConfig.groundedBody.eyeHeightMeters;
    const localBodyXBeforeAuthority =
      localCameraXBeforeAuthority -
      Math.sin(localCameraYawBeforeAuthority) * localForwardOffsetMeters;
    const localBodyYBeforeAuthority =
      runtime.hudSnapshot.camera.position.y - localEyeHeightMeters;
    const localBodyZBeforeAuthority =
      localCameraZBeforeAuthority +
      Math.cos(localCameraYawBeforeAuthority) * localForwardOffsetMeters;
    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 11,
        includeRemotePlayer: false,
        includeVehicle: false,
        localJumpAuthorityState:
          localLocomotionModeBeforeAuthority === "grounded"
            ? "grounded"
            : "none",
        localLastProcessedTraversalSequence: localPoseInputSequence,
        localLastProcessedWeaponSequence: localWeaponSequence,
        localLookYawRadians: localCameraYawBeforeAuthority,
        localLinearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        localLocomotionMode: localLocomotionModeBeforeAuthority,
        localPlayerId,
        localPlayerX: localBodyXBeforeAuthority + 1.8,
        localPlayerY: localBodyYBeforeAuthority,
        localPlayerZ: localBodyZBeforeAuthority,
        localYawRadians: localCameraYawBeforeAuthority,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 10,
        remoteUsername,
        serverTimeMs: 1_140,
        snapshotSequence: 1,
        vehicleX: 10
      })
    ]);

    wallClockMs = 1_170;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeCorrection
        .applied,
      false
    );
    assert.ok(
      Math.abs(runtime.hudSnapshot.camera.position.x - localCameraXBeforeAuthority) <
        0.05,
      `moderate acknowledged authority drift steered the local camera from ${localCameraXBeforeAuthority} to ${runtime.hudSnapshot.camera.position.x}`
    );

  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime does not run a full frame when authoritative world snapshots publish between browser frames", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    const renderedFrameCountBeforePublish =
      runtime.hudSnapshot.telemetry.renderedFrameCount;
    const traversalRequestCountBeforePublish =
      fakeWorldClient.playerTraversalIntentRequests.length;
    const localPoseInputSequence = fakeWorldClient.latestPlayerTraversalSequence;

    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 11,
        includeRemotePlayer: false,
        includeVehicle: false,
        localLastProcessedTraversalSequence: localPoseInputSequence,
        localPlayerId,
        localPlayerX: 3,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 10,
        remoteUsername,
        serverTimeMs: 1_140,
        snapshotSequence: 1,
        vehicleX: 10
      })
    ]);

    assert.equal(
      runtime.hudSnapshot.telemetry.renderedFrameCount,
      renderedFrameCountBeforePublish
    );
    assert.equal(
      fakeWorldClient.playerTraversalIntentRequests.length,
      traversalRequestCountBeforePublish
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer
        .lastProcessedTraversalSequence,
      localPoseInputSequence
    );

    wallClockMs = 1_170;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.renderedFrameCount,
      renderedFrameCountBeforePublish + 1
    );
    assert.ok(
      fakeWorldClient.playerTraversalIntentRequests.length >
        traversalRequestCountBeforePublish
    );

  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime keeps fully acknowledged held traversal intent correction-free", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    const latestTraversalIntent =
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

    assert.notEqual(latestTraversalIntent, null);
    assert.equal(latestTraversalIntent.bodyControl.moveAxis, 1);

    const localLocomotionModeBeforeAuthority = runtime.hudSnapshot.locomotionMode;
    const localCameraXBeforeAuthority = runtime.hudSnapshot.camera.position.x;
    const localCameraZBeforeAuthority = runtime.hudSnapshot.camera.position.z;
    const localCameraYawBeforeAuthority = runtime.hudSnapshot.camera.yawRadians;
    const localForwardOffsetMeters =
      localLocomotionModeBeforeAuthority === "swim"
        ? -metaverseRuntimeConfig.bodyPresentation.swimThirdPersonFollowDistanceMeters
        : metaverseRuntimeConfig.bodyPresentation
            .groundedFirstPersonForwardOffsetMeters;
    const localEyeHeightMeters =
      localLocomotionModeBeforeAuthority === "swim"
        ? metaverseRuntimeConfig.swim.cameraEyeHeightMeters +
          metaverseRuntimeConfig.bodyPresentation
            .swimThirdPersonHeightOffsetMeters
        : metaverseRuntimeConfig.groundedBody.eyeHeightMeters;
    const localBodyXBeforeAuthority =
      localCameraXBeforeAuthority -
      Math.sin(localCameraYawBeforeAuthority) * localForwardOffsetMeters;
    const localBodyYBeforeAuthority =
      runtime.hudSnapshot.camera.position.y - localEyeHeightMeters;
    const localBodyZBeforeAuthority =
      localCameraZBeforeAuthority +
      Math.cos(localCameraYawBeforeAuthority) * localForwardOffsetMeters;

    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 11,
        includeRemotePlayer: false,
        includeVehicle: false,
        localJumpAuthorityState:
          localLocomotionModeBeforeAuthority === "grounded"
            ? "grounded"
            : "none",
        localLastProcessedTraversalSequence: latestTraversalIntent.sequence,
        localLookYawRadians: localCameraYawBeforeAuthority,
        localLinearVelocity: {
          x: 0,
          y: 0,
          z: -6
        },
        localLocomotionMode: localLocomotionModeBeforeAuthority,
        localPlayerId,
        localPlayerX: localBodyXBeforeAuthority,
        localPlayerY: localBodyYBeforeAuthority,
        localPlayerZ: localBodyZBeforeAuthority + 0.42,
        localYawRadians: localCameraYawBeforeAuthority,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 10,
        remoteUsername,
        serverTimeMs: 1_140,
        snapshotSequence: 1,
        vehicleX: 10
      })
    ]);

    wallClockMs = 1_650;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      0
    );
    assert.notEqual(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .lastCorrectionSource,
      "local-authority-convergence-episode"
    );

  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime keeps sustained swim correction-free under delayed acknowledged authority", async () => {
  const localPlayerId = createMetaversePlayerId("swim-local-player");
  const remotePlayerId = createMetaversePlayerId("swim-remote-player");
  const username = createUsername("Swim Local");
  const remoteUsername = createUsername("Swim Remote");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    buildRuntimeConfig: createOpenWaterSpawnRuntimeConfig,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    assert.equal(runtime.hudSnapshot.locomotionMode, "swim");

    const capturedSamples = [];
    let snapshotSequence = 0;

    function captureCurrentSwimBodySample() {
      const cameraSnapshot = runtime.hudSnapshot.camera;
      const forwardOffsetMeters =
        -metaverseRuntimeConfig.bodyPresentation.swimThirdPersonFollowDistanceMeters;
      const eyeHeightMeters =
        metaverseRuntimeConfig.swim.cameraEyeHeightMeters +
        metaverseRuntimeConfig.bodyPresentation.swimThirdPersonHeightOffsetMeters;

      return Object.freeze({
        position: Object.freeze({
          x:
            cameraSnapshot.position.x -
            Math.sin(cameraSnapshot.yawRadians) * forwardOffsetMeters,
          y: cameraSnapshot.position.y - eyeHeightMeters,
          z:
            cameraSnapshot.position.z +
            Math.cos(cameraSnapshot.yawRadians) * forwardOffsetMeters
        }),
        wallClockMs,
        yawRadians: cameraSnapshot.yawRadians
      });
    }

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });

    for (let frame = 0; frame < 24; frame += 1) {
      if (frame === 4 || frame === 12 || frame === 20) {
        windowHarness.dispatch("keydown", {
          code: "Space"
        });
      }

      nowMs += 1000 / 60;
      wallClockMs = 1_100 + nowMs;
      windowHarness.advanceFrame(nowMs);

      const latestTraversalIntent =
        fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

      assert.notEqual(latestTraversalIntent, null);
      assert.equal(latestTraversalIntent.locomotionMode, "swim");
      assert.equal(latestTraversalIntent.bodyControl.moveAxis, 1);
      assert.equal(latestTraversalIntent.actionIntent.kind, "none");
      assert.equal(latestTraversalIntent.actionIntent.sequence, 0);

      const currentSample = captureCurrentSwimBodySample();
      const previousSample =
        capturedSamples[capturedSamples.length - 1] ?? currentSample;
      const deltaSeconds = Math.max(
        1 / 120,
        (currentSample.wallClockMs - previousSample.wallClockMs) / 1000
      );
      capturedSamples.push(
        Object.freeze({
          sequence: latestTraversalIntent.sequence,
          linearVelocity: Object.freeze({
            x:
              (currentSample.position.x - previousSample.position.x) / deltaSeconds,
            y:
              (currentSample.position.y - previousSample.position.y) / deltaSeconds,
            z:
              (currentSample.position.z - previousSample.position.z) / deltaSeconds
          }),
          position: currentSample.position,
          wallClockMs: currentSample.wallClockMs,
          yawRadians: currentSample.yawRadians
        })
      );

      const authoritativeSample =
        capturedSamples[Math.max(0, capturedSamples.length - 3)];

      fakeWorldClient.publishWorldSnapshotBuffer([
        createRealtimeWorldSnapshot({
          currentTick: 20 + frame,
          includeRemotePlayer: false,
          includeVehicle: false,
          localJumpAuthorityState: "none",
          localLastProcessedTraversalSequence: authoritativeSample.sequence,
          localLinearVelocity: authoritativeSample.linearVelocity,
          localLocomotionMode: "swim",
          localLookYawRadians: authoritativeSample.yawRadians,
          localPlayerId,
          localPlayerX: authoritativeSample.position.x,
          localPlayerY: authoritativeSample.position.y,
          localPlayerZ: authoritativeSample.position.z,
          localUsername: username,
          localYawRadians: authoritativeSample.yawRadians,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: authoritativeSample.wallClockMs,
          snapshotSequence: ++snapshotSequence,
          vehicleX: 10
        })
      ]);

      if (frame === 4 || frame === 12 || frame === 20) {
        windowHarness.dispatch("keyup", {
          code: "Space"
        });
      }
    }

    nowMs += 1000 / 60;
    wallClockMs = 1_100 + nowMs;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .recentCorrectionCountPast5Seconds,
      0
    );

  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime ignores acked authoritative local yaw drift while unmounted look stays client-owned", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    const localPoseInputSequence = fakeWorldClient.latestPlayerTraversalSequence;

    assert.ok(localPoseInputSequence > 0);

    const localLocomotionModeBeforeAuthority = runtime.hudSnapshot.locomotionMode;
    const localCameraXBeforeAuthority = runtime.hudSnapshot.camera.position.x;
    const localCameraYBeforeAuthority = runtime.hudSnapshot.camera.position.y;
    const localCameraZBeforeAuthority = runtime.hudSnapshot.camera.position.z;
    const localCameraYawBeforeAuthority = runtime.hudSnapshot.camera.yawRadians;
    const localForwardOffsetMeters =
      localLocomotionModeBeforeAuthority === "swim"
        ? -metaverseRuntimeConfig.bodyPresentation.swimThirdPersonFollowDistanceMeters
        : metaverseRuntimeConfig.bodyPresentation
            .groundedFirstPersonForwardOffsetMeters;
    const localEyeHeightMeters =
      localLocomotionModeBeforeAuthority === "swim"
        ? metaverseRuntimeConfig.swim.cameraEyeHeightMeters +
          metaverseRuntimeConfig.bodyPresentation
            .swimThirdPersonHeightOffsetMeters
        : metaverseRuntimeConfig.groundedBody.eyeHeightMeters;
    const localBodyXBeforeAuthority =
      localCameraXBeforeAuthority -
      Math.sin(localCameraYawBeforeAuthority) * localForwardOffsetMeters;
    const localBodyYBeforeAuthority =
      localCameraYBeforeAuthority - localEyeHeightMeters;
    const localBodyZBeforeAuthority =
      localCameraZBeforeAuthority +
      Math.cos(localCameraYawBeforeAuthority) * localForwardOffsetMeters;

    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 11,
        includeRemotePlayer: false,
        includeVehicle: false,
        localJumpAuthorityState:
          localLocomotionModeBeforeAuthority === "grounded"
            ? "grounded"
            : "none",
        localLastProcessedTraversalSequence: localPoseInputSequence,
        localLookYawRadians: localCameraYawBeforeAuthority - 0.85,
        localLinearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        localLocomotionMode: localLocomotionModeBeforeAuthority,
        localPlayerId,
        localPlayerX: localBodyXBeforeAuthority,
        localPlayerY: localBodyYBeforeAuthority,
        localPlayerZ: localBodyZBeforeAuthority,
        localYawRadians: localCameraYawBeforeAuthority - 0.85,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 10,
        remoteUsername,
        serverTimeMs: 1_140,
        snapshotSequence: 1,
        vehicleX: 10
      })
    ]);

    wallClockMs = 1_170;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeCorrection
        .applied,
      false
    );
    assert.ok(
      Math.abs(runtime.hudSnapshot.camera.yawRadians - localCameraYawBeforeAuthority) <
        0.000001
    );
    assert.ok(
      Math.abs(runtime.hudSnapshot.camera.position.x - localCameraXBeforeAuthority) <
        0.2
    );

  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime keeps grounded boost-strafe-turn authority aligned during delayed ack snapshots", async () => {
  const localPlayerId = createMetaversePlayerId("grounded-circle-runner-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Grounded Circle Runner");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    assert.equal(runtime.hudSnapshot.locomotionMode, "grounded");

    const capturedSamples = [];
    let snapshotSequence = 0;

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    windowHarness.dispatch("keydown", {
      code: "KeyD"
    });
    windowHarness.dispatch("keydown", {
      code: "ShiftLeft"
    });

    for (let frame = 0; frame < 24; frame += 1) {
      windowHarness.dispatch("mousemove", {
        movementX: 24,
        movementY: 0
      });
      nowMs += 1000 / 60;
      wallClockMs = 1_100 + nowMs;
      windowHarness.advanceFrame(nowMs);

      const latestTraversalIntent =
        fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

      assert.notEqual(latestTraversalIntent, null);
      assert.equal(latestTraversalIntent.locomotionMode, "grounded");
      assert.equal(latestTraversalIntent.bodyControl.boost, true);
      assert.equal(latestTraversalIntent.bodyControl.moveAxis, 1);
      assert.equal(latestTraversalIntent.bodyControl.strafeAxis, 1);
      assert.ok(latestTraversalIntent.sequence > 0);

      capturedSamples.push(
        captureCurrentGroundedBodySample({
          capturedSamples,
          fakeWorldClient,
          metaverseRuntimeConfig,
          runtime,
          wallClockMs
        })
      );

      const authoritativeSample =
        capturedSamples[Math.max(0, capturedSamples.length - 3)];

      fakeWorldClient.publishWorldSnapshotBuffer([
        createRealtimeWorldSnapshot({
          currentTick: 20 + frame,
          includeRemotePlayer: false,
          includeVehicle: false,
          localGroundedBody: authoritativeSample.groundedBody,
          localLastProcessedTraversalSequence: authoritativeSample.sequence,
          localLastProcessedTraversalSequence:
            authoritativeSample.sequence,
          localLinearVelocity: authoritativeSample.groundedBody.linearVelocity,
          localLookYawRadians: authoritativeSample.lookYawRadians,
          localPlayerId,
          localPlayerX: authoritativeSample.groundedBody.position.x,
          localPlayerY: authoritativeSample.groundedBody.position.y,
          localPlayerZ: authoritativeSample.groundedBody.position.z,
          localUsername: username,
          localYawRadians: authoritativeSample.groundedBody.yawRadians,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: authoritativeSample.wallClockMs,
          snapshotSequence: ++snapshotSequence,
          vehicleX: 10
        })
      ]);
    }

    windowHarness.dispatch("keyup", {
      code: "ShiftLeft"
    });
    windowHarness.dispatch("keyup", {
      code: "KeyD"
    });
    windowHarness.dispatch("keyup", {
      code: "KeyW"
    });

    nowMs += 1000 / 60;
    wallClockMs = 1_100 + nowMs;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .recentCorrectionCountPast5Seconds,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .lastCorrectionSource,
      "none"
    );
  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime keeps grounded diagonal travel correction-free across repeated ack buckets without turning", async () => {
  const localPlayerId = createMetaversePlayerId("grounded-diagonal-repeat-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Grounded Diagonal Repeat");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    assert.equal(runtime.hudSnapshot.locomotionMode, "grounded");

    const capturedSamples = [];
    let diagonalOrientationSequence = null;
    let snapshotSequence = 0;

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    windowHarness.dispatch("keydown", {
      code: "KeyD"
    });

    for (let frame = 0; frame < 36; frame += 1) {
      nowMs += 1000 / 60;
      wallClockMs = 1_100 + nowMs;
      windowHarness.advanceFrame(nowMs);

      const latestTraversalIntent =
        fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

      assert.notEqual(latestTraversalIntent, null);
      assert.equal(latestTraversalIntent.locomotionMode, "grounded");
      assert.equal(latestTraversalIntent.bodyControl.moveAxis, 1);
      assert.equal(latestTraversalIntent.bodyControl.strafeAxis, 1);
      diagonalOrientationSequence ??=
        latestTraversalIntent.sequence;
      assert.equal(
        latestTraversalIntent.sequence,
        diagonalOrientationSequence
      );

      capturedSamples.push(
        captureCurrentGroundedBodySample({
          capturedSamples,
          fakeWorldClient,
          metaverseRuntimeConfig,
          runtime,
          wallClockMs
        })
      );

      const authoritativeSample =
        capturedSamples[Math.max(0, capturedSamples.length - 3)];

      fakeWorldClient.publishWorldSnapshotBuffer([
        createRealtimeWorldSnapshot({
          currentTick: 200 + frame,
          includeRemotePlayer: false,
          includeVehicle: false,
          localGroundedBody: authoritativeSample.groundedBody,
          localLastProcessedTraversalSequence: authoritativeSample.sequence,
          localLastProcessedTraversalSequence:
            authoritativeSample.sequence,
          localLinearVelocity: authoritativeSample.groundedBody.linearVelocity,
          localLookYawRadians: authoritativeSample.lookYawRadians,
          localPlayerId,
          localPlayerX: authoritativeSample.groundedBody.position.x,
          localPlayerY: authoritativeSample.groundedBody.position.y,
          localPlayerZ: authoritativeSample.groundedBody.position.z,
          localUsername: username,
          localYawRadians: authoritativeSample.groundedBody.yawRadians,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: authoritativeSample.wallClockMs,
          snapshotSequence: ++snapshotSequence,
          vehicleX: 10
        })
      ]);
    }

    windowHarness.dispatch("keyup", {
      code: "KeyD"
    });
    windowHarness.dispatch("keyup", {
      code: "KeyW"
    });

    nowMs += 1000 / 60;
    wallClockMs = 1_100 + nowMs;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .recentCorrectionCountPast5Seconds,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .lastCorrectionSource,
      "none"
    );
  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime cancels opposite grounded inputs without corrective pull under delayed authority", async () => {
  const localPlayerId = createMetaversePlayerId("grounded-opposite-cancel-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Grounded Opposite Cancel");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);
  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { metaverseRuntimeConfig, runtime, windowHarness } = harness;

  try {
    assert.equal(runtime.hudSnapshot.locomotionMode, "grounded");

    const capturedSamples = [];
    let cancellationOrientationSequence = null;
    let snapshotSequence = 0;

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    windowHarness.dispatch("keydown", {
      code: "KeyA"
    });

    for (let frame = 0; frame < 12; frame += 1) {
      nowMs += 1000 / 60;
      wallClockMs = 1_100 + nowMs;
      windowHarness.advanceFrame(nowMs);

      const latestTraversalIntent =
        fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

      assert.notEqual(latestTraversalIntent, null);
      assert.equal(latestTraversalIntent.bodyControl.moveAxis, 1);
      assert.equal(latestTraversalIntent.bodyControl.strafeAxis, -1);
      cancellationOrientationSequence ??=
        latestTraversalIntent.sequence;
      assert.equal(
        latestTraversalIntent.sequence,
        cancellationOrientationSequence
      );

      capturedSamples.push(
        captureCurrentGroundedBodySample({
          capturedSamples,
          fakeWorldClient,
          metaverseRuntimeConfig,
          runtime,
          wallClockMs
        })
      );

      const authoritativeSample =
        capturedSamples[Math.max(0, capturedSamples.length - 3)];

      fakeWorldClient.publishWorldSnapshotBuffer([
        createRealtimeWorldSnapshot({
          currentTick: 260 + frame,
          includeRemotePlayer: false,
          includeVehicle: false,
          localGroundedBody: authoritativeSample.groundedBody,
          localLastProcessedTraversalSequence: authoritativeSample.sequence,
          localLastProcessedTraversalSequence:
            authoritativeSample.sequence,
          localLinearVelocity: authoritativeSample.groundedBody.linearVelocity,
          localLookYawRadians: authoritativeSample.lookYawRadians,
          localPlayerId,
          localPlayerX: authoritativeSample.groundedBody.position.x,
          localPlayerY: authoritativeSample.groundedBody.position.y,
          localPlayerZ: authoritativeSample.groundedBody.position.z,
          localUsername: username,
          localYawRadians: authoritativeSample.groundedBody.yawRadians,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: authoritativeSample.wallClockMs,
          snapshotSequence: ++snapshotSequence,
          vehicleX: 10
        })
      ]);
    }

    windowHarness.dispatch("keydown", {
      code: "KeyS"
    });
    windowHarness.dispatch("keydown", {
      code: "KeyD"
    });

    for (let frame = 0; frame < 18; frame += 1) {
      nowMs += 1000 / 60;
      wallClockMs = 1_100 + nowMs;
      windowHarness.advanceFrame(nowMs);

      const latestTraversalIntent =
        fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

      assert.notEqual(latestTraversalIntent, null);
      assert.equal(latestTraversalIntent.bodyControl.moveAxis, 0);
      assert.equal(latestTraversalIntent.bodyControl.strafeAxis, 0);
      assert.equal(
        latestTraversalIntent.sequence,
        cancellationOrientationSequence
      );

      capturedSamples.push(
        captureCurrentGroundedBodySample({
          capturedSamples,
          fakeWorldClient,
          metaverseRuntimeConfig,
          runtime,
          wallClockMs
        })
      );

      const authoritativeSample =
        capturedSamples[Math.max(0, capturedSamples.length - 3)];

      fakeWorldClient.publishWorldSnapshotBuffer([
        createRealtimeWorldSnapshot({
          currentTick: 272 + frame,
          includeRemotePlayer: false,
          includeVehicle: false,
          localGroundedBody: authoritativeSample.groundedBody,
          localLastProcessedTraversalSequence: authoritativeSample.sequence,
          localLastProcessedTraversalSequence:
            authoritativeSample.sequence,
          localLinearVelocity: authoritativeSample.groundedBody.linearVelocity,
          localLookYawRadians: authoritativeSample.lookYawRadians,
          localPlayerId,
          localPlayerX: authoritativeSample.groundedBody.position.x,
          localPlayerY: authoritativeSample.groundedBody.position.y,
          localPlayerZ: authoritativeSample.groundedBody.position.z,
          localUsername: username,
          localYawRadians: authoritativeSample.groundedBody.yawRadians,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: authoritativeSample.wallClockMs,
          snapshotSequence: ++snapshotSequence,
          vehicleX: 10
        })
      ]);
    }

    windowHarness.dispatch("keyup", {
      code: "KeyD"
    });
    windowHarness.dispatch("keyup", {
      code: "KeyS"
    });
    windowHarness.dispatch("keyup", {
      code: "KeyA"
    });
    windowHarness.dispatch("keyup", {
      code: "KeyW"
    });

    nowMs += 1000 / 60;
    wallClockMs = 1_100 + nowMs;
    windowHarness.advanceFrame(nowMs);

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .recentCorrectionCountPast5Seconds,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .lastCorrectionSource,
      "none"
    );
  } finally {
    harness.dispose();
  }
});

test("WebGpuMetaverseRuntime stays correction-free against the authoritative server during grounded circle-running input", async () => {
  const { MetaverseAuthoritativeWorldRuntime } = await import(
    "../../../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js"
  );
  const localPlayerId = createMetaversePlayerId("grounded-circle-authority-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Grounded Circle Authority");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

  const authoritativeRuntime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(33)
  });
  authoritativeRuntime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      pose: {
        position: {
          x: metaverseWorldGroundedSpawnPosition.x,
          y: metaverseWorldGroundedSpawnPosition.y,
          z: metaverseWorldGroundedSpawnPosition.z
        },
        stateSequence: 1,
        yawRadians: authoredGroundedSpawnYawRadians
      },
      username
    }),
    0
  );

  const fakePresenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const fakeWorldClient = new FakeMetaverseWorldClient();
  const harness = await createStartedClientMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    createMetaversePresenceClient: () => fakePresenceClient,
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: createSkiffMountProofSlice,
    readNowMs: () => nowMs,
    readWallClockMs: () => wallClockMs
  });
  const { runtime, windowHarness } = harness;

  try {
    fakeWorldClient.publishWorldSnapshotBuffer([
      authoritativeRuntime.readWorldSnapshot(0, localPlayerId)
    ]);

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    windowHarness.dispatch("keydown", {
      code: "KeyD"
    });
    windowHarness.dispatch("keydown", {
      code: "ShiftLeft"
    });

    for (let frame = 0; frame < 48; frame += 1) {
      windowHarness.dispatch("mousemove", {
        movementX: 24,
        movementY: 0
      });
      nowMs += 1000 / 60;
      wallClockMs = 1_100 + nowMs;
      windowHarness.advanceFrame(nowMs);

      const latestTraversalIntent =
        fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

      assert.notEqual(latestTraversalIntent, null);
      assert.equal(latestTraversalIntent.locomotionMode, "grounded");
      assert.equal(latestTraversalIntent.bodyControl.boost, true);
      assert.equal(latestTraversalIntent.bodyControl.moveAxis, 1);
      assert.equal(latestTraversalIntent.bodyControl.strafeAxis, 1);
      assert.ok(latestTraversalIntent.sequence > 0);

      authoritativeRuntime.acceptWorldCommand(
        createMetaverseSyncPlayerTraversalIntentCommand({
          intent: latestTraversalIntent,
          playerId: localPlayerId
        }),
        nowMs
      );
      authoritativeRuntime.advanceToTime(nowMs);
      fakeWorldClient.publishWorldSnapshotBuffer([
        authoritativeRuntime.readWorldSnapshot(nowMs, localPlayerId)
      ]);
    }

    windowHarness.dispatch("keyup", {
      code: "ShiftLeft"
    });
    windowHarness.dispatch("keyup", {
      code: "KeyD"
    });
    windowHarness.dispatch("keyup", {
      code: "KeyW"
    });

    for (let frame = 0; frame < 6; frame += 1) {
      nowMs += 1000 / 60;
      wallClockMs = 1_100 + nowMs;
      windowHarness.advanceFrame(nowMs);
      authoritativeRuntime.advanceToTime(nowMs);
      fakeWorldClient.publishWorldSnapshotBuffer([
        authoritativeRuntime.readWorldSnapshot(nowMs, localPlayerId)
      ]);
    }

    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .recentCorrectionCountPast5Seconds,
      0
    );
    assert.equal(
      runtime.hudSnapshot.telemetry.worldSnapshot.localReconciliation
        .lastCorrectionSource,
      "none"
    );
  } finally {
    harness.dispose();
  }
});
