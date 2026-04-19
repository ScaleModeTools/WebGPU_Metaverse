import type {
  MetaverseMountedInteractionHudSnapshot
} from "../types/hud";
import type {
  MetaverseMountedInteractionSnapshot
} from "../types/mounted";

const emptyMountedInteractionHudSnapshot =
  Object.freeze({
    boardingEntries: Object.freeze([]),
    detail: null,
    heading: null,
    leaveActionLabel: null,
    seatTargetButtonVariant: "outline",
    seatTargets: Object.freeze([]),
    visible: false
  } satisfies MetaverseMountedInteractionHudSnapshot);

export function createMetaverseMountedInteractionHudSnapshot(
  mountedInteraction: MetaverseMountedInteractionSnapshot
): MetaverseMountedInteractionHudSnapshot {
  const focusedMountable = mountedInteraction.focusedMountable;
  const mountedEnvironment = mountedInteraction.mountedEnvironment;

  if (focusedMountable === null && mountedEnvironment === null) {
    return emptyMountedInteractionHudSnapshot;
  }

  return Object.freeze({
    boardingEntries: mountedInteraction.boardingEntries,
    detail:
      mountedEnvironment !== null
        ? mountedEnvironment.occupancyKind === "entry"
          ? "Boarding is separate from seat ownership here. Direct seats stay claimable until you intentionally take one."
          : mountedEnvironment.occupantRole === "driver"
            ? "Hub movement controls now drive this vehicle. Propulsion cuts out when the hull is beached on hard ground."
            : "This seat keeps vehicle steering locked to the active driver."
        : mountedInteraction.boardingEntries.length > 0 &&
            mountedInteraction.selectableSeatTargets.length > 0
          ? "Board the deck first or take a direct seat now."
          : `${focusedMountable?.distanceFromCamera.toFixed(1)}m inside mount collider`,
    heading:
      mountedEnvironment !== null
        ? mountedEnvironment.occupancyKind === "seat"
          ? `${mountedEnvironment.label}: ${mountedEnvironment.occupantLabel}.`
          : `${mountedEnvironment.label} boarded via ${mountedEnvironment.occupantLabel.toLowerCase()}.`
        : `${focusedMountable?.label} is in range.`,
    leaveActionLabel:
      mountedEnvironment === null ? null : `Leave ${mountedEnvironment.label}`,
    seatTargetButtonVariant: mountedEnvironment === null ? "outline" : "default",
    seatTargets: mountedInteraction.selectableSeatTargets,
    visible: true
  });
}
