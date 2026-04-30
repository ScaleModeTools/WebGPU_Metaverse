import type {
  MetaversePlayerId,
  MetaversePlayerActionReceiptSnapshot,
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
  readonly readLatestAcceptedSnapshotReceivedAtMs?: () => number | null;
  readonly readLatestPlayerTraversalSequence: () => number;
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

function resolveTraversalMovementSequence(input: {
  readonly lastProcessedTraversalSequence: number;
}): number {
  return input.lastProcessedTraversalSequence;
}

export type MetaverseRealtimeAuthoritativeLocalPlayerSnapshot =
  MetaverseRealtimePlayerSnapshot & {
    readonly highestProcessedPlayerActionSequence: number;
    readonly lastProcessedLookSequence: number;
    readonly lastProcessedTraversalSequence: number;
    readonly lastProcessedWeaponSequence: number;
    readonly recentPlayerActionReceipts:
      readonly MetaversePlayerActionReceiptSnapshot[];
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
  readonly #readLatestAcceptedSnapshotReceivedAtMs: () => number | null;
  readonly #readLatestPlayerTraversalSequence: () => number;
  readonly #readLocalPlayerId: () => MetaversePlayerId | null;
  readonly #readWallClockMs: () => number;
  readonly #readWorldSnapshotBuffer: () => readonly MetaverseRealtimeWorldSnapshot[];

  #lastConsumedAckedLocalPlayerPoseDeliveryKey: string | null = null;
  #latestIndexedWorldSnapshot: MetaverseRealtimeWorldSnapshot | null = null;
  #latestIndexedLocalPlayerId: MetaversePlayerId | null = null;

  constructor({
    authoritativeServerClock,
    readLatestAcceptedSnapshotReceivedAtMs,
    readLatestPlayerTraversalSequence,
    readLocalPlayerId,
    readWallClockMs,
    readWorldSnapshotBuffer
  }: MetaverseRemoteWorldAuthoritativeSnapshotStateDependencies) {
    this.#authoritativeServerClock = authoritativeServerClock;
    this.#readLatestAcceptedSnapshotReceivedAtMs =
      readLatestAcceptedSnapshotReceivedAtMs ?? (() => null);
    this.#readLatestPlayerTraversalSequence = readLatestPlayerTraversalSequence;
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
                lastProcessedTraversalSequence:
                  freshAckedLocalPlayerSnapshot.observerPlayerSnapshot
                    .lastProcessedTraversalSequence
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

  readFreshAuthoritativeWorldSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeWorldSnapshot | null {
    return this.#readFreshLatestWorldSnapshot(maxAuthoritativeSnapshotAgeMs);
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
    return resolveMetaverseRemoteWorldFreshLatestSnapshot(
      worldSnapshotBuffer,
      this.#resolveAuthoritativeSimulationTimeMs(
        latestWorldSnapshot,
        localWallClockMs
      ),
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
    const latestPlayerTraversalSequence = resolveTraversalMovementSequence({
      lastProcessedTraversalSequence:
        this.#readLatestPlayerTraversalSequence()
    });
    const authoritativeTraversalSequence =
      freshLocalPlayerSnapshot === null
        ? 0
        : resolveTraversalMovementSequence({
            lastProcessedTraversalSequence:
              freshLocalPlayerSnapshot.observerPlayerSnapshot
                .lastProcessedTraversalSequence
          });

    if (
      freshLocalPlayerSnapshot === null ||
      authoritativeTraversalSequence < latestPlayerTraversalSequence
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
    const authoritativeSnapshotAgeMs = this.#resolveAuthoritativeSnapshotAgeMs(
      latestWorldSnapshot,
      receivedAtWallClockMs
    );

    return Object.freeze({
      authoritativeSnapshotAgeMs,
      authoritativeTick: latestWorldSnapshot.tick.currentTick,
      lastProcessedTraversalSequence:
        observerPlayerSnapshot.lastProcessedTraversalSequence,
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

  #resolveAuthoritativeSimulationTimeMs(
    latestWorldSnapshot: MetaverseRealtimeWorldSnapshot,
    localWallClockMs: number
  ): number {
    const latestAcceptedSnapshotReceivedAtMs =
      this.#readLatestAcceptedSnapshotReceivedAtMs();

    if (
      Number.isFinite(localWallClockMs) &&
      latestAcceptedSnapshotReceivedAtMs !== null &&
      Number.isFinite(latestAcceptedSnapshotReceivedAtMs)
    ) {
      return Math.max(
        0,
        Number(latestWorldSnapshot.tick.simulationTimeMs) +
          Math.max(0, localWallClockMs - latestAcceptedSnapshotReceivedAtMs)
      );
    }

    this.#authoritativeServerClock.observeServerTime(
      Number(latestWorldSnapshot.tick.emittedAtServerTimeMs),
      localWallClockMs
    );

    return this.#authoritativeServerClock.readEstimatedServerTimeMs(
      localWallClockMs
    );
  }

  #resolveAuthoritativeSnapshotAgeMs(
    latestWorldSnapshot: MetaverseRealtimeWorldSnapshot,
    localWallClockMs: number
  ): number {
    const latestAcceptedSnapshotReceivedAtMs =
      this.#readLatestAcceptedSnapshotReceivedAtMs();

    if (
      Number.isFinite(localWallClockMs) &&
      latestAcceptedSnapshotReceivedAtMs !== null &&
      Number.isFinite(latestAcceptedSnapshotReceivedAtMs)
    ) {
      return Math.max(0, localWallClockMs - latestAcceptedSnapshotReceivedAtMs);
    }

    return Math.max(
      0,
      this.#resolveAuthoritativeSimulationTimeMs(
        latestWorldSnapshot,
        localWallClockMs
      ) - Number(latestWorldSnapshot.tick.simulationTimeMs)
    );
  }

  #composeAuthoritativeLocalPlayerSnapshot({
    observerPlayerSnapshot,
    playerSnapshot
  }: FreshLocalPlayerSnapshot): MetaverseRealtimeAuthoritativeLocalPlayerSnapshot {
    return Object.freeze({
      highestProcessedPlayerActionSequence:
        observerPlayerSnapshot.highestProcessedPlayerActionSequence,
      ...playerSnapshot,
      lastProcessedLookSequence:
        observerPlayerSnapshot.lastProcessedLookSequence,
      lastProcessedTraversalSequence:
        observerPlayerSnapshot.lastProcessedTraversalSequence,
      lastProcessedWeaponSequence:
        observerPlayerSnapshot.lastProcessedWeaponSequence,
      recentPlayerActionReceipts:
        observerPlayerSnapshot.recentPlayerActionReceipts
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
