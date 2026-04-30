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
  const bodyControl =
    fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.bodyControl ??
    Object.freeze({
      boost: false,
      moveAxis: 0,
      strafeAxis: 0,
      turnAxis: 0
    });

  return Object.freeze({
    groundedBody: Object.freeze({
      contact: Object.freeze({
        appliedMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
        blockedPlanarMovement: false,
        blockedVerticalMovement: false,
        desiredMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
        supportingContactDetected: true
      }),
      driveTarget: Object.freeze({
        boost: bodyControl.boost,
        moveAxis: bodyControl.moveAxis,
        movementMagnitude: Math.hypot(
          bodyControl.moveAxis,
          bodyControl.strafeAxis
        ),
        strafeAxis: bodyControl.strafeAxis,
        targetForwardSpeedUnitsPerSecond: bodyControl.moveAxis,
        targetPlanarSpeedUnitsPerSecond: Math.hypot(
          bodyControl.moveAxis,
          bodyControl.strafeAxis
        ),
        targetStrafeSpeedUnitsPerSecond: bodyControl.strafeAxis
      }),
      interaction: Object.freeze({
        applyImpulsesToDynamicBodies: false
      }),
      jumpBody: Object.freeze({
        grounded: true,
        jumpGroundContactGraceSecondsRemaining: 0,
        jumpReady: true,
        jumpSnapSuppressionActive: false,
        verticalSpeedUnitsPerSecond: linearVelocity.y
      }),
      linearVelocity,
      position,
      yawRadians: cameraSnapshot.yawRadians
    }),
    sequence:
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.sequence ??
      0,
    lookYawRadians: cameraSnapshot.yawRadians,
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
    assert.equal(runtime.hudSnapshot.presence.state, "connected");
    assert.equal(runtime.hudSnapshot.presence.remotePlayerCount, 1);
    assert.equal(
      fakeWorldClient.playerLookIntentRequests.at(-1),
      null
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
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

    assert.ok(
      Math.abs(runtime.hudSnapshot.camera.yawRadians - startingYaw) > 0.001
    );

    const startingPosition = runtime.hudSnapshot.camera.position;

    windowHarness.dispatch("keydown", {
      code: "KeyD"
    });
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

    assert.ok(
      Math.hypot(
        runtime.hudSnapshot.camera.position.x - startingPosition.x,
        runtime.hudSnapshot.camera.position.z - startingPosition.z
      ) > 0.001
    );
    assert.ok(Math.abs(runtime.hudSnapshot.camera.position.y - 1.9) < 0.001);

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
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

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

    windowHarness.dispatch("keyup", {
      code: "Space"
    });
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent.kind ===
        "jump",
      true
    );
    assert.equal(
      fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.actionIntent.pressed,
      false
    );

    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

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
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

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

    windowHarness.dispatch("mousemove", {
      movementX: 240,
      movementY: 0
    });
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

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
  const { metaverseRuntimeConfig, renderer, runtime, windowHarness } = harness;

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
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      wallClockMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

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
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      wallClockMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

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
    for (let frame = 0; frame < 3; frame += 1) {
      nowMs += 1000 / 60;
      wallClockMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

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
