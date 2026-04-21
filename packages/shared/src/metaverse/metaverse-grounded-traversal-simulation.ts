import type { MetaverseWorldSurfaceVector3Snapshot } from "./metaverse-world-surface-query.js";
import {
  advanceMetaverseSurfaceTraversalMotion,
  constrainMetaverseSurfaceTraversalPositionToWorldRadius,
  createMetaverseSurfaceTraversalVector3Snapshot,
  toFiniteNumber,
  type MetaverseSurfaceTraversalConfig,
  type MetaverseSurfaceTraversalDriveTargetSnapshot
} from "./metaverse-surface-traversal-simulation.js";
import {
  resolveMetaverseGroundedJumpMovementDampingFactor,
  resolveMetaverseGroundedJumpVerticalSpeedUnitsPerSecond,
  type MetaverseGroundedJumpPhysicsConfigSnapshot
} from "./metaverse-grounded-jump-physics.js";

export interface MetaverseGroundedTraversalConfig
  extends MetaverseSurfaceTraversalConfig,
    MetaverseGroundedJumpPhysicsConfigSnapshot {
  readonly worldRadius: number;
}

export interface MetaverseGroundedTraversalIntentSnapshot {
  readonly boost: boolean;
  // `jump` is an accepted impulse edge by the time it reaches grounded
  // traversal simulation. Readiness is resolved by the caller that owns the
  // action queue and contact truth.
  readonly jump: boolean;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly turnAxis: number;
}

export interface MetaverseGroundedTraversalStateSnapshot {
  readonly forwardSpeedUnitsPerSecond: number;
  readonly grounded: boolean;
  readonly jumpReady: boolean;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly strafeSpeedUnitsPerSecond: number;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseGroundedTraversalPreparedStepSnapshot {
  readonly driveTarget: MetaverseSurfaceTraversalDriveTargetSnapshot;
  readonly desiredMovementDelta: MetaverseWorldSurfaceVector3Snapshot;
  readonly jumpRequested: boolean;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseGroundedTraversalResolvedStepSnapshot {
  readonly forwardSpeedUnitsPerSecond: number;
  readonly grounded: boolean;
  readonly planarSpeedUnitsPerSecond: number;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly strafeSpeedUnitsPerSecond: number;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseGroundedTraversalDirectionalSpeedSnapshot {
  readonly forwardSpeedUnitsPerSecond: number;
  readonly planarSpeedUnitsPerSecond: number;
  readonly strafeSpeedUnitsPerSecond: number;
  readonly verticalSpeedUnitsPerSecond: number;
}

export function resolveMetaverseGroundedTraversalDirectionalSpeeds(
  linearVelocity: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number,
  grounded: boolean
): MetaverseGroundedTraversalDirectionalSpeedSnapshot {
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);
  const linearVelocityX = toFiniteNumber(linearVelocity.x);
  const linearVelocityY = toFiniteNumber(linearVelocity.y);
  const linearVelocityZ = toFiniteNumber(linearVelocity.z);

  return Object.freeze({
    forwardSpeedUnitsPerSecond:
      linearVelocityX * forwardX + linearVelocityZ * forwardZ,
    planarSpeedUnitsPerSecond: Math.hypot(linearVelocityX, linearVelocityZ),
    strafeSpeedUnitsPerSecond:
      linearVelocityX * rightX + linearVelocityZ * rightZ,
    verticalSpeedUnitsPerSecond: grounded ? 0 : linearVelocityY
  });
}

export function prepareMetaverseGroundedTraversalStep(
  stateSnapshot: MetaverseGroundedTraversalStateSnapshot,
  intentSnapshot: MetaverseGroundedTraversalIntentSnapshot,
  config: MetaverseGroundedTraversalConfig,
  deltaSeconds: number,
  yawTargetRadians: number | null = null
): MetaverseGroundedTraversalPreparedStepSnapshot {
  const movementDampingFactor =
    resolveMetaverseGroundedJumpMovementDampingFactor(
      stateSnapshot.grounded,
      config
    );
  const motionSnapshot = advanceMetaverseSurfaceTraversalMotion(
    stateSnapshot.yawRadians,
    {
      forwardSpeedUnitsPerSecond: stateSnapshot.forwardSpeedUnitsPerSecond,
      strafeSpeedUnitsPerSecond: stateSnapshot.strafeSpeedUnitsPerSecond
    },
    {
      boost: intentSnapshot.boost,
      moveAxis: intentSnapshot.moveAxis,
      strafeAxis: intentSnapshot.strafeAxis,
      yawAxis: intentSnapshot.turnAxis
    },
    config,
    deltaSeconds,
    true,
    movementDampingFactor,
    yawTargetRadians
  );
  const jumpRequested = intentSnapshot.jump === true;
  const verticalSpeedUnitsPerSecond =
    resolveMetaverseGroundedJumpVerticalSpeedUnitsPerSecond({
      config,
      currentVerticalSpeedUnitsPerSecond:
        stateSnapshot.verticalSpeedUnitsPerSecond,
      deltaSeconds,
      jumpRequested
    });

  return Object.freeze({
    driveTarget: motionSnapshot.driveTarget,
    desiredMovementDelta: createMetaverseSurfaceTraversalVector3Snapshot(
      motionSnapshot.velocityX * deltaSeconds,
      verticalSpeedUnitsPerSecond * deltaSeconds,
      motionSnapshot.velocityZ * deltaSeconds
    ),
    jumpRequested,
    verticalSpeedUnitsPerSecond,
    yawRadians: motionSnapshot.yawRadians
  });
}

export function resolveMetaverseGroundedTraversalStep(
  previousPosition: MetaverseWorldSurfaceVector3Snapshot,
  unclampedRootPosition: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number,
  grounded: boolean,
  deltaSeconds: number,
  worldRadius: number
): MetaverseGroundedTraversalResolvedStepSnapshot {
  const clampedRootPosition =
    constrainMetaverseSurfaceTraversalPositionToWorldRadius(
      unclampedRootPosition,
      worldRadius
    );
  const appliedDeltaX = clampedRootPosition.x - previousPosition.x;
  const appliedDeltaY = clampedRootPosition.y - previousPosition.y;
  const appliedDeltaZ = clampedRootPosition.z - previousPosition.z;
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);

  return Object.freeze({
    forwardSpeedUnitsPerSecond:
      (appliedDeltaX * forwardX + appliedDeltaZ * forwardZ) / deltaSeconds,
    grounded,
    planarSpeedUnitsPerSecond: Math.hypot(appliedDeltaX, appliedDeltaZ) /
      deltaSeconds,
    position: clampedRootPosition,
    strafeSpeedUnitsPerSecond:
      (appliedDeltaX * rightX + appliedDeltaZ * rightZ) /
      deltaSeconds,
    verticalSpeedUnitsPerSecond: grounded ? 0 : appliedDeltaY / deltaSeconds,
    yawRadians
  });
}
