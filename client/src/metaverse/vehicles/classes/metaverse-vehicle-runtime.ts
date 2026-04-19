import {
  MetaverseSurfaceDriveBodyRuntime,
  type PhysicsVector3Snapshot,
  type RapierColliderHandle,
  type RapierPhysicsRuntime,
  type RapierQueryFilterPredicate
} from "@/physics";
import {
  createMetaverseWorldMountedEntryOccupancyPolicySnapshot,
  createMetaverseWorldMountedSeatOccupancyPolicySnapshot,
  type MetaverseWorldPlacedWaterRegionSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import type { MetaversePlacedCuboidColliderSnapshot } from "../../states/metaverse-environment-collision";
import type {
  MetaverseEnvironmentEntryProofConfig,
  MetaverseEnvironmentSeatProofConfig
} from "../../types/metaverse-runtime";
import type { SurfaceLocomotionConfig } from "../../traversal/types/traversal";
import {
  clamp,
  freezeVector3,
  toFiniteNumber,
  wrapRadians
} from "../../traversal/policies/surface-locomotion";
import { isWaterbornePosition } from "../../traversal/policies/surface-routing";
import type {
  MountedVehicleControlIntent,
  MountedVehicleEntryRuntimeSnapshot,
  MountedVehicleOccupancyRuntimeSnapshot,
  MountedVehicleRuntimeSnapshot,
  MountedVehicleSeatRuntimeSnapshot
} from "../types/vehicle-runtime";

interface MetaverseVehicleRuntimeInit {
  readonly authoritativeCorrection: {
    readonly grossSnapDistanceThresholdMeters: number;
    readonly grossSnapYawThresholdRadians: number;
    readonly routineBlendAlpha: number;
    readonly routinePositionBlendThresholdMeters: number;
    readonly routineYawBlendThresholdRadians: number;
  };
  readonly driveCollider: {
    readonly center: PhysicsVector3Snapshot;
    readonly size: PhysicsVector3Snapshot;
  } | null;
  readonly environmentAssetId: string;
  readonly label: string;
  readonly oceanHeightMeters: number;
  readonly physicsRuntime: RapierPhysicsRuntime;
  readonly poseSnapshot: {
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  };
  readonly resolveWaterborneTraversalFilterPredicate: (
    excludedOwnerEnvironmentAssetId?: string | null,
    excludedColliders?: readonly RapierColliderHandle[]
  ) => RapierQueryFilterPredicate;
  readonly entries: readonly MetaverseEnvironmentEntryProofConfig[] | null;
  readonly seats: readonly MetaverseEnvironmentSeatProofConfig[];
  readonly surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readonly waterContactProbeRadiusMeters: number;
  readonly waterlineHeightMeters: number;
  readonly worldRadius: number;
}

interface MetaverseVehicleAuthoritativePoseSnapshot {
  readonly linearVelocity?: PhysicsVector3Snapshot | null;
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

interface MetaverseVehicleOccupancyRuntime {
  occupy(): void;
  occupancySnapshot(): MountedVehicleOccupancyRuntimeSnapshot;
  vacate(): void;
}

function resolveDriveColliderShape(
  driveCollider: MetaverseVehicleRuntimeInit["driveCollider"],
  waterContactProbeRadiusMeters: number
): {
  readonly halfExtents: PhysicsVector3Snapshot;
  readonly localCenter: PhysicsVector3Snapshot;
} {
  if (driveCollider === null) {
    const fallbackRadiusMeters = Math.max(
      0.5,
      toFiniteNumber(waterContactProbeRadiusMeters, 1.75) * 0.75
    );

    return Object.freeze({
      halfExtents: freezeVector3(
        fallbackRadiusMeters,
        0.7,
        fallbackRadiusMeters
      ),
      localCenter: freezeVector3(0, 0.7, 0)
    });
  }

  return Object.freeze({
    halfExtents: freezeVector3(
      Math.abs(driveCollider.size.x) * 0.5,
      Math.abs(driveCollider.size.y) * 0.5,
      Math.abs(driveCollider.size.z) * 0.5
    ),
    localCenter: freezeVector3(
      driveCollider.center.x,
      driveCollider.center.y,
      driveCollider.center.z
    )
  });
}

class MetaverseVehicleSeatRuntime {
  readonly #cameraPolicyId: MountedVehicleSeatRuntimeSnapshot["cameraPolicyId"];
  readonly #controlRoutingPolicyId: MountedVehicleSeatRuntimeSnapshot["controlRoutingPolicyId"];
  readonly #directEntryEnabled: boolean;
  readonly #dismountOffset: MountedVehicleSeatRuntimeSnapshot["dismountOffset"];
  readonly #label: MountedVehicleSeatRuntimeSnapshot["label"];
  readonly #lookLimitPolicyId: MountedVehicleSeatRuntimeSnapshot["lookLimitPolicyId"];
  readonly #occupancyAnimationId: MountedVehicleSeatRuntimeSnapshot["occupancyAnimationId"];
  readonly #seatId: string;
  readonly #seatNodeName: string;
  readonly #seatRole: MountedVehicleSeatRuntimeSnapshot["seatRole"];

  #occupied = false;

  constructor(seat: MetaverseEnvironmentSeatProofConfig) {
    this.#cameraPolicyId = seat.cameraPolicyId;
    this.#controlRoutingPolicyId = seat.controlRoutingPolicyId;
    this.#directEntryEnabled = seat.directEntryEnabled;
    this.#dismountOffset = freezeVector3(
      seat.dismountOffset.x,
      seat.dismountOffset.y,
      seat.dismountOffset.z
    );
    this.#label = seat.label;
    this.#lookLimitPolicyId = seat.lookLimitPolicyId;
    this.#occupancyAnimationId = seat.occupancyAnimationId;
    this.#seatId = seat.seatId;
    this.#seatNodeName = seat.seatNodeName;
    this.#seatRole = seat.seatRole;
  }

  get seatId(): string {
    return this.#seatId;
  }

  get directEntryEnabled(): boolean {
    return this.#directEntryEnabled;
  }

  occupy(): void {
    this.#occupied = true;
  }

  vacate(): void {
    this.#occupied = false;
  }

  snapshot(): MountedVehicleSeatRuntimeSnapshot {
    return Object.freeze({
      cameraPolicyId: this.#cameraPolicyId,
      controlRoutingPolicyId: this.#controlRoutingPolicyId,
      directEntryEnabled: this.#directEntryEnabled,
      dismountOffset: this.#dismountOffset,
      label: this.#label,
      lookLimitPolicyId: this.#lookLimitPolicyId,
      occupancyAnimationId: this.#occupancyAnimationId,
      occupied: this.#occupied,
      seatId: this.#seatId,
      seatNodeName: this.#seatNodeName,
      seatRole: this.#seatRole
    });
  }

  occupancySnapshot(): MountedVehicleOccupancyRuntimeSnapshot {
    const occupancyPolicySnapshot =
      createMetaverseWorldMountedSeatOccupancyPolicySnapshot({
        cameraPolicyId: this.#cameraPolicyId,
        controlRoutingPolicyId: this.#controlRoutingPolicyId,
        label: this.#label,
        lookLimitPolicyId: this.#lookLimitPolicyId,
        occupancyAnimationId: this.#occupancyAnimationId,
        seatId: this.#seatId,
        seatRole: this.#seatRole
      });

    return Object.freeze({
      dismountOffset: this.#dismountOffset,
      ...occupancyPolicySnapshot
    });
  }
}

class MetaverseVehicleEntryRuntime {
  readonly #cameraPolicyId: MountedVehicleEntryRuntimeSnapshot["cameraPolicyId"];
  readonly #controlRoutingPolicyId: MountedVehicleEntryRuntimeSnapshot["controlRoutingPolicyId"];
  readonly #dismountOffset: MountedVehicleEntryRuntimeSnapshot["dismountOffset"];
  readonly #entryId: MountedVehicleEntryRuntimeSnapshot["entryId"];
  readonly #entryNodeName: MountedVehicleEntryRuntimeSnapshot["entryNodeName"];
  readonly #label: MountedVehicleEntryRuntimeSnapshot["label"];
  readonly #lookLimitPolicyId: MountedVehicleEntryRuntimeSnapshot["lookLimitPolicyId"];
  readonly #occupancyAnimationId: MountedVehicleEntryRuntimeSnapshot["occupancyAnimationId"];
  readonly #occupantRole: MountedVehicleEntryRuntimeSnapshot["occupantRole"];

  #occupied = false;

  constructor(entry: MetaverseEnvironmentEntryProofConfig) {
    this.#cameraPolicyId = entry.cameraPolicyId;
    this.#controlRoutingPolicyId = entry.controlRoutingPolicyId;
    this.#dismountOffset = freezeVector3(
      entry.dismountOffset.x,
      entry.dismountOffset.y,
      entry.dismountOffset.z
    );
    this.#entryId = entry.entryId;
    this.#entryNodeName = entry.entryNodeName;
    this.#label = entry.label;
    this.#lookLimitPolicyId = entry.lookLimitPolicyId;
    this.#occupancyAnimationId = entry.occupancyAnimationId;
    this.#occupantRole = entry.occupantRole;
  }

  get entryId(): string {
    return this.#entryId;
  }

  occupy(): void {
    this.#occupied = true;
  }

  vacate(): void {
    this.#occupied = false;
  }

  snapshot(): MountedVehicleEntryRuntimeSnapshot {
    return Object.freeze({
      cameraPolicyId: this.#cameraPolicyId,
      controlRoutingPolicyId: this.#controlRoutingPolicyId,
      dismountOffset: this.#dismountOffset,
      entryId: this.#entryId,
      entryNodeName: this.#entryNodeName,
      label: this.#label,
      lookLimitPolicyId: this.#lookLimitPolicyId,
      occupancyAnimationId: this.#occupancyAnimationId,
      occupied: this.#occupied,
      occupantRole: this.#occupantRole
    });
  }

  occupancySnapshot(): MountedVehicleOccupancyRuntimeSnapshot {
    const occupancyPolicySnapshot =
      createMetaverseWorldMountedEntryOccupancyPolicySnapshot({
        cameraPolicyId: this.#cameraPolicyId,
        controlRoutingPolicyId: this.#controlRoutingPolicyId,
        entryId: this.#entryId,
        label: this.#label,
        lookLimitPolicyId: this.#lookLimitPolicyId,
        occupancyAnimationId: this.#occupancyAnimationId,
        occupantRole: this.#occupantRole
      });

    return Object.freeze({
      dismountOffset: this.#dismountOffset,
      ...occupancyPolicySnapshot
    });
  }
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function resolveCorrectionBlendAlpha(
  errorMagnitude: number,
  routineThreshold: number,
  grossThreshold: number,
  routineBlendAlpha: number
): number {
  const normalizedRoutineBlendAlpha = clamp(
    toFiniteNumber(routineBlendAlpha, 0.35),
    0,
    1
  );
  const normalizedRoutineThreshold = Math.max(
    0,
    toFiniteNumber(routineThreshold, 0)
  );
  const normalizedGrossThreshold = Math.max(
    normalizedRoutineThreshold,
    toFiniteNumber(grossThreshold, normalizedRoutineThreshold)
  );
  const normalizedErrorMagnitude = Math.max(0, toFiniteNumber(errorMagnitude, 0));

  if (
    normalizedErrorMagnitude <= normalizedRoutineThreshold ||
    normalizedGrossThreshold <= normalizedRoutineThreshold
  ) {
    return normalizedRoutineBlendAlpha;
  }

  return lerp(
    normalizedRoutineBlendAlpha,
    1,
    (normalizedErrorMagnitude - normalizedRoutineThreshold) /
      Math.max(
        0.000001,
        normalizedGrossThreshold - normalizedRoutineThreshold
      )
  );
}

export class MetaverseVehicleRuntime {
  readonly #authoritativeCorrection: MetaverseVehicleRuntimeInit["authoritativeCorrection"];
  readonly #driveBodyRuntime: MetaverseSurfaceDriveBodyRuntime;
  readonly #environmentAssetId: string;
  readonly #entryRuntimes: readonly MetaverseVehicleEntryRuntime[];
  readonly #label: string;
  readonly #oceanHeightMeters: number;
  readonly #resolveWaterborneTraversalFilterPredicate:
    MetaverseVehicleRuntimeInit["resolveWaterborneTraversalFilterPredicate"];
  readonly #seatRuntimes: readonly MetaverseVehicleSeatRuntime[];
  readonly #surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];
  readonly #waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readonly #waterContactProbeRadiusMeters: number;
  readonly #waterlineHeightMeters: number;

  #occupancyRuntime: MetaverseVehicleOccupancyRuntime | null = null;
  #waterborne: boolean;

  constructor({
    authoritativeCorrection,
    driveCollider,
    environmentAssetId,
    entries,
    label,
    oceanHeightMeters,
    physicsRuntime,
    poseSnapshot,
    resolveWaterborneTraversalFilterPredicate,
    seats,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    waterContactProbeRadiusMeters,
    waterlineHeightMeters,
    worldRadius
  }: MetaverseVehicleRuntimeInit) {
    this.#authoritativeCorrection = authoritativeCorrection;
    this.#environmentAssetId = environmentAssetId;
    this.#label = label;
    this.#oceanHeightMeters = oceanHeightMeters;
    this.#resolveWaterborneTraversalFilterPredicate =
      resolveWaterborneTraversalFilterPredicate;
    this.#entryRuntimes = Object.freeze(
      (entries ?? []).map((entry) => new MetaverseVehicleEntryRuntime(entry))
    );
    this.#seatRuntimes = Object.freeze(
      seats.map((seat) => new MetaverseVehicleSeatRuntime(seat))
    );
    this.#surfaceColliderSnapshots = surfaceColliderSnapshots;
    this.#waterRegionSnapshots = waterRegionSnapshots;
    this.#waterContactProbeRadiusMeters = waterContactProbeRadiusMeters;
    this.#waterlineHeightMeters = toFiniteNumber(
      waterlineHeightMeters,
      poseSnapshot.position.y
    );
    const driveColliderShape = resolveDriveColliderShape(
      driveCollider,
      waterContactProbeRadiusMeters
    );

    this.#driveBodyRuntime = new MetaverseSurfaceDriveBodyRuntime(
      {
        controllerOffsetMeters: 0.02,
        shape: Object.freeze({
          halfExtents: driveColliderShape.halfExtents,
          kind: "cuboid",
          localCenter: driveColliderShape.localCenter
        }),
        spawnPosition: freezeVector3(
          poseSnapshot.position.x,
          toFiniteNumber(poseSnapshot.position.y, this.#waterlineHeightMeters),
          poseSnapshot.position.z
        ),
        spawnYawRadians: poseSnapshot.yawRadians,
        worldRadius
      },
      physicsRuntime
    );
    this.#waterborne = false;
    this.#syncWaterborneState();
  }

  get colliderHandle(): RapierColliderHandle {
    return this.#driveBodyRuntime.colliderHandle;
  }

  get snapshot(): MountedVehicleRuntimeSnapshot {
    const driveSnapshot = this.#driveBodyRuntime.snapshot;

    return Object.freeze({
      environmentAssetId: this.#environmentAssetId,
      label: this.#label,
      occupancy:
        this.#occupancyRuntime === null
          ? null
          : this.#occupancyRuntime.occupancySnapshot(),
      planarSpeedUnitsPerSecond: driveSnapshot.planarSpeedUnitsPerSecond,
      position: driveSnapshot.position,
      waterborne: this.#waterborne,
      yawRadians: driveSnapshot.yawRadians
    });
  }

  occupySeat(seatId: string): MountedVehicleSeatRuntimeSnapshot | null {
    const nextSeatRuntime = this.#seatRuntimes.find((seat) => seat.seatId === seatId);

    if (nextSeatRuntime === undefined) {
      return null;
    }

    this.clearOccupancy();
    nextSeatRuntime.occupy();
    this.#occupancyRuntime = nextSeatRuntime;

    return nextSeatRuntime.snapshot();
  }

  occupyEntry(entryId: string): MountedVehicleEntryRuntimeSnapshot | null {
    const nextEntryRuntime = this.#entryRuntimes.find(
      (entry) => entry.entryId === entryId
    );

    if (nextEntryRuntime === undefined) {
      return null;
    }

    this.clearOccupancy();
    nextEntryRuntime.occupy();
    this.#occupancyRuntime = nextEntryRuntime;

    return nextEntryRuntime.snapshot();
  }

  clearOccupancy(): void {
    this.#occupancyRuntime?.vacate();
    this.#occupancyRuntime = null;
  }

  syncAuthoritativePose(
    poseSnapshot: MetaverseVehicleAuthoritativePoseSnapshot
  ): MountedVehicleRuntimeSnapshot {
    const currentDriveSnapshot = this.#driveBodyRuntime.snapshot;
    const authoritativePosition = freezeVector3(
      poseSnapshot.position.x,
      poseSnapshot.position.y,
      poseSnapshot.position.z
    );
    const authoritativeYawRadians = wrapRadians(poseSnapshot.yawRadians);
    const positionErrorMeters = Math.hypot(
      authoritativePosition.x - currentDriveSnapshot.position.x,
      authoritativePosition.y - currentDriveSnapshot.position.y,
      authoritativePosition.z - currentDriveSnapshot.position.z
    );
    const yawErrorRadians = Math.abs(
      wrapRadians(authoritativeYawRadians - currentDriveSnapshot.yawRadians)
    );
    const shouldSnapCorrection =
      positionErrorMeters >=
        this.#authoritativeCorrection.grossSnapDistanceThresholdMeters ||
      yawErrorRadians >=
        this.#authoritativeCorrection.grossSnapYawThresholdRadians;
    const positionBlendAlpha = shouldSnapCorrection
      ? 1
      : resolveCorrectionBlendAlpha(
          positionErrorMeters,
          this.#authoritativeCorrection.routinePositionBlendThresholdMeters,
          this.#authoritativeCorrection.grossSnapDistanceThresholdMeters,
          this.#authoritativeCorrection.routineBlendAlpha
        );
    const yawBlendAlpha = shouldSnapCorrection
      ? 1
      : resolveCorrectionBlendAlpha(
          yawErrorRadians,
          this.#authoritativeCorrection.routineYawBlendThresholdRadians,
          this.#authoritativeCorrection.grossSnapYawThresholdRadians,
          this.#authoritativeCorrection.routineBlendAlpha
        );

    const blendedPosition = freezeVector3(
      lerp(
        currentDriveSnapshot.position.x,
        authoritativePosition.x,
        positionBlendAlpha
      ),
      lerp(
        currentDriveSnapshot.position.y,
        authoritativePosition.y,
        positionBlendAlpha
      ),
      lerp(
        currentDriveSnapshot.position.z,
        authoritativePosition.z,
        positionBlendAlpha
      )
    );
    const blendedYawRadians = wrapRadians(
      currentDriveSnapshot.yawRadians +
        wrapRadians(authoritativeYawRadians - currentDriveSnapshot.yawRadians) *
          yawBlendAlpha
    );
    this.#driveBodyRuntime.syncAuthoritativeState({
      linearVelocity: poseSnapshot.linearVelocity ?? currentDriveSnapshot.linearVelocity,
      position: blendedPosition,
      yawRadians: blendedYawRadians
    });
    this.#syncWaterborneState();

    return this.snapshot;
  }

  advance(
    controlIntent: MountedVehicleControlIntent,
    locomotionConfig: SurfaceLocomotionConfig,
    deltaSeconds: number,
    worldRadius: number
  ): MountedVehicleRuntimeSnapshot {
    void worldRadius;
    this.#driveBodyRuntime.advance(
      controlIntent,
      locomotionConfig,
      deltaSeconds,
      this.#waterlineHeightMeters,
      null,
      this.#resolveWaterborneTraversalFilterPredicate(
        this.#environmentAssetId,
        Object.freeze([this.#driveBodyRuntime.colliderHandle])
      )
    );
    this.#syncWaterborneState();

    return this.snapshot;
  }

  dispose(): void {
    this.#driveBodyRuntime.dispose();
  }

  #syncWaterborneState(): void {
    const driveSnapshot = this.#driveBodyRuntime.snapshot;

    this.#waterborne = isWaterbornePosition(
      {
        groundedBody: {
          capsuleHalfHeightMeters: 0,
          capsuleRadiusMeters: 0,
          gravityUnitsPerSecond: 0,
          jumpImpulseUnitsPerSecond: 0,
          stepHeightMeters: 0
        },
        ocean: {
          height: this.#oceanHeightMeters
        },
        waterRegionSnapshots: this.#waterRegionSnapshots
      } as never,
      this.#surfaceColliderSnapshots,
      driveSnapshot.position,
      this.#waterContactProbeRadiusMeters,
      this.#environmentAssetId
    );
  }
}
