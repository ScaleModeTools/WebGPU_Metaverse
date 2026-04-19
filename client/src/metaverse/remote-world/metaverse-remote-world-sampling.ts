import type {
  MetaverseRealtimeEnvironmentBodySnapshot,
  MetaversePlayerId,
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeVehicleSnapshot,
  MetaverseRealtimeWorldSnapshot,
  MetaverseVehicleId
} from "@webgpu-metaverse/shared";

export interface MetaverseRemoteWorldSampledFrame {
  readonly alpha: number;
  readonly baseSnapshot: MetaverseRealtimeWorldSnapshot;
  readonly extrapolationSeconds: number;
  readonly nextSnapshot: MetaverseRealtimeWorldSnapshot | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function readMetaverseWorldPlayerSnapshotByPlayerId(
  worldSnapshot: MetaverseRealtimeWorldSnapshot,
  playerId: MetaversePlayerId
): MetaverseRealtimePlayerSnapshot | null {
  for (const playerSnapshot of worldSnapshot.players) {
    if (playerSnapshot.playerId === playerId) {
      return playerSnapshot;
    }
  }

  return null;
}

export function resolveMetaverseRemoteWorldSampledFrame(
  worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[],
  targetServerTimeMs: number,
  maxExtrapolationMs: number
): MetaverseRemoteWorldSampledFrame | null {
  const firstSnapshot = worldSnapshotBuffer[0] ?? null;

  if (firstSnapshot === null) {
    return null;
  }

  if (worldSnapshotBuffer.length === 1) {
    const firstSnapshotTimeMs = Number(firstSnapshot.tick.simulationTimeMs);
    const extrapolationMs = clamp(
      targetServerTimeMs - firstSnapshotTimeMs,
      0,
      maxExtrapolationMs
    );

    return Object.freeze({
      alpha: 0,
      baseSnapshot: firstSnapshot,
      extrapolationSeconds: extrapolationMs / 1000,
      nextSnapshot: null
    });
  }

  const firstSnapshotTimeMs = Number(firstSnapshot.tick.simulationTimeMs);

  if (targetServerTimeMs <= firstSnapshotTimeMs) {
    return Object.freeze({
      alpha: 0,
      baseSnapshot: firstSnapshot,
      extrapolationSeconds: 0,
      nextSnapshot: null
    });
  }

  for (let index = 0; index < worldSnapshotBuffer.length - 1; index += 1) {
    const baseSnapshot = worldSnapshotBuffer[index]!;
    const nextSnapshot = worldSnapshotBuffer[index + 1]!;
    const baseTimeMs = Number(baseSnapshot.tick.simulationTimeMs);
    const nextTimeMs = Number(nextSnapshot.tick.simulationTimeMs);

    if (targetServerTimeMs > nextTimeMs) {
      continue;
    }

    const snapshotDurationMs = Math.max(1, nextTimeMs - baseTimeMs);
    const alpha = clamp(
      (targetServerTimeMs - baseTimeMs) / snapshotDurationMs,
      0,
      1
    );

    return Object.freeze({
      alpha,
      baseSnapshot,
      extrapolationSeconds: 0,
      nextSnapshot
    });
  }

  const latestSnapshot =
    worldSnapshotBuffer[worldSnapshotBuffer.length - 1] ?? firstSnapshot;
  const latestTimeMs = Number(latestSnapshot.tick.simulationTimeMs);
  const extrapolationMs = clamp(
    targetServerTimeMs - latestTimeMs,
    0,
    maxExtrapolationMs
  );

  return Object.freeze({
    alpha: 0,
    baseSnapshot: latestSnapshot,
    extrapolationSeconds: extrapolationMs / 1000,
    nextSnapshot: null
  });
}

export function resolveMetaverseRemoteWorldFreshLatestSnapshot(
  worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[],
  estimatedServerTimeMs: number,
  maxAuthoritativeSnapshotAgeMs: number
): MetaverseRealtimeWorldSnapshot | null {
  const latestWorldSnapshot =
    worldSnapshotBuffer[worldSnapshotBuffer.length - 1] ?? null;

  if (latestWorldSnapshot === null) {
    return null;
  }

  const authoritativeSnapshotAgeMs = Math.max(
    0,
    estimatedServerTimeMs - Number(latestWorldSnapshot.tick.simulationTimeMs)
  );

  return authoritativeSnapshotAgeMs >
    Math.max(0, maxAuthoritativeSnapshotAgeMs)
    ? null
    : latestWorldSnapshot;
}

export function indexMetaverseWorldPlayersByPlayerId(
  players: readonly MetaverseRealtimePlayerSnapshot[],
  playerSnapshotsByPlayerId: Map<MetaversePlayerId, MetaverseRealtimePlayerSnapshot>
): void {
  playerSnapshotsByPlayerId.clear();

  for (const playerSnapshot of players) {
    playerSnapshotsByPlayerId.set(playerSnapshot.playerId, playerSnapshot);
  }
}

export function indexMetaverseWorldVehiclesByVehicleId(
  vehicles: readonly MetaverseRealtimeVehicleSnapshot[],
  vehicleSnapshotsByVehicleId: Map<MetaverseVehicleId, MetaverseRealtimeVehicleSnapshot>
): void {
  vehicleSnapshotsByVehicleId.clear();

  for (const vehicleSnapshot of vehicles) {
    vehicleSnapshotsByVehicleId.set(vehicleSnapshot.vehicleId, vehicleSnapshot);
  }
}

export function indexMetaverseWorldEnvironmentBodiesByEnvironmentAssetId(
  environmentBodies: readonly MetaverseRealtimeEnvironmentBodySnapshot[],
  environmentBodySnapshotsByEnvironmentAssetId: Map<
    string,
    MetaverseRealtimeEnvironmentBodySnapshot
  >
): void {
  environmentBodySnapshotsByEnvironmentAssetId.clear();

  for (const environmentBodySnapshot of environmentBodies) {
    environmentBodySnapshotsByEnvironmentAssetId.set(
      environmentBodySnapshot.environmentAssetId,
      environmentBodySnapshot
    );
  }
}
