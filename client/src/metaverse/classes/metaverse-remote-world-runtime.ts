import type {
  MetaversePlayerId,
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeVehicleSnapshot,
  MetaverseRealtimeWorldSnapshot,
  MetaverseSyncDriverVehicleControlCommandInput
} from "@webgpu-metaverse/shared";

import type {
  AuthoritativeServerClockConfig,
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
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseRemoteVehiclePresentationSnapshot
} from "../types/metaverse-runtime";
import type { MetaverseLocalPlayerIdentity } from "./metaverse-presence-runtime";
import type { RoutedDriverVehicleControlIntentSnapshot } from "../traversal/types/traversal";

export interface MetaverseWorldClientRuntime {
  readonly currentPollIntervalMs: number;
  readonly driverVehicleControlDatagramStatusSnapshot: RealtimeDatagramTransportStatusSnapshot;
  readonly reliableTransportStatusSnapshot: RealtimeReliableTransportStatusSnapshot;
  readonly statusSnapshot: MetaverseWorldClientStatusSnapshot;
  readonly worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[];
  ensureConnected(
    playerId: MetaversePlayerId
  ): Promise<MetaverseRealtimeWorldSnapshot>;
  syncDriverVehicleControl(
    commandInput: MetaverseSyncDriverVehicleControlCommandInput | null
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

function freezeVector3(x: number, y: number, z: number) {
  return Object.freeze({
    x,
    y,
    z
  });
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

function sampleRemotePlayerPosition(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
) {
  if (nextPlayer !== null) {
    return freezeVector3(
      lerp(basePlayer.position.x, nextPlayer.position.x, alpha),
      lerp(basePlayer.position.y, nextPlayer.position.y, alpha),
      lerp(basePlayer.position.z, nextPlayer.position.z, alpha)
    );
  }

  if (extrapolationSeconds <= 0) {
    return basePlayer.position;
  }

  return freezeVector3(
    basePlayer.position.x + basePlayer.linearVelocity.x * extrapolationSeconds,
    basePlayer.position.y + basePlayer.linearVelocity.y * extrapolationSeconds,
    basePlayer.position.z + basePlayer.linearVelocity.z * extrapolationSeconds
  );
}

function sampleRemotePlayerYawRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): number {
  if (nextPlayer === null) {
    return basePlayer.yawRadians;
  }

  return lerpWrappedRadians(basePlayer.yawRadians, nextPlayer.yawRadians, alpha);
}

function sampleRemoteVehiclePosition(
  baseVehicle: MetaverseRealtimeVehicleSnapshot,
  nextVehicle: MetaverseRealtimeVehicleSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
) {
  if (nextVehicle !== null) {
    return freezeVector3(
      lerp(baseVehicle.position.x, nextVehicle.position.x, alpha),
      lerp(baseVehicle.position.y, nextVehicle.position.y, alpha),
      lerp(baseVehicle.position.z, nextVehicle.position.z, alpha)
    );
  }

  if (extrapolationSeconds <= 0) {
    return baseVehicle.position;
  }

  return freezeVector3(
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
    const firstSnapshotTimeMs = Number(firstSnapshot.tick.serverTimeMs);
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

  const firstSnapshotTimeMs = Number(firstSnapshot.tick.serverTimeMs);

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
    const baseTimeMs = Number(baseSnapshot.tick.serverTimeMs);
    const nextTimeMs = Number(nextSnapshot.tick.serverTimeMs);

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
  const latestTimeMs = Number(latestSnapshot.tick.serverTimeMs);
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

export class MetaverseRemoteWorldRuntime {
  readonly #createMetaverseWorldClient:
    | (() => MetaverseWorldClientRuntime)
    | null;
  readonly #localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly #onRemoteWorldUpdate: () => void;
  readonly #readWallClockMs: () => number;
  readonly #samplingConfig: MetaverseRemoteWorldSamplingConfig;
  readonly #authoritativeServerClock: AuthoritativeServerClock;

  #connectionPromise: Promise<MetaverseRealtimeWorldSnapshot> | null = null;
  #lastSampledAtMs: number | null = null;
  #remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[] =
    Object.freeze([]);
  #remoteVehiclePresentations: readonly MetaverseRemoteVehiclePresentationSnapshot[] =
    Object.freeze([]);
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

  get remoteCharacterPresentations(): readonly MetaverseRemoteCharacterPresentationSnapshot[] {
    return this.#remoteCharacterPresentations;
  }

  get remoteVehiclePresentations(): readonly MetaverseRemoteVehiclePresentationSnapshot[] {
    return this.#remoteVehiclePresentations;
  }

  readFreshAuthoritativeLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimePlayerSnapshot | null {
    const latestWorldSnapshot = this.#readFreshLatestWorldSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    if (latestWorldSnapshot === null || this.#localPlayerIdentity === null) {
      return null;
    }

    return (
      latestWorldSnapshot.players.find(
        (playerSnapshot) =>
          playerSnapshot.playerId === this.#localPlayerIdentity?.playerId
      ) ?? null
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

    return (
      latestWorldSnapshot.vehicles.find(
        (vehicleSnapshot) =>
          vehicleSnapshot.environmentAssetId === environmentAssetId
      ) ?? null
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
    this.#lastSampledAtMs = null;
    this.#remoteCharacterPresentations = Object.freeze([]);
    this.#remoteVehiclePresentations = Object.freeze([]);
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
      this.#remoteCharacterPresentations = Object.freeze([]);
      this.#remoteVehiclePresentations = Object.freeze([]);
      return;
    }

    const { alpha, baseSnapshot, extrapolationSeconds, nextSnapshot } =
      sampledWorldFrame;
    const remoteCharacterPresentations: MetaverseRemoteCharacterPresentationSnapshot[] =
      [];

    for (const basePlayer of baseSnapshot.players) {
      if (basePlayer.playerId === localPlayerIdentity.playerId) {
        continue;
      }

      const nextPlayer =
        nextSnapshot?.players.find(
          (candidate) => candidate.playerId === basePlayer.playerId
        ) ?? null;

      remoteCharacterPresentations.push(
        Object.freeze({
          characterId: basePlayer.characterId,
          mountedOccupancy: basePlayer.mountedOccupancy,
          playerId: basePlayer.playerId,
          poseSyncMode: "runtime-server-sampled",
          presentation: Object.freeze({
            animationVocabulary: basePlayer.animationVocabulary,
            position: sampleRemotePlayerPosition(
              basePlayer,
              nextPlayer,
              alpha,
              extrapolationSeconds
            ),
            yawRadians: sampleRemotePlayerYawRadians(
              basePlayer,
              nextPlayer,
              alpha
            )
          })
        })
      );
    }

    const remoteVehiclePresentations: MetaverseRemoteVehiclePresentationSnapshot[] =
      [];

    for (const baseVehicle of baseSnapshot.vehicles) {
      const nextVehicle =
        nextSnapshot?.vehicles.find(
          (candidate) => candidate.vehicleId === baseVehicle.vehicleId
        ) ?? null;
      const sampledVehiclePresentation = Object.freeze({
        environmentAssetId: baseVehicle.environmentAssetId,
        position: sampleRemoteVehiclePosition(
          baseVehicle,
          nextVehicle,
          alpha,
          extrapolationSeconds
        ),
        yawRadians: sampleRemoteVehicleYawRadians(
          baseVehicle,
          nextVehicle,
          alpha,
          extrapolationSeconds
        )
      });
      const previousVehiclePresentation =
        this.#remoteVehiclePresentations.find(
          (candidate) =>
            candidate.environmentAssetId ===
            sampledVehiclePresentation.environmentAssetId
        ) ?? null;
      const vehiclePositionDeltaX =
        sampledVehiclePresentation.position.x -
        (previousVehiclePresentation?.position.x ??
          sampledVehiclePresentation.position.x);
      const vehiclePositionDeltaY =
        sampledVehiclePresentation.position.y -
        (previousVehiclePresentation?.position.y ??
          sampledVehiclePresentation.position.y);
      const vehiclePositionDeltaZ =
        sampledVehiclePresentation.position.z -
        (previousVehiclePresentation?.position.z ??
          sampledVehiclePresentation.position.z);
      const vehiclePositionDistance = Math.hypot(
        vehiclePositionDeltaX,
        vehiclePositionDeltaY,
        vehiclePositionDeltaZ
      );
      const vehicleYawDistance = Math.abs(
        wrapRadians(
          sampledVehiclePresentation.yawRadians -
            (previousVehiclePresentation?.yawRadians ??
              sampledVehiclePresentation.yawRadians)
        )
      );
      const vehicleInterpolationAlpha =
        resolveRemoteVehiclePresentationInterpolationAlpha(deltaSeconds);

      remoteVehiclePresentations.push(
        previousVehiclePresentation === null ||
          vehicleInterpolationAlpha <= 0 ||
          vehiclePositionDistance >=
            remoteVehiclePresentationTeleportSnapDistanceMeters ||
          vehicleYawDistance >= remoteVehiclePresentationYawSnapRadians
          ? sampledVehiclePresentation
          : Object.freeze({
              environmentAssetId: sampledVehiclePresentation.environmentAssetId,
              position: freezeVector3(
                lerp(
                  previousVehiclePresentation.position.x,
                  sampledVehiclePresentation.position.x,
                  vehicleInterpolationAlpha
                ),
                lerp(
                  previousVehiclePresentation.position.y,
                  sampledVehiclePresentation.position.y,
                  vehicleInterpolationAlpha
                ),
                lerp(
                  previousVehiclePresentation.position.z,
                  sampledVehiclePresentation.position.z,
                  vehicleInterpolationAlpha
                )
              ),
              yawRadians: lerpWrappedRadians(
                previousVehiclePresentation.yawRadians,
                sampledVehiclePresentation.yawRadians,
                vehicleInterpolationAlpha
              )
            })
      );
    }

    this.#remoteCharacterPresentations = Object.freeze(
      remoteCharacterPresentations
    );
    this.#remoteVehiclePresentations = Object.freeze(remoteVehiclePresentations);
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
      Number(latestSnapshot.tick.serverTimeMs),
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
      Number(latestWorldSnapshot.tick.serverTimeMs),
      localWallClockMs
    );

    const authoritativeSnapshotAgeMs = Math.max(
      0,
      this.#authoritativeServerClock.readEstimatedServerTimeMs(localWallClockMs) -
        Number(latestWorldSnapshot.tick.serverTimeMs)
    );

    return authoritativeSnapshotAgeMs >
      Math.max(0, maxAuthoritativeSnapshotAgeMs)
      ? null
      : latestWorldSnapshot;
  }
}
