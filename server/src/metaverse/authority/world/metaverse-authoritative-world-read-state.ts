import type {
  MetaversePlayerId,
  MetaversePresenceRosterEvent,
  MetaversePresenceRosterSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaverseRealtimeWorldSnapshot,
  MetaverseVehicleId
} from "@webgpu-metaverse/shared/metaverse/realtime";

import {
  createMetaverseAuthoritativePresenceRosterEvent,
  createMetaverseAuthoritativePresenceRosterSnapshot,
  createMetaverseAuthoritativeWorldEvent,
  createMetaverseAuthoritativeWorldSnapshot,
  type MetaverseAuthoritativeSnapshotPlayerRuntimeState,
  type MetaverseAuthoritativeSnapshotEnvironmentBodyRuntimeState,
  type MetaverseAuthoritativeSnapshotPlayerTraversalIntentRuntimeState,
  type MetaverseAuthoritativeSnapshotVehicleRuntimeState
} from "../snapshots/metaverse-authoritative-world-snapshot-assembly.js";

function normalizeNowMs(nowMs: number): number {
  if (!Number.isFinite(nowMs)) {
    return 0;
  }

  return Math.max(0, nowMs);
}

interface MetaverseAuthoritativeWorldReadPlayerRuntimeState
  extends MetaverseAuthoritativeSnapshotPlayerRuntimeState {
  lastSeenAtMs: number;
}

interface MetaverseAuthoritativeWorldReadStateDependencies<
  PlayerRuntime extends MetaverseAuthoritativeWorldReadPlayerRuntimeState,
  EnvironmentBodyRuntime extends MetaverseAuthoritativeSnapshotEnvironmentBodyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeSnapshotVehicleRuntimeState
> {
  readonly environmentBodiesByEnvironmentAssetId: ReadonlyMap<
    string,
    EnvironmentBodyRuntime
  >;
  readonly playersById: Map<MetaversePlayerId, PlayerRuntime>;
  readonly readCurrentTick: () => number;
  readonly readLastAdvancedAtMs: () => number | null;
  readonly readSnapshotSequence: () => number;
  readonly readTickIntervalMs: () => number;
  readonly traversalIntentsByPlayerId: ReadonlyMap<
    MetaversePlayerId,
    MetaverseAuthoritativeSnapshotPlayerTraversalIntentRuntimeState
  >;
  readonly vehiclesById: ReadonlyMap<MetaverseVehicleId, VehicleRuntime>;
}

export class MetaverseAuthoritativeWorldReadState<
  PlayerRuntime extends MetaverseAuthoritativeWorldReadPlayerRuntimeState,
  EnvironmentBodyRuntime extends MetaverseAuthoritativeSnapshotEnvironmentBodyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeSnapshotVehicleRuntimeState
> {
  readonly #dependencies: MetaverseAuthoritativeWorldReadStateDependencies<
    PlayerRuntime,
    EnvironmentBodyRuntime,
    VehicleRuntime
  >;

  constructor(
    dependencies: MetaverseAuthoritativeWorldReadStateDependencies<
      PlayerRuntime,
      EnvironmentBodyRuntime,
      VehicleRuntime
    >
  ) {
    this.#dependencies = dependencies;
  }

  readPresenceRosterSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterSnapshot {
    const worldSnapshot = this.readWorldSnapshot(nowMs, observerPlayerId);

    return createMetaverseAuthoritativePresenceRosterSnapshot(
      worldSnapshot,
      this.#dependencies.playersById
    );
  }

  readPresenceRosterEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterEvent {
    return createMetaverseAuthoritativePresenceRosterEvent(
      this.readPresenceRosterSnapshot(nowMs, observerPlayerId)
    );
  }

  readWorldSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldSnapshot {
    const normalizedNowMs = normalizeNowMs(nowMs);

    if (
      observerPlayerId !== undefined &&
      !this.#dependencies.playersById.has(observerPlayerId)
    ) {
      throw new Error(`Unknown metaverse player: ${observerPlayerId}`);
    }

    if (observerPlayerId !== undefined) {
      this.#recordObserverHeartbeat(observerPlayerId, normalizedNowMs);
    }

    return createMetaverseAuthoritativeWorldSnapshot({
      currentTick: this.#dependencies.readCurrentTick(),
      environmentBodies:
        this.#dependencies.environmentBodiesByEnvironmentAssetId.values(),
      lastAdvancedAtMs: this.#dependencies.readLastAdvancedAtMs(),
      nowMs: normalizedNowMs,
      ...(observerPlayerId === undefined ? {} : { observerPlayerId }),
      players: this.#dependencies.playersById.values(),
      snapshotSequence: this.#dependencies.readSnapshotSequence(),
      tickIntervalMs: this.#dependencies.readTickIntervalMs(),
      traversalIntentsByPlayerId: this.#dependencies.traversalIntentsByPlayerId,
      vehicles: this.#dependencies.vehiclesById.values()
    });
  }

  readWorldEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ) {
    return createMetaverseAuthoritativeWorldEvent(
      this.readWorldSnapshot(nowMs, observerPlayerId)
    );
  }

  #recordObserverHeartbeat(
    observerPlayerId: MetaversePlayerId,
    nowMs: number
  ): void {
    const observerRuntime = this.#dependencies.playersById.get(observerPlayerId);

    if (observerRuntime === undefined) {
      return;
    }

    observerRuntime.lastSeenAtMs = nowMs;
  }
}
