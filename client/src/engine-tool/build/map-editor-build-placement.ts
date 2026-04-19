import type { MapEditorBuildPrimitiveCatalogEntry } from "@/engine-tool/build/map-editor-build-primitives";

export interface MapEditorBuildPlacementPositionSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const mapEditorBuildGridUnitMeters = 4;

function snapMapEditorBuildCoordinate(value: number): number {
  return Math.round(value / mapEditorBuildGridUnitMeters) * mapEditorBuildGridUnitMeters;
}

export function resolveMapEditorBuildGroundPlacementPosition(
  point: MapEditorBuildPlacementPositionSnapshot,
  _primitive: MapEditorBuildPrimitiveCatalogEntry
): MapEditorBuildPlacementPositionSnapshot {
  return Object.freeze({
    x: snapMapEditorBuildCoordinate(point.x),
    y: 0,
    z: snapMapEditorBuildCoordinate(point.z)
  });
}
