import type { EnvironmentAssetDescriptor } from "@/assets/types/environment-asset-manifest";
import {
  environmentPropManifest,
  metaverseBuilderBlockTileEnvironmentAssetId,
  metaverseBuilderFloorTileEnvironmentAssetId,
  metaverseBuilderStepTileEnvironmentAssetId,
  metaverseBuilderWallTileEnvironmentAssetId
} from "@/assets/config/environment-prop-manifest";

export interface MapEditorBuildPrimitiveFootprintSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MapEditorBuildPrimitiveCatalogEntry {
  readonly asset: EnvironmentAssetDescriptor;
  readonly description: string;
  readonly footprint: MapEditorBuildPrimitiveFootprintSnapshot;
}

function requireBuildPrimitiveAsset(
  assetId: string
): EnvironmentAssetDescriptor {
  const assetDescriptor =
    environmentPropManifest.environmentAssets.find((asset) => asset.id === assetId) ??
    null;

  if (assetDescriptor === null) {
    throw new Error(`Map editor build primitive asset ${assetId} is missing.`);
  }

  return assetDescriptor;
}

const mapEditorBuildPrimitiveCatalogEntries = Object.freeze([
  Object.freeze({
    asset: requireBuildPrimitiveAsset(metaverseBuilderFloorTileEnvironmentAssetId),
    description: "Flat support tile for quickly blocking out floors and roofs.",
    footprint: Object.freeze({
      x: 4,
      y: 0.5,
      z: 4
    })
  }),
  Object.freeze({
    asset: requireBuildPrimitiveAsset(metaverseBuilderWallTileEnvironmentAssetId),
    description: "Vertical blocker tile for corridors, cover, and shell walls.",
    footprint: Object.freeze({
      x: 4,
      y: 4,
      z: 0.5
    })
  }),
  Object.freeze({
    asset: requireBuildPrimitiveAsset(metaverseBuilderStepTileEnvironmentAssetId),
    description: "Raised support tile for stairs, trim levels, and stepped cover.",
    footprint: Object.freeze({
      x: 4,
      y: 1,
      z: 4
    })
  }),
  Object.freeze({
    asset: requireBuildPrimitiveAsset(metaverseBuilderBlockTileEnvironmentAssetId),
    description: "Full-height volume tile for chunky cover and quick platform stacks.",
    footprint: Object.freeze({
      x: 4,
      y: 4,
      z: 4
    })
  })
] satisfies readonly MapEditorBuildPrimitiveCatalogEntry[]);

const mapEditorBuildPrimitiveCatalogByAssetId = new Map<
  string,
  MapEditorBuildPrimitiveCatalogEntry
>(
  mapEditorBuildPrimitiveCatalogEntries.map((entry) => [entry.asset.id, entry])
);

export function listMapEditorBuildPrimitiveCatalogEntries(): readonly MapEditorBuildPrimitiveCatalogEntry[] {
  return mapEditorBuildPrimitiveCatalogEntries;
}

export function readMapEditorBuildPrimitiveCatalogEntry(
  assetId: string
): MapEditorBuildPrimitiveCatalogEntry | null {
  return mapEditorBuildPrimitiveCatalogByAssetId.get(assetId) ?? null;
}

export function isMapEditorBuildPrimitiveAssetId(assetId: string): boolean {
  return mapEditorBuildPrimitiveCatalogByAssetId.has(assetId);
}
