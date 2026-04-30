import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterAnimationVocabularyId,
  MetaverseCharacterPresentationSnapshot,
  MetaverseCombatAudioCuePlayer,
  MetaverseRemoteCharacterPresentationSnapshot
} from "../types/metaverse-runtime";

const metaverseMovementAudioListenerUp = Object.freeze({
  x: 0,
  y: 1,
  z: 0
});
const metaverseMovementRemoteFootstepSpatialProfile = Object.freeze({
  maxDistanceMeters: 42,
  refDistanceMeters: 3.8,
  rolloffFactor: 0.82
});
const metaverseMovementWalkCycleSeconds = 1.666667;
const metaverseMovementWalkBasePlaybackRate = 1.1;
const metaverseMovementFootstepMinimumSpeedMetersPerSecond = 0.12;
const metaverseMovementFootstepHeightMeters = 0.06;
const metaverseMovementWalkFootstepMarkers = Object.freeze([
  Object.freeze({
    footId: "left",
    phase: 0.18
  }),
  Object.freeze({
    footId: "right",
    phase: 0.68
  })
] as const);
const metaverseMovementReverseWalkFootstepMarkers = Object.freeze([
  metaverseMovementWalkFootstepMarkers[1],
  metaverseMovementWalkFootstepMarkers[0]
] as const);

interface MetaverseMovementAudioCharacterState {
  lastPositionX: number | null;
  lastPositionZ: number | null;
  lastSeenSyncSequence: number;
  walkCycleId: number | null;
  walkDirection: -1 | 1;
  walkPhase: number;
  wasWalking: boolean;
}

interface MetaverseMovementAudioRuntimeDependencies {
  readonly playAudioCue?: MetaverseCombatAudioCuePlayer | null;
}

export interface MetaverseMovementAudioSyncInput {
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly deltaSeconds: number;
  readonly localCharacterPresentation: MetaverseCharacterPresentationSnapshot | null;
  readonly localMounted: boolean;
  readonly nowMs: number;
  readonly remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[];
}

function isGroundedAnimationVocabulary(
  animationVocabulary: MetaverseCharacterAnimationVocabularyId
): boolean {
  return (
    animationVocabulary !== "jump-up" &&
    animationVocabulary !== "jump-mid" &&
    animationVocabulary !== "jump-down"
  );
}

function createSpatialFootstepAudioOptions(
  position: { readonly x: number; readonly y: number; readonly z: number },
  cameraSnapshot: MetaverseCameraSnapshot
) {
  return Object.freeze({
    spatial: Object.freeze({
      listener: Object.freeze({
        forward: cameraSnapshot.lookDirection,
        position: cameraSnapshot.position,
        up: metaverseMovementAudioListenerUp
      }),
      maxDistanceMeters:
        metaverseMovementRemoteFootstepSpatialProfile.maxDistanceMeters,
      position: Object.freeze({
        x: position.x,
        y: position.y + metaverseMovementFootstepHeightMeters,
        z: position.z
      }),
      refDistanceMeters:
        metaverseMovementRemoteFootstepSpatialProfile.refDistanceMeters,
      rolloffFactor:
        metaverseMovementRemoteFootstepSpatialProfile.rolloffFactor
    })
  });
}

function createMovementAudioCharacterState(
  syncSequence: number
): MetaverseMovementAudioCharacterState {
  return {
    lastPositionX: null,
    lastPositionZ: null,
    lastSeenSyncSequence: syncSequence,
    walkCycleId: null,
    walkDirection: 1,
    walkPhase: 0,
    wasWalking: false
  };
}

function normalizeWalkPhase(phase: number): number {
  const normalizedPhase = phase % 1;

  return normalizedPhase < 0 ? normalizedPhase + 1 : normalizedPhase;
}

function sanitizeAnimationPlaybackRateMultiplier(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  if (value === 0) {
    return 0.01;
  }

  return value;
}

function resolveWalkPlaybackRateMultiplier(
  presentation: MetaverseCharacterPresentationSnapshot
): number {
  return (
    metaverseMovementWalkBasePlaybackRate *
    sanitizeAnimationPlaybackRateMultiplier(
      presentation.animationPlaybackRateMultiplier
    )
  );
}

function resolveAnimationCycleId(
  presentation: MetaverseCharacterPresentationSnapshot
): number | null {
  return presentation.animationCycleId === undefined
    ? null
    : Math.max(0, Math.trunc(presentation.animationCycleId));
}

function didCrossWalkFootstepMarker(
  previousPhase: number,
  nextPhase: number,
  direction: -1 | 1,
  markerPhase: number
): boolean {
  if (direction > 0) {
    return nextPhase >= previousPhase
      ? markerPhase > previousPhase && markerPhase <= nextPhase
      : markerPhase > previousPhase || markerPhase <= nextPhase;
  }

  return nextPhase <= previousPhase
    ? markerPhase < previousPhase && markerPhase >= nextPhase
    : markerPhase < previousPhase || markerPhase >= nextPhase;
}

function resolveFootstepCueId(
  footId: (typeof metaverseMovementWalkFootstepMarkers)[number]["footId"]
): "metaverse-footstep-left" | "metaverse-footstep-right" {
  return footId === "left"
    ? "metaverse-footstep-left"
    : "metaverse-footstep-right";
}

export class MetaverseMovementAudioRuntime {
  readonly #characterStatesByKey = new Map<
    string,
    MetaverseMovementAudioCharacterState
  >();
  readonly #playAudioCue: MetaverseCombatAudioCuePlayer | null;

  #syncSequence = 0;

  constructor({
    playAudioCue = null
  }: MetaverseMovementAudioRuntimeDependencies) {
    this.#playAudioCue = playAudioCue;
  }

  reset(): void {
    this.#characterStatesByKey.clear();
    this.#syncSequence = 0;
  }

  sync({
    cameraSnapshot,
    deltaSeconds,
    localCharacterPresentation,
    localMounted,
    remoteCharacterPresentations
  }: MetaverseMovementAudioSyncInput): void {
    this.#syncSequence += 1;

    if (this.#playAudioCue === null) {
      this.#cleanupInactiveStates();
      return;
    }

    if (localCharacterPresentation !== null) {
      this.#syncCharacterPresentation({
        alive: true,
        cameraSnapshot,
        deltaSeconds,
        key: "local",
        mounted: localMounted,
        presentation: localCharacterPresentation,
        spatializedFootsteps: false
      });
    }

    for (const remoteCharacterPresentation of remoteCharacterPresentations) {
      this.#syncCharacterPresentation({
        alive: remoteCharacterPresentation.combatAlive,
        cameraSnapshot,
        deltaSeconds,
        key: `remote:${remoteCharacterPresentation.playerId}`,
        mounted: remoteCharacterPresentation.mountedOccupancy !== null,
        presentation: remoteCharacterPresentation.presentation,
        spatializedFootsteps: true
      });
    }

    this.#cleanupInactiveStates();
  }

  #cleanupInactiveStates(): void {
    for (const [key, state] of this.#characterStatesByKey) {
      if (state.lastSeenSyncSequence === this.#syncSequence) {
        continue;
      }

      this.#characterStatesByKey.delete(key);
    }
  }

  #playFootstep(
    footId: (typeof metaverseMovementWalkFootstepMarkers)[number]["footId"],
    presentation: MetaverseCharacterPresentationSnapshot,
    cameraSnapshot: MetaverseCameraSnapshot,
    spatialized: boolean
  ): void {
    this.#playAudioCue?.(
      resolveFootstepCueId(footId),
      spatialized
        ? createSpatialFootstepAudioOptions(presentation.position, cameraSnapshot)
        : undefined
    );
  }

  #syncWalkFootsteps(
    state: MetaverseMovementAudioCharacterState,
    presentation: MetaverseCharacterPresentationSnapshot,
    cameraSnapshot: MetaverseCameraSnapshot,
    deltaSeconds: number,
    spatializedFootsteps: boolean
  ): void {
    const cycleId = resolveAnimationCycleId(presentation);
    const playbackRateMultiplier =
      resolveWalkPlaybackRateMultiplier(presentation);
    const direction = playbackRateMultiplier < 0 ? -1 : 1;

    if (
      !state.wasWalking ||
      state.walkCycleId !== cycleId ||
      state.walkDirection !== direction
    ) {
      state.walkCycleId = cycleId;
      state.walkDirection = direction;
      state.walkPhase = direction > 0 ? 0 : 1;
    }

    const previousPhase = state.walkPhase;
    const cycleAdvance = Math.min(
      0.95,
      (Math.max(0, deltaSeconds) * Math.abs(playbackRateMultiplier)) /
        metaverseMovementWalkCycleSeconds
    );
    const nextPhase = normalizeWalkPhase(
      previousPhase + cycleAdvance * direction
    );
    const markers =
      direction > 0
        ? metaverseMovementWalkFootstepMarkers
        : metaverseMovementReverseWalkFootstepMarkers;

    for (const marker of markers) {
      if (
        didCrossWalkFootstepMarker(
          previousPhase,
          nextPhase,
          direction,
          marker.phase
        )
      ) {
        this.#playFootstep(
          marker.footId,
          presentation,
          cameraSnapshot,
          spatializedFootsteps
        );
      }
    }

    state.walkPhase = nextPhase;
    state.wasWalking = true;
  }

  #syncCharacterPresentation(input: {
    readonly alive: boolean;
    readonly cameraSnapshot: MetaverseCameraSnapshot;
    readonly deltaSeconds: number;
    readonly key: string;
    readonly mounted: boolean;
    readonly presentation: MetaverseCharacterPresentationSnapshot;
    readonly spatializedFootsteps: boolean;
  }): void {
    const state =
      this.#characterStatesByKey.get(input.key) ??
      createMovementAudioCharacterState(this.#syncSequence);

    this.#characterStatesByKey.set(input.key, state);
    state.lastSeenSyncSequence = this.#syncSequence;

    const grounded =
      input.alive &&
      !input.mounted &&
      isGroundedAnimationVocabulary(input.presentation.animationVocabulary);
    const hadPreviousPosition =
      state.lastPositionX !== null && state.lastPositionZ !== null;
    const deltaX = hadPreviousPosition
      ? input.presentation.position.x - Number(state.lastPositionX)
      : 0;
    const deltaZ = hadPreviousPosition
      ? input.presentation.position.z - Number(state.lastPositionZ)
      : 0;
    const distanceMeters = Math.hypot(deltaX, deltaZ);
    const safeDeltaSeconds = Math.max(0.001, input.deltaSeconds);
    const speedMetersPerSecond = distanceMeters / safeDeltaSeconds;
    const canPlayWalkFootstep =
      hadPreviousPosition &&
      grounded &&
      input.presentation.animationVocabulary === "walk" &&
      speedMetersPerSecond >= metaverseMovementFootstepMinimumSpeedMetersPerSecond;

    if (canPlayWalkFootstep) {
      this.#syncWalkFootsteps(
        state,
        input.presentation,
        input.cameraSnapshot,
        safeDeltaSeconds,
        input.spatializedFootsteps
      );
    } else {
      state.wasWalking = false;
    }

    state.lastPositionX = input.presentation.position.x;
    state.lastPositionZ = input.presentation.position.z;
  }
}
