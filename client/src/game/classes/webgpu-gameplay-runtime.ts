import {
  type OrthographicCamera,
  type Scene,
  WebGPURenderer
} from "three/webgpu";

import { gameplayRuntimeConfig } from "../config/gameplay-runtime";
import {
  createGameplayScene,
  type GameplaySceneCanvasHost
} from "../render/webgpu-gameplay-scene";
import type {
  GameplayHudSnapshot,
  GameplayRuntimeConfig
} from "../types/gameplay-runtime";
import type { LatestHandTrackingSnapshot } from "../types/hand-tracking";
import { LocalArenaSimulation } from "./local-arena-simulation";

interface GameplayTrackingSource {
  readonly latestPose: LatestHandTrackingSnapshot;
}

interface GameplayRendererHost {
  init(): Promise<void | GameplayRendererHost>;
  render(scene: Scene, camera: OrthographicCamera): void;
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
  readonly requestAnimationFrame?: typeof globalThis.requestAnimationFrame;
}

function createDefaultRenderer(canvas: HTMLCanvasElement): GameplayRendererHost {
  return new WebGPURenderer({
    alpha: true,
    antialias: true,
    canvas
  });
}

function freezeHudSnapshot(
  lifecycle: GameplayHudSnapshot["lifecycle"],
  failureReason: string | null,
  arenaHudSnapshot: LocalArenaSimulation["hudSnapshot"]
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

export class WebGpuGameplayRuntime {
  readonly #arenaSimulation: LocalArenaSimulation;
  readonly #config: GameplayRuntimeConfig;
  readonly #createRenderer: (canvas: HTMLCanvasElement) => GameplayRendererHost;
  readonly #devicePixelRatio: number;
  readonly #requestAnimationFrame: typeof globalThis.requestAnimationFrame;
  readonly #cancelAnimationFrame: typeof globalThis.cancelAnimationFrame;
  readonly #gameplayScene: ReturnType<typeof createGameplayScene>;
  readonly #trackingSource: GameplayTrackingSource;

  #animationFrameHandle = 0;
  #animationStartAtMs = 0;
  #canvasHost: GameplaySceneCanvasHost | null = null;
  #hudSnapshot: GameplayHudSnapshot;
  #renderer: GameplayRendererHost | null = null;

  constructor(
    trackingSource: GameplayTrackingSource,
    arenaSimulation: LocalArenaSimulation,
    config: GameplayRuntimeConfig = gameplayRuntimeConfig,
    dependencies: GameplayRuntimeDependencies = {}
  ) {
    this.#arenaSimulation = arenaSimulation;
    this.#config = config;
    this.#trackingSource = trackingSource;
    this.#createRenderer = dependencies.createRenderer ?? createDefaultRenderer;
    this.#devicePixelRatio = dependencies.devicePixelRatio ?? window.devicePixelRatio;
    this.#requestAnimationFrame =
      dependencies.requestAnimationFrame ?? window.requestAnimationFrame;
    this.#cancelAnimationFrame =
      dependencies.cancelAnimationFrame ?? window.cancelAnimationFrame;

    this.#gameplayScene = createGameplayScene(
      this.#config,
      this.#arenaSimulation.enemyRenderStates
    );
    this.#hudSnapshot = freezeHudSnapshot("idle", null, this.#arenaSimulation.hudSnapshot);
  }

  get hudSnapshot(): GameplayHudSnapshot {
    return this.#hudSnapshot;
  }

  restartSession(nowMs: number = readNowMs()): GameplayHudSnapshot {
    this.#arenaSimulation.reset(this.#trackingSource.latestPose);

    if (
      this.#renderer !== null &&
      this.#canvasHost !== null &&
      this.#hudSnapshot.lifecycle === "running"
    ) {
      this.#syncArenaFrame(nowMs);
      return this.#hudSnapshot;
    }

    if (this.#hudSnapshot.lifecycle === "failed") {
      return this.#hudSnapshot;
    }

    this.#hudSnapshot = freezeHudSnapshot(
      this.#hudSnapshot.lifecycle === "booting" ? "booting" : "idle",
      null,
      this.#arenaSimulation.hudSnapshot
    );

    return this.#hudSnapshot;
  }

  async start(
    canvas: HTMLCanvasElement,
    navigatorLike: Navigator | null | undefined = window.navigator
  ): Promise<GameplayHudSnapshot> {
    this.dispose();
    this.#arenaSimulation.reset(this.#trackingSource.latestPose);

    if (navigatorLike?.gpu === undefined) {
      this.#hudSnapshot = freezeHudSnapshot(
        "failed",
        "WebGPU is unavailable for the gameplay runtime.",
        this.#arenaSimulation.hudSnapshot
      );
      throw new Error(
        this.#hudSnapshot.failureReason ??
          "WebGPU is unavailable for the gameplay runtime."
      );
    }

    this.#hudSnapshot = freezeHudSnapshot(
      "booting",
      null,
      this.#arenaSimulation.hudSnapshot
    );
    this.#canvasHost = canvas;
    this.#renderer = this.#createRenderer(canvas);
    await this.#renderer.init();
    this.#animationStartAtMs = readNowMs();
    this.#syncViewport();
    this.#syncArenaFrame(this.#animationStartAtMs);
    this.#hudSnapshot = freezeHudSnapshot(
      "running",
      null,
      this.#arenaSimulation.hudSnapshot
    );
    this.#queueNextFrame();

    return this.#hudSnapshot;
  }

  dispose(): void {
    if (this.#animationFrameHandle !== 0) {
      this.#cancelAnimationFrame(this.#animationFrameHandle);
      this.#animationFrameHandle = 0;
    }

    this.#renderer?.dispose();
    this.#renderer = null;
    this.#canvasHost = null;
    this.#animationStartAtMs = 0;
    this.#arenaSimulation.reset();
    this.#gameplayScene.resetPresentation();

    if (this.#hudSnapshot.lifecycle !== "failed") {
      this.#hudSnapshot = freezeHudSnapshot(
        "idle",
        null,
        this.#arenaSimulation.hudSnapshot
      );
    }
  }

  #queueNextFrame(): void {
    if (this.#renderer === null || this.#canvasHost === null) {
      return;
    }

    this.#animationFrameHandle = this.#requestAnimationFrame(() => {
      this.#animationFrameHandle = 0;
      this.#renderFrame();
      this.#queueNextFrame();
    });
  }

  #renderFrame(): void {
    if (this.#renderer === null || this.#canvasHost === null) {
      return;
    }

    const nowMs = readNowMs();

    this.#syncViewport();
    this.#syncArenaFrame(nowMs);
    this.#gameplayScene.updateReticleDrift(
      Math.sin(((nowMs - this.#animationStartAtMs) / 1000) * 1.4) * 0.03
    );
    this.#renderer.render(this.#gameplayScene.scene, this.#gameplayScene.camera);
  }

  #syncArenaFrame(nowMs: number): void {
    const arenaHudSnapshot = this.#arenaSimulation.advance(
      this.#trackingSource.latestPose,
      nowMs
    );

    this.#gameplayScene.syncArenaPresentation(
      this.#arenaSimulation.enemyRenderStates,
      arenaHudSnapshot.aimPoint
    );
    this.#hudSnapshot = freezeHudSnapshot("running", null, arenaHudSnapshot);
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
}
