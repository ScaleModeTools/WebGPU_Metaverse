import { RotateCwIcon, SaveIcon } from "lucide-react";

import type { MetaverseWorldBundleRegistryEntry } from "@/metaverse/world/bundle-registry";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MapEditorViewportToolMode } from "@/engine-tool/types/map-editor";

interface MapEditorToolbarProps {
  readonly activeBuildPrimitiveLabel: string | null;
  readonly onBundleChange: (bundleId: string) => void;
  readonly onResetDraftRequest: () => void;
  readonly onSaveDraftRequest: () => void;
  readonly registryEntries: readonly MetaverseWorldBundleRegistryEntry[];
  readonly selectedBundleId: string;
  readonly viewportToolMode: MapEditorViewportToolMode;
  readonly onViewportToolModeChange: (
    viewportToolMode: MapEditorViewportToolMode
  ) => void;
}

function readViewportToolMode(
  nextValue: string
): MapEditorViewportToolMode | null {
  if (
    nextValue === "build" ||
    nextValue === "move" ||
    nextValue === "rotate" ||
    nextValue === "scale"
  ) {
    return nextValue;
  }

  return null;
}

export function MapEditorToolbar({
  activeBuildPrimitiveLabel,
  onBundleChange,
  onResetDraftRequest,
  onSaveDraftRequest,
  registryEntries,
  selectedBundleId,
  viewportToolMode,
  onViewportToolModeChange
}: MapEditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border/70 px-4 py-3">
      <div className="flex min-w-[15rem] flex-col gap-2">
        <Label htmlFor="map-editor-bundle-select">Map bundle</Label>
        <Select onValueChange={onBundleChange} value={selectedBundleId}>
          <SelectTrigger id="map-editor-bundle-select">
            <SelectValue placeholder="Select bundle" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {registryEntries.map((entry) => (
                <SelectItem key={entry.bundleId} value={entry.bundleId}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Separator className="hidden h-10 md:block" orientation="vertical" />

      <div className="flex flex-col gap-2">
        <Label>Viewport tool</Label>
        <ToggleGroup
          onValueChange={(nextValue) => {
            const nextViewportToolMode = readViewportToolMode(nextValue);

            if (nextViewportToolMode !== null) {
              onViewportToolModeChange(nextViewportToolMode);
            }
          }}
          spacing={0}
          type="single"
          value={viewportToolMode}
          variant="outline"
        >
          <ToggleGroupItem value="build">Build</ToggleGroupItem>
          <ToggleGroupItem value="move">Move</ToggleGroupItem>
          <ToggleGroupItem value="rotate">Rotate</ToggleGroupItem>
          <ToggleGroupItem value="scale">Scale</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator className="hidden h-10 md:block" orientation="vertical" />

      <Button onClick={onResetDraftRequest} type="button" variant="outline">
        <RotateCwIcon data-icon="inline-start" />
        Reset Draft
      </Button>

      <Button onClick={onSaveDraftRequest} type="button" variant="outline">
        <SaveIcon data-icon="inline-start" />
        Save Draft
      </Button>

      <div className="ml-auto max-w-xl text-sm text-muted-foreground">
        {viewportToolMode === "build" && activeBuildPrimitiveLabel !== null
          ? `Build mode is armed with ${activeBuildPrimitiveLabel}. Click the viewport to stamp snapped primitives while authoring truth stays in tool project state.`
          : "The viewport owns scene interaction only. Authoring truth stays in tool project state and inspector panels."}
      </div>
    </div>
  );
}
