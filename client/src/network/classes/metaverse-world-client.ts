import type {
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot,
  MetaverseSyncDriverVehicleControlCommandInput,
  MetaverseSyncPlayerLookIntentCommandInput,
  MetaverseSyncMountedOccupancyCommandInput,
  MetaverseSyncPlayerWeaponStateCommandInput,
  MetaverseSyncPlayerTraversalIntentCommandInput
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseSyncPlayerWeaponStateCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncPlayerTraversalIntentCommand
} from "@webgpu-metaverse/shared/metaverse/realtime";

import { createMetaverseWorldHttpTransport } from "../adapters/metaverse-world-http-transport";
import type { MetaverseWorldSnapshotStreamTransport } from "../types/metaverse-world-snapshot-stream-transport";
import type { MetaverseRealtimeWorldLatestWinsDatagramTransport } from "../types/metaverse-realtime-world-latest-wins-datagram-transport";
import type {
  MetaverseWorldClientConfig,
  MetaverseWorldClientTelemetrySnapshot,
  MetaverseWorldClientStatusSnapshot
} from "../types/metaverse-world-client";
import type { MetaversePlayerIssuedTraversalIntentSnapshot } from "../types/metaverse-player-issued-traversal-intent";
import type { MetaverseWorldTransport } from "../types/metaverse-world-transport";
import {
  createRealtimeDatagramTransportStatusSnapshot,
  createRealtimeReliableTransportStatusSnapshot,
  type RealtimeDatagramTransportStatusSnapshot,
  type RealtimeReliableTransportStatusSnapshot
} from "../types/realtime-transport-status";
import {
  MetaverseWorldConnectionLifecycle
} from "./metaverse-world-connection-lifecycle";
import {
  MetaverseWorldDriverControlSync,
  type MetaverseWorldDriverControlDatagramStatusContext
} from "./metaverse-world-driver-control-sync";
import { MetaverseWorldLatestWinsCommandLane } from "./metaverse-world-latest-wins-command-lane";
import { MetaverseWorldMountedOccupancySync } from "./metaverse-world-mounted-occupancy-sync";
import { MetaverseWorldPlayerIntentSync } from "./metaverse-world-player-intent-sync";
import { MetaverseWorldSnapshotState } from "./metaverse-world-snapshot-state";

interface MetaverseWorldClientDependencies {
  readonly clearTimeout?: typeof globalThis.clearTimeout;
  readonly fetch?: typeof globalThis.fetch;
  readonly latestWinsDatagramTransport?: MetaverseRealtimeWorldLatestWinsDatagramTransport;
  readonly readWallClockMs?: () => number;
  readonly resolveDriverVehicleControlDatagramTransportStatusSnapshot?:
    | ((
        context: MetaverseWorldDriverControlDatagramStatusContext
      ) => RealtimeDatagramTransportStatusSnapshot)
    | undefined;
  readonly resolveReliableTransportStatusSnapshot?:
    | (() => RealtimeReliableTransportStatusSnapshot)
    | undefined;
  readonly setTimeout?: typeof globalThis.setTimeout;
  readonly snapshotStreamTransport?: MetaverseWorldSnapshotStreamTransport;
  readonly transport?: MetaverseWorldTransport;
}

type PendingPlayerTraversalIntentCommand = ReturnType<
  typeof createMetaverseSyncPlayerTraversalIntentCommand
>;
type PendingPlayerLookIntentCommand = ReturnType<
  typeof createMetaverseSyncPlayerLookIntentCommand
>;
type PendingPlayerWeaponStateCommand = ReturnType<
  typeof createMetaverseSyncPlayerWeaponStateCommand
>;

function resolveMembershipLossMessage(message: string): string | null {
  if (message.startsWith("Unknown metaverse player:")) {
    return "You are no longer connected to the authoritative metaverse world.";
  }

  return null;
}

function freezeWorldClientTelemetrySnapshot(
  snapshot: MetaverseWorldClientTelemetrySnapshot
): MetaverseWorldClientTelemetrySnapshot {
  return Object.freeze({
    driverVehicleControlDatagramSendFailureCount:
      snapshot.driverVehicleControlDatagramSendFailureCount,
    latestSnapshotUpdateRateHz: snapshot.latestSnapshotUpdateRateHz,
    playerLookInputDatagramSendFailureCount:
      snapshot.playerLookInputDatagramSendFailureCount,
    playerTraversalInputDatagramSendFailureCount:
      snapshot.playerTraversalInputDatagramSendFailureCount,
    snapshotStream: Object.freeze({
      available: snapshot.snapshotStream.available,
      fallbackActive: snapshot.snapshotStream.fallbackActive,
      lastTransportError: snapshot.snapshotStream.lastTransportError,
      liveness: snapshot.snapshotStream.liveness,
      path: snapshot.snapshotStream.path,
      reconnectCount: snapshot.snapshotStream.reconnectCount
    })
  });
}

export class MetaverseWorldClient {
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #connectionLifecycle: MetaverseWorldConnectionLifecycle;
  readonly #config: MetaverseWorldClientConfig;
  readonly #driverControlSync: MetaverseWorldDriverControlSync;
  readonly #latestWinsDatagramTransport: MetaverseRealtimeWorldLatestWinsDatagramTransport | null;
  readonly #mountedOccupancySync: MetaverseWorldMountedOccupancySync;
  readonly #playerIntentSync: MetaverseWorldPlayerIntentSync;
  readonly #playerLookDatagramLane:
    MetaverseWorldLatestWinsCommandLane<
      ReturnType<typeof createMetaverseSyncPlayerLookIntentCommand>
    >;
  readonly #playerTraversalDatagramLane:
    MetaverseWorldLatestWinsCommandLane<
      ReturnType<typeof createMetaverseSyncPlayerTraversalIntentCommand>
    >;
  readonly #playerWeaponStateDatagramLane:
    MetaverseWorldLatestWinsCommandLane<
      ReturnType<typeof createMetaverseSyncPlayerWeaponStateCommand>
    >;
  readonly #readWallClockMs: () => number;
  readonly #resolveDriverVehicleControlDatagramTransportStatusSnapshot:
    | ((
        context: MetaverseWorldDriverControlDatagramStatusContext
      ) => RealtimeDatagramTransportStatusSnapshot)
    | null;
  readonly #resolveReliableTransportStatusSnapshot:
    | (() => RealtimeReliableTransportStatusSnapshot)
    | null;
  readonly #setTimeout: typeof globalThis.setTimeout;
  readonly #snapshotState: MetaverseWorldSnapshotState;
  readonly #transport: MetaverseWorldTransport;
  readonly #updateListeners = new Set<() => void>();

  constructor(
    config: MetaverseWorldClientConfig,
    dependencies: MetaverseWorldClientDependencies = {}
  ) {
    this.#config = config;
    this.#latestWinsDatagramTransport =
      dependencies.latestWinsDatagramTransport ?? null;
    this.#readWallClockMs = dependencies.readWallClockMs ?? Date.now;
    this.#resolveDriverVehicleControlDatagramTransportStatusSnapshot =
      dependencies.resolveDriverVehicleControlDatagramTransportStatusSnapshot ??
      null;
    this.#resolveReliableTransportStatusSnapshot =
      dependencies.resolveReliableTransportStatusSnapshot ?? null;
    this.#setTimeout =
      dependencies.setTimeout ?? globalThis.setTimeout.bind(globalThis);
    this.#clearTimeout =
      dependencies.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
    this.#transport =
      dependencies.transport ??
      createMetaverseWorldHttpTransport(
        config,
        dependencies.fetch === undefined
          ? {}
          : {
              fetch: dependencies.fetch
            }
      );
    const latestWinsDatagramTransport = this.#latestWinsDatagramTransport;
    this.#playerLookDatagramLane = new MetaverseWorldLatestWinsCommandLane({
      clearTimeout: this.#clearTimeout,
      onStateChange: () => {
        this.#notifyUpdates();
      },
      recoveryDelayMs: Number(this.#config.defaultCommandIntervalMs),
      sendDatagram:
        latestWinsDatagramTransport === null
          ? null
          : async (command) =>
              latestWinsDatagramTransport.sendPlayerLookIntentDatagram(command),
      setTimeout: this.#setTimeout
    });
    this.#playerTraversalDatagramLane =
      new MetaverseWorldLatestWinsCommandLane({
        clearTimeout: this.#clearTimeout,
        onStateChange: () => {
          this.#notifyUpdates();
        },
        recoveryDelayMs: Number(this.#config.defaultCommandIntervalMs),
        sendDatagram:
          latestWinsDatagramTransport === null
            ? null
            : async (command) =>
                latestWinsDatagramTransport.sendPlayerTraversalIntentDatagram(command),
        setTimeout: this.#setTimeout
      });
    this.#playerWeaponStateDatagramLane =
      new MetaverseWorldLatestWinsCommandLane({
        clearTimeout: this.#clearTimeout,
        onStateChange: () => {
          this.#notifyUpdates();
        },
        recoveryDelayMs: Number(this.#config.defaultCommandIntervalMs),
        sendDatagram:
          latestWinsDatagramTransport === null
            ? null
            : async (command) =>
                latestWinsDatagramTransport.sendPlayerWeaponStateDatagram(command),
        setTimeout: this.#setTimeout
      });
    let connectionLifecycle: MetaverseWorldConnectionLifecycle | null = null;
    this.#snapshotState = new MetaverseWorldSnapshotState({
      clearTimeout: this.#clearTimeout,
      maxBufferedSnapshots: this.#config.maxBufferedSnapshots,
      notifyUpdates: () => {
        this.#notifyUpdates();
      },
      onAcceptedWorldEvent: (_worldEvent, source) => {
        this.#playerIntentSync.syncFromAuthoritativeWorld();

        if (source === "snapshot-stream") {
          connectionLifecycle?.cancelPolling();
        }
      },
      onSnapshotStreamFailure: (message) => {
        connectionLifecycle?.handleSnapshotStreamFailure(message);
      },
      readWallClockMs: this.#readWallClockMs,
      setTimeout: this.#setTimeout,
      snapshotStreamReconnectDelayMs: Number(
        this.#config.snapshotStreamReconnectDelayMs
      ),
      snapshotStreamTransport: dependencies.snapshotStreamTransport ?? null
    });
    this.#connectionLifecycle = connectionLifecycle =
      new MetaverseWorldConnectionLifecycle({
        acceptWorldEvent: (playerId, worldEvent, source) => {
          this.#snapshotState.acceptWorldEvent(playerId, worldEvent, source);
        },
        applyWorldAccessError: (error, fallbackMessage) => {
          this.#applyWorldAccessError(error, fallbackMessage);
        },
        beginConnect: (playerId) => {
          this.#snapshotState.beginConnect(playerId);
        },
        clearTimeout: this.#clearTimeout,
        pollWorldSnapshot: (playerId) => this.#transport.pollWorldSnapshot(playerId),
        readStatusSnapshot: () => this.#statusSnapshot,
        readWorldSnapshotBuffer: () => this.#worldSnapshotBuffer,
        resolvePollDelayMs: () => this.#resolvePollDelayMs(),
        setError: (playerId, message) => {
          this.#snapshotState.setError(playerId, message);
        },
        setTimeout: this.#setTimeout,
        shouldUsePollingHappyPath: () => this.#shouldUsePollingHappyPath(),
        startSnapshotStream: (playerId) => {
          this.#snapshotState.startSnapshotStream(playerId);
        },
        supportsSnapshotStream: () => this.#snapshotState.supportsSnapshotStream,
        syncConnectedOwners: () => {
          this.#driverControlSync.syncConnection();
        }
      });
    this.#playerIntentSync = new MetaverseWorldPlayerIntentSync({
      acceptWorldEvent: (playerId, worldEvent) => {
        this.#snapshotState.acceptWorldEvent(playerId, worldEvent, "command");
      },
      applyWorldAccessError: (error, fallbackMessage) => {
        this.#applyWorldAccessError(error, fallbackMessage);
      },
      clearTimeout: this.#clearTimeout,
      readLatestLocalPlayerSnapshot: () =>
        this.#snapshotState.readLatestLocalPlayerSnapshot(
          this.#connectionLifecycle.playerId
        ),
      readPlayerId: () => this.#connectionLifecycle.playerId,
      readWallClockMs: this.#readWallClockMs,
      readStatusSnapshot: () => this.#statusSnapshot,
      resolveCommandDelayMs: () => this.#resolveCommandDelayMs(),
      sendPlayerLookIntentCommand: (command) =>
        this.#sendPlayerLookIntentCommand(command),
      sendPlayerWeaponStateCommand: (command) =>
        this.#sendPlayerWeaponStateCommand(command),
      sendPlayerTraversalIntentCommand: (command) =>
        this.#sendPlayerTraversalIntentCommand(command),
      setTimeout: this.#setTimeout
    });
    this.#driverControlSync = new MetaverseWorldDriverControlSync({
      acceptWorldEvent: (playerId, worldEvent) => {
        this.#snapshotState.acceptWorldEvent(playerId, worldEvent, "command");
      },
      applyWorldAccessError: (error, fallbackMessage) => {
        this.#applyWorldAccessError(error, fallbackMessage);
      },
      clearTimeout: this.#clearTimeout,
      latestWinsDatagramTransport,
      notifyUpdates: () => {
        this.#notifyUpdates();
      },
      readPlayerId: () => this.#connectionLifecycle.playerId,
      readStatusSnapshot: () => this.#statusSnapshot,
      readWallClockMs: this.#readWallClockMs,
      resolveCommandDelayMs: () => this.#resolveCommandDelayMs(),
      sendReliableCommand: (command) => this.#transport.sendCommand(command),
      setTimeout: this.#setTimeout
    });
    this.#mountedOccupancySync = new MetaverseWorldMountedOccupancySync({
      acceptWorldEvent: (playerId, worldEvent) => {
        this.#snapshotState.acceptWorldEvent(playerId, worldEvent, "command");
      },
      applyWorldAccessError: (error, fallbackMessage) => {
        this.#applyWorldAccessError(error, fallbackMessage);
      },
      readStatusSnapshot: () => this.#statusSnapshot,
      sendReliableCommand: (command) => this.#transport.sendCommand(command)
    });
  }

  get #statusSnapshot(): MetaverseWorldClientStatusSnapshot {
    return this.#snapshotState.statusSnapshot;
  }

  get #worldSnapshotBuffer(): readonly MetaverseRealtimeWorldSnapshot[] {
    return this.#snapshotState.worldSnapshotBuffer;
  }

  get statusSnapshot(): MetaverseWorldClientStatusSnapshot {
    return this.#snapshotState.statusSnapshot;
  }

  get telemetrySnapshot(): MetaverseWorldClientTelemetrySnapshot {
    return freezeWorldClientTelemetrySnapshot({
      driverVehicleControlDatagramSendFailureCount:
        this.#driverControlSync.failureCount,
      latestSnapshotUpdateRateHz: this.#snapshotState.latestSnapshotUpdateRateHz,
      playerLookInputDatagramSendFailureCount:
        this.#playerLookDatagramLane.failureCount,
      playerTraversalInputDatagramSendFailureCount:
        this.#playerTraversalDatagramLane.failureCount,
      snapshotStream: this.#snapshotState.snapshotStreamTelemetrySnapshot
    });
  }

  get worldSnapshotBuffer(): readonly MetaverseRealtimeWorldSnapshot[] {
    return this.#worldSnapshotBuffer;
  }

  get latestAcceptedSnapshotReceivedAtMs(): number | null {
    return this.#snapshotState.latestAcceptedSnapshotReceivedAtMs;
  }

  get latestPlayerTraversalSequence(): number {
    return this.#playerIntentSync.latestPlayerTraversalSequence;
  }

  get latestPlayerLookSequence(): number {
    return this.#playerIntentSync.latestPlayerLookSequence;
  }

  get latestPlayerWeaponSequence(): number {
    return this.#playerIntentSync.latestPlayerWeaponSequence;
  }

  get latestPlayerIssuedTraversalIntentSnapshot():
    | MetaversePlayerIssuedTraversalIntentSnapshot
    | null {
    return this.#playerIntentSync.latestPlayerIssuedTraversalIntentSnapshot;
  }

  previewPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerIssuedTraversalIntentSnapshot | null {
    if (commandInput === null) {
      return null;
    }

    this.#assertNotDisposed();

    if (
      this.#connectionLifecycle.playerId !== null &&
      this.#connectionLifecycle.playerId !== commandInput.playerId
    ) {
      throw new Error(
        "Metaverse world client already connected with a different player."
      );
    }

    return this.#playerIntentSync.previewPlayerTraversalIntent(commandInput);
  }

  get currentPollIntervalMs(): number {
    return this.#connectionLifecycle.currentPollIntervalMs;
  }

  get reliableTransportStatusSnapshot(): RealtimeReliableTransportStatusSnapshot {
    return (
      this.#resolveReliableTransportStatusSnapshot?.() ??
      createRealtimeReliableTransportStatusSnapshot({
        activeTransport: "http",
        browserWebTransportAvailable: false,
        enabled: true,
        fallbackActive: false,
        lastTransportError: null,
        preference: "http",
        webTransportConfigured: false,
        webTransportStatus: "not-requested"
      })
    );
  }

  get driverVehicleControlDatagramStatusSnapshot():
    | RealtimeDatagramTransportStatusSnapshot {
    return (
      this.#resolveDriverVehicleControlDatagramTransportStatusSnapshot?.(
        this.#createDriverVehicleControlDatagramTransportStatusContext()
      ) ?? this.#createDefaultDriverVehicleControlDatagramStatusSnapshot()
    );
  }

  get supportsDriverVehicleControlDatagrams(): boolean {
    return this.#driverControlSync.supportsDatagrams;
  }

  subscribeUpdates(listener: () => void): () => void {
    this.#updateListeners.add(listener);

    return () => {
      this.#updateListeners.delete(listener);
    };
  }

  syncDriverVehicleControl(
    commandInput: MetaverseSyncDriverVehicleControlCommandInput | null
  ): void {
    if (commandInput === null) {
      this.#driverControlSync.syncDriverVehicleControl(null);
      return;
    }

    this.#assertNotDisposed();
    this.#connectionLifecycle.bindPlayer(commandInput.playerId);
    this.#driverControlSync.syncDriverVehicleControl(commandInput);
  }

  syncPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerIssuedTraversalIntentSnapshot | null {
    if (commandInput === null) {
      return this.#playerIntentSync.syncPlayerTraversalIntent(null);
    }

    this.#assertNotDisposed();
    this.#connectionLifecycle.bindPlayer(commandInput.playerId);
    return this.#playerIntentSync.syncPlayerTraversalIntent(commandInput);
  }

  syncPlayerLookIntent(
    commandInput: MetaverseSyncPlayerLookIntentCommandInput | null
  ): void {
    if (commandInput === null) {
      this.#playerIntentSync.syncPlayerLookIntent(null);
      return;
    }

    this.#assertNotDisposed();
    this.#connectionLifecycle.bindPlayer(commandInput.playerId);
    this.#playerIntentSync.syncPlayerLookIntent(commandInput);
  }

  syncPlayerWeaponState(
    commandInput: MetaverseSyncPlayerWeaponStateCommandInput | null
  ): void {
    if (commandInput === null) {
      this.#playerIntentSync.syncPlayerWeaponState(null);
      return;
    }

    this.#assertNotDisposed();
    this.#connectionLifecycle.bindPlayer(commandInput.playerId);
    this.#playerIntentSync.syncPlayerWeaponState(commandInput);
  }

  syncMountedOccupancy(
    commandInput: MetaverseSyncMountedOccupancyCommandInput
  ): void {
    this.#assertNotDisposed();
    this.#connectionLifecycle.bindPlayer(commandInput.playerId);
    this.#mountedOccupancySync.syncMountedOccupancy(commandInput);
  }

  async ensureConnected(
    playerId: MetaversePlayerId
  ): Promise<MetaverseRealtimeWorldSnapshot> {
    return this.#connectionLifecycle.ensureConnected(playerId);
  }

  dispose(): void {
    if (this.#statusSnapshot.state === "disposed") {
      return;
    }

    this.#connectionLifecycle.dispose();
    this.#driverControlSync.dispose();
    this.#playerIntentSync.dispose();
    this.#snapshotState.dispose(this.#connectionLifecycle.playerId);
    this.#playerLookDatagramLane.dispose();
    this.#playerTraversalDatagramLane.dispose();
    this.#playerWeaponStateDatagramLane.dispose();
    this.#latestWinsDatagramTransport?.dispose?.();
    this.#transport.dispose?.();
  }

  #resolvePollDelayMs(): number {
    return this.#snapshotState.resolvePollDelayMs(
      Number(this.#config.defaultPollIntervalMs)
    );
  }

  #resolveCommandDelayMs(): number {
    return Number(this.#config.defaultCommandIntervalMs);
  }

  async #sendPlayerLookIntentCommand(
    command: PendingPlayerLookIntentCommand
  ): Promise<MetaverseRealtimeWorldEvent | null> {
    if (
      (await this.#playerLookDatagramLane.send(
        command,
        "Metaverse player look intent datagram send failed."
      )) === "datagram"
    ) {
      return null;
    }

    return this.#transport.sendCommand(command);
  }

  async #sendPlayerTraversalIntentCommand(
    command: PendingPlayerTraversalIntentCommand
  ): Promise<MetaverseRealtimeWorldEvent | null> {
    if (
      (await this.#playerTraversalDatagramLane.send(
        command,
        "Metaverse player traversal intent datagram send failed."
      )) === "datagram"
    ) {
      return null;
    }

    return this.#transport.sendCommand(command);
  }

  async #sendPlayerWeaponStateCommand(
    command: PendingPlayerWeaponStateCommand
  ): Promise<MetaverseRealtimeWorldEvent | null> {
    if (
      (await this.#playerWeaponStateDatagramLane.send(
        command,
        "Metaverse player weapon state datagram send failed."
      )) === "datagram"
    ) {
      return null;
    }

    return this.#transport.sendCommand(command);
  }


  #applyWorldAccessError(error: unknown, fallbackMessage: string): void {
    const message = error instanceof Error ? error.message : fallbackMessage;
    const membershipLossMessage = resolveMembershipLossMessage(message);

    if (membershipLossMessage !== null) {
      this.#snapshotState.setError(
        this.#connectionLifecycle.playerId,
        membershipLossMessage,
        {
        clearBufferedSnapshots: true
        }
      );
      return;
    }

    this.#snapshotState.setError(this.#connectionLifecycle.playerId, message);
  }

  #assertNotDisposed(): void {
    if (this.#isDisposed()) {
      throw new Error("Metaverse world client is already disposed.");
    }
  }

  #isDisposed(): boolean {
    return this.#snapshotState.isDisposed;
  }

  #notifyUpdates(): void {
    for (const listener of this.#updateListeners) {
      listener();
    }
  }

  #shouldUsePollingHappyPath(): boolean {
    return this.#snapshotState.shouldUsePollingHappyPath();
  }

  #createDriverVehicleControlDatagramTransportStatusContext(): MetaverseWorldDriverControlDatagramStatusContext {
    return this.#driverControlSync.datagramStatusContext;
  }

  #createDefaultDriverVehicleControlDatagramStatusSnapshot(): RealtimeDatagramTransportStatusSnapshot {
    const datagramStatusContext =
      this.#createDriverVehicleControlDatagramTransportStatusContext();

    if (!datagramStatusContext.datagramTransportAvailable) {
      return createRealtimeDatagramTransportStatusSnapshot({
        activeTransport: null,
        browserWebTransportAvailable: false,
        enabled: true,
        lastTransportError: null,
        preference: "http",
        state: "unavailable",
        webTransportConfigured: false,
        webTransportStatus: "not-requested"
      });
    }

    if (datagramStatusContext.usingReliableFallback) {
      return createRealtimeDatagramTransportStatusSnapshot({
        activeTransport: "reliable-command-fallback",
        browserWebTransportAvailable: true,
        enabled: true,
        lastTransportError: datagramStatusContext.lastTransportError,
        preference: "webtransport-preferred",
        state: "degraded-to-reliable",
        webTransportConfigured: true,
        webTransportStatus: "runtime-fallback"
      });
    }

    return createRealtimeDatagramTransportStatusSnapshot({
      activeTransport: "webtransport-datagram",
      browserWebTransportAvailable: true,
      enabled: true,
      lastTransportError: datagramStatusContext.lastTransportError,
      preference: "webtransport-preferred",
      state: "active",
      webTransportConfigured: true,
      webTransportStatus: datagramStatusContext.hasSuccessfulDatagramSend
        ? "active"
        : "active"
    });
  }
}
