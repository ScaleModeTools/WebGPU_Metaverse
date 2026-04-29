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
    currentPollIntervalMs: 33,
    driverVehicleControlDatagramStatusSnapshot: Object.freeze({
      enabled: true,
      state: "active"
    }),
    isConnected: false,
    latestAuthoritativeTickIntervalMs: 50,
    remoteCharacterPresentations: Object.freeze([]),
    readFreshAuthoritativeLocalPlayerSnapshot() {
      return null;
    },
    readFreshAuthoritativeWorldSnapshot() {
      return null;
    },
    readFreshAuthoritativeRemotePlayerSnapshots() {
      return Object.freeze([]);
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
      authoritativeSnapshotAgeMs: null,
      authoritativeSnapshotSequence: null,
      authoritativeTick: null,
      bodyStateDivergence: null,
      convergenceEpisodeStarted: false,
      convergenceEpisodeStartIntentionalDiscontinuityCause: "none",
      convergenceEpisodeStartHistoricalLocalSampleMatched: null,
      convergenceEpisodeStartHistoricalLocalSampleSelectionReason: null,
      convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs: null,
      convergenceEpisodeStartPlanarMagnitudeMeters: null,
      convergenceEpisodeStartReason: "none",
      convergenceEpisodeStartVerticalMagnitudeMeters: null,
      convergenceEpisodeStartYawMagnitudeRadians: null,
      groundedBodyStateDivergence: null,
      lastProcessedTraversalSequence: null,
      localGrounded: null,
      planarMagnitudeMeters: null,
      planarVelocityMagnitudeUnitsPerSecond: null,
      verticalMagnitudeMeters: null,
      verticalVelocityMagnitudeUnitsPerSecond: null
    }),
    lastLocalAuthorityPoseCorrectionSnapshot: null,
    lastLocalAuthorityPoseCorrectionReason: "none",
    lastLocalReconciliationCorrectionSource: "none",
    localAuthorityPoseCorrectionCount: 0,
    localAuthorityPoseConvergenceEpisodeCount: 0,
    localAuthorityPoseConvergenceStepCount: 0,
    localReconciliationCorrectionCount: 0,
    latestIssuedTraversalIntentSnapshot: null,
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
      groundedBody: null,
      locomotionMode: "grounded",
      resolvedSupportHeightMeters: 0.6,
      swimBody: null,
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
      groundedBody: Object.freeze({
        capsuleHalfHeightMeters: 0.9,
        capsuleRadiusMeters: 0.35,
        gravityUnitsPerSecond: 30,
        jumpImpulseUnitsPerSecond: 12,
        stepHeightMeters: 0.42
      }),
      movement: Object.freeze({
        worldRadius: 320
      }),
      ocean: Object.freeze({
        height: 0
      }),
      portals: Object.freeze([]),
      waterRegionSnapshots: Object.freeze([])
    }),
    devicePixelRatio: 2,
    environmentPhysicsRuntime: {
      surfaceColliderSnapshots: Object.freeze([])
    },
    initialControlMode: "keyboard",
    presenceRuntime,
    readNowMs,
    readLocalHeldWeaponGripTelemetrySnapshot() {
      return Object.freeze({
        adsBlend: null,
        adsAnchorPoseActive: false,
        adsAnchorPositionErrorMeters: null,
        adsAppliedGripDeltaMeters: null,
        adsGripDeltaClamped: false,
        adsPositionalWeight: null,
        aimMode: null,
        aimSource: null,
        aimSourceQuality: null,
        attachmentMountKind: "none",
        actualWeaponForwardWorld: null,
        degradedFrameCount: 0,
        deprecatedAimPoseActive: false,
        desiredWeaponForwardWorld: null,
        gripTargetSolveFailureReason: null,
        secondaryGripContactAvailable: false,
        heldMountSocketName: null,
        lastDegradedAgeMs: null,
        lastDegradedReason: null,
        mainHandGripErrorMeters: null,
        mainHandGripSocketComparisonErrorMeters: null,
        mainHandAngularErrorRadians: null,
        mainHandContactFrameId: null,
        mainHandMaxReachMeters: null,
        mainHandPalmSocketComparisonErrorMeters: null,
        mainHandPoleAngleRadians: null,
        mainHandPostPoleBiasErrorMeters: null,
        mainHandReachClampDeltaMeters: null,
        mainHandReachSlackMeters: null,
        mainHandSolveErrorMeters: null,
        mainHandSocket: "none",
        mainHandTargetDistanceMeters: null,
        mainHandWeaponSocketRole: null,
        mainHandWristCorrectionRadians: null,
        legacyFullBodyAimFallbackActive: false,
        legacyPistolShootOverlayActive: false,
        legacyUpperBodyAimOverlayActive: false,
        muzzleAimAngularErrorRadians: null,
        offHandAngularErrorRadians: null,
        offHandContactFrameId: null,
        offHandFinalErrorMeters: null,
        offHandGripMounted: false,
        offHandInitialSolveErrorMeters: null,
        offHandPoleAngleRadians: null,
        offHandPreSolveErrorMeters: null,
        offHandRefinementPassCount: 0,
        offHandSocket: "none",
        offHandGripAnchorAvailable: false,
        offHandTargetKind: "none",
        offHandWeaponSocketRole: null,
        offHandWristCorrectionRadians: null,
        phase: "no-character-runtime",
        poseProfileId: null,
        supportPalmFade: null,
        supportPalmHintActive: false,
        stability: "inactive",
        weaponId: null,
        weaponStatePresent: false,
        worstMainHandGripErrorMeters: 0,
        worstOffHandFinalErrorMeters: 0
      });
    },
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
