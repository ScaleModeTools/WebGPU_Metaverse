import type {
  MetaverseWorldPlacedSurfaceColliderSnapshot,
  MetaverseWorldPlacedWaterRegionSnapshot,
  MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";
import { resolveMetaverseWorldWaterSurfaceHeightMeters } from "./metaverse-world-surface-query.js";

export interface MetaverseWorldSurfacePolicyConfig {
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly gravityUnitsPerSecond: number;
  readonly jumpImpulseUnitsPerSecond: number;
  readonly maxWalkableSlopeAngleRadians?: number;
  readonly oceanHeightMeters: number;
  readonly stepHeightMeters: number;
}

export const metaverseWorldAutomaticSurfaceDecisionReasonIds = [
  "grounded-hold",
  "water-entry",
  "shoreline-exit-blocked",
  "shoreline-exit-success"
] as const;

export type MetaverseWorldAutomaticSurfaceDecisionReasonId =
  (typeof metaverseWorldAutomaticSurfaceDecisionReasonIds)[number];

export interface MetaverseWorldSurfaceLocomotionDecision {
  readonly locomotionMode: "grounded" | "swim";
  readonly support: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly supportHeightMeters: number | null;
}

export type MetaverseWorldSurfaceSupportKind =
  | "box"
  | "heightfield"
  | "trimesh";

export interface MetaverseWorldSurfaceSupportSnapshot {
  readonly confidence: number;
  readonly ownerEnvironmentAssetId: string | null;
  readonly slopeAngleRadians: number;
  readonly stepEligible: boolean;
  readonly supportHeightMeters: number;
  readonly supportId: string;
  readonly supportKind: MetaverseWorldSurfaceSupportKind;
  readonly supportNormal: MetaverseWorldSurfaceVector3Snapshot;
  readonly walkable: boolean;
}

export interface MetaverseWorldAutomaticSurfaceLocomotionDebugSnapshot {
  readonly blockerOverlap: boolean;
  readonly centerStepBlocked: boolean;
  readonly centerStepSupportHeightMeters: number | null;
  readonly forwardStepBlocked: boolean;
  readonly forwardStepSupportHeightMeters: number | null;
  readonly reason: MetaverseWorldAutomaticSurfaceDecisionReasonId;
  readonly resolvedSupportHeightMeters: number;
  readonly stepSupportedProbeCount: number;
}

export interface MetaverseWorldAutomaticSurfaceLocomotionSnapshot {
  readonly debug: MetaverseWorldAutomaticSurfaceLocomotionDebugSnapshot;
  readonly decision: MetaverseWorldSurfaceLocomotionDecision;
}

export const metaverseWorldAutomaticSurfaceWaterlineThresholdMeters = 0.05;
const automaticSurfaceExitSupportProbeCount = 3;
const automaticSurfaceGroundedHoldProbeCount = 2;
const automaticSurfaceGroundedHoldPaddingFactor = 0.45;
const automaticSurfaceProbeForwardDistanceFactor = 0.88;
const automaticSurfaceProbeLateralDistanceFactor = 0.72;
export const metaverseWorldSurfaceDefaultStepHeightMeters = 0.28;
export const metaverseWorldSurfaceStepHeightLeewayMeters = 0.04;
export const metaverseWorldSurfaceDefaultMaxWalkableSlopeAngleRadians =
  Math.PI * 0.26;
const automaticSurfaceStepHeightLeewayMeters =
  metaverseWorldSurfaceStepHeightLeewayMeters;
const automaticSurfaceBlockingHeightToleranceMeters = 0.01;
const automaticSurfaceDefaultMaxWalkableSlopeAngleRadians =
  metaverseWorldSurfaceDefaultMaxWalkableSlopeAngleRadians;
const automaticSurfaceSupportTokenPrecision = 1_000;

interface AutomaticSurfaceSupportSnapshot {
  readonly centerStepBlocked: boolean;
  readonly centerStepSupport: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly centerStepSupportHeightMeters: number | null;
  readonly forwardStepBlocked: boolean;
  readonly forwardStepSupport: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly forwardStepSupportHeightMeters: number | null;
  readonly highestStepSupport: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly highestStepSupportHeightMeters: number | null;
  readonly highestSupport: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly stepSupportedProbeCount: number;
}

interface AutomaticSurfaceProbeSupportSnapshot {
  readonly stepSupport: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly stepSupportHeightMeters: number | null;
  readonly support: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly supportHeightMeters: number | null;
}

interface GroundedSupportObstacleConfig {
  readonly currentRootHeightMeters: number;
  readonly maxStepRiseMeters: number;
  readonly maxSupportRiseMeters?: number;
  readonly nextRootHeightMeters: number;
  readonly surfacePolicyConfig?: MetaverseWorldSurfacePolicyConfig;
}

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
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

function normalizeSupportTokenNumber(value: number): string {
  return String(
    Math.round(
      toFiniteNumber(value, 0) * automaticSurfaceSupportTokenPrecision
    )
  );
}

function resolveColliderSupportBaseId(
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot,
  supportKind: MetaverseWorldSurfaceSupportKind
): string {
  return [
    collider.ownerEnvironmentAssetId ?? "world",
    supportKind,
    normalizeSupportTokenNumber(collider.translation.x),
    normalizeSupportTokenNumber(collider.translation.y),
    normalizeSupportTokenNumber(collider.translation.z),
    normalizeSupportTokenNumber(collider.rotationYRadians)
  ].join(":");
}

function normalizeSupportNormal(
  normal: MetaverseWorldSurfaceVector3Snapshot
): MetaverseWorldSurfaceVector3Snapshot {
  let x = toFiniteNumber(normal.x, 0);
  let y = toFiniteNumber(normal.y, 1);
  let z = toFiniteNumber(normal.z, 0);
  const magnitude = Math.hypot(x, y, z);

  if (magnitude <= 0.000001) {
    return freezeVector3(0, 1, 0);
  }

  if (y < 0) {
    x = -x;
    y = -y;
    z = -z;
  }

  return freezeVector3(x / magnitude, y / magnitude, z / magnitude);
}

function rotatePlanarVector(
  x: number,
  z: number,
  yawRadians: number
): Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "z"> {
  const sine = Math.sin(yawRadians);
  const cosine = Math.cos(yawRadians);

  return Object.freeze({
    x: x * cosine + z * sine,
    z: -x * sine + z * cosine
  });
}

function rotateSupportNormalToWorld(
  normal: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number
): MetaverseWorldSurfaceVector3Snapshot {
  const rotatedPlanarNormal = rotatePlanarVector(normal.x, normal.z, yawRadians);

  return normalizeSupportNormal(
    freezeVector3(rotatedPlanarNormal.x, normal.y, rotatedPlanarNormal.z)
  );
}

function resolveWalkableNormalY(
  config: MetaverseWorldSurfacePolicyConfig
): number {
  const maxWalkableSlopeAngleRadians = clamp(
    toFiniteNumber(
      config.maxWalkableSlopeAngleRadians ??
        automaticSurfaceDefaultMaxWalkableSlopeAngleRadians,
      automaticSurfaceDefaultMaxWalkableSlopeAngleRadians
    ),
    0,
    Math.PI * 0.5
  );

  return Math.cos(maxWalkableSlopeAngleRadians);
}

function createSurfaceSupportSnapshot(input: {
  readonly config: MetaverseWorldSurfacePolicyConfig;
  readonly collider: MetaverseWorldPlacedSurfaceColliderSnapshot;
  readonly detailId: string;
  readonly stepEligible: boolean;
  readonly supportHeightMeters: number;
  readonly supportKind: MetaverseWorldSurfaceSupportKind;
  readonly supportNormal: MetaverseWorldSurfaceVector3Snapshot;
}): MetaverseWorldSurfaceSupportSnapshot {
  const supportNormal = normalizeSupportNormal(input.supportNormal);
  const slopeAngleRadians = Math.acos(clamp(supportNormal.y, -1, 1));
  const walkable = supportNormal.y >= resolveWalkableNormalY(input.config);

  return Object.freeze({
    confidence: walkable ? supportNormal.y : 0,
    ownerEnvironmentAssetId: input.collider.ownerEnvironmentAssetId,
    slopeAngleRadians,
    stepEligible: input.stepEligible && walkable,
    supportHeightMeters: input.supportHeightMeters,
    supportId: `${resolveColliderSupportBaseId(
      input.collider,
      input.supportKind
    )}:${input.detailId}`,
    supportKind: input.supportKind,
    supportNormal,
    walkable
  });
}

function rotatePlanarPoint(
  x: number,
  z: number,
  yawRadians: number
): MetaverseWorldSurfaceVector3Snapshot {
  const sine = Math.sin(yawRadians);
  const cosine = Math.cos(yawRadians);

  return freezeVector3(x * cosine + z * sine, 0, -x * sine + z * cosine);
}

function resolvePlanarProbeOffset(
  forwardMeters: number,
  lateralMeters: number,
  yawRadians: number
): MetaverseWorldSurfaceVector3Snapshot {
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);

  return freezeVector3(
    forwardX * forwardMeters + rightX * lateralMeters,
    0,
    forwardZ * forwardMeters + rightZ * lateralMeters
  );
}

function isPlanarPositionInsideCollider(
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot,
  x: number,
  z: number,
  paddingMeters: number
): boolean {
  if (collider.shape === "trimesh") {
    const localOffset = rotatePlanarPoint(
      x - collider.translation.x,
      z - collider.translation.z,
      -collider.rotationYRadians
    );

    return (
      Math.abs(localOffset.x) <= collider.halfExtents.x + paddingMeters &&
      Math.abs(localOffset.z) <= collider.halfExtents.z + paddingMeters
    );
  }

  const localOffset = rotatePlanarPoint(
    x - collider.translation.x,
    z - collider.translation.z,
    -collider.rotationYRadians
  );

  return (
    Math.abs(localOffset.x) <= collider.halfExtents.x + paddingMeters &&
    Math.abs(localOffset.z) <= collider.halfExtents.z + paddingMeters
  );
}

function isSurfaceTriMeshCollider(
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot
): collider is MetaverseWorldPlacedSurfaceColliderSnapshot & {
  readonly indices: Uint32Array;
  readonly shape: "trimesh";
  readonly vertices: Float32Array;
} {
  return (
    collider.shape === "trimesh" &&
    collider.indices instanceof Uint32Array &&
    collider.vertices instanceof Float32Array
  );
}

function isSurfaceHeightfieldCollider(
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot
): collider is MetaverseWorldPlacedSurfaceColliderSnapshot & {
  readonly heightSamples: Float32Array;
  readonly sampleCountX: number;
  readonly sampleCountZ: number;
  readonly sampleSpacingMeters: number;
  readonly shape: "heightfield";
} {
  return (
    collider.shape === "heightfield" &&
    collider.heightSamples instanceof Float32Array &&
    typeof collider.sampleCountX === "number" &&
    typeof collider.sampleCountZ === "number" &&
    typeof collider.sampleSpacingMeters === "number"
  );
}

function dotPlanar(
  leftX: number,
  leftZ: number,
  rightX: number,
  rightZ: number
): number {
  return leftX * rightX + leftZ * rightZ;
}

function resolveClosestPlanarPointOnTriangle(
  output: {
    pointX: number;
    pointZ: number;
    u: number;
    v: number;
    w: number;
  },
  pointX: number,
  pointZ: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number
): void {
  const abX = bx - ax;
  const abZ = bz - az;
  const acX = cx - ax;
  const acZ = cz - az;
  const apX = pointX - ax;
  const apZ = pointZ - az;
  const d1 = dotPlanar(abX, abZ, apX, apZ);
  const d2 = dotPlanar(acX, acZ, apX, apZ);

  if (d1 <= 0 && d2 <= 0) {
    output.pointX = ax;
    output.pointZ = az;
    output.u = 1;
    output.v = 0;
    output.w = 0;
    return;
  }

  const bpX = pointX - bx;
  const bpZ = pointZ - bz;
  const d3 = dotPlanar(abX, abZ, bpX, bpZ);
  const d4 = dotPlanar(acX, acZ, bpX, bpZ);

  if (d3 >= 0 && d4 <= d3) {
    output.pointX = bx;
    output.pointZ = bz;
    output.u = 0;
    output.v = 1;
    output.w = 0;
    return;
  }

  const vc = d1 * d4 - d3 * d2;

  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / Math.max(0.000001, d1 - d3);

    output.pointX = ax + abX * v;
    output.pointZ = az + abZ * v;
    output.u = 1 - v;
    output.v = v;
    output.w = 0;
    return;
  }

  const cpX = pointX - cx;
  const cpZ = pointZ - cz;
  const d5 = dotPlanar(abX, abZ, cpX, cpZ);
  const d6 = dotPlanar(acX, acZ, cpX, cpZ);

  if (d6 >= 0 && d5 <= d6) {
    output.pointX = cx;
    output.pointZ = cz;
    output.u = 0;
    output.v = 0;
    output.w = 1;
    return;
  }

  const vb = d5 * d2 - d1 * d6;

  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / Math.max(0.000001, d2 - d6);

    output.pointX = ax + acX * w;
    output.pointZ = az + acZ * w;
    output.u = 1 - w;
    output.v = 0;
    output.w = w;
    return;
  }

  const va = d3 * d6 - d5 * d4;

  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / Math.max(0.000001, d4 - d3 + (d5 - d6));

    output.pointX = bx + (cx - bx) * w;
    output.pointZ = bz + (cz - bz) * w;
    output.u = 0;
    output.v = 1 - w;
    output.w = w;
    return;
  }

  const inverseDenominator = 1 / Math.max(0.000001, va + vb + vc);
  const v = vb * inverseDenominator;
  const w = vc * inverseDenominator;
  const u = 1 - v - w;

  output.pointX = ax + abX * v + acX * w;
  output.pointZ = az + abZ * v + acZ * w;
  output.u = u;
  output.v = v;
  output.w = w;
}

function isPlanarPositionBlockedByTriMeshCollider(
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot,
  x: number,
  z: number,
  paddingMeters: number,
  minHeightMeters: number,
  maxHeightMeters: number
): boolean {
  if (!isSurfaceTriMeshCollider(collider)) {
    return false;
  }

  const localPoint = rotatePlanarPoint(
    x - collider.translation.x,
    z - collider.translation.z,
    -collider.rotationYRadians
  );

  if (
    Math.abs(localPoint.x) > collider.halfExtents.x + paddingMeters ||
    Math.abs(localPoint.z) > collider.halfExtents.z + paddingMeters
  ) {
    return false;
  }

  const localMinHeightMeters = minHeightMeters - collider.translation.y;
  const localMaxHeightMeters = maxHeightMeters - collider.translation.y;
  const maxDistanceSquared = paddingMeters * paddingMeters;
  const closestPoint = {
    pointX: 0,
    pointZ: 0,
    u: 0,
    v: 0,
    w: 0
  };

  for (let index = 0; index + 2 < collider.indices.length; index += 3) {
    const vertexAIndex = (collider.indices[index] ?? 0) * 3;
    const vertexBIndex = (collider.indices[index + 1] ?? 0) * 3;
    const vertexCIndex = (collider.indices[index + 2] ?? 0) * 3;
    const ax = collider.vertices[vertexAIndex] ?? 0;
    const ay = collider.vertices[vertexAIndex + 1] ?? 0;
    const az = collider.vertices[vertexAIndex + 2] ?? 0;
    const bx = collider.vertices[vertexBIndex] ?? 0;
    const by = collider.vertices[vertexBIndex + 1] ?? 0;
    const bz = collider.vertices[vertexBIndex + 2] ?? 0;
    const cx = collider.vertices[vertexCIndex] ?? 0;
    const cy = collider.vertices[vertexCIndex + 1] ?? 0;
    const cz = collider.vertices[vertexCIndex + 2] ?? 0;
    resolveClosestPlanarPointOnTriangle(
      closestPoint,
      localPoint.x,
      localPoint.z,
      ax,
      az,
      bx,
      bz,
      cx,
      cz
    );
    const deltaX = closestPoint.pointX - localPoint.x;
    const deltaZ = closestPoint.pointZ - localPoint.z;

    if (
      paddingMeters > 0 &&
      deltaX * deltaX + deltaZ * deltaZ > maxDistanceSquared
    ) {
      continue;
    }

    if (
      paddingMeters <= 0 &&
      (Math.abs(deltaX) > 0.0001 || Math.abs(deltaZ) > 0.0001)
    ) {
      continue;
    }

    const localTriangleMinY = Math.min(ay, by, cy);
    const localTriangleMaxY = Math.max(ay, by, cy);

    if (
      localTriangleMaxY < localMinHeightMeters ||
      localTriangleMinY > localMaxHeightMeters
    ) {
      continue;
    }

    const abx = bx - ax;
    const abz = bz - az;
    const acx = cx - ax;
    const acz = cz - az;
    const normalY = abz * acx - abx * acz;

    if (Math.abs(normalY) <= 0.0001) {
      return true;
    }

    const localSurfaceY =
      ay * closestPoint.u + by * closestPoint.v + cy * closestPoint.w;

    if (
      localSurfaceY > localMinHeightMeters + automaticSurfaceBlockingHeightToleranceMeters &&
      localSurfaceY <=
        localMaxHeightMeters + automaticSurfaceBlockingHeightToleranceMeters
    ) {
      return true;
    }
  }

  return false;
}

function resolveHeightfieldSampleHeight(
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot & {
    readonly heightSamples: Float32Array;
    readonly sampleCountX: number;
    readonly sampleCountZ: number;
    readonly sampleSpacingMeters: number;
    readonly shape: "heightfield";
  },
  sampleX: number,
  sampleZ: number
): number {
  return collider.heightSamples[sampleZ * collider.sampleCountX + sampleX] ?? 0;
}

function resolveHeightfieldLocalSupportSnapshot(
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot & {
    readonly heightSamples: Float32Array;
    readonly sampleCountX: number;
    readonly sampleCountZ: number;
    readonly sampleSpacingMeters: number;
    readonly shape: "heightfield";
  },
  x: number,
  z: number,
  paddingMeters: number
): {
  readonly cellX: number;
  readonly cellZ: number;
  readonly supportHeightMeters: number;
  readonly supportNormal: MetaverseWorldSurfaceVector3Snapshot;
} | null {
  if (
    collider.sampleCountX < 2 ||
    collider.sampleCountZ < 2 ||
    collider.sampleSpacingMeters <= 0
  ) {
    return null;
  }

  const localPoint = rotatePlanarPoint(
    x - collider.translation.x,
    z - collider.translation.z,
    -collider.rotationYRadians
  );
  const halfX = (collider.sampleCountX - 1) * collider.sampleSpacingMeters * 0.5;
  const halfZ = (collider.sampleCountZ - 1) * collider.sampleSpacingMeters * 0.5;

  if (
    Math.abs(localPoint.x) > halfX + paddingMeters ||
    Math.abs(localPoint.z) > halfZ + paddingMeters
  ) {
    return null;
  }

  const sampleXFloat = Math.min(
    collider.sampleCountX - 1,
    Math.max(
      0,
      localPoint.x / collider.sampleSpacingMeters +
        (collider.sampleCountX - 1) * 0.5
    )
  );
  const sampleZFloat = Math.min(
    collider.sampleCountZ - 1,
    Math.max(
      0,
      localPoint.z / collider.sampleSpacingMeters +
        (collider.sampleCountZ - 1) * 0.5
    )
  );
  const cellX = Math.min(
    collider.sampleCountX - 2,
    Math.max(0, Math.floor(sampleXFloat))
  );
  const cellZ = Math.min(
    collider.sampleCountZ - 2,
    Math.max(0, Math.floor(sampleZFloat))
  );
  const localX = sampleXFloat - cellX;
  const localZ = sampleZFloat - cellZ;
  const topLeft = resolveHeightfieldSampleHeight(collider, cellX, cellZ);
  const topRight = resolveHeightfieldSampleHeight(collider, cellX + 1, cellZ);
  const bottomLeft = resolveHeightfieldSampleHeight(collider, cellX, cellZ + 1);
  const bottomRight = resolveHeightfieldSampleHeight(
    collider,
    cellX + 1,
    cellZ + 1
  );
  const localSurfaceY =
    localX + localZ <= 1
      ? topLeft + (topRight - topLeft) * localX + (bottomLeft - topLeft) * localZ
      : topRight * (1 - localZ) +
        bottomLeft * (1 - localX) +
        bottomRight * (localX + localZ - 1);
  const leftHeight = resolveHeightfieldSampleHeight(
    collider,
    Math.max(0, cellX - 1),
    cellZ
  );
  const rightHeight = resolveHeightfieldSampleHeight(
    collider,
    Math.min(collider.sampleCountX - 1, cellX + 1),
    cellZ
  );
  const rearHeight = resolveHeightfieldSampleHeight(
    collider,
    cellX,
    Math.max(0, cellZ - 1)
  );
  const forwardHeight = resolveHeightfieldSampleHeight(
    collider,
    cellX,
    Math.min(collider.sampleCountZ - 1, cellZ + 1)
  );
  const sampleSpanX =
    (Math.min(collider.sampleCountX - 1, cellX + 1) -
      Math.max(0, cellX - 1)) *
    collider.sampleSpacingMeters;
  const sampleSpanZ =
    (Math.min(collider.sampleCountZ - 1, cellZ + 1) -
      Math.max(0, cellZ - 1)) *
    collider.sampleSpacingMeters;
  const slopeX = sampleSpanX > 0 ? (rightHeight - leftHeight) / sampleSpanX : 0;
  const slopeZ =
    sampleSpanZ > 0 ? (forwardHeight - rearHeight) / sampleSpanZ : 0;
  const worldNormal = rotateSupportNormalToWorld(
    freezeVector3(-slopeX, 1, -slopeZ),
    collider.rotationYRadians
  );

  return Object.freeze({
    cellX,
    cellZ,
    supportHeightMeters: collider.translation.y + localSurfaceY,
    supportNormal: worldNormal
  });
}

function resolveTriMeshSupportCandidate(
  config: MetaverseWorldSurfacePolicyConfig,
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot,
  x: number,
  z: number,
  paddingMeters: number
): MetaverseWorldSurfaceSupportSnapshot | null {
  if (!isSurfaceTriMeshCollider(collider)) {
    return null;
  }

  const localPoint = rotatePlanarPoint(
    x - collider.translation.x,
    z - collider.translation.z,
    -collider.rotationYRadians
  );

  if (
    Math.abs(localPoint.x) > collider.halfExtents.x + paddingMeters ||
    Math.abs(localPoint.z) > collider.halfExtents.z + paddingMeters
  ) {
    return null;
  }

  let selectedSupport: MetaverseWorldSurfaceSupportSnapshot | null = null;
  const maxDistanceSquared = paddingMeters * paddingMeters;
  const closestPoint = {
    pointX: 0,
    pointZ: 0,
    u: 0,
    v: 0,
    w: 0
  };

  for (let index = 0; index + 2 < collider.indices.length; index += 3) {
    const vertexAIndex = (collider.indices[index] ?? 0) * 3;
    const vertexBIndex = (collider.indices[index + 1] ?? 0) * 3;
    const vertexCIndex = (collider.indices[index + 2] ?? 0) * 3;
    const ax = collider.vertices[vertexAIndex] ?? 0;
    const ay = collider.vertices[vertexAIndex + 1] ?? 0;
    const az = collider.vertices[vertexAIndex + 2] ?? 0;
    const bx = collider.vertices[vertexBIndex] ?? 0;
    const by = collider.vertices[vertexBIndex + 1] ?? 0;
    const bz = collider.vertices[vertexBIndex + 2] ?? 0;
    const cx = collider.vertices[vertexCIndex] ?? 0;
    const cy = collider.vertices[vertexCIndex + 1] ?? 0;
    const cz = collider.vertices[vertexCIndex + 2] ?? 0;
    resolveClosestPlanarPointOnTriangle(
      closestPoint,
      localPoint.x,
      localPoint.z,
      ax,
      az,
      bx,
      bz,
      cx,
      cz
    );
    const deltaX = closestPoint.pointX - localPoint.x;
    const deltaZ = closestPoint.pointZ - localPoint.z;

    if (
      paddingMeters > 0 &&
      deltaX * deltaX + deltaZ * deltaZ > maxDistanceSquared
    ) {
      continue;
    }

    if (
      paddingMeters <= 0 &&
      (Math.abs(deltaX) > 0.0001 || Math.abs(deltaZ) > 0.0001)
    ) {
      continue;
    }

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;
    const normal = rotateSupportNormalToWorld(
      freezeVector3(
        aby * acz - abz * acy,
        abz * acx - abx * acz,
        abx * acy - aby * acx
      ),
      collider.rotationYRadians
    );
    const localSurfaceY =
      ay * closestPoint.u + by * closestPoint.v + cy * closestPoint.w;
    const candidate = createSurfaceSupportSnapshot({
      collider,
      config,
      detailId: `tri-${index / 3}`,
      stepEligible: true,
      supportHeightMeters: collider.translation.y + localSurfaceY,
      supportKind: "trimesh",
      supportNormal: normal
    });

    if (!candidate.walkable) {
      continue;
    }

    if (
      selectedSupport === null ||
      candidate.supportHeightMeters > selectedSupport.supportHeightMeters ||
      (candidate.supportHeightMeters === selectedSupport.supportHeightMeters &&
        candidate.confidence > selectedSupport.confidence)
    ) {
      selectedSupport = candidate;
    }
  }

  return selectedSupport;
}

function resolveColliderSupportCandidate(
  config: MetaverseWorldSurfacePolicyConfig,
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot,
  x: number,
  z: number,
  paddingMeters: number
): MetaverseWorldSurfaceSupportSnapshot | null {
  if (isSurfaceHeightfieldCollider(collider)) {
    const heightfieldSupport = resolveHeightfieldLocalSupportSnapshot(
      collider,
      x,
      z,
      paddingMeters
    );

    return heightfieldSupport === null
      ? null
      : createSurfaceSupportSnapshot({
          collider,
          config,
          detailId: `cell-${heightfieldSupport.cellX}-${heightfieldSupport.cellZ}`,
          stepEligible: true,
          supportHeightMeters: heightfieldSupport.supportHeightMeters,
          supportKind: "heightfield",
          supportNormal: heightfieldSupport.supportNormal
        });
  }

  if (isSurfaceTriMeshCollider(collider)) {
    return resolveTriMeshSupportCandidate(config, collider, x, z, paddingMeters);
  }

  if (!isPlanarPositionInsideCollider(collider, x, z, paddingMeters)) {
    return null;
  }

  return createSurfaceSupportSnapshot({
    collider,
    config,
    detailId: "box",
    stepEligible: true,
    supportHeightMeters: collider.translation.y + collider.halfExtents.y,
    supportKind: "box",
    supportNormal: freezeVector3(0, 1, 0)
  });
}

function shouldPreferSupportCandidate(
  candidate: MetaverseWorldSurfaceSupportSnapshot,
  selectedCandidate: MetaverseWorldSurfaceSupportSnapshot | null
): boolean {
  if (!candidate.walkable) {
    return false;
  }

  if (selectedCandidate === null) {
    return true;
  }

  if (
    candidate.supportHeightMeters >
    selectedCandidate.supportHeightMeters + automaticSurfaceBlockingHeightToleranceMeters
  ) {
    return true;
  }

  if (
    Math.abs(candidate.supportHeightMeters - selectedCandidate.supportHeightMeters) <=
      automaticSurfaceBlockingHeightToleranceMeters &&
    candidate.confidence > selectedCandidate.confidence
  ) {
    return true;
  }

  return false;
}

function resolveSurfaceSupportCandidate(
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  config: MetaverseWorldSurfacePolicyConfig,
  x: number,
  z: number,
  paddingMeters = 0,
  excludedOwnerEnvironmentAssetId: string | null = null,
  maxSupportHeightMeters: number | null = null,
  preferredSupport: MetaverseWorldSurfaceSupportSnapshot | null = null
): MetaverseWorldSurfaceSupportSnapshot | null {
  let selectedCandidate: MetaverseWorldSurfaceSupportSnapshot | null = null;

  for (const collider of surfaceColliderSnapshots) {
    if (collider.traversalAffordance !== "support") {
      continue;
    }

    if (
      excludedOwnerEnvironmentAssetId !== null &&
      collider.ownerEnvironmentAssetId === excludedOwnerEnvironmentAssetId
    ) {
      continue;
    }

    const candidate = resolveColliderSupportCandidate(
      config,
      collider,
      x,
      z,
      paddingMeters
    );

    if (candidate === null || !candidate.walkable) {
      continue;
    }

    if (
      maxSupportHeightMeters !== null &&
      candidate.supportHeightMeters >
        maxSupportHeightMeters + automaticSurfaceBlockingHeightToleranceMeters
    ) {
      continue;
    }

    if (
      preferredSupport?.supportId === candidate.supportId &&
      selectedCandidate === null
    ) {
      selectedCandidate = candidate;
      continue;
    }

    if (shouldPreferSupportCandidate(candidate, selectedCandidate)) {
      selectedCandidate = candidate;
    }
  }

  return selectedCandidate;
}

function resolveSurfaceSupportHeightMeters(
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  config: MetaverseWorldSurfacePolicyConfig,
  x: number,
  z: number,
  paddingMeters = 0,
  excludedOwnerEnvironmentAssetId: string | null = null,
  maxSupportHeightMeters: number | null = null,
  preferredSupport: MetaverseWorldSurfaceSupportSnapshot | null = null
): number | null {
  return (
    resolveSurfaceSupportCandidate(
      surfaceColliderSnapshots,
      config,
      x,
      z,
      paddingMeters,
      excludedOwnerEnvironmentAssetId,
      maxSupportHeightMeters,
      preferredSupport
    )?.supportHeightMeters ?? null
  );
}

function isPlanarPositionBlocked(
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  x: number,
  z: number,
  paddingMeters: number,
  minHeightMeters: number,
  maxHeightMeters: number,
  excludedOwnerEnvironmentAssetId: string | null = null,
  groundedSupportObstacleConfig: GroundedSupportObstacleConfig | null = null
): boolean {
  for (const collider of surfaceColliderSnapshots) {
    if (
      collider.traversalAffordance !== "blocker" &&
      collider.traversalAffordance !== "support"
    ) {
      continue;
    }

    if (
      excludedOwnerEnvironmentAssetId !== null &&
      collider.ownerEnvironmentAssetId === excludedOwnerEnvironmentAssetId
    ) {
      continue;
    }

    const blockerMinHeightMeters =
      collider.translation.y - collider.halfExtents.y;
    const blockerMaxHeightMeters =
      collider.translation.y + collider.halfExtents.y;

    if (collider.traversalAffordance === "support") {
      if (
        groundedSupportObstacleConfig === null ||
        collider.shape === "heightfield" ||
        collider.shape === "trimesh"
      ) {
        continue;
      }

      if (
        blockerMaxHeightMeters <=
        groundedSupportObstacleConfig.currentRootHeightMeters +
          groundedSupportObstacleConfig.maxStepRiseMeters
      ) {
        continue;
      }

      const maxRootHeightMeters = Math.max(
        groundedSupportObstacleConfig.currentRootHeightMeters,
        groundedSupportObstacleConfig.nextRootHeightMeters
      );
      const risingTowardSupport =
        groundedSupportObstacleConfig.nextRootHeightMeters >
        groundedSupportObstacleConfig.currentRootHeightMeters +
          automaticSurfaceBlockingHeightToleranceMeters;
      const clearanceHeightMeters =
        maxRootHeightMeters +
        (risingTowardSupport
          ? groundedSupportObstacleConfig.maxStepRiseMeters
          : 0);

      if (
        clearanceHeightMeters >=
        blockerMaxHeightMeters - automaticSurfaceBlockingHeightToleranceMeters
      ) {
        continue;
      }
    }

    if (
      blockerMaxHeightMeters < minHeightMeters ||
      blockerMinHeightMeters > maxHeightMeters
    ) {
      continue;
    }

    const blocked =
      collider.shape === "trimesh"
        ? isPlanarPositionBlockedByTriMeshCollider(
            collider,
            x,
            z,
            paddingMeters,
            minHeightMeters,
            maxHeightMeters
          )
        : isPlanarPositionInsideCollider(collider, x, z, paddingMeters);

    if (!blocked) {
      continue;
    }

    if (
      shouldIgnoreGroundedTerrainPatchSubsurfaceBlocker(
        surfaceColliderSnapshots,
        collider,
        x,
        z,
        paddingMeters,
        excludedOwnerEnvironmentAssetId,
        groundedSupportObstacleConfig
      )
    ) {
      continue;
    }

    return true;
  }

  return false;
}

function shouldIgnoreGroundedTerrainPatchSubsurfaceBlocker(
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot,
  x: number,
  z: number,
  paddingMeters: number,
  excludedOwnerEnvironmentAssetId: string | null,
  groundedSupportObstacleConfig: GroundedSupportObstacleConfig | null
): boolean {
  if (
    groundedSupportObstacleConfig === null ||
    groundedSupportObstacleConfig.surfacePolicyConfig === undefined ||
    collider.ownerKind !== "terrain-patch" ||
    collider.shape !== "trimesh" ||
    collider.traversalAffordance !== "blocker"
  ) {
    return false;
  }

  const maxSupportRiseMeters =
    groundedSupportObstacleConfig.maxSupportRiseMeters ??
    groundedSupportObstacleConfig.maxStepRiseMeters;
  const supportCandidate = resolveSurfaceSupportCandidate(
    surfaceColliderSnapshots,
    groundedSupportObstacleConfig.surfacePolicyConfig,
    x,
    z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId,
    groundedSupportObstacleConfig.currentRootHeightMeters +
      maxSupportRiseMeters
  );

  return (
    supportCandidate !== null &&
    supportCandidate.supportKind === "heightfield" &&
    supportCandidate.supportHeightMeters <=
      groundedSupportObstacleConfig.currentRootHeightMeters +
        maxSupportRiseMeters +
        automaticSurfaceBlockingHeightToleranceMeters
  );
}

function resolveAutomaticSurfaceProbeSupport(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  x: number,
  z: number,
  paddingMeters = 0,
  excludedOwnerEnvironmentAssetId: string | null = null,
  maxStepSupportHeightMeters: number | null = null
): AutomaticSurfaceProbeSupportSnapshot {
  let highestStepSupport: MetaverseWorldSurfaceSupportSnapshot | null = null;
  let highestSupport: MetaverseWorldSurfaceSupportSnapshot | null = null;
  const highestStepRiseAboveWaterMeters =
    config.stepHeightMeters + automaticSurfaceStepHeightLeewayMeters;
  const localWaterSurfaceHeightMeters =
    resolveMetaverseWorldWaterSurfaceHeightMeters(
      waterRegionSnapshots,
      x,
      z,
      paddingMeters
    );

  for (const collider of surfaceColliderSnapshots) {
    if (collider.traversalAffordance !== "support") {
      continue;
    }

    if (
      excludedOwnerEnvironmentAssetId !== null &&
      collider.ownerEnvironmentAssetId === excludedOwnerEnvironmentAssetId
    ) {
      continue;
    }

    const supportCandidate = resolveColliderSupportCandidate(
      config,
      collider,
      x,
      z,
      paddingMeters
    );

    if (supportCandidate === null || !supportCandidate.walkable) {
      continue;
    }

    const surfaceY = supportCandidate.supportHeightMeters;

    if (localWaterSurfaceHeightMeters === null) {
      if (
        highestSupport === null ||
        shouldPreferSupportCandidate(supportCandidate, highestSupport)
      ) {
        highestSupport = supportCandidate;
      }

      if (
        (maxStepSupportHeightMeters === null ||
          surfaceY <=
            maxStepSupportHeightMeters +
              automaticSurfaceBlockingHeightToleranceMeters) &&
        (highestStepSupport === null ||
          shouldPreferSupportCandidate(supportCandidate, highestStepSupport))
      ) {
        highestStepSupport = supportCandidate;
      }

      continue;
    }

    const riseAboveWaterMeters = surfaceY - localWaterSurfaceHeightMeters;

    if (
      riseAboveWaterMeters >
      metaverseWorldAutomaticSurfaceWaterlineThresholdMeters
    ) {
      if (
        highestSupport === null ||
        shouldPreferSupportCandidate(supportCandidate, highestSupport)
      ) {
        highestSupport = supportCandidate;
      }

      if (
        riseAboveWaterMeters <= highestStepRiseAboveWaterMeters &&
        (maxStepSupportHeightMeters === null ||
          surfaceY <=
            maxStepSupportHeightMeters +
              automaticSurfaceBlockingHeightToleranceMeters) &&
        (highestStepSupport === null ||
          shouldPreferSupportCandidate(supportCandidate, highestStepSupport))
      ) {
        highestStepSupport = supportCandidate;
      }
    }
  }

  return {
    stepSupport: highestStepSupport,
    stepSupportHeightMeters: highestStepSupport?.supportHeightMeters ?? null,
    support: highestSupport,
    supportHeightMeters: highestSupport?.supportHeightMeters ?? null
  };
}

function hasBlockingSupport(
  probeSupport: AutomaticSurfaceProbeSupportSnapshot
): boolean {
  return (
    probeSupport.supportHeightMeters !== null &&
    (probeSupport.stepSupportHeightMeters === null ||
      probeSupport.supportHeightMeters >
        probeSupport.stepSupportHeightMeters +
          automaticSurfaceBlockingHeightToleranceMeters)
  );
}

function sampleAutomaticSurfaceSupport(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  position: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number,
  paddingMeters: number,
  excludedOwnerEnvironmentAssetId: string | null = null,
  maxStepSupportHeightMeters: number | null = null
): AutomaticSurfaceSupportSnapshot {
  const probeForwardDistanceMeters =
    config.capsuleRadiusMeters * automaticSurfaceProbeForwardDistanceFactor;
  const probeLateralDistanceMeters =
    config.capsuleRadiusMeters * automaticSurfaceProbeLateralDistanceFactor;
  const centerProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position.x,
    position.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId,
    maxStepSupportHeightMeters
  );
  const forwardProbeOffset = resolvePlanarProbeOffset(
    probeForwardDistanceMeters,
    0,
    yawRadians
  );
  const forwardProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position.x + forwardProbeOffset.x,
    position.z + forwardProbeOffset.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId,
    maxStepSupportHeightMeters
  );
  const forwardLeftProbeOffset = resolvePlanarProbeOffset(
    probeForwardDistanceMeters * 0.72,
    -probeLateralDistanceMeters,
    yawRadians
  );
  const forwardLeftProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position.x + forwardLeftProbeOffset.x,
    position.z + forwardLeftProbeOffset.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId,
    maxStepSupportHeightMeters
  );
  const forwardRightProbeOffset = resolvePlanarProbeOffset(
    probeForwardDistanceMeters * 0.72,
    probeLateralDistanceMeters,
    yawRadians
  );
  const forwardRightProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position.x + forwardRightProbeOffset.x,
    position.z + forwardRightProbeOffset.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId,
    maxStepSupportHeightMeters
  );
  const rearProbeOffset = resolvePlanarProbeOffset(
    -probeForwardDistanceMeters * 0.48,
    0,
    yawRadians
  );
  const rearProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position.x + rearProbeOffset.x,
    position.z + rearProbeOffset.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId,
    maxStepSupportHeightMeters
  );
  let highestStepSupportHeightMeters: number | null = null;
  let highestStepSupport: MetaverseWorldSurfaceSupportSnapshot | null = null;
  let highestSupport: MetaverseWorldSurfaceSupportSnapshot | null = null;
  let stepSupportedProbeCount = 0;

  for (const probeSupport of [
    centerProbeSupport,
    forwardProbeSupport,
    forwardLeftProbeSupport,
    forwardRightProbeSupport,
    rearProbeSupport
  ]) {
    if (
      probeSupport.support !== null &&
      (highestSupport === null ||
        shouldPreferSupportCandidate(probeSupport.support, highestSupport))
    ) {
      highestSupport = probeSupport.support;
    }

    if (probeSupport.stepSupportHeightMeters === null) {
      continue;
    }

    stepSupportedProbeCount += 1;

    if (
      highestStepSupportHeightMeters === null ||
      probeSupport.stepSupportHeightMeters > highestStepSupportHeightMeters
    ) {
      highestStepSupportHeightMeters = probeSupport.stepSupportHeightMeters;
      highestStepSupport = probeSupport.stepSupport;
    }
  }

  return {
    centerStepBlocked: hasBlockingSupport(centerProbeSupport),
    centerStepSupport: centerProbeSupport.stepSupport,
    centerStepSupportHeightMeters: centerProbeSupport.stepSupportHeightMeters,
    forwardStepBlocked: hasBlockingSupport(forwardProbeSupport),
    forwardStepSupport: forwardProbeSupport.stepSupport,
    forwardStepSupportHeightMeters: forwardProbeSupport.stepSupportHeightMeters,
    highestStepSupport,
    highestStepSupportHeightMeters,
    highestSupport,
    stepSupportedProbeCount
  };
}

export function resolveMetaverseWorldSurfaceHeightMeters(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  x: number,
  z: number,
  excludedOwnerEnvironmentAssetId: string | null = null,
  maxSupportHeightMeters: number | null = null,
  preferredSupport: MetaverseWorldSurfaceSupportSnapshot | null = null
): number | null {
  const supportHeightMeters = resolveSurfaceSupportHeightMeters(
    surfaceColliderSnapshots,
    config,
    x,
    z,
    config.capsuleRadiusMeters,
    excludedOwnerEnvironmentAssetId,
    maxSupportHeightMeters,
    preferredSupport
  );
  const waterSurfaceHeightMeters = resolveMetaverseWorldWaterSurfaceHeightMeters(
    waterRegionSnapshots,
    x,
    z,
    config.capsuleRadiusMeters
  );

  if (
    supportHeightMeters !== null &&
    waterSurfaceHeightMeters !== null
  ) {
    return Math.max(waterSurfaceHeightMeters, supportHeightMeters);
  }

  return supportHeightMeters ?? waterSurfaceHeightMeters;
}

export function resolveMetaverseWorldSurfaceSupportSnapshot(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  x: number,
  z: number,
  paddingMeters = config.capsuleRadiusMeters,
  excludedOwnerEnvironmentAssetId: string | null = null,
  maxSupportHeightMeters: number | null = null,
  preferredSupport: MetaverseWorldSurfaceSupportSnapshot | null = null
): MetaverseWorldSurfaceSupportSnapshot | null {
  return resolveSurfaceSupportCandidate(
    surfaceColliderSnapshots,
    config,
    x,
    z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId,
    maxSupportHeightMeters,
    preferredSupport
  );
}

export function constrainMetaverseWorldPlanarPositionAgainstBlockers(
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  currentPosition: MetaverseWorldSurfaceVector3Snapshot,
  nextPosition: MetaverseWorldSurfaceVector3Snapshot,
  paddingMeters: number,
  minHeightMeters: number,
  maxHeightMeters: number,
  excludedOwnerEnvironmentAssetId: string | null = null,
  groundedSupportObstacleConfig: GroundedSupportObstacleConfig | null = null
): MetaverseWorldSurfaceVector3Snapshot {
  if (
    !isPlanarPositionBlocked(
      surfaceColliderSnapshots,
      nextPosition.x,
      nextPosition.z,
      paddingMeters,
      minHeightMeters,
      maxHeightMeters,
      excludedOwnerEnvironmentAssetId,
      groundedSupportObstacleConfig
    )
  ) {
    return freezeVector3(nextPosition.x, nextPosition.y, nextPosition.z);
  }

  const deltaX = nextPosition.x - currentPosition.x;
  const deltaZ = nextPosition.z - currentPosition.z;
  const axisOrder =
    Math.abs(deltaX) >= Math.abs(deltaZ)
      ? (["x", "z"] as const)
      : (["z", "x"] as const);
  let constrainedPosition = freezeVector3(
    currentPosition.x,
    nextPosition.y,
    currentPosition.z
  );

  for (const axis of axisOrder) {
    const candidate =
      axis === "x"
        ? freezeVector3(nextPosition.x, nextPosition.y, constrainedPosition.z)
        : freezeVector3(constrainedPosition.x, nextPosition.y, nextPosition.z);

    if (
      isPlanarPositionBlocked(
        surfaceColliderSnapshots,
        candidate.x,
        candidate.z,
        paddingMeters,
        minHeightMeters,
        maxHeightMeters,
        excludedOwnerEnvironmentAssetId,
        groundedSupportObstacleConfig
      )
    ) {
      continue;
    }

    constrainedPosition = candidate;
  }

  return constrainedPosition;
}

export function resolveMetaverseWorldGroundedAutostepHeightMeters(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  position: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number,
  moveAxis: number,
  strafeAxis: number,
  verticalSpeedUnitsPerSecond = 0,
  jumpRequested = false,
  excludedOwnerEnvironmentAssetId: string | null = null
): number | null {
  const clampedMoveAxis = clamp(toFiniteNumber(moveAxis, 0), -1, 1);
  const clampedStrafeAxis = clamp(toFiniteNumber(strafeAxis, 0), -1, 1);
  const inputMagnitude = Math.hypot(clampedMoveAxis, clampedStrafeAxis);

  if (inputMagnitude <= 0.0001) {
    return null;
  }

  if (
    jumpRequested ||
    toFiniteNumber(verticalSpeedUnitsPerSecond, 0) >
      automaticSurfaceBlockingHeightToleranceMeters
  ) {
    return null;
  }

  const normalizedMoveAxis = clampedMoveAxis / inputMagnitude;
  const normalizedStrafeAxis = clampedStrafeAxis / inputMagnitude;
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);
  const movementDirectionX =
    forwardX * normalizedMoveAxis + rightX * normalizedStrafeAxis;
  const movementDirectionZ =
    forwardZ * normalizedMoveAxis + rightZ * normalizedStrafeAxis;
  const movementYawRadians = Math.atan2(movementDirectionX, -movementDirectionZ);
  const currentSupportHeightMeters = position.y;
  const maxEligibleStepRiseMeters =
    config.stepHeightMeters + automaticSurfaceStepHeightLeewayMeters;
  const maxStepSupportHeightMeters =
    currentSupportHeightMeters + maxEligibleStepRiseMeters;
  const probeForwardDistanceMeters =
    config.capsuleRadiusMeters * automaticSurfaceProbeForwardDistanceFactor;
  const probeLateralDistanceMeters =
    config.capsuleRadiusMeters * automaticSurfaceProbeLateralDistanceFactor;
  let highestEligibleStepRiseMeters: number | null = null;

  for (const probeOffset of [
    resolvePlanarProbeOffset(probeForwardDistanceMeters, 0, movementYawRadians),
    resolvePlanarProbeOffset(
      probeForwardDistanceMeters * 0.72,
      -probeLateralDistanceMeters,
      movementYawRadians
    ),
    resolvePlanarProbeOffset(
      probeForwardDistanceMeters * 0.72,
      probeLateralDistanceMeters,
      movementYawRadians
    )
  ]) {
    const supportHeightMeters = resolveSurfaceSupportHeightMeters(
      surfaceColliderSnapshots,
      config,
      position.x + probeOffset.x,
      position.z + probeOffset.z,
      0,
      excludedOwnerEnvironmentAssetId,
      maxStepSupportHeightMeters
    );

    if (supportHeightMeters === null) {
      continue;
    }

    const supportRiseMeters = supportHeightMeters - currentSupportHeightMeters;

    if (
      supportRiseMeters > automaticSurfaceBlockingHeightToleranceMeters &&
      supportRiseMeters <= maxEligibleStepRiseMeters &&
      (highestEligibleStepRiseMeters === null ||
        supportRiseMeters > highestEligibleStepRiseMeters)
    ) {
      highestEligibleStepRiseMeters = supportRiseMeters;
    }
  }

  return highestEligibleStepRiseMeters === null
    ? null
    : Math.max(config.stepHeightMeters, highestEligibleStepRiseMeters);
}

export function resolveMetaverseWorldAutomaticSurfaceLocomotion(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  position: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number,
  currentLocomotionMode: "grounded" | "swim",
  excludedOwnerEnvironmentAssetId: string | null = null,
  preferredSupport: MetaverseWorldSurfaceSupportSnapshot | null = null
): MetaverseWorldAutomaticSurfaceLocomotionSnapshot {
  const supportSnapshot = sampleAutomaticSurfaceSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position,
    yawRadians,
    currentLocomotionMode === "grounded"
      ? config.capsuleRadiusMeters * automaticSurfaceGroundedHoldPaddingFactor
      : 0,
    excludedOwnerEnvironmentAssetId,
    currentLocomotionMode === "grounded"
      ? position.y +
          config.stepHeightMeters +
          automaticSurfaceStepHeightLeewayMeters
      : null
  );
  const resolvedSupport = resolveMetaverseWorldSurfaceSupportSnapshot(
    config,
    surfaceColliderSnapshots,
    position.x,
    position.z,
    config.capsuleRadiusMeters,
    excludedOwnerEnvironmentAssetId,
    position.y,
    preferredSupport
  );
  const resolvedSupportHeightMeters =
    resolvedSupport?.supportHeightMeters ??
    resolveMetaverseWorldWaterSurfaceHeightMeters(
      waterRegionSnapshots,
      position.x,
      position.z,
      config.capsuleRadiusMeters
    ) ??
    position.y;
  const waterbornePosition = isMetaverseWorldWaterbornePosition(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position,
    0,
    excludedOwnerEnvironmentAssetId
  );

  if (currentLocomotionMode === "grounded") {
    const shouldStayGrounded =
      supportSnapshot.centerStepSupportHeightMeters !== null ||
      supportSnapshot.stepSupportedProbeCount >=
        automaticSurfaceGroundedHoldProbeCount ||
      !waterbornePosition;
    const decision = shouldStayGrounded
      ? Object.freeze({
          locomotionMode: "grounded",
          support:
            supportSnapshot.centerStepSupport ??
            supportSnapshot.highestStepSupport ??
            resolvedSupport,
          supportHeightMeters:
            supportSnapshot.centerStepSupportHeightMeters ??
            supportSnapshot.highestStepSupportHeightMeters ??
            resolvedSupportHeightMeters
        } satisfies MetaverseWorldSurfaceLocomotionDecision)
      : Object.freeze({
          locomotionMode: "swim",
          support: null,
          supportHeightMeters: null
        } satisfies MetaverseWorldSurfaceLocomotionDecision);

    return Object.freeze({
      debug: Object.freeze({
        blockerOverlap: false,
        centerStepBlocked: supportSnapshot.centerStepBlocked,
        centerStepSupportHeightMeters:
          supportSnapshot.centerStepSupportHeightMeters,
        forwardStepBlocked: supportSnapshot.forwardStepBlocked,
        forwardStepSupportHeightMeters:
          supportSnapshot.forwardStepSupportHeightMeters,
        reason: shouldStayGrounded ? "grounded-hold" : "water-entry",
        resolvedSupportHeightMeters,
        stepSupportedProbeCount: supportSnapshot.stepSupportedProbeCount
      }),
      decision
    });
  }

  const canExitWater =
    supportSnapshot.centerStepSupportHeightMeters !== null &&
    !supportSnapshot.centerStepBlocked &&
    supportSnapshot.forwardStepSupportHeightMeters !== null &&
    !supportSnapshot.forwardStepBlocked &&
    supportSnapshot.stepSupportedProbeCount >= automaticSurfaceExitSupportProbeCount;
  const decision = canExitWater
    ? Object.freeze({
        locomotionMode: "grounded",
        support:
          supportSnapshot.centerStepSupport ??
          supportSnapshot.highestStepSupport,
        supportHeightMeters:
          supportSnapshot.centerStepSupportHeightMeters ??
          supportSnapshot.highestStepSupportHeightMeters
      } satisfies MetaverseWorldSurfaceLocomotionDecision)
    : Object.freeze({
        locomotionMode: "swim",
        support: null,
        supportHeightMeters: null
      } satisfies MetaverseWorldSurfaceLocomotionDecision);

  return Object.freeze({
    debug: Object.freeze({
      blockerOverlap:
        supportSnapshot.centerStepBlocked || supportSnapshot.forwardStepBlocked,
      centerStepBlocked: supportSnapshot.centerStepBlocked,
      centerStepSupportHeightMeters: supportSnapshot.centerStepSupportHeightMeters,
      forwardStepBlocked: supportSnapshot.forwardStepBlocked,
      forwardStepSupportHeightMeters:
        supportSnapshot.forwardStepSupportHeightMeters,
      reason: canExitWater
        ? "shoreline-exit-success"
        : "shoreline-exit-blocked",
      resolvedSupportHeightMeters,
      stepSupportedProbeCount: supportSnapshot.stepSupportedProbeCount
    }),
    decision
  });
}

export function isMetaverseWorldWaterbornePosition(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  position: MetaverseWorldSurfaceVector3Snapshot,
  paddingMeters = 0,
  excludedOwnerEnvironmentAssetId: string | null = null
): boolean {
  const waterSurfaceHeightMeters = resolveMetaverseWorldWaterSurfaceHeightMeters(
    waterRegionSnapshots,
    position.x,
    position.z,
    paddingMeters
  );

  if (
    waterSurfaceHeightMeters === null
  ) {
    return false;
  }

  const supportHeight = resolveSurfaceSupportHeightMeters(
    surfaceColliderSnapshots,
    config,
    position.x,
    position.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId
  );

  return (
    supportHeight === null ||
    supportHeight <=
      waterSurfaceHeightMeters +
        metaverseWorldAutomaticSurfaceWaterlineThresholdMeters
  );
}
