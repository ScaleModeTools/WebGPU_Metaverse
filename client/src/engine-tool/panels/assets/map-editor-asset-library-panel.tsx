import { PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createStableCountReserveTexts,
  StableInlineText
} from "@/components/text-stability";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { EnvironmentAssetDescriptor } from "@/assets/types/environment-asset-manifest";
import type { MapEditorProjectSnapshot } from "@/engine-tool/project/map-editor-project-state";

interface MapEditorAssetLibraryPanelProps {
  readonly assetCatalogEntries: readonly EnvironmentAssetDescriptor[];
  readonly onAddPlacementFromAsset: (asset: EnvironmentAssetDescriptor) => void;
  readonly project: MapEditorProjectSnapshot;
}

const placedCountReserveTexts = createStableCountReserveTexts("placed", "placed");

function countPlacementsForAsset(
  project: MapEditorProjectSnapshot,
  assetId: string
): number {
  return project.placementDrafts.reduce((count, placement) => {
    return placement.assetId === assetId ? count + 1 : count;
  }, 0);
}

export function MapEditorAssetLibraryPanel({
  assetCatalogEntries,
  onAddPlacementFromAsset,
  project
}: MapEditorAssetLibraryPanelProps) {
  if (assetCatalogEntries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
        No assets match this filter.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/25">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Placement</TableHead>
            <TableHead>Live</TableHead>
            <TableHead className="text-right">Add</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assetCatalogEntries.map((asset) => {
            const placementCount = countPlacementsForAsset(project, asset.id);

            return (
              <TableRow key={asset.id}>
                <TableCell className="align-top">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{asset.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      <StableInlineText stabilizeNumbers={false} text={asset.id} />
                    </span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="outline">
                        <StableInlineText
                          stabilizeNumbers={false}
                          text={asset.placement}
                        />
                      </Badge>
                      <Badge variant="secondary">
                        <StableInlineText
                          stabilizeNumbers={false}
                          text={asset.traversalAffordance}
                        />
                      </Badge>
                      {(asset.seats?.length ?? 0) > 0 ? (
                        <Badge variant="outline">
                          <StableInlineText
                            stabilizeNumbers={false}
                            text={`${asset.seats?.length ?? 0} seats`}
                          />
                        </Badge>
                      ) : null}
                      {(asset.entries?.length ?? 0) > 0 ? (
                        <Badge variant="outline">
                          <StableInlineText
                            stabilizeNumbers={false}
                            text={`${asset.entries?.length ?? 0} entries`}
                          />
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top text-sm text-muted-foreground">
                  <StableInlineText stabilizeNumbers={false} text={asset.placement} />
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant="outline">
                    <StableInlineText
                      reserveTexts={placedCountReserveTexts}
                      text={`${placementCount} placed`}
                    />
                  </Badge>
                </TableCell>
                <TableCell className="align-top text-right">
                  <Button
                    onClick={() => onAddPlacementFromAsset(asset)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <PlusIcon data-icon="inline-start" />
                    <StableInlineText stabilizeNumbers={false} text="Add" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
