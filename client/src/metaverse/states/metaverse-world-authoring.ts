import {
  metaverseHubDockEnvironmentAssetId,
  metaverseHubDiveBoatEnvironmentAssetId,
  metaverseHubPushableCrateEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId,
  metaversePlaygroundRangeBarrierEnvironmentAssetId,
  metaversePlaygroundRangeFloorEnvironmentAssetId,
  metaverseWorldSurfaceAssets,
  metaverseWorldSurfacePlacementIds,
  metaverseWorldSurfaceTraversalAffordanceIds,
  metaverseWorldWaterRegions,
  type MetaverseWorldSurfaceAssetAuthoring,
  type MetaverseWorldSurfaceColliderAuthoring,
  type MetaverseWorldSurfacePlacementId,
  type MetaverseWorldSurfacePlacementSnapshot,
  type MetaverseWorldSurfaceTraversalAffordanceId,
  type MetaverseWorldSurfaceVector3Snapshot,
  type MetaverseWorldWaterRegionAuthoring
} from "@webgpu-metaverse/shared";

interface MetaverseWorldAuthoringAssetCodeMetadata {
  readonly environmentAssetConstantName: string;
  readonly environmentAssetId: string;
  readonly surfaceColliderConstantName: string;
}

interface MetaverseWorldAuthoringSummary {
  readonly assetCount: number;
  readonly placementCount: number;
  readonly surfaceColliderCount: number;
  readonly waterRegionCount: number;
}

export interface MetaverseWorldAuthoringDocumentSnapshot {
  readonly surfaceAssets: readonly MetaverseWorldSurfaceAssetAuthoring[];
  readonly waterRegions: readonly MetaverseWorldWaterRegionAuthoring[];
}

export interface MetaverseWorldAuthoringPlacementReference {
  readonly environmentAssetId: string;
  readonly placementIndex: number;
}

export interface MetaverseWorldAuthoringPlacementMutationResult {
  readonly assets: readonly MetaverseWorldSurfaceAssetAuthoring[];
  readonly placement: MetaverseWorldAuthoringPlacementReference;
}

const metaverseWorldAuthoringAssetCodeMetadata = Object.freeze([
  Object.freeze({
    environmentAssetConstantName:
      "metaversePlaygroundRangeFloorEnvironmentAssetId",
    environmentAssetId: metaversePlaygroundRangeFloorEnvironmentAssetId,
    surfaceColliderConstantName: "metaversePlaygroundRangeFloorSurfaceColliders"
  }),
  Object.freeze({
    environmentAssetConstantName:
      "metaversePlaygroundRangeBarrierEnvironmentAssetId",
    environmentAssetId: metaversePlaygroundRangeBarrierEnvironmentAssetId,
    surfaceColliderConstantName:
      "metaversePlaygroundRangeBarrierSurfaceColliders"
  }),
  Object.freeze({
    environmentAssetConstantName: "metaverseHubDockEnvironmentAssetId",
    environmentAssetId: metaverseHubDockEnvironmentAssetId,
    surfaceColliderConstantName: "metaverseHubDockSurfaceColliders"
  }),
  Object.freeze({
    environmentAssetConstantName: "metaverseHubPushableCrateEnvironmentAssetId",
    environmentAssetId: metaverseHubPushableCrateEnvironmentAssetId,
    surfaceColliderConstantName: "metaverseHubPushableCrateSurfaceColliders"
  }),
  Object.freeze({
    environmentAssetConstantName: "metaverseHubSkiffEnvironmentAssetId",
    environmentAssetId: metaverseHubSkiffEnvironmentAssetId,
    surfaceColliderConstantName: "metaverseHubSkiffSurfaceColliders"
  }),
  Object.freeze({
    environmentAssetConstantName: "metaverseHubDiveBoatEnvironmentAssetId",
    environmentAssetId: metaverseHubDiveBoatEnvironmentAssetId,
    surfaceColliderConstantName: "metaverseHubDiveBoatSurfaceColliders"
  })
] satisfies readonly MetaverseWorldAuthoringAssetCodeMetadata[]);

const metaverseWorldAuthoringAssetCodeMetadataById = new Map<
  string,
  MetaverseWorldAuthoringAssetCodeMetadata
>(
  metaverseWorldAuthoringAssetCodeMetadata.map((metadata) => [
    metadata.environmentAssetId,
    metadata
  ])
);

const metaverseWorldAuthoringExpectedAssetIds = Object.freeze(
  metaverseWorldSurfaceAssets.map((asset) => asset.environmentAssetId)
);

const metaverseWorldAuthoringSourcePathSegments = Object.freeze([
  "packages",
  "shared",
  "src",
  "metaverse",
  "metaverse-world-surface-authoring-data.ts"
]);

export const metaverseWorldAuthoringSourcePath =
  metaverseWorldAuthoringSourcePathSegments.join("/");

export const metaverseWorldAuthoringSourceFileName =
  "metaverse-world-surface-authoring-data.ts";

function freezeVector3Snapshot(
  value: MetaverseWorldSurfaceVector3Snapshot
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x: value.x,
    y: value.y,
    z: value.z
  });
}

function freezePlacementSnapshot(
  placement: MetaverseWorldSurfacePlacementSnapshot
): MetaverseWorldSurfacePlacementSnapshot {
  return Object.freeze({
    position: freezeVector3Snapshot(placement.position),
    rotationYRadians: placement.rotationYRadians,
    scale: placement.scale
  });
}

function freezeSurfaceAsset(
  asset: MetaverseWorldSurfaceAssetAuthoring,
  placements: readonly MetaverseWorldSurfacePlacementSnapshot[]
): MetaverseWorldSurfaceAssetAuthoring {
  return Object.freeze({
    environmentAssetId: asset.environmentAssetId,
    placement: asset.placement,
    placements: Object.freeze(placements.map((placement) => freezePlacementSnapshot(placement))),
    surfaceColliders: asset.surfaceColliders
  });
}

function resolveSurfaceAssetIndex(
  assets: readonly MetaverseWorldSurfaceAssetAuthoring[],
  environmentAssetId: string
): number {
  return assets.findIndex((asset) => asset.environmentAssetId === environmentAssetId);
}

function resolveSurfaceAssetPlacement(
  assets: readonly MetaverseWorldSurfaceAssetAuthoring[],
  placementReference: MetaverseWorldAuthoringPlacementReference
) {
  const assetIndex = resolveSurfaceAssetIndex(
    assets,
    placementReference.environmentAssetId
  );

  if (assetIndex < 0) {
    throw new Error(
      `The world authoring document is missing ${placementReference.environmentAssetId}.`
    );
  }

  const asset = assets[assetIndex]!;

  if (
    placementReference.placementIndex < 0 ||
    placementReference.placementIndex >= asset.placements.length
  ) {
    throw new Error(
      `${placementReference.environmentAssetId} placement ${placementReference.placementIndex + 1} does not exist.`
    );
  }

  return {
    asset,
    assetIndex,
    placement: asset.placements[placementReference.placementIndex]!
  };
}

function replaceSurfaceAsset(
  assets: readonly MetaverseWorldSurfaceAssetAuthoring[],
  assetIndex: number,
  nextAsset: MetaverseWorldSurfaceAssetAuthoring
): readonly MetaverseWorldSurfaceAssetAuthoring[] {
  return Object.freeze(
    assets.map((asset, index) => (index === assetIndex ? nextAsset : asset))
  ) as readonly MetaverseWorldSurfaceAssetAuthoring[];
}

function assertRecord(
  value: unknown,
  path: string
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
}

function assertFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`);
  }

  return value;
}

function assertPositiveFiniteNumber(value: unknown, path: string): number {
  const parsedValue = assertFiniteNumber(value, path);

  if (parsedValue <= 0) {
    throw new Error(`${path} must be greater than zero.`);
  }

  return parsedValue;
}

function assertKnownPlacementId(
  value: unknown,
  path: string
): MetaverseWorldSurfacePlacementId {
  if (
    typeof value !== "string" ||
    !metaverseWorldSurfacePlacementIds.includes(
      value as MetaverseWorldSurfacePlacementId
    )
  ) {
    throw new Error(
      `${path} must be one of ${metaverseWorldSurfacePlacementIds.join(", ")}.`
    );
  }

  return value as MetaverseWorldSurfacePlacementId;
}

function assertKnownTraversalAffordance(
  value: unknown,
  path: string
): MetaverseWorldSurfaceTraversalAffordanceId {
  if (
    typeof value !== "string" ||
    !metaverseWorldSurfaceTraversalAffordanceIds.includes(
      value as MetaverseWorldSurfaceTraversalAffordanceId
    )
  ) {
    throw new Error(
      `${path} must be one of ${metaverseWorldSurfaceTraversalAffordanceIds.join(", ")}.`
    );
  }

  return value as MetaverseWorldSurfaceTraversalAffordanceId;
}

function parseVector3(
  value: unknown,
  path: string
): MetaverseWorldSurfaceVector3Snapshot {
  assertRecord(value, path);

  return {
    x: assertFiniteNumber(value.x, `${path}.x`),
    y: assertFiniteNumber(value.y, `${path}.y`),
    z: assertFiniteNumber(value.z, `${path}.z`)
  };
}

function parsePlacement(
  value: unknown,
  path: string
): MetaverseWorldSurfacePlacementSnapshot {
  assertRecord(value, path);

  return {
    position: parseVector3(value.position, `${path}.position`),
    rotationYRadians: assertFiniteNumber(
      value.rotationYRadians,
      `${path}.rotationYRadians`
    ),
    scale: assertFiniteNumber(value.scale, `${path}.scale`)
  };
}

function parseSurfaceCollider(
  value: unknown,
  path: string
): MetaverseWorldSurfaceColliderAuthoring {
  assertRecord(value, path);

  return {
    center: parseVector3(value.center, `${path}.center`),
    size: parseVector3(value.size, `${path}.size`),
    traversalAffordance: assertKnownTraversalAffordance(
      value.traversalAffordance,
      `${path}.traversalAffordance`
    )
  };
}

function parseEnvironmentAssetId(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  if (!metaverseWorldAuthoringAssetCodeMetadataById.has(value)) {
    throw new Error(`${path} must match a shipped metaverse asset id.`);
  }

  return value;
}

function parseWaterRegionId(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return value;
}

function parseSurfaceAsset(
  value: unknown,
  index: number
): MetaverseWorldSurfaceAssetAuthoring {
  const path = `assets[${index}]`;

  assertRecord(value, path);

  if (!Array.isArray(value.placements)) {
    throw new Error(`${path}.placements must be an array.`);
  }

  if (!Array.isArray(value.surfaceColliders)) {
    throw new Error(`${path}.surfaceColliders must be an array.`);
  }

  return {
    environmentAssetId: parseEnvironmentAssetId(
      value.environmentAssetId,
      `${path}.environmentAssetId`
    ),
    placement: assertKnownPlacementId(value.placement, `${path}.placement`),
    placements: value.placements.map((placement, placementIndex) =>
      parsePlacement(placement, `${path}.placements[${placementIndex}]`)
    ),
    surfaceColliders: value.surfaceColliders.map((collider, colliderIndex) =>
      parseSurfaceCollider(
        collider,
        `${path}.surfaceColliders[${colliderIndex}]`
      )
    )
  };
}

function parseWaterRegion(
  value: unknown,
  index: number
): MetaverseWorldWaterRegionAuthoring {
  const path = `waterRegions[${index}]`;
  let parsedSize: MetaverseWorldSurfaceVector3Snapshot;

  assertRecord(value, path);
  parsedSize = parseVector3(value.size, `${path}.size`);

  return {
    center: parseVector3(value.center, `${path}.center`),
    rotationYRadians: assertFiniteNumber(
      value.rotationYRadians,
      `${path}.rotationYRadians`
    ),
    size: {
      x: assertPositiveFiniteNumber(parsedSize.x, `${path}.size.x`),
      y: assertPositiveFiniteNumber(parsedSize.y, `${path}.size.y`),
      z: assertPositiveFiniteNumber(parsedSize.z, `${path}.size.z`)
    },
    waterRegionId: parseWaterRegionId(value.waterRegionId, `${path}.waterRegionId`)
  };
}

function formatNumber(value: number): string {
  if (Object.is(value, -0)) {
    return "-0";
  }

  return `${value}`;
}

function serializeVector3(value: MetaverseWorldSurfaceVector3Snapshot): string {
  return `freezeVector3(${formatNumber(value.x)}, ${formatNumber(value.y)}, ${formatNumber(value.z)})`;
}

function serializeSurfaceCollider(
  collider: MetaverseWorldSurfaceColliderAuthoring
): string {
  return [
    "  Object.freeze({",
    `    center: ${serializeVector3(collider.center)},`,
    `    size: ${serializeVector3(collider.size)},`,
    `    traversalAffordance: ${JSON.stringify(collider.traversalAffordance)}`,
    "  })"
  ].join("\n");
}

function serializeWaterRegion(
  waterRegion: MetaverseWorldWaterRegionAuthoring
): string {
  return [
    "  Object.freeze({",
    `    center: ${serializeVector3(waterRegion.center)},`,
    `    rotationYRadians: ${formatNumber(waterRegion.rotationYRadians)},`,
    `    size: ${serializeVector3(waterRegion.size)},`,
    `    waterRegionId: ${JSON.stringify(waterRegion.waterRegionId)}`,
    "  })"
  ].join("\n");
}

function serializePlacement(
  placement: MetaverseWorldSurfacePlacementSnapshot
): string {
  return [
    "      Object.freeze({",
    `        position: ${serializeVector3(placement.position)},`,
    `        rotationYRadians: ${formatNumber(placement.rotationYRadians)},`,
    `        scale: ${formatNumber(placement.scale)}`,
    "      })"
  ].join("\n");
}

function serializeSurfaceColliderCollection(
  constantName: string,
  colliders: readonly MetaverseWorldSurfaceColliderAuthoring[]
): string {
  if (colliders.length === 0) {
    return [
      `const ${constantName} = Object.freeze(`,
      "  []",
      ") as readonly MetaverseWorldSurfaceColliderAuthoring[];"
    ].join("\n");
  }

  return [
    `const ${constantName} = Object.freeze([`,
    colliders.map((collider) => serializeSurfaceCollider(collider)).join(",\n"),
    "] satisfies readonly MetaverseWorldSurfaceColliderAuthoring[]);"
  ].join("\n");
}

function serializePlacementCollection(
  placements: readonly MetaverseWorldSurfacePlacementSnapshot[]
): string {
  if (placements.length === 0) {
    return "Object.freeze([])";
  }

  return [
    "Object.freeze([",
    placements.map((placement) => serializePlacement(placement)).join(",\n"),
    "    ])"
  ].join("\n");
}

function serializeWaterRegionCollection(
  waterRegions: readonly MetaverseWorldWaterRegionAuthoring[]
): string {
  if (waterRegions.length === 0) {
    return "Object.freeze([])";
  }

  return [
    "Object.freeze([",
    waterRegions.map((waterRegion) => serializeWaterRegion(waterRegion)).join(",\n"),
    "])"
  ].join("\n");
}

function serializeSurfaceAsset(
  asset: MetaverseWorldSurfaceAssetAuthoring,
  metadata: MetaverseWorldAuthoringAssetCodeMetadata
): string {
  return [
    "  Object.freeze({",
    `    environmentAssetId: ${metadata.environmentAssetConstantName},`,
    `    placement: ${JSON.stringify(asset.placement)},`,
    `    placements: ${serializePlacementCollection(asset.placements)},`,
    `    surfaceColliders: ${metadata.surfaceColliderConstantName}`,
    "  })"
  ].join("\n");
}

export function createMetaverseWorldSurfaceAuthoringDocument(): string {
  return JSON.stringify(
    {
      surfaceAssets: metaverseWorldSurfaceAssets,
      waterRegions: metaverseWorldWaterRegions
    } satisfies MetaverseWorldAuthoringDocumentSnapshot,
    null,
    2
  );
}

export function createMetaverseWorldSurfaceAuthoringDocumentFromAssets(
  assets: readonly MetaverseWorldSurfaceAssetAuthoring[],
  waterRegions: readonly MetaverseWorldWaterRegionAuthoring[] = metaverseWorldWaterRegions
): string {
  return JSON.stringify(
    parseMetaverseWorldSurfaceAuthoringDocument(
      JSON.stringify({
        surfaceAssets: assets,
        waterRegions
      } satisfies MetaverseWorldAuthoringDocumentSnapshot)
    ),
    null,
    2
  );
}

export function summarizeMetaverseWorldSurfaceAuthoring(
  document: MetaverseWorldAuthoringDocumentSnapshot
): MetaverseWorldAuthoringSummary {
  return {
    assetCount: document.surfaceAssets.length,
    placementCount: document.surfaceAssets.reduce(
      (count, asset) => count + asset.placements.length,
      0
    ),
    surfaceColliderCount: document.surfaceAssets.reduce(
      (count, asset) => count + asset.surfaceColliders.length,
      0
    ),
    waterRegionCount: document.waterRegions.length
  };
}

export function readMetaverseWorldSurfaceAuthoringPlacement(
  assets: readonly MetaverseWorldSurfaceAssetAuthoring[],
  placementReference: MetaverseWorldAuthoringPlacementReference
): MetaverseWorldSurfacePlacementSnapshot | null {
  const assetIndex = resolveSurfaceAssetIndex(
    assets,
    placementReference.environmentAssetId
  );

  if (assetIndex < 0) {
    return null;
  }

  const asset = assets[assetIndex]!;

  return asset.placements[placementReference.placementIndex] ?? null;
}

export function updateMetaverseWorldSurfaceAuthoringPlacement(
  assets: readonly MetaverseWorldSurfaceAssetAuthoring[],
  placementReference: MetaverseWorldAuthoringPlacementReference,
  nextPlacement: MetaverseWorldSurfacePlacementSnapshot
): readonly MetaverseWorldSurfaceAssetAuthoring[] {
  const { asset, assetIndex } = resolveSurfaceAssetPlacement(
    assets,
    placementReference
  );
  const nextPlacements = asset.placements.map((placement, placementIndex) =>
    placementIndex === placementReference.placementIndex
      ? freezePlacementSnapshot(nextPlacement)
      : placement
  );

  return replaceSurfaceAsset(
    assets,
    assetIndex,
    freezeSurfaceAsset(asset, nextPlacements)
  );
}

export function appendMetaverseWorldSurfaceAuthoringPlacement(
  assets: readonly MetaverseWorldSurfaceAssetAuthoring[],
  environmentAssetId: string
): MetaverseWorldAuthoringPlacementMutationResult {
  const assetIndex = resolveSurfaceAssetIndex(assets, environmentAssetId);

  if (assetIndex < 0) {
    throw new Error(`The world authoring document is missing ${environmentAssetId}.`);
  }

  const asset = assets[assetIndex]!;

  if (asset.placement !== "instanced") {
    throw new Error(
      `${environmentAssetId} does not support adding authored placements.`
    );
  }

  const seedPlacement =
    asset.placements[asset.placements.length - 1] ??
    Object.freeze({
      position: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      rotationYRadians: 0,
      scale: 1
    } satisfies MetaverseWorldSurfacePlacementSnapshot);
  const offsetDistance = Math.max(seedPlacement.scale * 1.5, 1.25);
  const nextPlacement = freezePlacementSnapshot({
    position: {
      x: seedPlacement.position.x + offsetDistance,
      y: seedPlacement.position.y,
      z: seedPlacement.position.z + offsetDistance
    },
    rotationYRadians: seedPlacement.rotationYRadians,
    scale: seedPlacement.scale
  });
  const nextAsset = freezeSurfaceAsset(asset, [
    ...asset.placements,
    nextPlacement
  ]);

  return {
    assets: replaceSurfaceAsset(assets, assetIndex, nextAsset),
    placement: {
      environmentAssetId,
      placementIndex: asset.placements.length
    }
  };
}

export function duplicateMetaverseWorldSurfaceAuthoringPlacement(
  assets: readonly MetaverseWorldSurfaceAssetAuthoring[],
  placementReference: MetaverseWorldAuthoringPlacementReference
): MetaverseWorldAuthoringPlacementMutationResult {
  const { asset, assetIndex, placement } = resolveSurfaceAssetPlacement(
    assets,
    placementReference
  );

  if (asset.placement !== "instanced") {
    throw new Error(
      `${placementReference.environmentAssetId} does not support duplicate placements.`
    );
  }

  const offsetDistance = Math.max(placement.scale * 1.5, 1.25);
  const nextPlacement = freezePlacementSnapshot({
    position: {
      x: placement.position.x + offsetDistance,
      y: placement.position.y,
      z: placement.position.z + offsetDistance
    },
    rotationYRadians: placement.rotationYRadians,
    scale: placement.scale
  });
  const nextAsset = freezeSurfaceAsset(asset, [
    ...asset.placements,
    nextPlacement
  ]);

  return {
    assets: replaceSurfaceAsset(assets, assetIndex, nextAsset),
    placement: {
      environmentAssetId: placementReference.environmentAssetId,
      placementIndex: asset.placements.length
    }
  };
}

export function removeMetaverseWorldSurfaceAuthoringPlacement(
  assets: readonly MetaverseWorldSurfaceAssetAuthoring[],
  placementReference: MetaverseWorldAuthoringPlacementReference
): readonly MetaverseWorldSurfaceAssetAuthoring[] {
  const { asset, assetIndex } = resolveSurfaceAssetPlacement(
    assets,
    placementReference
  );

  if (asset.placement !== "instanced") {
    throw new Error(
      `${placementReference.environmentAssetId} does not support removing authored placements.`
    );
  }

  if (asset.placements.length <= 1) {
    throw new Error(
      `${placementReference.environmentAssetId} must keep at least one placement.`
    );
  }

  const nextPlacements = asset.placements.filter(
    (_, placementIndex) => placementIndex !== placementReference.placementIndex
  );

  return replaceSurfaceAsset(
    assets,
    assetIndex,
    freezeSurfaceAsset(asset, nextPlacements)
  );
}

export function parseMetaverseWorldSurfaceAuthoringDocument(
  documentText: string
): MetaverseWorldAuthoringDocumentSnapshot {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(documentText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The document is not valid JSON.";

    throw new Error(`The world authoring document could not be parsed: ${message}`);
  }

  if (Array.isArray(parsedValue)) {
    throw new Error(
      "The world authoring document must be a top-level object with surfaceAssets and waterRegions arrays."
    );
  }

  assertRecord(parsedValue, "document");

  if (!Array.isArray(parsedValue.surfaceAssets)) {
    throw new Error("document.surfaceAssets must be an array.");
  }

  if (!Array.isArray(parsedValue.waterRegions)) {
    throw new Error("document.waterRegions must be an array.");
  }

  const parsedAssets = parsedValue.surfaceAssets.map((asset, index) =>
    parseSurfaceAsset(asset, index)
  );
  const parsedWaterRegions = parsedValue.waterRegions.map((waterRegion, index) =>
    parseWaterRegion(waterRegion, index)
  );

  if (parsedAssets.length !== metaverseWorldAuthoringExpectedAssetIds.length) {
    throw new Error(
      `The world authoring document must define exactly ${metaverseWorldAuthoringExpectedAssetIds.length} assets.`
    );
  }

  const parsedAssetsById = new Map<string, MetaverseWorldSurfaceAssetAuthoring>();

  for (const asset of parsedAssets) {
    if (parsedAssetsById.has(asset.environmentAssetId)) {
      throw new Error(
        `The world authoring document defines ${asset.environmentAssetId} more than once.`
      );
    }

    parsedAssetsById.set(asset.environmentAssetId, asset);
  }

  const parsedWaterRegionsById = new Map<string, MetaverseWorldWaterRegionAuthoring>();

  for (const waterRegion of parsedWaterRegions) {
    if (parsedWaterRegionsById.has(waterRegion.waterRegionId)) {
      throw new Error(
        `The world authoring document defines ${waterRegion.waterRegionId} more than once.`
      );
    }

    parsedWaterRegionsById.set(waterRegion.waterRegionId, waterRegion);
  }

  for (const environmentAssetId of metaverseWorldAuthoringExpectedAssetIds) {
    if (!parsedAssetsById.has(environmentAssetId)) {
      throw new Error(
        `The world authoring document is missing ${environmentAssetId}.`
      );
    }
  }

  return Object.freeze({
    surfaceAssets: Object.freeze(
      metaverseWorldAuthoringExpectedAssetIds.map((environmentAssetId) => {
        const asset = parsedAssetsById.get(environmentAssetId);

        if (asset === undefined) {
          throw new Error(
            `The world authoring document is missing ${environmentAssetId}.`
          );
        }

        return asset;
      })
    ),
    waterRegions: Object.freeze(
      parsedWaterRegions.map((waterRegion) => {
        const orderedWaterRegion = parsedWaterRegionsById.get(
          waterRegion.waterRegionId
        );

        if (orderedWaterRegion === undefined) {
          throw new Error(
            `The world authoring document is missing ${waterRegion.waterRegionId}.`
          );
        }

        return orderedWaterRegion;
      })
    )
  });
}

export function serializeMetaverseWorldSurfaceAuthoringDataModule(
  document: MetaverseWorldAuthoringDocumentSnapshot
): string {
  const orderedDocument = parseMetaverseWorldSurfaceAuthoringDocument(
    JSON.stringify(document)
  );
  const assetsById = new Map<string, MetaverseWorldSurfaceAssetAuthoring>(
    orderedDocument.surfaceAssets.map((asset) => [asset.environmentAssetId, asset])
  );

  return [
    "import type {",
    "  MetaverseWorldSurfaceAssetAuthoring,",
    "  MetaverseWorldSurfaceColliderAuthoring,",
    "  MetaverseWorldSurfaceVector3Snapshot,",
    "  MetaverseWorldWaterRegionAuthoring",
    '} from "./metaverse-world-surface-authoring.js";',
    "",
    "function freezeVector3(",
    "  x: number,",
    "  y: number,",
    "  z: number",
    "): MetaverseWorldSurfaceVector3Snapshot {",
    "  return Object.freeze({",
    "    x: Number.isFinite(x) ? x : 0,",
    "    y: Number.isFinite(y) ? y : 0,",
    "    z: Number.isFinite(z) ? z : 0",
    "  });",
    "}",
    "",
    ...metaverseWorldAuthoringAssetCodeMetadata.flatMap((metadata) => [
      `export const ${metadata.environmentAssetConstantName} = ${JSON.stringify(metadata.environmentAssetId)};`
    ]),
    "",
    ...metaverseWorldAuthoringAssetCodeMetadata.flatMap((metadata, index) => {
      const asset = assetsById.get(metadata.environmentAssetId);

      if (asset === undefined) {
        throw new Error(
          `The world authoring document is missing ${metadata.environmentAssetId}.`
        );
      }

      const colliderSource = serializeSurfaceColliderCollection(
        metadata.surfaceColliderConstantName,
        asset.surfaceColliders
      );

      return index === metaverseWorldAuthoringAssetCodeMetadata.length - 1
        ? [colliderSource]
        : [colliderSource, ""];
    }),
    "",
    "export const metaverseWorldSurfaceAssets = Object.freeze([",
    orderedDocument.surfaceAssets
      .map((asset) => {
        const metadata = metaverseWorldAuthoringAssetCodeMetadataById.get(
          asset.environmentAssetId
        );

        if (metadata === undefined) {
          throw new Error(
            `The world authoring document references an unsupported asset id: ${asset.environmentAssetId}.`
          );
        }

        return serializeSurfaceAsset(asset, metadata);
      })
      .join(",\n"),
    "] satisfies readonly MetaverseWorldSurfaceAssetAuthoring[]);",
    "",
    "export const metaverseWorldWaterRegions = " +
      serializeWaterRegionCollection(orderedDocument.waterRegions) +
      " satisfies readonly MetaverseWorldWaterRegionAuthoring[];",
    ""
  ].join("\n");
}
