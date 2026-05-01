import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { StableInlineText } from "@/components/text-stability";
import type {
  MapEditorPlayerSpawnDraftSnapshot,
  MapEditorResourceSpawnDraftSnapshot,
  MapEditorSceneObjectDraftSnapshot,
  MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import type {
  MapEditorConnectorDraftSnapshot,
  MapEditorEdgeDraftSnapshot,
  MapEditorGameplayVolumeDraftSnapshot,
  MapEditorLightDraftSnapshot,
  MapEditorMaterialDefinitionDraftSnapshot,
  MapEditorPlacementDraftSnapshot,
  MapEditorProjectSnapshot,
  MapEditorRegionDraftSnapshot,
  MapEditorSelectedEntityRef,
  MapEditorStructuralDraftSnapshot,
  MapEditorSurfaceDraftSnapshot,
  MapEditorTerrainPatchDraftSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import type {
  MapEditorBuilderToolStateSnapshot,
  MapEditorEntityTransformUpdate,
  MapEditorPlayerSpawnTransformUpdate,
  MapEditorPlacementUpdate,
  MapEditorSceneVisibilitySnapshot,
  MapEditorViewportTransformTargetRef,
  MapEditorViewportHelperVisibilitySnapshot,
  MapEditorViewportToolMode
} from "@/engine-tool/types/map-editor";
import { MapEditorViewport } from "@/engine-tool/viewport/map-editor-viewport";

interface MapEditorViewportPaneProps {
  readonly activeModuleAssetId: string | null;
  readonly activeWorkspaceLabel: string;
  readonly builderToolState: MapEditorBuilderToolStateSnapshot;
  readonly bundleLabel: string;
  readonly bundleLabelReserveTexts: readonly string[];
  readonly bundleId: string;
  readonly connectorDrafts: readonly MapEditorConnectorDraftSnapshot[];
  readonly edgeDrafts: readonly MapEditorEdgeDraftSnapshot[];
  readonly environmentPresentation:
    MapEditorProjectSnapshot["environmentPresentation"];
  readonly gameplayVolumeDrafts: readonly MapEditorGameplayVolumeDraftSnapshot[];
  readonly helperGridSizeMeters: number;
  readonly lightDrafts: readonly MapEditorLightDraftSnapshot[];
  readonly materialDefinitionDrafts:
    readonly MapEditorMaterialDefinitionDraftSnapshot[];
  readonly onApplyTerrainBrushAtPosition: (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => void;
  readonly onCreateTerrainPatchAtPositions: (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => void;
  readonly onCommitPathSegment: (
    targetPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    targetElevationMeters: number,
    fromAnchor: {
      readonly center: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      };
      readonly elevation: number;
    } | null
  ) => void;
  readonly onCreateModuleAtPosition: (
    assetId: string,
    position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => void;
  readonly onCreatePlayerSpawnAtPosition: (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => void;
  readonly onCreateResourceSpawnAtPosition: (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => void;
  readonly onCreatePortalAtPosition: (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => void;
  readonly onCreateFloorRegion: (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => void;
  readonly onCreateFloorPolygonRegion: (
    points: readonly {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }[]
  ) => void;
  readonly onCommitWallSegment: (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => void;
  readonly onCreateCombatLane: (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => void;
  readonly onCreateCoverAtPosition: (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => void;
  readonly onCreateLightAtPosition: (position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }) => void;
  readonly onCreateTeamZone: (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => void;
  readonly onCreateVehicleRoute: (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }
  ) => void;
  readonly onDeleteEntity: (entityRef: MapEditorSelectedEntityRef) => void;
  readonly onPaintEntity: (entityRef: MapEditorSelectedEntityRef) => void;
  readonly onCreateWaterRegionAtPosition: (
    startPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    endPosition: {
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
  readonly onCommitEntityTransform: (
    target: MapEditorViewportTransformTargetRef,
    update: MapEditorEntityTransformUpdate
  ) => void;
  readonly onSelectEntity: (entityRef: MapEditorSelectedEntityRef | null) => void;
  readonly placementDrafts: readonly MapEditorPlacementDraftSnapshot[];
  readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
  readonly regionDrafts: readonly MapEditorRegionDraftSnapshot[];
  readonly resourceSpawnDrafts: readonly MapEditorResourceSpawnDraftSnapshot[];
  readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
  readonly sceneVisibility: MapEditorSceneVisibilitySnapshot;
  readonly selectedEntityRef: MapEditorSelectedEntityRef | null;
  readonly selectedEntityLabel: string;
  readonly structuralDrafts: readonly MapEditorStructuralDraftSnapshot[];
  readonly surfaceDrafts: readonly MapEditorSurfaceDraftSnapshot[];
  readonly terrainPatchDrafts: readonly MapEditorTerrainPatchDraftSnapshot[];
  readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
  readonly viewportHelperVisibility: MapEditorViewportHelperVisibilitySnapshot;
  readonly viewportToolMode: MapEditorViewportToolMode;
}

const viewportToolModeLabels = [
  "Select",
  "Floor",
  "Cover",
  "Terrain",
  "Wall",
  "Path",
  "Zone",
  "Lane",
  "Vehicle Route",
  "Paint",
  "Delete",
  "Light",
  "Water",
  "Module",
  "Player Spawn",
  "Weapon Pickup",
  "Portal",
  "Move",
  "Rotate",
  "Scale",
  "Vertex"
] as const;

function formatToolMode(viewportToolMode: MapEditorViewportToolMode): string {
  if (viewportToolMode === "player-spawn") {
    return "Player Spawn";
  }

  if (viewportToolMode === "resource-spawn") {
    return "Weapon Pickup";
  }

  if (viewportToolMode === "vehicle-route") {
    return "Vehicle Route";
  }

  return `${viewportToolMode[0]?.toUpperCase()}${viewportToolMode.slice(1)}`;
}

function formatSelectionBadge(
  selectedEntityRef: MapEditorSelectedEntityRef | null
): string {
  if (selectedEntityRef === null) {
    return "No selection";
  }

  return `${selectedEntityRef.kind}: ${selectedEntityRef.id}`;
}

export function MapEditorViewportPane({
  activeModuleAssetId,
  activeWorkspaceLabel,
  builderToolState,
  bundleLabel,
  bundleLabelReserveTexts,
  bundleId,
  connectorDrafts,
  edgeDrafts,
  environmentPresentation,
  gameplayVolumeDrafts,
  helperGridSizeMeters,
  lightDrafts,
  materialDefinitionDrafts,
  onApplyTerrainBrushAtPosition,
  onCreateTerrainPatchAtPositions,
  onCommitPathSegment,
  onCreateFloorRegion,
  onCreateModuleAtPosition,
  onCreatePlayerSpawnAtPosition,
  onCreateResourceSpawnAtPosition,
  onCreatePortalAtPosition,
  onCommitWallSegment,
  onCreateCombatLane,
  onCreateCoverAtPosition,
  onCreateLightAtPosition,
  onCreateTeamZone,
  onCreateVehicleRoute,
  onCreateWaterRegionAtPosition,
  onDeleteEntity,
  onPaintEntity,
  onCommitPlacementTransform,
  onCommitPlayerSpawnTransform,
  onCreateFloorPolygonRegion,
  onCommitEntityTransform,
  onSelectEntity,
  placementDrafts,
  playerSpawnDrafts,
  regionDrafts,
  resourceSpawnDrafts,
  sceneObjectDrafts,
  sceneVisibility,
  selectedEntityRef,
  selectedEntityLabel,
  structuralDrafts,
  surfaceDrafts,
  terrainPatchDrafts,
  waterRegionDrafts,
  viewportHelperVisibility,
  viewportToolMode
}: MapEditorViewportPaneProps) {
  const viewportBadgeText =
    viewportToolMode === "module" && activeModuleAssetId !== null
      ? activeModuleAssetId
      : formatSelectionBadge(selectedEntityRef);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Viewport
          </p>
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="min-w-0 flex-nowrap text-sm font-semibold">
              <BreadcrumbItem>
                <BreadcrumbPage>Engine Tool</BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">
                  <StableInlineText
                    reserveTexts={bundleLabelReserveTexts}
                    stabilizeNumbers={false}
                    text={bundleLabel}
                  />
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{activeWorkspaceLabel}</BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">
                  {selectedEntityLabel}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <StableInlineText
              reserveTexts={viewportToolModeLabels}
              text={formatToolMode(viewportToolMode)}
            />
          </Badge>
          <Badge variant={selectedEntityRef === null ? "outline" : "secondary"}>
            <StableInlineText stabilizeNumbers={false} text={viewportBadgeText} />
          </Badge>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <MapEditorViewport
          activeModuleAssetId={activeModuleAssetId}
          builderToolState={builderToolState}
          bundleId={bundleId}
          connectorDrafts={connectorDrafts}
          edgeDrafts={edgeDrafts}
          environmentPresentation={environmentPresentation}
          gameplayVolumeDrafts={gameplayVolumeDrafts}
          helperGridSizeMeters={helperGridSizeMeters}
          helperVisibility={viewportHelperVisibility}
          lightDrafts={lightDrafts}
          materialDefinitionDrafts={materialDefinitionDrafts}
          onApplyTerrainBrushAtPosition={onApplyTerrainBrushAtPosition}
          onCreateTerrainPatchAtPositions={onCreateTerrainPatchAtPositions}
          onCommitPathSegment={onCommitPathSegment}
          onCommitEntityTransform={onCommitEntityTransform}
          onCommitPlacementTransform={onCommitPlacementTransform}
          onCommitPlayerSpawnTransform={onCommitPlayerSpawnTransform}
          onCreateFloorPolygonRegion={onCreateFloorPolygonRegion}
          onCreateFloorRegion={onCreateFloorRegion}
          onCreateCombatLane={onCreateCombatLane}
          onCreateCoverAtPosition={onCreateCoverAtPosition}
          onCreateLightAtPosition={onCreateLightAtPosition}
          onCreateModuleAtPosition={onCreateModuleAtPosition}
          onCreatePlayerSpawnAtPosition={onCreatePlayerSpawnAtPosition}
          onCreateResourceSpawnAtPosition={onCreateResourceSpawnAtPosition}
          onCreatePortalAtPosition={onCreatePortalAtPosition}
          onCreateTeamZone={onCreateTeamZone}
          onCreateVehicleRoute={onCreateVehicleRoute}
          onCommitWallSegment={onCommitWallSegment}
          onCreateWaterRegionAtPosition={onCreateWaterRegionAtPosition}
          onDeleteEntity={onDeleteEntity}
          onPaintEntity={onPaintEntity}
          onSelectEntity={onSelectEntity}
          placementDrafts={placementDrafts}
          playerSpawnDrafts={playerSpawnDrafts}
          regionDrafts={regionDrafts}
          resourceSpawnDrafts={resourceSpawnDrafts}
          sceneObjectDrafts={sceneObjectDrafts}
          sceneVisibility={sceneVisibility}
          selectedEntityRef={selectedEntityRef}
          structuralDrafts={structuralDrafts}
          surfaceDrafts={surfaceDrafts}
          terrainPatchDrafts={terrainPatchDrafts}
          waterRegionDrafts={waterRegionDrafts}
          viewportToolMode={viewportToolMode}
        />
      </div>

      <div className="shrink-0 border-t border-border/70 px-4 py-3 text-sm text-muted-foreground">
        {viewportToolMode === "module" && activeModuleAssetId !== null
          ? `Orbit with drag, pan with right-drag, zoom with the scroll wheel, and fly with WASD plus Q/E. Click to place ${activeModuleAssetId}.`
          : viewportToolMode === "floor"
            ? builderToolState.floorShapeMode === "polygon"
              ? `Click to place ${builderToolState.floorRole} vertices on the clicked support. Enter finishes, Backspace removes the last pending vertex.`
              : `Click or drag to build a ${builderToolState.floorFootprintCellsX} x ${builderToolState.floorFootprintCellsZ} ${builderToolState.floorRole} footprint at ${builderToolState.floorElevationMeters.toFixed(1)}m above the clicked support.`
          : viewportToolMode === "cover"
            ? `Click to place ${builderToolState.coverFootprintCellsX} x ${builderToolState.coverFootprintCellsZ} hard cover with ${builderToolState.activeMaterialId}.`
          : viewportToolMode === "zone" || viewportToolMode === "lane" || viewportToolMode === "vehicle-route"
            ? `Click two cells to author gameplay-aware ${viewportToolMode} metadata.`
          : viewportToolMode === "paint"
            ? `Click authored geometry to paint ${builderToolState.activeMaterialId}.`
          : viewportToolMode === "delete"
            ? "Click an authored entity to delete it."
          : viewportToolMode === "light"
            ? builderToolState.lightKind === "ambient" ||
              builderToolState.lightKind === "sun"
              ? `Click to place a ${builderToolState.lightIntensity.toFixed(1)} intensity ${builderToolState.lightKind} light.`
              : `Click to place a ${builderToolState.lightIntensity.toFixed(1)} intensity ${builderToolState.lightKind} light with ${builderToolState.lightRangeMeters.toFixed(1)}m range.`
          : viewportToolMode === "terrain"
            ? selectedEntityRef?.kind === "terrain-patch"
              ? `Drag over selected terrain to ${builderToolState.terrainBrushMode} with a ${builderToolState.terrainBrushSizeCells}x${builderToolState.terrainBrushSizeCells} brush.`
              : "Drag empty ground to draw a terrain patch. Click existing terrain to select it."
          : viewportToolMode === "vertex"
            ? "Click a terrain sample, then drag the vertical transform handle to reshape that vertex."
            : viewportToolMode === "resource-spawn"
              ? "Click the scene to place a weapon ammo pickup on the clicked support."
            : viewportToolMode === "wall"
              ? `Click once to anchor a ${builderToolState.wallPresetId} on the clicked support, move to preview, then click again to commit and keep chaining.`
              : viewportToolMode === "path"
                ? builderToolState.surfaceMode === "slope"
                  ? `Click to set a slope start, point toward the next direction, then click again to commit a ${builderToolState.pathSlopeLengthCells}-cell ${builderToolState.pathElevationMode === "down" ? "down" : "up"} slope.`
                  : "Click to start or continue flat path authoring on the clicked support."
                : viewportToolMode === "water"
                  ? `Click or drag to build a ${builderToolState.waterFootprintCellsX} x ${builderToolState.waterFootprintCellsZ} water footprint.`
                  : "Orbit with drag, pan with right-drag, zoom with the scroll wheel, and fly with WASD plus Q/E. Use the outliner or viewport picking to focus authored entities."}
      </div>
    </div>
  );
}
