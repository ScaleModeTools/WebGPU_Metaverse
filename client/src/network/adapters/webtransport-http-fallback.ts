import { ReliableWebTransportJsonRequestChannelError } from "./reliable-webtransport-json-request-channel";

interface DisposableTransport {
  dispose?(): void;
}

function isWebTransportFallbackError(error: unknown): boolean {
  return error instanceof ReliableWebTransportJsonRequestChannelError;
}

function resolveErrorMessage(error: unknown): string | null {
  if (
    error instanceof Error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return null;
}

export interface WebTransportHttpFallbackInvoker<
  Transport extends DisposableTransport
> {
  readonly hasPrimaryTransportSucceeded: boolean;
  readonly lastFallbackError: string | null;
  readonly usingFallback: boolean;
  dispose(): void;
  invoke<Response>(
    operation: (transport: Transport) => Promise<Response>
  ): Promise<Response>;
}

export function createWebTransportHttpFallbackInvoker<
  Transport extends DisposableTransport
>(
  primaryTransport: Transport,
  fallbackTransport: Transport
): WebTransportHttpFallbackInvoker<Transport> {
  let hasPrimaryTransportSucceeded = false;
  let lastFallbackError: string | null = null;
  let usingFallback = false;

  return Object.freeze({
    get hasPrimaryTransportSucceeded() {
      return hasPrimaryTransportSucceeded;
    },
    get lastFallbackError() {
      return lastFallbackError;
    },
    get usingFallback() {
      return usingFallback;
    },
    dispose() {
      primaryTransport.dispose?.();
      fallbackTransport.dispose?.();
    },
    async invoke<Response>(
      operation: (transport: Transport) => Promise<Response>
    ): Promise<Response> {
      if (usingFallback) {
        return operation(fallbackTransport);
      }

      try {
        const response = await operation(primaryTransport);

        hasPrimaryTransportSucceeded = true;
        lastFallbackError = null;

        return response;
      } catch (error) {
        if (!isWebTransportFallbackError(error)) {
          throw error;
        }

        usingFallback = true;
        lastFallbackError =
          resolveErrorMessage(error) ?? "WebTransport transport fallback activated.";
        return operation(fallbackTransport);
      }
    }
  });
}
