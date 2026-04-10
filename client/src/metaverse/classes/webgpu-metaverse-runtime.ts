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
  resolveMetaverseMouseLookAxes
} from "../states/metaverse-flight";
import {
  createMetaverseScene,
  type MetaverseSceneCanvasHost
} from "../render/webgpu-metaverse-scene";
import type {
  MetaverseAttachmentProofConfig,
  FocusedMountableSnapshot,
  FocusedExperiencePortalSnapshot,
  MetaverseCharacterProofConfig,
  MetaverseEnvironmentProofConfig,
  MetaverseHudSnapshot,
  MountedEnvironmentSnapshot,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";
import {
  defaultMetaverseControlMode
} from "../config/metaverse-control-modes";
import type {
  MetaverseControlModeId,
  MetaverseFlightInputSnapshot
} from "../types/metaverse-control-mode";

interface MetaverseRendererHost {
  compileAsync?(scene: Scene, camera: Camera): Promise<void>;
  init(): Promise<void | MetaverseRendererHost>;
  render(scene: Scene, camera: Camera): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  dispose(): void;
}

interface MetaverseRendererTuningHandle {
  outputColorSpace?: string;
  toneMapping?: number;
  toneMappingExposure?: number;
}

interface MetaverseRuntimeDependencies {
  readonly attachmentProofConfig?: MetaverseAttachmentProofConfig | null;
  readonly cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame;
  readonly characterProofConfig?: MetaverseCharacterProofConfig | null;
  readonly createRenderer?: (
    canvas: HTMLCanvasElement
  ) => MetaverseRendererHost;
  readonly devicePixelRatio?: number;
  readonly environmentProofConfig?: MetaverseEnvironmentProofConfig | null;
  readonly readNowMs?: () => number;
  readonly requestAnimationFrame?: typeof globalThis.requestAnimationFrame;
}

function createDefaultRenderer(canvas: HTMLCanvasElement): MetaverseRendererHost {
  const renderer = new WebGPURenderer({
    alpha: true,
    antialias: true,
    canvas
  });
  const tuningHandle = renderer as MetaverseRendererHost &
    MetaverseRendererTuningHandle;

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

function freezeHudSnapshot(
  lifecycle: MetaverseHudSnapshot["lifecycle"],
  failureReason: string | null,
  camera: MetaverseHudSnapshot["camera"],
  focusedPortal: FocusedExperiencePortalSnapshot | null,
  focusedMountable: FocusedMountableSnapshot | null,
  mountedEnvironment: MountedEnvironmentSnapshot | null,
  controlMode: MetaverseHudSnapshot["controlMode"]
): MetaverseHudSnapshot {
  return Object.freeze({
    camera,
    controlMode,
    failureReason,
    focusedMountable,
    focusedPortal,
    lifecycle,
    mountedEnvironment
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

interface KeyboardFlightInputState {
  boost: boolean;
  moveBackward: boolean;
  moveForward: boolean;
  pitchDown: boolean;
  pitchUp: boolean;
  yawLeft: boolean;
  yawRight: boolean;
}

interface MouseFlightInputState {
  boost: boolean;
  moveBackward: boolean;
  moveForward: boolean;
  pointerX: number | null;
  pointerY: number | null;
}

type MouseFlightButtonInputKey = "boost" | "moveBackward" | "moveForward";

function createKeyboardFlightInputState(): KeyboardFlightInputState {
  return {
    boost: false,
    moveBackward: false,
    moveForward: false,
    pitchDown: false,
    pitchUp: false,
    yawLeft: false,
    yawRight: false
  };
}

function createMouseFlightInputState(): MouseFlightInputState {
  return {
    boost: false,
    moveBackward: false,
    moveForward: false,
    pointerX: null,
    pointerY: null
  };
}

function normalizeViewportPointer(
  event: MouseEvent,
  canvas: HTMLCanvasElement
): Pick<MouseFlightInputState, "pointerX" | "pointerY"> {
  const bounds = canvas.getBoundingClientRect();

  if (bounds.width <= 0 || bounds.height <= 0) {
    return {
      pointerX: null,
      pointerY: null
    };
  }

  const pointerX = Math.min(
    1,
    Math.max(0, (event.clientX - bounds.left) / bounds.width)
  );
  const pointerY = Math.min(
    1,
    Math.max(0, (event.clientY - bounds.top) / bounds.height)
  );

  return {
    pointerX,
    pointerY
  };
}

export class WebGpuMetaverseRuntime {
  readonly #config: MetaverseRuntimeConfig;
  readonly #createRenderer: (canvas: HTMLCanvasElement) => MetaverseRendererHost;
  readonly #devicePixelRatio: number;
  readonly #keyboardInput = createKeyboardFlightInputState();
  readonly #mouseInput = createMouseFlightInputState();
  readonly #sceneRuntime: ReturnType<typeof createMetaverseScene>;
  readonly #uiUpdateListeners = new Set<() => void>();

  #animationFrameHandle = 0;
  #cameraSnapshot = createMetaverseCameraSnapshot(metaverseRuntimeConfig.camera);
  #canvas: HTMLCanvasElement | null = null;
  #controlMode: MetaverseControlModeId = defaultMetaverseControlMode;
  #focusedMountable: FocusedMountableSnapshot | null = null;
  #focusedPortal: FocusedExperiencePortalSnapshot | null = null;
  #hudSnapshot = freezeHudSnapshot(
    "idle",
    null,
    this.#cameraSnapshot,
    null,
    null,
    null,
    this.#controlMode
  );
  #inputCleanup: (() => void) | null = null;
  #lastFrameAtMs: number | null = null;
  #lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;
  #mountedEnvironment: MountedEnvironmentSnapshot | null = null;
  #renderer: MetaverseRendererHost | null = null;
  #runtimeEpoch = 0;
  #requestAnimationFrame: typeof globalThis.requestAnimationFrame;
  #cancelAnimationFrame: typeof globalThis.cancelAnimationFrame;
  #readNowMs: () => number;
  #startPromise: Promise<MetaverseHudSnapshot> | null = null;

  constructor(
    config: MetaverseRuntimeConfig = metaverseRuntimeConfig,
    dependencies: MetaverseRuntimeDependencies = {}
  ) {
    this.#config = config;
    this.#createRenderer = dependencies.createRenderer ?? createDefaultRenderer;
    this.#devicePixelRatio =
      dependencies.devicePixelRatio ?? globalThis.window?.devicePixelRatio ?? 1;
    this.#requestAnimationFrame =
      dependencies.requestAnimationFrame ?? requestBrowserAnimationFrame;
    this.#cancelAnimationFrame =
      dependencies.cancelAnimationFrame ?? cancelBrowserAnimationFrame;
    this.#readNowMs = dependencies.readNowMs ?? readNowMs;
    this.#sceneRuntime = createMetaverseScene(config, {
      attachmentProofConfig: dependencies.attachmentProofConfig ?? null,
      characterProofConfig: dependencies.characterProofConfig ?? null,
      environmentProofConfig: dependencies.environmentProofConfig ?? null
    });
    this.#cameraSnapshot = createMetaverseCameraSnapshot(config.camera);
    this.#hudSnapshot = freezeHudSnapshot(
      "idle",
      null,
      this.#cameraSnapshot,
      null,
      null,
      null,
      this.#controlMode
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

  setControlMode(controlMode: MetaverseControlModeId): void {
    if (controlMode === this.#controlMode) {
      return;
    }

    this.#controlMode = controlMode;
    this.#resetTransientInputState();
    this.#setHudSnapshot(
      this.#hudSnapshot.lifecycle,
      this.#hudSnapshot.failureReason,
      true
    );
  }

  toggleMount(): void {
    const sceneInteractionSnapshot = this.#sceneRuntime.toggleMount(
      this.#cameraSnapshot
    );

    this.#focusedMountable = sceneInteractionSnapshot.focusedMountable;
    this.#mountedEnvironment = sceneInteractionSnapshot.mountedEnvironment;
    this.#setHudSnapshot(
      this.#hudSnapshot.lifecycle,
      this.#hudSnapshot.failureReason,
      true
    );
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

  async #startInternal(
    canvas: HTMLCanvasElement,
    navigatorLike: Navigator | null | undefined
  ): Promise<MetaverseHudSnapshot> {
    this.dispose();
    const runtimeEpoch = ++this.#runtimeEpoch;

    if (navigatorLike?.gpu === undefined) {
      const failureReason = "WebGPU is unavailable for the metaverse runtime.";

      this.#setHudSnapshot("failed", failureReason, true);
      throw new Error(failureReason);
    }

    this.#canvas = canvas;
    this.#cameraSnapshot = createMetaverseCameraSnapshot(this.#config.camera);
    this.#focusedMountable = null;
    this.#focusedPortal = null;
    this.#mountedEnvironment = null;
    this.#setHudSnapshot("booting", null, true);
    this.#installInputListeners(canvas);
    const renderer = this.#createRenderer(canvas);

    this.#renderer = renderer;

    try {
      await renderer.init();
      await this.#sceneRuntime.boot();
      this.#sceneRuntime.syncViewport(
        renderer,
        canvas as MetaverseSceneCanvasHost,
        this.#devicePixelRatio
      );
      await this.#sceneRuntime.prewarm(renderer);
    } catch (error) {
      if (this.#renderer === renderer) {
        this.#renderer = null;
      }

      renderer.dispose();
      this.#removeInputListeners();
      if (this.#canvas === canvas) {
        this.#canvas = null;
      }

      if (runtimeEpoch === this.#runtimeEpoch) {
        const failureReason = resolveRuntimeFailureReason(error);

        this.#setHudSnapshot("failed", failureReason, true);
        throw new Error(failureReason);
      }

      throw error instanceof Error
        ? error
        : new Error(resolveRuntimeFailureReason(error));
    }

    if (
      runtimeEpoch !== this.#runtimeEpoch ||
      this.#renderer !== renderer ||
      this.#canvas !== canvas
    ) {
      if (this.#renderer === renderer) {
        this.#renderer = null;
      }

      if (this.#canvas === canvas) {
        this.#canvas = null;
      }

      this.#removeInputListeners();
      renderer.dispose();

      return this.#hudSnapshot;
    }

    this.#lastFrameAtMs = this.#readNowMs();
    this.#syncFrame(this.#lastFrameAtMs, true);
    this.#queueNextFrame();

    return this.#hudSnapshot;
  }

  dispose(): void {
    this.#runtimeEpoch += 1;

    if (this.#animationFrameHandle !== 0) {
      this.#cancelAnimationFrame(this.#animationFrameHandle);
      this.#animationFrameHandle = 0;
    }

    this.#removeInputListeners();
    this.#renderer?.dispose();
    this.#renderer = null;
    this.#canvas = null;
    this.#lastFrameAtMs = null;
    this.#lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;
    this.#focusedMountable = null;
    this.#focusedPortal = null;
    this.#mountedEnvironment = null;
    this.#resetTransientInputState();
    this.#cameraSnapshot = createMetaverseCameraSnapshot(this.#config.camera);
    this.#sceneRuntime.resetPresentation();

    if (this.#hudSnapshot.lifecycle !== "failed") {
      this.#setHudSnapshot("idle", null, true);
    }
  }

  #installInputListeners(canvas: HTMLCanvasElement): void {
    const keyBindings: Record<string, keyof KeyboardFlightInputState> = {
      KeyA: "yawLeft",
      KeyD: "yawRight",
      KeyE: "pitchUp",
      KeyQ: "pitchDown",
      KeyS: "moveBackward",
      KeyW: "moveForward",
      ShiftLeft: "boost",
      ShiftRight: "boost"
    };
    const mouseButtonBindings: Record<number, MouseFlightButtonInputKey> = {
      0: "moveForward",
      2: "moveBackward",
      3: "boost"
    };
    const handleCanvasMouseMove = (event: MouseEvent) => {
      Object.assign(this.#mouseInput, normalizeViewportPointer(event, canvas));
    };
    const handleCanvasMouseLeave = () => {
      this.#mouseInput.pointerX = null;
      this.#mouseInput.pointerY = null;
    };
    const handleCanvasMouseDown = (event: MouseEvent) => {
      const inputKey = mouseButtonBindings[event.button];

      if (inputKey === undefined) {
        return;
      }

      event.preventDefault();
      this.#mouseInput[inputKey] = true;
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
      this.#keyboardInput[inputKey] = true;
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
      this.#keyboardInput[inputKey] = false;
    };
    const handleWindowMouseUp = (event: MouseEvent) => {
      const inputKey = mouseButtonBindings[event.button];

      if (inputKey === undefined) {
        return;
      }

      this.#mouseInput[inputKey] = false;
    };
    const handleCanvasContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    const handleWindowBlur = () => {
      this.#resetTransientInputState();
    };

    canvas.addEventListener("mousemove", handleCanvasMouseMove);
    canvas.addEventListener("mouseleave", handleCanvasMouseLeave);
    canvas.addEventListener("mousedown", handleCanvasMouseDown);
    canvas.addEventListener("contextmenu", handleCanvasContextMenu);
    canvas.addEventListener("auxclick", handleCanvasContextMenu);
    globalThis.window?.addEventListener("keydown", handleKeyDown);
    globalThis.window?.addEventListener("keyup", handleKeyUp);
    globalThis.window?.addEventListener("mouseup", handleWindowMouseUp);
    globalThis.window?.addEventListener("blur", handleWindowBlur);
    this.#inputCleanup = () => {
      canvas.removeEventListener("mousemove", handleCanvasMouseMove);
      canvas.removeEventListener("mouseleave", handleCanvasMouseLeave);
      canvas.removeEventListener("mousedown", handleCanvasMouseDown);
      canvas.removeEventListener("contextmenu", handleCanvasContextMenu);
      canvas.removeEventListener("auxclick", handleCanvasContextMenu);
      globalThis.window?.removeEventListener("keydown", handleKeyDown);
      globalThis.window?.removeEventListener("keyup", handleKeyUp);
      globalThis.window?.removeEventListener("mouseup", handleWindowMouseUp);
      globalThis.window?.removeEventListener("blur", handleWindowBlur);
    };
  }

  #removeInputListeners(): void {
    this.#inputCleanup?.();
    this.#inputCleanup = null;
  }

  #resetTransientInputState(): void {
    Object.assign(this.#keyboardInput, createKeyboardFlightInputState());
    Object.assign(this.#mouseInput, createMouseFlightInputState());
  }

  #readFlightInputSnapshot(): MetaverseFlightInputSnapshot {
    if (this.#controlMode === "mouse") {
      const canvas = this.#canvas;
      const mouseLookAxes =
        canvas === null
          ? {
              pitchAxis: 0,
              yawAxis: 0
            }
          : resolveMetaverseMouseLookAxes(
              this.#mouseInput.pointerX,
              this.#mouseInput.pointerY,
              canvas.clientWidth,
              canvas.clientHeight,
              this.#config.orientation.mouseEdgeTurn
            );

      return Object.freeze({
        boost: this.#mouseInput.boost,
        moveAxis:
          (this.#mouseInput.moveForward ? 1 : 0) -
          (this.#mouseInput.moveBackward ? 1 : 0),
        pitchAxis: mouseLookAxes.pitchAxis,
        yawAxis: mouseLookAxes.yawAxis
      });
    }

    return Object.freeze({
      boost: this.#keyboardInput.boost,
      moveAxis:
        (this.#keyboardInput.moveForward ? 1 : 0) -
        (this.#keyboardInput.moveBackward ? 1 : 0),
      pitchAxis:
        (this.#keyboardInput.pitchUp ? 1 : 0) -
        (this.#keyboardInput.pitchDown ? 1 : 0),
      yawAxis:
        (this.#keyboardInput.yawRight ? 1 : 0) -
        (this.#keyboardInput.yawLeft ? 1 : 0)
    });
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
    const movementInput = this.#readFlightInputSnapshot();
    this.#cameraSnapshot = advanceMetaverseCameraSnapshot(
      this.#cameraSnapshot,
      movementInput,
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
    const sceneInteractionSnapshot = this.#sceneRuntime.syncPresentation(
      this.#cameraSnapshot,
      this.#focusedPortal,
      nowMs,
      deltaSeconds
    );
    this.#focusedMountable = sceneInteractionSnapshot.focusedMountable;
    this.#mountedEnvironment = sceneInteractionSnapshot.mountedEnvironment;
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
      this.#focusedMountable,
      this.#mountedEnvironment,
      this.#controlMode
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
