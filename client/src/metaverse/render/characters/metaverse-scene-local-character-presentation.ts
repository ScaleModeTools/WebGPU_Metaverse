import type { AnimationMixer, Object3D } from "three/webgpu";
import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";

import { resolveFirstPersonHeadClearanceCameraSnapshot } from "../first-person-camera-clearance";
import {
  clearHumanoidV2PistolPoseWeights,
  resolveHeldCharacterAnimationVocabulary,
  shouldUseHeldWeaponCharacterPresentation,
  syncCharacterAnimation,
  syncCharacterPresentation,
  syncHumanoidV2PistolPoseWeights,
  type MetaverseAttachmentAnimationRuntimeLike,
  type MetaverseCharacterAnimationRuntimeLike
} from "./metaverse-scene-character-animation";

import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";

interface LocalCharacterPresentationRuntimeLike
  extends MetaverseCharacterAnimationRuntimeLike {
  readonly firstPersonHeadAnchorNodes: readonly Object3D[];
  readonly heldWeaponPoseRuntime: object | null;
  readonly mixer: AnimationMixer;
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
    readonly restoreHeldWeaponPoseRuntime: (
      heldWeaponPoseRuntime: NonNullable<TCharacterRuntime["heldWeaponPoseRuntime"]>
    ) => void;
  }
): void {
  const heldWeaponPresentationActive =
    shouldUseHeldWeaponCharacterPresentation(
      attachmentRuntime,
      weaponState,
      mountedCharacterRuntime
    );
  const useHumanoidV2PistolLayering =
    heldWeaponPresentationActive &&
    characterPresentation !== null &&
    characterRuntime.humanoidV2PistolPoseRuntime !== null;

  syncCharacterAnimation(
    characterRuntime,
    resolveHeldCharacterAnimationVocabulary(
      characterRuntime,
      attachmentRuntime,
      characterPresentation?.animationVocabulary ?? "idle",
      weaponState,
      mountedCharacterRuntime
    ),
    useHumanoidV2PistolLayering,
    characterPresentation?.animationCycleId,
    characterPresentation?.animationPlaybackRateMultiplier
  );

  if (characterRuntime.humanoidV2PistolPoseRuntime !== null) {
    if (useHumanoidV2PistolLayering) {
      syncHumanoidV2PistolPoseWeights(
        characterRuntime.humanoidV2PistolPoseRuntime,
        cameraSnapshot.pitchRadians,
        orientation
      );
    } else {
      clearHumanoidV2PistolPoseWeights(
        characterRuntime.humanoidV2PistolPoseRuntime
      );
    }
  }

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
  TAttachmentRuntime extends MetaverseAttachmentAnimationRuntimeLike,
  TMountedCharacterRuntime extends object
>(
  characterRuntime: TCharacterRuntime,
  attachmentRuntime: TAttachmentRuntime | null,
  mountedCharacterRuntime: TMountedCharacterRuntime | null,
  cameraSnapshot: MetaverseCameraSnapshot,
  characterPresentation: MetaverseCharacterPresentationSnapshot | null,
  bodyPresentation: MetaverseRuntimeConfig["bodyPresentation"],
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null,
  weaponAdsBlend: number | null,
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
      cameraSnapshot: MetaverseCameraSnapshot,
      weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null,
      weaponAdsBlend?: number | null,
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
      presentedCameraSnapshot,
      weaponState,
      weaponAdsBlend,
      bodyPresentation
    );
  }

  return presentedCameraSnapshot;
}
