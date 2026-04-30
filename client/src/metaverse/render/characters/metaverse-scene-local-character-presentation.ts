import type { AnimationMixer, Object3D } from "three/webgpu";
import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";

import { resolveFirstPersonHeadClearanceCameraSnapshot } from "../first-person-camera-clearance";
import type { HeldObjectAimState } from "./metaverse-scene-held-weapon-pose";
import {
  createMetaverseSemanticAimFrameFromCameraSnapshot,
  type MetaverseSemanticAimFrame
} from "../../aim/metaverse-semantic-aim";
import {
  shouldUseHeldWeaponCharacterPresentation,
  syncCharacterAnimation,
  syncCharacterDeathRagdollPresentation,
  syncCharacterPresentation,
  syncCharacterProceduralHitReaction,
  type MetaverseAttachmentAnimationRuntimeLike,
  type MetaverseCharacterAnimationRuntimeLike
} from "./metaverse-scene-character-animation";

import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";
import type {
  HeldObjectAdsPolicyId,
  HeldObjectFamilyId,
  HeldObjectPoseProfileId
} from "@/assets/types/held-object-authoring-manifest";

interface LocalCharacterPresentationRuntimeLike
  extends MetaverseCharacterAnimationRuntimeLike {
  readonly firstPersonHeadAnchorNodes: readonly Object3D[];
  readonly heldWeaponPoseRuntime: object | null;
  readonly mixer: AnimationMixer;
}

interface LocalHeldObjectAttachmentRuntimeLike
  extends MetaverseAttachmentAnimationRuntimeLike {
  readonly presentationGroup: {
    visible: boolean;
  };
  readonly holdProfile: {
    readonly adsPolicy: HeldObjectAdsPolicyId;
    readonly family: HeldObjectFamilyId;
    readonly poseProfileId: HeldObjectPoseProfileId;
  };
}

export function shouldUseCleanAdsFirstPersonPresentation(
  attachmentRuntime: Pick<LocalHeldObjectAttachmentRuntimeLike, "holdProfile">,
  weaponState: Pick<MetaverseRealtimePlayerWeaponStateSnapshot, "aimMode"> | null
): boolean {
  if (weaponState?.aimMode !== "ads") {
    return false;
  }

  return (
    attachmentRuntime.holdProfile.family === "long_gun" ||
    attachmentRuntime.holdProfile.family === "shoulder_heavy"
  );
}

export function shouldUseScopedAdsAttachmentPresentation(
  attachmentRuntime: Pick<LocalHeldObjectAttachmentRuntimeLike, "holdProfile">,
  weaponState: Pick<MetaverseRealtimePlayerWeaponStateSnapshot, "aimMode"> | null
): boolean {
  return shouldUseCleanAdsFirstPersonPresentation(attachmentRuntime, weaponState);
}

export function syncLocalScopedAdsAttachmentPresentation(
  attachmentRuntime: Pick<
    LocalHeldObjectAttachmentRuntimeLike,
    "holdProfile" | "presentationGroup"
  >,
  weaponState: Pick<MetaverseRealtimePlayerWeaponStateSnapshot, "aimMode"> | null
): void {
  attachmentRuntime.presentationGroup.visible =
    !shouldUseScopedAdsAttachmentPresentation(attachmentRuntime, weaponState);
}

export function syncLocalCleanAdsCharacterPresentation(
  characterRuntime: Pick<LocalCharacterPresentationRuntimeLike, "anchorGroup">,
  attachmentRuntime: Pick<LocalHeldObjectAttachmentRuntimeLike, "holdProfile">,
  weaponState: Pick<MetaverseRealtimePlayerWeaponStateSnapshot, "aimMode"> | null
): void {
  if (shouldUseCleanAdsFirstPersonPresentation(attachmentRuntime, weaponState)) {
    characterRuntime.anchorGroup.visible = false;
  }
}

export function advanceLocalCharacterAnimation<
  TCharacterRuntime extends LocalCharacterPresentationRuntimeLike,
  TAttachmentRuntime extends MetaverseAttachmentAnimationRuntimeLike
>(
  characterRuntime: TCharacterRuntime,
  attachmentRuntime: TAttachmentRuntime | null,
  characterPresentation: MetaverseCharacterPresentationSnapshot | null,
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null,
  mountedCharacterRuntime: object | null,
  cameraSnapshot: Pick<MetaverseCameraSnapshot, "pitchRadians">,
  deltaSeconds: number,
  orientation: Pick<
    MetaverseRuntimeConfig["orientation"],
    "maxPitchRadians" | "minPitchRadians"
  >,
  dependencies: {
    readonly captureHeldWeaponPoseRuntime: (
      heldWeaponPoseRuntime: NonNullable<TCharacterRuntime["heldWeaponPoseRuntime"]>
    ) => void;
    readonly prepareHeldWeaponPoseRuntime: (
      heldWeaponPoseRuntime: NonNullable<TCharacterRuntime["heldWeaponPoseRuntime"]>
    ) => void;
    readonly restoreHeldWeaponPoseRuntime: (
      heldWeaponPoseRuntime: NonNullable<TCharacterRuntime["heldWeaponPoseRuntime"]>
    ) => void;
  }
): void {
  if (characterRuntime.deathRagdollRuntime.isActive) {
    return;
  }

  const heldWeaponPresentationActive =
    shouldUseHeldWeaponCharacterPresentation(
      attachmentRuntime,
      weaponState,
      mountedCharacterRuntime
    );

  if (characterRuntime.heldWeaponPoseRuntime !== null) {
    dependencies.prepareHeldWeaponPoseRuntime(
      characterRuntime.heldWeaponPoseRuntime
    );
  }

  syncCharacterAnimation(
    characterRuntime,
    characterPresentation?.animationVocabulary ?? "idle",
    characterPresentation?.animationCycleId,
    characterPresentation?.animationPlaybackRateMultiplier
  );

  void cameraSnapshot;
  void orientation;

  characterRuntime.mixer.update(deltaSeconds);

  if (characterRuntime.heldWeaponPoseRuntime !== null) {
    dependencies.captureHeldWeaponPoseRuntime(
      characterRuntime.heldWeaponPoseRuntime
    );

    if (!heldWeaponPresentationActive) {
      dependencies.restoreHeldWeaponPoseRuntime(
        characterRuntime.heldWeaponPoseRuntime
      );
    }
  }
}

export function syncLocalCharacterPresentation<
  TCharacterRuntime extends LocalCharacterPresentationRuntimeLike,
  TAttachmentRuntime extends LocalHeldObjectAttachmentRuntimeLike,
  TMountedCharacterRuntime extends object
>(
  characterRuntime: TCharacterRuntime,
  attachmentRuntime: TAttachmentRuntime | null,
  mountedCharacterRuntime: TMountedCharacterRuntime | null,
  cameraSnapshot: MetaverseCameraSnapshot,
  nowMs: number,
  characterPresentation: MetaverseCharacterPresentationSnapshot | null,
  bodyPresentation: MetaverseRuntimeConfig["bodyPresentation"],
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null,
  weaponAdsBlend: number | null,
  semanticAimFrame: MetaverseSemanticAimFrame | null,
  dependencies: {
    readonly applyMountedAnchorTransform: (
      characterRuntime: TCharacterRuntime,
      mountedCharacterRuntime: TMountedCharacterRuntime
    ) => void;
    readonly restoreHeldWeaponPoseRuntime: (
      heldWeaponPoseRuntime: NonNullable<TCharacterRuntime["heldWeaponPoseRuntime"]>
    ) => void;
    readonly syncHeldWeaponPose: (
      characterRuntime: TCharacterRuntime,
      heldWeaponPoseRuntime: NonNullable<TCharacterRuntime["heldWeaponPoseRuntime"]>,
      attachmentRuntime: TAttachmentRuntime,
      aimState: HeldObjectAimState,
      weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null,
      bodyPresentation?: Pick<
        MetaverseRuntimeConfig["bodyPresentation"],
        | "groundedFirstPersonHeadClearanceMeters"
        | "groundedFirstPersonHeadOcclusionRadiusMeters"
      >
    ) => void;
  }
): MetaverseCameraSnapshot {
  syncCharacterPresentation(
    characterRuntime,
    characterPresentation,
    mountedCharacterRuntime
  );

  if (mountedCharacterRuntime !== null) {
    dependencies.applyMountedAnchorTransform(
      characterRuntime,
      mountedCharacterRuntime
    );
  }

  syncCharacterProceduralHitReaction(characterRuntime, nowMs);

  const presentedCameraSnapshot =
    mountedCharacterRuntime !== null
      ? cameraSnapshot
      : resolveFirstPersonHeadClearanceCameraSnapshot(
          cameraSnapshot,
          characterPresentation,
          characterRuntime.firstPersonHeadAnchorNodes,
          bodyPresentation
        );

  if (
    shouldUseHeldWeaponCharacterPresentation(
      attachmentRuntime,
      weaponState,
      mountedCharacterRuntime
    ) &&
    characterRuntime.heldWeaponPoseRuntime !== null &&
    characterPresentation !== null &&
    attachmentRuntime !== null
  ) {
    dependencies.restoreHeldWeaponPoseRuntime(
      characterRuntime.heldWeaponPoseRuntime
    );
    characterRuntime.anchorGroup.updateMatrixWorld(true);
    dependencies.syncHeldWeaponPose(
      characterRuntime,
      characterRuntime.heldWeaponPoseRuntime,
      attachmentRuntime,
      semanticAimFrame ??
        createMetaverseSemanticAimFrameFromCameraSnapshot({
          actorFacingYawRadians: characterPresentation.yawRadians,
          adsBlend: weaponAdsBlend,
          attachmentRuntime,
          cameraSnapshot: presentedCameraSnapshot,
          quality: "full_camera_ray",
          source: "local_camera",
          weaponState
        }),
      weaponState,
      bodyPresentation
    );
    syncLocalScopedAdsAttachmentPresentation(attachmentRuntime, weaponState);
    syncLocalCleanAdsCharacterPresentation(
      characterRuntime,
      attachmentRuntime,
      weaponState
    );
  }

  syncCharacterDeathRagdollPresentation(characterRuntime, nowMs);

  return presentedCameraSnapshot;
}
