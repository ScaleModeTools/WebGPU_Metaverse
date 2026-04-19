import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { MapEditorWaterRegionDraftSnapshot } from "@/engine-tool/project/map-editor-project-scene-drafts";

function resolveFiniteNumber(value: string): number | null {
  const nextValue = Number(value);

  return Number.isFinite(nextValue) ? nextValue : null;
}

interface MapEditorWaterRegionsPanelProps {
  readonly onUpdateWaterRegion: (
    waterRegionId: string,
    update: (draft: MapEditorWaterRegionDraftSnapshot) => MapEditorWaterRegionDraftSnapshot
  ) => void;
  readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
}

export function MapEditorWaterRegionsPanel({
  onUpdateWaterRegion,
  waterRegionDrafts
}: MapEditorWaterRegionsPanelProps) {
  if (waterRegionDrafts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
        No authored water regions exist for this map.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/25 p-3">
      {waterRegionDrafts.map((waterRegionDraft) => (
        <div className="flex flex-col gap-4" key={waterRegionDraft.waterRegionId}>
          <div>
            <p className="text-sm font-medium">Water Region</p>
            <p className="text-xs text-muted-foreground">
              {waterRegionDraft.waterRegionId}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${waterRegionDraft.waterRegionId}-center-x`}>
                Center X
              </Label>
              <Input
                id={`${waterRegionDraft.waterRegionId}-center-x`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdateWaterRegion(waterRegionDraft.waterRegionId, (draft) => ({
                      ...draft,
                      center: {
                        ...draft.center,
                        x: nextValue
                      }
                    }));
                  }
                }}
                value={waterRegionDraft.center.x.toFixed(2)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${waterRegionDraft.waterRegionId}-center-y`}>
                Center Y
              </Label>
              <Input
                id={`${waterRegionDraft.waterRegionId}-center-y`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdateWaterRegion(waterRegionDraft.waterRegionId, (draft) => ({
                      ...draft,
                      center: {
                        ...draft.center,
                        y: nextValue
                      }
                    }));
                  }
                }}
                value={waterRegionDraft.center.y.toFixed(2)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${waterRegionDraft.waterRegionId}-center-z`}>
                Center Z
              </Label>
              <Input
                id={`${waterRegionDraft.waterRegionId}-center-z`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdateWaterRegion(waterRegionDraft.waterRegionId, (draft) => ({
                      ...draft,
                      center: {
                        ...draft.center,
                        z: nextValue
                      }
                    }));
                  }
                }}
                value={waterRegionDraft.center.z.toFixed(2)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${waterRegionDraft.waterRegionId}-size-x`}>
                Width
              </Label>
              <Input
                id={`${waterRegionDraft.waterRegionId}-size-x`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdateWaterRegion(waterRegionDraft.waterRegionId, (draft) => ({
                      ...draft,
                      size: {
                        ...draft.size,
                        x: Math.max(1, nextValue)
                      }
                    }));
                  }
                }}
                value={waterRegionDraft.size.x.toFixed(2)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${waterRegionDraft.waterRegionId}-size-y`}>
                Depth
              </Label>
              <Input
                id={`${waterRegionDraft.waterRegionId}-size-y`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdateWaterRegion(waterRegionDraft.waterRegionId, (draft) => ({
                      ...draft,
                      size: {
                        ...draft.size,
                        y: Math.max(1, nextValue)
                      }
                    }));
                  }
                }}
                value={waterRegionDraft.size.y.toFixed(2)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${waterRegionDraft.waterRegionId}-size-z`}>
                Length
              </Label>
              <Input
                id={`${waterRegionDraft.waterRegionId}-size-z`}
                onChange={(event) => {
                  const nextValue = resolveFiniteNumber(event.target.value);

                  if (nextValue !== null) {
                    onUpdateWaterRegion(waterRegionDraft.waterRegionId, (draft) => ({
                      ...draft,
                      size: {
                        ...draft.size,
                        z: Math.max(1, nextValue)
                      }
                    }));
                  }
                }}
                value={waterRegionDraft.size.z.toFixed(2)}
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${waterRegionDraft.waterRegionId}-color`}>
                Preview Color
              </Label>
              <Input
                id={`${waterRegionDraft.waterRegionId}-color`}
                onChange={(event) => {
                  onUpdateWaterRegion(waterRegionDraft.waterRegionId, (draft) => ({
                    ...draft,
                    previewColorHex: event.target.value
                  }));
                }}
                value={waterRegionDraft.previewColorHex}
              />
            </div>
            <div
              className="mt-auto h-10 rounded-xl border border-border/70"
              style={{ backgroundColor: waterRegionDraft.previewColorHex }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <Label htmlFor={`${waterRegionDraft.waterRegionId}-rotation`}>
                Rotation Y
              </Label>
              <span className="text-muted-foreground">
                {Math.round((waterRegionDraft.rotationYRadians * 180) / Math.PI)} deg
              </span>
            </div>
            <Slider
              id={`${waterRegionDraft.waterRegionId}-rotation`}
              max={Math.PI}
              min={-Math.PI}
              onValueChange={([nextValue = waterRegionDraft.rotationYRadians]) => {
                onUpdateWaterRegion(waterRegionDraft.waterRegionId, (draft) => ({
                  ...draft,
                  rotationYRadians: nextValue
                }));
              }}
              step={Math.PI / 90}
              value={[waterRegionDraft.rotationYRadians]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <Label htmlFor={`${waterRegionDraft.waterRegionId}-opacity`}>
                Preview Opacity
              </Label>
              <span className="text-muted-foreground">
                {waterRegionDraft.previewOpacity.toFixed(2)}
              </span>
            </div>
            <Slider
              id={`${waterRegionDraft.waterRegionId}-opacity`}
              max={0.95}
              min={0.1}
              onValueChange={([nextValue = waterRegionDraft.previewOpacity]) => {
                onUpdateWaterRegion(waterRegionDraft.waterRegionId, (draft) => ({
                  ...draft,
                  previewOpacity: nextValue
                }));
              }}
              step={0.01}
              value={[waterRegionDraft.previewOpacity]}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
