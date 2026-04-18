import type { Camera, Scene } from "three/webgpu";

import { resolveFocusedPortalSnapshot } from "../states/metaverse-flight";
import type {
  FocusedExperiencePortalSnapshot,
  FocusedMountableSnapshot,
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseFlightInputSnapshot,
  MetaverseHudSnapshot,
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
  isBootCinematicActive(nowMs: number): boolean;
  resolveBootCinematicPresentationSnapshot(nowMs: number): {
    readonly cameraSnapshot: MetaverseCameraSnapshot;
    readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
  } | null;
}

interface MetaverseRuntimeFrameAuthoritativeWorldSync {
  syncAuthoritativeWorldSnapshots(): void;
}

interface MetaverseRuntimeFrameEnvironmentPhysicsRuntime {
  syncDebugPresentation(): void;
  syncPushableBodyPresentations(): void;
  syncRemoteCharacterBlockers(
    remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[]
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
  readonly remoteCharacterPresentations:
    readonly MetaverseRemoteCharacterPresentationSnapshot[];
  previewLocalTraversalIntent(
    movementInput: Pick<
      MetaverseFlightInputSnapshot,
      "boost" | "jump" | "moveAxis" | "strafeAxis" | "yawAxis"
    >,
    traversalFacing: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
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
    movementInput: Pick<
      MetaverseFlightInputSnapshot,
      "boost" | "jump" | "moveAxis" | "strafeAxis" | "yawAxis"
    >,
    traversalFacing: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
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
  advance(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
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

  #focusedMountable: FocusedMountableSnapshot | null = null;
  #focusedPortal: FocusedExperiencePortalSnapshot | null = null;
  #frameDeltaMs = 0;
  #frameRate = 0;
  #lastFrameAtMs: number | null = null;
  #mountedEnvironment: MountedEnvironmentSnapshot | null = null;
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

  get focusedMountable(): FocusedMountableSnapshot | null {
    return this.#focusedMountable;
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

  get mountedEnvironment(): MountedEnvironmentSnapshot | null {
    return this.#mountedEnvironment;
  }

  get renderedFrameCount(): number {
    return this.#renderedFrameCount;
  }

  reset(): void {
    this.#focusedMountable = null;
    this.#focusedPortal = null;
    this.#frameDeltaMs = 0;
    this.#frameRate = 0;
    this.#lastFrameAtMs = null;
    this.#mountedEnvironment = null;
    this.#renderedFrameCount = 0;
  }

  syncFrame({
    canvas,
    nowMs,
    renderer
  }: MetaverseRuntimeFrameSyncRequest): void {
    const bootCinematicActive = this.#bootLifecycle.isBootCinematicActive(nowMs);
    const deltaSeconds =
      this.#lastFrameAtMs === null
        ? 0
        : Math.min(0.1, Math.max(0, (nowMs - this.#lastFrameAtMs) / 1000));

    this.#frameDeltaMs = deltaSeconds * 1000;
    this.#frameRate = deltaSeconds > 0 ? 1 / deltaSeconds : 0;
    this.#lastFrameAtMs = nowMs;
    this.#remoteWorldRuntime.syncConnection(this.#presenceRuntime.isJoined);
    this.#remoteWorldRuntime.sampleRemoteWorld();
    this.#presenceRuntime.syncRemoteCharacterPresentations();
    this.#authoritativeWorldSync.syncAuthoritativeWorldSnapshots();

    const remoteCharacterPresentations =
      this.#remoteWorldRuntime.remoteCharacterPresentations;

    this.#environmentPhysicsRuntime.syncRemoteCharacterBlockers(
      remoteCharacterPresentations
    );

    const movementInput = bootCinematicActive
      ? neutralMetaverseFlightInputSnapshot
      : this.#flightInputRuntime.readSnapshot();
    const issuedTraversalFacingSnapshot = this.#traversalRuntime.cameraSnapshot;

    this.#traversalRuntime.syncIssuedTraversalIntentSnapshot(
      this.#remoteWorldRuntime.previewLocalTraversalIntent(
        movementInput,
        issuedTraversalFacingSnapshot,
        this.#traversalRuntime.locomotionMode
      )
    );
    this.#traversalRuntime.advance(movementInput, deltaSeconds);

    const cameraSnapshot = this.#traversalRuntime.cameraSnapshot;
    this.#mountedEnvironment = this.#traversalRuntime.mountedEnvironmentSnapshot;

    this.#presenceRuntime.syncPresencePose(
      this.#traversalRuntime.characterPresentationSnapshot,
      cameraSnapshot,
      this.#traversalRuntime.locomotionMode,
      this.#mountedEnvironment
    );

    this.#remoteWorldRuntime.syncLocalPlayerLook(
      this.#traversalRuntime.locomotionMode === "mounted"
        ? cameraSnapshot
        : null
    );
    this.#remoteWorldRuntime.syncLocalDriverVehicleControl(
      this.#traversalRuntime.routedDriverVehicleControlIntentSnapshot
    );
    this.#environmentPhysicsRuntime.syncPushableBodyPresentations();
    this.#traversalRuntime.syncIssuedTraversalIntentSnapshot(
      this.#remoteWorldRuntime.syncLocalTraversalIntent(
        movementInput,
        cameraSnapshot,
        this.#traversalRuntime.locomotionMode
      )
    );

    const liveFocusedPortal = resolveFocusedPortalSnapshot(
      cameraSnapshot,
      this.#portals
    );
    const bootCinematicSnapshot = bootCinematicActive
      ? this.#bootLifecycle.resolveBootCinematicPresentationSnapshot(nowMs)
      : null;
    const presentationCameraSnapshot =
      bootCinematicSnapshot?.cameraSnapshot ?? cameraSnapshot;
    const presentationFocusedPortal =
      bootCinematicSnapshot?.focusedPortal ?? liveFocusedPortal;

    this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
    const sceneInteractionSnapshot = this.#sceneRuntime.syncPresentation(
      presentationCameraSnapshot,
      presentationFocusedPortal,
      nowMs,
      deltaSeconds,
      bootCinematicActive
        ? null
        : this.#traversalRuntime.characterPresentationSnapshot,
      remoteCharacterPresentations,
      this.#mountedEnvironment
    );

    this.#hudPublisher.trackFrameTelemetry(
      nowMs,
      presentationCameraSnapshot,
      this.#sceneRuntime.camera
    );
    this.#environmentPhysicsRuntime.syncDebugPresentation();

    this.#focusedPortal = bootCinematicActive ? null : liveFocusedPortal;
    this.#focusedMountable = bootCinematicActive
      ? null
      : sceneInteractionSnapshot.focusedMountable;
    this.#mountedEnvironment = this.#traversalRuntime.mountedEnvironmentSnapshot;
    renderer.render(this.#sceneRuntime.scene, this.#sceneRuntime.camera);
    this.#renderedFrameCount += 1;
  }
}
