import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  FakeMetaverseWorldClient,
  createRealtimeWorldSnapshot
} from "../runtime/fixtures/fake-world-client.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRemoteWorldSamplingState samples buffered snapshots against target server time and feeds presentation ownership", async () => {
  const [
    { AuthoritativeServerClock },
    { MetaverseRemoteWorldSamplingState }
  ] = await Promise.all([
    clientLoader.load("/src/network/classes/authoritative-server-clock.ts"),
    clientLoader.load(
      "/src/metaverse/remote-world/metaverse-remote-world-sampling-state.ts"
    )
  ]);
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  const sampledInputs = [];
  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 10,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 8,
      remoteUsername,
      serverTimeMs: 1_000,
      snapshotSequence: 1,
      vehicleX: 8,
      yawRadians: 0
    }),
    createRealtimeWorldSnapshot({
      currentTick: 11,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 11,
      remoteUsername,
      serverTimeMs: 1_150,
      snapshotSequence: 2,
      vehicleX: 11,
      yawRadians: 0.2
    })
  ]);
  const samplingState = new MetaverseRemoteWorldSamplingState({
    authoritativeServerClock: new AuthoritativeServerClock({
      clockOffsetCorrectionAlpha: 1,
      clockOffsetMaxStepMs: 1_000
    }),
    interpolationDelayMs: 75,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username: localUsername
    },
    maxExtrapolationMs: 120,
    presentationState: {
      clear() {
        sampledInputs.push("clear");
      },
      syncAuthoritativeSample(input) {
        sampledInputs.push(input);
        return input.sampledFrame.extrapolationSeconds * 1000;
      }
    },
    readWallClockMs: () => 1_100,
    readWorldClient: () => fakeWorldClient,
    remoteCharacterRootInterpolationDelayMs: 0,
    remoteCharacterRootMaxExtrapolationMs: 0
  });

  samplingState.sampleRemoteWorld();

  assert.equal(sampledInputs.length, 1);
  assert.equal(sampledInputs[0].localPlayerId, localPlayerId);
  assert.equal(sampledInputs[0].deltaSeconds, 0);
  assert.equal(sampledInputs[0].sampledFrame.alpha, 0.5);
  assert.equal(sampledInputs[0].sampledFrame.baseSnapshot.snapshotSequence, 1);
  assert.equal(sampledInputs[0].sampledFrame.nextSnapshot?.snapshotSequence, 2);
  assert.equal(sampledInputs[0].remoteCharacterRootFrame.alpha, 1);
  assert.equal(
    sampledInputs[0].remoteCharacterRootFrame.baseSnapshot.snapshotSequence,
    1
  );
  assert.equal(
    sampledInputs[0].remoteCharacterRootFrame.nextSnapshot?.snapshotSequence,
    2
  );
  assert.equal(samplingState.latestAuthoritativeTickIntervalMs, 50);
  assert.equal(samplingState.samplingTelemetrySnapshot.bufferDepth, 2);
  assert.equal(samplingState.samplingTelemetrySnapshot.currentExtrapolationMs, 0);
  assert.equal(samplingState.samplingTelemetrySnapshot.extrapolatedFramePercent, 0);
  assert.equal(
    samplingState.snapshotStreamTelemetrySnapshot.path,
    "http-polling"
  );
});

test("MetaverseRemoteWorldSamplingState anchors remote interpolation to the received simulation timeline", async () => {
  const [
    { AuthoritativeServerClock },
    { MetaverseRemoteWorldSamplingState }
  ] = await Promise.all([
    clientLoader.load("/src/network/classes/authoritative-server-clock.ts"),
    clientLoader.load(
      "/src/metaverse/remote-world/metaverse-remote-world-sampling-state.ts"
    )
  ]);
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  const sampledInputs = [];
  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 10,
      emittedAtServerTimeMs: 1_060,
      includeVehicle: false,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 8,
      remoteUsername,
      serverTimeMs: 1_060,
      simulationTimeMs: 1_000,
      snapshotSequence: 1,
      tickIntervalMs: 33,
      vehicleSeatOccupantPlayerId: null,
      yawRadians: 0
    }),
    createRealtimeWorldSnapshot({
      currentTick: 11,
      emittedAtServerTimeMs: 1_093,
      includeVehicle: false,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 11,
      remoteUsername,
      serverTimeMs: 1_093,
      simulationTimeMs: 1_033,
      snapshotSequence: 2,
      tickIntervalMs: 33,
      vehicleSeatOccupantPlayerId: null,
      yawRadians: 0.2
    })
  ]);

  fakeWorldClient.latestAcceptedSnapshotReceivedAtMs = 1_170;

  const samplingState = new MetaverseRemoteWorldSamplingState({
    authoritativeServerClock: new AuthoritativeServerClock({
      clockOffsetCorrectionAlpha: 1,
      clockOffsetMaxStepMs: 1_000
    }),
    interpolationDelayMs: 50,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username: localUsername
    },
    maxExtrapolationMs: 120,
    presentationState: {
      clear() {
        sampledInputs.push("clear");
      },
      syncAuthoritativeSample(input) {
        sampledInputs.push(input);
        return input.sampledFrame.extrapolationSeconds * 1000;
      }
    },
    readWallClockMs: () => 1_203,
    readWorldClient: () => fakeWorldClient,
    remoteCharacterRootInterpolationDelayMs: 50,
    remoteCharacterRootMaxExtrapolationMs: 0
  });

  samplingState.sampleRemoteWorld();

  assert.equal(sampledInputs.length, 1);
  assert.equal(sampledInputs[0].sampledFrame.baseSnapshot.snapshotSequence, 1);
  assert.equal(sampledInputs[0].sampledFrame.nextSnapshot?.snapshotSequence, 2);
  assert.equal(sampledInputs[0].sampledFrame.extrapolationSeconds, 0);
  assert.ok(
    Math.abs(sampledInputs[0].sampledFrame.alpha - 16 / 33) < 0.000001
  );
  assert.equal(
    sampledInputs[0].remoteCharacterRootFrame.baseSnapshot.snapshotSequence,
    1
  );
  assert.equal(
    sampledInputs[0].remoteCharacterRootFrame.nextSnapshot?.snapshotSequence,
    2
  );
  assert.equal(
    sampledInputs[0].remoteCharacterRootFrame.extrapolationSeconds,
    0
  );
  assert.equal(samplingState.samplingTelemetrySnapshot.currentExtrapolationMs, 0);
  assert.equal(samplingState.samplingTelemetrySnapshot.latestSimulationAgeMs, 33);
});

test("MetaverseRemoteWorldSamplingState tracks extrapolation and datagram telemetry without hiding the world-client truth", async () => {
  const [
    { AuthoritativeServerClock },
    { MetaverseRemoteWorldSamplingState }
  ] = await Promise.all([
    clientLoader.load("/src/network/classes/authoritative-server-clock.ts"),
    clientLoader.load(
      "/src/metaverse/remote-world/metaverse-remote-world-sampling-state.ts"
    )
  ]);
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_000;
  let clearCount = 0;
  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 10,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 8,
      remoteUsername,
      serverTimeMs: 1_000,
      snapshotSequence: 1,
      vehicleX: 8,
      yawRadians: 0
    })
  ]);

  fakeWorldClient.telemetrySnapshot = Object.freeze({
    driverVehicleControlDatagramSendFailureCount: 2,
    latestSnapshotUpdateRateHz: 20,
    playerLookInputDatagramSendFailureCount: 0,
    playerTraversalInputDatagramSendFailureCount: 1,
    snapshotStream: Object.freeze({
      available: true,
      fallbackActive: false,
      lastTransportError: null,
      liveness: "subscribed",
      path: "reliable-snapshot-stream",
      reconnectCount: 1
    })
  });

  const samplingState = new MetaverseRemoteWorldSamplingState({
    authoritativeServerClock: new AuthoritativeServerClock({
      clockOffsetCorrectionAlpha: 1,
      clockOffsetMaxStepMs: 1_000
    }),
    interpolationDelayMs: 0,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username: localUsername
    },
    maxExtrapolationMs: 120,
    presentationState: {
      clear() {
        clearCount += 1;
      },
      syncAuthoritativeSample(input) {
        return input.sampledFrame.extrapolationSeconds * 1000;
      }
    },
    readWallClockMs: () => currentWallClockMs,
    readWorldClient: () => fakeWorldClient,
    remoteCharacterRootInterpolationDelayMs: 0,
    remoteCharacterRootMaxExtrapolationMs: 0
  });

  samplingState.sampleRemoteWorld();
  currentWallClockMs = 1_060;
  samplingState.sampleRemoteWorld();

  assert.equal(samplingState.samplingTelemetrySnapshot.clockOffsetEstimateMs, 0);
  assert.equal(samplingState.samplingTelemetrySnapshot.currentExtrapolationMs, 60);
  assert.equal(samplingState.samplingTelemetrySnapshot.datagramSendFailureCount, 3);
  assert.equal(samplingState.samplingTelemetrySnapshot.extrapolatedFramePercent, 50);
  assert.equal(samplingState.samplingTelemetrySnapshot.latestSimulationAgeMs, 60);
  assert.equal(samplingState.samplingTelemetrySnapshot.latestSnapshotUpdateRateHz, 20);
  assert.equal(
    samplingState.snapshotStreamTelemetrySnapshot.liveness,
    "subscribed"
  );

  samplingState.reset();

  assert.equal(clearCount, 1);
  assert.equal(samplingState.samplingTelemetrySnapshot.currentExtrapolationMs, 0);
  assert.equal(samplingState.samplingTelemetrySnapshot.extrapolatedFramePercent, 0);
});
