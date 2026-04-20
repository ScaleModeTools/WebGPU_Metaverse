import {
  createCoopPlayerId,
  createCoopRoomId,
  createCoopRoomSnapshot,
  createCoopSessionId,
  createMetaversePlayerId,
  createMetaverseRealtimeWorldSnapshot,
  createMetaverseVehicleId,
  createUsername
} from "@webgpu-metaverse/shared";

function interpolateScalar(startValue, endValue, amount) {
  return startValue + (endValue - startValue) * amount;
}

function interpolatePoint(openPoint, pressedPoint, triggerCurl) {
  return {
    x: interpolateScalar(openPoint.x, pressedPoint.x, triggerCurl),
    y: interpolateScalar(openPoint.y, pressedPoint.y, triggerCurl),
    z: interpolateScalar(openPoint.z, pressedPoint.z, triggerCurl)
  };
}

function createTrackedPose(x, y, triggerCurl = 0) {
  const normalizedTriggerCurl = Math.min(1, Math.max(0, triggerCurl));
  const openPose = {
    handPivot: { x: x - 0.025, y: y + 0.18, z: 0.05 },
    thumbBase: { x: x - 0.105, y: y + 0.1, z: 0.024 },
    thumbKnuckle: { x: x - 0.145, y: y + 0.075, z: 0.018 },
    thumbJoint: { x: x - 0.175, y: y + 0.048, z: 0.012 },
    thumbTip: { x: x - 0.205, y: y + 0.02, z: 0.006 },
    indexBase: { x: x - 0.015, y: y + 0.11, z: 0.03 },
    indexKnuckle: { x: x - 0.01, y: y + 0.075, z: 0.018 },
    indexJoint: { x: x - 0.005, y: y + 0.038, z: 0.008 },
    indexTip: { x, y, z: 0 },
    middlePip: { x: x - 0.03, y: y + 0.02, z: 0.02 }
  };
  const pressedPose = {
    handPivot: openPose.handPivot,
    thumbBase: { x: x - 0.078, y: y + 0.097, z: 0.02 },
    thumbKnuckle: { x: x - 0.06, y: y + 0.075, z: 0.014 },
    thumbJoint: { x: x - 0.045, y: y + 0.048, z: 0.009 },
    thumbTip: { x: x - 0.03, y: y + 0.022, z: 0.003 },
    indexBase: openPose.indexBase,
    indexKnuckle: openPose.indexKnuckle,
    indexJoint: openPose.indexJoint,
    indexTip: openPose.indexTip,
    middlePip: openPose.middlePip
  };

  return {
    handPivot: interpolatePoint(
      openPose.handPivot,
      pressedPose.handPivot,
      normalizedTriggerCurl
    ),
    thumbBase: interpolatePoint(
      openPose.thumbBase,
      pressedPose.thumbBase,
      normalizedTriggerCurl
    ),
    thumbKnuckle: interpolatePoint(
      openPose.thumbKnuckle,
      pressedPose.thumbKnuckle,
      normalizedTriggerCurl
    ),
    thumbJoint: interpolatePoint(
      openPose.thumbJoint,
      pressedPose.thumbJoint,
      normalizedTriggerCurl
    ),
    thumbTip: interpolatePoint(
      openPose.thumbTip,
      pressedPose.thumbTip,
      normalizedTriggerCurl
    ),
    indexBase: interpolatePoint(
      openPose.indexBase,
      pressedPose.indexBase,
      normalizedTriggerCurl
    ),
    indexKnuckle: interpolatePoint(
      openPose.indexKnuckle,
      pressedPose.indexKnuckle,
      normalizedTriggerCurl
    ),
    indexJoint: interpolatePoint(
      openPose.indexJoint,
      pressedPose.indexJoint,
      normalizedTriggerCurl
    ),
    indexTip: interpolatePoint(
      openPose.indexTip,
      pressedPose.indexTip,
      normalizedTriggerCurl
    ),
    middlePip: interpolatePoint(
      openPose.middlePip,
      pressedPose.middlePip,
      normalizedTriggerCurl
    )
  };
}

function createTrackedSnapshot(sequenceNumber, x, y, triggerCurl = 0) {
  return {
    trackingState: "tracked",
    sequenceNumber,
    timestampMs: sequenceNumber * 8,
    pose: createTrackedPose(x, y, triggerCurl)
  };
}

function expectNonNullValue(value, label) {
  if (value === null) {
    throw new Error(`WebGPU Metaverse bench failed to create ${label}.`);
  }

  return value;
}

function appendBoundedSnapshotBuffer(snapshotBuffer, snapshot, maxSnapshots) {
  const nextBuffer =
    snapshotBuffer.length >= maxSnapshots
      ? snapshotBuffer.slice(snapshotBuffer.length - maxSnapshots + 1)
      : snapshotBuffer.slice();

  nextBuffer.push(snapshot);

  return Object.freeze(nextBuffer);
}

function resolveLatestSnapshotUpdateRateHz(snapshotBuffer) {
  if (snapshotBuffer.length < 2) {
    return null;
  }

  const previousSnapshot = snapshotBuffer[snapshotBuffer.length - 2];
  const latestSnapshot = snapshotBuffer[snapshotBuffer.length - 1];
  const updateIntervalMs = Math.max(
    1,
    Number(latestSnapshot.tick.emittedAtServerTimeMs) -
      Number(previousSnapshot.tick.emittedAtServerTimeMs)
  );

  return 1000 / updateIntervalMs;
}

const benchmarkFrameCountPerWindow = 60;
const battleCadenceBenchmarkConfig = Object.freeze({
  benchmarkWindowMs: 1000,
  candidateTickIntervalsMs: Object.freeze([50, 40, 33, 25]),
  duckHuntCoopArenaSimulation: Object.freeze({
    iterations: 500,
    maxMeanNs: 650_000
  }),
  frameDeltaMs: 1000 / benchmarkFrameCountPerWindow,
  maxBufferedSnapshots: 6,
  metaverseRemoteWorldRuntime: Object.freeze({
    iterations: 500,
    maxMeanNs: 350_000
  })
});

const defaultMetaverseWorldSnapshotStreamTelemetrySnapshot = Object.freeze({
  available: false,
  fallbackActive: false,
  lastTransportError: null,
  liveness: "inactive",
  path: "http-polling",
  reconnectCount: 0
});

const defaultCoopRoomSnapshotStreamTelemetrySnapshot = Object.freeze({
  available: false,
  fallbackActive: false,
  lastTransportError: null,
  liveness: "inactive",
  path: "http-polling",
  reconnectCount: 0
});

class FakeMetaverseWorldClient {
  constructor(tickIntervalMs) {
    this.currentPollIntervalMs = tickIntervalMs;
    this.driverVehicleControlDatagramStatusSnapshot = Object.freeze({
      activeTransport: null,
      browserWebTransportAvailable: false,
      enabled: true,
      lastTransportError: null,
      preference: "http",
      state: "unavailable",
      webTransportConfigured: false,
      webTransportStatus: "not-requested"
    });
    this.reliableTransportStatusSnapshot = Object.freeze({
      activeTransport: "http",
      browserWebTransportAvailable: false,
      enabled: true,
      fallbackActive: false,
      lastTransportError: null,
      preference: "http",
      webTransportConfigured: false,
      webTransportStatus: "not-requested"
    });
    this.statusSnapshot = Object.freeze({
      connected: true,
      lastError: null,
      lastSnapshotSequence: null,
      lastWorldTick: null,
      playerId: null,
      state: "connected"
    });
    this.telemetrySnapshot = Object.freeze({
      driverVehicleControlDatagramSendFailureCount: 0,
      latestSnapshotUpdateRateHz: null,
      snapshotStream: defaultMetaverseWorldSnapshotStreamTelemetrySnapshot
    });
    this.worldSnapshotBuffer = Object.freeze([]);
  }

  ensureConnected(playerId) {
    this.statusSnapshot = Object.freeze({
      connected: true,
      lastError: null,
      lastSnapshotSequence: this.statusSnapshot.lastSnapshotSequence,
      lastWorldTick: this.statusSnapshot.lastWorldTick,
      playerId,
      state: "connected"
    });

    return Promise.resolve(this.worldSnapshotBuffer[this.worldSnapshotBuffer.length - 1]);
  }

  publishWorldSnapshot(snapshot) {
    this.worldSnapshotBuffer = appendBoundedSnapshotBuffer(
      this.worldSnapshotBuffer,
      snapshot,
      battleCadenceBenchmarkConfig.maxBufferedSnapshots
    );
    this.statusSnapshot = Object.freeze({
      connected: true,
      lastError: null,
      lastSnapshotSequence: snapshot.snapshotSequence,
      lastWorldTick: snapshot.tick.currentTick,
      playerId: this.statusSnapshot.playerId,
      state: "connected"
    });
    this.telemetrySnapshot = Object.freeze({
      driverVehicleControlDatagramSendFailureCount: 0,
      latestSnapshotUpdateRateHz: resolveLatestSnapshotUpdateRateHz(
        this.worldSnapshotBuffer
      ),
      snapshotStream: defaultMetaverseWorldSnapshotStreamTelemetrySnapshot
    });
  }

  subscribeUpdates() {
    return () => {};
  }

  syncDriverVehicleControl() {}

  dispose() {}
}

function createMetaverseBenchmarkWorldSnapshot({
  currentTick,
  localPlayerId,
  localUsername,
  remotePlayerId,
  remoteUsername,
  tickIntervalMs,
  vehicleId
}) {
  const simulationTimeMs = currentTick * tickIntervalMs;
  const simulationSeconds = simulationTimeMs / 1000;

  return createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        angularVelocityRadiansPerSecond: 0,
        characterId: "mesh2motion-humanoid-v1",
        linearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        locomotionMode: "grounded",
        playerId: localPlayerId,
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: currentTick,
        username: localUsername,
        yawRadians: 0
      },
      {
        angularVelocityRadiansPerSecond: 0.9,
        animationVocabulary: "walk",
        characterId: "mesh2motion-humanoid-v1",
        linearVelocity: {
          x: Math.cos(simulationSeconds * 1.2) * 7.2,
          y: 0,
          z: -Math.sin(simulationSeconds * 0.8) * 2.4
        },
        locomotionMode: "grounded",
        playerId: remotePlayerId,
        position: {
          x: Math.sin(simulationSeconds * 1.2) * 6,
          y: 1.62,
          z: 18 + Math.cos(simulationSeconds * 0.8) * 3
        },
        stateSequence: currentTick,
        username: remoteUsername,
        yawRadians: simulationSeconds * 0.9
      }
    ],
    snapshotSequence: currentTick + 1,
    tick: {
      currentTick,
      emittedAtServerTimeMs: simulationTimeMs,
      simulationTimeMs,
      tickIntervalMs
    },
    vehicles: [
      {
        angularVelocityRadiansPerSecond: 0.45,
        environmentAssetId: "metaverse-hub-skiff-v1",
        linearVelocity: {
          x: -Math.sin(simulationSeconds * 0.7) * 2.8,
          y: 0,
          z: Math.cos(simulationSeconds * 0.6) * 3
        },
        position: {
          x: Math.cos(simulationSeconds * 0.7) * 4,
          y: 0.35,
          z: 16 + Math.sin(simulationSeconds * 0.6) * 5
        },
        seats: [],
        vehicleId,
        yawRadians: simulationSeconds * 0.45
      }
    ]
  });
}

function createMetaverseRemoteWorldCadenceBenchmarkSuite(
  MetaverseRemoteWorldRuntime,
  samplingConfig,
  tickIntervalMs
) {
  const localPlayerId = expectNonNullValue(
    createMetaversePlayerId("bench-local-pilot"),
    "bench local metaverse player id"
  );
  const remotePlayerId = expectNonNullValue(
    createMetaversePlayerId("bench-remote-scout"),
    "bench remote metaverse player id"
  );
  const localUsername = expectNonNullValue(
    createUsername("Bench Local Pilot"),
    "bench local metaverse username"
  );
  const remoteUsername = expectNonNullValue(
    createUsername("Bench Remote Scout"),
    "bench remote metaverse username"
  );
  const vehicleId = expectNonNullValue(
    createMetaverseVehicleId("metaverse-bench-skiff-v1"),
    "bench metaverse vehicle id"
  );

  return {
    id: `metaverse-remote-world-runtime.one-second.tick-${tickIntervalMs}ms`,
    iterations: battleCadenceBenchmarkConfig.metaverseRemoteWorldRuntime.iterations,
    maxMeanNs: battleCadenceBenchmarkConfig.metaverseRemoteWorldRuntime.maxMeanNs,
    setup() {
      const fakeWorldClient = new FakeMetaverseWorldClient(tickIntervalMs);
      let wallClockMs = 0;
      let nextSnapshotTick = 0;

      const runtime = new MetaverseRemoteWorldRuntime({
        createMetaverseWorldClient: () => fakeWorldClient,
        localPlayerIdentity: {
          characterId: "mesh2motion-humanoid-v1",
          playerId: localPlayerId,
          username: localUsername
        },
        onRemoteWorldUpdate() {},
        readWallClockMs: () => wallClockMs,
        samplingConfig
      });

      const publishWorldSnapshotsThrough = (targetWallClockMs) => {
        while (
          nextSnapshotTick * tickIntervalMs <=
          targetWallClockMs + Number.EPSILON
        ) {
          fakeWorldClient.publishWorldSnapshot(
            createMetaverseBenchmarkWorldSnapshot({
              currentTick: nextSnapshotTick,
              localPlayerId,
              localUsername,
              remotePlayerId,
              remoteUsername,
              tickIntervalMs,
              vehicleId
            })
          );
          nextSnapshotTick += 1;
        }
      };

      runtime.boot();
      publishWorldSnapshotsThrough(0);

      return () => {
        for (
          let frameIndex = 0;
          frameIndex < benchmarkFrameCountPerWindow;
          frameIndex += 1
        ) {
          wallClockMs += battleCadenceBenchmarkConfig.frameDeltaMs;
          publishWorldSnapshotsThrough(wallClockMs);
          runtime.sampleRemoteWorld();
        }

        const telemetrySnapshot = runtime.samplingTelemetrySnapshot;

        benchmarkSink =
          runtime.remoteCharacterPresentations.length +
          runtime.remoteVehiclePresentations.length +
          telemetrySnapshot.bufferDepth +
          Math.round(telemetrySnapshot.currentExtrapolationMs);
      };
    }
  };
}

function createCoopBenchmarkRoomSnapshot({
  currentTick,
  playerId,
  roomId,
  sessionId,
  tickIntervalMs,
  username
}) {
  const simulationTimeMs = currentTick * tickIntervalMs;
  const simulationSeconds = simulationTimeMs / 1000;

  return createCoopRoomSnapshot({
    birds: [
      {
        behavior: "glide",
        birdId: "bench-bird-1",
        headingRadians: simulationSeconds * 1.25,
        label: "Bench Bird 1",
        position: {
          x: simulationSeconds * 6,
          y: 2.8 + Math.sin(simulationSeconds * 2.5) * 0.35,
          z: -18 + Math.cos(simulationSeconds * 1.5) * 1.5
        },
        radius: 0.9,
        scale: 1 + Math.sin(simulationSeconds * 1.1) * 0.04,
        visible: true,
        wingPhase: simulationSeconds * 6
      }
    ],
    capacity: 4,
    players: [
      {
        activity: {
          hitsLanded: 0,
          lastAcknowledgedShotSequence: 0,
          lastHitBirdId: null,
          lastOutcome: null,
          lastShotTick: null,
          scatterEventsCaused: 0,
          shotsFired: 0
        },
        connected: true,
        playerId,
        presence: {
          aimDirection: {
            x: 0,
            y: 0,
            z: -1
          },
          pitchRadians: 0,
          position: {
            x: 0,
            y: 1.35,
            z: 0
          },
          stateSequence: currentTick,
          weaponId: "semiautomatic-pistol",
          yawRadians: 0
        },
        ready: true,
        username
      }
    ],
    roomId,
    session: {
      birdsCleared: 0,
      birdsRemaining: 1,
      phase: "active",
      roundPhase: "combat",
      roundPhaseRemainingMs: 20_000,
      requiredReadyPlayerCount: 1,
      sessionId,
      teamHitsLanded: 0,
      teamShotsFired: 0
    },
    tick: {
      currentTick,
      emittedAtServerTimeMs: simulationTimeMs,
      simulationTimeMs,
      tickIntervalMs
    }
  });
}

function createDuckHuntCoopArenaCadenceBenchmarkSuite(
  DuckHuntCoopArenaSimulation,
  tickIntervalMs
) {
  const playerId = expectNonNullValue(
    createCoopPlayerId("bench-coop-player"),
    "bench coop player id"
  );
  const roomId = expectNonNullValue(
    createCoopRoomId("bench-coop-room"),
    "bench coop room id"
  );
  const sessionId = expectNonNullValue(
    createCoopSessionId("bench-coop-session"),
    "bench coop session id"
  );
  const username = expectNonNullValue(
    createUsername("Bench Coop Player"),
    "bench coop username"
  );

  return {
    id: `duck-hunt-coop-arena-simulation.one-second.tick-${tickIntervalMs}ms`,
    iterations: battleCadenceBenchmarkConfig.duckHuntCoopArenaSimulation.iterations,
    maxMeanNs: battleCadenceBenchmarkConfig.duckHuntCoopArenaSimulation.maxMeanNs,
    setup() {
      let handSequenceNumber = 0;
      let nextSnapshotTick = 0;
      let wallClockMs = 0;
      const roomSource = {
        roomId,
        roomSnapshot: null,
        roomSnapshotBuffer: Object.freeze([]),
        telemetrySnapshot: Object.freeze({
          latestSnapshotUpdateRateHz: null,
          playerPresenceDatagramSendFailureCount: 0,
          playerPresenceLastTransportError: null,
          playerPresenceReliableFallbackActive: false,
          snapshotStream: defaultCoopRoomSnapshotStreamTelemetrySnapshot
        }),
        fireShot() {},
        syncPlayerPresence() {}
      };
      const simulation = new DuckHuntCoopArenaSimulation(
        {
          xCoefficients: [1, 0, 0],
          yCoefficients: [0, 1, 0]
        },
        roomSource,
        undefined,
        {
          playerId,
          readWallClockMs: () => wallClockMs
        }
      );

      const publishRoomSnapshotsThrough = (targetWallClockMs) => {
        while (
          nextSnapshotTick * tickIntervalMs <=
          targetWallClockMs + Number.EPSILON
        ) {
          const roomSnapshot = createCoopBenchmarkRoomSnapshot({
            currentTick: nextSnapshotTick,
            playerId,
            roomId,
            sessionId,
            tickIntervalMs,
            username
          });

          roomSource.roomSnapshotBuffer = appendBoundedSnapshotBuffer(
            roomSource.roomSnapshotBuffer,
            roomSnapshot,
            battleCadenceBenchmarkConfig.maxBufferedSnapshots
          );
          roomSource.roomSnapshot = roomSnapshot;
          roomSource.telemetrySnapshot = Object.freeze({
            latestSnapshotUpdateRateHz: resolveLatestSnapshotUpdateRateHz(
              roomSource.roomSnapshotBuffer
            ),
            playerPresenceDatagramSendFailureCount: 0,
            playerPresenceLastTransportError: null,
            playerPresenceReliableFallbackActive: false,
            snapshotStream: defaultCoopRoomSnapshotStreamTelemetrySnapshot
          });
          nextSnapshotTick += 1;
        }
      };

      publishRoomSnapshotsThrough(0);
      simulation.reset(createTrackedSnapshot(0, 0.5, 0.5));

      return () => {
        for (
          let frameIndex = 0;
          frameIndex < benchmarkFrameCountPerWindow;
          frameIndex += 1
        ) {
          wallClockMs += battleCadenceBenchmarkConfig.frameDeltaMs;
          publishRoomSnapshotsThrough(wallClockMs);
          handSequenceNumber += 1;
          simulation.advance(
            createTrackedSnapshot(handSequenceNumber, 0.5, 0.5),
            wallClockMs
          );
        }

        const telemetrySnapshot = simulation.telemetrySnapshot;

        benchmarkSink =
          simulation.enemyRenderStates.length +
          telemetrySnapshot.bufferDepth +
          Math.round(telemetrySnapshot.projectedSimulationLagMs ?? 0);
      };
    }
  };
}

let benchmarkSink = 0;

export async function createBenchmarkSuites({ clientLoader }) {
  const [
    {
      DuckHuntCoopArenaSimulation,
      DuckHuntLocalArenaSimulation: LocalArenaSimulation,
      DuckHuntWeaponRuntime: WeaponRuntime,
      duckHuntFirstPlayableWeaponDefinition: firstPlayableWeaponDefinition,
      duckHuntLocalArenaSimulationConfig: localArenaSimulationConfig
    },
    { createLatestHandTrackingSnapshot },
    { MetaverseRemoteWorldRuntime },
    { metaverseRemoteWorldSamplingConfig }
  ] = await Promise.all([
    clientLoader.load("/src/experiences/duck-hunt/index.ts"),
    clientLoader.load("/src/tracking/types/hand-tracking.ts"),
    clientLoader.load("/src/metaverse/classes/metaverse-remote-world-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-world-network.ts")
  ]);

  return [
    {
      id: "local-arena-simulation.advance",
      iterations: 20000,
      maxMeanNs: 50000,
      setup() {
        const simulation = new LocalArenaSimulation(
          {
            xCoefficients: [1, 0, 0],
            yCoefficients: [0, 1, 0]
          },
          localArenaSimulationConfig
        );
        const snapshots = [
          createTrackedSnapshot(1, 0.22, 0.3),
          createTrackedSnapshot(2, 0.27, 0.34, 0.08),
          createTrackedSnapshot(3, 0.5, 0.45),
          createTrackedSnapshot(4, 0.71, 0.28),
          createTrackedSnapshot(5, 0.65, 0.3, 0.08),
          createTrackedSnapshot(6, 0.43, 0.7)
        ];
        let sequenceIndex = 0;
        let nowMs = 0;

        return () => {
          const snapshot = snapshots[sequenceIndex % snapshots.length];

          sequenceIndex += 1;
          nowMs += 16;
          simulation.advance(snapshot, nowMs);
        };
      }
    },
    {
      id: "create-latest-hand-tracking-snapshot",
      iterations: 120000,
      maxMeanNs: 4500,
      setup() {
        let sequenceNumber = 0;

        return () => {
          sequenceNumber += 1;
          createLatestHandTrackingSnapshot({
            sequenceNumber,
            timestampMs: sequenceNumber * 8,
            pose: createTrackedPose(0.31, 0.37, 0.3)
          });
        };
      }
    },
    {
      id: "weapon-runtime.advance-plus-hud",
      iterations: 120000,
      maxMeanNs: 9000,
      setup() {
        const weaponRuntime = new WeaponRuntime(firstPlayableWeaponDefinition);
        const frameInputs = [
          {
            hasTrackedHand: true,
            isReticleOffscreen: false,
            sessionActive: true,
            triggerPressed: false
          },
          {
            hasTrackedHand: true,
            isReticleOffscreen: false,
            sessionActive: true,
            triggerPressed: true
          },
          {
            hasTrackedHand: true,
            isReticleOffscreen: false,
            sessionActive: true,
            triggerPressed: false
          },
          {
            hasTrackedHand: true,
            isReticleOffscreen: false,
            sessionActive: true,
            triggerPressed: true
          },
          {
            hasTrackedHand: true,
            isReticleOffscreen: true,
            sessionActive: true,
            triggerPressed: false
          }
        ];
        let frameIndex = 0;
        let nowMs = 0;

        return () => {
          const frameInput = frameInputs[frameIndex % frameInputs.length];

          frameIndex += 1;
          nowMs += 160;
          weaponRuntime.advance({
            ...frameInput,
            nowMs
          });
          weaponRuntime.createHudSnapshot({
            ...frameInput,
            nowMs
          });
        };
      }
    },
    ...battleCadenceBenchmarkConfig.candidateTickIntervalsMs.map((tickIntervalMs) =>
      createMetaverseRemoteWorldCadenceBenchmarkSuite(
        MetaverseRemoteWorldRuntime,
        metaverseRemoteWorldSamplingConfig,
        tickIntervalMs
      )
    ),
    ...battleCadenceBenchmarkConfig.candidateTickIntervalsMs.map((tickIntervalMs) =>
      createDuckHuntCoopArenaCadenceBenchmarkSuite(
        DuckHuntCoopArenaSimulation,
        tickIntervalMs
      )
    )
  ];
}
