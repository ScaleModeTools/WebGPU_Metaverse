import {
  defaultMapEditorBuilderToolState,
  defaultMapEditorMaterialPaletteIds,
  defaultMapEditorSceneVisibility,
  type MapEditorBuilderToolStateSnapshot,
  type MapEditorFloorRole,
  type MapEditorFloorShapeMode,
  type MapEditorGameplayTeamId,
  type MapEditorPathElevationMode,
  type MapEditorSceneVisibilitySnapshot,
  type MapEditorSurfaceMode,
  type MapEditorTerrainBrushMode,
  type MapEditorTerrainBrushSizeCells,
  type MapEditorWallToolPresetId
} from "@/engine-tool/types/map-editor";
import type {
  MetaverseMapBundleSemanticLightKind,
  MetaverseMapBundleSemanticMaterialId
} from "@webgpu-metaverse/shared/metaverse/world";

export interface MapEditorUiStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MapEditorUiPrefsSnapshot {
  readonly builderToolState: MapEditorBuilderToolStateSnapshot;
  readonly inspectorCollapsed: boolean;
  readonly sceneVisibility: MapEditorSceneVisibilitySnapshot;
  readonly sceneRailCollapsed: boolean;
  readonly sectionOpenState: Readonly<Record<string, boolean>>;
}

const storedMapEditorUiPrefsKey = "webgpu-metaverse:engine-tool:map-editor-ui";
const storedMapEditorUiPrefsVersion = 1 as const;

interface StoredMapEditorUiPrefsRecord {
  readonly builderToolState?: unknown;
  readonly inspectorCollapsed?: unknown;
  readonly sceneVisibility?: unknown;
  readonly sceneRailCollapsed?: unknown;
  readonly sectionOpenState?: unknown;
  readonly version: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function freezeSectionOpenState(
  value: Record<string, boolean>
): Readonly<Record<string, boolean>> {
  return Object.freeze({ ...value });
}

function readTerrainBrushMode(value: unknown): MapEditorTerrainBrushMode | null {
  return value === "cliff" ||
    value === "flatten" ||
    value === "flatten-pad" ||
    value === "lower" ||
    value === "material" ||
    value === "noise" ||
    value === "plateau" ||
    value === "raise" ||
    value === "ridge" ||
    value === "smooth" ||
    value === "valley"
    ? value
    : null;
}

function readPathElevationMode(value: unknown): MapEditorPathElevationMode | null {
  return value === "bridge-slope" ||
    value === "down" ||
    value === "flat" ||
    value === "up"
    ? value
    : null;
}

function readFloorRole(value: unknown): MapEditorFloorRole | null {
  return value === "floor" || value === "roof" ? value : null;
}

function readFloorShapeMode(value: unknown): MapEditorFloorShapeMode | null {
  return value === "polygon" || value === "rectangle" ? value : null;
}

function readSurfaceMode(value: unknown): MapEditorSurfaceMode | null {
  return value === "flat" || value === "slope" ? value : null;
}

function readTerrainBrushSizeCells(
  value: unknown
): MapEditorTerrainBrushSizeCells | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(16, Math.round(value)))
    : null;
}

function readWallPresetId(value: unknown): MapEditorWallToolPresetId | null {
  return value === "curb" ||
    value === "fence" ||
    value === "rail" ||
    value === "retaining-wall" ||
    value === "wall"
    ? value
    : null;
}

function readMaterialId(
  value: unknown
): MetaverseMapBundleSemanticMaterialId | null {
  return value === "alien-rock" ||
    value === "concrete" ||
    value === "glass" ||
    value === "metal" ||
    value === "terrain-ash" ||
    value === "terrain-basalt" ||
    value === "terrain-cliff" ||
    value === "terrain-dirt" ||
    value === "terrain-gravel" ||
    value === "terrain-grass" ||
    value === "terrain-moss" ||
    value === "terrain-rock" ||
    value === "terrain-sand" ||
    value === "terrain-snow" ||
    value === "team-blue" ||
    value === "team-red" ||
    value === "warning"
    ? value
    : null;
}

function readMaterialPaletteIds(
  value: unknown
): readonly string[] {
  if (!Array.isArray(value)) {
    return defaultMapEditorMaterialPaletteIds;
  }

  const materialIds: string[] = [];

  for (const candidate of value) {
    const materialId =
      typeof candidate === "string" && candidate.trim().length > 0
        ? candidate
        : null;

    if (materialId !== null && !materialIds.includes(materialId)) {
      materialIds.push(materialId);
    }
  }

  return materialIds.length === 0
    ? defaultMapEditorMaterialPaletteIds
    : Object.freeze(materialIds);
}

function readGameplayTeamId(value: unknown): MapEditorGameplayTeamId | null {
  return value === "blue" || value === "neutral" || value === "red"
    ? value
    : null;
}

function readLightKind(
  value: unknown
): MetaverseMapBundleSemanticLightKind | null {
  return value === "ambient" ||
    value === "area" ||
    value === "point" ||
    value === "spot" ||
    value === "sun"
    ? value
    : null;
}

function readRgbTuple(
  value: unknown,
  fallback: readonly [number, number, number]
): readonly [number, number, number] {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ? Object.freeze([
        Math.max(0, Math.min(1, value[0] ?? fallback[0])),
        Math.max(0, Math.min(1, value[1] ?? fallback[1])),
        Math.max(0, Math.min(1, value[2] ?? fallback[2]))
      ] as const)
    : fallback;
}

function readPositiveInteger(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.round(value))
    : fallback;
}

function readBuilderToolState(value: unknown): MapEditorBuilderToolStateSnapshot {
  if (!isRecord(value)) {
    return defaultMapEditorBuilderToolState;
  }

  const storedFloorFootprintCellsX = readPositiveInteger(
    value.floorFootprintCellsX,
    defaultMapEditorBuilderToolState.floorFootprintCellsX
  );
  const storedFloorFootprintCellsZ = readPositiveInteger(
    value.floorFootprintCellsZ,
    defaultMapEditorBuilderToolState.floorFootprintCellsZ
  );
  const storedWaterFootprintCellsX = readPositiveInteger(
    value.waterFootprintCellsX,
    defaultMapEditorBuilderToolState.waterFootprintCellsX
  );
  const storedWaterFootprintCellsZ = readPositiveInteger(
    value.waterFootprintCellsZ,
    defaultMapEditorBuilderToolState.waterFootprintCellsZ
  );
  const floorUsesLegacyDefault =
    storedFloorFootprintCellsX === 2 && storedFloorFootprintCellsZ === 2;
  const waterUsesLegacyDefault =
    storedWaterFootprintCellsX === 6 && storedWaterFootprintCellsZ === 6;
  const activeMaterialId =
    readMaterialId(value.activeMaterialId) ??
    defaultMapEditorBuilderToolState.activeMaterialId;
  const activeMaterialReferenceId =
    typeof value.activeMaterialReferenceId === "string" &&
    value.activeMaterialReferenceId.trim().length > 0
      ? value.activeMaterialReferenceId
      : activeMaterialId;
  const legacyTerrainGenerationElevationStrengthMeters =
    typeof value.terrainGenerationElevationStrengthMeters === "number" &&
    Number.isFinite(value.terrainGenerationElevationStrengthMeters)
      ? Math.max(0, value.terrainGenerationElevationStrengthMeters)
      : null;
  const storedTerrainGenerationMaxElevationMeters =
    typeof value.terrainGenerationMaxElevationMeters === "number" &&
    Number.isFinite(value.terrainGenerationMaxElevationMeters)
      ? value.terrainGenerationMaxElevationMeters
      : legacyTerrainGenerationElevationStrengthMeters ??
        defaultMapEditorBuilderToolState.terrainGenerationMaxElevationMeters;
  const storedTerrainGenerationMinElevationMeters =
    typeof value.terrainGenerationMinElevationMeters === "number" &&
    Number.isFinite(value.terrainGenerationMinElevationMeters)
      ? value.terrainGenerationMinElevationMeters
      : legacyTerrainGenerationElevationStrengthMeters !== null
        ? -legacyTerrainGenerationElevationStrengthMeters
        : defaultMapEditorBuilderToolState.terrainGenerationMinElevationMeters;
  const terrainGenerationMaxElevationMeters = Math.max(
    storedTerrainGenerationMinElevationMeters,
    storedTerrainGenerationMaxElevationMeters
  );
  const terrainGenerationMinElevationMeters = Math.min(
    storedTerrainGenerationMinElevationMeters,
    storedTerrainGenerationMaxElevationMeters
  );

  return Object.freeze({
    activeMaterialId,
    activeMaterialReferenceId,
    coverFootprintCellsX: readPositiveInteger(
      value.coverFootprintCellsX,
      defaultMapEditorBuilderToolState.coverFootprintCellsX
    ),
    coverFootprintCellsZ: readPositiveInteger(
      value.coverFootprintCellsZ,
      defaultMapEditorBuilderToolState.coverFootprintCellsZ
    ),
    coverHeightCells: readPositiveInteger(
      value.coverHeightCells,
      defaultMapEditorBuilderToolState.coverHeightCells
    ),
    floorElevationMeters:
      typeof value.floorElevationMeters === "number" &&
      Number.isFinite(value.floorElevationMeters)
        ? value.floorElevationMeters
        : defaultMapEditorBuilderToolState.floorElevationMeters,
    floorFootprintCellsX: floorUsesLegacyDefault
      ? defaultMapEditorBuilderToolState.floorFootprintCellsX
      : storedFloorFootprintCellsX,
    floorFootprintCellsZ: floorUsesLegacyDefault
      ? defaultMapEditorBuilderToolState.floorFootprintCellsZ
      : storedFloorFootprintCellsZ,
    floorRole:
      readFloorRole(value.floorRole) ??
      defaultMapEditorBuilderToolState.floorRole,
    floorShapeMode:
      readFloorShapeMode(value.floorShapeMode) ??
      defaultMapEditorBuilderToolState.floorShapeMode,
    gameplayVolumeTeamId:
      readGameplayTeamId(value.gameplayVolumeTeamId) ??
      defaultMapEditorBuilderToolState.gameplayVolumeTeamId,
    gameplayVolumeWidthCells: readPositiveInteger(
      value.gameplayVolumeWidthCells,
      defaultMapEditorBuilderToolState.gameplayVolumeWidthCells
    ),
    lightColor: readRgbTuple(
      value.lightColor,
      defaultMapEditorBuilderToolState.lightColor
    ),
    lightIntensity:
      typeof value.lightIntensity === "number" &&
      Number.isFinite(value.lightIntensity)
        ? Math.max(0, value.lightIntensity)
        : defaultMapEditorBuilderToolState.lightIntensity,
    lightKind:
      readLightKind(value.lightKind) ??
      defaultMapEditorBuilderToolState.lightKind,
    lightRangeMeters:
      typeof value.lightRangeMeters === "number" &&
      Number.isFinite(value.lightRangeMeters)
        ? Math.max(1, value.lightRangeMeters)
        : defaultMapEditorBuilderToolState.lightRangeMeters,
    materialPaletteIds: readMaterialPaletteIds(value.materialPaletteIds),
    pathElevationMode:
      readPathElevationMode(value.pathElevationMode) ??
      defaultMapEditorBuilderToolState.pathElevationMode,
    pathSlopeLengthCells:
      readPositiveInteger(
        value.pathSlopeLengthCells,
        defaultMapEditorBuilderToolState.pathSlopeLengthCells
      ),
    pathSlopeRotationDegrees:
      typeof value.pathSlopeRotationDegrees === "number" &&
      Number.isFinite(value.pathSlopeRotationDegrees)
        ? value.pathSlopeRotationDegrees
        : defaultMapEditorBuilderToolState.pathSlopeRotationDegrees,
    pathWidthCells:
      readPositiveInteger(
        value.pathWidthCells,
        defaultMapEditorBuilderToolState.pathWidthCells
      ),
    riseLayers:
      typeof value.riseLayers === "number" && Number.isFinite(value.riseLayers)
        ? Math.round(value.riseLayers)
        : defaultMapEditorBuilderToolState.riseLayers,
    surfaceMode:
      readSurfaceMode(value.surfaceMode) ??
      defaultMapEditorBuilderToolState.surfaceMode,
    terrainBrushMode:
      readTerrainBrushMode(value.terrainBrushMode) ??
      defaultMapEditorBuilderToolState.terrainBrushMode,
    terrainBrushStrengthMeters:
      typeof value.terrainBrushStrengthMeters === "number" &&
      Number.isFinite(value.terrainBrushStrengthMeters)
        ? Math.max(0.05, value.terrainBrushStrengthMeters)
        : defaultMapEditorBuilderToolState.terrainBrushStrengthMeters,
    terrainBrushSizeCells:
      readTerrainBrushSizeCells(value.terrainBrushSizeCells) ??
      defaultMapEditorBuilderToolState.terrainBrushSizeCells,
    terrainCliffSpanCells:
      typeof value.terrainCliffSpanCells === "number" &&
      Number.isFinite(value.terrainCliffSpanCells)
        ? Math.max(0, Math.min(8, Math.round(value.terrainCliffSpanCells)))
        : defaultMapEditorBuilderToolState.terrainCliffSpanCells,
    terrainBrushTargetHeightMeters:
      typeof value.terrainBrushTargetHeightMeters === "number" &&
      Number.isFinite(value.terrainBrushTargetHeightMeters)
        ? value.terrainBrushTargetHeightMeters
        : defaultMapEditorBuilderToolState.terrainBrushTargetHeightMeters,
    terrainMaterialId:
      readMaterialId(value.terrainMaterialId) ??
      defaultMapEditorBuilderToolState.terrainMaterialId,
    terrainGenerationFrequency:
      typeof value.terrainGenerationFrequency === "number" &&
      Number.isFinite(value.terrainGenerationFrequency)
        ? Math.max(0.001, value.terrainGenerationFrequency)
        : defaultMapEditorBuilderToolState.terrainGenerationFrequency,
    terrainGenerationMaxElevationMeters,
    terrainGenerationMaxSlopeDegrees:
      typeof value.terrainGenerationMaxSlopeDegrees === "number" &&
      Number.isFinite(value.terrainGenerationMaxSlopeDegrees)
        ? Math.max(1, Math.min(89, value.terrainGenerationMaxSlopeDegrees))
        : defaultMapEditorBuilderToolState.terrainGenerationMaxSlopeDegrees,
    terrainGenerationMinElevationMeters,
    terrainGenerationOctaves:
      readPositiveInteger(
        value.terrainGenerationOctaves,
        defaultMapEditorBuilderToolState.terrainGenerationOctaves
      ),
    terrainGenerationWarpFrequency:
      typeof value.terrainGenerationWarpFrequency === "number" &&
      Number.isFinite(value.terrainGenerationWarpFrequency)
        ? Math.max(0.001, value.terrainGenerationWarpFrequency)
        : defaultMapEditorBuilderToolState.terrainGenerationWarpFrequency,
    terrainGenerationWarpStrengthMeters:
      typeof value.terrainGenerationWarpStrengthMeters === "number" &&
      Number.isFinite(value.terrainGenerationWarpStrengthMeters)
        ? Math.max(0, value.terrainGenerationWarpStrengthMeters)
        : defaultMapEditorBuilderToolState.terrainGenerationWarpStrengthMeters,
    terrainNoiseSeed:
      typeof value.terrainNoiseSeed === "number" && Number.isFinite(value.terrainNoiseSeed)
        ? Math.round(value.terrainNoiseSeed)
        : defaultMapEditorBuilderToolState.terrainNoiseSeed,
    terrainSmoothEdges:
      typeof value.terrainSmoothEdges === "boolean"
        ? value.terrainSmoothEdges
        : defaultMapEditorBuilderToolState.terrainSmoothEdges,
    wallHeightMeters:
      typeof value.wallHeightMeters === "number" &&
      Number.isFinite(value.wallHeightMeters)
        ? Math.max(0.25, value.wallHeightMeters)
        : defaultMapEditorBuilderToolState.wallHeightMeters,
    wallPresetId:
      readWallPresetId(value.wallPresetId) ??
      defaultMapEditorBuilderToolState.wallPresetId,
    wallThicknessMeters:
      typeof value.wallThicknessMeters === "number" &&
      Number.isFinite(value.wallThicknessMeters)
        ? Math.max(0.1, value.wallThicknessMeters)
        : defaultMapEditorBuilderToolState.wallThicknessMeters,
    waterDepthMeters:
      typeof value.waterDepthMeters === "number" && Number.isFinite(value.waterDepthMeters)
        ? Math.max(0.5, value.waterDepthMeters)
        : defaultMapEditorBuilderToolState.waterDepthMeters,
    waterFootprintCellsX: waterUsesLegacyDefault
      ? defaultMapEditorBuilderToolState.waterFootprintCellsX
      : storedWaterFootprintCellsX,
    waterFootprintCellsZ: waterUsesLegacyDefault
      ? defaultMapEditorBuilderToolState.waterFootprintCellsZ
      : storedWaterFootprintCellsZ,
    waterTopElevationMeters:
      typeof value.waterTopElevationMeters === "number" &&
      Number.isFinite(value.waterTopElevationMeters)
        ? value.waterTopElevationMeters
        : defaultMapEditorBuilderToolState.waterTopElevationMeters
  });
}

function readSectionOpenState(value: unknown): Readonly<Record<string, boolean>> {
  if (!isRecord(value)) {
    return freezeSectionOpenState({});
  }

  const nextState: Record<string, boolean> = {};

  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate === "boolean") {
      nextState[key] = candidate;
    }
  }

  return freezeSectionOpenState(nextState);
}

function readBooleanRecordEntry(
  value: Record<string, unknown>,
  key: keyof MapEditorSceneVisibilitySnapshot
): boolean {
  const candidate = value[key];

  return typeof candidate === "boolean"
    ? candidate
    : defaultMapEditorSceneVisibility[key];
}

function readSceneVisibility(value: unknown): MapEditorSceneVisibilitySnapshot {
  if (!isRecord(value)) {
    return defaultMapEditorSceneVisibility;
  }

  return Object.freeze({
    authoredLights: readBooleanRecordEntry(value, "authoredLights"),
    authoredModules: readBooleanRecordEntry(value, "authoredModules"),
    authoredSurfaces: readBooleanRecordEntry(value, "authoredSurfaces"),
    gameplayMarkers: readBooleanRecordEntry(value, "gameplayMarkers"),
    terrain: readBooleanRecordEntry(value, "terrain"),
    waterRegions: readBooleanRecordEntry(value, "waterRegions"),
    worldSun: readBooleanRecordEntry(value, "worldSun")
  });
}

export const defaultMapEditorUiPrefs =
  Object.freeze<MapEditorUiPrefsSnapshot>({
    builderToolState: defaultMapEditorBuilderToolState,
    inspectorCollapsed: false,
    sceneVisibility: defaultMapEditorSceneVisibility,
    sceneRailCollapsed: false,
    sectionOpenState: freezeSectionOpenState({})
  });

export function loadMapEditorUiPrefs(
  storage: MapEditorUiStorageLike | null
): MapEditorUiPrefsSnapshot {
  if (storage === null) {
    return defaultMapEditorUiPrefs;
  }

  const rawValue = storage.getItem(storedMapEditorUiPrefsKey);

  if (rawValue === null) {
    return defaultMapEditorUiPrefs;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as StoredMapEditorUiPrefsRecord;

    if (
      !isRecord(parsedValue) ||
      parsedValue.version !== storedMapEditorUiPrefsVersion
    ) {
      return defaultMapEditorUiPrefs;
    }

    return Object.freeze({
      builderToolState: readBuilderToolState(parsedValue.builderToolState),
      inspectorCollapsed:
        typeof parsedValue.inspectorCollapsed === "boolean"
          ? parsedValue.inspectorCollapsed
          : false,
      sceneVisibility: readSceneVisibility(parsedValue.sceneVisibility),
      sceneRailCollapsed:
        typeof parsedValue.sceneRailCollapsed === "boolean"
          ? parsedValue.sceneRailCollapsed
          : false,
      sectionOpenState: readSectionOpenState(parsedValue.sectionOpenState)
    });
  } catch {
    return defaultMapEditorUiPrefs;
  }
}

export function saveMapEditorUiPrefs(
  storage: MapEditorUiStorageLike | null,
  prefs: MapEditorUiPrefsSnapshot
): void {
  if (storage === null) {
    return;
  }

  storage.setItem(
    storedMapEditorUiPrefsKey,
    JSON.stringify(
      Object.freeze({
        builderToolState: prefs.builderToolState,
        inspectorCollapsed: prefs.inspectorCollapsed,
        sceneVisibility: prefs.sceneVisibility,
        sceneRailCollapsed: prefs.sceneRailCollapsed,
        sectionOpenState: prefs.sectionOpenState,
        version: storedMapEditorUiPrefsVersion
      })
    )
  );
}
