import { Group, type Object3D, type Scene } from "three/webgpu";

import type {
  MetaverseCameraSnapshot,
  MetaverseEnvironmentProofConfig,
  MountedEnvironmentSnapshot
} from "../../types/metaverse-runtime";
import {
  loadMetaverseEnvironmentProofRuntime,
  syncEnvironmentProofRuntime,
  type DynamicEnvironmentPoseSnapshot,
  type MetaverseEnvironmentProofRuntime,
  type SceneAssetLoaderLike
} from "./metaverse-scene-environment-proof-runtime";
import { MetaverseSceneDynamicEnvironmentPoseState } from "./metaverse-scene-dynamic-environment-pose-state";

export type {
  DynamicEnvironmentPoseSnapshot,
  MetaverseEnvironmentDynamicAssetRuntime,
  MetaverseEnvironmentProofRuntime,
  MetaverseMountableEnvironmentDynamicAssetRuntime
} from "./metaverse-scene-environment-proof-runtime";

interface MetaverseSceneEnvironmentProofStateDependencies {
  readonly createSceneAssetLoader: () => SceneAssetLoaderLike;
  readonly environmentProofConfig?: MetaverseEnvironmentProofConfig | null;
  readonly findNamedNode: (
    scene: Group,
    nodeName: string,
    label: string
  ) => Object3D;
  readonly markSceneBundleGroupsDirty: () => void;
  readonly readCurrentCameraSnapshot: () => MetaverseCameraSnapshot;
  readonly scene: Scene;
  readonly showSocketDebug: boolean;
}

export class MetaverseSceneEnvironmentProofState {
  readonly #createSceneAssetLoader: () => SceneAssetLoaderLike;
  readonly #environmentProofConfig: MetaverseEnvironmentProofConfig | null;
  readonly #findNamedNode: (
    scene: Group,
    nodeName: string,
    label: string
  ) => Object3D;
  readonly #markSceneBundleGroupsDirty: () => void;
  readonly #readCurrentCameraSnapshot: () => MetaverseCameraSnapshot;
  readonly #scene: Scene;
  readonly #showSocketDebug: boolean;
  readonly #dynamicEnvironmentPoseState =
    new MetaverseSceneDynamicEnvironmentPoseState();

  #bootPromise: Promise<void> | null = null;
  #booted = false;
  #runtime: MetaverseEnvironmentProofRuntime | null = null;

  constructor({
    createSceneAssetLoader,
    environmentProofConfig = null,
    findNamedNode,
    markSceneBundleGroupsDirty,
    readCurrentCameraSnapshot,
    scene,
    showSocketDebug
  }: MetaverseSceneEnvironmentProofStateDependencies) {
    this.#createSceneAssetLoader = createSceneAssetLoader;
    this.#environmentProofConfig = environmentProofConfig;
    this.#findNamedNode = findNamedNode;
    this.#markSceneBundleGroupsDirty = markSceneBundleGroupsDirty;
    this.#readCurrentCameraSnapshot = readCurrentCameraSnapshot;
    this.#scene = scene;
    this.#showSocketDebug = showSocketDebug;
  }

  get runtime(): MetaverseEnvironmentProofRuntime | null {
    return this.#runtime;
  }

  async boot(): Promise<void> {
    if (this.#booted) {
      return;
    }

    if (this.#bootPromise !== null) {
      await this.#bootPromise;
      return;
    }

    this.#bootPromise = (async () => {
      if (this.#environmentProofConfig !== null && this.#runtime === null) {
        this.#runtime = await loadMetaverseEnvironmentProofRuntime(
          this.#environmentProofConfig,
          this.#createSceneAssetLoader,
          this.#findNamedNode,
          this.#showSocketDebug
        );
        this.#scene.add(this.#runtime.anchorGroup);
        this.#markSceneBundleGroupsDirty();
      }

      if (this.#runtime !== null) {
        syncEnvironmentProofRuntime(
          this.#runtime,
          this.#readCurrentCameraSnapshot(),
          0,
          this.#dynamicEnvironmentPoseState.dynamicEnvironmentPoseOverrides
        );
      }

      this.#booted = true;
    })();

    try {
      await this.#bootPromise;
    } finally {
      if (this.#bootPromise !== null) {
        this.#bootPromise = null;
      }
    }
  }

  clearDynamicEnvironmentPoseOverrides(): void {
    this.#dynamicEnvironmentPoseState.clear();
  }

  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    nowMs: number
  ): void {
    if (this.#runtime === null) {
      return;
    }

    syncEnvironmentProofRuntime(
      this.#runtime,
      cameraSnapshot,
      nowMs,
      this.#dynamicEnvironmentPoseState.dynamicEnvironmentPoseOverrides
    );
  }

  readDynamicEnvironmentPose(
    environmentAssetId: string
  ): DynamicEnvironmentPoseSnapshot | null {
    return this.#dynamicEnvironmentPoseState.readDynamicEnvironmentPose(
      this.#runtime,
      environmentAssetId
    );
  }

  readMountedEnvironmentAnchorSnapshot(
    mountedEnvironment: MountedEnvironmentSnapshot
  ) {
    return this.#dynamicEnvironmentPoseState.readMountedEnvironmentAnchorSnapshot(
      this.#runtime,
      mountedEnvironment
    );
  }

  setDynamicEnvironmentPose(
    environmentAssetId: string,
    poseSnapshot: DynamicEnvironmentPoseSnapshot | null
  ): void {
    this.#dynamicEnvironmentPoseState.setDynamicEnvironmentPose(
      environmentAssetId,
      poseSnapshot
    );
  }
}
