import type {
  MetaverseWorldMountedOccupancyPolicySnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import type {
  MountableSeatSelectionSnapshot,
  MountedEnvironmentSnapshot
} from "../types/mounted";

interface MetaverseMountedEnvironmentSeatSnapshotSource {
  readonly directEntryEnabled: boolean;
  readonly label: string;
  readonly seatId: string;
  readonly seatRole: MountableSeatSelectionSnapshot["seatRole"];
}

interface CreateMetaverseMountedEnvironmentSnapshotInput {
  readonly environmentAssetId: string;
  readonly label: string;
  readonly occupancyPolicy: MetaverseWorldMountedOccupancyPolicySnapshot;
  readonly seats: readonly MetaverseMountedEnvironmentSeatSnapshotSource[];
}

function createMountableSeatSelectionSnapshot(
  seat: MetaverseMountedEnvironmentSeatSnapshotSource
): MountableSeatSelectionSnapshot {
  return Object.freeze({
    label: seat.label,
    seatId: seat.seatId,
    seatRole: seat.seatRole
  });
}

function createSeatTargetSnapshots(
  seats: readonly MetaverseMountedEnvironmentSeatSnapshotSource[]
): MountedEnvironmentSnapshot["seatTargets"] {
  return Object.freeze(
    seats.map((seat) => createMountableSeatSelectionSnapshot(seat))
  );
}

function createDirectSeatTargetSnapshots(
  seats: readonly MetaverseMountedEnvironmentSeatSnapshotSource[]
): MountedEnvironmentSnapshot["directSeatTargets"] {
  return Object.freeze(
    seats
      .filter((seat) => seat.directEntryEnabled)
      .map((seat) => createMountableSeatSelectionSnapshot(seat))
  );
}

export function createMetaverseMountedEnvironmentSnapshot({
  environmentAssetId,
  label,
  occupancyPolicy,
  seats
}: CreateMetaverseMountedEnvironmentSnapshotInput): MountedEnvironmentSnapshot {
  return Object.freeze({
    ...occupancyPolicy,
    directSeatTargets: createDirectSeatTargetSnapshots(seats),
    environmentAssetId,
    label,
    seatTargets: createSeatTargetSnapshots(seats)
  });
}
