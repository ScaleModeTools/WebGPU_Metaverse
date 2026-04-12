import type { MetaverseRealtimeWorldWebTransportClientDatagram } from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "../classes/metaverse-authoritative-world-runtime.js";

export class MetaverseRealtimeWorldWebTransportDatagramSession {
  readonly #runtime: MetaverseAuthoritativeWorldRuntime;

  #disposed = false;

  constructor(runtime: MetaverseAuthoritativeWorldRuntime) {
    this.#runtime = runtime;
  }

  receiveClientDatagram(
    datagram: MetaverseRealtimeWorldWebTransportClientDatagram,
    nowMs: number
  ): void {
    this.#assertNotDisposed();
    this.#runtime.acceptWorldCommand(datagram.command, nowMs);
  }

  dispose(): void {
    this.#disposed = true;
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error(
        "Metaverse realtime world WebTransport datagram session has already been disposed."
      );
    }
  }
}

export class MetaverseRealtimeWorldWebTransportDatagramAdapter {
  readonly #runtime: MetaverseAuthoritativeWorldRuntime;

  constructor(runtime: MetaverseAuthoritativeWorldRuntime) {
    this.#runtime = runtime;
  }

  openSession(): MetaverseRealtimeWorldWebTransportDatagramSession {
    return new MetaverseRealtimeWorldWebTransportDatagramSession(this.#runtime);
  }
}
