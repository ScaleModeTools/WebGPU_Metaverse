import {
  createMetaverseSyncDriverVehicleControlCommand,
  type MetaverseSyncDriverVehicleControlCommand,
  type MetaverseVehicleId
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type {
  MetaversePlayerId,
  MetaversePresenceMountedOccupancySnapshot,
  MetaversePresenceMountedOccupantRoleId
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  wrapRadians,
  type MetaverseSurfaceTraversalConfig
} from "@webgpu-metaverse/shared/metaverse/traversal";

import type {
  PhysicsVector3Snapshot,
  RapierQueryFilterPredicate
} from "../../types/metaverse-authoritative-rapier.js";

export interface MetaverseAuthoritativeDriverVehicleControlRuntimeState {
  readonly environmentAssetId: string;
  boost: boolean;
  controlSequence: number;
  moveAxis: number;
  strafeAxis: number;
  yawAxis: number;
}

export interface MetaverseAuthoritativeVehicleSeatRuntimeState {
  occupantPlayerId: MetaversePlayerId | null;
  occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string;
}

export interface MetaverseAuthoritativeVehicleMountedOccupancyRuntimeState {
  readonly environmentAssetId: string;
  readonly occupancyKind: MetaversePresenceMountedOccupancySnapshot["occupancyKind"];
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string | null;
  readonly vehicleId: MetaverseVehicleId;
}

interface MetaverseAuthoritativeVehicleDriveRuntime {
  advance(
    intentSnapshot: {
      readonly boost: boolean;
      readonly moveAxis: number;
      readonly strafeAxis: number;
      readonly yawAxis: number;
    },
    locomotionConfig: MetaverseSurfaceTraversalConfig,
    deltaSeconds: number,
    lockedHeightMeters: number,
    preferredLookYawRadians: number | null,
    filterPredicate?: RapierQueryFilterPredicate
  ): {
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  };
}

export interface MetaverseAuthoritativeVehicleRuntimeState<
  SeatRuntime extends MetaverseAuthoritativeVehicleSeatRuntimeState = MetaverseAuthoritativeVehicleSeatRuntimeState
> {
  angularVelocityRadiansPerSecond: number;
  readonly driveRuntime: MetaverseAuthoritativeVehicleDriveRuntime;
  readonly environmentAssetId: string;
  forwardSpeedUnitsPerSecond: number;
  lastPoseAtMs: number | null;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  readonly seatsById: ReadonlyMap<string, SeatRuntime>;
  strafeSpeedUnitsPerSecond: number;
  readonly vehicleId: MetaverseVehicleId;
  yawRadians: number;
}

export interface MetaverseAuthoritativeVehiclePlayerRuntimeState<
  MountedOccupancy extends MetaverseAuthoritativeVehicleMountedOccupancyRuntimeState = MetaverseAuthoritativeVehicleMountedOccupancyRuntimeState
> {
  lastSeenAtMs: number;
  mountedOccupancy: MountedOccupancy | null;
  readonly playerId: MetaversePlayerId;
  realtimeWorldAuthorityActive: boolean;
}

interface MetaverseAuthoritativeVehicleDriveAuthorityDependencies<
  PlayerRuntime extends MetaverseAuthoritativeVehiclePlayerRuntimeState<MountedOccupancy>,
  MountedOccupancy extends MetaverseAuthoritativeVehicleMountedOccupancyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeVehicleRuntimeState,
  DriverControlState extends MetaverseAuthoritativeDriverVehicleControlRuntimeState
> {
  readonly createWaterborneTraversalColliderPredicate: (
    excludedOwnerEnvironmentAssetId: string | null
  ) => RapierQueryFilterPredicate;
  readonly driverVehicleControlsByPlayerId: Map<
    MetaversePlayerId,
    DriverControlState
  >;
  readonly playersById: ReadonlyMap<MetaversePlayerId, PlayerRuntime>;
  readonly syncMountedPlayerPoseFromVehicle: (
    playerRuntime: PlayerRuntime,
    vehicleRuntime: VehicleRuntime,
    nowMs: number
  ) => void;
  readonly syncVehicleDynamicSurfaceColliders: (
    vehicleRuntime: VehicleRuntime
  ) => void;
  readonly vehicleSurfaceTraversalConfig: MetaverseSurfaceTraversalConfig;
  readonly vehiclesById: ReadonlyMap<MetaverseVehicleId, VehicleRuntime>;
}

function normalizeAngularDeltaRadians(rawValue: number): number {
  return wrapRadians(rawValue);
}

export class MetaverseAuthoritativeVehicleDriveAuthority<
  PlayerRuntime extends MetaverseAuthoritativeVehiclePlayerRuntimeState<MountedOccupancy>,
  MountedOccupancy extends MetaverseAuthoritativeVehicleMountedOccupancyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeVehicleRuntimeState,
  DriverControlState extends MetaverseAuthoritativeDriverVehicleControlRuntimeState
> {
  readonly #dependencies: MetaverseAuthoritativeVehicleDriveAuthorityDependencies<
    PlayerRuntime,
    MountedOccupancy,
    VehicleRuntime,
    DriverControlState
  >;

  constructor(
    dependencies: MetaverseAuthoritativeVehicleDriveAuthorityDependencies<
      PlayerRuntime,
      MountedOccupancy,
      VehicleRuntime,
      DriverControlState
    >
  ) {
    this.#dependencies = dependencies;
  }

  acceptSyncDriverVehicleControlCommand(
    command: MetaverseSyncDriverVehicleControlCommand,
    nowMs: number
  ): void {
    const playerRuntime = this.#dependencies.playersById.get(command.playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    playerRuntime.realtimeWorldAuthorityActive = true;

    const normalizedCommand =
      createMetaverseSyncDriverVehicleControlCommand(command);
    const mountedOccupancy = playerRuntime.mountedOccupancy;

    if (
      mountedOccupancy === null ||
      mountedOccupancy.occupancyKind !== "seat" ||
      mountedOccupancy.occupantRole !== "driver" ||
      mountedOccupancy.seatId === null ||
      mountedOccupancy.environmentAssetId !==
        normalizedCommand.controlIntent.environmentAssetId
    ) {
      return;
    }

    const vehicleRuntime = this.#dependencies.vehiclesById.get(
      mountedOccupancy.vehicleId
    );
    const seatRuntime =
      vehicleRuntime?.seatsById.get(mountedOccupancy.seatId) ?? null;

    if (
      seatRuntime === null ||
      seatRuntime.occupantPlayerId !== command.playerId ||
      seatRuntime.occupantRole !== "driver"
    ) {
      return;
    }

    const existingControlState =
      this.#dependencies.driverVehicleControlsByPlayerId.get(command.playerId);

    if (
      existingControlState !== undefined &&
      normalizedCommand.controlSequence <= existingControlState.controlSequence
    ) {
      return;
    }

    this.#dependencies.driverVehicleControlsByPlayerId.set(
      command.playerId,
      {
        boost: normalizedCommand.controlIntent.boost,
        controlSequence: normalizedCommand.controlSequence,
        environmentAssetId: normalizedCommand.controlIntent.environmentAssetId,
        moveAxis: normalizedCommand.controlIntent.moveAxis,
        strafeAxis: normalizedCommand.controlIntent.strafeAxis,
        yawAxis: normalizedCommand.controlIntent.yawAxis
      } as DriverControlState
    );
    playerRuntime.lastSeenAtMs = nowMs;
  }

  advanceVehicleRuntimes(deltaSeconds: number, nowMs: number): void {
    for (const vehicleRuntime of this.#dependencies.vehiclesById.values()) {
      if (vehicleRuntime.lastPoseAtMs === null) {
        continue;
      }

      const driverControlState =
        this.#resolveDriverVehicleControlRuntimeState(vehicleRuntime);

      this.#advanceVehicleRuntime(vehicleRuntime, driverControlState, deltaSeconds);
      vehicleRuntime.lastPoseAtMs = nowMs;
    }
  }

  syncMountedPlayerWorldStateFromVehicles(nowMs: number): void {
    for (const playerRuntime of this.#dependencies.playersById.values()) {
      const mountedOccupancy = playerRuntime.mountedOccupancy;

      if (mountedOccupancy === null) {
        continue;
      }

      const vehicleRuntime = this.#dependencies.vehiclesById.get(
        mountedOccupancy.vehicleId
      );

      if (vehicleRuntime === undefined) {
        continue;
      }

      this.#dependencies.syncMountedPlayerPoseFromVehicle(
        playerRuntime,
        vehicleRuntime,
        nowMs
      );
    }
  }

  #resolveDriverVehicleControlRuntimeState(
    vehicleRuntime: VehicleRuntime
  ): DriverControlState | null {
    for (const seatRuntime of vehicleRuntime.seatsById.values()) {
      if (
        seatRuntime.occupantPlayerId === null ||
        seatRuntime.occupantRole !== "driver"
      ) {
        continue;
      }

      const playerRuntime = this.#dependencies.playersById.get(
        seatRuntime.occupantPlayerId
      );

      if (
        playerRuntime === undefined ||
        playerRuntime.mountedOccupancy === null ||
        playerRuntime.mountedOccupancy.occupancyKind !== "seat" ||
        playerRuntime.mountedOccupancy.vehicleId !== vehicleRuntime.vehicleId
      ) {
        continue;
      }

      const driverControlState =
        this.#dependencies.driverVehicleControlsByPlayerId.get(
          seatRuntime.occupantPlayerId
        );

      if (
        driverControlState === undefined ||
        driverControlState.environmentAssetId !== vehicleRuntime.environmentAssetId
      ) {
        return null;
      }

      return driverControlState;
    }

    return null;
  }

  #advanceVehicleRuntime(
    vehicleRuntime: VehicleRuntime,
    driverControlState: DriverControlState | null,
    deltaSeconds: number
  ): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }

    const nextVehicleState = vehicleRuntime.driveRuntime.advance(
      {
        boost: driverControlState?.boost === true,
        moveAxis: driverControlState?.moveAxis ?? 0,
        strafeAxis: driverControlState?.strafeAxis ?? 0,
        yawAxis: driverControlState?.yawAxis ?? 0
      },
      this.#dependencies.vehicleSurfaceTraversalConfig,
      deltaSeconds,
      vehicleRuntime.positionY,
      null,
      this.#dependencies.createWaterborneTraversalColliderPredicate(
        vehicleRuntime.environmentAssetId
      )
    );
    const nextYawRadians = nextVehicleState.yawRadians;
    const nextPositionX = nextVehicleState.position.x;
    const nextPositionZ = nextVehicleState.position.z;
    const deltaX = nextPositionX - vehicleRuntime.positionX;
    const deltaZ = nextPositionZ - vehicleRuntime.positionZ;
    const previousYawRadians = vehicleRuntime.yawRadians;

    vehicleRuntime.positionX = nextPositionX;
    vehicleRuntime.positionY = nextVehicleState.position.y;
    vehicleRuntime.positionZ = nextPositionZ;
    vehicleRuntime.yawRadians = nextYawRadians;
    vehicleRuntime.linearVelocityX = nextVehicleState.linearVelocity.x;
    vehicleRuntime.linearVelocityY = nextVehicleState.linearVelocity.y;
    vehicleRuntime.linearVelocityZ = nextVehicleState.linearVelocity.z;
    vehicleRuntime.angularVelocityRadiansPerSecond =
      normalizeAngularDeltaRadians(nextYawRadians - previousYawRadians) /
      deltaSeconds;
    const forwardX = Math.sin(nextYawRadians);
    const forwardZ = -Math.cos(nextYawRadians);
    const rightX = Math.cos(nextYawRadians);
    const rightZ = Math.sin(nextYawRadians);

    vehicleRuntime.forwardSpeedUnitsPerSecond =
      deltaSeconds > 0
        ? (deltaX * forwardX + deltaZ * forwardZ) / deltaSeconds
        : 0;
    vehicleRuntime.strafeSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * rightX + deltaZ * rightZ) / deltaSeconds : 0;
    this.#dependencies.syncVehicleDynamicSurfaceColliders(vehicleRuntime);
  }
}
