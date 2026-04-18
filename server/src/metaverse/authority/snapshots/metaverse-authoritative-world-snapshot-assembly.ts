import {
  createMetaversePresencePlayerSnapshot,
  createMetaversePresencePoseSnapshot,
  createMetaversePresenceRosterEvent,
  createMetaversePresenceRosterSnapshot,
  type MetaversePlayerId,
  type MetaversePresenceMountedOccupancySnapshot,
  type MetaversePresenceMountedOccupantRoleId,
  type MetaversePresencePlayerSnapshot,
  type MetaversePresencePoseSnapshot,
  type MetaversePresenceRosterEvent,
  type MetaversePresenceRosterSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseTraversalBodyControlSnapshot,
  createMetaverseTraversalFacingSnapshot,
  metaverseTraversalActionBufferSeconds,
  readMetaverseTraversalPendingActionBufferAgeMs,
  type MetaverseTraversalBodyControlSnapshot,
  type MetaverseTraversalFacingSnapshot,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  createMetaverseRealtimeWorldEvent,
  createMetaverseRealtimeWorldSnapshot,
  type MetaverseRealtimeMountedOccupancySnapshotInput,
  type MetaverseRealtimePlayerObservedTraversalSnapshot,
  type MetaverseRealtimeWorldEvent,
  type MetaverseRealtimeWorldSnapshot,
  type MetaverseVehicleId
} from "@webgpu-metaverse/shared/metaverse/realtime";

export interface MetaverseAuthoritativeSnapshotMountedOccupancyRuntimeState {
  readonly entryId: string | null;
  readonly environmentAssetId: string;
  readonly occupancyKind: MetaversePresenceMountedOccupancySnapshot["occupancyKind"];
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string | null;
  readonly vehicleId: MetaverseVehicleId;
}

export interface MetaverseAuthoritativeSnapshotPlayerRuntimeState {
  angularVelocityRadiansPerSecond: number;
  readonly characterId: string;
  lastGroundedBodyJumpReady: boolean;
  lastGroundedJumpSupported: boolean;
  lastProcessedInputSequence: number;
  lastProcessedLookSequence: number;
  lastProcessedTraversalOrientationSequence: number;
  lastSurfaceJumpSupported: boolean;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  lookPitchRadians: number;
  lookYawRadians: number;
  locomotionMode: MetaversePresencePoseSnapshot["locomotionMode"];
  mountedOccupancy: MetaverseAuthoritativeSnapshotMountedOccupancyRuntimeState | null;
  readonly playerId: MetaversePlayerId;
  positionX: number;
  positionY: number;
  positionZ: number;
  presenceAnimationVocabulary: MetaversePresencePoseSnapshot["animationVocabulary"];
  stateSequence: number;
  traversalAuthorityState: MetaverseTraversalAuthoritySnapshot;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly username: MetaversePresencePlayerSnapshot["username"];
  yawRadians: number;
}

export interface MetaverseAuthoritativeSnapshotPlayerTraversalIntentRuntimeState {
  readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
  readonly facing: MetaverseTraversalFacingSnapshot;
}

export interface MetaverseAuthoritativeSnapshotVehicleSeatRuntimeState {
  occupantPlayerId: MetaversePlayerId | null;
  occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string;
}

export interface MetaverseAuthoritativeSnapshotVehicleRuntimeState {
  angularVelocityRadiansPerSecond: number;
  readonly environmentAssetId: string;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  readonly seatsById: ReadonlyMap<
    string,
    MetaverseAuthoritativeSnapshotVehicleSeatRuntimeState
  >;
  readonly vehicleId: MetaverseVehicleId;
  yawRadians: number;
}

export interface MetaverseAuthoritativeWorldSnapshotAssemblyConfig {
  readonly currentTick: number;
  readonly lastAdvancedAtMs: number | null;
  readonly nowMs: number;
  readonly snapshotSequence: number;
  readonly tickIntervalMs: number;
}

function createObservedPlayerTraversalSnapshot(
  playerRuntime: MetaverseAuthoritativeSnapshotPlayerRuntimeState,
  traversalIntent:
    | MetaverseAuthoritativeSnapshotPlayerTraversalIntentRuntimeState
    | undefined
): MetaverseRealtimePlayerObservedTraversalSnapshot {
  return Object.freeze({
    bodyControl:
      traversalIntent?.bodyControl ??
      createMetaverseTraversalBodyControlSnapshot({
        boost: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      }),
    facing:
      traversalIntent?.facing ??
      createMetaverseTraversalFacingSnapshot({
        pitchRadians: playerRuntime.lookPitchRadians,
        yawRadians: playerRuntime.lookYawRadians
      })
  });
}

function createMountedOccupancySnapshot(
  mountedOccupancy: MetaverseAuthoritativeSnapshotMountedOccupancyRuntimeState | null
): MetaverseRealtimeMountedOccupancySnapshotInput | undefined {
  if (
    mountedOccupancy === null ||
    mountedOccupancy.occupancyKind !== "entry"
  ) {
    return undefined;
  }

  return {
    entryId: mountedOccupancy.entryId,
    environmentAssetId: mountedOccupancy.environmentAssetId,
    occupancyKind: mountedOccupancy.occupancyKind,
    occupantRole: mountedOccupancy.occupantRole,
    seatId: mountedOccupancy.seatId,
    vehicleId: mountedOccupancy.vehicleId
  };
}

export function createMetaverseAuthoritativeWorldSnapshot<
  PlayerRuntime extends MetaverseAuthoritativeSnapshotPlayerRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeSnapshotVehicleRuntimeState
>(
  config: MetaverseAuthoritativeWorldSnapshotAssemblyConfig & {
    readonly players: Iterable<PlayerRuntime>;
    readonly traversalIntentsByPlayerId: ReadonlyMap<
      MetaversePlayerId,
      MetaverseAuthoritativeSnapshotPlayerTraversalIntentRuntimeState
    >;
    readonly vehicles: Iterable<VehicleRuntime>;
  }
): MetaverseRealtimeWorldSnapshot {
  const players = [...config.players]
    .sort((leftPlayer, rightPlayer) =>
      leftPlayer.playerId < rightPlayer.playerId
        ? -1
        : leftPlayer.playerId > rightPlayer.playerId
          ? 1
          : 0
    )
    .map((playerRuntime) => {
      const traversalIntent =
        playerRuntime.mountedOccupancy === null
          ? config.traversalIntentsByPlayerId.get(playerRuntime.playerId)
          : undefined;
      const mountedOccupancy = createMountedOccupancySnapshot(
        playerRuntime.mountedOccupancy
      );

      return {
        angularVelocityRadiansPerSecond:
          playerRuntime.angularVelocityRadiansPerSecond,
        characterId: playerRuntime.characterId,
        jumpDebug: {
          groundedBodyJumpReady: playerRuntime.lastGroundedBodyJumpReady,
          pendingActionSequence:
            playerRuntime.unmountedTraversalState.actionState.pendingActionKind ===
            "jump"
              ? playerRuntime.unmountedTraversalState.actionState
                  .pendingActionSequence
              : 0,
          pendingActionBufferAgeMs:
            playerRuntime.unmountedTraversalState.actionState.pendingActionKind ===
            "jump"
              ? readMetaverseTraversalPendingActionBufferAgeMs(
                  playerRuntime.unmountedTraversalState.actionState,
                  metaverseTraversalActionBufferSeconds,
                  "jump"
                )
              : null,
          resolvedActionSequence:
            playerRuntime.unmountedTraversalState.actionState.resolvedActionKind ===
            "jump"
              ? playerRuntime.unmountedTraversalState.actionState
                  .resolvedActionSequence
              : 0,
          resolvedActionState:
            playerRuntime.unmountedTraversalState.actionState.resolvedActionKind ===
            "jump"
              ? playerRuntime.unmountedTraversalState.actionState
                  .resolvedActionState
              : "none",
          surfaceJumpSupported: playerRuntime.lastSurfaceJumpSupported,
          supported: playerRuntime.lastGroundedJumpSupported
        },
        lastProcessedInputSequence: playerRuntime.lastProcessedInputSequence,
        lastProcessedLookSequence: playerRuntime.lastProcessedLookSequence,
        lastProcessedTraversalOrientationSequence:
          playerRuntime.lastProcessedTraversalOrientationSequence,
        linearVelocity: {
          x: playerRuntime.linearVelocityX,
          y: playerRuntime.linearVelocityY,
          z: playerRuntime.linearVelocityZ
        },
        look: {
          pitchRadians: playerRuntime.lookPitchRadians,
          yawRadians: playerRuntime.lookYawRadians
        },
        locomotionMode: playerRuntime.locomotionMode,
        observedTraversal: createObservedPlayerTraversalSnapshot(
          playerRuntime,
          traversalIntent
        ),
        ...(mountedOccupancy === undefined
          ? {}
          : {
              mountedOccupancy
            }),
        playerId: playerRuntime.playerId,
        position: {
          x: playerRuntime.positionX,
          y: playerRuntime.positionY,
          z: playerRuntime.positionZ
        },
        stateSequence: playerRuntime.stateSequence,
        traversalAuthority: playerRuntime.traversalAuthorityState,
        username: playerRuntime.username,
        yawRadians: playerRuntime.yawRadians
      };
    });
  const vehicles = [...config.vehicles]
    .sort((leftVehicle, rightVehicle) =>
      leftVehicle.vehicleId < rightVehicle.vehicleId
        ? -1
        : leftVehicle.vehicleId > rightVehicle.vehicleId
          ? 1
          : 0
    )
    .map((vehicleRuntime) => ({
      angularVelocityRadiansPerSecond:
        vehicleRuntime.angularVelocityRadiansPerSecond,
      environmentAssetId: vehicleRuntime.environmentAssetId,
      linearVelocity: {
        x: vehicleRuntime.linearVelocityX,
        y: vehicleRuntime.linearVelocityY,
        z: vehicleRuntime.linearVelocityZ
      },
      position: {
        x: vehicleRuntime.positionX,
        y: vehicleRuntime.positionY,
        z: vehicleRuntime.positionZ
      },
      seats: [...vehicleRuntime.seatsById.values()]
        .sort((leftSeat, rightSeat) => leftSeat.seatId.localeCompare(rightSeat.seatId))
        .map((seatRuntime) => ({
          occupantPlayerId: seatRuntime.occupantPlayerId,
          occupantRole: seatRuntime.occupantRole,
          seatId: seatRuntime.seatId
        })),
      vehicleId: vehicleRuntime.vehicleId,
      yawRadians: vehicleRuntime.yawRadians
    }));

  return createMetaverseRealtimeWorldSnapshot({
    players,
    snapshotSequence: config.snapshotSequence,
    tick: {
      currentTick: config.currentTick,
      emittedAtServerTimeMs: config.nowMs,
      simulationTimeMs: config.lastAdvancedAtMs ?? config.nowMs,
      tickIntervalMs: config.tickIntervalMs
    },
    vehicles
  });
}

export function createMetaverseAuthoritativeWorldEvent(
  worldSnapshot: MetaverseRealtimeWorldSnapshot
): MetaverseRealtimeWorldEvent {
  return createMetaverseRealtimeWorldEvent({
    world: worldSnapshot
  });
}

export function createMetaverseAuthoritativePresenceRosterSnapshot(
  worldSnapshot: MetaverseRealtimeWorldSnapshot,
  playersById: ReadonlyMap<
    MetaversePlayerId,
    MetaverseAuthoritativeSnapshotPlayerRuntimeState
  >
): MetaversePresenceRosterSnapshot {
  return createMetaversePresenceRosterSnapshot({
    players: worldSnapshot.players.map((playerSnapshot) =>
      createMetaversePresencePlayerSnapshot({
        characterId: playerSnapshot.characterId,
        playerId: playerSnapshot.playerId,
        pose: createMetaversePresencePoseSnapshot({
          animationVocabulary:
            playersById.get(playerSnapshot.playerId)?.presenceAnimationVocabulary ??
            "idle",
          look: {
            pitchRadians: playerSnapshot.look.pitchRadians,
            yawRadians: playerSnapshot.look.yawRadians
          },
          locomotionMode: playerSnapshot.locomotionMode,
          mountedOccupancy:
            playerSnapshot.mountedOccupancy === null
              ? null
              : {
                  environmentAssetId:
                    playerSnapshot.mountedOccupancy.environmentAssetId,
                  entryId: playerSnapshot.mountedOccupancy.entryId,
                  occupancyKind: playerSnapshot.mountedOccupancy.occupancyKind,
                  occupantRole: playerSnapshot.mountedOccupancy.occupantRole,
                  seatId: playerSnapshot.mountedOccupancy.seatId
                },
          position: playerSnapshot.position,
          stateSequence: playerSnapshot.stateSequence,
          yawRadians: playerSnapshot.yawRadians
        }),
        username: playerSnapshot.username
      })
    ),
    snapshotSequence: worldSnapshot.snapshotSequence,
    tickIntervalMs: Number(worldSnapshot.tick.tickIntervalMs)
  });
}

export function createMetaverseAuthoritativePresenceRosterEvent(
  rosterSnapshot: MetaversePresenceRosterSnapshot
): MetaversePresenceRosterEvent {
  return createMetaversePresenceRosterEvent(rosterSnapshot);
}
