import {
  type ResolvedMountedEnvironmentSelection,
  type MetaverseSceneDynamicEnvironmentRuntime,
  type MetaverseSceneEnvironmentProofRuntime,
  type MetaverseSceneInteractionSnapshot,
  type MetaverseSceneMountedCharacterPresentationRuntime,
  type MetaverseSceneMountableEnvironmentRuntime,
  type MountedCharacterRuntime
} from "./metaverse-scene-mounts";
import {
  resolveFocusedMountableEnvironmentRuntime,
  resolveMountedEnvironmentSelectionByRequest
} from "./metaverse-scene-mount-runtime-resolution";
import {
  createMetaverseSceneInteractionSnapshot,
  resolveFocusedMountableSnapshot
} from "./metaverse-scene-mount-snapshots";
import {
  dismountCharacterFromEnvironmentAsset,
  syncMountedCharacterRuntimeFromSelectionReference
} from "./metaverse-scene-mounted-character-runtime";

import type {
  MetaverseCameraSnapshot,
  MountedEnvironmentSnapshot
} from "../../types/metaverse-runtime";
import type {
  MetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";

interface MetaverseSceneMountInteractionStateDependencies<
  TCharacterRuntime extends MetaverseSceneMountedCharacterPresentationRuntime,
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
> {
  readonly focusProbeForwardMeters: number;
  readonly readCharacterProofRuntime: () => TCharacterRuntime | null;
  readonly readEnvironmentProofRuntime: () => MetaverseSceneEnvironmentProofRuntime<MetaverseSceneDynamicEnvironmentRuntime> | null;
  readonly resolveMountedEnvironmentRuntime: (
    environmentAssetId: string
  ) => TEnvironmentRuntime | null;
  readonly resolveMountedEnvironmentSnapshot: (
    environmentAsset: TEnvironmentRuntime,
    occupiedSelection: Omit<ResolvedMountedEnvironmentSelection, "anchorGroup">
  ) => MountedEnvironmentSnapshot;
}

export class MetaverseSceneMountInteractionState<
  TCharacterRuntime extends MetaverseSceneMountedCharacterPresentationRuntime,
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
> {
  readonly #dependencies: MetaverseSceneMountInteractionStateDependencies<
    TCharacterRuntime,
    TEnvironmentRuntime
  >;

  #mountedCharacterRuntime: MountedCharacterRuntime<TEnvironmentRuntime> | null =
    null;
  #sceneInteractionSnapshot = createMetaverseSceneInteractionSnapshot(null);

  constructor(
    dependencies: MetaverseSceneMountInteractionStateDependencies<
      TCharacterRuntime,
      TEnvironmentRuntime
    >
  ) {
    this.#dependencies = dependencies;
  }

  readMountedCharacterRuntime(): MountedCharacterRuntime<TEnvironmentRuntime> | null {
    return this.#mountedCharacterRuntime;
  }

  resetPresentation(): void {
    const characterProofRuntime = this.#dependencies.readCharacterProofRuntime();

    if (
      characterProofRuntime !== null &&
      this.#mountedCharacterRuntime !== null
    ) {
      dismountCharacterFromEnvironmentAsset(
        characterProofRuntime,
        this.#mountedCharacterRuntime
      );
      this.#mountedCharacterRuntime = null;
    }

    this.#sceneInteractionSnapshot = createMetaverseSceneInteractionSnapshot(null);
  }

  resolveBoardFocusedMountable(
    cameraSnapshot: MetaverseCameraSnapshot,
    requestedEntryId: string | null = null
  ): MountedEnvironmentSnapshot | null {
    const environmentProofRuntime =
      this.#dependencies.readEnvironmentProofRuntime();

    if (environmentProofRuntime === null) {
      return null;
    }

    const focusedEnvironment = resolveFocusedMountableEnvironmentRuntime(
      environmentProofRuntime,
      cameraSnapshot,
      this.#dependencies.focusProbeForwardMeters
    );

    if (focusedEnvironment === null) {
      return null;
    }

    const occupiedSelection = resolveMountedEnvironmentSelectionByRequest(
      focusedEnvironment.environmentAsset,
      {
        requestedEntryId
      }
    );

    return occupiedSelection === null
      ? null
      : this.#dependencies.resolveMountedEnvironmentSnapshot(
          focusedEnvironment.environmentAsset as TEnvironmentRuntime,
          occupiedSelection
        );
  }

  resolveSeatOccupancy(
    cameraSnapshot: MetaverseCameraSnapshot,
    requestedSeatId: string
  ): MountedEnvironmentSnapshot | null {
    const environmentProofRuntime =
      this.#dependencies.readEnvironmentProofRuntime();

    if (environmentProofRuntime === null) {
      return null;
    }

    const targetEnvironment =
      this.#mountedCharacterRuntime?.environmentAsset ??
      resolveFocusedMountableEnvironmentRuntime(
        environmentProofRuntime,
        cameraSnapshot,
        this.#dependencies.focusProbeForwardMeters
      )?.environmentAsset ??
      null;

    if (targetEnvironment === null) {
      return null;
    }

    const occupiedSelection = resolveMountedEnvironmentSelectionByRequest(
      targetEnvironment,
      {
        requestedSeatId
      }
    );

    return occupiedSelection === null
      ? null
      : this.#dependencies.resolveMountedEnvironmentSnapshot(
          targetEnvironment as TEnvironmentRuntime,
          occupiedSelection
        );
  }

  syncMountedCharacterRuntime(
    mountedEnvironment: MountedEnvironmentSnapshot | null,
    mountedOccupancyPresentationState:
      | MetaverseMountedOccupancyPresentationStateSnapshot
      | null
  ): void {
    const characterProofRuntime = this.#dependencies.readCharacterProofRuntime();
    const environmentProofRuntime =
      this.#dependencies.readEnvironmentProofRuntime();

    if (characterProofRuntime === null || environmentProofRuntime === null) {
      return;
    }

    this.#mountedCharacterRuntime = syncMountedCharacterRuntimeFromSelectionReference(
      characterProofRuntime,
      this.#mountedCharacterRuntime,
      mountedEnvironment,
      mountedOccupancyPresentationState,
      this.#dependencies.resolveMountedEnvironmentRuntime
    );
  }

  syncSceneInteractionSnapshot(
    cameraSnapshot: MetaverseCameraSnapshot,
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): MetaverseSceneInteractionSnapshot {
    const environmentProofRuntime =
      this.#dependencies.readEnvironmentProofRuntime();

    this.#sceneInteractionSnapshot =
      environmentProofRuntime === null
        ? createMetaverseSceneInteractionSnapshot(null)
        : createMetaverseSceneInteractionSnapshot(
            resolveFocusedMountableSnapshot(
              environmentProofRuntime,
              mountedEnvironment,
              cameraSnapshot,
              this.#dependencies.focusProbeForwardMeters
            )
          );

    return this.#sceneInteractionSnapshot;
  }
}
