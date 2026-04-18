import type {
  MetaversePlayerId,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared";

import type { MetaverseWorldSnapshotStreamTransport } from "../types/metaverse-world-snapshot-stream-transport";
import type {
  MetaverseWorldClientStatusSnapshot,
  MetaverseWorldSnapshotStreamTelemetrySnapshot
} from "../types/metaverse-world-client";

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type SnapshotAcceptanceSource = "command" | "polling" | "snapshot-stream";
type LocalPlayerWorldSnapshot = MetaverseRealtimeWorldSnapshot["players"][number];

interface MetaverseWorldSnapshotStateDependencies {
  readonly clearTimeout: typeof globalThis.clearTimeout;
  readonly maxBufferedSnapshots: number;
  readonly notifyUpdates: () => void;
  readonly onAcceptedWorldEvent?:
    | ((
        worldEvent: MetaverseRealtimeWorldEvent,
        source: SnapshotAcceptanceSource
      ) => void)
    | undefined;
  readonly onSnapshotStreamFailure?: ((message: string) => void) | undefined;
  readonly readWallClockMs: () => number;
  readonly setTimeout: typeof globalThis.setTimeout;
  readonly snapshotStreamReconnectDelayMs: number;
  readonly snapshotStreamTransport?: MetaverseWorldSnapshotStreamTransport | null;
}

function clampBufferedSnapshotCount(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(rawValue));
}

function freezeSnapshotStreamTelemetrySnapshot(
  snapshot: MetaverseWorldSnapshotStreamTelemetrySnapshot
): MetaverseWorldSnapshotStreamTelemetrySnapshot {
  return Object.freeze({
    available: snapshot.available,
    fallbackActive: snapshot.fallbackActive,
    lastTransportError: snapshot.lastTransportError,
    liveness: snapshot.liveness,
    path: snapshot.path,
    reconnectCount: snapshot.reconnectCount
  });
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

export class MetaverseWorldSnapshotState {
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #maxBufferedSnapshots: number;
  readonly #notifyUpdates: () => void;
  readonly #onAcceptedWorldEvent:
    | ((
        worldEvent: MetaverseRealtimeWorldEvent,
        source: SnapshotAcceptanceSource
      ) => void)
    | null;
  readonly #onSnapshotStreamFailure: ((message: string) => void) | null;
  readonly #readWallClockMs: () => number;
  readonly #setTimeout: typeof globalThis.setTimeout;
  readonly #snapshotStreamReconnectDelayMs: number;
  readonly #snapshotStreamTransport: MetaverseWorldSnapshotStreamTransport | null;

  #latestAcceptedSnapshotReceivedAtMs: number | null = null;
  #previousAcceptedSnapshotReceivedAtMs: number | null = null;
  #snapshotStreamDeliveredAcceptedWorldEvent = false;
  #snapshotStreamLastError: string | null = null;
  #snapshotStreamReconnectCount = 0;
  #snapshotStreamReconnectHandle: TimeoutHandle | null = null;
  #snapshotStreamSubscription:
    | ReturnType<MetaverseWorldSnapshotStreamTransport["subscribeWorldSnapshots"]>
    | null = null;
  #statusSnapshot: MetaverseWorldClientStatusSnapshot;
  #usingSnapshotStreamFallback = false;
  #worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[] =
    Object.freeze([]);

  constructor(dependencies: MetaverseWorldSnapshotStateDependencies) {
    this.#clearTimeout = dependencies.clearTimeout;
    this.#maxBufferedSnapshots = clampBufferedSnapshotCount(
      dependencies.maxBufferedSnapshots
    );
    this.#notifyUpdates = dependencies.notifyUpdates;
    this.#onAcceptedWorldEvent = dependencies.onAcceptedWorldEvent ?? null;
    this.#onSnapshotStreamFailure = dependencies.onSnapshotStreamFailure ?? null;
    this.#readWallClockMs = dependencies.readWallClockMs;
    this.#setTimeout = dependencies.setTimeout;
    this.#snapshotStreamReconnectDelayMs =
      dependencies.snapshotStreamReconnectDelayMs;
    this.#snapshotStreamTransport = dependencies.snapshotStreamTransport ?? null;
    this.#statusSnapshot = freezeStatusSnapshot(
      null,
      "idle",
      false,
      null,
      null,
      null
    );
  }

  get isDisposed(): boolean {
    return this.#statusSnapshot.state === "disposed";
  }

  get latestSnapshotUpdateRateHz(): number | null {
    return this.#latestAcceptedSnapshotReceivedAtMs !== null &&
      this.#previousAcceptedSnapshotReceivedAtMs !== null
      ? 1000 /
          Math.max(
            1,
            this.#latestAcceptedSnapshotReceivedAtMs -
              this.#previousAcceptedSnapshotReceivedAtMs
          )
      : null;
  }

  get snapshotStreamTelemetrySnapshot(): MetaverseWorldSnapshotStreamTelemetrySnapshot {
    return freezeSnapshotStreamTelemetrySnapshot({
      available: this.#snapshotStreamTransport !== null,
      fallbackActive: this.#usingSnapshotStreamFallback,
      lastTransportError: this.#snapshotStreamLastError,
      liveness: this.#resolveSnapshotStreamLiveness(),
      path: this.#resolveSnapshotStreamPath(),
      reconnectCount: this.#snapshotStreamReconnectCount
    });
  }

  get statusSnapshot(): MetaverseWorldClientStatusSnapshot {
    return this.#statusSnapshot;
  }

  get supportsSnapshotStream(): boolean {
    return this.#snapshotStreamTransport !== null;
  }

  get worldSnapshotBuffer(): readonly MetaverseRealtimeWorldSnapshot[] {
    return this.#worldSnapshotBuffer;
  }

  acceptWorldEvent(
    playerId: MetaversePlayerId | null,
    worldEvent: MetaverseRealtimeWorldEvent,
    source: SnapshotAcceptanceSource
  ): boolean {
    if (this.isDisposed || !this.#shouldAcceptWorldSnapshot(worldEvent.world)) {
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
      playerId,
      "connected",
      true,
      worldEvent.world.snapshotSequence,
      worldEvent.world.tick.currentTick,
      null
    );
    this.#onAcceptedWorldEvent?.(worldEvent, source);
    this.#notifyUpdates();
    return true;
  }

  beginConnect(playerId: MetaversePlayerId): void {
    if (this.isDisposed) {
      return;
    }

    this.#statusSnapshot = freezeStatusSnapshot(
      playerId,
      "connecting",
      false,
      this.#statusSnapshot.lastSnapshotSequence,
      this.#statusSnapshot.lastWorldTick,
      null
    );
    this.#notifyUpdates();
  }

  dispose(playerId: MetaversePlayerId | null): void {
    if (this.isDisposed) {
      return;
    }

    this.#cancelScheduledSnapshotStreamReconnect();
    this.#closeSnapshotStreamSubscription();
    this.#snapshotStreamDeliveredAcceptedWorldEvent = false;
    this.#statusSnapshot = freezeStatusSnapshot(
      playerId,
      "disposed",
      false,
      this.#statusSnapshot.lastSnapshotSequence,
      this.#statusSnapshot.lastWorldTick,
      null
    );
    this.#notifyUpdates();
    this.#snapshotStreamTransport?.dispose?.();
  }

  readLatestLocalPlayerSnapshot(
    playerId: MetaversePlayerId | null
  ): LocalPlayerWorldSnapshot | null {
    const latestWorldSnapshot =
      this.#worldSnapshotBuffer[this.#worldSnapshotBuffer.length - 1] ?? null;

    if (latestWorldSnapshot === null || playerId === null) {
      return null;
    }

    return (
      latestWorldSnapshot.players.find(
        (playerSnapshot) => playerSnapshot.playerId === playerId
      ) ?? null
    );
  }

  resolvePollDelayMs(defaultPollIntervalMs: number): number {
    const latestSnapshot =
      this.#worldSnapshotBuffer[this.#worldSnapshotBuffer.length - 1] ?? null;

    if (latestSnapshot !== null) {
      return Number(latestSnapshot.tick.tickIntervalMs);
    }

    return Number(defaultPollIntervalMs);
  }

  setError(
    playerId: MetaversePlayerId | null,
    message: string,
    options: {
      readonly clearBufferedSnapshots?: boolean | undefined;
    } = {}
  ): void {
    if (this.isDisposed) {
      return;
    }

    if (options.clearBufferedSnapshots === true) {
      this.#worldSnapshotBuffer = Object.freeze([]);
    }

    const latestSnapshot =
      this.#worldSnapshotBuffer[this.#worldSnapshotBuffer.length - 1] ?? null;

    this.#statusSnapshot = freezeStatusSnapshot(
      playerId,
      "error",
      latestSnapshot !== null,
      latestSnapshot?.snapshotSequence ?? null,
      latestSnapshot?.tick.currentTick ?? null,
      message
    );
    this.#notifyUpdates();
  }

  shouldUsePollingHappyPath(): boolean {
    return (
      this.#snapshotStreamTransport === null ||
      this.#usingSnapshotStreamFallback ||
      !this.#snapshotStreamDeliveredAcceptedWorldEvent
    );
  }

  startSnapshotStream(playerId: MetaversePlayerId): void {
    if (
      this.#snapshotStreamTransport === null ||
      this.#snapshotStreamSubscription !== null ||
      this.isDisposed
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
          const acceptedWorldEvent = this.acceptWorldEvent(
            playerId,
            worldEvent,
            "snapshot-stream"
          );

          if (acceptedWorldEvent) {
            this.#snapshotStreamDeliveredAcceptedWorldEvent = true;
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

  #resolveSnapshotStreamLiveness():
    | MetaverseWorldSnapshotStreamTelemetrySnapshot["liveness"] {
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

  #resolveSnapshotStreamPath(): MetaverseWorldSnapshotStreamTelemetrySnapshot["path"] {
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

  #scheduleSnapshotStreamReconnect(playerId: MetaversePlayerId): void {
    this.#cancelScheduledSnapshotStreamReconnect();

    if (this.#snapshotStreamTransport === null || this.isDisposed) {
      return;
    }

    this.#snapshotStreamReconnectCount += 1;
    this.#snapshotStreamReconnectHandle = this.#setTimeout(() => {
      this.#snapshotStreamReconnectHandle = null;

      if (this.isDisposed) {
        return;
      }

      this.startSnapshotStream(playerId);
    }, Math.max(0, Number(this.#snapshotStreamReconnectDelayMs)));
  }

  #cancelScheduledSnapshotStreamReconnect(): void {
    if (this.#snapshotStreamReconnectHandle === null) {
      return;
    }

    this.#clearTimeout(this.#snapshotStreamReconnectHandle);
    this.#snapshotStreamReconnectHandle = null;
  }

  #handleSnapshotStreamFailure(message: string): void {
    if (this.isDisposed) {
      return;
    }

    this.#snapshotStreamSubscription = null;
    this.#snapshotStreamDeliveredAcceptedWorldEvent = false;
    this.#snapshotStreamLastError = message.trim().length > 0 ? message : null;
    this.#usingSnapshotStreamFallback = true;

    if (this.#statusSnapshot.playerId !== null) {
      this.#scheduleSnapshotStreamReconnect(this.#statusSnapshot.playerId);
    }

    this.#notifyUpdates();
    this.#onSnapshotStreamFailure?.(message);
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
}
