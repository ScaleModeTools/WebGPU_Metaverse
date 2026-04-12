import type {
  MetaverseDriverVehicleControlIntentSnapshot,
  MetaversePlayerId,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot,
  MetaverseSyncDriverVehicleControlCommandInput
} from "@webgpu-metaverse/shared";
import {
  createMetaverseDriverVehicleControlIntentSnapshot,
  createMetaverseSyncDriverVehicleControlCommand
} from "@webgpu-metaverse/shared";

import { createMetaverseWorldHttpTransport } from "../adapters/metaverse-world-http-transport";
import type { MetaverseRealtimeWorldDriverVehicleControlDatagramTransport } from "../types/metaverse-realtime-world-driver-vehicle-control-datagram-transport";
import type {
  MetaverseWorldClientConfig,
  MetaverseWorldClientStatusSnapshot
} from "../types/metaverse-world-client";
import type { MetaverseWorldTransport } from "../types/metaverse-world-transport";

interface MetaverseWorldClientDependencies {
  readonly clearTimeout?: typeof globalThis.clearTimeout;
  readonly driverVehicleControlDatagramTransport?: MetaverseRealtimeWorldDriverVehicleControlDatagramTransport;
  readonly fetch?: typeof globalThis.fetch;
  readonly setTimeout?: typeof globalThis.setTimeout;
  readonly transport?: MetaverseWorldTransport;
}

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

type PendingDriverVehicleControlCommand = ReturnType<
  typeof createMetaverseSyncDriverVehicleControlCommand
>;

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

export class MetaverseWorldClient {
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #config: MetaverseWorldClientConfig;
  readonly #driverVehicleControlDatagramTransport: MetaverseRealtimeWorldDriverVehicleControlDatagramTransport | null;
  readonly #maxBufferedSnapshots: number;
  readonly #setTimeout: typeof globalThis.setTimeout;
  readonly #transport: MetaverseWorldTransport;
  readonly #updateListeners = new Set<() => void>();

  #commandSyncHandle: TimeoutHandle | null = null;
  #commandSyncInFlight = false;
  #connectPromise: Promise<MetaverseRealtimeWorldSnapshot> | null = null;
  #lastDriverVehicleControlIntent: MetaverseDriverVehicleControlIntentSnapshot | null =
    null;
  #nextDriverVehicleControlSequence = 0;
  #pendingDriverVehicleControlCommand: PendingDriverVehicleControlCommand | null =
    null;
  #playerId: MetaversePlayerId | null = null;
  #pollHandle: TimeoutHandle | null = null;
  #statusSnapshot: MetaverseWorldClientStatusSnapshot;
  #useReliableDriverVehicleControlFallback = false;
  #worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[] =
    Object.freeze([]);

  constructor(
    config: MetaverseWorldClientConfig,
    dependencies: MetaverseWorldClientDependencies = {}
  ) {
    this.#config = config;
    this.#driverVehicleControlDatagramTransport =
      dependencies.driverVehicleControlDatagramTransport ?? null;
    this.#maxBufferedSnapshots = clampBufferedSnapshotCount(
      config.maxBufferedSnapshots
    );
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

  get worldSnapshotBuffer(): readonly MetaverseRealtimeWorldSnapshot[] {
    return this.#worldSnapshotBuffer;
  }

  get supportsDriverVehicleControlDatagrams(): boolean {
    return (
      this.#driverVehicleControlDatagramTransport !== null &&
      !this.#useReliableDriverVehicleControlFallback
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
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#playerId,
      "disposed",
      false,
      this.#statusSnapshot.lastSnapshotSequence,
      this.#statusSnapshot.lastWorldTick,
      null
    );
    this.#notifyUpdates();
    this.#driverVehicleControlDatagramTransport?.dispose?.();
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
        this.#schedulePoll(0);
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
      if (!this.#isDisposed() && this.#playerId !== null) {
        this.#schedulePoll(this.#resolvePollDelayMs());
      }
    }
  }

  #applyWorldEvent(worldEvent: MetaverseRealtimeWorldEvent): void {
    if (this.#isDisposed()) {
      return;
    }

    if (!this.#shouldAcceptWorldSnapshot(worldEvent.world)) {
      return;
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

  #schedulePoll(delayMs: number): void {
    this.#cancelScheduledPoll();

    if (this.#statusSnapshot.state === "disposed" || this.#playerId === null) {
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

  async #sendDriverVehicleControlCommand(
    command: PendingDriverVehicleControlCommand
  ): Promise<MetaverseRealtimeWorldEvent | null> {
    if (
      this.#driverVehicleControlDatagramTransport === null ||
      this.#useReliableDriverVehicleControlFallback
    ) {
      return this.#transport.sendCommand(command);
    }

    try {
      await this.#driverVehicleControlDatagramTransport.sendDriverVehicleControlDatagram(
        command
      );
      return null;
    } catch {
      this.#useReliableDriverVehicleControlFallback = true;
      return this.#transport.sendCommand(command);
    }
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
}
