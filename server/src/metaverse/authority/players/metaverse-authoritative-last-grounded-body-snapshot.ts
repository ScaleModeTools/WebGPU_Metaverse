import {
  createMetaverseGroundedBodyContactSnapshot,
  createMetaverseGroundedBodyInteractionSnapshot,
  createMetaverseGroundedJumpBodySnapshot,
  createMetaverseSurfaceTraversalDriveTargetSnapshot,
  type MetaverseGroundedBodyContactSnapshot,
  type MetaverseGroundedBodyInteractionSnapshot,
  type MetaverseGroundedJumpBodySnapshot,
  type MetaverseSurfaceTraversalDriveTargetSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

export interface MetaverseAuthoritativeLastGroundedBodySnapshot {
  readonly contact: MetaverseGroundedBodyContactSnapshot;
  readonly driveTarget: MetaverseSurfaceTraversalDriveTargetSnapshot;
  readonly interaction: MetaverseGroundedBodyInteractionSnapshot;
  readonly jumpBody: MetaverseGroundedJumpBodySnapshot;
  readonly positionYMeters: number;
}

export function createMetaverseAuthoritativeLastGroundedBodySnapshot(
  input: {
    readonly contact?: Partial<MetaverseGroundedBodyContactSnapshot>;
    readonly driveTarget?: Partial<MetaverseSurfaceTraversalDriveTargetSnapshot>;
    readonly interaction?: Partial<MetaverseGroundedBodyInteractionSnapshot>;
    readonly jumpBody?: Partial<MetaverseGroundedJumpBodySnapshot>;
    readonly positionYMeters?: number;
  } = {}
): MetaverseAuthoritativeLastGroundedBodySnapshot {
  return Object.freeze({
    contact: createMetaverseGroundedBodyContactSnapshot(input.contact),
    driveTarget: createMetaverseSurfaceTraversalDriveTargetSnapshot(
      input.driveTarget
    ),
    interaction: createMetaverseGroundedBodyInteractionSnapshot(
      input.interaction
    ),
    jumpBody: createMetaverseGroundedJumpBodySnapshot(input.jumpBody),
    positionYMeters:
      typeof input.positionYMeters === "number" &&
      Number.isFinite(input.positionYMeters)
        ? input.positionYMeters
        : 0
  });
}

export function captureMetaverseAuthoritativeLastGroundedBodySnapshot(
  snapshot: {
    readonly contact: MetaverseGroundedBodyContactSnapshot;
    readonly driveTarget: MetaverseSurfaceTraversalDriveTargetSnapshot;
    readonly interaction: MetaverseGroundedBodyInteractionSnapshot;
    readonly jumpBody: MetaverseGroundedJumpBodySnapshot;
    readonly position: {
      readonly y: number;
    };
  }
): MetaverseAuthoritativeLastGroundedBodySnapshot {
  return createMetaverseAuthoritativeLastGroundedBodySnapshot({
    contact: snapshot.contact,
    driveTarget: snapshot.driveTarget,
    interaction: snapshot.interaction,
    jumpBody: snapshot.jumpBody,
    positionYMeters: snapshot.position.y
  });
}
