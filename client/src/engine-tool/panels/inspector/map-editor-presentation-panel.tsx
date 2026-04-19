import {
  listMetaverseGameplayProfiles
} from "@webgpu-metaverse/shared/metaverse/world";

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
import { mapEditorMaterialOptions } from "@/engine-tool/config/map-editor-material-options";
import {
  type MapEditorPlacementDraftSnapshot,
  type MapEditorProjectSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import type { MapEditorPlacementUpdate } from "@/engine-tool/types/map-editor";
import { listMetaverseEnvironmentPresentationProfiles } from "@/metaverse/render/environment/profiles";

interface MapEditorPresentationPanelProps {
  readonly onUpdateGameplayProfileId: (gameplayProfileId: string) => void;
  readonly onUpdateEnvironmentPresentationProfileId: (
    environmentPresentationProfileId: string | null
  ) => void;
  readonly onUpdateSelectedPlacement: (update: MapEditorPlacementUpdate) => void;
  readonly project: MapEditorProjectSnapshot;
  readonly selectedPlacement: MapEditorPlacementDraftSnapshot | null;
}

export function MapEditorPresentationPanel({
  onUpdateGameplayProfileId,
  onUpdateEnvironmentPresentationProfileId,
  onUpdateSelectedPlacement,
  project,
  selectedPlacement
}: MapEditorPresentationPanelProps) {
  const gameplayProfiles = listMetaverseGameplayProfiles();
  const selectedMaterialReferenceId =
    selectedPlacement?.materialReferenceId ?? "__default__";
  const environmentPresentationProfiles =
    listMetaverseEnvironmentPresentationProfiles();
  const selectedEnvironmentPresentationProfileId =
    project.environmentPresentationProfileId ?? "__none__";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/25 p-3">
      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">HUD</span>
          <span className="font-medium">{project.hudProfileId ?? "None"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Camera</span>
          <span className="font-medium">{project.cameraProfileId ?? "None"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Character</span>
          <span className="font-medium">
            {project.characterPresentationProfileId ?? "None"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Gameplay</span>
          <span className="font-medium">{project.gameplayProfileId}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Environment</span>
          <span className="font-medium">
            {project.environmentPresentationProfileId ?? "None"}
          </span>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <Label htmlFor="map-editor-gameplay-profile-select">
          Gameplay profile
        </Label>
        <Select
          onValueChange={onUpdateGameplayProfileId}
          value={project.gameplayProfileId}
        >
          <SelectTrigger id="map-editor-gameplay-profile-select">
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

        <Separator />

        <Label htmlFor="map-editor-environment-presentation-select">
          Environment presentation
        </Label>
        <Select
          onValueChange={(nextValue) => {
            onUpdateEnvironmentPresentationProfileId(
              nextValue === "__none__" ? null : nextValue
            );
          }}
          value={selectedEnvironmentPresentationProfileId}
        >
          <SelectTrigger id="map-editor-environment-presentation-select">
            <SelectValue placeholder="Select environment presentation" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__none__">None</SelectItem>
              {environmentPresentationProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Separator />

        <Label htmlFor="map-editor-material-select">Material reference</Label>
        <Select
          disabled={selectedPlacement === null}
          onValueChange={(nextValue) => {
            onUpdateSelectedPlacement({
              materialReferenceId:
                nextValue === "__default__" ? null : nextValue
            });
          }}
          value={selectedMaterialReferenceId}
        >
          <SelectTrigger id="map-editor-material-select">
            <SelectValue placeholder="Select material" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {mapEditorMaterialOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="overflow-hidden rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Label</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mapEditorMaterialOptions.map((option) => (
                <TableRow
                  className={
                    selectedMaterialReferenceId === option.value
                      ? "bg-muted/70"
                      : undefined
                  }
                  key={option.value}
                >
                  <TableCell className="font-mono text-xs">
                    {option.value}
                  </TableCell>
                  <TableCell>{option.label}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
