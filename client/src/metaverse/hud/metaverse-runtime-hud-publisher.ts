import { type Camera } from "three/webgpu";

import type { MetaverseControlModeId } from "../types/metaverse-control-mode";
import type {
  FocusedExperiencePortalSnapshot,
  MetaverseHudSnapshot,
  MetaverseMountedInteractionSnapshot,
  MetaverseRuntimeConfig,
} from "../types/metaverse-runtime";
import {
  createMetaverseMountedInteractionHudSnapshot
} from "../states/metaverse-mounted-interaction-hud-snapshot";
import {
  createMetaverseMountedInteractionSnapshot
} from "../states/metaverse-mounted-interaction-snapshot";
import { MetaverseEnvironmentPhysicsRuntime } from "../classes/metaverse-environment-physics-runtime";
import { MetaversePresenceRuntime } from "../classes/metaverse-presence-runtime";
import { MetaverseRemoteWorldRuntime } from "../classes/metaverse-remote-world-runtime";
import { MetaverseTraversalRuntime } from "../classes/metaverse-traversal-runtime";
import {
  MetaverseRuntimeHudTelemetryState,
  type MetaverseRendererTelemetrySource
} from "./debug/metaverse-runtime-hud-telemetry-state";

interface MetaverseRuntimeHudPublisherDependencies {
  readonly config: MetaverseRuntimeConfig;
  readonly devicePixelRatio: number;
  readonly environmentPhysicsRuntime: MetaverseEnvironmentPhysicsRuntime;
  readonly initialControlMode: MetaverseControlModeId;
  readonly presenceRuntime: MetaversePresenceRuntime;
  readonly readNowMs: () => number;
  readonly remoteWorldRuntime: MetaverseRemoteWorldRuntime;
  readonly traversalRuntime: MetaverseTraversalRuntime;
}

interface PublishRuntimeHudSnapshotInput {
  readonly bootRendererInitialized: boolean;
  readonly bootScenePrewarmed: boolean;
  readonly controlMode: MetaverseControlModeId;
  readonly failureReason: string | null;
  readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
  readonly frameDeltaMs: number;
  readonly frameRate: number;
  readonly lifecycle: MetaverseHudSnapshot["lifecycle"];
  readonly mountedInteraction: MetaverseMountedInteractionSnapshot;
  readonly renderedFrameCount: number;
  readonly renderer: MetaverseRendererTelemetrySource | null;
}

const metaverseUiUpdateIntervalMs = 120;

function freezeHudSnapshot(
  lifecycle: MetaverseHudSnapshot["lifecycle"],
  failureReason: string | null,
  boot: MetaverseHudSnapshot["boot"],
  camera: MetaverseHudSnapshot["camera"],
  focusedPortal: FocusedExperiencePortalSnapshot | null,
  mountedInteraction: MetaverseMountedInteractionSnapshot,
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
    focusedPortal,
    lifecycle,
    locomotionMode,
    mountedInteraction,
    mountedInteractionHud:
      createMetaverseMountedInteractionHudSnapshot(mountedInteraction),
    presence,
    telemetry,
    transport
  });
}

export class MetaverseRuntimeHudPublisher {
  readonly #presenceRuntime: MetaversePresenceRuntime;
  readonly #readNowMs: () => number;
  readonly #remoteWorldRuntime: MetaverseRemoteWorldRuntime;
  readonly #telemetryState: MetaverseRuntimeHudTelemetryState;
  readonly #traversalRuntime: MetaverseTraversalRuntime;
  readonly #uiUpdateListeners = new Set<() => void>();

  #hudSnapshot: MetaverseHudSnapshot;
  #lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;

  constructor({
    config,
    devicePixelRatio,
    environmentPhysicsRuntime,
    initialControlMode,
    presenceRuntime,
    readNowMs,
    remoteWorldRuntime,
    traversalRuntime
  }: MetaverseRuntimeHudPublisherDependencies) {
    this.#presenceRuntime = presenceRuntime;
    this.#readNowMs = readNowMs;
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#traversalRuntime = traversalRuntime;
    this.#telemetryState = new MetaverseRuntimeHudTelemetryState({
      config,
      devicePixelRatio,
      environmentPhysicsRuntime,
      remoteWorldRuntime,
      traversalRuntime
    });
    this.#hudSnapshot = freezeHudSnapshot(
      "idle",
      null,
      Object.freeze({
        authoritativeWorldConnected: false,
        phase: "idle",
        presenceJoined: false,
        rendererInitialized: false,
        scenePrewarmed: false
      }),
      this.#traversalRuntime.cameraSnapshot,
      null,
      createMetaverseMountedInteractionSnapshot(null, null),
      initialControlMode,
      this.#traversalRuntime.locomotionMode,
      this.#presenceRuntime.resolveHudSnapshot(),
      this.#telemetryState.createSnapshot(this.#readNowMs(), {
        frameDeltaMs: 0,
        frameRate: 0,
        renderedFrameCount: 0,
        renderer: null
      }),
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

  resetTelemetryState(): void {
    this.#telemetryState.reset();
    this.#lastUiUpdateAtMs = Number.NEGATIVE_INFINITY;
  }

  trackFrameTelemetry(
    nowMs: number,
    referenceCameraSnapshot: MetaverseHudSnapshot["camera"],
    renderedCamera: Camera
  ): void {
    this.#telemetryState.trackFrame(
      nowMs,
      referenceCameraSnapshot,
      renderedCamera
    );
  }

  publishSnapshot(
    input: PublishRuntimeHudSnapshotInput,
    forceUiUpdate: boolean,
    nowMs: number | null = null
  ): void {
    const resolvedNowMs = nowMs ?? this.#readNowMs();

    this.#hudSnapshot = freezeHudSnapshot(
      input.lifecycle,
      input.failureReason,
      this.#createBootSnapshot(
        input.lifecycle,
        input.bootRendererInitialized,
        input.bootScenePrewarmed
      ),
      this.#traversalRuntime.cameraSnapshot,
      input.focusedPortal,
      input.mountedInteraction,
      input.controlMode,
      this.#traversalRuntime.locomotionMode,
      this.#presenceRuntime.resolveHudSnapshot(),
      this.#telemetryState.createSnapshot(resolvedNowMs, {
        frameDeltaMs: input.frameDeltaMs,
        frameRate: input.frameRate,
        renderedFrameCount: input.renderedFrameCount,
        renderer: input.renderer
      }),
      this.#createTransportSnapshot()
    );

    if (
      !forceUiUpdate &&
      resolvedNowMs - this.#lastUiUpdateAtMs < metaverseUiUpdateIntervalMs
    ) {
      return;
    }

    this.#lastUiUpdateAtMs = resolvedNowMs;

    for (const listener of this.#uiUpdateListeners) {
      listener();
    }
  }

  #createBootSnapshot(
    lifecycle: MetaverseHudSnapshot["lifecycle"],
    bootRendererInitialized: boolean,
    bootScenePrewarmed: boolean
  ): MetaverseHudSnapshot["boot"] {
    const presenceJoined = this.#presenceRuntime.isJoined;
    const authoritativeWorldConnected = this.#remoteWorldRuntime.isConnected;
    const presenceReady =
      !this.#presenceRuntime.connectionRequired || presenceJoined;
    const authoritativeWorldReady =
      !this.#remoteWorldRuntime.connectionRequired ||
      authoritativeWorldConnected;
    let phase: MetaverseHudSnapshot["boot"]["phase"];

    if (lifecycle === "failed") {
      phase = "failed";
    } else if (lifecycle === "idle") {
      phase = "idle";
    } else if (!bootRendererInitialized) {
      phase = "renderer-init";
    } else if (!bootScenePrewarmed) {
      phase = "scene-prewarm";
    } else if (!presenceReady) {
      phase = "presence-joining";
    } else if (!authoritativeWorldReady) {
      phase = "world-connecting";
    } else {
      phase = "ready";
    }

    return Object.freeze({
      authoritativeWorldConnected,
      phase,
      presenceJoined,
      rendererInitialized: bootRendererInitialized,
      scenePrewarmed: bootScenePrewarmed
    });
  }

  #createTransportSnapshot(): MetaverseHudSnapshot["transport"] {
    return Object.freeze({
      presenceReliable: this.#presenceRuntime.reliableTransportStatusSnapshot,
      worldDriverDatagram:
        this.#remoteWorldRuntime.driverVehicleControlDatagramStatusSnapshot,
      worldReliable: this.#remoteWorldRuntime.reliableTransportStatusSnapshot,
      worldSnapshotStream: this.#remoteWorldRuntime.snapshotStreamTelemetrySnapshot
    });
  }
}
