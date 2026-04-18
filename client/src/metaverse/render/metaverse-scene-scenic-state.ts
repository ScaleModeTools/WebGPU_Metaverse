import { PerspectiveCamera, Scene } from "three/webgpu";

import {
  syncMetaverseSceneViewport,
  type MetaverseSceneCanvasHost,
  type MetaverseSceneRendererHost
} from "./camera/metaverse-scene-camera";
import { createMetaverseSceneEnvironment } from "./environment/metaverse-scene-environment";
import { markMetaverseSceneBundleGroupsDirty } from "./metaverse-scene-bundle-groups";
import {
  createPortalMeshRuntime,
  createPortalSharedRenderResources,
  type PortalMeshRuntime
} from "./portals/metaverse-scene-portals";

import type { MetaverseRuntimeConfig } from "../types/metaverse-runtime";

interface MetaverseSceneScenicStateDependencies {
  readonly camera: PerspectiveCamera;
  readonly config: MetaverseRuntimeConfig;
  readonly scene: Scene;
}

export class MetaverseSceneScenicState {
  readonly #camera: PerspectiveCamera;
  readonly #scene: Scene;
  #previousViewportHeight: number | null = null;
  #previousViewportWidth: number | null = null;

  readonly portalMeshes: readonly PortalMeshRuntime[];

  constructor({
    camera,
    config,
    scene
  }: MetaverseSceneScenicStateDependencies) {
    this.#camera = camera;
    this.#scene = scene;

    const environmentRuntime = createMetaverseSceneEnvironment(config);
    const portalSharedRenderResources = createPortalSharedRenderResources();

    this.portalMeshes = config.portals.map((portalConfig) =>
      createPortalMeshRuntime(portalConfig, portalSharedRenderResources)
    );

    scene.background = environmentRuntime.backgroundColor;
    scene.fog = environmentRuntime.fog;
    scene.add(
      environmentRuntime.hemisphereLight,
      environmentRuntime.sunLight,
      environmentRuntime.skyMesh,
      environmentRuntime.waterGroup
    );

    for (const portalMesh of this.portalMeshes) {
      scene.add(portalMesh.anchorGroup);
    }
  }

  syncViewport(
    renderer: MetaverseSceneRendererHost,
    canvasHost: MetaverseSceneCanvasHost,
    devicePixelRatio: number
  ): void {
    const viewportUpdate = syncMetaverseSceneViewport(
      this.#camera,
      renderer,
      canvasHost,
      devicePixelRatio,
      this.#previousViewportWidth,
      this.#previousViewportHeight
    );

    this.#previousViewportWidth = viewportUpdate.width;
    this.#previousViewportHeight = viewportUpdate.height;

    if (viewportUpdate.viewportChanged) {
      markMetaverseSceneBundleGroupsDirty(this.#scene);
    }
  }
}
