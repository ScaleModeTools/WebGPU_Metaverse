interface WebTransportDatagramStreamLike {
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
  readonly transport: WebTransportLike;
  readonly writer: WritableStreamDefaultWriter<Uint8Array>;
}

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

    try {
      const connection = await this.#ensureConnection();
      await connection.writer.write(
        this.#encodeText.encode(JSON.stringify(this.#serializeDatagram(datagram)))
      );
    } catch (error) {
      this.#resetConnection();
      if (error instanceof LatestWinsWebTransportJsonDatagramChannelError) {
        throw error;
      }

      const message =
        error instanceof Error &&
        typeof error.message === "string" &&
        error.message.trim().length > 0
          ? error.message
          : "Latest-wins WebTransport JSON datagram send failed.";

      throw new LatestWinsWebTransportJsonDatagramChannelError(message, error);
    }
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#resetConnection();
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
      transport,
      writer: datagramStream.writable.getWriter()
    };
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
