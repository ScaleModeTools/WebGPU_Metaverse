interface MountedOccupancyPolicySnapshot {
  readonly occupancyKind: "entry" | "seat";
  readonly occupantRole: string;
}

function isFreeRoamMountedOccupancy(
  occupancy: MountedOccupancyPolicySnapshot | null | undefined
): boolean {
  return (
    occupancy !== null &&
    occupancy !== undefined &&
    occupancy.occupancyKind === "entry" &&
    occupancy.occupantRole !== "driver"
  );
}

export function shouldKeepMountedOccupancyFreeRoam(
  occupancy: MountedOccupancyPolicySnapshot | null | undefined
): boolean {
  return isFreeRoamMountedOccupancy(occupancy);
}

export function shouldConstrainMountedOccupancyToAnchor(
  occupancy: MountedOccupancyPolicySnapshot | null | undefined
): boolean {
  return (
    occupancy !== null &&
    occupancy !== undefined &&
    !isFreeRoamMountedOccupancy(occupancy)
  );
}

export function shouldHolsterHeldAttachmentWhileMounted(
  mountedEnvironment: MountedOccupancyPolicySnapshot | null | undefined
): boolean {
  return shouldConstrainMountedOccupancyToAnchor(mountedEnvironment);
}
