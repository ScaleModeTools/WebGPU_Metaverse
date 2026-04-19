import type { EnvironmentAssetDescriptor } from "@/assets/types/environment-asset-manifest";
import { isMapEditorBuildPrimitiveAssetId } from "@/engine-tool/build/map-editor-build-primitives";

export interface MapEditorLibraryAssetGroupsSnapshot {
  readonly props: readonly EnvironmentAssetDescriptor[];
  readonly vehicles: readonly EnvironmentAssetDescriptor[];
}

function isVehicleAssetDescriptor(asset: EnvironmentAssetDescriptor): boolean {
  return (
    asset.traversalAffordance === "mount" ||
    (asset.entries?.length ?? 0) > 0 ||
    (asset.seats?.length ?? 0) > 0
  );
}

export function groupMapEditorLibraryAssets(
  assetCatalogEntries: readonly EnvironmentAssetDescriptor[]
): MapEditorLibraryAssetGroupsSnapshot {
  const props: EnvironmentAssetDescriptor[] = [];
  const vehicles: EnvironmentAssetDescriptor[] = [];

  for (const asset of assetCatalogEntries) {
    if (isMapEditorBuildPrimitiveAssetId(asset.id)) {
      continue;
    }

    if (isVehicleAssetDescriptor(asset)) {
      vehicles.push(asset);
      continue;
    }

    props.push(asset);
  }

  return Object.freeze({
    props: Object.freeze(props),
    vehicles: Object.freeze(vehicles)
  });
}
