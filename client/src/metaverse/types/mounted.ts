import type { ExperienceId } from "@webgpu-metaverse/shared";
import type {
  MetaverseWorldMountedOccupancyPolicySnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import type {
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

export type MountedEnvironmentOccupancyKind =
  MetaverseWorldMountedOccupancyPolicySnapshot["occupancyKind"];

export interface MountedEnvironmentSnapshot
  extends MetaverseWorldMountedOccupancyPolicySnapshot {
  readonly directSeatTargets: readonly MountableSeatSelectionSnapshot[];
  readonly environmentAssetId: string;
  readonly label: string;
  readonly seatTargets: readonly MountableSeatSelectionSnapshot[];
}

export interface MetaverseMountedInteractionSnapshot {
  readonly boardingEntries: readonly MountableBoardingEntrySnapshot[];
  readonly focusedMountable: FocusedMountableSnapshot | null;
  readonly mountedEnvironment: MountedEnvironmentSnapshot | null;
  readonly seatTargetEnvironmentAssetId: string | null;
  readonly selectableSeatTargets: readonly MountableSeatSelectionSnapshot[];
}
