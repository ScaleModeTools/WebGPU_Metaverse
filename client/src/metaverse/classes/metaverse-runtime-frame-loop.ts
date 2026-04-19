import type { Camera, Scene } from "three/webgpu";
import type {
  MetaversePlayerTraversalIntentSnapshotInput,
  MetaverseRealtimePlayerSnapshot
} from "@webgpu-metaverse/shared";

import {
  metaverseLocalAuthorityReconciliationConfig
} from "../config/metaverse-world-network";
import { resolveFocusedPortalSnapshot } from "../states/metaverse-flight";
import {
  createMetaverseMountedInteractionSnapshot
} from "../states/metaverse-mounted-interaction-snapshot";
import type {
  FocusedExperiencePortalSnapshot,
  FocusedMountableSnapshot,
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseFlightInputSnapshot,
  MetaverseHudSnapshot,
  MetaverseMountedInteractionSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MountedEnvironmentSnapshot,
  MetaversePortalConfig
} from "../types/metaverse-runtime";
import type { RoutedDriverVehicleControlIntentSnapshot } from "../traversal/types/traversal";

const neutralMetaverseFlightInputSnapshot = Object.freeze({
  boost: false,
  jump: false,
  moveAxis: 0,
  pitchAxis: 0,
  primaryAction: false,
  secondaryAction: false,
  strafeAxis: 0,
  yawAxis: 0
});

interface MetaverseRuntimeFrameCanvasHost {
  readonly clientHeight: number;
  readonly clientWidth: number;
}

interface MetaverseRuntimeFrameRendererHost {
  render(scene: Scene, camera: Camera): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

interface MetaverseRuntimeFrameBootLifecycle {
  resolveRuntimeCameraPhaseState(input: {
    readonly liveCameraSnapshot: MetaverseCameraSnapshot;
    readonly liveFocusedPortal: FocusedExperiencePortalSnapshot | null;
    readonly nowMs: number;
    readonly presenceReady: boolean;
    readonly worldReady: boolean;
  }): {
    readonly blocksMovementInput: boolean;
    readonly hidesLocalCharacter: boolean;
    readonly presentationSnapshot: {
      readonly cameraSnapshot: MetaverseCameraSnapshot;
      readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
    } | null;
    readonly suppressesInteractionFocus: boolean;
  };
}

interface MetaverseRuntimeFrameAuthoritativeWorldSync {
  syncAuthoritativeWorldSnapshots(): void;
}

interface MetaverseRuntimeFrameEnvironmentPhysicsRuntime {
  syncDebugPresentation(): void;
  syncDynamicEnvironmentBodyPresentations(): void;
  syncAuthoritativeRemotePlayerBlockers(
    remotePlayerSnapshots: readonly MetaverseRealtimePlayerSnapshot[]
  ): void;
}

interface MetaverseRuntimeFrameFlightInputRuntime {
  readSnapshot(): MetaverseFlightInputSnapshot;
}

interface MetaverseRuntimeFrameHudPublisher {
  trackFrameTelemetry(
    nowMs: number,
    presentationCameraSnapshot: MetaverseCameraSnapshot,
    renderedCamera: Camera
  ): void;
}

interface MetaverseRuntimeFramePresenceRuntime {
  readonly connectionRequired: boolean;
  readonly isJoined: boolean;
  syncPresencePose(
    characterPresentationSnapshot: MetaverseCharacterPresentationSnapshot | null,
    cameraSnapshot: MetaverseCameraSnapshot,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"],
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void;
  syncRemoteCharacterPresentations(): void;
}

interface MetaverseRuntimeFrameRemoteWorldRuntime {
  readonly connectionRequired: boolean;
  readonly isConnected: boolean;
  readonly remoteCharacterPresentations:
    readonly MetaverseRemoteCharacterPresentationSnapshot[];
  readFreshAuthoritativeRemotePlayerSnapshots(
    maxAuthoritativeSnapshotAgeMs: number
  ): readonly MetaverseRealtimePlayerSnapshot[];
  previewLocalTraversalIntent(
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null
  ): unknown;
  sampleRemoteWorld(): void;
  syncConnection(presenceJoined: boolean): void;
  syncLocalDriverVehicleControl(
    controlIntentSnapshot: RoutedDriverVehicleControlIntentSnapshot | null
  ): void;
  syncLocalPlayerLook(
    lookSnapshot:
      | Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">
      | null
  ): void;
  syncLocalTraversalIntent(
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null
  ): unknown;
}

interface MetaverseRuntimeFrameSceneRuntime {
  readonly camera: Camera;
  readonly scene: Scene;
  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    focusedPortal: FocusedExperiencePortalSnapshot | null,
    nowMs: number,
    deltaSeconds: number,
    localCharacterPresentation: MetaverseCharacterPresentationSnapshot | null,
    remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[],
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): {
    readonly focusedMountable: FocusedMountableSnapshot | null;
  };
  syncViewport(
    renderer: MetaverseRuntimeFrameRendererHost,
    canvas: MetaverseRuntimeFrameCanvasHost,
    devicePixelRatio: number
  ): void;
}

interface MetaverseRuntimeFrameTraversalRuntime {
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly characterPresentationSnapshot: MetaverseCharacterPresentationSnapshot | null;
  readonly locomotionMode: MetaverseHudSnapshot["locomotionMode"];
  readonly mountedEnvironmentSnapshot: MountedEnvironmentSnapshot | null;
  readonly routedDriverVehicleControlIntentSnapshot:
    | RoutedDriverVehicleControlIntentSnapshot
    | null;
  resolveLocalTraversalIntentInput(
    movementInput: Pick<
      MetaverseFlightInputSnapshot,
      "boost" | "jump" | "moveAxis" | "pitchAxis" | "strafeAxis" | "yawAxis"
    >,
    deltaSeconds: number
  ): MetaversePlayerTraversalIntentSnapshotInput | null;
  advance(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number,
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null
  ): void;
  syncIssuedTraversalIntentSnapshot(intentSnapshot: unknown): void;
}

interface MetaverseRuntimeFrameLoopDependencies {
  readonly authoritativeWorldSync: MetaverseRuntimeFrameAuthoritativeWorldSync;
  readonly bootLifecycle: MetaverseRuntimeFrameBootLifecycle;
  readonly devicePixelRatio: number;
  readonly environmentPhysicsRuntime: MetaverseRuntimeFrameEnvironmentPhysicsRuntime;
  readonly flightInputRuntime: MetaverseRuntimeFrameFlightInputRuntime;
  readonly hudPublisher: MetaverseRuntimeFrameHudPublisher;
  readonly portals: readonly MetaversePortalConfig[];
  readonly presenceRuntime: MetaverseRuntimeFramePresenceRuntime;
  readonly remoteWorldRuntime: MetaverseRuntimeFrameRemoteWorldRuntime;
  readonly sceneRuntime: MetaverseRuntimeFrameSceneRuntime;
  readonly traversalRuntime: MetaverseRuntimeFrameTraversalRuntime;
}

interface MetaverseRuntimeFrameSyncRequest {
  readonly canvas: MetaverseRuntimeFrameCanvasHost;
  readonly nowMs: number;
  readonly renderer: MetaverseRuntimeFrameRendererHost;
}

export class MetaverseRuntimeFrameLoop {
  readonly #authoritativeWorldSync: MetaverseRuntimeFrameAuthoritativeWorldSync;
  readonly #bootLifecycle: MetaverseRuntimeFrameBootLifecycle;
  readonly #devicePixelRatio: number;
  readonly #environmentPhysicsRuntime: MetaverseRuntimeFrameEnvironmentPhysicsRuntime;
  readonly #flightInputRuntime: MetaverseRuntimeFrameFlightInputRuntime;
  readonly #hudPublisher: MetaverseRuntimeFrameHudPublisher;
  readonly #portals: readonly MetaversePortalConfig[];
  readonly #presenceRuntime: MetaverseRuntimeFramePresenceRuntime;
  readonly #remoteWorldRuntime: MetaverseRuntimeFrameRemoteWorldRuntime;
  readonly #sceneRuntime: MetaverseRuntimeFrameSceneRuntime;
  readonly #traversalRuntime: MetaverseRuntimeFrameTraversalRuntime;

  #focusedPortal: FocusedExperiencePortalSnapshot | null = null;
  #frameDeltaMs = 0;
  #frameRate = 0;
  #lastFrameAtMs: number | null = null;
  #mountedInteraction = createMetaverseMountedInteractionSnapshot(null, null);
  #renderedFrameCount = 0;

  constructor({
    authoritativeWorldSync,
    bootLifecycle,
    devicePixelRatio,
    environmentPhysicsRuntime,
    flightInputRuntime,
    hudPublisher,
    portals,
    presenceRuntime,
    remoteWorldRuntime,
    sceneRuntime,
    traversalRuntime
  }: MetaverseRuntimeFrameLoopDependencies) {
    this.#authoritativeWorldSync = authoritativeWorldSync;
    this.#bootLifecycle = bootLifecycle;
    this.#devicePixelRatio = devicePixelRatio;
    this.#environmentPhysicsRuntime = environmentPhysicsRuntime;
    this.#flightInputRuntime = flightInputRuntime;
    this.#hudPublisher = hudPublisher;
    this.#portals = portals;
    this.#presenceRuntime = presenceRuntime;
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#sceneRuntime = sceneRuntime;
    this.#traversalRuntime = traversalRuntime;
  }

  get focusedPortal(): FocusedExperiencePortalSnapshot | null {
    return this.#focusedPortal;
  }

  get frameDeltaMs(): number {
    return this.#frameDeltaMs;
  }

  get frameRate(): number {
    return this.#frameRate;
  }

  get mountedInteraction(): MetaverseMountedInteractionSnapshot {
    return this.#mountedInteraction;
  }

  get renderedFrameCount(): number {
    return this.#renderedFrameCount;
  }

  reset(): void {
    this.#focusedPortal = null;
    this.#frameDeltaMs = 0;
    this.#frameRate = 0;
    this.#lastFrameAtMs = null;
    this.#mountedInteraction = createMetaverseMountedInteractionSnapshot(
      null,
      null
    );
    this.#renderedFrameCount = 0;
  }

  syncFrame({
    canvas,
    nowMs,
    renderer
  }: MetaverseRuntimeFrameSyncRequest): void {
    const deltaSeconds =
      this.#lastFrameAtMs === null
        ? 0
        : Math.min(0.1, Math.max(0, (nowMs - this.#lastFrameAtMs) / 1000));

    this.#frameDeltaMs = deltaSeconds * 1000;
    this.#frameRate = deltaSeconds > 0 ? 1 / deltaSeconds : 0;
    this.#lastFrameAtMs = nowMs;
    const presenceReady =
      !this.#presenceRuntime.connectionRequired || this.#presenceRuntime.isJoined;
    const worldReady =
      !this.#remoteWorldRuntime.connectionRequired ||
      this.#remoteWorldRuntime.isConnected;

    this.#remoteWorldRuntime.syncConnection(presenceReady);
    this.#remoteWorldRuntime.sampleRemoteWorld();
    this.#presenceRuntime.syncRemoteCharacterPresentations();
    this.#authoritativeWorldSync.syncAuthoritativeWorldSnapshots();

    const remoteCharacterPresentations =
      this.#remoteWorldRuntime.remoteCharacterPresentations;

    this.#environmentPhysicsRuntime.syncAuthoritativeRemotePlayerBlockers(
      this.#remoteWorldRuntime.readFreshAuthoritativeRemotePlayerSnapshots(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      )
    );

    const preAdvanceCameraSnapshot = this.#traversalRuntime.cameraSnapshot;
    const preAdvanceFocusedPortal = resolveFocusedPortalSnapshot(
      preAdvanceCameraSnapshot,
      this.#portals
    );
    const preAdvanceCameraPhaseState =
      this.#bootLifecycle.resolveRuntimeCameraPhaseState({
        liveCameraSnapshot: preAdvanceCameraSnapshot,
        liveFocusedPortal: preAdvanceFocusedPortal,
        nowMs,
        presenceReady,
        worldReady
      });
    const movementInput = preAdvanceCameraPhaseState.blocksMovementInput
      ? neutralMetaverseFlightInputSnapshot
      : this.#flightInputRuntime.readSnapshot();
    const localTraversalIntentInput =
      this.#traversalRuntime.resolveLocalTraversalIntentInput(
        movementInput,
        deltaSeconds
      );

    this.#traversalRuntime.syncIssuedTraversalIntentSnapshot(
      this.#remoteWorldRuntime.previewLocalTraversalIntent(
        localTraversalIntentInput
      )
    );
    this.#traversalRuntime.advance(
      movementInput,
      deltaSeconds,
      localTraversalIntentInput
    );

    const cameraSnapshot = this.#traversalRuntime.cameraSnapshot;
    const mountedEnvironment = this.#traversalRuntime.mountedEnvironmentSnapshot;

    this.#presenceRuntime.syncPresencePose(
      this.#traversalRuntime.characterPresentationSnapshot,
      cameraSnapshot,
      this.#traversalRuntime.locomotionMode,
      mountedEnvironment
    );

    this.#remoteWorldRuntime.syncLocalPlayerLook(
      this.#traversalRuntime.locomotionMode === "mounted"
        ? cameraSnapshot
        : null
    );
    this.#remoteWorldRuntime.syncLocalDriverVehicleControl(
      this.#traversalRuntime.routedDriverVehicleControlIntentSnapshot
    );
    this.#environmentPhysicsRuntime.syncDynamicEnvironmentBodyPresentations();
    this.#traversalRuntime.syncIssuedTraversalIntentSnapshot(
      this.#remoteWorldRuntime.syncLocalTraversalIntent(localTraversalIntentInput)
    );

    const liveFocusedPortal = resolveFocusedPortalSnapshot(
      cameraSnapshot,
      this.#portals
    );
    const cameraPhaseState = this.#bootLifecycle.resolveRuntimeCameraPhaseState({
      liveCameraSnapshot: cameraSnapshot,
      liveFocusedPortal,
      nowMs,
      presenceReady,
      worldReady
    });
    const presentationSnapshot = cameraPhaseState.presentationSnapshot;
    const presentationCameraSnapshot =
      presentationSnapshot?.cameraSnapshot ?? cameraSnapshot;
    const presentationFocusedPortal =
      presentationSnapshot?.focusedPortal ?? liveFocusedPortal;

    this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
    const sceneInteractionSnapshot = this.#sceneRuntime.syncPresentation(
      presentationCameraSnapshot,
      presentationFocusedPortal,
      nowMs,
      deltaSeconds,
      cameraPhaseState.hidesLocalCharacter
        ? null
        : this.#traversalRuntime.characterPresentationSnapshot,
      remoteCharacterPresentations,
      mountedEnvironment
    );

    this.#hudPublisher.trackFrameTelemetry(
      nowMs,
      presentationCameraSnapshot,
      this.#sceneRuntime.camera
    );
    this.#environmentPhysicsRuntime.syncDebugPresentation();

    this.#focusedPortal = cameraPhaseState.suppressesInteractionFocus
      ? null
      : liveFocusedPortal;
    this.#mountedInteraction = createMetaverseMountedInteractionSnapshot(
      cameraPhaseState.suppressesInteractionFocus
        ? null
        : sceneInteractionSnapshot.focusedMountable,
      mountedEnvironment
    );
    renderer.render(this.#sceneRuntime.scene, this.#sceneRuntime.camera);
    this.#renderedFrameCount += 1;
  }
}
