import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Plane,
  PlaneGeometry,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGPURenderer
} from "three/webgpu";

import { environmentPropManifest } from "@/assets/config/environment-prop-manifest";
import type {
  EnvironmentAssetDescriptor,
  EnvironmentRenderLodDescriptor
} from "@/assets/types/environment-asset-manifest";
import {
  resolveMapEditorBuildAssetPlacementPosition,
  mapEditorBuildGridUnitMeters,
  resolveMapEditorBuildFootprintCenterPosition,
  resolveMapEditorBuildGroundPosition,
  resolveMapEditorBuildPathDirectedSlopeSegmentEnd,
  resolveMapEditorBuildPathAnchorPosition,
  resolveMapEditorBuildPathSegmentEnd,
  resolveMapEditorBuildRectangleFromGridPoints,
  resolveMapEditorBuildSizedCenterPosition,
  resolveMapEditorBuildWallSegment,
  resolveMapEditorBuildWallSegmentEnd
} from "@/engine-tool/build/map-editor-build-placement";
import { readMapEditorBuildPrimitiveCatalogEntry } from "@/engine-tool/build/map-editor-build-primitives";
import type {
  MapEditorPlayerSpawnDraftSnapshot,
  MapEditorResourceSpawnDraftSnapshot,
  MapEditorSceneObjectDraftSnapshot,
  MapEditorWaterRegionDraftSnapshot
} from "@/engine-tool/project/map-editor-project-scene-drafts";
import {
  resolveMapEditorWaterRegionCenter,
  resolveMapEditorWaterRegionSize
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
import { resolveMapEditorTerrainCellPosition } from "@/engine-tool/project/map-editor-project-state";
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
import {
  applyMetaverseSceneEnvironmentRendererTuning,
  createMetaverseSceneEnvironment,
  disposeMetaverseSceneEnvironment,
  syncMetaverseSceneEnvironmentToCamera,
  type MetaverseSceneEnvironmentRuntime
} from "@/metaverse/render/environment/metaverse-scene-environment";
import { resolveMetaverseSceneSemanticPreviewColorHex } from "@/metaverse/render/environment/metaverse-scene-semantic-material-textures";

import type { MapEditorViewportHelperHandles } from "./map-editor-viewport-helpers";
import {
  createMapEditorViewportHelperHandles,
  disposeMapEditorViewportHelperHandles,
  replaceMapEditorViewportSelectionBoundsHelper,
  syncMapEditorViewportHelperGridSize,
  syncMapEditorViewportHelperVisibility
} from "./map-editor-viewport-helpers";
import { MapEditorViewportKeyboardFlightController } from "./map-editor-viewport-keyboard-flight";
import {
  createMapEditorViewportOrbitControls,
  frameMapEditorViewportCamera
} from "./map-editor-viewport-orbit-controls";
import {
  applyMapEditorViewportPreviewOpacity,
  createMapEditorViewportPlacementCollisionAnchor,
  disposeMapEditorViewportPreviewGroup,
  MapEditorViewportPreviewAssetLibrary,
  syncMapEditorViewportPlacementAnchorTransform,
  syncMapEditorViewportPlacementPreviewAnchor
} from "./map-editor-viewport-preview-assets";
import type { MapEditorViewportSceneDraftHandles } from "./map-editor-viewport-scene-drafts";
import {
  createMapEditorViewportSceneDraftHandles,
  disposeMapEditorViewportSceneDraftHandles,
  syncMapEditorViewportSceneDrafts
} from "./map-editor-viewport-scene-drafts";
import type { MapEditorViewportSemanticDraftHandles } from "./map-editor-viewport-semantic-drafts";
import {
  createMapEditorViewportSemanticDraftHandles,
  disposeMapEditorViewportSemanticDraftHandles,
  syncMapEditorViewportSemanticDrafts
} from "./map-editor-viewport-semantic-drafts";
import { MapEditorViewportTransformController } from "./map-editor-viewport-transform-controls";

interface MapEditorViewportProps {
  readonly activeModuleAssetId: string | null;
  readonly builderToolState: MapEditorBuilderToolStateSnapshot;
  readonly bundleId: string;
  readonly connectorDrafts: readonly MapEditorConnectorDraftSnapshot[];
  readonly edgeDrafts: readonly MapEditorEdgeDraftSnapshot[];
  readonly environmentPresentation:
    MapEditorProjectSnapshot["environmentPresentation"];
  readonly gameplayVolumeDrafts: readonly MapEditorGameplayVolumeDraftSnapshot[];
  readonly helperGridSizeMeters: number;
  readonly helperVisibility: MapEditorViewportHelperVisibilitySnapshot;
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
  readonly onSelectEntity: (entityRef: MapEditorSelectedEntityRef | null) => void;
  readonly placementDrafts: readonly MapEditorPlacementDraftSnapshot[];
  readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
  readonly regionDrafts: readonly MapEditorRegionDraftSnapshot[];
  readonly resourceSpawnDrafts: readonly MapEditorResourceSpawnDraftSnapshot[];
  readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
  readonly sceneVisibility: MapEditorSceneVisibilitySnapshot;
  readonly selectedEntityRef: MapEditorSelectedEntityRef | null;
  readonly structuralDrafts: readonly MapEditorStructuralDraftSnapshot[];
  readonly surfaceDrafts: readonly MapEditorSurfaceDraftSnapshot[];
  readonly terrainPatchDrafts: readonly MapEditorTerrainPatchDraftSnapshot[];
  readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
  readonly viewportToolMode: MapEditorViewportToolMode;
}

interface PlacementExtents {
  readonly maxX: number;
  readonly maxZ: number;
  readonly minX: number;
  readonly minZ: number;
}

interface MapEditorPathAnchorSnapshot {
  readonly center: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly elevation: number;
}

interface MapEditorBuildPlacementReferenceSnapshot {
  readonly elevation: number;
  readonly point: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

function createTransformTargetFromSelectedEntity(
  selectedEntityRef: MapEditorSelectedEntityRef | null
): MapEditorViewportTransformTargetRef | null {
  if (selectedEntityRef?.kind === "module") {
    return Object.freeze({
      id: selectedEntityRef.id,
      kind: "placement"
    });
  }

  if (selectedEntityRef?.kind === "player-spawn") {
    return Object.freeze({
      id: selectedEntityRef.id,
      kind: "player-spawn"
    });
  }

  if (
    selectedEntityRef?.kind === "world-atmosphere" ||
    selectedEntityRef?.kind === "world-sky" ||
    selectedEntityRef?.kind === "world-sun"
  ) {
    return null;
  }

  if (selectedEntityRef === null) {
    return null;
  }

  return Object.freeze({
    id: selectedEntityRef.id,
    kind: selectedEntityRef.kind
  });
}

function shouldSuppressOrbitWhileBuildPointerHeld(
  viewportToolMode: MapEditorViewportToolMode
): boolean {
  switch (viewportToolMode) {
    case "move":
    case "rotate":
    case "scale":
    case "select":
    case "vertex":
      return false;
    default:
      return true;
  }
}

function disposeBuilderPreviewGroup(group: Group): void {
  group.traverse((node) => {
    if (!("isMesh" in node) || node.isMesh !== true) {
      return;
    }

    const mesh = node as Mesh;

    mesh.geometry.dispose();

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const material of materials) {
      material.dispose();
    }
  });

  group.clear();
}

function createPreviewMesh(
  geometry: BufferGeometry,
  material: MeshStandardMaterial
): Mesh {
  return new Mesh(geometry, material);
}

function createPreviewMaterial(
  color: string,
  opacity = 0.28
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.08,
    opacity,
    roughness: 0.45,
    side: DoubleSide,
    transparent: true
  });
}

function resolveMaterialReferencePreviewColorHex(
  materialDefinitions: readonly MapEditorMaterialDefinitionDraftSnapshot[],
  materialReferenceId: string,
  fallbackMaterialId: MapEditorStructuralDraftSnapshot["materialId"]
): string {
  const materialDefinition =
    materialDefinitions.find(
      (candidateMaterialDefinition) =>
        candidateMaterialDefinition.materialId === materialReferenceId
    ) ?? null;

  return materialDefinition?.baseColorHex ??
    resolveMetaverseSceneSemanticPreviewColorHex(fallbackMaterialId);
}

function resolveSnappedGroundPosition(point: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  return resolveMapEditorBuildGroundPosition(point, 0);
}

function resolveEdgeTopElevation(edge: MapEditorEdgeDraftSnapshot): number {
  return edge.center.y + edge.heightMeters * 0.5;
}

function resolveSurfaceSupportElevation(
  surface: MapEditorSurfaceDraftSnapshot,
  point: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  edgeDrafts: readonly MapEditorEdgeDraftSnapshot[]
): number {
  const edgeDraft =
    edgeDrafts.find((candidateEdge) => candidateEdge.surfaceId === surface.surfaceId) ??
    null;

  if (edgeDraft !== null) {
    return resolveEdgeTopElevation(edgeDraft);
  }

  return Math.abs(surface.slopeRiseMeters) > 0.01 ? point.y : surface.elevation;
}

function resolveMapEditorBuildSupportElevation(
  entityRef: MapEditorSelectedEntityRef,
  point: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  drafts: {
    readonly connectorDrafts: readonly MapEditorConnectorDraftSnapshot[];
    readonly edgeDrafts: readonly MapEditorEdgeDraftSnapshot[];
    readonly regionDrafts: readonly MapEditorRegionDraftSnapshot[];
    readonly structuralDrafts: readonly MapEditorStructuralDraftSnapshot[];
    readonly surfaceDrafts: readonly MapEditorSurfaceDraftSnapshot[];
    readonly terrainPatchDrafts: readonly MapEditorTerrainPatchDraftSnapshot[];
  }
): number | null {
  switch (entityRef.kind) {
    case "edge": {
      const edgeDraft =
        drafts.edgeDrafts.find((edge) => edge.edgeId === entityRef.id) ?? null;

      return edgeDraft === null ? null : resolveEdgeTopElevation(edgeDraft);
    }
    case "surface": {
      const surfaceDraft =
        drafts.surfaceDrafts.find((surface) => surface.surfaceId === entityRef.id) ??
        null;

      return surfaceDraft === null
        ? null
        : resolveSurfaceSupportElevation(surfaceDraft, point, drafts.edgeDrafts);
    }
    case "region": {
      const regionDraft =
        drafts.regionDrafts.find((region) => region.regionId === entityRef.id) ??
        null;
      const surfaceDraft =
        regionDraft === null
          ? null
          : drafts.surfaceDrafts.find(
              (surface) => surface.surfaceId === regionDraft.surfaceId
            ) ?? null;

      if (surfaceDraft !== null) {
        return resolveSurfaceSupportElevation(surfaceDraft, point, drafts.edgeDrafts);
      }

      return regionDraft === null ? null : regionDraft.center.y;
    }
    case "structure": {
      const structureDraft =
        drafts.structuralDrafts.find(
          (structure) => structure.structureId === entityRef.id
        ) ?? null;

      return structureDraft === null
        ? null
        : structureDraft.center.y + structureDraft.size.y;
    }
    case "connector": {
      const connectorDraft =
        drafts.connectorDrafts.find(
          (connector) => connector.connectorId === entityRef.id
        ) ?? null;

      return connectorDraft === null
        ? null
        : connectorDraft.center.y + connectorDraft.size.y * 0.5;
    }
    case "terrain-patch":
      return resolveTerrainHeightAtPosition(drafts.terrainPatchDrafts, point);
    case "module":
      return point.y;
    default:
      return null;
  }
}

function findTerrainPatchAtPosition(
  terrainPatchDrafts: readonly MapEditorTerrainPatchDraftSnapshot[],
  position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }
): MapEditorTerrainPatchDraftSnapshot | null {
  return (
    terrainPatchDrafts.find((terrainPatch) => {
      const halfWidth =
        ((terrainPatch.sampleCountX - 1) * terrainPatch.sampleSpacingMeters) * 0.5;
      const halfDepth =
        ((terrainPatch.sampleCountZ - 1) * terrainPatch.sampleSpacingMeters) * 0.5;

      return (
        Math.abs(position.x - terrainPatch.origin.x) <= halfWidth + 0.01 &&
        Math.abs(position.z - terrainPatch.origin.z) <= halfDepth + 0.01
      );
    }) ?? null
  );
}

function resolveTerrainHeightAtPosition(
  terrainPatchDrafts: readonly MapEditorTerrainPatchDraftSnapshot[],
  position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }
): number {
  const terrainPatch = findTerrainPatchAtPosition(terrainPatchDrafts, position);

  if (terrainPatch === null) {
    return 0;
  }

  const halfCellCountX = (terrainPatch.sampleCountX - 1) * 0.5;
  const halfCellCountZ = (terrainPatch.sampleCountZ - 1) * 0.5;
  const cellX = Math.round(
    (position.x - terrainPatch.origin.x) / terrainPatch.sampleSpacingMeters +
      halfCellCountX
  );
  const cellZ = Math.round(
    (position.z - terrainPatch.origin.z) / terrainPatch.sampleSpacingMeters +
      halfCellCountZ
  );

  if (
    cellX < 0 ||
    cellX >= terrainPatch.sampleCountX ||
    cellZ < 0 ||
    cellZ >= terrainPatch.sampleCountZ
  ) {
    return terrainPatch.origin.y;
  }

  const heightIndex = cellZ * terrainPatch.sampleCountX + cellX;

  return terrainPatch.origin.y + (terrainPatch.heightSamples[heightIndex] ?? 0);
}

interface MapEditorTerrainVertexTransformTarget {
  readonly cellX: number;
  readonly cellZ: number;
  readonly terrainPatchId: string;
}

function createTerrainVertexTransformTargetId(
  target: MapEditorTerrainVertexTransformTarget
): string {
  return `${encodeURIComponent(target.terrainPatchId)}:${target.cellX}:${target.cellZ}`;
}

function resolveTerrainPatchCellAtPosition(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot,
  position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }
): {
  readonly cellX: number;
  readonly cellZ: number;
} | null {
  const deltaX = position.x - terrainPatch.origin.x;
  const deltaZ = position.z - terrainPatch.origin.z;
  const sine = Math.sin(terrainPatch.rotationYRadians);
  const cosine = Math.cos(terrainPatch.rotationYRadians);
  const localX = deltaX * cosine - deltaZ * sine;
  const localZ = deltaX * sine + deltaZ * cosine;
  const cellX = Math.round(
    localX / terrainPatch.sampleSpacingMeters + (terrainPatch.sampleCountX - 1) * 0.5
  );
  const cellZ = Math.round(
    localZ / terrainPatch.sampleSpacingMeters + (terrainPatch.sampleCountZ - 1) * 0.5
  );

  return cellX >= 0 &&
    cellX < terrainPatch.sampleCountX &&
    cellZ >= 0 &&
    cellZ < terrainPatch.sampleCountZ
    ? Object.freeze({ cellX, cellZ })
    : null;
}

function resolveTerrainPatchVertexWorldPosition(
  terrainPatch: MapEditorTerrainPatchDraftSnapshot,
  target: Pick<MapEditorTerrainVertexTransformTarget, "cellX" | "cellZ">
): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  const localX =
    (target.cellX - (terrainPatch.sampleCountX - 1) * 0.5) *
    terrainPatch.sampleSpacingMeters;
  const localZ =
    (target.cellZ - (terrainPatch.sampleCountZ - 1) * 0.5) *
    terrainPatch.sampleSpacingMeters;
  const sine = Math.sin(terrainPatch.rotationYRadians);
  const cosine = Math.cos(terrainPatch.rotationYRadians);
  const heightIndex = target.cellZ * terrainPatch.sampleCountX + target.cellX;

  return Object.freeze({
    x: terrainPatch.origin.x + localX * cosine + localZ * sine,
    y: terrainPatch.origin.y + (terrainPatch.heightSamples[heightIndex] ?? 0),
    z: terrainPatch.origin.z - localX * sine + localZ * cosine
  });
}

function normalizeTerrainBrushSizeCells(brushSizeCells: number): number {
  return Math.max(1, Math.min(16, Math.round(brushSizeCells)));
}

const defaultTerrainPatchPreviewFootprintCells = 8;

function readTerrainBrushStrokeKey(
  terrainPatchDrafts: readonly MapEditorTerrainPatchDraftSnapshot[],
  position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }
): string {
  const terrainPatch = findTerrainPatchAtPosition(terrainPatchDrafts, position);

  if (terrainPatch !== null) {
    const targetCell = (() => {
      const cellX = Math.round(
        (position.x - terrainPatch.origin.x) / terrainPatch.sampleSpacingMeters +
          (terrainPatch.sampleCountX - 1) * 0.5
      );
      const cellZ = Math.round(
        (position.z - terrainPatch.origin.z) / terrainPatch.sampleSpacingMeters +
          (terrainPatch.sampleCountZ - 1) * 0.5
      );

      return cellX >= 0 &&
        cellX < terrainPatch.sampleCountX &&
        cellZ >= 0 &&
        cellZ < terrainPatch.sampleCountZ
        ? Object.freeze({
            cellX,
            cellZ
          })
        : null;
    })();

    if (targetCell !== null) {
      return `${terrainPatch.terrainPatchId}:${targetCell.cellX}:${targetCell.cellZ}`;
    }
  }

  const snappedPosition = resolveSnappedGroundPosition(position);

  return `ground:${snappedPosition.x}:${snappedPosition.z}`;
}

function addTerrainPatchPreview(
  previewGroup: Group,
  startPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  hoverPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  materialColor: string
): void {
  const snappedStart = resolveMapEditorBuildGroundPosition(
    startPosition,
    startPosition.y
  );
  const snappedHover = resolveMapEditorBuildGroundPosition(
    hoverPosition,
    startPosition.y
  );
  const rectangle =
    snappedStart.x === snappedHover.x && snappedStart.z === snappedHover.z
      ? Object.freeze({
          center: resolveMapEditorBuildFootprintCenterPosition(
            startPosition,
            startPosition.y,
            defaultTerrainPatchPreviewFootprintCells,
            defaultTerrainPatchPreviewFootprintCells
          ),
          size: Object.freeze({
            x:
              defaultTerrainPatchPreviewFootprintCells *
              mapEditorBuildGridUnitMeters,
            y: 0.5,
            z:
              defaultTerrainPatchPreviewFootprintCells *
              mapEditorBuildGridUnitMeters
          })
        })
      : resolveMapEditorBuildRectangleFromGridPoints(
          snappedStart,
          snappedHover,
          0.5
        );
  const mesh = createPreviewMesh(
    new BoxGeometry(rectangle.size.x, 0.18, rectangle.size.z),
    createPreviewMaterial(materialColor, 0.24)
  );

  mesh.position.set(
    rectangle.center.x,
    rectangle.center.y + 0.09,
    rectangle.center.z
  );
  previewGroup.add(mesh);
}

function addTerrainBrushPreview(
  previewGroup: Group,
  terrainPatchDrafts: readonly MapEditorTerrainPatchDraftSnapshot[],
  position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  brushSizeCells: number,
  smoothEdges: boolean,
  materialColor: string
): void {
  const normalizedBrushSizeCells = normalizeTerrainBrushSizeCells(brushSizeCells);
  const terrainPatch = findTerrainPatchAtPosition(terrainPatchDrafts, position);
  const previewCells: {
    readonly cellDistance: number;
    readonly height: number;
    readonly sizeMeters: number;
    readonly x: number;
    readonly z: number;
  }[] = [];

  if (terrainPatch === null) {
    return;
  }

  const halfCellCountX = (terrainPatch.sampleCountX - 1) * 0.5;
  const halfCellCountZ = (terrainPatch.sampleCountZ - 1) * 0.5;
  const targetCellX = Math.round(
    (position.x - terrainPatch.origin.x) / terrainPatch.sampleSpacingMeters +
      halfCellCountX
  );
  const targetCellZ = Math.round(
    (position.z - terrainPatch.origin.z) / terrainPatch.sampleSpacingMeters +
      halfCellCountZ
  );
  const brushOffset = Math.floor(normalizedBrushSizeCells * 0.5);
  const minCellX = targetCellX - brushOffset;
  const minCellZ = targetCellZ - brushOffset;
  const maxCellX = minCellX + normalizedBrushSizeCells - 1;
  const maxCellZ = minCellZ + normalizedBrushSizeCells - 1;

  for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
    if (cellZ < 0 || cellZ >= terrainPatch.sampleCountZ) {
      continue;
    }

    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      if (cellX < 0 || cellX >= terrainPatch.sampleCountX) {
        continue;
      }

      const cellPosition = resolveMapEditorTerrainCellPosition(
        terrainPatch,
        cellX,
        cellZ
      );

      previewCells.push(
        Object.freeze({
          cellDistance: Math.max(
            Math.abs(cellX - targetCellX),
            Math.abs(cellZ - targetCellZ)
          ),
          height: resolveTerrainHeightAtPosition(terrainPatchDrafts, cellPosition),
          sizeMeters: terrainPatch.sampleSpacingMeters,
          x: cellPosition.x,
          z: cellPosition.z
        })
      );
    }
  }

  for (const previewCell of previewCells) {
    const opacity =
      smoothEdges === true
        ? Math.max(0.18, 0.38 - previewCell.cellDistance * 0.06)
        : 0.34;
    const mesh = createPreviewMesh(
      new BoxGeometry(
        previewCell.sizeMeters * 0.96,
        0.24,
        previewCell.sizeMeters * 0.96
      ),
      createPreviewMaterial(materialColor, opacity)
    );

    mesh.position.set(previewCell.x, previewCell.height + 0.12, previewCell.z);
    previewGroup.add(mesh);
  }
}

function addWallSegmentPreview(
  previewGroup: Group,
  startPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  hoverPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  builderToolState: MapEditorBuilderToolStateSnapshot,
  materialColor: string
): void {
  const wallSegment = resolveMapEditorBuildWallSegment(
    startPosition,
    hoverPosition
  );

  if (wallSegment === null) {
    return;
  }

  const mesh = createPreviewMesh(
    new BoxGeometry(
      wallSegment.lengthMeters,
      builderToolState.wallHeightMeters,
      builderToolState.wallThicknessMeters
    ),
    createPreviewMaterial(materialColor, 0.34)
  );

  mesh.position.set(
    wallSegment.center.x,
    wallSegment.center.y + builderToolState.wallHeightMeters * 0.5,
    wallSegment.center.z
  );
  mesh.rotation.y = wallSegment.rotationYRadians;
  previewGroup.add(mesh);
}

function addFloorPreview(
  previewGroup: Group,
  startPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  hoverPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  builderToolState: MapEditorBuilderToolStateSnapshot,
  materialColor: string
): void {
  const elevation = startPosition.y + builderToolState.floorElevationMeters;
  const snappedStart = resolveMapEditorBuildGroundPosition(startPosition, elevation);
  const snappedHover = resolveMapEditorBuildGroundPosition(hoverPosition, elevation);
  const rectangle =
    snappedStart.x === snappedHover.x && snappedStart.z === snappedHover.z
      ? Object.freeze({
          center: resolveMapEditorBuildFootprintCenterPosition(
            startPosition,
            elevation,
            builderToolState.floorFootprintCellsX,
            builderToolState.floorFootprintCellsZ
          ),
          size: Object.freeze({
            x:
              builderToolState.floorFootprintCellsX *
              mapEditorBuildGridUnitMeters,
            y: 0.5,
            z:
              builderToolState.floorFootprintCellsZ *
              mapEditorBuildGridUnitMeters
          })
        })
      : resolveMapEditorBuildRectangleFromGridPoints(snappedStart, snappedHover, 0.5);
  const mesh = createPreviewMesh(
    new BoxGeometry(rectangle.size.x, 0.18, rectangle.size.z),
    createPreviewMaterial(materialColor, 0.34)
  );

  mesh.position.set(
    rectangle.center.x,
    rectangle.center.y + 0.09,
    rectangle.center.z
  );
  previewGroup.add(mesh);
}

function addFloorPolygonPreview(
  previewGroup: Group,
  points: readonly {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }[],
  hoverPoint: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null,
  materialColor: string
): void {
  const previewPoints =
    hoverPoint === null ? points : Object.freeze([...points, hoverPoint]);

  for (const point of previewPoints) {
    const marker = createPreviewMesh(
      new BoxGeometry(0.35, 0.18, 0.35),
      createPreviewMaterial(materialColor, 0.42)
    );

    marker.position.set(point.x, point.y + 0.09, point.z);
    previewGroup.add(marker);
  }

  for (let pointIndex = 0; pointIndex + 1 < previewPoints.length; pointIndex += 1) {
    addSegmentPreview(
      previewGroup,
      previewPoints[pointIndex]!,
      previewPoints[pointIndex + 1]!,
      materialColor,
      1,
      0.14
    );
  }
}

function addPathPreview(
  previewGroup: Group,
  targetPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  targetElevationMeters: number,
  fromAnchor: MapEditorPathAnchorSnapshot | null,
  pathWidthCells: number,
  materialColor: string
): void {
  const topY = targetElevationMeters + 0.08;
  const pathWidthMeters =
    Math.max(1, pathWidthCells) * mapEditorBuildGridUnitMeters;
  const targetMesh = createPreviewMesh(
    new BoxGeometry(pathWidthMeters, 0.18, pathWidthMeters),
    createPreviewMaterial(materialColor, 0.34)
  );

  targetMesh.position.set(targetPosition.x, topY, targetPosition.z);
  previewGroup.add(targetMesh);

  if (fromAnchor === null) {
    return;
  }

  const deltaX = targetPosition.x - fromAnchor.center.x;
  const deltaZ = targetPosition.z - fromAnchor.center.z;
  const segmentLengthMeters = Math.hypot(deltaX, deltaZ);

  if (segmentLengthMeters <= 0.01) {
    return;
  }

  const riseMeters = targetElevationMeters - fromAnchor.elevation;
  const segmentHeightMeters =
    Math.abs(riseMeters) > 0.01 ? Math.abs(riseMeters) + 0.4 : 0.18;
  const segmentMesh = createPreviewMesh(
    new BoxGeometry(
      pathWidthMeters,
      segmentHeightMeters,
      Math.max(mapEditorBuildGridUnitMeters, segmentLengthMeters)
    ),
    createPreviewMaterial(materialColor, 0.22)
  );

  segmentMesh.position.set(
    (fromAnchor.center.x + targetPosition.x) * 0.5,
    Math.abs(riseMeters) > 0.01
      ? (fromAnchor.elevation + targetElevationMeters) * 0.5
      : targetElevationMeters + segmentHeightMeters * 0.5,
    (fromAnchor.center.z + targetPosition.z) * 0.5
  );
  segmentMesh.rotation.y = Math.atan2(deltaX, deltaZ);
  previewGroup.add(segmentMesh);
}

function addWaterPreview(
  previewGroup: Group,
  startPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  hoverPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  builderToolState: MapEditorBuilderToolStateSnapshot
): void {
  const depth = Math.max(0.5, builderToolState.waterDepthMeters);
  const topElevation = builderToolState.waterTopElevationMeters;
  const snappedStart = resolveMapEditorBuildGroundPosition(startPosition, topElevation);
  const snappedHover = resolveMapEditorBuildGroundPosition(hoverPosition, topElevation);
  const rectangle =
    snappedStart.x === snappedHover.x && snappedStart.z === snappedHover.z
      ? Object.freeze({
          center: resolveMapEditorBuildFootprintCenterPosition(
            startPosition,
            topElevation,
            builderToolState.waterFootprintCellsX,
            builderToolState.waterFootprintCellsZ
          ),
          size: Object.freeze({
            x: builderToolState.waterFootprintCellsX * mapEditorBuildGridUnitMeters,
            y: depth,
            z: builderToolState.waterFootprintCellsZ * mapEditorBuildGridUnitMeters
          })
        })
      : resolveMapEditorBuildRectangleFromGridPoints(snappedStart, snappedHover, depth);
  const volumeMesh = createPreviewMesh(
    new BoxGeometry(rectangle.size.x, depth, rectangle.size.z),
    createPreviewMaterial("#38bdf8", 0.26)
  );
  const topPlane = createPreviewMesh(
    new PlaneGeometry(rectangle.size.x, rectangle.size.z),
    createPreviewMaterial("#67e8f9", 0.32)
  );

  volumeMesh.position.set(
    rectangle.center.x,
    topElevation - depth * 0.5,
    rectangle.center.z
  );
  topPlane.position.set(rectangle.center.x, topElevation + 0.02, rectangle.center.z);
  topPlane.rotation.x = -Math.PI * 0.5;
  previewGroup.add(volumeMesh);
  previewGroup.add(topPlane);
}

function addCoverPreview(
  previewGroup: Group,
  position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  builderToolState: MapEditorBuilderToolStateSnapshot,
  materialColor: string
): void {
  const sizeX =
    builderToolState.coverFootprintCellsX * mapEditorBuildGridUnitMeters;
  const sizeY = builderToolState.coverHeightCells * mapEditorBuildGridUnitMeters;
  const sizeZ =
    builderToolState.coverFootprintCellsZ * mapEditorBuildGridUnitMeters;
  const center = resolveMapEditorBuildFootprintCenterPosition(
    position,
    position.y,
    builderToolState.coverFootprintCellsX,
    builderToolState.coverFootprintCellsZ
  );
  const mesh = createPreviewMesh(
    new BoxGeometry(sizeX, sizeY, sizeZ),
    createPreviewMaterial(materialColor, 0.36)
  );

  mesh.position.set(center.x, position.y + sizeY * 0.5, center.z);
  previewGroup.add(mesh);
}

function addLightPreview(
  previewGroup: Group,
  position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  builderToolState: MapEditorBuilderToolStateSnapshot
): void {
  const lightHeight =
    builderToolState.lightKind === "ambient" || builderToolState.lightKind === "sun"
      ? 4
      : Math.max(2, builderToolState.lightRangeMeters * 0.18);
  const mesh = createPreviewMesh(
    new SphereGeometry(builderToolState.lightKind === "sun" ? 0.34 : 0.24, 18, 12),
    createPreviewMaterial(
      `rgb(${Math.round(builderToolState.lightColor[0] * 255)} ${Math.round(
        builderToolState.lightColor[1] * 255
      )} ${Math.round(builderToolState.lightColor[2] * 255)})`,
      0.48
    )
  );

  mesh.position.set(position.x, position.y + lightHeight, position.z);
  previewGroup.add(mesh);
}

function addSceneElementPreview(
  previewGroup: Group,
  position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  color: string,
  heightMeters: number
): void {
  const mesh = createPreviewMesh(
    new BoxGeometry(
      mapEditorBuildGridUnitMeters * 0.55,
      Math.max(0.5, heightMeters),
      mapEditorBuildGridUnitMeters * 0.55
    ),
    createPreviewMaterial(color, 0.34)
  );

  mesh.position.set(
    position.x,
    position.y + Math.max(0.5, heightMeters) * 0.5,
    position.z
  );
  previewGroup.add(mesh);
}

function addSegmentPreview(
  previewGroup: Group,
  startPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  hoverPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  color: string,
  widthCells: number,
  heightMeters = 3
): void {
  const snappedStart = resolveMapEditorBuildSizedCenterPosition(
    startPosition,
    startPosition.y,
    Math.max(1, widthCells) * mapEditorBuildGridUnitMeters,
    Math.max(1, widthCells) * mapEditorBuildGridUnitMeters
  );
  const snappedHover = resolveMapEditorBuildSizedCenterPosition(
    hoverPosition,
    hoverPosition.y,
    Math.max(1, widthCells) * mapEditorBuildGridUnitMeters,
    Math.max(1, widthCells) * mapEditorBuildGridUnitMeters
  );
  const deltaX = snappedHover.x - snappedStart.x;
  const deltaZ = snappedHover.z - snappedStart.z;
  const lengthMeters = Math.hypot(deltaX, deltaZ);

  if (lengthMeters <= 0.01) {
    const marker = createPreviewMesh(
      new BoxGeometry(
        mapEditorBuildGridUnitMeters * 0.55,
        0.5,
        mapEditorBuildGridUnitMeters * 0.55
      ),
      createPreviewMaterial(color, 0.36)
    );

    marker.position.set(
      snappedStart.x,
      snappedStart.y + 0.25,
      snappedStart.z
    );
    previewGroup.add(marker);
    return;
  }

  const mesh = createPreviewMesh(
    new BoxGeometry(
      Math.max(1, widthCells) * mapEditorBuildGridUnitMeters,
      Math.max(0.25, heightMeters),
      Math.max(mapEditorBuildGridUnitMeters, lengthMeters)
    ),
    createPreviewMaterial(color, 0.24)
  );

  mesh.position.set(
    (snappedStart.x + snappedHover.x) * 0.5,
    Math.min(snappedStart.y, snappedHover.y) +
      Math.max(0.25, heightMeters) * 0.5,
    (snappedStart.z + snappedHover.z) * 0.5
  );
  mesh.rotation.y = Math.atan2(deltaX, deltaZ);
  previewGroup.add(mesh);
}

function createEmptyPlacementExtents(): PlacementExtents {
  return Object.freeze({
    maxX: 0,
    maxZ: 0,
    minX: 0,
    minZ: 0
  });
}

interface PlacementFootprintHalfExtents {
  readonly x: number;
  readonly z: number;
}

function resolveDefaultEnvironmentRenderLod(
  asset: EnvironmentAssetDescriptor
): EnvironmentRenderLodDescriptor | null {
  return (
    asset.renderModel.lods.find(
      (lodDescriptor) => lodDescriptor.tier === asset.renderModel.defaultTier
    ) ??
    asset.renderModel.lods[0] ??
    null
  );
}

function resolveEnvironmentAssetFootprintHalfExtents(
  assetId: string
): PlacementFootprintHalfExtents | null {
  const asset =
    environmentPropManifest.environmentAssets.find(
      (environmentAsset) => environmentAsset.id === assetId
    ) ?? null;

  if (asset === null) {
    return null;
  }

  const defaultRenderLod = resolveDefaultEnvironmentRenderLod(asset);

  if (
    defaultRenderLod !== null &&
    "kind" in defaultRenderLod &&
    defaultRenderLod.kind === "procedural-box"
  ) {
    return Object.freeze({
      x: defaultRenderLod.size.x * 0.5,
      z: defaultRenderLod.size.z * 0.5
    });
  }

  let maxHalfExtentX = 0;
  let maxHalfExtentZ = 0;
  const colliderDescriptors = [
    ...(asset.collider === null ? [] : [asset.collider]),
    ...(asset.physicsColliders ?? [])
  ];

  for (const colliderDescriptor of colliderDescriptors) {
    maxHalfExtentX = Math.max(
      maxHalfExtentX,
      Math.abs(colliderDescriptor.center.x) + colliderDescriptor.size.x * 0.5
    );
    maxHalfExtentZ = Math.max(
      maxHalfExtentZ,
      Math.abs(colliderDescriptor.center.z) + colliderDescriptor.size.z * 0.5
    );
  }

  if (maxHalfExtentX > 0 || maxHalfExtentZ > 0) {
    return Object.freeze({
      x: maxHalfExtentX,
      z: maxHalfExtentZ
    });
  }

  return null;
}

function resolvePlacementFootprintHalfExtents(
  placement: MapEditorPlacementDraftSnapshot
): PlacementFootprintHalfExtents {
  const buildPrimitiveCatalogEntry = readMapEditorBuildPrimitiveCatalogEntry(
    placement.assetId
  );
  const baseHalfExtents =
    buildPrimitiveCatalogEntry === null
      ? (resolveEnvironmentAssetFootprintHalfExtents(placement.assetId) ??
        Object.freeze({
          x: 1,
          z: 1
        }))
      : Object.freeze({
          x: buildPrimitiveCatalogEntry.footprint.x * 0.5,
          z: buildPrimitiveCatalogEntry.footprint.z * 0.5
        });
  const scaledHalfExtentX = Math.max(0.5, baseHalfExtents.x * placement.scale.x);
  const scaledHalfExtentZ = Math.max(0.5, baseHalfExtents.z * placement.scale.z);
  const sinRotation = Math.abs(Math.sin(placement.rotationYRadians));
  const cosRotation = Math.abs(Math.cos(placement.rotationYRadians));

  return Object.freeze({
    x: scaledHalfExtentX * cosRotation + scaledHalfExtentZ * sinRotation,
    z: scaledHalfExtentX * sinRotation + scaledHalfExtentZ * cosRotation
  });
}

function resolvePlacementExtents(
  placementDrafts: readonly MapEditorPlacementDraftSnapshot[],
  sceneDrafts: {
    readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
    readonly resourceSpawnDrafts: readonly MapEditorResourceSpawnDraftSnapshot[];
    readonly connectorDrafts: readonly MapEditorConnectorDraftSnapshot[];
    readonly edgeDrafts: readonly MapEditorEdgeDraftSnapshot[];
    readonly gameplayVolumeDrafts: readonly MapEditorGameplayVolumeDraftSnapshot[];
    readonly lightDrafts: readonly MapEditorLightDraftSnapshot[];
    readonly regionDrafts: readonly MapEditorRegionDraftSnapshot[];
    readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
    readonly structuralDrafts: readonly MapEditorStructuralDraftSnapshot[];
    readonly surfaceDrafts: readonly MapEditorSurfaceDraftSnapshot[];
    readonly terrainPatchDrafts: readonly MapEditorTerrainPatchDraftSnapshot[];
    readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
  }
): PlacementExtents {
  if (
    placementDrafts.length === 0 &&
    sceneDrafts.playerSpawnDrafts.length === 0 &&
    sceneDrafts.resourceSpawnDrafts.length === 0 &&
    sceneDrafts.connectorDrafts.length === 0 &&
    sceneDrafts.edgeDrafts.length === 0 &&
    sceneDrafts.gameplayVolumeDrafts.length === 0 &&
    sceneDrafts.lightDrafts.length === 0 &&
    sceneDrafts.regionDrafts.length === 0 &&
    sceneDrafts.sceneObjectDrafts.length === 0 &&
    sceneDrafts.structuralDrafts.length === 0 &&
    sceneDrafts.surfaceDrafts.length === 0 &&
    sceneDrafts.terrainPatchDrafts.length === 0 &&
    sceneDrafts.waterRegionDrafts.length === 0
  ) {
    return createEmptyPlacementExtents();
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const placement of placementDrafts) {
    const placementHalfExtents = resolvePlacementFootprintHalfExtents(placement);

    minX = Math.min(minX, placement.position.x - placementHalfExtents.x);
    maxX = Math.max(maxX, placement.position.x + placementHalfExtents.x);
    minZ = Math.min(minZ, placement.position.z - placementHalfExtents.z);
    maxZ = Math.max(maxZ, placement.position.z + placementHalfExtents.z);
  }

  for (const spawnDraft of sceneDrafts.playerSpawnDrafts) {
    minX = Math.min(minX, spawnDraft.position.x);
    maxX = Math.max(maxX, spawnDraft.position.x);
    minZ = Math.min(minZ, spawnDraft.position.z);
    maxZ = Math.max(maxZ, spawnDraft.position.z);
  }

  for (const resourceSpawnDraft of sceneDrafts.resourceSpawnDrafts) {
    minX = Math.min(minX, resourceSpawnDraft.position.x);
    maxX = Math.max(maxX, resourceSpawnDraft.position.x);
    minZ = Math.min(minZ, resourceSpawnDraft.position.z);
    maxZ = Math.max(maxZ, resourceSpawnDraft.position.z);
  }

  for (const sceneObjectDraft of sceneDrafts.sceneObjectDrafts) {
    const highlightRadius = sceneObjectDraft.launchTarget?.highlightRadius ?? 2;

    minX = Math.min(minX, sceneObjectDraft.position.x - highlightRadius);
    maxX = Math.max(maxX, sceneObjectDraft.position.x + highlightRadius);
    minZ = Math.min(minZ, sceneObjectDraft.position.z - highlightRadius);
    maxZ = Math.max(maxZ, sceneObjectDraft.position.z + highlightRadius);
  }

  for (const waterRegionDraft of sceneDrafts.waterRegionDrafts) {
    const center = resolveMapEditorWaterRegionCenter(waterRegionDraft);
    const size = resolveMapEditorWaterRegionSize(waterRegionDraft);

    minX = Math.min(minX, center.x - size.x * 0.5);
    maxX = Math.max(maxX, center.x + size.x * 0.5);
    minZ = Math.min(minZ, center.z - size.z * 0.5);
    maxZ = Math.max(maxZ, center.z + size.z * 0.5);
  }

  for (const terrainPatch of sceneDrafts.terrainPatchDrafts) {
    const width = Math.max(
      1,
      (terrainPatch.sampleCountX - 1) * terrainPatch.sampleSpacingMeters
    );
    const depth = Math.max(
      1,
      (terrainPatch.sampleCountZ - 1) * terrainPatch.sampleSpacingMeters
    );

    minX = Math.min(minX, terrainPatch.origin.x - width * 0.5);
    maxX = Math.max(maxX, terrainPatch.origin.x + width * 0.5);
    minZ = Math.min(minZ, terrainPatch.origin.z - depth * 0.5);
    maxZ = Math.max(maxZ, terrainPatch.origin.z + depth * 0.5);
  }

  for (const surface of sceneDrafts.surfaceDrafts) {
    minX = Math.min(minX, surface.center.x - surface.size.x * 0.5);
    maxX = Math.max(maxX, surface.center.x + surface.size.x * 0.5);
    minZ = Math.min(minZ, surface.center.z - surface.size.z * 0.5);
    maxZ = Math.max(maxZ, surface.center.z + surface.size.z * 0.5);
  }

  for (const region of sceneDrafts.regionDrafts) {
    minX = Math.min(minX, region.center.x - region.size.x * 0.5);
    maxX = Math.max(maxX, region.center.x + region.size.x * 0.5);
    minZ = Math.min(minZ, region.center.z - region.size.z * 0.5);
    maxZ = Math.max(maxZ, region.center.z + region.size.z * 0.5);
  }

  for (const edge of sceneDrafts.edgeDrafts) {
    minX = Math.min(minX, edge.center.x - edge.lengthMeters * 0.5);
    maxX = Math.max(maxX, edge.center.x + edge.lengthMeters * 0.5);
    minZ = Math.min(minZ, edge.center.z - edge.lengthMeters * 0.5);
    maxZ = Math.max(maxZ, edge.center.z + edge.lengthMeters * 0.5);
  }

  for (const connector of sceneDrafts.connectorDrafts) {
    minX = Math.min(minX, connector.center.x - connector.size.x * 0.5);
    maxX = Math.max(maxX, connector.center.x + connector.size.x * 0.5);
    minZ = Math.min(minZ, connector.center.z - connector.size.z * 0.5);
    maxZ = Math.max(maxZ, connector.center.z + connector.size.z * 0.5);
  }

  for (const structure of sceneDrafts.structuralDrafts) {
    minX = Math.min(minX, structure.center.x - structure.size.x * 0.5);
    maxX = Math.max(maxX, structure.center.x + structure.size.x * 0.5);
    minZ = Math.min(minZ, structure.center.z - structure.size.z * 0.5);
    maxZ = Math.max(maxZ, structure.center.z + structure.size.z * 0.5);
  }

  for (const volume of sceneDrafts.gameplayVolumeDrafts) {
    minX = Math.min(minX, volume.center.x - volume.size.x * 0.5);
    maxX = Math.max(maxX, volume.center.x + volume.size.x * 0.5);
    minZ = Math.min(minZ, volume.center.z - volume.size.z * 0.5);
    maxZ = Math.max(maxZ, volume.center.z + volume.size.z * 0.5);
  }

  for (const light of sceneDrafts.lightDrafts) {
    minX = Math.min(minX, light.position.x);
    maxX = Math.max(maxX, light.position.x);
    minZ = Math.min(minZ, light.position.z);
    maxZ = Math.max(maxZ, light.position.z);
  }

  return Object.freeze({
    maxX,
    maxZ,
    minX,
    minZ
  });
}

function createPlacementPreviewSignature(
  placementDrafts: readonly MapEditorPlacementDraftSnapshot[]
): string {
  return placementDrafts
    .map((placement) =>
      [
        placement.assetId,
        placement.collisionEnabled ? "1" : "0",
        placement.isVisible ? "1" : "0",
        placement.placementId,
        placement.position.x,
        placement.position.y,
        placement.position.z,
        placement.rotationYRadians,
        placement.scale.x,
        placement.scale.y,
        placement.scale.z
      ].join(":")
    )
    .join("|");
}

function createPlacementStructureSignature(
  placementDrafts: readonly MapEditorPlacementDraftSnapshot[]
): string {
  return placementDrafts
    .map((placement) =>
      [
        placement.placementId,
        placement.assetId,
        placement.materialReferenceId ?? ""
      ].join(":")
    )
    .join("|");
}

function createSceneDraftSignature(
  sceneDrafts: {
    readonly playerSpawnDrafts: readonly MapEditorPlayerSpawnDraftSnapshot[];
    readonly resourceSpawnDrafts: readonly MapEditorResourceSpawnDraftSnapshot[];
    readonly sceneObjectDrafts: readonly MapEditorSceneObjectDraftSnapshot[];
    readonly waterRegionDrafts: readonly MapEditorWaterRegionDraftSnapshot[];
  }
): string {
  return [
    ...sceneDrafts.playerSpawnDrafts.map((spawnDraft) =>
      [
        "spawn",
        spawnDraft.spawnId,
        spawnDraft.position.x,
        spawnDraft.position.y,
        spawnDraft.position.z,
        spawnDraft.yawRadians
      ].join(":")
    ),
    ...sceneDrafts.resourceSpawnDrafts.map((resourceSpawnDraft) =>
      [
        "resource-spawn",
        resourceSpawnDraft.spawnId,
        resourceSpawnDraft.weaponId,
        resourceSpawnDraft.assetId ?? "",
        resourceSpawnDraft.ammoGrantRounds,
        resourceSpawnDraft.respawnCooldownMs,
        resourceSpawnDraft.pickupRadiusMeters,
        resourceSpawnDraft.position.x,
        resourceSpawnDraft.position.y,
        resourceSpawnDraft.position.z,
        resourceSpawnDraft.yawRadians,
        resourceSpawnDraft.modeTags.join(",")
      ].join(":")
    ),
    ...sceneDrafts.sceneObjectDrafts.map((sceneObjectDraft) =>
      [
        "scene-object",
        sceneObjectDraft.objectId,
        sceneObjectDraft.position.x,
        sceneObjectDraft.position.y,
        sceneObjectDraft.position.z,
        sceneObjectDraft.launchTarget?.experienceId ?? "none",
        sceneObjectDraft.launchTarget?.ringColorHex ?? "none",
        sceneObjectDraft.launchTarget?.beamColorHex ?? "none"
      ].join(":")
    ),
    ...sceneDrafts.waterRegionDrafts.map((waterRegionDraft) =>
      {
        const center = resolveMapEditorWaterRegionCenter(waterRegionDraft);
        const size = resolveMapEditorWaterRegionSize(waterRegionDraft);

        return [
          "water",
          waterRegionDraft.waterRegionId,
          center.x,
          center.y,
          center.z,
          size.x,
          size.y,
          size.z,
          waterRegionDraft.topElevationMeters,
          waterRegionDraft.depthMeters,
          waterRegionDraft.previewColorHex,
          waterRegionDraft.previewOpacity
        ].join(":");
      }
    )
  ].join("|");
}

function readNearestPathAnchorFromDrafts(
  position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  regionDrafts: readonly MapEditorRegionDraftSnapshot[],
  surfaceDrafts: readonly MapEditorSurfaceDraftSnapshot[]
): MapEditorPathAnchorSnapshot | null {
  const surfacesById = new Map(
    surfaceDrafts.map((surfaceDraft) => [surfaceDraft.surfaceId, surfaceDraft] as const)
  );
  let nearestAnchor:
    | {
        readonly center: {
          readonly x: number;
          readonly y: number;
          readonly z: number;
        };
        readonly distanceSquared: number;
        readonly elevation: number;
      }
    | null = null;

  for (const regionDraft of regionDrafts) {
    if (regionDraft.regionKind !== "path") {
      continue;
    }

    const surfaceDraft = surfacesById.get(regionDraft.surfaceId) ?? null;

    if (surfaceDraft === null) {
      continue;
    }

    const halfLengthMeters = Math.max(
      mapEditorBuildGridUnitMeters * 0.5,
      surfaceDraft.size.z * 0.5
    );
    const candidateAnchors = [
      Object.freeze({
        center: Object.freeze({
          x:
            regionDraft.center.x +
            Math.sin(surfaceDraft.rotationYRadians) * -halfLengthMeters,
          y: surfaceDraft.elevation - surfaceDraft.slopeRiseMeters * 0.5,
          z:
            regionDraft.center.z +
            Math.cos(surfaceDraft.rotationYRadians) * -halfLengthMeters
        }),
        elevation: surfaceDraft.elevation - surfaceDraft.slopeRiseMeters * 0.5
      }),
      Object.freeze({
        center: Object.freeze({
          x:
            regionDraft.center.x +
            Math.sin(surfaceDraft.rotationYRadians) * halfLengthMeters,
          y: surfaceDraft.elevation + surfaceDraft.slopeRiseMeters * 0.5,
          z:
            regionDraft.center.z +
            Math.cos(surfaceDraft.rotationYRadians) * halfLengthMeters
        }),
        elevation: surfaceDraft.elevation + surfaceDraft.slopeRiseMeters * 0.5
      })
    ];

    for (const candidateAnchor of candidateAnchors) {
      const deltaX = candidateAnchor.center.x - position.x;
      const deltaZ = candidateAnchor.center.z - position.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;

      if (
        distanceSquared >
        mapEditorBuildGridUnitMeters * mapEditorBuildGridUnitMeters
      ) {
        continue;
      }

      if (
        nearestAnchor === null ||
        distanceSquared < nearestAnchor.distanceSquared
      ) {
        nearestAnchor = Object.freeze({
          center: candidateAnchor.center,
          distanceSquared,
          elevation: candidateAnchor.elevation
        });
      }
    }
  }

  return nearestAnchor === null
    ? null
    : Object.freeze({
      center: nearestAnchor.center,
      elevation: nearestAnchor.elevation
    });
}

function resolvePathToolRiseMeters(
  builderToolState: MapEditorBuilderToolStateSnapshot
): number {
  if (builderToolState.surfaceMode !== "slope") {
    return 0;
  }

  const riseMagnitude = Math.max(
    1,
    Math.abs(Math.round(builderToolState.riseLayers))
  );

  return builderToolState.pathElevationMode === "down"
    ? -riseMagnitude
    : riseMagnitude;
}

function readSelectedEntityFromObject(
  object: {
    parent: unknown;
    userData?: {
      connectorId?: unknown;
      edgeId?: unknown;
      gameplayVolumeId?: unknown;
      lightId?: unknown;
      placementId?: unknown;
      playerSpawnId?: unknown;
      resourceSpawnId?: unknown;
      regionId?: unknown;
      sceneObjectId?: unknown;
      structureId?: unknown;
      surfaceId?: unknown;
      terrainPatchId?: unknown;
      waterRegionId?: unknown;
    };
  } | null
): MapEditorSelectedEntityRef | null {
  let currentObject = object;

  while (currentObject !== null) {
    const candidateTerrainPatchId = currentObject.userData?.terrainPatchId;
    const candidateSurfaceId = currentObject.userData?.surfaceId;
    const candidateRegionId = currentObject.userData?.regionId;
    const candidateEdgeId = currentObject.userData?.edgeId;
    const candidateConnectorId = currentObject.userData?.connectorId;
    const candidateStructureId = currentObject.userData?.structureId;
    const candidateGameplayVolumeId = currentObject.userData?.gameplayVolumeId;
    const candidateLightId = currentObject.userData?.lightId;
    const candidatePlacementId = currentObject.userData?.placementId;
    const candidatePlayerSpawnId = currentObject.userData?.playerSpawnId;
    const candidateResourceSpawnId = currentObject.userData?.resourceSpawnId;
    const candidateSceneObjectId = currentObject.userData?.sceneObjectId;
    const candidateWaterRegionId = currentObject.userData?.waterRegionId;

    if (typeof candidateTerrainPatchId === "string") {
      return Object.freeze({
        id: candidateTerrainPatchId,
        kind: "terrain-patch"
      });
    }

    if (typeof candidateSurfaceId === "string") {
      return Object.freeze({
        id: candidateSurfaceId,
        kind: "surface"
      });
    }

    if (typeof candidateRegionId === "string") {
      return Object.freeze({
        id: candidateRegionId,
        kind: "region"
      });
    }

    if (typeof candidateEdgeId === "string") {
      return Object.freeze({
        id: candidateEdgeId,
        kind: "edge"
      });
    }

    if (typeof candidateConnectorId === "string") {
      return Object.freeze({
        id: candidateConnectorId,
        kind: "connector"
      });
    }

    if (typeof candidateStructureId === "string") {
      return Object.freeze({
        id: candidateStructureId,
        kind: "structure"
      });
    }

    if (typeof candidateGameplayVolumeId === "string") {
      return Object.freeze({
        id: candidateGameplayVolumeId,
        kind: "gameplay-volume"
      });
    }

    if (typeof candidateLightId === "string") {
      return Object.freeze({
        id: candidateLightId,
        kind: "light"
      });
    }

    if (typeof candidatePlacementId === "string") {
      return Object.freeze({
        id: candidatePlacementId,
        kind: "module"
      });
    }

    if (typeof candidatePlayerSpawnId === "string") {
      return Object.freeze({
        id: candidatePlayerSpawnId,
        kind: "player-spawn"
      });
    }

    if (typeof candidateResourceSpawnId === "string") {
      return Object.freeze({
        id: candidateResourceSpawnId,
        kind: "resource-spawn"
      });
    }

    if (typeof candidateSceneObjectId === "string") {
      return Object.freeze({
        id: candidateSceneObjectId,
        kind: "scene-object"
      });
    }

    if (typeof candidateWaterRegionId === "string") {
      return Object.freeze({
        id: candidateWaterRegionId,
        kind: "water-region"
      });
    }

    currentObject =
      currentObject.parent !== null &&
      typeof currentObject.parent === "object" &&
      "parent" in currentObject.parent
        ? (currentObject.parent as typeof object)
        : null;
  }

  return null;
}

function resolveViewportErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The map editor viewport could not initialize.";
}

function readCanvasPointer(
  canvasElement: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  pointer: Vector2
): Vector2 {
  const rect = canvasElement.getBoundingClientRect();

  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  return pointer;
}

function installMapEditorSceneEnvironment(
  camera: PerspectiveCamera,
  scene: Scene,
  renderer: WebGPURenderer,
  environmentPresentation: MapEditorProjectSnapshot["environmentPresentation"]
): MetaverseSceneEnvironmentRuntime {
  const environmentRuntime = createMetaverseSceneEnvironment({
    environment: environmentPresentation.environment,
    ocean: environmentPresentation.ocean,
    waterRegionSnapshots: Object.freeze([])
  });

  scene.background = environmentRuntime.backgroundColor;
  scene.fog = environmentRuntime.fog;
  scene.add(
    environmentRuntime.hemisphereLight,
    environmentRuntime.sunLight,
    environmentRuntime.skyMesh,
    environmentRuntime.waterGroup
  );
  syncMetaverseSceneEnvironmentToCamera(environmentRuntime, camera.position);
  applyMetaverseSceneEnvironmentRendererTuning(
    renderer,
    environmentPresentation.environment
  );

  return environmentRuntime;
}

function disposeMapEditorSceneEnvironment(
  scene: Scene,
  environmentRuntime: MetaverseSceneEnvironmentRuntime | null
): void {
  if (environmentRuntime === null) {
    return;
  }

  scene.remove(
    environmentRuntime.hemisphereLight,
    environmentRuntime.sunLight,
    environmentRuntime.skyMesh,
    environmentRuntime.waterGroup
  );
  scene.fog = null;
  disposeMetaverseSceneEnvironment(environmentRuntime);
}

function syncGroupMapVisibility(
  groupsById: ReadonlyMap<string, Group>,
  visible: boolean
): void {
  for (const group of groupsById.values()) {
    group.visible = visible;
  }
}

function syncMapEditorViewportSceneVisibility(
  sceneVisibility: MapEditorSceneVisibilitySnapshot,
  environmentRuntime: MetaverseSceneEnvironmentRuntime | null,
  placementGroup: Group | null,
  sceneDraftHandles: MapEditorViewportSceneDraftHandles | null,
  semanticDraftHandles: MapEditorViewportSemanticDraftHandles | null
): void {
  if (environmentRuntime !== null) {
    environmentRuntime.sunLight.visible = sceneVisibility.worldSun;
  }

  if (placementGroup !== null) {
    placementGroup.visible = sceneVisibility.authoredModules;
  }

  if (sceneDraftHandles !== null) {
    syncGroupMapVisibility(
      sceneDraftHandles.playerSpawnGroupsById,
      sceneVisibility.gameplayMarkers
    );
    syncGroupMapVisibility(
      sceneDraftHandles.resourceSpawnGroupsById,
      sceneVisibility.gameplayMarkers
    );
    syncGroupMapVisibility(
      sceneDraftHandles.sceneObjectGroupsById,
      sceneVisibility.gameplayMarkers
    );
    syncGroupMapVisibility(
      sceneDraftHandles.waterRegionGroupsById,
      sceneVisibility.waterRegions
    );
  }

  if (semanticDraftHandles !== null) {
    syncGroupMapVisibility(
      semanticDraftHandles.terrainPatchGroupsById,
      sceneVisibility.terrain
    );
    syncGroupMapVisibility(
      semanticDraftHandles.regionGroupsById,
      sceneVisibility.authoredSurfaces
    );
    syncGroupMapVisibility(
      semanticDraftHandles.edgeGroupsById,
      sceneVisibility.authoredSurfaces
    );
    syncGroupMapVisibility(
      semanticDraftHandles.connectorGroupsById,
      sceneVisibility.authoredSurfaces
    );
    syncGroupMapVisibility(
      semanticDraftHandles.structureGroupsById,
      sceneVisibility.authoredSurfaces
    );
    syncGroupMapVisibility(
      semanticDraftHandles.surfaceGroupsById,
      sceneVisibility.authoredSurfaces
    );
    syncGroupMapVisibility(
      semanticDraftHandles.gameplayVolumeGroupsById,
      sceneVisibility.gameplayMarkers
    );
    syncGroupMapVisibility(
      semanticDraftHandles.lightGroupsById,
      sceneVisibility.authoredLights
    );
  }
}

export function MapEditorViewport({
  activeModuleAssetId,
  builderToolState,
  bundleId,
  connectorDrafts,
  edgeDrafts,
  environmentPresentation,
  gameplayVolumeDrafts,
  helperGridSizeMeters,
  helperVisibility,
  lightDrafts,
  materialDefinitionDrafts,
  onApplyTerrainBrushAtPosition,
  onCommitPathSegment,
  onCreateFloorRegion,
  onCreateFloorPolygonRegion,
  onCreateModuleAtPosition,
  onCreatePlayerSpawnAtPosition,
  onCreateResourceSpawnAtPosition,
  onCreatePortalAtPosition,
  onCreateTerrainPatchAtPositions,
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
  onCommitEntityTransform,
  onSelectEntity,
  placementDrafts,
  playerSpawnDrafts,
  regionDrafts,
  resourceSpawnDrafts,
  sceneObjectDrafts,
  sceneVisibility,
  selectedEntityRef,
  structuralDrafts,
  surfaceDrafts,
  terrainPatchDrafts,
  waterRegionDrafts,
  viewportToolMode
}: MapEditorViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const keyboardFlightControllerRef =
    useRef<MapEditorViewportKeyboardFlightController | null>(null);
  const environmentRuntimeRef =
    useRef<MetaverseSceneEnvironmentRuntime | null>(null);
  const placementGroupRef = useRef<Group | null>(null);
  const collisionGroupRef = useRef<Group | null>(null);
  const previewAssetLibraryRef =
    useRef<MapEditorViewportPreviewAssetLibrary | null>(null);
  const sceneDraftHandlesRef = useRef<MapEditorViewportSceneDraftHandles | null>(null);
  const semanticDraftHandlesRef =
    useRef<MapEditorViewportSemanticDraftHandles | null>(null);
  const placementAnchorByIdRef = useRef(new Map<string, Group>());
  const collisionAnchorByIdRef = useRef(new Map<string, Group>());
  const buildCursorAnchorRef = useRef<Group | null>(null);
  const buildCursorAssetIdRef = useRef<string | null>(null);
  const builderPreviewGroupRef = useRef<Group | null>(null);
  const terrainVertexTransformAnchorRef = useRef<Group | null>(null);
  const activeModuleAssetIdRef = useRef(activeModuleAssetId);
  const builderToolStateRef = useRef(builderToolState);
  const connectorDraftsRef = useRef(connectorDrafts);
  const edgeDraftsRef = useRef(edgeDrafts);
  const environmentPresentationRef = useRef(environmentPresentation);
  const materialDefinitionDraftsRef = useRef(materialDefinitionDrafts);
  const placementDraftsRef = useRef(placementDrafts);
  const selectedEntityRefRef = useRef(selectedEntityRef);
  const regionDraftsRef = useRef(regionDrafts);
  const structuralDraftsRef = useRef(structuralDrafts);
  const surfaceDraftsRef = useRef(surfaceDrafts);
  const terrainPatchDraftsRef = useRef(terrainPatchDrafts);
  const viewportToolModeRef = useRef(viewportToolMode);
  const pendingFloorAnchorRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null>(null);
  const pendingWaterAnchorRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null>(null);
  const pendingFloorPolygonPointsRef = useRef<
    readonly {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }[]
  >([]);
  const pendingZoneAnchorRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null>(null);
  const pendingLaneAnchorRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null>(null);
  const pendingVehicleRouteAnchorRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null>(null);
  const pendingWallAnchorRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null>(null);
  const pendingWallChainStartRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null>(null);
  const pendingPathAnchorRef = useRef<MapEditorPathAnchorSnapshot | null>(null);
  const pathAnchorPointerYRef = useRef<number | null>(null);
  const pathBrushDragAnchorRef = useRef<MapEditorPathAnchorSnapshot | null>(null);
  const pathBrushDidCommitRef = useRef(false);
  const transformControllerRef =
    useRef<MapEditorViewportTransformController | null>(null);
  const helperHandlesRef = useRef<MapEditorViewportHelperHandles | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const pointerRef = useRef(new Vector2());
  const buildPlacementPlaneRef = useRef(new Plane(new Vector3(0, 1, 0), 0));
  const buildPlacementPointRef = useRef(new Vector3());
  const buildCursorPositionRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null>(null);
  const previewBuildVersionRef = useRef(0);
  const pointerDownPositionRef = useRef<{
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const buildPointerOrbitLockActiveRef = useRef(false);
  const terrainBrushDragActiveRef = useRef(false);
  const terrainBrushLastStrokeKeyRef = useRef<string | null>(null);
  const pendingTerrainPatchAnchorRef = useRef<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null>(null);
  const framedBundleIdRef = useRef<string | null>(null);
  const animationFrameRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const [selectedTransformTarget, setSelectedTransformTarget] =
    useState<MapEditorViewportTransformTargetRef | null>(() =>
      createTransformTargetFromSelectedEntity(selectedEntityRef)
    );
  const [selectedTerrainVertexTarget, setSelectedTerrainVertexTarget] =
    useState<MapEditorTerrainVertexTransformTarget | null>(null);
  const [viewportError, setViewportError] = useState<string | null>(null);
  const previewPlacementSignature = useMemo(
    () => createPlacementPreviewSignature(placementDrafts),
    [placementDrafts]
  );
  const previewStructureSignature = useMemo(
    () => createPlacementStructureSignature(placementDrafts),
    [placementDrafts]
  );
  const sceneDraftSignature = useMemo(
    () =>
      createSceneDraftSignature({
        playerSpawnDrafts,
        resourceSpawnDrafts,
        sceneObjectDrafts,
        waterRegionDrafts
      }),
    [playerSpawnDrafts, resourceSpawnDrafts, sceneObjectDrafts, waterRegionDrafts]
  );

  const handleEntitySelection = useEffectEvent(
    (entityRef: MapEditorSelectedEntityRef | null) => {
      onSelectEntity(entityRef);
    }
  );
  const handlePlacementTransformCommit = useEffectEvent(
    (placementId: string, update: MapEditorPlacementUpdate) => {
      onCommitPlacementTransform(placementId, update);
    }
  );
  const handlePlayerSpawnTransformCommit = useEffectEvent(
    (
      spawnId: string,
      update: MapEditorPlayerSpawnTransformUpdate
    ) => {
      onCommitPlayerSpawnTransform(spawnId, update);
    }
  );
  const handleCreateModulePlacement = useEffectEvent(
    (
      assetId: string,
      position: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      }
    ) => {
      onCreateModuleAtPosition(assetId, position);
    }
  );
  const handleApplyTerrainBrush = useEffectEvent(
    (position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }) => {
      onApplyTerrainBrushAtPosition(position);
    }
  );
  const handleCreateTerrainPatch = useEffectEvent(
    (
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
    ) => {
      onCreateTerrainPatchAtPositions(startPosition, endPosition);
    }
  );
  const handleCreateFloor = useEffectEvent(
    (
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
    ) => {
      onCreateFloorRegion(startPosition, endPosition);
    }
  );
  const handleCreateFloorPolygon = useEffectEvent(
    (
      points: readonly {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      }[]
    ) => {
      onCreateFloorPolygonRegion(points);
    }
  );
  const handleCommitWall = useEffectEvent(
    (
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
    ) => {
      onCommitWallSegment(startPosition, endPosition);
    }
  );
  const handleCommitPath = useEffectEvent(
    (
      targetPosition: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      },
      targetElevationMeters: number,
      fromAnchor: MapEditorPathAnchorSnapshot | null
    ) => {
      onCommitPathSegment(targetPosition, targetElevationMeters, fromAnchor);
    }
  );
  const handleCreateWaterRegion = useEffectEvent(
    (
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
    ) => {
      onCreateWaterRegionAtPosition(startPosition, endPosition);
    }
  );
  const handleCreateCover = useEffectEvent(
    (position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }) => {
      onCreateCoverAtPosition(position);
    }
  );
  const handleCreateLight = useEffectEvent(
    (position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }) => {
      onCreateLightAtPosition(position);
    }
  );
  const handleCreateResourceSpawn = useEffectEvent(
    (position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }) => {
      onCreateResourceSpawnAtPosition(position);
    }
  );
  const handleCreateTeamZone = useEffectEvent(
    (
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
    ) => {
      onCreateTeamZone(startPosition, endPosition);
    }
  );
  const handleCreateCombatLane = useEffectEvent(
    (
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
    ) => {
      onCreateCombatLane(startPosition, endPosition);
    }
  );
  const handleCreateVehicleRoute = useEffectEvent(
    (
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
    ) => {
      onCreateVehicleRoute(startPosition, endPosition);
    }
  );
  const handlePaintEntity = useEffectEvent(
    (entityRef: MapEditorSelectedEntityRef) => {
      onPaintEntity(entityRef);
    }
  );
  const handleDeleteEntity = useEffectEvent(
    (entityRef: MapEditorSelectedEntityRef) => {
      onDeleteEntity(entityRef);
    }
  );
  const syncPlacementPreviewAnchors = useEffectEvent(
    (drafts: readonly MapEditorPlacementDraftSnapshot[]) => {
      for (const placement of drafts) {
        const placementAnchor =
          placementAnchorByIdRef.current.get(placement.placementId) ?? null;

        if (placementAnchor === null) {
          continue;
        }

        syncMapEditorViewportPlacementPreviewAnchor(placementAnchor, placement);
      }
    }
  );
  const syncTerrainVertexTransformAnchor = useEffectEvent(() => {
    const terrainVertexTransformAnchor = terrainVertexTransformAnchorRef.current;

    if (terrainVertexTransformAnchor === null) {
      return;
    }

    if (
      viewportToolMode !== "vertex" ||
      selectedTerrainVertexTarget === null
    ) {
      terrainVertexTransformAnchor.visible = false;
      return;
    }

    const terrainPatch =
      terrainPatchDrafts.find(
        (candidateTerrainPatch) =>
          candidateTerrainPatch.terrainPatchId ===
          selectedTerrainVertexTarget.terrainPatchId
      ) ?? null;

    if (terrainPatch === null) {
      terrainVertexTransformAnchor.visible = false;
      return;
    }

    const vertexPosition = resolveTerrainPatchVertexWorldPosition(
      terrainPatch,
      selectedTerrainVertexTarget
    );

    terrainVertexTransformAnchor.position.set(
      vertexPosition.x,
      vertexPosition.y,
      vertexPosition.z
    );
    terrainVertexTransformAnchor.rotation.set(0, 0, 0);
    terrainVertexTransformAnchor.scale.set(1, 1, 1);
    terrainVertexTransformAnchor.visible = true;
    terrainVertexTransformAnchor.updateMatrixWorld(true);
  });
  const syncSelectionPresentation = useEffectEvent(() => {
    const scene = sceneRef.current;
    const helperHandles = helperHandlesRef.current;
    const transformController = transformControllerRef.current;
    const sceneDraftHandles = sceneDraftHandlesRef.current;
    const semanticDraftHandles = semanticDraftHandlesRef.current;

    if (scene === null || helperHandles === null || transformController === null) {
      return;
    }

    transformController.syncToolMode(viewportToolMode);
    syncTerrainVertexTransformAnchor();

    let selectedPresentationAnchor: Group | null = null;
    let selectedTransformAnchor: Group | null = null;
    let activeTransformTarget: MapEditorViewportTransformTargetRef | null =
      selectedTransformTarget;

    if (selectedEntityRef !== null) {
      switch (selectedEntityRef.kind) {
        case "module":
          selectedPresentationAnchor =
            placementAnchorByIdRef.current.get(selectedEntityRef.id) ?? null;
          break;
        case "player-spawn":
          selectedPresentationAnchor =
            sceneDraftHandles?.playerSpawnGroupsById.get(selectedEntityRef.id) ?? null;
          break;
        case "resource-spawn":
          selectedPresentationAnchor =
            sceneDraftHandles?.resourceSpawnGroupsById.get(selectedEntityRef.id) ??
            null;
          break;
        case "scene-object":
          selectedPresentationAnchor =
            sceneDraftHandles?.sceneObjectGroupsById.get(selectedEntityRef.id) ?? null;
          break;
        case "water-region":
          selectedPresentationAnchor =
            sceneDraftHandles?.waterRegionGroupsById.get(selectedEntityRef.id) ?? null;
          break;
        case "terrain-patch":
          selectedPresentationAnchor =
            semanticDraftHandles?.terrainPatchGroupsById.get(selectedEntityRef.id) ??
            null;
          break;
        case "surface":
          selectedPresentationAnchor =
            semanticDraftHandles?.surfaceGroupsById.get(selectedEntityRef.id) ?? null;
          break;
        case "region":
          selectedPresentationAnchor =
            semanticDraftHandles?.regionGroupsById.get(selectedEntityRef.id) ?? null;
          break;
        case "edge":
          selectedPresentationAnchor =
            semanticDraftHandles?.edgeGroupsById.get(selectedEntityRef.id) ?? null;
          break;
        case "connector":
          selectedPresentationAnchor =
            semanticDraftHandles?.connectorGroupsById.get(selectedEntityRef.id) ?? null;
          break;
        case "structure":
          selectedPresentationAnchor =
            semanticDraftHandles?.structureGroupsById.get(selectedEntityRef.id) ?? null;
          break;
        case "gameplay-volume":
          selectedPresentationAnchor =
            semanticDraftHandles?.gameplayVolumeGroupsById.get(
              selectedEntityRef.id
            ) ?? null;
          break;
        case "light":
          selectedPresentationAnchor =
            semanticDraftHandles?.lightGroupsById.get(selectedEntityRef.id) ?? null;
          break;
      }
    }

    if (viewportToolMode === "vertex") {
      selectedTransformAnchor =
        selectedTerrainVertexTarget === null ||
        terrainVertexTransformAnchorRef.current?.visible !== true
          ? null
          : terrainVertexTransformAnchorRef.current;
      activeTransformTarget =
        selectedTerrainVertexTarget === null
          ? null
          : Object.freeze({
              id: createTerrainVertexTransformTargetId(selectedTerrainVertexTarget),
              kind: "terrain-vertex" as const
            });
    } else if (
      (viewportToolMode === "move" ||
        viewportToolMode === "rotate" ||
        viewportToolMode === "scale") &&
      selectedTransformTarget !== null
    ) {
      switch (selectedTransformTarget.kind) {
        case "placement":
          selectedTransformAnchor =
            placementAnchorByIdRef.current.get(selectedTransformTarget.id) ?? null;
          break;
        case "player-spawn":
          selectedTransformAnchor =
            viewportToolMode === "scale" || sceneDraftHandles === null
              ? null
              : sceneDraftHandles.playerSpawnGroupsById.get(
                  selectedTransformTarget.id
                ) ?? null;
          break;
        case "resource-spawn":
          selectedTransformAnchor =
            viewportToolMode === "scale" || sceneDraftHandles === null
              ? null
              : sceneDraftHandles.resourceSpawnGroupsById.get(
                  selectedTransformTarget.id
                ) ?? null;
          break;
        case "scene-object":
          selectedTransformAnchor =
            sceneDraftHandles === null
              ? null
              : sceneDraftHandles.sceneObjectGroupsById.get(
                  selectedTransformTarget.id
                ) ?? null;
          break;
        case "water-region":
          selectedTransformAnchor =
            sceneDraftHandles?.waterRegionGroupsById.get(
              selectedTransformTarget.id
            ) ?? null;
          break;
        case "terrain-patch":
          selectedTransformAnchor =
            semanticDraftHandles?.terrainPatchGroupsById.get(
              selectedTransformTarget.id
            ) ?? null;
          break;
        case "surface":
          selectedTransformAnchor =
            semanticDraftHandles?.surfaceGroupsById.get(
              selectedTransformTarget.id
            ) ?? null;
          break;
        case "region":
          selectedTransformAnchor =
            semanticDraftHandles?.regionGroupsById.get(
              selectedTransformTarget.id
            ) ?? null;
          break;
        case "edge":
          selectedTransformAnchor =
            semanticDraftHandles?.edgeGroupsById.get(selectedTransformTarget.id) ??
            null;
          break;
        case "connector":
          selectedTransformAnchor =
            semanticDraftHandles?.connectorGroupsById.get(
              selectedTransformTarget.id
            ) ?? null;
          break;
        case "structure":
          selectedTransformAnchor =
            semanticDraftHandles?.structureGroupsById.get(
              selectedTransformTarget.id
            ) ?? null;
          break;
        case "gameplay-volume":
          selectedTransformAnchor =
            semanticDraftHandles?.gameplayVolumeGroupsById.get(
              selectedTransformTarget.id
            ) ?? null;
          break;
        case "light":
          selectedTransformAnchor =
            semanticDraftHandles?.lightGroupsById.get(
              selectedTransformTarget.id
            ) ?? null;
          break;
      }
    }

    if (selectedTransformAnchor === null || activeTransformTarget === null) {
      transformController.syncAttachedGroup(null, null);
    } else {
      transformController.syncAttachedGroup(
        selectedTransformAnchor,
        activeTransformTarget
      );
    }
    replaceMapEditorViewportSelectionBoundsHelper(
      scene,
      helperHandles,
      selectedPresentationAnchor,
      helperVisibility
    );
  });

  useEffect(() => {
    setSelectedTransformTarget(createTransformTargetFromSelectedEntity(selectedEntityRef));
  }, [bundleId, selectedEntityRef]);

  useEffect(() => {
    placementDraftsRef.current = placementDrafts;
  }, [placementDrafts]);

  useEffect(() => {
    selectedEntityRefRef.current = selectedEntityRef;
  }, [selectedEntityRef]);

  useEffect(() => {
    builderToolStateRef.current = builderToolState;
  }, [builderToolState]);

  useEffect(() => {
    materialDefinitionDraftsRef.current = materialDefinitionDrafts;
  }, [materialDefinitionDrafts]);

  useEffect(() => {
    connectorDraftsRef.current = connectorDrafts;
  }, [connectorDrafts]);

  useEffect(() => {
    edgeDraftsRef.current = edgeDrafts;
  }, [edgeDrafts]);

  useEffect(() => {
    environmentPresentationRef.current = environmentPresentation;
  }, [environmentPresentation]);

  useEffect(() => {
    regionDraftsRef.current = regionDrafts;
  }, [regionDrafts]);

  useEffect(() => {
    structuralDraftsRef.current = structuralDrafts;
  }, [structuralDrafts]);

  useEffect(() => {
    surfaceDraftsRef.current = surfaceDrafts;
  }, [surfaceDrafts]);

  useEffect(() => {
    terrainPatchDraftsRef.current = terrainPatchDrafts;
  }, [terrainPatchDrafts]);

  useEffect(() => {
    activeModuleAssetIdRef.current = activeModuleAssetId;
  }, [activeModuleAssetId]);

  useEffect(() => {
    viewportToolModeRef.current = viewportToolMode;
  }, [viewportToolMode]);

  useEffect(() => {
    if (viewportToolMode !== "floor") {
      pendingFloorAnchorRef.current = null;
    }

    if (viewportToolMode !== "zone") {
      pendingZoneAnchorRef.current = null;
    }

    if (viewportToolMode !== "water") {
      pendingWaterAnchorRef.current = null;
    }

    if (viewportToolMode !== "lane") {
      pendingLaneAnchorRef.current = null;
    }

    if (viewportToolMode !== "vehicle-route") {
      pendingVehicleRouteAnchorRef.current = null;
    }

    if (viewportToolMode !== "wall") {
      pendingWallAnchorRef.current = null;
    }

    if (viewportToolMode !== "path") {
      pendingPathAnchorRef.current = null;
      pathAnchorPointerYRef.current = null;
      pathBrushDragAnchorRef.current = null;
      pathBrushDidCommitRef.current = false;
    }

    if (viewportToolMode !== "terrain") {
      terrainBrushDragActiveRef.current = false;
      terrainBrushLastStrokeKeyRef.current = null;
      pendingTerrainPatchAnchorRef.current = null;
    }

    if (viewportToolMode !== "vertex") {
      setSelectedTerrainVertexTarget(null);
    }

    if (!shouldSuppressOrbitWhileBuildPointerHeld(viewportToolMode)) {
      buildPointerOrbitLockActiveRef.current = false;

      if (orbitControlsRef.current !== null) {
        orbitControlsRef.current.enabled = true;
      }
    }

    if (viewportToolMode === "module" || viewportToolMode === "select") {
      if (builderPreviewGroupRef.current !== null) {
        disposeBuilderPreviewGroup(builderPreviewGroupRef.current);
      }
    }
  }, [viewportToolMode]);

  useEffect(() => {
    const hostElement = hostRef.current;
    const canvasElement = canvasRef.current;

    if (hostElement === null || canvasElement === null) {
      return;
    }

    let disposed = false;

    const scene = new Scene();
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(48, 1, 0.1, 500);
    cameraRef.current = camera;

    const renderer = new WebGPURenderer({
      alpha: true,
      antialias: true,
      canvas: canvasElement
    });
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    rendererRef.current = renderer;
    setViewportError(null);
    const orbitControls = createMapEditorViewportOrbitControls(
      camera,
      canvasElement
    );
    orbitControlsRef.current = orbitControls;
    const keyboardFlightController =
      new MapEditorViewportKeyboardFlightController({
        camera,
        hostElement,
        orbitControls
      });
    keyboardFlightControllerRef.current = keyboardFlightController;

    const placementGroup = new Group();
    placementGroupRef.current = placementGroup;
    scene.add(placementGroup);
    const collisionGroup = new Group();
    collisionGroup.visible = helperVisibility.collisionBounds;
    collisionGroupRef.current = collisionGroup;
    scene.add(collisionGroup);
    const builderPreviewGroup = new Group();
    builderPreviewGroupRef.current = builderPreviewGroup;
    scene.add(builderPreviewGroup);
    const terrainVertexTransformAnchor = new Group();
    terrainVertexTransformAnchor.visible = false;
    terrainVertexTransformAnchor.add(
      createPreviewMesh(
        new SphereGeometry(0.24, 16, 12),
        createPreviewMaterial("#fbbf24", 0.78)
      )
    );
    terrainVertexTransformAnchorRef.current = terrainVertexTransformAnchor;
    scene.add(terrainVertexTransformAnchor);
    const sceneDraftHandles = createMapEditorViewportSceneDraftHandles();
    sceneDraftHandlesRef.current = sceneDraftHandles;
    scene.add(sceneDraftHandles.rootGroup);
    const semanticDraftHandles = createMapEditorViewportSemanticDraftHandles();
    semanticDraftHandlesRef.current = semanticDraftHandles;
    scene.add(semanticDraftHandles.rootGroup);
    const previewAssetLibrary = new MapEditorViewportPreviewAssetLibrary();
    previewAssetLibraryRef.current = previewAssetLibrary;
    const helperHandles = createMapEditorViewportHelperHandles(
      scene,
      helperGridSizeMeters
    );
    helperHandlesRef.current = helperHandles;
    environmentRuntimeRef.current = installMapEditorSceneEnvironment(
      camera,
      scene,
      renderer,
      environmentPresentationRef.current
    );

    const transformController = new MapEditorViewportTransformController({
      camera,
      canvasElement,
      orbitControls,
      onCommitEntityTransform,
      onCommitPlayerSpawnTransform: handlePlayerSpawnTransformCommit,
      scene,
      onCommitPlacementTransform: handlePlacementTransformCommit
    });
    transformControllerRef.current = transformController;

    const syncSize = () => {
      const width = Math.max(1, hostElement.clientWidth);
      const height = Math.max(1, hostElement.clientHeight);

      renderer.setPixelRatio(globalThis.window?.devicePixelRatio ?? 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const renderFrame = (frameTimeMs: number) => {
      if (disposed) {
        return;
      }

      animationFrameRef.current = globalThis.window.requestAnimationFrame(
        renderFrame
      );

      try {
        const lastFrameTimeMs = lastFrameTimeRef.current ?? frameTimeMs;
        const deltaSeconds = Math.min(
          0.05,
          Math.max(0, (frameTimeMs - lastFrameTimeMs) / 1000)
        );

        lastFrameTimeRef.current = frameTimeMs;
        keyboardFlightController.update(deltaSeconds);
        orbitControls.update();
        if (environmentRuntimeRef.current !== null) {
          syncMetaverseSceneEnvironmentToCamera(
            environmentRuntimeRef.current,
            camera.position
          );
        }
        helperHandles.selectionBoundsHelper?.update();
        renderer.render(scene, camera);
      } catch (error) {
        globalThis.window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;

        if (!disposed) {
          setViewportError(resolveViewportErrorMessage(error));
        }
      }
    };

    const readPickableObjects = () => [
      ...placementGroup.children,
      ...(sceneDraftHandlesRef.current === null
        ? []
        : [sceneDraftHandlesRef.current.rootGroup]),
      ...(semanticDraftHandlesRef.current === null
        ? []
        : [semanticDraftHandlesRef.current.rootGroup])
    ];
    const readSelectedEntity = (
      clientX: number,
      clientY: number
    ): MapEditorSelectedEntityRef | null => {
      const pointer = readCanvasPointer(
        canvasElement,
        clientX,
        clientY,
        pointerRef.current
      );

      raycasterRef.current.setFromCamera(pointer, camera);

      const intersections = raycasterRef.current.intersectObjects(
        readPickableObjects(),
        true
      );

      return readSelectedEntityFromObject(intersections[0]?.object ?? null);
    };
    const readTerrainVertexTarget = (
      clientX: number,
      clientY: number
    ): MapEditorTerrainVertexTransformTarget | null => {
      const pointer = readCanvasPointer(
        canvasElement,
        clientX,
        clientY,
        pointerRef.current
      );

      raycasterRef.current.setFromCamera(pointer, camera);

      const intersections = raycasterRef.current.intersectObjects(
        readPickableObjects(),
        true
      );

      for (const intersection of intersections) {
        const entityRef = readSelectedEntityFromObject(intersection.object);

        if (entityRef?.kind !== "terrain-patch") {
          continue;
        }

        const terrainPatch =
          terrainPatchDraftsRef.current.find(
            (candidateTerrainPatch) =>
              candidateTerrainPatch.terrainPatchId === entityRef.id
          ) ?? null;

        if (terrainPatch === null) {
          continue;
        }

        const targetCell = resolveTerrainPatchCellAtPosition(
          terrainPatch,
          intersection.point
        );

        if (targetCell !== null) {
          return Object.freeze({
            cellX: targetCell.cellX,
            cellZ: targetCell.cellZ,
            terrainPatchId: terrainPatch.terrainPatchId
          });
        }
      }

      return null;
    };
    const clearBuilderPreview = () => {
      if (builderPreviewGroupRef.current !== null) {
        disposeBuilderPreviewGroup(builderPreviewGroupRef.current);
      }
    };
    const readPlacementPlanePosition = (
      clientX: number,
      clientY: number
    ): {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null => {
      const pointer = readCanvasPointer(
        canvasElement,
        clientX,
        clientY,
        pointerRef.current
      );

      raycasterRef.current.setFromCamera(pointer, camera);

      const placementPoint = raycasterRef.current.ray.intersectPlane(
        buildPlacementPlaneRef.current,
        buildPlacementPointRef.current
      );

      if (placementPoint === null) {
        return null;
      }

      return Object.freeze({
        x: placementPoint.x,
        y: placementPoint.y,
        z: placementPoint.z
      });
    };
    const readBuildPlacementReference = (
      clientX: number,
      clientY: number
    ): MapEditorBuildPlacementReferenceSnapshot | null => {
      const pointer = readCanvasPointer(
        canvasElement,
        clientX,
        clientY,
        pointerRef.current
      );

      raycasterRef.current.setFromCamera(pointer, camera);

      const intersections = raycasterRef.current.intersectObjects(
        readPickableObjects(),
        true
      );

      for (const intersection of intersections) {
        const entityRef = readSelectedEntityFromObject(intersection.object);

        if (entityRef === null) {
          continue;
        }

        const point = Object.freeze({
          x: intersection.point.x,
          y: intersection.point.y,
          z: intersection.point.z
        });
        const supportElevation = resolveMapEditorBuildSupportElevation(
          entityRef,
          point,
          {
            connectorDrafts: connectorDraftsRef.current,
            edgeDrafts: edgeDraftsRef.current,
            regionDrafts: regionDraftsRef.current,
            structuralDrafts: structuralDraftsRef.current,
            surfaceDrafts: surfaceDraftsRef.current,
            terrainPatchDrafts: terrainPatchDraftsRef.current
          }
        );

        if (supportElevation !== null && Number.isFinite(supportElevation)) {
          return Object.freeze({
            elevation: supportElevation,
            point
          });
        }
      }

      const placementPoint = readPlacementPlanePosition(clientX, clientY);

      return placementPoint === null
        ? null
        : Object.freeze({
            elevation: 0,
            point: placementPoint
          });
    };
    const readGroundPlacementPosition = (
      clientX: number,
      clientY: number
    ): {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null => {
      const placementPoint = readPlacementPlanePosition(clientX, clientY);

      return placementPoint === null
        ? null
        : resolveSnappedGroundPosition(placementPoint);
    };
    const readSelectedTerrainPatchId = (): string | null =>
      selectedEntityRefRef.current?.kind === "terrain-patch"
        ? selectedEntityRefRef.current.id
        : null;
    const readSelectedTerrainPatchAtPosition = (position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    }): MapEditorTerrainPatchDraftSnapshot | null => {
      const selectedTerrainPatchId = readSelectedTerrainPatchId();
      const terrainPatch = findTerrainPatchAtPosition(
        terrainPatchDraftsRef.current,
        position
      );

      return terrainPatch !== null &&
        terrainPatch.terrainPatchId === selectedTerrainPatchId
        ? terrainPatch
        : null;
    };
    const readBuildPlacementPosition = (
      clientX: number,
      clientY: number
    ): {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null => {
      const placementReference = readBuildPlacementReference(clientX, clientY);

      return placementReference === null
        ? null
        : resolveMapEditorBuildGroundPosition(
            placementReference.point,
            placementReference.elevation
          );
    };
    const readModulePlacementPosition = (
      clientX: number,
      clientY: number
    ): {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null => {
      const placementReference = readBuildPlacementReference(clientX, clientY);

      if (placementReference === null) {
        return null;
      }

      const activeAssetId = activeModuleAssetIdRef.current;
      const activeAsset =
        activeAssetId === null
          ? null
          : environmentPropManifest.environmentAssets.find(
              (environmentAsset) => environmentAsset.id === activeAssetId
            ) ?? null;

      return activeAsset === null
        ? resolveMapEditorBuildGroundPosition(
            placementReference.point,
            placementReference.elevation
          )
        : resolveMapEditorBuildAssetPlacementPosition(
            placementReference.point,
            activeAsset,
            placementReference.elevation
          );
    };
    const syncBuildCursor = (clientX: number, clientY: number) => {
      const buildCursorAnchor = buildCursorAnchorRef.current;

      if (viewportToolModeRef.current !== "module") {
        buildCursorPositionRef.current = null;

        if (buildCursorAnchor !== null) {
          buildCursorAnchor.visible = false;
        }

        return;
      }

      const nextBuildCursorPosition = readModulePlacementPosition(
        clientX,
        clientY
      );

      if (nextBuildCursorPosition === null) {
        buildCursorPositionRef.current = null;
        if (buildCursorAnchor !== null) {
          buildCursorAnchor.visible = false;
        }
        return;
      }

      buildCursorPositionRef.current = nextBuildCursorPosition;

      if (buildCursorAnchor === null) {
        return;
      }

      buildCursorAnchor.visible = true;
      buildCursorAnchor.position.set(
        nextBuildCursorPosition.x,
        nextBuildCursorPosition.y,
        nextBuildCursorPosition.z
      );
      buildCursorAnchor.updateMatrixWorld(true);
    };
    const syncBuilderPreview = (
      clientX: number,
      clientY: number,
      ctrlKey: boolean
    ) => {
      const builderPreviewGroup = builderPreviewGroupRef.current;

      if (builderPreviewGroup === null) {
        return;
      }

      clearBuilderPreview();

      if (
        viewportToolModeRef.current === "select" ||
        viewportToolModeRef.current === "move" ||
        viewportToolModeRef.current === "rotate" ||
        viewportToolModeRef.current === "scale" ||
        viewportToolModeRef.current === "module"
      ) {
        return;
      }

      const nextGroundPosition =
        viewportToolModeRef.current === "terrain"
          ? readGroundPlacementPosition(clientX, clientY)
          : readBuildPlacementPosition(clientX, clientY);

      if (nextGroundPosition === null) {
        return;
      }

      const activeMaterialColor = resolveMaterialReferencePreviewColorHex(
        materialDefinitionDraftsRef.current,
        builderToolStateRef.current.activeMaterialReferenceId,
        builderToolStateRef.current.activeMaterialId
      );

      switch (viewportToolModeRef.current) {
        case "floor":
          if (builderToolStateRef.current.floorShapeMode === "polygon") {
            const polygonHoverPosition = resolveMapEditorBuildGroundPosition(
              nextGroundPosition,
              nextGroundPosition.y + builderToolStateRef.current.floorElevationMeters
            );

            if (pendingFloorPolygonPointsRef.current.length === 0) {
              addFloorPolygonPreview(
                builderPreviewGroup,
                Object.freeze([]),
                polygonHoverPosition,
                activeMaterialColor
              );
              return;
            }

            addFloorPolygonPreview(
              builderPreviewGroup,
              pendingFloorPolygonPointsRef.current,
              polygonHoverPosition,
              activeMaterialColor
            );
            return;
          }

          addFloorPreview(
            builderPreviewGroup,
            pendingFloorAnchorRef.current ?? nextGroundPosition,
            nextGroundPosition,
            builderToolStateRef.current,
            activeMaterialColor
          );
          return;
        case "cover":
          addCoverPreview(
            builderPreviewGroup,
            nextGroundPosition,
            builderToolStateRef.current,
            activeMaterialColor
          );
          return;
        case "light":
          addLightPreview(
            builderPreviewGroup,
            nextGroundPosition,
            builderToolStateRef.current
          );
          return;
        case "player-spawn":
          addSceneElementPreview(
            builderPreviewGroup,
            nextGroundPosition,
            "#38bdf8",
            1.4
          );
          return;
        case "resource-spawn":
          addSceneElementPreview(
            builderPreviewGroup,
            nextGroundPosition,
            "#fb923c",
            1.1
          );
          return;
        case "portal":
          addSceneElementPreview(
            builderPreviewGroup,
            nextGroundPosition,
            "#f6d06a",
            6
          );
          return;
        case "zone":
          addSegmentPreview(
            builderPreviewGroup,
            pendingZoneAnchorRef.current ?? nextGroundPosition,
            nextGroundPosition,
            builderToolStateRef.current.gameplayVolumeTeamId === "blue"
              ? "#38bdf8"
              : builderToolStateRef.current.gameplayVolumeTeamId === "red"
                ? "#fb7185"
                : "#f59e0b",
            builderToolStateRef.current.gameplayVolumeWidthCells,
            3
          );
          return;
        case "lane":
          addSegmentPreview(
            builderPreviewGroup,
            pendingLaneAnchorRef.current ?? nextGroundPosition,
            nextGroundPosition,
            "#f59e0b",
            builderToolStateRef.current.gameplayVolumeWidthCells,
            3
          );
          return;
        case "vehicle-route":
          addSegmentPreview(
            builderPreviewGroup,
            pendingVehicleRouteAnchorRef.current ?? nextGroundPosition,
            nextGroundPosition,
            "#a3e635",
            builderToolStateRef.current.gameplayVolumeWidthCells,
            3
          );
          return;
        case "terrain":
          if (readSelectedTerrainPatchId() !== null) {
            if (readSelectedTerrainPatchAtPosition(nextGroundPosition) !== null) {
              addTerrainBrushPreview(
                builderPreviewGroup,
                terrainPatchDraftsRef.current,
                nextGroundPosition,
                builderToolStateRef.current.terrainBrushSizeCells,
                builderToolStateRef.current.terrainSmoothEdges,
                resolveMetaverseSceneSemanticPreviewColorHex(
                  builderToolStateRef.current.terrainMaterialId
                )
              );
            }

            return;
          }

          if (
            pendingTerrainPatchAnchorRef.current === null &&
            findTerrainPatchAtPosition(
              terrainPatchDraftsRef.current,
              nextGroundPosition
            ) !== null
          ) {
            return;
          }

          addTerrainPatchPreview(
            builderPreviewGroup,
            pendingTerrainPatchAnchorRef.current ?? nextGroundPosition,
            nextGroundPosition,
            resolveMetaverseSceneSemanticPreviewColorHex(
              builderToolStateRef.current.terrainMaterialId
            )
          );
          return;
        case "wall":
          if (pendingWallAnchorRef.current === null) {
            const marker = createPreviewMesh(
              new BoxGeometry(
                mapEditorBuildGridUnitMeters * 0.45,
                0.5,
                mapEditorBuildGridUnitMeters * 0.45
              ),
              createPreviewMaterial(activeMaterialColor, 0.38)
            );

            marker.position.set(
              nextGroundPosition.x,
              nextGroundPosition.y + 0.25,
              nextGroundPosition.z
            );
            builderPreviewGroup.add(marker);
            return;
          }

          addWallSegmentPreview(
            builderPreviewGroup,
            pendingWallAnchorRef.current,
            nextGroundPosition,
            builderToolStateRef.current,
            activeMaterialColor
          );
          return;
        case "path": {
          const pathGroundPosition = resolveMapEditorBuildPathAnchorPosition(
            nextGroundPosition,
            nextGroundPosition.y,
            builderToolStateRef.current.pathWidthCells
          );
          const fallbackAnchor = readNearestPathAnchorFromDrafts(
            pathGroundPosition,
            regionDraftsRef.current,
            surfaceDraftsRef.current
          );
          const activeAnchor = pendingPathAnchorRef.current ?? fallbackAnchor;
          const baseElevation = activeAnchor?.elevation ?? pathGroundPosition.y;
          const pathRiseMeters = resolvePathToolRiseMeters(builderToolStateRef.current);
          const targetElevation =
            pathRiseMeters !== 0 && activeAnchor !== null
              ? activeAnchor.elevation + pathRiseMeters
              : baseElevation;
          const pathTargetPosition =
            activeAnchor === null
              ? pathGroundPosition
              : pathRiseMeters !== 0
                ? resolveMapEditorBuildPathDirectedSlopeSegmentEnd(
                    activeAnchor.center,
                    pathGroundPosition,
                    builderToolStateRef.current.pathSlopeLengthCells,
                    builderToolStateRef.current.pathSlopeRotationDegrees
                  )
              : resolveMapEditorBuildPathSegmentEnd(
                  activeAnchor.center,
                  pathGroundPosition,
                  builderToolStateRef.current.pathWidthCells
                );

          addPathPreview(
            builderPreviewGroup,
            Object.freeze({
              x: pathTargetPosition.x,
              y: targetElevation,
              z: pathTargetPosition.z
            }),
            targetElevation,
            activeAnchor,
            builderToolStateRef.current.pathWidthCells,
            activeMaterialColor
          );
          return;
        }
        case "water":
          addWaterPreview(
            builderPreviewGroup,
            pendingWaterAnchorRef.current ?? nextGroundPosition,
            nextGroundPosition,
            builderToolStateRef.current
          );
          return;
      }
    };

    const stopTerrainBrushDrag = () => {
      terrainBrushDragActiveRef.current = false;
      terrainBrushLastStrokeKeyRef.current = null;
    };
    const stopPathBrushDrag = () => {
      pathBrushDragAnchorRef.current = null;
      pathBrushDidCommitRef.current = false;
    };
    const commitPathBrushDragAtPointer = (
      clientX: number,
      clientY: number
    ): boolean => {
      const activeAnchor = pathBrushDragAnchorRef.current;

      if (
        activeAnchor === null ||
        viewportToolModeRef.current !== "path" ||
        builderToolStateRef.current.surfaceMode === "slope"
      ) {
        return false;
      }

      const nextScenePosition = readBuildPlacementPosition(clientX, clientY);

      if (nextScenePosition === null) {
        return false;
      }

      const pathScenePosition = resolveMapEditorBuildPathAnchorPosition(
        nextScenePosition,
        nextScenePosition.y,
        builderToolStateRef.current.pathWidthCells
      );
      const snappedPathPosition = resolveMapEditorBuildPathSegmentEnd(
        activeAnchor.center,
        pathScenePosition,
        builderToolStateRef.current.pathWidthCells
      );
      const targetElevation = activeAnchor.elevation;

      if (
        activeAnchor.center.x === snappedPathPosition.x &&
        activeAnchor.center.z === snappedPathPosition.z &&
        Math.abs(activeAnchor.elevation - targetElevation) <= 0.01
      ) {
        return false;
      }

      const nextPathAnchor = Object.freeze({
        center: Object.freeze({
          x: snappedPathPosition.x,
          y: targetElevation,
          z: snappedPathPosition.z
        }),
        elevation: targetElevation
      });

      handleCommitPath(nextPathAnchor.center, targetElevation, activeAnchor);
      pathBrushDragAnchorRef.current = nextPathAnchor;
      pathBrushDidCommitRef.current = true;
      pendingPathAnchorRef.current = nextPathAnchor;

      return true;
    };

    const setBuildPointerOrbitLock = (active: boolean) => {
      buildPointerOrbitLockActiveRef.current = active;

      if (orbitControlsRef.current !== null) {
        orbitControlsRef.current.enabled = !active;
      }
    };

    const stopBuildPointerInteraction = () => {
      stopTerrainBrushDrag();
      setBuildPointerOrbitLock(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      hostElement.focus({ preventScroll: true });

      if (event.button !== 0) {
        return;
      }

      pointerDownPositionRef.current = Object.freeze({
        x: event.clientX,
        y: event.clientY
      });

      if (shouldSuppressOrbitWhileBuildPointerHeld(viewportToolModeRef.current)) {
        setBuildPointerOrbitLock(true);
      }

      if (
        viewportToolModeRef.current === "floor" &&
        builderToolStateRef.current.floorShapeMode === "rectangle"
      ) {
        pendingFloorAnchorRef.current = readBuildPlacementPosition(
          event.clientX,
          event.clientY
        );
      }

      if (viewportToolModeRef.current === "water") {
        pendingWaterAnchorRef.current = readBuildPlacementPosition(
          event.clientX,
          event.clientY
        );
      }

      if (viewportToolModeRef.current === "zone") {
        pendingZoneAnchorRef.current = readBuildPlacementPosition(
          event.clientX,
          event.clientY
        );
      }

      if (viewportToolModeRef.current === "terrain") {
        const terrainPatchPosition = readGroundPlacementPosition(
          event.clientX,
          event.clientY
        );

        if (terrainPatchPosition !== null) {
          if (readSelectedTerrainPatchId() !== null) {
            if (readSelectedTerrainPatchAtPosition(terrainPatchPosition) !== null) {
              terrainBrushDragActiveRef.current = true;
              terrainBrushLastStrokeKeyRef.current = readTerrainBrushStrokeKey(
                terrainPatchDraftsRef.current,
                terrainPatchPosition
              );

              handleApplyTerrainBrush(terrainPatchPosition);
            }
          } else if (
            findTerrainPatchAtPosition(
              terrainPatchDraftsRef.current,
              terrainPatchPosition
            ) === null
          ) {
            pendingTerrainPatchAnchorRef.current = terrainPatchPosition;
          }
        }
      }

      if (
        viewportToolModeRef.current === "path" &&
        builderToolStateRef.current.surfaceMode !== "slope"
      ) {
        const pathScenePosition = readBuildPlacementPosition(
          event.clientX,
          event.clientY
        );

        if (pathScenePosition !== null) {
          const pathGroundPosition = resolveMapEditorBuildPathAnchorPosition(
            pathScenePosition,
            pathScenePosition.y,
            builderToolStateRef.current.pathWidthCells
          );
          const existingAnchor = readNearestPathAnchorFromDrafts(
            pathGroundPosition,
            regionDraftsRef.current,
            surfaceDraftsRef.current
          );
          const activeAnchor =
            pendingPathAnchorRef.current ??
            existingAnchor ??
            Object.freeze({
              center: pathGroundPosition,
              elevation: pathGroundPosition.y
            });

          pathBrushDragAnchorRef.current = activeAnchor;
          pathBrushDidCommitRef.current = false;
          pendingPathAnchorRef.current = activeAnchor;
          pathAnchorPointerYRef.current = event.clientY;
        }
      }

      if (
        viewportToolModeRef.current === "path" &&
        pathBrushDragAnchorRef.current !== null &&
        builderToolStateRef.current.surfaceMode !== "slope" &&
        (event.buttons & 1) === 1
      ) {
        commitPathBrushDragAtPointer(event.clientX, event.clientY);
      }

      syncBuildCursor(event.clientX, event.clientY);
      syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button !== 0) {
        if ((event.buttons & 1) !== 1) {
          pointerDownPositionRef.current = null;
          pendingTerrainPatchAnchorRef.current = null;
          stopPathBrushDrag();
          stopBuildPointerInteraction();
        }

        return;
      }

      const pointerDownPosition = pointerDownPositionRef.current;
      pointerDownPositionRef.current = null;

      if (viewportToolModeRef.current === "terrain") {
        const pendingTerrainPatchAnchor = pendingTerrainPatchAnchorRef.current;
        const terrainBrushWasActive = terrainBrushDragActiveRef.current;

        pendingTerrainPatchAnchorRef.current = null;

        if (pendingTerrainPatchAnchor !== null) {
          const terrainPatchEndPosition = readGroundPlacementPosition(
            event.clientX,
            event.clientY
          );

          stopBuildPointerInteraction();

          if (terrainPatchEndPosition !== null) {
            handleCreateTerrainPatch(
              pendingTerrainPatchAnchor,
              terrainPatchEndPosition
            );
          }

          syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
          return;
        }

        if (terrainBrushWasActive) {
          stopBuildPointerInteraction();
          syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
          return;
        }
      }

      if (
        viewportToolModeRef.current === "path" &&
        pathBrushDragAnchorRef.current !== null
      ) {
        const pathBrushDidCommit = pathBrushDidCommitRef.current;

        stopPathBrushDrag();

        if (pathBrushDidCommit) {
          stopBuildPointerInteraction();
          syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
          return;
        }
      }

      stopBuildPointerInteraction();

      if (pointerDownPosition === null) {
        return;
      }

      const pointerTravelDistance = Math.hypot(
        event.clientX - pointerDownPosition.x,
        event.clientY - pointerDownPosition.y
      );

      if (
        pointerTravelDistance > 4 &&
        viewportToolModeRef.current !== "floor" &&
        viewportToolModeRef.current !== "water" &&
        viewportToolModeRef.current !== "zone"
      ) {
        return;
      }

      if (
        viewportToolModeRef.current === "module" &&
        activeModuleAssetIdRef.current !== null
      ) {
        const nextBuildPlacementPosition = readModulePlacementPosition(
          event.clientX,
          event.clientY
        );

        if (nextBuildPlacementPosition !== null) {
          handleCreateModulePlacement(
            activeModuleAssetIdRef.current,
            nextBuildPlacementPosition
          );
        }

        return;
      }

      if (viewportToolModeRef.current === "vertex") {
        const nextTerrainVertexTarget = readTerrainVertexTarget(
          event.clientX,
          event.clientY
        );

        setSelectedTerrainVertexTarget(nextTerrainVertexTarget);
        setSelectedTransformTarget(
          nextTerrainVertexTarget === null
            ? null
            : Object.freeze({
                id: nextTerrainVertexTarget.terrainPatchId,
                kind: "terrain-patch" as const
              })
        );
        handleEntitySelection(
          nextTerrainVertexTarget === null
            ? null
            : Object.freeze({
                id: nextTerrainVertexTarget.terrainPatchId,
                kind: "terrain-patch" as const
              })
        );
        syncSelectionPresentation();
        return;
      }

      if (
        viewportToolModeRef.current === "paint" ||
        viewportToolModeRef.current === "delete"
      ) {
        const targetEntity =
          readSelectedEntity(event.clientX, event.clientY) ??
          selectedEntityRefRef.current;

        if (targetEntity !== null) {
          if (viewportToolModeRef.current === "paint") {
            handlePaintEntity(targetEntity);
          } else {
            handleDeleteEntity(targetEntity);
          }
        }

        return;
      }

      const nextScenePosition = readBuildPlacementPosition(event.clientX, event.clientY);

      if (nextScenePosition !== null) {
        switch (viewportToolModeRef.current) {
          case "floor": {
            if (builderToolStateRef.current.floorShapeMode === "polygon") {
              const polygonPoint = resolveMapEditorBuildGroundPosition(
                nextScenePosition,
                nextScenePosition.y + builderToolStateRef.current.floorElevationMeters
              );
              const pendingPoints = pendingFloorPolygonPointsRef.current;

              if (pendingPoints.length === 0) {
                pendingFloorPolygonPointsRef.current = Object.freeze([polygonPoint]);
                syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
                return;
              }

              const lastPoint = pendingPoints[pendingPoints.length - 1]!;
              const snappedPolygonPoint = resolveMapEditorBuildWallSegmentEnd(
                lastPoint,
                polygonPoint
              );
              const firstPoint = pendingPoints[0]!;
              const closesLoop =
                pendingPoints.length >= 2 &&
                Math.abs(snappedPolygonPoint.x - firstPoint.x) <= 0.01 &&
                Math.abs(snappedPolygonPoint.z - firstPoint.z) <= 0.01;

              if (closesLoop && pendingPoints.length >= 3) {
                handleCreateFloorPolygon(
                  Object.freeze([...pendingPoints])
                );
                pendingFloorPolygonPointsRef.current = Object.freeze([]);
                syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
                return;
              }

              if (
                Math.abs(snappedPolygonPoint.x - lastPoint.x) <= 0.01 &&
                Math.abs(snappedPolygonPoint.z - lastPoint.z) <= 0.01
              ) {
                return;
              }

              pendingFloorPolygonPointsRef.current = Object.freeze([
                ...pendingPoints,
                snappedPolygonPoint
              ]);

              if (event.detail >= 2 && pendingFloorPolygonPointsRef.current.length >= 3) {
                handleCreateFloorPolygon(pendingFloorPolygonPointsRef.current);
                pendingFloorPolygonPointsRef.current = Object.freeze([]);
              }

              syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
              return;
            }

            const floorAnchor =
              pendingFloorAnchorRef.current ?? nextScenePosition;

            handleCreateFloor(floorAnchor, nextScenePosition);
            pendingFloorAnchorRef.current = null;
            syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
            return;
          }
          case "cover":
            handleCreateCover(nextScenePosition);
            return;
          case "light":
            handleCreateLight(nextScenePosition);
            return;
          case "player-spawn":
            onCreatePlayerSpawnAtPosition(nextScenePosition);
            return;
          case "resource-spawn":
            handleCreateResourceSpawn(nextScenePosition);
            return;
          case "portal":
            onCreatePortalAtPosition(nextScenePosition);
            return;
          case "zone": {
            const zoneAnchor = pendingZoneAnchorRef.current ?? nextScenePosition;

            handleCreateTeamZone(zoneAnchor, nextScenePosition);
            pendingZoneAnchorRef.current = null;
            syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
            return;
          }
          case "lane":
            if (pendingLaneAnchorRef.current === null) {
              pendingLaneAnchorRef.current = nextScenePosition;
              syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
              return;
            }

            handleCreateCombatLane(pendingLaneAnchorRef.current, nextScenePosition);
            pendingLaneAnchorRef.current = null;
            syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
            return;
          case "vehicle-route":
            if (pendingVehicleRouteAnchorRef.current === null) {
              pendingVehicleRouteAnchorRef.current = nextScenePosition;
              syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
              return;
            }

            handleCreateVehicleRoute(
              pendingVehicleRouteAnchorRef.current,
              nextScenePosition
            );
            pendingVehicleRouteAnchorRef.current = null;
            syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
            return;
          case "wall":
            if (pendingWallAnchorRef.current === null) {
              const snappedWallStart = resolveMapEditorBuildGroundPosition(
                nextScenePosition,
                nextScenePosition.y
              );

              pendingWallAnchorRef.current = snappedWallStart;
              pendingWallChainStartRef.current = snappedWallStart;
              syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
              return;
            }

            const nextWallEnd = resolveMapEditorBuildWallSegmentEnd(
              pendingWallAnchorRef.current,
              nextScenePosition
            );

            if (
              nextWallEnd.x === pendingWallAnchorRef.current.x &&
              nextWallEnd.z === pendingWallAnchorRef.current.z
            ) {
              return;
            }

            handleCommitWall(pendingWallAnchorRef.current, nextWallEnd);
            if (
              pendingWallChainStartRef.current !== null &&
              Math.abs(nextWallEnd.x - pendingWallChainStartRef.current.x) <= 0.01 &&
              Math.abs(nextWallEnd.z - pendingWallChainStartRef.current.z) <= 0.01
            ) {
              pendingWallAnchorRef.current = null;
              pendingWallChainStartRef.current = null;
            } else {
              pendingWallAnchorRef.current = nextWallEnd;
            }
            syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
            return;
          case "path": {
            const pathScenePosition = resolveMapEditorBuildPathAnchorPosition(
              nextScenePosition,
              nextScenePosition.y,
              builderToolStateRef.current.pathWidthCells
            );
            const existingAnchor = readNearestPathAnchorFromDrafts(
              pathScenePosition,
              regionDraftsRef.current,
              surfaceDraftsRef.current
            );
            const activeAnchor = pendingPathAnchorRef.current ?? existingAnchor;
            const baseElevation = activeAnchor?.elevation ?? pathScenePosition.y;
            const pathRiseMeters =
              resolvePathToolRiseMeters(builderToolStateRef.current);
            const targetElevation =
              pathRiseMeters !== 0 && activeAnchor !== null
                ? activeAnchor.elevation + pathRiseMeters
                : baseElevation;
            const snappedPathPosition =
              activeAnchor === null
                ? pathScenePosition
                : pathRiseMeters !== 0
                  ? resolveMapEditorBuildPathDirectedSlopeSegmentEnd(
                      activeAnchor.center,
                      pathScenePosition,
                      builderToolStateRef.current.pathSlopeLengthCells,
                      builderToolStateRef.current.pathSlopeRotationDegrees
                    )
                : resolveMapEditorBuildPathSegmentEnd(
                    activeAnchor.center,
                    pathScenePosition,
                    builderToolStateRef.current.pathWidthCells
                  );
            const nextPathAnchor = Object.freeze({
              center: Object.freeze({
                x: snappedPathPosition.x,
                y: targetElevation,
                z: snappedPathPosition.z
              }),
              elevation: targetElevation
            });

            if (
              activeAnchor !== null &&
              activeAnchor.center.x === snappedPathPosition.x &&
              activeAnchor.center.z === snappedPathPosition.z &&
              Math.abs(activeAnchor.elevation - targetElevation) <= 0.01
            ) {
              pendingPathAnchorRef.current = activeAnchor;
              pathAnchorPointerYRef.current = event.clientY;
              syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
              return;
            }

            if (activeAnchor === null) {
              pendingPathAnchorRef.current = nextPathAnchor;
              pathAnchorPointerYRef.current = event.clientY;
              syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
              return;
            }

            handleCommitPath(
              nextPathAnchor.center,
              targetElevation,
              activeAnchor
            );
            pendingPathAnchorRef.current = nextPathAnchor;
            pathAnchorPointerYRef.current = event.clientY;
            syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
            return;
          }
          case "water":
            handleCreateWaterRegion(
              pendingWaterAnchorRef.current ?? nextScenePosition,
              nextScenePosition
            );
            pendingWaterAnchorRef.current = null;
            syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
            return;
        }
      }

      const nextSelectedEntity = readSelectedEntity(event.clientX, event.clientY);

      setSelectedTransformTarget(
        createTransformTargetFromSelectedEntity(nextSelectedEntity)
      );
      handleEntitySelection(nextSelectedEntity);
    };

    const handlePointerCancel = () => {
      pointerDownPositionRef.current = null;
      stopBuildPointerInteraction();
      pendingFloorAnchorRef.current = null;
      pendingFloorPolygonPointsRef.current = Object.freeze([]);
      pendingWaterAnchorRef.current = null;
      pendingZoneAnchorRef.current = null;
      pendingTerrainPatchAnchorRef.current = null;
      stopPathBrushDrag();
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (
        terrainBrushDragActiveRef.current === true &&
        viewportToolModeRef.current === "terrain" &&
        (event.buttons & 1) === 1
      ) {
        const terrainBrushPosition = readGroundPlacementPosition(
          event.clientX,
          event.clientY
        );

        if (
          terrainBrushPosition !== null &&
          readSelectedTerrainPatchAtPosition(terrainBrushPosition) !== null
        ) {
          const nextStrokeKey = readTerrainBrushStrokeKey(
            terrainPatchDraftsRef.current,
            terrainBrushPosition
          );

          if (nextStrokeKey !== terrainBrushLastStrokeKeyRef.current) {
            terrainBrushLastStrokeKeyRef.current = nextStrokeKey;
            handleApplyTerrainBrush(terrainBrushPosition);
          }
        }
      }

      syncBuildCursor(event.clientX, event.clientY);
      syncBuilderPreview(event.clientX, event.clientY, event.ctrlKey);
    };
    const handlePointerLeave = () => {
      stopBuildPointerInteraction();
      buildCursorPositionRef.current = null;
      pendingFloorAnchorRef.current = null;
      pendingFloorPolygonPointsRef.current = Object.freeze([]);
      pendingWaterAnchorRef.current = null;
      pendingZoneAnchorRef.current = null;
      pendingTerrainPatchAnchorRef.current = null;
      stopPathBrushDrag();

      if (buildCursorAnchorRef.current !== null) {
        buildCursorAnchorRef.current.visible = false;
      }

      clearBuilderPreview();
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      stopBuildPointerInteraction();
      pendingFloorAnchorRef.current = null;
      pendingFloorPolygonPointsRef.current = Object.freeze([]);
      pendingWaterAnchorRef.current = null;
      pendingWallAnchorRef.current = null;
      pendingWallChainStartRef.current = null;
      pendingPathAnchorRef.current = null;
      pendingZoneAnchorRef.current = null;
      pendingLaneAnchorRef.current = null;
      pendingVehicleRouteAnchorRef.current = null;
      pathAnchorPointerYRef.current = null;
      stopPathBrushDrag();
      clearBuilderPreview();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stopBuildPointerInteraction();
        pendingFloorAnchorRef.current = null;
        pendingFloorPolygonPointsRef.current = Object.freeze([]);
        pendingWaterAnchorRef.current = null;
        pendingWallAnchorRef.current = null;
        pendingWallChainStartRef.current = null;
        pendingPathAnchorRef.current = null;
        pendingZoneAnchorRef.current = null;
        stopPathBrushDrag();
        clearBuilderPreview();
        return;
      }

      if (event.key === "Backspace") {
        if (pendingFloorPolygonPointsRef.current.length > 0) {
          event.preventDefault();
          pendingFloorPolygonPointsRef.current = Object.freeze(
            pendingFloorPolygonPointsRef.current.slice(
              0,
              pendingFloorPolygonPointsRef.current.length - 1
            )
          );
          clearBuilderPreview();
          return;
        }

        if (pendingWallAnchorRef.current !== null) {
          event.preventDefault();
          pendingWallAnchorRef.current = pendingWallChainStartRef.current;
          clearBuilderPreview();
        }
      }

      if (
        event.key === "Enter" &&
        pendingFloorPolygonPointsRef.current.length >= 3
      ) {
        event.preventDefault();
        handleCreateFloorPolygon(pendingFloorPolygonPointsRef.current);
        pendingFloorPolygonPointsRef.current = Object.freeze([]);
        clearBuilderPreview();
      }
    };

    const initializeViewport = async () => {
      try {
        await renderer.init();

        if (disposed) {
          return;
        }

        syncSize();
        resizeObserverRef.current = new ResizeObserver(syncSize);
        resizeObserverRef.current.observe(hostElement);
        canvasElement.addEventListener("pointerdown", handlePointerDown);
        canvasElement.addEventListener("pointermove", handlePointerMove);
        canvasElement.addEventListener("pointerup", handlePointerUp);
        canvasElement.addEventListener("pointercancel", handlePointerCancel);
        canvasElement.addEventListener("pointerleave", handlePointerLeave);
        canvasElement.addEventListener("contextmenu", handleContextMenu);
        hostElement.addEventListener("keydown", handleKeyDown);
        syncSelectionPresentation();
        animationFrameRef.current =
          globalThis.window.requestAnimationFrame(renderFrame);
      } catch (error) {
        if (disposed) {
          return;
        }

        setViewportError(resolveViewportErrorMessage(error));
      }
    };

    void initializeViewport();

    return () => {
      disposed = true;
      lastFrameTimeRef.current = null;
      globalThis.window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      canvasElement.removeEventListener("pointerdown", handlePointerDown);
      canvasElement.removeEventListener("pointermove", handlePointerMove);
      canvasElement.removeEventListener("pointerup", handlePointerUp);
      canvasElement.removeEventListener("pointercancel", handlePointerCancel);
      canvasElement.removeEventListener("pointerleave", handlePointerLeave);
      canvasElement.removeEventListener("contextmenu", handleContextMenu);
      hostElement.removeEventListener("keydown", handleKeyDown);
      disposeMapEditorViewportPreviewGroup(placementGroup);
      if (collisionGroupRef.current !== null) {
        scene.remove(collisionGroupRef.current);
        disposeMapEditorViewportPreviewGroup(collisionGroupRef.current);
        collisionGroupRef.current = null;
      }
      if (builderPreviewGroupRef.current !== null) {
        scene.remove(builderPreviewGroupRef.current);
        disposeBuilderPreviewGroup(builderPreviewGroupRef.current);
        builderPreviewGroupRef.current = null;
      }
      if (terrainVertexTransformAnchorRef.current !== null) {
        scene.remove(terrainVertexTransformAnchorRef.current);
        disposeBuilderPreviewGroup(terrainVertexTransformAnchorRef.current);
        terrainVertexTransformAnchorRef.current = null;
      }
      if (sceneDraftHandlesRef.current !== null) {
        scene.remove(sceneDraftHandlesRef.current.rootGroup);
        disposeMapEditorViewportSceneDraftHandles(sceneDraftHandlesRef.current);
        sceneDraftHandlesRef.current = null;
      }
      if (semanticDraftHandlesRef.current !== null) {
        scene.remove(semanticDraftHandlesRef.current.rootGroup);
        disposeMapEditorViewportSemanticDraftHandles(
          semanticDraftHandlesRef.current
        );
        semanticDraftHandlesRef.current = null;
      }
      if (buildCursorAnchorRef.current !== null) {
        const buildCursorDisposalGroup = new Group();

        buildCursorDisposalGroup.add(buildCursorAnchorRef.current);
        disposeMapEditorViewportPreviewGroup(buildCursorDisposalGroup);
        buildCursorAnchorRef.current = null;
      }
      placementAnchorByIdRef.current = new Map();
      collisionAnchorByIdRef.current = new Map();
      previewAssetLibraryRef.current = null;
      transformController.dispose(scene);
      transformControllerRef.current = null;
      keyboardFlightController.dispose();
      keyboardFlightControllerRef.current = null;
      orbitControls.dispose();
      orbitControlsRef.current = null;
      disposeMapEditorSceneEnvironment(scene, environmentRuntimeRef.current);
      environmentRuntimeRef.current = null;
      disposeMapEditorViewportHelperHandles(scene, helperHandles);
      helperHandlesRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
      placementGroupRef.current = null;
      collisionGroupRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const renderer = rendererRef.current;

    if (camera === null || scene === null || renderer === null) {
      return;
    }

    disposeMapEditorSceneEnvironment(scene, environmentRuntimeRef.current);
    environmentRuntimeRef.current = installMapEditorSceneEnvironment(
      camera,
      scene,
      renderer,
      environmentPresentation
    );
  }, [environmentPresentation]);

  useEffect(() => {
    const placementGroup = placementGroupRef.current;
    const previewAssetLibrary = previewAssetLibraryRef.current;

    if (placementGroup === null || previewAssetLibrary === null) {
      return;
    }

    let cancelled = false;
    const previewBuildVersion = previewBuildVersionRef.current + 1;
    previewBuildVersionRef.current = previewBuildVersion;

    const rebuildPlacementPreviews = async () => {
      try {
        const placementAnchors = await Promise.all(
          placementDraftsRef.current.map((placement) =>
            previewAssetLibrary.createPlacementPreviewAnchor(placement)
          )
        );

        if (cancelled || previewBuildVersionRef.current !== previewBuildVersion) {
          const disposalGroup = new Group();

          for (const placementAnchor of placementAnchors) {
            disposalGroup.add(placementAnchor);
          }

          disposeMapEditorViewportPreviewGroup(disposalGroup);
          return;
        }

        disposeMapEditorViewportPreviewGroup(placementGroup);
        placementAnchorByIdRef.current = new Map(
          placementAnchors.map((placementAnchor) => [
            placementAnchor.userData.placementId as string,
            placementAnchor
          ])
        );

        for (const placementAnchor of placementAnchors) {
          placementGroup.add(placementAnchor);
        }

        syncPlacementPreviewAnchors(placementDraftsRef.current);
        syncSelectionPresentation();
      } catch (error) {
        if (!cancelled) {
          setViewportError(resolveViewportErrorMessage(error));
        }
      }
    };

    void rebuildPlacementPreviews();

    return () => {
      cancelled = true;
    };
  }, [previewStructureSignature, syncPlacementPreviewAnchors, syncSelectionPresentation]);

  useEffect(() => {
    const collisionGroup = collisionGroupRef.current;

    if (collisionGroup === null) {
      return;
    }

    const collisionAnchors = placementDrafts.map((placement) =>
      createMapEditorViewportPlacementCollisionAnchor(placement)
    );

    disposeMapEditorViewportPreviewGroup(collisionGroup);
    collisionAnchorByIdRef.current = new Map(
      collisionAnchors.map((collisionAnchor) => [
        collisionAnchor.userData.placementId as string,
        collisionAnchor
      ])
    );

    for (const collisionAnchor of collisionAnchors) {
      collisionGroup.add(collisionAnchor);
    }
  }, [previewStructureSignature]);

  useEffect(() => {
    syncPlacementPreviewAnchors(placementDrafts);
  }, [placementDrafts, previewPlacementSignature, syncPlacementPreviewAnchors]);

  useEffect(() => {
    for (const placement of placementDrafts) {
      const collisionAnchor =
        collisionAnchorByIdRef.current.get(placement.placementId) ?? null;

      if (collisionAnchor === null) {
        continue;
      }

      syncMapEditorViewportPlacementAnchorTransform(collisionAnchor, placement);
    }
  }, [placementDrafts, previewPlacementSignature]);

  useEffect(() => {
    const sceneDraftHandles = sceneDraftHandlesRef.current;

    if (sceneDraftHandles === null) {
      return;
    }

    syncMapEditorViewportSceneDrafts(sceneDraftHandles, {
      playerSpawnDrafts,
      resourceSpawnDrafts,
      sceneObjectDrafts,
      waterRegionDrafts
    });
    syncSelectionPresentation();
  }, [
    playerSpawnDrafts,
    resourceSpawnDrafts,
    sceneDraftSignature,
    sceneObjectDrafts,
    waterRegionDrafts
  ]);

  useEffect(() => {
    const semanticDraftHandles = semanticDraftHandlesRef.current;

    if (semanticDraftHandles === null) {
      return;
    }

    syncMapEditorViewportSemanticDrafts(semanticDraftHandles, {
      connectorDrafts,
      edgeDrafts,
      gameplayVolumeDrafts,
      lightDrafts,
      materialDefinitionDrafts,
      regionDrafts,
      structuralDrafts,
      surfaceDrafts,
      terrainPatchDrafts
    });
    syncSelectionPresentation();
  }, [
    connectorDrafts,
    edgeDrafts,
    gameplayVolumeDrafts,
    lightDrafts,
    materialDefinitionDrafts,
    regionDrafts,
    structuralDrafts,
    surfaceDrafts,
    syncSelectionPresentation,
    terrainPatchDrafts
  ]);

  useEffect(() => {
    syncMapEditorViewportSceneVisibility(
      sceneVisibility,
      environmentRuntimeRef.current,
      placementGroupRef.current,
      sceneDraftHandlesRef.current,
      semanticDraftHandlesRef.current
    );
  }, [
    connectorDrafts,
    edgeDrafts,
    environmentPresentation,
    gameplayVolumeDrafts,
    lightDrafts,
    previewPlacementSignature,
    regionDrafts,
    sceneDraftSignature,
    sceneVisibility,
    structuralDrafts,
    surfaceDrafts,
    terrainPatchDrafts
  ]);

  useEffect(() => {
    const scene = sceneRef.current;
    const previewAssetLibrary = previewAssetLibraryRef.current;

    if (scene === null || previewAssetLibrary === null) {
      return;
    }

    let cancelled = false;

    const removeBuildCursorAnchor = () => {
      if (buildCursorAnchorRef.current === null) {
        buildCursorAssetIdRef.current = null;
        return;
      }

      const buildCursorDisposalGroup = new Group();

      scene.remove(buildCursorAnchorRef.current);
      buildCursorDisposalGroup.add(buildCursorAnchorRef.current);
      disposeMapEditorViewportPreviewGroup(buildCursorDisposalGroup);
      buildCursorAnchorRef.current = null;
      buildCursorAssetIdRef.current = null;
      buildCursorPositionRef.current = null;
    };

    if (viewportToolMode !== "module" || activeModuleAssetId === null) {
      removeBuildCursorAnchor();
      return;
    }

    if (
      buildCursorAnchorRef.current !== null &&
      buildCursorAssetIdRef.current === activeModuleAssetId
    ) {
      buildCursorAnchorRef.current.visible = buildCursorPositionRef.current !== null;
      return;
    }

    removeBuildCursorAnchor();

    const createBuildCursorAnchor = async () => {
      const placement = {
        assetId: activeModuleAssetId,
        colliderCount: 0,
        collisionEnabled: true,
        collisionPath: null,
        collider: null,
        dynamicBody: null,
        entries: null,
        isVisible: true,
        materialReferenceId: null,
        moduleId: "__map-editor-build-cursor__",
        notes: "",
        placementId: "__map-editor-build-cursor__",
        placementMode: "instanced",
        position: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        rotationYRadians: 0,
        scale: Object.freeze({
          x: 1,
          y: 1,
          z: 1
        }),
        seats: null,
        surfaceColliders: Object.freeze([]),
        traversalAffordance: "support"
      } satisfies MapEditorPlacementDraftSnapshot;
      const buildCursorAnchor =
        await previewAssetLibrary.createPlacementPreviewAnchor(placement);

      if (cancelled) {
        const disposalGroup = new Group();

        disposalGroup.add(buildCursorAnchor);
        disposeMapEditorViewportPreviewGroup(disposalGroup);
        return;
      }

      applyMapEditorViewportPreviewOpacity(buildCursorAnchor, 0.42);
      if (buildCursorPositionRef.current !== null) {
        buildCursorAnchor.position.set(
          buildCursorPositionRef.current.x,
          buildCursorPositionRef.current.y,
          buildCursorPositionRef.current.z
        );
        buildCursorAnchor.visible = true;
      } else {
        buildCursorAnchor.visible = false;
      }
      buildCursorAnchorRef.current = buildCursorAnchor;
      buildCursorAssetIdRef.current = activeModuleAssetId;
      scene.add(buildCursorAnchor);
    };

    void createBuildCursorAnchor();

    return () => {
      cancelled = true;
    };
  }, [activeModuleAssetId, viewportToolMode]);

  useEffect(() => {
    const helperHandles = helperHandlesRef.current;
    const collisionGroup = collisionGroupRef.current;

    if (helperHandles === null) {
      return;
    }

    syncMapEditorViewportHelperGridSize(
      sceneRef.current,
      helperHandles,
      helperGridSizeMeters
    );
    syncMapEditorViewportHelperVisibility(helperHandles, helperVisibility);

    if (collisionGroup !== null) {
      collisionGroup.visible =
        helperVisibility.collisionBounds && sceneVisibility.authoredModules;
    }
  }, [
    helperGridSizeMeters,
    helperVisibility,
    sceneVisibility.authoredModules
  ]);

  useEffect(() => {
    syncSelectionPresentation();
  }, [
    selectedEntityRef,
    selectedTerrainVertexTarget,
    selectedTransformTarget,
    syncSelectionPresentation,
    terrainPatchDrafts,
    viewportToolMode
  ]);

  useEffect(() => {
    const camera = cameraRef.current;
    const orbitControls = orbitControlsRef.current;
    const hostElement = hostRef.current;

    if (camera === null || orbitControls === null) {
      return;
    }

    if (framedBundleIdRef.current === bundleId) {
      return;
    }

    if (hostElement !== null) {
      camera.aspect = Math.max(1, hostElement.clientWidth) / Math.max(1, hostElement.clientHeight);
      camera.updateProjectionMatrix();
    }

    const extents = resolvePlacementExtents(placementDrafts, {
      connectorDrafts,
      edgeDrafts,
      gameplayVolumeDrafts,
      lightDrafts,
      playerSpawnDrafts,
      regionDrafts,
      resourceSpawnDrafts,
      sceneObjectDrafts,
      structuralDrafts,
      surfaceDrafts,
      terrainPatchDrafts,
      waterRegionDrafts
    });
    const centerX = (extents.minX + extents.maxX) * 0.5;
    const centerZ = (extents.minZ + extents.maxZ) * 0.5;
    const span = Math.max(
      14,
      extents.maxX - extents.minX,
      extents.maxZ - extents.minZ
    );

    frameMapEditorViewportCamera(camera, orbitControls, centerX, centerZ, span);
    framedBundleIdRef.current = bundleId;
  }, [
    bundleId,
    connectorDrafts,
    edgeDrafts,
    gameplayVolumeDrafts,
    lightDrafts,
    placementDrafts,
    playerSpawnDrafts,
    regionDrafts,
    resourceSpawnDrafts,
    sceneObjectDrafts,
    structuralDrafts,
    surfaceDrafts,
    terrainPatchDrafts,
    waterRegionDrafts
  ]);

  return (
    <div className="relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-border/70 bg-[radial-gradient(circle_at_top,rgb(56_189_248/0.08),transparent_32%),linear-gradient(180deg,rgb(15_23_42/0.18),rgb(2_6_23/0.6))]">
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-border/70 bg-background/78 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
        {viewportToolMode === "module" && activeModuleAssetId !== null
          ? `Module tool: click to place ${activeModuleAssetId} on the clicked support.`
          : viewportToolMode === "floor"
            ? "Floor tool: click or drag a snapped footprint on the clicked support."
          : viewportToolMode === "cover"
            ? "Cover tool: click to place a gameplay-tagged hard cover block."
          : viewportToolMode === "zone" || viewportToolMode === "lane" || viewportToolMode === "vehicle-route"
            ? "Gameplay volume tool: click two snapped cells to author zones, lanes, and routes."
          : viewportToolMode === "paint"
            ? "Paint tool: click a structure, region, or module to apply the active material."
          : viewportToolMode === "delete"
            ? "Delete tool: click an authored entity to remove it."
          : viewportToolMode === "light"
            ? "Light tool: click to place the authored light preset above the clicked support."
          : viewportToolMode === "player-spawn"
            ? "Spawn tool: click the scene to place a player spawn marker on the clicked support."
          : viewportToolMode === "resource-spawn"
            ? "Weapon tool: click the scene to place a weapon ammo pickup on the clicked support."
          : viewportToolMode === "portal"
            ? "Portal tool: click the scene to place a portal on the clicked support."
          : viewportToolMode === "terrain"
            ? selectedEntityRef?.kind === "terrain-patch"
              ? "Terrain tool: drag over the selected patch to shape or smooth it."
              : "Terrain tool: drag empty ground to draw a patch."
          : viewportToolMode === "vertex"
            ? "Vertex tool: click a terrain sample, then drag the height handle."
            : viewportToolMode === "wall"
              ? "Wall tool: click once to anchor on a support, hover the next edge, then click again to commit and keep chaining."
              : viewportToolMode === "path"
                ? "Path tool: drag to paint flat path blocks, or select an authored path to shape a ramp."
                : viewportToolMode === "water"
                  ? "Water tool: place a snapped rectangular footprint using top elevation and depth."
                  : "Click to focus. Drag to orbit. Right-drag to pan. Scroll to zoom. Use WASD to fly, Q/E for height, and Shift to move faster."}
      </div>
      {viewportError !== null ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/92 p-6 text-center text-sm text-muted-foreground">
          {viewportError}
        </div>
      ) : null}
      <div
        className="h-full w-full outline-none"
        ref={hostRef}
        tabIndex={0}
      >
        <canvas className="h-full w-full" ref={canvasRef} />
      </div>
    </div>
  );
}
