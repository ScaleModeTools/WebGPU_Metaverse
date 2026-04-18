import {
  type MetaversePlayerId,
  type MetaversePresenceMountedOccupancySnapshot,
  type MetaversePresenceMountedOccupantRoleId
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseVehicleId,
  type MetaverseVehicleId
} from "@webgpu-metaverse/shared/metaverse/realtime";

import { readMetaverseAuthoritativeSurfaceAsset } from "../../config/metaverse-authoritative-world-surface.js";
import { MetaverseAuthoritativeRapierPhysicsRuntime } from "../../classes/metaverse-authoritative-rapier-physics-runtime.js";
import { MetaverseAuthoritativeSurfaceDriveRuntime } from "../../classes/metaverse-authoritative-surface-drive-runtime.js";
import type {
  PhysicsVector3Snapshot,
  RapierColliderHandle
} from "../../types/metaverse-authoritative-rapier.js";

interface MetaverseAuthoritativeVehicleDriveColliderShape {
  readonly halfExtents: PhysicsVector3Snapshot;
  readonly localCenter: PhysicsVector3Snapshot;
}

export interface MetaverseAuthoritativeVehicleRegistryMountedOccupancyRuntimeState {
  readonly environmentAssetId: string;
  readonly occupancyKind: MetaversePresenceMountedOccupancySnapshot["occupancyKind"];
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string | null;
  readonly vehicleId: MetaverseVehicleId;
}

export interface MetaverseAuthoritativeVehicleRegistryPlayerRuntimeState {
  readonly playerId: MetaversePlayerId;
  positionX: number;
  positionY: number;
  positionZ: number;
  yawRadians: number;
}

export interface MetaverseAuthoritativeVehicleRuntimeRegistrySeatRuntimeState {
  occupantPlayerId: MetaversePlayerId | null;
  occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string;
}

export interface MetaverseAuthoritativeVehicleRuntimeRegistryRuntimeState<
  SeatRuntime extends MetaverseAuthoritativeVehicleRuntimeRegistrySeatRuntimeState = MetaverseAuthoritativeVehicleRuntimeRegistrySeatRuntimeState
> {
  angularVelocityRadiansPerSecond: number;
  readonly driveRuntime: MetaverseAuthoritativeSurfaceDriveRuntime;
  readonly environmentAssetId: string;
  forwardSpeedUnitsPerSecond: number;
  lastPoseAtMs: number | null;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  readonly seatsById: Map<string, SeatRuntime>;
  strafeSpeedUnitsPerSecond: number;
  readonly vehicleId: MetaverseVehicleId;
  yawRadians: number;
}

interface MetaverseAuthoritativeVehicleRuntimeRegistryDependencies<
  VehicleRuntime extends MetaverseAuthoritativeVehicleRuntimeRegistryRuntimeState
> {
  readonly controllerOffsetMeters: number;
  readonly physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly syncVehicleDynamicSurfaceColliders: (
    vehicleRuntime: VehicleRuntime
  ) => void;
  readonly vehicleDriveColliderHandles: Set<RapierColliderHandle>;
  readonly vehicleSurfaceWorldRadius: number;
  readonly vehiclesById: Map<MetaverseVehicleId, VehicleRuntime>;
}

function createPhysicsVector3Snapshot(
  x: number,
  y: number,
  z: number
): PhysicsVector3Snapshot {
  return Object.freeze({
    x,
    y,
    z
  });
}

function resolveVehicleDriveColliderShape(
  environmentAssetId: string
): MetaverseAuthoritativeVehicleDriveColliderShape {
  const surfaceAsset = readMetaverseAuthoritativeSurfaceAsset(environmentAssetId);
  const blockerCollider =
    surfaceAsset?.surfaceColliders.find(
      (surfaceCollider) => surfaceCollider.traversalAffordance === "blocker"
    ) ?? null;

  if (surfaceAsset === null || blockerCollider === null) {
    throw new Error(
      `Metaverse authoritative world requires blocker collider authoring for ${environmentAssetId}.`
    );
  }

  return Object.freeze({
    halfExtents: createPhysicsVector3Snapshot(
      Math.abs(blockerCollider.size.x) * 0.5,
      Math.abs(blockerCollider.size.y) * 0.5,
      Math.abs(blockerCollider.size.z) * 0.5
    ),
    localCenter: createPhysicsVector3Snapshot(
      blockerCollider.center.x,
      blockerCollider.center.y,
      blockerCollider.center.z
    )
  });
}

export class MetaverseAuthoritativeVehicleRuntimeRegistry<
  PlayerRuntime extends MetaverseAuthoritativeVehicleRegistryPlayerRuntimeState,
  MountedOccupancy extends MetaverseAuthoritativeVehicleRegistryMountedOccupancyRuntimeState,
  SeatRuntime extends MetaverseAuthoritativeVehicleRuntimeRegistrySeatRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeVehicleRuntimeRegistryRuntimeState<SeatRuntime>
> {
  readonly #dependencies: MetaverseAuthoritativeVehicleRuntimeRegistryDependencies<VehicleRuntime>;
  readonly #vehicleIdsByEnvironmentAssetId = new Map<string, MetaverseVehicleId>();

  #nextVehicleOrdinal = 1;

  constructor(
    dependencies: MetaverseAuthoritativeVehicleRuntimeRegistryDependencies<VehicleRuntime>
  ) {
    this.#dependencies = dependencies;
  }

  resolveVehicleId(environmentAssetId: string): MountedOccupancy["vehicleId"] {
    const existingVehicleId =
      this.#vehicleIdsByEnvironmentAssetId.get(environmentAssetId);

    if (existingVehicleId !== undefined) {
      return existingVehicleId as MountedOccupancy["vehicleId"];
    }

    const preferredVehicleId =
      createMetaverseVehicleId(environmentAssetId) ??
      createMetaverseVehicleId(`metaverse-vehicle-${this.#nextVehicleOrdinal}`);

    if (preferredVehicleId === null) {
      throw new Error(
        `Metaverse authoritative world could not resolve a vehicle id for ${environmentAssetId}.`
      );
    }

    this.#nextVehicleOrdinal += 1;
    this.#vehicleIdsByEnvironmentAssetId.set(environmentAssetId, preferredVehicleId);

    return preferredVehicleId as MountedOccupancy["vehicleId"];
  }

  ensureVehicleRuntime(
    environmentAssetId: string,
    vehicleId: MountedOccupancy["vehicleId"]
  ): VehicleRuntime {
    const existingVehicleRuntime = this.#dependencies.vehiclesById.get(vehicleId);

    if (existingVehicleRuntime !== undefined) {
      return existingVehicleRuntime;
    }

    const driveColliderShape = resolveVehicleDriveColliderShape(
      environmentAssetId
    );
    const vehicleRuntime = {
      angularVelocityRadiansPerSecond: 0,
      driveRuntime: new MetaverseAuthoritativeSurfaceDriveRuntime(
        {
          controllerOffsetMeters: this.#dependencies.controllerOffsetMeters,
          shape: {
            halfExtents: driveColliderShape.halfExtents,
            kind: "cuboid",
            localCenter: driveColliderShape.localCenter
          },
          spawnPosition: createPhysicsVector3Snapshot(0, 0, 0),
          spawnYawRadians: 0,
          worldRadius: this.#dependencies.vehicleSurfaceWorldRadius
        },
        this.#dependencies.physicsRuntime
      ),
      environmentAssetId,
      forwardSpeedUnitsPerSecond: 0,
      lastPoseAtMs: null,
      linearVelocityX: 0,
      linearVelocityY: 0,
      linearVelocityZ: 0,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      seatsById: new Map<string, SeatRuntime>(),
      strafeSpeedUnitsPerSecond: 0,
      vehicleId,
      yawRadians: 0
    } as VehicleRuntime;

    this.#dependencies.vehicleDriveColliderHandles.add(
      vehicleRuntime.driveRuntime.colliderHandle
    );
    this.#dependencies.vehiclesById.set(vehicleId, vehicleRuntime);

    return vehicleRuntime;
  }

  syncVehicleOccupancyAndInitialPoseFromPlayer(
    playerRuntime: PlayerRuntime,
    mountedOccupancy: MountedOccupancy,
    nowMs: number
  ): VehicleRuntime {
    const vehicleRuntime = this.ensureVehicleRuntime(
      mountedOccupancy.environmentAssetId,
      mountedOccupancy.vehicleId
    );

    if (
      mountedOccupancy.occupancyKind === "seat" &&
      mountedOccupancy.seatId !== null
    ) {
      const seatRuntime = this.#ensureVehicleSeatRuntime(
        vehicleRuntime,
        mountedOccupancy.seatId,
        mountedOccupancy.occupantRole
      );

      seatRuntime.occupantPlayerId = playerRuntime.playerId;
      seatRuntime.occupantRole = mountedOccupancy.occupantRole;
    }

    if (vehicleRuntime.lastPoseAtMs === null) {
      vehicleRuntime.angularVelocityRadiansPerSecond = 0;
      vehicleRuntime.forwardSpeedUnitsPerSecond = 0;
      vehicleRuntime.linearVelocityX = 0;
      vehicleRuntime.linearVelocityY = 0;
      vehicleRuntime.linearVelocityZ = 0;
      vehicleRuntime.positionX = playerRuntime.positionX;
      vehicleRuntime.positionY = playerRuntime.positionY;
      vehicleRuntime.positionZ = playerRuntime.positionZ;
      vehicleRuntime.strafeSpeedUnitsPerSecond = 0;
      vehicleRuntime.yawRadians = playerRuntime.yawRadians;
      vehicleRuntime.lastPoseAtMs = nowMs;
    }

    this.#syncVehicleDriveRuntime(vehicleRuntime);
    this.#dependencies.syncVehicleDynamicSurfaceColliders(vehicleRuntime);

    return vehicleRuntime;
  }

  #ensureVehicleSeatRuntime(
    vehicleRuntime: VehicleRuntime,
    seatId: string,
    occupantRole: MetaversePresenceMountedOccupantRoleId
  ): SeatRuntime {
    const existingSeatRuntime = vehicleRuntime.seatsById.get(seatId);

    if (existingSeatRuntime !== undefined) {
      return existingSeatRuntime;
    }

    const seatRuntime = {
      occupantPlayerId: null,
      occupantRole,
      seatId
    } as SeatRuntime;

    vehicleRuntime.seatsById.set(seatId, seatRuntime);

    return seatRuntime;
  }

  #syncVehicleDriveRuntime(vehicleRuntime: VehicleRuntime): void {
    vehicleRuntime.driveRuntime.syncAuthoritativeState({
      linearVelocity: createPhysicsVector3Snapshot(
        vehicleRuntime.linearVelocityX,
        vehicleRuntime.linearVelocityY,
        vehicleRuntime.linearVelocityZ
      ),
      position: createPhysicsVector3Snapshot(
        vehicleRuntime.positionX,
        vehicleRuntime.positionY,
        vehicleRuntime.positionZ
      ),
      yawRadians: vehicleRuntime.yawRadians
    });
  }
}
