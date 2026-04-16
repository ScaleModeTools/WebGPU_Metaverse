import {
  createRadians,
  type MetaverseRealtimePlayerSnapshot,
  type MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared";

export type AckedAuthoritativeLocalPlayerPoseForReconciliation = Pick<
  MetaverseRealtimePlayerSnapshot,
  | "jumpAuthorityState"
  | "linearVelocity"
  | "locomotionMode"
  | "mountedOccupancy"
  | "position"
  | "traversalAuthority"
  | "yawRadians"
>;

type AckedAuthoritativeLocalPlayerSnapshotForReconciliation = Pick<
  MetaverseRealtimePlayerSnapshot,
  | "jumpAuthorityState"
  | "lastProcessedInputSequence"
  | "linearVelocity"
  | "locomotionMode"
  | "mountedOccupancy"
  | "position"
  | "traversalAuthority"
  | "yawRadians"
  | "angularVelocityRadiansPerSecond"
>;

export interface FreshAckedAuthoritativeLocalPlayerSnapshotForReconciliation {
  readonly latestWorldSnapshot: Pick<
    MetaverseRealtimeWorldSnapshot,
    "snapshotSequence" | "tick"
  >;
  readonly playerSnapshot: AckedAuthoritativeLocalPlayerSnapshotForReconciliation;
}

export interface AckedAuthoritativeLocalPlayerReconciliationSample {
  readonly authoritativePlayerSnapshot: AckedAuthoritativeLocalPlayerPoseForReconciliation;
  readonly extrapolationSeconds: number;
}

interface MutableVector3Snapshot {
  x: number;
  y: number;
  z: number;
}

function createMountedOccupancyReconciliationKey(
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

function createAckedAuthoritativeLocalPlayerReconciliationSampleKey(
  playerSnapshot: AckedAuthoritativeLocalPlayerSnapshotForReconciliation
): string {
  return [
    playerSnapshot.jumpAuthorityState,
    playerSnapshot.lastProcessedInputSequence,
    playerSnapshot.locomotionMode,
    createMountedOccupancyReconciliationKey(playerSnapshot.mountedOccupancy),
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

function createMutableVector3(
  x: number = 0,
  y: number = 0,
  z: number = 0
): MutableVector3Snapshot {
  return {
    x,
    y,
    z
  };
}

function writeMutableVector3(
  target: MutableVector3Snapshot,
  x: number,
  y: number,
  z: number
): MutableVector3Snapshot {
  target.x = x;
  target.y = y;
  target.z = z;

  return target;
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function wrapRadians(rawValue: number): number {
  let normalizedValue = rawValue;

  while (normalizedValue > Math.PI) {
    normalizedValue -= Math.PI * 2;
  }

  while (normalizedValue <= -Math.PI) {
    normalizedValue += Math.PI * 2;
  }

  return normalizedValue;
}

function lerpWrappedRadians(
  startRadians: number,
  endRadians: number,
  alpha: number
): number {
  return wrapRadians(
    startRadians + wrapRadians(endRadians - startRadians) * alpha
  );
}

function sampleRemotePlayerPositionInto(
  target: MutableVector3Snapshot,
  basePlayer: AckedAuthoritativeLocalPlayerSnapshotForReconciliation,
  extrapolationSeconds: number
): MutableVector3Snapshot {
  if (extrapolationSeconds <= 0) {
    return writeMutableVector3(
      target,
      basePlayer.position.x,
      basePlayer.position.y,
      basePlayer.position.z
    );
  }

  return writeMutableVector3(
    target,
    basePlayer.position.x + basePlayer.linearVelocity.x * extrapolationSeconds,
    basePlayer.position.y + basePlayer.linearVelocity.y * extrapolationSeconds,
    basePlayer.position.z + basePlayer.linearVelocity.z * extrapolationSeconds
  );
}

function sampleRemotePlayerYawRadians(
  basePlayer: AckedAuthoritativeLocalPlayerSnapshotForReconciliation,
  extrapolationSeconds: number
): number {
  if (extrapolationSeconds <= 0) {
    return basePlayer.yawRadians;
  }

  return wrapRadians(
    basePlayer.yawRadians +
      basePlayer.angularVelocityRadiansPerSecond * extrapolationSeconds
  );
}

export function createAckedAuthoritativeLocalPlayerReconciliationDeliveryKey(
  freshAckedLocalPlayerSnapshot: FreshAckedAuthoritativeLocalPlayerSnapshotForReconciliation
): string {
  return [
    freshAckedLocalPlayerSnapshot.latestWorldSnapshot.snapshotSequence,
    freshAckedLocalPlayerSnapshot.latestWorldSnapshot.tick.currentTick,
    createAckedAuthoritativeLocalPlayerReconciliationSampleKey(
      freshAckedLocalPlayerSnapshot.playerSnapshot
    )
  ].join("|");
}

export function readAckedAuthoritativeLocalPlayerRawPoseForReconciliation(
  playerSnapshot: AckedAuthoritativeLocalPlayerSnapshotForReconciliation
): AckedAuthoritativeLocalPlayerPoseForReconciliation {
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

export function projectAckedAuthoritativeLocalPlayerPoseForReconciliation(
  playerSnapshot: AckedAuthoritativeLocalPlayerSnapshotForReconciliation,
  extrapolationSeconds: number
): AckedAuthoritativeLocalPlayerPoseForReconciliation {
  if (extrapolationSeconds <= 0) {
    return readAckedAuthoritativeLocalPlayerRawPoseForReconciliation(
      playerSnapshot
    );
  }

  return {
    ...readAckedAuthoritativeLocalPlayerRawPoseForReconciliation(playerSnapshot),
    position: sampleRemotePlayerPositionInto(
      createMutableVector3(),
      playerSnapshot,
      extrapolationSeconds
    ),
    yawRadians: createRadians(
      sampleRemotePlayerYawRadians(playerSnapshot, extrapolationSeconds)
    )
  };
}
