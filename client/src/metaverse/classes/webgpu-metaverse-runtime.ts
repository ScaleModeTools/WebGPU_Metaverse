import {
  ACESFilmicToneMapping,
  type Camera,
  type Scene,
  SRGBColorSpace,
  WebGPURenderer
} from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import {
  MetaverseGroundedBodyRuntime,
  RapierPhysicsRuntime
} from "@/physics";
import { defaultMetaverseControlMode } from "../config/metaverse-control-modes";
import {
  metaverseWorldClientConfig,
  metaverseLocalMountedVehicleReconciliationConfig,
  metaverseRemoteWorldSamplingConfig
} from "../config/metaverse-world-network";
import { metaverseRuntimeConfig } from "../config/metaverse-runtime";
import { MetaverseTraversalRuntime } from "./metaverse-traversal-runtime";
import { MetaverseEnvironmentPhysicsRuntime } from "./metaverse-environment-physics-runtime";
import {
  createMetaverseScene,
  type MetaverseSceneCanvasHost,
  type SceneAssetLoader
} from "../render/webgpu-metaverse-scene";
import {
  createMetaverseCameraSnapshot,
  resolveFocusedPortalSnapshot
} from "../states/metaverse-flight";
import type { MetaverseControlModeId } from "../types/metaverse-control-mode";
import type {
  FocusedExperiencePortalSnapshot,
  FocusedMountableSnapshot,
  MetaverseAttachmentProofConfig,
  MetaverseBootPhaseState,
  MetaverseCharacterProofConfig,
  MetaverseCharacterPresentationSnapshot,
  MetaverseEnvironmentProofConfig,
  MetaverseHudSnapshot,
  MetaverseTelemetrySnapshot,
  MetaverseRuntimeConfig,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";
import { MetaverseFlightInputRuntime } from "./metaverse-flight-input-runtime";
import {
  MetaversePresenceRuntime,
  type MetaverseLocalPlayerIdentity,
  type MetaversePresenceClientRuntime
} from "./metaverse-presence-runtime";
import {
  MetaverseRemoteWorldRuntime,
  type MetaverseWorldClientRuntime
} from "./metaverse-remote-world-runtime";

interface MetaverseRendererHost {
  readonly info?: {
    readonly render?: {
      readonly calls?: number;
      readonly drawCalls?: number;
      readonly triangles?: number;
    };
  };
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
  readonly createMetaverseWorldClient?: (() => MetaverseWorldClientRuntime) | null;
  readonly createRenderer?: (
    canvas: HTMLCanvasElement
  ) => MetaverseRendererHost;
  readonly createSceneAssetLoader?: () => SceneAssetLoader;
  readonly devicePixelRatio?: number;
  readonly environmentProofConfig?: MetaverseEnvironmentProofConfig | null;
  readonly localPlayerIdentity?: MetaverseLocalPlayerIdentity | null;
  readonly physicsRuntime?: RapierPhysicsRuntime;
  readonly readNowMs?: () => number;
  readonly readWallClockMs?: () => number;
  readonly requestAnimationFrame?: typeof globalThis.requestAnimationFrame;
  readonly showPhysicsDebug?: boolean;
  readonly showSocketDebug?: boolean;
}

const metaverseUiUpdateIntervalMs = 120;

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

function freezeHudSnapshot(
  lifecycle: MetaverseHudSnapshot["lifecycle"],
  failureReason: string | null,
  boot: MetaverseHudSnapshot["boot"],
  camera: MetaverseHudSnapshot["camera"],
  focusedPortal: FocusedExperiencePortalSnapshot | null,
  focusedMountable: FocusedMountableSnapshot | null,
  mountedEnvironment: MountedEnvironmentSnapshot | null,
  controlMode: MetaverseHudSnapshot["controlMode"],
  locomotionMode: MetaverseHudSnapshot["locomotionMode"],
  presence: MetaverseHudSnapshot["presence"],
  telemetry: MetaverseHudSnapshot["telemetry"],
  transport: MetaverseHudSnapshot["transport"]
): MetaverseHudSnapshot {
  return Object.freeze({
    boot,
    camera,
    controlMode,
    failureReason,
    focusedMountable,
    focusedPortal,
    lifecycle,
    locomotionMode,
    mountedEnvironment,
    presence,
    telemetry,
    transport
  });
}

function freezeRendererTelemetrySnapshot(
  snapshot: MetaverseTelemetrySnapshot["renderer"]
): MetaverseTelemetrySnapshot["renderer"] {
  return Object.freeze({
    active: snapshot.active,
    devicePixelRatio: snapshot.devicePixelRatio,
    drawCallCount: snapshot.drawCallCount,
    label: snapshot.label,
    triangleCount: snapshot.triangleCount
  });
}

function freezeTelemetrySnapshot(
  snapshot: MetaverseTelemetrySnapshot
): MetaverseTelemetrySnapshot {
  return Object.freeze({
    frameDeltaMs: snapshot.frameDeltaMs,
    frameRate: snapshot.frameRate,
    renderedFrameCount: snapshot.renderedFrameCount,
    renderer: freezeRendererTelemetrySnapshot(snapshot.renderer),
    worldCadence: Object.freeze({
      authoritativeTickIntervalMs: snapshot.worldCadence.authoritativeTickIntervalMs,
      localAuthoritativeFreshnessMaxAgeMs:
        snapshot.worldCadence.localAuthoritativeFreshnessMaxAgeMs,
      maxExtrapolationMs: snapshot.worldCadence.maxExtrapolationMs,
      remoteInterpolationDelayMs:
        snapshot.worldCadence.remoteInterpolationDelayMs,
      worldPollIntervalMs: snapshot.worldCadence.worldPollIntervalMs
    })
  });
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
  readonly #createRenderer: (canvas: HTMLCanvasElement) => MetaverseRendererHost;
  readonly #createSceneAssetLoader: () => SceneAssetLoader;
  readonly #devicePixelRatio: number;
  readonly #environmentProofConfig: MetaverseEnvironmentProofConfig | null;
  readonly #environmentPhysicsRuntime: MetaverseEnvironmentPhysicsRuntime;
  readonly #flightInputRuntime = new MetaverseFlightInputRuntime();
  readonly #groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly #physicsRuntime: RapierPhysicsRuntime;
  readonly #presenceRuntime: MetaversePresenceRuntime;
  readonly #remoteWorldRuntime: MetaverseRemoteWorldRuntime;
  readonly #sceneRuntime: ReturnType<typeof createMetaverseScene>;
  readonly #traversalRuntime: MetaverseTraversalRuntime;
  readonly #uiUpdateListeners = new Set<() => void>();

  #animationFrameHandle = 0;
  #bootRendererInitialized = false;
  #bootScenePrewarmed = false;
  #canvas: HTMLCanvasElement | null = null;
  #controlMode: MetaverseControlModeId = defaultMetaverseControlMode;
  #frameDeltaMs = 0;
  #frameRate = 0;
  #focusedMountable: FocusedMountableSnapshot | null = null;
  #focusedPortal: FocusedExperiencePortalSnapshot | null = null;
  #hudSnapshot: MetaverseHudSnapshot;
  #lastFrameAtMs: number | null = null;
  #lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;
  #mountedEnvironment: MountedEnvironmentSnapshot | null = null;
  #renderer: MetaverseRendererHost | null = null;
  #runtimeEpoch = 0;
  #requestAnimationFrame: typeof globalThis.requestAnimationFrame;
  #cancelAnimationFrame: typeof globalThis.cancelAnimationFrame;
  #readNowMs: () => number;
  #readWallClockMs: () => number;
  #renderedFrameCount = 0;
  #startPromise: Promise<MetaverseHudSnapshot> | null = null;

  constructor(
    config: MetaverseRuntimeConfig = metaverseRuntimeConfig,
    dependencies: MetaverseRuntimeDependencies = {}
  ) {
    this.#config = config;
    this.#createRenderer = dependencies.createRenderer ?? createDefaultRenderer;
    this.#createSceneAssetLoader =
      dependencies.createSceneAssetLoader ?? createDefaultSceneAssetLoader;
    this.#devicePixelRatio =
      dependencies.devicePixelRatio ?? globalThis.window?.devicePixelRatio ?? 1;
    this.#environmentProofConfig = dependencies.environmentProofConfig ?? null;
    this.#physicsRuntime =
      dependencies.physicsRuntime ?? new RapierPhysicsRuntime();
    this.#groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
      {
        ...config.groundedBody,
        maxTurnSpeedRadiansPerSecond:
          config.groundedBody.maxTurnSpeedRadiansPerSecond,
        worldRadius: config.movement.worldRadius
      },
      this.#physicsRuntime
    );
    this.#requestAnimationFrame =
      dependencies.requestAnimationFrame ?? requestBrowserAnimationFrame;
    this.#cancelAnimationFrame =
      dependencies.cancelAnimationFrame ?? cancelBrowserAnimationFrame;
    this.#readNowMs = dependencies.readNowMs ?? readNowMs;
    this.#readWallClockMs = dependencies.readWallClockMs ?? Date.now;
    this.#sceneRuntime = createMetaverseScene(config, {
      attachmentProofConfig: dependencies.attachmentProofConfig ?? null,
      characterProofConfig: dependencies.characterProofConfig ?? null,
      createSceneAssetLoader: this.#createSceneAssetLoader,
      environmentProofConfig: this.#environmentProofConfig,
      showSocketDebug: dependencies.showSocketDebug ?? false
    });
    this.#environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
      config,
      {
        createSceneAssetLoader: this.#createSceneAssetLoader,
        environmentProofConfig: this.#environmentProofConfig,
        groundedBodyRuntime: this.#groundedBodyRuntime,
        physicsRuntime: this.#physicsRuntime,
        sceneRuntime: this.#sceneRuntime,
        showPhysicsDebug: dependencies.showPhysicsDebug ?? false
      }
    );
    this.#traversalRuntime = new MetaverseTraversalRuntime(config, {
      groundedBodyRuntime: this.#groundedBodyRuntime,
      readDynamicEnvironmentPose: (environmentAssetId) =>
        this.#sceneRuntime.readDynamicEnvironmentPose(environmentAssetId),
      readMountedEnvironmentAnchorSnapshot: (mountedEnvironment) =>
        this.#sceneRuntime.readMountedEnvironmentAnchorSnapshot(
          mountedEnvironment
        ),
      readMountableEnvironmentConfig: (environmentAssetId) =>
        this.#environmentProofConfig?.assets.find(
          (environmentAsset) =>
            environmentAsset.environmentAssetId === environmentAssetId &&
            environmentAsset.traversalAffordance === "mount" &&
            environmentAsset.seats !== null
        ) ?? null,
      setDynamicEnvironmentPose: (environmentAssetId, poseSnapshot) => {
        this.#environmentPhysicsRuntime.setDynamicEnvironmentPose(
          environmentAssetId,
          poseSnapshot
        );
        this.#sceneRuntime.setDynamicEnvironmentPose(
          environmentAssetId,
          poseSnapshot
        );
      },
      surfaceColliderSnapshots:
        this.#environmentPhysicsRuntime.surfaceColliderSnapshots
    });
    this.#presenceRuntime = new MetaversePresenceRuntime({
      createMetaversePresenceClient:
        dependencies.createMetaversePresenceClient ?? null,
      localPlayerIdentity: dependencies.localPlayerIdentity ?? null,
      onPresenceUpdate: () => {
        this.#syncOrPublishRuntimeState(true);
      }
    });
    this.#remoteWorldRuntime = new MetaverseRemoteWorldRuntime({
      createMetaverseWorldClient:
        dependencies.createMetaverseWorldClient ?? null,
      localPlayerIdentity: dependencies.localPlayerIdentity ?? null,
      onRemoteWorldUpdate: () => {
        this.#syncOrPublishRuntimeState(true);
      },
      readWallClockMs: this.#readWallClockMs,
      samplingConfig: metaverseRemoteWorldSamplingConfig
    });
    this.#hudSnapshot = freezeHudSnapshot(
      "idle",
      null,
      this.#createBootSnapshot("idle"),
      this.#traversalRuntime.cameraSnapshot,
      null,
      null,
      null,
      this.#controlMode,
      this.#traversalRuntime.locomotionMode,
      this.#presenceRuntime.resolveHudSnapshot(),
      this.#createTelemetrySnapshot(),
      this.#createTransportSnapshot()
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
    this.#flightInputRuntime.reset();
    this.#syncOrPublishRuntimeState(true);
  }

  boardMountable(entryId: string | null = null): void {
    if (this.#focusedMountable === null) {
      return;
    }

    this.#traversalRuntime.boardEnvironment(
      this.#focusedMountable.environmentAssetId,
      entryId
    );
    this.#syncOrPublishRuntimeState(true);
  }

  occupySeat(seatId: string): void {
    const environmentAssetId =
      this.#mountedEnvironment?.environmentAssetId ??
      this.#focusedMountable?.environmentAssetId ??
      null;

    if (environmentAssetId === null) {
      return;
    }

    this.#traversalRuntime.occupySeat(environmentAssetId, seatId);
    this.#syncOrPublishRuntimeState(true);
  }

  leaveMountedEnvironment(): void {
    this.#traversalRuntime.leaveMountedEnvironment();
    this.#syncOrPublishRuntimeState(true);
  }

  toggleMount(): void {
    if (this.#mountedEnvironment === null) {
      this.boardMountable();
      return;
    }

    this.leaveMountedEnvironment();
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
    this.#bootRendererInitialized = false;
    this.#bootScenePrewarmed = false;
    this.#focusedMountable = null;
    this.#focusedPortal = null;
    this.#mountedEnvironment = null;
    this.#presenceRuntime.dispose();
    this.#remoteWorldRuntime.dispose();
    this.#setHudSnapshot("booting", null, true);
    this.#flightInputRuntime.install(canvas);
    const renderer = this.#createRenderer(canvas);

    this.#renderer = renderer;

    try {
      await renderer.init();
      this.#bootRendererInitialized = true;
      this.#setHudSnapshot("booting", null, true);
      await this.#sceneRuntime.boot();
      await this.#bootGroundedRuntime();
      this.#sceneRuntime.syncViewport(
        renderer,
        canvas as MetaverseSceneCanvasHost,
        this.#devicePixelRatio
      );
      await this.#sceneRuntime.prewarm(renderer);
      this.#bootScenePrewarmed = true;
      this.#setHudSnapshot("booting", null, true);
    } catch (error) {
      if (this.#renderer === renderer) {
        this.#renderer = null;
      }

      renderer.dispose();
      this.#flightInputRuntime.dispose();
      this.#environmentPhysicsRuntime.dispose();
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

      this.#flightInputRuntime.dispose();
      this.#environmentPhysicsRuntime.dispose();
      renderer.dispose();

      return this.#hudSnapshot;
    }

    this.#lastFrameAtMs = this.#readNowMs();
    this.#frameDeltaMs = 0;
    this.#frameRate = 0;
    this.#renderedFrameCount = 0;
    this.#presenceRuntime.boot(
      this.#readCharacterPresentationSnapshot(),
      this.#traversalRuntime.locomotionMode,
      this.#traversalRuntime.mountedEnvironmentSnapshot
    );
    this.#remoteWorldRuntime.boot();
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

    this.#flightInputRuntime.dispose();
    this.#renderer?.dispose();
    this.#renderer = null;
    this.#canvas = null;
    this.#frameDeltaMs = 0;
    this.#frameRate = 0;
    this.#lastFrameAtMs = null;
    this.#lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;
    this.#focusedMountable = null;
    this.#focusedPortal = null;
    this.#bootRendererInitialized = false;
    this.#bootScenePrewarmed = false;
    this.#mountedEnvironment = null;
    this.#renderedFrameCount = 0;
    this.#environmentPhysicsRuntime.dispose();
    this.#presenceRuntime.dispose();
    this.#remoteWorldRuntime.dispose();
    this.#traversalRuntime.reset();
    this.#sceneRuntime.resetPresentation();

    if (this.#hudSnapshot.lifecycle !== "failed") {
      this.#setHudSnapshot("idle", null, true);
    }
  }

  #queueNextFrame(): void {
    this.#animationFrameHandle = this.#requestAnimationFrame((nextFrameAtMs) => {
      this.#animationFrameHandle = 0;
      this.#syncFrame(nextFrameAtMs, false);
      this.#queueNextFrame();
    });
  }

  async #bootGroundedRuntime(): Promise<void> {
    await this.#environmentPhysicsRuntime.boot(
      this.#traversalRuntime.cameraSnapshot.yawRadians
    );
    this.#traversalRuntime.boot();
  }

  #readCharacterPresentationSnapshot():
    | MetaverseCharacterPresentationSnapshot
    | null {
    return this.#traversalRuntime.characterPresentationSnapshot;
  }

  #syncFrame(nowMs: number, forceUiUpdate: boolean): void {
    if (this.#renderer === null || this.#canvas === null) {
      return;
    }

    const deltaSeconds =
      this.#lastFrameAtMs === null
        ? 0
        : Math.min(0.1, Math.max(0, (nowMs - this.#lastFrameAtMs) / 1000));

    this.#frameDeltaMs = deltaSeconds * 1000;
    this.#frameRate = deltaSeconds > 0 ? 1 / deltaSeconds : 0;
    this.#lastFrameAtMs = nowMs;
    this.#remoteWorldRuntime.syncConnection(this.#presenceRuntime.isJoined);
    this.#remoteWorldRuntime.sampleRemoteWorld();
    this.#syncVehicleAuthorityFromWorldSnapshots();
    const movementInput = this.#flightInputRuntime.readSnapshot();
    const cameraSnapshot = this.#traversalRuntime.advance(
      movementInput,
      deltaSeconds
    );
    this.#mountedEnvironment = this.#traversalRuntime.mountedEnvironmentSnapshot;
    this.#remoteWorldRuntime.syncLocalDriverVehicleControl(
      this.#traversalRuntime.routedDriverVehicleControlIntentSnapshot
    );
    this.#environmentPhysicsRuntime.syncPushableBodyPresentations();
    this.#presenceRuntime.syncPresencePose(
      this.#readCharacterPresentationSnapshot(),
      this.#traversalRuntime.locomotionMode,
      this.#mountedEnvironment
    );
    this.#presenceRuntime.syncRemoteCharacterPresentations();
    const remoteCharacterPresentations =
      this.#remoteWorldRuntime.hasWorldSnapshot
        ? this.#remoteWorldRuntime.remoteCharacterPresentations
        : this.#presenceRuntime.remoteCharacterPresentations;

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
      remoteCharacterPresentations,
      this.#mountedEnvironment
    );

    this.#environmentPhysicsRuntime.syncDebugPresentation();
    this.#focusedMountable = sceneInteractionSnapshot.focusedMountable;
    this.#mountedEnvironment = this.#traversalRuntime.mountedEnvironmentSnapshot;
    this.#renderer.render(this.#sceneRuntime.scene, this.#sceneRuntime.camera);
    this.#renderedFrameCount += 1;
    this.#setHudSnapshot("running", null, forceUiUpdate);
  }

  #syncVehicleAuthorityFromWorldSnapshots(): void {
    const mountedEnvironment = this.#traversalRuntime.mountedEnvironmentSnapshot;
    const localMountedEnvironmentAssetId =
      mountedEnvironment?.environmentAssetId ?? null;

    for (const remoteVehiclePresentation of this.#remoteWorldRuntime
      .remoteVehiclePresentations) {
      if (
        localMountedEnvironmentAssetId !== null &&
        remoteVehiclePresentation.environmentAssetId ===
          localMountedEnvironmentAssetId
      ) {
        continue;
      }

      this.#traversalRuntime.syncAuthoritativeVehiclePose(
        remoteVehiclePresentation.environmentAssetId,
        {
          position: remoteVehiclePresentation.position,
          yawRadians: remoteVehiclePresentation.yawRadians
        }
      );
    }

    if (localMountedEnvironmentAssetId === null) {
      return;
    }

    const localMountedVehicleAuthority =
      this.#remoteWorldRuntime.readFreshAuthoritativeVehicleSnapshot(
        localMountedEnvironmentAssetId,
        metaverseLocalMountedVehicleReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );

    if (localMountedVehicleAuthority === null) {
      return;
    }

    this.#traversalRuntime.syncAuthoritativeVehiclePose(
      localMountedEnvironmentAssetId,
      {
        linearVelocity: localMountedVehicleAuthority.linearVelocity,
        position: localMountedVehicleAuthority.position,
        yawRadians: localMountedVehicleAuthority.yawRadians
      }
    );
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
      this.#createBootSnapshot(lifecycle),
      this.#traversalRuntime.cameraSnapshot,
      this.#focusedPortal,
      this.#focusedMountable,
      this.#mountedEnvironment,
      this.#controlMode,
      this.#traversalRuntime.locomotionMode,
      this.#presenceRuntime.resolveHudSnapshot(),
      this.#createTelemetrySnapshot(),
      this.#createTransportSnapshot()
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

  #createBootSnapshot(
    lifecycle: MetaverseHudSnapshot["lifecycle"]
  ): MetaverseHudSnapshot["boot"] {
    const presenceJoined = this.#presenceRuntime.isJoined;
    const authoritativeWorldConnected = this.#remoteWorldRuntime.isConnected;
    let phase: MetaverseBootPhaseState;

    if (lifecycle === "failed") {
      phase = "failed";
    } else if (lifecycle === "idle") {
      phase = "idle";
    } else if (!this.#bootRendererInitialized) {
      phase = "renderer-init";
    } else if (!this.#bootScenePrewarmed) {
      phase = "scene-prewarm";
    } else if (!presenceJoined) {
      phase = "presence-joining";
    } else if (!authoritativeWorldConnected) {
      phase = "world-connecting";
    } else {
      phase = "ready";
    }

    return Object.freeze({
      authoritativeWorldConnected,
      phase,
      presenceJoined,
      rendererInitialized: this.#bootRendererInitialized,
      scenePrewarmed: this.#bootScenePrewarmed
    });
  }

  #createTransportSnapshot(): MetaverseHudSnapshot["transport"] {
    return Object.freeze({
      presenceReliable: this.#presenceRuntime.reliableTransportStatusSnapshot,
      worldDriverDatagram:
        this.#remoteWorldRuntime.driverVehicleControlDatagramStatusSnapshot,
      worldReliable: this.#remoteWorldRuntime.reliableTransportStatusSnapshot
    });
  }

  #createTelemetrySnapshot(): MetaverseHudSnapshot["telemetry"] {
    const renderInfo = this.#renderer?.info?.render;

    return freezeTelemetrySnapshot({
      frameDeltaMs: this.#frameDeltaMs,
      frameRate: this.#frameRate,
      renderedFrameCount: this.#renderedFrameCount,
      renderer: {
        active: this.#renderer !== null,
        devicePixelRatio: this.#devicePixelRatio,
        drawCallCount: renderInfo?.drawCalls ?? renderInfo?.calls ?? 0,
        label: "WebGPU",
        triangleCount: renderInfo?.triangles ?? 0
      },
      worldCadence: {
        authoritativeTickIntervalMs:
          this.#remoteWorldRuntime.latestAuthoritativeTickIntervalMs,
        localAuthoritativeFreshnessMaxAgeMs:
          metaverseLocalMountedVehicleReconciliationConfig.maxAuthoritativeSnapshotAgeMs,
        maxExtrapolationMs: metaverseRemoteWorldSamplingConfig.maxExtrapolationMs,
        remoteInterpolationDelayMs:
          metaverseRemoteWorldSamplingConfig.interpolationDelayMs,
        worldPollIntervalMs:
          this.#remoteWorldRuntime.currentPollIntervalMs ??
          Number(metaverseWorldClientConfig.defaultPollIntervalMs)
      }
    });
  }
}
