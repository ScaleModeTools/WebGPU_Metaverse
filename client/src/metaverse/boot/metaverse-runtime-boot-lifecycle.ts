import type { Camera, Scene } from "three/webgpu";

import {
  resolveMetaverseBootCinematicPresentationSnapshot,
  type MetaverseBootCinematicPresentationSnapshot
} from "../states/metaverse-boot-cinematic";
import type { MetaverseSceneRendererHost } from "../render/webgpu-metaverse-scene";
import type {
  FocusedExperiencePortalSnapshot,
  MetaverseCameraSnapshot,
  MetaversePortalConfig
} from "../types/metaverse-runtime";
import type { MetaverseBootCinematicConfig } from "../types/metaverse-boot-cinematic";

const emptyRemoteCharacterPresentations = Object.freeze([]);

interface MetaverseRuntimeBootCanvasHost {
  readonly clientHeight: number;
  readonly clientWidth: number;
}

interface MetaverseRuntimeBootFlightInputRuntime {
  install(canvas: MetaverseRuntimeBootCanvasHost): void;
}

interface MetaverseRuntimeBootRendererHost extends MetaverseSceneRendererHost {
  init(): Promise<void | MetaverseRuntimeBootRendererHost>;
  render(scene: Scene, camera: Camera): void;
}

interface MetaverseRuntimeBootSceneRuntime {
  readonly camera: Camera;
  readonly scene: Scene;
  boot(): Promise<void>;
  bootInteractivePresentation(): Promise<void>;
  bootScenicEnvironment(): Promise<void>;
  prewarm(renderer: MetaverseRuntimeBootRendererHost): Promise<void>;
  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    focusedPortal: FocusedExperiencePortalSnapshot | null,
    nowMs: number,
    deltaSeconds: number,
    localCharacterPresentation: null,
    remoteCharacterPresentations: typeof emptyRemoteCharacterPresentations,
    mountedEnvironment: null
  ): void;
  syncViewport(
    renderer: MetaverseRuntimeBootRendererHost,
    canvas: MetaverseRuntimeBootCanvasHost,
    devicePixelRatio: number
  ): void;
}

interface MetaverseRuntimeBootLifecycleDependencies {
  readonly bootCinematicConfig: MetaverseBootCinematicConfig;
  readonly devicePixelRatio: number;
  readonly portals: readonly MetaversePortalConfig[];
  readonly readNowMs: () => number;
  readonly sceneRuntime: MetaverseRuntimeBootSceneRuntime;
}

interface MetaverseRuntimeBootRequest {
  readonly bootGroundedRuntime: () => Promise<void>;
  readonly canvas: MetaverseRuntimeBootCanvasHost;
  readonly renderer: MetaverseRuntimeBootRendererHost;
}

export class MetaverseRuntimeBootLifecycle {
  readonly #bootCinematicConfig: MetaverseBootCinematicConfig;
  readonly #devicePixelRatio: number;
  readonly #portals: readonly MetaversePortalConfig[];
  readonly #readNowMs: () => number;
  readonly #sceneRuntime: MetaverseRuntimeBootSceneRuntime;

  #bootCinematicLiveReadyAtMs: number | null = null;
  #bootCinematicStartedAtMs: number | null = null;
  #bootRendererInitialized = false;
  #bootScenePrewarmed = false;
  #runtimeInputInstalled = false;

  constructor({
    bootCinematicConfig,
    devicePixelRatio,
    portals,
    readNowMs,
    sceneRuntime
  }: MetaverseRuntimeBootLifecycleDependencies) {
    this.#bootCinematicConfig = bootCinematicConfig;
    this.#devicePixelRatio = devicePixelRatio;
    this.#portals = portals;
    this.#readNowMs = readNowMs;
    this.#sceneRuntime = sceneRuntime;
  }

  get bootRendererInitialized(): boolean {
    return this.#bootRendererInitialized;
  }

  get bootScenePrewarmed(): boolean {
    return this.#bootScenePrewarmed;
  }

  get bootCinematicEnabled(): boolean {
    return this.#bootCinematicConfig.enabled;
  }

  reset(): void {
    this.#bootCinematicLiveReadyAtMs = null;
    this.#bootCinematicStartedAtMs = null;
    this.#bootRendererInitialized = false;
    this.#bootScenePrewarmed = false;
    this.#runtimeInputInstalled = false;
  }

  ensureRuntimeInputInstalled(
    canvas: MetaverseRuntimeBootCanvasHost,
    flightInputRuntime: MetaverseRuntimeBootFlightInputRuntime
  ): void {
    if (this.#runtimeInputInstalled) {
      return;
    }

    flightInputRuntime.install(canvas);
    this.#runtimeInputInstalled = true;
  }

  isBootCinematicActive(nowMs: number): boolean {
    if (
      !this.#bootCinematicConfig.enabled ||
      this.#bootCinematicStartedAtMs === null
    ) {
      return false;
    }

    if (this.#bootCinematicLiveReadyAtMs === null) {
      return true;
    }

    return (
      nowMs - this.#bootCinematicLiveReadyAtMs <
      this.#bootCinematicConfig.minimumDwellMs
    );
  }

  resolveBootCinematicPresentationSnapshot(
    nowMs: number,
    environmentReady: boolean = this.#bootScenePrewarmed
  ): MetaverseBootCinematicPresentationSnapshot | null {
    if (this.#bootCinematicStartedAtMs === null) {
      return null;
    }

    return resolveMetaverseBootCinematicPresentationSnapshot(
      this.#bootCinematicConfig,
      nowMs - this.#bootCinematicStartedAtMs,
      {
        environmentReady
      },
      this.#portals
    );
  }

  async bootRuntime({
    bootGroundedRuntime,
    canvas,
    renderer
  }: MetaverseRuntimeBootRequest): Promise<void> {
    this.reset();

    await renderer.init();
    this.#bootRendererInitialized = true;

    if (this.#bootCinematicConfig.enabled) {
      this.#bootCinematicStartedAtMs = this.#readNowMs();
      this.#renderBootCinematicFrame(renderer, canvas, this.#bootCinematicStartedAtMs, false);
      await this.#sceneRuntime.bootScenicEnvironment();
      this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
      this.#renderBootCinematicFrame(renderer, canvas, this.#readNowMs(), true);
      await this.#sceneRuntime.prewarm(renderer);
      this.#renderBootCinematicFrame(renderer, canvas, this.#readNowMs(), true);
      await bootGroundedRuntime();
      await this.#sceneRuntime.bootInteractivePresentation();
      this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
      await this.#sceneRuntime.prewarm(renderer);
      this.#renderBootCinematicFrame(renderer, canvas, this.#readNowMs(), true);
      this.#bootCinematicLiveReadyAtMs = this.#readNowMs();
    } else {
      await this.#sceneRuntime.boot();
      await bootGroundedRuntime();
      this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
      await this.#sceneRuntime.prewarm(renderer);
    }

    this.#bootScenePrewarmed = true;
  }

  #renderBootCinematicFrame(
    renderer: MetaverseRuntimeBootRendererHost,
    canvas: MetaverseRuntimeBootCanvasHost,
    nowMs: number,
    environmentReady: boolean
  ): void {
    if (this.#bootCinematicStartedAtMs === null) {
      return;
    }

    const bootCinematicSnapshot = this.resolveBootCinematicPresentationSnapshot(
      nowMs,
      environmentReady
    );

    if (bootCinematicSnapshot === null) {
      return;
    }

    this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
    this.#sceneRuntime.syncPresentation(
      bootCinematicSnapshot.cameraSnapshot,
      bootCinematicSnapshot.focusedPortal,
      nowMs,
      0,
      null,
      emptyRemoteCharacterPresentations,
      null
    );
    renderer.render(this.#sceneRuntime.scene, this.#sceneRuntime.camera);
  }
}
