import type {
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaverseRealtimePlayerSnapshot } from "@webgpu-metaverse/shared/metaverse/realtime";
import { createRadians } from "@webgpu-metaverse/shared";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

export type AuthoritativeLocalPlayerReconciliationSnapshot = Pick<
  MetaverseRealtimePlayerSnapshot,
  | "groundedBody"
  | "look"
  | "locomotionMode"
  | "mountedOccupancy"
  | "swimBody"
  | "traversalAuthority"
>;

type AckedAuthoritativeLocalPlayerSnapshot =
  AuthoritativeLocalPlayerReconciliationSnapshot & {
    readonly lastProcessedTraversalSequence: number;
  };

export type AckedAuthoritativeLocalPlayerPose =
  AckedAuthoritativeLocalPlayerSnapshot & {
    readonly linearVelocity:
      MetaverseRealtimePlayerSnapshot["groundedBody"]["linearVelocity"];
    readonly position:
      MetaverseRealtimePlayerSnapshot["groundedBody"]["position"];
    readonly yawRadians:
      MetaverseRealtimePlayerSnapshot["groundedBody"]["yawRadians"];
  };

export interface FreshAckedAuthoritativeLocalPlayerSnapshot {
  readonly latestWorldSnapshot: Pick<
    MetaverseRealtimeWorldSnapshot,
    "snapshotSequence" | "tick"
  >;
  readonly playerSnapshot: Pick<
    AckedAuthoritativeLocalPlayerSnapshot,
    "lastProcessedTraversalSequence"
  >;
}

export interface ConsumedAckedAuthoritativeLocalPlayerSample {
  readonly authoritativeSnapshotAgeMs: number;
  readonly authoritativeTick: number;
  readonly lastProcessedTraversalSequence: number;
  readonly pose: AckedAuthoritativeLocalPlayerPose;
  readonly receivedAtWallClockMs: number;
  readonly snapshotSequence: number;
}

function resolveTraversalMovementSequence(input: {
  readonly lastProcessedTraversalSequence: number;
}): number {
  return input.lastProcessedTraversalSequence;
}

export function createAckedAuthoritativeLocalPlayerDeliveryKey(
  freshAckedLocalPlayerSnapshot: FreshAckedAuthoritativeLocalPlayerSnapshot
): string {
  const { latestWorldSnapshot, playerSnapshot } = freshAckedLocalPlayerSnapshot;

  return [
    latestWorldSnapshot.snapshotSequence,
    latestWorldSnapshot.tick.currentTick,
    resolveTraversalMovementSequence(playerSnapshot)
  ].join("|");
}

export function readAckedAuthoritativeLocalPlayerPose(
  playerSnapshot: AckedAuthoritativeLocalPlayerSnapshot
): AckedAuthoritativeLocalPlayerPose {
  const activeBodySnapshot =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(playerSnapshot);

  return {
    groundedBody: playerSnapshot.groundedBody,
    lastProcessedTraversalSequence:
      playerSnapshot.lastProcessedTraversalSequence,
    linearVelocity: activeBodySnapshot.linearVelocity,
    look: playerSnapshot.look,
    locomotionMode: playerSnapshot.locomotionMode,
    mountedOccupancy: playerSnapshot.mountedOccupancy,
    position: activeBodySnapshot.position,
    swimBody: playerSnapshot.swimBody,
    traversalAuthority: playerSnapshot.traversalAuthority,
    yawRadians: createRadians(activeBodySnapshot.yawRadians)
  };
}
