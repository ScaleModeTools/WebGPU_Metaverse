import type {
  MetaverseDriverVehicleControlIntentSnapshot,
  MetaversePlayerId,
  MetaversePlayerTraversalIntentSnapshot,
  MetaverseRealtimePlayerLookSnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot,
  MetaverseSyncDriverVehicleControlCommandInput,
  MetaverseSyncPlayerLookIntentCommandInput,
  MetaverseSyncMountedOccupancyCommandInput,
  MetaverseSyncPlayerTraversalIntentCommandInput
} from "@webgpu-metaverse/shared";
import {
  createMetaverseDriverVehicleControlIntentSnapshot,
  createMetaversePlayerTraversalIntentSnapshot,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerTraversalIntentCommand
} from "@webgpu-metaverse/shared";

import { createMetaverseWorldHttpTransport } from "../adapters/metaverse-world-http-transport";
import type { MetaverseWorldSnapshotStreamTransport } from "../types/metaverse-world-snapshot-stream-transport";
import type { MetaverseRealtimeWorldLatestWinsDatagramTransport } from "../types/metaverse-realtime-world-latest-wins-datagram-transport";
import type {
  MetaverseWorldClientConfig,
  MetaverseWorldClientTelemetrySnapshot,
  MetaverseWorldSnapshotPath,
  MetaverseWorldSnapshotStreamLiveness,
  MetaverseWorldClientStatusSnapshot
} from "../types/metaverse-world-client";
import type { MetaverseWorldTransport } from "../types/metaverse-world-transport";
import {
  createRealtimeDatagramTransportStatusSnapshot,
  createRealtimeReliableTransportStatusSnapshot,
  type RealtimeDatagramTransportStatusSnapshot,
  type RealtimeReliableTransportStatusSnapshot
} from "../types/realtime-transport-status";

interface MetaverseWorldClientDependencies {
  readonly clearTimeout?: typeof globalThis.clearTimeout;
  readonly fetch?: typeof globalThis.fetch;
  readonly latestWinsDatagramTransport?: MetaverseRealtimeWorldLatestWinsDatagramTransport;
  readonly readWallClockMs?: () => number;
  readonly resolveDriverVehicleControlDatagramTransportStatusSnapshot?:
    | ((
        context: MetaverseWorldDriverVehicleControlDatagramTransportStatusContext
      ) => RealtimeDatagramTransportStatusSnapshot)
    | undefined;
  readonly resolveReliableTransportStatusSnapshot?:
    | (() => RealtimeReliableTransportStatusSnapshot)
    | undefined;
  readonly setTimeout?: typeof globalThis.setTimeout;
  readonly snapshotStreamTransport?: MetaverseWorldSnapshotStreamTransport;
  readonly transport?: MetaverseWorldTransport;
}

interface MetaverseWorldDriverVehicleControlDatagramTransportStatusContext {
  readonly datagramTransportAvailable: boolean;
  readonly hasSuccessfulDatagramSend: boolean;
  readonly lastTransportError: string | null;
  readonly usingReliableFallback: boolean;
}

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

type PendingDriverVehicleControlCommand = ReturnType<
  typeof createMetaverseSyncDriverVehicleControlCommand
>;
type PendingPlayerTraversalIntentCommand = ReturnType<
  typeof createMetaverseSyncPlayerTraversalIntentCommand
>;
type PendingPlayerLookIntentCommand = ReturnType<
  typeof createMetaverseSyncPlayerLookIntentCommand
>;

const latestWinsDatagramFallbackRecoveryDelayMultiplier = 1;

function playerTraversalIntentMatches(
  leftIntent: MetaversePlayerTraversalIntentSnapshot | null,
  rightIntent: MetaverseSyncPlayerTraversalIntentCommandInput["intent"]
): boolean {
  if (leftIntent === null) {
    return false;
  }

  const nextMoveAxis = rightIntent.moveAxis;
  const nextStrafeAxis = rightIntent.strafeAxis;
  const nextYawAxis = rightIntent.yawAxis;

  return (
    leftIntent.boost === (rightIntent.boost === true) &&
    leftIntent.jump === (rightIntent.jump === true) &&
    leftIntent.jumpActionSequence === (rightIntent.jumpActionSequence ?? 0) &&
    leftIntent.locomotionMode === (rightIntent.locomotionMode ?? "grounded") &&
    leftIntent.moveAxis ===
      (typeof nextMoveAxis === "number" && Number.isFinite(nextMoveAxis)
        ? Math.min(1, Math.max(-1, nextMoveAxis))
        : 0) &&
    leftIntent.strafeAxis ===
      (typeof nextStrafeAxis === "number" && Number.isFinite(nextStrafeAxis)
        ? Math.min(1, Math.max(-1, nextStrafeAxis))
        : 0) &&
    leftIntent.yawAxis ===
      (typeof nextYawAxis === "number" && Number.isFinite(nextYawAxis)
        ? Math.min(1, Math.max(-1, nextYawAxis))
        : 0)
  );
}

function driverVehicleControlIntentsMatch(
  leftIntent: MetaverseDriverVehicleControlIntentSnapshot | null,
  rightIntent: MetaverseDriverVehicleControlIntentSnapshot
): boolean {
  if (leftIntent === null) {
    return false;
  }

  return (
    leftIntent.boost === rightIntent.boost &&
    leftIntent.environmentAssetId === rightIntent.environmentAssetId &&
    leftIntent.moveAxis === rightIntent.moveAxis &&
    leftIntent.strafeAxis === rightIntent.strafeAxis &&
    leftIntent.yawAxis === rightIntent.yawAxis
  );
}

function playerLookIntentMatches(
  leftIntent: MetaverseRealtimePlayerLookSnapshot | null,
  rightIntent: MetaverseSyncPlayerLookIntentCommandInput["lookIntent"]
): boolean {
  if (leftIntent === null) {
    return false;
  }

  return (
    leftIntent.pitchRadians ===
      (typeof rightIntent.pitchRadians === "number" &&
      Number.isFinite(rightIntent.pitchRadians)
        ? rightIntent.pitchRadians
        : 0) &&
    leftIntent.yawRadians ===
      (typeof rightIntent.yawRadians === "number" &&
      Number.isFinite(rightIntent.yawRadians)
        ? rightIntent.yawRadians
        : 0)
  );
}

function freezeStatusSnapshot(
  playerId: MetaverseWorldClientStatusSnapshot["playerId"],
  state: MetaverseWorldClientStatusSnapshot["state"],
  connected: boolean,
  lastSnapshotSequence: number | null,
  lastWorldTick: number | null,
  lastError: string | null
): MetaverseWorldClientStatusSnapshot {
  return Object.freeze({
    connected,
    lastError,
    lastSnapshotSequence,
    lastWorldTick,
    playerId,
    state
  });
}

function resolveMembershipLossMessage(message: string): string | null {
  if (message.startsWith("Unknown metaverse player:")) {
    return "You are no longer connected to the authoritative metaverse world.";
  }

  return null;
}

function clampBufferedSnapshotCount(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(rawValue));
}

function freezeWorldClientTelemetrySnapshot(
  snapshot: MetaverseWorldClientTelemetrySnapshot
): MetaverseWorldClientTelemetrySnapshot {
  return Object.freeze({
    driverVehicleControlDatagramSendFailureCount:
      snapshot.driverVehicleControlDatagramSendFailureCount,
    latestSnapshotUpdateRateHz: snapshot.latestSnapshotUpdateRateHz,
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
  readonly #config: MetaverseWorldClientConfig;
  readonly #maxBufferedSnapshots: number;
  readonly #latestWinsDatagramTransport: MetaverseRealtimeWorldLatestWinsDatagramTransport | null;
  readonly #readWallClockMs: () => number;
  readonly #resolveDriverVehicleControlDatagramTransportStatusSnapshot:
    | ((
        context: MetaverseWorldDriverVehicleControlDatagramTransportStatusContext
      ) => RealtimeDatagramTransportStatusSnapshot)
    | null;
  readonly #resolveReliableTransportStatusSnapshot:
    | (() => RealtimeReliableTransportStatusSnapshot)
    | null;
  readonly #setTimeout: typeof globalThis.setTimeout;
  readonly #snapshotStreamTransport: MetaverseWorldSnapshotStreamTransport | null;
  readonly #transport: MetaverseWorldTransport;
  readonly #updateListeners = new Set<() => void>();

  #commandSyncHandle: TimeoutHandle | null = null;
  #commandSyncInFlight = false;
  #connectPromise: Promise<MetaverseRealtimeWorldSnapshot> | null = null;
  #driverVehicleControlDatagramSendFailureCount = 0;
  #hasSuccessfulLatestWinsDatagramSend = false;
  #lastJumpPressed = false;
  #lastDriverVehicleControlIntent: MetaverseDriverVehicleControlIntentSnapshot | null =
    null;
  #lastLatestWinsDatagramError: string | null = null;
  #lastPlayerLookIntent: MetaverseRealtimePlayerLookSnapshot | null = null;
  #lastPlayerTraversalIntent: MetaversePlayerTraversalIntentSnapshot | null = null;
  #latestAcceptedSnapshotReceivedAtMs: number | null = null;
  #previousAcceptedSnapshotReceivedAtMs: number | null = null;
  #nextDriverVehicleControlSequence = 0;
  #nextJumpActionSequence = 0;
  #nextPlayerInputSequence = 0;
  #nextPlayerLookSequence = 0;
  #queuedReliableWorldCommandPromise: Promise<void> = Promise.resolve();
  #pendingDriverVehicleControlCommand: PendingDriverVehicleControlCommand | null =
    null;
  #pendingPlayerLookIntentCommand: PendingPlayerLookIntentCommand | null = null;
  #pendingPlayerTraversalIntentCommand: PendingPlayerTraversalIntentCommand | null =
    null;
  #playerId: MetaversePlayerId | null = null;
  #playerLookInputSyncHandle: TimeoutHandle | null = null;
  #playerLookInputSyncInFlight = false;
  #playerTraversalInputDatagramSendFailureCount = 0;
  #playerTraversalInputSyncHandle: TimeoutHandle | null = null;
  #playerTraversalInputSyncInFlight = false;
  #pollHandle: TimeoutHandle | null = null;
  #latestWinsDatagramFallbackRecoveryHandle: TimeoutHandle | null = null;
  #snapshotStreamDeliveredAcceptedWorldEvent = false;
  #snapshotStreamLastError: string | null = null;
  #snapshotStreamReconnectCount = 0;
  #snapshotStreamReconnectHandle: TimeoutHandle | null = null;
  #snapshotStreamSubscription:
    | ReturnType<MetaverseWorldSnapshotStreamTransport["subscribeWorldSnapshots"]>
    | null = null;
  #statusSnapshot: MetaverseWorldClientStatusSnapshot;
  #useReliableLatestWinsDatagramFallback = false;
  #usingSnapshotStreamFallback = false;
  #worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[] =
    Object.freeze([]);

  constructor(
    config: MetaverseWorldClientConfig,
    dependencies: MetaverseWorldClientDependencies = {}
  ) {
    this.#config = config;
    this.#maxBufferedSnapshots = clampBufferedSnapshotCount(
      config.maxBufferedSnapshots
    );
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
    this.#snapshotStreamTransport = dependencies.snapshotStreamTransport ?? null;
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
    this.#statusSnapshot = freezeStatusSnapshot(
      null,
      "idle",
      false,
      null,
      null,
      null
    );
  }

  get statusSnapshot(): MetaverseWorldClientStatusSnapshot {
    return this.#statusSnapshot;
  }

  get telemetrySnapshot(): MetaverseWorldClientTelemetrySnapshot {
    const snapshotUpdateRateHz =
      this.#latestAcceptedSnapshotReceivedAtMs !== null &&
      this.#previousAcceptedSnapshotReceivedAtMs !== null
        ? 1000 /
          Math.max(
            1,
            this.#latestAcceptedSnapshotReceivedAtMs -
              this.#previousAcceptedSnapshotReceivedAtMs
          )
        : null;

    return freezeWorldClientTelemetrySnapshot({
      driverVehicleControlDatagramSendFailureCount:
        this.#driverVehicleControlDatagramSendFailureCount,
      latestSnapshotUpdateRateHz: snapshotUpdateRateHz,
      playerTraversalInputDatagramSendFailureCount:
        this.#playerTraversalInputDatagramSendFailureCount,
      snapshotStream: {
        available: this.#snapshotStreamTransport !== null,
        fallbackActive: this.#usingSnapshotStreamFallback,
        lastTransportError: this.#snapshotStreamLastError,
        liveness: this.#resolveSnapshotStreamLiveness(),
        path: this.#resolveSnapshotStreamPath(),
        reconnectCount: this.#snapshotStreamReconnectCount
      }
    });
  }

  get worldSnapshotBuffer(): readonly MetaverseRealtimeWorldSnapshot[] {
    return this.#worldSnapshotBuffer;
  }

  get latestPlayerInputSequence(): number {
    return this.#nextPlayerInputSequence;
  }

  get latestPlayerTraversalIntentSnapshot():
    | MetaversePlayerTraversalIntentSnapshot
    | null {
    return this.#lastPlayerTraversalIntent;
  }

  get currentPollIntervalMs(): number {
    return this.#resolvePollDelayMs();
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
    return (
      this.#latestWinsDatagramTransport !== null &&
      !this.#useReliableLatestWinsDatagramFallback
    );
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
      this.#lastDriverVehicleControlIntent = null;
      this.#pendingDriverVehicleControlCommand = null;
      this.#cancelScheduledCommandSync();
      return;
    }

    this.#assertNotDisposed();

    if (this.#playerId !== null && this.#playerId !== commandInput.playerId) {
      throw new Error(
        "Metaverse world client already connected with a different player."
      );
    }

    this.#playerId ??= commandInput.playerId;

    const nextControlIntent = createMetaverseDriverVehicleControlIntentSnapshot(
      commandInput.controlIntent
    );

    if (
      driverVehicleControlIntentsMatch(
        this.#lastDriverVehicleControlIntent,
        nextControlIntent
      )
    ) {
      return;
    }

    this.#lastDriverVehicleControlIntent = nextControlIntent;
    this.#nextDriverVehicleControlSequence += 1;
    this.#pendingDriverVehicleControlCommand =
      createMetaverseSyncDriverVehicleControlCommand({
        controlIntent: nextControlIntent,
        controlSequence: this.#nextDriverVehicleControlSequence,
        playerId: commandInput.playerId
      });

    if (this.#statusSnapshot.connected) {
      this.#scheduleCommandSync(this.#resolveCommandDelayMs());
    }
  }

  syncPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): void {
    if (commandInput === null) {
      this.#lastJumpPressed = false;
      this.#lastPlayerTraversalIntent = null;
      this.#pendingPlayerTraversalIntentCommand = null;
      this.#cancelScheduledPlayerTraversalInputSync();
      return;
    }

    this.#assertNotDisposed();

    if (this.#playerId !== null && this.#playerId !== commandInput.playerId) {
      throw new Error(
        "Metaverse world client already connected with a different player."
      );
    }

    this.#playerId ??= commandInput.playerId;

    const jumpPressed = commandInput.intent.jump === true;

    if (jumpPressed && !this.#lastJumpPressed) {
      this.#nextJumpActionSequence += 1;
    }

    this.#lastJumpPressed = jumpPressed;
    const nextIntent = {
      ...commandInput.intent,
      jumpActionSequence: this.#nextJumpActionSequence
    };

    if (
      playerTraversalIntentMatches(
        this.#lastPlayerTraversalIntent,
        nextIntent
      )
    ) {
      return;
    }

    this.#nextPlayerInputSequence += 1;
    this.#pendingPlayerTraversalIntentCommand =
      createMetaverseSyncPlayerTraversalIntentCommand({
      playerId: commandInput.playerId,
      intent: {
        ...nextIntent,
        inputSequence: this.#nextPlayerInputSequence
      }
    });
    this.#lastPlayerTraversalIntent =
      this.#pendingPlayerTraversalIntentCommand.intent;

    if (this.#statusSnapshot.connected) {
      this.#schedulePlayerTraversalInputSync(this.#resolveCommandDelayMs());
    }
  }

  syncPlayerLookIntent(
    commandInput: MetaverseSyncPlayerLookIntentCommandInput | null
  ): void {
    if (commandInput === null) {
      this.#lastPlayerLookIntent = null;
      this.#pendingPlayerLookIntentCommand = null;
      this.#cancelScheduledPlayerLookInputSync();
      return;
    }

    this.#assertNotDisposed();

    if (this.#playerId !== null && this.#playerId !== commandInput.playerId) {
      throw new Error(
        "Metaverse world client already connected with a different player."
      );
    }

    this.#playerId ??= commandInput.playerId;

    if (
      playerLookIntentMatches(
        this.#lastPlayerLookIntent,
        commandInput.lookIntent
      )
    ) {
      return;
    }

    this.#nextPlayerLookSequence += 1;
    this.#pendingPlayerLookIntentCommand = createMetaverseSyncPlayerLookIntentCommand(
      {
        lookIntent: commandInput.lookIntent,
        lookSequence: this.#nextPlayerLookSequence,
        playerId: commandInput.playerId
      }
    );
    this.#lastPlayerLookIntent = this.#pendingPlayerLookIntentCommand.lookIntent;

    if (this.#statusSnapshot.connected) {
      this.#schedulePlayerLookInputSync(this.#resolveCommandDelayMs());
    }
  }

  syncMountedOccupancy(
    commandInput: MetaverseSyncMountedOccupancyCommandInput
  ): void {
    this.#assertNotDisposed();

    if (this.#playerId !== null && this.#playerId !== commandInput.playerId) {
      throw new Error(
        "Metaverse world client already connected with a different player."
      );
    }

    this.#playerId ??= commandInput.playerId;
    this.#enqueueReliableWorldCommand(
      createMetaverseSyncMountedOccupancyCommand(commandInput),
      "Metaverse mounted occupancy sync failed."
    );
  }

  async ensureConnected(
    playerId: MetaversePlayerId
  ): Promise<MetaverseRealtimeWorldSnapshot> {
    this.#assertNotDisposed();

    if (this.#playerId !== null && this.#playerId !== playerId) {
      throw new Error(
        "Metaverse world client already connected with a different player."
      );
    }

    if (
      this.#worldSnapshotBuffer.length > 0 &&
      this.#playerId === playerId &&
      this.#statusSnapshot.connected
    ) {
      return this.#worldSnapshotBuffer[this.#worldSnapshotBuffer.length - 1]!;
    }

    if (this.#connectPromise !== null) {
      return this.#connectPromise;
    }

    this.#playerId = playerId;
    this.#statusSnapshot = freezeStatusSnapshot(
      playerId,
      "connecting",
      false,
      this.#statusSnapshot.lastSnapshotSequence,
      this.#statusSnapshot.lastWorldTick,
      null
    );
    this.#notifyUpdates();

    const connectPromise = this.#connectInternal(playerId);
    this.#connectPromise = connectPromise;

    try {
      return await connectPromise;
    } finally {
      if (this.#connectPromise === connectPromise) {
        this.#connectPromise = null;
      }
    }
  }

  dispose(): void {
    if (this.#statusSnapshot.state === "disposed") {
      return;
    }

    this.#cancelScheduledPoll();
    this.#cancelScheduledCommandSync();
    this.#cancelScheduledPlayerLookInputSync();
    this.#cancelScheduledPlayerTraversalInputSync();
    this.#cancelScheduledLatestWinsDatagramFallbackRecovery();
    this.#cancelScheduledSnapshotStreamReconnect();
    this.#closeSnapshotStreamSubscription();
    this.#snapshotStreamDeliveredAcceptedWorldEvent = false;
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#playerId,
      "disposed",
      false,
      this.#statusSnapshot.lastSnapshotSequence,
      this.#statusSnapshot.lastWorldTick,
      null
    );
    this.#notifyUpdates();
    this.#latestWinsDatagramTransport?.dispose?.();
    this.#snapshotStreamTransport?.dispose?.();
    this.#transport.dispose?.();
  }

  async #connectInternal(
    playerId: MetaversePlayerId
  ): Promise<MetaverseRealtimeWorldSnapshot> {
    try {
      const worldEvent = await this.#transport.pollWorldSnapshot(playerId);

      this.#applyWorldEvent(worldEvent);

      if (!this.#isDisposed()) {
        if (this.#pendingDriverVehicleControlCommand !== null) {
          this.#scheduleCommandSync(0);
        }
        if (this.#pendingPlayerLookIntentCommand !== null) {
          this.#schedulePlayerLookInputSync(0);
        }
        if (this.#pendingPlayerTraversalIntentCommand !== null) {
          this.#schedulePlayerTraversalInputSync(0);
        }
        this.#startSnapshotStream(playerId);

        if (this.#snapshotStreamTransport === null) {
          this.#schedulePoll(0);
        } else if (this.#shouldUsePollingHappyPath()) {
          this.#schedulePoll(this.#resolvePollDelayMs());
        }
      }

      return worldEvent.world;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Metaverse world connect failed.";

      this.#setError(message);
      throw error;
    }
  }

  async #pollWorldSnapshot(): Promise<void> {
    if (this.#playerId === null || this.#statusSnapshot.state === "disposed") {
      return;
    }

    try {
      this.#applyWorldEvent(
        await this.#transport.pollWorldSnapshot(this.#playerId)
      );
    } catch (error) {
      this.#applyWorldAccessError(error, "Metaverse world poll failed.");
    } finally {
      if (
        !this.#isDisposed() &&
        this.#playerId !== null &&
        this.#shouldUsePollingHappyPath()
      ) {
        this.#schedulePoll(this.#resolvePollDelayMs());
      }
    }
  }

  #applyWorldEvent(worldEvent: MetaverseRealtimeWorldEvent): boolean {
    if (this.#isDisposed()) {
      return false;
    }

    if (!this.#shouldAcceptWorldSnapshot(worldEvent.world)) {
      return false;
    }

    const acceptedAtMs = this.#readWallClockMs();

    if (Number.isFinite(acceptedAtMs)) {
      this.#previousAcceptedSnapshotReceivedAtMs =
        this.#latestAcceptedSnapshotReceivedAtMs;
      this.#latestAcceptedSnapshotReceivedAtMs = acceptedAtMs;
    }

    const nextBuffer = [
      ...this.#worldSnapshotBuffer.filter(
        (snapshot) =>
          snapshot.snapshotSequence < worldEvent.world.snapshotSequence
      ),
      worldEvent.world
    ];

    this.#worldSnapshotBuffer = Object.freeze(
      nextBuffer.slice(-this.#maxBufferedSnapshots)
    );
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#playerId,
      "connected",
      true,
      worldEvent.world.snapshotSequence,
      worldEvent.world.tick.currentTick,
      null
    );
    this.#notifyUpdates();
    return true;
  }

  #shouldAcceptWorldSnapshot(
    nextSnapshot: MetaverseRealtimeWorldSnapshot
  ): boolean {
    const latestSnapshot =
      this.#worldSnapshotBuffer[this.#worldSnapshotBuffer.length - 1] ?? null;

    if (latestSnapshot === null) {
      return true;
    }

    return nextSnapshot.snapshotSequence >= latestSnapshot.snapshotSequence;
  }

  #resolvePollDelayMs(): number {
    const latestSnapshot =
      this.#worldSnapshotBuffer[this.#worldSnapshotBuffer.length - 1] ?? null;

    if (latestSnapshot !== null) {
      return Number(latestSnapshot.tick.tickIntervalMs);
    }

    return Number(this.#config.defaultPollIntervalMs);
  }

  #resolveCommandDelayMs(): number {
    return Number(this.#config.defaultCommandIntervalMs);
  }

  #resolveLatestWinsDatagramFallbackRecoveryDelayMs(): number {
    return Math.max(
      1,
      Math.floor(
        this.#resolveCommandDelayMs() *
          latestWinsDatagramFallbackRecoveryDelayMultiplier
      )
    );
  }

  #schedulePoll(delayMs: number): void {
    this.#cancelScheduledPoll();

    if (
      this.#statusSnapshot.state === "disposed" ||
      this.#playerId === null ||
      !this.#shouldUsePollingHappyPath()
    ) {
      return;
    }

    this.#pollHandle = this.#setTimeout(() => {
      this.#pollHandle = null;
      void this.#pollWorldSnapshot();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPoll(): void {
    if (this.#pollHandle === null) {
      return;
    }

    this.#clearTimeout(this.#pollHandle);
    this.#pollHandle = null;
  }

  #startSnapshotStream(playerId: MetaversePlayerId): void {
    if (
      this.#snapshotStreamTransport === null ||
      this.#snapshotStreamSubscription !== null ||
      this.#isDisposed()
    ) {
      return;
    }

    const transportStatusChanged =
      this.#usingSnapshotStreamFallback ||
      this.#snapshotStreamLastError !== null ||
      this.#snapshotStreamReconnectHandle !== null;

    this.#snapshotStreamDeliveredAcceptedWorldEvent = false;
    this.#usingSnapshotStreamFallback = false;
    this.#cancelScheduledSnapshotStreamReconnect();
    this.#snapshotStreamSubscription =
      this.#snapshotStreamTransport.subscribeWorldSnapshots(playerId, {
        onClose: () => {
          this.#handleSnapshotStreamFailure(
            "Metaverse world snapshot stream closed."
          );
        },
        onError: (error) => {
          const message =
            error instanceof Error &&
            typeof error.message === "string" &&
            error.message.trim().length > 0
              ? error.message
              : "Metaverse world snapshot stream failed.";

          this.#handleSnapshotStreamFailure(message);
        },
        onWorldEvent: (worldEvent) => {
          const transportStatusChangedOnEvent =
            this.#usingSnapshotStreamFallback ||
            this.#snapshotStreamLastError !== null ||
            this.#snapshotStreamReconnectHandle !== null ||
            !this.#snapshotStreamDeliveredAcceptedWorldEvent;

          this.#usingSnapshotStreamFallback = false;
          this.#snapshotStreamLastError = null;
          const acceptedWorldEvent = this.#applyWorldEvent(worldEvent);

          if (acceptedWorldEvent) {
            this.#snapshotStreamDeliveredAcceptedWorldEvent = true;
            this.#cancelScheduledPoll();
          }

          this.#cancelScheduledSnapshotStreamReconnect();

          if (transportStatusChangedOnEvent && !acceptedWorldEvent) {
            this.#notifyUpdates();
          }
        }
      });

    if (transportStatusChanged) {
      this.#notifyUpdates();
    }
  }

  #closeSnapshotStreamSubscription(): void {
    if (this.#snapshotStreamSubscription === null) {
      return;
    }

    const subscription = this.#snapshotStreamSubscription;

    this.#snapshotStreamSubscription = null;
    subscription.close();
  }

  #scheduleSnapshotStreamReconnect(): void {
    this.#cancelScheduledSnapshotStreamReconnect();

    if (
      this.#snapshotStreamTransport === null ||
      this.#playerId === null ||
      this.#isDisposed()
    ) {
      return;
    }

    this.#snapshotStreamReconnectCount += 1;

    this.#snapshotStreamReconnectHandle = this.#setTimeout(() => {
      this.#snapshotStreamReconnectHandle = null;

      if (this.#playerId === null || this.#isDisposed()) {
        return;
      }

      this.#startSnapshotStream(this.#playerId);
    }, Math.max(0, Number(this.#config.snapshotStreamReconnectDelayMs)));
  }

  #cancelScheduledSnapshotStreamReconnect(): void {
    if (this.#snapshotStreamReconnectHandle === null) {
      return;
    }

    this.#clearTimeout(this.#snapshotStreamReconnectHandle);
    this.#snapshotStreamReconnectHandle = null;
  }

  #scheduleCommandSync(delayMs: number): void {
    if (
      this.#statusSnapshot.state === "disposed" ||
      this.#playerId === null ||
      !this.#statusSnapshot.connected ||
      this.#pendingDriverVehicleControlCommand === null ||
      this.#commandSyncInFlight ||
      this.#commandSyncHandle !== null
    ) {
      return;
    }

    this.#commandSyncHandle = this.#setTimeout(() => {
      this.#commandSyncHandle = null;
      void this.#flushCommandSync();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledCommandSync(): void {
    if (this.#commandSyncHandle === null) {
      return;
    }

    this.#clearTimeout(this.#commandSyncHandle);
    this.#commandSyncHandle = null;
  }

  #schedulePlayerLookInputSync(delayMs: number): void {
    if (
      this.#statusSnapshot.state === "disposed" ||
      this.#playerId === null ||
      !this.#statusSnapshot.connected ||
      this.#pendingPlayerLookIntentCommand === null ||
      this.#playerLookInputSyncInFlight ||
      this.#playerLookInputSyncHandle !== null
    ) {
      return;
    }

    this.#playerLookInputSyncHandle = this.#setTimeout(() => {
      this.#playerLookInputSyncHandle = null;
      void this.#flushPlayerLookInputSync();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPlayerLookInputSync(): void {
    if (this.#playerLookInputSyncHandle === null) {
      return;
    }

    this.#clearTimeout(this.#playerLookInputSyncHandle);
    this.#playerLookInputSyncHandle = null;
  }

  #schedulePlayerTraversalInputSync(delayMs: number): void {
    if (
      this.#statusSnapshot.state === "disposed" ||
      this.#playerId === null ||
      !this.#statusSnapshot.connected ||
      this.#pendingPlayerTraversalIntentCommand === null ||
      this.#playerTraversalInputSyncInFlight ||
      this.#playerTraversalInputSyncHandle !== null
    ) {
      return;
    }

    this.#playerTraversalInputSyncHandle = this.#setTimeout(() => {
      this.#playerTraversalInputSyncHandle = null;
      void this.#flushPlayerTraversalInputSync();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPlayerTraversalInputSync(): void {
    if (this.#playerTraversalInputSyncHandle === null) {
      return;
    }

    this.#clearTimeout(this.#playerTraversalInputSyncHandle);
    this.#playerTraversalInputSyncHandle = null;
  }

  #scheduleLatestWinsDatagramFallbackRecovery(): void {
    this.#cancelScheduledLatestWinsDatagramFallbackRecovery();

    if (
      this.#statusSnapshot.state === "disposed" ||
      this.#latestWinsDatagramTransport === null
    ) {
      return;
    }

    this.#latestWinsDatagramFallbackRecoveryHandle = this.#setTimeout(() => {
      this.#latestWinsDatagramFallbackRecoveryHandle = null;

      if (
        this.#statusSnapshot.state === "disposed" ||
        !this.#useReliableLatestWinsDatagramFallback
      ) {
        return;
      }

      this.#useReliableLatestWinsDatagramFallback = false;
      this.#notifyUpdates();
    }, this.#resolveLatestWinsDatagramFallbackRecoveryDelayMs());
  }

  #cancelScheduledLatestWinsDatagramFallbackRecovery(): void {
    if (this.#latestWinsDatagramFallbackRecoveryHandle === null) {
      return;
    }

    this.#clearTimeout(this.#latestWinsDatagramFallbackRecoveryHandle);
    this.#latestWinsDatagramFallbackRecoveryHandle = null;
  }

  #handleSuccessfulLatestWinsDatagramSend(): void {
    const transportStatusChanged =
      !this.#hasSuccessfulLatestWinsDatagramSend ||
      this.#useReliableLatestWinsDatagramFallback ||
      this.#lastLatestWinsDatagramError !== null;

    this.#hasSuccessfulLatestWinsDatagramSend = true;
    this.#useReliableLatestWinsDatagramFallback = false;
    this.#lastLatestWinsDatagramError = null;
    this.#cancelScheduledLatestWinsDatagramFallbackRecovery();

    if (transportStatusChanged) {
      this.#notifyUpdates();
    }
  }

  #handleLatestWinsDatagramSendFailure(nextError: string): void {
    const transportStatusChanged =
      !this.#useReliableLatestWinsDatagramFallback ||
      this.#lastLatestWinsDatagramError !== nextError;

    this.#lastLatestWinsDatagramError = nextError;
    this.#useReliableLatestWinsDatagramFallback = true;
    this.#scheduleLatestWinsDatagramFallbackRecovery();

    if (transportStatusChanged) {
      this.#notifyUpdates();
    }
  }

  async #flushCommandSync(): Promise<void> {
    if (
      this.#playerId === null ||
      this.#statusSnapshot.state === "disposed" ||
      !this.#statusSnapshot.connected ||
      this.#pendingDriverVehicleControlCommand === null
    ) {
      return;
    }

    const pendingCommand = this.#pendingDriverVehicleControlCommand;

    this.#pendingDriverVehicleControlCommand = null;
    this.#commandSyncInFlight = true;

    try {
      const worldEvent =
        await this.#sendDriverVehicleControlCommand(pendingCommand);

      if (worldEvent !== null) {
        this.#applyWorldEvent(worldEvent);
      }
    } catch (error) {
      this.#applyWorldAccessError(error, "Metaverse world command failed.");
    } finally {
      this.#commandSyncInFlight = false;

      if (
        !this.#isDisposed() &&
        this.#statusSnapshot.connected &&
        this.#pendingDriverVehicleControlCommand !== null
      ) {
        this.#scheduleCommandSync(0);
      }
    }
  }

  async #flushPlayerLookInputSync(): Promise<void> {
    if (
      this.#playerId === null ||
      this.#statusSnapshot.state === "disposed" ||
      !this.#statusSnapshot.connected ||
      this.#pendingPlayerLookIntentCommand === null
    ) {
      return;
    }

    const pendingCommand = this.#pendingPlayerLookIntentCommand;

    this.#pendingPlayerLookIntentCommand = null;
    this.#playerLookInputSyncInFlight = true;

    try {
      const worldEvent = await this.#sendPlayerLookIntentCommand(pendingCommand);

      if (worldEvent !== null) {
        this.#applyWorldEvent(worldEvent);
      }
    } catch (error) {
      this.#applyWorldAccessError(
        error,
        "Metaverse world player look sync failed."
      );
    } finally {
      this.#playerLookInputSyncInFlight = false;

      if (
        !this.#isDisposed() &&
        this.#statusSnapshot.connected &&
        this.#pendingPlayerLookIntentCommand !== null
      ) {
        this.#schedulePlayerLookInputSync(0);
      }
    }
  }

  async #flushPlayerTraversalInputSync(): Promise<void> {
    if (
      this.#playerId === null ||
      this.#statusSnapshot.state === "disposed" ||
      !this.#statusSnapshot.connected ||
      this.#pendingPlayerTraversalIntentCommand === null
    ) {
      return;
    }

    const pendingCommand = this.#pendingPlayerTraversalIntentCommand;

    this.#pendingPlayerTraversalIntentCommand = null;
    this.#playerTraversalInputSyncInFlight = true;

    try {
      const worldEvent =
        await this.#sendPlayerTraversalIntentCommand(pendingCommand);

      if (worldEvent !== null) {
        this.#applyWorldEvent(worldEvent);
      }
    } catch (error) {
      this.#applyWorldAccessError(
        error,
        "Metaverse world traversal intent sync failed."
      );
    } finally {
      this.#playerTraversalInputSyncInFlight = false;

      if (
        !this.#isDisposed() &&
        this.#statusSnapshot.connected &&
        this.#pendingPlayerTraversalIntentCommand !== null
      ) {
        this.#schedulePlayerTraversalInputSync(0);
      }
    }
  }

  async #sendDriverVehicleControlCommand(
    command: PendingDriverVehicleControlCommand
  ): Promise<MetaverseRealtimeWorldEvent | null> {
    if (
      this.#latestWinsDatagramTransport === null ||
      this.#useReliableLatestWinsDatagramFallback
    ) {
      return this.#transport.sendCommand(command);
    }

    try {
      await this.#latestWinsDatagramTransport.sendDriverVehicleControlDatagram(
        command
      );
      this.#handleSuccessfulLatestWinsDatagramSend();

      return null;
    } catch (error) {
      const nextError =
        error instanceof Error &&
        typeof error.message === "string" &&
        error.message.trim().length > 0
          ? error.message
          : "Metaverse driver vehicle control datagram send failed.";

      this.#driverVehicleControlDatagramSendFailureCount += 1;
      this.#handleLatestWinsDatagramSendFailure(nextError);

      return this.#transport.sendCommand(command);
    }
  }

  async #sendPlayerLookIntentCommand(
    command: PendingPlayerLookIntentCommand
  ): Promise<MetaverseRealtimeWorldEvent | null> {
    if (
      this.#latestWinsDatagramTransport === null ||
      this.#useReliableLatestWinsDatagramFallback
    ) {
      return this.#transport.sendCommand(command);
    }

    try {
      await this.#latestWinsDatagramTransport.sendPlayerLookIntentDatagram(
        command
      );
      this.#handleSuccessfulLatestWinsDatagramSend();

      return null;
    } catch (error) {
      const nextError =
        error instanceof Error &&
        typeof error.message === "string" &&
        error.message.trim().length > 0
          ? error.message
          : "Metaverse player look intent datagram send failed.";

      this.#playerTraversalInputDatagramSendFailureCount += 1;
      this.#handleLatestWinsDatagramSendFailure(nextError);

      return this.#transport.sendCommand(command);
    }
  }

  async #sendPlayerTraversalIntentCommand(
    command: PendingPlayerTraversalIntentCommand
  ): Promise<MetaverseRealtimeWorldEvent | null> {
    if (
      this.#latestWinsDatagramTransport === null ||
      this.#useReliableLatestWinsDatagramFallback
    ) {
      return this.#transport.sendCommand(command);
    }

    try {
      await this.#latestWinsDatagramTransport.sendPlayerTraversalIntentDatagram(
        command
      );
      this.#handleSuccessfulLatestWinsDatagramSend();

      return null;
    } catch (error) {
      const nextError =
        error instanceof Error &&
        typeof error.message === "string" &&
        error.message.trim().length > 0
          ? error.message
          : "Metaverse player traversal intent datagram send failed.";

      this.#playerTraversalInputDatagramSendFailureCount += 1;
      this.#handleLatestWinsDatagramSendFailure(nextError);

      return this.#transport.sendCommand(command);
    }
  }

  #enqueueReliableWorldCommand(
    command: ReturnType<typeof createMetaverseSyncMountedOccupancyCommand>,
    fallbackMessage: string
  ): void {
    const queuedCommandPromise = this.#queuedReliableWorldCommandPromise
      .catch(() => undefined)
      .then(async () => {
        this.#applyWorldEvent(await this.#transport.sendCommand(command));
      })
      .catch((error: unknown) => {
        this.#applyWorldAccessError(error, fallbackMessage);
      });

    this.#queuedReliableWorldCommandPromise = queuedCommandPromise;
  }

  #applyWorldAccessError(error: unknown, fallbackMessage: string): void {
    const message = error instanceof Error ? error.message : fallbackMessage;
    const membershipLossMessage = resolveMembershipLossMessage(message);

    if (membershipLossMessage !== null) {
      this.#worldSnapshotBuffer = Object.freeze([]);
      this.#setError(membershipLossMessage);
      return;
    }

    this.#setError(message);
  }

  #handleSnapshotStreamFailure(message: string): void {
    if (this.#isDisposed()) {
      return;
    }

    this.#snapshotStreamSubscription = null;
    this.#snapshotStreamDeliveredAcceptedWorldEvent = false;
    this.#snapshotStreamLastError = message.trim().length > 0 ? message : null;
    this.#usingSnapshotStreamFallback = true;
    this.#schedulePoll(0);
    this.#scheduleSnapshotStreamReconnect();
    this.#notifyUpdates();

    if (message.trim().length > 0) {
      this.#applyWorldAccessError(new Error(message), message);
    }
  }

  #setError(message: string): void {
    if (this.#statusSnapshot.state === "disposed") {
      return;
    }

    this.#statusSnapshot = freezeStatusSnapshot(
      this.#playerId,
      "error",
      this.#worldSnapshotBuffer.length > 0,
      this.#worldSnapshotBuffer[this.#worldSnapshotBuffer.length - 1]
        ?.snapshotSequence ?? null,
      this.#worldSnapshotBuffer[this.#worldSnapshotBuffer.length - 1]?.tick
        .currentTick ?? null,
      message
    );
    this.#notifyUpdates();
  }

  #assertNotDisposed(): void {
    if (this.#isDisposed()) {
      throw new Error("Metaverse world client is already disposed.");
    }
  }

  #isDisposed(): boolean {
    return this.#statusSnapshot.state === "disposed";
  }

  #notifyUpdates(): void {
    for (const listener of this.#updateListeners) {
      listener();
    }
  }

  #resolveSnapshotStreamLiveness(): MetaverseWorldSnapshotStreamLiveness {
    if (this.#snapshotStreamTransport === null) {
      return "inactive";
    }

    if (this.#usingSnapshotStreamFallback) {
      return this.#snapshotStreamReconnectHandle === null
        ? "fallback-polling"
        : "reconnecting";
    }

    if (this.#snapshotStreamSubscription !== null) {
      return "subscribed";
    }

    return this.#snapshotStreamReconnectHandle !== null
      ? "reconnecting"
      : "inactive";
  }

  #resolveSnapshotStreamPath(): MetaverseWorldSnapshotPath {
    if (this.#snapshotStreamTransport === null) {
      return "http-polling";
    }

    if (this.#usingSnapshotStreamFallback) {
      return "fallback-polling";
    }

    return this.#snapshotStreamSubscription !== null
      ? "reliable-snapshot-stream"
      : "http-polling";
  }

  #shouldUsePollingHappyPath(): boolean {
    return (
      this.#snapshotStreamTransport === null ||
      this.#usingSnapshotStreamFallback ||
      !this.#snapshotStreamDeliveredAcceptedWorldEvent
    );
  }

  #createDriverVehicleControlDatagramTransportStatusContext(): MetaverseWorldDriverVehicleControlDatagramTransportStatusContext {
    return Object.freeze({
      datagramTransportAvailable:
        this.#latestWinsDatagramTransport !== null,
      hasSuccessfulDatagramSend:
        this.#hasSuccessfulLatestWinsDatagramSend,
      lastTransportError: this.#lastLatestWinsDatagramError,
      usingReliableFallback: this.#useReliableLatestWinsDatagramFallback
    });
  }

  #createDefaultDriverVehicleControlDatagramStatusSnapshot(): RealtimeDatagramTransportStatusSnapshot {
    if (this.#latestWinsDatagramTransport === null) {
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

    if (this.#useReliableLatestWinsDatagramFallback) {
      return createRealtimeDatagramTransportStatusSnapshot({
        activeTransport: "reliable-command-fallback",
        browserWebTransportAvailable: true,
        enabled: true,
        lastTransportError: this.#lastLatestWinsDatagramError,
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
      lastTransportError: this.#lastLatestWinsDatagramError,
      preference: "webtransport-preferred",
      state: "active",
      webTransportConfigured: true,
      webTransportStatus: this.#hasSuccessfulLatestWinsDatagramSend
        ? "active"
        : "active"
    });
  }
}
