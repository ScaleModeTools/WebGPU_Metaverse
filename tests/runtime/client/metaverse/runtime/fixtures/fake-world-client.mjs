import assert from "node:assert/strict";

import {
  createMetaverseRealtimePlayerWeaponStateSnapshot,
  createMetaverseRealtimeWorldSnapshot,
  createMetaverseVehicleId,
  doMetaversePlayerTraversalSequencedInputsMatch,
  resolveMetaverseTraversalAuthoritySnapshotInput
} from "@webgpu-metaverse/shared";

import {
  authoredWaterBayOpenWaterSpawn,
  authoredWaterBaySkiffPlacement,
  authoredWaterBaySkiffYawRadians
} from "../../../../metaverse-authored-world-test-fixtures.mjs";

function resolveLatestWorldSnapshotUpdateRateHz(worldSnapshotBuffer) {
  if (worldSnapshotBuffer.length < 2) {
    return null;
  }

  const previousSnapshot = worldSnapshotBuffer[worldSnapshotBuffer.length - 2];
  const latestSnapshot = worldSnapshotBuffer[worldSnapshotBuffer.length - 1];
  const updateIntervalMs = Math.max(
    1,
    Number(latestSnapshot.tick.emittedAtServerTimeMs) -
      Number(previousSnapshot.tick.emittedAtServerTimeMs)
  );

  return 1000 / updateIntervalMs;
}

function createFakeWorldClientTelemetrySnapshot(
  worldSnapshotBuffer,
  currentTelemetrySnapshot = null
) {
  return Object.freeze({
    driverVehicleControlDatagramSendFailureCount:
      currentTelemetrySnapshot?.driverVehicleControlDatagramSendFailureCount ?? 0,
    latestSnapshotUpdateRateHz:
      resolveLatestWorldSnapshotUpdateRateHz(worldSnapshotBuffer),
    playerLookInputDatagramSendFailureCount:
      currentTelemetrySnapshot?.playerLookInputDatagramSendFailureCount ?? 0,
    playerTraversalInputDatagramSendFailureCount:
      currentTelemetrySnapshot?.playerTraversalInputDatagramSendFailureCount ??
      0,
    snapshotStream:
      currentTelemetrySnapshot?.snapshotStream ??
      Object.freeze({
        available: false,
        fallbackActive: false,
        lastTransportError: null,
        liveness: "inactive",
        path: "http-polling",
        reconnectCount: 0
      })
  });
}

export function createRealtimeWorldSnapshot({
  currentTick,
  environmentBodyEnvironmentAssetId = "metaverse-hub-pushable-crate-v1",
  environmentBodyLinearVelocity = {
    x: 4,
    y: 0,
    z: 0
  },
  environmentBodyX = 4,
  environmentBodyY = 0.46,
  environmentBodyYawRadians = 0,
  environmentBodyZ = 14,
  includeEnvironmentBody = false,
  includeRemotePlayer = true,
  includeVehicle = true,
  localAnimationVocabulary = "idle",
  localJumpAuthorityState,
  localJumpDebug,
  localGroundedBody,
  localLastAcceptedJumpActionSequence = 0,
  localLastProcessedInputSequence,
  localLastProcessedJumpActionSequence = 0,
  localLastProcessedLookSequence,
  localLastProcessedWeaponSequence = 0,
  localLastProcessedTraversalOrientationSequence,
  localLinearVelocity = {
    x: 0,
    y: 0,
    z: 0
  },
  localLocomotionMode = "grounded",
  localMountedOccupancy = null,
  localLookPitchRadians = 0,
  localLookYawRadians,
  localObservedMoveAxis = 0,
  localObservedStrafeAxis = 0,
  localPlayerId,
  localPlayerX = 0,
  localPlayerY = 1.62,
  localPlayerZ = 24,
  localUsername,
  localYawRadians = 0,
  remoteAnimationVocabulary,
  remoteLinearVelocity,
  remoteLocomotionMode,
  remoteLookPitchRadians = 0,
  remoteLookYawRadians,
  remoteMountedOccupancy = null,
  remoteObservedMoveAxis = 0,
  remoteObservedStrafeAxis = 0,
  remotePlayerAngularVelocityRadiansPerSecond = 0,
  remotePlayerId,
  remoteWeaponState = null,
  remotePlayerX,
  remotePlayerY,
  remotePlayerZ = 18,
  remoteUsername,
  serverTimeMs,
  snapshotSequence,
  tickIntervalMs = 50,
  vehicleLinearVelocity = {
    x: 20,
    y: 0,
    z: 0
  },
  vehicleSeatOccupantPlayerId = remotePlayerId,
  vehicleX,
  yawRadians = 0
}) {
  const vehicleId = createMetaverseVehicleId("metaverse-hub-skiff-v1");
  const resolvedLocalLastProcessedInputSequence =
    localLastProcessedInputSequence ?? snapshotSequence;
  const resolvedLocalLastProcessedLookSequence =
    localLastProcessedLookSequence ?? resolvedLocalLastProcessedInputSequence;
  const resolvedLocalLastProcessedTraversalOrientationSequence =
    localLastProcessedTraversalOrientationSequence ??
    resolvedLocalLastProcessedInputSequence;
  const resolvedLocalLookYawRadians = localLookYawRadians ?? localYawRadians;
  const resolvedRemoteLookYawRadians = remoteLookYawRadians ?? yawRadians;
  const hasRemoteCanonicalSeatOccupancy =
    includeVehicle && vehicleSeatOccupantPlayerId === remotePlayerId;
  const resolvedRemoteLocomotionMode =
    remoteLocomotionMode ??
    (remoteMountedOccupancy !== null || hasRemoteCanonicalSeatOccupancy
      ? "mounted"
      : "grounded");
  const resolvedRemoteAnimationVocabulary =
    remoteAnimationVocabulary ??
    (resolvedRemoteLocomotionMode === "mounted"
      ? "seated"
      : resolvedRemoteLocomotionMode === "swim"
        ? "swim-idle"
        : "idle");
  const resolvedRemoteLinearVelocity =
    remoteLinearVelocity ??
    (resolvedRemoteLocomotionMode === "mounted"
      ? {
          x: 20,
          y: 0,
          z: 0
        }
      : {
          x: 0,
          y: 0,
          z: 0
        });
  const resolvedRemotePlayerY =
    remotePlayerY ??
    (resolvedRemoteLocomotionMode === "mounted" ? 0.75 : 1.62);
  const derivedLocalResolvedJumpActionSequence =
    localLastProcessedJumpActionSequence > localLastAcceptedJumpActionSequence
      ? localLastProcessedJumpActionSequence
      : localLastAcceptedJumpActionSequence;
  const derivedLocalResolvedJumpActionState =
    localLastProcessedJumpActionSequence > localLastAcceptedJumpActionSequence
      ? "rejected-buffer-expired"
      : localLastAcceptedJumpActionSequence > 0
        ? "accepted"
        : "none";
  const resolvedLocalJumpDebug =
    localJumpDebug === undefined &&
    derivedLocalResolvedJumpActionSequence === 0
      ? undefined
      : {
          ...localJumpDebug,
          resolvedActionSequence:
            localJumpDebug?.resolvedActionSequence ??
            derivedLocalResolvedJumpActionSequence,
          resolvedActionState:
            localJumpDebug?.resolvedActionState ??
            derivedLocalResolvedJumpActionState
        };
  const localTraversalAuthority =
    localJumpAuthorityState === undefined
      ? undefined
      : resolveMetaverseTraversalAuthoritySnapshotInput({
          activeAction:
            localJumpAuthorityState === "none"
              ? {
                  kind: "none",
                  phase: "idle"
                }
              : {
                  kind: "jump",
                  phase: localJumpAuthorityState
                },
          currentTick,
          locomotionMode:
            localMountedOccupancy === null && localLocomotionMode === "swim"
              ? "swim"
              : "grounded",
          mounted: localMountedOccupancy !== null,
          pendingActionKind:
            resolvedLocalJumpDebug?.pendingActionSequence > 0 ? "jump" : "none",
          pendingActionSequence:
            resolvedLocalJumpDebug?.pendingActionSequence ?? 0,
          resolvedActionKind:
            resolvedLocalJumpDebug?.resolvedActionSequence > 0 ? "jump" : "none",
          resolvedActionSequence:
            resolvedLocalJumpDebug?.resolvedActionSequence ?? 0,
          resolvedActionState:
            resolvedLocalJumpDebug?.resolvedActionState ?? "none"
        });
  const localCanonicalPosition = {
    x: localPlayerX,
    y: localPlayerY,
    z: localPlayerZ
  };
  const localCanonicalGroundedBody =
    localGroundedBody ??
    {
      linearVelocity: localLinearVelocity,
      position: localCanonicalPosition,
      yawRadians: localYawRadians
    };
  const localCanonicalSwimBody =
    localMountedOccupancy === null && localLocomotionMode === "swim"
      ? {
          linearVelocity: localLinearVelocity,
          position: localCanonicalPosition,
          yawRadians: localYawRadians
        }
      : undefined;
  const remoteCanonicalPosition = {
    x: remotePlayerX,
    y: resolvedRemotePlayerY,
    z: remotePlayerZ
  };
  const remoteCanonicalGroundedBody = {
    linearVelocity: resolvedRemoteLinearVelocity,
    position: remoteCanonicalPosition,
    yawRadians
  };
  const remoteCanonicalSwimBody =
    resolvedRemoteLocomotionMode === "swim"
      ? {
          linearVelocity: resolvedRemoteLinearVelocity,
          position: remoteCanonicalPosition,
          yawRadians
        }
      : undefined;

  assert.notEqual(vehicleId, null);

  return createMetaverseRealtimeWorldSnapshot({
    observerPlayer: {
      jumpDebug: resolvedLocalJumpDebug,
      lastProcessedInputSequence: resolvedLocalLastProcessedInputSequence,
      lastProcessedLookSequence: resolvedLocalLastProcessedLookSequence,
      lastProcessedTraversalOrientationSequence:
        resolvedLocalLastProcessedTraversalOrientationSequence,
      lastProcessedWeaponSequence: localLastProcessedWeaponSequence,
      playerId: localPlayerId
    },
    players: [
      {
        angularVelocityRadiansPerSecond: 0,
        animationVocabulary: localAnimationVocabulary,
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: localCanonicalGroundedBody,
        look: {
          pitchRadians: localLookPitchRadians,
          yawRadians: resolvedLocalLookYawRadians
        },
        locomotionMode:
          localMountedOccupancy === null ? localLocomotionMode : "mounted",
        mountedOccupancy:
          localMountedOccupancy === null
            ? null
            : {
                ...localMountedOccupancy,
                vehicleId
              },
        ...(localCanonicalSwimBody === undefined
          ? {}
          : {
              swimBody: localCanonicalSwimBody
            }),
        presentationIntent: {
          moveAxis: localObservedMoveAxis,
          strafeAxis: localObservedStrafeAxis
        },
        playerId: localPlayerId,
        stateSequence: snapshotSequence,
        ...(localTraversalAuthority === undefined
          ? {}
          : { traversalAuthority: localTraversalAuthority }),
        username: localUsername
      },
      ...(includeRemotePlayer
        ? [
            {
              angularVelocityRadiansPerSecond:
                remotePlayerAngularVelocityRadiansPerSecond,
              animationVocabulary: resolvedRemoteAnimationVocabulary,
              characterId: "mesh2motion-humanoid-v1",
              groundedBody: remoteCanonicalGroundedBody,
              look: {
                pitchRadians: remoteLookPitchRadians,
                yawRadians: resolvedRemoteLookYawRadians
              },
              locomotionMode: resolvedRemoteLocomotionMode,
              ...(remoteMountedOccupancy === null
                ? {}
                : {
                    mountedOccupancy: {
                      ...remoteMountedOccupancy,
                      vehicleId
                    }
                  }),
              ...(remoteCanonicalSwimBody === undefined
                ? {}
                : {
                    swimBody: remoteCanonicalSwimBody
                  }),
              presentationIntent: {
                moveAxis: remoteObservedMoveAxis,
                strafeAxis: remoteObservedStrafeAxis
              },
              playerId: remotePlayerId,
              stateSequence: snapshotSequence,
              ...(remoteWeaponState === null
                ? {}
                : {
                    weaponState: remoteWeaponState
                  }),
              username: remoteUsername
            }
          ]
        : [])
    ],
    snapshotSequence,
    tick: {
      currentTick,
      serverTimeMs,
      tickIntervalMs
    },
    environmentBodies: includeEnvironmentBody
      ? [
          {
            environmentAssetId: environmentBodyEnvironmentAssetId,
            linearVelocity: environmentBodyLinearVelocity,
            position: {
              x: environmentBodyX,
              y: environmentBodyY,
              z: environmentBodyZ
            },
            yawRadians: environmentBodyYawRadians
          }
        ]
      : [],
    vehicles: includeVehicle
      ? [
          {
            angularVelocityRadiansPerSecond: 1.3333333333333333,
            environmentAssetId: "metaverse-hub-skiff-v1",
            linearVelocity: vehicleLinearVelocity,
            position: {
              x: vehicleX,
              y: 0.35,
              z: 18
            },
            seats: [
              {
                occupantPlayerId: vehicleSeatOccupantPlayerId,
                occupantRole: "driver",
                seatId: "driver-seat"
              }
            ],
            vehicleId,
            yawRadians
          }
        ]
      : []
  });
}

export class FakeMetaverseWorldClient {
  constructor(worldSnapshotBuffer = []) {
    this.disposeCalls = 0;
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
    this.driverVehicleControlRequests = [];
    this.lastJumpPressed = false;
    this.lastPlayerLookIntentRequestKey = null;
    this.lastPlayerWeaponStateRequestKey = null;
    this.lastPlayerTraversalIntentRequestKey = null;
    this.latestPlayerInputSequence = 0;
    this.latestPlayerIssuedTraversalIntentSnapshot = null;
    this.latestPlayerLookSequence = 0;
    this.latestPlayerWeaponSequence = 0;
    this.latestPlayerTraversalOrientationSequence = 0;
    this.latestPlayerLookIntentSnapshot = null;
    this.latestPlayerWeaponStateSnapshot = null;
    this.mountedOccupancyRequests = [];
    this.nextJumpActionSequence = 0;
    this.playerLookIntentRequests = [];
    this.playerWeaponStateRequests = [];
    this.playerTraversalIntentRequests = [];
    this.ensureConnectedRequests = [];
    this.listeners = new Set();
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
    this.telemetrySnapshot = createFakeWorldClientTelemetrySnapshot(
      worldSnapshotBuffer
    );
    this._latestPlayerTraversalIntentSnapshot = null;
    this.worldSnapshotBuffer = Object.freeze(worldSnapshotBuffer);
    this.statusSnapshot = Object.freeze({
      connected: worldSnapshotBuffer.length > 0,
      lastError: null,
      lastSnapshotSequence:
        worldSnapshotBuffer[worldSnapshotBuffer.length - 1]?.snapshotSequence ?? null,
      lastWorldTick:
        worldSnapshotBuffer[worldSnapshotBuffer.length - 1]?.tick.currentTick ?? null,
      playerId: null,
      state: worldSnapshotBuffer.length > 0 ? "connected" : "idle"
    });
  }

  ensureConnected(playerId) {
    this.ensureConnectedRequests.push(playerId);
    this.statusSnapshot = Object.freeze({
      connected: true,
      lastError: null,
      lastSnapshotSequence:
        this.worldSnapshotBuffer[this.worldSnapshotBuffer.length - 1]
          ?.snapshotSequence ?? null,
      lastWorldTick:
        this.worldSnapshotBuffer[this.worldSnapshotBuffer.length - 1]?.tick
          .currentTick ?? null,
      playerId,
      state: "connected"
    });
    this.#notifyUpdates();

    return Promise.resolve(
      this.worldSnapshotBuffer[this.worldSnapshotBuffer.length - 1] ?? null
    );
  }

  syncDriverVehicleControl(commandInput) {
    this.driverVehicleControlRequests.push(commandInput);
  }

  syncMountedOccupancy(commandInput) {
    this.mountedOccupancyRequests.push(commandInput);
  }

  syncPlayerLookIntent(commandInput) {
    this.playerLookIntentRequests.push(commandInput);
    const nextPlayerLookIntentRequestKey =
      commandInput === null ? null : JSON.stringify(commandInput);

    if (
      commandInput !== null &&
      nextPlayerLookIntentRequestKey !== this.lastPlayerLookIntentRequestKey
    ) {
      this.latestPlayerLookSequence += 1;
    }

    this.lastPlayerLookIntentRequestKey = nextPlayerLookIntentRequestKey;
    this.latestPlayerLookIntentSnapshot =
      commandInput === null
        ? null
        : Object.freeze({
            pitchRadians: commandInput.lookIntent.pitchRadians,
            lookSequence: this.latestPlayerLookSequence,
            yawRadians: commandInput.lookIntent.yawRadians
          });
  }

  syncPlayerWeaponState(commandInput) {
    this.playerWeaponStateRequests.push(commandInput);
    const nextPlayerWeaponStateRequestKey =
      commandInput === null ? null : JSON.stringify(commandInput);

    if (
      commandInput !== null &&
      nextPlayerWeaponStateRequestKey !== this.lastPlayerWeaponStateRequestKey
    ) {
      this.latestPlayerWeaponSequence += 1;
    }

    this.lastPlayerWeaponStateRequestKey = nextPlayerWeaponStateRequestKey;
    this.latestPlayerWeaponStateSnapshot =
      commandInput === null || commandInput.weaponState === null
        ? null
        : createMetaverseRealtimePlayerWeaponStateSnapshot(commandInput.weaponState);
  }

  syncPlayerTraversalIntent(commandInput) {
    this.playerTraversalIntentRequests.push(commandInput);
    const nextTraversalIntentSnapshot =
      this.#previewPlayerTraversalIntentSnapshot(commandInput);

    if (commandInput === null || nextTraversalIntentSnapshot === null) {
      this.lastJumpPressed = false;
      this.lastPlayerTraversalIntentRequestKey = null;
      this.latestPlayerIssuedTraversalIntentSnapshot = null;
      this._latestPlayerTraversalIntentSnapshot = null;
      return null;
    }

    const nextPlayerTraversalIntentRequestKey = JSON.stringify(commandInput);
    const jumpPressed =
      commandInput.intent.actionIntent?.kind === "jump"
        ? commandInput.intent.actionIntent.pressed === true
        : commandInput.intent.jump === true;
    const sequencedInputChanged =
      !doMetaversePlayerTraversalSequencedInputsMatch(
        this._latestPlayerTraversalIntentSnapshot,
        nextTraversalIntentSnapshot
      );
    const orientationInputChanged =
      this._latestPlayerTraversalIntentSnapshot === null ||
      this._latestPlayerTraversalIntentSnapshot.bodyControl.turnAxis !==
        nextTraversalIntentSnapshot.bodyControl.turnAxis ||
      this._latestPlayerTraversalIntentSnapshot.facing.pitchRadians !==
        nextTraversalIntentSnapshot.facing.pitchRadians ||
      this._latestPlayerTraversalIntentSnapshot.facing.yawRadians !==
        nextTraversalIntentSnapshot.facing.yawRadians;

    if (sequencedInputChanged) {
      this.latestPlayerInputSequence += 1;
    }

    if (orientationInputChanged) {
      this.latestPlayerTraversalOrientationSequence += 1;
    }

    this.lastPlayerTraversalIntentRequestKey =
      nextPlayerTraversalIntentRequestKey;

    if (jumpPressed && !this.lastJumpPressed) {
      this.nextJumpActionSequence += 1;
    }

    this.lastJumpPressed = jumpPressed;
    this._latestPlayerTraversalIntentSnapshot = Object.freeze({
      ...nextTraversalIntentSnapshot,
      inputSequence: this.latestPlayerInputSequence,
      orientationSequence: this.latestPlayerTraversalOrientationSequence,
      actionIntent: Object.freeze({
        ...nextTraversalIntentSnapshot.actionIntent,
        kind:
          nextTraversalIntentSnapshot.actionIntent.kind === "jump" ||
          this.nextJumpActionSequence > 0
            ? "jump"
            : "none",
        sequence:
          nextTraversalIntentSnapshot.actionIntent.kind === "jump" ||
          this.nextJumpActionSequence > 0
            ? this.nextJumpActionSequence
            : 0
      })
    });

    this.latestPlayerIssuedTraversalIntentSnapshot = Object.freeze({
      actionIntent: this._latestPlayerTraversalIntentSnapshot.actionIntent,
      bodyControl: this._latestPlayerTraversalIntentSnapshot.bodyControl,
      inputSequence: this._latestPlayerTraversalIntentSnapshot.inputSequence,
      locomotionMode: this._latestPlayerTraversalIntentSnapshot.locomotionMode,
      orientationSequence:
        this._latestPlayerTraversalIntentSnapshot.orientationSequence
    });

    return this.latestPlayerIssuedTraversalIntentSnapshot;
  }

  previewPlayerTraversalIntent(commandInput) {
    const nextTraversalIntentSnapshot =
      this.#previewPlayerTraversalIntentSnapshot(commandInput);

    if (nextTraversalIntentSnapshot === null) {
      return null;
    }

    return Object.freeze({
      actionIntent: nextTraversalIntentSnapshot.actionIntent,
      bodyControl: nextTraversalIntentSnapshot.bodyControl,
      inputSequence: nextTraversalIntentSnapshot.inputSequence,
      locomotionMode: nextTraversalIntentSnapshot.locomotionMode,
      orientationSequence: nextTraversalIntentSnapshot.orientationSequence
    });
  }

  #previewPlayerTraversalIntentSnapshot(commandInput) {
    if (commandInput === null) {
      return null;
    }

    const jumpPressed =
      commandInput.intent.actionIntent?.kind === "jump"
        ? commandInput.intent.actionIntent.pressed === true
        : commandInput.intent.jump === true;
    const nextJumpActionSequence =
      jumpPressed && !this.lastJumpPressed
        ? this.nextJumpActionSequence + 1
        : this.nextJumpActionSequence;
    const normalizedTraversalIntentSnapshot = Object.freeze({
      actionIntent: Object.freeze({
        kind: jumpPressed || nextJumpActionSequence > 0 ? "jump" : "none",
        pressed: jumpPressed,
        sequence:
          jumpPressed || nextJumpActionSequence > 0
            ? nextJumpActionSequence
            : 0
      }),
      bodyControl: Object.freeze({
        boost:
          commandInput.intent.bodyControl?.boost ??
          commandInput.intent.boost ??
          false,
        moveAxis:
          commandInput.intent.bodyControl?.moveAxis ??
          commandInput.intent.moveAxis ??
          0,
        strafeAxis:
          commandInput.intent.bodyControl?.strafeAxis ??
          commandInput.intent.strafeAxis ??
          0,
        turnAxis:
          commandInput.intent.bodyControl?.turnAxis ??
          commandInput.intent.yawAxis ??
          0
      }),
      facing: Object.freeze({
        pitchRadians:
          commandInput.intent.facing?.pitchRadians ??
          commandInput.intent.pitchRadians ??
          0,
        yawRadians:
          commandInput.intent.facing?.yawRadians ??
          commandInput.intent.bodyYawRadians ??
          commandInput.intent.lookYawRadians ??
          commandInput.intent.yawRadians ??
          0
      }),
      inputSequence: this.latestPlayerInputSequence,
      locomotionMode: commandInput.intent.locomotionMode
    });
    const nextInputSequence =
      !doMetaversePlayerTraversalSequencedInputsMatch(
        this._latestPlayerTraversalIntentSnapshot,
        normalizedTraversalIntentSnapshot
      )
        ? this.latestPlayerInputSequence + 1
        : this.latestPlayerInputSequence;
    const nextOrientationSequence =
      this._latestPlayerTraversalIntentSnapshot === null ||
      this._latestPlayerTraversalIntentSnapshot.bodyControl.turnAxis !==
        normalizedTraversalIntentSnapshot.bodyControl.turnAxis ||
      this._latestPlayerTraversalIntentSnapshot.facing.pitchRadians !==
        normalizedTraversalIntentSnapshot.facing.pitchRadians ||
      this._latestPlayerTraversalIntentSnapshot.facing.yawRadians !==
        normalizedTraversalIntentSnapshot.facing.yawRadians
        ? this.latestPlayerTraversalOrientationSequence + 1
        : this.latestPlayerTraversalOrientationSequence;

    return Object.freeze({
      actionIntent: normalizedTraversalIntentSnapshot.actionIntent,
      bodyControl: normalizedTraversalIntentSnapshot.bodyControl,
      facing: normalizedTraversalIntentSnapshot.facing,
      inputSequence: nextInputSequence,
      locomotionMode: normalizedTraversalIntentSnapshot.locomotionMode,
      orientationSequence: nextOrientationSequence
    });
  }

  publishWorldSnapshotBuffer(worldSnapshotBuffer) {
    this.telemetrySnapshot = createFakeWorldClientTelemetrySnapshot(
      worldSnapshotBuffer,
      this.telemetrySnapshot
    );
    this.worldSnapshotBuffer = Object.freeze(worldSnapshotBuffer);
    this.statusSnapshot = Object.freeze({
      connected: worldSnapshotBuffer.length > 0,
      lastError: null,
      lastSnapshotSequence:
        worldSnapshotBuffer[worldSnapshotBuffer.length - 1]?.snapshotSequence ?? null,
      lastWorldTick:
        worldSnapshotBuffer[worldSnapshotBuffer.length - 1]?.tick.currentTick ?? null,
      playerId: this.statusSnapshot.playerId,
      state: worldSnapshotBuffer.length > 0 ? "connected" : "idle"
    });
    this.#notifyUpdates();
  }

  subscribeUpdates(listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose() {
    this.disposeCalls += 1;
    this.statusSnapshot = Object.freeze({
      connected: false,
      lastError: null,
      lastSnapshotSequence: this.statusSnapshot.lastSnapshotSequence,
      lastWorldTick: this.statusSnapshot.lastWorldTick,
      playerId: this.statusSnapshot.playerId,
      state: "disposed"
    });
    this.#notifyUpdates();
  }

  #notifyUpdates() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const shippedWaterBayOpenWaterSpawn = authoredWaterBayOpenWaterSpawn;
export const shippedWaterBaySkiffPlacement = authoredWaterBaySkiffPlacement;
export const shippedWaterBaySkiffYawRadians = authoredWaterBaySkiffYawRadians;
