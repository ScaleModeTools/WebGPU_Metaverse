import {
  advanceLocalCharacterAnimation,
  syncLocalCharacterPresentation
} from "./metaverse-scene-local-character-presentation";
import type {
  MetaverseRemoteCharacterPresentationDependencies
} from "./metaverse-scene-remote-character-presentations";
import type {
  MetaverseSceneCharacterProofRuntime,
  MetaverseSceneInteractivePresentationState
} from "./metaverse-scene-interactive-presentation-state";
import type {
  MetaverseMountableEnvironmentDynamicAssetRuntime
} from "../environment/metaverse-scene-environment-proof-state";
import type {
  MetaverseSceneMountInteractionState
} from "../mounts/metaverse-scene-mount-interaction-state";
import type {
  MountedCharacterRuntime
} from "../mounts/metaverse-scene-mounts";
import type {
  MetaverseAttachmentProofRuntime
} from "../attachments/metaverse-scene-attachment-runtime";

import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MountedEnvironmentSnapshot,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";

interface MetaverseSceneLocalCharacterPresentationStateDependencies {
  readonly config: Pick<
    MetaverseRuntimeConfig,
    "bodyPresentation" | "orientation"
  >;
  readonly interactivePresentationState: Pick<
    MetaverseSceneInteractivePresentationState,
    "attachmentProofRuntime" | "characterProofRuntime" | "syncAttachmentMount"
  >;
  readonly localCharacterPresentationDependencies: Pick<
    MetaverseRemoteCharacterPresentationDependencies<
      MetaverseSceneCharacterProofRuntime,
      MetaverseAttachmentProofRuntime,
      MountedCharacterRuntime<MetaverseMountableEnvironmentDynamicAssetRuntime>,
      MetaverseMountableEnvironmentDynamicAssetRuntime
    >,
    | "applyMountedAnchorTransform"
    | "restoreHeldWeaponPoseRuntime"
    | "syncHeldWeaponPose"
  >;
  readonly mountInteractionState: Pick<
    MetaverseSceneMountInteractionState<
      MetaverseSceneCharacterProofRuntime,
      MetaverseMountableEnvironmentDynamicAssetRuntime
    >,
    "readMountedCharacterRuntime" | "syncMountedCharacterRuntime"
  >;
}

export class MetaverseSceneLocalCharacterPresentationState {
  readonly #dependencies: MetaverseSceneLocalCharacterPresentationStateDependencies;

  constructor(
    dependencies: MetaverseSceneLocalCharacterPresentationStateDependencies
  ) {
    this.#dependencies = dependencies;
  }

  resetPresentation(): void {
    this.#dependencies.interactivePresentationState.syncAttachmentMount(null);
  }

  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    deltaSeconds: number,
    characterPresentation: MetaverseCharacterPresentationSnapshot | null = null,
    mountedEnvironment: MountedEnvironmentSnapshot | null = null
  ): MetaverseCameraSnapshot {
    const {
      config,
      interactivePresentationState,
      localCharacterPresentationDependencies,
      mountInteractionState
    } = this.#dependencies;

    if (interactivePresentationState.characterProofRuntime !== null) {
      advanceLocalCharacterAnimation(
        interactivePresentationState.characterProofRuntime,
        interactivePresentationState.attachmentProofRuntime,
        characterPresentation,
        mountInteractionState.readMountedCharacterRuntime(),
        cameraSnapshot,
        deltaSeconds,
        config.orientation
      );
    }

    mountInteractionState.syncMountedCharacterRuntime(mountedEnvironment);
    interactivePresentationState.syncAttachmentMount(mountedEnvironment);

    return interactivePresentationState.characterProofRuntime === null
      ? cameraSnapshot
      : syncLocalCharacterPresentation(
          interactivePresentationState.characterProofRuntime,
          interactivePresentationState.attachmentProofRuntime,
          mountInteractionState.readMountedCharacterRuntime(),
          cameraSnapshot,
          characterPresentation,
          config.bodyPresentation,
          localCharacterPresentationDependencies
        );
  }
}
