import type { PhysicsVector3Snapshot } from "@/physics";

import type { MetaversePlacedCuboidColliderSnapshot } from "../../states/metaverse-environment-collision";
import type {
  MetaverseEnvironmentEntryProofConfig,
  MetaverseEnvironmentSeatProofConfig
} from "../../types/metaverse-runtime";
import type { SurfaceLocomotionConfig } from "../../traversal/types/traversal";
import {
  advanceSurfaceLocomotionSnapshot,
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
  readonly environmentAssetId: string;
  readonly label: string;
  readonly oceanHeightMeters: number;
  readonly poseSnapshot: {
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  };
  readonly entries: readonly MetaverseEnvironmentEntryProofConfig[] | null;
  readonly seats: readonly MetaverseEnvironmentSeatProofConfig[];
  readonly surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];
  readonly waterContactProbeRadiusMeters: number;
  readonly waterlineHeightMeters: number;
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
    return Object.freeze({
      cameraPolicyId: this.#cameraPolicyId,
      controlRoutingPolicyId: this.#controlRoutingPolicyId,
      dismountOffset: this.#dismountOffset,
      entryId: null,
      lookLimitPolicyId: this.#lookLimitPolicyId,
      occupancyAnimationId: this.#occupancyAnimationId,
      occupancyKind: "seat",
      occupantLabel: this.#label,
      occupantRole: this.#seatRole,
      seatId: this.#seatId
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
    return Object.freeze({
      cameraPolicyId: this.#cameraPolicyId,
      controlRoutingPolicyId: this.#controlRoutingPolicyId,
      dismountOffset: this.#dismountOffset,
      entryId: this.#entryId,
      lookLimitPolicyId: this.#lookLimitPolicyId,
      occupancyAnimationId: this.#occupancyAnimationId,
      occupancyKind: "entry",
      occupantLabel: this.#label,
      occupantRole: this.#occupantRole,
      seatId: null
    });
  }
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function resolveAuthoritativePlanarVelocitySnapshot(
  linearVelocity: PhysicsVector3Snapshot,
  yawRadians: number
): {
  readonly forwardSpeedUnitsPerSecond: number;
  readonly planarSpeedUnitsPerSecond: number;
  readonly strafeSpeedUnitsPerSecond: number;
} {
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);
  const forwardSpeedUnitsPerSecond =
    linearVelocity.x * forwardX + linearVelocity.z * forwardZ;
  const strafeSpeedUnitsPerSecond =
    linearVelocity.x * rightX + linearVelocity.z * rightZ;

  return Object.freeze({
    forwardSpeedUnitsPerSecond,
    planarSpeedUnitsPerSecond: Math.hypot(linearVelocity.x, linearVelocity.z),
    strafeSpeedUnitsPerSecond
  });
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
  readonly #environmentAssetId: string;
  readonly #entryRuntimes: readonly MetaverseVehicleEntryRuntime[];
  readonly #label: string;
  readonly #oceanHeightMeters: number;
  readonly #seatRuntimes: readonly MetaverseVehicleSeatRuntime[];
  readonly #surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];
  readonly #waterContactProbeRadiusMeters: number;

  #forwardSpeedUnitsPerSecond = 0;
  #occupancyRuntime: MetaverseVehicleOccupancyRuntime | null = null;
  #planarSpeedUnitsPerSecond = 0;
  #position: PhysicsVector3Snapshot;
  #strafeSpeedUnitsPerSecond = 0;
  #waterborne: boolean;
  #yawRadians: number;

  constructor({
    authoritativeCorrection,
    environmentAssetId,
    entries,
    label,
    oceanHeightMeters,
    poseSnapshot,
    seats,
    surfaceColliderSnapshots,
    waterContactProbeRadiusMeters,
    waterlineHeightMeters
  }: MetaverseVehicleRuntimeInit) {
    this.#authoritativeCorrection = authoritativeCorrection;
    this.#environmentAssetId = environmentAssetId;
    this.#label = label;
    this.#oceanHeightMeters = oceanHeightMeters;
    this.#entryRuntimes = Object.freeze(
      (entries ?? []).map((entry) => new MetaverseVehicleEntryRuntime(entry))
    );
    this.#seatRuntimes = Object.freeze(
      seats.map((seat) => new MetaverseVehicleSeatRuntime(seat))
    );
    this.#surfaceColliderSnapshots = surfaceColliderSnapshots;
    this.#waterContactProbeRadiusMeters = waterContactProbeRadiusMeters;
    this.#position = freezeVector3(
      poseSnapshot.position.x,
      toFiniteNumber(poseSnapshot.position.y, waterlineHeightMeters),
      poseSnapshot.position.z
    );
    this.#yawRadians = wrapRadians(poseSnapshot.yawRadians);
    this.#waterborne = false;
    this.#syncWaterborneState();
  }

  get snapshot(): MountedVehicleRuntimeSnapshot {
    return Object.freeze({
      environmentAssetId: this.#environmentAssetId,
      label: this.#label,
      occupancy:
        this.#occupancyRuntime === null
          ? null
          : this.#occupancyRuntime.occupancySnapshot(),
      planarSpeedUnitsPerSecond: this.#planarSpeedUnitsPerSecond,
      position: this.#position,
      waterborne: this.#waterborne,
      yawRadians: this.#yawRadians
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
    const authoritativePosition = freezeVector3(
      poseSnapshot.position.x,
      poseSnapshot.position.y,
      poseSnapshot.position.z
    );
    const authoritativeYawRadians = wrapRadians(poseSnapshot.yawRadians);
    const positionErrorMeters = Math.hypot(
      authoritativePosition.x - this.#position.x,
      authoritativePosition.y - this.#position.y,
      authoritativePosition.z - this.#position.z
    );
    const yawErrorRadians = Math.abs(
      wrapRadians(authoritativeYawRadians - this.#yawRadians)
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

    this.#position = freezeVector3(
      lerp(this.#position.x, authoritativePosition.x, positionBlendAlpha),
      lerp(this.#position.y, authoritativePosition.y, positionBlendAlpha),
      lerp(this.#position.z, authoritativePosition.z, positionBlendAlpha)
    );
    this.#yawRadians = wrapRadians(
      this.#yawRadians +
        wrapRadians(authoritativeYawRadians - this.#yawRadians) * yawBlendAlpha
    );
    this.#syncWaterborneState();

    if (poseSnapshot.linearVelocity !== undefined && poseSnapshot.linearVelocity !== null) {
      const authoritativePlanarVelocitySnapshot =
        resolveAuthoritativePlanarVelocitySnapshot(
          poseSnapshot.linearVelocity,
          authoritativeYawRadians
        );

      this.#planarSpeedUnitsPerSecond =
        authoritativePlanarVelocitySnapshot.planarSpeedUnitsPerSecond;
      this.#forwardSpeedUnitsPerSecond = this.#waterborne
        ? authoritativePlanarVelocitySnapshot.forwardSpeedUnitsPerSecond
        : 0;
      this.#strafeSpeedUnitsPerSecond = this.#waterborne
        ? authoritativePlanarVelocitySnapshot.strafeSpeedUnitsPerSecond
        : 0;
    }

    return this.snapshot;
  }

  advance(
    controlIntent: MountedVehicleControlIntent,
    locomotionConfig: SurfaceLocomotionConfig,
    deltaSeconds: number,
    worldRadius: number
  ): MountedVehicleRuntimeSnapshot {
    const nextMountedVehicleState = advanceSurfaceLocomotionSnapshot(
      {
        planarSpeedUnitsPerSecond: this.#planarSpeedUnitsPerSecond,
        position: this.#position,
        yawRadians: this.#yawRadians
      },
      {
        forwardSpeedUnitsPerSecond: this.#forwardSpeedUnitsPerSecond,
        strafeSpeedUnitsPerSecond: this.#strafeSpeedUnitsPerSecond
      },
      controlIntent,
      locomotionConfig,
      deltaSeconds,
      worldRadius,
      this.#position.y
    );

    this.#position = nextMountedVehicleState.snapshot.position;
    this.#yawRadians = nextMountedVehicleState.snapshot.yawRadians;
    this.#planarSpeedUnitsPerSecond =
      nextMountedVehicleState.snapshot.planarSpeedUnitsPerSecond;
    this.#syncWaterborneState();
    this.#forwardSpeedUnitsPerSecond = this.#waterborne
      ? nextMountedVehicleState.speedSnapshot.forwardSpeedUnitsPerSecond
      : 0;
    this.#strafeSpeedUnitsPerSecond = this.#waterborne
      ? nextMountedVehicleState.speedSnapshot.strafeSpeedUnitsPerSecond
      : 0;

    return this.snapshot;
  }

  #syncWaterborneState(): void {
    this.#waterborne = isWaterbornePosition(
      {
        ocean: {
          height: this.#oceanHeightMeters
        }
      } as never,
      this.#surfaceColliderSnapshots,
      this.#position,
      this.#waterContactProbeRadiusMeters,
      this.#environmentAssetId
    );
  }
}
