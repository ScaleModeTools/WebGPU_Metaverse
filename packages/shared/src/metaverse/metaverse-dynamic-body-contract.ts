import {
  createMetaverseSurfaceTraversalVector3Snapshot,
  wrapRadians
} from "./metaverse-surface-traversal-simulation.js";
import {
  resolveMetaverseWorldSurfaceScaleVector,
  type MetaverseWorldSurfaceAssetAuthoring,
  type MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";

export interface MetaverseDynamicCuboidBodyConfigSnapshot {
  readonly additionalMass: number;
  readonly angularDamping: number;
  readonly colliderCenter: MetaverseWorldSurfaceVector3Snapshot;
  readonly gravityScale: number;
  readonly halfExtents: MetaverseWorldSurfaceVector3Snapshot;
  readonly linearDamping: number;
  readonly lockRotations: boolean;
  readonly spawnPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly spawnYawRadians: number;
}

export interface MetaverseDynamicCuboidBodyRuntimeSnapshot {
  readonly linearVelocity: MetaverseWorldSurfaceVector3Snapshot;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

function toFiniteNumber(value: number | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function createMetaverseDynamicCuboidBodyConfigSnapshot(
  input: Partial<MetaverseDynamicCuboidBodyConfigSnapshot> = {}
): MetaverseDynamicCuboidBodyConfigSnapshot {
  return Object.freeze({
    additionalMass: Math.max(0, toFiniteNumber(input.additionalMass)),
    angularDamping: Math.max(0, toFiniteNumber(input.angularDamping)),
    colliderCenter: createMetaverseSurfaceTraversalVector3Snapshot(
      input.colliderCenter?.x ?? 0,
      input.colliderCenter?.y ?? 0,
      input.colliderCenter?.z ?? 0
    ),
    gravityScale: Math.max(0, toFiniteNumber(input.gravityScale, 1)),
    halfExtents: createMetaverseSurfaceTraversalVector3Snapshot(
      Math.max(0.01, Math.abs(toFiniteNumber(input.halfExtents?.x, 0.5))),
      Math.max(0.01, Math.abs(toFiniteNumber(input.halfExtents?.y, 0.5))),
      Math.max(0.01, Math.abs(toFiniteNumber(input.halfExtents?.z, 0.5)))
    ),
    linearDamping: Math.max(0, toFiniteNumber(input.linearDamping)),
    lockRotations: input.lockRotations ?? false,
    spawnPosition: createMetaverseSurfaceTraversalVector3Snapshot(
      input.spawnPosition?.x ?? 0,
      input.spawnPosition?.y ?? 0,
      input.spawnPosition?.z ?? 0
    ),
    spawnYawRadians: wrapRadians(input.spawnYawRadians ?? 0)
  });
}

export function createMetaverseDynamicCuboidBodyRuntimeSnapshot(
  input: Partial<MetaverseDynamicCuboidBodyRuntimeSnapshot> = {}
): MetaverseDynamicCuboidBodyRuntimeSnapshot {
  return Object.freeze({
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

export function resolveMetaverseDynamicCuboidBodyConfigSnapshotFromSurfaceAsset(
  surfaceAsset: Pick<
    MetaverseWorldSurfaceAssetAuthoring,
    "collider" | "dynamicBody" | "placement" | "placements"
  >
): MetaverseDynamicCuboidBodyConfigSnapshot | null {
  if (
    surfaceAsset.placement !== "dynamic" ||
    surfaceAsset.dynamicBody === null ||
    surfaceAsset.collider === null ||
    surfaceAsset.placements.length !== 1
  ) {
    return null;
  }

  const placement = surfaceAsset.placements[0]!;
  const scaleVector = resolveMetaverseWorldSurfaceScaleVector(placement.scale);

  return createMetaverseDynamicCuboidBodyConfigSnapshot({
    additionalMass: surfaceAsset.dynamicBody.additionalMass,
    angularDamping: surfaceAsset.dynamicBody.angularDamping,
    colliderCenter: createMetaverseSurfaceTraversalVector3Snapshot(
      surfaceAsset.collider.center.x * scaleVector.x,
      surfaceAsset.collider.center.y * scaleVector.y,
      surfaceAsset.collider.center.z * scaleVector.z
    ),
    gravityScale: surfaceAsset.dynamicBody.gravityScale,
    halfExtents: createMetaverseSurfaceTraversalVector3Snapshot(
      Math.abs(surfaceAsset.collider.size.x * scaleVector.x) * 0.5,
      Math.abs(surfaceAsset.collider.size.y * scaleVector.y) * 0.5,
      Math.abs(surfaceAsset.collider.size.z * scaleVector.z) * 0.5
    ),
    linearDamping: surfaceAsset.dynamicBody.linearDamping,
    lockRotations: surfaceAsset.dynamicBody.lockRotations,
    spawnPosition: placement.position,
    spawnYawRadians: placement.rotationYRadians
  });
}
