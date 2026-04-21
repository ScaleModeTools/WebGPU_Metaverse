import type {
  MetaversePlayerTraversalIntentSnapshotInput,
  MetaverseRealtimeEnvironmentBodySnapshot,
  MetaverseRealtimePlayerSnapshot,
  MetaverseRealtimeVehicleSnapshot,
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared";

import type {
  AuthoritativeServerClockConfig,
  MetaverseWorldClientRuntime,
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
  MountedEnvironmentSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseRemoteEnvironmentBodyPresentationSnapshot,
  MetaverseRemoteVehiclePresentationSnapshot,
  MetaverseRuntimeConfig
} from "../types/metaverse-runtime";
import { metaverseRuntimeConfig } from "../config/metaverse-runtime";
import type { MetaverseLocalPlayerIdentity } from "./metaverse-presence-runtime";
import type {
  MetaverseIssuedTraversalIntentInputSnapshot,
  RoutedDriverVehicleControlIntentSnapshot
} from "../traversal/types/traversal";
import type {
  AckedAuthoritativeLocalPlayerPose,
  ConsumedAckedAuthoritativeLocalPlayerSample
} from "../traversal/reconciliation/authoritative-local-player-reconciliation";
import {
  resolveMetaverseRemoteWorldSampledFrame
} from "../remote-world/metaverse-remote-world-sampling";
import { MetaverseRemoteWorldCommandTransport } from "../remote-world/metaverse-remote-world-command-transport";
import { MetaverseRemoteWorldConnectionLifecycle } from "../remote-world/metaverse-remote-world-connection-lifecycle";
import {
  MetaverseRemoteWorldAuthoritativeSnapshotState,
  type MetaverseRealtimeAuthoritativeLocalPlayerSnapshot
} from "../remote-world/metaverse-remote-world-authoritative-snapshot-state";
import { MetaverseRemoteWorldPresentationState } from "../remote-world/metaverse-remote-world-presentation-state";
import {
  MetaverseRemoteWorldSamplingState,
  type MetaverseRemoteWorldSamplingTelemetrySnapshot
} from "../remote-world/metaverse-remote-world-sampling-state";
import type {
  MetaverseWorldSnapshotStreamTelemetrySnapshot
} from "@/network";
export type { MetaverseWorldClientRuntime } from "@/network";

export interface MetaverseRemoteWorldSamplingConfig
  extends AuthoritativeServerClockConfig {
  readonly interpolationDelayMs: number;
  readonly maxExtrapolationMs: number;
  readonly remoteCharacterRootInterpolationDelayMs: number;
  readonly remoteCharacterRootMaxExtrapolationMs: number;
}

interface MetaverseRemoteWorldRuntimeDependencies {
  readonly createMetaverseWorldClient:
    | ((
        dependencies?: {
          readonly readEstimatedServerTimeMs?:
            | ((localWallClockMs: number) => number)
            | undefined;
        }
      ) => MetaverseWorldClientRuntime)
    | null;
  readonly localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly onRemoteWorldUpdate: () => void;
  readonly presentationConfig?: Pick<
    MetaverseRuntimeConfig,
    "bodyPresentation" | "groundedBody"
  >;
  readonly readWallClockMs?: () => number;
  readonly samplingConfig: MetaverseRemoteWorldSamplingConfig;
}

export class MetaverseRemoteWorldRuntime {
  readonly #commandTransport: MetaverseRemoteWorldCommandTransport;
  readonly #connectionRequired: boolean;
  readonly #connectionLifecycle: MetaverseRemoteWorldConnectionLifecycle;
  readonly #remoteWorldAuthoritativeSnapshotState: MetaverseRemoteWorldAuthoritativeSnapshotState;
  readonly #remoteWorldPresentationState: MetaverseRemoteWorldPresentationState;
  readonly #samplingState: MetaverseRemoteWorldSamplingState;

  constructor({
    createMetaverseWorldClient,
    localPlayerIdentity,
    onRemoteWorldUpdate,
    presentationConfig,
    readWallClockMs,
    samplingConfig
  }: MetaverseRemoteWorldRuntimeDependencies) {
    this.#connectionRequired =
      createMetaverseWorldClient !== null && localPlayerIdentity !== null;
    const resolvedReadWallClockMs = readWallClockMs ?? Date.now;
    const authoritativeServerClock = new AuthoritativeServerClock({
      clockOffsetCorrectionAlpha: samplingConfig.clockOffsetCorrectionAlpha,
      clockOffsetMaxStepMs: samplingConfig.clockOffsetMaxStepMs
    });
    this.#commandTransport = new MetaverseRemoteWorldCommandTransport({
      localPlayerIdentity,
      readWorldClient: () => this.#connectionLifecycle.worldClient
    });
    this.#connectionLifecycle = new MetaverseRemoteWorldConnectionLifecycle({
      createMetaverseWorldClient:
        createMetaverseWorldClient === null
          ? null
          : () =>
              createMetaverseWorldClient({
                readEstimatedServerTimeMs: (localWallClockMs) =>
                  authoritativeServerClock.readEstimatedServerTimeMs(
                    localWallClockMs
                  )
              }),
      localPlayerIdentity,
      onRemoteWorldUpdate
    });
    this.#remoteWorldPresentationState = new MetaverseRemoteWorldPresentationState(
      presentationConfig ?? metaverseRuntimeConfig
    );
    this.#remoteWorldAuthoritativeSnapshotState =
      new MetaverseRemoteWorldAuthoritativeSnapshotState({
        authoritativeServerClock,
        readLatestPlayerInputSequence: () =>
          this.#connectionLifecycle.worldClient?.latestPlayerInputSequence ?? 0,
        readLatestPlayerTraversalOrientationSequence: () =>
          this.#connectionLifecycle.worldClient
            ?.latestPlayerTraversalOrientationSequence ?? 0,
        readLatestPlayerWeaponSequence: () =>
          this.#connectionLifecycle.worldClient?.latestPlayerWeaponSequence ?? 0,
        readLocalPlayerId: () => localPlayerIdentity?.playerId ?? null,
        readWallClockMs: resolvedReadWallClockMs,
        readWorldSnapshotBuffer: () =>
          this.#connectionLifecycle.worldClient?.worldSnapshotBuffer ?? []
      });
    this.#samplingState = new MetaverseRemoteWorldSamplingState({
      authoritativeServerClock,
      interpolationDelayMs: samplingConfig.interpolationDelayMs,
      localPlayerIdentity,
      maxExtrapolationMs: samplingConfig.maxExtrapolationMs,
      remoteCharacterRootInterpolationDelayMs:
        samplingConfig.remoteCharacterRootInterpolationDelayMs,
      remoteCharacterRootMaxExtrapolationMs:
        samplingConfig.remoteCharacterRootMaxExtrapolationMs,
      presentationState: this.#remoteWorldPresentationState,
      readWallClockMs: resolvedReadWallClockMs,
      readWorldClient: () => this.#connectionLifecycle.worldClient
    });
  }

  get hasWorldSnapshot(): boolean {
    return (this.#connectionLifecycle.worldClient?.worldSnapshotBuffer.length ?? 0) > 0;
  }

  get connectionRequired(): boolean {
    return this.#connectionRequired;
  }

  get isConnected(): boolean {
    return this.#connectionLifecycle.worldClient?.statusSnapshot.connected ?? false;
  }

  get currentPollIntervalMs(): number | null {
    return this.#connectionLifecycle.worldClient?.currentPollIntervalMs ?? null;
  }

  get samplingTelemetrySnapshot(): MetaverseRemoteWorldSamplingTelemetrySnapshot {
    return this.#samplingState.samplingTelemetrySnapshot;
  }

  get snapshotStreamTelemetrySnapshot(): MetaverseWorldSnapshotStreamTelemetrySnapshot {
    return this.#samplingState.snapshotStreamTelemetrySnapshot;
  }

  get latestAuthoritativeTickIntervalMs(): number | null {
    return this.#samplingState.latestAuthoritativeTickIntervalMs;
  }

  get reliableTransportStatusSnapshot(): RealtimeReliableTransportStatusSnapshot {
    return (
      this.#connectionLifecycle.worldClient?.reliableTransportStatusSnapshot ??
      createDisabledRealtimeReliableTransportStatusSnapshot()
    );
  }

  get driverVehicleControlDatagramStatusSnapshot():
    | RealtimeDatagramTransportStatusSnapshot {
    return (
      this.#connectionLifecycle.worldClient
        ?.driverVehicleControlDatagramStatusSnapshot ??
      createDisabledRealtimeDatagramTransportStatusSnapshot()
    );
  }

  get remoteCharacterPresentations(): readonly MetaverseRemoteCharacterPresentationSnapshot[] {
    return this.#remoteWorldPresentationState.remoteCharacterPresentations;
  }

  get remoteVehiclePresentations(): readonly MetaverseRemoteVehiclePresentationSnapshot[] {
    return this.#remoteWorldPresentationState.remoteVehiclePresentations;
  }

  get remoteEnvironmentBodyPresentations():
    readonly MetaverseRemoteEnvironmentBodyPresentationSnapshot[] {
    return this.#remoteWorldPresentationState.remoteEnvironmentBodyPresentations;
  }

  readFreshAuthoritativeLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeAuthoritativeLocalPlayerSnapshot | null {
    return this.#remoteWorldAuthoritativeSnapshotState.readFreshAuthoritativeLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );
  }

  readFreshAckedAuthoritativeLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeAuthoritativeLocalPlayerSnapshot | null {
    return this.#remoteWorldAuthoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(
      maxAuthoritativeSnapshotAgeMs
    );
  }

  readFreshAckedAuthoritativeLocalPlayerPose(
    maxAuthoritativeSnapshotAgeMs: number
  ): AckedAuthoritativeLocalPlayerPose | null {
    return this.#remoteWorldAuthoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerPose(
      maxAuthoritativeSnapshotAgeMs
    );
  }

  readFreshAckedAuthoritativeLocalPlayerSample(
    maxAuthoritativeSnapshotAgeMs: number
  ): ConsumedAckedAuthoritativeLocalPlayerSample | null {
    return this.#remoteWorldAuthoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSample(
      maxAuthoritativeSnapshotAgeMs
    );
  }

  consumeFreshAckedAuthoritativeLocalPlayerSample(
    maxAuthoritativeSnapshotAgeMs: number
  ): ConsumedAckedAuthoritativeLocalPlayerSample | null {
    return this.#remoteWorldAuthoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerSample(
      maxAuthoritativeSnapshotAgeMs
    );
  }

  consumeFreshAckedAuthoritativeLocalPlayerPose(
    maxAuthoritativeSnapshotAgeMs: number
  ): AckedAuthoritativeLocalPlayerPose | null {
    return this.#remoteWorldAuthoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(
      maxAuthoritativeSnapshotAgeMs
    );
  }

  readFreshAuthoritativeVehicleSnapshot(
    environmentAssetId: string,
    maxAuthoritativeSnapshotAgeMs: number
  ): MetaverseRealtimeVehicleSnapshot | null {
    return this.#remoteWorldAuthoritativeSnapshotState.readFreshAuthoritativeVehicleSnapshot(
      environmentAssetId,
      maxAuthoritativeSnapshotAgeMs
    );
  }

  readFreshAuthoritativeEnvironmentBodySnapshots(
    maxAuthoritativeSnapshotAgeMs: number
  ): readonly MetaverseRealtimeEnvironmentBodySnapshot[] {
    return this.#remoteWorldAuthoritativeSnapshotState.readFreshAuthoritativeEnvironmentBodySnapshots(
      maxAuthoritativeSnapshotAgeMs
    );
  }

  readFreshAuthoritativeRemotePlayerSnapshots(
    maxAuthoritativeSnapshotAgeMs: number
  ): readonly MetaverseRealtimePlayerSnapshot[] {
    return this.#remoteWorldAuthoritativeSnapshotState.readFreshAuthoritativeRemotePlayerSnapshots(
      maxAuthoritativeSnapshotAgeMs
    );
  }

  boot(): void {
    this.#connectionLifecycle.boot();
  }

  dispose(): void {
    this.#connectionLifecycle.dispose();
    this.#samplingState.reset();
    this.#remoteWorldAuthoritativeSnapshotState.clear();
  }

  syncConnection(presenceJoined: boolean): void {
    this.#connectionLifecycle.syncConnection(presenceJoined);
  }

  sampleRemoteWorld(): void {
    this.#samplingState.sampleRemoteWorld();
  }

  syncLocalDriverVehicleControl(
    controlIntentSnapshot: RoutedDriverVehicleControlIntentSnapshot | null
  ): void {
    this.#commandTransport.syncLocalDriverVehicleControl(controlIntentSnapshot);
  }

  syncMountedOccupancy(
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void {
    this.#commandTransport.syncMountedOccupancy(mountedEnvironment);
  }

  syncLocalTraversalIntent(
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null
  ): MetaverseIssuedTraversalIntentInputSnapshot | null {
    return this.#commandTransport.syncLocalTraversalIntent(traversalIntentInput);
  }

  previewLocalTraversalIntent(
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null
  ): MetaverseIssuedTraversalIntentInputSnapshot | null {
    return this.#commandTransport.previewLocalTraversalIntent(
      traversalIntentInput
    );
  }

  syncLocalPlayerLook(
    lookSnapshot:
      | Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">
      | null
  ): void {
    this.#commandTransport.syncLocalPlayerLook(lookSnapshot);
  }

  syncLocalPlayerWeaponState(
    weaponState: MetaverseRealtimePlayerSnapshot["weaponState"] | null
  ): void {
    this.#commandTransport.syncLocalPlayerWeaponState(weaponState);
  }
}
