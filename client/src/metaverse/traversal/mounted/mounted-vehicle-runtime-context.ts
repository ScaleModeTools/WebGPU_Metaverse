import type {
  RapierColliderHandle,
  RapierPhysicsRuntime,
  RapierQueryFilterPredicate
} from "@/physics";

import type {
  MetaverseFlightInputSnapshot
} from "../../types/metaverse-control-mode";
import type {
  MountedEnvironmentSnapshot
} from "../../types/mounted";
import type { MetaverseEnvironmentAssetProofConfig } from "../../types/proof";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import {
  canMetaverseMountedOccupancyRouteSurfaceDrive,
  resolveMetaverseMountedVehicleSurfaceDriveControlIntent
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  createMetaverseMountedEnvironmentSnapshot
} from "../../states/metaverse-mounted-environment-snapshot";
import {
  MetaverseVehicleRuntime,
  type MountedVehicleControlIntent
} from "../../vehicles";
import { freezeVector3 } from "../policies/surface-locomotion";
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
  readonly readDynamicEnvironmentCollisionPose: (
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

  return createMetaverseMountedEnvironmentSnapshot({
    environmentAssetId: mountedVehicleSnapshot.environmentAssetId,
    label: mountedVehicleSnapshot.label,
    occupancyPolicy: occupancy,
    seats: mountableEnvironmentConfig.seats ?? []
  });
}

export function createMountedVehicleRuntimeContext({
  config,
  environmentAssetId,
  excludedColliders,
  physicsRuntime,
  readDynamicEnvironmentCollisionPose,
  readMountableEnvironmentConfig,
  resolveWaterborneTraversalFilterPredicate,
  surfaceColliderSnapshots
}: CreateMountedVehicleRuntimeContextInput): MountedVehicleRuntimeContext | null {
  const mountableEnvironmentConfig =
    readMountableEnvironmentConfig(environmentAssetId);
  const dynamicEnvironmentPose =
    readDynamicEnvironmentCollisionPose(environmentAssetId);

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
      waterRegionSnapshots: config.waterRegionSnapshots,
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
    !canMetaverseMountedOccupancyRouteSurfaceDrive({
      controlRoutingPolicyId: occupancy.controlRoutingPolicyId,
      occupantRole: occupancy.occupantRole
    })
  ) {
    return resolveMetaverseMountedVehicleSurfaceDriveControlIntent({
      boost: false,
      moveAxis: 0,
      occupantRole: null,
      strafeAxis: 0,
      waterborne: false,
      yawAxis: 0
    });
  }

  return resolveMetaverseMountedVehicleSurfaceDriveControlIntent({
    boost: movementInput.boost,
    moveAxis: movementInput.moveAxis,
    occupantRole: occupancy.occupantRole,
    strafeAxis: movementInput.strafeAxis,
    waterborne: mountedVehicleState.waterborne,
    yawAxis: movementInput.yawAxis
  });
}

export function resolveRoutedDriverVehicleControlIntentSnapshot(
  mountedVehicleState: TraversalMountedVehicleSnapshot,
  controlIntent: MountedVehicleControlIntent
): RoutedDriverVehicleControlIntentSnapshot | null {
  const occupancy = mountedVehicleState.occupancy;

  if (
    occupancy === null ||
    !canMetaverseMountedOccupancyRouteSurfaceDrive({
      controlRoutingPolicyId: occupancy.controlRoutingPolicyId,
      occupantRole: occupancy.occupantRole
    })
  ) {
    return null;
  }

  return Object.freeze({
    controlIntent,
    environmentAssetId: mountedVehicleState.environmentAssetId
  });
}
