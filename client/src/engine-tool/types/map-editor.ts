import {
  metaverseWorldSurfaceDefaultMaxWalkableSlopeAngleRadians,
  type MetaverseMapBundleSemanticLightKind,
  type MetaverseMapBundleSemanticMaterialId,
  type MetaverseWorldSurfaceVector3Snapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import { mapEditorBuildGridUnitMeters } from "@/engine-tool/build/map-editor-build-placement";

export type MapEditorViewportTransformToolMode =
  | "move"
  | "rotate"
  | "scale"
  | "select"
  | "vertex";

export type MapEditorBuildToolMode =
  | "cover"
  | "delete"
  | "floor"
  | "lane"
  | "light"
  | "module"
  | "paint"
  | "path"
  | "player-spawn"
  | "portal"
  | "resource-spawn"
  | "terrain"
  | "vehicle-route"
  | "wall"
  | "zone"
  | "water";

export type MapEditorViewportToolMode =
  | MapEditorBuildToolMode
  | MapEditorViewportTransformToolMode;

export type MapEditorTerrainBrushMode =
  | "cliff"
  | "flatten"
  | "flatten-pad"
  | "lower"
  | "material"
  | "noise"
  | "plateau"
  | "raise"
  | "ridge"
  | "smooth"
  | "valley";
export type MapEditorTerrainBrushSizeCells = number;
export type MapEditorGameplayTeamId = "blue" | "neutral" | "red";
export type MapEditorPathElevationMode =
  | "bridge-slope"
  | "down"
  | "flat"
  | "up";
export type MapEditorFloorRole = "floor" | "roof";
export type MapEditorFloorShapeMode = "polygon" | "rectangle";
export type MapEditorSurfaceMode = "flat" | "slope";
export type MapEditorWallToolPresetId =
  | "curb"
  | "fence"
  | "rail"
  | "retaining-wall"
  | "wall";

export const defaultMapEditorMaterialPaletteIds =
  Object.freeze<readonly string[]>([
    "concrete",
    "metal",
    "warning",
    "glass",
    "team-blue",
    "team-red",
    "terrain-basalt",
    "terrain-cliff",
    "terrain-dirt",
    "terrain-gravel",
    "terrain-rock",
    "terrain-ash",
    "terrain-grass",
    "terrain-moss",
    "terrain-sand",
    "terrain-snow"
  ]);

const defaultMapEditorTerrainGenerationMaxSlopeDegrees =
  Math.round(
    (metaverseWorldSurfaceDefaultMaxWalkableSlopeAngleRadians * 180) /
      Math.PI *
      10
  ) / 10;

export interface MapEditorProjectSettingsSnapshot {
  readonly helperGridSizeMeters: number;
}

export const defaultMapEditorProjectSettings =
  Object.freeze<MapEditorProjectSettingsSnapshot>({
    helperGridSizeMeters: 240
  });

export function normalizeMapEditorProjectHelperGridSizeMeters(
  helperGridSizeMeters: number
): number {
  if (!Number.isFinite(helperGridSizeMeters)) {
    return defaultMapEditorProjectSettings.helperGridSizeMeters;
  }

  return Math.max(
    mapEditorBuildGridUnitMeters,
    Math.round(helperGridSizeMeters / mapEditorBuildGridUnitMeters) *
      mapEditorBuildGridUnitMeters
  );
}

export function createMapEditorProjectSettingsSnapshot(
  settings: Partial<MapEditorProjectSettingsSnapshot> = {}
): MapEditorProjectSettingsSnapshot {
  return Object.freeze({
    helperGridSizeMeters: normalizeMapEditorProjectHelperGridSizeMeters(
      settings.helperGridSizeMeters ??
        defaultMapEditorProjectSettings.helperGridSizeMeters
    )
  });
}

export interface MapEditorBuilderToolStateSnapshot {
  readonly activeMaterialId: MetaverseMapBundleSemanticMaterialId;
  readonly activeMaterialReferenceId: string;
  readonly coverFootprintCellsX: number;
  readonly coverFootprintCellsZ: number;
  readonly coverHeightCells: number;
  readonly floorElevationMeters: number;
  readonly floorFootprintCellsX: number;
  readonly floorFootprintCellsZ: number;
  readonly floorRole: MapEditorFloorRole;
  readonly floorShapeMode: MapEditorFloorShapeMode;
  readonly gameplayVolumeTeamId: MapEditorGameplayTeamId;
  readonly gameplayVolumeWidthCells: number;
  readonly lightColor: readonly [number, number, number];
  readonly lightIntensity: number;
  readonly lightKind: MetaverseMapBundleSemanticLightKind;
  readonly lightRangeMeters: number;
  readonly materialPaletteIds: readonly string[];
  readonly pathElevationMode: MapEditorPathElevationMode;
  readonly pathSlopeLengthCells: number;
  readonly pathSlopeRotationDegrees: number;
  readonly pathWidthCells: number;
  readonly riseLayers: number;
  readonly surfaceMode: MapEditorSurfaceMode;
  readonly terrainBrushMode: MapEditorTerrainBrushMode;
  readonly terrainBrushStrengthMeters: number;
  readonly terrainBrushSizeCells: MapEditorTerrainBrushSizeCells;
  readonly terrainCliffSpanCells: number;
  readonly terrainBrushTargetHeightMeters: number;
  readonly terrainMaterialId: MetaverseMapBundleSemanticMaterialId;
  readonly terrainGenerationFrequency: number;
  readonly terrainGenerationMaxElevationMeters: number;
  readonly terrainGenerationMaxSlopeDegrees: number;
  readonly terrainGenerationMinElevationMeters: number;
  readonly terrainGenerationOctaves: number;
  readonly terrainGenerationWarpFrequency: number;
  readonly terrainGenerationWarpStrengthMeters: number;
  readonly terrainNoiseSeed: number;
  readonly terrainSmoothEdges: boolean;
  readonly wallHeightMeters: number;
  readonly wallPresetId: MapEditorWallToolPresetId;
  readonly wallThicknessMeters: number;
  readonly waterDepthMeters: number;
  readonly waterFootprintCellsX: number;
  readonly waterFootprintCellsZ: number;
  readonly waterTopElevationMeters: number;
}

export const defaultMapEditorBuilderToolState =
  Object.freeze<MapEditorBuilderToolStateSnapshot>({
    activeMaterialId: "concrete",
    activeMaterialReferenceId: "concrete",
    coverFootprintCellsX: 1,
    coverFootprintCellsZ: 1,
    coverHeightCells: 1,
    floorElevationMeters: 0,
    floorFootprintCellsX: 1,
    floorFootprintCellsZ: 1,
    floorRole: "floor",
    floorShapeMode: "rectangle",
    gameplayVolumeTeamId: "neutral",
    gameplayVolumeWidthCells: 3,
    lightColor: Object.freeze([1, 0.86, 0.62] as const),
    lightIntensity: 2.5,
    lightKind: "point",
    lightRangeMeters: 20,
    materialPaletteIds: defaultMapEditorMaterialPaletteIds,
    pathElevationMode: "flat",
    pathSlopeLengthCells: 2,
    pathSlopeRotationDegrees: 0,
    pathWidthCells: 2,
    riseLayers: 1,
    surfaceMode: "flat",
    terrainBrushMode: "raise",
    terrainBrushStrengthMeters: 0.5,
    terrainBrushSizeCells: 2,
    terrainCliffSpanCells: 2,
    terrainBrushTargetHeightMeters: 0,
    terrainMaterialId: "terrain-grass",
    terrainGenerationFrequency: 0.08,
    terrainGenerationMaxElevationMeters: 8,
    terrainGenerationMaxSlopeDegrees:
      defaultMapEditorTerrainGenerationMaxSlopeDegrees,
    terrainGenerationMinElevationMeters: -8,
    terrainGenerationOctaves: 5,
    terrainGenerationWarpFrequency: 0.22,
    terrainGenerationWarpStrengthMeters: 8,
    terrainNoiseSeed: 1337,
    terrainSmoothEdges: true,
    wallHeightMeters: 4,
    wallPresetId: "wall",
    wallThicknessMeters: 0.5,
    waterDepthMeters: 4,
    waterFootprintCellsX: 1,
    waterFootprintCellsZ: 1,
    waterTopElevationMeters: 0
  });
export type MapEditorViewportHelperId =
  | "axes"
  | "collisionBounds"
  | "grid"
  | "polarGrid"
  | "selectionBounds";

export interface MapEditorViewportHelperVisibilitySnapshot {
  readonly axes: boolean;
  readonly collisionBounds: boolean;
  readonly grid: boolean;
  readonly polarGrid: boolean;
  readonly selectionBounds: boolean;
}

export const defaultMapEditorViewportHelperVisibility =
  Object.freeze<MapEditorViewportHelperVisibilitySnapshot>({
    axes: true,
    collisionBounds: false,
    grid: true,
    polarGrid: false,
    selectionBounds: true
  });

export type MapEditorSceneVisibilityLayerId =
  | "authoredLights"
  | "authoredModules"
  | "authoredSurfaces"
  | "gameplayMarkers"
  | "terrain"
  | "waterRegions"
  | "worldSun";

export interface MapEditorSceneVisibilitySnapshot {
  readonly authoredLights: boolean;
  readonly authoredModules: boolean;
  readonly authoredSurfaces: boolean;
  readonly gameplayMarkers: boolean;
  readonly terrain: boolean;
  readonly waterRegions: boolean;
  readonly worldSun: boolean;
}

export const defaultMapEditorSceneVisibility =
  Object.freeze<MapEditorSceneVisibilitySnapshot>({
    authoredLights: true,
    authoredModules: true,
    authoredSurfaces: true,
    gameplayMarkers: true,
    terrain: true,
    waterRegions: true,
    worldSun: true
  });

export interface MapEditorMaterialOption {
  readonly label: string;
  readonly value: string;
}

export interface MapEditorPlacementUpdate {
  readonly collisionEnabled?: boolean;
  readonly isVisible?: boolean;
  readonly materialReferenceId?: string | null;
  readonly notes?: string;
  readonly position?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly rotationYRadians?: number;
  readonly scale?: MetaverseWorldSurfaceVector3Snapshot;
}

export interface MapEditorPlayerSpawnTransformUpdate {
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly yawRadians: number;
}

export type MapEditorViewportTransformTargetKind =
  | "connector"
  | "edge"
  | "gameplay-volume"
  | "light"
  | "placement"
  | "player-spawn"
  | "region"
  | "resource-spawn"
  | "scene-object"
  | "structure"
  | "surface"
  | "terrain-patch"
  | "terrain-vertex"
  | "water-region";

export interface MapEditorViewportTransformTargetRef {
  readonly id: string;
  readonly kind: MapEditorViewportTransformTargetKind;
}

export interface MapEditorEntityTransformUpdate {
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly rotationYRadians: number;
  readonly scale: MetaverseWorldSurfaceVector3Snapshot;
}
