import type {
  MetaverseMapBundleSemanticConnectorSnapshot,
  MetaverseMapBundleSemanticEdgeSnapshot,
  MetaverseMapBundleSemanticGameplayVolumeSnapshot,
  MetaverseMapBundleSemanticGridRectSnapshot,
  MetaverseMapBundleSemanticLightSnapshot,
  MetaverseMapBundleSemanticMaterialDefinitionSnapshot,
  MetaverseMapBundleSemanticMaterialId,
  MetaverseMapBundleSemanticPlanarLoopSnapshot,
  MetaverseMapBundleSemanticPlanarPointSnapshot,
  MetaverseMapBundleSemanticRegionSnapshot,
  MetaverseMapBundleSemanticStructureKind,
  MetaverseMapBundleSemanticStructureSnapshot,
  MetaverseMapBundleSemanticSurfaceSnapshot,
  MetaverseMapBundleSemanticTerrainMaterialLayerSnapshot,
  MetaverseMapBundleSemanticTerrainPatchSnapshot,
  MetaverseMapBundleSemanticWorldSnapshot,
  MetaverseWorldSurfaceVector3Snapshot
} from "@webgpu-metaverse/shared/metaverse/world";

export interface MapEditorTerrainPatchDraftSnapshot {
  readonly grid: MetaverseMapBundleSemanticGridRectSnapshot;
  readonly heightSamples: readonly number[];
  readonly label: string;
  readonly materialLayers:
    readonly MetaverseMapBundleSemanticTerrainMaterialLayerSnapshot[];
  readonly origin: MetaverseWorldSurfaceVector3Snapshot;
  readonly rotationYRadians: number;
  readonly sampleCountX: number;
  readonly sampleCountZ: number;
  readonly sampleSpacingMeters: number;
  readonly terrainPatchId: string;
  readonly waterLevelMeters: number | null;
}

export interface MapEditorMaterialDefinitionDraftSnapshot
  extends MetaverseMapBundleSemanticMaterialDefinitionSnapshot {}

export interface MapEditorSurfaceDraftSnapshot {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly elevation: number;
  readonly kind: "flat-slab" | "sloped-plane" | "terrain-patch";
  readonly label: string;
  readonly rotationYRadians: number;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly slopeRiseMeters: number;
  readonly surfaceId: string;
  readonly terrainPatchId: string | null;
}

export interface MapEditorRegionDraftSnapshot {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly label: string;
  readonly materialReferenceId: string | null;
  readonly outerLoop: MetaverseMapBundleSemanticPlanarLoopSnapshot;
  readonly regionId: string;
  readonly regionKind: "arena" | "floor" | "path" | "roof";
  readonly rotationYRadians: number;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly surfaceId: string;
}

export interface MapEditorEdgeDraftSnapshot {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly edgeId: string;
  readonly edgeKind:
    | "curb"
    | "fence"
    | "rail"
    | "retaining-wall"
    | "wall";
  readonly heightMeters: number;
  readonly label: string;
  readonly lengthMeters: number;
  readonly path: readonly MetaverseMapBundleSemanticPlanarPointSnapshot[];
  readonly rotationYRadians: number;
  readonly surfaceId: string;
  readonly thicknessMeters: number;
}

export interface MapEditorConnectorDraftSnapshot {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly connectorId: string;
  readonly connectorKind: "door" | "gate" | "ramp";
  readonly fromSurfaceId: string;
  readonly label: string;
  readonly rotationYRadians: number;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly toSurfaceId: string;
}

export interface MapEditorStructuralDraftSnapshot {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly grid: MetaverseMapBundleSemanticGridRectSnapshot;
  readonly label: string;
  readonly materialId: MetaverseMapBundleSemanticMaterialId;
  readonly materialReferenceId: string | null;
  readonly rotationYRadians: number;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly structureId: string;
  readonly structureKind: MetaverseMapBundleSemanticStructureKind;
  readonly traversalAffordance: "blocker" | "support";
}

export interface MapEditorGameplayVolumeDraftSnapshot {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly label: string;
  readonly priority: number;
  readonly rotationYRadians: number;
  readonly routePoints: readonly MetaverseWorldSurfaceVector3Snapshot[];
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly tags: readonly string[];
  readonly teamId: "blue" | "neutral" | "red" | null;
  readonly volumeId: string;
  readonly volumeKind:
    | "combat-lane"
    | "cover-volume"
    | "kill-floor"
    | "spawn-room"
    | "team-zone"
    | "vehicle-route";
}

export interface MapEditorLightDraftSnapshot {
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  readonly label: string;
  readonly lightId: string;
  readonly lightKind: "ambient" | "area" | "point" | "spot" | "sun";
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly rangeMeters: number | null;
  readonly rotationYRadians: number;
  readonly target: MetaverseWorldSurfaceVector3Snapshot | null;
}

function freezeVector3(
  vector: MetaverseWorldSurfaceVector3Snapshot
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x: vector.x,
    y: vector.y,
    z: vector.z
  });
}

function resolveLoopBounds(
  loop: MetaverseMapBundleSemanticPlanarLoopSnapshot
): {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
} {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of loop.points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minZ)) {
    return Object.freeze({
      center: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      size: Object.freeze({
        x: 4,
        y: 0.5,
        z: 4
      })
    });
  }

  return Object.freeze({
    center: Object.freeze({
      x: (minX + maxX) * 0.5,
      y: 0,
      z: (minZ + maxZ) * 0.5
    }),
    size: Object.freeze({
      x: Math.max(0.5, maxX - minX),
      y: 0.5,
      z: Math.max(0.5, maxZ - minZ)
    })
  });
}

export function freezeTerrainPatchDraft(
  draft: MapEditorTerrainPatchDraftSnapshot
): MapEditorTerrainPatchDraftSnapshot {
  return Object.freeze({
    ...draft,
    grid: Object.freeze({
      cellX: draft.grid.cellX,
      cellZ: draft.grid.cellZ,
      cellsX: draft.grid.cellsX,
      cellsZ: draft.grid.cellsZ,
      layer: draft.grid.layer
    }),
    heightSamples: Object.freeze([...draft.heightSamples]),
    materialLayers: Object.freeze(
      draft.materialLayers.map((layer) =>
        Object.freeze({
          layerId: layer.layerId,
          materialId: layer.materialId,
          weightSamples: Object.freeze([...layer.weightSamples])
        })
      )
    ),
    origin: freezeVector3(draft.origin)
  });
}

export function freezeMaterialDefinitionDraft(
  draft: MapEditorMaterialDefinitionDraftSnapshot
): MapEditorMaterialDefinitionDraftSnapshot {
  return Object.freeze({
    accentColorHex: draft.accentColorHex,
    baseColorHex: draft.baseColorHex,
    baseMaterialId: draft.baseMaterialId,
    label: draft.label,
    materialId: draft.materialId,
    metalness: draft.metalness,
    opacity: draft.opacity,
    roughness: draft.roughness,
    textureBrightness: draft.textureBrightness,
    textureContrast: draft.textureContrast,
    textureImageDataUrl: draft.textureImageDataUrl,
    texturePatternStrength: draft.texturePatternStrength,
    textureRepeat: draft.textureRepeat
  });
}

export function freezeSurfaceDraft(
  draft: MapEditorSurfaceDraftSnapshot
): MapEditorSurfaceDraftSnapshot {
  return Object.freeze({
    ...draft,
    center: freezeVector3(draft.center),
    size: freezeVector3(draft.size)
  });
}

export function freezeRegionDraft(
  draft: MapEditorRegionDraftSnapshot
): MapEditorRegionDraftSnapshot {
  return Object.freeze({
    ...draft,
    center: freezeVector3(draft.center),
    outerLoop: Object.freeze({
      points: Object.freeze(
        draft.outerLoop.points.map((point) =>
          Object.freeze({
            x: point.x,
            z: point.z
          })
        )
      )
    }),
    size: freezeVector3(draft.size)
  });
}

export function freezeEdgeDraft(
  draft: MapEditorEdgeDraftSnapshot
): MapEditorEdgeDraftSnapshot {
  return Object.freeze({
    ...draft,
    center: freezeVector3(draft.center),
    path: Object.freeze(
      draft.path.map((point) =>
        Object.freeze({
          x: point.x,
          z: point.z
        })
      )
    )
  });
}

export function freezeConnectorDraft(
  draft: MapEditorConnectorDraftSnapshot
): MapEditorConnectorDraftSnapshot {
  return Object.freeze({
    ...draft,
    center: freezeVector3(draft.center),
    size: freezeVector3(draft.size)
  });
}

export function freezeStructuralDraft(
  draft: MapEditorStructuralDraftSnapshot
): MapEditorStructuralDraftSnapshot {
  return Object.freeze({
    ...draft,
    center: freezeVector3(draft.center),
    grid: Object.freeze({
      cellX: draft.grid.cellX,
      cellZ: draft.grid.cellZ,
      cellsX: draft.grid.cellsX,
      cellsZ: draft.grid.cellsZ,
      layer: draft.grid.layer
    }),
    size: freezeVector3(draft.size)
  });
}

export function freezeGameplayVolumeDraft(
  draft: MapEditorGameplayVolumeDraftSnapshot
): MapEditorGameplayVolumeDraftSnapshot {
  return Object.freeze({
    ...draft,
    center: freezeVector3(draft.center),
    routePoints: Object.freeze(draft.routePoints.map(freezeVector3)),
    size: freezeVector3(draft.size),
    tags: Object.freeze([...draft.tags])
  });
}

export function freezeLightDraft(
  draft: MapEditorLightDraftSnapshot
): MapEditorLightDraftSnapshot {
  return Object.freeze({
    ...draft,
    color: Object.freeze([
      draft.color[0],
      draft.color[1],
      draft.color[2]
    ] as const),
    position: freezeVector3(draft.position),
    target: draft.target === null ? null : freezeVector3(draft.target)
  });
}

export function createMapEditorTerrainPatchDrafts(
  semanticWorld: MetaverseMapBundleSemanticWorldSnapshot
): readonly MapEditorTerrainPatchDraftSnapshot[] {
  return Object.freeze(
    semanticWorld.terrainPatches.map((terrainPatch) =>
      freezeTerrainPatchDraft({
        grid: terrainPatch.grid,
        heightSamples: terrainPatch.heightSamples,
        label: terrainPatch.label,
        materialLayers: terrainPatch.materialLayers,
        origin: terrainPatch.origin,
        rotationYRadians: terrainPatch.rotationYRadians,
        sampleCountX: terrainPatch.sampleCountX,
        sampleCountZ: terrainPatch.sampleCountZ,
        sampleSpacingMeters: terrainPatch.sampleSpacingMeters,
        terrainPatchId: terrainPatch.terrainPatchId,
        waterLevelMeters: terrainPatch.waterLevelMeters
      })
    )
  );
}

export function createMapEditorMaterialDefinitionDrafts(
  semanticWorld: MetaverseMapBundleSemanticWorldSnapshot
): readonly MapEditorMaterialDefinitionDraftSnapshot[] {
  return Object.freeze(
    semanticWorld.materialDefinitions.map((materialDefinition) =>
      freezeMaterialDefinitionDraft(materialDefinition)
    )
  );
}

export function createMapEditorSurfaceDrafts(
  semanticWorld: MetaverseMapBundleSemanticWorldSnapshot
): readonly MapEditorSurfaceDraftSnapshot[] {
  return Object.freeze(
    semanticWorld.surfaces.map((surface) =>
      freezeSurfaceDraft({
        center: surface.center,
        elevation: surface.elevation,
        kind: surface.kind,
        label: surface.label,
        rotationYRadians: surface.rotationYRadians,
        size: surface.size,
        slopeRiseMeters: surface.slopeRiseMeters,
        surfaceId: surface.surfaceId,
        terrainPatchId: surface.terrainPatchId
      })
    )
  );
}

export function createMapEditorRegionDrafts(
  semanticWorld: MetaverseMapBundleSemanticWorldSnapshot,
  surfaces: readonly MapEditorSurfaceDraftSnapshot[]
): readonly MapEditorRegionDraftSnapshot[] {
  const surfacesById = new Map(surfaces.map((surface) => [surface.surfaceId, surface]));

  return Object.freeze(
    semanticWorld.regions.map((region) => {
      const surface = surfacesById.get(region.surfaceId) ?? null;
      const bounds = resolveLoopBounds(region.outerLoop);

      return freezeRegionDraft({
        center:
          surface === null
            ? Object.freeze({
                x: bounds.center.x,
                y: 0,
                z: bounds.center.z
              })
            : surface.center,
        label: region.label,
        materialReferenceId: region.materialReferenceId,
        outerLoop: region.outerLoop,
        regionId: region.regionId,
        regionKind: region.regionKind,
        rotationYRadians: surface?.rotationYRadians ?? 0,
        size: bounds.size,
        surfaceId: region.surfaceId
      });
    })
  );
}

export function createMapEditorEdgeDrafts(
  semanticWorld: MetaverseMapBundleSemanticWorldSnapshot,
  surfaces: readonly MapEditorSurfaceDraftSnapshot[]
): readonly MapEditorEdgeDraftSnapshot[] {
  const surfacesById = new Map(surfaces.map((surface) => [surface.surfaceId, surface]));

  return Object.freeze(
    semanticWorld.edges.map((edge) => {
      const surface = surfacesById.get(edge.surfaceId) ?? null;
      const startPoint = edge.path[0] ?? Object.freeze({ x: -2, z: 0 });
      const endPoint = edge.path[edge.path.length - 1] ?? Object.freeze({ x: 2, z: 0 });
      const centerOffset = Object.freeze({
        x: (startPoint.x + endPoint.x) * 0.5,
        z: (startPoint.z + endPoint.z) * 0.5
      });

      return freezeEdgeDraft({
        center:
          surface === null
            ? Object.freeze({
                x: centerOffset.x,
                y: edge.heightMeters * 0.5,
                z: centerOffset.z
              })
            : Object.freeze({
                x: surface.center.x + centerOffset.x,
                y: surface.elevation + edge.heightMeters * 0.5,
                z: surface.center.z + centerOffset.z
              }),
        edgeId: edge.edgeId,
        edgeKind: edge.edgeKind,
        heightMeters: edge.heightMeters,
        label: edge.label,
        lengthMeters: Math.max(
          0.5,
          Math.hypot(endPoint.x - startPoint.x, endPoint.z - startPoint.z)
        ),
        path: edge.path,
        rotationYRadians: surface?.rotationYRadians ?? 0,
        surfaceId: edge.surfaceId,
        thicknessMeters: edge.thicknessMeters
      });
    })
  );
}

export function createMapEditorConnectorDrafts(
  semanticWorld: MetaverseMapBundleSemanticWorldSnapshot
): readonly MapEditorConnectorDraftSnapshot[] {
  return Object.freeze(
    semanticWorld.connectors.map((connector) =>
      freezeConnectorDraft({
        center: connector.center,
        connectorId: connector.connectorId,
        connectorKind: connector.connectorKind,
        fromSurfaceId: connector.fromSurfaceId,
        label: connector.label,
        rotationYRadians: connector.rotationYRadians,
        size: connector.size,
        toSurfaceId: connector.toSurfaceId
      })
    )
  );
}

export function createMapEditorStructuralDrafts(
  semanticWorld: MetaverseMapBundleSemanticWorldSnapshot
): readonly MapEditorStructuralDraftSnapshot[] {
  return Object.freeze(
    semanticWorld.structures.map((structure) =>
      freezeStructuralDraft({
        center: structure.center,
        grid: structure.grid,
        label: structure.label,
        materialId: structure.materialId,
        materialReferenceId: structure.materialReferenceId,
        rotationYRadians: structure.rotationYRadians,
        size: structure.size,
        structureId: structure.structureId,
        structureKind: structure.structureKind,
        traversalAffordance: structure.traversalAffordance
      })
    )
  );
}

export function createMapEditorGameplayVolumeDrafts(
  semanticWorld: MetaverseMapBundleSemanticWorldSnapshot
): readonly MapEditorGameplayVolumeDraftSnapshot[] {
  return Object.freeze(
    semanticWorld.gameplayVolumes.map((volume) =>
      freezeGameplayVolumeDraft({
        center: volume.center,
        label: volume.label,
        priority: volume.priority,
        rotationYRadians: volume.rotationYRadians,
        routePoints: volume.routePoints,
        size: volume.size,
        tags: volume.tags,
        teamId: volume.teamId,
        volumeId: volume.volumeId,
        volumeKind: volume.volumeKind
      })
    )
  );
}

export function createMapEditorLightDrafts(
  semanticWorld: MetaverseMapBundleSemanticWorldSnapshot
): readonly MapEditorLightDraftSnapshot[] {
  return Object.freeze(
    semanticWorld.lights.map((light) =>
      freezeLightDraft({
        color: light.color,
        intensity: light.intensity,
        label: light.label,
        lightId: light.lightId,
        lightKind: light.lightKind,
        position: light.position,
        rangeMeters: light.rangeMeters,
        rotationYRadians: light.rotationYRadians,
        target: light.target
      })
    )
  );
}

export function createSemanticSurfaceSnapshotFromDraft(
  draft: MapEditorSurfaceDraftSnapshot
): MetaverseMapBundleSemanticSurfaceSnapshot {
  return Object.freeze({
    center: freezeVector3(draft.center),
    elevation: draft.elevation,
    kind: draft.kind,
    label: draft.label,
    rotationYRadians: draft.rotationYRadians,
    size: freezeVector3(draft.size),
    slopeRiseMeters: draft.slopeRiseMeters,
    surfaceId: draft.surfaceId,
    terrainPatchId: draft.terrainPatchId
  });
}

export function createSemanticRegionSnapshotFromDraft(
  draft: MapEditorRegionDraftSnapshot
): MetaverseMapBundleSemanticRegionSnapshot {
  return Object.freeze({
    holes: Object.freeze([]),
    label: draft.label,
    materialReferenceId: draft.materialReferenceId,
    outerLoop: Object.freeze({
      points: Object.freeze(
        draft.outerLoop.points.map((point) =>
          Object.freeze({
            x: point.x,
            z: point.z
          })
        )
      )
    }),
    regionId: draft.regionId,
    regionKind: draft.regionKind,
    surfaceId: draft.surfaceId
  });
}

export function createSemanticEdgeSnapshotFromDraft(
  draft: MapEditorEdgeDraftSnapshot
): MetaverseMapBundleSemanticEdgeSnapshot {
  return Object.freeze({
    edgeId: draft.edgeId,
    edgeKind: draft.edgeKind,
    heightMeters: draft.heightMeters,
    label: draft.label,
    path: Object.freeze(
      draft.path.map((point) =>
        Object.freeze({
          x: point.x,
          z: point.z
        })
      )
    ),
    surfaceId: draft.surfaceId,
    thicknessMeters: draft.thicknessMeters
  });
}

export function createSemanticConnectorSnapshotFromDraft(
  draft: MapEditorConnectorDraftSnapshot
): MetaverseMapBundleSemanticConnectorSnapshot {
  return Object.freeze({
    center: freezeVector3(draft.center),
    connectorId: draft.connectorId,
    connectorKind: draft.connectorKind,
    fromSurfaceId: draft.fromSurfaceId,
    label: draft.label,
    rotationYRadians: draft.rotationYRadians,
    size: freezeVector3(draft.size),
    toSurfaceId: draft.toSurfaceId
  });
}

export function createSemanticStructureSnapshotFromDraft(
  draft: MapEditorStructuralDraftSnapshot
): MetaverseMapBundleSemanticStructureSnapshot {
  return Object.freeze({
    center: freezeVector3(draft.center),
    grid: Object.freeze({
      cellX: draft.grid.cellX,
      cellZ: draft.grid.cellZ,
      cellsX: draft.grid.cellsX,
      cellsZ: draft.grid.cellsZ,
      layer: draft.grid.layer
    }),
    label: draft.label,
    materialId: draft.materialId,
    materialReferenceId: draft.materialReferenceId,
    rotationYRadians: draft.rotationYRadians,
    size: freezeVector3(draft.size),
    structureId: draft.structureId,
    structureKind: draft.structureKind,
    traversalAffordance: draft.traversalAffordance
  });
}

export function createSemanticGameplayVolumeSnapshotFromDraft(
  draft: MapEditorGameplayVolumeDraftSnapshot
): MetaverseMapBundleSemanticGameplayVolumeSnapshot {
  return Object.freeze({
    center: freezeVector3(draft.center),
    label: draft.label,
    priority: draft.priority,
    rotationYRadians: draft.rotationYRadians,
    routePoints: Object.freeze(draft.routePoints.map(freezeVector3)),
    size: freezeVector3(draft.size),
    tags: Object.freeze([...draft.tags]),
    teamId: draft.teamId,
    volumeId: draft.volumeId,
    volumeKind: draft.volumeKind
  });
}

export function createSemanticLightSnapshotFromDraft(
  draft: MapEditorLightDraftSnapshot
): MetaverseMapBundleSemanticLightSnapshot {
  return Object.freeze({
    color: Object.freeze([
      draft.color[0],
      draft.color[1],
      draft.color[2]
    ] as const),
    intensity: draft.intensity,
    label: draft.label,
    lightId: draft.lightId,
    lightKind: draft.lightKind,
    position: freezeVector3(draft.position),
    rangeMeters: draft.rangeMeters,
    rotationYRadians: draft.rotationYRadians,
    target: draft.target === null ? null : freezeVector3(draft.target)
  });
}

export function createSemanticMaterialDefinitionSnapshotFromDraft(
  draft: MapEditorMaterialDefinitionDraftSnapshot
): MetaverseMapBundleSemanticMaterialDefinitionSnapshot {
  return freezeMaterialDefinitionDraft(draft);
}

export function createSemanticTerrainPatchSnapshotFromDraft(
  draft: MapEditorTerrainPatchDraftSnapshot
): MetaverseMapBundleSemanticTerrainPatchSnapshot {
  return Object.freeze({
    grid: Object.freeze({
      cellX: draft.grid.cellX,
      cellZ: draft.grid.cellZ,
      cellsX: draft.grid.cellsX,
      cellsZ: draft.grid.cellsZ,
      layer: draft.grid.layer
    }),
    heightSamples: Object.freeze([...draft.heightSamples]),
    label: draft.label,
    materialLayers: Object.freeze(
      draft.materialLayers.map((layer) =>
        Object.freeze({
          layerId: layer.layerId,
          materialId: layer.materialId,
          weightSamples: Object.freeze([...layer.weightSamples])
        })
      )
    ),
    origin: freezeVector3(draft.origin),
    rotationYRadians: draft.rotationYRadians,
    sampleCountX: draft.sampleCountX,
    sampleCountZ: draft.sampleCountZ,
    sampleSpacingMeters: draft.sampleSpacingMeters,
    terrainPatchId: draft.terrainPatchId,
    waterLevelMeters: draft.waterLevelMeters
  });
}
