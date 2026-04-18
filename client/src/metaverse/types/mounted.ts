import type { ExperienceId } from "@webgpu-metaverse/shared";

import type {
  MountedVehicleCameraPolicyId,
  MountedVehicleControlRoutingPolicyId,
  MountedVehicleLookLimitPolicyId,
  MountedVehicleOccupancyAnimationId,
  MountedVehicleSeatRoleId
} from "../vehicles";

export interface FocusedExperiencePortalSnapshot {
  readonly distanceFromCamera: number;
  readonly experienceId: ExperienceId;
  readonly label: string;
}

export interface MountableBoardingEntrySnapshot {
  readonly entryId: string;
  readonly label: string;
}

export interface MountableSeatSelectionSnapshot {
  readonly label: string;
  readonly seatId: string;
  readonly seatRole: MountedVehicleSeatRoleId;
}

export interface FocusedMountableSnapshot {
  readonly boardingEntries: readonly MountableBoardingEntrySnapshot[];
  readonly directSeatTargets: readonly MountableSeatSelectionSnapshot[];
  readonly distanceFromCamera: number;
  readonly environmentAssetId: string;
  readonly label: string;
}

export type MountedEnvironmentOccupancyKind = "entry" | "seat";

export interface MountedEnvironmentSnapshot {
  readonly cameraPolicyId: MountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MountedVehicleControlRoutingPolicyId;
  readonly directSeatTargets: readonly MountableSeatSelectionSnapshot[];
  readonly entryId: string | null;
  readonly environmentAssetId: string;
  readonly label: string;
  readonly lookLimitPolicyId: MountedVehicleLookLimitPolicyId;
  readonly occupancyAnimationId: MountedVehicleOccupancyAnimationId;
  readonly occupancyKind: MountedEnvironmentOccupancyKind;
  readonly occupantLabel: string;
  readonly occupantRole: MountedVehicleSeatRoleId;
  readonly seatId: string | null;
  readonly seatTargets: readonly MountableSeatSelectionSnapshot[];
}
