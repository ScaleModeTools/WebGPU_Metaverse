import { type Camera } from "three/webgpu";

import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared";

import { metaverseLocalAuthorityReconciliationConfig } from "../config/metaverse-world-network";
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
import { MetaverseWeaponPresentationRuntime } from "../classes/metaverse-weapon-presentation-runtime";
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
  readonly weaponPresentationRuntime?: MetaverseWeaponPresentationRuntime;
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

const metaverseUiUpdateIntervalMs = 16;
const metaverseRadarRangeMeters = 25;
const hiddenWeaponHudSnapshot = Object.freeze({
  adsTransitionMs: 0,
  aimMode: "hip-fire",
  reticleColor: "white",
  reticleId: "default-ring",
  reticleStyleId: "pistol-ring",
  visible: false,
  weaponId: null,
  weaponLabel: null
} satisfies MetaverseHudSnapshot["weapon"]);

function createEmptyRadarSnapshot(
  localTeamId: MetaverseHudSnapshot["radar"]["localTeamId"] = null
): MetaverseHudSnapshot["radar"] {
  return Object.freeze({
    available: false,
    enemyContacts: Object.freeze([]),
    friendlyContacts: Object.freeze([]),
    localTeamId,
    rangeMeters: metaverseRadarRangeMeters
  });
}

function freezeRadarContactSnapshot(
  localYawRadians: number,
  localPosition: {
    readonly x: number;
    readonly z: number;
  },
  contactSnapshot: {
    readonly position: {
      readonly x: number;
      readonly z: number;
    };
    readonly teamId: MetaverseHudSnapshot["radar"]["enemyContacts"][number]["teamId"];
    readonly username: MetaverseHudSnapshot["radar"]["enemyContacts"][number]["username"];
  }
): MetaverseHudSnapshot["radar"]["enemyContacts"][number] | null {
  const deltaX = contactSnapshot.position.x - localPosition.x;
  const deltaZ = contactSnapshot.position.z - localPosition.z;
  const forwardX = Math.sin(localYawRadians);
  const forwardZ = -Math.cos(localYawRadians);
  const rightX = Math.cos(localYawRadians);
  const rightZ = Math.sin(localYawRadians);
  const rightOffset = deltaX * rightX + deltaZ * rightZ;
  const forwardOffset = deltaX * forwardX + deltaZ * forwardZ;
  const distanceMeters = Math.hypot(deltaX, deltaZ);

  if (distanceMeters > metaverseRadarRangeMeters) {
    return null;
  }

  return Object.freeze({
    clamped: false,
    distanceMeters,
    radarX: rightOffset / metaverseRadarRangeMeters,
    radarY: -forwardOffset / metaverseRadarRangeMeters,
    teamId: contactSnapshot.teamId,
    username: contactSnapshot.username
  });
}

function compareRadarContacts(
  leftContact: MetaverseHudSnapshot["radar"]["enemyContacts"][number],
  rightContact: MetaverseHudSnapshot["radar"]["enemyContacts"][number]
): number {
  if (leftContact.distanceMeters !== rightContact.distanceMeters) {
    return leftContact.distanceMeters - rightContact.distanceMeters;
  }

  return leftContact.username.localeCompare(rightContact.username);
}

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
  radar: MetaverseHudSnapshot["radar"],
  telemetry: MetaverseHudSnapshot["telemetry"],
  transport: MetaverseHudSnapshot["transport"],
  weapon: MetaverseHudSnapshot["weapon"]
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
    radar,
    telemetry,
    transport,
    weapon
  });
}

export class MetaverseRuntimeHudPublisher {
  readonly #presenceRuntime: MetaversePresenceRuntime;
  readonly #readNowMs: () => number;
  readonly #remoteWorldRuntime: MetaverseRemoteWorldRuntime;
  readonly #telemetryState: MetaverseRuntimeHudTelemetryState;
  readonly #traversalRuntime: MetaverseTraversalRuntime;
  readonly #weaponPresentationRuntime:
    | Pick<MetaverseWeaponPresentationRuntime, "hudSnapshot">
    | null;
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
    traversalRuntime,
    weaponPresentationRuntime
  }: MetaverseRuntimeHudPublisherDependencies) {
    this.#presenceRuntime = presenceRuntime;
    this.#readNowMs = readNowMs;
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#traversalRuntime = traversalRuntime;
    this.#weaponPresentationRuntime = weaponPresentationRuntime ?? null;
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
      createEmptyRadarSnapshot(this.#presenceRuntime.localTeamId),
      this.#telemetryState.createSnapshot(this.#readNowMs(), {
        frameDeltaMs: 0,
        frameRate: 0,
        renderedFrameCount: 0,
        renderer: null
      }),
      this.#createTransportSnapshot(),
      this.#createWeaponSnapshot()
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
    const presenceSnapshot = this.#presenceRuntime.resolveHudSnapshot();

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
      presenceSnapshot,
      this.#createRadarSnapshot(presenceSnapshot),
      this.#telemetryState.createSnapshot(resolvedNowMs, {
        frameDeltaMs: input.frameDeltaMs,
        frameRate: input.frameRate,
        renderedFrameCount: input.renderedFrameCount,
        renderer: input.renderer
      }),
      this.#createTransportSnapshot(),
      this.#createWeaponSnapshot()
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

  #createWeaponSnapshot(): MetaverseHudSnapshot["weapon"] {
    return this.#weaponPresentationRuntime?.hudSnapshot ?? hiddenWeaponHudSnapshot;
  }

  #createRadarSnapshot(
    presenceSnapshot: MetaverseHudSnapshot["presence"]
  ): MetaverseHudSnapshot["radar"] {
    const localPlayerSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );
    const localTeamId = localPlayerSnapshot?.teamId ?? presenceSnapshot.localTeamId;

    if (localPlayerSnapshot === null || localTeamId === null) {
      return createEmptyRadarSnapshot(localTeamId);
    }

    const localBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(localPlayerSnapshot);
    const localRadarPosition =
      this.#traversalRuntime.localTraversalPoseSnapshot?.position ??
      localBodySnapshot.position;
    const localRadarYawRadians = this.#traversalRuntime.cameraSnapshot.yawRadians;
    const remoteCharacterPresentations =
      this.#remoteWorldRuntime.remoteCharacterPresentations;
    const friendlyContacts = Object.freeze(
      remoteCharacterPresentations
        .filter((playerSnapshot) => playerSnapshot.teamId === localTeamId)
        .map((playerSnapshot) =>
          freezeRadarContactSnapshot(
            localRadarYawRadians,
            localRadarPosition,
            {
              position: playerSnapshot.presentation.position,
              teamId: playerSnapshot.teamId,
              username: playerSnapshot.username
            }
          )
        )
        .filter(
          (
            contact
          ): contact is NonNullable<typeof contact> => contact !== null
        )
        .sort(compareRadarContacts)
    );
    const enemyContacts = Object.freeze(
      remoteCharacterPresentations
        .filter((playerSnapshot) => playerSnapshot.teamId !== localTeamId)
        .map((playerSnapshot) =>
          freezeRadarContactSnapshot(
            localRadarYawRadians,
            localRadarPosition,
            {
              position: playerSnapshot.presentation.position,
              teamId: playerSnapshot.teamId,
              username: playerSnapshot.username
            }
          )
        )
        .filter(
          (
            contact
          ): contact is NonNullable<typeof contact> => contact !== null
        )
        .sort(compareRadarContacts)
    );

    return Object.freeze({
      available: true,
      enemyContacts,
      friendlyContacts,
      localTeamId,
      rangeMeters: metaverseRadarRangeMeters
    });
  }
}
