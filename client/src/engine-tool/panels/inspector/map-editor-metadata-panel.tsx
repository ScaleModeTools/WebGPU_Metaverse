import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type MapEditorPlacementDraftSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import type { MapEditorPlacementUpdate } from "@/engine-tool/types/map-editor";

interface MapEditorMetadataPanelProps {
  readonly onUpdateSelectedPlacement: (update: MapEditorPlacementUpdate) => void;
  readonly selectedPlacement: MapEditorPlacementDraftSnapshot | null;
}

export function MapEditorMetadataPanel({
  onUpdateSelectedPlacement,
  selectedPlacement
}: MapEditorMetadataPanelProps) {
  if (selectedPlacement === null) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
        Select a placement to edit metadata and notes.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/25 p-3">
      <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-3">
        <div>
          <p className="text-sm font-medium">Visible</p>
          <p className="text-xs text-muted-foreground">
            Render this placement in the scene preview.
          </p>
        </div>
        <Checkbox
          checked={selectedPlacement.isVisible}
          onCheckedChange={(checked) => {
            onUpdateSelectedPlacement({
              isVisible: checked === true
            });
          }}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-3">
        <div>
          <p className="text-sm font-medium">Collision</p>
          <p className="text-xs text-muted-foreground">
            Keep authored collision enabled for runtime export.
          </p>
        </div>
        <Checkbox
          checked={selectedPlacement.collisionEnabled}
          onCheckedChange={(checked) => {
            onUpdateSelectedPlacement({
              collisionEnabled: checked === true
            });
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="map-editor-notes">Notes</Label>
        <Textarea
          id="map-editor-notes"
          onChange={(event) => {
            onUpdateSelectedPlacement({
              notes: event.target.value
            });
          }}
          placeholder="Authoring notes, gameplay intent, validation reminders..."
          value={selectedPlacement.notes}
        />
      </div>
    </div>
  );
}
