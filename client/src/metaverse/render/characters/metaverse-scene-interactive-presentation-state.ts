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
  readonly attachmentProofConfig?: MetaverseAttachmentProofConfig | null;
  readonly attachmentProofConfigs?:
    | readonly MetaverseAttachmentProofConfig[]
    | null;
  readonly attachmentRuntimeNodeResolvers: MetaverseAttachmentRuntimeNodeResolvers;
  readonly characterProofConfig: MetaverseCharacterProofConfig | null;
  readonly characterProofRuntimeNodeResolvers: MetaverseCharacterProofRuntimeNodeResolvers;
  readonly createSceneAssetLoader: () => MetaverseSceneAssetLoader;
  readonly heldWeaponPoseRuntimeNodeResolvers: MetaverseHeldWeaponPoseRuntimeNodeResolvers;
  readonly scene: Scene;
  readonly warn: (message: string) => void;
}

function resolveAttachmentProofConfigs(
  dependencies: Pick<
    MetaverseSceneInteractivePresentationStateDependencies,
    "attachmentProofConfig" | "attachmentProofConfigs"
  >
): readonly MetaverseAttachmentProofConfig[] {
  if (dependencies.attachmentProofConfigs !== undefined) {
    return dependencies.attachmentProofConfigs ?? [];
  }

  return dependencies.attachmentProofConfig === null ||
    dependencies.attachmentProofConfig === undefined
    ? []
    : [dependencies.attachmentProofConfig];
}

export class MetaverseSceneInteractivePresentationState {
  attachmentProofRuntime: MetaverseAttachmentProofRuntime | null = null;
  readonly attachmentProofRuntimesByAttachmentId = new Map<
    string,
    MetaverseAttachmentProofRuntime
  >();
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
        attachmentRuntimeNodeResolvers,
        characterProofConfig,
        characterProofRuntimeNodeResolvers,
        createSceneAssetLoader,
        heldWeaponPoseRuntimeNodeResolvers,
        scene,
        warn
      } = this.#dependencies;
      const attachmentProofConfigs = resolveAttachmentProofConfigs(
        this.#dependencies
      );

      if (attachmentProofConfigs.length > 0 && characterProofConfig !== null) {
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
            warn,
            ...characterProofRuntimeNodeResolvers
          }
        );

        this.characterProofRuntime = loadedCharacterProofRuntime;
        scene.add(loadedCharacterProofRuntime.anchorGroup);
        for (const attachmentProofConfig of attachmentProofConfigs) {
          const attachmentProofRuntime = await loadMetaverseAttachmentProofRuntime(
            attachmentProofConfig,
            loadedCharacterProofRuntime,
            {
              createSceneAssetLoader,
              heldWeaponSolveDirectionEpsilon,
              ...attachmentRuntimeNodeResolvers
            }
          );

          this.attachmentProofRuntimesByAttachmentId.set(
            attachmentProofRuntime.attachmentId,
            attachmentProofRuntime
          );
        }
      } else if (characterProofConfig !== null) {
        const loadedCharacterProofRuntime = await loadMetaverseCharacterProofRuntime(
          characterProofConfig,
          {
            createHeldWeaponPoseRuntime: () => null,
            createSceneAssetLoader,
            heldWeaponSolveDirectionEpsilon,
            warn,
            ...characterProofRuntimeNodeResolvers
          }
        );

        this.characterProofRuntime = loadedCharacterProofRuntime;
        scene.add(loadedCharacterProofRuntime.anchorGroup);
      } else if (attachmentProofConfigs.length > 0) {
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
    this.attachmentProofRuntime = null;

    if (this.characterProofRuntime === null) {
      return;
    }

    for (const attachmentProofRuntime of this.attachmentProofRuntimesByAttachmentId.values()) {
      syncAttachmentProofRuntimeMount(
        attachmentProofRuntime,
        this.characterProofRuntime,
        mountedOccupancyPresentationState,
        this.#dependencies.attachmentRuntimeNodeResolvers,
        weaponState
      );

      if (
        weaponState !== null &&
        weaponState.weaponId === attachmentProofRuntime.attachmentId
      ) {
        this.attachmentProofRuntime = attachmentProofRuntime;
      }
    }
  }
}
