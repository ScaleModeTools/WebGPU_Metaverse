import type { PerspectiveCamera, Scene } from "three/webgpu";

import type {
  MetaverseSceneRendererHost
} from "./camera/metaverse-scene-camera";
import type { MetaverseSceneCameraPresentationState } from "./camera/metaverse-scene-camera-presentation-state";
import type { MetaverseSceneLocalCharacterPresentationState } from "./characters/metaverse-scene-local-character-presentation-state";
import type { MetaverseSceneRemoteCharacterPresentationState } from "./characters/metaverse-scene-remote-character-presentation-state";
import type {
  MetaverseSceneInteractivePresentationState
} from "./characters/metaverse-scene-interactive-presentation-state";
import type {
  MetaverseMountableEnvironmentDynamicAssetRuntime,
  MetaverseSceneEnvironmentProofState
} from "./environment/metaverse-scene-environment-proof-state";
import type {
  MetaverseSceneMountInteractionState
} from "./mounts/metaverse-scene-mount-interaction-state";
import type {
  MetaverseSceneCharacterProofRuntime
} from "./characters/metaverse-scene-interactive-presentation-state";

import type { MetaverseCameraSnapshot } from "../types/metaverse-runtime";

interface MetaverseScenePresentationLifecycleStateDependencies {
  readonly camera: PerspectiveCamera;
  readonly cameraPresentationState: Pick<
    MetaverseSceneCameraPresentationState,
    "syncSceneInteractionSnapshot"
  >;
  readonly createCurrentCameraSnapshot: () => MetaverseCameraSnapshot;
  readonly environmentProofState: Pick<
    MetaverseSceneEnvironmentProofState,
    "boot" | "clearDynamicEnvironmentPoseOverrides"
  >;
  readonly interactivePresentationState: Pick<
    MetaverseSceneInteractivePresentationState,
    "boot"
  >;
  readonly localCharacterPresentationState: Pick<
    MetaverseSceneLocalCharacterPresentationState,
    "resetPresentation"
  >;
  readonly mountInteractionState: Pick<
    MetaverseSceneMountInteractionState<
      MetaverseSceneCharacterProofRuntime,
      MetaverseMountableEnvironmentDynamicAssetRuntime
    >,
    "resetPresentation"
  >;
  readonly portalPresentationState: Pick<
    MetaverseScenePortalPresentationState,
    "resetPresentation"
  >;
  readonly remoteCharacterPresentationState: Pick<
    MetaverseSceneRemoteCharacterPresentationState,
    "resetPresentation"
  >;
  readonly scene: Scene;
}

type MetaverseScenePortalPresentationState = import("./portals/metaverse-scene-portal-presentation-state").MetaverseScenePortalPresentationState;

export class MetaverseScenePresentationLifecycleState {
  readonly #dependencies: MetaverseScenePresentationLifecycleStateDependencies;

  constructor(
    dependencies: MetaverseScenePresentationLifecycleStateDependencies
  ) {
    this.#dependencies = dependencies;
  }

  async bootScenicEnvironment(): Promise<void> {
    await this.#dependencies.environmentProofState.boot();
    this.#dependencies.cameraPresentationState.syncSceneInteractionSnapshot(
      this.#dependencies.createCurrentCameraSnapshot(),
      null
    );
  }

  async bootInteractivePresentation(): Promise<void> {
    await this.bootScenicEnvironment();
    await this.#dependencies.interactivePresentationState.boot();
  }

  async boot(): Promise<void> {
    await this.bootInteractivePresentation();
  }

  resetPresentation(): void {
    this.#dependencies.mountInteractionState.resetPresentation();
    this.#dependencies.localCharacterPresentationState.resetPresentation();
    this.#dependencies.portalPresentationState.resetPresentation();
    this.#dependencies.environmentProofState.clearDynamicEnvironmentPoseOverrides();
    this.#dependencies.remoteCharacterPresentationState.resetPresentation();
  }

  async prewarm(renderer: MetaverseSceneRendererHost): Promise<void> {
    if (typeof renderer.compileAsync !== "function") {
      return;
    }

    await renderer.compileAsync(
      this.#dependencies.scene,
      this.#dependencies.camera
    );
  }
}
