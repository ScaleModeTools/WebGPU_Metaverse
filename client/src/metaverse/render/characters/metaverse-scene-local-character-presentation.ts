import type { AnimationMixer, Object3D } from "three/webgpu";

import { resolveFirstPersonHeadClearanceCameraSnapshot } from "../first-person-camera-clearance";
import {
  clearHumanoidV2PistolPoseWeights,
  resolveHeldCharacterAnimationVocabulary,
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
  mountedCharacterRuntime: object | null,
  cameraSnapshot: Pick<MetaverseCameraSnapshot, "pitchRadians">,
  deltaSeconds: number,
  orientation: Pick<
    MetaverseRuntimeConfig["orientation"],
    "maxPitchRadians" | "minPitchRadians"
  >
): void {
  const useHumanoidV2PistolLayering =
    attachmentRuntime !== null &&
    attachmentRuntime.activeMountKind === "held" &&
    characterPresentation !== null &&
    mountedCharacterRuntime === null &&
    characterRuntime.humanoidV2PistolPoseRuntime !== null;

  syncCharacterAnimation(
    characterRuntime,
    resolveHeldCharacterAnimationVocabulary(
      characterRuntime,
      attachmentRuntime,
      characterPresentation?.animationVocabulary ?? "idle",
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
      cameraSnapshot: MetaverseCameraSnapshot
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
    attachmentRuntime !== null &&
    characterRuntime.heldWeaponPoseRuntime !== null &&
    attachmentRuntime.activeMountKind === "held" &&
    characterPresentation !== null &&
    mountedCharacterRuntime === null
  ) {
    dependencies.restoreHeldWeaponPoseRuntime(
      characterRuntime.heldWeaponPoseRuntime
    );
    characterRuntime.anchorGroup.updateMatrixWorld(true);
    dependencies.syncHeldWeaponPose(
      characterRuntime,
      characterRuntime.heldWeaponPoseRuntime,
      attachmentRuntime,
      presentedCameraSnapshot
    );
  }

  return presentedCameraSnapshot;
}
