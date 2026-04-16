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
import { MetaverseRemoteCharacterPresentationOwner } from "../traversal/presentation/remote-character-presentation";
import { MetaverseRemoteVehiclePresentationOwner } from "../traversal/presentation/remote-vehicle-presentation";
import {
  createAckedAuthoritativeLocalPlayerReconciliationDeliveryKey,
  projectAckedAuthoritativeLocalPlayerPoseForReconciliation,
  readAckedAuthoritativeLocalPlayerRawPoseForReconciliation,
  type AckedAuthoritativeLocalPlayerPoseForReconciliation,
  type AckedAuthoritativeLocalPlayerReconciliationSample
} from "../traversal/reconciliation/authoritative-local-player-reconciliation";
import {
  indexMetaverseWorldPlayersByPlayerId,
  indexMetaverseWorldVehiclesByVehicleId,
  readMetaverseWorldPlayerSnapshotByPlayerId,
  resolveMetaverseRemoteWorldFreshLatestSnapshot,
  resolveMetaverseRemoteWorldSampledFrame
} from "../remote-world/metaverse-remote-world-sampling";

export interface MetaverseWorldClientRuntime {
  readonly currentPollIntervalMs: number;
  readonly driverVehicleControlDatagramStatusSnapshot: RealtimeDatagramTransportStatusSnapshot;
  readonly latestPlayerInputSequence: number;
  readonly latestPlayerLookSequence: number;
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
  ): MetaversePlayerTraversalIntentSnapshot | null;
  previewPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerTraversalIntentSnapshot | null;
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
  readonly maxAckedReplayHorizonMs?: number;
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
  readonly #maxAckedReplayHorizonMs: number;
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
    MetaverseRemoteCharacterPresentationOwner
  >();
  readonly #remoteVehiclePresentationsByEnvironmentAssetId = new Map<
    string,
    MetaverseRemoteVehiclePresentationOwner
  >();
  readonly #remoteCharacterPresentations: MetaverseRemoteCharacterPresentationSnapshot[] =
    [];
  readonly #remoteVehiclePresentations: MetaverseRemoteVehiclePresentationSnapshot[] =
    [];

  #connectionPromise: Promise<MetaverseRealtimeWorldSnapshot> | null = null;
  #extrapolatedFrameCount = 0;
  #lastSampledAtMs: number | null = null;
  #lastSampledExtrapolationMs = 0;
  #lastConsumedAckedLocalPlayerReconciliationDeliveryKey: string | null = null;
  #latestIndexedWorldSnapshot: MetaverseRealtimeWorldSnapshot | null = null;
  #sampleEpoch = 0;
  #sampledFrameCount = 0;
  #metaverseWorldClient: MetaverseWorldClientRuntime | null = null;
  #metaverseWorldUnsubscribe: (() => void) | null = null;

  constructor({
    createMetaverseWorldClient,
    localPlayerIdentity,
    maxAckedReplayHorizonMs,
    onRemoteWorldUpdate,
    readWallClockMs,
    samplingConfig
  }: MetaverseRemoteWorldRuntimeDependencies) {
    this.#createMetaverseWorldClient = createMetaverseWorldClient;
    this.#localPlayerIdentity = localPlayerIdentity;
    this.#maxAckedReplayHorizonMs =
      maxAckedReplayHorizonMs ?? samplingConfig.maxExtrapolationMs;
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
  ): AckedAuthoritativeLocalPlayerPoseForReconciliation | null {
    const freshAckedLocalPlayerSnapshot = this.#readFreshAckedLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );

    if (freshAckedLocalPlayerSnapshot === null) {
      return null;
    }

    return projectAckedAuthoritativeLocalPlayerPoseForReconciliation(
      freshAckedLocalPlayerSnapshot.playerSnapshot,
      this.#readAckedLocalPlayerReplaySeconds(
        freshAckedLocalPlayerSnapshot.latestWorldSnapshot
      )
    );
  }

  consumeFreshAckedAuthoritativeLocalPlayerPoseForReconciliation(
    maxAuthoritativeSnapshotAgeMs: number
  ): AckedAuthoritativeLocalPlayerPoseForReconciliation | null {
    const freshAckedLocalPlayerSnapshot = this.#readFreshAckedLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );
    const reconciliationDeliveryKey =
      freshAckedLocalPlayerSnapshot === null
        ? null
        : createAckedAuthoritativeLocalPlayerReconciliationDeliveryKey(
            freshAckedLocalPlayerSnapshot
          );

    if (
      freshAckedLocalPlayerSnapshot === null ||
      reconciliationDeliveryKey ===
        this.#lastConsumedAckedLocalPlayerReconciliationDeliveryKey
    ) {
      return null;
    }

    this.#lastConsumedAckedLocalPlayerReconciliationDeliveryKey =
      reconciliationDeliveryKey;

    return projectAckedAuthoritativeLocalPlayerPoseForReconciliation(
      freshAckedLocalPlayerSnapshot.playerSnapshot,
      this.#readAckedLocalPlayerReplaySeconds(
        freshAckedLocalPlayerSnapshot.latestWorldSnapshot
      )
    );
  }

  consumeFreshAckedAuthoritativeLocalPlayerReconciliationSample(
    maxAuthoritativeSnapshotAgeMs: number
  ): AckedAuthoritativeLocalPlayerReconciliationSample | null {
    const freshAckedLocalPlayerSnapshot = this.#readFreshAckedLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );
    const reconciliationDeliveryKey =
      freshAckedLocalPlayerSnapshot === null
        ? null
        : createAckedAuthoritativeLocalPlayerReconciliationDeliveryKey(
            freshAckedLocalPlayerSnapshot
          );

    if (
      freshAckedLocalPlayerSnapshot === null ||
      reconciliationDeliveryKey ===
        this.#lastConsumedAckedLocalPlayerReconciliationDeliveryKey
    ) {
      return null;
    }

    this.#lastConsumedAckedLocalPlayerReconciliationDeliveryKey =
      reconciliationDeliveryKey;

    return Object.freeze({
      authoritativePlayerSnapshot:
        readAckedAuthoritativeLocalPlayerRawPoseForReconciliation(
          freshAckedLocalPlayerSnapshot.playerSnapshot
        ),
      extrapolationSeconds: this.#readAckedLocalPlayerReplaySeconds(
        freshAckedLocalPlayerSnapshot.latestWorldSnapshot
      )
    });
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
    this.#lastConsumedAckedLocalPlayerReconciliationDeliveryKey = null;
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
        : resolveMetaverseRemoteWorldSampledFrame(
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
    indexMetaverseWorldPlayersByPlayerId(
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
        remoteCharacterPresentation =
          new MetaverseRemoteCharacterPresentationOwner(basePlayer);
        this.#remoteCharacterPresentationsByPlayerId.set(
          basePlayer.playerId,
          remoteCharacterPresentation
        );
      }

      remoteCharacterPresentation.syncAuthoritativeSample({
        alpha,
        basePlayer,
        deltaSeconds,
        extrapolationSeconds,
        nextPlayer,
        sampleEpoch
      });
      this.#remoteCharacterPresentations.push(
        remoteCharacterPresentation.presentationSnapshot
      );
    }

    for (const [playerId, remoteCharacterPresentation] of this
      .#remoteCharacterPresentationsByPlayerId) {
      if (remoteCharacterPresentation.sampleEpoch === sampleEpoch) {
        continue;
      }

      this.#remoteCharacterPresentationsByPlayerId.delete(playerId);
    }

    indexMetaverseWorldVehiclesByVehicleId(
      nextSnapshot?.vehicles ?? emptyRealtimeVehicleSnapshots,
      this.#nextVehicleSnapshotsByVehicleId
    );
    this.#remoteVehiclePresentations.length = 0;

    for (const baseVehicle of baseSnapshot.vehicles) {
      const nextVehicle =
        this.#nextVehicleSnapshotsByVehicleId.get(baseVehicle.vehicleId) ?? null;
      let remoteVehiclePresentation =
        this.#remoteVehiclePresentationsByEnvironmentAssetId.get(
          baseVehicle.environmentAssetId
        );

      if (remoteVehiclePresentation === undefined) {
        remoteVehiclePresentation = new MetaverseRemoteVehiclePresentationOwner(
          baseVehicle
        );
        this.#remoteVehiclePresentationsByEnvironmentAssetId.set(
          baseVehicle.environmentAssetId,
          remoteVehiclePresentation
        );
      }

      remoteVehiclePresentation.syncAuthoritativeSample({
        alpha,
        baseVehicle,
        deltaSeconds,
        extrapolationSeconds,
        nextVehicle,
        sampleEpoch
      });
      this.#remoteVehiclePresentations.push(
        remoteVehiclePresentation.presentationSnapshot
      );
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
    traversalFacing: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
  ): MetaversePlayerTraversalIntentSnapshot | null {
    if (
      this.#metaverseWorldClient === null ||
      this.#localPlayerIdentity === null
    ) {
      this.#metaverseWorldClient?.syncPlayerTraversalIntent(null);
      return null;
    }

    if (locomotionMode !== "grounded" && locomotionMode !== "swim") {
      this.#metaverseWorldClient.syncPlayerTraversalIntent(null);
      return null;
    }

    return this.#metaverseWorldClient.syncPlayerTraversalIntent({
      intent: {
        actionIntent: this.#createTraversalActionIntentSnapshot(
          locomotionMode,
          movementInput.jump
        ),
        bodyControl: {
          boost: movementInput.boost,
          moveAxis: movementInput.moveAxis,
          strafeAxis: movementInput.strafeAxis,
          turnAxis: movementInput.yawAxis
        },
        facing: {
          pitchRadians: traversalFacing.pitchRadians,
          yawRadians: traversalFacing.yawRadians
        },
        locomotionMode,
      },
      playerId: this.#localPlayerIdentity.playerId,
    });
  }

  previewLocalTraversalIntent(
    movementInput: Pick<
      MetaverseFlightInputSnapshot,
      "boost" | "jump" | "moveAxis" | "strafeAxis" | "yawAxis"
    >,
    traversalFacing: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
  ): MetaversePlayerTraversalIntentSnapshot | null {
    if (
      this.#metaverseWorldClient === null ||
      this.#localPlayerIdentity === null
    ) {
      return null;
    }

    if (locomotionMode !== "grounded" && locomotionMode !== "swim") {
      return null;
    }

    return this.#metaverseWorldClient.previewPlayerTraversalIntent({
      intent: {
        actionIntent: this.#createTraversalActionIntentSnapshot(
          locomotionMode,
          movementInput.jump
        ),
        bodyControl: {
          boost: movementInput.boost,
          moveAxis: movementInput.moveAxis,
          strafeAxis: movementInput.strafeAxis,
          turnAxis: movementInput.yawAxis
        },
        facing: {
          pitchRadians: traversalFacing.pitchRadians,
          yawRadians: traversalFacing.yawRadians
        },
        locomotionMode,
      },
      playerId: this.#localPlayerIdentity.playerId
    });
  }

  #createTraversalActionIntentSnapshot(
    locomotionMode: MetaverseHudSnapshot["locomotionMode"],
    jumpPressed: boolean
  ): {
    readonly kind: "none" | "jump";
    readonly pressed: boolean;
  } {
    if (locomotionMode !== "grounded") {
      return Object.freeze({
        kind: "none",
        pressed: false
      });
    }

    return Object.freeze({
      kind: jumpPressed ? "jump" : "none",
      pressed: jumpPressed
    });
  }

  syncLocalPlayerLook(
    lookSnapshot:
      | Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">
      | null
  ): void {
    if (
      this.#metaverseWorldClient === null ||
      this.#localPlayerIdentity === null
    ) {
      this.#metaverseWorldClient?.syncPlayerLookIntent(null);
      return;
    }

    if (lookSnapshot === null) {
      this.#metaverseWorldClient.syncPlayerLookIntent(null);
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
    const worldSnapshotBuffer = this.#metaverseWorldClient?.worldSnapshotBuffer ?? [];

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
      ) ??
      readMetaverseWorldPlayerSnapshotByPlayerId(
        latestWorldSnapshot,
        this.#localPlayerIdentity.playerId
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

  #readAckedLocalPlayerReplaySeconds(
    latestWorldSnapshot: MetaverseRealtimeWorldSnapshot
  ): number {
    const localWallClockMs = this.#readWallClockMs();

    this.#authoritativeServerClock.observeServerTime(
      Number(latestWorldSnapshot.tick.emittedAtServerTimeMs),
      localWallClockMs
    );

    const authoritativeSimulationAgeMs =
      this.#authoritativeServerClock.readEstimatedServerTimeMs(localWallClockMs) -
      Number(latestWorldSnapshot.tick.simulationTimeMs);
    const hiddenTruthDelayMs = Math.max(
      0,
      -(this.#authoritativeServerClock.clockOffsetEstimateMs ?? 0)
    );
    const replayHorizonMs = clamp(
      authoritativeSimulationAgeMs + hiddenTruthDelayMs,
      0,
      this.#maxAckedReplayHorizonMs
    );

    return replayHorizonMs / 1000;
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
