import { Badge } from "@/components/ui/badge";
import { StableInlineText } from "@/components/text-stability";
import {
  type MapEditorPlayerSpawnDraftSnapshot,
  type MapEditorSceneObjectDraftSnapshot,
  type MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import {
  type MapEditorPlacementDraftSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import type {
  MapEditorPlayerSpawnTransformUpdate,
  MapEditorPlacementUpdate,
  MapEditorViewportHelperVisibilitySnapshot,
  MapEditorViewportToolMode
} from "@/engine-tool/types/map-editor";
import { MapEditorViewport } from "@/engine-tool/viewport/map-editor-viewport";

interface MapEditorViewportPaneProps {
  readonly activeBuildPrimitiveAssetId: string | null;
  readonly bundleId: string;
  readonly onBuildPlacementAtPosition: (
    assetId: string,
    position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => void;
  readonly onCommitPlacementTransform: (
    placementId: string,
    update: MapEditorPlacementUpdate
  ) => void;
  readonly onCommitPlayerSpawnTransform: (
    spawnId: string,
    update: MapEditorPlayerSpawnTransformUpdate
  ) => void;
  readonly onSelectPlacementId: (placementId: string) => void;
  readonly placementDrafts: readonly MapEditorPlacementDraftSnapshot[];
  readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
  readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
  readonly selectedPlacementAssetId: string | null;
  readonly selectedPlacementId: string | null;
  readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
  readonly viewportHelperVisibility: MapEditorViewportHelperVisibilitySnapshot;
  readonly viewportToolMode: MapEditorViewportToolMode;
}

const viewportToolModeLabels = ["Build", "Move", "Rotate", "Scale"] as const;

export function MapEditorViewportPane({
  activeBuildPrimitiveAssetId,
  bundleId,
  onBuildPlacementAtPosition,
  onCommitPlacementTransform,
  onCommitPlayerSpawnTransform,
  onSelectPlacementId,
  placementDrafts,
  playerSpawnDrafts,
  sceneObjectDrafts,
  selectedPlacementAssetId,
  selectedPlacementId,
  waterRegionDrafts,
  viewportHelperVisibility,
  viewportToolMode
}: MapEditorViewportPaneProps) {
  const viewportBadgeAssetId =
    viewportToolMode === "build"
      ? activeBuildPrimitiveAssetId
      : selectedPlacementAssetId;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Viewport
          </p>
          <h2 className="font-heading text-lg font-semibold">
            Three.js Scene Workspace
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <StableInlineText
              reserveTexts={viewportToolModeLabels}
              text={`${viewportToolMode[0]?.toUpperCase()}${viewportToolMode.slice(1)}`}
            />
          </Badge>
          {viewportBadgeAssetId !== null ? (
            <Badge variant="secondary">
              <StableInlineText
                stabilizeNumbers={false}
                text={viewportBadgeAssetId}
              />
            </Badge>
          ) : (
            <Badge variant="outline">
              <StableInlineText stabilizeNumbers={false} text="No selection" />
            </Badge>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <MapEditorViewport
          activeBuildPrimitiveAssetId={activeBuildPrimitiveAssetId}
          bundleId={bundleId}
          onBuildPlacementAtPosition={onBuildPlacementAtPosition}
          helperVisibility={viewportHelperVisibility}
          onCommitPlacementTransform={onCommitPlacementTransform}
          onCommitPlayerSpawnTransform={onCommitPlayerSpawnTransform}
          onSelectPlacementId={onSelectPlacementId}
          placementDrafts={placementDrafts}
          playerSpawnDrafts={playerSpawnDrafts}
          sceneObjectDrafts={sceneObjectDrafts}
          selectedPlacementId={selectedPlacementId}
          waterRegionDrafts={waterRegionDrafts}
          viewportToolMode={viewportToolMode}
        />
      </div>

      <div className="shrink-0 border-t border-border/70 px-4 py-3 text-sm text-muted-foreground">
        {viewportToolMode === "build" && activeBuildPrimitiveAssetId !== null
          ? `Orbit with drag, pan with right-drag, zoom with the scroll wheel, and fly with WASD plus Q/E. Click to stamp ${activeBuildPrimitiveAssetId} onto the snapped build plane.`
          : "Orbit with drag, pan with right-drag, zoom with the scroll wheel, and fly with WASD plus Q/E. Placements use move/rotate/scale gizmos, and player spawns support click-to-move plus rotate directly in the viewport."}
      </div>
    </div>
  );
}
