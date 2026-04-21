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
    readonly lastProcessedInputSequence: number;
    readonly lastProcessedTraversalSampleId: number;
    readonly lastProcessedTraversalOrientationSequence: number;
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
    | "lastProcessedInputSequence"
    | "lastProcessedTraversalSampleId"
    | "lastProcessedTraversalOrientationSequence"
  >;
}

export interface ConsumedAckedAuthoritativeLocalPlayerSample {
  readonly authoritativeSnapshotAgeMs: number;
  readonly authoritativeTick: number;
  readonly lastProcessedInputSequence: number;
  readonly lastProcessedTraversalSampleId: number;
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
    playerSnapshot.lastProcessedTraversalSampleId,
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
    lastProcessedTraversalSampleId:
      playerSnapshot.lastProcessedTraversalSampleId,
    lastProcessedTraversalOrientationSequence:
      playerSnapshot.lastProcessedTraversalOrientationSequence,
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
