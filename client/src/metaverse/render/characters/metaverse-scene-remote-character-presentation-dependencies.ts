import {
  cloneMetaverseAttachmentProofRuntime,
  syncAttachmentProofRuntimeMount,
  type MetaverseAttachmentProofRuntime,
  type MetaverseAttachmentRuntimeNodeResolvers
} from "../attachments/metaverse-scene-attachment-runtime";
import {
  cloneMetaverseCharacterProofRuntime,
  type MetaverseCharacterProofRuntimeNodeResolvers
} from "./metaverse-scene-character-proof-runtime";
import {
  createHeldWeaponPoseRuntime,
  restoreHumanoidV2HeldWeaponPoseRuntime,
  syncHumanoidV2HeldWeaponPose,
  type MetaverseHeldWeaponPoseRuntimeNodeResolvers
} from "./metaverse-scene-held-weapon-pose";
import {
  type MetaverseRemoteCharacterPresentationDependencies
} from "./metaverse-scene-remote-character-presentations";
import {
  clearHumanoidV2PistolPoseWeights,
  resolveHeldCharacterAnimationVocabulary,
  syncCharacterAnimation,
  syncCharacterPresentation,
  syncHumanoidV2PistolPoseWeights
} from "./metaverse-scene-character-animation";
import {
  resolveMetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";

import type {
  MetaverseMountableEnvironmentDynamicAssetRuntime
} from "../environment/metaverse-scene-environment-proof-state";
import type {
  MountedCharacterRuntime
} from "../mounts/metaverse-scene-mounts";
import {
  applyCharacterMountedAnchorTransform,
  syncMountedCharacterRuntimeFromSelectionReference
} from "../mounts/metaverse-scene-mounted-character-runtime";
import type {
  MetaverseSceneCharacterProofRuntime
} from "./metaverse-scene-interactive-presentation-state";

interface CreateMetaverseSceneRemoteCharacterPresentationDependencies {
  readonly attachmentRuntimeNodeResolvers: MetaverseAttachmentRuntimeNodeResolvers;
  readonly characterProofRuntimeNodeResolvers: MetaverseCharacterProofRuntimeNodeResolvers;
  readonly heldWeaponPoseRuntimeNodeResolvers: MetaverseHeldWeaponPoseRuntimeNodeResolvers;
  readonly resolveMountedEnvironmentRuntime: (
    environmentAssetId: string
  ) => MetaverseMountableEnvironmentDynamicAssetRuntime | null;
}

export function createMetaverseSceneRemoteCharacterPresentationDependencies({
  attachmentRuntimeNodeResolvers,
  characterProofRuntimeNodeResolvers,
  heldWeaponPoseRuntimeNodeResolvers,
  resolveMountedEnvironmentRuntime
}: CreateMetaverseSceneRemoteCharacterPresentationDependencies): MetaverseRemoteCharacterPresentationDependencies<
  MetaverseSceneCharacterProofRuntime,
  MetaverseAttachmentProofRuntime,
  MountedCharacterRuntime<MetaverseMountableEnvironmentDynamicAssetRuntime>,
  MetaverseMountableEnvironmentDynamicAssetRuntime
> {
  return {
    applyMountedAnchorTransform: applyCharacterMountedAnchorTransform,
    clearPistolPoseWeights: clearHumanoidV2PistolPoseWeights,
    cloneAttachmentRuntime: (sourceAttachmentRuntime, characterRuntime) =>
      cloneMetaverseAttachmentProofRuntime(
        sourceAttachmentRuntime,
        characterRuntime,
        attachmentRuntimeNodeResolvers
      ),
    cloneCharacterRuntime: (sourceCharacterRuntime, playerId) =>
      cloneMetaverseCharacterProofRuntime(sourceCharacterRuntime, playerId, {
        createHeldWeaponPoseRuntime: (characterScene) =>
          createHeldWeaponPoseRuntime(
            characterScene,
            heldWeaponPoseRuntimeNodeResolvers
          ),
        ...characterProofRuntimeNodeResolvers
      }),
    resolveHeldAnimationVocabulary: resolveHeldCharacterAnimationVocabulary,
    resolveMountedEnvironmentRuntime,
    restoreHeldWeaponPoseRuntime: restoreHumanoidV2HeldWeaponPoseRuntime,
    syncAttachmentMount: (
      attachmentRuntime,
      characterRuntime,
      mountedOccupancy
    ) =>
      syncAttachmentProofRuntimeMount(
        attachmentRuntime,
        characterRuntime,
        resolveMetaverseMountedOccupancyPresentationStateSnapshot(
          mountedOccupancy
        ),
        attachmentRuntimeNodeResolvers
      ),
    syncCharacterAnimation,
    syncCharacterPresentation,
    syncHeldWeaponPose: syncHumanoidV2HeldWeaponPose,
    syncMountedCharacterRuntime: (
      characterRuntime,
      mountedCharacterRuntime,
      mountedOccupancy,
      resolveMountedEnvironmentRuntime
    ) =>
      syncMountedCharacterRuntimeFromSelectionReference(
        characterRuntime,
        mountedCharacterRuntime,
        mountedOccupancy,
        resolveMetaverseMountedOccupancyPresentationStateSnapshot(
          mountedOccupancy
        ),
        resolveMountedEnvironmentRuntime
      ),
    syncPistolPoseWeights: syncHumanoidV2PistolPoseWeights
  };
}
