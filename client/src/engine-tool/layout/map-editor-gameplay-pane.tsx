import type { ReactNode } from "react";

import { ChevronDownIcon, FlagIcon } from "lucide-react";
import { listMetaverseGameplayProfiles } from "@webgpu-metaverse/shared/metaverse/world";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { MapEditorLaunchVariationsPanel } from "@/engine-tool/panels/inspector/map-editor-launch-variations-panel";
import type { MapEditorLaunchVariationDraftSnapshot } from "@/engine-tool/project/map-editor-project-launch-variations";
import type { MapEditorProjectSnapshot } from "@/engine-tool/project/map-editor-project-state";

import { composeMapEditorLayoutClassName } from "./map-editor-layout-class-name";

interface MapEditorGameplayPaneProps {
  readonly onAddLaunchVariation: () => void;
  readonly onSectionOpenChange: (sectionId: string, open: boolean) => void;
  readonly onSelectLaunchVariation: (variationId: string) => void;
  readonly onUpdateGameplayProfileId: (gameplayProfileId: string) => void;
  readonly onUpdateLaunchVariation: (
    variationId: string,
    update: (
      draft: MapEditorLaunchVariationDraftSnapshot
    ) => MapEditorLaunchVariationDraftSnapshot
  ) => void;
  readonly project: MapEditorProjectSnapshot;
  readonly readSectionOpen: (sectionId: string, defaultOpen?: boolean) => boolean;
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

export function MapEditorGameplayPane({
  onAddLaunchVariation,
  onSectionOpenChange,
  onSelectLaunchVariation,
  onUpdateGameplayProfileId,
  onUpdateLaunchVariation,
  project,
  readSectionOpen,
  selectedLaunchVariation
}: MapEditorGameplayPaneProps) {
  const gameplayProfiles = listMetaverseGameplayProfiles();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background/84 backdrop-blur-sm">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-muted/70">
          <FlagIcon />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Gameplay
          </p>
          <h2 className="truncate font-heading text-lg font-semibold">
            Profile and Variations
          </h2>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          <Section
            onOpenChange={onSectionOpenChange}
            open={readSectionOpen("gameplay-pane:profile", true)}
            sectionId="gameplay-pane:profile"
            title="Gameplay Profile"
          >
            <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/25 p-3">
              <Label htmlFor="map-editor-gameplay-pane-profile">
                Runtime profile
              </Label>
              <Select
                onValueChange={onUpdateGameplayProfileId}
                value={project.gameplayProfileId}
              >
                <SelectTrigger id="map-editor-gameplay-pane-profile">
                  <SelectValue placeholder="Select gameplay profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {gameplayProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section
            badge={<Badge variant="outline">{project.launchVariationDrafts.length}</Badge>}
            onOpenChange={onSectionOpenChange}
            open={readSectionOpen("gameplay-pane:variations", true)}
            sectionId="gameplay-pane:variations"
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
