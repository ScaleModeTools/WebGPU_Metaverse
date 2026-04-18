import {
  createMetaverseUnmountedTraversalStateSnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type {
  MetaversePlayerId,
  MetaversePresenceMountedOccupancySnapshot,
  MetaversePresenceMountedOccupantRoleId,
  MetaversePresencePoseSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseSyncMountedOccupancyCommand,
  type MetaverseSyncMountedOccupancyCommand,
  type MetaverseVehicleId
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseAuthoritativeSurfaceColliderSnapshot } from "../../config/metaverse-authoritative-world-surface.js";

export interface MetaverseAuthoritativeMountedOccupancyRuntimeState {
  readonly entryId: string | null;
  readonly environmentAssetId: string;
  readonly occupancyKind: MetaversePresenceMountedOccupancySnapshot["occupancyKind"];
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string | null;
  readonly vehicleId: MetaverseVehicleId;
}

export interface MetaverseAuthoritativeMountedSeatRuntimeState {
  occupantPlayerId: MetaversePlayerId | null;
  occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string;
}

export interface MetaverseAuthoritativeMountedVehicleRuntimeState<
  SeatRuntime extends MetaverseAuthoritativeMountedSeatRuntimeState = MetaverseAuthoritativeMountedSeatRuntimeState
> {
  readonly seatsById: ReadonlyMap<string, SeatRuntime>;
}

export interface MetaverseAuthoritativeMountedPlayerRuntimeState<
  MountedOccupancy extends MetaverseAuthoritativeMountedOccupancyRuntimeState = MetaverseAuthoritativeMountedOccupancyRuntimeState
> {
  angularVelocityRadiansPerSecond: number;
  forwardSpeedUnitsPerSecond: number;
  lastPoseAtMs: number | null;
  lastSeenAtMs: number;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  locomotionMode: MetaversePresencePoseSnapshot["locomotionMode"];
  mountedOccupancy: MountedOccupancy | null;
  readonly playerId: MetaversePlayerId;
  realtimeWorldAuthorityActive: boolean;
  strafeSpeedUnitsPerSecond: number;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
}

interface MetaverseAuthoritativeMountedOccupancyAuthorityDependencies<
  PlayerRuntime extends MetaverseAuthoritativeMountedPlayerRuntimeState<MountedOccupancy>,
  MountedOccupancy extends MetaverseAuthoritativeMountedOccupancyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeMountedVehicleRuntimeState
> {
  readonly clearDriverVehicleControl: (playerId: MetaversePlayerId) => void;
  readonly clearPlayerTraversalIntent: (playerId: MetaversePlayerId) => void;
  readonly clearPlayerVehicleOccupancy: (playerId: MetaversePlayerId) => void;
  readonly ensureVehicleRuntime: (
    environmentAssetId: string,
    vehicleId: MountedOccupancy["vehicleId"]
  ) => VehicleRuntime;
  readonly incrementSnapshotSequence: () => void;
  readonly playersById: ReadonlyMap<MetaversePlayerId, PlayerRuntime>;
  readonly resolveAuthoritativeSurfaceColliders:
    () => readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];
  readonly resolveVehicleId: (
    environmentAssetId: string
  ) => MountedOccupancy["vehicleId"];
  readonly syncAuthoritativePlayerLookToCurrentFacing: (
    playerRuntime: PlayerRuntime
  ) => void;
  readonly syncMountedPlayerPoseFromVehicle: (
    playerRuntime: PlayerRuntime,
    vehicleRuntime: VehicleRuntime,
    nowMs: number
  ) => void;
  readonly syncPlayerTraversalAuthorityState: (
    playerRuntime: PlayerRuntime
  ) => void;
  readonly syncUnmountedPlayerToAuthoritativeSurface: (
    playerRuntime: PlayerRuntime,
    authoritativeSurfaceColliders: readonly MetaverseAuthoritativeSurfaceColliderSnapshot[],
    excludedOwnerEnvironmentAssetId: string | null
  ) => void;
  readonly syncVehicleOccupancyAndInitialPoseFromPlayer: (
    playerRuntime: PlayerRuntime,
    mountedOccupancy: MountedOccupancy,
    nowMs: number
  ) => VehicleRuntime;
}

function createMountedOccupancyRuntimeState(
  mountedOccupancy: MetaversePresenceMountedOccupancySnapshot,
  vehicleId: MetaverseVehicleId
): MetaverseAuthoritativeMountedOccupancyRuntimeState {
  return Object.freeze({
    entryId: mountedOccupancy.entryId,
    environmentAssetId: mountedOccupancy.environmentAssetId,
    occupancyKind: mountedOccupancy.occupancyKind,
    occupantRole: mountedOccupancy.occupantRole,
    seatId: mountedOccupancy.seatId,
    vehicleId
  });
}

export class MetaverseAuthoritativeMountedOccupancyAuthority<
  PlayerRuntime extends MetaverseAuthoritativeMountedPlayerRuntimeState<MountedOccupancy>,
  MountedOccupancy extends MetaverseAuthoritativeMountedOccupancyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeMountedVehicleRuntimeState
> {
  readonly #dependencies: MetaverseAuthoritativeMountedOccupancyAuthorityDependencies<
    PlayerRuntime,
    MountedOccupancy,
    VehicleRuntime
  >;

  constructor(
    dependencies: MetaverseAuthoritativeMountedOccupancyAuthorityDependencies<
      PlayerRuntime,
      MountedOccupancy,
      VehicleRuntime
    >
  ) {
    this.#dependencies = dependencies;
  }

  resolveMountedOccupancyRuntimeState(
    mountedOccupancy: MetaversePresenceMountedOccupancySnapshot | null
  ): MountedOccupancy | null {
    if (mountedOccupancy === null) {
      return null;
    }

    return createMountedOccupancyRuntimeState(
      mountedOccupancy,
      this.#dependencies.resolveVehicleId(mountedOccupancy.environmentAssetId)
    ) as MountedOccupancy;
  }

  resolveAcceptedMountedOccupancy(
    playerId: MetaversePlayerId,
    requestedMountedOccupancy: MountedOccupancy | null,
    previousMountedOccupancy: MountedOccupancy | null
  ): MountedOccupancy | null {
    if (
      requestedMountedOccupancy !== null &&
      this.#canPlayerOccupyMountedSeat(playerId, requestedMountedOccupancy)
    ) {
      return requestedMountedOccupancy;
    }

    if (
      previousMountedOccupancy !== null &&
      this.#canPlayerOccupyMountedSeat(playerId, previousMountedOccupancy)
    ) {
      return previousMountedOccupancy;
    }

    return null;
  }

  acceptSyncMountedOccupancyCommand(
    command: MetaverseSyncMountedOccupancyCommand,
    nowMs: number
  ): void {
    const normalizedCommand = createMetaverseSyncMountedOccupancyCommand(command);
    const playerRuntime = this.#dependencies.playersById.get(
      normalizedCommand.playerId
    );

    if (playerRuntime === undefined) {
      throw new Error(
        `Unknown metaverse player: ${normalizedCommand.playerId}`
      );
    }

    playerRuntime.realtimeWorldAuthorityActive = true;
    playerRuntime.lastSeenAtMs = nowMs;

    if (normalizedCommand.mountedOccupancy === null) {
      const authoritativeSurfaceColliders =
        this.#dependencies.resolveAuthoritativeSurfaceColliders();
      const previousMountedEnvironmentAssetId =
        playerRuntime.mountedOccupancy?.environmentAssetId ?? null;

      this.#dependencies.clearPlayerVehicleOccupancy(playerRuntime.playerId);
      this.#dependencies.clearDriverVehicleControl(playerRuntime.playerId);
      this.#dependencies.clearPlayerTraversalIntent(playerRuntime.playerId);
      playerRuntime.angularVelocityRadiansPerSecond = 0;
      playerRuntime.forwardSpeedUnitsPerSecond = 0;
      playerRuntime.linearVelocityX = 0;
      playerRuntime.linearVelocityY = 0;
      playerRuntime.linearVelocityZ = 0;
      playerRuntime.mountedOccupancy = null;
      playerRuntime.lastPoseAtMs = nowMs;
      playerRuntime.strafeSpeedUnitsPerSecond = 0;
      this.#dependencies.syncUnmountedPlayerToAuthoritativeSurface(
        playerRuntime,
        authoritativeSurfaceColliders,
        previousMountedEnvironmentAssetId
      );
      this.#dependencies.syncAuthoritativePlayerLookToCurrentFacing(playerRuntime);
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      this.#dependencies.incrementSnapshotSequence();
      return;
    }

    const requestedMountedOccupancy = this.resolveMountedOccupancyRuntimeState(
      normalizedCommand.mountedOccupancy
    );
    const acceptedMountedOccupancy = this.resolveAcceptedMountedOccupancy(
      playerRuntime.playerId,
      requestedMountedOccupancy,
      playerRuntime.mountedOccupancy
    );

    this.#dependencies.clearPlayerVehicleOccupancy(playerRuntime.playerId);
    this.#dependencies.clearPlayerTraversalIntent(playerRuntime.playerId);
    playerRuntime.mountedOccupancy = acceptedMountedOccupancy;
    playerRuntime.locomotionMode =
      acceptedMountedOccupancy === null ? "grounded" : "mounted";
    if (acceptedMountedOccupancy === null) {
      playerRuntime.unmountedTraversalState =
        createMetaverseUnmountedTraversalStateSnapshot({
          actionState: playerRuntime.unmountedTraversalState.actionState,
          locomotionMode: "grounded"
        });
    }

    if (acceptedMountedOccupancy === null) {
      const authoritativeSurfaceColliders =
        this.#dependencies.resolveAuthoritativeSurfaceColliders();
      const excludedMountedEnvironmentAssetId =
        requestedMountedOccupancy?.environmentAssetId ??
        playerRuntime.mountedOccupancy?.environmentAssetId ??
        null;

      this.#dependencies.clearDriverVehicleControl(playerRuntime.playerId);
      playerRuntime.angularVelocityRadiansPerSecond = 0;
      playerRuntime.forwardSpeedUnitsPerSecond = 0;
      playerRuntime.linearVelocityX = 0;
      playerRuntime.linearVelocityY = 0;
      playerRuntime.linearVelocityZ = 0;
      playerRuntime.lastPoseAtMs = nowMs;
      playerRuntime.strafeSpeedUnitsPerSecond = 0;
      this.#dependencies.syncUnmountedPlayerToAuthoritativeSurface(
        playerRuntime,
        authoritativeSurfaceColliders,
        excludedMountedEnvironmentAssetId
      );
      this.#dependencies.syncAuthoritativePlayerLookToCurrentFacing(playerRuntime);
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      this.#dependencies.incrementSnapshotSequence();
      return;
    }

    if (acceptedMountedOccupancy.occupantRole !== "driver") {
      this.#dependencies.clearDriverVehicleControl(playerRuntime.playerId);
    }

    const vehicleRuntime =
      this.#dependencies.syncVehicleOccupancyAndInitialPoseFromPlayer(
        playerRuntime,
        acceptedMountedOccupancy,
        nowMs
      );

    this.#dependencies.syncMountedPlayerPoseFromVehicle(
      playerRuntime,
      vehicleRuntime,
      nowMs
    );
    this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
    this.#dependencies.incrementSnapshotSequence();
  }

  #canPlayerOccupyMountedSeat(
    playerId: MetaversePlayerId,
    mountedOccupancy: MountedOccupancy
  ): boolean {
    if (
      mountedOccupancy.occupancyKind !== "seat" ||
      mountedOccupancy.seatId === null
    ) {
      return true;
    }

    const vehicleRuntime = this.#dependencies.ensureVehicleRuntime(
      mountedOccupancy.environmentAssetId,
      mountedOccupancy.vehicleId
    );
    const existingSeatRuntime = vehicleRuntime.seatsById.get(
      mountedOccupancy.seatId
    );

    return (
      existingSeatRuntime === undefined ||
      existingSeatRuntime.occupantPlayerId === null ||
      existingSeatRuntime.occupantPlayerId === playerId
    );
  }
}
