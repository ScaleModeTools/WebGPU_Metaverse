import type { Camera, Scene } from "three/webgpu";

import type { MetaverseSceneRendererHost } from "../render/webgpu-metaverse-scene";
import type { MountedEnvironmentSnapshot } from "../types/mounted";
import type { MetaverseLocomotionModeId } from "../types/metaverse-locomotion-mode";
import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot
} from "../types/presentation";
import type { MetaverseHudSnapshot } from "../types/metaverse-runtime";
import type { MetaverseWeaponPresentationRuntime } from "./metaverse-weapon-presentation-runtime";

interface MetaverseRuntimeServiceLifecycleCanvasHost {
  readonly clientHeight: number;
  readonly clientWidth: number;
}

interface MetaverseRuntimeServiceLifecycleRendererHost
  extends MetaverseSceneRendererHost {
  init(): Promise<void | MetaverseRuntimeServiceLifecycleRendererHost>;
  render(scene: Scene, camera: Camera): void;
  dispose(): void;
}

interface MetaverseRuntimeServiceLifecycleAuthoritativeWorldSync {
  reset(): void;
}

interface MetaverseRuntimeServiceLifecycleBootLifecycle {
  bootRuntime(input: {
    readonly bootGroundedRuntime: () => Promise<void>;
    readonly canvas: MetaverseRuntimeServiceLifecycleCanvasHost;
    readonly renderer: MetaverseRuntimeServiceLifecycleRendererHost;
  }): Promise<void>;
  ensureRuntimeInputInstalled(
    canvas: MetaverseRuntimeServiceLifecycleCanvasHost,
    flightInputRuntime: MetaverseRuntimeServiceLifecycleFlightInputRuntime
  ): void;
  reset(): void;
}

interface MetaverseRuntimeServiceLifecycleEnvironmentPhysicsRuntime {
  boot(initialYawRadians: number): Promise<void>;
  dispose(): void;
}

interface MetaverseRuntimeServiceLifecycleFlightInputRuntime {
  install(canvas: MetaverseRuntimeServiceLifecycleCanvasHost): void;
  dispose(): void;
}

interface MetaverseRuntimeServiceLifecycleFrameLoop {
  reset(): void;
}

interface MetaverseRuntimeServiceLifecycleHudPublisher {
  resetTelemetryState(): void;
}

interface MetaverseRuntimeServiceLifecyclePresenceRuntime {
  boot(
    characterPresentationSnapshot: MetaverseCharacterPresentationSnapshot,
    cameraSnapshot: MetaverseCameraSnapshot,
    locomotionMode: MetaverseLocomotionModeId,
    mountedEnvironmentSnapshot: MountedEnvironmentSnapshot | null
  ): void;
  dispose(): void;
}

interface MetaverseRuntimeServiceLifecycleRemoteWorldRuntime {
  boot(): void;
  dispose(): void;
}

interface MetaverseRuntimeServiceLifecycleSceneRuntime {
  resetPresentation(): void;
}

interface MetaverseRuntimeServiceLifecycleTraversalRuntime {
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly characterPresentationSnapshot:
    | MetaverseCharacterPresentationSnapshot
    | null;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly mountedEnvironmentSnapshot: MountedEnvironmentSnapshot | null;
  boot(): void;
  reset(): void;
}

interface MetaverseRuntimeServiceLifecycleDependencies {
  readonly authoritativeWorldSync: MetaverseRuntimeServiceLifecycleAuthoritativeWorldSync;
  readonly bootLifecycle: MetaverseRuntimeServiceLifecycleBootLifecycle;
  readonly combatFeedbackRuntime?: {
    reset(): void;
  } | null;
  readonly combatLifecycle?: {
    reset(): void;
  } | null;
  readonly environmentPhysicsRuntime: MetaverseRuntimeServiceLifecycleEnvironmentPhysicsRuntime;
  readonly ensureAuthoritativeWorldBundleSynchronized?:
    | (() => Promise<void>)
    | null;
  readonly flightInputRuntime: MetaverseRuntimeServiceLifecycleFlightInputRuntime;
  readonly frameLoop: MetaverseRuntimeServiceLifecycleFrameLoop;
  readonly hudPublisher: MetaverseRuntimeServiceLifecycleHudPublisher;
  readonly presenceRuntime: MetaverseRuntimeServiceLifecyclePresenceRuntime;
  readonly readNowMs: () => number;
  readonly remoteWorldRuntime: MetaverseRuntimeServiceLifecycleRemoteWorldRuntime;
  readonly sceneRuntime: MetaverseRuntimeServiceLifecycleSceneRuntime;
  readonly traversalRuntime: MetaverseRuntimeServiceLifecycleTraversalRuntime;
  readonly weaponPresentationRuntime?: Pick<MetaverseWeaponPresentationRuntime, "reset">;
}

interface MetaverseRuntimeServiceBootRequest {
  readonly canvas: MetaverseRuntimeServiceLifecycleCanvasHost;
  readonly publishHudSnapshot: (
    lifecycle: MetaverseHudSnapshot["lifecycle"],
    failureReason: string | null,
    forceUiUpdate: boolean
  ) => void;
  readonly renderer: MetaverseRuntimeServiceLifecycleRendererHost;
}

interface MetaverseRuntimeServiceActivationRequest {
  readonly canvas: MetaverseRuntimeServiceLifecycleCanvasHost;
  readonly queueNextFrame: () => void;
  readonly syncFrame: (nowMs: number, forceUiUpdate: boolean) => void;
}

interface MetaverseRuntimeServiceBootCleanupRequest {
  readonly clearActiveSurface: () => void;
  readonly renderer: MetaverseRuntimeServiceLifecycleRendererHost;
}

export class MetaverseRuntimeServiceLifecycle {
  readonly #authoritativeWorldSync: MetaverseRuntimeServiceLifecycleAuthoritativeWorldSync;
  readonly #bootLifecycle: MetaverseRuntimeServiceLifecycleBootLifecycle;
  readonly #combatFeedbackRuntime: {
    reset(): void;
  } | null;
  readonly #combatLifecycle: {
    reset(): void;
  } | null;
  readonly #environmentPhysicsRuntime: MetaverseRuntimeServiceLifecycleEnvironmentPhysicsRuntime;
  readonly #ensureAuthoritativeWorldBundleSynchronized: () => Promise<void>;
  readonly #flightInputRuntime: MetaverseRuntimeServiceLifecycleFlightInputRuntime;
  readonly #frameLoop: MetaverseRuntimeServiceLifecycleFrameLoop;
  readonly #hudPublisher: MetaverseRuntimeServiceLifecycleHudPublisher;
  readonly #presenceRuntime: MetaverseRuntimeServiceLifecyclePresenceRuntime;
  readonly #readNowMs: () => number;
  readonly #remoteWorldRuntime: MetaverseRuntimeServiceLifecycleRemoteWorldRuntime;
  readonly #sceneRuntime: MetaverseRuntimeServiceLifecycleSceneRuntime;
  readonly #traversalRuntime: MetaverseRuntimeServiceLifecycleTraversalRuntime;
  readonly #weaponPresentationRuntime: Pick<
    MetaverseWeaponPresentationRuntime,
    "reset"
  > | null;

  constructor({
    authoritativeWorldSync,
    bootLifecycle,
    combatFeedbackRuntime,
    combatLifecycle,
    environmentPhysicsRuntime,
    ensureAuthoritativeWorldBundleSynchronized,
    flightInputRuntime,
    frameLoop,
    hudPublisher,
    presenceRuntime,
    readNowMs,
    remoteWorldRuntime,
    sceneRuntime,
    traversalRuntime,
    weaponPresentationRuntime
  }: MetaverseRuntimeServiceLifecycleDependencies) {
    this.#authoritativeWorldSync = authoritativeWorldSync;
    this.#bootLifecycle = bootLifecycle;
    this.#combatFeedbackRuntime = combatFeedbackRuntime ?? null;
    this.#combatLifecycle = combatLifecycle ?? null;
    this.#environmentPhysicsRuntime = environmentPhysicsRuntime;
    this.#ensureAuthoritativeWorldBundleSynchronized =
      ensureAuthoritativeWorldBundleSynchronized ?? (async () => {});
    this.#flightInputRuntime = flightInputRuntime;
    this.#frameLoop = frameLoop;
    this.#hudPublisher = hudPublisher;
    this.#presenceRuntime = presenceRuntime;
    this.#readNowMs = readNowMs;
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#sceneRuntime = sceneRuntime;
    this.#traversalRuntime = traversalRuntime;
    this.#weaponPresentationRuntime = weaponPresentationRuntime ?? null;
  }

  resetForStart(): void {
    this.#combatFeedbackRuntime?.reset();
    this.#combatLifecycle?.reset();
    this.#weaponPresentationRuntime?.reset();
    this.#traversalRuntime.reset();
    this.#frameLoop.reset();
    this.#presenceRuntime.dispose();
    this.#remoteWorldRuntime.dispose();
  }

  async beginBootRuntimeServices({
    canvas,
    publishHudSnapshot,
    renderer,
  }: MetaverseRuntimeServiceBootRequest): Promise<void> {
    publishHudSnapshot("booting", null, true);
    await this.#ensureAuthoritativeWorldBundleSynchronized();

    this.#bootLifecycle.ensureRuntimeInputInstalled(
      canvas,
      this.#flightInputRuntime
    );

    await this.#bootLifecycle.bootRuntime({
      bootGroundedRuntime: async () => {
        await this.#environmentPhysicsRuntime.boot(
          this.#traversalRuntime.cameraSnapshot.yawRadians
        );
        this.#traversalRuntime.boot();
      },
      canvas,
      renderer
    });

    publishHudSnapshot("booting", null, true);
  }

  activateBootedRuntimeServices({
    canvas,
    queueNextFrame,
    syncFrame
  }: MetaverseRuntimeServiceActivationRequest): void {
    const characterPresentationSnapshot =
      this.#traversalRuntime.characterPresentationSnapshot;

    if (characterPresentationSnapshot === null) {
      throw new Error(
        "Metaverse traversal must publish a local character presentation before runtime activation."
      );
    }

    const firstFrameAtMs = this.#readNowMs();

    this.#presenceRuntime.boot(
      characterPresentationSnapshot,
      this.#traversalRuntime.cameraSnapshot,
      this.#traversalRuntime.locomotionMode,
      this.#traversalRuntime.mountedEnvironmentSnapshot
    );
    this.#remoteWorldRuntime.boot();
    syncFrame(firstFrameAtMs, true);
    queueNextFrame();
  }

  cleanupBootAttempt({
    clearActiveSurface,
    renderer
  }: MetaverseRuntimeServiceBootCleanupRequest): void {
    clearActiveSurface();
    renderer.dispose();
    this.#flightInputRuntime.dispose();
    this.#environmentPhysicsRuntime.dispose();
  }

  disposeRuntimeServices(): void {
    this.#flightInputRuntime.dispose();
    this.#authoritativeWorldSync.reset();
    this.#combatFeedbackRuntime?.reset();
    this.#combatLifecycle?.reset();
    this.#frameLoop.reset();
    this.#environmentPhysicsRuntime.dispose();
    this.#presenceRuntime.dispose();
    this.#remoteWorldRuntime.dispose();
    this.#traversalRuntime.reset();
    this.#weaponPresentationRuntime?.reset();
    this.#sceneRuntime.resetPresentation();
    this.#bootLifecycle.reset();
    this.#hudPublisher.resetTelemetryState();
  }
}
