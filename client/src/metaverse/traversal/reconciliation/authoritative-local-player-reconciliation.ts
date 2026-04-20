import type {
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import { createRadians } from "@webgpu-metaverse/shared";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

export type AckedAuthoritativeLocalPlayerPose = Pick<
  MetaverseRealtimePlayerSnapshot,
  | "groundedBody"
  | "lastProcessedInputSequence"
  | "lastProcessedTraversalOrientationSequence"
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
  | "lastProcessedTraversalOrientationSequence"
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
  readonly playerSnapshot: Pick<
    MetaverseRealtimePlayerSnapshot,
    "lastProcessedInputSequence" | "lastProcessedTraversalOrientationSequence"
  >;
}

export interface ConsumedAckedAuthoritativeLocalPlayerSample {
  readonly authoritativeSnapshotAgeMs: number;
  readonly authoritativeTick: number;
  readonly lastProcessedInputSequence: number;
  readonly lastProcessedTraversalOrientationSequence: number;
  readonly pose: AckedAuthoritativeLocalPlayerPose;
  readonly receivedAtWallClockMs: number;
  readonly snapshotSequence: number;
}

export function createAckedAuthoritativeLocalPlayerDeliveryKey(
  freshAckedLocalPlayerSnapshot: FreshAckedAuthoritativeLocalPlayerSnapshot
): string {
  const { latestWorldSnapshot, playerSnapshot } = freshAckedLocalPlayerSnapshot;

  return [
    latestWorldSnapshot.snapshotSequence,
    latestWorldSnapshot.tick.currentTick,
    playerSnapshot.lastProcessedInputSequence,
    playerSnapshot.lastProcessedTraversalOrientationSequence
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
    lastProcessedTraversalOrientationSequence:
      playerSnapshot.lastProcessedTraversalOrientationSequence,
    linearVelocity: activeBodySnapshot.linearVelocity,
    locomotionMode: playerSnapshot.locomotionMode,
    mountedOccupancy: playerSnapshot.mountedOccupancy,
    position: activeBodySnapshot.position,
    swimBody: playerSnapshot.swimBody,
    traversalAuthority: playerSnapshot.traversalAuthority,
    yawRadians: createRadians(activeBodySnapshot.yawRadians)
  };
}
