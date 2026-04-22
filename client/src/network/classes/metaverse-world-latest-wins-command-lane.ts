type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

interface MetaverseWorldLatestWinsCommandLaneDependencies<Command> {
  readonly clearTimeout: typeof globalThis.clearTimeout;
  readonly onStateChange: () => void;
  readonly recoveryDelayMs: number;
  readonly sendDatagram: ((command: Command) => Promise<void>) | null;
  readonly setTimeout: typeof globalThis.setTimeout;
}

interface LatestWinsQueuedCommand<Command> {
  readonly command: Command;
  readonly fallbackMessage: string;
  resolve(result: MetaverseWorldLatestWinsCommandLaneSendResult): void;
}

const latestWinsDatagramFallbackRecoveryDelayMultiplier = 1;

export type MetaverseWorldLatestWinsCommandLaneSendResult =
  | "datagram"
  | "reliable-fallback"
  | "superseded";

export class MetaverseWorldLatestWinsCommandLane<Command> {
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #onStateChange: () => void;
  readonly #recoveryDelayMs: number;
  readonly #sendDatagram: ((command: Command) => Promise<void>) | null;
  readonly #setTimeout: typeof globalThis.setTimeout;

  #disposed = false;
  #failureCount = 0;
  #flushPromise: Promise<void> | null = null;
  #hasSuccessfulDatagramSend = false;
  #lastTransportError: string | null = null;
  #pendingCommand: LatestWinsQueuedCommand<Command> | null = null;
  #recoveryHandle: TimeoutHandle | null = null;
  #usingReliableFallback = false;

  constructor({
    clearTimeout,
    onStateChange,
    recoveryDelayMs,
    sendDatagram,
    setTimeout
  }: MetaverseWorldLatestWinsCommandLaneDependencies<Command>) {
    this.#clearTimeout = clearTimeout;
    this.#onStateChange = onStateChange;
    this.#recoveryDelayMs = recoveryDelayMs;
    this.#sendDatagram = sendDatagram;
    this.#setTimeout = setTimeout;
  }

  get datagramTransportAvailable(): boolean {
    return this.#sendDatagram !== null;
  }

  get failureCount(): number {
    return this.#failureCount;
  }

  get hasSuccessfulDatagramSend(): boolean {
    return this.#hasSuccessfulDatagramSend;
  }

  get lastTransportError(): string | null {
    return this.#lastTransportError;
  }

  get supportsDatagrams(): boolean {
    return this.#sendDatagram !== null && !this.#usingReliableFallback;
  }

  get usingReliableFallback(): boolean {
    return this.#usingReliableFallback;
  }

  dispose(): void {
    this.#disposed = true;
    this.#resolvePendingCommand("reliable-fallback");
    this.#cancelScheduledRecovery();
  }

  async send(
    command: Command,
    fallbackMessage: string
  ): Promise<MetaverseWorldLatestWinsCommandLaneSendResult> {
    if (
      this.#disposed ||
      this.#sendDatagram === null ||
      this.#usingReliableFallback
    ) {
      return "reliable-fallback";
    }

    return new Promise((resolve) => {
      this.#replacePendingCommand(
        Object.freeze({
          command,
          fallbackMessage,
          resolve
        })
      );
      this.#ensureFlushLoop();
    });
  }

  #resolveRecoveryDelayMs(): number {
    return Math.max(
      0,
      Math.floor(
        this.#recoveryDelayMs * latestWinsDatagramFallbackRecoveryDelayMultiplier
      )
    );
  }

  #scheduleRecovery(): void {
    this.#cancelScheduledRecovery();

    if (this.#sendDatagram === null || this.#disposed) {
      return;
    }

    this.#recoveryHandle = this.#setTimeout(() => {
      this.#recoveryHandle = null;

      if (!this.#usingReliableFallback) {
        return;
      }

      this.#usingReliableFallback = false;
      this.#onStateChange();
    }, this.#resolveRecoveryDelayMs());
  }

  #cancelScheduledRecovery(): void {
    if (this.#recoveryHandle === null) {
      return;
    }

    this.#clearTimeout(this.#recoveryHandle);
    this.#recoveryHandle = null;
  }

  #handleSuccessfulSend(): void {
    const stateChanged =
      !this.#hasSuccessfulDatagramSend ||
      this.#usingReliableFallback ||
      this.#lastTransportError !== null;

    this.#hasSuccessfulDatagramSend = true;
    this.#usingReliableFallback = false;
    this.#lastTransportError = null;
    this.#cancelScheduledRecovery();

    if (stateChanged) {
      this.#onStateChange();
    }
  }

  #handleSendFailure(nextError: string): void {
    const stateChanged =
      !this.#usingReliableFallback || this.#lastTransportError !== nextError;

    this.#resolvePendingCommand("reliable-fallback");
    this.#lastTransportError = nextError;
    this.#usingReliableFallback = true;
    this.#scheduleRecovery();

    if (stateChanged) {
      this.#onStateChange();
    }
  }

  #replacePendingCommand(nextPendingCommand: LatestWinsQueuedCommand<Command>): void {
    const supersededCommand = this.#pendingCommand;

    this.#pendingCommand = nextPendingCommand;
    supersededCommand?.resolve("superseded");
  }

  #resolvePendingCommand(
    result: MetaverseWorldLatestWinsCommandLaneSendResult
  ): void {
    const pendingCommand = this.#pendingCommand;

    if (pendingCommand === null) {
      return;
    }

    this.#pendingCommand = null;
    pendingCommand.resolve(result);
  }

  #ensureFlushLoop(): void {
    if (
      this.#disposed ||
      this.#sendDatagram === null ||
      this.#usingReliableFallback ||
      this.#flushPromise !== null
    ) {
      return;
    }

    const flushPromise = this.#flushQueuedCommands();
    this.#flushPromise = flushPromise;
    void flushPromise.finally(() => {
      if (this.#flushPromise === flushPromise) {
        this.#flushPromise = null;
      }

      if (
        !this.#disposed &&
        !this.#usingReliableFallback &&
        this.#pendingCommand !== null
      ) {
        this.#ensureFlushLoop();
      }
    });
  }

  async #flushQueuedCommands(): Promise<void> {
    while (
      !this.#disposed &&
      !this.#usingReliableFallback &&
      this.#sendDatagram !== null
    ) {
      const pendingCommand = this.#pendingCommand;

      if (pendingCommand === null) {
        return;
      }

      this.#pendingCommand = null;

      try {
        await this.#sendDatagramWithTimeout(
          pendingCommand.command,
          pendingCommand.fallbackMessage
        );
        pendingCommand.resolve("datagram");
        this.#handleSuccessfulSend();
      } catch (error) {
        pendingCommand.resolve("reliable-fallback");
        this.#failureCount += 1;
        this.#handleSendFailure(
          error instanceof Error &&
            typeof error.message === "string" &&
            error.message.trim().length > 0
            ? error.message
            : pendingCommand.fallbackMessage
        );
        return;
      }
    }
  }

  async #sendDatagramWithTimeout(
    command: Command,
    fallbackMessage: string
  ): Promise<void> {
    const sendDatagram = this.#sendDatagram;

    if (sendDatagram === null) {
      throw new Error(fallbackMessage);
    }

    const sendPromise = sendDatagram(command);
    void sendPromise.catch(() => undefined);

    let timeoutHandle: TimeoutHandle | null = null;

    try {
      await Promise.race([
        sendPromise,
        new Promise<never>((_, reject) => {
          timeoutHandle = this.#setTimeout(() => {
            timeoutHandle = null;
            reject(new Error(fallbackMessage));
          }, this.#resolveRecoveryDelayMs());
        })
      ]);
    } finally {
      if (timeoutHandle !== null) {
        this.#clearTimeout(timeoutHandle);
      }
    }
  }
}
