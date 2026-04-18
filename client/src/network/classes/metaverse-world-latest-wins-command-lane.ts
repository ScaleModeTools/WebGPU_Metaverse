type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

interface MetaverseWorldLatestWinsCommandLaneDependencies<Command> {
  readonly clearTimeout: typeof globalThis.clearTimeout;
  readonly onStateChange: () => void;
  readonly recoveryDelayMs: number;
  readonly sendDatagram: ((command: Command) => Promise<void>) | null;
  readonly setTimeout: typeof globalThis.setTimeout;
}

const latestWinsDatagramFallbackRecoveryDelayMultiplier = 1;

export class MetaverseWorldLatestWinsCommandLane<Command> {
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #onStateChange: () => void;
  readonly #recoveryDelayMs: number;
  readonly #sendDatagram: ((command: Command) => Promise<void>) | null;
  readonly #setTimeout: typeof globalThis.setTimeout;

  #failureCount = 0;
  #hasSuccessfulDatagramSend = false;
  #lastTransportError: string | null = null;
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
    this.#cancelScheduledRecovery();
  }

  async send(
    command: Command,
    fallbackMessage: string
  ): Promise<"datagram" | "reliable-fallback"> {
    if (this.#sendDatagram === null || this.#usingReliableFallback) {
      return "reliable-fallback";
    }

    try {
      await this.#sendDatagram(command);
      this.#handleSuccessfulSend();
      return "datagram";
    } catch (error) {
      this.#failureCount += 1;
      this.#handleSendFailure(
        error instanceof Error &&
          typeof error.message === "string" &&
          error.message.trim().length > 0
          ? error.message
          : fallbackMessage
      );

      return "reliable-fallback";
    }
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

    if (this.#sendDatagram === null) {
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

    this.#lastTransportError = nextError;
    this.#usingReliableFallback = true;
    this.#scheduleRecovery();

    if (stateChanged) {
      this.#onStateChange();
    }
  }
}
