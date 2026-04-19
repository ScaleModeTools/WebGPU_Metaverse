import type { MetaversePresenceMountedOccupantRoleId } from "./metaverse-presence-contract.js";

export const metaverseMountedVehicleControlRoutingPolicyIds = [
  "vehicle-surface-drive",
  "look-only",
  "turret-station"
] as const;

export type MetaverseMountedVehicleControlRoutingPolicyId =
  (typeof metaverseMountedVehicleControlRoutingPolicyIds)[number];

export const metaverseMountedVehicleCameraPolicyIds = [
  "vehicle-follow",
  "seat-follow",
  "turret-follow"
] as const;

export type MetaverseMountedVehicleCameraPolicyId =
  (typeof metaverseMountedVehicleCameraPolicyIds)[number];

export const metaverseMountedVehicleOccupancyAnimationIds = [
  "seated",
  "standing"
] as const;

export type MetaverseMountedVehicleOccupancyAnimationId =
  (typeof metaverseMountedVehicleOccupancyAnimationIds)[number];

export const defaultMetaverseMountedVehicleControlRoutingPolicyId =
  "vehicle-surface-drive" satisfies MetaverseMountedVehicleControlRoutingPolicyId;
export const defaultMetaverseMountedVehicleCameraPolicyId =
  "vehicle-follow" satisfies MetaverseMountedVehicleCameraPolicyId;
export const defaultMetaverseMountedVehicleOccupancyAnimationId =
  "seated" satisfies MetaverseMountedVehicleOccupancyAnimationId;

export function canMetaverseMountedOccupancyRouteSurfaceDrive(input: {
  readonly controlRoutingPolicyId: MetaverseMountedVehicleControlRoutingPolicyId;
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId | null;
}): boolean {
  return (
    input.controlRoutingPolicyId === "vehicle-surface-drive" &&
    input.occupantRole === "driver"
  );
}
