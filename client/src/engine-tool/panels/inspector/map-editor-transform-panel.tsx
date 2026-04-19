import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { MetaverseWorldSurfaceVector3Snapshot } from "@webgpu-metaverse/shared/metaverse/world";
import {
  type MapEditorPlacementDraftSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import type { MapEditorPlacementUpdate } from "@/engine-tool/types/map-editor";

interface MapEditorTransformPanelProps {
  readonly onUpdateSelectedPlacement: (update: MapEditorPlacementUpdate) => void;
  readonly selectedPlacement: MapEditorPlacementDraftSnapshot | null;
}

function formatRotationDegrees(rotationYRadians: number): string {
  return `${Math.round((rotationYRadians * 180) / Math.PI)} deg`;
}

function resolveFiniteNumber(value: string): number | null {
  const nextValue = Number(value);

  return Number.isFinite(nextValue) ? nextValue : null;
}

function createNextPlacementScale(
  scale: MetaverseWorldSurfaceVector3Snapshot,
  axis: "x" | "y" | "z",
  nextValue: number
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    ...scale,
    [axis]: Math.max(0.1, nextValue)
  });
}

export function MapEditorTransformPanel({
  onUpdateSelectedPlacement,
  selectedPlacement
}: MapEditorTransformPanelProps) {
  if (selectedPlacement === null) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
        Select a placement to edit transform values.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/25 p-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="map-editor-position-x">Pos X</Label>
          <Input
            id="map-editor-position-x"
            onChange={(event) => {
              const nextValue = resolveFiniteNumber(event.target.value);

              if (nextValue !== null) {
                onUpdateSelectedPlacement({
                  position: {
                    ...selectedPlacement.position,
                    x: nextValue
                  }
                });
              }
            }}
            value={selectedPlacement.position.x.toFixed(2)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="map-editor-position-y">Pos Y</Label>
          <Input
            id="map-editor-position-y"
            onChange={(event) => {
              const nextValue = resolveFiniteNumber(event.target.value);

              if (nextValue !== null) {
                onUpdateSelectedPlacement({
                  position: {
                    ...selectedPlacement.position,
                    y: nextValue
                  }
                });
              }
            }}
            value={selectedPlacement.position.y.toFixed(2)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="map-editor-position-z">Pos Z</Label>
          <Input
            id="map-editor-position-z"
            onChange={(event) => {
              const nextValue = resolveFiniteNumber(event.target.value);

              if (nextValue !== null) {
                onUpdateSelectedPlacement({
                  position: {
                    ...selectedPlacement.position,
                    z: nextValue
                  }
                });
              }
            }}
            value={selectedPlacement.position.z.toFixed(2)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <Label htmlFor="map-editor-rotation-slider">Rotation Y</Label>
          <span className="text-muted-foreground">
            {formatRotationDegrees(selectedPlacement.rotationYRadians)}
          </span>
        </div>
        <Slider
          id="map-editor-rotation-slider"
          max={Math.PI}
          min={-Math.PI}
          onValueChange={([nextValue = 0]) => {
            onUpdateSelectedPlacement({
              rotationYRadians: nextValue
            });
          }}
          step={Math.PI / 90}
          value={[selectedPlacement.rotationYRadians]}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <Label>Size</Label>
          <span className="text-muted-foreground">
            {selectedPlacement.scale.x.toFixed(2)} x{" "}
            {selectedPlacement.scale.y.toFixed(2)} x{" "}
            {selectedPlacement.scale.z.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="map-editor-scale-x">Size X</Label>
            <Input
              id="map-editor-scale-x"
              min="0.1"
              onChange={(event) => {
                const nextValue = resolveFiniteNumber(event.target.value);

                if (nextValue !== null) {
                  onUpdateSelectedPlacement({
                    scale: createNextPlacementScale(
                      selectedPlacement.scale,
                      "x",
                      nextValue
                    )
                  });
                }
              }}
              step="0.1"
              type="number"
              value={selectedPlacement.scale.x.toFixed(2)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="map-editor-scale-y">Size Y</Label>
            <Input
              id="map-editor-scale-y"
              min="0.1"
              onChange={(event) => {
                const nextValue = resolveFiniteNumber(event.target.value);

                if (nextValue !== null) {
                  onUpdateSelectedPlacement({
                    scale: createNextPlacementScale(
                      selectedPlacement.scale,
                      "y",
                      nextValue
                    )
                  });
                }
              }}
              step="0.1"
              type="number"
              value={selectedPlacement.scale.y.toFixed(2)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="map-editor-scale-z">Size Z</Label>
            <Input
              id="map-editor-scale-z"
              min="0.1"
              onChange={(event) => {
                const nextValue = resolveFiniteNumber(event.target.value);

                if (nextValue !== null) {
                  onUpdateSelectedPlacement({
                    scale: createNextPlacementScale(
                      selectedPlacement.scale,
                      "z",
                      nextValue
                    )
                  });
                }
              }}
              step="0.1"
              type="number"
              value={selectedPlacement.scale.z.toFixed(2)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <Label htmlFor="map-editor-scale-slider-x">Size X</Label>
              <span className="text-muted-foreground">
                {selectedPlacement.scale.x.toFixed(2)}
              </span>
            </div>
            <Slider
              id="map-editor-scale-slider-x"
              max={12}
              min={0.1}
              onValueChange={([nextValue = 1]) => {
                onUpdateSelectedPlacement({
                  scale: createNextPlacementScale(
                    selectedPlacement.scale,
                    "x",
                    nextValue
                  )
                });
              }}
              step={0.1}
              value={[selectedPlacement.scale.x]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <Label htmlFor="map-editor-scale-slider-y">Size Y</Label>
              <span className="text-muted-foreground">
                {selectedPlacement.scale.y.toFixed(2)}
              </span>
            </div>
            <Slider
              id="map-editor-scale-slider-y"
              max={12}
              min={0.1}
              onValueChange={([nextValue = 1]) => {
                onUpdateSelectedPlacement({
                  scale: createNextPlacementScale(
                    selectedPlacement.scale,
                    "y",
                    nextValue
                  )
                });
              }}
              step={0.1}
              value={[selectedPlacement.scale.y]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <Label htmlFor="map-editor-scale-slider-z">Size Z</Label>
              <span className="text-muted-foreground">
                {selectedPlacement.scale.z.toFixed(2)}
              </span>
            </div>
            <Slider
              id="map-editor-scale-slider-z"
              max={12}
              min={0.1}
              onValueChange={([nextValue = 1]) => {
                onUpdateSelectedPlacement({
                  scale: createNextPlacementScale(
                    selectedPlacement.scale,
                    "z",
                    nextValue
                  )
                });
              }}
              step={0.1}
              value={[selectedPlacement.scale.z]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
