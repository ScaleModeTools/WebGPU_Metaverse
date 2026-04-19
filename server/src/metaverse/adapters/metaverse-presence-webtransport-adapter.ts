import type {
  MetaversePresenceWebTransportClientMessage,
  MetaversePresenceWebTransportServerMessage
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaversePresenceWebTransportErrorMessage,
  createMetaversePresenceWebTransportServerEventMessage
} from "@webgpu-metaverse/shared/metaverse/presence";

import type { MetaverseAuthoritativeWorldRuntimeOwner } from "../types/metaverse-authoritative-world-runtime-owner.js";

export class MetaversePresenceWebTransportSession {
  readonly #runtime: MetaverseAuthoritativeWorldRuntimeOwner;

  #disposed = false;

  constructor(runtime: MetaverseAuthoritativeWorldRuntimeOwner) {
    this.#runtime = runtime;
  }

  receiveClientMessage(
    message: MetaversePresenceWebTransportClientMessage,
    nowMs: number
  ): MetaversePresenceWebTransportServerMessage {
    this.#assertNotDisposed();

    try {
      switch (message.type) {
        case "presence-command-request":
          return createMetaversePresenceWebTransportServerEventMessage({
            event: this.#runtime.acceptPresenceCommand(message.command, nowMs)
          });
        case "presence-roster-request":
          return createMetaversePresenceWebTransportServerEventMessage({
            event: this.#runtime.readPresenceRosterEvent(
              nowMs,
              message.observerPlayerId
            )
          });
        default: {
          const exhaustiveCheck: never = message;
          throw new Error(
            `Unsupported metaverse presence WebTransport message: ${exhaustiveCheck}`
          );
        }
      }
    } catch (error) {
      return createMetaversePresenceWebTransportErrorMessage({
        message:
          error instanceof Error
            ? error.message
            : "Metaverse presence WebTransport request failed."
      });
    }
  }

  dispose(): void {
    this.#disposed = true;
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error(
        "Metaverse presence WebTransport session has already been disposed."
      );
    }
  }
}

export class MetaversePresenceWebTransportAdapter {
  readonly #runtime: MetaverseAuthoritativeWorldRuntimeOwner;

  constructor(runtime: MetaverseAuthoritativeWorldRuntimeOwner) {
    this.#runtime = runtime;
  }

  openSession(): MetaversePresenceWebTransportSession {
    return new MetaversePresenceWebTransportSession(this.#runtime);
  }
}
