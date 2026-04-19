import type {
  MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";
import {
  advanceMetaverseSurfaceTraversalMotion,
  clamp,
  constrainMetaverseSurfaceTraversalPositionToWorldRadius,
  createMetaverseSurfaceTraversalVector3Snapshot,
  toFiniteNumber,
  type MetaverseSurfaceTraversalConfig
} from "./metaverse-surface-traversal-simulation.js";
import {
  resolveMetaverseTraversalKinematicState,
  type MetaverseTraversalKinematicStateSnapshot
} from "./metaverse-traversal-kinematics.js";

export interface MetaverseSurfaceDriveBodyIntentSnapshot {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly yawAxis: number;
}

export interface ResolveMetaverseSurfaceDriveBodyStepInput {
  readonly currentForwardSpeedUnitsPerSecond: number;
  readonly currentSnapshot: MetaverseTraversalKinematicStateSnapshot;
  readonly currentStrafeSpeedUnitsPerSecond: number;
  readonly deltaSeconds: number;
  readonly intentSnapshot: MetaverseSurfaceDriveBodyIntentSnapshot;
  readonly lockedHeightMeters: number;
  readonly locomotionConfig: MetaverseSurfaceTraversalConfig;
  readonly preferredLookYawRadians?: number | null;
  readonly resolveBlockedPlanarPosition?: (
    rootPosition: MetaverseWorldSurfaceVector3Snapshot
  ) => Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "y" | "z">;
  readonly resolveUnclampedRootPosition: (input: {
    readonly desiredDeltaX: number;
    readonly desiredDeltaZ: number;
    readonly nextYawRadians: number;
  }) => Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "y" | "z">;
  readonly worldRadius: number;
}

export interface MetaverseSurfaceDriveBodyStepSnapshot {
  readonly nextForwardSpeedUnitsPerSecond: number;
  readonly nextSnapshot: MetaverseTraversalKinematicStateSnapshot;
  readonly nextStrafeSpeedUnitsPerSecond: number;
  readonly nextYawRadians: number;
  readonly resolvedRootPosition: MetaverseWorldSurfaceVector3Snapshot;
}

export function resolveMetaverseSurfaceDriveBodyStep({
  currentForwardSpeedUnitsPerSecond,
  currentSnapshot,
  currentStrafeSpeedUnitsPerSecond,
  deltaSeconds,
  intentSnapshot,
  lockedHeightMeters,
  locomotionConfig,
  preferredLookYawRadians = null,
  resolveBlockedPlanarPosition,
  resolveUnclampedRootPosition,
  worldRadius
}: ResolveMetaverseSurfaceDriveBodyStepInput): MetaverseSurfaceDriveBodyStepSnapshot {
  const motionSnapshot = advanceMetaverseSurfaceTraversalMotion(
    currentSnapshot.yawRadians,
    {
      forwardSpeedUnitsPerSecond: currentForwardSpeedUnitsPerSecond,
      strafeSpeedUnitsPerSecond: currentStrafeSpeedUnitsPerSecond
    },
    {
      boost: intentSnapshot.boost,
      moveAxis: clamp(toFiniteNumber(intentSnapshot.moveAxis, 0), -1, 1),
      strafeAxis: clamp(toFiniteNumber(intentSnapshot.strafeAxis, 0), -1, 1),
      yawAxis: clamp(toFiniteNumber(intentSnapshot.yawAxis, 0), -1, 1)
    },
    locomotionConfig,
    deltaSeconds,
    true,
    1,
    preferredLookYawRadians
  );
  const nextYawRadians = motionSnapshot.yawRadians;
  const resolvedUnclampedRootPosition = resolveUnclampedRootPosition({
    desiredDeltaX: motionSnapshot.velocityX * deltaSeconds,
    desiredDeltaZ: motionSnapshot.velocityZ * deltaSeconds,
    nextYawRadians
  });
  const unclampedRootPosition = createMetaverseSurfaceTraversalVector3Snapshot(
    resolvedUnclampedRootPosition.x,
    resolvedUnclampedRootPosition.y,
    resolvedUnclampedRootPosition.z
  );
  const clampedRootPosition =
    constrainMetaverseSurfaceTraversalPositionToWorldRadius(
      createMetaverseSurfaceTraversalVector3Snapshot(
        unclampedRootPosition.x,
        lockedHeightMeters,
        unclampedRootPosition.z
      ),
      worldRadius
    );
  const blockedPlanarPosition =
    resolveBlockedPlanarPosition?.(clampedRootPosition) ?? clampedRootPosition;
  const resolvedRootPosition = createMetaverseSurfaceTraversalVector3Snapshot(
    blockedPlanarPosition.x,
    blockedPlanarPosition.y,
    blockedPlanarPosition.z
  );
  const nextSnapshot = resolveMetaverseTraversalKinematicState(
    {
      position: currentSnapshot.position,
      yawRadians: currentSnapshot.yawRadians
    },
    {
      position: resolvedRootPosition,
      yawRadians: nextYawRadians
    },
    deltaSeconds
  );

  return Object.freeze({
    nextForwardSpeedUnitsPerSecond:
      nextSnapshot.forwardSpeedUnitsPerSecond,
    nextSnapshot,
    nextStrafeSpeedUnitsPerSecond:
      nextSnapshot.strafeSpeedUnitsPerSecond,
    nextYawRadians,
    resolvedRootPosition
  });
}
