import {
  ACESFilmicToneMapping,
  type Camera,
  type Object3D,
  type Scene,
  SRGBColorSpace,
  WebGPURenderer
} from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import {
  MetaverseDynamicCuboidBodyRuntime,
  MetaverseGroundedBodyRuntime,
  RapierPhysicsRuntime,
  type PhysicsVector3Snapshot,
  type RapierColliderHandle
} from "@/physics";
import type {
  MetaversePlayerId,
  MetaversePresenceAnimationVocabularyId,
  MetaversePresenceLocomotionModeId,
  MetaversePresencePoseSnapshotInput,
  MetaversePresenceRosterSnapshot,
  Username
} from "@webgpu-metaverse/shared";
import type {
  MetaversePresenceClientStatusSnapshot,
  MetaversePresenceJoinRequest
} from "@/network";
import { defaultMetaverseControlMode } from "../config/metaverse-control-modes";
import { metaverseRuntimeConfig } from "../config/metaverse-runtime";
import { MetaverseTraversalRuntime } from "./metaverse-traversal-runtime";
import {
  createMetaverseScene,
  type MetaverseSceneCanvasHost,
  type SceneAssetLoader
} from "../render/webgpu-metaverse-scene";
import {
  resolvePlacedCollisionTriMeshes,
  resolvePlacedCuboidColliders,
  type MetaversePlacedCuboidColliderSnapshot
} from "../states/metaverse-environment-collision";
import {
  createMetaverseCameraSnapshot,
  resolveFocusedPortalSnapshot,
  resolveMetaverseMouseLookAxes
} from "../states/metaverse-flight";
import type {
  MetaverseControlModeId,
  MetaverseFlightInputSnapshot
} from "../types/metaverse-control-mode";
import type {
  FocusedExperiencePortalSnapshot,
  FocusedMountableSnapshot,
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
  MetaverseCharacterPresentationSnapshot,
  MetaverseEnvironmentProofConfig,
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseHudSnapshot,
  MetaverseRuntimeConfig,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";

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
  readonly createMetaversePresenceClient?: (() => MetaversePresenceClientRuntime) | null;
  readonly createRenderer?: (
    canvas: HTMLCanvasElement
  ) => MetaverseRendererHost;
  readonly createSceneAssetLoader?: () => SceneAssetLoader;
  readonly devicePixelRatio?: number;
  readonly environmentProofConfig?: MetaverseEnvironmentProofConfig | null;
  readonly localPlayerIdentity?: MetaverseLocalPlayerIdentity | null;
  readonly physicsRuntime?: RapierPhysicsRuntime;
  readonly readNowMs?: () => number;
  readonly requestAnimationFrame?: typeof globalThis.requestAnimationFrame;
  readonly showPhysicsDebug?: boolean;
}

interface MetaverseLocalPlayerIdentity {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly username: Username;
}

interface MetaversePresenceClientRuntime {
  readonly rosterSnapshot: MetaversePresenceRosterSnapshot | null;
  readonly statusSnapshot: MetaversePresenceClientStatusSnapshot;
  ensureJoined(
    request: MetaversePresenceJoinRequest
  ): Promise<MetaversePresenceRosterSnapshot>;
  subscribeUpdates(listener: () => void): () => void;
  syncPresence(
    pose: Omit<MetaversePresencePoseSnapshotInput, "stateSequence">
  ): void;
  dispose(): void;
}

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

type MetaversePhysicsDebugObject = Object3D & {
  dispose?(): void;
  update?(): void;
};

type MouseFlightButtonInputKey = "boost" | "moveBackward" | "moveForward";

const metaverseUiUpdateIntervalMs = 120;
const metaversePushableBodyAdditionalMass = 12;
const metaversePushableBodyAngularDamping = 10;
const metaversePushableBodyGravityScale = 1;
const metaversePushableBodyLinearDamping = 4.5;

function freezePresenceHudSnapshot(
  state: MetaverseHudSnapshot["presence"]["state"],
  joined: boolean,
  lastError: string | null,
  remotePlayerCount: number
): MetaverseHudSnapshot["presence"] {
  return Object.freeze({
    joined,
    lastError,
    remotePlayerCount,
    state
  });
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

function createDefaultSceneAssetLoader(): SceneAssetLoader {
  return new GLTFLoader() as SceneAssetLoader;
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

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function freezeVector3(
  x: number,
  y: number,
  z: number
): PhysicsVector3Snapshot {
  return Object.freeze({
    x: toFiniteNumber(x),
    y: toFiniteNumber(y),
    z: toFiniteNumber(z)
  });
}

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

function freezeHudSnapshot(
  lifecycle: MetaverseHudSnapshot["lifecycle"],
  failureReason: string | null,
  camera: MetaverseHudSnapshot["camera"],
  focusedPortal: FocusedExperiencePortalSnapshot | null,
  focusedMountable: FocusedMountableSnapshot | null,
  mountedEnvironment: MountedEnvironmentSnapshot | null,
  controlMode: MetaverseHudSnapshot["controlMode"],
  locomotionMode: MetaverseHudSnapshot["locomotionMode"],
  presence: MetaverseHudSnapshot["presence"]
): MetaverseHudSnapshot {
  return Object.freeze({
    camera,
    controlMode,
    failureReason,
    focusedMountable,
    focusedPortal,
    lifecycle,
    locomotionMode,
    mountedEnvironment,
    presence
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

export class WebGpuMetaverseRuntime {
  readonly #config: MetaverseRuntimeConfig;
  readonly #createMetaversePresenceClient: (() => MetaversePresenceClientRuntime) | null;
  readonly #createRenderer: (canvas: HTMLCanvasElement) => MetaverseRendererHost;
  readonly #createSceneAssetLoader: () => SceneAssetLoader;
  readonly #devicePixelRatio: number;
  readonly #environmentProofConfig: MetaverseEnvironmentProofConfig | null;
  readonly #groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly #keyboardInput = createKeyboardFlightInputState();
  readonly #localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly #mouseInput = createMouseFlightInputState();
  readonly #physicsRuntime: RapierPhysicsRuntime;
  readonly #sceneRuntime: ReturnType<typeof createMetaverseScene>;
  readonly #showPhysicsDebug: boolean;
  readonly #surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];
  readonly #traversalRuntime: MetaverseTraversalRuntime;
  readonly #uiUpdateListeners = new Set<() => void>();

  #animationFrameHandle = 0;
  #canvas: HTMLCanvasElement | null = null;
  #controlMode: MetaverseControlModeId = defaultMetaverseControlMode;
  #environmentColliders: RapierColliderHandle[] = [];
  #focusedMountable: FocusedMountableSnapshot | null = null;
  #focusedPortal: FocusedExperiencePortalSnapshot | null = null;
  #groundCollider: RapierColliderHandle | null = null;
  #hudSnapshot: MetaverseHudSnapshot;
  #inputCleanup: (() => void) | null = null;
  #lastFrameAtMs: number | null = null;
  #lastPresencePose:
    | {
        readonly animationVocabulary: MetaversePresenceAnimationVocabularyId;
        readonly locomotionMode: MetaversePresenceLocomotionModeId;
        readonly x: number;
        readonly y: number;
        readonly yawRadians: number;
        readonly z: number;
      }
    | null = null;
  #lastPresenceRosterSnapshot: MetaversePresenceRosterSnapshot | null = null;
  #lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;
  #metaversePresenceClient: MetaversePresenceClientRuntime | null = null;
  #metaversePresenceUnsubscribe: (() => void) | null = null;
  #mountedEnvironment: MountedEnvironmentSnapshot | null = null;
  #physicsDebugObject: MetaversePhysicsDebugObject | null = null;
  #pushableBodyRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseDynamicCuboidBodyRuntime
  >();
  #remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[] =
    Object.freeze([]);
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
    this.#createMetaversePresenceClient =
      dependencies.createMetaversePresenceClient ?? null;
    this.#createRenderer = dependencies.createRenderer ?? createDefaultRenderer;
    this.#createSceneAssetLoader =
      dependencies.createSceneAssetLoader ?? createDefaultSceneAssetLoader;
    this.#devicePixelRatio =
      dependencies.devicePixelRatio ?? globalThis.window?.devicePixelRatio ?? 1;
    this.#environmentProofConfig = dependencies.environmentProofConfig ?? null;
    this.#physicsRuntime =
      dependencies.physicsRuntime ?? new RapierPhysicsRuntime();
    this.#surfaceColliderSnapshots =
      this.#environmentProofConfig === null
        ? Object.freeze([])
        : Object.freeze(
            this.#environmentProofConfig.assets.flatMap((environmentAsset) =>
              resolvePlacedCuboidColliders(environmentAsset)
            )
          );
    this.#groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
      {
        ...config.groundedBody,
        maxTurnSpeedRadiansPerSecond:
          config.groundedBody.maxTurnSpeedRadiansPerSecond,
        worldRadius: config.movement.worldRadius
      },
      this.#physicsRuntime
    );
    this.#localPlayerIdentity = dependencies.localPlayerIdentity ?? null;
    this.#requestAnimationFrame =
      dependencies.requestAnimationFrame ?? requestBrowserAnimationFrame;
    this.#cancelAnimationFrame =
      dependencies.cancelAnimationFrame ?? cancelBrowserAnimationFrame;
    this.#readNowMs = dependencies.readNowMs ?? readNowMs;
    this.#sceneRuntime = createMetaverseScene(config, {
      attachmentProofConfig: dependencies.attachmentProofConfig ?? null,
      characterProofConfig: dependencies.characterProofConfig ?? null,
      createSceneAssetLoader: this.#createSceneAssetLoader,
      environmentProofConfig: this.#environmentProofConfig
    });
    this.#traversalRuntime = new MetaverseTraversalRuntime(config, {
      groundedBodyRuntime: this.#groundedBodyRuntime,
      readDynamicEnvironmentPose: (environmentAssetId) =>
        this.#sceneRuntime.readDynamicEnvironmentPose(environmentAssetId),
      setDynamicEnvironmentPose: (environmentAssetId, poseSnapshot) => {
        this.#sceneRuntime.setDynamicEnvironmentPose(
          environmentAssetId,
          poseSnapshot
        );
      },
      surfaceColliderSnapshots: this.#surfaceColliderSnapshots
    });
    this.#showPhysicsDebug = dependencies.showPhysicsDebug ?? false;
    this.#hudSnapshot = freezeHudSnapshot(
      "idle",
      null,
      this.#traversalRuntime.cameraSnapshot,
      null,
      null,
      null,
      this.#controlMode,
      this.#traversalRuntime.locomotionMode,
      this.#resolvePresenceHudSnapshot()
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
    this.#syncOrPublishRuntimeState(true);
  }

  toggleMount(): void {
    const sceneInteractionSnapshot = this.#sceneRuntime.toggleMount(
      this.#traversalRuntime.cameraSnapshot
    );

    this.#focusedMountable = sceneInteractionSnapshot.focusedMountable;
    this.#mountedEnvironment = sceneInteractionSnapshot.mountedEnvironment;
    this.#traversalRuntime.syncMountedEnvironment(
      sceneInteractionSnapshot.mountedEnvironment
    );

    this.#syncOrPublishRuntimeState(true);
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
    this.#traversalRuntime.reset();
    this.#focusedMountable = null;
    this.#focusedPortal = null;
    this.#mountedEnvironment = null;
    this.#lastPresencePose = null;
    this.#lastPresenceRosterSnapshot = null;
    this.#remoteCharacterPresentations = Object.freeze([]);
    this.#teardownPresenceRuntime();
    this.#setHudSnapshot("booting", null, true);
    this.#installInputListeners(canvas);
    const renderer = this.#createRenderer(canvas);

    this.#renderer = renderer;

    try {
      await renderer.init();
      await this.#sceneRuntime.boot();
      await this.#bootGroundedRuntime();
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
      this.#disposeGroundedRuntime();
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
      this.#disposeGroundedRuntime();
      renderer.dispose();

      return this.#hudSnapshot;
    }

    this.#lastFrameAtMs = this.#readNowMs();
    this.#bootPresenceRuntime();
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
    this.#disposeGroundedRuntime();
    this.#teardownPresenceRuntime();
    this.#lastPresencePose = null;
    this.#lastPresenceRosterSnapshot = null;
    this.#remoteCharacterPresentations = Object.freeze([]);
    this.#traversalRuntime.reset();
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

  async #bootStaticEnvironmentCollision(): Promise<void> {
    if (this.#environmentProofConfig === null) {
      return;
    }

    const sceneAssetLoader = this.#createSceneAssetLoader();
    const collisionAssetsByPath = new Map<string, Awaited<ReturnType<SceneAssetLoader["loadAsync"]>>>();

    for (const environmentAsset of this.#environmentProofConfig.assets) {
      for (const collider of resolvePlacedCuboidColliders(environmentAsset)) {
        this.#environmentColliders.push(
          this.#physicsRuntime.createFixedCuboidCollider(
            collider.halfExtents,
            collider.translation,
            collider.rotation
          )
        );
      }

      if (
        environmentAsset.placement === "dynamic" ||
        environmentAsset.physicsColliders !== null ||
        environmentAsset.collisionPath === null
      ) {
        continue;
      }

      let collisionAsset = collisionAssetsByPath.get(environmentAsset.collisionPath);

      if (collisionAsset === undefined) {
        collisionAsset = await sceneAssetLoader.loadAsync(environmentAsset.collisionPath);
        collisionAssetsByPath.set(environmentAsset.collisionPath, collisionAsset);
      }

      for (const triMeshCollider of resolvePlacedCollisionTriMeshes(
        environmentAsset,
        collisionAsset.scene
      )) {
        this.#environmentColliders.push(
          this.#physicsRuntime.createFixedTriMeshCollider(
            triMeshCollider.vertices,
            triMeshCollider.indices
          )
        );
      }
    }
  }

  async #bootPushableEnvironmentBodies(): Promise<void> {
    if (this.#environmentProofConfig === null) {
      return;
    }

    this.#pushableBodyRuntimesByEnvironmentAssetId.clear();

    for (const environmentAsset of this.#environmentProofConfig.assets) {
      if (
        environmentAsset.placement !== "dynamic" ||
        environmentAsset.traversalAffordance !== "pushable"
      ) {
        continue;
      }

      if (environmentAsset.placements.length !== 1) {
        throw new Error(
          `Metaverse pushable environment asset ${environmentAsset.label} requires exactly one placement.`
        );
      }

      if (environmentAsset.collider === null) {
        throw new Error(
          `Metaverse pushable environment asset ${environmentAsset.label} requires collider metadata.`
        );
      }

      const placement = environmentAsset.placements[0]!;
      const collider = environmentAsset.collider;
      const pushableBodyRuntime = new MetaverseDynamicCuboidBodyRuntime(
        {
          additionalMass: metaversePushableBodyAdditionalMass,
          angularDamping: metaversePushableBodyAngularDamping,
          colliderCenter: freezeVector3(
            collider.center.x * placement.scale,
            collider.center.y * placement.scale,
            collider.center.z * placement.scale
          ),
          gravityScale: metaversePushableBodyGravityScale,
          halfExtents: freezeVector3(
            Math.abs(collider.size.x * placement.scale) * 0.5,
            Math.abs(collider.size.y * placement.scale) * 0.5,
            Math.abs(collider.size.z * placement.scale) * 0.5
          ),
          linearDamping: metaversePushableBodyLinearDamping,
          lockRotations: true,
          spawnPosition: freezeVector3(
            placement.position.x,
            placement.position.y,
            placement.position.z
          ),
          spawnYawRadians: placement.rotationYRadians
        },
        this.#physicsRuntime
      );

      await pushableBodyRuntime.init();
      this.#pushableBodyRuntimesByEnvironmentAssetId.set(
        environmentAsset.environmentAssetId,
        pushableBodyRuntime
      );
      const pushableBodySnapshot = pushableBodyRuntime.syncSnapshot();

      this.#sceneRuntime.setDynamicEnvironmentPose(
        environmentAsset.environmentAssetId,
        Object.freeze({
          position: pushableBodySnapshot.position,
          yawRadians: pushableBodySnapshot.yawRadians
        })
      );
    }
  }

  async #bootGroundedRuntime(): Promise<void> {
    await this.#physicsRuntime.init();
    this.#groundCollider ??= this.#physicsRuntime.createFixedCuboidCollider(
      freezeVector3(
        Math.max(this.#config.movement.worldRadius, this.#config.ocean.planeWidth * 0.5),
        0.5,
        Math.max(this.#config.movement.worldRadius, this.#config.ocean.planeDepth * 0.5)
      ),
      freezeVector3(0, this.#config.ocean.height - 0.5, 0)
    );
    await this.#bootStaticEnvironmentCollision();
    await this.#bootPushableEnvironmentBodies();
    this.#groundedBodyRuntime.setApplyImpulsesToDynamicBodies(
      this.#pushableBodyRuntimesByEnvironmentAssetId.size > 0
    );
    await this.#groundedBodyRuntime.init(this.#traversalRuntime.cameraSnapshot.yawRadians);
    this.#traversalRuntime.boot();

    if (this.#showPhysicsDebug && this.#physicsDebugObject === null) {
      const physicsDebugObject = this.#physicsRuntime.createDebugHelper();

      if (physicsDebugObject !== null) {
        this.#physicsDebugObject = physicsDebugObject;
        this.#sceneRuntime.scene.add(physicsDebugObject);
      }
    }
  }

  #disposeGroundedRuntime(): void {
    if (this.#physicsDebugObject !== null) {
      this.#physicsDebugObject.parent?.remove(this.#physicsDebugObject);
      this.#physicsDebugObject.dispose?.();
      this.#physicsDebugObject = null;
    }

    if (this.#groundCollider !== null) {
      this.#physicsRuntime.removeCollider(this.#groundCollider);
      this.#groundCollider = null;
    }

    for (const environmentCollider of this.#environmentColliders) {
      this.#physicsRuntime.removeCollider(environmentCollider);
    }

    this.#environmentColliders = [];
    for (const [
      environmentAssetId,
      pushableBodyRuntime
    ] of this.#pushableBodyRuntimesByEnvironmentAssetId.entries()) {
      pushableBodyRuntime.dispose();
      this.#sceneRuntime.setDynamicEnvironmentPose(environmentAssetId, null);
    }
    this.#pushableBodyRuntimesByEnvironmentAssetId.clear();
    this.#groundedBodyRuntime.setApplyImpulsesToDynamicBodies(false);
    this.#groundedBodyRuntime.dispose();
  }

  #syncPushableBodyPresentations(): void {
    for (const [
      environmentAssetId,
      pushableBodyRuntime
    ] of this.#pushableBodyRuntimesByEnvironmentAssetId.entries()) {
      const pushableBodySnapshot = pushableBodyRuntime.syncSnapshot();

      this.#sceneRuntime.setDynamicEnvironmentPose(
        environmentAssetId,
        Object.freeze({
          position: pushableBodySnapshot.position,
          yawRadians: pushableBodySnapshot.yawRadians
        })
      );
    }
  }

  #bootPresenceRuntime(): void {
    if (!this.#isPresenceConfigured()) {
      return;
    }

    const metaversePresenceClient = this.#createMetaversePresenceClient?.() ?? null;

    if (metaversePresenceClient === null) {
      return;
    }

    this.#metaversePresenceClient = metaversePresenceClient;
    this.#metaversePresenceUnsubscribe = metaversePresenceClient.subscribeUpdates(() => {
      if (this.#metaversePresenceClient !== metaversePresenceClient) {
        return;
      }

      this.#syncRemoteCharacterPresentationsFromPresence();
      this.#syncOrPublishRuntimeState(true);
    });

    const joinRequest = this.#createPresenceJoinRequest();

    if (joinRequest === null) {
      return;
    }

    void metaversePresenceClient.ensureJoined(joinRequest).catch(() => {
      if (this.#metaversePresenceClient !== metaversePresenceClient) {
        return;
      }

      this.#syncOrPublishRuntimeState(true);
    });
  }

  #teardownPresenceRuntime(): void {
    this.#metaversePresenceUnsubscribe?.();
    this.#metaversePresenceUnsubscribe = null;
    this.#metaversePresenceClient?.dispose();
    this.#metaversePresenceClient = null;
  }

  #isPresenceConfigured(): boolean {
    return (
      this.#createMetaversePresenceClient !== null &&
      this.#localPlayerIdentity !== null
    );
  }

  #createPresenceJoinRequest(): MetaversePresenceJoinRequest | null {
    if (this.#localPlayerIdentity === null) {
      return null;
    }

    const characterPresentation = this.#traversalRuntime.characterPresentationSnapshot;

    if (characterPresentation === null) {
      return null;
    }

    return {
      characterId: this.#localPlayerIdentity.characterId,
      playerId: this.#localPlayerIdentity.playerId,
      pose: this.#createPresencePoseInput(
        characterPresentation,
        this.#traversalRuntime.locomotionMode
      ),
      username: this.#localPlayerIdentity.username
    };
  }

  #createPresencePoseInput(
    characterPresentation: MetaverseCharacterPresentationSnapshot,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
  ): Omit<MetaversePresencePoseSnapshotInput, "stateSequence"> {
    return {
      animationVocabulary: characterPresentation.animationVocabulary,
      locomotionMode,
      position: characterPresentation.position,
      yawRadians: characterPresentation.yawRadians
    };
  }

  #readCharacterPresentationSnapshot():
    | MetaverseCharacterPresentationSnapshot
    | null {
    return this.#traversalRuntime.characterPresentationSnapshot;
  }

  #syncPresencePose(): void {
    const metaversePresenceClient = this.#metaversePresenceClient;

    if (
      metaversePresenceClient === null ||
      this.#localPlayerIdentity === null ||
      !metaversePresenceClient.statusSnapshot.joined
    ) {
      return;
    }

    const characterPresentation = this.#readCharacterPresentationSnapshot();

    if (characterPresentation === null) {
      return;
    }

    const nextPresencePose = {
      animationVocabulary: characterPresentation.animationVocabulary,
      locomotionMode: this.#traversalRuntime.locomotionMode,
      x: characterPresentation.position.x,
      y: characterPresentation.position.y,
      yawRadians: characterPresentation.yawRadians,
      z: characterPresentation.position.z
    } as const;

    if (
      this.#lastPresencePose !== null &&
      this.#lastPresencePose.animationVocabulary ===
        nextPresencePose.animationVocabulary &&
      this.#lastPresencePose.locomotionMode === nextPresencePose.locomotionMode &&
      this.#lastPresencePose.x === nextPresencePose.x &&
      this.#lastPresencePose.y === nextPresencePose.y &&
      this.#lastPresencePose.z === nextPresencePose.z &&
      this.#lastPresencePose.yawRadians === nextPresencePose.yawRadians
    ) {
      return;
    }

    this.#lastPresencePose = nextPresencePose;
    metaversePresenceClient.syncPresence(
      this.#createPresencePoseInput(
        characterPresentation,
        this.#traversalRuntime.locomotionMode
      )
    );
  }

  #syncRemoteCharacterPresentationsFromPresence(): void {
    const metaversePresenceClient = this.#metaversePresenceClient;
    const rosterSnapshot = metaversePresenceClient?.rosterSnapshot ?? null;

    if (rosterSnapshot === this.#lastPresenceRosterSnapshot) {
      return;
    }

    this.#lastPresenceRosterSnapshot = rosterSnapshot;

    if (rosterSnapshot === null || this.#localPlayerIdentity === null) {
      this.#remoteCharacterPresentations = Object.freeze([]);
      return;
    }

    const remoteCharacterPresentations: MetaverseRemoteCharacterPresentationSnapshot[] =
      [];

    for (const playerSnapshot of rosterSnapshot.players) {
      if (playerSnapshot.playerId === this.#localPlayerIdentity.playerId) {
        continue;
      }

      remoteCharacterPresentations.push(
        Object.freeze({
          characterId: playerSnapshot.characterId,
          playerId: playerSnapshot.playerId,
          presentation: Object.freeze({
            animationVocabulary: playerSnapshot.pose.animationVocabulary,
            position: playerSnapshot.pose.position,
            yawRadians: playerSnapshot.pose.yawRadians
          })
        })
      );
    }

    this.#remoteCharacterPresentations = Object.freeze(remoteCharacterPresentations);
  }

  #resolvePresenceHudSnapshot(): MetaverseHudSnapshot["presence"] {
    if (!this.#isPresenceConfigured()) {
      return freezePresenceHudSnapshot("disabled", false, null, 0);
    }

    const metaversePresenceClient = this.#metaversePresenceClient;

    if (metaversePresenceClient === null) {
      return freezePresenceHudSnapshot(
        "idle",
        false,
        null,
        this.#remoteCharacterPresentations.length
      );
    }

    return freezePresenceHudSnapshot(
      metaversePresenceClient.statusSnapshot.state,
      metaversePresenceClient.statusSnapshot.joined,
      metaversePresenceClient.statusSnapshot.lastError,
      this.#remoteCharacterPresentations.length
    );
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
    const cameraSnapshot = this.#traversalRuntime.advance(
      movementInput,
      deltaSeconds
    );
    this.#syncPushableBodyPresentations();
    this.#syncPresencePose();
    this.#syncRemoteCharacterPresentationsFromPresence();

    this.#focusedPortal = resolveFocusedPortalSnapshot(
      cameraSnapshot,
      this.#config.portals
    );
    this.#sceneRuntime.syncViewport(
      this.#renderer,
      this.#canvas as MetaverseSceneCanvasHost,
      this.#devicePixelRatio
    );
    const sceneInteractionSnapshot = this.#sceneRuntime.syncPresentation(
      cameraSnapshot,
      this.#focusedPortal,
      nowMs,
      deltaSeconds,
      this.#traversalRuntime.characterPresentationSnapshot,
      this.#remoteCharacterPresentations
    );

    this.#physicsDebugObject?.update?.();
    this.#focusedMountable = sceneInteractionSnapshot.focusedMountable;
    this.#mountedEnvironment = sceneInteractionSnapshot.mountedEnvironment;
    this.#renderer.render(this.#sceneRuntime.scene, this.#sceneRuntime.camera);
    this.#setHudSnapshot("running", null, forceUiUpdate);
  }

  #syncOrPublishRuntimeState(forceUiUpdate: boolean): void {
    if (this.#renderer !== null && this.#canvas !== null) {
      const nowMs = this.#readNowMs();

      this.#lastFrameAtMs = nowMs;
      this.#syncFrame(nowMs, forceUiUpdate);

      return;
    }

    this.#setHudSnapshot(
      this.#hudSnapshot.lifecycle,
      this.#hudSnapshot.failureReason,
      forceUiUpdate
    );
  }

  #setHudSnapshot(
    lifecycle: MetaverseHudSnapshot["lifecycle"],
    failureReason: string | null,
    forceUiUpdate: boolean
  ): void {
    this.#hudSnapshot = freezeHudSnapshot(
      lifecycle,
      failureReason,
      this.#traversalRuntime.cameraSnapshot,
      this.#focusedPortal,
      this.#focusedMountable,
      this.#mountedEnvironment,
      this.#controlMode,
      this.#traversalRuntime.locomotionMode,
      this.#resolvePresenceHudSnapshot()
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
