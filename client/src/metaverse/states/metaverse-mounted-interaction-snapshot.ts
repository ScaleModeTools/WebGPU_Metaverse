import type {
  FocusedMountableSnapshot,
  MetaverseMountedInteractionSnapshot,
  MountableBoardingEntrySnapshot,
  MountableSeatSelectionSnapshot,
  MountedEnvironmentSnapshot
} from "../types/mounted";

const emptyBoardingEntries = Object.freeze(
  []
) as readonly MountableBoardingEntrySnapshot[];
const emptySeatTargets = Object.freeze(
  []
) as readonly MountableSeatSelectionSnapshot[];

function resolveSelectableSeatTargets(
  focusedMountable: FocusedMountableSnapshot | null,
  mountedEnvironment: MountedEnvironmentSnapshot | null
): readonly MountableSeatSelectionSnapshot[] {
  if (mountedEnvironment === null) {
    return focusedMountable?.directSeatTargets ?? emptySeatTargets;
  }

  if (mountedEnvironment.seatId === null) {
    return mountedEnvironment.seatTargets;
  }

  return Object.freeze(
    mountedEnvironment.seatTargets.filter(
      (seatTarget) => seatTarget.seatId !== mountedEnvironment.seatId
    )
  );
}

export function createMetaverseMountedInteractionSnapshot(
  focusedMountable: FocusedMountableSnapshot | null,
  mountedEnvironment: MountedEnvironmentSnapshot | null
): MetaverseMountedInteractionSnapshot {
  return Object.freeze({
    boardingEntries:
      mountedEnvironment === null
        ? focusedMountable?.boardingEntries ?? emptyBoardingEntries
        : emptyBoardingEntries,
    focusedMountable,
    mountedEnvironment,
    seatTargetEnvironmentAssetId:
      mountedEnvironment?.environmentAssetId ??
      focusedMountable?.environmentAssetId ??
      null,
    selectableSeatTargets: resolveSelectableSeatTargets(
      focusedMountable,
      mountedEnvironment
    )
  });
}
