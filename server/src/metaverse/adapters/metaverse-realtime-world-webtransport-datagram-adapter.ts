import type {
  MetaverseRealtimeWorldWebTransportClientDatagram
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";

import type { MetaverseAuthoritativeWorldRuntimeOwner } from "../types/metaverse-authoritative-world-runtime-owner.js";

export class MetaverseRealtimeWorldWebTransportDatagramSession {
  readonly #runtime: MetaverseAuthoritativeWorldRuntimeOwner;

  #boundPlayerId: MetaversePlayerId | null = null;
  #disposed = false;

  constructor(runtime: MetaverseAuthoritativeWorldRuntimeOwner) {
    this.#runtime = runtime;
  }

  receiveClientDatagram(
    datagram: MetaverseRealtimeWorldWebTransportClientDatagram,
    nowMs: number
  ): void {
    this.#assertNotDisposed();
    this.#bindPlayerIdentity(datagram.command.playerId);
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

  #bindPlayerIdentity(playerId: MetaversePlayerId): void {
    if (this.#boundPlayerId !== null && this.#boundPlayerId !== playerId) {
      throw new Error(
        `Metaverse world WebTransport datagram session is already bound to ${this.#boundPlayerId}.`
      );
    }

    this.#boundPlayerId = playerId;
  }
}

export class MetaverseRealtimeWorldWebTransportDatagramAdapter {
  readonly #runtime: MetaverseAuthoritativeWorldRuntimeOwner;

  constructor(runtime: MetaverseAuthoritativeWorldRuntimeOwner) {
    this.#runtime = runtime;
  }

  openSession(): MetaverseRealtimeWorldWebTransportDatagramSession {
    return new MetaverseRealtimeWorldWebTransportDatagramSession(this.#runtime);
  }
}
