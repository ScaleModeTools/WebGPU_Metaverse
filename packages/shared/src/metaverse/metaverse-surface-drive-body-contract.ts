import type {
  MetaverseTraversalKinematicStateSnapshot
} from "./metaverse-traversal-kinematics.js";
import {
  createMetaverseTraversalKinematicStateSnapshot
} from "./metaverse-traversal-kinematics.js";
import type {
  MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";
import {
  createMetaverseSurfaceTraversalDriveTargetSnapshot,
  createMetaverseSurfaceTraversalVector3Snapshot,
  toFiniteNumber,
  wrapRadians,
  type MetaverseSurfaceTraversalDriveTargetSnapshot
} from "./metaverse-surface-traversal-simulation.js";

export interface MetaverseSurfaceDriveBodyContactSnapshot {
  readonly appliedMovementDelta: MetaverseWorldSurfaceVector3Snapshot;
  readonly blockedPlanarMovement: boolean;
  readonly desiredMovementDelta: MetaverseWorldSurfaceVector3Snapshot;
}

export type MetaverseSurfaceDriveBodyShapeConfigSnapshot =
  | {
      readonly kind: "capsule";
      readonly halfHeightMeters: number;
      readonly radiusMeters: number;
    }
  | {
      readonly kind: "cuboid";
      readonly halfExtents: MetaverseWorldSurfaceVector3Snapshot;
      readonly localCenter: MetaverseWorldSurfaceVector3Snapshot;
    };

export interface MetaverseSurfaceDriveBodyConfigSnapshot {
  readonly controllerOffsetMeters: number;
  readonly shape: MetaverseSurfaceDriveBodyShapeConfigSnapshot;
  readonly spawnPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly spawnYawRadians: number;
  readonly worldRadius: number;
}

export interface MetaverseSurfaceDriveBodyRuntimeSnapshot
  extends MetaverseTraversalKinematicStateSnapshot {
  readonly contact: MetaverseSurfaceDriveBodyContactSnapshot;
  readonly driveTarget: MetaverseSurfaceTraversalDriveTargetSnapshot;
}

export function createMetaverseSurfaceDriveBodyContactSnapshot(
  input: Partial<MetaverseSurfaceDriveBodyContactSnapshot> = {}
): MetaverseSurfaceDriveBodyContactSnapshot {
  return Object.freeze({
    appliedMovementDelta: createMetaverseSurfaceTraversalVector3Snapshot(
      input.appliedMovementDelta?.x ?? 0,
      input.appliedMovementDelta?.y ?? 0,
      input.appliedMovementDelta?.z ?? 0
    ),
    blockedPlanarMovement: input.blockedPlanarMovement === true,
    desiredMovementDelta: createMetaverseSurfaceTraversalVector3Snapshot(
      input.desiredMovementDelta?.x ?? 0,
      input.desiredMovementDelta?.y ?? 0,
      input.desiredMovementDelta?.z ?? 0
    )
  });
}

export function createMetaverseSurfaceDriveBodyConfigSnapshot(
  input: MetaverseSurfaceDriveBodyConfigSnapshot
): MetaverseSurfaceDriveBodyConfigSnapshot {
  return Object.freeze({
    controllerOffsetMeters: Math.max(
      0.001,
      toFiniteNumber(input.controllerOffsetMeters, 0.01)
    ),
    shape:
      input.shape.kind === "capsule"
        ? Object.freeze({
            halfHeightMeters: Math.max(
              0.01,
              toFiniteNumber(input.shape.halfHeightMeters, 0.48)
            ),
            kind: "capsule" as const,
            radiusMeters: Math.max(
              0.01,
              toFiniteNumber(input.shape.radiusMeters, 0.34)
            )
          })
        : Object.freeze({
            halfExtents: createMetaverseSurfaceTraversalVector3Snapshot(
              Math.max(0.01, toFiniteNumber(input.shape.halfExtents.x, 0.5)),
              Math.max(0.01, toFiniteNumber(input.shape.halfExtents.y, 0.5)),
              Math.max(0.01, toFiniteNumber(input.shape.halfExtents.z, 0.5))
            ),
            kind: "cuboid" as const,
            localCenter: createMetaverseSurfaceTraversalVector3Snapshot(
              input.shape.localCenter.x,
              input.shape.localCenter.y,
              input.shape.localCenter.z
            )
          }),
    spawnPosition: createMetaverseSurfaceTraversalVector3Snapshot(
      input.spawnPosition.x,
      input.spawnPosition.y,
      input.spawnPosition.z
    ),
    spawnYawRadians: wrapRadians(input.spawnYawRadians),
    worldRadius: Math.max(1, toFiniteNumber(input.worldRadius, 110))
  });
}

export function createMetaverseSurfaceDriveBodyRuntimeSnapshot(
  input: Partial<MetaverseSurfaceDriveBodyRuntimeSnapshot> = {}
): MetaverseSurfaceDriveBodyRuntimeSnapshot {
  return Object.freeze({
    ...createMetaverseTraversalKinematicStateSnapshot({
      angularVelocityRadiansPerSecond:
        input.angularVelocityRadiansPerSecond ?? 0,
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
      yawRadians: input.yawRadians ?? 0
    }),
    contact: createMetaverseSurfaceDriveBodyContactSnapshot(input.contact ?? {}),
    driveTarget: createMetaverseSurfaceTraversalDriveTargetSnapshot(
      input.driveTarget ?? {}
    )
  });
}
