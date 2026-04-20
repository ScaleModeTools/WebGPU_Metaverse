import type {
  MountedVehicleCameraPolicyId,
  MountedVehicleControlRoutingPolicyId,
  MountedVehicleLookLimitPolicyId,
  MountedVehicleOccupancyAnimationId,
  MountedVehicleSeatRoleId
} from "../vehicles";
import type {
  MetaverseCharacterAnimationVocabularyId,
  MetaverseVector3Snapshot
} from "./presentation";

export interface MetaverseCharacterAnimationClipProofConfig {
  readonly clipName: string;
  readonly sourcePath: string;
  readonly vocabulary: MetaverseCharacterAnimationVocabularyId;
}

export const metaverseHumanoidV2PistolPoseIds = [
  "down",
  "neutral",
  "up"
] as const;

export type MetaverseHumanoidV2PistolPoseId =
  (typeof metaverseHumanoidV2PistolPoseIds)[number];

export interface MetaverseHumanoidV2PistolPoseProofConfig {
  readonly clipNamesByPoseId: Readonly<
    Record<MetaverseHumanoidV2PistolPoseId, string>
  >;
  readonly sourcePath: string;
}

export const metaverseCharacterSkeletonIds = ["humanoid_v2"] as const;

export type MetaverseCharacterSkeletonId =
  (typeof metaverseCharacterSkeletonIds)[number];

export const metaverseCanonicalSocketNames = [
  "hand_r_socket",
  "hand_l_socket",
  "head_socket",
  "hip_socket",
  "seat_socket"
] as const;

export type MetaverseCanonicalSocketName =
  (typeof metaverseCanonicalSocketNames)[number];

export interface MetaverseCharacterProofConfig {
  readonly animationClips: readonly MetaverseCharacterAnimationClipProofConfig[];
  readonly characterId: string;
  readonly humanoidV2PistolPoseProofConfig?:
    | MetaverseHumanoidV2PistolPoseProofConfig
    | null;
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
  "palm_r_socket"
] as const;

export type MetaverseSyntheticSocketName =
  (typeof metaverseSyntheticSocketNames)[number];

export type MetaverseAttachmentSocketName =
  | MetaverseCanonicalSocketName
  | MetaverseSyntheticSocketName;

export interface MetaverseAttachmentMountProofConfig {
  readonly attachmentSocketNodeName: string;
  readonly forwardReferenceNodeName?: string | null;
  readonly offHandSupportPointId?: string | null;
  readonly socketName: MetaverseAttachmentSocketName;
}

export interface MetaverseAttachmentProofConfig {
  readonly attachmentId: string;
  readonly heldMount: MetaverseAttachmentMountProofConfig;
  readonly label: string;
  readonly modelPath: string;
  readonly modules: readonly MetaverseAttachmentModuleProofConfig[];
  readonly mountedHolsterMount: MetaverseAttachmentMountProofConfig | null;
  readonly supportPoints: readonly {
    readonly authoringNodeName: string | null;
    readonly localPosition: MetaverseVector3Snapshot;
    readonly supportPointId: string;
  }[] | null;
}

export interface MetaverseAttachmentModuleProofConfig {
  readonly label: string;
  readonly modelPath: string;
  readonly moduleId: string;
  readonly socketNodeName: string;
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

export interface MetaverseEnvironmentPhysicsColliderProofConfig
  extends MetaverseEnvironmentColliderProofConfig {
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

import type { MetaverseWorldSurfaceScaleSnapshot } from "@webgpu-metaverse/shared/metaverse/world";

export interface MetaverseEnvironmentPlacementProofConfig {
  readonly position: MetaverseVector3Snapshot;
  readonly rotationYRadians: number;
  readonly scale: MetaverseWorldSurfaceScaleSnapshot;
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
}
