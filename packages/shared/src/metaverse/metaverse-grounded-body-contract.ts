import type { MetaverseWorldSurfaceVector3Snapshot } from "./metaverse-world-surface-query.js";
import {
  createMetaverseGroundedBodyContactSnapshot,
  createMetaverseGroundedBodyInteractionSnapshot,
  type MetaverseGroundedBodyContactSnapshot,
  type MetaverseGroundedBodyInteractionSnapshot
} from "./metaverse-grounded-traversal-kernel.js";
import {
  createMetaverseGroundedJumpBodySnapshot,
  type MetaverseGroundedJumpBodySnapshot
} from "./metaverse-grounded-jump-physics.js";
import {
  createMetaverseSurfaceTraversalDriveTargetSnapshot,
  createMetaverseSurfaceTraversalVector3Snapshot,
  wrapRadians,
  type MetaverseSurfaceTraversalDriveTargetSnapshot
} from "./metaverse-surface-traversal-simulation.js";

export interface MetaverseGroundedBodyConfigSnapshot {
  readonly accelerationCurveExponent: number;
  readonly accelerationUnitsPerSecondSquared: number;
  readonly airborneMovementDampingFactor: number;
  readonly baseSpeedUnitsPerSecond: number;
  readonly boostCurveExponent: number;
  readonly boostMultiplier: number;
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly controllerOffsetMeters: number;
  readonly decelerationUnitsPerSecondSquared: number;
  readonly dragCurveExponent: number;
  readonly gravityUnitsPerSecond: number;
  readonly jumpGroundContactGraceSeconds: number;
  readonly jumpImpulseUnitsPerSecond: number;
  readonly maxSlopeClimbAngleRadians: number;
  readonly minSlopeSlideAngleRadians: number;
  readonly maxTurnSpeedRadiansPerSecond: number;
  readonly snapToGroundDistanceMeters: number;
  readonly spawnPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly stepHeightMeters: number;
  readonly stepWidthMeters: number;
  readonly worldRadius: number;
}

export interface MetaverseGroundedBodyOwnerSnapshot {
  readonly contact: MetaverseGroundedBodyContactSnapshot;
  readonly driveTarget: MetaverseSurfaceTraversalDriveTargetSnapshot;
  readonly grounded: boolean;
  readonly interaction: MetaverseGroundedBodyInteractionSnapshot;
  readonly jumpBody: MetaverseGroundedJumpBodySnapshot;
}

export interface MetaverseGroundedBodyRuntimeSnapshot
  extends MetaverseGroundedBodyOwnerSnapshot {
  readonly linearVelocity: MetaverseWorldSurfaceVector3Snapshot;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

export function createMetaverseGroundedBodyOwnerSnapshot(
  input: Partial<MetaverseGroundedBodyOwnerSnapshot> = {}
): MetaverseGroundedBodyOwnerSnapshot {
  const jumpBodySnapshot = createMetaverseGroundedJumpBodySnapshot(
    input.jumpBody ?? {
      grounded: input.grounded === true
    }
  );

  return Object.freeze({
    contact: createMetaverseGroundedBodyContactSnapshot(
      input.contact ?? {
        supportingContactDetected: jumpBodySnapshot.grounded
      }
    ),
    driveTarget: createMetaverseSurfaceTraversalDriveTargetSnapshot(
      input.driveTarget ?? {}
    ),
    grounded: jumpBodySnapshot.grounded,
    interaction: createMetaverseGroundedBodyInteractionSnapshot(
      input.interaction ?? {}
    ),
    jumpBody: jumpBodySnapshot
  });
}

export function createMetaverseGroundedBodyRuntimeSnapshot(
  input: Partial<MetaverseGroundedBodyRuntimeSnapshot> = {}
): MetaverseGroundedBodyRuntimeSnapshot {
  const ownerSnapshot = createMetaverseGroundedBodyOwnerSnapshot(input);

  return Object.freeze({
    ...ownerSnapshot,
    linearVelocity: createMetaverseSurfaceTraversalVector3Snapshot(
      input.linearVelocity?.x ?? 0,
      input.linearVelocity?.y ?? 0,
      input.linearVelocity?.z ?? 0
    ),
    position: createMetaverseSurfaceTraversalVector3Snapshot(
      input.position?.x ?? 0,
      input.position?.y ?? 0,
      input.position?.z ?? 0
    ),
    yawRadians: wrapRadians(input.yawRadians ?? 0)
  });
}
