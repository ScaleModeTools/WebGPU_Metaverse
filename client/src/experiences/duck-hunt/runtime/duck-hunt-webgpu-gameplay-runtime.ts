import type { NormalizedViewportPoint } from "@webgpu-metaverse/shared";
import {
  ACESFilmicToneMapping,
  type Camera,
  type Scene,
  SRGBColorSpace,
  WebGPURenderer
} from "three/webgpu";

import { duckHuntGameplayRuntimeConfig } from "../config/duck-hunt-gameplay-runtime";
import {
  resolveGameplayReticleVisualState
} from "../render/duck-hunt-gameplay-reticle-presentation";
import {
  createGameplayScene,
  type GameplaySceneCanvasHost
} from "../render/duck-hunt-webgpu-gameplay-scene";
import type { GameplayReticleVisualState } from "../types/duck-hunt-gameplay-presentation";
import type { GameplayArenaRuntime } from "../types/duck-hunt-gameplay-arena-runtime";
import type {
  GameplayArenaHudSnapshot,
  GameplayViewportSnapshot,
  GameplayHudSnapshot,
  GameplayRuntimeConfig
} from "../types/duck-hunt-gameplay-runtime";
import type { LatestHandTrackingSnapshot } from "../../../tracking";

interface GameplayTrackingSource {
  readonly latestPose: LatestHandTrackingSnapshot;
}

interface GameplayRendererHost {
  init(): Promise<void | GameplayRendererHost>;
  render(scene: Scene, camera: Camera): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  dispose(): void;
}

interface GameplayRuntimeDependencies {
  readonly cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame;
  readonly createRenderer?: (
    canvas: HTMLCanvasElement
  ) => GameplayRendererHost;
  readonly devicePixelRatio?: number;
  readonly readNowMs?: () => number;
  readonly requestAnimationFrame?: typeof globalThis.requestAnimationFrame;
}

interface GameplayRendererTuningHandle {
  outputColorSpace?: string;
  toneMapping?: number;
  toneMappingExposure?: number;
}

function createDefaultRenderer(canvas: HTMLCanvasElement): GameplayRendererHost {
  const renderer = new WebGPURenderer({
    alpha: true,
    antialias: true,
    canvas
  });
  const tuningHandle = renderer as GameplayRendererHost &
    GameplayRendererTuningHandle;

  tuningHandle.toneMapping = ACESFilmicToneMapping;
  tuningHandle.toneMappingExposure = 1.05;
  tuningHandle.outputColorSpace = SRGBColorSpace;

  return renderer;
}

function freezeHudSnapshot(
  lifecycle: GameplayHudSnapshot["lifecycle"],
  failureReason: string | null,
  arenaHudSnapshot: GameplayArenaHudSnapshot
): GameplayHudSnapshot {
  return Object.freeze({
    aimPoint: arenaHudSnapshot.aimPoint,
    arena: arenaHudSnapshot.arena,
    failureReason,
    lifecycle,
    session: arenaHudSnapshot.session,
    targetFeedback: arenaHudSnapshot.targetFeedback,
    trackingState: arenaHudSnapshot.trackingState,
    weapon: arenaHudSnapshot.weapon
  });
}

function readNowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function requestBrowserAnimationFrame(callback: FrameRequestCallback): number {
  if (typeof globalThis.window?.requestAnimationFrame !== "function") {
    throw new Error("requestAnimationFrame is unavailable for gameplay rendering.");
  }

  return globalThis.window.requestAnimationFrame(callback);
}

function cancelBrowserAnimationFrame(frameHandle: number): void {
  if (typeof globalThis.window?.cancelAnimationFrame !== "function") {
    return;
  }

  globalThis.window.cancelAnimationFrame(frameHandle);
}

function resolveRuntimeFailureReason(error: unknown): string {
  if (
    error instanceof Error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return `WebGPU gameplay failed to initialize: ${error.message}`;
  }

  return "WebGPU gameplay failed to initialize.";
}

function resolveRenderLoopFailureReason(error: unknown): string {
  if (
    error instanceof Error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return `WebGPU gameplay failed during rendering: ${error.message}`;
  }

  return "WebGPU gameplay failed during rendering.";
}

function readViewportSnapshot(
  canvasHost: GameplaySceneCanvasHost | null
): GameplayViewportSnapshot {
  return Object.freeze({
    height: Math.max(1, canvasHost?.clientHeight ?? 1),
    width: Math.max(1, canvasHost?.clientWidth ?? 1)
  });
}

let pendingGameplayBoot: Promise<void> | null = null;

async function withGameplayBootLock<T>(task: () => Promise<T>): Promise<T> {
  const previousBoot = pendingGameplayBoot;
  let releaseBoot!: () => void;
  const currentBoot = new Promise<void>((resolve) => {
    releaseBoot = resolve;
  });

  pendingGameplayBoot = currentBoot;

  if (previousBoot !== null) {
    await previousBoot;
  }

  try {
    return await task();
  } finally {
    releaseBoot();

    if (pendingGameplayBoot === currentBoot) {
      pendingGameplayBoot = null;
    }
  }
}

const gameplayUiUpdateIntervalMs = 150;

type ReticleUpdateListener = (
  aimPoint: NormalizedViewportPoint | null,
  visualState: GameplayReticleVisualState
) => void;

export class DuckHuntWebGpuGameplayRuntime {
  readonly #arenaSimulation: GameplayArenaRuntime;
  readonly #config: GameplayRuntimeConfig;
  readonly #createRenderer: (canvas: HTMLCanvasElement) => GameplayRendererHost;
  readonly #devicePixelRatio: number;
  readonly #readNowMs: () => number;
  readonly #requestAnimationFrame: typeof globalThis.requestAnimationFrame;
  readonly #cancelAnimationFrame: typeof globalThis.cancelAnimationFrame;
  readonly #gameplayScene: ReturnType<typeof createGameplayScene>;
  readonly #trackingSource: GameplayTrackingSource;
  readonly #reticleUpdateListeners = new Set<ReticleUpdateListener>();
  readonly #uiUpdateListeners = new Set<() => void>();

  #animationFrameHandle = 0;
  #animationStartAtMs = 0;
  #canvasHost: GameplaySceneCanvasHost | null = null;
  #hudSnapshot: GameplayHudSnapshot;
  #lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;
  #renderer: GameplayRendererHost | null = null;
  #reticleVisualState: GameplayReticleVisualState = "hidden";
  #runtimeEpoch = 0;
  #startPromise: Promise<GameplayHudSnapshot> | null = null;

  constructor(
    trackingSource: GameplayTrackingSource,
    arenaSimulation: GameplayArenaRuntime,
    config: GameplayRuntimeConfig = duckHuntGameplayRuntimeConfig,
    dependencies: GameplayRuntimeDependencies = {}
  ) {
    this.#arenaSimulation = arenaSimulation;
    this.#config = config;
    this.#trackingSource = trackingSource;
    this.#createRenderer = dependencies.createRenderer ?? createDefaultRenderer;
    this.#devicePixelRatio =
      dependencies.devicePixelRatio ?? globalThis.window?.devicePixelRatio ?? 1;
    this.#readNowMs = dependencies.readNowMs ?? readNowMs;
    this.#requestAnimationFrame =
      dependencies.requestAnimationFrame ?? requestBrowserAnimationFrame;
    this.#cancelAnimationFrame =
      dependencies.cancelAnimationFrame ?? cancelBrowserAnimationFrame;

    this.#gameplayScene = createGameplayScene(
      this.#config,
      this.#arenaSimulation.enemyRenderStates
    );
    this.#hudSnapshot = freezeHudSnapshot("idle", null, this.#arenaSimulation.hudSnapshot);
  }

  get hudSnapshot(): GameplayHudSnapshot {
    return this.#hudSnapshot;
  }

  get reticleAimPoint(): NormalizedViewportPoint | null {
    return this.#hudSnapshot.aimPoint;
  }

  get reticleVisualState(): GameplayReticleVisualState {
    return this.#reticleVisualState;
  }

  subscribeUiUpdates(listener: () => void): () => void {
    this.#uiUpdateListeners.add(listener);

    return () => {
      this.#uiUpdateListeners.delete(listener);
    };
  }

  subscribeReticleUpdates(listener: ReticleUpdateListener): () => void {
    this.#reticleUpdateListeners.add(listener);

    return () => {
      this.#reticleUpdateListeners.delete(listener);
    };
  }

  restartSession(nowMs: number = this.#readNowMs()): GameplayHudSnapshot {
    this.#arenaSimulation.restartSession(this.#trackingSource.latestPose);

    if (
      this.#renderer !== null &&
      this.#canvasHost !== null &&
      this.#hudSnapshot.lifecycle === "running"
    ) {
      this.#syncArenaFrame(nowMs, true);
      return this.#hudSnapshot;
    }

    if (this.#hudSnapshot.lifecycle === "failed") {
      return this.#hudSnapshot;
    }

    return this.#setHudSnapshot(
      this.#hudSnapshot.lifecycle === "booting" ? "booting" : "idle",
      null,
      this.#arenaSimulation.hudSnapshot,
      nowMs,
      true
    );
  }

  async start(
    canvas: HTMLCanvasElement,
    navigatorLike: Navigator | null | undefined = globalThis.window?.navigator
  ): Promise<GameplayHudSnapshot> {
    if (this.#startPromise !== null) {
      this.dispose();

      try {
        await this.#startPromise;
      } catch {
        // Disposal makes stale boot failures non-actionable for the next start.
      }
    }

    const startPromise = withGameplayBootLock(() =>
      this.#startInternal(canvas, navigatorLike)
    );
    this.#startPromise = startPromise;

    try {
      return await startPromise;
    } finally {
      if (this.#startPromise === startPromise) {
        this.#startPromise = null;
      }
    }
  }

  async #startInternal(
    canvas: HTMLCanvasElement,
    navigatorLike: Navigator | null | undefined
  ): Promise<GameplayHudSnapshot> {
    this.dispose();
    const runtimeEpoch = ++this.#runtimeEpoch;
    this.#arenaSimulation.reset(this.#trackingSource.latestPose);

    if (navigatorLike?.gpu === undefined) {
      const failureReason = "WebGPU is unavailable for the gameplay runtime.";

      this.#setHudSnapshot(
        "failed",
        failureReason,
        this.#arenaSimulation.hudSnapshot,
        this.#readNowMs(),
        true
      );
      throw new Error(failureReason);
    }

    this.#setHudSnapshot(
      "booting",
      null,
      this.#arenaSimulation.hudSnapshot,
      this.#readNowMs(),
      true
    );
    this.#canvasHost = canvas;
    const renderer = this.#createRenderer(canvas);

    this.#renderer = renderer;

    try {
      await renderer.init();
    } catch (error) {
      if (this.#renderer === renderer) {
        this.#renderer = null;
      }

      if (this.#canvasHost === canvas) {
        this.#canvasHost = null;
      }

      renderer.dispose();

      if (runtimeEpoch === this.#runtimeEpoch) {
        const failureReason = resolveRuntimeFailureReason(error);

        this.#setHudSnapshot(
          "failed",
          failureReason,
          this.#arenaSimulation.hudSnapshot,
          this.#readNowMs(),
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
      this.#renderer !== renderer ||
      this.#canvasHost !== canvas
    ) {
      if (this.#renderer === renderer) {
        this.#renderer = null;
      }

      if (this.#canvasHost === canvas) {
        this.#canvasHost = null;
      }

      renderer.dispose();

      return this.#hudSnapshot;
    }

    this.#animationStartAtMs = this.#readNowMs();
    this.#syncViewport();
    this.#syncArenaFrame(this.#animationStartAtMs, true);
    this.#queueNextFrame();

    return this.#hudSnapshot;
  }

  dispose(): void {
    this.#runtimeEpoch += 1;

    if (this.#animationFrameHandle !== 0) {
      this.#cancelAnimationFrame(this.#animationFrameHandle);
      this.#animationFrameHandle = 0;
    }

    this.#renderer?.dispose();
    this.#renderer = null;
    this.#canvasHost = null;
    this.#animationStartAtMs = 0;
    this.#reticleVisualState = "hidden";
    this.#arenaSimulation.reset();
    this.#gameplayScene.resetPresentation();

    if (
      this.#hudSnapshot.lifecycle !== "failed" &&
      (this.#hudSnapshot.lifecycle !== "idle" || this.#hudSnapshot.failureReason !== null)
    ) {
      this.#setHudSnapshot(
        "idle",
        null,
        this.#arenaSimulation.hudSnapshot,
        this.#readNowMs(),
        true
      );
    }

    this.#publishReticleUpdate();
  }

  #queueNextFrame(): void {
    if (this.#renderer === null || this.#canvasHost === null) {
      return;
    }

    this.#animationFrameHandle = this.#requestAnimationFrame(() => {
      this.#animationFrameHandle = 0;

      try {
        this.#renderFrame();
        this.#queueNextFrame();
      } catch (error) {
        this.#handleRenderLoopFailure(error);
      }
    });
  }

  #renderFrame(): void {
    if (this.#renderer === null || this.#canvasHost === null) {
      return;
    }

    const nowMs = this.#readNowMs();
    this.#syncViewport();
    this.#syncArenaFrame(nowMs);
    this.#gameplayScene.updateReticleDrift(
      Math.sin(((nowMs - this.#animationStartAtMs) / 1000) * 1.4) * 0.03
    );
    this.#renderer.render(this.#gameplayScene.scene, this.#gameplayScene.camera);
  }

  #syncArenaFrame(nowMs: number, forceUiUpdate = false): void {
    const trackingSnapshot = this.#trackingSource.latestPose;
    const viewportSnapshot = readViewportSnapshot(this.#canvasHost);
    const arenaHudSnapshot = this.#arenaSimulation.advance(
      trackingSnapshot,
      nowMs,
      viewportSnapshot
    );
    const hudSnapshot = this.#setHudSnapshot(
      "running",
      null,
      arenaHudSnapshot,
      nowMs,
      forceUiUpdate
    );
    const reticleVisualState = resolveGameplayReticleVisualState(hudSnapshot);

    this.#gameplayScene.syncArenaPresentation(
      this.#arenaSimulation.cameraSnapshot,
      this.#arenaSimulation.enemyRenderStates,
      arenaHudSnapshot.aimPoint,
      reticleVisualState
    );
    this.#reticleVisualState = reticleVisualState;
    this.#publishReticleUpdate();
  }

  #syncViewport(): void {
    if (this.#renderer === null || this.#canvasHost === null) {
      return;
    }

    this.#gameplayScene.syncViewport(
      this.#renderer,
      this.#canvasHost,
      this.#devicePixelRatio
    );
  }

  #handleRenderLoopFailure(error: unknown): void {
    const failureReason = resolveRenderLoopFailureReason(error);

    this.#renderer?.dispose();
    this.#renderer = null;
    this.#canvasHost = null;
    this.#reticleVisualState = "hidden";
    this.#publishReticleUpdate();
    this.#setHudSnapshot(
      "failed",
      failureReason,
      this.#arenaSimulation.hudSnapshot,
      this.#readNowMs(),
      true
    );
  }

  #setHudSnapshot(
    lifecycle: GameplayHudSnapshot["lifecycle"],
    failureReason: string | null,
    arenaHudSnapshot: GameplayArenaHudSnapshot,
    nowMs: number,
    forceUiUpdate: boolean
  ): GameplayHudSnapshot {
    const hudSnapshot = freezeHudSnapshot(lifecycle, failureReason, arenaHudSnapshot);

    this.#hudSnapshot = hudSnapshot;
    this.#publishUiUpdate(nowMs, forceUiUpdate);

    return hudSnapshot;
  }

  #publishUiUpdate(nowMs: number, forceUiUpdate: boolean): void {
    if (
      !forceUiUpdate &&
      nowMs - this.#lastUiUpdateAtMs < gameplayUiUpdateIntervalMs
    ) {
      return;
    }

    this.#lastUiUpdateAtMs = nowMs;

    for (const listener of this.#uiUpdateListeners) {
      listener();
    }
  }

  #publishReticleUpdate(): void {
    for (const listener of this.#reticleUpdateListeners) {
      listener(this.#hudSnapshot.aimPoint, this.#reticleVisualState);
    }
  }
}
