import type {
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  createMetaverseMountedOccupancyIdentityKey
} from "@webgpu-metaverse/shared/metaverse/presence";

export type AckedAuthoritativeLocalPlayerPose = Pick<
  MetaverseRealtimePlayerSnapshot,
  | "lastProcessedInputSequence"
  | "linearVelocity"
  | "locomotionMode"
  | "mountedOccupancy"
  | "position"
  | "traversalAuthority"
  | "yawRadians"
>;

type AckedAuthoritativeLocalPlayerSnapshot = Pick<
  MetaverseRealtimePlayerSnapshot,
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
  return createMetaverseMountedOccupancyIdentityKey(mountedOccupancy) ?? "unmounted";
}

export function createAckedAuthoritativeLocalPlayerDeliveryKey(
  freshAckedLocalPlayerSnapshot: FreshAckedAuthoritativeLocalPlayerSnapshot
): string {
  const { latestWorldSnapshot, playerSnapshot } = freshAckedLocalPlayerSnapshot;

  return [
    latestWorldSnapshot.snapshotSequence,
    latestWorldSnapshot.tick.currentTick,
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
    lastProcessedInputSequence: playerSnapshot.lastProcessedInputSequence,
    linearVelocity: playerSnapshot.linearVelocity,
    locomotionMode: playerSnapshot.locomotionMode,
    mountedOccupancy: playerSnapshot.mountedOccupancy,
    position: playerSnapshot.position,
    traversalAuthority: playerSnapshot.traversalAuthority,
    yawRadians: playerSnapshot.yawRadians
  };
}
