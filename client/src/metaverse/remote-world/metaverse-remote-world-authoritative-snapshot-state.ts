import type {
  MetaversePlayerId,
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeEnvironmentBodySnapshot,
  MetaverseRealtimeVehicleSnapshot,
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared";

import {
  createAckedAuthoritativeLocalPlayerDeliveryKey,
  readAckedAuthoritativeLocalPlayerPose,
  type AckedAuthoritativeLocalPlayerPose,
  type ConsumedAckedAuthoritativeLocalPlayerSample
} from "../traversal/reconciliation/authoritative-local-player-reconciliation";
import {
  readMetaverseWorldPlayerSnapshotByPlayerId,
  resolveMetaverseRemoteWorldFreshLatestSnapshot
} from "./metaverse-remote-world-sampling";

interface MetaverseRemoteWorldAuthoritativeSnapshotClock {
  observeServerTime(serverTimeMs: number, localWallClockMs: number): void;
  readEstimatedServerTimeMs(localWallClockMs: number): number;
}

interface MetaverseRemoteWorldAuthoritativeSnapshotStateDependencies {
  readonly authoritativeServerClock: MetaverseRemoteWorldAuthoritativeSnapshotClock;
  readonly readLatestPlayerInputSequence: () => number;
  readonly readLatestPlayerTraversalOrientationSequence: () => number;
  readonly readLatestPlayerWeaponSequence: () => number;
  readonly readLocalPlayerId: () => MetaversePlayerId | null;
  readonly readWallClockMs?: () => number;
  readonly readWorldSnapshotBuffer: () => readonly MetaverseRealtimeWorldSnapshot[];
}

interface FreshLocalPlayerSnapshot {
  readonly latestWorldSnapshot: MetaverseRealtimeWorldSnapshot;
  readonly observerPlayerSnapshot:
    NonNullable<MetaverseRealtimeWorldSnapshot["observerPlayer"]>;
  readonly playerSnapshot: MetaverseRealtimePlayerSnapshot;
}

export type MetaverseRealtimeAuthoritativeLocalPlayerSnapshot =
  MetaverseRealtimePlayerSnapshot & {
    readonly jumpDebug:
      NonNullable<MetaverseRealtimeWorldSnapshot["observerPlayer"]>["jumpDebug"];
    readonly lastProcessedInputSequence: number;
    readonly lastProcessedLookSequence: number;
    readonly lastProcessedTraversalSampleId: number;
    readonly lastProcessedTraversalOrientationSequence: number;
    readonly lastProcessedWeaponSequence: number;
  };

const emptyRealtimeEnvironmentBodySnapshots =
  Object.freeze([]) as readonly MetaverseRealtimeEnvironmentBodySnapshot[];
const emptyRealtimePlayerSnapshots =
  Object.freeze([]) as readonly MetaverseRealtimePlayerSnapshot[];

export class MetaverseRemoteWorldAuthoritativeSnapshotState {
  readonly #authoritativeServerClock: MetaverseRemoteWorldAuthoritativeSnapshotClock;
  readonly #latestAuthoritativeRemotePlayerSnapshots:
    MetaverseRealtimePlayerSnapshot[] = [];
  readonly #latestPlayerSnapshotsByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseRealtimePlayerSnapshot
  >();
  readonly #latestVehicleSnapshotsByEnvironmentAssetId = new Map<
    string,
    MetaverseRealtimeVehicleSnapshot
  >();
  readonly #readLatestPlayerInputSequence: () => number;
  readonly #readLatestPlayerTraversalOrientationSequence: () => number;
  readonly #readLatestPlayerWeaponSequence: () => number;
  readonly #readLocalPlayerId: () => MetaversePlayerId | null;
  readonly #readWallClockMs: () => number;
  readonly #readWorldSnapshotBuffer: () => readonly MetaverseRealtimeWorldSnapshot[];

  #lastConsumedAckedLocalPlayerPoseDeliveryKey: string | null = null;
  #latestIndexedWorldSnapshot: MetaverseRealtimeWorldSnapshot | null = null;
  #latestIndexedLocalPlayerId: MetaversePlayerId | null = null;

  constructor({
    authoritativeServerClock,
    readLatestPlayerInputSequence,
    readLatestPlayerTraversalOrientationSequence,
    readLatestPlayerWeaponSequence,
    readLocalPlayerId,
    readWallClockMs,
    readWorldSnapshotBuffer
  }: MetaverseRemoteWorldAuthoritativeSnapshotStateDependencies) {
    this.#authoritativeServerClock = authoritativeServerClock;
    this.#readLatestPlayerInputSequence = readLatestPlayerInputSequence;
    this.#readLatestPlayerTraversalOrientationSequence =
      readLatestPlayerTraversalOrientationSequence;
    this.#readLatestPlayerWeaponSequence = readLatestPlayerWeaponSequence;
    this.#readLocalPlayerId = readLocalPlayerId;
    this.#readWallClockMs = readWallClockMs ?? Date.now;
    this.#readWorldSnapshotBuffer = readWorldSnapshotBuffer;
  }

  clear(): void {
    this.#lastConsumedAckedLocalPlayerPoseDeliveryKey = null;
    this.#latestIndexedWorldSnapshot = null;
    this.#latestIndexedLocalPlayerId = null;
    this.#latestAuthoritativeRemotePlayerSnapshots.length = 0;
    this.#latestPlayerSnapshotsByPlayerId.clear();
    this.#latestVehicleSnapshotsByEnvironmentAssetId.clear();
  }

  readFreshAuthoritativeLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeAuthoritativeLocalPlayerSnapshot | null {
    const freshLocalPlayerSnapshot = this.#readFreshLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    return freshLocalPlayerSnapshot === null
      ? null
      : this.#composeAuthoritativeLocalPlayerSnapshot(freshLocalPlayerSnapshot);
  }

  readFreshAckedAuthoritativeLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeAuthoritativeLocalPlayerSnapshot | null {
    const freshAckedLocalPlayerSnapshot = this.#readFreshAckedLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    return freshAckedLocalPlayerSnapshot === null
      ? null
      : this.#composeAuthoritativeLocalPlayerSnapshot(
          freshAckedLocalPlayerSnapshot
        );
  }

  readFreshAckedAuthoritativeLocalPlayerPose(
    maxAuthoritativeSnapshotAgeMs: number
  ): AckedAuthoritativeLocalPlayerPose | null {
    const freshAckedLocalPlayerSnapshot = this.#readFreshAckedLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    if (freshAckedLocalPlayerSnapshot === null) {
      return null;
    }

    return readAckedAuthoritativeLocalPlayerPose(
      this.#composeAuthoritativeLocalPlayerSnapshot(
        freshAckedLocalPlayerSnapshot
      )
    );
  }

  readFreshAckedAuthoritativeLocalPlayerSample(
    maxAuthoritativeSnapshotAgeMs: number
  ): ConsumedAckedAuthoritativeLocalPlayerSample | null {
    const freshAckedLocalPlayerSnapshot = this.#readFreshAckedLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    if (freshAckedLocalPlayerSnapshot === null) {
      return null;
    }

    return this.#createConsumedAckedAuthoritativeLocalPlayerSample(
      freshAckedLocalPlayerSnapshot
    );
  }

  consumeFreshAckedAuthoritativeLocalPlayerSample(
    maxAuthoritativeSnapshotAgeMs: number
  ): ConsumedAckedAuthoritativeLocalPlayerSample | null {
    const freshAckedLocalPlayerSnapshot = this.#readFreshAckedLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );
    const poseDeliveryKey =
      freshAckedLocalPlayerSnapshot === null
        ? null
        : createAckedAuthoritativeLocalPlayerDeliveryKey(
            {
              latestWorldSnapshot: freshAckedLocalPlayerSnapshot.latestWorldSnapshot,
              playerSnapshot: {
                lastProcessedInputSequence:
                  freshAckedLocalPlayerSnapshot.observerPlayerSnapshot
                    .lastProcessedInputSequence,
                lastProcessedTraversalSampleId:
                  freshAckedLocalPlayerSnapshot.observerPlayerSnapshot
                    .lastProcessedTraversalSampleId,
                lastProcessedTraversalOrientationSequence:
                  freshAckedLocalPlayerSnapshot.observerPlayerSnapshot
                    .lastProcessedTraversalOrientationSequence
              }
            }
          );

    if (
      freshAckedLocalPlayerSnapshot === null ||
      poseDeliveryKey === this.#lastConsumedAckedLocalPlayerPoseDeliveryKey
    ) {
      return null;
    }

    this.#lastConsumedAckedLocalPlayerPoseDeliveryKey = poseDeliveryKey;

    return this.#createConsumedAckedAuthoritativeLocalPlayerSample(
      freshAckedLocalPlayerSnapshot
    );
  }

  consumeFreshAckedAuthoritativeLocalPlayerPose(
    maxAuthoritativeSnapshotAgeMs: number
  ): AckedAuthoritativeLocalPlayerPose | null {
    return (
      this.consumeFreshAckedAuthoritativeLocalPlayerSample(
        maxAuthoritativeSnapshotAgeMs
      )?.pose ?? null
    );
  }

  readFreshAuthoritativeVehicleSnapshot(
    environmentAssetId: string,
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeVehicleSnapshot | null {
    const latestWorldSnapshot = this.#readFreshLatestWorldSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    if (latestWorldSnapshot === null) {
      return null;
    }

    this.#syncLatestWorldSnapshotIndexes(latestWorldSnapshot);

    return (
      this.#latestVehicleSnapshotsByEnvironmentAssetId.get(environmentAssetId) ??
      null
    );
  }

  readFreshAuthoritativeEnvironmentBodySnapshots(
    maxAuthoritativeSnapshotAgeMs: number
  ): readonly MetaverseRealtimeEnvironmentBodySnapshot[] {
    const latestWorldSnapshot = this.#readFreshLatestWorldSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    return (
      latestWorldSnapshot?.environmentBodies ??
      emptyRealtimeEnvironmentBodySnapshots
    );
  }

  readFreshAuthoritativeRemotePlayerSnapshots(
    maxAuthoritativeSnapshotAgeMs: number
  ): readonly MetaverseRealtimePlayerSnapshot[] {
    const latestWorldSnapshot = this.#readFreshLatestWorldSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    if (latestWorldSnapshot === null) {
      return emptyRealtimePlayerSnapshots;
    }

    this.#syncLatestWorldSnapshotIndexes(latestWorldSnapshot);

    return this.#latestAuthoritativeRemotePlayerSnapshots;
  }

  #readFreshLatestWorldSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeWorldSnapshot | null {
    const worldSnapshotBuffer = this.#readWorldSnapshotBuffer();

    if (worldSnapshotBuffer.length <= 0) {
      return null;
    }

    const localWallClockMs = this.#readWallClockMs();
    const latestWorldSnapshot =
      worldSnapshotBuffer[worldSnapshotBuffer.length - 1] ?? null;

    if (latestWorldSnapshot === null) {
      return null;
    }

    this.#authoritativeServerClock.observeServerTime(
      Number(latestWorldSnapshot.tick.emittedAtServerTimeMs),
      localWallClockMs
    );
    return resolveMetaverseRemoteWorldFreshLatestSnapshot(
      worldSnapshotBuffer,
      this.#authoritativeServerClock.readEstimatedServerTimeMs(localWallClockMs),
      maxAuthoritativeSnapshotAgeMs
    );
  }

  #readFreshLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): FreshLocalPlayerSnapshot | null {
    const latestWorldSnapshot = this.#readFreshLatestWorldSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );
    const localPlayerId = this.#readLocalPlayerId();

    if (latestWorldSnapshot === null || localPlayerId === null) {
      return null;
    }

    const observerPlayerSnapshot = latestWorldSnapshot.observerPlayer;

    if (
      observerPlayerSnapshot === null ||
      observerPlayerSnapshot.playerId !== localPlayerId
    ) {
      return null;
    }

    this.#syncLatestWorldSnapshotIndexes(latestWorldSnapshot);
    const playerSnapshot =
      this.#latestPlayerSnapshotsByPlayerId.get(localPlayerId) ??
      readMetaverseWorldPlayerSnapshotByPlayerId(
        latestWorldSnapshot,
        localPlayerId
      );

    if (playerSnapshot === null) {
      return null;
    }

    return {
      latestWorldSnapshot,
      observerPlayerSnapshot,
      playerSnapshot
    };
  }

  #readFreshAckedLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): FreshLocalPlayerSnapshot | null {
    const freshLocalPlayerSnapshot = this.#readFreshLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );
    const latestPlayerInputSequence = this.#readLatestPlayerInputSequence();
    const latestPlayerTraversalOrientationSequence =
      this.#readLatestPlayerTraversalOrientationSequence();
    const latestPlayerWeaponSequence = this.#readLatestPlayerWeaponSequence();

    if (
      freshLocalPlayerSnapshot === null ||
      freshLocalPlayerSnapshot.observerPlayerSnapshot.lastProcessedInputSequence <
        latestPlayerInputSequence ||
      freshLocalPlayerSnapshot.observerPlayerSnapshot
        .lastProcessedTraversalOrientationSequence <
        latestPlayerTraversalOrientationSequence ||
      freshLocalPlayerSnapshot.observerPlayerSnapshot.lastProcessedWeaponSequence <
        latestPlayerWeaponSequence
    ) {
      return null;
    }

    return freshLocalPlayerSnapshot;
  }

  #createConsumedAckedAuthoritativeLocalPlayerSample({
    latestWorldSnapshot,
    observerPlayerSnapshot,
    playerSnapshot
  }: FreshLocalPlayerSnapshot): ConsumedAckedAuthoritativeLocalPlayerSample {
    const receivedAtWallClockMs = this.#readWallClockMs();
    const estimatedServerTimeMs =
      this.#authoritativeServerClock.readEstimatedServerTimeMs(
        receivedAtWallClockMs
      );
    const authoritativeSnapshotAgeMs = Math.max(
      0,
      estimatedServerTimeMs - Number(latestWorldSnapshot.tick.simulationTimeMs)
    );

    return Object.freeze({
      authoritativeSnapshotAgeMs,
      authoritativeTick: latestWorldSnapshot.tick.currentTick,
      lastProcessedInputSequence:
        observerPlayerSnapshot.lastProcessedInputSequence,
      lastProcessedTraversalSampleId:
        observerPlayerSnapshot.lastProcessedTraversalSampleId,
      lastProcessedTraversalOrientationSequence:
        observerPlayerSnapshot.lastProcessedTraversalOrientationSequence,
      pose: readAckedAuthoritativeLocalPlayerPose(
        this.#composeAuthoritativeLocalPlayerSnapshot({
          latestWorldSnapshot,
          observerPlayerSnapshot,
          playerSnapshot
        })
      ),
      receivedAtWallClockMs,
      snapshotSequence: latestWorldSnapshot.snapshotSequence
    });
  }

  #composeAuthoritativeLocalPlayerSnapshot({
    observerPlayerSnapshot,
    playerSnapshot
  }: FreshLocalPlayerSnapshot): MetaverseRealtimeAuthoritativeLocalPlayerSnapshot {
    return Object.freeze({
      ...playerSnapshot,
      jumpDebug: observerPlayerSnapshot.jumpDebug,
      lastProcessedInputSequence:
        observerPlayerSnapshot.lastProcessedInputSequence,
      lastProcessedLookSequence:
        observerPlayerSnapshot.lastProcessedLookSequence,
      lastProcessedTraversalSampleId:
        observerPlayerSnapshot.lastProcessedTraversalSampleId,
      lastProcessedTraversalOrientationSequence:
        observerPlayerSnapshot.lastProcessedTraversalOrientationSequence,
      lastProcessedWeaponSequence:
        observerPlayerSnapshot.lastProcessedWeaponSequence
    });
  }

  #syncLatestWorldSnapshotIndexes(
    latestWorldSnapshot: MetaverseRealtimeWorldSnapshot
  ): void {
    const localPlayerId = this.#readLocalPlayerId();

    if (
      this.#latestIndexedWorldSnapshot === latestWorldSnapshot &&
      this.#latestIndexedLocalPlayerId === localPlayerId
    ) {
      return;
    }

    this.#latestIndexedWorldSnapshot = latestWorldSnapshot;
    this.#latestIndexedLocalPlayerId = localPlayerId;
    this.#latestAuthoritativeRemotePlayerSnapshots.length = 0;
    this.#latestPlayerSnapshotsByPlayerId.clear();
    this.#latestVehicleSnapshotsByEnvironmentAssetId.clear();

    for (const playerSnapshot of latestWorldSnapshot.players) {
      this.#latestPlayerSnapshotsByPlayerId.set(
        playerSnapshot.playerId,
        playerSnapshot
      );

      if (playerSnapshot.playerId !== localPlayerId) {
        this.#latestAuthoritativeRemotePlayerSnapshots.push(playerSnapshot);
      }
    }

    for (const vehicleSnapshot of latestWorldSnapshot.vehicles) {
      this.#latestVehicleSnapshotsByEnvironmentAssetId.set(
        vehicleSnapshot.environmentAssetId,
        vehicleSnapshot
      );
    }
  }
}
