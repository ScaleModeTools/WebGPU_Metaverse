export {
  animationClipManifest,
  metaverseHumanoidBaseAnimationPackSourcePath,
  mesh2motionHumanoidIdleAnimationClipId,
  mesh2motionHumanoidInteractAnimationClipId,
  mesh2motionHumanoidSeatedAnimationClipId,
  mesh2motionHumanoidWalkAnimationClipId,
} from "./config/animation-clip-manifest";
export {
  attachmentModelManifest,
  metaverseBattleRifleAttachmentAssetId,
  metaverseBreacherShotgunAttachmentAssetId,
  metaverseCompactSmgAttachmentAssetId,
  metaverseLongshotSniperAttachmentAssetId,
  metaverseRocketLauncherAttachmentAssetId,
  metaverseServicePistolAttachmentAssetId,
} from "./config/attachment-model-manifest";
export {
  characterModelManifest,
  metaverseHumanoidCharacterAssetId,
  mesh2motionHumanoidCharacterAssetId,
} from "./config/character-model-manifest";
export {
  environmentPropManifest,
  metaverseHubDockEnvironmentAssetId,
  metaverseHubDiveBoatEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId,
  metaversePlaygroundRangeBarrierEnvironmentAssetId,
  metaversePlaygroundRangeFloorEnvironmentAssetId,
} from "./config/environment-prop-manifest";
export { reticleManifest } from "./config/reticle-manifest";
export {
  metaverseBattleRifleWeaponAssetId,
  metaverseBreacherShotgunWeaponAssetId,
  metaverseCompactSmgWeaponAssetId,
  metaverseLongshotSniperWeaponAssetId,
  metaverseRocketLauncherWeaponAssetId,
  metaverseServicePistolV2WeaponAssetId,
  weaponArchetypeManifest,
} from "./config/weapon-archetype-manifest";
export { weaponModuleManifest } from "./config/weapon-module-manifest";
export { weaponProgressionManifest } from "./config/weapon-progression-manifest";
export {
  readDefaultWeaponModuleIds,
  resolveWeaponLoadout,
} from "./runtime/resolve-weapon-loadout";
export {
  createAnimationClipId,
  createAttachmentAssetId,
  createCharacterAssetId,
  createEnvironmentAssetId,
} from "./types/asset-id";
export { lodTierIds } from "./types/asset-lod";
export {
  humanoidV2BoneAliasByName,
  humanoidV2BoneGroups,
  humanoidV2BoneNames,
  humanoidV2BoneParentByName,
  humanoidV2FingerChainsBySide,
  humanoidV2NonWeightedDriverNames,
  humanoidV2SocketLocalTransformsById,
  humanoidV2SocketParentById,
  humanoidV2WeightedJointNames,
  skeletonBoneNamesById,
  skeletonBoneParentByNameById,
  skeletonIds,
  skeletonSocketLocalTransformsById,
  skeletonSocketParentById,
  socketIds,
} from "./types/asset-socket";
export {
  animationClipLoopModes,
  animationVocabularyIds,
  canonicalAnimationClipNamesByVocabulary,
  defineAnimationClipManifest,
} from "./types/animation-clip-manifest";
export {
  attachmentCategoryIds,
  defineAttachmentAssetManifest,
} from "./types/attachment-asset-manifest";
export {
  heldObjectAdsPolicyIds,
  heldObjectCoreSocketRolesByFamily,
  heldObjectFamilyIds,
  heldObjectHandIds,
  heldObjectOffhandPolicyIds,
  heldObjectPoseProfileIds,
  heldObjectPrimaryHandIds,
  heldObjectSocketOrientationPolicyIds,
  heldObjectSocketRoleIds,
} from "./types/held-object-authoring-manifest";
export {
  characterPresentationModeIds,
  defineCharacterAssetManifest,
} from "./types/character-asset-manifest";
export {
  defineEnvironmentAssetManifest,
  environmentAssetPlacements,
  environmentEditorCatalogVisibilityIds,
  environmentProceduralMaterialPresetIds,
} from "./types/environment-asset-manifest";
export { defineReticleManifest } from "./types/asset-manifest";
export {
  buildAttachmentAssetFromWeaponArchetype,
  defineWeaponArchetypeManifest,
  defineWeaponModuleManifest,
  weaponFamilyIds,
  weaponModuleSlotIds,
  weaponPoseProfileIds,
} from "./types/weapon-builder-manifest";
export type {
  AnimationClipId,
  AttachmentAssetId,
  CharacterAssetId,
  EnvironmentAssetId,
} from "./types/asset-id";
export type {
  AssetLodDescriptor,
  AssetLodGroup,
  LodTierId,
} from "./types/asset-lod";
export type {
  HumanoidV2BoneGroupName,
  HumanoidV2BoneName,
  SkeletonBoneName,
  SkeletonBoneParentByName,
  SkeletonId,
  SkeletonSocketLocalTransform,
  SkeletonSocketLocalTransformsById,
  SkeletonSocketParentById,
  SocketId,
} from "./types/asset-socket";
export type {
  HumanoidV2BoneCategory,
  HumanoidV2BoneDescriptor,
  HumanoidV2BoneSide,
} from "./types/humanoid-v2-rig-descriptors";
export type {
  AnimationClipDescriptor,
  AnimationClipLoopMode,
  AnimationClipManifest,
  AnimationVocabularyId,
} from "./types/animation-clip-manifest";
export type {
  AttachmentAssetDescriptor,
  AttachmentAssetManifest,
  AttachmentCategoryId,
  AttachmentMountSocketDescriptor,
  AttachmentMountTargetSocketName,
  AttachmentMountedHolsterDescriptor,
  AttachmentVector3Descriptor,
} from "./types/attachment-asset-manifest";
export type {
  HeldObjectAdsPolicyId,
  HeldObjectFamilyId,
  HeldObjectFingerPoseHintDescriptor,
  HeldObjectHandId,
  HeldObjectHoldProfileDescriptor,
  HeldObjectOffhandPolicyId,
  HeldObjectPoseProfileId,
  HeldObjectPrimaryHandId,
  HeldObjectSocketDescriptor,
  HeldObjectSocketOrientationPolicyId,
  HeldObjectSocketRoleId,
} from "./types/held-object-authoring-manifest";
export type {
  CharacterAssetDescriptor,
  CharacterAssetManifest,
  CharacterPresentationModeId,
} from "./types/character-asset-manifest";
export type {
  Avatar124Animation,
  Avatar124AnimationId,
  AvatarAnimationCategory,
  AvatarAnimationPack,
  AvatarAnimationPlaybackKind,
} from "./config/metaverse-humanoid-base-animation-catalog";
export type {
  EnvironmentAssetDescriptor,
  EnvironmentAssetManifest,
  EnvironmentBoxColliderDescriptor,
  EnvironmentColliderVector3,
  EnvironmentEditorCatalogVisibilityId,
  EnvironmentProceduralBoxLodDescriptor,
  EnvironmentProceduralMaterialPresetId,
  EnvironmentRenderLodDescriptor,
  EnvironmentRenderLodGroup,
  EnvironmentSeatDescriptor,
  EnvironmentVector3Descriptor,
  EnvironmentAssetPlacement,
} from "./types/environment-asset-manifest";
export {
  defaultMountedVehicleCameraPolicyId,
  defaultMountedVehicleControlRoutingPolicyId,
  defaultMountedVehicleLookLimitPolicyId,
  defaultMountedVehicleOccupancyAnimationId,
  defaultMountedVehicleSeatId,
  defaultMountedVehicleSeatRole,
  mountedVehicleCameraPolicyIds,
  mountedVehicleControlRoutingPolicyIds,
  mountedVehicleLookLimitPolicyIds,
  mountedVehicleOccupancyAnimationIds,
  mountedVehicleSeatRoleIds,
} from "./types/environment-seat";
export type {
  MountedVehicleCameraPolicyId,
  MountedVehicleControlRoutingPolicyId,
  MountedVehicleLookLimitPolicyId,
  MountedVehicleOccupancyAnimationId,
  MountedVehicleSeatRoleId,
} from "./types/environment-seat";
export type {
  ReticleDescriptor,
  ReticleManifest,
} from "./types/asset-manifest";
export type {
  NumericStatModifierDescriptor,
  ResolvedWeaponLoadoutDescriptor,
  WeaponAccuracyStatsDescriptor,
  WeaponAimProfileDescriptor,
  WeaponArchetypeDescriptor,
  WeaponArchetypeManifest,
  WeaponBallisticsKind,
  WeaponBallisticsStatsDescriptor,
  WeaponDamageStatsDescriptor,
  WeaponFamilyId,
  WeaponFireControlStatsDescriptor,
  WeaponFireMode,
  WeaponHandlingStatsDescriptor,
  WeaponMagazineStatsDescriptor,
  WeaponModuleAimOverridesDescriptor,
  WeaponModuleAssetDescriptor,
  WeaponModuleManifest,
  WeaponModuleSlotId,
  WeaponModuleSocketDescriptor,
  WeaponPoseProfileId,
  WeaponRangeStatsDescriptor,
  WeaponReloadStyle,
  WeaponStatBlockDescriptor,
  WeaponStatModifierDescriptor,
  WeaponUnlockDescriptor,
  WeaponZoomLevelDescriptor,
} from "./types/weapon-builder-manifest";
