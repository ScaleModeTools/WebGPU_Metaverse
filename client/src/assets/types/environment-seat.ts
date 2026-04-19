import {
  defaultMetaverseMountedVehicleCameraPolicyId,
  defaultMetaverseMountedVehicleControlRoutingPolicyId,
  defaultMetaverseMountedVehicleOccupancyAnimationId,
  defaultMetaverseMountedLookLimitPolicyId,
  metaverseMountedVehicleCameraPolicyIds,
  metaverseMountedVehicleControlRoutingPolicyIds,
  metaverseMountedVehicleOccupancyAnimationIds,
  metaverseMountedLookLimitPolicyIds,
  metaversePresenceMountedOccupantRoleIds
} from "@webgpu-metaverse/shared";
import type {
  MetaverseMountedLookLimitPolicyId,
  MetaverseMountedVehicleCameraPolicyId,
  MetaverseMountedVehicleControlRoutingPolicyId,
  MetaverseMountedVehicleOccupancyAnimationId,
  MetaversePresenceMountedOccupantRoleId
} from "@webgpu-metaverse/shared";

export const mountedVehicleSeatRoleIds =
  metaversePresenceMountedOccupantRoleIds;

export type MountedVehicleSeatRoleId = MetaversePresenceMountedOccupantRoleId;

export const mountedVehicleControlRoutingPolicyIds =
  metaverseMountedVehicleControlRoutingPolicyIds;

export type MountedVehicleControlRoutingPolicyId =
  MetaverseMountedVehicleControlRoutingPolicyId;

export const mountedVehicleCameraPolicyIds =
  metaverseMountedVehicleCameraPolicyIds;

export type MountedVehicleCameraPolicyId =
  MetaverseMountedVehicleCameraPolicyId;

export const mountedVehicleLookLimitPolicyIds =
  metaverseMountedLookLimitPolicyIds;

export type MountedVehicleLookLimitPolicyId = MetaverseMountedLookLimitPolicyId;

export const mountedVehicleOccupancyAnimationIds =
  metaverseMountedVehicleOccupancyAnimationIds;

export type MountedVehicleOccupancyAnimationId =
  MetaverseMountedVehicleOccupancyAnimationId;

export const defaultMountedVehicleSeatId = "driver-seat";
export const defaultMountedVehicleSeatRole =
  "driver" satisfies MountedVehicleSeatRoleId;
export const defaultMountedVehicleControlRoutingPolicyId =
  defaultMetaverseMountedVehicleControlRoutingPolicyId;
export const defaultMountedVehicleCameraPolicyId =
  defaultMetaverseMountedVehicleCameraPolicyId;
export const defaultMountedVehicleLookLimitPolicyId =
  defaultMetaverseMountedLookLimitPolicyId;
export const defaultMountedVehicleOccupancyAnimationId =
  defaultMetaverseMountedVehicleOccupancyAnimationId;
