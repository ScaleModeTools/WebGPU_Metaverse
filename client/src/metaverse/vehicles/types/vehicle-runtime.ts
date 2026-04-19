import type { PhysicsVector3Snapshot } from "@/physics";
import type {
  MetaverseWorldMountedOccupancyPolicySnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import type {
  MountedVehicleCameraPolicyId,
  MountedVehicleControlRoutingPolicyId,
  MountedVehicleLookLimitPolicyId,
  MountedVehicleOccupancyAnimationId,
  MountedVehicleSeatRoleId
} from "./vehicle-seat";

export interface MountedVehicleSeatRuntimeSnapshot {
  readonly cameraPolicyId: MountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MountedVehicleControlRoutingPolicyId;
  readonly directEntryEnabled: boolean;
  readonly dismountOffset: PhysicsVector3Snapshot;
  readonly label: string;
  readonly lookLimitPolicyId: MountedVehicleLookLimitPolicyId;
  readonly occupancyAnimationId: MountedVehicleOccupancyAnimationId;
  readonly occupied: boolean;
  readonly seatId: string;
  readonly seatNodeName: string;
  readonly seatRole: MountedVehicleSeatRoleId;
}

export interface MountedVehicleEntryRuntimeSnapshot {
  readonly cameraPolicyId: MountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MountedVehicleControlRoutingPolicyId;
  readonly dismountOffset: PhysicsVector3Snapshot;
  readonly entryId: string;
  readonly entryNodeName: string;
  readonly label: string;
  readonly lookLimitPolicyId: MountedVehicleLookLimitPolicyId;
  readonly occupancyAnimationId: MountedVehicleOccupancyAnimationId;
  readonly occupied: boolean;
  readonly occupantRole: MountedVehicleSeatRoleId;
}

export type MountedVehicleOccupancyKind =
  MetaverseWorldMountedOccupancyPolicySnapshot["occupancyKind"];

export interface MountedVehicleOccupancyRuntimeSnapshot
  extends MetaverseWorldMountedOccupancyPolicySnapshot {
  readonly dismountOffset: PhysicsVector3Snapshot;
}

export interface MountedVehicleRuntimeSnapshot {
  readonly environmentAssetId: string;
  readonly label: string;
  readonly occupancy: MountedVehicleOccupancyRuntimeSnapshot | null;
  readonly planarSpeedUnitsPerSecond: number;
  readonly position: PhysicsVector3Snapshot;
  readonly waterborne: boolean;
  readonly yawRadians: number;
}

export interface MountedVehicleControlIntent {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly yawAxis: number;
}
