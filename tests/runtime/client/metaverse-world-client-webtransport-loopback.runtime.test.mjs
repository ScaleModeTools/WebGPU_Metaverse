import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import { MetaverseRealtimeWorldWebTransportDatagramAdapter } from "../../../server/dist/metaverse/adapters/metaverse-realtime-world-webtransport-datagram-adapter.js";
import { MetaverseWorldWebTransportAdapter } from "../../../server/dist/metaverse/adapters/metaverse-world-webtransport-adapter.js";
import { MetaverseAuthoritativeWorldRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";
import {
  createManualTimerScheduler,
  createTraversalIntentInput,
  flushAsyncWork
} from "./fixtures/metaverse-world-network-test-fixtures.mjs";
import { createClientModuleLoader } from "./load-client-module.mjs";
import {
  createStartedWebGpuMetaverseRuntimeHarness,
  FakeMetaversePresenceClient
} from "./metaverse-runtime-test-fixtures.mjs";
import {
  createStaticSurfaceProofSlice
} from "./metaverse-runtime-proof-slice-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createDeferred() {
  let resolve = () => {};
  let reject = () => {};
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

function createBidirectionalStreamPair() {
  const clientToServer = new TransformStream();
  const serverToClient = new TransformStream();

  return Object.freeze({
    clientStream: Object.freeze({
      readable: serverToClient.readable,
      writable: clientToServer.writable
    }),
    serverStream: Object.freeze({
      readable: clientToServer.readable,
      writable: serverToClient.writable
    })
  });
}


async function waitFor(check, label) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = check();

    if (result) {
      return result;
    }

    await flushAsyncWork();
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

async function runScheduledTasksWithDelay(scheduler, delay) {
  while (scheduler.pendingTasks.some((task) => task.delay === delay)) {
    scheduler.runNext(delay);
    await flushAsyncWork();
  }
}

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function parseReliableWorldMessage(payload) {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Metaverse world reliable loopback payload must be an object.");
  }

  if (
    payload.type !== "world-command-request" &&
    payload.type !== "world-snapshot-request" &&
    payload.type !== "world-snapshot-subscribe"
  ) {
    throw new Error(
      `Unsupported metaverse world reliable loopback payload: ${payload.type}`
    );
  }

  return payload;
}

function parseWorldDatagram(payload) {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Metaverse world datagram loopback payload must be an object.");
  }

  if (
    payload.type !== "world-driver-vehicle-control-datagram" &&
    payload.type !== "world-player-look-intent-datagram" &&
    payload.type !== "world-player-traversal-intent-datagram" &&
    payload.type !== "world-player-weapon-state-datagram"
  ) {
    throw new Error(
      `Unsupported metaverse world datagram loopback payload: ${payload.type}`
    );
  }

  return payload;
}

async function serveReliableWorldSession({
  readNowMs,
  serverStream,
  session,
  sessionClosedPromise,
  telemetry,
  textDecoder,
  textEncoder
}) {
  const reader = serverStream.readable.getReader();
  const writer = serverStream.writable.getWriter();
  let bufferedText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      bufferedText += textDecoder.decode(value, {
        stream: true
      });

      while (true) {
        const newlineIndex = bufferedText.indexOf("\n");

        if (newlineIndex < 0) {
          break;
        }

        const rawFrame = bufferedText.slice(0, newlineIndex);

        bufferedText = bufferedText.slice(newlineIndex + 1);

        if (rawFrame.trim().length === 0) {
          continue;
        }

        const message = parseReliableWorldMessage(JSON.parse(rawFrame));

        if (message.type === "world-snapshot-request") {
          telemetry.snapshotRequestCount += 1;
        } else if (message.type === "world-snapshot-subscribe") {
          telemetry.snapshotSubscribeCount += 1;
        } else {
          telemetry.reliableCommandRequestCount += 1;
        }

        if (message.type === "world-snapshot-subscribe") {
          await session.handleClientStream(
            message,
            {
              closed: sessionClosedPromise,
              async writeResponse(response) {
                await writer.write(
                  textEncoder.encode(`${JSON.stringify(response)}\n`)
                );
              }
            },
            readNowMs()
          );
          return;
        }

        const response = session.receiveClientMessage(message, readNowMs());

        await writer.write(textEncoder.encode(`${JSON.stringify(response)}\n`));
      }
    }
  } finally {
    try {
      await writer.close();
    } catch {}

    try {
      writer.releaseLock();
    } catch {}

    try {
      reader.releaseLock();
    } catch {}

    session.dispose();
  }
}

function createMetaverseWorldWebTransportLoopback({
  datagramAdapter,
  readNowMs,
  worldAdapter
}) {
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  const telemetry = {
    datagramDriverControlCount: 0,
    datagramLookCount: 0,
    datagramWeaponCount: 0,
    datagramTraversalCount: 0,
    latestTraversalDatagram: null,
    reliableCommandRequestCount: 0,
    snapshotRequestCount: 0,
    snapshotSubscribeCount: 0
  };

  return Object.freeze({
    telemetry,
    webTransportFactory() {
      const datagramSession = datagramAdapter.openSession();
      const closeDeferred = createDeferred();
      const closeStreamSessions = new Set();
      let closed = false;

      return Object.freeze({
        closed: closeDeferred.promise,
        datagrams: Object.freeze({
          writable: new WritableStream({
            async write(chunk) {
              if (closed) {
                throw new Error("Loopback WebTransport datagram transport is closed.");
              }

              const payload = parseWorldDatagram(
                JSON.parse(textDecoder.decode(chunk))
              );

              if (payload.type === "world-driver-vehicle-control-datagram") {
                telemetry.datagramDriverControlCount += 1;
              } else if (payload.type === "world-player-look-intent-datagram") {
                telemetry.datagramLookCount += 1;
              } else if (
                payload.type === "world-player-weapon-state-datagram"
              ) {
                telemetry.datagramWeaponCount += 1;
              } else {
                telemetry.datagramTraversalCount += 1;
                telemetry.latestTraversalDatagram = payload.command;
              }

              datagramSession.receiveClientDatagram(payload, readNowMs());
            }
          })
        }),
        async createBidirectionalStream() {
          if (closed) {
            throw new Error(
              "Loopback WebTransport reliable transport is already closed."
            );
          }

          const session = worldAdapter.openSession();
          const sessionClosed = createDeferred();
          const { clientStream, serverStream } = createBidirectionalStreamPair();
          const closeStreamSession = () => {
            sessionClosed.resolve();
          };

          closeStreamSessions.add(closeStreamSession);
          void serveReliableWorldSession({
            readNowMs,
            serverStream,
            session,
            sessionClosedPromise: sessionClosed.promise,
            telemetry,
            textDecoder,
            textEncoder
          }).finally(() => {
            closeStreamSessions.delete(closeStreamSession);
          });

          return clientStream;
        },
        ready: Promise.resolve(),
        close() {
          if (closed) {
            return;
          }

          closed = true;

          for (const closeStreamSession of closeStreamSessions) {
            closeStreamSession();
          }

          closeStreamSessions.clear();
          datagramSession.dispose();
          closeDeferred.resolve();
        }
      });
    }
  });
}

function joinGroundedPlayer(
  runtime,
  playerId,
  username,
  position = {
    x: 0,
    y: 1.62,
    z: 24
  },
  yawRadians = 0
) {
  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position,
        stateSequence: 1,
        yawRadians
      },
      username
    }),
    0
  );
}

async function publishAuthoritativeWorld(runtime, worldAdapter, nowMs) {
  runtime.advanceToTime(nowMs);
  worldAdapter.publishWorldSnapshots(nowMs);
  await flushAsyncWork();
}

function createLoopbackWorldClient(
  networkModule,
  {
    loopback,
    readNowMs,
    scheduler
  }
) {
  const {
    MetaverseWorldClient,
    createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport,
    createMetaverseWorldWebTransportSnapshotStreamTransport,
    createMetaverseWorldWebTransportTransport
  } = networkModule;

  return new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 6,
      serverOrigin: "https://127.0.0.1:3211",
      snapshotStreamReconnectDelayMs: createMilliseconds(250),
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      clearTimeout: scheduler.clearTimeout,
      latestWinsDatagramTransport:
        createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport(
          {
            webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      readWallClockMs: readNowMs,
      setTimeout: scheduler.setTimeout,
      snapshotStreamTransport:
        createMetaverseWorldWebTransportSnapshotStreamTransport(
          {
            webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      transport: createMetaverseWorldWebTransportTransport(
        {
          webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
        },
        {
          webTransportFactory: loopback.webTransportFactory
        }
      )
    }
  );
}

function readRuntimeLocalGroundedBodyPosition(runtime, metaverseRuntimeConfig) {
  const groundedBody =
    runtime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.groundedBody;

  assert.notEqual(groundedBody, null, "local grounded body should be available");

  return Object.freeze({
    x:
      runtime.hudSnapshot.camera.position.x -
      Math.sin(runtime.hudSnapshot.camera.yawRadians) *
        metaverseRuntimeConfig.bodyPresentation
          .groundedFirstPersonForwardOffsetMeters,
    y:
      runtime.hudSnapshot.camera.position.y -
      metaverseRuntimeConfig.groundedBody.eyeHeightMeters,
    z:
      runtime.hudSnapshot.camera.position.z +
      Math.cos(runtime.hudSnapshot.camera.yawRadians) *
        metaverseRuntimeConfig.bodyPresentation
          .groundedFirstPersonForwardOffsetMeters
  });
}

function readRuntimeLocalPlanarDisplacementMeters(runtime, metaverseRuntimeConfig) {
  const position = readRuntimeLocalGroundedBodyPosition(
    runtime,
    metaverseRuntimeConfig
  );
  const spawnPosition = metaverseRuntimeConfig.groundedBody.spawnPosition;

  return Math.hypot(
    position.x - spawnPosition.x,
    position.z - spawnPosition.z
  );
}

test("MetaverseWorldClient uses WebTransport datagrams for grounded move and turn input while reliable WebTransport owns snapshot request and stream", async () => {
  const {
    MetaverseWorldClient,
    createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport,
    createMetaverseWorldWebTransportSnapshotStreamTransport,
    createMetaverseWorldWebTransportTransport
  } = await clientLoader.load("/src/network/index.ts");
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const worldAdapter = new MetaverseWorldWebTransportAdapter(runtime);
  const datagramAdapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const playerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-grounded-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Loopback Grounded Pilot"),
    "username"
  );
  const scheduler = createManualTimerScheduler();
  let nowMs = 0;

  joinGroundedPlayer(runtime, playerId, username);

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 6,
      serverOrigin: "https://127.0.0.1:3211",
      snapshotStreamReconnectDelayMs: createMilliseconds(250),
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      clearTimeout: scheduler.clearTimeout,
      latestWinsDatagramTransport:
        createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport(
          {
            webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      readWallClockMs: () => nowMs,
      setTimeout: scheduler.setTimeout,
      snapshotStreamTransport:
        createMetaverseWorldWebTransportSnapshotStreamTransport(
          {
            webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      transport: createMetaverseWorldWebTransportTransport(
        {
          webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
        },
        {
          webTransportFactory: loopback.webTransportFactory
        }
      )
    }
  );

  try {
    const initialSnapshot = await client.ensureConnected(playerId);

    assert.equal(initialSnapshot.players[0]?.playerId, playerId);
    assert.equal(loopback.telemetry.snapshotRequestCount, 1);
    await waitFor(
      () =>
        loopback.telemetry.snapshotSubscribeCount === 1 ? true : null,
      "authoritative world snapshot-stream subscribe"
    );
    assert.equal(loopback.telemetry.snapshotSubscribeCount, 1);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);

    client.syncPlayerTraversalIntent({
      intent: createTraversalIntentInput({
        boost: false,
        jump: false,
        moveAxis: 1,
        pitchRadians: 0,
        strafeAxis: 0,
        yawRadians: 0
      }),
      playerId
    });
    const expectedMoveTraversalSampleId =
      client.latestPlayerIssuedTraversalIntentSnapshot?.sampleId ?? 0;
    const expectedMoveInputSequence = client.latestPlayerInputSequence;
    const expectedMoveOrientationSequence =
      client.latestPlayerTraversalOrientationSequence;

    assert.ok(expectedMoveInputSequence > 0);
    assert.ok(expectedMoveOrientationSequence > 0);
    assert.ok(expectedMoveTraversalSampleId > 0);

    assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

    scheduler.runNext(0);
    await flushAsyncWork();

    assert.equal(loopback.telemetry.datagramTraversalCount, 1);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);

    nowMs = Math.max(150, nowMs + 50);
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    const authoritativeMovedSnapshot = runtime.readWorldSnapshot(nowMs, playerId);

    assert.equal(
      authoritativeMovedSnapshot.observerPlayer?.lastProcessedInputSequence,
      expectedMoveInputSequence
    );
    assert.equal(
      authoritativeMovedSnapshot.observerPlayer?.lastProcessedTraversalSampleId,
      expectedMoveTraversalSampleId
    );
    assert.equal(
      authoritativeMovedSnapshot.observerPlayer
        ?.lastProcessedTraversalOrientationSequence,
      expectedMoveOrientationSequence
    );

    const movedSnapshot = await waitFor(() => {
      const snapshot = client.worldSnapshotBuffer.at(-1);

      if (
        snapshot?.observerPlayer?.lastProcessedInputSequence !==
          expectedMoveInputSequence ||
        snapshot.observerPlayer?.lastProcessedTraversalSampleId !==
          expectedMoveTraversalSampleId
      ) {
        return null;
      }

      return snapshot;
    }, "grounded traversal input ack over snapshot stream");
    const movedBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        requireValue(movedSnapshot.players[0], "movedPlayerSnapshot")
      );

    assert.equal(
      movedSnapshot.observerPlayer?.lastProcessedTraversalSampleId,
      expectedMoveTraversalSampleId
    );
    assert.equal(
      movedSnapshot.observerPlayer?.lastProcessedTraversalOrientationSequence,
      expectedMoveOrientationSequence
    );
    assert.ok(movedBodySnapshot.position.z < 24);

    client.syncPlayerTraversalIntent({
      intent: createTraversalIntentInput({
        boost: false,
        jump: false,
        moveAxis: 1,
        pitchRadians: -0.15,
        strafeAxis: 0,
        yawRadians: 0.7
      }),
      playerId
    });
    const expectedTurnInputSequence = client.latestPlayerInputSequence;
    const expectedTurnOrientationSequence =
      client.latestPlayerTraversalOrientationSequence;

    assert.equal(expectedTurnInputSequence, expectedMoveInputSequence);
    assert.ok(
      expectedTurnOrientationSequence > expectedMoveOrientationSequence
    );

    assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

    scheduler.runNext(0);
    await flushAsyncWork();

    assert.equal(loopback.telemetry.datagramTraversalCount, 2);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);

    nowMs = 200;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    const authoritativeTurnedSnapshot = runtime.readWorldSnapshot(nowMs, playerId);

    assert.equal(
      authoritativeTurnedSnapshot.observerPlayer?.lastProcessedInputSequence,
      expectedTurnInputSequence
    );
    assert.equal(
      authoritativeTurnedSnapshot.observerPlayer
        ?.lastProcessedTraversalOrientationSequence,
      expectedTurnOrientationSequence
    );

    const turnedSnapshot = await waitFor(() => {
      const snapshot = client.worldSnapshotBuffer.at(-1);

      if (
        snapshot?.observerPlayer?.lastProcessedTraversalOrientationSequence !==
        expectedTurnOrientationSequence
      ) {
        return null;
      }

      return snapshot;
    }, "grounded traversal orientation ack over snapshot stream");
    const turnedBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        requireValue(turnedSnapshot.players[0], "turnedPlayerSnapshot")
      );

    assert.equal(
      turnedSnapshot.observerPlayer?.lastProcessedInputSequence,
      expectedTurnInputSequence
    );
    assert.ok(turnedBodySnapshot.yawRadians > 0.35);
  } finally {
    client.dispose();
  }
});

test("MetaverseRemoteWorldRuntime keeps remote root motion live while the mover only advances yaw updates", async () => {
  const networkModule = await clientLoader.load("/src/network/index.ts");
  const { MetaverseRemoteWorldRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-remote-world-runtime.ts"
  );
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const worldAdapter = new MetaverseWorldWebTransportAdapter(runtime);
  const datagramAdapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const moverPlayerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-mover-pilot"),
    "moverPlayerId"
  );
  const observerPlayerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-observer-pilot"),
    "observerPlayerId"
  );
  const moverUsername = requireValue(
    createUsername("Loopback Mover Pilot"),
    "moverUsername"
  );
  const observerUsername = requireValue(
    createUsername("Loopback Observer Pilot"),
    "observerUsername"
  );
  const moverScheduler = createManualTimerScheduler();
  const observerScheduler = createManualTimerScheduler();
  let nowMs = 0;
  let observerWorldClient = null;

  joinGroundedPlayer(runtime, moverPlayerId, moverUsername);
  joinGroundedPlayer(
    runtime,
    observerPlayerId,
    observerUsername,
    {
      x: 6,
      y: 1.62,
      z: 24
    }
  );

  const moverLoopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const observerLoopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const moverClient = createLoopbackWorldClient(networkModule, {
    loopback: moverLoopback,
    readNowMs: () => nowMs,
    scheduler: moverScheduler
  });
  const observerRemoteWorldRuntime = new MetaverseRemoteWorldRuntime({
    createMetaverseWorldClient: () => {
      observerWorldClient = createLoopbackWorldClient(networkModule, {
        loopback: observerLoopback,
        readNowMs: () => nowMs,
        scheduler: observerScheduler
      });

      return observerWorldClient;
    },
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: observerPlayerId,
      username: observerUsername
    },
    onRemoteWorldUpdate() {},
    readWallClockMs: () => nowMs,
    samplingConfig: {
      clockOffsetCorrectionAlpha: 1,
      clockOffsetMaxStepMs: 1_000,
      interpolationDelayMs: 0,
      maxExtrapolationMs: 0,
      remoteCharacterRootInterpolationDelayMs: 0,
      remoteCharacterRootMaxExtrapolationMs: 0
    }
  });

  try {
    await moverClient.ensureConnected(moverPlayerId);
    observerRemoteWorldRuntime.boot();
    observerRemoteWorldRuntime.syncConnection(true);

    await waitFor(
      () => observerWorldClient?.statusSnapshot.connected === true,
      "observer world client connect"
    );
    await waitFor(
      () => observerLoopback.telemetry.snapshotSubscribeCount === 1,
      "observer world snapshot-stream subscribe"
    );
    await waitFor(
      () => observerWorldClient?.worldSnapshotBuffer.length > 0,
      "observer initial world snapshot"
    );

    observerRemoteWorldRuntime.sampleRemoteWorld();
    assert.equal(observerRemoteWorldRuntime.remoteCharacterPresentations.length, 1);

    moverClient.syncPlayerTraversalIntent({
      intent: createTraversalIntentInput({
        boost: false,
        jump: false,
        moveAxis: 1,
        pitchRadians: 0,
        strafeAxis: 0,
        yawRadians: 0
      }),
      playerId: moverPlayerId
    });
    const expectedMoveInputSequence = moverClient.latestPlayerInputSequence;
    const expectedMoveOrientationSequence =
      moverClient.latestPlayerTraversalOrientationSequence;

    moverScheduler.runNext(0);
    await flushAsyncWork();

    nowMs = 50;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    observerRemoteWorldRuntime.sampleRemoteWorld();

    const firstRemotePresentation =
      observerRemoteWorldRuntime.remoteCharacterPresentations[0];
    const firstRemotePosition = {
      ...requireValue(
        firstRemotePresentation?.presentation.position,
        "firstRemotePosition"
      )
    };

    assert.equal(firstRemotePresentation?.playerId, moverPlayerId);
    assert.ok(firstRemotePosition.z < 24);

    moverClient.syncPlayerTraversalIntent({
      intent: createTraversalIntentInput({
        boost: false,
        jump: false,
        moveAxis: 1,
        pitchRadians: -0.15,
        strafeAxis: 0,
        yawRadians: 0.7
      }),
      playerId: moverPlayerId
    });
    const expectedTurnInputSequence = moverClient.latestPlayerInputSequence;
    const expectedTurnOrientationSequence =
      moverClient.latestPlayerTraversalOrientationSequence;

    assert.equal(expectedTurnInputSequence, expectedMoveInputSequence);
    assert.ok(
      expectedTurnOrientationSequence > expectedMoveOrientationSequence
    );

    moverScheduler.runNext(0);
    await flushAsyncWork();

    nowMs = 100;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    observerRemoteWorldRuntime.sampleRemoteWorld();

    const secondRemotePresentation =
      observerRemoteWorldRuntime.remoteCharacterPresentations[0];
    const secondRemotePosition = {
      ...requireValue(
        secondRemotePresentation?.presentation.position,
        "secondRemotePosition"
      )
    };

    assert.ok(secondRemotePosition.z < firstRemotePosition.z - 0.01);
    assert.ok(secondRemotePresentation?.presentation.yawRadians > 0.35);
    assert.ok(
      Math.abs((secondRemotePresentation?.look.yawRadians ?? 0) - 0.7) < 0.000001
    );

    nowMs = 150;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    observerRemoteWorldRuntime.sampleRemoteWorld();

    const thirdRemotePresentation =
      observerRemoteWorldRuntime.remoteCharacterPresentations[0];
    const thirdRemotePosition = {
      ...requireValue(
        thirdRemotePresentation?.presentation.position,
        "thirdRemotePosition"
      )
    };

    assert.ok(thirdRemotePosition.x > secondRemotePosition.x + 0.01);
    assert.ok(thirdRemotePosition.z < secondRemotePosition.z - 0.01);
    assert.ok(
      Math.abs((thirdRemotePresentation?.look.yawRadians ?? 0) - 0.7) < 0.000001
    );
  } finally {
    observerRemoteWorldRuntime.dispose();
    moverClient.dispose();
  }
});

test("WebGpuMetaverseRuntime preserves brief grounded tap travel locally and stays planarly aligned with authoritative WebTransport history", async () => {
  const networkModule = await clientLoader.load("/src/network/index.ts");
  const { createMetaverseRuntimeConfig } =
    await clientLoader.load("/src/metaverse/config/metaverse-runtime.ts");
  const localPlayerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-runtime-tap-pilot"),
    "localPlayerId"
  );
  const remotePlayerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-runtime-remote"),
    "remotePlayerId"
  );
  const username = requireValue(
    createUsername("Loopback Runtime Tap Pilot"),
    "username"
  );
  const playerRuntimeConfig = createMetaverseRuntimeConfig(
    undefined,
    localPlayerId,
    null
  );
  const remoteUsername = requireValue(
    createUsername("Loopback Runtime Remote"),
    "remoteUsername"
  );
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const worldAdapter = new MetaverseWorldWebTransportAdapter(runtime);
  const datagramAdapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const scheduler = createManualTimerScheduler();
  let nowMs = 0;
  let runtimeWorldClient = null;

  joinGroundedPlayer(
    runtime,
    localPlayerId,
    username,
    playerRuntimeConfig.groundedBody.spawnPosition,
    playerRuntimeConfig.camera.initialYawRadians
  );

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const presenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const harness = await createStartedWebGpuMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    buildRuntimeConfig: () => playerRuntimeConfig,
    clientModuleLoader: clientLoader,
    createMetaversePresenceClient: () => presenceClient,
    createMetaverseWorldClient: () => {
      runtimeWorldClient = createLoopbackWorldClient(networkModule, {
        loopback,
        readNowMs: () => nowMs,
        scheduler
      });

      return runtimeWorldClient;
    },
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: () => createStaticSurfaceProofSlice(clientLoader),
    readNowMs: () => nowMs,
    readWallClockMs: () => nowMs
  });
  const {
    metaverseRuntimeConfig,
    runtime: clientRuntime,
    windowHarness
  } = harness;

  try {
    await waitFor(
      () => runtimeWorldClient?.statusSnapshot.connected === true,
      "runtime world client connect"
    );
    await waitFor(
      () => loopback.telemetry.snapshotSubscribeCount === 1,
      "runtime world snapshot-stream subscribe"
    );
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    await waitFor(
      () => runtimeWorldClient?.worldSnapshotBuffer.length > 0,
      "runtime initial world snapshot"
    );
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    const seededTraversalIntent =
      runtimeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

    assert.notEqual(seededTraversalIntent, null);
    assert.ok(seededTraversalIntent.inputSequence > 0);

    await runScheduledTasksWithDelay(scheduler, 0);
    await waitFor(
      () => (loopback.telemetry.datagramTraversalCount > 0 ? true : null),
      "runtime seeded idle traversal datagram send"
    );
    nowMs = 50;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    await waitFor(() => {
      const latestSnapshot = runtimeWorldClient?.worldSnapshotBuffer.at(-1);

      if (
        latestSnapshot?.observerPlayer?.lastProcessedInputSequence !==
        seededTraversalIntent.inputSequence
      ) {
        return null;
      }

      return latestSnapshot;
    }, "runtime seeded authoritative idle acknowledgement");
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    const baselineCorrectionCount =
      clientRuntime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount;
    const baselineLocalReconciliation =
      clientRuntime.hudSnapshot.telemetry.worldSnapshot.localReconciliation;
    const baselineTraversalDatagramCount =
      loopback.telemetry.datagramTraversalCount;

    assert.equal(
      baselineCorrectionCount,
      1,
      `expected only the spawn bootstrap correction before tap replay, received ${JSON.stringify(baselineLocalReconciliation)}`
    );
    assert.equal(
      baselineLocalReconciliation.lastLocalAuthorityPoseCorrectionDetail
        .convergenceEpisodeStartIntentionalDiscontinuityCause,
      "spawn",
      `expected initial correction to stay tied to spawn bootstrap, received ${JSON.stringify(baselineLocalReconciliation)}`
    );
    assert.ok(
      (
        baselineLocalReconciliation.lastLocalAuthorityPoseCorrectionDetail
          .planarMagnitudeMeters ?? 0
      ) <= 0.01,
      `expected spawn bootstrap correction to stay planarly negligible, received ${JSON.stringify(baselineLocalReconciliation)}`
    );

    nowMs += 1000 / 60;
    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    windowHarness.advanceFrame(nowMs);

    nowMs += 1000 / 60;
    windowHarness.dispatch("keyup", {
      code: "KeyW"
    });
    windowHarness.advanceFrame(nowMs);

    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    const localPlanarDisplacementBeforeAuthority =
      readRuntimeLocalPlanarDisplacementMeters(
        clientRuntime,
        metaverseRuntimeConfig
      );
    const previewTraversalIntent =
      runtimeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

    assert.notEqual(previewTraversalIntent, null);
    assert.ok(previewTraversalIntent.inputSequence >= 2);
    assert.equal(previewTraversalIntent.bodyControl.moveAxis, 0);
    assert.ok(
      localPlanarDisplacementBeforeAuthority > 0.004,
      `expected local grounded prediction to preserve brief tap travel before authoritative replay, received ${localPlanarDisplacementBeforeAuthority}`
    );
    assert.equal(
      loopback.telemetry.datagramTraversalCount,
      baselineTraversalDatagramCount
    );

    await runScheduledTasksWithDelay(scheduler, 0);
    await waitFor(
      () =>
        loopback.telemetry.datagramTraversalCount >
        baselineTraversalDatagramCount
          ? true
          : null,
      "runtime tapped traversal datagram send"
    );

    let authoritativePublishTimeMs = Math.max(150, nowMs + 50);
    let authoritativeSnapshot = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      nowMs = authoritativePublishTimeMs;
      await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);

      const nextAuthoritativeSnapshot = runtime.readWorldSnapshot(
        nowMs,
        localPlayerId
      );

      if (
        nextAuthoritativeSnapshot.observerPlayer?.lastProcessedInputSequence ===
        previewTraversalIntent.inputSequence
      ) {
        authoritativeSnapshot = nextAuthoritativeSnapshot;
        break;
      }

      authoritativePublishTimeMs += 50;
    }

    assert.notEqual(
      authoritativeSnapshot,
      null,
      `expected authoritative runtime to process the tapped traversal intent, latestDatagram=${JSON.stringify(loopback.telemetry.latestTraversalDatagram)}`
    );

    const authoritativePlayerSnapshot = requireValue(
      authoritativeSnapshot.players.find(
        (playerSnapshot) => playerSnapshot.playerId === localPlayerId
      ),
      "authoritativeLocalPlayerSnapshot"
    );
    const authoritativeBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        authoritativePlayerSnapshot
      );
    assert.ok(
      Math.abs(
        Math.hypot(
          authoritativeBodySnapshot.position.x -
            metaverseRuntimeConfig.groundedBody.spawnPosition.x,
          authoritativeBodySnapshot.position.z -
            metaverseRuntimeConfig.groundedBody.spawnPosition.z
        )
      ) > 0.02,
      `expected authoritative replay to preserve brief forward travel, received ${JSON.stringify(authoritativeBodySnapshot)}`
    );

    await waitFor(() => {
      const latestSnapshot = runtimeWorldClient?.worldSnapshotBuffer.at(-1);

      if (
        latestSnapshot?.observerPlayer?.lastProcessedInputSequence !==
        previewTraversalIntent.inputSequence
      ) {
        return null;
      }

      return latestSnapshot;
    }, "runtime authoritative tap acknowledgement");

    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    const localGroundedPositionAfterAuthority =
      readRuntimeLocalGroundedBodyPosition(
        clientRuntime,
        metaverseRuntimeConfig
      );
    const planarAuthorityDeltaMeters = Math.hypot(
      localGroundedPositionAfterAuthority.x -
        authoritativeBodySnapshot.position.x,
      localGroundedPositionAfterAuthority.z -
        authoritativeBodySnapshot.position.z
    );

    assert.ok(
      planarAuthorityDeltaMeters <= 0.05,
      `expected brief tap parity to stay aligned with authority, local=${JSON.stringify(localGroundedPositionAfterAuthority)} authority=${JSON.stringify(authoritativeBodySnapshot.position)}`
    );
    const finalLocalReconciliation =
      clientRuntime.hudSnapshot.telemetry.worldSnapshot.localReconciliation;
    const finalCorrectionCount =
      clientRuntime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount;

    assert.ok(
      finalCorrectionCount === baselineCorrectionCount ||
        (
          finalCorrectionCount === baselineCorrectionCount + 1 &&
          finalLocalReconciliation.lastLocalAuthorityPoseCorrectionReason ===
            "none"
        ),
      `expected brief tap parity to avoid gross correction churn, received ${JSON.stringify(finalLocalReconciliation)}`
    );
  } finally {
    harness.dispose();
    runtimeWorldClient?.dispose();
  }
});

test("WebGpuMetaverseRuntime keeps an ordinary grounded jump accepted over WebTransport instead of aging into buffer-expired rejection", async () => {
  const networkModule = await clientLoader.load("/src/network/index.ts");
  const { createMetaverseRuntimeConfig } =
    await clientLoader.load("/src/metaverse/config/metaverse-runtime.ts");
  const localPlayerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-runtime-jump-pilot"),
    "localPlayerId"
  );
  const remotePlayerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-runtime-jump-remote"),
    "remotePlayerId"
  );
  const username = requireValue(
    createUsername("Loopback Runtime Jump Pilot"),
    "username"
  );
  const playerRuntimeConfig = createMetaverseRuntimeConfig(
    undefined,
    localPlayerId,
    null
  );
  const remoteUsername = requireValue(
    createUsername("Loopback Runtime Jump Remote"),
    "remoteUsername"
  );
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const worldAdapter = new MetaverseWorldWebTransportAdapter(runtime);
  const datagramAdapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const scheduler = createManualTimerScheduler();
  let nowMs = 0;
  let runtimeWorldClient = null;

  joinGroundedPlayer(
    runtime,
    localPlayerId,
    username,
    playerRuntimeConfig.groundedBody.spawnPosition,
    playerRuntimeConfig.camera.initialYawRadians
  );

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const presenceClient = new FakeMetaversePresenceClient(
    localPlayerId,
    username,
    remotePlayerId
  );
  const harness = await createStartedWebGpuMetaverseRuntimeHarness({
    authoritativePlayerMovementEnabled: true,
    buildRuntimeConfig: () => playerRuntimeConfig,
    clientModuleLoader: clientLoader,
    createMetaversePresenceClient: () => presenceClient,
    createMetaverseWorldClient: () => {
      runtimeWorldClient = createLoopbackWorldClient(networkModule, {
        loopback,
        readNowMs: () => nowMs,
        scheduler
      });

      return runtimeWorldClient;
    },
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    proofSliceFactory: () => createStaticSurfaceProofSlice(clientLoader),
    readNowMs: () => nowMs,
    readWallClockMs: () => nowMs
  });
  const { runtime: clientRuntime, windowHarness } = harness;

  try {
    await waitFor(
      () => runtimeWorldClient?.statusSnapshot.connected === true,
      "runtime world client connect"
    );
    await waitFor(
      () => loopback.telemetry.snapshotSubscribeCount === 1,
      "runtime world snapshot-stream subscribe"
    );
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    await waitFor(
      () => runtimeWorldClient?.worldSnapshotBuffer.length > 0,
      "runtime initial world snapshot"
    );
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    const seededTraversalIntent =
      runtimeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

    assert.notEqual(seededTraversalIntent, null);
    assert.ok(seededTraversalIntent.inputSequence > 0);

    await runScheduledTasksWithDelay(scheduler, 0);
    await waitFor(
      () => (loopback.telemetry.datagramTraversalCount > 0 ? true : null),
      "runtime seeded idle traversal datagram send"
    );
    nowMs = 50;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    await waitFor(() => {
      const latestSnapshot = runtimeWorldClient?.worldSnapshotBuffer.at(-1);

      if (
        latestSnapshot?.observerPlayer?.lastProcessedInputSequence !==
        seededTraversalIntent.inputSequence
      ) {
        return null;
      }

      return latestSnapshot;
    }, "runtime seeded authoritative idle acknowledgement");
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    const baselineCorrectionCount =
      clientRuntime.hudSnapshot.telemetry.worldSnapshot.localReconciliationCorrectionCount;
    const baselineLocalReconciliation =
      clientRuntime.hudSnapshot.telemetry.worldSnapshot.localReconciliation;

    assert.equal(
      baselineCorrectionCount,
      1,
      `expected only the spawn bootstrap correction before jump replay, received ${JSON.stringify(baselineLocalReconciliation)}`
    );
    assert.equal(
      baselineLocalReconciliation.lastLocalAuthorityPoseCorrectionDetail
        .convergenceEpisodeStartIntentionalDiscontinuityCause,
      "spawn",
      `expected initial correction to stay tied to spawn bootstrap, received ${JSON.stringify(baselineLocalReconciliation)}`
    );

    const baselineTraversalDatagramCount =
      loopback.telemetry.datagramTraversalCount;

    nowMs += 1000 / 60;
    windowHarness.dispatch("keydown", {
      code: "Space"
    });
    windowHarness.advanceFrame(nowMs);

    const jumpPressedTraversalIntent =
      runtimeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

    assert.notEqual(jumpPressedTraversalIntent, null);
    assert.equal(jumpPressedTraversalIntent.actionIntent.kind, "jump");
    assert.equal(jumpPressedTraversalIntent.actionIntent.pressed, true);
    assert.ok(jumpPressedTraversalIntent.actionIntent.sequence > 0);

    nowMs += 1000 / 60;
    windowHarness.dispatch("keyup", {
      code: "Space"
    });
    windowHarness.advanceFrame(nowMs);

    const jumpReleasedTraversalIntent =
      runtimeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

    assert.notEqual(jumpReleasedTraversalIntent, null);
    assert.equal(jumpReleasedTraversalIntent.actionIntent.kind, "jump");
    assert.equal(jumpReleasedTraversalIntent.actionIntent.pressed, false);
    assert.equal(
      jumpReleasedTraversalIntent.actionIntent.sequence,
      jumpPressedTraversalIntent.actionIntent.sequence
    );

    await runScheduledTasksWithDelay(scheduler, 0);
    await waitFor(
      () =>
        loopback.telemetry.datagramTraversalCount >
        baselineTraversalDatagramCount
          ? true
          : null,
      "runtime jump traversal datagram send"
    );

    let authoritativePublishTimeMs = Math.max(150, nowMs + 50);
    let authoritativeJumpSnapshot = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      nowMs = authoritativePublishTimeMs;
      await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);

      const nextAuthoritativeSnapshot = runtime.readWorldSnapshot(
        nowMs,
        localPlayerId
      );

      if (
        nextAuthoritativeSnapshot.observerPlayer?.lastProcessedInputSequence ===
          jumpReleasedTraversalIntent.inputSequence &&
        nextAuthoritativeSnapshot.players[0]?.traversalAuthority
          .lastConsumedActionKind === "jump"
      ) {
        authoritativeJumpSnapshot = nextAuthoritativeSnapshot;
        break;
      }

      authoritativePublishTimeMs += 50;
    }

    assert.notEqual(
      authoritativeJumpSnapshot,
      null,
      `expected authoritative runtime to consume the grounded jump intent, latestDatagram=${JSON.stringify(loopback.telemetry.latestTraversalDatagram)}`
    );
    assert.equal(
      authoritativeJumpSnapshot.players[0]?.traversalAuthority.lastRejectedActionReason,
      "none"
    );

    await waitFor(() => {
      const latestSnapshot = runtimeWorldClient?.worldSnapshotBuffer.at(-1);

      if (
        latestSnapshot?.observerPlayer?.lastProcessedInputSequence !==
        jumpReleasedTraversalIntent.inputSequence
      ) {
        return null;
      }

      if (
        latestSnapshot.players[0]?.traversalAuthority.lastConsumedActionKind !==
        "jump"
      ) {
        return null;
      }

      return latestSnapshot;
    }, "runtime authoritative jump acknowledgement");

    for (let snapshotIndex = 0; snapshotIndex < 3; snapshotIndex += 1) {
      nowMs = authoritativePublishTimeMs + (snapshotIndex + 1) * 50;
      await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
      nowMs += 1000 / 60;
      windowHarness.advanceFrame(nowMs);
    }

    const authoritativeLocalPlayerTelemetry =
      clientRuntime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer;
    const localTraversalAuthorityTelemetry =
      clientRuntime.hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
        .traversalAuthority;
    const finalLocalReconciliation =
      clientRuntime.hudSnapshot.telemetry.worldSnapshot.localReconciliation;

    assert.equal(
      authoritativeLocalPlayerTelemetry.jumpDebug.resolvedActionSequence,
      jumpReleasedTraversalIntent.actionIntent.sequence
    );
    assert.equal(
      authoritativeLocalPlayerTelemetry.jumpDebug.resolvedActionState,
      "accepted"
    );
    assert.equal(
      authoritativeLocalPlayerTelemetry.traversalAuthority.lastRejectedActionReason,
      "none"
    );
    assert.equal(
      localTraversalAuthorityTelemetry.lastRejectedActionReason,
      "none"
    );
    assert.ok(
      clientRuntime.hudSnapshot.camera.position.y >
        playerRuntimeConfig.groundedBody.eyeHeightMeters,
      `expected runtime camera to remain airborne after accepted jump, received ${JSON.stringify(clientRuntime.hudSnapshot.camera)}`
    );
    assert.ok(
      finalLocalReconciliation.lastLocalAuthorityPoseCorrectionReason !==
        "gross-body-divergence",
      `expected accepted grounded jump to avoid gross rejection-style correction, received ${JSON.stringify(finalLocalReconciliation)}`
    );
  } finally {
    harness.dispose();
    runtimeWorldClient?.dispose();
  }
});

test("MetaverseWorldClient preserves rapid short-lived traversal edges over the WebTransport traversal datagram lane", async () => {
  const {
    MetaverseWorldClient,
    createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport,
    createMetaverseWorldWebTransportSnapshotStreamTransport,
    createMetaverseWorldWebTransportTransport
  } = await clientLoader.load("/src/network/index.ts");
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const worldAdapter = new MetaverseWorldWebTransportAdapter(runtime);
  const datagramAdapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const playerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-rapid-history-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Loopback Rapid History Pilot"),
    "username"
  );
  const scheduler = createManualTimerScheduler();
  let nowMs = 0;

  joinGroundedPlayer(runtime, playerId, username);

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 6,
      serverOrigin: "https://127.0.0.1:3211",
      snapshotStreamReconnectDelayMs: createMilliseconds(250),
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      clearTimeout: scheduler.clearTimeout,
      latestWinsDatagramTransport:
        createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport(
          {
            webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      readWallClockMs: () => nowMs,
      setTimeout: scheduler.setTimeout,
      snapshotStreamTransport:
        createMetaverseWorldWebTransportSnapshotStreamTransport(
          {
            webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      transport: createMetaverseWorldWebTransportTransport(
        {
          webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
        },
        {
          webTransportFactory: loopback.webTransportFactory
        }
      )
    }
  );

  try {
    const initialSnapshot = await client.ensureConnected(playerId);
    const initialBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        requireValue(initialSnapshot.players[0], "initialPlayerSnapshot")
      );
    await waitFor(
      () =>
        loopback.telemetry.snapshotSubscribeCount === 1 ? true : null,
      "authoritative world snapshot-stream subscribe"
    );

    client.syncPlayerTraversalIntent({
      intent: createTraversalIntentInput({
        boost: false,
        jump: false,
        moveAxis: 1,
        pitchRadians: 0,
        strafeAxis: 0,
        yawRadians: 0
      }),
      playerId
    });
    nowMs = 30;
    client.syncPlayerTraversalIntent({
      intent: createTraversalIntentInput({
        boost: false,
        jump: false,
        moveAxis: 0,
        pitchRadians: 0,
        strafeAxis: 0,
        yawRadians: 0
      }),
      playerId
    });
    nowMs = 60;
    client.syncPlayerTraversalIntent({
      intent: createTraversalIntentInput({
        boost: false,
        jump: false,
        moveAxis: 0,
        pitchRadians: -0.25,
        strafeAxis: 1,
        yawRadians: 0
      }),
      playerId
    });
    const expectedInputSequence = client.latestPlayerInputSequence;
    const expectedOrientationSequence =
      client.latestPlayerTraversalOrientationSequence;

    assert.ok(expectedInputSequence >= 3);
    assert.ok(expectedOrientationSequence >= 2);
    assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

    scheduler.runNext(0);
    await flushAsyncWork();

    assert.equal(loopback.telemetry.datagramTraversalCount, 1);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);

    nowMs = 90;
    await flushAsyncWork();

    nowMs = 100;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    const authoritativeSnapshot = runtime.readWorldSnapshot(nowMs, playerId);
    const authoritativeBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        requireValue(authoritativeSnapshot.players[0], "authoritativePlayerSnapshot")
      );

    assert.equal(
      authoritativeSnapshot.observerPlayer?.lastProcessedInputSequence,
      expectedInputSequence
    );
    assert.equal(
      authoritativeSnapshot.observerPlayer
        ?.lastProcessedTraversalOrientationSequence,
      expectedOrientationSequence
    );
    assert.ok(
      Math.abs(
        authoritativeBodySnapshot.position.z - initialBodySnapshot.position.z
      ) > 0.02
    );
    assert.ok(
      authoritativeBodySnapshot.position.x >
        initialBodySnapshot.position.x + 0.01
    );

    const acknowledgedSnapshot = await waitFor(() => {
      const snapshot = client.worldSnapshotBuffer.at(-1);

      if (
        snapshot?.observerPlayer?.lastProcessedInputSequence !==
          expectedInputSequence ||
        snapshot.observerPlayer?.lastProcessedTraversalOrientationSequence !==
          expectedOrientationSequence
      ) {
        return null;
      }

      return snapshot;
    }, "rapid short-lived traversal ack over WebTransport datagram traversal lane");
    const acknowledgedBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        requireValue(acknowledgedSnapshot.players[0], "acknowledgedPlayerSnapshot")
      );

    assert.ok(
      Math.abs(
        acknowledgedBodySnapshot.position.z - initialBodySnapshot.position.z
      ) > 0.02
    );
    assert.ok(
      acknowledgedBodySnapshot.position.x >
        initialBodySnapshot.position.x + 0.01
    );
  } finally {
    client.dispose();
  }
});

test("MetaverseWorldClient keeps jump acceptance on the WebTransport traversal datagram lane instead of reliable commands", async () => {
  const {
    MetaverseWorldClient,
    createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport,
    createMetaverseWorldWebTransportSnapshotStreamTransport,
    createMetaverseWorldWebTransportTransport
  } = await clientLoader.load("/src/network/index.ts");
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const worldAdapter = new MetaverseWorldWebTransportAdapter(runtime);
  const datagramAdapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const playerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-jump-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Loopback Jump Pilot"),
    "username"
  );
  const scheduler = createManualTimerScheduler();
  let nowMs = 0;

  joinGroundedPlayer(runtime, playerId, username);

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 6,
      serverOrigin: "https://127.0.0.1:3211",
      snapshotStreamReconnectDelayMs: createMilliseconds(250),
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      clearTimeout: scheduler.clearTimeout,
      latestWinsDatagramTransport:
        createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport(
          {
            webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      readWallClockMs: () => nowMs,
      setTimeout: scheduler.setTimeout,
      snapshotStreamTransport:
        createMetaverseWorldWebTransportSnapshotStreamTransport(
          {
            webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      transport: createMetaverseWorldWebTransportTransport(
        {
          webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
        },
        {
          webTransportFactory: loopback.webTransportFactory
        }
      )
    }
  );

  try {
    await client.ensureConnected(playerId);
    await waitFor(
      () =>
        loopback.telemetry.snapshotSubscribeCount === 1 ? true : null,
      "authoritative world snapshot-stream subscribe"
    );

    client.syncPlayerTraversalIntent({
      intent: createTraversalIntentInput({
        boost: false,
        jump: true,
        moveAxis: 1,
        pitchRadians: 0,
        strafeAxis: 0,
        yawRadians: 0
      }),
      playerId
    });
    const expectedJumpInputSequence = client.latestPlayerInputSequence;

    assert.ok(expectedJumpInputSequence > 0);

    assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

    scheduler.runNext(0);
    await flushAsyncWork();

    assert.equal(loopback.telemetry.datagramTraversalCount, 1);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);

    nowMs = 150;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    const authoritativeJumpSnapshot = runtime.readWorldSnapshot(nowMs, playerId);

    assert.equal(
      authoritativeJumpSnapshot.observerPlayer?.lastProcessedInputSequence,
      expectedJumpInputSequence
    );
    assert.equal(
      authoritativeJumpSnapshot.players[0]?.traversalAuthority.currentActionKind,
      "jump"
    );
    assert.equal(
      authoritativeJumpSnapshot.players[0]?.traversalAuthority.currentActionPhase,
      "rising"
    );

    const jumpSnapshot = await waitFor(() => {
      const snapshot = client.worldSnapshotBuffer.at(-1);

      if (
        snapshot?.observerPlayer?.lastProcessedInputSequence !==
        expectedJumpInputSequence
      ) {
        return null;
      }

      if (
        snapshot.players[0]?.traversalAuthority.lastConsumedActionKind !==
          "jump" &&
        snapshot.players[0]?.traversalAuthority.currentActionKind !== "jump"
      ) {
        return null;
      }

      return snapshot;
    }, "jump ack over WebTransport datagram traversal lane");
    const jumpedBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        requireValue(jumpSnapshot.players[0], "jumpPlayerSnapshot")
      );

    assert.equal(loopback.telemetry.snapshotRequestCount, 1);
    assert.equal(loopback.telemetry.snapshotSubscribeCount, 1);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);
    assert.ok(jumpedBodySnapshot.position.y > 1.62);
    assert.ok(jumpedBodySnapshot.position.z < 24);
  } finally {
    client.dispose();
  }
});

test("MetaverseWorldClient uses the WebTransport weapon-state datagram lane and receives authoritative weapon acks", async () => {
  const {
    MetaverseWorldClient,
    createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport,
    createMetaverseWorldWebTransportSnapshotStreamTransport,
    createMetaverseWorldWebTransportTransport
  } = await clientLoader.load("/src/network/index.ts");
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const worldAdapter = new MetaverseWorldWebTransportAdapter(runtime);
  const datagramAdapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const playerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-weapon-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Loopback Weapon Pilot"),
    "username"
  );
  const scheduler = createManualTimerScheduler();
  let nowMs = 0;

  joinGroundedPlayer(runtime, playerId, username);

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const client = new MetaverseWorldClient(
    {
      defaultCommandIntervalMs: createMilliseconds(50),
      defaultPollIntervalMs: createMilliseconds(50),
      maxBufferedSnapshots: 6,
      serverOrigin: "https://127.0.0.1:3211",
      snapshotStreamReconnectDelayMs: createMilliseconds(250),
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      clearTimeout: scheduler.clearTimeout,
      latestWinsDatagramTransport:
        createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport(
          {
            webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      readWallClockMs: () => nowMs,
      setTimeout: scheduler.setTimeout,
      snapshotStreamTransport:
        createMetaverseWorldWebTransportSnapshotStreamTransport(
          {
            webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      transport: createMetaverseWorldWebTransportTransport(
        {
          webTransportUrl: "https://127.0.0.1:3211/metaverse/world"
        },
        {
          webTransportFactory: loopback.webTransportFactory
        }
      )
    }
  );

  try {
    await client.ensureConnected(playerId);
    await waitFor(
      () =>
        loopback.telemetry.snapshotSubscribeCount === 1 ? true : null,
      "authoritative world snapshot-stream subscribe"
    );

    client.syncPlayerWeaponState({
      playerId,
      weaponState: {
        aimMode: "ads",
        weaponId: "metaverse-service-pistol-v1"
      }
    });
    const expectedWeaponSequence = client.latestPlayerWeaponSequence;

    assert.ok(expectedWeaponSequence > 0);
    assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

    scheduler.runNext(0);
    await flushAsyncWork();

    assert.equal(loopback.telemetry.datagramWeaponCount, 1);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);

    nowMs = 100;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    const authoritativeWeaponSnapshot = runtime.readWorldSnapshot(nowMs, playerId);

    assert.equal(
      authoritativeWeaponSnapshot.observerPlayer?.lastProcessedWeaponSequence,
      expectedWeaponSequence
    );
    assert.deepEqual(authoritativeWeaponSnapshot.players[0]?.weaponState, {
      aimMode: "ads",
      weaponId: "metaverse-service-pistol-v1"
    });

    const acknowledgedSnapshot = await waitFor(() => {
      const snapshot = client.worldSnapshotBuffer.at(-1);

      if (
        snapshot?.observerPlayer?.lastProcessedWeaponSequence !==
        expectedWeaponSequence
      ) {
        return null;
      }

      return snapshot;
    }, "weapon-state ack over WebTransport datagram lane");

    assert.deepEqual(acknowledgedSnapshot.players[0]?.weaponState, {
      aimMode: "ads",
      weaponId: "metaverse-service-pistol-v1"
    });
  } finally {
    client.dispose();
  }
});
