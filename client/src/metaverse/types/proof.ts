import type {
  MountedVehicleCameraPolicyId,
  MountedVehicleControlRoutingPolicyId,
  MountedVehicleLookLimitPolicyId,
  MountedVehicleOccupancyAnimationId,
  MountedVehicleSeatRoleId,
} from "../vehicles";
import type {
  MetaverseCharacterAnimationVocabularyId,
  MetaverseVector3Snapshot,
} from "./presentation";
import type {
  HeldObjectHoldProfileDescriptor,
  HeldObjectSocketRoleId,
} from "@/assets/types/held-object-authoring-manifest";

export interface MetaverseCharacterAnimationClipProofConfig {
  readonly clipName: string;
  readonly loopMode?: MetaverseCharacterAnimationClipLoopMode;
  readonly sourcePath: string;
  readonly vocabulary: MetaverseCharacterAnimationVocabularyId;
}

export type MetaverseCharacterAnimationClipLoopMode = "once" | "repeat";

export const metaverseCharacterSkeletonIds = ["humanoid_v2"] as const;

export type MetaverseCharacterSkeletonId =
  (typeof metaverseCharacterSkeletonIds)[number];

export const metaverseCanonicalSocketNames = [
  "hand_r_socket",
  "hand_l_socket",
  "head_socket",
  "hip_socket",
  "seat_socket",
] as const;

export type MetaverseCanonicalSocketName =
  (typeof metaverseCanonicalSocketNames)[number];

export interface MetaverseCharacterProofConfig {
  readonly animationClips: readonly MetaverseCharacterAnimationClipProofConfig[];
  readonly characterId: string;
  readonly label: string;
  readonly modelPath: string;
  readonly skeletonId: MetaverseCharacterSkeletonId;
  readonly socketNames: readonly MetaverseCanonicalSocketName[];
}

export const metaverseSyntheticSocketNames = [
  "back_socket",
  "grip_l_socket",
  "grip_r_socket",
  "palm_l_socket",
  "palm_r_socket",
  "support_l_socket",
  "support_r_socket",
] as const;

export type MetaverseSyntheticSocketName =
  (typeof metaverseSyntheticSocketNames)[number];

export type MetaverseAttachmentSocketName =
  | MetaverseCanonicalSocketName
  | MetaverseSyntheticSocketName;

export interface MetaverseAttachmentMountProofConfig {
  readonly adsCameraTargetOffset?: MetaverseAttachmentAimBasisOffsetSnapshot | null;
  readonly attachmentSocketRole: HeldObjectSocketRoleId;
  readonly socketName: MetaverseAttachmentSocketName;
}

export interface MetaverseAttachmentAimBasisOffsetSnapshot {
  readonly across: number;
  readonly forward: number;
  readonly up: number;
}

export interface MetaverseAttachmentProofConfig {
  readonly attachmentId: string;
  readonly heldMount: MetaverseAttachmentMountProofConfig;
  readonly holdProfile: HeldObjectHoldProfileDescriptor;
  readonly label: string;
  readonly modelPath: string;
  readonly modules: readonly MetaverseAttachmentModuleProofConfig[];
  readonly mountedHolsterMount: MetaverseAttachmentMountProofConfig | null;
}

export interface MetaverseAttachmentModuleProofConfig {
  readonly label: string;
  readonly modelPath: string;
  readonly moduleId: string;
  readonly socketRole: HeldObjectSocketRoleId;
}

export interface MetaverseEnvironmentColliderProofConfig {
  readonly center: MetaverseVector3Snapshot;
  readonly shape: "box";
  readonly size: MetaverseVector3Snapshot;
}

export interface MetaverseEnvironmentDynamicBodyProofConfig {
  readonly additionalMass: number;
  readonly angularDamping: number;
  readonly gravityScale: number;
  readonly kind: "dynamic-rigid-body";
  readonly linearDamping: number;
  readonly lockRotations: boolean;
}

export interface MetaverseEnvironmentPhysicsColliderProofConfig extends MetaverseEnvironmentColliderProofConfig {
  readonly traversalAffordance: "blocker" | "support";
}

export interface MetaverseEnvironmentSeatProofConfig {
  readonly cameraPolicyId: MountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MountedVehicleControlRoutingPolicyId;
  readonly directEntryEnabled: boolean;
  readonly dismountOffset: MetaverseVector3Snapshot;
  readonly label: string;
  readonly lookLimitPolicyId: MountedVehicleLookLimitPolicyId;
  readonly occupancyAnimationId: MountedVehicleOccupancyAnimationId;
  readonly seatId: string;
  readonly seatNodeName: string;
  readonly seatRole: MountedVehicleSeatRoleId;
}

export interface MetaverseEnvironmentEntryProofConfig {
  readonly cameraPolicyId: MountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MountedVehicleControlRoutingPolicyId;
  readonly dismountOffset: MetaverseVector3Snapshot;
  readonly entryId: string;
  readonly entryNodeName: string;
  readonly label: string;
  readonly lookLimitPolicyId: MountedVehicleLookLimitPolicyId;
  readonly occupancyAnimationId: MountedVehicleOccupancyAnimationId;
  readonly occupantRole: MountedVehicleSeatRoleId;
}

export interface MetaverseEnvironmentOrientationProofConfig {
  readonly forwardModelYawRadians: number;
}

import type {
  MetaverseMapBundleSemanticGameplayVolumeKind,
  MetaverseMapBundleSemanticLightKind,
  MetaverseMapBundleSemanticMaterialDefinitionSnapshot,
  MetaverseMapBundleSemanticMaterialId,
  MetaverseMapBundleSemanticStructureKind,
  MetaverseWorldPlacedSurfaceColliderSnapshot,
  MetaverseWorldSurfaceScaleSnapshot,
} from "@webgpu-metaverse/shared/metaverse/world";

export interface MetaverseEnvironmentPlacementProofConfig {
  readonly materialReferenceId?: string | null;
  readonly position: MetaverseVector3Snapshot;
  readonly rotationYRadians: number;
  readonly scale: MetaverseWorldSurfaceScaleSnapshot;
}

export interface MetaverseEnvironmentProceduralStructureProofConfig {
  readonly center: MetaverseVector3Snapshot;
  readonly materialId: MetaverseMapBundleSemanticMaterialId;
  readonly materialReferenceId: string | null;
  readonly rotationYRadians: number;
  readonly size: MetaverseVector3Snapshot;
  readonly structureId: string;
  readonly structureKind: MetaverseMapBundleSemanticStructureKind;
  readonly traversalAffordance: "blocker" | "support";
}

export interface MetaverseEnvironmentTerrainMaterialLayerProofConfig {
  readonly layerId: string;
  readonly materialId: MetaverseMapBundleSemanticMaterialId;
  readonly weightSamples: readonly number[];
}

export interface MetaverseEnvironmentTerrainPatchProofConfig {
  readonly heightSamples: readonly number[];
  readonly materialLayers: readonly MetaverseEnvironmentTerrainMaterialLayerProofConfig[];
  readonly origin: MetaverseVector3Snapshot;
  readonly rotationYRadians: number;
  readonly sampleCountX: number;
  readonly sampleCountZ: number;
  readonly sampleSpacingMeters: number;
  readonly terrainPatchId: string;
  readonly waterLevelMeters: number | null;
}

export interface MetaverseEnvironmentSurfaceMeshProofConfig {
  readonly indices: readonly number[];
  readonly materialId: MetaverseMapBundleSemanticMaterialId;
  readonly materialReferenceId: string | null;
  readonly regionId: string;
  readonly regionKind: "floor" | "path" | "roof";
  readonly rotationYRadians: number;
  readonly translation: MetaverseVector3Snapshot;
  readonly vertices: readonly number[];
}

export interface MetaverseEnvironmentGameplayVolumeProofConfig {
  readonly center: MetaverseVector3Snapshot;
  readonly size: MetaverseVector3Snapshot;
  readonly teamId: "blue" | "neutral" | "red" | null;
  readonly volumeId: string;
  readonly volumeKind: MetaverseMapBundleSemanticGameplayVolumeKind;
}

export interface MetaverseEnvironmentLightProofConfig {
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  readonly lightId: string;
  readonly lightKind: MetaverseMapBundleSemanticLightKind;
  readonly position: MetaverseVector3Snapshot;
  readonly rangeMeters: number | null;
  readonly rotationYRadians: number;
  readonly target: MetaverseVector3Snapshot | null;
}

export interface MetaverseEnvironmentModelLodProofConfig {
  readonly maxDistanceMeters: number | null;
  readonly modelPath: string;
  readonly tier: string;
}

export interface MetaverseEnvironmentProceduralBoxLodProofConfig {
  readonly kind: "procedural-box";
  readonly materialPreset: "training-range-accent" | "training-range-surface";
  readonly maxDistanceMeters: number | null;
  readonly size: MetaverseVector3Snapshot;
  readonly tier: string;
}

export type MetaverseEnvironmentLodProofConfig =
  | MetaverseEnvironmentModelLodProofConfig
  | MetaverseEnvironmentProceduralBoxLodProofConfig;

export type MetaverseEnvironmentTraversalAffordanceId =
  | "support"
  | "blocker"
  | "mount";

export interface MetaverseEnvironmentAssetProofConfig {
  readonly collisionPath: string | null;
  readonly collider: MetaverseEnvironmentColliderProofConfig | null;
  readonly dynamicBody: MetaverseEnvironmentDynamicBodyProofConfig | null;
  readonly entries: readonly MetaverseEnvironmentEntryProofConfig[] | null;
  readonly environmentAssetId: string;
  readonly label: string;
  readonly lods: readonly MetaverseEnvironmentLodProofConfig[];
  readonly orientation: MetaverseEnvironmentOrientationProofConfig | null;
  readonly placement: "dynamic" | "instanced" | "static";
  readonly placements: readonly MetaverseEnvironmentPlacementProofConfig[];
  readonly physicsColliders:
    | readonly MetaverseEnvironmentPhysicsColliderProofConfig[]
    | null;
  readonly seats: readonly MetaverseEnvironmentSeatProofConfig[] | null;
  readonly traversalAffordance: MetaverseEnvironmentTraversalAffordanceId;
}

export interface MetaverseEnvironmentProofConfig {
  readonly assets: readonly MetaverseEnvironmentAssetProofConfig[];
  readonly gameplayVolumes: readonly MetaverseEnvironmentGameplayVolumeProofConfig[];
  readonly lights: readonly MetaverseEnvironmentLightProofConfig[];
  readonly materialDefinitions: readonly MetaverseMapBundleSemanticMaterialDefinitionSnapshot[];
  readonly proceduralStructures: readonly MetaverseEnvironmentProceduralStructureProofConfig[];
  readonly surfaceColliders: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly surfaceMeshes: readonly MetaverseEnvironmentSurfaceMeshProofConfig[];
  readonly terrainPatches: readonly MetaverseEnvironmentTerrainPatchProofConfig[];
}
