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
  type AckedAuthoritativeLocalPlayerPose
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
  readonly readLocalPlayerId: () => MetaversePlayerId | null;
  readonly readWallClockMs?: () => number;
  readonly readWorldSnapshotBuffer: () => readonly MetaverseRealtimeWorldSnapshot[];
}

interface FreshLocalPlayerSnapshot {
  readonly latestWorldSnapshot: MetaverseRealtimeWorldSnapshot;
  readonly playerSnapshot: MetaverseRealtimePlayerSnapshot;
}

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
    readLocalPlayerId,
    readWallClockMs,
    readWorldSnapshotBuffer
  }: MetaverseRemoteWorldAuthoritativeSnapshotStateDependencies) {
    this.#authoritativeServerClock = authoritativeServerClock;
    this.#readLatestPlayerInputSequence = readLatestPlayerInputSequence;
    this.#readLatestPlayerTraversalOrientationSequence =
      readLatestPlayerTraversalOrientationSequence;
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
  ): MetaverseRealtimePlayerSnapshot | null {
    return this.#readFreshLocalPlayerSnapshot(maxAuthoritativeSnapshotAgeMs)
      ?.playerSnapshot ?? null;
  }

  readFreshAckedAuthoritativeLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimePlayerSnapshot | null {
    return this.#readFreshAckedLocalPlayerSnapshot(maxAuthoritativeSnapshotAgeMs)
      ?.playerSnapshot ?? null;
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
      freshAckedLocalPlayerSnapshot.playerSnapshot
    );
  }

  consumeFreshAckedAuthoritativeLocalPlayerPose(
    maxAuthoritativeSnapshotAgeMs: number
  ): AckedAuthoritativeLocalPlayerPose | null {
    const freshAckedLocalPlayerSnapshot = this.#readFreshAckedLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );
    const poseDeliveryKey =
      freshAckedLocalPlayerSnapshot === null
        ? null
        : createAckedAuthoritativeLocalPlayerDeliveryKey(
            freshAckedLocalPlayerSnapshot
          );

    if (
      freshAckedLocalPlayerSnapshot === null ||
      poseDeliveryKey === this.#lastConsumedAckedLocalPlayerPoseDeliveryKey
    ) {
      return null;
    }

    this.#lastConsumedAckedLocalPlayerPoseDeliveryKey = poseDeliveryKey;

    return readAckedAuthoritativeLocalPlayerPose(
      freshAckedLocalPlayerSnapshot.playerSnapshot
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

    if (
      freshLocalPlayerSnapshot === null ||
      freshLocalPlayerSnapshot.playerSnapshot.lastProcessedInputSequence <
        latestPlayerInputSequence ||
      freshLocalPlayerSnapshot.playerSnapshot
        .lastProcessedTraversalOrientationSequence <
        latestPlayerTraversalOrientationSequence
    ) {
      return null;
    }

    return freshLocalPlayerSnapshot;
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
