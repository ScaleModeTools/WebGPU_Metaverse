import type { Camera, Scene } from "three/webgpu";

import type { MetaverseHudSnapshot } from "../types/metaverse-runtime";

interface MetaverseRuntimeStartCoordinatorRendererHost {
  readonly info?: {
    readonly render?: {
      readonly calls?: number;
      readonly drawCalls?: number;
      readonly triangles?: number;
    };
  };
  compileAsync?(scene: Scene, camera: Camera): Promise<void>;
  init(): Promise<void | MetaverseRuntimeStartCoordinatorRendererHost>;
  render(scene: Scene, camera: Camera): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  dispose(): void;
}

interface MetaverseRuntimeStartCoordinatorRenderSession {
  activate(
    canvas: HTMLCanvasElement,
    renderer: MetaverseRuntimeStartCoordinatorRendererHost
  ): void;
  cancelQueuedFrame(): void;
  clearActiveSurfaceIfMatching(
    canvas: HTMLCanvasElement,
    renderer: MetaverseRuntimeStartCoordinatorRendererHost
  ): void;
  disposeActiveRenderer(): void;
  matchesActiveSurface(
    canvas: HTMLCanvasElement,
    renderer: MetaverseRuntimeStartCoordinatorRendererHost
  ): boolean;
  publishLifecycleSnapshot(
    lifecycle: MetaverseHudSnapshot["lifecycle"],
    failureReason: string | null,
    forceUiUpdate: boolean,
    nowMs?: number | null
  ): void;
  queueNextFrame(): void;
  syncFrame(nowMs: number, forceUiUpdate: boolean): void;
}

interface MetaverseRuntimeStartCoordinatorServiceLifecycle {
  activateBootedRuntimeServices(input: {
    readonly canvas: HTMLCanvasElement;
    readonly queueNextFrame: () => void;
    readonly syncFrame: (nowMs: number, forceUiUpdate: boolean) => void;
  }): void;
  beginBootRuntimeServices(input: {
    readonly canvas: HTMLCanvasElement;
    readonly publishHudSnapshot: (
      lifecycle: MetaverseHudSnapshot["lifecycle"],
      failureReason: string | null,
      forceUiUpdate: boolean
    ) => void;
    readonly renderer: MetaverseRuntimeStartCoordinatorRendererHost;
  }): Promise<void>;
  cleanupBootAttempt(input: {
    readonly clearActiveSurface: () => void;
    readonly renderer: MetaverseRuntimeStartCoordinatorRendererHost;
  }): void;
  disposeRuntimeServices(): void;
  resetForStart(): void;
}

interface MetaverseRuntimeStartCoordinatorDependencies {
  readonly createRenderer: (
    canvas: HTMLCanvasElement
  ) => MetaverseRuntimeStartCoordinatorRendererHost;
  readonly readHudSnapshot: () => MetaverseHudSnapshot;
  readonly renderSession: MetaverseRuntimeStartCoordinatorRenderSession;
  readonly serviceLifecycle: MetaverseRuntimeStartCoordinatorServiceLifecycle;
}

function resolveRuntimeFailureReason(error: unknown): string {
  if (
    error instanceof Error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return `WebGPU metaverse failed to initialize: ${error.message}`;
  }

  return "WebGPU metaverse failed to initialize.";
}

export class MetaverseRuntimeStartCoordinator {
  readonly #createRenderer: (
    canvas: HTMLCanvasElement
  ) => MetaverseRuntimeStartCoordinatorRendererHost;
  readonly #readHudSnapshot: () => MetaverseHudSnapshot;
  readonly #renderSession: MetaverseRuntimeStartCoordinatorRenderSession;
  readonly #serviceLifecycle: MetaverseRuntimeStartCoordinatorServiceLifecycle;

  #runtimeEpoch = 0;
  #startPromise: Promise<MetaverseHudSnapshot> | null = null;

  constructor({
    createRenderer,
    readHudSnapshot,
    renderSession,
    serviceLifecycle
  }: MetaverseRuntimeStartCoordinatorDependencies) {
    this.#createRenderer = createRenderer;
    this.#readHudSnapshot = readHudSnapshot;
    this.#renderSession = renderSession;
    this.#serviceLifecycle = serviceLifecycle;
  }

  async start(
    canvas: HTMLCanvasElement,
    navigatorLike: Navigator | null | undefined = globalThis.window?.navigator
  ): Promise<MetaverseHudSnapshot> {
    if (this.#startPromise !== null) {
      this.dispose();

      try {
        await this.#startPromise;
      } catch {
        // Disposal makes stale boot failures non-actionable for the next start.
      }
    }

    const startPromise = this.#startInternal(canvas, navigatorLike);
    this.#startPromise = startPromise;

    try {
      return await startPromise;
    } finally {
      if (this.#startPromise === startPromise) {
        this.#startPromise = null;
      }
    }
  }

  dispose(): void {
    this.#runtimeEpoch += 1;
    this.#renderSession.cancelQueuedFrame();
    this.#renderSession.disposeActiveRenderer();
    this.#serviceLifecycle.disposeRuntimeServices();

    if (this.#readHudSnapshot().lifecycle !== "failed") {
      this.#renderSession.publishLifecycleSnapshot("idle", null, true);
    }
  }

  async #startInternal(
    canvas: HTMLCanvasElement,
    navigatorLike: Navigator | null | undefined
  ): Promise<MetaverseHudSnapshot> {
    this.dispose();
    const runtimeEpoch = ++this.#runtimeEpoch;

    if (navigatorLike?.gpu === undefined) {
      const failureReason = "WebGPU is unavailable for the metaverse runtime.";

      this.#renderSession.publishLifecycleSnapshot("failed", failureReason, true);
      throw new Error(failureReason);
    }

    this.#serviceLifecycle.resetForStart();
    const renderer = this.#createRenderer(canvas);

    this.#renderSession.activate(canvas, renderer);

    try {
      await this.#serviceLifecycle.beginBootRuntimeServices({
        canvas,
        publishHudSnapshot: (lifecycle, failureReason, forceUiUpdate) =>
          this.#renderSession.publishLifecycleSnapshot(
            lifecycle,
            failureReason,
            forceUiUpdate
          ),
        renderer
      });
    } catch (error) {
      this.#serviceLifecycle.cleanupBootAttempt({
        clearActiveSurface: () =>
          this.#renderSession.clearActiveSurfaceIfMatching(canvas, renderer),
        renderer
      });

      if (runtimeEpoch === this.#runtimeEpoch) {
        const failureReason = resolveRuntimeFailureReason(error);

        this.#renderSession.publishLifecycleSnapshot(
          "failed",
          failureReason,
          true
        );
        throw new Error(failureReason);
      }

      throw error instanceof Error
        ? error
        : new Error(resolveRuntimeFailureReason(error));
    }

    if (
      runtimeEpoch !== this.#runtimeEpoch ||
      !this.#renderSession.matchesActiveSurface(canvas, renderer)
    ) {
      this.#serviceLifecycle.cleanupBootAttempt({
        clearActiveSurface: () =>
          this.#renderSession.clearActiveSurfaceIfMatching(canvas, renderer),
        renderer
      });

      return this.#readHudSnapshot();
    }

    this.#serviceLifecycle.activateBootedRuntimeServices({
      canvas,
      queueNextFrame: () => this.#renderSession.queueNextFrame(),
      syncFrame: (nowMs, forceUiUpdate) =>
        this.#renderSession.syncFrame(nowMs, forceUiUpdate)
    });

    return this.#readHudSnapshot();
  }
}
