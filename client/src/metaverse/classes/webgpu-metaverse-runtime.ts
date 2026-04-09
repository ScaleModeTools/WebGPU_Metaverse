import {
  ACESFilmicToneMapping,
  type Camera,
  type Scene,
  SRGBColorSpace,
  WebGPURenderer
} from "three/webgpu";

import { metaverseRuntimeConfig } from "../config/metaverse-runtime";
import {
  advanceMetaverseCameraSnapshot,
  createMetaverseCameraSnapshot,
  resolveFocusedPortalSnapshot,
  rotateMetaverseCameraSnapshot
} from "../states/metaverse-flight";
import {
  createMetaverseScene,
  type MetaverseSceneCanvasHost
} from "../render/webgpu-metaverse-scene";
import type {
  FocusedExperiencePortalSnapshot,
  MetaverseHudSnapshot,
  MetaverseMovementInputSnapshot,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";

interface MetaverseRendererHost {
  init(): Promise<void | MetaverseRendererHost>;
  render(scene: Scene, camera: Camera): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  dispose(): void;
}

interface MetaverseRendererFallbackHandle {
  _getFallback?: ((error: unknown) => MetaverseRendererHost) | null;
}

interface MetaverseRendererTuningHandle {
  outputColorSpace?: string;
  toneMapping?: number;
  toneMappingExposure?: number;
}

function disableImplicitWebGlFallback(renderer: MetaverseRendererHost): void {
  const fallbackHandle = renderer as MetaverseRendererHost &
    MetaverseRendererFallbackHandle;

  if ("_getFallback" in fallbackHandle) {
    fallbackHandle._getFallback = null;
  }
}

function createDefaultRenderer(canvas: HTMLCanvasElement): MetaverseRendererHost {
  const renderer = new WebGPURenderer({
    alpha: true,
    antialias: true,
    canvas
  });
  const tuningHandle = renderer as MetaverseRendererHost &
    MetaverseRendererTuningHandle;

  disableImplicitWebGlFallback(renderer);
  tuningHandle.toneMapping = ACESFilmicToneMapping;
  tuningHandle.toneMappingExposure = 1.04;
  tuningHandle.outputColorSpace = SRGBColorSpace;

  return renderer;
}

function requestBrowserAnimationFrame(callback: FrameRequestCallback): number {
  if (typeof globalThis.window?.requestAnimationFrame !== "function") {
    throw new Error("requestAnimationFrame is unavailable for the metaverse.");
  }

  return globalThis.window.requestAnimationFrame(callback);
}

function cancelBrowserAnimationFrame(frameHandle: number): void {
  if (typeof globalThis.window?.cancelAnimationFrame !== "function") {
    return;
  }

  globalThis.window.cancelAnimationFrame(frameHandle);
}

function readNowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function createMovementInputSnapshot(): MetaverseMovementInputSnapshot {
  return {
    ascend: false,
    boost: false,
    descend: false,
    moveBackward: false,
    moveForward: false,
    strafeLeft: false,
    strafeRight: false
  };
}

function freezeHudSnapshot(
  lifecycle: MetaverseHudSnapshot["lifecycle"],
  failureReason: string | null,
  camera: MetaverseHudSnapshot["camera"],
  focusedPortal: FocusedExperiencePortalSnapshot | null,
  pointerLockActive: boolean
): MetaverseHudSnapshot {
  return Object.freeze({
    camera,
    failureReason,
    focusedPortal,
    lifecycle,
    pointerLockActive
  });
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
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

const metaverseUiUpdateIntervalMs = 120;

export class WebGpuMetaverseRuntime {
  readonly #config: MetaverseRuntimeConfig;
  readonly #createRenderer: (canvas: HTMLCanvasElement) => MetaverseRendererHost;
  readonly #devicePixelRatio: number;
  readonly #sceneRuntime: ReturnType<typeof createMetaverseScene>;
  readonly #uiUpdateListeners = new Set<() => void>();
  readonly #movementInput = createMovementInputSnapshot();

  #animationFrameHandle = 0;
  #cameraSnapshot = createMetaverseCameraSnapshot(metaverseRuntimeConfig.camera);
  #canvas: HTMLCanvasElement | null = null;
  #focusedPortal: FocusedExperiencePortalSnapshot | null = null;
  #hudSnapshot = freezeHudSnapshot(
    "idle",
    null,
    this.#cameraSnapshot,
    null,
    false
  );
  #inputCleanup: (() => void) | null = null;
  #lastFrameAtMs: number | null = null;
  #lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;
  #pointerLockActive = false;
  #renderer: MetaverseRendererHost | null = null;
  #requestAnimationFrame: typeof globalThis.requestAnimationFrame;
  #cancelAnimationFrame: typeof globalThis.cancelAnimationFrame;
  #readNowMs: () => number;

  constructor(config: MetaverseRuntimeConfig = metaverseRuntimeConfig) {
    this.#config = config;
    this.#createRenderer = createDefaultRenderer;
    this.#devicePixelRatio = globalThis.window?.devicePixelRatio ?? 1;
    this.#requestAnimationFrame = requestBrowserAnimationFrame;
    this.#cancelAnimationFrame = cancelBrowserAnimationFrame;
    this.#readNowMs = readNowMs;
    this.#sceneRuntime = createMetaverseScene(config);
    this.#cameraSnapshot = createMetaverseCameraSnapshot(config.camera);
    this.#hudSnapshot = freezeHudSnapshot(
      "idle",
      null,
      this.#cameraSnapshot,
      null,
      false
    );
  }

  get hudSnapshot(): MetaverseHudSnapshot {
    return this.#hudSnapshot;
  }

  subscribeUiUpdates(listener: () => void): () => void {
    this.#uiUpdateListeners.add(listener);

    return () => {
      this.#uiUpdateListeners.delete(listener);
    };
  }

  async start(
    canvas: HTMLCanvasElement,
    navigatorLike: Navigator | null | undefined = globalThis.window?.navigator
  ): Promise<MetaverseHudSnapshot> {
    this.dispose();

    if (navigatorLike?.gpu === undefined) {
      const failureReason = "WebGPU is unavailable for the metaverse runtime.";

      this.#setHudSnapshot("failed", failureReason, true);
      throw new Error(failureReason);
    }

    this.#canvas = canvas;
    this.#cameraSnapshot = createMetaverseCameraSnapshot(this.#config.camera);
    this.#focusedPortal = null;
    this.#setHudSnapshot("booting", null, true);
    this.#installInputListeners(canvas);
    const renderer = this.#createRenderer(canvas);

    this.#renderer = renderer;

    try {
      await renderer.init();
    } catch (error) {
      this.#renderer = null;
      renderer.dispose();
      this.#removeInputListeners();
      this.#canvas = null;
      const failureReason = resolveRuntimeFailureReason(error);

      this.#setHudSnapshot("failed", failureReason, true);
      throw new Error(failureReason);
    }

    this.#lastFrameAtMs = this.#readNowMs();
    this.#syncFrame(this.#lastFrameAtMs, true);
    this.#queueNextFrame();

    return this.#hudSnapshot;
  }

  dispose(): void {
    if (this.#animationFrameHandle !== 0) {
      this.#cancelAnimationFrame(this.#animationFrameHandle);
      this.#animationFrameHandle = 0;
    }

    if (
      this.#canvas !== null &&
      globalThis.document?.pointerLockElement === this.#canvas &&
      typeof globalThis.document.exitPointerLock === "function"
    ) {
      globalThis.document.exitPointerLock();
    }

    this.#removeInputListeners();
    this.#renderer?.dispose();
    this.#renderer = null;
    this.#canvas = null;
    this.#lastFrameAtMs = null;
    this.#lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;
    this.#pointerLockActive = false;
    this.#focusedPortal = null;
    Object.assign(this.#movementInput, createMovementInputSnapshot());
    this.#cameraSnapshot = createMetaverseCameraSnapshot(this.#config.camera);
    this.#sceneRuntime.resetPresentation();

    if (this.#hudSnapshot.lifecycle !== "failed") {
      this.#setHudSnapshot("idle", null, true);
    }
  }

  #installInputListeners(canvas: HTMLCanvasElement): void {
    const keyBindings: Record<string, keyof MetaverseMovementInputSnapshot> = {
      KeyA: "strafeLeft",
      KeyD: "strafeRight",
      KeyE: "ascend",
      KeyQ: "descend",
      KeyS: "moveBackward",
      KeyW: "moveForward",
      ShiftLeft: "boost",
      ShiftRight: "boost",
      Space: "ascend"
    };
    const handlePointerLockChange = () => {
      this.#pointerLockActive = globalThis.document?.pointerLockElement === canvas;
      this.#setHudSnapshot(this.#hudSnapshot.lifecycle, this.#hudSnapshot.failureReason, true);
    };
    const handleCanvasClick = () => {
      if (typeof canvas.requestPointerLock !== "function") {
        return;
      }

      if (globalThis.document?.pointerLockElement === canvas) {
        return;
      }

      canvas.requestPointerLock();
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!this.#pointerLockActive) {
        return;
      }

      this.#cameraSnapshot = rotateMetaverseCameraSnapshot(
        this.#cameraSnapshot,
        event.movementX,
        event.movementY,
        this.#config.movement
      );
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      const inputKey = keyBindings[event.code];

      if (inputKey === undefined) {
        return;
      }

      event.preventDefault();
      this.#movementInput[inputKey] = true;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      const inputKey = keyBindings[event.code];

      if (inputKey === undefined) {
        return;
      }

      event.preventDefault();
      this.#movementInput[inputKey] = false;
    };
    const handleWindowBlur = () => {
      Object.assign(this.#movementInput, createMovementInputSnapshot());
    };

    canvas.addEventListener("click", handleCanvasClick);
    globalThis.document?.addEventListener("pointerlockchange", handlePointerLockChange);
    globalThis.window?.addEventListener("mousemove", handleMouseMove);
    globalThis.window?.addEventListener("keydown", handleKeyDown);
    globalThis.window?.addEventListener("keyup", handleKeyUp);
    globalThis.window?.addEventListener("blur", handleWindowBlur);
    this.#inputCleanup = () => {
      canvas.removeEventListener("click", handleCanvasClick);
      globalThis.document?.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange
      );
      globalThis.window?.removeEventListener("mousemove", handleMouseMove);
      globalThis.window?.removeEventListener("keydown", handleKeyDown);
      globalThis.window?.removeEventListener("keyup", handleKeyUp);
      globalThis.window?.removeEventListener("blur", handleWindowBlur);
    };
  }

  #removeInputListeners(): void {
    this.#inputCleanup?.();
    this.#inputCleanup = null;
  }

  #queueNextFrame(): void {
    this.#animationFrameHandle = this.#requestAnimationFrame((nextFrameAtMs) => {
      this.#animationFrameHandle = 0;
      this.#syncFrame(nextFrameAtMs, false);
      this.#queueNextFrame();
    });
  }

  #syncFrame(nowMs: number, forceUiUpdate: boolean): void {
    if (this.#renderer === null || this.#canvas === null) {
      return;
    }

    const deltaSeconds =
      this.#lastFrameAtMs === null
        ? 0
        : Math.min(0.1, Math.max(0, (nowMs - this.#lastFrameAtMs) / 1000));

    this.#lastFrameAtMs = nowMs;
    this.#cameraSnapshot = advanceMetaverseCameraSnapshot(
      this.#cameraSnapshot,
      this.#movementInput,
      this.#config,
      deltaSeconds
    );
    this.#focusedPortal = resolveFocusedPortalSnapshot(
      this.#cameraSnapshot,
      this.#config.portals
    );
    this.#sceneRuntime.syncViewport(
      this.#renderer,
      this.#canvas as MetaverseSceneCanvasHost,
      this.#devicePixelRatio
    );
    this.#sceneRuntime.syncPresentation(
      this.#cameraSnapshot,
      this.#focusedPortal,
      nowMs
    );
    this.#renderer.render(this.#sceneRuntime.scene, this.#sceneRuntime.camera);
    this.#setHudSnapshot("running", null, forceUiUpdate);
  }

  #setHudSnapshot(
    lifecycle: MetaverseHudSnapshot["lifecycle"],
    failureReason: string | null,
    forceUiUpdate: boolean
  ): void {
    this.#hudSnapshot = freezeHudSnapshot(
      lifecycle,
      failureReason,
      this.#cameraSnapshot,
      this.#focusedPortal,
      this.#pointerLockActive
    );

    if (
      !forceUiUpdate &&
      this.#readNowMs() - this.#lastUiUpdateAtMs < metaverseUiUpdateIntervalMs
    ) {
      return;
    }

    this.#lastUiUpdateAtMs = this.#readNowMs();

    for (const listener of this.#uiUpdateListeners) {
      listener();
    }
  }
}
