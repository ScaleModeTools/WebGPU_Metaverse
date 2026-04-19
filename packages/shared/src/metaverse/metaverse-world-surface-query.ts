import type {
  MetaverseMountedLookLimitPolicyId
} from "./metaverse-player-look-constraints.js";
import type {
  MetaversePresenceMountedOccupancySnapshot,
  MetaversePresenceMountedOccupantRoleId
} from "./metaverse-presence-contract.js";
import type {
  MetaverseMountedVehicleCameraPolicyId,
  MetaverseMountedVehicleControlRoutingPolicyId,
  MetaverseMountedVehicleOccupancyAnimationId
} from "./metaverse-mounted-vehicle-policies.js";

export const metaverseWorldSurfaceTraversalAffordanceIds = [
  "blocker",
  "support"
] as const;

export type MetaverseWorldSurfaceTraversalAffordanceId =
  (typeof metaverseWorldSurfaceTraversalAffordanceIds)[number];

export const metaverseWorldEnvironmentTraversalAffordanceIds = [
  "support",
  "blocker",
  "mount"
] as const;

export type MetaverseWorldEnvironmentTraversalAffordanceId =
  (typeof metaverseWorldEnvironmentTraversalAffordanceIds)[number];

export const metaverseWorldEnvironmentDynamicBodyKindIds = [
  "dynamic-rigid-body"
] as const;

export type MetaverseWorldEnvironmentDynamicBodyKindId =
  (typeof metaverseWorldEnvironmentDynamicBodyKindIds)[number];

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

export type MetaverseWorldSurfaceScaleSnapshot =
  | number
  | MetaverseWorldSurfaceVector3Snapshot;

export interface MetaverseWorldSurfaceQuaternionSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface MetaverseWorldSurfacePlacementSnapshot {
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly rotationYRadians: number;
  readonly scale: MetaverseWorldSurfaceScaleSnapshot;
}

export interface MetaverseWorldSurfaceColliderAuthoring {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly traversalAffordance: MetaverseWorldSurfaceTraversalAffordanceId;
}

export interface MetaverseWorldEnvironmentColliderAuthoring {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
}

export interface MetaverseWorldEnvironmentDynamicBodyAuthoring {
  readonly additionalMass: number;
  readonly angularDamping: number;
  readonly gravityScale: number;
  readonly kind: MetaverseWorldEnvironmentDynamicBodyKindId;
  readonly linearDamping: number;
  readonly lockRotations: boolean;
}

export interface MetaverseWorldMountedSeatAuthoring {
  readonly cameraPolicyId: MetaverseMountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MetaverseMountedVehicleControlRoutingPolicyId;
  readonly directEntryEnabled: boolean;
  readonly label: string;
  readonly lookLimitPolicyId: MetaverseMountedLookLimitPolicyId;
  readonly occupancyAnimationId: MetaverseMountedVehicleOccupancyAnimationId;
  readonly seatId: string;
  readonly seatRole: MetaversePresenceMountedOccupantRoleId;
}

export interface MetaverseWorldMountedEntryAuthoring {
  readonly cameraPolicyId: MetaverseMountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MetaverseMountedVehicleControlRoutingPolicyId;
  readonly entryId: string;
  readonly label: string;
  readonly lookLimitPolicyId: MetaverseMountedLookLimitPolicyId;
  readonly occupancyAnimationId: MetaverseMountedVehicleOccupancyAnimationId;
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
}

export interface MetaverseWorldMountedOccupancyPolicySnapshot {
  readonly cameraPolicyId: MetaverseMountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MetaverseMountedVehicleControlRoutingPolicyId;
  readonly entryId: string | null;
  readonly lookLimitPolicyId: MetaverseMountedLookLimitPolicyId;
  readonly occupancyAnimationId: MetaverseMountedVehicleOccupancyAnimationId;
  readonly occupancyKind: MetaversePresenceMountedOccupancySnapshot["occupancyKind"];
  readonly occupantLabel: string;
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string | null;
}

export interface MetaverseWorldSurfaceAssetAuthoring {
  readonly collisionPath: string | null;
  readonly collider: MetaverseWorldEnvironmentColliderAuthoring | null;
  readonly dynamicBody: MetaverseWorldEnvironmentDynamicBodyAuthoring | null;
  readonly environmentAssetId: string;
  readonly entries?: readonly MetaverseWorldMountedEntryAuthoring[] | null;
  readonly placement: MetaverseWorldSurfacePlacementId;
  readonly placements: readonly MetaverseWorldSurfacePlacementSnapshot[];
  readonly seats?: readonly MetaverseWorldMountedSeatAuthoring[] | null;
  readonly surfaceColliders: readonly MetaverseWorldSurfaceColliderAuthoring[];
  readonly traversalAffordance: MetaverseWorldEnvironmentTraversalAffordanceId;
}

export interface MetaverseWorldWaterRegionAuthoring {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly rotationYRadians: number;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly waterRegionId: string;
}

export interface MetaverseWorldPlacedSurfaceColliderSnapshot {
  readonly shape?: "box" | "trimesh";
  readonly halfExtents: MetaverseWorldSurfaceVector3Snapshot;
  readonly indices?: Uint32Array;
  readonly ownerEnvironmentAssetId: string | null;
  readonly rotation: MetaverseWorldSurfaceQuaternionSnapshot;
  readonly rotationYRadians: number;
  readonly translation: MetaverseWorldSurfaceVector3Snapshot;
  readonly traversalAffordance: MetaverseWorldSurfaceTraversalAffordanceId;
  readonly vertices?: Float32Array;
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

export function resolveMetaverseWorldSurfaceScaleVector(
  scale: MetaverseWorldSurfaceScaleSnapshot
): MetaverseWorldSurfaceVector3Snapshot {
  if (typeof scale === "number") {
    return freezeVector3(scale, scale, scale);
  }

  return freezeVector3(scale.x, scale.y, scale.z);
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
  const scaleVector = resolveMetaverseWorldSurfaceScaleVector(placement.scale);
  const scaledCenterX = localCenter.x * scaleVector.x;
  const scaledCenterY = localCenter.y * scaleVector.y;
  const scaledCenterZ = localCenter.z * scaleVector.z;
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
  const scaleVector = resolveMetaverseWorldSurfaceScaleVector(placement.scale);

  return Object.freeze({
    halfExtents: freezeVector3(
      Math.abs(collider.size.x * scaleVector.x) * 0.5,
      Math.abs(collider.size.y * scaleVector.y) * 0.5,
      Math.abs(collider.size.z * scaleVector.z) * 0.5
    ),
    ownerEnvironmentAssetId: environmentAssetId,
    rotation: freezeQuaternion(0, Math.sin(halfAngle), 0, Math.cos(halfAngle)),
    rotationYRadians: placement.rotationYRadians,
    shape: "box",
    translation: applyPlacementToLocalCenter(collider.center, placement),
    traversalAffordance: collider.traversalAffordance
  });
}

const metaverseTriMeshSupportNormalTolerance = 0.0001;

function resolveMetaverseWorldTriMeshBoundsHalfExtents(
  vertices: Float32Array
): MetaverseWorldSurfaceVector3Snapshot {
  let maxAbsX = 0;
  let maxAbsY = 0;
  let maxAbsZ = 0;

  for (let index = 0; index < vertices.length; index += 3) {
    maxAbsX = Math.max(maxAbsX, Math.abs(vertices[index] ?? 0));
    maxAbsY = Math.max(maxAbsY, Math.abs(vertices[index + 1] ?? 0));
    maxAbsZ = Math.max(maxAbsZ, Math.abs(vertices[index + 2] ?? 0));
  }

  return freezeVector3(maxAbsX, maxAbsY, maxAbsZ);
}

function resolveMetaverseWorldSupportTriMeshIndices(
  vertices: Float32Array,
  indices: Uint32Array
): Uint32Array {
  const supportIndices: number[] = [];

  for (let index = 0; index + 2 < indices.length; index += 3) {
    const vertexAIndex = (indices[index] ?? 0) * 3;
    const vertexBIndex = (indices[index + 1] ?? 0) * 3;
    const vertexCIndex = (indices[index + 2] ?? 0) * 3;
    const ax = vertices[vertexAIndex] ?? 0;
    const ay = vertices[vertexAIndex + 1] ?? 0;
    const az = vertices[vertexAIndex + 2] ?? 0;
    const bx = vertices[vertexBIndex] ?? 0;
    const by = vertices[vertexBIndex + 1] ?? 0;
    const bz = vertices[vertexBIndex + 2] ?? 0;
    const cx = vertices[vertexCIndex] ?? 0;
    const cy = vertices[vertexCIndex + 1] ?? 0;
    const cz = vertices[vertexCIndex + 2] ?? 0;
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;
    const normalY = abz * acx - abx * acz;

    if (
      Math.abs(normalY) <= metaverseTriMeshSupportNormalTolerance ||
      !Number.isFinite(aby) ||
      !Number.isFinite(acy)
    ) {
      continue;
    }

    supportIndices.push(
      indices[index] ?? 0,
      indices[index + 1] ?? 0,
      indices[index + 2] ?? 0
    );
  }

  return Uint32Array.from(supportIndices);
}

export function createMetaverseWorldPlacedSurfaceTriMeshSupportSnapshot(
  ownerEnvironmentAssetId: string | null,
  triMesh: {
    readonly indices: Uint32Array;
    readonly vertices: Float32Array;
  },
  poseSnapshot: {
    readonly position: MetaverseWorldSurfaceVector3Snapshot;
    readonly yawRadians: number;
  }
): MetaverseWorldPlacedSurfaceColliderSnapshot | null {
  const supportIndices = resolveMetaverseWorldSupportTriMeshIndices(
    triMesh.vertices,
    triMesh.indices
  );

  if (supportIndices.length === 0) {
    return null;
  }

  const halfAngle = poseSnapshot.yawRadians * 0.5;

  return Object.freeze({
    halfExtents: resolveMetaverseWorldTriMeshBoundsHalfExtents(triMesh.vertices),
    indices: supportIndices,
    ownerEnvironmentAssetId,
    rotation: freezeQuaternion(0, Math.sin(halfAngle), 0, Math.cos(halfAngle)),
    rotationYRadians: poseSnapshot.yawRadians,
    shape: "trimesh",
    translation: freezeVector3(
      poseSnapshot.position.x,
      poseSnapshot.position.y,
      poseSnapshot.position.z
    ),
    traversalAffordance: "support",
    vertices: triMesh.vertices
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

export function readMetaverseWorldMountedSeatAuthoring(
  surfaceAsset:
    | Pick<MetaverseWorldSurfaceAssetAuthoring, "seats">
    | null
    | undefined,
  seatId: string
): MetaverseWorldMountedSeatAuthoring | null {
  return surfaceAsset?.seats?.find((seat) => seat.seatId === seatId) ?? null;
}

export function readMetaverseWorldMountedEntryAuthoring(
  surfaceAsset:
    | Pick<MetaverseWorldSurfaceAssetAuthoring, "entries">
    | null
    | undefined,
  entryId: string
): MetaverseWorldMountedEntryAuthoring | null {
  return surfaceAsset?.entries?.find((entry) => entry.entryId === entryId) ?? null;
}

export function createMetaverseWorldMountedSeatOccupancyPolicySnapshot(
  seat: Pick<
    MetaverseWorldMountedSeatAuthoring,
    | "cameraPolicyId"
    | "controlRoutingPolicyId"
    | "label"
    | "lookLimitPolicyId"
    | "occupancyAnimationId"
    | "seatId"
    | "seatRole"
  >
): MetaverseWorldMountedOccupancyPolicySnapshot {
  return Object.freeze({
    cameraPolicyId: seat.cameraPolicyId,
    controlRoutingPolicyId: seat.controlRoutingPolicyId,
    entryId: null,
    lookLimitPolicyId: seat.lookLimitPolicyId,
    occupancyAnimationId: seat.occupancyAnimationId,
    occupancyKind: "seat",
    occupantLabel: seat.label,
    occupantRole: seat.seatRole,
    seatId: seat.seatId
  });
}

export function createMetaverseWorldMountedEntryOccupancyPolicySnapshot(
  entry: Pick<
    MetaverseWorldMountedEntryAuthoring,
    | "cameraPolicyId"
    | "controlRoutingPolicyId"
    | "entryId"
    | "label"
    | "lookLimitPolicyId"
    | "occupancyAnimationId"
    | "occupantRole"
  >
): MetaverseWorldMountedOccupancyPolicySnapshot {
  return Object.freeze({
    cameraPolicyId: entry.cameraPolicyId,
    controlRoutingPolicyId: entry.controlRoutingPolicyId,
    entryId: entry.entryId,
    lookLimitPolicyId: entry.lookLimitPolicyId,
    occupancyAnimationId: entry.occupancyAnimationId,
    occupancyKind: "entry",
    occupantLabel: entry.label,
    occupantRole: entry.occupantRole,
    seatId: null
  });
}

export function resolveMetaverseWorldMountedOccupancyPolicySnapshotFromAuthoring(
  mountedOccupancy:
    | Pick<
        MetaversePresenceMountedOccupancySnapshot,
        "entryId" | "occupancyKind" | "occupantRole" | "seatId"
      >
    | null
    | undefined,
  authoring:
    | MetaverseWorldMountedEntryAuthoring
    | MetaverseWorldMountedSeatAuthoring
    | null
    | undefined
): MetaverseWorldMountedOccupancyPolicySnapshot | null {
  if (mountedOccupancy === null || mountedOccupancy === undefined) {
    return null;
  }

  if (authoring === null || authoring === undefined) {
    return null;
  }

  if ("seatId" in authoring) {
    if (
      mountedOccupancy.occupancyKind !== "seat" ||
      mountedOccupancy.entryId !== null ||
      mountedOccupancy.seatId !== authoring.seatId ||
      mountedOccupancy.occupantRole !== authoring.seatRole
    ) {
      return null;
    }

    return createMetaverseWorldMountedSeatOccupancyPolicySnapshot(authoring);
  }

  if (
    mountedOccupancy.occupancyKind !== "entry" ||
    mountedOccupancy.seatId !== null ||
    mountedOccupancy.entryId !== authoring.entryId ||
    mountedOccupancy.occupantRole !== authoring.occupantRole
  ) {
    return null;
  }

  return createMetaverseWorldMountedEntryOccupancyPolicySnapshot(authoring);
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
