import type {
  ExperienceId
} from "../../experience-catalog.js";
import type {
  GameplaySessionMode
} from "../../../experiences/duck-hunt/duck-hunt-room-contract.js";
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

export interface MetaverseMapBundleSpawnNodeSnapshot {
  readonly label: string;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly spawnId: string;
  readonly yawRadians: number;
}

export interface MetaverseMapBundleResourceSpawnSnapshot {
  readonly assetId: string | null;
  readonly label: string;
  readonly modeTags: readonly string[];
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly resourceKind: string;
  readonly respawnCooldownMs: number | null;
  readonly spawnId: string;
  readonly yawRadians: number;
}

export interface MetaverseMapBundlePresentationProfileIds {
  readonly cameraProfileId: string | null;
  readonly characterPresentationProfileId: string | null;
  readonly environmentPresentationProfileId: string | null;
  readonly hudProfileId: string | null;
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
  readonly sessionMode: GameplaySessionMode | null;
  readonly variationId: string;
  readonly vehicleLayoutId: string | null;
  readonly weaponLayoutId: string | null;
}

export interface MetaverseMapBundleSnapshot {
  readonly description: string;
  readonly environmentAssets: readonly MetaverseMapBundleEnvironmentAssetSnapshot[];
  readonly gameplayProfileId: string;
  readonly launchVariations: readonly MetaverseMapBundleLaunchVariationSnapshot[];
  readonly mapId: string;
  readonly label: string;
  readonly playerSpawnNodes: readonly MetaverseMapBundleSpawnNodeSnapshot[];
  readonly presentationProfileIds: MetaverseMapBundlePresentationProfileIds;
  readonly resourceSpawns: readonly MetaverseMapBundleResourceSpawnSnapshot[];
  readonly sceneObjects: readonly MetaverseMapBundleSceneObjectSnapshot[];
  readonly waterRegions: readonly MetaverseWorldWaterRegionAuthoring[];
}
