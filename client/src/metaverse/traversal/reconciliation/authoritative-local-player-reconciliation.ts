import type {
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared";

export type AckedAuthoritativeLocalPlayerPose = Pick<
  MetaverseRealtimePlayerSnapshot,
  | "jumpAuthorityState"
  | "linearVelocity"
  | "locomotionMode"
  | "mountedOccupancy"
  | "position"
  | "traversalAuthority"
  | "yawRadians"
>;

type AckedAuthoritativeLocalPlayerSnapshot = Pick<
  MetaverseRealtimePlayerSnapshot,
  | "jumpAuthorityState"
  | "lastProcessedInputSequence"
  | "linearVelocity"
  | "locomotionMode"
  | "mountedOccupancy"
  | "position"
  | "traversalAuthority"
  | "yawRadians"
>;

export interface FreshAckedAuthoritativeLocalPlayerSnapshot {
  readonly latestWorldSnapshot: Pick<
    MetaverseRealtimeWorldSnapshot,
    "snapshotSequence" | "tick"
  >;
  readonly playerSnapshot: AckedAuthoritativeLocalPlayerSnapshot;
}

function createMountedOccupancyDeliveryKey(
  mountedOccupancy: MetaverseRealtimePlayerSnapshot["mountedOccupancy"]
): string {
  if (mountedOccupancy === null) {
    return "unmounted";
  }

  return [
    mountedOccupancy.environmentAssetId,
    mountedOccupancy.occupancyKind,
    mountedOccupancy.entryId ?? "",
    mountedOccupancy.seatId ?? ""
  ].join(":");
}

export function createAckedAuthoritativeLocalPlayerDeliveryKey(
  freshAckedLocalPlayerSnapshot: FreshAckedAuthoritativeLocalPlayerSnapshot
): string {
  const { latestWorldSnapshot, playerSnapshot } = freshAckedLocalPlayerSnapshot;

  return [
    latestWorldSnapshot.snapshotSequence,
    latestWorldSnapshot.tick.currentTick,
    playerSnapshot.jumpAuthorityState,
    playerSnapshot.lastProcessedInputSequence,
    playerSnapshot.locomotionMode,
    createMountedOccupancyDeliveryKey(playerSnapshot.mountedOccupancy),
    playerSnapshot.position.x,
    playerSnapshot.position.y,
    playerSnapshot.position.z,
    playerSnapshot.yawRadians,
    playerSnapshot.linearVelocity.x,
    playerSnapshot.linearVelocity.y,
    playerSnapshot.linearVelocity.z,
    playerSnapshot.traversalAuthority.currentActionKind,
    playerSnapshot.traversalAuthority.currentActionPhase,
    playerSnapshot.traversalAuthority.currentActionSequence,
    playerSnapshot.traversalAuthority.lastConsumedActionKind,
    playerSnapshot.traversalAuthority.lastConsumedActionSequence,
    playerSnapshot.traversalAuthority.lastRejectedActionKind,
    playerSnapshot.traversalAuthority.lastRejectedActionReason,
    playerSnapshot.traversalAuthority.lastRejectedActionSequence
  ].join("|");
}

export function readAckedAuthoritativeLocalPlayerPose(
  playerSnapshot: AckedAuthoritativeLocalPlayerSnapshot
): AckedAuthoritativeLocalPlayerPose {
  return {
    jumpAuthorityState: playerSnapshot.jumpAuthorityState,
    linearVelocity: playerSnapshot.linearVelocity,
    locomotionMode: playerSnapshot.locomotionMode,
    mountedOccupancy: playerSnapshot.mountedOccupancy,
    position: playerSnapshot.position,
    traversalAuthority: playerSnapshot.traversalAuthority,
    yawRadians: playerSnapshot.yawRadians
  };
}
