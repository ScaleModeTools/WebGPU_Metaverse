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
    localTeamId: "blue",
    reliableTransportStatusSnapshot: Object.freeze({
      enabled: false
    }),
    resolveHudSnapshot() {
      return Object.freeze({
        joined: this.isJoined,
        lastError: null,
        localTeamId: this.localTeamId,
        remotePlayerCount: 0,
        state: this.isJoined ? "connected" : "idle"
      });
    }
  };
  const remoteWorldRuntime = {
    connectionRequired: true,
    driverVehicleControlDatagramStatusSnapshot: Object.freeze({
      enabled: true,
      state: "active"
    }),
    isConnected: false,
    remoteCharacterPresentations: Object.freeze([]),
    readFreshAuthoritativeLocalPlayerSnapshot() {
      return null;
    },
    readFreshAuthoritativeWorldSnapshot() {
      return null;
    },
    reliableTransportStatusSnapshot: Object.freeze({
      enabled: true
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
    cameraSnapshot: createFakeCameraSnapshot(),
    localTraversalPoseSnapshot: Object.freeze({
      position: Object.freeze({
        x: 0,
        y: 1.62,
        z: 0
      })
    }),
    locomotionMode: "grounded"
  };

  return {
    devicePixelRatio: 2,
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
    cameraPhaseId: "live",
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
  createMountedInteractionSnapshot,
  createPublishInput
};
