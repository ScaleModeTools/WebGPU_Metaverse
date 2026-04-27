import type { AnimationClip, Group, Scene } from "three/webgpu";
import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";

import {
  loadMetaverseAttachmentProofRuntime,
  syncAttachmentProofRuntimeMount,
  type MetaverseAttachmentProofRuntime,
  type MetaverseAttachmentRuntimeNodeResolvers
} from "../attachments/metaverse-scene-attachment-runtime";
import {
  loadMetaverseCharacterProofRuntime,
  type LoadedMetaverseCharacterProofRuntime,
  type MetaverseCharacterProofRuntimeNodeResolvers
} from "./metaverse-scene-character-proof-runtime";
import {
  createHeldWeaponPoseRuntime,
  heldWeaponSolveDirectionEpsilon,
  type HumanoidV2HeldWeaponPoseRuntime,
  type MetaverseHeldWeaponPoseRuntimeNodeResolvers
} from "./metaverse-scene-held-weapon-pose";

import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
} from "../../types/metaverse-runtime";
import type {
  MetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";

export interface MetaverseSceneAsset {
  readonly animations: readonly AnimationClip[];
  readonly scene: Group;
}

export interface MetaverseSceneAssetLoader {
  loadAsync(path: string): Promise<MetaverseSceneAsset>;
}

export type MetaverseSceneCharacterProofRuntime =
  LoadedMetaverseCharacterProofRuntime<HumanoidV2HeldWeaponPoseRuntime | null>;

interface MetaverseSceneInteractivePresentationStateDependencies {
  readonly attachmentProofConfig: MetaverseAttachmentProofConfig | null;
  readonly attachmentRuntimeNodeResolvers: MetaverseAttachmentRuntimeNodeResolvers;
  readonly characterProofConfig: MetaverseCharacterProofConfig | null;
  readonly characterProofRuntimeNodeResolvers: MetaverseCharacterProofRuntimeNodeResolvers;
  readonly createSceneAssetLoader: () => MetaverseSceneAssetLoader;
  readonly heldWeaponPoseRuntimeNodeResolvers: MetaverseHeldWeaponPoseRuntimeNodeResolvers;
  readonly scene: Scene;
  readonly showSocketDebug: boolean;
  readonly warn: (message: string) => void;
}

function resolveUnarmedCharacterProofConfig(
  characterProofConfig: MetaverseCharacterProofConfig
): MetaverseCharacterProofConfig {
  if (
    characterProofConfig.humanoidV2PistolPoseProofConfig === null ||
    characterProofConfig.humanoidV2PistolPoseProofConfig === undefined
  ) {
    return characterProofConfig;
  }

  return Object.freeze({
    ...characterProofConfig,
    humanoidV2PistolPoseProofConfig: null
  });
}

export class MetaverseSceneInteractivePresentationState {
  attachmentProofRuntime: MetaverseAttachmentProofRuntime | null = null;
  characterProofRuntime: MetaverseSceneCharacterProofRuntime | null = null;

  readonly #dependencies: MetaverseSceneInteractivePresentationStateDependencies;
  #interactivePresentationBootPromise: Promise<void> | null = null;
  #interactivePresentationBooted = false;

  constructor(dependencies: MetaverseSceneInteractivePresentationStateDependencies) {
    this.#dependencies = dependencies;
  }

  async boot(): Promise<void> {
    if (this.#interactivePresentationBooted) {
      return;
    }

    if (this.#interactivePresentationBootPromise !== null) {
      await this.#interactivePresentationBootPromise;
      return;
    }

    this.#interactivePresentationBootPromise = (async () => {
      const {
        attachmentProofConfig,
        attachmentRuntimeNodeResolvers,
        characterProofConfig,
        characterProofRuntimeNodeResolvers,
        createSceneAssetLoader,
        heldWeaponPoseRuntimeNodeResolvers,
        scene,
        showSocketDebug,
        warn
      } = this.#dependencies;

      if (attachmentProofConfig !== null && characterProofConfig !== null) {
        const loadedCharacterProofRuntime = await loadMetaverseCharacterProofRuntime(
          characterProofConfig,
          {
            createHeldWeaponPoseRuntime: (characterScene) =>
              createHeldWeaponPoseRuntime(
                characterScene,
                heldWeaponPoseRuntimeNodeResolvers
              ),
            createSceneAssetLoader,
            heldWeaponSolveDirectionEpsilon,
            showSocketDebug,
            warn,
            ...characterProofRuntimeNodeResolvers
          }
        );

        this.characterProofRuntime = loadedCharacterProofRuntime;
        scene.add(loadedCharacterProofRuntime.anchorGroup);
        this.attachmentProofRuntime = await loadMetaverseAttachmentProofRuntime(
          attachmentProofConfig,
          loadedCharacterProofRuntime,
          {
            createSceneAssetLoader,
            heldWeaponSolveDirectionEpsilon,
            ...attachmentRuntimeNodeResolvers
          }
        );
      } else if (characterProofConfig !== null) {
        const loadedCharacterProofRuntime = await loadMetaverseCharacterProofRuntime(
          resolveUnarmedCharacterProofConfig(characterProofConfig),
          {
            createHeldWeaponPoseRuntime: () => null,
            createSceneAssetLoader,
            heldWeaponSolveDirectionEpsilon,
            showSocketDebug,
            warn,
            ...characterProofRuntimeNodeResolvers
          }
        );

        this.characterProofRuntime = loadedCharacterProofRuntime;
        scene.add(loadedCharacterProofRuntime.anchorGroup);
      } else if (attachmentProofConfig !== null) {
        throw new Error(
          "Metaverse scene cannot boot an attachment proof slice without a character proof slice."
        );
      }

      this.#interactivePresentationBooted = true;
    })();

    try {
      await this.#interactivePresentationBootPromise;
    } finally {
      if (this.#interactivePresentationBootPromise !== null) {
        this.#interactivePresentationBootPromise = null;
      }
    }
  }

  syncAttachmentMount(
    mountedOccupancyPresentationState:
      | MetaverseMountedOccupancyPresentationStateSnapshot
      | null,
    weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null = null
  ): void {
    if (
      this.attachmentProofRuntime === null ||
      this.characterProofRuntime === null
    ) {
      return;
    }

    syncAttachmentProofRuntimeMount(
      this.attachmentProofRuntime,
      this.characterProofRuntime,
      mountedOccupancyPresentationState,
      this.#dependencies.attachmentRuntimeNodeResolvers,
      weaponState
    );
  }
}
