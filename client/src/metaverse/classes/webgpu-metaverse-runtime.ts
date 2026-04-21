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
import { MetaverseRuntimeStartCoordinator } from "../boot/metaverse-runtime-start-coordinator";
import { MetaverseRuntimeBootLifecycle } from "../boot/metaverse-runtime-boot-lifecycle";
import { defaultMetaverseControlMode } from "../config/metaverse-control-modes";
import { metaverseRuntimeCameraPhaseConfig } from "../config/metaverse-runtime-camera-phase";
import { metaverseRuntimeConfig } from "../config/metaverse-runtime";
import {
  metaverseRealtimeMigrationConfig,
  metaverseRemoteWorldSamplingConfig
} from "../config/metaverse-world-network";
import { MetaverseRuntimeHudPublisher } from "../hud/metaverse-runtime-hud-publisher";
import {
  createMetaverseScene,
  type SceneAssetLoader
} from "../render/webgpu-metaverse-scene";
import type { MetaverseControlModeId } from "../types/metaverse-control-mode";
import type { MetaverseRuntimeCameraPhaseConfig } from "../types/metaverse-runtime-camera-phase";
import type {
  MetaverseAttachmentProofConfig,
  MetaverseCameraSnapshot,
  MetaverseCharacterProofConfig,
  MetaverseEnvironmentProofConfig,
  MetaverseHudSnapshot,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";
import { MetaverseAuthoritativeWorldSync } from "./metaverse-authoritative-world-sync";
import { MetaverseEnvironmentPhysicsRuntime } from "./metaverse-environment-physics-runtime";
import { MetaverseFlightInputRuntime } from "./metaverse-flight-input-runtime";
import { MetaverseMountedInteractionRuntime } from "./metaverse-mounted-interaction-runtime";
import { MetaverseRuntimeCameraPhaseState } from "./metaverse-runtime-camera-phase-state";
import {
  MetaversePresenceRuntime,
  type MetaverseLocalPlayerIdentity,
  type MetaversePresenceClientRuntime
} from "./metaverse-presence-runtime";
import {
  MetaverseRemoteWorldRuntime,
  type MetaverseWorldClientRuntime
} from "./metaverse-remote-world-runtime";
import { MetaverseRuntimeFrameLoop } from "./metaverse-runtime-frame-loop";
import { MetaverseRuntimeRenderSession } from "./metaverse-runtime-render-session";
import { MetaverseRuntimeServiceLifecycle } from "./metaverse-runtime-service-lifecycle";
import { MetaverseTraversalRuntime } from "./metaverse-traversal-runtime";
import { MetaverseWeaponPresentationRuntime } from "./metaverse-weapon-presentation-runtime";

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
  readonly authoritativePlayerMovementEnabled?: boolean;
  readonly cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame;
  readonly characterProofConfig?: MetaverseCharacterProofConfig | null;
  readonly ensureAuthoritativeWorldBundleSynchronized?:
    | (() => Promise<void>)
    | null;
  readonly createMetaversePresenceClient?: (() => MetaversePresenceClientRuntime) | null;
  readonly createMetaverseWorldClient?:
    | ((
        dependencies?: {
          readonly readEstimatedServerTimeMs?:
            | ((localWallClockMs: number) => number)
            | undefined;
        }
      ) => MetaverseWorldClientRuntime)
    | null;
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
  readonly runtimeCameraPhaseConfig?: MetaverseRuntimeCameraPhaseConfig;
  readonly showPhysicsDebug?: boolean;
  readonly showSocketDebug?: boolean;
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

export class WebGpuMetaverseRuntime {
  readonly #bootLifecycle: MetaverseRuntimeBootLifecycle;
  readonly #flightInputRuntime = new MetaverseFlightInputRuntime();
  readonly #hudPublisher: MetaverseRuntimeHudPublisher;
  readonly #mountedInteractionRuntime: MetaverseMountedInteractionRuntime;
  readonly #renderSession: MetaverseRuntimeRenderSession;
  readonly #startCoordinator: MetaverseRuntimeStartCoordinator;
  readonly #weaponPresentationRuntime: MetaverseWeaponPresentationRuntime;

  #controlMode: MetaverseControlModeId = defaultMetaverseControlMode;

  constructor(
    config: MetaverseRuntimeConfig = metaverseRuntimeConfig,
    dependencies: MetaverseRuntimeDependencies = {}
  ) {
    const createRenderer = dependencies.createRenderer ?? createDefaultRenderer;
    const createSceneAssetLoader =
      dependencies.createSceneAssetLoader ?? createDefaultSceneAssetLoader;
    const devicePixelRatio =
      dependencies.devicePixelRatio ?? globalThis.window?.devicePixelRatio ?? 1;
    const environmentProofConfig = dependencies.environmentProofConfig ?? null;
    const physicsRuntime =
      dependencies.physicsRuntime ?? new RapierPhysicsRuntime();
    const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
      {
        ...config.groundedBody,
        maxTurnSpeedRadiansPerSecond:
          config.groundedBody.maxTurnSpeedRadiansPerSecond,
        worldRadius: config.movement.worldRadius
      },
      physicsRuntime
    );
    const requestAnimationFrameImpl =
      dependencies.requestAnimationFrame ?? requestBrowserAnimationFrame;
    const cancelAnimationFrameImpl =
      dependencies.cancelAnimationFrame ?? cancelBrowserAnimationFrame;
    const readNowMsImpl = dependencies.readNowMs ?? readNowMs;
    const readWallClockMsImpl = dependencies.readWallClockMs ?? Date.now;
    const runtimeCameraPhaseConfig =
      dependencies.runtimeCameraPhaseConfig ?? metaverseRuntimeCameraPhaseConfig;

    const sceneRuntime = createMetaverseScene(config, {
      attachmentProofConfig: dependencies.attachmentProofConfig ?? null,
      characterProofConfig: dependencies.characterProofConfig ?? null,
      createSceneAssetLoader,
      environmentProofConfig,
      showSocketDebug: dependencies.showSocketDebug ?? false
    });
    const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
      config,
      {
        createSceneAssetLoader,
        environmentProofConfig,
        groundedBodyRuntime,
        physicsRuntime,
        sceneRuntime,
        showPhysicsDebug: dependencies.showPhysicsDebug ?? false
      }
    );
    const traversalRuntime = new MetaverseTraversalRuntime(config, {
      groundedBodyRuntime,
      physicsRuntime,
      readWallClockMs: readWallClockMsImpl,
      readDynamicEnvironmentCollisionPose: (environmentAssetId) =>
        environmentPhysicsRuntime.readDynamicEnvironmentCollisionPose(
          environmentAssetId
        ),
      readMountedEnvironmentAnchorSnapshot: (mountedEnvironment) =>
        sceneRuntime.readMountedEnvironmentAnchorSnapshot(mountedEnvironment),
      readMountableEnvironmentConfig: (environmentAssetId) =>
        environmentProofConfig?.assets.find(
          (environmentAsset) =>
            environmentAsset.environmentAssetId === environmentAssetId &&
            environmentAsset.traversalAffordance === "mount" &&
            environmentAsset.seats !== null
        ) ?? null,
      resolveGroundedTraversalFilterPredicate: (excludedColliders = []) =>
        environmentPhysicsRuntime.resolveGroundedTraversalFilterPredicate(
          excludedColliders
        ),
      resolveWaterborneTraversalFilterPredicate: (
        excludedOwnerEnvironmentAssetId = null,
        excludedColliders = []
      ) =>
        environmentPhysicsRuntime.resolveWaterborneTraversalFilterPredicate(
          excludedOwnerEnvironmentAssetId,
          excludedColliders
        ),
      setDynamicEnvironmentPose: (environmentAssetId, poseSnapshot) => {
        environmentPhysicsRuntime.setDynamicEnvironmentPose(
          environmentAssetId,
          poseSnapshot
        );
        sceneRuntime.setDynamicEnvironmentPose(environmentAssetId, poseSnapshot);
      },
      surfaceColliderSnapshots: environmentPhysicsRuntime.surfaceColliderSnapshots
    });
    const remoteWorldRuntime = new MetaverseRemoteWorldRuntime({
      createMetaverseWorldClient:
        dependencies.createMetaverseWorldClient ?? null,
      localPlayerIdentity: dependencies.localPlayerIdentity ?? null,
      onRemoteWorldUpdate: () => {
        this.#renderSession.publishRuntimeHudSnapshot(false);
      },
      presentationConfig: config,
      readWallClockMs: readWallClockMsImpl,
      samplingConfig: metaverseRemoteWorldSamplingConfig
    });
    this.#weaponPresentationRuntime = new MetaverseWeaponPresentationRuntime(
      config,
      {
        attachmentProofConfig: dependencies.attachmentProofConfig ?? null
      }
    );
    const presenceRuntime = new MetaversePresenceRuntime({
      createMetaversePresenceClient:
        dependencies.createMetaversePresenceClient ?? null,
      localPlayerIdentity: dependencies.localPlayerIdentity ?? null,
      onPresenceUpdate: () => {
        remoteWorldRuntime.syncConnection(
          !presenceRuntime.connectionRequired || presenceRuntime.isJoined
        );
        this.#renderSession.publishRuntimeHudSnapshot(false);
      }
    });
    const authoritativeWorldSync = new MetaverseAuthoritativeWorldSync({
      authoritativePlayerMovementEnabled:
        dependencies.authoritativePlayerMovementEnabled ??
        metaverseRealtimeMigrationConfig.metaverseAuthoritativePlayerMovementEnabled,
      dynamicEnvironmentPresentationRuntime: {
        syncRemoteVehiclePresentationPose: (environmentAssetId, poseSnapshot) =>
          sceneRuntime.setDynamicEnvironmentPose(environmentAssetId, poseSnapshot),
        syncRemoteEnvironmentBodyPresentationPose: (
          environmentAssetId,
          poseSnapshot
        ) => sceneRuntime.setDynamicEnvironmentPose(environmentAssetId, poseSnapshot)
      },
      environmentBodyCollisionRuntime: {
        beginAuthoritativeEnvironmentBodyCollisionSync: () =>
          environmentPhysicsRuntime.beginAuthoritativeEnvironmentBodyCollisionSync(),
        syncAuthoritativeEnvironmentBodyCollisionPose: (
          environmentAssetId,
          poseSnapshot
        ) =>
          environmentPhysicsRuntime.syncAuthoritativeEnvironmentBodyCollisionPose(
            environmentAssetId,
            poseSnapshot
          )
      },
      readWallClockMs: readWallClockMsImpl,
      remoteWorldRuntime,
      traversalRuntime,
      vehicleCollisionRuntime: {
        syncAuthoritativeVehicleCollisionPose: (environmentAssetId, poseSnapshot) =>
          environmentPhysicsRuntime.setDynamicEnvironmentPose(
            environmentAssetId,
            poseSnapshot
          )
      }
    });
    const cameraPhaseState = new MetaverseRuntimeCameraPhaseState({
      cameraConfig: config.camera,
      config: runtimeCameraPhaseConfig,
      environmentProofConfig,
      portals: config.portals
    });
    const bootLifecycle = new MetaverseRuntimeBootLifecycle({
      cameraPhaseState,
      devicePixelRatio,
      readNowMs: readNowMsImpl,
      sceneRuntime
    });
    this.#bootLifecycle = bootLifecycle;

    this.#hudPublisher = new MetaverseRuntimeHudPublisher({
      config,
      devicePixelRatio,
      environmentPhysicsRuntime,
      initialControlMode: this.#controlMode,
      presenceRuntime,
      readNowMs: readNowMsImpl,
      remoteWorldRuntime,
      traversalRuntime,
      weaponPresentationRuntime: this.#weaponPresentationRuntime
    });

    const frameLoop = new MetaverseRuntimeFrameLoop({
      authoritativeWorldSync,
      bootLifecycle,
      devicePixelRatio,
      environmentPhysicsRuntime,
      flightInputRuntime: this.#flightInputRuntime,
      hudPublisher: this.#hudPublisher,
      portals: config.portals,
      presenceRuntime,
      remoteWorldRuntime,
      sceneRuntime,
      traversalRuntime,
      weaponPresentationRuntime: this.#weaponPresentationRuntime
    });

    this.#renderSession = new MetaverseRuntimeRenderSession({
      bootLifecycle,
      cancelAnimationFrame: cancelAnimationFrameImpl,
      frameLoop,
      hudPublisher: this.#hudPublisher,
      readControlMode: () => this.#controlMode,
      readNowMs: readNowMsImpl,
      requestAnimationFrame: requestAnimationFrameImpl
    });

    this.#mountedInteractionRuntime = new MetaverseMountedInteractionRuntime({
      authoritativeWorldSync,
      frameLoop,
      remoteWorldRuntime,
      traversalRuntime
    });

    const serviceLifecycle = new MetaverseRuntimeServiceLifecycle({
      authoritativeWorldSync,
      bootLifecycle,
      environmentPhysicsRuntime,
      ensureAuthoritativeWorldBundleSynchronized:
        dependencies.ensureAuthoritativeWorldBundleSynchronized ?? null,
      flightInputRuntime: this.#flightInputRuntime,
      frameLoop,
      hudPublisher: this.#hudPublisher,
      presenceRuntime,
      readNowMs: readNowMsImpl,
      remoteWorldRuntime,
      sceneRuntime,
      traversalRuntime,
      weaponPresentationRuntime: this.#weaponPresentationRuntime
    });

    this.#startCoordinator = new MetaverseRuntimeStartCoordinator({
      createRenderer,
      readHudSnapshot: () => this.hudSnapshot,
      renderSession: this.#renderSession,
      serviceLifecycle
    });
  }

  get hudSnapshot(): MetaverseHudSnapshot {
    return this.#hudPublisher.hudSnapshot;
  }

  get weaponHudSnapshot(): MetaverseHudSnapshot["weapon"] {
    return this.#weaponPresentationRuntime.hudSnapshot;
  }

  subscribeUiUpdates(listener: () => void): () => void {
    return this.#hudPublisher.subscribeUiUpdates(listener);
  }

  subscribeWeaponUiUpdates(listener: () => void): () => void {
    return this.#weaponPresentationRuntime.subscribeUiUpdates(listener);
  }

  setControlMode(controlMode: MetaverseControlModeId): void {
    if (controlMode === this.#controlMode) {
      return;
    }

    this.#controlMode = controlMode;
    this.#flightInputRuntime.reset();
    this.#weaponPresentationRuntime.reset();
    this.#renderSession.syncOrPublishRuntimeState(true);
  }

  boardMountable(entryId: string | null = null): void {
    if (!this.#mountedInteractionRuntime.boardMountable(entryId)) {
      return;
    }

    this.#renderSession.syncOrPublishRuntimeState(true);
  }

  occupySeat(seatId: string): void {
    if (!this.#mountedInteractionRuntime.occupySeat(seatId)) {
      return;
    }

    this.#renderSession.syncOrPublishRuntimeState(true);
  }

  leaveMountedEnvironment(): void {
    this.#mountedInteractionRuntime.leaveMountedEnvironment();
    this.#renderSession.syncOrPublishRuntimeState(true);
  }

  setDeathCameraSnapshot(snapshot: MetaverseCameraSnapshot | null): void {
    this.#bootLifecycle.setDeathCameraSnapshot(snapshot);
    this.#renderSession.syncOrPublishRuntimeState(true);
  }

  setGameplayControlLocked(locked: boolean): void {
    this.#bootLifecycle.setGameplayControlLocked(locked);
    this.#renderSession.syncOrPublishRuntimeState(true);
  }

  setRespawnControlLocked(locked: boolean): void {
    this.#bootLifecycle.setRespawnControlLocked(locked);
    this.#renderSession.syncOrPublishRuntimeState(true);
  }

  toggleMount(): void {
    if (!this.#mountedInteractionRuntime.toggleMount()) {
      return;
    }

    this.#renderSession.syncOrPublishRuntimeState(true);
  }

  async start(
    canvas: HTMLCanvasElement,
    navigatorLike: Navigator | null | undefined = globalThis.window?.navigator
  ): Promise<MetaverseHudSnapshot> {
    return this.#startCoordinator.start(canvas, navigatorLike);
  }

  dispose(): void {
    this.#startCoordinator.dispose();
  }
}
