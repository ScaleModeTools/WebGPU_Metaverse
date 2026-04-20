import {
  createMetaverseUnmountedTraversalStateSnapshot,
  type MetaverseMountedLookLimitPolicyId,
  type MetaverseMountedVehicleControlRoutingPolicyId,
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

import type { MetaverseAuthoritativeSurfaceColliderSnapshot } from "../../world/map-bundles/metaverse-authoritative-world-bundle-inputs.js";
import {
  resolveMetaverseWorldMountedOccupancyPolicySnapshotFromAuthoring,
  type MetaverseWorldMountedOccupancyPolicySnapshot,
  type MetaverseWorldMountedEntryAuthoring,
  type MetaverseWorldMountedSeatAuthoring
} from "@webgpu-metaverse/shared/metaverse/world";

export interface MetaverseAuthoritativeMountedOccupancyRuntimeState {
  readonly controlRoutingPolicyId: MetaverseMountedVehicleControlRoutingPolicyId;
  readonly entryId: string | null;
  readonly environmentAssetId: string;
  readonly lookLimitPolicyId: MetaverseMountedLookLimitPolicyId;
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
  lastPoseAtMs: number | null;
  lastSeenAtMs: number;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  locomotionMode: MetaversePresencePoseSnapshot["locomotionMode"];
  mountedOccupancy: MountedOccupancy | null;
  readonly playerId: MetaversePlayerId;
  realtimeWorldAuthorityActive: boolean;
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
  readonly readMountedEntryAuthoring: (
    environmentAssetId: string,
    entryId: string
  ) => MetaverseWorldMountedEntryAuthoring | null;
  readonly readMountedSeatAuthoring: (
    environmentAssetId: string,
    seatId: string
  ) => MetaverseWorldMountedSeatAuthoring | null;
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
  vehicleId: MetaverseVehicleId,
  occupancyPolicy: MetaverseWorldMountedOccupancyPolicySnapshot
): MetaverseAuthoritativeMountedOccupancyRuntimeState {
  return Object.freeze({
    controlRoutingPolicyId: occupancyPolicy.controlRoutingPolicyId,
    entryId: occupancyPolicy.entryId,
    environmentAssetId: mountedOccupancy.environmentAssetId,
    lookLimitPolicyId: occupancyPolicy.lookLimitPolicyId,
    occupancyKind: occupancyPolicy.occupancyKind,
    occupantRole: occupancyPolicy.occupantRole,
    seatId: occupancyPolicy.seatId,
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

    const authoredMountedOccupancy =
      mountedOccupancy.occupancyKind === "seat" &&
      mountedOccupancy.seatId !== null
        ? this.#dependencies.readMountedSeatAuthoring(
            mountedOccupancy.environmentAssetId,
            mountedOccupancy.seatId
          )
        : mountedOccupancy.occupancyKind === "entry" &&
            mountedOccupancy.entryId !== null
          ? this.#dependencies.readMountedEntryAuthoring(
              mountedOccupancy.environmentAssetId,
              mountedOccupancy.entryId
            )
          : null;
    const occupancyPolicy =
      resolveMetaverseWorldMountedOccupancyPolicySnapshotFromAuthoring(
        mountedOccupancy,
        authoredMountedOccupancy
      );

    if (occupancyPolicy !== null) {
      return createMountedOccupancyRuntimeState(
        mountedOccupancy,
        this.#dependencies.resolveVehicleId(mountedOccupancy.environmentAssetId),
        occupancyPolicy
      ) as MountedOccupancy;
    }

    return null;
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
    const requestedMountedEnvironmentAssetId =
      normalizedCommand.mountedOccupancy?.environmentAssetId ?? null;
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
      playerRuntime.linearVelocityX = 0;
      playerRuntime.linearVelocityY = 0;
      playerRuntime.linearVelocityZ = 0;
      playerRuntime.mountedOccupancy = null;
      playerRuntime.lastPoseAtMs = nowMs;
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
    const previousMountedOccupancy = playerRuntime.mountedOccupancy;
    const acceptedMountedOccupancy = this.resolveAcceptedMountedOccupancy(
      playerRuntime.playerId,
      requestedMountedOccupancy,
      previousMountedOccupancy
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
        requestedMountedEnvironmentAssetId ??
        requestedMountedOccupancy?.environmentAssetId ??
        previousMountedOccupancy?.environmentAssetId ??
        null;

      this.#dependencies.clearDriverVehicleControl(playerRuntime.playerId);
      playerRuntime.angularVelocityRadiansPerSecond = 0;
      playerRuntime.linearVelocityX = 0;
      playerRuntime.linearVelocityY = 0;
      playerRuntime.linearVelocityZ = 0;
      playerRuntime.lastPoseAtMs = nowMs;
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
