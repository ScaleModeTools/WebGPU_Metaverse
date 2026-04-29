import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseQuickJoinRoomRequest,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import { MetaverseRealtimeWorldWebTransportDatagramAdapter } from "../../../server/dist/metaverse/adapters/metaverse-realtime-world-webtransport-datagram-adapter.js";
import { MetaverseWorldWebTransportAdapter } from "../../../server/dist/metaverse/adapters/metaverse-world-webtransport-adapter.js";
import { MetaverseRoomDirectory } from "../../../server/dist/metaverse/classes/metaverse-room-directory.js";
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

function createRoomBoundWorldServer(runtimeConfig = {}) {
  const roomDirectory = new MetaverseRoomDirectory({
    runtimeConfig
  });
  const roomAssignmentsByPlayerId = new Map();

  function ensurePlayerRoomAssignment(playerId, nowMs = 0) {
    const existingAssignment = roomAssignmentsByPlayerId.get(playerId);

    if (existingAssignment !== undefined) {
      return existingAssignment;
    }

    const roomAssignment = roomDirectory.quickJoinRoom(
      createMetaverseQuickJoinRoomRequest({
        matchMode: "free-roam",
        playerId
      }),
      nowMs
    );

    roomAssignmentsByPlayerId.set(playerId, roomAssignment);

    return roomAssignment;
  }

  return Object.freeze({
    datagramAdapter: new MetaverseRealtimeWorldWebTransportDatagramAdapter(
      roomDirectory
    ),
    ensurePlayerRoomAssignment,
    roomDirectory,
    runtime: Object.freeze({
      acceptPresenceCommand(command, nowMs) {
        return roomDirectory.acceptPresenceCommand(
          ensurePlayerRoomAssignment(command.playerId, nowMs).roomId,
          command,
          nowMs
        );
      },
      advanceToTime(nowMs) {
        roomDirectory.advanceToTime(nowMs);
      },
      readWorldSnapshot(nowMs, observerPlayerId) {
        if (observerPlayerId === undefined) {
          const firstAssignment =
            roomAssignmentsByPlayerId.values().next().value ?? null;

          if (firstAssignment === null) {
            throw new Error("No metaverse room assignment exists yet.");
          }

          return roomDirectory.readWorldSnapshot(firstAssignment.roomId, nowMs);
        }

        const roomAssignment = ensurePlayerRoomAssignment(observerPlayerId, nowMs);

        return roomDirectory.readWorldSnapshot(
          roomAssignment.roomId,
          nowMs,
          observerPlayerId
        );
      }
    }),
    worldAdapter: new MetaverseWorldWebTransportAdapter(roomDirectory)
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

function issueFireWeaponPlayerAction(
  client,
  {
    issuedAtAuthoritativeTimeMs,
    playerId,
    rayOriginWorld,
    weaponId
  }
) {
  return client.issuePlayerAction({
    action: {
      aimMode: "hip-fire",
      aimSnapshot: {
        pitchRadians: 0,
        rayForwardWorld: {
          x: 0,
          y: 0,
          z: -1
        },
        rayOriginWorld,
        yawRadians: 0
      },
      issuedAtAuthoritativeTimeMs,
      kind: "fire-weapon",
      weaponId
    },
    playerId
  });
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
    roomId,
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
      worldCommandPath: `/metaverse/rooms/${roomId}/world/commands`,
      worldPath: `/metaverse/rooms/${roomId}/world`
    },
    {
      clearTimeout: scheduler.clearTimeout,
      latestWinsDatagramTransport:
        createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport(
          {
            roomId,
            webTransportUrl:
              `https://127.0.0.1:3211/metaverse/rooms/${roomId}/world`
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
            roomId,
            webTransportUrl:
              `https://127.0.0.1:3211/metaverse/rooms/${roomId}/world`
          },
          {
            webTransportFactory: loopback.webTransportFactory
          }
        ),
      transport: createMetaverseWorldWebTransportTransport(
        {
          roomId,
          webTransportUrl:
            `https://127.0.0.1:3211/metaverse/rooms/${roomId}/world`
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
  const networkModule = await clientLoader.load("/src/network/index.ts");
  const worldServer = createRoomBoundWorldServer({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const { datagramAdapter, runtime, worldAdapter } = worldServer;
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
  const roomId = worldServer.ensurePlayerRoomAssignment(playerId, nowMs).roomId;

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const client = createLoopbackWorldClient(networkModule, {
    loopback,
    readNowMs: () => nowMs,
    roomId,
    scheduler
  });

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
    assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

    scheduler.runNext(0);
    await flushAsyncWork();

    const expectedMoveTraversalSequence =
      client.latestPlayerIssuedTraversalIntentSnapshot?.sequence ?? 0;
    assert.ok(expectedMoveTraversalSequence > 0);

    assert.equal(loopback.telemetry.datagramTraversalCount, 1);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);

    nowMs = Math.max(150, nowMs + 50);
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    const authoritativeMovedSnapshot = runtime.readWorldSnapshot(nowMs, playerId);

    assert.equal(
      authoritativeMovedSnapshot.observerPlayer?.lastProcessedTraversalSequence,
      expectedMoveTraversalSequence
    );

    const movedSnapshot = await waitFor(() => {
      const snapshot = client.worldSnapshotBuffer.at(-1);

      if (
        snapshot?.observerPlayer?.lastProcessedTraversalSequence !==
          expectedMoveTraversalSequence
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
      movedSnapshot.observerPlayer?.lastProcessedTraversalSequence,
      expectedMoveTraversalSequence
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
    assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

    scheduler.runNext(0);
    await flushAsyncWork();

    const expectedTurnTraversalSequence =
      client.latestPlayerIssuedTraversalIntentSnapshot?.sequence ?? 0;

    assert.ok(expectedTurnTraversalSequence > expectedMoveTraversalSequence);

    assert.equal(loopback.telemetry.datagramTraversalCount, 2);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);

    nowMs = 200;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    const authoritativeTurnedSnapshot = runtime.readWorldSnapshot(nowMs, playerId);

    assert.equal(
      authoritativeTurnedSnapshot.observerPlayer?.lastProcessedTraversalSequence,
      expectedTurnTraversalSequence
    );

    const turnedSnapshot = await waitFor(() => {
      const snapshot = client.worldSnapshotBuffer.at(-1);

      if (
        snapshot?.observerPlayer?.lastProcessedTraversalSequence !==
          expectedTurnTraversalSequence
      ) {
        return null;
      }

      return snapshot;
    }, "grounded traversal ack over snapshot stream");
    const turnedBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        requireValue(turnedSnapshot.players[0], "turnedPlayerSnapshot")
      );

    assert.equal(
      turnedSnapshot.observerPlayer?.lastProcessedTraversalSequence,
      expectedTurnTraversalSequence
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
  const worldServer = createRoomBoundWorldServer({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const { datagramAdapter, runtime, worldAdapter } = worldServer;
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
  const moverRoomId =
    worldServer.ensurePlayerRoomAssignment(moverPlayerId, nowMs).roomId;
  const observerRoomId =
    worldServer.ensurePlayerRoomAssignment(observerPlayerId, nowMs).roomId;

  assert.equal(observerRoomId, moverRoomId);

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
    roomId: moverRoomId,
    scheduler: moverScheduler
  });
  const observerRemoteWorldRuntime = new MetaverseRemoteWorldRuntime({
    createMetaverseWorldClient: () => {
      observerWorldClient = createLoopbackWorldClient(networkModule, {
        loopback: observerLoopback,
        readNowMs: () => nowMs,
        roomId: observerRoomId,
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
    moverScheduler.runNext(0);
    await flushAsyncWork();

    const expectedMoveTraversalSequence =
      moverClient.latestPlayerIssuedTraversalIntentSnapshot?.sequence ?? 0;

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
    moverScheduler.runNext(0);
    await flushAsyncWork();

    const expectedTurnTraversalSequence =
      moverClient.latestPlayerIssuedTraversalIntentSnapshot?.sequence ?? 0;

    assert.ok(expectedTurnTraversalSequence > expectedMoveTraversalSequence);

    nowMs = 1_200;
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

    nowMs = 1_250;
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
  const worldServer = createRoomBoundWorldServer({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const { datagramAdapter, runtime, worldAdapter } = worldServer;
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
  const roomId = worldServer.ensurePlayerRoomAssignment(localPlayerId, nowMs).roomId;

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
        roomId,
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

    const previewTraversalIntent =
      runtimeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

    assert.notEqual(previewTraversalIntent, null);
    assert.ok(previewTraversalIntent.sequence > 0);
    assert.equal(previewTraversalIntent.bodyControl.moveAxis, 0);

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
        nextAuthoritativeSnapshot.observerPlayer?.lastProcessedTraversalSequence ===
        previewTraversalIntent.sequence
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
        latestSnapshot?.observerPlayer?.lastProcessedTraversalSequence !==
        previewTraversalIntent.sequence
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
  const worldServer = createRoomBoundWorldServer({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const { datagramAdapter, runtime, worldAdapter } = worldServer;
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
  const roomId = worldServer.ensurePlayerRoomAssignment(localPlayerId, nowMs).roomId;

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
        roomId,
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

    nowMs += 1000 / 60;
    windowHarness.dispatch("keyup", {
      code: "Space"
    });
    windowHarness.advanceFrame(nowMs);

    await runScheduledTasksWithDelay(scheduler, 0);
    await waitFor(
      () =>
        loopback.telemetry.datagramTraversalCount >
        baselineTraversalDatagramCount
          ? true
          : null,
      "runtime jump traversal datagram send"
    );

    const jumpIssuedTraversalIntent =
      runtimeWorldClient.latestPlayerIssuedTraversalIntentSnapshot;

    assert.notEqual(jumpIssuedTraversalIntent, null);
    assert.equal(jumpIssuedTraversalIntent.actionIntent.kind, "jump");
    assert.equal(jumpIssuedTraversalIntent.actionIntent.pressed, true);
    assert.ok(jumpIssuedTraversalIntent.actionIntent.sequence > 0);

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
        nextAuthoritativeSnapshot.observerPlayer?.lastProcessedTraversalSequence ===
          jumpIssuedTraversalIntent.sequence &&
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
        latestSnapshot?.observerPlayer?.lastProcessedTraversalSequence !==
          jumpIssuedTraversalIntent.sequence
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
      jumpIssuedTraversalIntent.actionIntent.sequence
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
  const networkModule = await clientLoader.load("/src/network/index.ts");
  const worldServer = createRoomBoundWorldServer({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const { datagramAdapter, runtime, worldAdapter } = worldServer;
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
  const roomId = worldServer.ensurePlayerRoomAssignment(playerId, nowMs).roomId;

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const client = createLoopbackWorldClient(networkModule, {
    loopback,
    readNowMs: () => nowMs,
    roomId,
    scheduler
  });

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
    assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

    scheduler.runNext(0);
    await flushAsyncWork();

    assert.equal(loopback.telemetry.datagramTraversalCount, 1);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);
    assert.notEqual(loopback.telemetry.latestTraversalDatagram, null);
    assert.equal(
      loopback.telemetry.latestTraversalDatagram.intent.bodyControl.moveAxis,
      0
    );
    assert.equal(
      loopback.telemetry.latestTraversalDatagram.intent.bodyControl.strafeAxis,
      1
    );
    assert.ok(
      (loopback.telemetry.latestTraversalDatagram.pendingIntentSamples?.length ?? 0) >
        0
    );
    assert.ok(
      loopback.telemetry.latestTraversalDatagram.pendingIntentSamples?.some(
        (intentSample) => intentSample.bodyControl.moveAxis === 1
      ) ?? false
    );

    let authoritativePublishTimeMs = 100;
    let authoritativeSnapshot = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      nowMs = authoritativePublishTimeMs;
      await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);

      const nextAuthoritativeSnapshot = runtime.readWorldSnapshot(nowMs, playerId);

      if (
        (nextAuthoritativeSnapshot.observerPlayer?.lastProcessedTraversalSequence ?? 0) >
        0
      ) {
        authoritativeSnapshot = nextAuthoritativeSnapshot;
        break;
      }

      authoritativePublishTimeMs += 50;
    }

    assert.notEqual(authoritativeSnapshot, null);
    const authoritativeTraversalSequence =
      authoritativeSnapshot.observerPlayer?.lastProcessedTraversalSequence ?? 0;

    assert.ok(authoritativeTraversalSequence > 0);

    const acknowledgedSnapshot = await waitFor(() => {
      const snapshot = client.worldSnapshotBuffer.at(-1);

      if (
        snapshot?.observerPlayer?.lastProcessedTraversalSequence !==
          authoritativeTraversalSequence
      ) {
        return null;
      }

      return snapshot;
    }, "rapid short-lived traversal ack over WebTransport datagram traversal lane");
  } finally {
    client.dispose();
  }
});

test("MetaverseWorldClient keeps jump acceptance on the WebTransport traversal datagram lane instead of reliable commands", async () => {
  const networkModule = await clientLoader.load("/src/network/index.ts");
  const worldServer = createRoomBoundWorldServer({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const { datagramAdapter, runtime, worldAdapter } = worldServer;
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
  const roomId = worldServer.ensurePlayerRoomAssignment(playerId, nowMs).roomId;

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const client = createLoopbackWorldClient(networkModule, {
    loopback,
    readNowMs: () => nowMs,
    roomId,
    scheduler
  });

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
    assert.equal(scheduler.pendingTasks.at(-1)?.delay, 0);

    scheduler.runNext(0);
    await flushAsyncWork();

    const expectedJumpInputSequence = client.latestPlayerTraversalSequence;

    assert.ok(expectedJumpInputSequence > 0);

    assert.equal(loopback.telemetry.datagramTraversalCount, 1);
    assert.equal(loopback.telemetry.reliableCommandRequestCount, 0);

    nowMs = 150;
    await publishAuthoritativeWorld(runtime, worldAdapter, nowMs);
    const authoritativeJumpSnapshot = runtime.readWorldSnapshot(nowMs, playerId);

    assert.equal(
      authoritativeJumpSnapshot.observerPlayer?.lastProcessedTraversalSequence,
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
        snapshot?.observerPlayer?.lastProcessedTraversalSequence !==
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
  const networkModule = await clientLoader.load("/src/network/index.ts");
  const worldServer = createRoomBoundWorldServer({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const { datagramAdapter, runtime, worldAdapter } = worldServer;
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
  const roomId = worldServer.ensurePlayerRoomAssignment(playerId, nowMs).roomId;

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const client = createLoopbackWorldClient(networkModule, {
    loopback,
    readNowMs: () => nowMs,
    roomId,
    scheduler
  });

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
      activeSlotId: "primary",
      aimMode: "ads",
      slots: [
        {
          attachmentId: "metaverse-service-pistol-v1",
          equipped: true,
          slotId: "primary",
          weaponId: "metaverse-service-pistol-v1",
          weaponInstanceId: "primary:metaverse-service-pistol-v1"
        }
      ],
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
      activeSlotId: "primary",
      aimMode: "ads",
      slots: [
        {
          attachmentId: "metaverse-service-pistol-v1",
          equipped: true,
          slotId: "primary",
          weaponId: "metaverse-service-pistol-v1",
          weaponInstanceId: "primary:metaverse-service-pistol-v1"
        }
      ],
      weaponId: "metaverse-service-pistol-v1"
    });
  } finally {
    client.dispose();
  }
});

test("MetaverseWorldClient keeps reliable fire-weapon command responses observer-qualified over WebTransport", async () => {
  const networkModule = await clientLoader.load("/src/network/index.ts");
  const worldServer = createRoomBoundWorldServer({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(50)
  });
  const { datagramAdapter, runtime, worldAdapter } = worldServer;
  const playerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-fire-pilot"),
    "playerId"
  );
  const remotePlayerId = requireValue(
    createMetaversePlayerId("loopback-webtransport-fire-target"),
    "remotePlayerId"
  );
  const username = requireValue(
    createUsername("Loopback Fire Pilot"),
    "username"
  );
  const remoteUsername = requireValue(
    createUsername("Loopback Fire Target"),
    "remoteUsername"
  );
  const scheduler = createManualTimerScheduler();
  let nowMs = 0;

  joinGroundedPlayer(runtime, playerId, username);
  joinGroundedPlayer(
    runtime,
    remotePlayerId,
    remoteUsername,
    {
      x: 0,
      y: 1.62,
      z: 15
    }
  );
  const roomId = worldServer.ensurePlayerRoomAssignment(playerId, nowMs).roomId;
  worldServer.ensurePlayerRoomAssignment(remotePlayerId, nowMs);

  const loopback = createMetaverseWorldWebTransportLoopback({
    datagramAdapter,
    readNowMs: () => nowMs,
    worldAdapter
  });
  const client = createLoopbackWorldClient(networkModule, {
    loopback,
    readNowMs: () => nowMs,
    roomId,
    scheduler
  });

  try {
    await client.ensureConnected(playerId);
    await waitFor(
      () =>
        loopback.telemetry.snapshotSubscribeCount === 1 ? true : null,
      "authoritative world snapshot-stream subscribe"
    );

    const initialSnapshotSequence =
      client.worldSnapshotBuffer.at(-1)?.snapshotSequence ?? 0;

    assert.ok(initialSnapshotSequence > 0);

    nowMs = 1_200;
    issueFireWeaponPlayerAction(client, {
      issuedAtAuthoritativeTimeMs: 1_200,
      playerId,
      rayOriginWorld: {
        x: 0,
        y: 1.62,
        z: 24
      },
      weaponId: "metaverse-service-pistol-v2"
    });
    scheduler.runNext(0);

    const commandSnapshot = await waitFor(() => {
      if (loopback.telemetry.reliableCommandRequestCount !== 1) {
        return null;
      }

      const latestSnapshot = client.worldSnapshotBuffer.at(-1) ?? null;

      if (
        latestSnapshot === null ||
        latestSnapshot.snapshotSequence <= initialSnapshotSequence
      ) {
        return null;
      }

      return latestSnapshot;
    }, "observer-qualified fire-weapon command snapshot");

    assert.equal(loopback.telemetry.datagramWeaponCount, 0);
    assert.equal(client.statusSnapshot.state, "connected");
    assert.equal(client.statusSnapshot.connected, true);
    assert.equal(client.statusSnapshot.lastError, null);
    assert.equal(commandSnapshot.observerPlayer?.playerId, playerId);
    assert.equal(commandSnapshot.players[0]?.playerId, playerId);
  } finally {
    client.dispose();
  }
});
