import type { PerspectiveCamera } from "three/webgpu";

import { syncMetaverseSceneCamera } from "./metaverse-scene-camera";
import type { MetaverseSceneEnvironmentProofState } from "../environment/metaverse-scene-environment-proof-state";
import type {
  MetaverseSceneInteractionSnapshot
} from "../mounts/metaverse-scene-mounts";
import type {
  MetaverseSceneMountedPresentationSnapshot
} from "../mounts/metaverse-scene-mounted-presentation-snapshot";
import type {
  MetaverseSceneMountInteractionState
} from "../mounts/metaverse-scene-mount-interaction-state";
import type {
  MetaverseMountableEnvironmentDynamicAssetRuntime
} from "../environment/metaverse-scene-environment-proof-state";
import type {
  MetaverseSceneCharacterProofRuntime
} from "../characters/metaverse-scene-interactive-presentation-state";

import type {
  MetaverseCameraSnapshot
} from "../../types/metaverse-runtime";

interface MetaverseSceneCameraPresentationStateDependencies {
  readonly camera: PerspectiveCamera;
  readonly environmentProofState: Pick<
    MetaverseSceneEnvironmentProofState,
    "syncPresentation"
  >;
  readonly mountInteractionState: Pick<
    MetaverseSceneMountInteractionState<
      MetaverseSceneCharacterProofRuntime,
      MetaverseMountableEnvironmentDynamicAssetRuntime
    >,
    "syncSceneInteractionSnapshot"
  >;
}

export class MetaverseSceneCameraPresentationState {
  readonly #dependencies: MetaverseSceneCameraPresentationStateDependencies;

  constructor(
    dependencies: MetaverseSceneCameraPresentationStateDependencies
  ) {
    this.#dependencies = dependencies;
  }

  syncPresentedCamera(
    cameraSnapshot: MetaverseCameraSnapshot,
    nowMs: number
  ): void {
    this.#dependencies.environmentProofState.syncPresentation(
      cameraSnapshot,
      nowMs
    );
    syncMetaverseSceneCamera(this.#dependencies.camera, cameraSnapshot);
  }

  syncSceneInteractionSnapshot(
    cameraSnapshot: MetaverseCameraSnapshot,
    mountedPresentationSnapshot: MetaverseSceneMountedPresentationSnapshot | null
  ): MetaverseSceneInteractionSnapshot {
    return this.#dependencies.mountInteractionState.syncSceneInteractionSnapshot(
      cameraSnapshot,
      mountedPresentationSnapshot?.mountedEnvironment ?? null
    );
  }
}
