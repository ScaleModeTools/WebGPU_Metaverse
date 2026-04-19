import { useDeferredValue, useMemo, useState } from "react";

import { FolderTreeIcon } from "lucide-react";

import type { EnvironmentAssetDescriptor } from "@/assets/types/environment-asset-manifest";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  listMapEditorBuildPrimitiveCatalogEntries
} from "@/engine-tool/build/map-editor-build-primitives";
import { groupMapEditorLibraryAssets } from "@/engine-tool/library/map-editor-library-asset-groups";
import type { MapEditorProjectSnapshot } from "@/engine-tool/project/map-editor-project-state";

import { MapEditorAssetLibraryPanel } from "../panels/assets/map-editor-asset-library-panel";
import { MapEditorBuildPrimitivesPanel } from "../panels/assets/map-editor-build-primitives-panel";
import { MapEditorSceneRuntimePanel } from "../panels/scene/map-editor-scene-runtime-panel";
import { MapEditorSceneExplorerPanel } from "../panels/scene-explorer/map-editor-scene-explorer-panel";

interface MapEditorLibraryPaneProps {
  readonly activeBuildPrimitiveAssetId: string | null;
  readonly assetCatalogEntries: readonly EnvironmentAssetDescriptor[];
  readonly onAddPlayerSpawn: () => void;
  readonly onActivateBuildPrimitiveAssetId: (assetId: string) => void;
  readonly onAddPlacementFromAsset: (asset: EnvironmentAssetDescriptor) => void;
  readonly onAddSceneObject: () => void;
  readonly onAddWaterRegion: () => void;
  readonly onSelectPlacementId: (placementId: string) => void;
  readonly project: MapEditorProjectSnapshot;
}

function filterAssetCatalogEntries(
  assetCatalogEntries: readonly EnvironmentAssetDescriptor[],
  searchQuery: string
): readonly EnvironmentAssetDescriptor[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return assetCatalogEntries;
  }

  return assetCatalogEntries.filter((asset) => {
    return (
      asset.label.toLowerCase().includes(normalizedQuery) ||
      asset.id.toLowerCase().includes(normalizedQuery) ||
      asset.placement.toLowerCase().includes(normalizedQuery) ||
      asset.traversalAffordance.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function MapEditorLibraryPane({
  activeBuildPrimitiveAssetId,
  assetCatalogEntries,
  onAddPlayerSpawn,
  onActivateBuildPrimitiveAssetId,
  onAddPlacementFromAsset,
  onAddSceneObject,
  onAddWaterRegion,
  onSelectPlacementId,
  project
}: MapEditorLibraryPaneProps) {
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const deferredAssetSearchQuery = useDeferredValue(assetSearchQuery);
  const buildPrimitiveEntries = useMemo(
    () => listMapEditorBuildPrimitiveCatalogEntries(),
    []
  );
  const libraryAssetGroups = useMemo(
    () => groupMapEditorLibraryAssets(assetCatalogEntries),
    [assetCatalogEntries]
  );
  const filteredPropAssets = useMemo(() => {
    return filterAssetCatalogEntries(
      libraryAssetGroups.props,
      deferredAssetSearchQuery
    );
  }, [deferredAssetSearchQuery, libraryAssetGroups.props]);
  const filteredVehicleAssets = useMemo(() => {
    return filterAssetCatalogEntries(
      libraryAssetGroups.vehicles,
      deferredAssetSearchQuery
    );
  }, [deferredAssetSearchQuery, libraryAssetGroups.vehicles]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background/84 backdrop-blur-sm">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-muted/70">
          <FolderTreeIcon />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Library
          </p>
          <h2 className="truncate font-heading text-lg font-semibold">
            Scene, Placed, Build, Props, Vehicles
          </h2>
        </div>
      </div>

      <Tabs
        className="flex min-h-0 flex-1 flex-col overflow-hidden p-4"
        defaultValue="scene"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="scene">Scene</TabsTrigger>
          <TabsTrigger value="placed">Placed</TabsTrigger>
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="props">Props</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-3 min-h-0 flex-1 overflow-hidden" value="scene">
          <ScrollArea className="h-full">
            <MapEditorSceneRuntimePanel
              onAddPlayerSpawn={onAddPlayerSpawn}
              onAddSceneObject={onAddSceneObject}
              onAddWaterRegion={onAddWaterRegion}
              project={project}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent className="mt-3 min-h-0 flex-1 overflow-hidden" value="placed">
          <ScrollArea className="h-full">
            <MapEditorSceneExplorerPanel
              onSelectPlacementId={onSelectPlacementId}
              project={project}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent className="mt-3 min-h-0 flex-1 overflow-hidden" value="build">
          <ScrollArea className="h-full">
            <MapEditorBuildPrimitivesPanel
              activeBuildPrimitiveAssetId={activeBuildPrimitiveAssetId}
              entries={buildPrimitiveEntries}
              onActivateBuildPrimitiveAssetId={onActivateBuildPrimitiveAssetId}
              onAddPlacementFromAsset={onAddPlacementFromAsset}
              project={project}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent className="mt-3 min-h-0 flex-1 overflow-hidden" value="props">
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
            <Input
              onChange={(event) => setAssetSearchQuery(event.target.value)}
              placeholder="Search props, ids, placement, affordance..."
              value={assetSearchQuery}
            />

            <ScrollArea className="min-h-0 flex-1">
              <MapEditorAssetLibraryPanel
                assetCatalogEntries={filteredPropAssets}
                onAddPlacementFromAsset={onAddPlacementFromAsset}
                project={project}
              />
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent className="mt-3 min-h-0 flex-1 overflow-hidden" value="vehicles">
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
            <Input
              onChange={(event) => setAssetSearchQuery(event.target.value)}
              placeholder="Search vehicles, mounts, ids..."
              value={assetSearchQuery}
            />

            <ScrollArea className="min-h-0 flex-1">
              <MapEditorAssetLibraryPanel
                assetCatalogEntries={filteredVehicleAssets}
                onAddPlacementFromAsset={onAddPlacementFromAsset}
                project={project}
              />
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
