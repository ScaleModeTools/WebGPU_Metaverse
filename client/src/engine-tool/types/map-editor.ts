import type { MetaverseWorldSurfaceVector3Snapshot } from "@webgpu-metaverse/shared/metaverse/world";

export type MapEditorViewportToolMode = "build" | "move" | "rotate" | "scale";
export type MapEditorViewportHelperId =
  | "axes"
  | "grid"
  | "polarGrid"
  | "selectionBounds";

export interface MapEditorViewportHelperVisibilitySnapshot {
  readonly axes: boolean;
  readonly grid: boolean;
  readonly polarGrid: boolean;
  readonly selectionBounds: boolean;
}

export const defaultMapEditorViewportHelperVisibility =
  Object.freeze<MapEditorViewportHelperVisibilitySnapshot>({
    axes: true,
    grid: true,
    polarGrid: false,
    selectionBounds: true
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
