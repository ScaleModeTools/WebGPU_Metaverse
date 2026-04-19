import type { MetaverseRealtimeWorldSnapshot } from "@webgpu-metaverse/shared";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";

import type {
  MetaverseWorldClientRuntime,
  MetaverseWorldClientTelemetrySnapshot,
  MetaverseWorldSnapshotStreamTelemetrySnapshot
} from "@/network";
import type { MetaverseLocalPlayerIdentity } from "../classes/metaverse-presence-runtime";
import {
  resolveMetaverseRemoteWorldSampledFrame,
  type MetaverseRemoteWorldSampledFrame
} from "./metaverse-remote-world-sampling";

export interface MetaverseRemoteWorldSamplingTelemetrySnapshot {
  readonly bufferDepth: number;
  readonly clockOffsetEstimateMs: number | null;
  readonly currentExtrapolationMs: number;
  readonly datagramSendFailureCount: number;
  readonly extrapolatedFramePercent: number;
  readonly latestSimulationAgeMs: number | null;
  readonly latestSnapshotUpdateRateHz: number | null;
}

interface MetaverseRemoteWorldSamplingClock {
  readonly clockOffsetEstimateMs: number | null;
  observeServerTime(serverTimeMs: number, localWallClockMs: number): void;
  readEstimatedServerTimeMs(localWallClockMs: number): number;
  readTargetServerTimeMs(
    localWallClockMs: number,
    interpolationDelayMs?: number
  ): number;
  reset(): void;
}

interface MetaverseRemoteWorldSamplingPresentationState {
  clear(): void;
  syncAuthoritativeSample(input: {
    readonly deltaSeconds: number;
    readonly localPlayerId: MetaversePlayerId;
    readonly remoteCharacterRootFrame: MetaverseRemoteWorldSampledFrame;
    readonly sampledFrame: MetaverseRemoteWorldSampledFrame;
  }): number;
}

interface MetaverseRemoteWorldSamplingStateDependencies {
  readonly authoritativeServerClock: MetaverseRemoteWorldSamplingClock;
  readonly interpolationDelayMs: number;
  readonly localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly maxExtrapolationMs: number;
  readonly presentationState: MetaverseRemoteWorldSamplingPresentationState;
  readonly readWallClockMs: () => number;
  readonly readWorldClient: () => MetaverseWorldClientRuntime | null;
  readonly remoteCharacterRootInterpolationDelayMs: number;
  readonly remoteCharacterRootMaxExtrapolationMs: number;
}

const disabledMetaverseWorldClientTelemetrySnapshot: MetaverseWorldClientTelemetrySnapshot =
  Object.freeze({
    driverVehicleControlDatagramSendFailureCount: 0,
    latestSnapshotUpdateRateHz: null,
    playerLookInputDatagramSendFailureCount: 0,
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

export class MetaverseRemoteWorldSamplingState {
  readonly #authoritativeServerClock: MetaverseRemoteWorldSamplingClock;
  readonly #interpolationDelayMs: number;
  readonly #localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly #maxExtrapolationMs: number;
  readonly #presentationState: MetaverseRemoteWorldSamplingPresentationState;
  readonly #readWallClockMs: () => number;
  readonly #readWorldClient: () => MetaverseWorldClientRuntime | null;
  readonly #remoteCharacterRootInterpolationDelayMs: number;
  readonly #remoteCharacterRootMaxExtrapolationMs: number;

  #extrapolatedFrameCount = 0;
  #lastSampledAtMs: number | null = null;
  #lastSampledExtrapolationMs = 0;
  #sampledFrameCount = 0;

  constructor({
    authoritativeServerClock,
    interpolationDelayMs,
    localPlayerIdentity,
    maxExtrapolationMs,
    presentationState,
    readWallClockMs,
    readWorldClient,
    remoteCharacterRootInterpolationDelayMs,
    remoteCharacterRootMaxExtrapolationMs
  }: MetaverseRemoteWorldSamplingStateDependencies) {
    this.#authoritativeServerClock = authoritativeServerClock;
    this.#interpolationDelayMs = interpolationDelayMs;
    this.#localPlayerIdentity = localPlayerIdentity;
    this.#maxExtrapolationMs = maxExtrapolationMs;
    this.#presentationState = presentationState;
    this.#readWallClockMs = readWallClockMs;
    this.#readWorldClient = readWorldClient;
    this.#remoteCharacterRootInterpolationDelayMs =
      Number.isFinite(remoteCharacterRootInterpolationDelayMs)
        ? Math.max(0, remoteCharacterRootInterpolationDelayMs)
        : 0;
    this.#remoteCharacterRootMaxExtrapolationMs =
      Number.isFinite(remoteCharacterRootMaxExtrapolationMs)
        ? Math.max(0, remoteCharacterRootMaxExtrapolationMs)
        : 0;
  }

  get latestAuthoritativeTickIntervalMs(): number | null {
    const worldClient = this.#readWorldClient();
    const latestSnapshot =
      worldClient?.worldSnapshotBuffer[
        (worldClient?.worldSnapshotBuffer.length ?? 0) - 1
      ] ?? null;

    if (latestSnapshot === null) {
      return null;
    }

    return Number(latestSnapshot.tick.tickIntervalMs);
  }

  get samplingTelemetrySnapshot(): MetaverseRemoteWorldSamplingTelemetrySnapshot {
    const worldClientTelemetrySnapshot = this.#readWorldClientTelemetrySnapshot();
    const worldClient = this.#readWorldClient();
    const latestSnapshot =
      worldClient?.worldSnapshotBuffer[
        (worldClient?.worldSnapshotBuffer.length ?? 0) - 1
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
      bufferDepth: worldClient?.worldSnapshotBuffer.length ?? 0,
      clockOffsetEstimateMs: this.#authoritativeServerClock.clockOffsetEstimateMs,
      currentExtrapolationMs: this.#lastSampledExtrapolationMs,
      datagramSendFailureCount:
        worldClientTelemetrySnapshot.driverVehicleControlDatagramSendFailureCount +
        (worldClientTelemetrySnapshot.playerLookInputDatagramSendFailureCount ??
          0) +
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

  reset(): void {
    this.#authoritativeServerClock.reset();
    this.#extrapolatedFrameCount = 0;
    this.#lastSampledAtMs = null;
    this.#lastSampledExtrapolationMs = 0;
    this.#sampledFrameCount = 0;
    this.#presentationState.clear();
  }

  sampleRemoteWorld(): void {
    const worldClient = this.#readWorldClient();
    const localPlayerIdentity = this.#localPlayerIdentity;
    const sampleWallClockMs = this.#readWallClockMs();
    const deltaSeconds =
      this.#lastSampledAtMs === null
        ? 0
        : Math.min(0.1, Math.max(0, (sampleWallClockMs - this.#lastSampledAtMs) / 1000));

    this.#lastSampledAtMs = sampleWallClockMs;

    const sampledWorldFrame =
      worldClient === null || localPlayerIdentity === null
        ? null
        : resolveMetaverseRemoteWorldSampledFrame(
            worldClient.worldSnapshotBuffer,
            this.#resolveTargetServerTimeMs(worldClient.worldSnapshotBuffer),
            this.#maxExtrapolationMs
          );
    const remoteCharacterRootFrame =
      worldClient === null || localPlayerIdentity === null
        ? null
        : resolveMetaverseRemoteWorldSampledFrame(
            worldClient.worldSnapshotBuffer,
            this.#resolveTargetServerTimeMs(
              worldClient.worldSnapshotBuffer,
              this.#remoteCharacterRootInterpolationDelayMs
            ),
            this.#remoteCharacterRootMaxExtrapolationMs
          );

    if (
      sampledWorldFrame === null ||
      remoteCharacterRootFrame === null ||
      localPlayerIdentity === null
    ) {
      this.#lastSampledExtrapolationMs = 0;
      this.#presentationState.clear();
      return;
    }

    const extrapolationMs = this.#presentationState.syncAuthoritativeSample({
      deltaSeconds,
      localPlayerId: localPlayerIdentity.playerId,
      remoteCharacterRootFrame,
      sampledFrame: sampledWorldFrame
    });

    this.#lastSampledExtrapolationMs = extrapolationMs;
    this.#sampledFrameCount += 1;

    if (extrapolationMs > 0) {
      this.#extrapolatedFrameCount += 1;
    }
  }

  #resolveTargetServerTimeMs(
    worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[],
    interpolationDelayMs = this.#interpolationDelayMs
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
      interpolationDelayMs
    );
  }

  #readWorldClientTelemetrySnapshot(): MetaverseWorldClientTelemetrySnapshot {
    return (
      this.#readWorldClient()?.telemetrySnapshot ??
      disabledMetaverseWorldClientTelemetrySnapshot
    );
  }
}
