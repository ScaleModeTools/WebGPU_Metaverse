import type {
  RapierColliderHandle,
  RapierPhysicsRuntime,
  RapierQueryFilterPredicate
} from "@/physics";

import type {
  MetaverseFlightInputSnapshot
} from "../../types/metaverse-control-mode";
import type {
  MountableSeatSelectionSnapshot,
  MountedEnvironmentSnapshot
} from "../../types/mounted";
import type { MetaverseEnvironmentAssetProofConfig } from "../../types/proof";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import {
  MetaverseVehicleRuntime,
  type MountedVehicleControlIntent
} from "../../vehicles";
import { clamp, freezeVector3, toFiniteNumber } from "../policies/surface-locomotion";
import type {
  DynamicEnvironmentPoseSnapshot,
  RoutedDriverVehicleControlIntentSnapshot,
  TraversalMountedVehicleSnapshot
} from "../types/traversal";
import type { MetaversePlacedCuboidColliderSnapshot } from "../../states/metaverse-environment-collision";

export interface MountedVehicleRuntimeContext {
  readonly mountableEnvironmentConfig: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "collider" | "entries" | "environmentAssetId" | "label" | "seats"
  >;
  readonly mountedVehicleRuntime: MetaverseVehicleRuntime;
}

interface CreateMountedVehicleRuntimeContextInput {
  readonly config: MetaverseRuntimeConfig;
  readonly environmentAssetId: string;
  readonly excludedColliders: readonly RapierColliderHandle[];
  readonly physicsRuntime: RapierPhysicsRuntime;
  readonly readDynamicEnvironmentPose: (
    environmentAssetId: string
  ) => DynamicEnvironmentPoseSnapshot | null;
  readonly readMountableEnvironmentConfig: (
    environmentAssetId: string
  ) => Pick<
    MetaverseEnvironmentAssetProofConfig,
    "collider" | "entries" | "environmentAssetId" | "label" | "seats"
  > | null;
  readonly resolveWaterborneTraversalFilterPredicate: (
    excludedOwnerEnvironmentAssetId?: string | null,
    excludedColliders?: readonly RapierColliderHandle[]
  ) => RapierQueryFilterPredicate;
  readonly surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];
}

function createMountedVehicleIdleControlIntent(): MountedVehicleControlIntent {
  return Object.freeze({
    boost: false,
    moveAxis: 0,
    strafeAxis: 0,
    yawAxis: 0
  });
}

function resolveMountedEnvironmentDirectSeatTargets(
  mountableEnvironmentConfig: Pick<MetaverseEnvironmentAssetProofConfig, "seats">
): MountedEnvironmentSnapshot["directSeatTargets"] {
  return Object.freeze(
    (mountableEnvironmentConfig.seats ?? [])
      .filter((seat) => seat.directEntryEnabled)
      .map((seat) =>
        Object.freeze({
          label: seat.label,
          seatId: seat.seatId,
          seatRole: seat.seatRole
        } satisfies MountableSeatSelectionSnapshot)
      )
  );
}

function resolveMountedEnvironmentSeatTargets(
  mountableEnvironmentConfig: Pick<MetaverseEnvironmentAssetProofConfig, "seats">
): MountedEnvironmentSnapshot["seatTargets"] {
  return Object.freeze(
    (mountableEnvironmentConfig.seats ?? []).map((seat) =>
      Object.freeze({
        label: seat.label,
        seatId: seat.seatId,
        seatRole: seat.seatRole
      } satisfies MountableSeatSelectionSnapshot)
    )
  );
}

export function didMountedVehiclePoseChange(
  previousMountedVehicleState: TraversalMountedVehicleSnapshot,
  nextMountedVehicleState: TraversalMountedVehicleSnapshot
): boolean {
  return (
    Math.abs(
      previousMountedVehicleState.position.x - nextMountedVehicleState.position.x
    ) > 0.000001 ||
    Math.abs(
      previousMountedVehicleState.position.y - nextMountedVehicleState.position.y
    ) > 0.000001 ||
    Math.abs(
      previousMountedVehicleState.position.z - nextMountedVehicleState.position.z
    ) > 0.000001 ||
    Math.abs(
      previousMountedVehicleState.yawRadians - nextMountedVehicleState.yawRadians
    ) > 0.000001
  );
}

export function resolveMountedEnvironmentSnapshot(
  mountableEnvironmentConfig: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "seats"
  >,
  mountedVehicleSnapshot: TraversalMountedVehicleSnapshot
): MountedEnvironmentSnapshot | null {
  const occupancy = mountedVehicleSnapshot.occupancy;

  if (occupancy === null) {
    return null;
  }

  return Object.freeze({
    cameraPolicyId: occupancy.cameraPolicyId,
    controlRoutingPolicyId: occupancy.controlRoutingPolicyId,
    directSeatTargets: resolveMountedEnvironmentDirectSeatTargets(
      mountableEnvironmentConfig
    ),
    entryId: occupancy.entryId,
    environmentAssetId: mountedVehicleSnapshot.environmentAssetId,
    label: mountedVehicleSnapshot.label,
    lookLimitPolicyId: occupancy.lookLimitPolicyId,
    occupancyAnimationId: occupancy.occupancyAnimationId,
    occupancyKind: occupancy.occupancyKind,
    occupantLabel: occupancy.occupantLabel,
    occupantRole: occupancy.occupantRole,
    seatId: occupancy.seatId,
    seatTargets: resolveMountedEnvironmentSeatTargets(
      mountableEnvironmentConfig
    )
  });
}

export function createMountedVehicleRuntimeContext({
  config,
  environmentAssetId,
  excludedColliders,
  physicsRuntime,
  readDynamicEnvironmentPose,
  readMountableEnvironmentConfig,
  resolveWaterborneTraversalFilterPredicate,
  surfaceColliderSnapshots
}: CreateMountedVehicleRuntimeContextInput): MountedVehicleRuntimeContext | null {
  const mountableEnvironmentConfig =
    readMountableEnvironmentConfig(environmentAssetId);
  const dynamicEnvironmentPose = readDynamicEnvironmentPose(environmentAssetId);

  if (
    dynamicEnvironmentPose === null ||
    mountableEnvironmentConfig === null ||
    mountableEnvironmentConfig.seats === null
  ) {
    return null;
  }

  return {
    mountableEnvironmentConfig,
    mountedVehicleRuntime: new MetaverseVehicleRuntime({
      authoritativeCorrection: config.skiff.authoritativeCorrection,
      driveCollider:
        mountableEnvironmentConfig.collider === null
          ? null
          : Object.freeze({
              center: freezeVector3(
                mountableEnvironmentConfig.collider.center.x,
                mountableEnvironmentConfig.collider.center.y,
                mountableEnvironmentConfig.collider.center.z
              ),
              size: freezeVector3(
                mountableEnvironmentConfig.collider.size.x,
                mountableEnvironmentConfig.collider.size.y,
                mountableEnvironmentConfig.collider.size.z
              )
            }),
      entries: mountableEnvironmentConfig.entries,
      environmentAssetId: mountableEnvironmentConfig.environmentAssetId,
      label: mountableEnvironmentConfig.label,
      oceanHeightMeters: config.ocean.height,
      physicsRuntime,
      poseSnapshot: dynamicEnvironmentPose,
      resolveWaterborneTraversalFilterPredicate: (
        excludedOwnerEnvironmentAssetId,
        additionalExcludedColliders = []
      ) =>
        resolveWaterborneTraversalFilterPredicate(
          excludedOwnerEnvironmentAssetId,
          Object.freeze([
            ...excludedColliders,
            ...additionalExcludedColliders
          ])
        ),
      seats: mountableEnvironmentConfig.seats,
      surfaceColliderSnapshots,
      waterContactProbeRadiusMeters:
        config.skiff.waterContactProbeRadiusMeters,
      waterlineHeightMeters: config.skiff.waterlineHeightMeters,
      worldRadius: config.movement.worldRadius
    })
  };
}

export function resolveMountedVehicleControlIntent(
  mountedVehicleState: TraversalMountedVehicleSnapshot,
  movementInput: MetaverseFlightInputSnapshot
): MountedVehicleControlIntent {
  const occupancy = mountedVehicleState.occupancy;

  if (
    occupancy === null ||
    occupancy.controlRoutingPolicyId !== "vehicle-surface-drive" ||
    occupancy.occupantRole !== "driver" ||
    !mountedVehicleState.waterborne
  ) {
    return createMountedVehicleIdleControlIntent();
  }

  return Object.freeze({
    boost: movementInput.boost,
    moveAxis: movementInput.moveAxis,
    strafeAxis: 0,
    yawAxis: clamp(
      toFiniteNumber(movementInput.yawAxis, 0) +
        toFiniteNumber(movementInput.strafeAxis, 0),
      -1,
      1
    )
  });
}

export function resolveRoutedDriverVehicleControlIntentSnapshot(
  mountedVehicleState: TraversalMountedVehicleSnapshot,
  controlIntent: MountedVehicleControlIntent
): RoutedDriverVehicleControlIntentSnapshot | null {
  const occupancy = mountedVehicleState.occupancy;

  if (
    occupancy === null ||
    occupancy.controlRoutingPolicyId !== "vehicle-surface-drive" ||
    occupancy.occupantRole !== "driver"
  ) {
    return null;
  }

  return Object.freeze({
    controlIntent,
    environmentAssetId: mountedVehicleState.environmentAssetId
  });
}
