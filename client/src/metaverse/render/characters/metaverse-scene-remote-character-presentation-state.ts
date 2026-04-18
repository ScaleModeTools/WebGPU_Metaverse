import { type Scene } from "three/webgpu";

import type {
  MetaverseRemoteCharacterPresentationDependencies,
  MetaverseRemoteCharacterPresentationRuntimeState
} from "./metaverse-scene-remote-character-presentations";
import {
  syncRemoteCharacterPresentations
} from "./metaverse-scene-remote-character-presentations";
import type {
  MetaverseSceneCharacterProofRuntime,
  MetaverseSceneInteractivePresentationState
} from "./metaverse-scene-interactive-presentation-state";
import type {
  MetaverseMountableEnvironmentDynamicAssetRuntime
} from "../environment/metaverse-scene-environment-proof-state";
import type {
  MountedCharacterRuntime
} from "../mounts/metaverse-scene-mounts";
import type { MetaverseAttachmentProofRuntime } from "../attachments/metaverse-scene-attachment-runtime";

import type {
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";

interface MetaverseSceneRemoteCharacterPresentationStateDependencies {
  readonly config: Pick<MetaverseRuntimeConfig, "orientation">;
  readonly interactivePresentationState: Pick<
    MetaverseSceneInteractivePresentationState,
    "attachmentProofRuntime" | "characterProofRuntime"
  >;
  readonly remoteCharacterPresentationDependencies: MetaverseRemoteCharacterPresentationDependencies<
    MetaverseSceneCharacterProofRuntime,
    MetaverseAttachmentProofRuntime,
    MountedCharacterRuntime<MetaverseMountableEnvironmentDynamicAssetRuntime>,
    MetaverseMountableEnvironmentDynamicAssetRuntime
  >;
  readonly scene: Scene;
}

export class MetaverseSceneRemoteCharacterPresentationState {
  readonly #dependencies: MetaverseSceneRemoteCharacterPresentationStateDependencies;
  readonly #remoteCharacterRuntimesByPlayerId = new Map<
    string,
    MetaverseRemoteCharacterPresentationRuntimeState<
      MetaverseSceneCharacterProofRuntime,
      MetaverseAttachmentProofRuntime,
      MountedCharacterRuntime<MetaverseMountableEnvironmentDynamicAssetRuntime>
    >
  >();

  constructor(
    dependencies: MetaverseSceneRemoteCharacterPresentationStateDependencies
  ) {
    this.#dependencies = dependencies;
  }

  resetPresentation(): void {
    for (const remoteCharacterRuntime of this.#remoteCharacterRuntimesByPlayerId.values()) {
      remoteCharacterRuntime.characterRuntime.anchorGroup.parent?.remove(
        remoteCharacterRuntime.characterRuntime.anchorGroup
      );
    }

    this.#remoteCharacterRuntimesByPlayerId.clear();
  }

  syncPresentation(
    remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[],
    deltaSeconds: number
  ): void {
    syncRemoteCharacterPresentations(
      this.#dependencies.scene,
      this.#dependencies.interactivePresentationState.characterProofRuntime,
      this.#dependencies.interactivePresentationState.attachmentProofRuntime,
      this.#dependencies.config,
      this.#remoteCharacterRuntimesByPlayerId,
      remoteCharacterPresentations,
      deltaSeconds,
      this.#dependencies.remoteCharacterPresentationDependencies
    );
  }
}
