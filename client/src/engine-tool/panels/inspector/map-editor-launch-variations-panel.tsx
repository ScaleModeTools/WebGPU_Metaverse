import type {
  MetaverseMatchModeId
} from "@webgpu-metaverse/shared";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { MapEditorLaunchVariationDraftSnapshot } from "@/engine-tool/project/map-editor-project-launch-variations";

interface MapEditorLaunchVariationsPanelProps {
  readonly launchVariationDrafts: readonly MapEditorLaunchVariationDraftSnapshot[];
  readonly onAddLaunchVariation: () => void;
  readonly onSelectLaunchVariation: (variationId: string) => void;
  readonly onUpdateLaunchVariation: (
    variationId: string,
    update: (
      draft: MapEditorLaunchVariationDraftSnapshot
    ) => MapEditorLaunchVariationDraftSnapshot
  ) => void;
  readonly selectedLaunchVariation: MapEditorLaunchVariationDraftSnapshot | null;
}

type MapEditorLaunchModeId =
  | "duck-hunt-preview"
  | "metaverse-free-roam"
  | "metaverse-team-deathmatch";

const sceneDefaultLayoutSelectValue = "scene-default";

function resolveLaunchModeId(
  launchVariation: MapEditorLaunchVariationDraftSnapshot
): MapEditorLaunchModeId {
  if (launchVariation.experienceId === "duck-hunt") {
    return "duck-hunt-preview";
  }

  return launchVariation.matchMode === "team-deathmatch"
    ? "metaverse-team-deathmatch"
    : "metaverse-free-roam";
}

function readLaunchModeUpdate(value: string): Pick<
  MapEditorLaunchVariationDraftSnapshot,
  "experienceId" | "gameplayVariationId" | "matchMode"
> | null {
  if (value === "duck-hunt-preview") {
    return {
      experienceId: "duck-hunt",
      gameplayVariationId: null,
      matchMode: "free-roam"
    };
  }

  if (value === "metaverse-free-roam") {
    return {
      experienceId: null,
      gameplayVariationId: null,
      matchMode: "free-roam"
    };
  }

  if (value === "metaverse-team-deathmatch") {
    return {
      experienceId: null,
      gameplayVariationId: null,
      matchMode: "team-deathmatch"
    };
  }

  return null;
}

function formatLaunchModeLabel(
  launchVariation: MapEditorLaunchVariationDraftSnapshot
): string {
  switch (resolveLaunchModeId(launchVariation)) {
    case "duck-hunt-preview":
      return "Duck Hunt Preview";
    case "metaverse-team-deathmatch":
      return "Team Deathmatch";
    case "metaverse-free-roam":
      return "Free Roam";
  }
}

function formatMatchModeLabel(matchMode: MetaverseMatchModeId | null): string {
  return matchMode === "team-deathmatch" ? "Team Deathmatch" : "Free Roam";
}

export function MapEditorLaunchVariationsPanel({
  launchVariationDrafts,
  onAddLaunchVariation,
  onSelectLaunchVariation,
  onUpdateLaunchVariation,
  selectedLaunchVariation
}: MapEditorLaunchVariationsPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/25 p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Launch setups</p>
          <p className="text-xs text-muted-foreground">
            Validate + Run uses Scene Default when no setup is saved.
          </p>
        </div>
        <Button onClick={onAddLaunchVariation} size="sm" type="button" variant="outline">
          <PlusIcon data-icon="inline-start" />
          New Setup
        </Button>
      </div>

      {launchVariationDrafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-background/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Scene Default</span>
            <span className="text-xs text-muted-foreground">Free Roam</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Authored spawns, pickups, and vehicles drive the preview.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setup</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Scene Content</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {launchVariationDrafts.map((launchVariation) => (
              <TableRow
                className="cursor-pointer"
                data-state={
                  selectedLaunchVariation?.variationId === launchVariation.variationId
                    ? "selected"
                    : undefined
                }
                key={launchVariation.variationId}
                onClick={() => {
                  onSelectLaunchVariation(launchVariation.variationId);
                }}
              >
                <TableCell>
                  <span className="truncate text-sm font-medium">
                    {launchVariation.label}
                  </span>
                </TableCell>
                <TableCell>{formatLaunchModeLabel(launchVariation)}</TableCell>
                <TableCell>Scene Default</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selectedLaunchVariation === null ? null : (
        <>
          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${selectedLaunchVariation.variationId}-label`}>
                Name
              </Label>
              <Input
                id={`${selectedLaunchVariation.variationId}-label`}
                onChange={(event) => {
                  const nextLabel = event.target.value;

                  onUpdateLaunchVariation(selectedLaunchVariation.variationId, (draft) => ({
                    ...draft,
                    label: nextLabel
                  }));
                }}
                value={selectedLaunchVariation.label}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${selectedLaunchVariation.variationId}-mode`}>
                Launch Mode
              </Label>
              <Select
                onValueChange={(nextValue) => {
                  const nextLaunchMode = readLaunchModeUpdate(nextValue);

                  if (nextLaunchMode === null) {
                    return;
                  }

                  onUpdateLaunchVariation(selectedLaunchVariation.variationId, (draft) => ({
                    ...draft,
                    ...nextLaunchMode,
                    vehicleLayoutId: null,
                    weaponLayoutId: null
                  }));
                }}
                value={resolveLaunchModeId(selectedLaunchVariation)}
              >
                <SelectTrigger id={`${selectedLaunchVariation.variationId}-mode`}>
                  <SelectValue placeholder="Select launch mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="metaverse-free-roam">Free Roam</SelectItem>
                    <SelectItem value="metaverse-team-deathmatch">
                      Team Deathmatch
                    </SelectItem>
                    <SelectItem value="duck-hunt-preview">Duck Hunt Preview</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${selectedLaunchVariation.variationId}-weapon-layout`}>
                Starting Weapons
              </Label>
              <Select
                onValueChange={(nextValue) => {
                  if (nextValue !== sceneDefaultLayoutSelectValue) {
                    return;
                  }

                  onUpdateLaunchVariation(selectedLaunchVariation.variationId, (draft) => ({
                    ...draft,
                    weaponLayoutId: null
                  }));
                }}
                value={sceneDefaultLayoutSelectValue}
              >
                <SelectTrigger id={`${selectedLaunchVariation.variationId}-weapon-layout`}>
                  <SelectValue placeholder="Select weapon setup" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={sceneDefaultLayoutSelectValue}>
                      Scene Default
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${selectedLaunchVariation.variationId}-vehicle-layout`}>
                Vehicles
              </Label>
              <Select
                onValueChange={(nextValue) => {
                  if (nextValue !== sceneDefaultLayoutSelectValue) {
                    return;
                  }

                  onUpdateLaunchVariation(selectedLaunchVariation.variationId, (draft) => ({
                    ...draft,
                    vehicleLayoutId: null
                  }));
                }}
                value={sceneDefaultLayoutSelectValue}
              >
                <SelectTrigger id={`${selectedLaunchVariation.variationId}-vehicle-layout`}>
                  <SelectValue placeholder="Select vehicle setup" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={sceneDefaultLayoutSelectValue}>
                      Scene Default
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${selectedLaunchVariation.variationId}-description`}>
              Notes
            </Label>
            <Textarea
              id={`${selectedLaunchVariation.variationId}-description`}
              onChange={(event) => {
                onUpdateLaunchVariation(selectedLaunchVariation.variationId, (draft) => ({
                  ...draft,
                  description: event.target.value
                }));
              }}
              rows={3}
              placeholder={`${formatMatchModeLabel(
                selectedLaunchVariation.matchMode
              )} setup notes`}
              value={selectedLaunchVariation.description}
            />
          </div>
        </>
      )}
    </div>
  );
}
