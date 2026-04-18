import type {
  MetaversePlayerId,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot
} from "@webgpu-metaverse/shared";

import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type SnapshotAcceptanceSource = "polling";

interface MetaverseWorldConnectionLifecycleDependencies {
  readonly acceptWorldEvent: (
    playerId: MetaversePlayerId,
    worldEvent: MetaverseRealtimeWorldEvent,
    source: SnapshotAcceptanceSource
  ) => void;
  readonly applyWorldAccessError: (
    error: unknown,
    fallbackMessage: string
  ) => void;
  readonly beginConnect: (playerId: MetaversePlayerId) => void;
  readonly clearTimeout: typeof globalThis.clearTimeout;
  readonly pollWorldSnapshot: (
    playerId: MetaversePlayerId
  ) => Promise<MetaverseRealtimeWorldEvent>;
  readonly readStatusSnapshot: () => MetaverseWorldClientStatusSnapshot;
  readonly readWorldSnapshotBuffer: () => readonly MetaverseRealtimeWorldSnapshot[];
  readonly resolvePollDelayMs: () => number;
  readonly setError: (playerId: MetaversePlayerId | null, message: string) => void;
  readonly setTimeout: typeof globalThis.setTimeout;
  readonly shouldUsePollingHappyPath: () => boolean;
  readonly startSnapshotStream: (playerId: MetaversePlayerId) => void;
  readonly supportsSnapshotStream: () => boolean;
  readonly syncConnectedOwners: () => void;
}

export class MetaverseWorldConnectionLifecycle {
  readonly #acceptWorldEvent: MetaverseWorldConnectionLifecycleDependencies["acceptWorldEvent"];
  readonly #applyWorldAccessError: MetaverseWorldConnectionLifecycleDependencies["applyWorldAccessError"];
  readonly #beginConnect: MetaverseWorldConnectionLifecycleDependencies["beginConnect"];
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #pollWorldSnapshotTransport: MetaverseWorldConnectionLifecycleDependencies["pollWorldSnapshot"];
  readonly #readStatusSnapshot: MetaverseWorldConnectionLifecycleDependencies["readStatusSnapshot"];
  readonly #readWorldSnapshotBuffer: MetaverseWorldConnectionLifecycleDependencies["readWorldSnapshotBuffer"];
  readonly #resolvePollDelayMs: MetaverseWorldConnectionLifecycleDependencies["resolvePollDelayMs"];
  readonly #setError: MetaverseWorldConnectionLifecycleDependencies["setError"];
  readonly #setTimeout: typeof globalThis.setTimeout;
  readonly #shouldUsePollingHappyPath: MetaverseWorldConnectionLifecycleDependencies["shouldUsePollingHappyPath"];
  readonly #startSnapshotStream: MetaverseWorldConnectionLifecycleDependencies["startSnapshotStream"];
  readonly #supportsSnapshotStream: MetaverseWorldConnectionLifecycleDependencies["supportsSnapshotStream"];
  readonly #syncConnectedOwners: MetaverseWorldConnectionLifecycleDependencies["syncConnectedOwners"];

  #connectPromise: Promise<MetaverseRealtimeWorldSnapshot> | null = null;
  #playerId: MetaversePlayerId | null = null;
  #pollHandle: TimeoutHandle | null = null;

  constructor({
    acceptWorldEvent,
    applyWorldAccessError,
    beginConnect,
    clearTimeout,
    pollWorldSnapshot,
    readStatusSnapshot,
    readWorldSnapshotBuffer,
    resolvePollDelayMs,
    setError,
    setTimeout,
    shouldUsePollingHappyPath,
    startSnapshotStream,
    supportsSnapshotStream,
    syncConnectedOwners
  }: MetaverseWorldConnectionLifecycleDependencies) {
    this.#acceptWorldEvent = acceptWorldEvent;
    this.#applyWorldAccessError = applyWorldAccessError;
    this.#beginConnect = beginConnect;
    this.#clearTimeout = clearTimeout;
    this.#pollWorldSnapshotTransport = pollWorldSnapshot;
    this.#readStatusSnapshot = readStatusSnapshot;
    this.#readWorldSnapshotBuffer = readWorldSnapshotBuffer;
    this.#resolvePollDelayMs = resolvePollDelayMs;
    this.#setError = setError;
    this.#setTimeout = setTimeout;
    this.#shouldUsePollingHappyPath = shouldUsePollingHappyPath;
    this.#startSnapshotStream = startSnapshotStream;
    this.#supportsSnapshotStream = supportsSnapshotStream;
    this.#syncConnectedOwners = syncConnectedOwners;
  }

  get currentPollIntervalMs(): number {
    return this.#resolvePollDelayMs();
  }

  get playerId(): MetaversePlayerId | null {
    return this.#playerId;
  }

  bindPlayer(playerId: MetaversePlayerId): void {
    this.#assertNotDisposed();

    if (this.#playerId !== null && this.#playerId !== playerId) {
      throw new Error(
        "Metaverse world client already connected with a different player."
      );
    }

    this.#playerId ??= playerId;
  }

  async ensureConnected(
    playerId: MetaversePlayerId
  ): Promise<MetaverseRealtimeWorldSnapshot> {
    this.bindPlayer(playerId);

    if (
      this.#readWorldSnapshotBuffer().length > 0 &&
      this.#playerId === playerId &&
      this.#readStatusSnapshot().connected
    ) {
      return this.#readWorldSnapshotBuffer()[
        this.#readWorldSnapshotBuffer().length - 1
      ]!;
    }

    if (this.#connectPromise !== null) {
      return this.#connectPromise;
    }

    this.#beginConnect(playerId);

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
    this.#cancelScheduledPoll();
    this.#connectPromise = null;
  }

  cancelPolling(): void {
    this.#cancelScheduledPoll();
  }

  handleSnapshotStreamFailure(message: string): void {
    this.#schedulePoll(0);
    this.#applyWorldAccessError(new Error(message), message);
  }

  async #connectInternal(
    playerId: MetaversePlayerId
  ): Promise<MetaverseRealtimeWorldSnapshot> {
    try {
      const worldEvent = await this.#pollWorldSnapshotTransport(playerId);

      this.#acceptWorldEvent(playerId, worldEvent, "polling");

      if (!this.#isDisposed()) {
        this.#syncConnectedOwners();
        this.#startSnapshotStream(playerId);

        if (!this.#supportsSnapshotStream()) {
          this.#schedulePoll(0);
        } else if (this.#shouldUsePollingHappyPath()) {
          this.#schedulePoll(this.#resolvePollDelayMs());
        }
      }

      return worldEvent.world;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Metaverse world connect failed.";

      this.#setError(this.#playerId, message);
      throw error;
    }
  }

  async #pollCurrentPlayerWorldSnapshot(): Promise<void> {
    const playerId = this.#playerId;

    if (playerId === null || this.#isDisposed()) {
      return;
    }

    try {
      this.#acceptWorldEvent(
        playerId,
        await this.#pollWorldSnapshotTransport(playerId),
        "polling"
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

  #schedulePoll(delayMs: number): void {
    this.#cancelScheduledPoll();

    if (
      this.#isDisposed() ||
      this.#playerId === null ||
      !this.#shouldUsePollingHappyPath()
    ) {
      return;
    }

    this.#pollHandle = this.#setTimeout(() => {
      this.#pollHandle = null;
      void this.#pollCurrentPlayerWorldSnapshot();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPoll(): void {
    if (this.#pollHandle === null) {
      return;
    }

    this.#clearTimeout(this.#pollHandle);
    this.#pollHandle = null;
  }

  #assertNotDisposed(): void {
    if (this.#isDisposed()) {
      throw new Error("Metaverse world client is already disposed.");
    }
  }

  #isDisposed(): boolean {
    return this.#readStatusSnapshot().state === "disposed";
  }
}
