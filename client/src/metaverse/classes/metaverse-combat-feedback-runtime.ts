import type {
  MetaverseCombatEventSnapshot,
  MetaverseCombatFeedEventSnapshot,
  MetaversePlayerId
} from "@webgpu-metaverse/shared";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot,
  type MetaverseRealtimePlayerSnapshot,
  type MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type {
  MetaverseCameraSnapshot,
  MetaverseCombatAudioCuePlayer,
  MetaverseCombatPresentationEvent,
  MetaverseRenderedWeaponMuzzleResolver
} from "../types/metaverse-runtime";
import { MetaverseCombatHapticsRuntime } from "./metaverse-combat-haptics-runtime";

interface MetaverseCombatFeedbackRuntimeDependencies {
  readonly playAudioCue?: MetaverseCombatAudioCuePlayer | null;
  readonly readLocalPlayerId: () => MetaversePlayerId | null;
  readonly triggerPresentationEvent: (
    event: MetaverseCombatPresentationEvent
  ) => void;
}

type MetaverseQueuedCombatVisualKind =
  | "pistol-tracer"
  | "rocket-muzzle";

interface MetaversePistolEndpointResolution {
  readonly finiteEndpointPolicy:
    | "normal-tracer"
    | "forward-converged-tracer"
    | "near-field-tracer"
    | "suppressed-invalid-endpoint";
  readonly visualEndWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
}

interface MetaverseQueuedCombatVisualIntent {
  readonly actionSequence: number;
  readonly activeSlotId: string | null;
  readonly directionWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly endWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly eventCameraRayForwardWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  fallbackWaitCount: number;
  readonly firstProjectileSnapshotWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly kind: MetaverseQueuedCombatVisualKind;
  readonly playerId: MetaversePlayerId;
  readonly projectileId: string | null;
  readonly shotId: string | null;
  readonly hitscanHitKind: "miss" | "player" | "world" | null;
  readonly rayOriginWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly semanticOriginWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly sequence: number;
  readonly serverOriginWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly source: NonNullable<MetaverseCombatPresentationEvent["source"]>;
  readonly visualKey: string;
  readonly weaponId: string;
  readonly weaponInstanceId: string | null;
}

const metaverseCombatRecentVisualKeyMaxEntries = 64;
const metaverseCombatPresentationVisualKeyTtlMs = 5_000;
const metaverseCombatVisualIntentMuzzleWaitFrames = 2;
const metaverseCombatPistolTracerMinimumForwardDistanceMeters = 0.05;
const metaverseCombatPistolTracerForwardConvergedLengthMeters = 1.2;
const metaverseCombatPistolTracerNearFieldMinimumLengthMeters = 1.2;
const metaverseCombatListenerUp = Object.freeze({
  x: 0,
  y: 1,
  z: 0
});
const metaverseCombatShotSpatialProfile = Object.freeze({
  maxDistanceMeters: 118,
  refDistanceMeters: 5.4,
  rolloffFactor: 0.68
});
const metaverseCombatHitSpatialProfile = Object.freeze({
  maxDistanceMeters: 36,
  refDistanceMeters: 0.95,
  rolloffFactor: 1.85
});

function createSpatialAudioOptions(
  position: { readonly x: number; readonly y: number; readonly z: number },
  cameraSnapshot: MetaverseCameraSnapshot,
  profile: {
    readonly maxDistanceMeters: number;
    readonly refDistanceMeters: number;
    readonly rolloffFactor: number;
  }
) {
  return Object.freeze({
    spatial: Object.freeze({
      listener: Object.freeze({
        forward: cameraSnapshot.lookDirection,
        position: cameraSnapshot.position,
        up: metaverseCombatListenerUp
      }),
      position: Object.freeze({
        x: position.x,
        y: position.y,
        z: position.z
      }),
      maxDistanceMeters: profile.maxDistanceMeters,
      refDistanceMeters: profile.refDistanceMeters,
      rolloffFactor: profile.rolloffFactor
    })
  });
}

function readPlayerHitAudioPosition(
  playerSnapshot: MetaverseRealtimePlayerSnapshot,
  hitZone: "body" | "head"
) {
  const activeBodySnapshot =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(playerSnapshot);

  return Object.freeze({
    x: activeBodySnapshot.position.x,
    y: activeBodySnapshot.position.y + (hitZone === "head" ? 1.72 : 1.12),
    z: activeBodySnapshot.position.z
  });
}

function createDamageSourceDirectionWorld(
  targetPlayerSnapshot: MetaverseRealtimePlayerSnapshot,
  attackerPlayerSnapshot: MetaverseRealtimePlayerSnapshot
) {
  const targetBodySnapshot =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(targetPlayerSnapshot);
  const attackerBodySnapshot =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(attackerPlayerSnapshot);
  const deltaX =
    attackerBodySnapshot.position.x - targetBodySnapshot.position.x;
  const deltaZ =
    attackerBodySnapshot.position.z - targetBodySnapshot.position.z;
  const horizontalDistance = Math.hypot(deltaX, deltaZ);

  if (horizontalDistance <= 0.000001) {
    return null;
  }

  return Object.freeze({
    x: deltaX / horizontalDistance,
    y: 0,
    z: deltaZ / horizontalDistance
  });
}

function resolveShotAudioCueId(weaponId: string) {
  return weaponId === "metaverse-rocket-launcher-v1"
    ? "metaverse-rocket-launch"
    : "metaverse-pistol-shot";
}

function createCombatVisualKey(input: {
  readonly actionSequence?: number | null;
  readonly eventKind: string;
  readonly playerId: string;
  readonly projectileId?: string | null;
  readonly shotId?: string | null;
  readonly shotCount?: number | null;
  readonly source: string;
  readonly weaponId: string;
}): string {
  const defaultShotId =
    input.actionSequence === null || input.actionSequence === undefined
      ? null
      : `${input.playerId}:${input.actionSequence}`;
  const shotKey =
    input.shotId !== null &&
    input.shotId !== undefined &&
    input.shotId !== defaultShotId
      ? input.shotId
      : input.actionSequence ?? input.shotCount ?? "none";

  return [
    input.source,
    input.eventKind,
    input.playerId,
    input.weaponId,
    input.projectileId ?? "none",
    shotKey
  ].join(":");
}

function readFiniteVector3(
  input:
    | { readonly x: number; readonly y: number; readonly z: number }
    | null
    | undefined
): { readonly x: number; readonly y: number; readonly z: number } | null {
  if (
    input === null ||
    input === undefined ||
    !Number.isFinite(input.x) ||
    !Number.isFinite(input.y) ||
    !Number.isFinite(input.z)
  ) {
    return null;
  }

  return Object.freeze({
    x: input.x,
    y: input.y,
    z: input.z
  });
}

function readVectorDistanceMeters(
  start: { readonly x: number; readonly y: number; readonly z: number } | null,
  end: { readonly x: number; readonly y: number; readonly z: number } | null
): number | null {
  if (start === null || end === null) {
    return null;
  }

  return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
}

function readNormalizedVector3(
  input:
    | { readonly x: number; readonly y: number; readonly z: number }
    | null
    | undefined
): { readonly x: number; readonly y: number; readonly z: number } | null {
  const vector = readFiniteVector3(input);

  if (vector === null) {
    return null;
  }

  const length = Math.hypot(vector.x, vector.y, vector.z);

  if (length <= 0.000001) {
    return null;
  }

  return Object.freeze({
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  });
}

function resolvePistolEndpointPresentation(input: {
  readonly endpointWorld:
    | { readonly x: number; readonly y: number; readonly z: number }
    | null;
  readonly hitscanHitKind: "miss" | "player" | "world" | null;
  readonly rayForwardWorld:
    | { readonly x: number; readonly y: number; readonly z: number }
    | null;
  readonly rayOriginWorld:
    | { readonly x: number; readonly y: number; readonly z: number }
    | null;
  readonly visualStartWorld:
    | { readonly x: number; readonly y: number; readonly z: number }
    | null;
  readonly muzzleForwardWorld:
    | { readonly x: number; readonly y: number; readonly z: number }
    | null;
}): MetaversePistolEndpointResolution {
  const endpointWorld = readFiniteVector3(input.endpointWorld);
  const visualStartWorld = readFiniteVector3(input.visualStartWorld);
  const presentationForwardWorld =
    readNormalizedVector3(input.rayForwardWorld) ??
    readNormalizedVector3(input.muzzleForwardWorld);
  const muzzleToEndpointDistanceMeters = readVectorDistanceMeters(
    visualStartWorld,
    endpointWorld
  );

  if (visualStartWorld === null) {
    return Object.freeze({
      finiteEndpointPolicy: "suppressed-invalid-endpoint",
      visualEndWorld: endpointWorld
    });
  }

  if (endpointWorld === null) {
    return Object.freeze({
      finiteEndpointPolicy: "suppressed-invalid-endpoint",
      visualEndWorld: null
    });
  }

  const endpointOffset =
    visualStartWorld === null
      ? null
      : {
          x: endpointWorld.x - visualStartWorld.x,
          y: endpointWorld.y - visualStartWorld.y,
          z: endpointWorld.z - visualStartWorld.z
        };
  const endpointForwardDistanceMeters =
    endpointOffset === null || presentationForwardWorld === null
      ? null
      : endpointOffset.x * presentationForwardWorld.x +
        endpointOffset.y * presentationForwardWorld.y +
        endpointOffset.z * presentationForwardWorld.z;

  if (
    input.hitscanHitKind !== "miss" &&
    presentationForwardWorld !== null &&
    endpointForwardDistanceMeters !== null &&
    endpointForwardDistanceMeters <=
      metaverseCombatPistolTracerMinimumForwardDistanceMeters
  ) {
    return Object.freeze({
      finiteEndpointPolicy: "forward-converged-tracer",
      visualEndWorld: Object.freeze({
        x:
          visualStartWorld.x +
          presentationForwardWorld.x *
            metaverseCombatPistolTracerForwardConvergedLengthMeters,
        y:
          visualStartWorld.y +
          presentationForwardWorld.y *
            metaverseCombatPistolTracerForwardConvergedLengthMeters,
        z:
          visualStartWorld.z +
          presentationForwardWorld.z *
            metaverseCombatPistolTracerForwardConvergedLengthMeters
      })
    });
  }

  if (
    input.hitscanHitKind !== "miss" &&
    presentationForwardWorld !== null &&
    muzzleToEndpointDistanceMeters !== null &&
    muzzleToEndpointDistanceMeters <
      metaverseCombatPistolTracerNearFieldMinimumLengthMeters
  ) {
    return Object.freeze({
      finiteEndpointPolicy: "near-field-tracer",
      visualEndWorld: Object.freeze({
        x:
          visualStartWorld.x +
          presentationForwardWorld.x *
            metaverseCombatPistolTracerNearFieldMinimumLengthMeters,
        y:
          visualStartWorld.y +
          presentationForwardWorld.y *
            metaverseCombatPistolTracerNearFieldMinimumLengthMeters,
        z:
          visualStartWorld.z +
          presentationForwardWorld.z *
            metaverseCombatPistolTracerNearFieldMinimumLengthMeters
      })
    });
  }

  return Object.freeze({
    finiteEndpointPolicy: "normal-tracer",
    visualEndWorld: endpointWorld
  });
}

function readLatestCombatEventSequence(
  eventSnapshots: readonly MetaverseCombatEventSnapshot[],
  fallbackSequence: number | null
): number | null {
  let latestSequence = fallbackSequence;

  for (const eventSnapshot of eventSnapshots) {
    latestSequence =
      latestSequence === null
        ? eventSnapshot.eventSequence
        : Math.max(latestSequence, eventSnapshot.eventSequence);
  }

  return latestSequence;
}

function readLatestCombatFeedSequence(
  eventSnapshots: readonly MetaverseCombatFeedEventSnapshot[],
  fallbackSequence: number | null
): number | null {
  let latestSequence = fallbackSequence;

  for (const eventSnapshot of eventSnapshots) {
    latestSequence =
      latestSequence === null
        ? eventSnapshot.sequence
        : Math.max(latestSequence, eventSnapshot.sequence);
  }

  return latestSequence;
}

function readPresentationNowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function readPlayerById(
  worldSnapshot: MetaverseRealtimeWorldSnapshot,
  playerId: MetaversePlayerId
): MetaverseRealtimePlayerSnapshot | null {
  return (
    worldSnapshot.players.find(
      (playerSnapshot) => playerSnapshot.playerId === playerId
    ) ?? null
  );
}

function readProjectilePositionById(
  worldSnapshot: MetaverseRealtimeWorldSnapshot,
  projectileId: string | null
): { readonly x: number; readonly y: number; readonly z: number } | null {
  if (projectileId === null) {
    return null;
  }

  return (
    worldSnapshot.projectiles.find(
      (projectileSnapshot) =>
        projectileSnapshot.projectileId === projectileId &&
        projectileSnapshot.resolution === "active"
    )?.position ?? null
  );
}

export class MetaverseCombatFeedbackRuntime {
  readonly #hapticsRuntime = new MetaverseCombatHapticsRuntime();
  readonly #playAudioCue: MetaverseCombatAudioCuePlayer | null;
  readonly #readLocalPlayerId:
    MetaverseCombatFeedbackRuntimeDependencies["readLocalPlayerId"];
  readonly #deathPresentationSequenceByPlayerId = new Map<
    MetaversePlayerId,
    number
  >();
  readonly #deathPresentationActiveByPlayerId = new Map<
    MetaversePlayerId,
    boolean
  >();
  readonly #deferredCombatEventsBySequence = new Map<
    number,
    MetaverseCombatEventSnapshot
  >();
  readonly #projectileImpactVisualIdOrder: string[] = [];
  readonly #projectileImpactVisualIds = new Set<string>();
  readonly #queuedVisualIntentByKey =
    new Map<string, MetaverseQueuedCombatVisualIntent>();
  readonly #queuedVisualIntentKeys: string[] = [];
  readonly #presentationVisualKeys = new Map<string, number>();
  readonly #localPredictedShotOriginByActionSequence = new Map<
    number,
    {
      readonly directionWorld:
        | { readonly x: number; readonly y: number; readonly z: number }
        | null;
      readonly originWorld:
        | { readonly x: number; readonly y: number; readonly z: number }
        | null;
      readonly originSource:
        | "rendered-muzzle-post-sync"
        | "rendered-muzzle-drain-time"
        | "semantic-muzzle-fallback"
        | null;
      readonly originForwardWorld:
        | { readonly x: number; readonly y: number; readonly z: number }
        | null;
      readonly originCaptured: boolean;
      readonly weaponId: string;
    }
  >();
  readonly #triggerPresentationEvent:
    MetaverseCombatFeedbackRuntimeDependencies["triggerPresentationEvent"];

  #initializedFromAuthoritativeSnapshot = false;
  #lastCombatEventSequence: number | null = null;
  #lastCombatFeedSequence: number | null = null;
  #lastLocalPresentationEventSequence = 0;
  #playerAliveById = new Map<MetaversePlayerId, boolean>();

  constructor(dependencies: MetaverseCombatFeedbackRuntimeDependencies) {
    this.#playAudioCue = dependencies.playAudioCue ?? null;
    this.#readLocalPlayerId = dependencies.readLocalPlayerId;
    this.#triggerPresentationEvent = dependencies.triggerPresentationEvent;
  }

  reset(): void {
    this.#initializedFromAuthoritativeSnapshot = false;
    this.#lastCombatEventSequence = null;
    this.#lastCombatFeedSequence = null;
    this.#lastLocalPresentationEventSequence = 0;
    this.#deathPresentationActiveByPlayerId.clear();
    this.#deathPresentationSequenceByPlayerId.clear();
    this.#deferredCombatEventsBySequence.clear();
    this.#playerAliveById.clear();
    this.#localPredictedShotOriginByActionSequence.clear();
    this.#queuedVisualIntentByKey.clear();
    this.#queuedVisualIntentKeys.length = 0;
    this.#presentationVisualKeys.clear();
    this.#projectileImpactVisualIdOrder.length = 0;
    this.#projectileImpactVisualIds.clear();
  }

  registerPendingLocalShot(input: {
    readonly actionSequence?: number | null;
    readonly directionWorld?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null;
    readonly weaponId: string;
  }): void {
    const playerId = this.#readLocalPlayerId();

    if (playerId === null) {
      return;
    }

    const nextPresentationEventSequence =
      this.#lastLocalPresentationEventSequence + 1;
    const actionSequence =
      input.actionSequence === undefined || input.actionSequence === null
        ? null
        : Math.max(0, Math.trunc(input.actionSequence));
    const directionWorld = readFiniteVector3(input.directionWorld);

    this.#lastLocalPresentationEventSequence = nextPresentationEventSequence;

    if (actionSequence !== null) {
      this.#localPredictedShotOriginByActionSequence.set(actionSequence, {
        directionWorld,
        originForwardWorld: null,
        originCaptured: false,
        originSource: null,
        originWorld: null,
        weaponId: input.weaponId
      });

      while (this.#localPredictedShotOriginByActionSequence.size > 32) {
        const oldestActionSequence =
          this.#localPredictedShotOriginByActionSequence.keys().next().value;

        if (oldestActionSequence === undefined) {
          break;
        }

        this.#localPredictedShotOriginByActionSequence.delete(
          oldestActionSequence
        );
      }
    }

    this.#hapticsRuntime.triggerShot();
  }

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
      | "rendered-muzzle-drain-time"
      | "semantic-muzzle-fallback"
      | null;
    readonly originForwardWorld?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null;
    readonly weaponId: string;
  }): void {
    const playerId = this.#readLocalPlayerId();

    if (playerId === null) {
      return;
    }

    const actionSequence =
      input.actionSequence === undefined || input.actionSequence === null
        ? null
        : Math.max(0, Math.trunc(input.actionSequence));
    const originWorld = readFiniteVector3(input.originWorld);
    const originSource =
      originWorld === null
        ? null
        : input.originSource ?? "rendered-muzzle-post-sync";
    const directionWorld = readFiniteVector3(input.directionWorld);
    const originForwardWorld = readFiniteVector3(input.originForwardWorld);
    const previousPendingShot =
      actionSequence === null
        ? null
        : this.#localPredictedShotOriginByActionSequence.get(actionSequence) ??
          null;

    if (actionSequence !== null) {
      this.#localPredictedShotOriginByActionSequence.set(actionSequence, {
        directionWorld: directionWorld ?? previousPendingShot?.directionWorld ?? null,
        originForwardWorld:
          originForwardWorld ?? previousPendingShot?.originForwardWorld ?? null,
        originCaptured: true,
        originSource,
        originWorld,
        weaponId: input.weaponId
      });
    }
  }

  syncAuthoritativeWorld(
    worldSnapshot: MetaverseRealtimeWorldSnapshot | null,
    cameraSnapshot: MetaverseCameraSnapshot
  ): void {
    if (worldSnapshot === null) {
      return;
    }

    this.#syncCombatEvents(worldSnapshot, cameraSnapshot);
    this.#syncCombatFeed(worldSnapshot, cameraSnapshot);
    this.#syncAliveTransitions(worldSnapshot);
    this.#initializedFromAuthoritativeSnapshot = true;
  }

  drainQueuedVisualIntents(input: {
    readonly cameraSnapshot: MetaverseCameraSnapshot;
    readonly resolveRenderedMuzzle?: MetaverseRenderedWeaponMuzzleResolver | null;
  }): void {
    const nowMs = readPresentationNowMs();
    const resolveRenderedMuzzle = input.resolveRenderedMuzzle ?? null;
    const localPlayerId = this.#readLocalPlayerId();

    for (const visualKey of [...this.#queuedVisualIntentKeys]) {
      const visualIntent = this.#queuedVisualIntentByKey.get(visualKey) ?? null;

      if (visualIntent === null) {
        continue;
      }

      const renderedMuzzleFrame =
        resolveRenderedMuzzle?.({
          playerId: visualIntent.playerId,
          role: "projectile.muzzle",
          slotId: visualIntent.activeSlotId,
          weaponId: visualIntent.weaponId,
          weaponInstanceId: visualIntent.weaponInstanceId
        }) ?? null;
      const renderedMuzzleWorld = readFiniteVector3(
        renderedMuzzleFrame?.originWorld
      );
      const renderedMuzzleForwardWorld = readFiniteVector3(
        renderedMuzzleFrame?.forwardWorld
      );
      const localPredictedShotOrigin =
        localPlayerId !== null && visualIntent.playerId === localPlayerId
          ? this.#localPredictedShotOriginByActionSequence.get(
              visualIntent.actionSequence
            ) ?? null
          : null;
      const localPendingShotMatches =
        localPredictedShotOrigin?.weaponId === visualIntent.weaponId;
      const postSyncFireActionMuzzleWorld =
        localPredictedShotOrigin !== null &&
        localPendingShotMatches &&
        localPredictedShotOrigin.originCaptured
          ? readFiniteVector3(localPredictedShotOrigin.originWorld)
          : null;
      const postSyncFireActionMuzzleForwardWorld =
        postSyncFireActionMuzzleWorld === null
          ? null
          : readFiniteVector3(localPredictedShotOrigin?.originForwardWorld);
      const renderedVisualStartWorld = renderedMuzzleWorld;
      const semanticVisualStartWorld = readFiniteVector3(
        visualIntent.semanticOriginWorld
      );
      const muzzleWaitExpired =
        visualIntent.fallbackWaitCount >=
        metaverseCombatVisualIntentMuzzleWaitFrames;

      if (visualIntent.kind === "pistol-tracer") {
        const semanticFallbackStartWorld =
          muzzleWaitExpired ? semanticVisualStartWorld : null;
        const visualStartWorld =
          postSyncFireActionMuzzleWorld ??
          renderedVisualStartWorld ??
          semanticFallbackStartWorld;
        const selectedRenderedMuzzleForwardWorld =
          postSyncFireActionMuzzleForwardWorld ?? renderedMuzzleForwardWorld;

        if (
          visualStartWorld === null &&
          visualIntent.fallbackWaitCount <
            metaverseCombatVisualIntentMuzzleWaitFrames
        ) {
          visualIntent.fallbackWaitCount += 1;
          continue;
        }

        const endpointResolution = resolvePistolEndpointPresentation({
          endpointWorld: visualIntent.endWorld,
          hitscanHitKind: visualIntent.hitscanHitKind,
          muzzleForwardWorld: selectedRenderedMuzzleForwardWorld,
          rayForwardWorld:
            visualIntent.eventCameraRayForwardWorld ??
            visualIntent.directionWorld,
          rayOriginWorld: visualIntent.rayOriginWorld,
          visualStartWorld
        });
        const finiteEndpointPolicy = endpointResolution.finiteEndpointPolicy;

        if (visualStartWorld === null) {
          this.#localPredictedShotOriginByActionSequence.delete(
            visualIntent.actionSequence
          );
          this.#removeQueuedVisualIntent(visualKey);
          continue;
        }

        if (!this.#consumePresentationVisualKey(visualKey, nowMs)) {
          this.#removeQueuedVisualIntent(visualKey);
          continue;
        }

        const authoritativeWorldImpactPoint =
          visualIntent.hitscanHitKind === "world"
            ? readFiniteVector3(visualIntent.endWorld)
            : null;

        if (
          authoritativeWorldImpactPoint !== null &&
          endpointResolution.finiteEndpointPolicy !==
            "suppressed-invalid-endpoint"
        ) {
          const impactVisualKey = createCombatVisualKey({
            actionSequence: visualIntent.actionSequence,
            eventKind: "pistol-world-impact",
            playerId: visualIntent.playerId,
            shotId: visualIntent.shotId,
            source: visualIntent.source,
            weaponId: visualIntent.weaponId
          });

          if (this.#consumePresentationVisualKey(impactVisualKey, nowMs)) {
            this.#triggerPresentationEvent({
              actionSequence: visualIntent.actionSequence,
              kind: "shot",
              originWorld: authoritativeWorldImpactPoint,
              playerId: visualIntent.playerId,
              sequence: visualIntent.sequence,
              shotFx: "pistol-world-impact",
              source: visualIntent.source,
              startedAtMs: nowMs,
              visualKey: impactVisualKey,
              weaponId: visualIntent.weaponId
            });
          }
        }

        if (finiteEndpointPolicy !== "suppressed-invalid-endpoint") {
          this.#playAudioCue?.(
            resolveShotAudioCueId(visualIntent.weaponId),
            createSpatialAudioOptions(
              visualStartWorld,
              input.cameraSnapshot,
              metaverseCombatShotSpatialProfile
            )
          );

          this.#triggerPresentationEvent({
            actionSequence: visualIntent.actionSequence,
            directionWorld: visualIntent.directionWorld,
            endWorld: endpointResolution.visualEndWorld,
            kind: "shot",
            originWorld: visualStartWorld,
            playerId: visualIntent.playerId,
            projectileId: visualIntent.projectileId,
            sequence: visualIntent.sequence,
            shotFx: visualIntent.kind,
            source: visualIntent.source,
            startedAtMs: nowMs,
            visualKey: visualIntent.visualKey,
            weaponId: visualIntent.weaponId
          });
        }

        this.#localPredictedShotOriginByActionSequence.delete(
          visualIntent.actionSequence
        );
        this.#removeQueuedVisualIntent(visualKey);
        continue;
      }

      const semanticFallbackStartWorld =
        muzzleWaitExpired ? semanticVisualStartWorld : null;
      const visualStartWorld =
        postSyncFireActionMuzzleWorld ??
        renderedVisualStartWorld ??
        semanticFallbackStartWorld;

      if (
        visualStartWorld === null &&
        visualIntent.fallbackWaitCount <
          metaverseCombatVisualIntentMuzzleWaitFrames
      ) {
        visualIntent.fallbackWaitCount += 1;
        continue;
      }

      if (visualStartWorld === null) {
        this.#removeQueuedVisualIntent(visualKey);
        continue;
      }

      if (!this.#consumePresentationVisualKey(visualKey, nowMs)) {
        this.#removeQueuedVisualIntent(visualKey);
        continue;
      }

      if (visualIntent.kind === "rocket-muzzle") {
        this.#playAudioCue?.(
          "metaverse-rocket-launch",
          createSpatialAudioOptions(
            visualStartWorld,
            input.cameraSnapshot,
            metaverseCombatShotSpatialProfile
          )
        );
      }

      this.#triggerPresentationEvent({
        actionSequence: visualIntent.actionSequence,
        directionWorld: visualIntent.directionWorld,
        endWorld: visualIntent.endWorld,
        kind: "shot",
        originWorld: visualStartWorld,
        playerId: visualIntent.playerId,
        projectileId: visualIntent.projectileId,
        sequence: visualIntent.sequence,
        shotFx: visualIntent.kind,
        source: visualIntent.source,
        startedAtMs: nowMs,
        visualKey: visualIntent.visualKey,
        weaponId: visualIntent.weaponId
      });

      this.#localPredictedShotOriginByActionSequence.delete(
        visualIntent.actionSequence
      );
      this.#removeQueuedVisualIntent(visualKey);
    }
  }

  #queueVisualIntent(intent: MetaverseQueuedCombatVisualIntent): void {
    if (
      this.#presentationVisualKeys.has(intent.visualKey) ||
      this.#queuedVisualIntentByKey.has(intent.visualKey)
    ) {
      return;
    }

    this.#queuedVisualIntentByKey.set(intent.visualKey, intent);
    this.#queuedVisualIntentKeys.push(intent.visualKey);

    while (
      this.#queuedVisualIntentKeys.length >
      metaverseCombatRecentVisualKeyMaxEntries
    ) {
      const retiredVisualKey = this.#queuedVisualIntentKeys.shift();

      if (retiredVisualKey !== undefined) {
        this.#queuedVisualIntentByKey.delete(retiredVisualKey);
      }
    }
  }

  #removeQueuedVisualIntent(visualKey: string): void {
    this.#queuedVisualIntentByKey.delete(visualKey);
    const visualKeyIndex = this.#queuedVisualIntentKeys.indexOf(visualKey);

    if (visualKeyIndex >= 0) {
      this.#queuedVisualIntentKeys.splice(visualKeyIndex, 1);
    }
  }

  #syncCombatEvents(
    worldSnapshot: MetaverseRealtimeWorldSnapshot,
    cameraSnapshot: MetaverseCameraSnapshot
  ): void {
    const latestCombatEventSequence = readLatestCombatEventSequence(
      worldSnapshot.combatEvents,
      this.#lastCombatEventSequence
    );

    if (this.#lastCombatEventSequence === null) {
      const localPlayerId = this.#readLocalPlayerId();
      const activeProjectileIds = new Set(
        worldSnapshot.projectiles
          .filter((projectileSnapshot) => projectileSnapshot.resolution === "active")
          .map((projectileSnapshot) => projectileSnapshot.projectileId)
      );
      const pendingLocalCombatEvents =
        localPlayerId === null
          ? []
          : worldSnapshot.combatEvents.filter(
              (eventSnapshot) =>
                eventSnapshot.playerId === localPlayerId &&
                this.#localPredictedShotOriginByActionSequence.get(
                  eventSnapshot.actionSequence
                )?.weaponId === eventSnapshot.weaponId
            );
      const activeProjectileSpawnEvents = worldSnapshot.combatEvents.filter(
        (eventSnapshot) =>
          eventSnapshot.eventKind === "projectile-spawned" &&
          eventSnapshot.projectileId !== null &&
          activeProjectileIds.has(eventSnapshot.projectileId)
      );
      const resolvedProjectileImpactIds = new Set(
        worldSnapshot.projectiles
          .filter(
            (projectileSnapshot) =>
              projectileSnapshot.resolution === "hit-player" ||
              projectileSnapshot.resolution === "hit-world"
          )
          .map((projectileSnapshot) => projectileSnapshot.projectileId)
      );
      const resolvedProjectileImpactEvents = worldSnapshot.combatEvents.filter(
        (eventSnapshot) =>
          eventSnapshot.eventKind === "projectile-resolved" &&
          eventSnapshot.projectileId !== null &&
          resolvedProjectileImpactIds.has(eventSnapshot.projectileId) &&
          eventSnapshot.projectile !== null &&
          (eventSnapshot.projectile.resolutionKind === "hit-player" ||
            eventSnapshot.projectile.resolutionKind === "hit-world")
      );
      const initialCombatEventsBySequence = new Map<
        number,
        MetaverseCombatEventSnapshot
      >();

      for (const eventSnapshot of [
        ...pendingLocalCombatEvents,
        ...activeProjectileSpawnEvents,
        ...resolvedProjectileImpactEvents
      ]) {
        initialCombatEventsBySequence.set(
          eventSnapshot.eventSequence,
          eventSnapshot
        );
      }

      for (const eventSnapshot of [...initialCombatEventsBySequence.values()].sort(
        (leftEvent, rightEvent) =>
          leftEvent.eventSequence - rightEvent.eventSequence
      )) {
        const processed = this.#triggerCombatEvent(
          eventSnapshot,
          worldSnapshot,
          cameraSnapshot
        );

        if (!processed) {
          this.#deferredCombatEventsBySequence.set(
            eventSnapshot.eventSequence,
            eventSnapshot
          );
        }
      }

      this.#lastCombatEventSequence = latestCombatEventSequence ?? 0;
      return;
    }

    const lastCombatEventSequence = this.#lastCombatEventSequence ?? 0;
    let newEvents: MetaverseCombatEventSnapshot[] | null = null;

    for (const eventSnapshot of worldSnapshot.combatEvents) {
      if (eventSnapshot.eventSequence <= lastCombatEventSequence) {
        continue;
      }

      if (newEvents === null) {
        newEvents = [];
      }

      newEvents.push(eventSnapshot);
    }

    const combatEvents =
      this.#deferredCombatEventsBySequence.size === 0
        ? newEvents ?? []
        : [
            ...this.#deferredCombatEventsBySequence.values(),
            ...(newEvents ?? [])
          ].sort(
            (leftEvent, rightEvent) =>
              leftEvent.eventSequence - rightEvent.eventSequence
          );

    for (const eventSnapshot of combatEvents) {
      const processed = this.#triggerCombatEvent(
        eventSnapshot,
        worldSnapshot,
        cameraSnapshot
      );

      if (processed) {
        this.#deferredCombatEventsBySequence.delete(eventSnapshot.eventSequence);
      } else {
        this.#deferredCombatEventsBySequence.set(
          eventSnapshot.eventSequence,
          eventSnapshot
        );
      }
    }

    this.#lastCombatEventSequence = Math.max(
      this.#lastCombatEventSequence,
      latestCombatEventSequence ?? this.#lastCombatEventSequence
    );
  }

  #triggerCombatEvent(
    eventSnapshot: MetaverseCombatEventSnapshot,
    worldSnapshot: MetaverseRealtimeWorldSnapshot,
    cameraSnapshot: MetaverseCameraSnapshot
  ): boolean {
    switch (eventSnapshot.eventKind) {
      case "hitscan-resolved":
        return this.#triggerHitscanResolvedEvent(eventSnapshot, worldSnapshot);
      case "projectile-spawned":
        return this.#triggerProjectileSpawnedEvent(eventSnapshot, worldSnapshot);
      case "projectile-resolved":
        this.#triggerProjectileResolvedEvent(eventSnapshot, cameraSnapshot);
        return true;
      default: {
        const exhaustiveEventKind: never = eventSnapshot.eventKind;

        throw new Error(
          `Unsupported metaverse combat event kind: ${exhaustiveEventKind}`
        );
      }
    }
  }

  #triggerHitscanResolvedEvent(
    eventSnapshot: MetaverseCombatEventSnapshot,
    _worldSnapshot: MetaverseRealtimeWorldSnapshot
  ): boolean {
    if (
      eventSnapshot.presentationDeliveryModel !== "hitscan-tracer" ||
      eventSnapshot.hitscan === null
    ) {
      return true;
    }

    const localPlayerId = this.#readLocalPlayerId();
    const localPredictedShotOrigin =
      localPlayerId !== null && eventSnapshot.playerId === localPlayerId
        ? this.#localPredictedShotOriginByActionSequence.get(
            eventSnapshot.actionSequence
          ) ?? null
        : null;

    const predictedDirection =
      localPredictedShotOrigin?.weaponId === eventSnapshot.weaponId
        ? localPredictedShotOrigin.directionWorld
        : null;
    const authoritativeRayDirection = readFiniteVector3(
      eventSnapshot.cameraRayForwardWorld
    );
    const tracerDirection = authoritativeRayDirection ?? predictedDirection;
    const semanticTracerOrigin = readFiniteVector3(
      eventSnapshot.semanticMuzzleWorld
    );
    const rayOrigin = readFiniteVector3(eventSnapshot.cameraRayOriginWorld);

    const hitPointWorld = readFiniteVector3(eventSnapshot.hitscan.hitPointWorld);
    const tracerEnd =
      eventSnapshot.hitscan.hitKind === "miss"
        ? readFiniteVector3(eventSnapshot.aimTargetWorld)
        : hitPointWorld;

    const visualKey = createCombatVisualKey({
      actionSequence: eventSnapshot.actionSequence,
      eventKind: "pistol-tracer",
      playerId: eventSnapshot.playerId,
      shotId: eventSnapshot.shotId,
      source: "authoritative-shot-resolution",
      weaponId: eventSnapshot.weaponId
    });

    this.#queueVisualIntent({
      actionSequence: eventSnapshot.actionSequence,
      activeSlotId: eventSnapshot.activeSlotId ?? null,
      directionWorld: tracerDirection ?? authoritativeRayDirection,
      endWorld: tracerEnd,
      eventCameraRayForwardWorld: authoritativeRayDirection ?? tracerDirection,
      fallbackWaitCount: 0,
      firstProjectileSnapshotWorld: null,
      hitscanHitKind: eventSnapshot.hitscan.hitKind,
      kind: "pistol-tracer",
      playerId: eventSnapshot.playerId,
      projectileId: null,
      rayOriginWorld: rayOrigin,
      semanticOriginWorld: semanticTracerOrigin,
      sequence: eventSnapshot.eventSequence,
      serverOriginWorld: semanticTracerOrigin,
      shotId: eventSnapshot.shotId,
      source: "authoritative-shot-resolution",
      visualKey,
      weaponId: eventSnapshot.weaponId,
      weaponInstanceId: eventSnapshot.weaponInstanceId ?? null
    });

    return true;
  }

  #triggerProjectileSpawnedEvent(
    eventSnapshot: MetaverseCombatEventSnapshot,
    worldSnapshot: MetaverseRealtimeWorldSnapshot
  ): boolean {
    if (
      eventSnapshot.presentationDeliveryModel !== "authoritative-projectile" ||
      eventSnapshot.projectileId === null
    ) {
      return true;
    }

    const localPlayerId = this.#readLocalPlayerId();
    const localPredictedShotOrigin =
      localPlayerId !== null && eventSnapshot.playerId === localPlayerId
        ? this.#localPredictedShotOriginByActionSequence.get(
            eventSnapshot.actionSequence
          ) ?? null
        : null;
    const serverLaunchOrigin = readFiniteVector3(
      eventSnapshot.semanticMuzzleWorld
    );
    const launchDirection =
      readFiniteVector3(eventSnapshot.launchDirectionWorld) ??
      readFiniteVector3(eventSnapshot.cameraRayForwardWorld) ??
      localPredictedShotOrigin?.directionWorld ??
      null;
    const rayOrigin = readFiniteVector3(eventSnapshot.cameraRayOriginWorld);

    const visualKey = createCombatVisualKey({
      actionSequence: eventSnapshot.actionSequence,
      eventKind: "rocket-muzzle",
      playerId: eventSnapshot.playerId,
      projectileId: eventSnapshot.projectileId,
      shotId: eventSnapshot.shotId,
      source: "authoritative-projectile",
      weaponId: eventSnapshot.weaponId
    });

    this.#queueVisualIntent({
      actionSequence: eventSnapshot.actionSequence,
      activeSlotId: eventSnapshot.activeSlotId ?? null,
      directionWorld: launchDirection,
      endWorld: readFiniteVector3(eventSnapshot.aimTargetWorld),
      eventCameraRayForwardWorld: readFiniteVector3(
        eventSnapshot.cameraRayForwardWorld
      ),
      fallbackWaitCount: 0,
      firstProjectileSnapshotWorld: readProjectilePositionById(
        worldSnapshot,
        eventSnapshot.projectileId
      ),
      hitscanHitKind: null,
      kind: "rocket-muzzle",
      playerId: eventSnapshot.playerId,
      projectileId: eventSnapshot.projectileId,
      rayOriginWorld: rayOrigin,
      semanticOriginWorld: serverLaunchOrigin,
      sequence: eventSnapshot.eventSequence,
      serverOriginWorld: serverLaunchOrigin,
      shotId: eventSnapshot.shotId,
      source: "authoritative-projectile",
      visualKey,
      weaponId: eventSnapshot.weaponId,
      weaponInstanceId: eventSnapshot.weaponInstanceId ?? null
    });

    return true;
  }

  #triggerProjectileResolvedEvent(
    eventSnapshot: MetaverseCombatEventSnapshot,
    cameraSnapshot: MetaverseCameraSnapshot
  ): void {
    if (
      eventSnapshot.projectileId === null ||
      eventSnapshot.projectile === null ||
      (eventSnapshot.projectile.resolutionKind !== "hit-player" &&
        eventSnapshot.projectile.resolutionKind !== "hit-world")
    ) {
      return;
    }

    if (this.#projectileImpactVisualIds.has(eventSnapshot.projectileId)) {
      return;
    }

    const impactPointWorld = readFiniteVector3(
      eventSnapshot.projectile.impactPointWorld
    );

    if (impactPointWorld === null) {
      return;
    }

    const nowMs = readPresentationNowMs();
    const visualKey = createCombatVisualKey({
      actionSequence: eventSnapshot.actionSequence,
      eventKind: "projectile-impact",
      playerId: eventSnapshot.playerId,
      projectileId: eventSnapshot.projectileId,
      shotId: eventSnapshot.shotId,
      source: "authoritative-projectile-resolution",
      weaponId: eventSnapshot.weaponId
    });

    if (!this.#consumePresentationVisualKey(visualKey, nowMs)) {
      return;
    }

    this.#projectileImpactVisualIds.add(eventSnapshot.projectileId);
    this.#projectileImpactVisualIdOrder.push(eventSnapshot.projectileId);

    while (
      this.#projectileImpactVisualIdOrder.length >
      metaverseCombatRecentVisualKeyMaxEntries
    ) {
      const retiredProjectileId = this.#projectileImpactVisualIdOrder.shift();

      if (retiredProjectileId !== undefined) {
        this.#projectileImpactVisualIds.delete(retiredProjectileId);
      }
    }

    if (eventSnapshot.weaponId === "metaverse-rocket-launcher-v1") {
      this.#playAudioCue?.(
        "metaverse-rocket-explosion",
        createSpatialAudioOptions(
          impactPointWorld,
          cameraSnapshot,
          metaverseCombatHitSpatialProfile
        )
      );
    } else if (eventSnapshot.projectile.resolutionKind === "hit-world") {
      this.#playAudioCue?.(
        "metaverse-world-impact",
        createSpatialAudioOptions(
          impactPointWorld,
          cameraSnapshot,
          metaverseCombatHitSpatialProfile
        )
      );
    }

    this.#triggerPresentationEvent({
      actionSequence: eventSnapshot.actionSequence,
      kind: "projectile-impact",
      originWorld: impactPointWorld,
      playerId: eventSnapshot.playerId,
      projectileId: eventSnapshot.projectileId,
      sequence: eventSnapshot.eventSequence,
      source: "authoritative-projectile-resolution",
      startedAtMs: nowMs,
      visualKey,
      weaponId: eventSnapshot.weaponId
    });
  }

  #consumePresentationVisualKey(visualKey: string, nowMs: number): boolean {
    for (const [candidateKey, expiresAtMs] of this.#presentationVisualKeys) {
      if (nowMs >= expiresAtMs) {
        this.#presentationVisualKeys.delete(candidateKey);
      }
    }

    if (this.#presentationVisualKeys.has(visualKey)) {
      return false;
    }

    this.#presentationVisualKeys.set(
      visualKey,
      nowMs + metaverseCombatPresentationVisualKeyTtlMs
    );

    while (
      this.#presentationVisualKeys.size > metaverseCombatRecentVisualKeyMaxEntries
    ) {
      const oldestVisualKey = this.#presentationVisualKeys.keys().next().value;

      if (oldestVisualKey === undefined) {
        break;
      }

      this.#presentationVisualKeys.delete(oldestVisualKey);
    }

    return true;
  }

  #syncCombatFeed(
    worldSnapshot: MetaverseRealtimeWorldSnapshot,
    cameraSnapshot: MetaverseCameraSnapshot
  ): void {
    const latestFeedSequence = readLatestCombatFeedSequence(
      worldSnapshot.combatFeed,
      this.#lastCombatFeedSequence
    );

    if (this.#lastCombatFeedSequence === null) {
      this.#lastCombatFeedSequence = latestFeedSequence ?? 0;
      return;
    }

    const localPlayerId = this.#readLocalPlayerId();

    for (const eventSnapshot of worldSnapshot.combatFeed) {
      if (eventSnapshot.sequence <= this.#lastCombatFeedSequence) {
        continue;
      }

      if (eventSnapshot.type === "damage") {
        this.#triggerHit(
          worldSnapshot,
          eventSnapshot.targetPlayerId,
          eventSnapshot.attackerPlayerId,
          eventSnapshot.damage,
          eventSnapshot.hitZone,
          eventSnapshot.sequence,
          eventSnapshot.weaponId,
          cameraSnapshot,
          eventSnapshot.targetPlayerId === localPlayerId
        );
      } else if (eventSnapshot.type === "kill") {
        this.#triggerDeath(
          worldSnapshot,
          eventSnapshot.targetPlayerId,
          eventSnapshot.sequence,
          eventSnapshot.weaponId,
          eventSnapshot.attackerPlayerId
        );
      }
    }

    this.#lastCombatFeedSequence = latestFeedSequence;
  }

  #triggerHit(
    worldSnapshot: MetaverseRealtimeWorldSnapshot,
    targetPlayerId: MetaversePlayerId,
    attackerPlayerId: MetaversePlayerId,
    damageAmount: number,
    hitZone: "body" | "head",
    sequence: number,
    weaponId: string,
    cameraSnapshot: MetaverseCameraSnapshot,
    localTarget: boolean
  ): void {
    const targetPlayerSnapshot = readPlayerById(worldSnapshot, targetPlayerId);
    const attackerPlayerSnapshot = readPlayerById(
      worldSnapshot,
      attackerPlayerId
    );
    const damageSourceDirectionWorld =
      targetPlayerSnapshot === null || attackerPlayerSnapshot === null
        ? null
        : createDamageSourceDirectionWorld(
            targetPlayerSnapshot,
            attackerPlayerSnapshot
          );

    if (targetPlayerSnapshot !== null) {
      this.#playAudioCue?.(
        "metaverse-armor-hit",
        createSpatialAudioOptions(
          readPlayerHitAudioPosition(targetPlayerSnapshot, hitZone),
          cameraSnapshot,
          metaverseCombatHitSpatialProfile
        )
      );
    } else {
      this.#playAudioCue?.("metaverse-armor-hit");
    }

    if (localTarget) {
      this.#hapticsRuntime.triggerHit();
    }

    this.#triggerPresentationEvent({
      damageAmount,
      damageSourceDirectionWorld,
      hitZone,
      kind: "hit",
      playerId: targetPlayerId,
      sequence,
      startedAtMs: readPresentationNowMs(),
      weaponId
    });
  }

  #syncAliveTransitions(worldSnapshot: MetaverseRealtimeWorldSnapshot): void {
    for (const playerSnapshot of worldSnapshot.players) {
      const alive = playerSnapshot.combat?.alive ?? true;
      const previousAlive = this.#playerAliveById.get(playerSnapshot.playerId);

      this.#playerAliveById.set(playerSnapshot.playerId, alive);

      if (alive) {
        this.#deathPresentationActiveByPlayerId.set(playerSnapshot.playerId, false);
      }

      if (
        previousAlive === undefined ||
        previousAlive === alive ||
        !this.#initializedFromAuthoritativeSnapshot
      ) {
        continue;
      }

      if (!alive) {
        this.#triggerDeath(
          worldSnapshot,
          playerSnapshot.playerId,
          playerSnapshot.stateSequence,
          playerSnapshot.combat?.activeWeapon?.weaponId ?? null
        );
      }
    }
  }

  #triggerDeath(
    worldSnapshot: MetaverseRealtimeWorldSnapshot,
    playerId: MetaversePlayerId,
    sequence: number,
    weaponId: string | null,
    attackerPlayerId?: MetaversePlayerId | null
  ): void {
    const lastDeathSequence =
      this.#deathPresentationSequenceByPlayerId.get(playerId) ?? 0;

    if (
      this.#deathPresentationActiveByPlayerId.get(playerId) === true ||
      sequence <= lastDeathSequence
    ) {
      return;
    }

    this.#deathPresentationActiveByPlayerId.set(playerId, true);
    this.#deathPresentationSequenceByPlayerId.set(playerId, sequence);

    const targetPlayerSnapshot = readPlayerById(worldSnapshot, playerId);
    const attackerPlayerSnapshot =
      attackerPlayerId === null || attackerPlayerId === undefined
        ? null
        : readPlayerById(worldSnapshot, attackerPlayerId);
    const damageSourceDirectionWorld =
      targetPlayerSnapshot === null || attackerPlayerSnapshot === null
        ? null
        : createDamageSourceDirectionWorld(
            targetPlayerSnapshot,
            attackerPlayerSnapshot
          );

    this.#triggerPresentationEvent({
      damageSourceDirectionWorld,
      kind: "death",
      playerId,
      sequence,
      startedAtMs: readPresentationNowMs(),
      weaponId
    });
  }
}
