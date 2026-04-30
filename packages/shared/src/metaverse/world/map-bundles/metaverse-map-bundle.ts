import type {
  ExperienceId
} from "../../experience-catalog.js";
import type {
  MetaverseWorldEnvironmentDynamicBodyAuthoring,
  MetaverseWorldEnvironmentTraversalAffordanceId,
  MetaverseWorldMountedEntryAuthoring,
  MetaverseWorldMountedSeatAuthoring,
  MetaverseWorldEnvironmentColliderAuthoring,
  MetaverseWorldSurfaceScaleSnapshot,
  MetaverseWorldSurfaceColliderAuthoring,
  MetaverseWorldSurfacePlacementId,
  MetaverseWorldSurfaceVector3Snapshot,
  MetaverseWorldWaterRegionAuthoring
} from "../../metaverse-world-surface-query.js";
import type { MetaversePlayerTeamId } from "../../metaverse-player-team.js";
import { metaversePlayerTeamIds } from "../../metaverse-player-team.js";
import type { MetaverseMatchModeId } from "../../metaverse-match-mode.js";

export interface MetaverseMapBundlePlacementSnapshot {
  readonly collisionEnabled: boolean;
  readonly isVisible: boolean;
  readonly materialReferenceId: string | null;
  readonly notes: string;
  readonly placementId: string;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly rotationYRadians: number;
  readonly scale: MetaverseWorldSurfaceScaleSnapshot;
}

export interface MetaverseMapBundleEnvironmentAssetSnapshot {
  readonly assetId: string;
  readonly collisionPath: string | null;
  readonly collider: MetaverseWorldEnvironmentColliderAuthoring | null;
  readonly dynamicBody: MetaverseWorldEnvironmentDynamicBodyAuthoring | null;
  readonly entries: readonly MetaverseWorldMountedEntryAuthoring[] | null;
  readonly placementMode: MetaverseWorldSurfacePlacementId;
  readonly placements: readonly MetaverseMapBundlePlacementSnapshot[];
  readonly seats: readonly MetaverseWorldMountedSeatAuthoring[] | null;
  readonly surfaceColliders: readonly MetaverseWorldSurfaceColliderAuthoring[];
  readonly traversalAffordance: MetaverseWorldEnvironmentTraversalAffordanceId;
}

export const metaverseMapPlayerSpawnTeamIds = [
  "neutral",
  ...metaversePlayerTeamIds
] as const;

export type MetaverseMapPlayerSpawnTeamId =
  (typeof metaverseMapPlayerSpawnTeamIds)[number];
export type MetaverseMapPlayerTeamId = MetaversePlayerTeamId;

export interface MetaverseMapBundlePlayerSpawnSelectionSnapshot {
  readonly enemyAvoidanceRadiusMeters: number;
  readonly homeTeamBiasMeters: number;
}

export const defaultMetaverseMapBundlePlayerSpawnSelection = Object.freeze({
  enemyAvoidanceRadiusMeters: 18,
  homeTeamBiasMeters: 12
} satisfies MetaverseMapBundlePlayerSpawnSelectionSnapshot);

export interface MetaverseMapBundleSpawnNodeSnapshot {
  readonly label: string;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly spawnId: string;
  readonly teamId: MetaverseMapPlayerSpawnTeamId;
  readonly yawRadians: number;
}

export interface MetaverseMapBundleResourceSpawnSnapshot {
  readonly ammoGrantRounds: number;
  readonly assetId: string | null;
  readonly label: string;
  readonly modeTags: readonly string[];
  readonly pickupRadiusMeters: number;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly resourceKind: "weapon-pickup";
  readonly respawnCooldownMs: number;
  readonly spawnId: string;
  readonly weaponId: string;
  readonly yawRadians: number;
}

export interface MetaverseMapBundlePresentationProfileIds {
  readonly cameraProfileId: string | null;
  readonly characterPresentationProfileId: string | null;
  readonly environmentPresentationProfileId: string | null;
  readonly hudProfileId: string | null;
}

export interface MetaverseMapBundleEnvironmentPresentationSnapshot {
  readonly environment: {
    readonly cloudCoverage: number;
    readonly cloudDensity: number;
    readonly cloudElevation: number;
    readonly cloudScale: number;
    readonly cloudSpeed: number;
    readonly domeRadius: number;
    readonly fogColor: readonly [number, number, number];
    readonly fogDensity: number;
    readonly fogEnabled: boolean;
    readonly groundColor: readonly [number, number, number];
    readonly groundFalloff: number;
    readonly horizonColor: readonly [number, number, number];
    readonly horizonSoftness: number;
    readonly mieCoefficient: number;
    readonly mieDirectionalG: number;
    readonly rayleigh: number;
    readonly skyExposure: number;
    readonly skyExposureCurve: number;
    readonly sunAzimuthDegrees: number;
    readonly sunColor: readonly [number, number, number];
    readonly sunElevationDegrees: number;
    readonly toneMappingExposure: number;
    readonly turbidity: number;
  };
  readonly ocean: {
    readonly emissiveColor: readonly [number, number, number];
    readonly farColor: readonly [number, number, number];
    readonly height: number;
    readonly nearColor: readonly [number, number, number];
    readonly planeDepth: number;
    readonly planeWidth: number;
    readonly roughness: number;
    readonly segmentCount: number;
    readonly waveAmplitude: number;
    readonly waveFrequencies: {
      readonly primary: number;
      readonly ripple: number;
      readonly secondary: number;
    };
    readonly waveSpeeds: {
      readonly primary: number;
      readonly ripple: number;
      readonly secondary: number;
    };
  };
}

export interface MetaverseMapBundleSceneObjectLaunchTargetCapabilitySnapshot {
  readonly beamColor: readonly [number, number, number];
  readonly experienceId: ExperienceId;
  readonly highlightRadius: number;
  readonly interactionRadius: number;
  readonly kind: "launch-target";
  readonly ringColor: readonly [number, number, number];
}

export type MetaverseMapBundleSceneObjectCapabilitySnapshot =
  | MetaverseMapBundleSceneObjectLaunchTargetCapabilitySnapshot;

export interface MetaverseMapBundleSceneObjectSnapshot {
  readonly assetId: string | null;
  readonly capabilities: readonly MetaverseMapBundleSceneObjectCapabilitySnapshot[];
  readonly label: string;
  readonly objectId: string;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly rotationYRadians: number;
  readonly scale: number;
}

export interface MetaverseMapBundleLaunchVariationSnapshot {
  readonly description: string;
  readonly experienceId: ExperienceId | null;
  readonly gameplayVariationId: string | null;
  readonly label: string;
  readonly matchMode: MetaverseMatchModeId | null;
  readonly variationId: string;
  readonly vehicleLayoutId: string | null;
  readonly weaponLayoutId: string | null;
}

export interface MetaverseMapBundleSemanticPlanarPointSnapshot {
  readonly x: number;
  readonly z: number;
}

export interface MetaverseMapBundleSemanticPlanarLoopSnapshot {
  readonly points: readonly MetaverseMapBundleSemanticPlanarPointSnapshot[];
}

export interface MetaverseMapBundleSemanticTerrainMaterialLayerSnapshot {
  readonly layerId: string;
  readonly materialId: MetaverseMapBundleSemanticMaterialId;
  readonly weightSamples: readonly number[];
}

export interface MetaverseMapBundleSemanticTerrainPatchSnapshot {
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

export interface MetaverseMapBundleSemanticSurfaceSnapshot {
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

export interface MetaverseMapBundleSemanticRegionSnapshot {
  readonly holes: readonly MetaverseMapBundleSemanticPlanarLoopSnapshot[];
  readonly label: string;
  readonly materialReferenceId: string | null;
  readonly outerLoop: MetaverseMapBundleSemanticPlanarLoopSnapshot;
  readonly regionId: string;
  readonly regionKind: "arena" | "floor" | "path" | "roof";
  readonly surfaceId: string;
}

export interface MetaverseMapBundleSemanticEdgeSnapshot {
  readonly edgeId: string;
  readonly edgeKind:
    | "curb"
    | "fence"
    | "rail"
    | "retaining-wall"
    | "wall";
  readonly heightMeters: number;
  readonly label: string;
  readonly materialReferenceId: string | null;
  readonly path: readonly MetaverseMapBundleSemanticPlanarPointSnapshot[];
  readonly surfaceId: string;
  readonly thicknessMeters: number;
}

export interface MetaverseMapBundleSemanticConnectorSnapshot {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly connectorId: string;
  readonly connectorKind: "door" | "gate" | "ramp";
  readonly fromSurfaceId: string;
  readonly label: string;
  readonly rotationYRadians: number;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly toSurfaceId: string;
}

export interface MetaverseMapBundleSemanticModuleSnapshot {
  readonly assetId: string;
  readonly collisionEnabled: boolean;
  readonly collisionPath: string | null;
  readonly collider: MetaverseWorldEnvironmentColliderAuthoring | null;
  readonly dynamicBody: MetaverseWorldEnvironmentDynamicBodyAuthoring | null;
  readonly entries: readonly MetaverseWorldMountedEntryAuthoring[] | null;
  readonly isVisible: boolean;
  readonly label: string;
  readonly materialReferenceId: string | null;
  readonly moduleId: string;
  readonly notes: string;
  readonly placementMode: MetaverseWorldSurfacePlacementId;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly rotationYRadians: number;
  readonly scale: MetaverseWorldSurfaceScaleSnapshot;
  readonly seats: readonly MetaverseWorldMountedSeatAuthoring[] | null;
  readonly surfaceColliders: readonly MetaverseWorldSurfaceColliderAuthoring[];
  readonly traversalAffordance: MetaverseWorldEnvironmentTraversalAffordanceId;
}

export type MetaverseMapBundleSemanticMaterialId =
  | "alien-rock"
  | "concrete"
  | "glass"
  | "metal"
  | "terrain-ash"
  | "terrain-basalt"
  | "terrain-cliff"
  | "terrain-dirt"
  | "terrain-gravel"
  | "terrain-grass"
  | "terrain-moss"
  | "terrain-rock"
  | "terrain-sand"
  | "terrain-snow"
  | "team-blue"
  | "team-red"
  | "warning";

export interface MetaverseMapBundleSemanticMaterialDefinitionSnapshot {
  readonly accentColorHex: string | null;
  readonly baseColorHex: string;
  readonly baseMaterialId: MetaverseMapBundleSemanticMaterialId;
  readonly label: string;
  readonly materialId: string;
  readonly metalness: number;
  readonly opacity: number;
  readonly roughness: number;
  readonly textureBrightness: number;
  readonly textureContrast: number;
  readonly textureImageDataUrl: string | null;
  readonly texturePatternStrength: number;
  readonly textureRepeat: number;
}

export type MetaverseMapBundleSemanticStructureKind =
  | "bridge"
  | "catwalk"
  | "cover"
  | "floor"
  | "pad"
  | "path"
  | "ramp"
  | "tower"
  | "vehicle-bay"
  | "wall";

export interface MetaverseMapBundleSemanticGridRectSnapshot {
  readonly cellX: number;
  readonly cellZ: number;
  readonly cellsX: number;
  readonly cellsZ: number;
  readonly layer: number;
}

export interface MetaverseMapBundleSemanticStructureSnapshot {
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

export type MetaverseMapBundleSemanticGameplayVolumeKind =
  | "combat-lane"
  | "cover-volume"
  | "kill-floor"
  | "spawn-room"
  | "team-zone"
  | "vehicle-route";

export interface MetaverseMapBundleSemanticGameplayVolumeSnapshot {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly label: string;
  readonly priority: number;
  readonly rotationYRadians: number;
  readonly routePoints: readonly MetaverseWorldSurfaceVector3Snapshot[];
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly tags: readonly string[];
  readonly teamId: MetaverseMapPlayerSpawnTeamId | null;
  readonly volumeId: string;
  readonly volumeKind: MetaverseMapBundleSemanticGameplayVolumeKind;
}

export type MetaverseMapBundleSemanticLightKind =
  | "ambient"
  | "area"
  | "point"
  | "spot"
  | "sun";

export interface MetaverseMapBundleSemanticLightSnapshot {
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  readonly label: string;
  readonly lightId: string;
  readonly lightKind: MetaverseMapBundleSemanticLightKind;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly rangeMeters: number | null;
  readonly rotationYRadians: number;
  readonly target: MetaverseWorldSurfaceVector3Snapshot | null;
}

export interface MetaverseMapBundleSemanticCompatibilityAssetIdsSnapshot {
  readonly connectorAssetId: string | null;
  readonly floorAssetId: string | null;
  readonly wallAssetId: string | null;
}

export interface MetaverseMapBundleSemanticWorldSnapshot {
  readonly compatibilityAssetIds: MetaverseMapBundleSemanticCompatibilityAssetIdsSnapshot;
  readonly connectors: readonly MetaverseMapBundleSemanticConnectorSnapshot[];
  readonly edges: readonly MetaverseMapBundleSemanticEdgeSnapshot[];
  readonly gameplayVolumes: readonly MetaverseMapBundleSemanticGameplayVolumeSnapshot[];
  readonly lights: readonly MetaverseMapBundleSemanticLightSnapshot[];
  readonly materialDefinitions:
    readonly MetaverseMapBundleSemanticMaterialDefinitionSnapshot[];
  readonly modules: readonly MetaverseMapBundleSemanticModuleSnapshot[];
  readonly regions: readonly MetaverseMapBundleSemanticRegionSnapshot[];
  readonly surfaces: readonly MetaverseMapBundleSemanticSurfaceSnapshot[];
  readonly structures: readonly MetaverseMapBundleSemanticStructureSnapshot[];
  readonly terrainPatches: readonly MetaverseMapBundleSemanticTerrainPatchSnapshot[];
}

export interface MetaverseMapBundleCompiledWorldChunkBoundsSnapshot {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
}

export interface MetaverseMapBundleCompiledCollisionBoxSnapshot {
  readonly center: MetaverseWorldSurfaceVector3Snapshot;
  readonly ownerId: string;
  readonly ownerKind:
    | "connector"
    | "edge"
    | "structure"
    | "module"
    | "region";
  readonly rotationYRadians: number;
  readonly size: MetaverseWorldSurfaceVector3Snapshot;
  readonly traversalAffordance: "blocker" | "support";
}

export interface MetaverseMapBundleCompiledCollisionTriMeshSnapshot {
  readonly indices: readonly number[];
  readonly ownerId: string;
  readonly ownerKind: "region" | "terrain-patch";
  readonly rotationYRadians: number;
  readonly translation: MetaverseWorldSurfaceVector3Snapshot;
  readonly traversalAffordance: "blocker" | "support";
  readonly vertices: readonly number[];
}

export interface MetaverseMapBundleCompiledCollisionHeightfieldSnapshot {
  readonly heightSamples: readonly number[];
  readonly ownerId: string;
  readonly ownerKind: "terrain-patch";
  readonly rotationYRadians: number;
  readonly sampleCountX: number;
  readonly sampleCountZ: number;
  readonly sampleSpacingMeters: number;
  readonly translation: MetaverseWorldSurfaceVector3Snapshot;
  readonly traversalAffordance: "support";
}

export interface MetaverseMapBundleCompiledWorldChunkSnapshot {
  readonly bounds: MetaverseMapBundleCompiledWorldChunkBoundsSnapshot;
  readonly chunkId: string;
  readonly collision: {
    readonly boxes: readonly MetaverseMapBundleCompiledCollisionBoxSnapshot[];
    readonly heightfields: readonly MetaverseMapBundleCompiledCollisionHeightfieldSnapshot[];
    readonly triMeshes: readonly MetaverseMapBundleCompiledCollisionTriMeshSnapshot[];
  };
  readonly navigation: {
    readonly connectorIds: readonly string[];
    readonly gameplayVolumeIds: readonly string[];
    readonly regionIds: readonly string[];
    readonly surfaceIds: readonly string[];
  };
  readonly render: {
    readonly edgeIds: readonly string[];
    readonly instancedModuleAssetIds: readonly string[];
    readonly lightIds: readonly string[];
    readonly regionIds: readonly string[];
    readonly structureIds: readonly string[];
    readonly terrainPatchIds: readonly string[];
    readonly transparentEntityIds: readonly string[];
  };
}

export interface MetaverseMapBundleCompiledWorldSnapshot {
  readonly chunkSizeMeters: number;
  readonly chunks: readonly MetaverseMapBundleCompiledWorldChunkSnapshot[];
  readonly compatibilityEnvironmentAssets:
    readonly MetaverseMapBundleEnvironmentAssetSnapshot[];
}

export interface MetaverseMapBundleSnapshot {
  readonly compiledWorld: MetaverseMapBundleCompiledWorldSnapshot;
  readonly description: string;
  readonly environmentAssets: readonly MetaverseMapBundleEnvironmentAssetSnapshot[];
  readonly environmentPresentation?:
    MetaverseMapBundleEnvironmentPresentationSnapshot | null;
  readonly gameplayProfileId: string;
  readonly launchVariations: readonly MetaverseMapBundleLaunchVariationSnapshot[];
  readonly mapId: string;
  readonly label: string;
  readonly playerSpawnNodes: readonly MetaverseMapBundleSpawnNodeSnapshot[];
  readonly playerSpawnSelection: MetaverseMapBundlePlayerSpawnSelectionSnapshot;
  readonly presentationProfileIds: MetaverseMapBundlePresentationProfileIds;
  readonly resourceSpawns: readonly MetaverseMapBundleResourceSpawnSnapshot[];
  readonly sceneObjects: readonly MetaverseMapBundleSceneObjectSnapshot[];
  readonly semanticWorld: MetaverseMapBundleSemanticWorldSnapshot;
  readonly waterRegions: readonly MetaverseWorldWaterRegionAuthoring[];
}
