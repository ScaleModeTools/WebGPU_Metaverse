import type {
  MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";
import {
  createMetaverseSurfaceTraversalVector3Snapshot,
  toFiniteNumber,
  wrapRadians
} from "./metaverse-surface-traversal-simulation.js";

export interface MetaverseTraversalPlanarDirectionalSpeedSnapshot {
  readonly forwardSpeedUnitsPerSecond: number;
  readonly planarSpeedUnitsPerSecond: number;
  readonly strafeSpeedUnitsPerSecond: number;
}

export interface MetaverseTraversalLinearVelocitySnapshotInput {
  readonly forwardSpeedUnitsPerSecond: number;
  readonly strafeSpeedUnitsPerSecond: number;
  readonly verticalSpeedUnitsPerSecond?: number;
}

export interface MetaverseTraversalKinematicPoseSnapshot {
  readonly position: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "y" | "z">;
  readonly yawRadians: number;
}

export interface MetaverseTraversalPoseKinematicsSnapshot
  extends MetaverseTraversalPlanarDirectionalSpeedSnapshot {
  readonly angularVelocityRadiansPerSecond: number;
  readonly linearVelocity: MetaverseWorldSurfaceVector3Snapshot;
}

export interface MetaverseTraversalKinematicStateSnapshot
  extends MetaverseTraversalPoseKinematicsSnapshot {
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

export interface SyncMetaverseTraversalKinematicStateInput {
  readonly linearVelocity: Pick<
    MetaverseWorldSurfaceVector3Snapshot,
    "x" | "y" | "z"
  >;
  readonly position: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "y" | "z">;
  readonly yawRadians: number;
}

export interface CreateMetaverseTraversalKinematicStateSnapshotInput {
  readonly angularVelocityRadiansPerSecond: number;
  readonly linearVelocity: Pick<
    MetaverseWorldSurfaceVector3Snapshot,
    "x" | "y" | "z"
  >;
  readonly position: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "y" | "z">;
  readonly yawRadians: number;
}

export function createMetaverseTraversalKinematicStateSnapshot({
  angularVelocityRadiansPerSecond,
  linearVelocity: rawLinearVelocity,
  position: rawPosition,
  yawRadians: rawYawRadians
}: CreateMetaverseTraversalKinematicStateSnapshotInput): MetaverseTraversalKinematicStateSnapshot {
  const linearVelocity = createMetaverseSurfaceTraversalVector3Snapshot(
    rawLinearVelocity.x,
    rawLinearVelocity.y,
    rawLinearVelocity.z
  );
  const yawRadians = wrapRadians(rawYawRadians);
  const planarDirectionalSpeeds = resolveMetaverseTraversalPlanarDirectionalSpeeds(
    linearVelocity,
    yawRadians
  );

  return Object.freeze({
    angularVelocityRadiansPerSecond: toFiniteNumber(
      angularVelocityRadiansPerSecond,
      0
    ),
    forwardSpeedUnitsPerSecond:
      planarDirectionalSpeeds.forwardSpeedUnitsPerSecond,
    linearVelocity,
    planarSpeedUnitsPerSecond:
      planarDirectionalSpeeds.planarSpeedUnitsPerSecond,
    position: createMetaverseSurfaceTraversalVector3Snapshot(
      rawPosition.x,
      rawPosition.y,
      rawPosition.z
    ),
    strafeSpeedUnitsPerSecond:
      planarDirectionalSpeeds.strafeSpeedUnitsPerSecond,
    yawRadians
  });
}

function isPositiveFiniteDeltaSeconds(deltaSeconds: number | null): deltaSeconds is number {
  return (
    typeof deltaSeconds === "number" &&
    Number.isFinite(deltaSeconds) &&
    deltaSeconds > 0
  );
}

export function resolveMetaverseTraversalAngularVelocityRadiansPerSecond(
  previousYawRadians: number,
  nextYawRadians: number,
  deltaSeconds: number | null
): number {
  const normalizedDeltaSeconds = isPositiveFiniteDeltaSeconds(deltaSeconds)
    ? deltaSeconds
    : null;

  if (normalizedDeltaSeconds === null) {
    return 0;
  }

  return wrapRadians(nextYawRadians - previousYawRadians) /
    normalizedDeltaSeconds;
}

export function resolveMetaverseTraversalPlanarDirectionalSpeeds(
  linearVelocity: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "z">,
  yawRadians: number
): MetaverseTraversalPlanarDirectionalSpeedSnapshot {
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);
  const linearVelocityX = toFiniteNumber(linearVelocity.x);
  const linearVelocityZ = toFiniteNumber(linearVelocity.z);

  return Object.freeze({
    forwardSpeedUnitsPerSecond:
      linearVelocityX * forwardX + linearVelocityZ * forwardZ,
    planarSpeedUnitsPerSecond: Math.hypot(linearVelocityX, linearVelocityZ),
    strafeSpeedUnitsPerSecond:
      linearVelocityX * rightX + linearVelocityZ * rightZ
  });
}

export function resolveMetaverseTraversalLinearVelocitySnapshot(
  directionalSpeeds: MetaverseTraversalLinearVelocitySnapshotInput,
  yawRadians: number
): MetaverseWorldSurfaceVector3Snapshot {
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);
  const forwardSpeedUnitsPerSecond = toFiniteNumber(
    directionalSpeeds.forwardSpeedUnitsPerSecond
  );
  const strafeSpeedUnitsPerSecond = toFiniteNumber(
    directionalSpeeds.strafeSpeedUnitsPerSecond
  );

  return createMetaverseSurfaceTraversalVector3Snapshot(
    forwardSpeedUnitsPerSecond * forwardX +
      strafeSpeedUnitsPerSecond * rightX,
    directionalSpeeds.verticalSpeedUnitsPerSecond === undefined
      ? 0
      : toFiniteNumber(directionalSpeeds.verticalSpeedUnitsPerSecond),
    forwardSpeedUnitsPerSecond * forwardZ +
      strafeSpeedUnitsPerSecond * rightZ
  );
}

export function resolveMetaverseTraversalPoseKinematics(
  previousPose: MetaverseTraversalKinematicPoseSnapshot,
  nextPose: MetaverseTraversalKinematicPoseSnapshot,
  deltaSeconds: number | null
): MetaverseTraversalPoseKinematicsSnapshot {
  const normalizedDeltaSeconds = isPositiveFiniteDeltaSeconds(deltaSeconds)
    ? deltaSeconds
    : null;
  const linearVelocity = normalizedDeltaSeconds === null
    ? createMetaverseSurfaceTraversalVector3Snapshot(0, 0, 0)
    : createMetaverseSurfaceTraversalVector3Snapshot(
        (toFiniteNumber(nextPose.position.x) -
          toFiniteNumber(previousPose.position.x)) /
          normalizedDeltaSeconds,
        (toFiniteNumber(nextPose.position.y) -
          toFiniteNumber(previousPose.position.y)) /
          normalizedDeltaSeconds,
        (toFiniteNumber(nextPose.position.z) -
          toFiniteNumber(previousPose.position.z)) /
          normalizedDeltaSeconds
      );
  const planarDirectionalSpeeds = resolveMetaverseTraversalPlanarDirectionalSpeeds(
    linearVelocity,
    nextPose.yawRadians
  );

  return Object.freeze({
    angularVelocityRadiansPerSecond:
      resolveMetaverseTraversalAngularVelocityRadiansPerSecond(
        previousPose.yawRadians,
        nextPose.yawRadians,
        deltaSeconds
      ),
    forwardSpeedUnitsPerSecond:
      planarDirectionalSpeeds.forwardSpeedUnitsPerSecond,
    linearVelocity,
    planarSpeedUnitsPerSecond:
      planarDirectionalSpeeds.planarSpeedUnitsPerSecond,
    strafeSpeedUnitsPerSecond:
      planarDirectionalSpeeds.strafeSpeedUnitsPerSecond
  });
}

export function syncMetaverseTraversalKinematicState({
  linearVelocity,
  position,
  yawRadians
}: SyncMetaverseTraversalKinematicStateInput): MetaverseTraversalKinematicStateSnapshot {
  return createMetaverseTraversalKinematicStateSnapshot({
    angularVelocityRadiansPerSecond: 0,
    linearVelocity,
    position,
    yawRadians
  });
}

export function resolveMetaverseTraversalKinematicState(
  previousPose: MetaverseTraversalKinematicPoseSnapshot,
  nextPose: MetaverseTraversalKinematicPoseSnapshot,
  deltaSeconds: number | null
): MetaverseTraversalKinematicStateSnapshot {
  const kinematicSnapshot = resolveMetaverseTraversalPoseKinematics(
    previousPose,
    nextPose,
    deltaSeconds
  );

  return createMetaverseTraversalKinematicStateSnapshot({
    angularVelocityRadiansPerSecond:
      kinematicSnapshot.angularVelocityRadiansPerSecond,
    linearVelocity: kinematicSnapshot.linearVelocity,
    position: nextPose.position,
    yawRadians: nextPose.yawRadians
  });
}
