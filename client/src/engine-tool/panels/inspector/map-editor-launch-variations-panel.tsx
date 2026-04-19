import type {
  ExperienceId,
  GameplaySessionMode
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

function readExperienceId(value: string): ExperienceId | null {
  return value === "duck-hunt" ? "duck-hunt" : null;
}

function readGameplaySessionMode(value: string): GameplaySessionMode | null {
  if (value === "single-player" || value === "co-op") {
    return value;
  }

  return null;
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
          <p className="text-sm font-medium">Saved launch variations</p>
          <p className="text-xs text-muted-foreground">
            Save and run named map variations with authored launch metadata.
          </p>
        </div>
        <Button onClick={onAddLaunchVariation} size="sm" type="button" variant="outline">
          <PlusIcon data-icon="inline-start" />
          New Variation
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variation</TableHead>
            <TableHead>Experience</TableHead>
            <TableHead>Session</TableHead>
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
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {launchVariation.label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {launchVariation.variationId}
                  </span>
                </div>
              </TableCell>
              <TableCell>{launchVariation.experienceId ?? "Shell"}</TableCell>
              <TableCell>{launchVariation.sessionMode ?? "None"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedLaunchVariation === null ? null : (
        <>
          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${selectedLaunchVariation.variationId}-label`}>
                Label
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
              <Label htmlFor={`${selectedLaunchVariation.variationId}-experience`}>
                Experience
              </Label>
              <Select
                onValueChange={(nextValue) => {
                  const nextExperienceId = readExperienceId(nextValue);

                  onUpdateLaunchVariation(selectedLaunchVariation.variationId, (draft) => ({
                    ...draft,
                    experienceId: nextExperienceId,
                    sessionMode:
                      nextExperienceId === null ? null : draft.sessionMode ?? "single-player"
                  }));
                }}
                value={selectedLaunchVariation.experienceId ?? "none"}
              >
                <SelectTrigger id={`${selectedLaunchVariation.variationId}-experience`}>
                  <SelectValue placeholder="Select experience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Shell / Free roam</SelectItem>
                    <SelectItem value="duck-hunt">Duck Hunt</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${selectedLaunchVariation.variationId}-session`}>
                Session
              </Label>
              <Select
                onValueChange={(nextValue) => {
                  const nextSessionMode = readGameplaySessionMode(nextValue);

                  onUpdateLaunchVariation(selectedLaunchVariation.variationId, (draft) => ({
                    ...draft,
                    sessionMode: draft.experienceId === null ? null : nextSessionMode
                  }));
                }}
                value={selectedLaunchVariation.sessionMode ?? "none"}
              >
                <SelectTrigger id={`${selectedLaunchVariation.variationId}-session`}>
                  <SelectValue placeholder="Select session mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No session</SelectItem>
                    <SelectItem value="single-player">Single-player</SelectItem>
                    <SelectItem value="co-op">Co-op</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${selectedLaunchVariation.variationId}-gameplay-variation`}>
                Game Variation
              </Label>
              <Input
                id={`${selectedLaunchVariation.variationId}-gameplay-variation`}
                onChange={(event) => {
                  const nextValue = event.target.value.trim();

                  onUpdateLaunchVariation(selectedLaunchVariation.variationId, (draft) => ({
                    ...draft,
                    gameplayVariationId: nextValue.length === 0 ? null : nextValue
                  }));
                }}
                value={selectedLaunchVariation.gameplayVariationId ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${selectedLaunchVariation.variationId}-weapon-layout`}>
                Weapon Layout
              </Label>
              <Input
                id={`${selectedLaunchVariation.variationId}-weapon-layout`}
                onChange={(event) => {
                  const nextValue = event.target.value.trim();

                  onUpdateLaunchVariation(selectedLaunchVariation.variationId, (draft) => ({
                    ...draft,
                    weaponLayoutId: nextValue.length === 0 ? null : nextValue
                  }));
                }}
                value={selectedLaunchVariation.weaponLayoutId ?? ""}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${selectedLaunchVariation.variationId}-vehicle-layout`}>
                Vehicle Layout
              </Label>
              <Input
                id={`${selectedLaunchVariation.variationId}-vehicle-layout`}
                onChange={(event) => {
                  const nextValue = event.target.value.trim();

                  onUpdateLaunchVariation(selectedLaunchVariation.variationId, (draft) => ({
                    ...draft,
                    vehicleLayoutId: nextValue.length === 0 ? null : nextValue
                  }));
                }}
                value={selectedLaunchVariation.vehicleLayoutId ?? ""}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${selectedLaunchVariation.variationId}-description`}>
              Description
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
              value={selectedLaunchVariation.description}
            />
          </div>
        </>
      )}
    </div>
  );
}
