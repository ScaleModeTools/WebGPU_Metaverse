import type { Camera, Scene } from "three/webgpu";

import type { MetaverseSceneCanvasHost } from "../render/webgpu-metaverse-scene";
import type {
  FocusedExperiencePortalSnapshot,
  MetaverseHudSnapshot,
  MetaverseMountedInteractionSnapshot
} from "../types/metaverse-runtime";

interface MetaverseRuntimeRenderSessionRendererHost {
  readonly info?: {
    readonly render?: {
      readonly calls?: number;
      readonly drawCalls?: number;
      readonly triangles?: number;
    };
  };
  render(scene: Scene, camera: Camera): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  dispose(): void;
}

interface MetaverseRuntimeRenderSessionBootLifecycle {
  readonly bootRendererInitialized: boolean;
  readonly bootScenePrewarmed: boolean;
}

interface MetaverseRuntimeRenderSessionFrameLoop {
  readonly cameraPhaseId: MetaverseHudSnapshot["cameraPhaseId"];
  readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
  readonly frameDeltaMs: number;
  readonly frameRate: number;
  readonly mountedInteraction: MetaverseMountedInteractionSnapshot;
  readonly renderedFrameCount: number;
  syncFrame(input: {
    readonly canvas: MetaverseSceneCanvasHost;
    readonly nowMs: number;
    readonly renderer: MetaverseRuntimeRenderSessionRendererHost;
  }): void;
}

interface MetaverseRuntimeRenderSessionHudPublisher {
  readonly hudSnapshot: MetaverseHudSnapshot;
  publishSnapshot(
    input: {
      readonly bootRendererInitialized: boolean;
      readonly bootScenePrewarmed: boolean;
      readonly cameraPhaseId: MetaverseHudSnapshot["cameraPhaseId"];
      readonly controlMode: MetaverseHudSnapshot["controlMode"];
      readonly failureReason: string | null;
      readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
      readonly frameDeltaMs: number;
      readonly frameRate: number;
      readonly lifecycle: MetaverseHudSnapshot["lifecycle"];
      readonly mountedInteraction: MetaverseMountedInteractionSnapshot;
      readonly renderedFrameCount: number;
      readonly renderer: MetaverseRuntimeRenderSessionRendererHost | null;
    },
    forceUiUpdate: boolean,
    nowMs: number | null
  ): void;
}

interface MetaverseRuntimeRenderSessionDependencies {
  readonly bootLifecycle: MetaverseRuntimeRenderSessionBootLifecycle;
  readonly cancelAnimationFrame: typeof globalThis.cancelAnimationFrame;
  readonly frameLoop: MetaverseRuntimeRenderSessionFrameLoop;
  readonly hudPublisher: MetaverseRuntimeRenderSessionHudPublisher;
  readonly readControlMode: () => MetaverseHudSnapshot["controlMode"];
  readonly readNowMs: () => number;
  readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame;
}

export class MetaverseRuntimeRenderSession {
  readonly #bootLifecycle: MetaverseRuntimeRenderSessionBootLifecycle;
  readonly #cancelAnimationFrame: typeof globalThis.cancelAnimationFrame;
  readonly #frameLoop: MetaverseRuntimeRenderSessionFrameLoop;
  readonly #hudPublisher: MetaverseRuntimeRenderSessionHudPublisher;
  readonly #readControlMode: () => MetaverseHudSnapshot["controlMode"];
  readonly #readNowMs: () => number;
  readonly #requestAnimationFrame: typeof globalThis.requestAnimationFrame;

  #animationFrameHandle = 0;
  #canvas: HTMLCanvasElement | null = null;
  #renderer: MetaverseRuntimeRenderSessionRendererHost | null = null;

  constructor({
    bootLifecycle,
    cancelAnimationFrame,
    frameLoop,
    hudPublisher,
    readControlMode,
    readNowMs,
    requestAnimationFrame
  }: MetaverseRuntimeRenderSessionDependencies) {
    this.#bootLifecycle = bootLifecycle;
    this.#cancelAnimationFrame = cancelAnimationFrame;
    this.#frameLoop = frameLoop;
    this.#hudPublisher = hudPublisher;
    this.#readControlMode = readControlMode;
    this.#readNowMs = readNowMs;
    this.#requestAnimationFrame = requestAnimationFrame;
  }

  activate(
    canvas: HTMLCanvasElement,
    renderer: MetaverseRuntimeRenderSessionRendererHost
  ): void {
    this.#canvas = canvas;
    this.#renderer = renderer;
  }

  matchesActiveSurface(
    canvas: HTMLCanvasElement,
    renderer: MetaverseRuntimeRenderSessionRendererHost
  ): boolean {
    return this.#canvas === canvas && this.#renderer === renderer;
  }

  clearActiveSurfaceIfMatching(
    canvas: HTMLCanvasElement,
    renderer: MetaverseRuntimeRenderSessionRendererHost
  ): void {
    if (!this.matchesActiveSurface(canvas, renderer)) {
      return;
    }

    this.#renderer = null;
    this.#canvas = null;
  }

  cancelQueuedFrame(): void {
    if (this.#animationFrameHandle === 0) {
      return;
    }

    this.#cancelAnimationFrame(this.#animationFrameHandle);
    this.#animationFrameHandle = 0;
  }

  disposeActiveRenderer(): void {
    this.#renderer?.dispose();
    this.#renderer = null;
    this.#canvas = null;
  }

  queueNextFrame(): void {
    this.#animationFrameHandle = this.#requestAnimationFrame((nextFrameAtMs) => {
      this.#animationFrameHandle = 0;
      this.syncFrame(nextFrameAtMs, false);
      this.queueNextFrame();
    });
  }

  syncFrame(nowMs: number, forceUiUpdate: boolean): void {
    if (this.#renderer === null || this.#canvas === null) {
      return;
    }

    this.#frameLoop.syncFrame({
      canvas: this.#canvas as MetaverseSceneCanvasHost,
      nowMs,
      renderer: this.#renderer
    });
    this.publishLifecycleSnapshot("running", null, forceUiUpdate, nowMs);
  }

  syncOrPublishRuntimeState(forceUiUpdate: boolean): void {
    if (this.#renderer !== null && this.#canvas !== null) {
      this.syncFrame(this.#readNowMs(), forceUiUpdate);
      return;
    }

    this.publishLifecycleSnapshot(
      this.#hudPublisher.hudSnapshot.lifecycle,
      this.#hudPublisher.hudSnapshot.failureReason,
      forceUiUpdate
    );
  }

  publishRuntimeHudSnapshot(forceUiUpdate: boolean): void {
    this.publishLifecycleSnapshot(
      this.#hudPublisher.hudSnapshot.lifecycle,
      this.#hudPublisher.hudSnapshot.failureReason,
      forceUiUpdate
    );
  }

  publishLifecycleSnapshot(
    lifecycle: MetaverseHudSnapshot["lifecycle"],
    failureReason: string | null,
    forceUiUpdate: boolean,
    nowMs: number | null = null
  ): void {
    this.#hudPublisher.publishSnapshot(
      {
        bootRendererInitialized: this.#bootLifecycle.bootRendererInitialized,
        bootScenePrewarmed: this.#bootLifecycle.bootScenePrewarmed,
        cameraPhaseId: this.#frameLoop.cameraPhaseId,
        controlMode: this.#readControlMode(),
        failureReason,
        focusedPortal: this.#frameLoop.focusedPortal,
        frameDeltaMs: this.#frameLoop.frameDeltaMs,
        frameRate: this.#frameLoop.frameRate,
        lifecycle,
        mountedInteraction: this.#frameLoop.mountedInteraction,
        renderedFrameCount: this.#frameLoop.renderedFrameCount,
        renderer: this.#renderer
      },
      forceUiUpdate,
      nowMs
    );
  }
}
