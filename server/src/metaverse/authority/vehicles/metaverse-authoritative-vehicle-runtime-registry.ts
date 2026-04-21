import {
  type MetaversePlayerId,
  type MetaversePresenceMountedOccupancySnapshot,
  type MetaversePresenceMountedOccupantRoleId
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  readMetaverseWorldMountedEntryAuthoring,
  readMetaverseWorldMountedSeatAuthoring,
  type MetaverseMountedVehicleControlRoutingPolicyId,
  type MetaverseWorldMountedEntryAuthoring,
  type MetaverseWorldMountedSeatAuthoring,
  createMetaverseVehicleId,
  type MetaverseVehicleId
} from "@webgpu-metaverse/shared";
import type { MetaverseWorldSurfaceAssetAuthoring } from "@webgpu-metaverse/shared/metaverse/world";

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
  readonly controlRoutingPolicyId: MetaverseMountedVehicleControlRoutingPolicyId;
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
  readonly readSurfaceAsset: (
    environmentAssetId: string
  ) => MetaverseWorldSurfaceAssetAuthoring | null;
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
  readSurfaceAsset: (
    environmentAssetId: string
  ) => MetaverseWorldSurfaceAssetAuthoring | null,
  environmentAssetId: string
): MetaverseAuthoritativeVehicleDriveColliderShape {
  const surfaceAsset = readSurfaceAsset(environmentAssetId);

  if (surfaceAsset?.collider === null || surfaceAsset === null) {
    throw new Error(
      `Metaverse authoritative world requires collider authoring for ${environmentAssetId}.`
    );
  }

  return Object.freeze({
    halfExtents: createPhysicsVector3Snapshot(
      Math.abs(surfaceAsset.collider.size.x) * 0.5,
      Math.abs(surfaceAsset.collider.size.y) * 0.5,
      Math.abs(surfaceAsset.collider.size.z) * 0.5
    ),
    localCenter: createPhysicsVector3Snapshot(
      surfaceAsset.collider.center.x,
      surfaceAsset.collider.center.y,
      surfaceAsset.collider.center.z
    )
  });
}

function resolveVehicleInitialPose(
  readSurfaceAsset: (
    environmentAssetId: string
  ) => MetaverseWorldSurfaceAssetAuthoring | null,
  environmentAssetId: string
): {
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
} {
  const surfaceAsset = readSurfaceAsset(environmentAssetId);
  const authoredPlacement = surfaceAsset?.placements[0] ?? null;

  if (surfaceAsset === null || authoredPlacement === null) {
    throw new Error(
      `Metaverse authoritative world requires one authored placement for vehicle ${environmentAssetId}.`
    );
  }

  return Object.freeze({
    position: createPhysicsVector3Snapshot(
      authoredPlacement.position.x,
      authoredPlacement.position.y,
      authoredPlacement.position.z
    ),
    yawRadians: authoredPlacement.rotationYRadians
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
      this.#dependencies.readSurfaceAsset,
      environmentAssetId
    );
    const initialVehiclePose = resolveVehicleInitialPose(
      this.#dependencies.readSurfaceAsset,
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
      positionX: initialVehiclePose.position.x,
      positionY: initialVehiclePose.position.y,
      positionZ: initialVehiclePose.position.z,
      seatsById: new Map<string, SeatRuntime>(),
      strafeSpeedUnitsPerSecond: 0,
      vehicleId,
      yawRadians: initialVehiclePose.yawRadians
    } as VehicleRuntime;

    this.#dependencies.vehicleDriveColliderHandles.add(
      vehicleRuntime.driveRuntime.colliderHandle
    );
    this.#dependencies.vehiclesById.set(vehicleId, vehicleRuntime);

    return vehicleRuntime;
  }

  readMountedSeatAuthoring(
    environmentAssetId: string,
    seatId: string
  ): MetaverseWorldMountedSeatAuthoring | null {
    return readMetaverseWorldMountedSeatAuthoring(
      this.#dependencies.readSurfaceAsset(environmentAssetId),
      seatId
    );
  }

  readMountedEntryAuthoring(
    environmentAssetId: string,
    entryId: string
  ): MetaverseWorldMountedEntryAuthoring | null {
    return readMetaverseWorldMountedEntryAuthoring(
      this.#dependencies.readSurfaceAsset(environmentAssetId),
      entryId
    );
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
      const seatAuthoring = this.readMountedSeatAuthoring(
        mountedOccupancy.environmentAssetId,
        mountedOccupancy.seatId
      );

      if (seatAuthoring === null) {
        throw new Error(
          `Metaverse authoritative world could not resolve authored seat ${mountedOccupancy.seatId} for ${mountedOccupancy.environmentAssetId}.`
        );
      }

      const seatRuntime = this.#ensureVehicleSeatRuntime(
        vehicleRuntime,
        seatAuthoring
      );

      seatRuntime.occupantPlayerId = playerRuntime.playerId;
      seatRuntime.occupantRole = seatAuthoring.seatRole;
    }

    if (vehicleRuntime.lastPoseAtMs === null) {
      vehicleRuntime.angularVelocityRadiansPerSecond = 0;
      vehicleRuntime.forwardSpeedUnitsPerSecond = 0;
      vehicleRuntime.linearVelocityX = 0;
      vehicleRuntime.linearVelocityY = 0;
      vehicleRuntime.linearVelocityZ = 0;
      vehicleRuntime.strafeSpeedUnitsPerSecond = 0;
      vehicleRuntime.lastPoseAtMs = nowMs;
    }

    this.#syncVehicleDriveRuntime(vehicleRuntime);
    this.#dependencies.syncVehicleDynamicSurfaceColliders(vehicleRuntime);

    return vehicleRuntime;
  }

  #ensureVehicleSeatRuntime(
    vehicleRuntime: VehicleRuntime,
    seatAuthoring: MetaverseWorldMountedSeatAuthoring
  ): SeatRuntime {
    const existingSeatRuntime = vehicleRuntime.seatsById.get(seatAuthoring.seatId);

    if (existingSeatRuntime !== undefined) {
      return existingSeatRuntime;
    }

    const seatRuntime = {
      controlRoutingPolicyId: seatAuthoring.controlRoutingPolicyId,
      occupantPlayerId: null,
      occupantRole: seatAuthoring.seatRole,
      seatId: seatAuthoring.seatId
    } as SeatRuntime;

    vehicleRuntime.seatsById.set(seatAuthoring.seatId, seatRuntime);

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
