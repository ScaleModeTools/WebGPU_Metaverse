function createFakeCameraSnapshot({
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

function createFakeRenderedCamera() {
  return {
    getWorldDirection(target) {
      target.x = 0;
      target.y = 0;
      target.z = -1;
      return target;
    },
    position: {
      x: 0,
      y: 1.62,
      z: 0
    }
  };
}

function createMountedInteractionSnapshot({
  focusedMountable = null,
  mountedEnvironment = null
} = {}) {
  return Object.freeze({
    boardingEntries:
      mountedEnvironment === null
        ? focusedMountable?.boardingEntries ?? Object.freeze([])
        : Object.freeze([]),
    focusedMountable,
    mountedEnvironment,
    seatTargetEnvironmentAssetId:
      mountedEnvironment?.environmentAssetId ??
      focusedMountable?.environmentAssetId ??
      null,
    selectableSeatTargets:
      mountedEnvironment === null
        ? focusedMountable?.directSeatTargets ?? Object.freeze([])
        : mountedEnvironment.seatId === null
          ? mountedEnvironment.seatTargets
          : Object.freeze(
              mountedEnvironment.seatTargets.filter(
                (seatTarget) => seatTarget.seatId !== mountedEnvironment.seatId
              )
            )
  });
}

function createFakeHudPublisherDependencies(readNowMs) {
  const presenceRuntime = {
    connectionRequired: true,
    isJoined: false,
    reliableTransportStatusSnapshot: Object.freeze({
      enabled: false
    }),
    resolveHudSnapshot() {
      return Object.freeze({
        joined: this.isJoined,
        lastError: null,
        remotePlayerCount: 0,
        state: this.isJoined ? "connected" : "idle"
      });
    }
  };
  const remoteWorldRuntime = {
    connectionRequired: true,
    currentPollIntervalMs: 33,
    driverVehicleControlDatagramStatusSnapshot: Object.freeze({
      enabled: true,
      state: "active"
    }),
    isConnected: false,
    latestAuthoritativeTickIntervalMs: 50,
    latestPlayerTraversalIntentSnapshot: null,
    readFreshAuthoritativeLocalPlayerSnapshot() {
      return null;
    },
    reliableTransportStatusSnapshot: Object.freeze({
      enabled: true
    }),
    samplingTelemetrySnapshot: Object.freeze({
      bufferDepth: 2,
      clockOffsetEstimateMs: 4,
      currentExtrapolationMs: 12,
      datagramSendFailureCount: 3,
      extrapolatedFramePercent: 25,
      latestSimulationAgeMs: 14,
      latestSnapshotUpdateRateHz: 20
    }),
    snapshotStreamTelemetrySnapshot: Object.freeze({
      available: true,
      fallbackActive: false,
      lastTransportError: null,
      liveness: "subscribed",
      path: "reliable-snapshot-stream",
      reconnectCount: 0
    })
  };
  const traversalRuntime = {
    authoritativeCorrectionTelemetrySnapshot: Object.freeze({
      applied: false,
      locomotionMismatch: false,
      planarMagnitudeMeters: 0,
      verticalMagnitudeMeters: 0
    }),
    cameraSnapshot: createFakeCameraSnapshot(),
    lastLocalAuthorityPoseCorrectionDetail: Object.freeze({
      authoritativeGrounded: null,
      localGrounded: null,
      planarMagnitudeMeters: null,
      verticalMagnitudeMeters: null
    }),
    lastLocalAuthorityPoseCorrectionSnapshot: null,
    lastLocalAuthorityPoseCorrectionReason: "none",
    lastLocalReconciliationCorrectionSource: "none",
    localAuthorityPoseCorrectionCount: 0,
    localReconciliationCorrectionCount: 0,
    localTraversalPoseSnapshot: Object.freeze({
      position: Object.freeze({
        x: 0,
        y: 1.62,
        z: 0
      })
    }),
    locomotionMode: "grounded",
    mountedVehicleAuthorityCorrectionCount: 0,
    surfaceRoutingLocalTelemetrySnapshot: Object.freeze({
      autostepHeightMeters: null,
      blockingAffordanceDetected: false,
      decisionReason: "capability-maintained",
      jumpDebug: Object.freeze({
        groundedBodyGrounded: null,
        groundedBodyJumpReady: null,
        surfaceJumpSupported: null,
        supported: null,
        verticalSpeedUnitsPerSecond: null
      }),
      locomotionMode: "grounded",
      resolvedSupportHeightMeters: 0.6,
      supportingAffordanceSampleCount: 0,
      traversalAuthority: Object.freeze({
        currentActionKind: "none",
        currentActionPhase: "idle",
        currentActionSequence: 0,
        lastConsumedActionSequence: 0,
        lastRejectedActionReason: "none",
        lastRejectedActionSequence: 0,
        phaseStartedAtTick: 0
      })
    })
  };

  return {
    config: Object.freeze({
      portals: Object.freeze([])
    }),
    devicePixelRatio: 2,
    environmentPhysicsRuntime: {
      surfaceColliderSnapshots: Object.freeze([])
    },
    initialControlMode: "keyboard",
    presenceRuntime,
    readNowMs,
    remoteWorldRuntime,
    traversalRuntime
  };
}

function createPublishInput(overrides = {}) {
  return Object.freeze({
    bootRendererInitialized: true,
    bootScenePrewarmed: true,
    controlMode: "keyboard",
    failureReason: null,
    focusedPortal: null,
    frameDeltaMs: 16,
    frameRate: 60,
    lifecycle: "running",
    mountedInteraction: createMountedInteractionSnapshot(),
    renderedFrameCount: 4,
    renderer: Object.freeze({
      info: Object.freeze({
        render: Object.freeze({
          drawCalls: 7,
          triangles: 42
        })
      })
    }),
    ...overrides
  });
}

export {
  createFakeCameraSnapshot,
  createFakeHudPublisherDependencies,
  createFakeRenderedCamera,
  createMountedInteractionSnapshot,
  createPublishInput
};
