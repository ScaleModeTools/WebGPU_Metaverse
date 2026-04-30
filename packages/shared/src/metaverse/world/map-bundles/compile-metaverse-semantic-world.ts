import {
  resolveMetaverseWorldPlacedSurfaceColliders,
  resolveMetaverseWorldSurfaceScaleVector,
  type MetaverseWorldSurfaceScaleSnapshot,
  type MetaverseWorldSurfaceVector3Snapshot
} from "../../metaverse-world-surface-query.js";
import type {
  MetaverseMapBundleCompiledCollisionBoxSnapshot,
  MetaverseMapBundleCompiledCollisionHeightfieldSnapshot,
  MetaverseMapBundleCompiledCollisionTriMeshSnapshot,
  MetaverseMapBundleCompiledWorldChunkBoundsSnapshot,
  MetaverseMapBundleCompiledWorldChunkSnapshot,
  MetaverseMapBundleCompiledWorldSnapshot,
  MetaverseMapBundleEnvironmentAssetSnapshot,
  MetaverseMapBundlePlacementSnapshot,
  MetaverseMapBundleSemanticConnectorSnapshot,
  MetaverseMapBundleSemanticEdgeSnapshot,
  MetaverseMapBundleSemanticGameplayVolumeSnapshot,
  MetaverseMapBundleSemanticLightSnapshot,
  MetaverseMapBundleSemanticModuleSnapshot,
  MetaverseMapBundleSemanticPlanarPointSnapshot,
  MetaverseMapBundleSemanticRegionSnapshot,
  MetaverseMapBundleSemanticStructureSnapshot,
  MetaverseMapBundleSemanticSurfaceSnapshot,
  MetaverseMapBundleSemanticTerrainPatchSnapshot,
  MetaverseMapBundleSemanticWorldSnapshot
} from "./metaverse-map-bundle.js";
import {
  createMetaverseMapBundleSemanticRegionSurfaceMesh,
  isMetaverseMapBundleSemanticRegionFlatLocalRectangle,
  resolveMetaverseMapBundleSemanticRegionLoopBounds,
  resolveMetaverseMapBundleSemanticSurfaceLocalHeightMeters
} from "./resolve-metaverse-map-bundle-semantic-surface-mesh.js";

const defaultCompiledChunkSizeMeters = 24;
const semanticFloorFootprint = Object.freeze({
  x: 4,
  y: 0.5,
  z: 4
});
const semanticWallFootprint = Object.freeze({
  x: 4,
  y: 4,
  z: 0.5
});
const semanticConnectorFootprint = Object.freeze({
  x: 4,
  y: 1,
  z: 4
});
const terrainPatchCollisionHeightEpsilonMeters = 0.001;
const terrainPatchSubsurfaceBlockerCeilingInsetMeters = 0.035;

function freezeVector3(
  x: number,
  y: number,
  z: number
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({ x, y, z });
}

function freezePlacementScale(
  scale: MetaverseWorldSurfaceScaleSnapshot
): MetaverseWorldSurfaceVector3Snapshot {
  const resolved = resolveMetaverseWorldSurfaceScaleVector(scale);

  return Object.freeze({
    x: Math.max(0.1, resolved.x),
    y: Math.max(0.1, resolved.y),
    z: Math.max(0.1, resolved.z)
  });
}

function createEnvironmentPlacement(
  placementId: string,
  position: MetaverseWorldSurfaceVector3Snapshot,
  rotationYRadians: number,
  scale: MetaverseWorldSurfaceScaleSnapshot,
  notes = "",
  materialReferenceId: string | null = null
): MetaverseMapBundlePlacementSnapshot {
  return Object.freeze({
    collisionEnabled: true,
    isVisible: true,
    materialReferenceId,
    notes,
    placementId,
    position: freezeVector3(position.x, position.y, position.z),
    rotationYRadians,
    scale: freezePlacementScale(scale)
  });
}

function ensureEnvironmentAssetGroup(
  environmentAssetsById: Map<string, MetaverseMapBundleEnvironmentAssetSnapshot>,
  seed: Omit<MetaverseMapBundleEnvironmentAssetSnapshot, "placements">,
  placements: readonly MetaverseMapBundlePlacementSnapshot[]
): void {
  const existingAsset = environmentAssetsById.get(seed.assetId) ?? null;

  if (existingAsset === null) {
    environmentAssetsById.set(
      seed.assetId,
      Object.freeze({
        ...seed,
        placements: Object.freeze([...placements])
      })
    );
    return;
  }

  environmentAssetsById.set(
    seed.assetId,
    Object.freeze({
      ...existingAsset,
      placements: Object.freeze([...existingAsset.placements, ...placements])
    })
  );
}

function resolveChunkIndex(value: number, chunkSizeMeters: number): number {
  return Math.floor(value / chunkSizeMeters);
}

function createChunkId(
  x: number,
  z: number,
  chunkSizeMeters: number
): string {
  return `chunk:${resolveChunkIndex(x, chunkSizeMeters)}:${resolveChunkIndex(
    z,
    chunkSizeMeters
  )}`;
}

function resolveChunkCenterFromId(
  chunkId: string,
  chunkSizeMeters: number
): MetaverseWorldSurfaceVector3Snapshot {
  const [, rawX = "0", rawZ = "0"] = chunkId.split(":");
  const chunkX = Number.parseInt(rawX, 10) || 0;
  const chunkZ = Number.parseInt(rawZ, 10) || 0;

  return freezeVector3(
    (chunkX + 0.5) * chunkSizeMeters,
    0,
    (chunkZ + 0.5) * chunkSizeMeters
  );
}

function createChunkBounds(
  chunkId: string,
  chunkSizeMeters: number
): MetaverseMapBundleCompiledWorldChunkBoundsSnapshot {
  return Object.freeze({
    center: resolveChunkCenterFromId(chunkId, chunkSizeMeters),
    size: freezeVector3(chunkSizeMeters, chunkSizeMeters, chunkSizeMeters)
  });
}

function applyYawToPlanarPoint(
  point: MetaverseMapBundleSemanticPlanarPointSnapshot,
  yawRadians: number
): MetaverseMapBundleSemanticPlanarPointSnapshot {
  const sine = Math.sin(yawRadians);
  const cosine = Math.cos(yawRadians);

  return Object.freeze({
    x: point.x * cosine + point.z * sine,
    z: -point.x * sine + point.z * cosine
  });
}

function resolveLoopBounds(
  region: MetaverseMapBundleSemanticRegionSnapshot,
  surface: MetaverseMapBundleSemanticSurfaceSnapshot
): {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
} {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of region.outerLoop.points) {
    const worldPoint = applyYawToPlanarPoint(point, surface.rotationYRadians);
    const localHeight = resolveMetaverseMapBundleSemanticSurfaceLocalHeightMeters(
      surface,
      point.x,
      point.z
    );

    minX = Math.min(minX, surface.center.x + worldPoint.x);
    maxX = Math.max(maxX, surface.center.x + worldPoint.x);
    minY = Math.min(minY, surface.elevation + localHeight);
    maxY = Math.max(maxY, surface.elevation + localHeight);
    minZ = Math.min(minZ, surface.center.z + worldPoint.z);
    maxZ = Math.max(maxZ, surface.center.z + worldPoint.z);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(minZ)) {
    return Object.freeze({
      center: freezeVector3(surface.center.x, surface.elevation, surface.center.z),
      size: freezeVector3(
        surface.size.x,
        Math.max(0.5, surface.size.y),
        surface.size.z
      )
    });
  }

  return Object.freeze({
    center: freezeVector3(
      (minX + maxX) * 0.5,
      (minY + maxY) * 0.5,
      (minZ + maxZ) * 0.5
    ),
    size: freezeVector3(
      Math.max(0.5, maxX - minX),
      Math.max(0.5, maxY - minY),
      Math.max(0.5, maxZ - minZ)
    )
  });
}

function resolveEdgeSegmentBounds(
  startPoint: MetaverseMapBundleSemanticPlanarPointSnapshot,
  endPoint: MetaverseMapBundleSemanticPlanarPointSnapshot,
  edge: Pick<MetaverseMapBundleSemanticEdgeSnapshot, "heightMeters">,
  surface: Pick<
    MetaverseMapBundleSemanticSurfaceSnapshot,
    "center" | "elevation" | "rotationYRadians"
  >
): {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly lengthMeters: number;
  readonly rotationYRadians: number;
} {
  const deltaX = endPoint.x - startPoint.x;
  const deltaZ = endPoint.z - startPoint.z;
  const midPoint = Object.freeze({
    x: (startPoint.x + endPoint.x) * 0.5,
    z: (startPoint.z + endPoint.z) * 0.5
  });
  const worldMidPoint = applyYawToPlanarPoint(midPoint, surface.rotationYRadians);

  return Object.freeze({
    center: freezeVector3(
      surface.center.x + worldMidPoint.x,
      surface.elevation + edge.heightMeters * 0.5,
      surface.center.z + worldMidPoint.z
    ),
    lengthMeters: Math.max(0.5, Math.hypot(deltaX, deltaZ)),
    rotationYRadians:
      surface.rotationYRadians + Math.atan2(deltaX, deltaZ) - Math.PI * 0.5
  });
}

function resolveTerrainPatchSampleHeight(
  terrainPatch: Pick<
    MetaverseMapBundleSemanticTerrainPatchSnapshot,
    "heightSamples" | "sampleCountX"
  >,
  sampleX: number,
  sampleZ: number
): number {
  return terrainPatch.heightSamples[sampleZ * terrainPatch.sampleCountX + sampleX] ?? 0;
}

function resolveTerrainPatchSupportHeightMeters(
  terrainPatch: Pick<
    MetaverseMapBundleSemanticTerrainPatchSnapshot,
    | "heightSamples"
    | "origin"
    | "rotationYRadians"
    | "sampleCountX"
    | "sampleCountZ"
    | "sampleSpacingMeters"
  >,
  x: number,
  z: number
): number | null {
  if (
    terrainPatch.sampleCountX < 2 ||
    terrainPatch.sampleCountZ < 2 ||
    terrainPatch.sampleSpacingMeters <= 0
  ) {
    return null;
  }

  const localPoint = applyYawToPlanarPoint(
    Object.freeze({
      x: x - terrainPatch.origin.x,
      z: z - terrainPatch.origin.z
    }),
    -terrainPatch.rotationYRadians
  );
  const halfX =
    (terrainPatch.sampleCountX - 1) * terrainPatch.sampleSpacingMeters * 0.5;
  const halfZ =
    (terrainPatch.sampleCountZ - 1) * terrainPatch.sampleSpacingMeters * 0.5;

  if (Math.abs(localPoint.x) > halfX || Math.abs(localPoint.z) > halfZ) {
    return null;
  }

  const sampleXFloat = Math.min(
    terrainPatch.sampleCountX - 1,
    Math.max(
      0,
      localPoint.x / terrainPatch.sampleSpacingMeters +
        (terrainPatch.sampleCountX - 1) * 0.5
    )
  );
  const sampleZFloat = Math.min(
    terrainPatch.sampleCountZ - 1,
    Math.max(
      0,
      localPoint.z / terrainPatch.sampleSpacingMeters +
        (terrainPatch.sampleCountZ - 1) * 0.5
    )
  );
  const cellX = Math.min(
    terrainPatch.sampleCountX - 2,
    Math.max(0, Math.floor(sampleXFloat))
  );
  const cellZ = Math.min(
    terrainPatch.sampleCountZ - 2,
    Math.max(0, Math.floor(sampleZFloat))
  );
  const localX = sampleXFloat - cellX;
  const localZ = sampleZFloat - cellZ;
  const topLeft = resolveTerrainPatchSampleHeight(terrainPatch, cellX, cellZ);
  const topRight = resolveTerrainPatchSampleHeight(
    terrainPatch,
    cellX + 1,
    cellZ
  );
  const bottomLeft = resolveTerrainPatchSampleHeight(
    terrainPatch,
    cellX,
    cellZ + 1
  );
  const bottomRight = resolveTerrainPatchSampleHeight(
    terrainPatch,
    cellX + 1,
    cellZ + 1
  );
  const localSurfaceY =
    localX + localZ <= 1
      ? topLeft +
        (topRight - topLeft) * localX +
        (bottomLeft - topLeft) * localZ
      : topRight * (1 - localZ) +
        bottomLeft * (1 - localX) +
        bottomRight * (localX + localZ - 1);

  return terrainPatch.origin.y + localSurfaceY;
}

function resolveMinimumTerrainHeightMetersWithinOrientedBounds(
  terrainPatch: Pick<
    MetaverseMapBundleSemanticTerrainPatchSnapshot,
    | "heightSamples"
    | "origin"
    | "rotationYRadians"
    | "sampleCountX"
    | "sampleCountZ"
    | "sampleSpacingMeters"
  >,
  bounds: {
    readonly center: MetaverseWorldSurfaceVector3Snapshot;
    readonly rotationYRadians: number;
    readonly size: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "z">;
  }
): number | null {
  const samplingStepMeters =
    terrainPatch.sampleSpacingMeters > 0
      ? Math.max(0.5, terrainPatch.sampleSpacingMeters * 0.5)
      : 1;
  const sampleCountX = Math.max(
    3,
    Math.min(15, Math.ceil(bounds.size.x / samplingStepMeters) + 1)
  );
  const sampleCountZ = Math.max(
    3,
    Math.min(7, Math.ceil(bounds.size.z / samplingStepMeters) + 1)
  );
  let minimumHeightMeters: number | null = null;

  for (let sampleXIndex = 0; sampleXIndex < sampleCountX; sampleXIndex += 1) {
    const sampleXFraction =
      sampleCountX <= 1 ? 0.5 : sampleXIndex / (sampleCountX - 1);
    const localX = (sampleXFraction - 0.5) * bounds.size.x;

    for (let sampleZIndex = 0; sampleZIndex < sampleCountZ; sampleZIndex += 1) {
      const sampleZFraction =
        sampleCountZ <= 1 ? 0.5 : sampleZIndex / (sampleCountZ - 1);
      const localZ = (sampleZFraction - 0.5) * bounds.size.z;
      const worldOffset = applyYawToPlanarPoint(
        Object.freeze({ x: localX, z: localZ }),
        bounds.rotationYRadians
      );
      const terrainHeightMeters = resolveTerrainPatchSupportHeightMeters(
        terrainPatch,
        bounds.center.x + worldOffset.x,
        bounds.center.z + worldOffset.z
      );

      if (terrainHeightMeters === null) {
        continue;
      }

      if (
        minimumHeightMeters === null ||
        terrainHeightMeters < minimumHeightMeters
      ) {
        minimumHeightMeters = terrainHeightMeters;
      }
    }
  }

  return minimumHeightMeters;
}

function extendCollisionBoxBottomToHeight(
  collisionBox: MetaverseMapBundleCompiledCollisionBoxSnapshot,
  bottomYMeters: number | null
): MetaverseMapBundleCompiledCollisionBoxSnapshot {
  if (bottomYMeters === null) {
    return collisionBox;
  }

  const currentBottomY = collisionBox.center.y - collisionBox.size.y * 0.5;

  if (bottomYMeters >= currentBottomY - 0.000001) {
    return collisionBox;
  }

  const currentTopY = collisionBox.center.y + collisionBox.size.y * 0.5;
  const nextHeightMeters = Math.max(0.5, currentTopY - bottomYMeters);

  return createCollisionBoxSnapshot(
    collisionBox.ownerId,
    collisionBox.ownerKind,
    freezeVector3(
      collisionBox.center.x,
      bottomYMeters + nextHeightMeters * 0.5,
      collisionBox.center.z
    ),
    freezeVector3(collisionBox.size.x, nextHeightMeters, collisionBox.size.z),
    collisionBox.rotationYRadians,
    collisionBox.traversalAffordance
  );
}

function createRegionSurfaceTriMesh(
  region: MetaverseMapBundleSemanticRegionSnapshot,
  surface: MetaverseMapBundleSemanticSurfaceSnapshot
): MetaverseMapBundleCompiledCollisionTriMeshSnapshot | null {
  const mesh = createMetaverseMapBundleSemanticRegionSurfaceMesh(region, surface);

  if (mesh === null) {
    return null;
  }

  return Object.freeze({
    indices: Object.freeze([...mesh.indices]),
    ownerId: region.regionId,
    ownerKind: "region",
    rotationYRadians: mesh.rotationYRadians,
    translation: mesh.translation,
    traversalAffordance: "support",
    vertices: Object.freeze([...mesh.vertices])
  });
}

function createCollisionBoxSnapshot(
  ownerId: string,
  ownerKind: MetaverseMapBundleCompiledCollisionBoxSnapshot["ownerKind"],
  center: MetaverseWorldSurfaceVector3Snapshot,
  size: MetaverseWorldSurfaceVector3Snapshot,
  rotationYRadians: number,
  traversalAffordance: MetaverseMapBundleCompiledCollisionBoxSnapshot["traversalAffordance"]
): MetaverseMapBundleCompiledCollisionBoxSnapshot {
  return Object.freeze({
    center,
    ownerId,
    ownerKind,
    rotationYRadians,
    size,
    traversalAffordance
  });
}

function resolveCollisionBoxBottomPlacementPosition(
  collisionBox: MetaverseMapBundleCompiledCollisionBoxSnapshot
): MetaverseWorldSurfaceVector3Snapshot {
  return freezeVector3(
    collisionBox.center.x,
    collisionBox.center.y - collisionBox.size.y * 0.5,
    collisionBox.center.z
  );
}

function createCompiledCollisionBoxesForPlacement(
  ownerId: string,
  ownerKind: MetaverseMapBundleCompiledCollisionBoxSnapshot["ownerKind"],
  environmentAssetId: string,
  placement: Pick<
    MetaverseMapBundlePlacementSnapshot,
    "position" | "rotationYRadians" | "scale"
  >,
  surfaceColliders: MetaverseMapBundleEnvironmentAssetSnapshot["surfaceColliders"]
): readonly MetaverseMapBundleCompiledCollisionBoxSnapshot[] {
  return Object.freeze(
    resolveMetaverseWorldPlacedSurfaceColliders({
      environmentAssetId,
      placements: Object.freeze([
        Object.freeze({
          position: placement.position,
          rotationYRadians: placement.rotationYRadians,
          scale: placement.scale
        })
      ]),
      surfaceColliders
    }).map((collider) =>
      createCollisionBoxSnapshot(
        ownerId,
        ownerKind,
        collider.translation,
        freezeVector3(
          Math.max(0.5, collider.halfExtents.x * 2),
          Math.max(0.5, collider.halfExtents.y * 2),
          Math.max(0.5, collider.halfExtents.z * 2)
        ),
        collider.rotationYRadians,
        collider.traversalAffordance
      )
    )
  );
}

function resolveSemanticStructureCollisionBox(
  structure: MetaverseMapBundleSemanticStructureSnapshot
): MetaverseMapBundleCompiledCollisionBoxSnapshot {
  return createCollisionBoxSnapshot(
    structure.structureId,
    "structure",
    freezeVector3(
      structure.center.x,
      structure.center.y + Math.max(0.05, structure.size.y) * 0.5,
      structure.center.z
    ),
    freezeVector3(
      Math.max(0.25, structure.size.x),
      Math.max(0.1, structure.size.y),
      Math.max(0.25, structure.size.z)
    ),
    structure.rotationYRadians,
    structure.traversalAffordance
  );
}

function resolveSemanticGameplayVolumeChunkId(
  volume: MetaverseMapBundleSemanticGameplayVolumeSnapshot,
  chunkSizeMeters: number
): string {
  const routePoint = volume.routePoints[0] ?? null;

  return routePoint === null
    ? createChunkId(volume.center.x, volume.center.z, chunkSizeMeters)
    : createChunkId(routePoint.x, routePoint.z, chunkSizeMeters);
}

function resolveSemanticLightChunkId(
  light: MetaverseMapBundleSemanticLightSnapshot,
  chunkSizeMeters: number
): string {
  return createChunkId(light.position.x, light.position.z, chunkSizeMeters);
}

function buildRegionCompatibilityPlacements(
  region: MetaverseMapBundleSemanticRegionSnapshot,
  surface: MetaverseMapBundleSemanticSurfaceSnapshot,
  compatibilityAssetId: string | null
): {
  readonly collisionBoxes: readonly MetaverseMapBundleCompiledCollisionBoxSnapshot[];
  readonly collisionTriMeshes:
    readonly MetaverseMapBundleCompiledCollisionTriMeshSnapshot[];
  readonly environmentAsset: MetaverseMapBundleEnvironmentAssetSnapshot | null;
  readonly chunkId: string;
} {
  const bounds = resolveLoopBounds(region, surface);
  const chunkId = createChunkId(
    bounds.center.x,
    bounds.center.z,
    defaultCompiledChunkSizeMeters
  );
  const flatLocalRectangle =
    region.regionKind !== "arena" &&
    isMetaverseMapBundleSemanticRegionFlatLocalRectangle(region, surface);
  const localBounds = resolveMetaverseMapBundleSemanticRegionLoopBounds(
    region.outerLoop
  );
  const localCenter =
    localBounds === null
      ? Object.freeze({ x: 0, z: 0 })
      : Object.freeze({
          x: (localBounds.minX + localBounds.maxX) * 0.5,
          z: (localBounds.minZ + localBounds.maxZ) * 0.5
        });
  const worldLocalCenter = applyYawToPlanarPoint(localCenter, surface.rotationYRadians);
  const supportThicknessMeters = Math.max(0.5, surface.size.y);
  const supportBox =
    flatLocalRectangle && localBounds !== null
      ? createCollisionBoxSnapshot(
          region.regionId,
          "region",
          freezeVector3(
            surface.center.x + worldLocalCenter.x,
            surface.elevation - supportThicknessMeters * 0.5,
            surface.center.z + worldLocalCenter.z
          ),
          freezeVector3(
            Math.max(0.5, localBounds.maxX - localBounds.minX),
            supportThicknessMeters,
            Math.max(0.5, localBounds.maxZ - localBounds.minZ)
          ),
          surface.rotationYRadians,
          "support"
        )
      : null;
  const supportTriMesh =
    flatLocalRectangle ||
    region.regionKind === "arena"
      ? null
      : createRegionSurfaceTriMesh(region, surface);

  if (compatibilityAssetId === null || supportBox === null) {
    return Object.freeze({
      chunkId,
      collisionBoxes:
        supportBox === null ? Object.freeze([]) : Object.freeze([supportBox]),
      collisionTriMeshes:
        supportTriMesh === null
          ? Object.freeze([])
          : Object.freeze([supportTriMesh]),
      environmentAsset: null
    });
  }

  const placementScale = Object.freeze({
    x: Math.max(0.25, supportBox.size.x / semanticFloorFootprint.x),
    y: Math.max(0.25, supportBox.size.y / semanticFloorFootprint.y),
    z: Math.max(0.25, supportBox.size.z / semanticFloorFootprint.z)
  });

  return Object.freeze({
    chunkId,
    collisionBoxes: Object.freeze([supportBox]),
    collisionTriMeshes: Object.freeze([]),
    environmentAsset: Object.freeze({
      assetId: compatibilityAssetId,
      collisionPath: null,
      collider: null,
      dynamicBody: null,
      entries: null,
      placementMode: "instanced",
      placements: Object.freeze([
        createEnvironmentPlacement(
          `region:${region.regionId}`,
          resolveCollisionBoxBottomPlacementPosition(supportBox),
          surface.rotationYRadians,
          placementScale,
          "",
          region.materialReferenceId
        )
      ]),
      seats: null,
      surfaceColliders: Object.freeze([
        Object.freeze({
          center: freezeVector3(0, semanticFloorFootprint.y * 0.5, 0),
          size: freezeVector3(
            semanticFloorFootprint.x,
            semanticFloorFootprint.y,
            semanticFloorFootprint.z
          ),
          traversalAffordance: "support"
        })
      ]),
      traversalAffordance: "support"
    })
  });
}

function buildEdgeCompatibilityPlacements(
  edge: MetaverseMapBundleSemanticEdgeSnapshot,
  surface: MetaverseMapBundleSemanticSurfaceSnapshot,
  terrainPatch: MetaverseMapBundleSemanticTerrainPatchSnapshot | null,
  compatibilityAssetId: string | null
): readonly {
  readonly collisionBoxes: readonly MetaverseMapBundleCompiledCollisionBoxSnapshot[];
  readonly environmentAsset: MetaverseMapBundleEnvironmentAssetSnapshot | null;
  readonly chunkId: string;
}[] {
  const segmentPlacements: {
    collisionBoxes: MetaverseMapBundleCompiledCollisionBoxSnapshot[];
    environmentAsset: MetaverseMapBundleEnvironmentAssetSnapshot | null;
    chunkId: string;
  }[] = [];
  const edgePoints =
    edge.path.length >= 2
      ? edge.path
      : Object.freeze([
          Object.freeze({ x: -2, z: 0 }),
          Object.freeze({ x: 2, z: 0 })
        ]);

  for (let segmentIndex = 0; segmentIndex + 1 < edgePoints.length; segmentIndex += 1) {
    const startPoint = edgePoints[segmentIndex]!;
    const endPoint = edgePoints[segmentIndex + 1]!;
    const bounds = resolveEdgeSegmentBounds(startPoint, endPoint, edge, surface);
    const chunkId = createChunkId(
      bounds.center.x,
      bounds.center.z,
      defaultCompiledChunkSizeMeters
    );
    const collisionBox = createCollisionBoxSnapshot(
      edge.edgeId,
      "edge",
      bounds.center,
      freezeVector3(
        bounds.lengthMeters,
        Math.max(0.5, edge.heightMeters),
        Math.max(0.25, edge.thicknessMeters)
      ),
      bounds.rotationYRadians,
      edge.edgeKind === "curb" || edge.edgeKind === "rail"
        ? "support"
        : "blocker"
    );
    const collisionBoxWithTerrainSupport =
      terrainPatch !== null &&
      collisionBox.traversalAffordance === "blocker"
        ? extendCollisionBoxBottomToHeight(
            collisionBox,
            resolveMinimumTerrainHeightMetersWithinOrientedBounds(terrainPatch, {
              center: collisionBox.center,
              rotationYRadians: collisionBox.rotationYRadians,
              size: collisionBox.size
            })
          )
        : collisionBox;

    if (compatibilityAssetId === null) {
      segmentPlacements.push({
        chunkId,
        collisionBoxes: [collisionBoxWithTerrainSupport],
        environmentAsset: null
      });
      continue;
    }

    const placementScale = Object.freeze({
      x: Math.max(0.25, collisionBoxWithTerrainSupport.size.x / semanticWallFootprint.x),
      y: Math.max(0.25, collisionBoxWithTerrainSupport.size.y / semanticWallFootprint.y),
      z: Math.max(0.25, collisionBoxWithTerrainSupport.size.z / semanticWallFootprint.z)
    });

    segmentPlacements.push({
      chunkId,
      collisionBoxes: [collisionBoxWithTerrainSupport],
      environmentAsset: Object.freeze({
        assetId: compatibilityAssetId,
        collisionPath: null,
        collider: null,
        dynamicBody: null,
        entries: null,
        placementMode: "instanced",
        placements: Object.freeze([
          createEnvironmentPlacement(
            `edge:${edge.edgeId}:${segmentIndex}`,
            resolveCollisionBoxBottomPlacementPosition(
              collisionBoxWithTerrainSupport
            ),
            collisionBoxWithTerrainSupport.rotationYRadians,
            placementScale,
            "",
            edge.materialReferenceId
          )
        ]),
        seats: null,
        surfaceColliders: Object.freeze([
          Object.freeze({
            center: freezeVector3(0, semanticWallFootprint.y * 0.5, 0),
            size: freezeVector3(
              semanticWallFootprint.x,
              semanticWallFootprint.y,
              semanticWallFootprint.z
            ),
            traversalAffordance: "support"
          })
        ]),
        traversalAffordance: "support"
      })
    });
  }

  return Object.freeze(
    segmentPlacements.map((placement) =>
      Object.freeze({
        chunkId: placement.chunkId,
        collisionBoxes: Object.freeze([...placement.collisionBoxes]),
        environmentAsset: placement.environmentAsset
      })
    )
  );
}

function buildConnectorCompatibilityPlacements(
  connector: MetaverseMapBundleSemanticConnectorSnapshot,
  compatibilityAssetId: string | null
): {
  readonly collisionBoxes: readonly MetaverseMapBundleCompiledCollisionBoxSnapshot[];
  readonly environmentAsset: MetaverseMapBundleEnvironmentAssetSnapshot | null;
  readonly chunkId: string;
} {
  const chunkId = createChunkId(
    connector.center.x,
    connector.center.z,
    defaultCompiledChunkSizeMeters
  );
  const size = freezeVector3(
    Math.max(0.5, connector.size.x),
    Math.max(0.5, connector.size.y),
    Math.max(0.5, connector.size.z)
  );

  if (compatibilityAssetId === null) {
    return Object.freeze({
      chunkId,
      collisionBoxes: Object.freeze([
        createCollisionBoxSnapshot(
          connector.connectorId,
          "connector",
          connector.center,
          size,
          connector.rotationYRadians,
          "support"
        )
      ]),
      environmentAsset: null
    });
  }

  return Object.freeze({
    chunkId,
    collisionBoxes: Object.freeze([
      createCollisionBoxSnapshot(
        connector.connectorId,
        "connector",
        connector.center,
        size,
        connector.rotationYRadians,
        "support"
      )
    ]),
    environmentAsset: Object.freeze({
      assetId: compatibilityAssetId,
      collisionPath: null,
      collider: null,
      dynamicBody: null,
      entries: null,
      placementMode: "instanced",
      placements: Object.freeze([
        createEnvironmentPlacement(
          `connector:${connector.connectorId}`,
          freezeVector3(
            connector.center.x,
            connector.center.y - size.y * 0.5,
            connector.center.z
          ),
          connector.rotationYRadians,
          Object.freeze({
            x: Math.max(0.25, connector.size.x / semanticConnectorFootprint.x),
            y: Math.max(0.25, connector.size.y / semanticConnectorFootprint.y),
            z: Math.max(0.25, connector.size.z / semanticConnectorFootprint.z)
          })
        )
      ]),
      seats: null,
      surfaceColliders: Object.freeze([
        Object.freeze({
          center: freezeVector3(0, semanticConnectorFootprint.y * 0.5, 0),
          size: freezeVector3(
            semanticConnectorFootprint.x,
            semanticConnectorFootprint.y,
            semanticConnectorFootprint.z
          ),
          traversalAffordance: "support"
        })
      ]),
      traversalAffordance: "support"
    })
  });
}

function buildModuleCompatibilityAsset(
  module: MetaverseMapBundleSemanticModuleSnapshot
): MetaverseMapBundleEnvironmentAssetSnapshot {
  return Object.freeze({
    assetId: module.assetId,
    collisionPath: module.collisionPath,
    collider: module.collider,
    dynamicBody: module.dynamicBody,
    entries: module.entries,
    placementMode: module.placementMode,
    placements: Object.freeze([
      Object.freeze({
        collisionEnabled: module.collisionEnabled,
        isVisible: module.isVisible,
        materialReferenceId: module.materialReferenceId,
        notes: module.notes,
        placementId: module.moduleId,
        position: freezeVector3(
          module.position.x,
          module.position.y,
          module.position.z
        ),
        rotationYRadians: module.rotationYRadians,
        scale: freezePlacementScale(module.scale)
      } satisfies MetaverseMapBundlePlacementSnapshot)
    ]),
    seats: module.seats,
    surfaceColliders: module.surfaceColliders,
    traversalAffordance: module.traversalAffordance
  });
}

function shouldUseModuleCollisionMeshSurface(
  module: Pick<
    MetaverseMapBundleSemanticModuleSnapshot,
    "collisionPath" | "dynamicBody"
  >
): boolean {
  return module.dynamicBody === null && module.collisionPath !== null;
}

interface MutableCompiledChunkRecord {
  readonly chunkId: string;
  readonly collisionBoxes: MetaverseMapBundleCompiledCollisionBoxSnapshot[];
  readonly collisionHeightfields:
    MetaverseMapBundleCompiledCollisionHeightfieldSnapshot[];
  readonly collisionTriMeshes: MetaverseMapBundleCompiledCollisionTriMeshSnapshot[];
  readonly connectorIds: Set<string>;
  readonly edgeIds: Set<string>;
  readonly gameplayVolumeIds: Set<string>;
  readonly instancedModuleAssetIds: Set<string>;
  readonly lightIds: Set<string>;
  readonly regionIds: Set<string>;
  readonly structureIds: Set<string>;
  readonly surfaceIds: Set<string>;
  readonly terrainPatchIds: Set<string>;
  readonly transparentEntityIds: Set<string>;
}

function ensureChunkRecord(
  chunksById: Map<string, MutableCompiledChunkRecord>,
  chunkId: string
): MutableCompiledChunkRecord {
  const existingRecord = chunksById.get(chunkId);

  if (existingRecord !== undefined) {
    return existingRecord;
  }

  const nextRecord = {
    chunkId,
    collisionBoxes: [],
    collisionHeightfields: [],
    collisionTriMeshes: [],
    connectorIds: new Set<string>(),
    edgeIds: new Set<string>(),
    gameplayVolumeIds: new Set<string>(),
    instancedModuleAssetIds: new Set<string>(),
    lightIds: new Set<string>(),
    regionIds: new Set<string>(),
    structureIds: new Set<string>(),
    surfaceIds: new Set<string>(),
    terrainPatchIds: new Set<string>(),
    transparentEntityIds: new Set<string>()
  } satisfies MutableCompiledChunkRecord;

  chunksById.set(chunkId, nextRecord);

  return nextRecord;
}

export function createDefaultMetaverseMapBundleCompiledWorld(
  environmentAssets: readonly MetaverseMapBundleEnvironmentAssetSnapshot[],
  chunkSizeMeters = defaultCompiledChunkSizeMeters
): MetaverseMapBundleCompiledWorldSnapshot {
  const chunksById = new Map<string, MutableCompiledChunkRecord>();

  for (const environmentAsset of environmentAssets) {
    for (const placement of environmentAsset.placements) {
      const chunkRecord = ensureChunkRecord(
        chunksById,
        createChunkId(placement.position.x, placement.position.z, chunkSizeMeters)
      );

      chunkRecord.instancedModuleAssetIds.add(environmentAsset.assetId);
      chunkRecord.collisionBoxes.push(
        ...createCompiledCollisionBoxesForPlacement(
          placement.placementId,
          "module",
          environmentAsset.assetId,
          placement,
          environmentAsset.surfaceColliders
        )
      );
    }
  }

  return Object.freeze({
    chunkSizeMeters,
    chunks: Object.freeze(
      [...chunksById.values()].map((chunkRecord) =>
        Object.freeze({
          bounds: createChunkBounds(chunkRecord.chunkId, chunkSizeMeters),
          chunkId: chunkRecord.chunkId,
          collision: Object.freeze({
            boxes: Object.freeze([...chunkRecord.collisionBoxes]),
            heightfields: Object.freeze([...chunkRecord.collisionHeightfields]),
            triMeshes: Object.freeze([...chunkRecord.collisionTriMeshes])
          }),
          navigation: Object.freeze({
            connectorIds: Object.freeze([...chunkRecord.connectorIds]),
            gameplayVolumeIds: Object.freeze([...chunkRecord.gameplayVolumeIds]),
            regionIds: Object.freeze([...chunkRecord.regionIds]),
            surfaceIds: Object.freeze([...chunkRecord.surfaceIds])
          }),
          render: Object.freeze({
            edgeIds: Object.freeze([...chunkRecord.edgeIds]),
            instancedModuleAssetIds: Object.freeze([
              ...chunkRecord.instancedModuleAssetIds
            ]),
            lightIds: Object.freeze([...chunkRecord.lightIds]),
            regionIds: Object.freeze([...chunkRecord.regionIds]),
            structureIds: Object.freeze([...chunkRecord.structureIds]),
            terrainPatchIds: Object.freeze([...chunkRecord.terrainPatchIds]),
            transparentEntityIds: Object.freeze([
              ...chunkRecord.transparentEntityIds
            ])
          })
        } satisfies MetaverseMapBundleCompiledWorldChunkSnapshot)
      )
    ),
    compatibilityEnvironmentAssets: Object.freeze([...environmentAssets])
  });
}

function createTerrainPatchHeightfield(
  terrainPatch: MetaverseMapBundleSemanticTerrainPatchSnapshot
): MetaverseMapBundleCompiledCollisionHeightfieldSnapshot | null {
  if (terrainPatch.sampleCountX < 2 || terrainPatch.sampleCountZ < 2) {
    return null;
  }

  return Object.freeze({
    heightSamples: Object.freeze([...terrainPatch.heightSamples]),
    ownerId: terrainPatch.terrainPatchId,
    ownerKind: "terrain-patch",
    rotationYRadians: terrainPatch.rotationYRadians,
    sampleCountX: terrainPatch.sampleCountX,
    sampleCountZ: terrainPatch.sampleCountZ,
    sampleSpacingMeters: terrainPatch.sampleSpacingMeters,
    translation: terrainPatch.origin,
    traversalAffordance: "support"
  });
}

function createTerrainPatchSubsurfaceBlockerTriMesh(
  terrainPatch: MetaverseMapBundleSemanticTerrainPatchSnapshot
): MetaverseMapBundleCompiledCollisionTriMeshSnapshot | null {
  if (
    terrainPatch.sampleCountX < 2 ||
    terrainPatch.sampleCountZ < 2 ||
    terrainPatch.sampleSpacingMeters <= 0
  ) {
    return null;
  }

  const vertices: number[] = [];
  const indices: number[] = [];
  let blockerBaseHeight = 0;

  for (const heightSample of terrainPatch.heightSamples) {
    blockerBaseHeight = Math.min(blockerBaseHeight, heightSample);
  }

  blockerBaseHeight -= terrainPatchCollisionHeightEpsilonMeters;
  const halfX =
    (terrainPatch.sampleCountX - 1) * terrainPatch.sampleSpacingMeters * 0.5;
  const halfZ =
    (terrainPatch.sampleCountZ - 1) * terrainPatch.sampleSpacingMeters * 0.5;
  const readLocalX = (sampleX: number): number =>
    sampleX * terrainPatch.sampleSpacingMeters - halfX;
  const readLocalZ = (sampleZ: number): number =>
    sampleZ * terrainPatch.sampleSpacingMeters - halfZ;
  const pushVertex = (x: number, y: number, z: number): number => {
    const vertexIndex = vertices.length / 3;

    vertices.push(x, y, z);

    return vertexIndex;
  };
  const resolveBlockerCeilingHeight = (height: number): number =>
    Math.max(
      blockerBaseHeight,
      height - terrainPatchSubsurfaceBlockerCeilingInsetMeters
    );
  const pushRawTriangle = (
    a: { readonly x: number; readonly y: number; readonly z: number },
    b: { readonly x: number; readonly y: number; readonly z: number },
    c: { readonly x: number; readonly y: number; readonly z: number }
  ): void => {
    const aIndex = pushVertex(a.x, a.y, a.z);
    const bIndex = pushVertex(b.x, b.y, b.z);
    const cIndex = pushVertex(c.x, c.y, c.z);

    indices.push(aIndex, bIndex, cIndex);
  };
  const pushTriangleCeiling = (
    a: { readonly x: number; readonly y: number; readonly z: number },
    b: { readonly x: number; readonly y: number; readonly z: number },
    c: { readonly x: number; readonly y: number; readonly z: number }
  ): void => {
    if (
      Math.max(a.y, b.y, c.y) <=
      blockerBaseHeight + terrainPatchCollisionHeightEpsilonMeters
    ) {
      return;
    }

    pushRawTriangle(a, b, c);
  };
  const pushBoundarySide = (
    a: { readonly x: number; readonly y: number; readonly z: number },
    b: { readonly x: number; readonly y: number; readonly z: number }
  ): void => {
    if (
      Math.max(a.y, b.y) <=
      blockerBaseHeight + terrainPatchCollisionHeightEpsilonMeters
    ) {
      return;
    }

    const baseA = Object.freeze({
      x: a.x,
      y: blockerBaseHeight,
      z: a.z
    });
    const baseB = Object.freeze({
      x: b.x,
      y: blockerBaseHeight,
      z: b.z
    });

    pushRawTriangle(a, baseA, b);
    pushRawTriangle(b, baseA, baseB);
  };
  const readSample = (
    sampleX: number,
    sampleZ: number
  ): { readonly x: number; readonly y: number; readonly z: number } =>
    Object.freeze({
      x: readLocalX(sampleX),
      y: resolveBlockerCeilingHeight(
        resolveTerrainPatchSampleHeight(terrainPatch, sampleX, sampleZ)
      ),
      z: readLocalZ(sampleZ)
    });

  for (let cellZ = 0; cellZ < terrainPatch.sampleCountZ - 1; cellZ += 1) {
    for (let cellX = 0; cellX < terrainPatch.sampleCountX - 1; cellX += 1) {
      const topLeft = readSample(cellX, cellZ);
      const topRight = readSample(cellX + 1, cellZ);
      const bottomLeft = readSample(cellX, cellZ + 1);
      const bottomRight = readSample(cellX + 1, cellZ + 1);

      pushTriangleCeiling(topLeft, topRight, bottomLeft);
      pushTriangleCeiling(topRight, bottomRight, bottomLeft);
    }
  }

  for (let sampleX = 0; sampleX < terrainPatch.sampleCountX - 1; sampleX += 1) {
    pushBoundarySide(readSample(sampleX, 0), readSample(sampleX + 1, 0));
    pushBoundarySide(
      readSample(sampleX + 1, terrainPatch.sampleCountZ - 1),
      readSample(sampleX, terrainPatch.sampleCountZ - 1)
    );
  }

  for (let sampleZ = 0; sampleZ < terrainPatch.sampleCountZ - 1; sampleZ += 1) {
    pushBoundarySide(readSample(0, sampleZ + 1), readSample(0, sampleZ));
    pushBoundarySide(
      readSample(terrainPatch.sampleCountX - 1, sampleZ),
      readSample(terrainPatch.sampleCountX - 1, sampleZ + 1)
    );
  }

  if (indices.length === 0) {
    return null;
  }

  return Object.freeze({
    indices: Object.freeze(indices),
    ownerId: terrainPatch.terrainPatchId,
    ownerKind: "terrain-patch",
    rotationYRadians: terrainPatch.rotationYRadians,
    translation: terrainPatch.origin,
    traversalAffordance: "blocker",
    vertices: Object.freeze(vertices)
  });
}

export function compileMetaverseMapBundleSemanticWorld(
  semanticWorld: MetaverseMapBundleSemanticWorldSnapshot,
  chunkSizeMeters = defaultCompiledChunkSizeMeters
): MetaverseMapBundleCompiledWorldSnapshot {
  const chunksById = new Map<string, MutableCompiledChunkRecord>();
  const environmentAssetsById = new Map<
    string,
    MetaverseMapBundleEnvironmentAssetSnapshot
  >();
  const surfacesById = new Map(
    semanticWorld.surfaces.map((surface) => [surface.surfaceId, surface] as const)
  );
  const terrainPatchesById = new Map(
    semanticWorld.terrainPatches.map((terrainPatch) => [
      terrainPatch.terrainPatchId,
      terrainPatch
    ] as const)
  );

  for (const terrainPatch of semanticWorld.terrainPatches) {
    const chunkRecord = ensureChunkRecord(
      chunksById,
      createChunkId(terrainPatch.origin.x, terrainPatch.origin.z, chunkSizeMeters)
    );

    chunkRecord.terrainPatchIds.add(terrainPatch.terrainPatchId);

    const heightfield = createTerrainPatchHeightfield(terrainPatch);

    if (heightfield !== null) {
      chunkRecord.collisionHeightfields.push(heightfield);
    }

    const subsurfaceBlockerTriMesh =
      createTerrainPatchSubsurfaceBlockerTriMesh(terrainPatch);

    if (subsurfaceBlockerTriMesh !== null) {
      chunkRecord.collisionTriMeshes.push(subsurfaceBlockerTriMesh);
    }
  }

  for (const structure of semanticWorld.structures) {
    const chunkRecord = ensureChunkRecord(
      chunksById,
      createChunkId(structure.center.x, structure.center.z, chunkSizeMeters)
    );

    chunkRecord.structureIds.add(structure.structureId);
    chunkRecord.collisionBoxes.push(
      resolveSemanticStructureCollisionBox(structure)
    );

    if (
      structure.structureKind === "cover" ||
      structure.structureKind === "wall"
    ) {
      chunkRecord.transparentEntityIds.add(structure.structureId);
    }
  }

  for (const volume of semanticWorld.gameplayVolumes) {
    const chunkRecord = ensureChunkRecord(
      chunksById,
      resolveSemanticGameplayVolumeChunkId(volume, chunkSizeMeters)
    );

    chunkRecord.gameplayVolumeIds.add(volume.volumeId);
    chunkRecord.transparentEntityIds.add(volume.volumeId);
  }

  for (const light of semanticWorld.lights) {
    const chunkRecord = ensureChunkRecord(
      chunksById,
      resolveSemanticLightChunkId(light, chunkSizeMeters)
    );

    chunkRecord.lightIds.add(light.lightId);
  }

  for (const region of semanticWorld.regions) {
    const surface = surfacesById.get(region.surfaceId) ?? null;

    if (surface === null) {
      continue;
    }

    const compatibilityPlacement = buildRegionCompatibilityPlacements(
      region,
      surface,
      semanticWorld.compatibilityAssetIds.floorAssetId
    );
    const chunkRecord = ensureChunkRecord(chunksById, compatibilityPlacement.chunkId);

    chunkRecord.regionIds.add(region.regionId);
    chunkRecord.surfaceIds.add(surface.surfaceId);
    chunkRecord.collisionBoxes.push(...compatibilityPlacement.collisionBoxes);
    chunkRecord.collisionTriMeshes.push(
      ...compatibilityPlacement.collisionTriMeshes
    );

    if (compatibilityPlacement.environmentAsset !== null) {
      const { placements, ...environmentAssetSeed } =
        compatibilityPlacement.environmentAsset;

      ensureEnvironmentAssetGroup(
        environmentAssetsById,
        environmentAssetSeed,
        placements
      );
    }
  }

  for (const edge of semanticWorld.edges) {
    const surface = surfacesById.get(edge.surfaceId) ?? null;

    if (surface === null) {
      continue;
    }

    const compatibilityPlacements = buildEdgeCompatibilityPlacements(
      edge,
      surface,
      surface.terrainPatchId === null
        ? null
        : terrainPatchesById.get(surface.terrainPatchId) ?? null,
      semanticWorld.compatibilityAssetIds.wallAssetId
    );

    for (const compatibilityPlacement of compatibilityPlacements) {
      const chunkRecord = ensureChunkRecord(
        chunksById,
        compatibilityPlacement.chunkId
      );

      chunkRecord.edgeIds.add(edge.edgeId);
      chunkRecord.surfaceIds.add(surface.surfaceId);
      chunkRecord.collisionBoxes.push(...compatibilityPlacement.collisionBoxes);

      if (compatibilityPlacement.environmentAsset !== null) {
        const { placements, ...environmentAssetSeed } =
          compatibilityPlacement.environmentAsset;

        ensureEnvironmentAssetGroup(
          environmentAssetsById,
          environmentAssetSeed,
          placements
        );
      }
    }
  }

  for (const connector of semanticWorld.connectors) {
    const compatibilityPlacement = buildConnectorCompatibilityPlacements(
      connector,
      semanticWorld.compatibilityAssetIds.connectorAssetId
    );
    const chunkRecord = ensureChunkRecord(chunksById, compatibilityPlacement.chunkId);

    chunkRecord.connectorIds.add(connector.connectorId);
    chunkRecord.surfaceIds.add(connector.fromSurfaceId);
    chunkRecord.surfaceIds.add(connector.toSurfaceId);
    chunkRecord.collisionBoxes.push(...compatibilityPlacement.collisionBoxes);

    if (compatibilityPlacement.environmentAsset !== null) {
      const { placements, ...environmentAssetSeed } =
        compatibilityPlacement.environmentAsset;

      ensureEnvironmentAssetGroup(
        environmentAssetsById,
        environmentAssetSeed,
        placements
      );
    }
  }

  for (const module of semanticWorld.modules) {
    const environmentAsset = buildModuleCompatibilityAsset(module);
    const chunkRecord = ensureChunkRecord(
      chunksById,
      createChunkId(module.position.x, module.position.z, chunkSizeMeters)
    );

    chunkRecord.instancedModuleAssetIds.add(module.assetId);
    if (!shouldUseModuleCollisionMeshSurface(module)) {
      chunkRecord.collisionBoxes.push(
        ...createCompiledCollisionBoxesForPlacement(
          module.moduleId,
          "module",
          module.assetId,
          {
            position: module.position,
            rotationYRadians: module.rotationYRadians,
            scale: freezePlacementScale(module.scale)
          },
          module.surfaceColliders
        )
      );
    }

    ensureEnvironmentAssetGroup(
      environmentAssetsById,
      (({ placements, ...environmentAssetSeed }) => environmentAssetSeed)(
        environmentAsset
      ),
      environmentAsset.placements
    );
  }

  return Object.freeze({
    chunkSizeMeters,
    chunks: Object.freeze(
      [...chunksById.values()]
        .sort((leftChunk, rightChunk) =>
          leftChunk.chunkId.localeCompare(rightChunk.chunkId)
        )
        .map((chunkRecord) =>
          Object.freeze({
            bounds: createChunkBounds(chunkRecord.chunkId, chunkSizeMeters),
            chunkId: chunkRecord.chunkId,
            collision: Object.freeze({
              boxes: Object.freeze([...chunkRecord.collisionBoxes]),
              heightfields: Object.freeze([...chunkRecord.collisionHeightfields]),
              triMeshes: Object.freeze([...chunkRecord.collisionTriMeshes])
            }),
            navigation: Object.freeze({
              connectorIds: Object.freeze([...chunkRecord.connectorIds]),
              gameplayVolumeIds: Object.freeze([
                ...chunkRecord.gameplayVolumeIds
              ]),
              regionIds: Object.freeze([...chunkRecord.regionIds]),
              surfaceIds: Object.freeze([...chunkRecord.surfaceIds])
            }),
            render: Object.freeze({
              edgeIds: Object.freeze([...chunkRecord.edgeIds]),
              instancedModuleAssetIds: Object.freeze([
                ...chunkRecord.instancedModuleAssetIds
              ]),
              lightIds: Object.freeze([...chunkRecord.lightIds]),
              regionIds: Object.freeze([...chunkRecord.regionIds]),
              structureIds: Object.freeze([...chunkRecord.structureIds]),
              terrainPatchIds: Object.freeze([...chunkRecord.terrainPatchIds]),
              transparentEntityIds: Object.freeze([
                ...chunkRecord.transparentEntityIds
              ])
            })
          } satisfies MetaverseMapBundleCompiledWorldChunkSnapshot)
        )
    ),
    compatibilityEnvironmentAssets: Object.freeze(
      [...environmentAssetsById.values()]
    )
  });
}
