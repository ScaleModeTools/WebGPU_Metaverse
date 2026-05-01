import type { ReactNode } from "react";

import { ChevronDownIcon, Globe2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MapEditorLaunchVariationDraftSnapshot } from "@/engine-tool/project/map-editor-project-launch-variations";
import type { MapEditorProjectSnapshot } from "@/engine-tool/project/map-editor-project-state";

import { composeMapEditorLayoutClassName } from "./map-editor-layout-class-name";
import { MapEditorLaunchVariationsPanel } from "../panels/inspector/map-editor-launch-variations-panel";
import { MapEditorMaterialLightingToolsPanel } from "../panels/inspector/map-editor-material-lighting-tools-panel";
import { MapEditorWorldSettingsPanel } from "../panels/inspector/map-editor-world-settings-panel";
import type {
  MapEditorBuilderToolStateSnapshot
} from "@/engine-tool/types/map-editor";

interface MapEditorWorldPaneProps {
  readonly builderToolState: MapEditorBuilderToolStateSnapshot;
  readonly onAddLaunchVariation: () => void;
  readonly onBuilderToolStateChange: (
    update: (
      currentBuilderToolState: MapEditorBuilderToolStateSnapshot
    ) => MapEditorBuilderToolStateSnapshot
  ) => void;
  readonly onSectionOpenChange: (sectionId: string, open: boolean) => void;
  readonly onSelectLaunchVariation: (variationId: string) => void;
  readonly onUpdateEnvironmentPresentation: (
    update: (
      environmentPresentation: MapEditorProjectSnapshot["environmentPresentation"]
    ) => MapEditorProjectSnapshot["environmentPresentation"]
  ) => void;
  readonly onUpdateEnvironmentPresentationProfileId: (
    environmentPresentationProfileId: string | null
  ) => void;
  readonly onUpdateGameplayProfileId: (gameplayProfileId: string) => void;
  readonly onUpdateLaunchVariation: (
    variationId: string,
    update: (
      draft: MapEditorLaunchVariationDraftSnapshot
    ) => MapEditorLaunchVariationDraftSnapshot
  ) => void;
  readonly project: MapEditorProjectSnapshot;
  readonly readSectionOpen: (sectionId: string, defaultOpen?: boolean) => boolean;
  readonly runInProgress: boolean;
  readonly runStatusMessage: string | null;
  readonly selectedLaunchVariation: MapEditorLaunchVariationDraftSnapshot | null;
}

function Section({
  badge,
  children,
  onOpenChange,
  open,
  sectionId,
  title
}: {
  readonly badge?: ReactNode;
  readonly children: ReactNode;
  readonly onOpenChange: (sectionId: string, open: boolean) => void;
  readonly open: boolean;
  readonly sectionId: string;
  readonly title: string;
}) {
  return (
    <Collapsible
      onOpenChange={(nextOpen) => onOpenChange(sectionId, nextOpen)}
      open={open}
    >
      <CollapsibleTrigger asChild>
        <Button className="w-full justify-between px-2" type="button" variant="ghost">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{title}</span>
            {badge}
          </span>
          <ChevronDownIcon
            className={composeMapEditorLayoutClassName(
              "shrink-0 transition-transform",
              open ? "rotate-0" : "-rotate-90"
            )}
            data-icon="inline-end"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function MapEditorWorldPane({
  builderToolState,
  onAddLaunchVariation,
  onBuilderToolStateChange,
  onSectionOpenChange,
  onSelectLaunchVariation,
  onUpdateEnvironmentPresentation,
  onUpdateEnvironmentPresentationProfileId,
  onUpdateGameplayProfileId,
  onUpdateLaunchVariation,
  project,
  readSectionOpen,
  runInProgress,
  runStatusMessage,
  selectedLaunchVariation
}: MapEditorWorldPaneProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background/84 backdrop-blur-sm">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-muted/70">
          <Globe2Icon />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            World
          </p>
          <h2 className="truncate font-heading text-lg font-semibold">
            Bundle, Profiles, Launch
          </h2>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          <Section
            onOpenChange={onSectionOpenChange}
            open={readSectionOpen("world-pane:summary", true)}
            sectionId="world-pane:summary"
            title="Run Summary"
          >
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={runInProgress ? "default" : "outline"}>
                  {runInProgress ? "Exporting Preview" : "Runtime Ready"}
                </Badge>
                {selectedLaunchVariation !== null ? (
                  <Badge variant="secondary">{selectedLaunchVariation.label}</Badge>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Bundle</span>
                  <span className="truncate font-medium">{project.bundleLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Semantic Surfaces</span>
                  <span className="font-medium">
                    {project.surfaceDrafts.length +
                      project.regionDrafts.length +
                      project.edgeDrafts.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Modules</span>
                  <span className="font-medium">{project.placementDrafts.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Gameplay Anchors</span>
                  <span className="font-medium">
                    {project.playerSpawnDrafts.length + project.sceneObjectDrafts.length}
                  </span>
                </div>
              </div>
              {runStatusMessage !== null ? (
                <p className="mt-3 text-sm text-muted-foreground">{runStatusMessage}</p>
              ) : null}
            </div>
          </Section>

          <Section
            onOpenChange={onSectionOpenChange}
            open={readSectionOpen("world-pane:material-lighting-tools", true)}
            sectionId="world-pane:material-lighting-tools"
            title="Material & Light Tools"
          >
            <MapEditorMaterialLightingToolsPanel
              builderToolState={builderToolState}
              onBuilderToolStateChange={onBuilderToolStateChange}
            />
          </Section>

          <Section
            onOpenChange={onSectionOpenChange}
            open={readSectionOpen("world-pane:settings", true)}
            sectionId="world-pane:settings"
            title="World Settings"
          >
            <MapEditorWorldSettingsPanel
              onUpdateEnvironmentPresentation={
                onUpdateEnvironmentPresentation
              }
              onUpdateEnvironmentPresentationProfileId={
                onUpdateEnvironmentPresentationProfileId
              }
              onUpdateGameplayProfileId={onUpdateGameplayProfileId}
              project={project}
            />
          </Section>

          <Section
            badge={<Badge variant="outline">{project.launchVariationDrafts.length}</Badge>}
            onOpenChange={onSectionOpenChange}
            open={readSectionOpen("world-pane:variations", true)}
            sectionId="world-pane:variations"
            title="Launch Setups"
          >
            <MapEditorLaunchVariationsPanel
              launchVariationDrafts={project.launchVariationDrafts}
              onAddLaunchVariation={onAddLaunchVariation}
              onSelectLaunchVariation={onSelectLaunchVariation}
              onUpdateLaunchVariation={onUpdateLaunchVariation}
              selectedLaunchVariation={selectedLaunchVariation}
            />
          </Section>
        </div>
      </ScrollArea>
    </div>
  );
}
