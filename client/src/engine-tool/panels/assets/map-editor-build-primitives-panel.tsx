import { Grid3X3Icon, PlusIcon, WandSparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  createStableCountReserveTexts,
  StableInlineText
} from "@/components/text-stability";
import type { EnvironmentAssetDescriptor } from "@/assets/types/environment-asset-manifest";
import type { MapEditorProjectSnapshot } from "@/engine-tool/project/map-editor-project-state";
import type { MapEditorBuildPrimitiveCatalogEntry } from "@/engine-tool/build/map-editor-build-primitives";

interface MapEditorBuildPrimitivesPanelProps {
  readonly activeBuildPrimitiveAssetId: string | null;
  readonly entries: readonly MapEditorBuildPrimitiveCatalogEntry[];
  readonly onActivateBuildPrimitiveAssetId: (assetId: string) => void;
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

export function MapEditorBuildPrimitivesPanel({
  activeBuildPrimitiveAssetId,
  entries,
  onActivateBuildPrimitiveAssetId,
  onAddPlacementFromAsset,
  project
}: MapEditorBuildPrimitivesPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
        Modular primitives are the fast path for blocking out maps. The current
        slice is box-based and snap-friendly so floors, walls, steps, and
        stacked cover can be authored quickly before prettier assets land.
      </div>

      <div className="grid gap-3">
        {entries.map((entry) => {
          const placementCount = countPlacementsForAsset(project, entry.asset.id);
          const isActiveBuildPrimitive =
            activeBuildPrimitiveAssetId === entry.asset.id;

          return (
            <Card
              className={
                isActiveBuildPrimitive
                  ? "border-sky-400/70 bg-sky-500/5 shadow-[0_0_0_1px_rgb(56_189_248/0.16)]"
                  : undefined
              }
              key={entry.asset.id}
            >
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/70">
                      <Grid3X3Icon />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">
                        {entry.asset.label}
                      </CardTitle>
                      <CardDescription>{entry.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActiveBuildPrimitive ? (
                      <Badge variant="secondary">
                        <StableInlineText
                          stabilizeNumbers={false}
                          text="Active Brush"
                        />
                      </Badge>
                    ) : null}
                    <Badge variant="outline">
                      <StableInlineText
                        reserveTexts={placedCountReserveTexts}
                        text={`${placementCount} placed`}
                      />
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">
                    <StableInlineText stabilizeNumbers={false} text={entry.asset.traversalAffordance} />
                  </Badge>
                  <Badge variant="outline">
                    <StableInlineText
                      stabilizeNumbers={false}
                      text={`${entry.footprint.x}m x ${entry.footprint.y}m x ${entry.footprint.z}m`}
                    />
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => onActivateBuildPrimitiveAssetId(entry.asset.id)}
                    size="sm"
                    type="button"
                    variant={isActiveBuildPrimitive ? "default" : "secondary"}
                  >
                    <WandSparklesIcon data-icon="inline-start" />
                    <StableInlineText
                      stabilizeNumbers={false}
                      text={isActiveBuildPrimitive ? "Brush Armed" : "Use Brush"}
                    />
                  </Button>
                  <Button
                    onClick={() => onAddPlacementFromAsset(entry.asset)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <PlusIcon data-icon="inline-start" />
                    <StableInlineText stabilizeNumbers={false} text="Add Tile" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
