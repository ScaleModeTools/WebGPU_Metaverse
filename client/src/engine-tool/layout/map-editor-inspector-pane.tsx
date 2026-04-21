import { ChevronDownIcon, Settings2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type MapEditorLaunchVariationDraftSnapshot
} from "@/engine-tool/project/map-editor-project-launch-variations";
import type {
  MapEditorPlayerSpawnSelectionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-player-spawn-selection";
import {
  type MapEditorPlayerSpawnDraftSnapshot,
  type MapEditorSceneObjectDraftSnapshot,
  type MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import {
  type MapEditorPlacementDraftSnapshot,
  type MapEditorProjectSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import type { MapEditorPlacementUpdate } from "@/engine-tool/types/map-editor";

import { MapEditorMetadataPanel } from "../panels/inspector/map-editor-metadata-panel";
import { MapEditorLaunchVariationsPanel } from "../panels/inspector/map-editor-launch-variations-panel";
import { MapEditorPresentationPanel } from "../panels/inspector/map-editor-presentation-panel";
import { MapEditorSceneAnchorsPanel } from "../panels/inspector/map-editor-scene-anchors-panel";
import { MapEditorTransformPanel } from "../panels/inspector/map-editor-transform-panel";
import { MapEditorWaterRegionsPanel } from "../panels/inspector/map-editor-water-regions-panel";
interface MapEditorInspectorPaneProps {
  readonly onAddLaunchVariation: () => void;
  readonly onUpdateGameplayProfileId: (gameplayProfileId: string) => void;
  readonly onSelectLaunchVariation: (variationId: string) => void;
  readonly onUpdateEnvironmentPresentationProfileId: (
    environmentPresentationProfileId: string | null
  ) => void;
  readonly onUpdateSelectedPlacement: (update: MapEditorPlacementUpdate) => void;
  readonly onUpdateLaunchVariation: (
    variationId: string,
    update: (
      draft: MapEditorLaunchVariationDraftSnapshot
    ) => MapEditorLaunchVariationDraftSnapshot
  ) => void;
  readonly onUpdatePlayerSpawnSelection: (
    update: (
      draft: MapEditorPlayerSpawnSelectionDraftSnapshot
    ) => MapEditorPlayerSpawnSelectionDraftSnapshot
  ) => void;
  readonly onUpdatePlayerSpawn: (
    spawnId: string,
    update: (draft: MapEditorPlayerSpawnDraftSnapshot) => MapEditorPlayerSpawnDraftSnapshot
  ) => void;
  readonly onUpdateSceneObject: (
    objectId: string,
    update: (draft: MapEditorSceneObjectDraftSnapshot) => MapEditorSceneObjectDraftSnapshot
  ) => void;
  readonly onUpdateWaterRegion: (
    waterRegionId: string,
    update: (draft: MapEditorWaterRegionDraftSnapshot) => MapEditorWaterRegionDraftSnapshot
  ) => void;
  readonly project: MapEditorProjectSnapshot;
  readonly selectedLaunchVariation: MapEditorLaunchVariationDraftSnapshot | null;
  readonly selectedPlacement: MapEditorPlacementDraftSnapshot | null;
}

export function MapEditorInspectorPane({
  onAddLaunchVariation,
  onUpdateGameplayProfileId,
  onSelectLaunchVariation,
  onUpdateEnvironmentPresentationProfileId,
  onUpdateSelectedPlacement,
  onUpdateLaunchVariation,
  onUpdatePlayerSpawnSelection,
  onUpdatePlayerSpawn,
  onUpdateSceneObject,
  onUpdateWaterRegion,
  project,
  selectedLaunchVariation,
  selectedPlacement
}: MapEditorInspectorPaneProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-t border-border/70 bg-background/84 backdrop-blur-sm">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-muted/70">
          <Settings2Icon />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Inspector
          </p>
          <h2 className="truncate font-heading text-lg font-semibold">
            Authoring Panels
          </h2>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-col gap-4 p-4">
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button className="w-full justify-between" type="button" variant="ghost">
                Launch Variations
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <MapEditorLaunchVariationsPanel
                launchVariationDrafts={project.launchVariationDrafts}
                onAddLaunchVariation={onAddLaunchVariation}
                onSelectLaunchVariation={onSelectLaunchVariation}
                onUpdateLaunchVariation={onUpdateLaunchVariation}
                selectedLaunchVariation={selectedLaunchVariation}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button className="w-full justify-between" type="button" variant="ghost">
                Scene Anchors
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <MapEditorSceneAnchorsPanel
                onUpdatePlayerSpawnSelection={onUpdatePlayerSpawnSelection}
                onUpdatePlayerSpawn={onUpdatePlayerSpawn}
                onUpdateSceneObject={onUpdateSceneObject}
                playerSpawnDrafts={project.playerSpawnDrafts}
                playerSpawnSelectionDraft={project.playerSpawnSelectionDraft}
                sceneObjectDrafts={project.sceneObjectDrafts}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button className="w-full justify-between" type="button" variant="ghost">
                Water
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <MapEditorWaterRegionsPanel
                onUpdateWaterRegion={onUpdateWaterRegion}
                waterRegionDrafts={project.waterRegionDrafts}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button className="w-full justify-between" type="button" variant="ghost">
                Transform
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <MapEditorTransformPanel
                onUpdateSelectedPlacement={onUpdateSelectedPlacement}
                selectedPlacement={selectedPlacement}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button className="w-full justify-between" type="button" variant="ghost">
                Materials And Presentation
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <MapEditorPresentationPanel
                onUpdateGameplayProfileId={onUpdateGameplayProfileId}
                onUpdateEnvironmentPresentationProfileId={
                  onUpdateEnvironmentPresentationProfileId
                }
                onUpdateSelectedPlacement={onUpdateSelectedPlacement}
                project={project}
                selectedPlacement={selectedPlacement}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button className="w-full justify-between" type="button" variant="ghost">
                Metadata
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <MapEditorMetadataPanel
                onUpdateSelectedPlacement={onUpdateSelectedPlacement}
                selectedPlacement={selectedPlacement}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
