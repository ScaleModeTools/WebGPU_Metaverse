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

function wrapRadians(rawValue) {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let nextValue = rawValue;

  while (nextValue > Math.PI) {
    nextValue -= Math.PI * 2;
  }

  while (nextValue <= -Math.PI) {
    nextValue += Math.PI * 2;
  }

  return nextValue;
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRemoteWorldRuntime samples buffered authoritative world snapshots against server time", async () => {
  const { MetaverseRemoteWorldRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-remote-world-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 10,
      environmentBodyX: 4,
      environmentBodyYawRadians: -0.2,
      includeEnvironmentBody: true,
      localPlayerId,
      localUsername,
      remoteLookPitchRadians: -0.3,
      remoteLookYawRadians: 0.2,
      remotePlayerAngularVelocityRadiansPerSecond: 1,
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
      environmentBodyX: 7,
      environmentBodyYawRadians: 0.2,
      includeEnvironmentBody: true,
      localPlayerId,
      localUsername,
      remoteLookPitchRadians: 0.1,
      remoteLookYawRadians: 0.6,
      remotePlayerId,
      remotePlayerX: 11,
      remoteUsername,
      serverTimeMs: 1_150,
      snapshotSequence: 2,
      vehicleX: 11,
      yawRadians: 0.2
    })
  ]);
  const remoteWorldRuntime = new MetaverseRemoteWorldRuntime({
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username: localUsername
    },
    onRemoteWorldUpdate() {},
    readWallClockMs: () => 1_100,
    samplingConfig: {
      clockOffsetCorrectionAlpha: 1,
      clockOffsetMaxStepMs: 1_000,
      interpolationDelayMs: 75,
      maxExtrapolationMs: 120,
      remoteCharacterRootInterpolationDelayMs: 0,
      remoteCharacterRootMaxExtrapolationMs: 0
    }
  });

  remoteWorldRuntime.boot();
  remoteWorldRuntime.sampleRemoteWorld();

  assert.equal(remoteWorldRuntime.hasWorldSnapshot, true);
  assert.equal(remoteWorldRuntime.remoteCharacterPresentations.length, 1);
  assert.equal(
    remoteWorldRuntime.remoteCharacterPresentations[0]?.poseSyncMode,
    "runtime-server-sampled"
  );
  assert.ok(
    Math.abs(
      remoteWorldRuntime.remoteCharacterPresentations[0]?.presentation.position.x -
        11
    ) < 0.000001
  );
  assert.equal(
    remoteWorldRuntime.remoteCharacterPresentations[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
  assert.ok(
    Math.abs(
      (remoteWorldRuntime.remoteCharacterPresentations[0]?.look.pitchRadians ?? 0) +
        0.1
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      (remoteWorldRuntime.remoteCharacterPresentations[0]?.look.yawRadians ?? 0) -
        0.4
    ) < 0.000001
  );
  assert.equal(remoteWorldRuntime.remoteVehiclePresentations.length, 1);
  assert.ok(
    Math.abs(remoteWorldRuntime.remoteVehiclePresentations[0]?.position.x - 9.5) <
      0.000001
  );
  assert.ok(
    Math.abs(remoteWorldRuntime.remoteVehiclePresentations[0]?.yawRadians - 0.1) <
      0.000001
  );
  assert.equal(remoteWorldRuntime.remoteEnvironmentBodyPresentations.length, 1);
  assert.ok(
    Math.abs(
      remoteWorldRuntime.remoteEnvironmentBodyPresentations[0]?.position.x - 5.5
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      remoteWorldRuntime.remoteEnvironmentBodyPresentations[0]?.yawRadians
    ) < 0.000001
  );

  remoteWorldRuntime.dispose();

  assert.equal(fakeWorldClient.disposeCalls, 1);
});

test("MetaverseRemoteWorldRuntime extrapolates from the latest authoritative snapshot when a newer snapshot is missing", async () => {
  const { MetaverseRemoteWorldRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-remote-world-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 10,
      localPlayerId,
      localUsername,
      remoteLookPitchRadians: -0.25,
      remoteLookYawRadians: 0.4,
      remotePlayerAngularVelocityRadiansPerSecond: 1,
      remotePlayerId,
      remotePlayerX: 8,
      remoteUsername,
      serverTimeMs: 1_000,
      snapshotSequence: 1,
      vehicleX: 8,
      yawRadians: 0
    })
  ]);
  let currentWallClockMs = 1_000;
  const remoteWorldRuntime = new MetaverseRemoteWorldRuntime({
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username: localUsername
    },
    onRemoteWorldUpdate() {},
    readWallClockMs: () => currentWallClockMs,
    samplingConfig: {
      clockOffsetCorrectionAlpha: 1,
      clockOffsetMaxStepMs: 1_000,
      interpolationDelayMs: 0,
      maxExtrapolationMs: 120,
      remoteCharacterRootInterpolationDelayMs: 0,
      remoteCharacterRootMaxExtrapolationMs: 0
    }
  });

  remoteWorldRuntime.boot();
  remoteWorldRuntime.sampleRemoteWorld();

  currentWallClockMs = 1_060;
  remoteWorldRuntime.sampleRemoteWorld();

  assert.equal(remoteWorldRuntime.remoteCharacterPresentations.length, 1);
  assert.ok(
    Math.abs(
      remoteWorldRuntime.remoteCharacterPresentations[0]?.presentation.position.x -
        8
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      wrapRadians(
        (remoteWorldRuntime.remoteCharacterPresentations[0]?.presentation
          .yawRadians ?? 0) - 0.06
      )
    ) < 0.000001
  );
  assert.equal(
    remoteWorldRuntime.remoteCharacterPresentations[0]?.look.pitchRadians,
    -0.25
  );
  assert.equal(
    remoteWorldRuntime.remoteCharacterPresentations[0]?.look.yawRadians,
    0.4
  );
  assert.equal(remoteWorldRuntime.remoteVehiclePresentations.length, 1);
  assert.ok(
    (remoteWorldRuntime.remoteVehiclePresentations[0]?.position.x ?? 0) > 8
  );
  assert.ok(
    (remoteWorldRuntime.remoteVehiclePresentations[0]?.position.x ?? 0) < 9.2
  );
  assert.ok(
    (remoteWorldRuntime.remoteVehiclePresentations[0]?.yawRadians ?? 0) > 0
  );
  assert.ok(
    (remoteWorldRuntime.remoteVehiclePresentations[0]?.yawRadians ?? 0) < 0.08
  );

  remoteWorldRuntime.dispose();
});

test("MetaverseRemoteWorldRuntime exposes authoritative snapshot timing telemetry", async () => {
  const { MetaverseRemoteWorldRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-remote-world-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 10,
      localPlayerId,
      localUsername,
      remotePlayerAngularVelocityRadiansPerSecond: 1,
      remotePlayerId,
      remotePlayerX: 8,
      remoteUsername,
      serverTimeMs: 1_000,
      snapshotSequence: 1,
      vehicleX: 8,
      yawRadians: 0
    })
  ]);
  let currentWallClockMs = 1_000;

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

  const remoteWorldRuntime = new MetaverseRemoteWorldRuntime({
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username: localUsername
    },
    onRemoteWorldUpdate() {},
    readWallClockMs: () => currentWallClockMs,
    samplingConfig: {
      clockOffsetCorrectionAlpha: 1,
      clockOffsetMaxStepMs: 1_000,
      interpolationDelayMs: 0,
      maxExtrapolationMs: 120,
      remoteCharacterRootInterpolationDelayMs: 0,
      remoteCharacterRootMaxExtrapolationMs: 0
    }
  });

  remoteWorldRuntime.boot();
  remoteWorldRuntime.sampleRemoteWorld();

  currentWallClockMs = 1_060;
  remoteWorldRuntime.sampleRemoteWorld();

  assert.equal(remoteWorldRuntime.samplingTelemetrySnapshot.bufferDepth, 1);
  assert.equal(remoteWorldRuntime.samplingTelemetrySnapshot.clockOffsetEstimateMs, 0);
  assert.equal(
    remoteWorldRuntime.samplingTelemetrySnapshot.currentExtrapolationMs,
    60
  );
  assert.equal(
    remoteWorldRuntime.samplingTelemetrySnapshot.datagramSendFailureCount,
    3
  );
  assert.equal(
    remoteWorldRuntime.samplingTelemetrySnapshot.extrapolatedFramePercent,
    50
  );
  assert.equal(
    remoteWorldRuntime.samplingTelemetrySnapshot.latestSimulationAgeMs,
    60
  );
  assert.equal(
    remoteWorldRuntime.samplingTelemetrySnapshot.latestSnapshotUpdateRateHz,
    20
  );
  assert.equal(
    remoteWorldRuntime.snapshotStreamTelemetrySnapshot.path,
    "reliable-snapshot-stream"
  );
  assert.equal(
    remoteWorldRuntime.snapshotStreamTelemetrySnapshot.liveness,
    "subscribed"
  );

  remoteWorldRuntime.dispose();
});
