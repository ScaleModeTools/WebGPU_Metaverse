import type {
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import { createRadians } from "@webgpu-metaverse/shared";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  createMetaverseMountedOccupancyIdentityKey
} from "@webgpu-metaverse/shared/metaverse/presence";

export type AckedAuthoritativeLocalPlayerPose = Pick<
  MetaverseRealtimePlayerSnapshot,
  | "groundedBody"
  | "lastProcessedInputSequence"
  | "linearVelocity"
  | "locomotionMode"
  | "mountedOccupancy"
  | "position"
  | "swimBody"
  | "traversalAuthority"
  | "yawRadians"
>;

type AckedAuthoritativeLocalPlayerSnapshot = Pick<
  MetaverseRealtimePlayerSnapshot,
  | "groundedBody"
  | "lastProcessedInputSequence"
  | "linearVelocity"
  | "locomotionMode"
  | "mountedOccupancy"
  | "position"
  | "swimBody"
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
  const activeBodySnapshot =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(playerSnapshot);

  return [
    latestWorldSnapshot.snapshotSequence,
    latestWorldSnapshot.tick.currentTick,
    playerSnapshot.lastProcessedInputSequence,
    playerSnapshot.locomotionMode,
    createMountedOccupancyDeliveryKey(playerSnapshot.mountedOccupancy),
    activeBodySnapshot.position.x,
    activeBodySnapshot.position.y,
    activeBodySnapshot.position.z,
    activeBodySnapshot.yawRadians,
    activeBodySnapshot.linearVelocity.x,
    activeBodySnapshot.linearVelocity.y,
    activeBodySnapshot.linearVelocity.z,
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
  const activeBodySnapshot =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(playerSnapshot);

  return {
    groundedBody: playerSnapshot.groundedBody,
    lastProcessedInputSequence: playerSnapshot.lastProcessedInputSequence,
    linearVelocity: activeBodySnapshot.linearVelocity,
    locomotionMode: playerSnapshot.locomotionMode,
    mountedOccupancy: playerSnapshot.mountedOccupancy,
    position: activeBodySnapshot.position,
    swimBody: playerSnapshot.swimBody,
    traversalAuthority: playerSnapshot.traversalAuthority,
    yawRadians: createRadians(activeBodySnapshot.yawRadians)
  };
}
