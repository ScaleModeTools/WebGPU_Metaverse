import type { MetaverseRealtimeWorldSnapshot } from "@webgpu-metaverse/shared";

import type { MetaverseLocalPlayerIdentity } from "../classes/metaverse-presence-runtime";
import type { MetaverseWorldClientRuntime } from "@/network";

interface MetaverseRemoteWorldConnectionLifecycleDependencies {
  readonly createMetaverseWorldClient:
    | (() => MetaverseWorldClientRuntime)
    | null;
  readonly localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly onRemoteWorldUpdate: () => void;
}

export class MetaverseRemoteWorldConnectionLifecycle {
  readonly #createMetaverseWorldClient:
    | (() => MetaverseWorldClientRuntime)
    | null;
  readonly #localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly #onRemoteWorldUpdate: () => void;

  #connectionPromise: Promise<MetaverseRealtimeWorldSnapshot> | null = null;
  #worldClient: MetaverseWorldClientRuntime | null = null;
  #worldUnsubscribe: (() => void) | null = null;

  constructor({
    createMetaverseWorldClient,
    localPlayerIdentity,
    onRemoteWorldUpdate
  }: MetaverseRemoteWorldConnectionLifecycleDependencies) {
    this.#createMetaverseWorldClient = createMetaverseWorldClient;
    this.#localPlayerIdentity = localPlayerIdentity;
    this.#onRemoteWorldUpdate = onRemoteWorldUpdate;
  }

  get worldClient(): MetaverseWorldClientRuntime | null {
    return this.#worldClient;
  }

  boot(): void {
    this.dispose();

    if (
      this.#createMetaverseWorldClient === null ||
      this.#localPlayerIdentity === null
    ) {
      return;
    }

    const worldClient = this.#createMetaverseWorldClient();

    this.#worldClient = worldClient;
    this.#worldUnsubscribe = worldClient.subscribeUpdates(() => {
      if (this.#worldClient !== worldClient) {
        return;
      }

      this.#onRemoteWorldUpdate();
    });
  }

  dispose(): void {
    this.#worldUnsubscribe?.();
    this.#worldUnsubscribe = null;
    this.#worldClient?.dispose();
    this.#worldClient = null;
    this.#connectionPromise = null;
  }

  syncConnection(presenceJoined: boolean): void {
    if (
      !presenceJoined ||
      this.#localPlayerIdentity === null ||
      this.#worldClient === null ||
      this.#connectionPromise !== null ||
      this.#worldClient.statusSnapshot.connected
    ) {
      return;
    }

    const connectionPromise = this.#worldClient.ensureConnected(
      this.#localPlayerIdentity.playerId
    );
    this.#connectionPromise = connectionPromise;

    void connectionPromise
      .catch(() => {
        if (this.#connectionPromise !== connectionPromise) {
          return;
        }

        this.#onRemoteWorldUpdate();
      })
      .finally(() => {
        if (this.#connectionPromise === connectionPromise) {
          this.#connectionPromise = null;
        }
      });
  }
}
