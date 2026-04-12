interface NativeWebTransportBidirectionalStreamLike {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}

interface NativeWebTransportDatagramStreamLike {
  readonly writable: WritableStream<Uint8Array>;
}

interface NativeWebTransportLike {
  readonly closed?: Promise<unknown>;
  readonly datagrams?: NativeWebTransportDatagramStreamLike;
  readonly ready?: Promise<unknown>;
  createBidirectionalStream(): Promise<NativeWebTransportBidirectionalStreamLike>;
  close(closeInfo?: {
    readonly closeCode?: number;
    readonly reason?: string;
  }): void;
}

interface NativeWebTransportConstructorOptions {
  readonly serverCertificateHashes?: readonly {
    readonly algorithm: "sha-256";
    readonly value: Uint8Array;
  }[];
}

interface NativeWebTransportConstructor {
  new (
    url: string,
    options?: NativeWebTransportConstructorOptions
  ): NativeWebTransportLike;
}

export interface NativeWebTransportBrowserFactoryConfig {
  readonly serverCertificateSha256Hex?: string | null;
}

export interface NativeWebTransportBrowserFactoryDependencies {
  readonly webTransportConstructor?: NativeWebTransportConstructor;
}

function resolveNativeWebTransportConstructor(
  customConstructor:
    | NativeWebTransportBrowserFactoryDependencies["webTransportConstructor"]
    | undefined
): NativeWebTransportConstructor {
  if (customConstructor !== undefined) {
    return customConstructor;
  }

  const webTransportConstructor = (
    globalThis as typeof globalThis & {
      readonly WebTransport?: NativeWebTransportConstructor;
    }
  ).WebTransport;

  if (webTransportConstructor === undefined) {
    throw new Error("WebTransport API is unavailable in this browser.");
  }

  return webTransportConstructor;
}

function decodeSha256Hex(rawValue: string): Uint8Array {
  const normalizedValue = rawValue.trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/u.test(normalizedValue)) {
    throw new Error(
      "WebTransport server certificate SHA-256 must be a 64-character hex string."
    );
  }

  const bytes = new Uint8Array(32);

  for (let index = 0; index < bytes.length; index += 1) {
    const start = index * 2;
    bytes[index] = Number.parseInt(
      normalizedValue.slice(start, start + 2),
      16
    );
  }

  return bytes;
}

export function createNativeWebTransportBrowserFactory(
  config: NativeWebTransportBrowserFactoryConfig = {},
  dependencies: NativeWebTransportBrowserFactoryDependencies = {}
): (url: string) => NativeWebTransportLike {
  const webTransportConstructor = resolveNativeWebTransportConstructor(
    dependencies.webTransportConstructor
  );
  const connectionOptions =
    config.serverCertificateSha256Hex === undefined ||
    config.serverCertificateSha256Hex === null ||
    config.serverCertificateSha256Hex.trim().length === 0
      ? undefined
      : ({
          serverCertificateHashes: [
            Object.freeze({
              algorithm: "sha-256" as const,
              value: decodeSha256Hex(config.serverCertificateSha256Hex)
            })
          ]
        } as const satisfies NativeWebTransportConstructorOptions);

  return (url: string) => new webTransportConstructor(url, connectionOptions);
}
