import type { Camera, Scene } from "three/webgpu";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot,
  type MetaverseCombatAimSnapshotInput,
  type MetaversePlayerTraversalIntentSnapshotInput,
  type MetaverseRealtimePlayerSnapshot,
  type MetaverseRealtimeWorldSnapshot,
  type MetaverseTraversalPlayerBodyBlockerSnapshot,
  type MetaverseWeaponSlotId
} from "@webgpu-metaverse/shared";

import {
  createMetaverseFireAimSnapshotFromSemanticAimFrame,
  createMetaverseLookSyncIntentFromSemanticAimFrame,
  createMetaverseSemanticAimFrameFromCameraSnapshot,
  type MetaverseSemanticAimFrame
} from "../aim/metaverse-semantic-aim";
import {
  metaverseLocalAuthorityReconciliationConfig,
  metaverseWorldCadenceConfig
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
  MetaverseCombatPresentationEvent,
  MetaverseRuntimeCameraPhaseId,
  MetaverseRenderedWeaponMuzzleFrame,
  MetaverseRenderedWeaponMuzzleQuery,
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
  primaryActionPressedCount: 0,
  secondaryAction: false,
  strafeAxis: 0,
  weaponInteractPressedCount: 0,
  weaponReloadPressedCount: 0,
  weaponSwitchPressedCount: 0,
  yawAxis: 0
});
const metaverseRuntimeTraversalFixedStepSeconds =
  Number(metaverseWorldCadenceConfig.authoritativeTickIntervalMs) / 1000;
const metaverseRuntimeTraversalFixedStepEpsilonSeconds = 0.000001;
const metaverseRuntimeTraversalMaxAccumulatedSeconds =
  metaverseRuntimeTraversalFixedStepSeconds * 4;

function clampTraversalAxis(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(-1, value));
}

function resolveMovementInputWithLookAxes(
  movementInput: MetaverseFlightInputSnapshot,
  pitchAxis: number,
  yawAxis: number
): MetaverseFlightInputSnapshot {
  if (
    movementInput.pitchAxis === pitchAxis &&
    movementInput.yawAxis === yawAxis
  ) {
    return movementInput;
  }

  return Object.freeze({
    ...movementInput,
    pitchAxis,
    yawAxis
  });
}

function isWeaponEquippedByPlayer(
  localPlayerSnapshot: MetaverseRealtimePlayerSnapshot,
  weaponId: string
): boolean {
  return (
    localPlayerSnapshot.weaponState?.slots.some(
      (slot) => slot.equipped && slot.weaponId === weaponId
    ) ?? false
  );
}

function hasNearbyWeaponResource(input: {
  readonly localPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly localPlayerSnapshot: MetaverseRealtimePlayerSnapshot | null;
  readonly worldSnapshot: MetaverseRealtimeWorldSnapshot | null;
}): boolean {
  const { localPlayerSnapshot, worldSnapshot } = input;

  if (
    localPlayerSnapshot === null ||
    worldSnapshot === null ||
    localPlayerSnapshot.combat?.alive === false
  ) {
    return false;
  }

  const localPosition =
    input.localPosition ??
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(localPlayerSnapshot)
      .position;

  return worldSnapshot.resourceSpawns.some((resourceSpawn) => {
    if (isWeaponEquippedByPlayer(localPlayerSnapshot, resourceSpawn.weaponId)) {
      return false;
    }

    const distanceMeters = Math.hypot(
      localPosition.x - resourceSpawn.position.x,
      localPosition.y - resourceSpawn.position.y,
      localPosition.z - resourceSpawn.position.z
    );

    return distanceMeters <= resourceSpawn.pickupRadiusMeters;
  });
}

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
    readonly phaseId: MetaverseRuntimeCameraPhaseId;
    readonly presentationSnapshot: {
      readonly cameraSnapshot: MetaverseCameraSnapshot;
      readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
    } | null;
    readonly suppressesInteractionFocus: boolean;
  };
}

interface MetaverseRuntimeFrameCombatLifecycle {
  syncLocalCombatState(liveCameraSnapshot: MetaverseCameraSnapshot): void;
}

interface MetaverseRuntimeFrameCombatFeedbackRuntime {
  capturePendingLocalShotOrigin(input: {
    readonly actionSequence?: number | null;
    readonly directionWorld?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null;
    readonly originWorld?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null;
    readonly originSource?:
      | "rendered-muzzle-post-sync"
      | null;
    readonly originForwardWorld?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null;
    readonly weaponId: string;
  }): void;
  drainQueuedVisualIntents?(input: {
    readonly cameraSnapshot: MetaverseCameraSnapshot;
    readonly resolveRenderedMuzzle?: ((
      query: MetaverseRenderedWeaponMuzzleQuery
    ) => MetaverseRenderedWeaponMuzzleFrame | null) | null;
  }): void;
  registerPendingLocalShot(input: {
    readonly actionSequence?: number | null;
    readonly directionWorld?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null;
    readonly weaponId: string;
  }): void;
  syncAuthoritativeWorld(
    worldSnapshot: MetaverseRealtimeWorldSnapshot | null,
    cameraSnapshot: MetaverseCameraSnapshot
  ): void;
}

interface MetaverseRuntimeFrameMovementAudioRuntime {
  reset?(): void;
  sync(input: {
    readonly cameraSnapshot: MetaverseCameraSnapshot;
    readonly deltaSeconds: number;
    readonly localCharacterPresentation: MetaverseCharacterPresentationSnapshot | null;
    readonly localMounted: boolean;
    readonly nowMs: number;
    readonly remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[];
  }): void;
}

interface MetaverseRuntimeFrameAuthoritativeWorldSync {
  syncAuthoritativeWorldSnapshots(): void;
}

interface MetaverseRuntimeFrameEnvironmentPhysicsRuntime {
  syncDynamicEnvironmentBodyPresentations(): void;
  syncSampledRemotePlayerBlockers(
    remotePlayerBlockers: readonly MetaverseTraversalPlayerBodyBlockerSnapshot[]
  ): void;
}

interface MetaverseRuntimeFrameFlightInputRuntime {
  readSnapshot(): MetaverseFlightInputSnapshot;
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
  readonly remotePlayerBodyBlockers:
    readonly MetaverseTraversalPlayerBodyBlockerSnapshot[];
  readonly remoteCharacterPresentations:
    readonly MetaverseRemoteCharacterPresentationSnapshot[];
  previewLocalTraversalIntent(
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null
  ): unknown;
  sampleRemoteWorld(): void;
  fireWeapon(input: {
    readonly aimMode?: "ads" | "hip-fire";
    readonly aimSnapshot: MetaverseCombatAimSnapshotInput;
    readonly weaponId: string;
  }): {
    readonly actionSequence: number;
    readonly issuedAtAuthoritativeTimeMs: number;
    readonly weaponId: string;
  } | null;
  interactWeaponResource(input: {
    readonly intendedWeaponInstanceId?: string | null;
    readonly requestedActiveSlotId?: MetaverseWeaponSlotId | null;
  }): {
    readonly actionSequence: number;
  } | null;
  reloadWeapon(input: {
    readonly intendedWeaponInstanceId?: string | null;
    readonly requestedActiveSlotId?: MetaverseWeaponSlotId | null;
    readonly weaponId: string;
  }): {
    readonly actionSequence: number;
    readonly weaponId: string;
  } | null;
  switchActiveWeaponSlot(input: {
    readonly intendedWeaponId?: string | null;
    readonly intendedWeaponInstanceId?: string | null;
    readonly requestedActiveSlotId: MetaverseWeaponSlotId;
  }): {
    readonly actionSequence: number;
    readonly requestedActiveSlotId: MetaverseWeaponSlotId;
  } | null;
  readFreshAuthoritativeWorldSnapshot?(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeWorldSnapshot | null;
  syncConnection(presenceJoined: boolean): void;
  syncLocalDriverVehicleControl(
    controlIntentSnapshot: RoutedDriverVehicleControlIntentSnapshot | null
  ): void;
  syncLocalPlayerLook(
    lookSnapshot:
      | Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">
      | null
  ): void;
  syncLocalPlayerWeaponState?(
    weaponState: MetaverseRealtimePlayerSnapshot["weaponState"] | null
  ): void;
  syncLocalTraversalIntent(
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null
  ): unknown;
}

interface MetaverseRuntimeFrameSceneRuntime {
  readonly camera: Camera;
  readonly scene: Scene;
  readLocalWeaponProjectileMuzzleWorldPosition?(
    weaponId: string
  ): { readonly x: number; readonly y: number; readonly z: number } | null;
  readLocalWeaponProjectileMuzzleFrame?(weaponId: string): {
    readonly forwardWorld?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null;
    readonly originWorld: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
  } | null;
  readRenderedWeaponMuzzleFrame?(
    query: MetaverseRenderedWeaponMuzzleQuery
  ): MetaverseRenderedWeaponMuzzleFrame | null;
  syncCombatProjectiles?(
    projectiles: MetaverseRealtimeWorldSnapshot["projectiles"],
    nowMs: number
  ): void;
  syncResourceSpawns?(
    resourceSpawns: MetaverseRealtimeWorldSnapshot["resourceSpawns"],
    nowMs: number
  ): void;
  syncPresentation(
    cameraSnapshot: MetaverseCameraSnapshot,
    focusedPortal: FocusedExperiencePortalSnapshot | null,
    nowMs: number,
    deltaSeconds: number,
    localCharacterPresentation: MetaverseCharacterPresentationSnapshot | null,
    localWeaponState: MetaverseRealtimePlayerSnapshot["weaponState"] | null,
    localWeaponAdsBlend: number | null,
    remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[],
    mountedEnvironment: MountedEnvironmentSnapshot | null,
    cameraFieldOfViewDegrees?: number | null,
    localSemanticAimFrame?: MetaverseSemanticAimFrame | null,
    combatProjectiles?: MetaverseRealtimeWorldSnapshot["projectiles"]
  ): {
    readonly focusedMountable: FocusedMountableSnapshot | null;
  };
  triggerCombatPresentationEvent(
    event: MetaverseCombatPresentationEvent
  ): void;
  syncViewport(
    renderer: MetaverseRuntimeFrameRendererHost,
    canvas: MetaverseRuntimeFrameCanvasHost,
    devicePixelRatio: number
  ): void;
}

interface MetaverseRuntimeFrameTraversalRuntime {
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly characterPresentationSnapshot: MetaverseCharacterPresentationSnapshot | null;
  readonly localTraversalPoseSnapshot: {
    readonly position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
  } | null;
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

interface MetaverseRuntimeFrameWeaponPresentationRuntime {
  readonly adsBlend: number;
  readonly cameraFieldOfViewDegrees: number;
  readonly firePressedThisFrame: boolean;
  readonly weaponState: MetaverseRealtimePlayerSnapshot["weaponState"] | null;
  syncAuthoritativeWeaponState?(
    weaponState: MetaverseRealtimePlayerSnapshot["weaponState"] | null
  ): void;
  consumeSlotSwitchIntent?(): {
    readonly intendedWeaponId: string;
    readonly intendedWeaponInstanceId: string;
    readonly requestedActiveSlotId: MetaverseWeaponSlotId;
  } | null;
  advance(input: {
    readonly deltaSeconds: number;
    readonly flightInput: Pick<
      MetaverseFlightInputSnapshot,
      "primaryAction" | "secondaryAction" | "weaponSwitchPressedCount"
    >;
    readonly mountedEnvironment: MountedEnvironmentSnapshot | null;
  }): void;
}

interface MetaverseRuntimeFrameLoopDependencies {
  readonly authoritativeWorldSync: MetaverseRuntimeFrameAuthoritativeWorldSync;
  readonly bootLifecycle: MetaverseRuntimeFrameBootLifecycle;
  readonly combatFeedbackRuntime?: MetaverseRuntimeFrameCombatFeedbackRuntime;
  readonly combatLifecycle?: MetaverseRuntimeFrameCombatLifecycle;
  readonly devicePixelRatio: number;
  readonly environmentPhysicsRuntime: MetaverseRuntimeFrameEnvironmentPhysicsRuntime;
  readonly flightInputRuntime: MetaverseRuntimeFrameFlightInputRuntime;
  readonly movementAudioRuntime?: MetaverseRuntimeFrameMovementAudioRuntime;
  readonly portals: readonly MetaversePortalConfig[];
  readonly presenceRuntime: MetaverseRuntimeFramePresenceRuntime;
  readonly remoteWorldRuntime: MetaverseRuntimeFrameRemoteWorldRuntime;
  readonly sceneRuntime: MetaverseRuntimeFrameSceneRuntime;
  readonly traversalRuntime: MetaverseRuntimeFrameTraversalRuntime;
  readonly weaponPresentationRuntime?: MetaverseRuntimeFrameWeaponPresentationRuntime;
}

interface MetaverseRuntimeFrameSyncRequest {
  readonly canvas: MetaverseRuntimeFrameCanvasHost;
  readonly nowMs: number;
  readonly renderer: MetaverseRuntimeFrameRendererHost;
}

export class MetaverseRuntimeFrameLoop {
  readonly #authoritativeWorldSync: MetaverseRuntimeFrameAuthoritativeWorldSync;
  readonly #bootLifecycle: MetaverseRuntimeFrameBootLifecycle;
  readonly #combatFeedbackRuntime: MetaverseRuntimeFrameCombatFeedbackRuntime | null;
  readonly #combatLifecycle: MetaverseRuntimeFrameCombatLifecycle | null;
  readonly #devicePixelRatio: number;
  readonly #environmentPhysicsRuntime: MetaverseRuntimeFrameEnvironmentPhysicsRuntime;
  readonly #flightInputRuntime: MetaverseRuntimeFrameFlightInputRuntime;
  readonly #movementAudioRuntime: MetaverseRuntimeFrameMovementAudioRuntime | null;
  readonly #portals: readonly MetaversePortalConfig[];
  readonly #presenceRuntime: MetaverseRuntimeFramePresenceRuntime;
  readonly #remoteWorldRuntime: MetaverseRuntimeFrameRemoteWorldRuntime;
  readonly #sceneRuntime: MetaverseRuntimeFrameSceneRuntime;
  readonly #traversalRuntime: MetaverseRuntimeFrameTraversalRuntime;
  readonly #weaponPresentationRuntime:
    | MetaverseRuntimeFrameWeaponPresentationRuntime
    | null;

  #focusedPortal: FocusedExperiencePortalSnapshot | null = null;
  #cameraPhaseId: MetaverseRuntimeCameraPhaseId | null = null;
  #frameDeltaMs = 0;
  #frameRate = 0;
  #lastFrameAtMs: number | null = null;
  #mountedInteraction = createMetaverseMountedInteractionSnapshot(null, null);
  #pendingLookPitchAxisSeconds = 0;
  #pendingLookYawAxisSeconds = 0;
  #renderedFrameCount = 0;
  #traversalAccumulatorSeconds = 0;

  constructor({
    authoritativeWorldSync,
    bootLifecycle,
    combatFeedbackRuntime,
    combatLifecycle,
    devicePixelRatio,
    environmentPhysicsRuntime,
    flightInputRuntime,
    movementAudioRuntime,
    portals,
    presenceRuntime,
    remoteWorldRuntime,
    sceneRuntime,
    traversalRuntime,
    weaponPresentationRuntime
  }: MetaverseRuntimeFrameLoopDependencies) {
    this.#authoritativeWorldSync = authoritativeWorldSync;
    this.#bootLifecycle = bootLifecycle;
    this.#combatFeedbackRuntime = combatFeedbackRuntime ?? null;
    this.#combatLifecycle = combatLifecycle ?? null;
    this.#devicePixelRatio = devicePixelRatio;
    this.#environmentPhysicsRuntime = environmentPhysicsRuntime;
    this.#flightInputRuntime = flightInputRuntime;
    this.#movementAudioRuntime = movementAudioRuntime ?? null;
    this.#portals = portals;
    this.#presenceRuntime = presenceRuntime;
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#sceneRuntime = sceneRuntime;
    this.#traversalRuntime = traversalRuntime;
    this.#weaponPresentationRuntime = weaponPresentationRuntime ?? null;
  }

  get focusedPortal(): FocusedExperiencePortalSnapshot | null {
    return this.#focusedPortal;
  }

  get cameraPhaseId(): MetaverseRuntimeCameraPhaseId | null {
    return this.#cameraPhaseId;
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
    this.#cameraPhaseId = null;
    this.#frameDeltaMs = 0;
    this.#frameRate = 0;
    this.#lastFrameAtMs = null;
    this.#mountedInteraction = createMetaverseMountedInteractionSnapshot(
      null,
      null
    );
    this.#pendingLookPitchAxisSeconds = 0;
    this.#pendingLookYawAxisSeconds = 0;
    this.#renderedFrameCount = 0;
    this.#traversalAccumulatorSeconds = 0;
    this.#movementAudioRuntime?.reset?.();
  }

  #resolveFixedStepMovementInput(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number,
    consumeLookAxes: boolean
  ): MetaverseFlightInputSnapshot {
    const safeDeltaSeconds = Math.max(0, deltaSeconds);

    if (safeDeltaSeconds <= metaverseRuntimeTraversalFixedStepEpsilonSeconds) {
      return resolveMovementInputWithLookAxes(
        movementInput,
        clampTraversalAxis(movementInput.pitchAxis),
        clampTraversalAxis(movementInput.yawAxis)
      );
    }

    const consumedPitchAxisSeconds = clampTraversalAxis(
      this.#pendingLookPitchAxisSeconds / safeDeltaSeconds
    ) * safeDeltaSeconds;
    const consumedYawAxisSeconds = clampTraversalAxis(
      this.#pendingLookYawAxisSeconds / safeDeltaSeconds
    ) * safeDeltaSeconds;

    if (consumeLookAxes) {
      this.#pendingLookPitchAxisSeconds -= consumedPitchAxisSeconds;
      this.#pendingLookYawAxisSeconds -= consumedYawAxisSeconds;
    }

    return resolveMovementInputWithLookAxes(
      movementInput,
      clampTraversalAxis(consumedPitchAxisSeconds / safeDeltaSeconds),
      clampTraversalAxis(consumedYawAxisSeconds / safeDeltaSeconds)
    );
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
    this.#traversalAccumulatorSeconds = Math.min(
      this.#traversalAccumulatorSeconds + deltaSeconds,
      metaverseRuntimeTraversalMaxAccumulatedSeconds
    );
    const presenceReady =
      !this.#presenceRuntime.connectionRequired || this.#presenceRuntime.isJoined;
    const worldReady =
      !this.#remoteWorldRuntime.connectionRequired ||
      this.#remoteWorldRuntime.isConnected;

    this.#remoteWorldRuntime.syncConnection(presenceReady);
    this.#remoteWorldRuntime.sampleRemoteWorld();
    this.#presenceRuntime.syncRemoteCharacterPresentations();

    const preAdvanceCameraSnapshot = this.#traversalRuntime.cameraSnapshot;
    this.#combatLifecycle?.syncLocalCombatState(preAdvanceCameraSnapshot);
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
    this.#pendingLookPitchAxisSeconds += movementInput.pitchAxis * deltaSeconds;
    this.#pendingLookYawAxisSeconds += movementInput.yawAxis * deltaSeconds;
    let authoritativeWorldPrepared = false;
    const prepareAuthoritativeWorld = () => {
      if (authoritativeWorldPrepared) {
        return;
      }

      this.#authoritativeWorldSync.syncAuthoritativeWorldSnapshots();
      this.#environmentPhysicsRuntime.syncSampledRemotePlayerBlockers(
        this.#remoteWorldRuntime.remotePlayerBodyBlockers
      );
      authoritativeWorldPrepared = true;
    };
    while (
      this.#traversalAccumulatorSeconds +
        metaverseRuntimeTraversalFixedStepEpsilonSeconds >=
      metaverseRuntimeTraversalFixedStepSeconds
    ) {
      const fixedStepMovementInput = this.#resolveFixedStepMovementInput(
        movementInput,
        metaverseRuntimeTraversalFixedStepSeconds,
        true
      );
      const localTraversalIntentInput =
        this.#traversalRuntime.resolveLocalTraversalIntentInput(
          fixedStepMovementInput,
          metaverseRuntimeTraversalFixedStepSeconds
        );

      this.#traversalRuntime.syncIssuedTraversalIntentSnapshot(
        this.#remoteWorldRuntime.previewLocalTraversalIntent(
          localTraversalIntentInput
        )
      );
      prepareAuthoritativeWorld();
      this.#traversalRuntime.advance(
        fixedStepMovementInput,
        metaverseRuntimeTraversalFixedStepSeconds,
        localTraversalIntentInput
      );
      this.#traversalRuntime.syncIssuedTraversalIntentSnapshot(
        this.#remoteWorldRuntime.syncLocalTraversalIntent(
          localTraversalIntentInput
        )
      );
      this.#traversalAccumulatorSeconds = Math.max(
        0,
        this.#traversalAccumulatorSeconds -
          metaverseRuntimeTraversalFixedStepSeconds
      );
    }

    if (!authoritativeWorldPrepared) {
      const previewMovementInput = this.#resolveFixedStepMovementInput(
        movementInput,
        metaverseRuntimeTraversalFixedStepSeconds,
        false
      );
      const previewTraversalIntentInput =
        this.#traversalRuntime.resolveLocalTraversalIntentInput(
          previewMovementInput,
          metaverseRuntimeTraversalFixedStepSeconds
        );

      this.#traversalRuntime.syncIssuedTraversalIntentSnapshot(
        this.#remoteWorldRuntime.previewLocalTraversalIntent(
          previewTraversalIntentInput
        )
      );
      prepareAuthoritativeWorld();
    }

    const remoteCharacterPresentations =
      this.#remoteWorldRuntime.remoteCharacterPresentations;

    const authoritativeWorldSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeWorldSnapshot?.(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      ) ?? null;
    const authoritativeObserverPlayerId =
      authoritativeWorldSnapshot?.observerPlayer?.playerId ?? null;
    const authoritativeObserverPlayer =
      authoritativeObserverPlayerId === null
        ? null
        : authoritativeWorldSnapshot?.players.find(
            (player) => player.playerId === authoritativeObserverPlayerId
          ) ?? null;

    const cameraSnapshot = this.#traversalRuntime.cameraSnapshot;
    const mountedEnvironment = this.#traversalRuntime.mountedEnvironmentSnapshot;
    const weaponPresentationRuntime = this.#weaponPresentationRuntime;

    weaponPresentationRuntime?.syncAuthoritativeWeaponState?.(
      authoritativeObserverPlayer?.weaponState ?? null
    );
    weaponPresentationRuntime?.advance({
      deltaSeconds,
      flightInput: movementInput,
      mountedEnvironment
    });
    const localWeaponSlotSwitchIntent =
      weaponPresentationRuntime?.consumeSlotSwitchIntent?.() ?? null;
    const localWeaponState = weaponPresentationRuntime?.weaponState ?? null;
    const localWeaponAdsBlend = weaponPresentationRuntime?.adsBlend ?? 0;
    const localSemanticAimFrame =
      localWeaponState === null
        ? null
        : createMetaverseSemanticAimFrameFromCameraSnapshot({
            actorFacingYawRadians:
              this.#traversalRuntime.characterPresentationSnapshot?.yawRadians ??
              cameraSnapshot.yawRadians,
            adsBlend: localWeaponAdsBlend,
            cameraSnapshot,
            quality: "full_camera_ray",
            source: "local_camera",
            weaponState: localWeaponState
          });

    this.#presenceRuntime.syncPresencePose(
      this.#traversalRuntime.characterPresentationSnapshot,
      cameraSnapshot,
      this.#traversalRuntime.locomotionMode,
      mountedEnvironment
    );

    this.#remoteWorldRuntime.syncLocalPlayerLook(
      this.#traversalRuntime.locomotionMode === "mounted"
        ? cameraSnapshot
        : localSemanticAimFrame === null || mountedEnvironment !== null
          ? null
          : createMetaverseLookSyncIntentFromSemanticAimFrame(
              localSemanticAimFrame
            )
    );
    this.#remoteWorldRuntime.syncLocalPlayerWeaponState?.(
      localWeaponState
    );
    if (localWeaponSlotSwitchIntent !== null) {
      this.#remoteWorldRuntime.switchActiveWeaponSlot({
        intendedWeaponId: localWeaponSlotSwitchIntent.intendedWeaponId,
        intendedWeaponInstanceId:
          localWeaponSlotSwitchIntent.intendedWeaponInstanceId,
        requestedActiveSlotId:
          localWeaponSlotSwitchIntent.requestedActiveSlotId
      });
    }
    const localActiveWeaponSlot =
      localWeaponState === null || localWeaponState.activeSlotId === null
        ? null
        : localWeaponState.slots.find(
            (slot) => slot.slotId === localWeaponState.activeSlotId
          ) ?? null;

    if (
      movementInput.weaponReloadPressedCount > 0 &&
      mountedEnvironment === null &&
      localWeaponState !== null &&
      localActiveWeaponSlot !== null
    ) {
      this.#remoteWorldRuntime.reloadWeapon({
        intendedWeaponInstanceId: localActiveWeaponSlot.weaponInstanceId,
        requestedActiveSlotId: localActiveWeaponSlot.slotId,
        weaponId: localActiveWeaponSlot.weaponId
      });
    }

    if (
      movementInput.weaponInteractPressedCount > 0 &&
      mountedEnvironment === null &&
      hasNearbyWeaponResource({
        localPosition:
          this.#traversalRuntime.localTraversalPoseSnapshot?.position ?? null,
        localPlayerSnapshot: authoritativeObserverPlayer,
        worldSnapshot: authoritativeWorldSnapshot
      })
    ) {
      this.#remoteWorldRuntime.interactWeaponResource({
        intendedWeaponInstanceId:
          localActiveWeaponSlot?.weaponInstanceId ?? null,
        requestedActiveSlotId: localWeaponState?.activeSlotId ?? null
      });
    }
    let pendingLocalShotFeedback:
      | {
          readonly actionSequence: number;
          readonly directionWorld: MetaverseSemanticAimFrame["cameraForwardWorld"];
          readonly weaponId: string;
        }
      | null = null;

    if (
      weaponPresentationRuntime?.firePressedThisFrame === true &&
      mountedEnvironment === null &&
      localWeaponState !== null &&
      localSemanticAimFrame !== null
    ) {
      const fireAimSnapshot =
        createMetaverseFireAimSnapshotFromSemanticAimFrame(localSemanticAimFrame);
      const fireWeaponIssue =
        fireAimSnapshot === null
          ? null
          : this.#remoteWorldRuntime.fireWeapon({
              aimMode: localWeaponState.aimMode,
              aimSnapshot: fireAimSnapshot,
              weaponId: localWeaponState.weaponId
            });

      if (fireWeaponIssue !== null) {
        pendingLocalShotFeedback = {
          actionSequence: fireWeaponIssue.actionSequence,
          directionWorld: localSemanticAimFrame.cameraForwardWorld,
          weaponId: localWeaponState.weaponId
        };
        this.#combatFeedbackRuntime?.registerPendingLocalShot({
          actionSequence: fireWeaponIssue.actionSequence,
          directionWorld: localSemanticAimFrame.cameraForwardWorld,
          weaponId: localWeaponState.weaponId
        });
      }
    }
    this.#remoteWorldRuntime.syncLocalDriverVehicleControl(
      this.#traversalRuntime.routedDriverVehicleControlIntentSnapshot
    );
    this.#environmentPhysicsRuntime.syncDynamicEnvironmentBodyPresentations();

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
    this.#cameraPhaseId = cameraPhaseState.phaseId;
    const presentationSnapshot = cameraPhaseState.presentationSnapshot;
    const presentationCameraSnapshot =
      presentationSnapshot?.cameraSnapshot ?? cameraSnapshot;
    const presentationFocusedPortal =
      presentationSnapshot?.focusedPortal ?? liveFocusedPortal;
    const localCharacterPresentation =
      cameraPhaseState.hidesLocalCharacter
        ? null
        : this.#traversalRuntime.characterPresentationSnapshot;

    this.#combatFeedbackRuntime?.syncAuthoritativeWorld(
      authoritativeWorldSnapshot,
      presentationCameraSnapshot
    );

    this.#sceneRuntime.syncViewport(renderer, canvas, this.#devicePixelRatio);
    const sceneInteractionSnapshot = this.#sceneRuntime.syncPresentation(
      presentationCameraSnapshot,
      presentationFocusedPortal,
      nowMs,
      deltaSeconds,
      localCharacterPresentation,
      localWeaponState,
      weaponPresentationRuntime?.adsBlend ?? null,
      remoteCharacterPresentations,
      mountedEnvironment,
      weaponPresentationRuntime?.cameraFieldOfViewDegrees ?? null,
      localSemanticAimFrame
    );
    this.#movementAudioRuntime?.sync({
      cameraSnapshot: presentationCameraSnapshot,
      deltaSeconds,
      localCharacterPresentation,
      localMounted: mountedEnvironment !== null,
      nowMs,
      remoteCharacterPresentations
    });

    if (pendingLocalShotFeedback !== null) {
      const renderedMuzzleFrame =
        this.#sceneRuntime.readLocalWeaponProjectileMuzzleFrame?.(
          pendingLocalShotFeedback.weaponId
        ) ?? null;
      const renderedMuzzleOrigin =
        renderedMuzzleFrame?.originWorld ??
        this.#sceneRuntime.readLocalWeaponProjectileMuzzleWorldPosition?.(
          pendingLocalShotFeedback.weaponId
        ) ??
        null;
      const localShotOriginSource =
        renderedMuzzleOrigin !== null
          ? "rendered-muzzle-post-sync"
          : null;

      this.#combatFeedbackRuntime?.capturePendingLocalShotOrigin({
        actionSequence: pendingLocalShotFeedback.actionSequence,
        directionWorld: pendingLocalShotFeedback.directionWorld,
        originForwardWorld: renderedMuzzleFrame?.forwardWorld ?? null,
        originSource: localShotOriginSource,
        originWorld: renderedMuzzleOrigin,
        weaponId: pendingLocalShotFeedback.weaponId
      });
    }

    this.#combatFeedbackRuntime?.drainQueuedVisualIntents?.({
      cameraSnapshot: presentationCameraSnapshot,
      resolveRenderedMuzzle:
        this.#sceneRuntime.readRenderedWeaponMuzzleFrame?.bind(
          this.#sceneRuntime
        ) ?? null
    });
    this.#sceneRuntime.syncCombatProjectiles?.(
      authoritativeWorldSnapshot?.projectiles ?? [],
      nowMs
    );
    this.#sceneRuntime.syncResourceSpawns?.(
      authoritativeWorldSnapshot?.resourceSpawns ?? [],
      nowMs
    );

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
