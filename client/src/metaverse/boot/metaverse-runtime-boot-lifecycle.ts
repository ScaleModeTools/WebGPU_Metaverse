import type { Camera, Scene } from "three/webgpu";
import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";

import type { MetaverseRuntimeCameraPhaseState } from "../classes/metaverse-runtime-camera-phase-state";
import type { MetaverseSceneRendererHost } from "../render/webgpu-metaverse-scene";
import type {
  FocusedExperiencePortalSnapshot,
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";

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
    localCharacterPresentation: MetaverseCharacterPresentationSnapshot | null,
    localWeaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null,
    localWeaponAdsBlend: number | null,
    remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[],
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void;
  syncViewport(
    renderer: MetaverseRuntimeBootRendererHost,
    canvas: MetaverseRuntimeBootCanvasHost,
    devicePixelRatio: number
  ): void;
}

interface MetaverseRuntimeBootLifecycleDependencies {
  readonly cancelAnimationFrame: (frameHandle: number) => void;
  readonly cameraPhaseState: MetaverseRuntimeCameraPhaseState;
  readonly devicePixelRatio: number;
  readonly readNowMs: () => number;
  readonly requestAnimationFrame: (callback: (nowMs: number) => void) => number;
  readonly sceneRuntime: MetaverseRuntimeBootSceneRuntime;
}

interface MetaverseRuntimeBootRequest {
  readonly bootGroundedRuntime: () => Promise<void>;
  readonly canvas: MetaverseRuntimeBootCanvasHost;
  readonly renderer: MetaverseRuntimeBootRendererHost;
}

export class MetaverseRuntimeBootLifecycle {
  readonly #cancelAnimationFrame: (frameHandle: number) => void;
  readonly #cameraPhaseState: MetaverseRuntimeCameraPhaseState;
  readonly #devicePixelRatio: number;
  readonly #readNowMs: () => number;
  readonly #requestAnimationFrame: (callback: (nowMs: number) => void) => number;
  readonly #sceneRuntime: MetaverseRuntimeBootSceneRuntime;

  #bootRendererInitialized = false;
  #bootScenePrewarmed = false;
  #entryPreviewFrameHandle: number | null = null;
  #runtimeInputInstalled = false;

  constructor({
    cancelAnimationFrame,
    cameraPhaseState,
    devicePixelRatio,
    readNowMs,
    requestAnimationFrame,
    sceneRuntime
  }: MetaverseRuntimeBootLifecycleDependencies) {
    this.#cancelAnimationFrame = cancelAnimationFrame;
    this.#cameraPhaseState = cameraPhaseState;
    this.#devicePixelRatio = devicePixelRatio;
    this.#readNowMs = readNowMs;
    this.#requestAnimationFrame = requestAnimationFrame;
    this.#sceneRuntime = sceneRuntime;
  }

  get bootRendererInitialized(): boolean {
    return this.#bootRendererInitialized;
  }

  get bootScenePrewarmed(): boolean {
    return this.#bootScenePrewarmed;
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

  setDeathCameraSnapshot(snapshot: MetaverseCameraSnapshot | null): void {
    this.#cameraPhaseState.setDeathCameraSnapshot(snapshot);
  }

  setGameplayControlLocked(locked: boolean): void {
    this.#cameraPhaseState.setGameplayControlLocked(locked);
  }

  setRespawnControlLocked(locked: boolean): void {
    this.#cameraPhaseState.setRespawnControlLocked(locked);
  }

  resolveRuntimeCameraPhaseState(
    input: Parameters<
      MetaverseRuntimeCameraPhaseState["resolveRuntimeCameraPhaseState"]
    >[0]
  ): ReturnType<MetaverseRuntimeCameraPhaseState["resolveRuntimeCameraPhaseState"]> {
    return this.#cameraPhaseState.resolveRuntimeCameraPhaseState(input);
  }

  reset(): void {
    this.#stopEntryPreviewFrameLoop();
    this.#cameraPhaseState.reset();
    this.#bootRendererInitialized = false;
    this.#bootScenePrewarmed = false;
    this.#runtimeInputInstalled = false;
  }

  async bootRuntime({
    bootGroundedRuntime,
    canvas,
    renderer
  }: MetaverseRuntimeBootRequest): Promise<void> {
    this.reset();

    await renderer.init();
    this.#bootRendererInitialized = true;

    const entryPreviewEnabled = this.#cameraPhaseState.entryPreviewEnabled;

    if (entryPreviewEnabled) {
      this.#cameraPhaseState.startEntryPreview(this.#readNowMs());
      await this.#sceneRuntime.bootScenicEnvironment();
      this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
      this.#renderEntryPreviewFrame(renderer, canvas, this.#readNowMs());
      this.#startEntryPreviewFrameLoop(renderer, canvas);
      try {
        await this.#sceneRuntime.prewarm(renderer);
        await bootGroundedRuntime();
        await this.#sceneRuntime.bootInteractivePresentation();
        this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
        await this.#sceneRuntime.prewarm(renderer);
        this.#cameraPhaseState.markEntryPreviewLiveReady(this.#readNowMs());
      } finally {
        this.#stopEntryPreviewFrameLoop();
      }
      this.#renderEntryPreviewFrame(renderer, canvas, this.#readNowMs());
    } else {
      await this.#sceneRuntime.boot();
      await bootGroundedRuntime();
      this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
      await this.#sceneRuntime.prewarm(renderer);
    }

    this.#bootScenePrewarmed = true;
  }

  #startEntryPreviewFrameLoop(
    renderer: MetaverseRuntimeBootRendererHost,
    canvas: MetaverseRuntimeBootCanvasHost
  ): void {
    if (this.#entryPreviewFrameHandle !== null) {
      return;
    }

    const renderNextFrame = () => {
      this.#entryPreviewFrameHandle = null;
      this.#renderEntryPreviewFrame(renderer, canvas, this.#readNowMs());
      this.#entryPreviewFrameHandle =
        this.#requestAnimationFrame(renderNextFrame);
    };

    this.#entryPreviewFrameHandle =
      this.#requestAnimationFrame(renderNextFrame);
  }

  #stopEntryPreviewFrameLoop(): void {
    if (this.#entryPreviewFrameHandle === null) {
      return;
    }

    this.#cancelAnimationFrame(this.#entryPreviewFrameHandle);
    this.#entryPreviewFrameHandle = null;
  }

  #renderEntryPreviewFrame(
    renderer: MetaverseRuntimeBootRendererHost,
    canvas: MetaverseRuntimeBootCanvasHost,
    nowMs: number
  ): void {
    const previewSnapshot =
      this.#cameraPhaseState.resolveBootPresentationSnapshot(nowMs);

    if (previewSnapshot === null) {
      return;
    }

    this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
    this.#sceneRuntime.syncPresentation(
      previewSnapshot.cameraSnapshot,
      previewSnapshot.focusedPortal,
      nowMs,
      0,
      null,
      null,
      null,
      emptyRemoteCharacterPresentations,
      null
    );
    renderer.render(this.#sceneRuntime.scene, this.#sceneRuntime.camera);
  }
}
