import {
  createMetaversePresencePlayerSnapshot,
  createMetaversePresencePoseSnapshot,
  createMetaversePresenceRosterEvent,
  createMetaversePresenceRosterSnapshot,
  shouldTreatMetaverseMountedOccupancyAsTraversalMounted,
  type MetaversePlayerId,
  type MetaversePlayerTeamId,
  type MetaversePresenceMountedOccupancySnapshot,
  type MetaversePresenceMountedOccupantRoleId,
  type MetaversePresencePlayerSnapshot,
  type MetaversePresencePoseSnapshot,
  type MetaversePresenceRosterEvent,
  type MetaversePresenceRosterSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  metaverseTraversalActionBufferSeconds,
  readMetaverseTraversalPendingActionBufferAgeMs,
  type MetaverseTraversalBodyControlSnapshot,
  type MetaverseSurfaceDriveBodyRuntimeSnapshot,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  createMetaverseRealtimeWorldEvent,
  createMetaverseRealtimeWorldSnapshot,
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot,
  type MetaverseRealtimeEnvironmentBodySnapshotInput,
  type MetaverseRealtimeMountedOccupancySnapshotInput,
  type MetaverseRealtimeObserverPlayerSnapshotInput,
  type MetaverseRealtimeWorldEvent,
  type MetaverseRealtimeWorldSnapshot,
  type MetaverseVehicleId
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type {
  MetaverseAuthoritativeLastGroundedBodySnapshot
} from "../players/metaverse-authoritative-last-grounded-body-snapshot.js";

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
  lastGroundedBodySnapshot: MetaverseAuthoritativeLastGroundedBodySnapshot;
  lastProcessedLookSequence: number;
  lastProcessedTraversalSequence: number;
  lastProcessedWeaponSequence: number;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  lookPitchRadians: number;
  lookYawRadians: number;
  locomotionMode: MetaversePresencePoseSnapshot["locomotionMode"];
  mountedOccupancy: MetaverseAuthoritativeSnapshotMountedOccupancyRuntimeState | null;
  readonly playerId: MetaversePlayerId;
  readonly teamId: MetaversePlayerTeamId;
  positionX: number;
  positionY: number;
  positionZ: number;
  presenceAnimationVocabulary: MetaversePresencePoseSnapshot["animationVocabulary"];
  stateSequence: number;
  readonly swimBodyRuntime: {
    readonly snapshot: MetaverseSurfaceDriveBodyRuntimeSnapshot;
  };
  traversalAuthorityState: MetaverseTraversalAuthoritySnapshot;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly username: MetaversePresencePlayerSnapshot["username"];
  weaponState: MetaverseRealtimeWorldSnapshot["players"][number]["weaponState"];
  yawRadians: number;
}

export interface MetaverseAuthoritativeSnapshotPlayerTraversalIntentRuntimeState {
  readonly currentIntent: {
    readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
  };
  readonly pendingIntentTimeline: readonly {
    readonly intent: {
      readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
    };
  }[];
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

export interface MetaverseAuthoritativeSnapshotEnvironmentBodyRuntimeState {
  readonly environmentAssetId: string;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  yawRadians: number;
}

export interface MetaverseAuthoritativeWorldSnapshotAssemblyConfig {
  readonly currentTick: number;
  readonly lastAdvancedAtMs: number | null;
  readonly nowMs: number;
  readonly observerPlayerId?: MetaversePlayerId;
  readonly snapshotSequence: number;
  readonly tickIntervalMs: number;
}

function createPlayerPresentationIntentSnapshot(
  traversalIntent:
    | MetaverseAuthoritativeSnapshotPlayerTraversalIntentRuntimeState
    | undefined
): {
  readonly moveAxis: number;
  readonly strafeAxis: number;
} {
  const presentationIntent =
    traversalIntent?.pendingIntentTimeline.at(-1)?.intent ??
    traversalIntent?.currentIntent;

  return Object.freeze({
    moveAxis: presentationIntent?.bodyControl.moveAxis ?? 0,
    strafeAxis: presentationIntent?.bodyControl.strafeAxis ?? 0
  });
}

function createObserverPlayerSnapshot(
  playerRuntime: MetaverseAuthoritativeSnapshotPlayerRuntimeState
): MetaverseRealtimeObserverPlayerSnapshotInput {
  return {
    jumpDebug: {
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
          : "none"
    },
    lastProcessedLookSequence: playerRuntime.lastProcessedLookSequence,
    lastProcessedTraversalSequence:
      playerRuntime.lastProcessedTraversalSequence,
    lastProcessedWeaponSequence: playerRuntime.lastProcessedWeaponSequence,
    playerId: playerRuntime.playerId
  };
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
  EnvironmentBodyRuntime extends MetaverseAuthoritativeSnapshotEnvironmentBodyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeSnapshotVehicleRuntimeState
>(
  config: MetaverseAuthoritativeWorldSnapshotAssemblyConfig & {
    readonly environmentBodies: Iterable<EnvironmentBodyRuntime>;
    readonly players: Iterable<PlayerRuntime>;
    readonly traversalIntentsByPlayerId: ReadonlyMap<
      MetaversePlayerId,
      MetaverseAuthoritativeSnapshotPlayerTraversalIntentRuntimeState
    >;
    readonly vehicles: Iterable<VehicleRuntime>;
  }
): MetaverseRealtimeWorldSnapshot {
  const sortedPlayerRuntimes = [...config.players].sort(
    (leftPlayer, rightPlayer) =>
      leftPlayer.playerId < rightPlayer.playerId
        ? -1
        : leftPlayer.playerId > rightPlayer.playerId
          ? 1
          : 0
  );
  const players = sortedPlayerRuntimes.map((playerRuntime) => {
      const traversalIntent =
        !shouldTreatMetaverseMountedOccupancyAsTraversalMounted(
          playerRuntime.mountedOccupancy
        )
          ? config.traversalIntentsByPlayerId.get(playerRuntime.playerId)
          : undefined;
      const mountedOccupancy = createMountedOccupancySnapshot(
        playerRuntime.mountedOccupancy
      );

      return {
        angularVelocityRadiansPerSecond:
          playerRuntime.angularVelocityRadiansPerSecond,
        characterId: playerRuntime.characterId,
        groundedBody: Object.freeze({
          contact: playerRuntime.lastGroundedBodySnapshot.contact,
          driveTarget: playerRuntime.lastGroundedBodySnapshot.driveTarget,
          grounded: playerRuntime.lastGroundedBodySnapshot.jumpBody.grounded,
          interaction: playerRuntime.lastGroundedBodySnapshot.interaction,
          jumpBody: playerRuntime.lastGroundedBodySnapshot.jumpBody,
          linearVelocity: Object.freeze({
            x: playerRuntime.linearVelocityX,
            y: playerRuntime.linearVelocityY,
            z: playerRuntime.linearVelocityZ
          }),
          position: Object.freeze({
            x: playerRuntime.positionX,
            y: playerRuntime.positionY,
            z: playerRuntime.positionZ
          }),
          yawRadians: playerRuntime.yawRadians
        }),
        look: {
          pitchRadians: playerRuntime.lookPitchRadians,
          yawRadians: playerRuntime.lookYawRadians
        },
        locomotionMode: playerRuntime.locomotionMode,
        presentationIntent: createPlayerPresentationIntentSnapshot(
          traversalIntent
        ),
        ...(mountedOccupancy === undefined
          ? {}
          : {
              mountedOccupancy
            }),
        playerId: playerRuntime.playerId,
        stateSequence: playerRuntime.stateSequence,
        ...(playerRuntime.locomotionMode !== "swim"
          ? {}
          : {
              swimBody: playerRuntime.swimBodyRuntime.snapshot
            }),
        teamId: playerRuntime.teamId,
        traversalAuthority: playerRuntime.traversalAuthorityState,
        weaponState: playerRuntime.weaponState,
        username: playerRuntime.username
      };
    });
  const observerPlayerRuntime =
    config.observerPlayerId === undefined
      ? null
      : sortedPlayerRuntimes.find(
          (playerRuntime) => playerRuntime.playerId === config.observerPlayerId
        ) ?? null;
  const environmentBodies = [...config.environmentBodies]
    .sort((leftEnvironmentBody, rightEnvironmentBody) =>
      leftEnvironmentBody.environmentAssetId.localeCompare(
        rightEnvironmentBody.environmentAssetId
      )
    )
    .map(
      (environmentBodyRuntime) =>
        ({
          environmentAssetId: environmentBodyRuntime.environmentAssetId,
          linearVelocity: {
            x: environmentBodyRuntime.linearVelocityX,
            y: environmentBodyRuntime.linearVelocityY,
            z: environmentBodyRuntime.linearVelocityZ
          },
          position: {
            x: environmentBodyRuntime.positionX,
            y: environmentBodyRuntime.positionY,
            z: environmentBodyRuntime.positionZ
          },
          yawRadians: environmentBodyRuntime.yawRadians
        }) satisfies MetaverseRealtimeEnvironmentBodySnapshotInput
    );
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
    environmentBodies,
    ...(observerPlayerRuntime === null
      ? {}
      : {
          observerPlayer: createObserverPlayerSnapshot(observerPlayerRuntime)
        }),
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
    players: worldSnapshot.players.map((playerSnapshot) => {
      const activeBodySnapshot =
        readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(playerSnapshot);

      return createMetaversePresencePlayerSnapshot({
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
          position: activeBodySnapshot.position,
          stateSequence: playerSnapshot.stateSequence,
          yawRadians: activeBodySnapshot.yawRadians
        }),
        teamId: playerSnapshot.teamId,
        username: playerSnapshot.username
      });
    }),
    snapshotSequence: worldSnapshot.snapshotSequence,
    tickIntervalMs: Number(worldSnapshot.tick.tickIntervalMs)
  });
}

export function createMetaverseAuthoritativePresenceRosterEvent(
  rosterSnapshot: MetaversePresenceRosterSnapshot
): MetaversePresenceRosterEvent {
  return createMetaversePresenceRosterEvent(rosterSnapshot);
}
