import type { MetaversePresenceMountedOccupantRoleId } from "./metaverse-presence-contract.js";
import {
  clamp,
  toFiniteNumber
} from "./metaverse-surface-traversal-simulation.js";

export interface MetaverseMountedVehicleSurfaceDriveControlIntentSnapshot {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly yawAxis: number;
}

export interface ResolveMetaverseMountedVehicleSurfaceDriveControlIntentInput {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId | null;
  readonly strafeAxis: number;
  readonly waterborne: boolean;
  readonly yawAxis: number;
}

export function createMetaverseMountedVehicleSurfaceDriveControlIntentSnapshot(
  input: Partial<MetaverseMountedVehicleSurfaceDriveControlIntentSnapshot> = {}
): MetaverseMountedVehicleSurfaceDriveControlIntentSnapshot {
  return Object.freeze({
    boost: input.boost === true,
    moveAxis: clamp(toFiniteNumber(input.moveAxis ?? 0, 0), -1, 1),
    strafeAxis: clamp(toFiniteNumber(input.strafeAxis ?? 0, 0), -1, 1),
    yawAxis: clamp(toFiniteNumber(input.yawAxis ?? 0, 0), -1, 1)
  });
}

export function isMetaverseMountedVehicleSurfaceDriveEnabled(input: {
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId | null;
  readonly waterborne: boolean;
}): boolean {
  return input.occupantRole === "driver" && input.waterborne === true;
}

export function resolveMetaverseMountedVehicleSurfaceDriveControlIntent({
  boost,
  moveAxis,
  occupantRole,
  strafeAxis,
  waterborne,
  yawAxis
}: ResolveMetaverseMountedVehicleSurfaceDriveControlIntentInput): MetaverseMountedVehicleSurfaceDriveControlIntentSnapshot {
  if (
    !isMetaverseMountedVehicleSurfaceDriveEnabled({
      occupantRole,
      waterborne
    })
  ) {
    return createMetaverseMountedVehicleSurfaceDriveControlIntentSnapshot();
  }

  return createMetaverseMountedVehicleSurfaceDriveControlIntentSnapshot({
    boost,
    moveAxis,
    strafeAxis: 0,
    yawAxis:
      clamp(toFiniteNumber(yawAxis, 0) + toFiniteNumber(strafeAxis, 0), -1, 1)
  });
}
