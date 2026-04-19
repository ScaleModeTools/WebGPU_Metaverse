import type {
  MetaverseRealtimeWorldWebTransportClientMessage,
  MetaverseRealtimeWorldWebTransportServerMessage
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseRealtimeWorldWebTransportErrorMessage,
  createMetaverseRealtimeWorldWebTransportServerEventMessage
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseAuthoritativeWorldRuntimeOwner } from "../types/metaverse-authoritative-world-runtime-owner.js";

interface PersistentReliableStreamContext<Response> {
  readonly closed: Promise<void>;
  writeResponse(response: Response): Promise<void>;
}

interface MetaverseWorldSnapshotSubscriber {
  readonly observerPlayerId: MetaversePlayerId;
  readonly session: MetaverseWorldWebTransportSession;
  readonly writeResponse: (
    response: MetaverseRealtimeWorldWebTransportServerMessage
  ) => Promise<void>;
  closeAfterWrite: boolean;
  pendingResponse: MetaverseRealtimeWorldWebTransportServerMessage | null;
  writing: boolean;
}

function resolveBoundPlayerId(
  message: MetaverseRealtimeWorldWebTransportClientMessage
): MetaversePlayerId {
  switch (message.type) {
    case "world-command-request":
      return message.command.playerId;
    case "world-snapshot-request":
    case "world-snapshot-subscribe":
      return message.observerPlayerId;
    default: {
      const exhaustiveMessage: never = message;
      throw new Error(
        `Unsupported metaverse world WebTransport request type: ${exhaustiveMessage}`
      );
    }
  }
}

export class MetaverseWorldWebTransportSession {
  readonly #adapter: MetaverseWorldWebTransportAdapter;
  readonly #runtime: MetaverseAuthoritativeWorldRuntimeOwner;

  #boundPlayerId: MetaversePlayerId | null = null;
  #disposed = false;

  constructor(
    runtime: MetaverseAuthoritativeWorldRuntimeOwner,
    adapter: MetaverseWorldWebTransportAdapter
  ) {
    this.#adapter = adapter;
    this.#runtime = runtime;
  }

  receiveClientMessage(
    message: MetaverseRealtimeWorldWebTransportClientMessage,
    nowMs: number
  ): MetaverseRealtimeWorldWebTransportServerMessage {
    this.#assertNotDisposed();

    try {
      this.#bindPlayerIdentity(resolveBoundPlayerId(message));

      switch (message.type) {
        case "world-snapshot-request":
          return createMetaverseRealtimeWorldWebTransportServerEventMessage({
            event: this.#runtime.readWorldEvent(nowMs, message.observerPlayerId)
          });
        case "world-snapshot-subscribe":
          return createMetaverseRealtimeWorldWebTransportErrorMessage({
            message:
              "Metaverse world snapshot subscriptions require a persistent WebTransport stream."
          });
        case "world-command-request":
          return createMetaverseRealtimeWorldWebTransportServerEventMessage({
            event: this.#runtime.acceptWorldCommand(message.command, nowMs)
          });
        default: {
          const exhaustiveMessage: never = message;

          throw new Error(
            `Unsupported metaverse world WebTransport request type: ${exhaustiveMessage}`
          );
        }
      }
    } catch (error) {
      return createMetaverseRealtimeWorldWebTransportErrorMessage({
        message:
          error instanceof Error
            ? error.message
            : "Metaverse world WebTransport request failed."
      });
    }
  }

  async handleClientStream(
    message: MetaverseRealtimeWorldWebTransportClientMessage,
    context: PersistentReliableStreamContext<MetaverseRealtimeWorldWebTransportServerMessage>,
    nowMs: number
  ): Promise<boolean> {
    this.#assertNotDisposed();

    if (message.type !== "world-snapshot-subscribe") {
      return false;
    }

    try {
      this.#bindPlayerIdentity(message.observerPlayerId);
    } catch (error) {
      await context.writeResponse(
        createMetaverseRealtimeWorldWebTransportErrorMessage({
          message:
            error instanceof Error
              ? error.message
              : "Metaverse world snapshot subscribe failed."
        })
      );
      return true;
    }

    const unsubscribe = this.#adapter.subscribeWorldSnapshots(
      this,
      message.observerPlayerId,
      context.writeResponse,
      nowMs
    );

    try {
      await context.closed.catch(() => undefined);
    } finally {
      unsubscribe();
    }

    return true;
  }

  get boundPlayerId(): MetaversePlayerId | null {
    return this.#boundPlayerId;
  }

  dispose(): void {
    this.#adapter.unsubscribeSession(this);
    this.#disposed = true;
  }

  #bindPlayerIdentity(playerId: MetaversePlayerId): void {
    if (this.#boundPlayerId !== null && this.#boundPlayerId !== playerId) {
      throw new Error(
        `Metaverse world WebTransport session is already bound to ${this.#boundPlayerId}.`
      );
    }

    this.#boundPlayerId = playerId;
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error(
        "Metaverse world WebTransport session has already been disposed."
      );
    }
  }
}

export class MetaverseWorldWebTransportAdapter {
  readonly #runtime: MetaverseAuthoritativeWorldRuntimeOwner;
  readonly #snapshotSubscribers = new Map<
    MetaverseWorldWebTransportSession,
    MetaverseWorldSnapshotSubscriber
  >();

  constructor(runtime: MetaverseAuthoritativeWorldRuntimeOwner) {
    this.#runtime = runtime;
  }

  openSession(): MetaverseWorldWebTransportSession {
    return new MetaverseWorldWebTransportSession(this.#runtime, this);
  }

  publishWorldSnapshots(nowMs: number): void {
    for (const subscriber of this.#snapshotSubscribers.values()) {
      this.#queueSnapshotForSubscriber(subscriber, nowMs);
    }
  }

  subscribeWorldSnapshots(
    session: MetaverseWorldWebTransportSession,
    observerPlayerId: MetaversePlayerId,
    writeResponse: (
      response: MetaverseRealtimeWorldWebTransportServerMessage
    ) => Promise<void>,
    nowMs: number
  ): () => void {
    this.unsubscribeSession(session);

    const subscriber: MetaverseWorldSnapshotSubscriber = {
      closeAfterWrite: false,
      observerPlayerId,
      pendingResponse: null,
      session,
      writeResponse,
      writing: false
    };

    this.#snapshotSubscribers.set(session, subscriber);
    this.#queueSnapshotForSubscriber(subscriber, nowMs);

    return () => {
      if (this.#snapshotSubscribers.get(session) === subscriber) {
        this.#snapshotSubscribers.delete(session);
      }
    };
  }

  unsubscribeSession(session: MetaverseWorldWebTransportSession): void {
    this.#snapshotSubscribers.delete(session);
  }

  #queueSnapshotForSubscriber(
    subscriber: MetaverseWorldSnapshotSubscriber,
    nowMs: number
  ): void {
    const response = this.#createSnapshotResponse(
      subscriber.observerPlayerId,
      nowMs
    );

    subscriber.pendingResponse = response;
    subscriber.closeAfterWrite = response.type === "world-error";

    if (subscriber.writing) {
      return;
    }

    subscriber.writing = true;
    void this.#flushSubscriber(subscriber);
  }

  #createSnapshotResponse(
    observerPlayerId: MetaversePlayerId,
    nowMs: number
  ): MetaverseRealtimeWorldWebTransportServerMessage {
    try {
      return createMetaverseRealtimeWorldWebTransportServerEventMessage({
        event: this.#runtime.readWorldEvent(nowMs, observerPlayerId)
      });
    } catch (error) {
      return createMetaverseRealtimeWorldWebTransportErrorMessage({
        message:
          error instanceof Error
            ? error.message
            : "Metaverse world snapshot publish failed."
      });
    }
  }

  async #flushSubscriber(
    subscriber: MetaverseWorldSnapshotSubscriber
  ): Promise<void> {
    let keepSubscribed = true;

    try {
      while (true) {
        const pendingResponse = subscriber.pendingResponse;

        if (pendingResponse === null) {
          return;
        }

        const closeAfterWrite = subscriber.closeAfterWrite;

        subscriber.pendingResponse = null;
        subscriber.closeAfterWrite = false;
        await subscriber.writeResponse(pendingResponse);

        if (closeAfterWrite) {
          keepSubscribed = false;
          return;
        }
      }
    } catch {
      // Transport close or slow-subscriber failure removes this writer.
      keepSubscribed = false;
    } finally {
      subscriber.writing = false;

      if (!keepSubscribed) {
        this.#snapshotSubscribers.delete(subscriber.session);
        return;
      }

      if (subscriber.pendingResponse !== null) {
        subscriber.writing = true;
        void this.#flushSubscriber(subscriber);
      }
    }
  }
}
