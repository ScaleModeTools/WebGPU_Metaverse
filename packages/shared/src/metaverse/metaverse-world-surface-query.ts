export const metaverseWorldSurfaceTraversalAffordanceIds = [
  "blocker",
  "support"
] as const;

export type MetaverseWorldSurfaceTraversalAffordanceId =
  (typeof metaverseWorldSurfaceTraversalAffordanceIds)[number];

export const metaverseWorldSurfacePlacementIds = [
  "dynamic",
  "instanced",
  "static"
] as const;

export type MetaverseWorldSurfacePlacementId =
  (typeof metaverseWorldSurfacePlacementIds)[number];

export interface MetaverseWorldSurfaceVector3Snapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MetaverseWorldSurfaceQuaternionSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface MetaverseWorldSurfacePlacementSnapshot {
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly rotationYRadians: number;
  readonly scale: number;
}

export interface MetaverseWorldSurfaceColliderAuthoring {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly traversalAffordance: MetaverseWorldSurfaceTraversalAffordanceId;
}

export interface MetaverseWorldSurfaceAssetAuthoring {
  readonly environmentAssetId: string;
  readonly placement: MetaverseWorldSurfacePlacementId;
  readonly placements: readonly MetaverseWorldSurfacePlacementSnapshot[];
  readonly surfaceColliders: readonly MetaverseWorldSurfaceColliderAuthoring[];
}

export interface MetaverseWorldWaterRegionAuthoring {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly rotationYRadians: number;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly waterRegionId: string;
}

export interface MetaverseWorldPlacedSurfaceColliderSnapshot {
  readonly halfExtents: MetaverseWorldSurfaceVector3Snapshot;
  readonly ownerEnvironmentAssetId: string | null;
  readonly rotation: MetaverseWorldSurfaceQuaternionSnapshot;
  readonly rotationYRadians: number;
  readonly translation: MetaverseWorldSurfaceVector3Snapshot;
  readonly traversalAffordance: MetaverseWorldSurfaceTraversalAffordanceId;
}

export interface MetaverseWorldPlacedWaterRegionSnapshot {
  readonly halfExtents: MetaverseWorldSurfaceVector3Snapshot;
  readonly rotationYRadians: number;
  readonly translation: MetaverseWorldSurfaceVector3Snapshot;
  readonly waterRegionId: string;
}

function freezeVector3(
  x: number,
  y: number,
  z: number
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0
  });
}

function freezeQuaternion(
  x: number,
  y: number,
  z: number,
  w: number
): MetaverseWorldSurfaceQuaternionSnapshot {
  const magnitude = Math.hypot(x, y, z, w);

  if (magnitude <= 0.000001) {
    return Object.freeze({
      x: 0,
      y: 0,
      z: 0,
      w: 1
    });
  }

  return Object.freeze({
    x: x / magnitude,
    y: y / magnitude,
    z: z / magnitude,
    w: w / magnitude
  });
}

function applyPlacementToLocalCenter(
  localCenter: MetaverseWorldSurfaceColliderAuthoring["center"],
  placement: MetaverseWorldSurfacePlacementSnapshot
): MetaverseWorldSurfaceVector3Snapshot {
  const scaledCenterX = localCenter.x * placement.scale;
  const scaledCenterY = localCenter.y * placement.scale;
  const scaledCenterZ = localCenter.z * placement.scale;
  const sine = Math.sin(placement.rotationYRadians);
  const cosine = Math.cos(placement.rotationYRadians);

  return freezeVector3(
    placement.position.x + scaledCenterX * cosine + scaledCenterZ * sine,
    placement.position.y + scaledCenterY,
    placement.position.z - scaledCenterX * sine + scaledCenterZ * cosine
  );
}

function createPlacedSurfaceColliderSnapshot(
  environmentAssetId: string,
  collider: MetaverseWorldSurfaceColliderAuthoring,
  placement: MetaverseWorldSurfacePlacementSnapshot
): MetaverseWorldPlacedSurfaceColliderSnapshot {
  const halfAngle = placement.rotationYRadians * 0.5;

  return Object.freeze({
    halfExtents: freezeVector3(
      Math.abs(collider.size.x * placement.scale) * 0.5,
      Math.abs(collider.size.y * placement.scale) * 0.5,
      Math.abs(collider.size.z * placement.scale) * 0.5
    ),
    ownerEnvironmentAssetId: environmentAssetId,
    rotation: freezeQuaternion(0, Math.sin(halfAngle), 0, Math.cos(halfAngle)),
    rotationYRadians: placement.rotationYRadians,
    translation: applyPlacementToLocalCenter(collider.center, placement),
    traversalAffordance: collider.traversalAffordance
  });
}

function createPlacedWaterRegionSnapshot(
  waterRegion: MetaverseWorldWaterRegionAuthoring
): MetaverseWorldPlacedWaterRegionSnapshot {
  return Object.freeze({
    halfExtents: freezeVector3(
      Math.abs(waterRegion.size.x) * 0.5,
      Math.abs(waterRegion.size.y) * 0.5,
      Math.abs(waterRegion.size.z) * 0.5
    ),
    rotationYRadians: waterRegion.rotationYRadians,
    translation: freezeVector3(
      waterRegion.center.x,
      waterRegion.center.y,
      waterRegion.center.z
    ),
    waterRegionId: waterRegion.waterRegionId
  });
}

export function resolveMetaverseWorldPlacedSurfaceColliders(
  surfaceAsset: Pick<
    MetaverseWorldSurfaceAssetAuthoring,
    "environmentAssetId" | "placements" | "surfaceColliders"
  >
): readonly MetaverseWorldPlacedSurfaceColliderSnapshot[] {
  return Object.freeze(
    surfaceAsset.placements.flatMap((placement) =>
      surfaceAsset.surfaceColliders.map((collider) =>
        createPlacedSurfaceColliderSnapshot(
          surfaceAsset.environmentAssetId,
          collider,
          placement
        )
      )
    )
  );
}

export function resolveMetaverseWorldDynamicSurfaceCollidersForAsset(
  surfaceAsset: Pick<
    MetaverseWorldSurfaceAssetAuthoring,
    "environmentAssetId" | "placement" | "placements" | "surfaceColliders"
  >,
  poseSnapshot: {
    readonly position: MetaverseWorldSurfaceVector3Snapshot;
    readonly yawRadians: number;
  }
): readonly MetaverseWorldPlacedSurfaceColliderSnapshot[] {
  if (
    surfaceAsset.placement !== "dynamic" ||
    surfaceAsset.placements.length === 0
  ) {
    return Object.freeze([]);
  }

  const authoredPlacement = surfaceAsset.placements[0]!;
  const placement = Object.freeze({
    position: freezeVector3(
      poseSnapshot.position.x,
      poseSnapshot.position.y,
      poseSnapshot.position.z
    ),
    rotationYRadians: poseSnapshot.yawRadians,
    scale: authoredPlacement.scale
  } satisfies MetaverseWorldSurfacePlacementSnapshot);

  return Object.freeze(
    surfaceAsset.surfaceColliders.map((collider) =>
      createPlacedSurfaceColliderSnapshot(
        surfaceAsset.environmentAssetId,
        collider,
        placement
      )
    )
  );
}

export function resolveMetaverseWorldPlacedWaterRegions(
  waterRegions: readonly MetaverseWorldWaterRegionAuthoring[]
): readonly MetaverseWorldPlacedWaterRegionSnapshot[] {
  return Object.freeze(
    waterRegions.map((waterRegion) =>
      createPlacedWaterRegionSnapshot(waterRegion)
    )
  );
}

function rotateWaterRegionPlanarOffset(
  x: number,
  z: number,
  yawRadians: number
): MetaverseWorldSurfaceVector3Snapshot {
  const sine = Math.sin(yawRadians);
  const cosine = Math.cos(yawRadians);

  return freezeVector3(x * cosine + z * sine, 0, -x * sine + z * cosine);
}

function isPlanarPositionInsidePlacedWaterRegion(
  waterRegion: MetaverseWorldPlacedWaterRegionSnapshot,
  x: number,
  z: number,
  paddingMeters: number
): boolean {
  const localOffset = rotateWaterRegionPlanarOffset(
    x - waterRegion.translation.x,
    z - waterRegion.translation.z,
    -waterRegion.rotationYRadians
  );

  return (
    Math.abs(localOffset.x) <= waterRegion.halfExtents.x + paddingMeters &&
    Math.abs(localOffset.z) <= waterRegion.halfExtents.z + paddingMeters
  );
}

export function resolveMetaverseWorldWaterRegionSurfaceHeightMeters(
  waterRegion: MetaverseWorldPlacedWaterRegionSnapshot
): number {
  return waterRegion.translation.y + waterRegion.halfExtents.y;
}

export function resolveMetaverseWorldWaterRegionFloorHeightMeters(
  waterRegion: MetaverseWorldPlacedWaterRegionSnapshot
): number {
  return waterRegion.translation.y - waterRegion.halfExtents.y;
}

export function resolveMetaverseWorldPlacedWaterRegionAtPlanarPosition(
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  x: number,
  z: number,
  paddingMeters = 0
): MetaverseWorldPlacedWaterRegionSnapshot | null {
  let highestSurfaceWaterRegion: MetaverseWorldPlacedWaterRegionSnapshot | null =
    null;

  for (const waterRegion of waterRegionSnapshots) {
    if (
      !isPlanarPositionInsidePlacedWaterRegion(waterRegion, x, z, paddingMeters)
    ) {
      continue;
    }

    if (
      highestSurfaceWaterRegion === null ||
      resolveMetaverseWorldWaterRegionSurfaceHeightMeters(waterRegion) >
        resolveMetaverseWorldWaterRegionSurfaceHeightMeters(
          highestSurfaceWaterRegion
        )
    ) {
      highestSurfaceWaterRegion = waterRegion;
    }
  }

  return highestSurfaceWaterRegion;
}

export function resolveMetaverseWorldWaterSurfaceHeightMeters(
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  x: number,
  z: number,
  paddingMeters = 0
): number | null {
  const waterRegion = resolveMetaverseWorldPlacedWaterRegionAtPlanarPosition(
    waterRegionSnapshots,
    x,
    z,
    paddingMeters
  );

  return waterRegion === null
    ? null
    : resolveMetaverseWorldWaterRegionSurfaceHeightMeters(waterRegion);
}
