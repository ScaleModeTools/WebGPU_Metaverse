interface WebTransportDatagramStreamLike {
  readonly maxDatagramSize?: number;
  readonly writable: WritableStream<Uint8Array>;
}

interface WebTransportLike {
  readonly closed?: Promise<unknown>;
  readonly datagrams?: WebTransportDatagramStreamLike;
  readonly ready?: Promise<unknown>;
  close(closeInfo?: {
    readonly closeCode?: number;
    readonly reason?: string;
  }): void;
}

interface LatestWinsWebTransportJsonDatagramConnection {
  readonly maxDatagramSize: number;
  readonly transport: WebTransportLike;
  readonly writer: WritableStreamDefaultWriter<Uint8Array>;
}

interface LatestWinsWebTransportJsonDatagramPendingWrite<Datagram> {
  readonly datagram: Datagram;
  reject(error: unknown): void;
  resolve(): void;
}

const fallbackWebTransportMaxDatagramSizeBytes = 1_000;

export class LatestWinsWebTransportJsonDatagramChannelError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause: unknown = null) {
    super(message);
    this.name = "LatestWinsWebTransportJsonDatagramChannelError";
    this.cause = cause;
  }
}

export interface LatestWinsWebTransportJsonDatagramChannelConfig<Datagram> {
  readonly serializeDatagram?: (datagram: Datagram) => unknown;
  readonly url: string;
}

export interface LatestWinsWebTransportJsonDatagramChannelDependencies {
  readonly textEncoder?: TextEncoder;
  readonly webTransportFactory?: (url: string) => WebTransportLike;
}

function resolveWebTransportFactory(
  customFactory:
    | LatestWinsWebTransportJsonDatagramChannelDependencies["webTransportFactory"]
    | undefined
): (url: string) => WebTransportLike {
  if (customFactory !== undefined) {
    return customFactory;
  }

  const webTransportConstructor = (
    globalThis as typeof globalThis & {
      readonly WebTransport?: new (url: string) => WebTransportLike;
    }
  ).WebTransport;

  if (webTransportConstructor === undefined) {
    throw new Error(
      "WebTransport API is unavailable for the latest-wins JSON datagram channel."
    );
  }

  return (url: string) => new webTransportConstructor(url);
}

export class LatestWinsWebTransportJsonDatagramChannel<Datagram> {
  readonly #encodeText: TextEncoder;
  readonly #serializeDatagram: (datagram: Datagram) => unknown;
  readonly #url: string;
  readonly #webTransportFactory: (url: string) => WebTransportLike;

  #connectionPromise: Promise<LatestWinsWebTransportJsonDatagramConnection> | null =
    null;
  #disposed = false;
  #flushPromise: Promise<void> | null = null;
  #pendingWrite: LatestWinsWebTransportJsonDatagramPendingWrite<Datagram> | null =
    null;

  constructor(
    config: LatestWinsWebTransportJsonDatagramChannelConfig<Datagram>,
    dependencies: LatestWinsWebTransportJsonDatagramChannelDependencies = {}
  ) {
    this.#encodeText = dependencies.textEncoder ?? new TextEncoder();
    this.#serializeDatagram =
      config.serializeDatagram ?? ((datagram: Datagram) => datagram);
    this.#url = config.url;
    this.#webTransportFactory = resolveWebTransportFactory(
      dependencies.webTransportFactory
    );
  }

  async sendDatagram(datagram: Datagram): Promise<void> {
    this.#assertNotDisposed();

    return new Promise((resolve, reject) => {
      this.#replacePendingWrite({
        datagram,
        reject,
        resolve
      });
      this.#ensureFlushLoop();
    });
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#rejectPendingWrite(
      new Error(
        "Latest-wins WebTransport JSON datagram channel has already been disposed."
      )
    );
    this.#resetConnection();
  }

  #encodeDatagram(
    datagram: Datagram,
    maxDatagramSize: number
  ): Uint8Array {
    try {
      const encodedDatagram = this.#encodeText.encode(
        JSON.stringify(this.#serializeDatagram(datagram))
      );

      if (encodedDatagram.byteLength > maxDatagramSize) {
        throw new Error(
          `Latest-wins WebTransport JSON datagram payload ${encodedDatagram.byteLength} bytes exceeds max datagram size ${maxDatagramSize} bytes.`
        );
      }

      return encodedDatagram;
    } catch (error) {
      throw this.#normalizeSendError(error);
    }
  }

  #replacePendingWrite(
    nextPendingWrite: LatestWinsWebTransportJsonDatagramPendingWrite<Datagram>
  ): void {
    const supersededPendingWrite = this.#pendingWrite;

    this.#pendingWrite = nextPendingWrite;
    supersededPendingWrite?.resolve();
  }

  #ensureFlushLoop(): void {
    if (this.#flushPromise !== null) {
      return;
    }

    const flushPromise = this.#flushPendingWrites();
    this.#flushPromise = flushPromise;
    void flushPromise.finally(() => {
      if (this.#flushPromise === flushPromise) {
        this.#flushPromise = null;
      }
    });
  }

  async #flushPendingWrites(): Promise<void> {
    while (!this.#disposed) {
      const pendingWrite = this.#pendingWrite;

      if (pendingWrite === null) {
        return;
      }

      this.#pendingWrite = null;

      try {
        const connection = await this.#ensureConnection();
        await connection.writer.write(
          this.#encodeDatagram(
            pendingWrite.datagram,
            connection.maxDatagramSize
          )
        );
        pendingWrite.resolve();
      } catch (error) {
        const normalizedError = this.#normalizeSendError(error);

        pendingWrite.reject(normalizedError);
        this.#rejectPendingWrite(normalizedError);
        this.#resetConnection();
        return;
      }
    }
  }

  async #ensureConnection(): Promise<LatestWinsWebTransportJsonDatagramConnection> {
    if (this.#connectionPromise !== null) {
      return this.#connectionPromise;
    }

    const connectionPromise = this.#openConnection();
    this.#connectionPromise = connectionPromise;

    try {
      return await connectionPromise;
    } catch (error) {
      if (this.#connectionPromise === connectionPromise) {
        this.#connectionPromise = null;
      }
      throw error;
    }
  }

  async #openConnection(): Promise<LatestWinsWebTransportJsonDatagramConnection> {
    const transport = this.#webTransportFactory(this.#url);

    if (transport.ready !== undefined) {
      await transport.ready;
    }

    const datagramStream = transport.datagrams;

    if (datagramStream === undefined) {
      throw new LatestWinsWebTransportJsonDatagramChannelError(
        "Latest-wins WebTransport JSON datagram channel requires transport datagram support."
      );
    }

    return {
      maxDatagramSize: this.#resolveMaxDatagramSize(datagramStream.maxDatagramSize),
      transport,
      writer: datagramStream.writable.getWriter()
    };
  }

  #rejectPendingWrite(error: unknown): void {
    const pendingWrite = this.#pendingWrite;

    if (pendingWrite === null) {
      return;
    }

    this.#pendingWrite = null;
    pendingWrite.reject(error);
  }

  #normalizeSendError(
    error: unknown
  ): LatestWinsWebTransportJsonDatagramChannelError {
    if (error instanceof LatestWinsWebTransportJsonDatagramChannelError) {
      return error;
    }

    const message =
      error instanceof Error &&
      typeof error.message === "string" &&
      error.message.trim().length > 0
        ? error.message
        : "Latest-wins WebTransport JSON datagram send failed.";

    return new LatestWinsWebTransportJsonDatagramChannelError(message, error);
  }

  #resolveMaxDatagramSize(rawValue: number | undefined): number {
    return Number.isFinite(rawValue) && rawValue !== undefined && rawValue > 0
      ? Math.max(1, Math.floor(rawValue))
      : fallbackWebTransportMaxDatagramSizeBytes;
  }

  #resetConnection(): void {
    const connectionPromise = this.#connectionPromise;

    if (connectionPromise === null) {
      return;
    }

    this.#connectionPromise = null;
    void connectionPromise
      .then(async (connection) => {
        try {
          await connection.writer.close();
        } catch {}

        try {
          connection.writer.releaseLock();
        } catch {}

        try {
          connection.transport.close({
            closeCode: 0,
            reason: "Channel disposed"
          });
        } catch {}

        try {
          await connection.transport.closed;
        } catch {}
      })
      .catch(() => {});
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error(
        "Latest-wins WebTransport JSON datagram channel has already been disposed."
      );
    }
  }
}
