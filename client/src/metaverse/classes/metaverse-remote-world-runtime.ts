import type {
  MetaversePlayerId,
  MetaversePlayerTraversalIntentSnapshot,
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeVehicleSnapshot,
  MetaverseRealtimeWorldSnapshot,
  MetaverseSyncDriverVehicleControlCommandInput,
  MetaverseSyncPlayerLookIntentCommandInput,
  MetaverseSyncMountedOccupancyCommandInput,
  MetaverseSyncPlayerTraversalIntentCommandInput,
  MetaverseVehicleId
} from "@webgpu-metaverse/shared";
import { createRadians } from "@webgpu-metaverse/shared";

import type {
  AuthoritativeServerClockConfig,
  MetaverseWorldClientTelemetrySnapshot,
  MetaverseWorldSnapshotStreamTelemetrySnapshot,
  MetaverseWorldClientStatusSnapshot,
  RealtimeDatagramTransportStatusSnapshot,
  RealtimeReliableTransportStatusSnapshot
} from "@/network";
import {
  AuthoritativeServerClock,
  createDisabledRealtimeDatagramTransportStatusSnapshot,
  createDisabledRealtimeReliableTransportStatusSnapshot
} from "@/network";
import type {
  MetaverseCameraSnapshot,
  MetaverseFlightInputSnapshot,
  MetaverseHudSnapshot,
  MountedEnvironmentSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseRemoteVehiclePresentationSnapshot
} from "../types/metaverse-runtime";
import type { MetaverseLocalPlayerIdentity } from "./metaverse-presence-runtime";
import type { RoutedDriverVehicleControlIntentSnapshot } from "../traversal/types/traversal";

interface MutableVector3Snapshot {
  x: number;
  y: number;
  z: number;
}

interface MutableRemoteCharacterPresentationSnapshot {
  characterId: string;
  look: {
    pitchRadians: number;
    yawRadians: number;
  };
  mountedOccupancy: MetaverseRemoteCharacterPresentationSnapshot["mountedOccupancy"];
  playerId: string;
  poseSyncMode: "runtime-server-sampled";
  presentation: {
    animationVocabulary:
      MetaverseRemoteCharacterPresentationSnapshot["presentation"]["animationVocabulary"];
    position: MutableVector3Snapshot;
    yawRadians: number;
  };
  sampleEpoch: number;
}

interface MutableRemoteVehiclePresentationSnapshot {
  environmentAssetId: string;
  position: MutableVector3Snapshot;
  sampleEpoch: number;
  yawRadians: number;
}

export interface MetaverseWorldClientRuntime {
  readonly currentPollIntervalMs: number;
  readonly driverVehicleControlDatagramStatusSnapshot: RealtimeDatagramTransportStatusSnapshot;
  readonly latestPlayerInputSequence: number;
  readonly latestPlayerTraversalIntentSnapshot:
    | MetaversePlayerTraversalIntentSnapshot
    | null;
  readonly reliableTransportStatusSnapshot: RealtimeReliableTransportStatusSnapshot;
  readonly statusSnapshot: MetaverseWorldClientStatusSnapshot;
  readonly telemetrySnapshot: MetaverseWorldClientTelemetrySnapshot;
  readonly worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[];
  ensureConnected(
    playerId: MetaversePlayerId
  ): Promise<MetaverseRealtimeWorldSnapshot>;
  syncDriverVehicleControl(
    commandInput: MetaverseSyncDriverVehicleControlCommandInput | null
  ): void;
  syncMountedOccupancy(
    commandInput: MetaverseSyncMountedOccupancyCommandInput
  ): void;
  syncPlayerLookIntent(
    commandInput: MetaverseSyncPlayerLookIntentCommandInput | null
  ): void;
  syncPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): void;
  subscribeUpdates(listener: () => void): () => void;
  dispose(): void;
}

export interface MetaverseRemoteWorldSamplingConfig
  extends AuthoritativeServerClockConfig {
  readonly interpolationDelayMs: number;
  readonly maxExtrapolationMs: number;
}

interface MetaverseRemoteWorldRuntimeDependencies {
  readonly createMetaverseWorldClient:
    | (() => MetaverseWorldClientRuntime)
    | null;
  readonly localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly onRemoteWorldUpdate: () => void;
  readonly readWallClockMs?: () => number;
  readonly samplingConfig: MetaverseRemoteWorldSamplingConfig;
}

interface MetaverseRemoteWorldSamplingTelemetrySnapshot {
  readonly bufferDepth: number;
  readonly clockOffsetEstimateMs: number | null;
  readonly currentExtrapolationMs: number;
  readonly datagramSendFailureCount: number;
  readonly extrapolatedFramePercent: number;
  readonly latestSimulationAgeMs: number | null;
  readonly latestSnapshotUpdateRateHz: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function wrapRadians(rawValue: number): number {
  let normalizedValue = rawValue;

  while (normalizedValue > Math.PI) {
    normalizedValue -= Math.PI * 2;
  }

  while (normalizedValue <= -Math.PI) {
    normalizedValue += Math.PI * 2;
  }

  return normalizedValue;
}

function lerpWrappedRadians(
  startRadians: number,
  endRadians: number,
  alpha: number
): number {
  return wrapRadians(
    startRadians + wrapRadians(endRadians - startRadians) * alpha
  );
}

function createMutableVector3(
  x: number = 0,
  y: number = 0,
  z: number = 0
): MutableVector3Snapshot {
  return {
    x,
    y,
    z
  };
}

function writeMutableVector3(
  target: MutableVector3Snapshot,
  x: number,
  y: number,
  z: number
): MutableVector3Snapshot {
  target.x = x;
  target.y = y;
  target.z = z;

  return target;
}

const remoteVehiclePresentationInterpolationRatePerSecond = 16;
const remoteVehiclePresentationTeleportSnapDistanceMeters = 3.5;
const remoteVehiclePresentationYawSnapRadians = 0.75;

function resolveRemoteVehiclePresentationInterpolationAlpha(
  deltaSeconds: number
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return 0;
  }

  return (
    1 - Math.exp(-remoteVehiclePresentationInterpolationRatePerSecond * deltaSeconds)
  );
}

function sampleRemotePlayerPositionInto(
  target: MutableVector3Snapshot,
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
): MutableVector3Snapshot {
  if (nextPlayer !== null) {
    return writeMutableVector3(
      target,
      lerp(basePlayer.position.x, nextPlayer.position.x, alpha),
      lerp(basePlayer.position.y, nextPlayer.position.y, alpha),
      lerp(basePlayer.position.z, nextPlayer.position.z, alpha)
    );
  }

  if (extrapolationSeconds <= 0) {
    return writeMutableVector3(
      target,
      basePlayer.position.x,
      basePlayer.position.y,
      basePlayer.position.z
    );
  }

  return writeMutableVector3(
    target,
    basePlayer.position.x + basePlayer.linearVelocity.x * extrapolationSeconds,
    basePlayer.position.y + basePlayer.linearVelocity.y * extrapolationSeconds,
    basePlayer.position.z + basePlayer.linearVelocity.z * extrapolationSeconds
  );
}

function sampleRemotePlayerYawRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
): number {
  if (nextPlayer === null) {
    if (extrapolationSeconds <= 0) {
      return basePlayer.yawRadians;
    }

    return wrapRadians(
      basePlayer.yawRadians +
        basePlayer.angularVelocityRadiansPerSecond * extrapolationSeconds
    );
  }

  return lerpWrappedRadians(basePlayer.yawRadians, nextPlayer.yawRadians, alpha);
}

function sampleRemotePlayerLookPitchRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): number {
  if (nextPlayer === null) {
    return basePlayer.look.pitchRadians;
  }

  return lerp(basePlayer.look.pitchRadians, nextPlayer.look.pitchRadians, alpha);
}

function sampleRemotePlayerLookYawRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): number {
  if (nextPlayer === null) {
    return basePlayer.look.yawRadians;
  }

  return lerpWrappedRadians(
    basePlayer.look.yawRadians,
    nextPlayer.look.yawRadians,
    alpha
  );
}

function readPlayerSnapshotByPlayerId(
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

function sampleRemoteVehiclePositionInto(
  target: MutableVector3Snapshot,
  baseVehicle: MetaverseRealtimeVehicleSnapshot,
  nextVehicle: MetaverseRealtimeVehicleSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
): MutableVector3Snapshot {
  if (nextVehicle !== null) {
    return writeMutableVector3(
      target,
      lerp(baseVehicle.position.x, nextVehicle.position.x, alpha),
      lerp(baseVehicle.position.y, nextVehicle.position.y, alpha),
      lerp(baseVehicle.position.z, nextVehicle.position.z, alpha)
    );
  }

  if (extrapolationSeconds <= 0) {
    return writeMutableVector3(
      target,
      baseVehicle.position.x,
      baseVehicle.position.y,
      baseVehicle.position.z
    );
  }

  return writeMutableVector3(
    target,
    baseVehicle.position.x + baseVehicle.linearVelocity.x * extrapolationSeconds,
    baseVehicle.position.y + baseVehicle.linearVelocity.y * extrapolationSeconds,
    baseVehicle.position.z + baseVehicle.linearVelocity.z * extrapolationSeconds
  );
}

function sampleRemoteVehicleYawRadians(
  baseVehicle: MetaverseRealtimeVehicleSnapshot,
  nextVehicle: MetaverseRealtimeVehicleSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
): number {
  if (nextVehicle !== null) {
    return lerpWrappedRadians(
      baseVehicle.yawRadians,
      nextVehicle.yawRadians,
      alpha
    );
  }

  if (extrapolationSeconds <= 0) {
    return baseVehicle.yawRadians;
  }

  return wrapRadians(
    baseVehicle.yawRadians +
      baseVehicle.angularVelocityRadiansPerSecond * extrapolationSeconds
  );
}

interface SampledWorldFrame {
  readonly alpha: number;
  readonly baseSnapshot: MetaverseRealtimeWorldSnapshot;
  readonly extrapolationSeconds: number;
  readonly nextSnapshot: MetaverseRealtimeWorldSnapshot | null;
}

function resolveSampledWorldFrame(
  worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[],
  targetServerTimeMs: number,
  maxExtrapolationMs: number
): SampledWorldFrame | null {
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

function indexPlayersByPlayerId(
  players: readonly MetaverseRealtimePlayerSnapshot[],
  playerSnapshotsByPlayerId: Map<MetaversePlayerId, MetaverseRealtimePlayerSnapshot>
): void {
  playerSnapshotsByPlayerId.clear();

  for (const playerSnapshot of players) {
    playerSnapshotsByPlayerId.set(playerSnapshot.playerId, playerSnapshot);
  }
}

function indexVehiclesByVehicleId(
  vehicles: readonly MetaverseRealtimeVehicleSnapshot[],
  vehicleSnapshotsByVehicleId: Map<MetaverseVehicleId, MetaverseRealtimeVehicleSnapshot>
): void {
  vehicleSnapshotsByVehicleId.clear();

  for (const vehicleSnapshot of vehicles) {
    vehicleSnapshotsByVehicleId.set(vehicleSnapshot.vehicleId, vehicleSnapshot);
  }
}

const emptyRealtimePlayerSnapshots: readonly MetaverseRealtimePlayerSnapshot[] =
  Object.freeze([]);
const emptyRealtimeVehicleSnapshots: readonly MetaverseRealtimeVehicleSnapshot[] =
  Object.freeze([]);
const disabledMetaverseWorldClientTelemetrySnapshot: MetaverseWorldClientTelemetrySnapshot =
  Object.freeze({
    driverVehicleControlDatagramSendFailureCount: 0,
    latestSnapshotUpdateRateHz: null,
    playerTraversalInputDatagramSendFailureCount: 0,
    snapshotStream: Object.freeze({
      available: false,
      fallbackActive: false,
      lastTransportError: null,
      liveness: "inactive",
      path: "http-polling",
      reconnectCount: 0
    })
  });

export class MetaverseRemoteWorldRuntime {
  readonly #createMetaverseWorldClient:
    | (() => MetaverseWorldClientRuntime)
    | null;
  readonly #localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly #onRemoteWorldUpdate: () => void;
  readonly #readWallClockMs: () => number;
  readonly #samplingConfig: MetaverseRemoteWorldSamplingConfig;
  readonly #authoritativeServerClock: AuthoritativeServerClock;
  readonly #nextPlayerSnapshotsByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseRealtimePlayerSnapshot
  >();
  readonly #nextVehicleSnapshotsByVehicleId = new Map<
    MetaverseVehicleId,
    MetaverseRealtimeVehicleSnapshot
  >();
  readonly #latestPlayerSnapshotsByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseRealtimePlayerSnapshot
  >();
  readonly #latestVehicleSnapshotsByEnvironmentAssetId = new Map<
    string,
    MetaverseRealtimeVehicleSnapshot
  >();
  readonly #remoteCharacterPresentationsByPlayerId = new Map<
    MetaversePlayerId,
    MutableRemoteCharacterPresentationSnapshot
  >();
  readonly #remoteVehiclePresentationsByEnvironmentAssetId = new Map<
    string,
    MutableRemoteVehiclePresentationSnapshot
  >();
  readonly #remoteCharacterPresentations: MutableRemoteCharacterPresentationSnapshot[] =
    [];
  readonly #remoteVehiclePresentations: MutableRemoteVehiclePresentationSnapshot[] =
    [];
  readonly #sampledVehiclePositionScratch = createMutableVector3();

  #connectionPromise: Promise<MetaverseRealtimeWorldSnapshot> | null = null;
  #extrapolatedFrameCount = 0;
  #lastSampledAtMs: number | null = null;
  #lastSampledExtrapolationMs = 0;
  #latestIndexedWorldSnapshot: MetaverseRealtimeWorldSnapshot | null = null;
  #sampleEpoch = 0;
  #sampledFrameCount = 0;
  #metaverseWorldClient: MetaverseWorldClientRuntime | null = null;
  #metaverseWorldUnsubscribe: (() => void) | null = null;

  constructor({
    createMetaverseWorldClient,
    localPlayerIdentity,
    onRemoteWorldUpdate,
    readWallClockMs,
    samplingConfig
  }: MetaverseRemoteWorldRuntimeDependencies) {
    this.#createMetaverseWorldClient = createMetaverseWorldClient;
    this.#localPlayerIdentity = localPlayerIdentity;
    this.#onRemoteWorldUpdate = onRemoteWorldUpdate;
    this.#readWallClockMs = readWallClockMs ?? Date.now;
    this.#samplingConfig = samplingConfig;
    this.#authoritativeServerClock = new AuthoritativeServerClock({
      clockOffsetCorrectionAlpha: samplingConfig.clockOffsetCorrectionAlpha,
      clockOffsetMaxStepMs: samplingConfig.clockOffsetMaxStepMs
    });
  }

  get hasWorldSnapshot(): boolean {
    return (this.#metaverseWorldClient?.worldSnapshotBuffer.length ?? 0) > 0;
  }

  get isConnected(): boolean {
    return this.#metaverseWorldClient?.statusSnapshot.connected ?? false;
  }

  get currentPollIntervalMs(): number | null {
    return this.#metaverseWorldClient?.currentPollIntervalMs ?? null;
  }

  get samplingTelemetrySnapshot(): MetaverseRemoteWorldSamplingTelemetrySnapshot {
    const worldClientTelemetrySnapshot = this.#readWorldClientTelemetrySnapshot();
    const latestSnapshot =
      this.#metaverseWorldClient?.worldSnapshotBuffer[
        (this.#metaverseWorldClient?.worldSnapshotBuffer.length ?? 0) - 1
      ] ?? null;
    const localWallClockMs = this.#readWallClockMs();

    if (latestSnapshot !== null) {
      this.#authoritativeServerClock.observeServerTime(
        Number(latestSnapshot.tick.emittedAtServerTimeMs),
        localWallClockMs
      );
    }

    const latestSimulationAgeMs =
      latestSnapshot === null
        ? null
        : Math.max(
            0,
            this.#authoritativeServerClock.readEstimatedServerTimeMs(
              localWallClockMs
            ) - Number(latestSnapshot.tick.simulationTimeMs)
          );

    return Object.freeze({
      bufferDepth: this.#metaverseWorldClient?.worldSnapshotBuffer.length ?? 0,
      clockOffsetEstimateMs: this.#authoritativeServerClock.clockOffsetEstimateMs,
      currentExtrapolationMs: this.#lastSampledExtrapolationMs,
      datagramSendFailureCount:
        worldClientTelemetrySnapshot.driverVehicleControlDatagramSendFailureCount +
        worldClientTelemetrySnapshot.playerTraversalInputDatagramSendFailureCount,
      extrapolatedFramePercent:
        this.#sampledFrameCount <= 0
          ? 0
          : (this.#extrapolatedFrameCount / this.#sampledFrameCount) * 100,
      latestSimulationAgeMs,
      latestSnapshotUpdateRateHz:
        worldClientTelemetrySnapshot.latestSnapshotUpdateRateHz
    });
  }

  get snapshotStreamTelemetrySnapshot(): MetaverseWorldSnapshotStreamTelemetrySnapshot {
    return this.#readWorldClientTelemetrySnapshot().snapshotStream;
  }

  get latestAuthoritativeTickIntervalMs(): number | null {
    const latestSnapshot =
      this.#metaverseWorldClient?.worldSnapshotBuffer[
        (this.#metaverseWorldClient?.worldSnapshotBuffer.length ?? 0) - 1
      ] ?? null;

    if (latestSnapshot === null) {
      return null;
    }

    return Number(latestSnapshot.tick.tickIntervalMs);
  }

  get reliableTransportStatusSnapshot(): RealtimeReliableTransportStatusSnapshot {
    return (
      this.#metaverseWorldClient?.reliableTransportStatusSnapshot ??
      createDisabledRealtimeReliableTransportStatusSnapshot()
    );
  }

  get driverVehicleControlDatagramStatusSnapshot():
    | RealtimeDatagramTransportStatusSnapshot {
    return (
      this.#metaverseWorldClient?.driverVehicleControlDatagramStatusSnapshot ??
      createDisabledRealtimeDatagramTransportStatusSnapshot()
    );
  }

  get latestPlayerTraversalIntentSnapshot():
    | MetaversePlayerTraversalIntentSnapshot
    | null {
    return this.#metaverseWorldClient?.latestPlayerTraversalIntentSnapshot ?? null;
  }

  get remoteCharacterPresentations(): readonly MetaverseRemoteCharacterPresentationSnapshot[] {
    return this.#remoteCharacterPresentations;
  }

  get remoteVehiclePresentations(): readonly MetaverseRemoteVehiclePresentationSnapshot[] {
    return this.#remoteVehiclePresentations;
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

  readFreshAckedAuthoritativeLocalPlayerPoseForReconciliation(
    maxAuthoritativeSnapshotAgeMs: number
  ): Pick<
    MetaverseRealtimePlayerSnapshot,
    | "linearVelocity"
    | "locomotionMode"
    | "mountedOccupancy"
    | "position"
    | "yawRadians"
  > | null {
    const freshAckedLocalPlayerSnapshot = this.#readFreshAckedLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    if (freshAckedLocalPlayerSnapshot === null) {
      return null;
    }

    const { latestWorldSnapshot, playerSnapshot } = freshAckedLocalPlayerSnapshot;
    const extrapolationSeconds =
      this.#readLatestWorldSnapshotExtrapolationSeconds(latestWorldSnapshot);

    if (extrapolationSeconds <= 0) {
      return {
        linearVelocity: playerSnapshot.linearVelocity,
        locomotionMode: playerSnapshot.locomotionMode,
        mountedOccupancy: playerSnapshot.mountedOccupancy,
        position: playerSnapshot.position,
        yawRadians: playerSnapshot.yawRadians
      };
    }

    return {
      linearVelocity: playerSnapshot.linearVelocity,
      locomotionMode: playerSnapshot.locomotionMode,
      mountedOccupancy: playerSnapshot.mountedOccupancy,
      position: sampleRemotePlayerPositionInto(
        createMutableVector3(),
        playerSnapshot,
        null,
        0,
        extrapolationSeconds
      ),
      yawRadians: createRadians(
        sampleRemotePlayerYawRadians(
          playerSnapshot,
          null,
          0,
          extrapolationSeconds
        )
      )
    };
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

  boot(): void {
    this.dispose();

    if (
      this.#createMetaverseWorldClient === null ||
      this.#localPlayerIdentity === null
    ) {
      return;
    }

    const metaverseWorldClient = this.#createMetaverseWorldClient();

    this.#metaverseWorldClient = metaverseWorldClient;
    this.#metaverseWorldUnsubscribe = metaverseWorldClient.subscribeUpdates(() => {
      if (this.#metaverseWorldClient !== metaverseWorldClient) {
        return;
      }

      this.#onRemoteWorldUpdate();
    });
  }

  dispose(): void {
    this.#metaverseWorldUnsubscribe?.();
    this.#metaverseWorldUnsubscribe = null;
    this.#metaverseWorldClient?.dispose();
    this.#metaverseWorldClient = null;
    this.#connectionPromise = null;
    this.#authoritativeServerClock.reset();
    this.#extrapolatedFrameCount = 0;
    this.#lastSampledAtMs = null;
    this.#lastSampledExtrapolationMs = 0;
    this.#latestIndexedWorldSnapshot = null;
    this.#sampleEpoch = 0;
    this.#sampledFrameCount = 0;
    this.#latestPlayerSnapshotsByPlayerId.clear();
    this.#latestVehicleSnapshotsByEnvironmentAssetId.clear();
    this.#nextPlayerSnapshotsByPlayerId.clear();
    this.#nextVehicleSnapshotsByVehicleId.clear();
    this.#remoteCharacterPresentationsByPlayerId.clear();
    this.#remoteVehiclePresentationsByEnvironmentAssetId.clear();
    this.#remoteCharacterPresentations.length = 0;
    this.#remoteVehiclePresentations.length = 0;
  }

  syncConnection(presenceJoined: boolean): void {
    if (
      !presenceJoined ||
      this.#localPlayerIdentity === null ||
      this.#metaverseWorldClient === null ||
      this.#connectionPromise !== null ||
      this.#metaverseWorldClient.statusSnapshot.connected
    ) {
      return;
    }

    const connectionPromise = this.#metaverseWorldClient.ensureConnected(
      this.#localPlayerIdentity.playerId
    );
    this.#connectionPromise = connectionPromise;

    void connectionPromise
      .catch(() => {
        if (this.#connectionPromise !== connectionPromise) {
          return;
        }

        this.#onRemoteWorldUpdate();
      })
      .finally(() => {
        if (this.#connectionPromise === connectionPromise) {
          this.#connectionPromise = null;
        }
      });
  }

  sampleRemoteWorld(): void {
    const metaverseWorldClient = this.#metaverseWorldClient;
    const localPlayerIdentity = this.#localPlayerIdentity;
    const sampleWallClockMs = this.#readWallClockMs();
    const deltaSeconds =
      this.#lastSampledAtMs === null
        ? 0
        : Math.min(0.1, Math.max(0, (sampleWallClockMs - this.#lastSampledAtMs) / 1000));
    this.#lastSampledAtMs = sampleWallClockMs;
    const sampledWorldFrame =
      metaverseWorldClient === null || localPlayerIdentity === null
        ? null
        : resolveSampledWorldFrame(
            metaverseWorldClient.worldSnapshotBuffer,
            this.#resolveTargetServerTimeMs(
              metaverseWorldClient.worldSnapshotBuffer
            ),
            this.#samplingConfig.maxExtrapolationMs
          );

    if (sampledWorldFrame === null || localPlayerIdentity === null) {
      this.#lastSampledExtrapolationMs = 0;
      this.#sampleEpoch += 1;
      this.#nextPlayerSnapshotsByPlayerId.clear();
      this.#nextVehicleSnapshotsByVehicleId.clear();
      this.#remoteCharacterPresentationsByPlayerId.clear();
      this.#remoteVehiclePresentationsByEnvironmentAssetId.clear();
      this.#remoteCharacterPresentations.length = 0;
      this.#remoteVehiclePresentations.length = 0;
      return;
    }

    const { alpha, baseSnapshot, extrapolationSeconds, nextSnapshot } =
      sampledWorldFrame;
    const extrapolationMs = extrapolationSeconds * 1000;
    const sampleEpoch = this.#sampleEpoch + 1;

    this.#lastSampledExtrapolationMs = extrapolationMs;
    this.#sampledFrameCount += 1;
    if (extrapolationMs > 0) {
      this.#extrapolatedFrameCount += 1;
    }
    this.#sampleEpoch = sampleEpoch;
    indexPlayersByPlayerId(
      nextSnapshot?.players ?? emptyRealtimePlayerSnapshots,
      this.#nextPlayerSnapshotsByPlayerId
    );
    this.#remoteCharacterPresentations.length = 0;

    for (const basePlayer of baseSnapshot.players) {
      if (basePlayer.playerId === localPlayerIdentity.playerId) {
        continue;
      }

      const nextPlayer =
        this.#nextPlayerSnapshotsByPlayerId.get(basePlayer.playerId) ?? null;
      let remoteCharacterPresentation =
        this.#remoteCharacterPresentationsByPlayerId.get(basePlayer.playerId);

      if (remoteCharacterPresentation === undefined) {
        remoteCharacterPresentation = {
          characterId: basePlayer.characterId,
          look: {
            pitchRadians: basePlayer.look.pitchRadians,
            yawRadians: basePlayer.look.yawRadians
          },
          mountedOccupancy: basePlayer.mountedOccupancy,
          playerId: basePlayer.playerId,
          poseSyncMode: "runtime-server-sampled",
          presentation: {
            animationVocabulary: basePlayer.animationVocabulary,
            position: createMutableVector3(),
            yawRadians: basePlayer.yawRadians
          },
          sampleEpoch
        };
        this.#remoteCharacterPresentationsByPlayerId.set(
          basePlayer.playerId,
          remoteCharacterPresentation
        );
      }

      remoteCharacterPresentation.characterId = basePlayer.characterId;
      remoteCharacterPresentation.look.pitchRadians =
        sampleRemotePlayerLookPitchRadians(basePlayer, nextPlayer, alpha);
      remoteCharacterPresentation.look.yawRadians =
        sampleRemotePlayerLookYawRadians(basePlayer, nextPlayer, alpha);
      remoteCharacterPresentation.mountedOccupancy = basePlayer.mountedOccupancy;
      remoteCharacterPresentation.presentation.animationVocabulary =
        basePlayer.animationVocabulary;
      sampleRemotePlayerPositionInto(
        remoteCharacterPresentation.presentation.position,
        basePlayer,
        nextPlayer,
        alpha,
        extrapolationSeconds
      );
      remoteCharacterPresentation.presentation.yawRadians =
        sampleRemotePlayerYawRadians(
          basePlayer,
          nextPlayer,
          alpha,
          extrapolationSeconds
        );
      remoteCharacterPresentation.sampleEpoch = sampleEpoch;
      this.#remoteCharacterPresentations.push(remoteCharacterPresentation);
    }

    for (const [playerId, remoteCharacterPresentation] of this
      .#remoteCharacterPresentationsByPlayerId) {
      if (remoteCharacterPresentation.sampleEpoch === sampleEpoch) {
        continue;
      }

      this.#remoteCharacterPresentationsByPlayerId.delete(playerId);
    }

    indexVehiclesByVehicleId(
      nextSnapshot?.vehicles ?? emptyRealtimeVehicleSnapshots,
      this.#nextVehicleSnapshotsByVehicleId
    );
    this.#remoteVehiclePresentations.length = 0;
    const vehicleInterpolationAlpha =
      resolveRemoteVehiclePresentationInterpolationAlpha(deltaSeconds);

    for (const baseVehicle of baseSnapshot.vehicles) {
      const nextVehicle =
        this.#nextVehicleSnapshotsByVehicleId.get(baseVehicle.vehicleId) ?? null;
      let remoteVehiclePresentation =
        this.#remoteVehiclePresentationsByEnvironmentAssetId.get(
          baseVehicle.environmentAssetId
        );

      if (remoteVehiclePresentation === undefined) {
        remoteVehiclePresentation = {
          environmentAssetId: baseVehicle.environmentAssetId,
          position: createMutableVector3(),
          sampleEpoch: 0,
          yawRadians: baseVehicle.yawRadians
        };
        this.#remoteVehiclePresentationsByEnvironmentAssetId.set(
          baseVehicle.environmentAssetId,
          remoteVehiclePresentation
        );
      }

      const previousVehiclePresentationSampled =
        remoteVehiclePresentation.sampleEpoch > 0;
      const previousVehiclePositionX = remoteVehiclePresentation.position.x;
      const previousVehiclePositionY = remoteVehiclePresentation.position.y;
      const previousVehiclePositionZ = remoteVehiclePresentation.position.z;
      const previousVehicleYawRadians = remoteVehiclePresentation.yawRadians;
      const sampledVehiclePosition = sampleRemoteVehiclePositionInto(
        this.#sampledVehiclePositionScratch,
        baseVehicle,
        nextVehicle,
        alpha,
        extrapolationSeconds
      );
      const sampledVehicleYawRadians = sampleRemoteVehicleYawRadians(
        baseVehicle,
        nextVehicle,
        alpha,
        extrapolationSeconds
      );
      const vehiclePositionDeltaX =
        sampledVehiclePosition.x -
        (previousVehiclePresentationSampled
          ? previousVehiclePositionX
          : sampledVehiclePosition.x);
      const vehiclePositionDeltaY =
        sampledVehiclePosition.y -
        (previousVehiclePresentationSampled
          ? previousVehiclePositionY
          : sampledVehiclePosition.y);
      const vehiclePositionDeltaZ =
        sampledVehiclePosition.z -
        (previousVehiclePresentationSampled
          ? previousVehiclePositionZ
          : sampledVehiclePosition.z);
      const vehiclePositionDistance = Math.hypot(
        vehiclePositionDeltaX,
        vehiclePositionDeltaY,
        vehiclePositionDeltaZ
      );
      const vehicleYawDistance = Math.abs(
        wrapRadians(
          sampledVehicleYawRadians -
            (previousVehiclePresentationSampled
              ? previousVehicleYawRadians
              : sampledVehicleYawRadians)
        )
      );

      remoteVehiclePresentation.environmentAssetId = baseVehicle.environmentAssetId;
      if (
        !previousVehiclePresentationSampled ||
        vehicleInterpolationAlpha <= 0 ||
        vehiclePositionDistance >=
          remoteVehiclePresentationTeleportSnapDistanceMeters ||
        vehicleYawDistance >= remoteVehiclePresentationYawSnapRadians
      ) {
        writeMutableVector3(
          remoteVehiclePresentation.position,
          sampledVehiclePosition.x,
          sampledVehiclePosition.y,
          sampledVehiclePosition.z
        );
        remoteVehiclePresentation.yawRadians = sampledVehicleYawRadians;
      } else {
        writeMutableVector3(
          remoteVehiclePresentation.position,
          lerp(
            previousVehiclePositionX,
            sampledVehiclePosition.x,
            vehicleInterpolationAlpha
          ),
          lerp(
            previousVehiclePositionY,
            sampledVehiclePosition.y,
            vehicleInterpolationAlpha
          ),
          lerp(
            previousVehiclePositionZ,
            sampledVehiclePosition.z,
            vehicleInterpolationAlpha
          )
        );
        remoteVehiclePresentation.yawRadians = lerpWrappedRadians(
          previousVehicleYawRadians,
          sampledVehicleYawRadians,
          vehicleInterpolationAlpha
        );
      }
      remoteVehiclePresentation.sampleEpoch = sampleEpoch;
      this.#remoteVehiclePresentations.push(remoteVehiclePresentation);
    }

    for (const [
      environmentAssetId,
      remoteVehiclePresentation
    ] of this.#remoteVehiclePresentationsByEnvironmentAssetId) {
      if (remoteVehiclePresentation.sampleEpoch === sampleEpoch) {
        continue;
      }

      this.#remoteVehiclePresentationsByEnvironmentAssetId.delete(
        environmentAssetId
      );
    }
  }

  syncLocalDriverVehicleControl(
    controlIntentSnapshot: RoutedDriverVehicleControlIntentSnapshot | null
  ): void {
    if (
      this.#metaverseWorldClient === null ||
      this.#localPlayerIdentity === null
    ) {
      return;
    }

    if (controlIntentSnapshot === null) {
      this.#metaverseWorldClient.syncDriverVehicleControl(null);
      return;
    }

    this.#metaverseWorldClient.syncDriverVehicleControl({
      controlIntent: {
        boost: controlIntentSnapshot.controlIntent.boost,
        environmentAssetId: controlIntentSnapshot.environmentAssetId,
        moveAxis: controlIntentSnapshot.controlIntent.moveAxis,
        strafeAxis: controlIntentSnapshot.controlIntent.strafeAxis,
        yawAxis: controlIntentSnapshot.controlIntent.yawAxis
      },
      playerId: this.#localPlayerIdentity.playerId
    });
  }

  syncMountedOccupancy(
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void {
    if (
      this.#metaverseWorldClient === null ||
      this.#localPlayerIdentity === null
    ) {
      return;
    }

    this.#metaverseWorldClient.syncMountedOccupancy({
      mountedOccupancy:
        mountedEnvironment === null
          ? null
          : {
              environmentAssetId: mountedEnvironment.environmentAssetId,
              entryId: mountedEnvironment.entryId,
              occupancyKind: mountedEnvironment.occupancyKind,
              occupantRole: mountedEnvironment.occupantRole,
              seatId: mountedEnvironment.seatId
            },
      playerId: this.#localPlayerIdentity.playerId
    });
  }

  syncLocalTraversalIntent(
    movementInput: Pick<
      MetaverseFlightInputSnapshot,
      "boost" | "jump" | "moveAxis" | "strafeAxis" | "yawAxis"
    >,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
  ): void {
    if (
      this.#metaverseWorldClient === null ||
      this.#localPlayerIdentity === null
    ) {
      this.#metaverseWorldClient?.syncPlayerTraversalIntent(null);
      return;
    }

    if (locomotionMode !== "grounded" && locomotionMode !== "swim") {
      this.#metaverseWorldClient.syncPlayerTraversalIntent(null);
      return;
    }

    this.#metaverseWorldClient.syncPlayerTraversalIntent({
      intent: {
        boost: movementInput.boost,
        jump: movementInput.jump,
        locomotionMode,
        moveAxis: movementInput.moveAxis,
        strafeAxis: movementInput.strafeAxis,
        yawAxis: movementInput.yawAxis
      },
      playerId: this.#localPlayerIdentity.playerId,
    });
  }

  syncLocalPlayerLook(
    lookSnapshot: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">
  ): void {
    if (
      this.#metaverseWorldClient === null ||
      this.#localPlayerIdentity === null
    ) {
      this.#metaverseWorldClient?.syncPlayerLookIntent(null);
      return;
    }

    this.#metaverseWorldClient.syncPlayerLookIntent({
      lookIntent: {
        pitchRadians: lookSnapshot.pitchRadians,
        yawRadians: lookSnapshot.yawRadians
      },
      playerId: this.#localPlayerIdentity.playerId
    });
  }

  #resolveTargetServerTimeMs(
    worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[]
  ): number {
    const latestSnapshot =
      worldSnapshotBuffer[worldSnapshotBuffer.length - 1] ?? null;
    const localWallClockMs = this.#readWallClockMs();

    if (latestSnapshot === null) {
      return localWallClockMs;
    }

    this.#authoritativeServerClock.observeServerTime(
      Number(latestSnapshot.tick.emittedAtServerTimeMs),
      localWallClockMs
    );

    return this.#authoritativeServerClock.readTargetServerTimeMs(
      localWallClockMs,
      this.#samplingConfig.interpolationDelayMs
    );
  }

  #readFreshLatestWorldSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeWorldSnapshot | null {
    const latestWorldSnapshot =
      this.#metaverseWorldClient?.worldSnapshotBuffer[
        (this.#metaverseWorldClient?.worldSnapshotBuffer.length ?? 0) - 1
      ] ?? null;

    if (latestWorldSnapshot === null) {
      return null;
    }

    const localWallClockMs = this.#readWallClockMs();

    this.#authoritativeServerClock.observeServerTime(
      Number(latestWorldSnapshot.tick.emittedAtServerTimeMs),
      localWallClockMs
    );

    const authoritativeSnapshotAgeMs = Math.max(
      0,
      this.#authoritativeServerClock.readEstimatedServerTimeMs(localWallClockMs) -
        Number(latestWorldSnapshot.tick.simulationTimeMs)
    );

    return authoritativeSnapshotAgeMs >
      Math.max(0, maxAuthoritativeSnapshotAgeMs)
      ? null
      : latestWorldSnapshot;
  }

  #readFreshLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): {
    readonly latestWorldSnapshot: MetaverseRealtimeWorldSnapshot;
    readonly playerSnapshot: MetaverseRealtimePlayerSnapshot;
  } | null {
    const latestWorldSnapshot = this.#readFreshLatestWorldSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    if (latestWorldSnapshot === null || this.#localPlayerIdentity === null) {
      return null;
    }

    this.#syncLatestWorldSnapshotIndexes(latestWorldSnapshot);
    const playerSnapshot =
      this.#latestPlayerSnapshotsByPlayerId.get(
        this.#localPlayerIdentity.playerId
      ) ?? null;

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
  ): {
    readonly latestWorldSnapshot: MetaverseRealtimeWorldSnapshot;
    readonly playerSnapshot: MetaverseRealtimePlayerSnapshot;
  } | null {
    const freshLocalPlayerSnapshot = this.#readFreshLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );
    const latestPlayerInputSequence =
      this.#metaverseWorldClient?.latestPlayerInputSequence ?? 0;

    if (
      freshLocalPlayerSnapshot === null ||
      freshLocalPlayerSnapshot.playerSnapshot.lastProcessedInputSequence <
        latestPlayerInputSequence
    ) {
      return null;
    }

    return freshLocalPlayerSnapshot;
  }

  #readLatestWorldSnapshotExtrapolationSeconds(
    latestWorldSnapshot: MetaverseRealtimeWorldSnapshot
  ): number {
    const localWallClockMs = this.#readWallClockMs();

    this.#authoritativeServerClock.observeServerTime(
      Number(latestWorldSnapshot.tick.emittedAtServerTimeMs),
      localWallClockMs
    );

    const extrapolationMs = clamp(
      this.#authoritativeServerClock.readEstimatedServerTimeMs(localWallClockMs) -
        Number(latestWorldSnapshot.tick.simulationTimeMs),
      0,
      this.#samplingConfig.maxExtrapolationMs
    );

    return extrapolationMs / 1000;
  }

  #syncLatestWorldSnapshotIndexes(
    latestWorldSnapshot: MetaverseRealtimeWorldSnapshot
  ): void {
    if (this.#latestIndexedWorldSnapshot === latestWorldSnapshot) {
      return;
    }

    this.#latestIndexedWorldSnapshot = latestWorldSnapshot;
    this.#latestPlayerSnapshotsByPlayerId.clear();
    this.#latestVehicleSnapshotsByEnvironmentAssetId.clear();

    for (const playerSnapshot of latestWorldSnapshot.players) {
      this.#latestPlayerSnapshotsByPlayerId.set(
        playerSnapshot.playerId,
        playerSnapshot
      );
    }

    for (const vehicleSnapshot of latestWorldSnapshot.vehicles) {
      this.#latestVehicleSnapshotsByEnvironmentAssetId.set(
        vehicleSnapshot.environmentAssetId,
        vehicleSnapshot
      );
    }
  }

  #readWorldClientTelemetrySnapshot(): MetaverseWorldClientTelemetrySnapshot {
    return (
      this.#metaverseWorldClient?.telemetrySnapshot ??
      disabledMetaverseWorldClientTelemetrySnapshot
    );
  }
}
