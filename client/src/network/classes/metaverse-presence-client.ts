import type {
  MetaversePresenceCommand,
  MetaversePlayerId,
  MetaversePresencePoseSnapshotInput,
  MetaversePresenceRosterEvent,
  MetaversePresenceRosterSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseJoinPresenceCommand,
  createMetaverseLeavePresenceCommand,
  createMetaverseSyncPresenceCommand
} from "@webgpu-metaverse/shared/metaverse/presence";

import { createMetaversePresenceHttpTransport } from "../adapters/metaverse-presence-http-transport";
import type {
  MetaversePresenceClientConfig,
  MetaversePresenceClientStatusSnapshot,
  MetaversePresenceJoinRequest
} from "../types/metaverse-presence-client";
import type { MetaversePresenceTransport } from "../types/metaverse-presence-transport";
import {
  createRealtimeReliableTransportStatusSnapshot,
  type RealtimeReliableTransportStatusSnapshot
} from "../types/realtime-transport-status";
import type { NetworkCommandTransportOptions } from "../types/transport-command-options";

interface MetaversePresenceClientDependencies {
  readonly clearTimeout?: typeof globalThis.clearTimeout;
  readonly fetch?: typeof globalThis.fetch;
  readonly resolveReliableTransportStatusSnapshot?:
    | (() => RealtimeReliableTransportStatusSnapshot)
    | undefined;
  readonly setTimeout?: typeof globalThis.setTimeout;
  readonly transport?: MetaversePresenceTransport;
}

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

type PendingMetaversePresenceUpdate = Omit<
  MetaversePresencePoseSnapshotInput,
  "stateSequence"
> & {
  readonly stateSequence: number;
};

function freezeStatusSnapshot(
  playerId: MetaversePresenceClientStatusSnapshot["playerId"],
  state: MetaversePresenceClientStatusSnapshot["state"],
  joined: boolean,
  lastSnapshotSequence: number | null,
  lastError: string | null
): MetaversePresenceClientStatusSnapshot {
  return Object.freeze({
    joined,
    lastError,
    lastSnapshotSequence,
    playerId,
    state
  });
}

function hasPlayerMembership(
  rosterSnapshot: MetaversePresenceRosterSnapshot,
  playerId: MetaversePlayerId | null
): boolean {
  if (playerId === null) {
    return true;
  }

  return rosterSnapshot.players.some(
    (candidate) => candidate.playerId === playerId
  );
}

function resolveMembershipLossMessage(message: string): string | null {
  if (message.startsWith("Unknown metaverse player:")) {
    return "You are no longer in the metaverse presence roster.";
  }

  return null;
}

export class MetaversePresenceClient {
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #config: MetaversePresenceClientConfig;
  readonly #resolveReliableTransportStatusSnapshot:
    | (() => RealtimeReliableTransportStatusSnapshot)
    | null;
  readonly #setTimeout: typeof globalThis.setTimeout;
  readonly #transport: MetaversePresenceTransport;
  readonly #updateListeners = new Set<() => void>();

  #joinRequest: MetaversePresenceJoinRequest | null = null;
  #joinPromise: Promise<MetaversePresenceRosterSnapshot> | null = null;
  #lastPresencePose: Omit<
    MetaversePresencePoseSnapshotInput,
    "stateSequence"
  > | null = null;
  #nextPresenceSequence = 0;
  #pendingPresenceUpdate: PendingMetaversePresenceUpdate | null = null;
  #playerId: MetaversePlayerId | null = null;
  #pollHandle: TimeoutHandle | null = null;
  #presenceSyncHandle: TimeoutHandle | null = null;
  #presenceSyncInFlight = false;
  #rosterSnapshot: MetaversePresenceRosterSnapshot | null = null;
  #statusSnapshot: MetaversePresenceClientStatusSnapshot;

  constructor(
    config: MetaversePresenceClientConfig,
    dependencies: MetaversePresenceClientDependencies = {}
  ) {
    this.#config = config;
    this.#resolveReliableTransportStatusSnapshot =
      dependencies.resolveReliableTransportStatusSnapshot ?? null;
    this.#setTimeout = dependencies.setTimeout ?? globalThis.setTimeout.bind(globalThis);
    this.#clearTimeout =
      dependencies.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
    this.#transport =
      dependencies.transport ??
      createMetaversePresenceHttpTransport(
        config,
        dependencies.fetch === undefined
          ? {}
          : {
              fetch: dependencies.fetch
            }
      );
    this.#statusSnapshot = freezeStatusSnapshot(null, "idle", false, null, null);
  }

  get rosterSnapshot(): MetaversePresenceRosterSnapshot | null {
    return this.#rosterSnapshot;
  }

  get statusSnapshot(): MetaversePresenceClientStatusSnapshot {
    return this.#statusSnapshot;
  }

  get reliableTransportStatusSnapshot(): RealtimeReliableTransportStatusSnapshot {
    return (
      this.#resolveReliableTransportStatusSnapshot?.() ??
      createRealtimeReliableTransportStatusSnapshot({
        activeTransport: "http",
        browserWebTransportAvailable: false,
        enabled: true,
        fallbackActive: false,
        lastTransportError: null,
        preference: "http",
        webTransportConfigured: false,
        webTransportStatus: "not-requested"
      })
    );
  }

  subscribeUpdates(listener: () => void): () => void {
    this.#updateListeners.add(listener);

    return () => {
      this.#updateListeners.delete(listener);
    };
  }

  async ensureJoined(
    request: MetaversePresenceJoinRequest
  ): Promise<MetaversePresenceRosterSnapshot> {
    this.#assertNotDisposed();

    if (this.#playerId !== null && this.#playerId !== request.playerId) {
      throw new Error(
        "Metaverse presence client already joined with a different player."
      );
    }

    if (
      this.#rosterSnapshot !== null &&
      this.#playerId === request.playerId &&
      this.#statusSnapshot.joined
    ) {
      return this.#rosterSnapshot;
    }

    if (this.#joinPromise !== null) {
      return this.#joinPromise;
    }

    this.#joinRequest = request;
    this.#lastPresencePose = request.pose;
    this.#playerId = request.playerId;
    this.#statusSnapshot = freezeStatusSnapshot(
      request.playerId,
      "joining",
      false,
      this.#statusSnapshot.lastSnapshotSequence,
      null
    );
    this.#notifyUpdates();

    const joinPromise = this.#ensureJoinedInternal(request);
    this.#joinPromise = joinPromise;

    try {
      return await joinPromise;
    } finally {
      if (this.#joinPromise === joinPromise) {
        this.#joinPromise = null;
      }
    }
  }

  syncPresence(
    pose: Omit<MetaversePresencePoseSnapshotInput, "stateSequence">
  ): void {
    this.#lastPresencePose = pose;

    if (
      this.#playerId === null ||
      this.#statusSnapshot.state === "disposed" ||
      !this.#statusSnapshot.joined
    ) {
      return;
    }

    this.#nextPresenceSequence += 1;
    this.#pendingPresenceUpdate = {
      ...pose,
      stateSequence: this.#nextPresenceSequence
    };
    this.#schedulePresenceSync(this.#resolvePollDelayMs());
  }

  dispose(): void {
    if (this.#statusSnapshot.state === "disposed") {
      return;
    }

    const playerIdToLeave =
      this.#statusSnapshot.joined && this.#playerId !== null
        ? this.#playerId
        : null;

    this.#cancelScheduledPoll();
    this.#cancelScheduledPresenceSync();
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#playerId,
      "disposed",
      false,
      this.#statusSnapshot.lastSnapshotSequence,
      null
    );
    this.#notifyUpdates();

    if (playerIdToLeave !== null) {
      void this.#postLeaveDuringDispose(playerIdToLeave);
      return;
    }

    this.#transport.dispose?.();
  }

  async #ensureJoinedInternal(
    request: MetaversePresenceJoinRequest
  ): Promise<MetaversePresenceRosterSnapshot> {
    try {
      const serverEvent = await this.#postCommand(
        createMetaverseJoinPresenceCommand(request)
      );

      this.#applyServerEvent(serverEvent);

      if (!this.#isDisposed()) {
        this.#schedulePoll(0);

        if (this.#pendingPresenceUpdate !== null) {
          this.#schedulePresenceSync(0);
        }
      }

      return serverEvent.roster;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Metaverse presence join failed.";

      this.#setError(message);
      throw error;
    }
  }

  #applyServerEvent(serverEvent: MetaversePresenceRosterEvent): void {
    if (this.#isDisposed()) {
      return;
    }

    if (!hasPlayerMembership(serverEvent.roster, this.#playerId)) {
      this.#setMembershipLost("You are no longer in the metaverse presence roster.");
      return;
    }

    if (!this.#shouldAcceptRosterSnapshot(serverEvent.roster)) {
      return;
    }

    this.#rosterSnapshot = serverEvent.roster;
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#playerId,
      "connected",
      true,
      serverEvent.roster.snapshotSequence,
      null
    );
    this.#notifyUpdates();
  }

  #shouldAcceptRosterSnapshot(
    nextSnapshot: MetaversePresenceRosterSnapshot
  ): boolean {
    if (this.#rosterSnapshot === null) {
      return true;
    }

    return nextSnapshot.snapshotSequence >= this.#rosterSnapshot.snapshotSequence;
  }

  #schedulePoll(delayMs: number): void {
    this.#cancelScheduledPoll();

    if (
      this.#statusSnapshot.state === "disposed" ||
      this.#playerId === null ||
      !this.#statusSnapshot.joined
    ) {
      return;
    }

    this.#pollHandle = this.#setTimeout(() => {
      this.#pollHandle = null;
      void this.#pollRosterSnapshot();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPoll(): void {
    if (this.#pollHandle === null) {
      return;
    }

    this.#clearTimeout(this.#pollHandle);
    this.#pollHandle = null;
  }

  #schedulePresenceSync(delayMs: number): void {
    if (
      this.#playerId === null ||
      this.#statusSnapshot.state === "disposed" ||
      this.#pendingPresenceUpdate === null ||
      !this.#statusSnapshot.joined
    ) {
      return;
    }

    if (this.#presenceSyncInFlight || this.#presenceSyncHandle !== null) {
      return;
    }

    this.#presenceSyncHandle = this.#setTimeout(() => {
      this.#presenceSyncHandle = null;
      void this.#flushPresenceSync();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPresenceSync(): void {
    if (this.#presenceSyncHandle === null) {
      return;
    }

    this.#clearTimeout(this.#presenceSyncHandle);
    this.#presenceSyncHandle = null;
  }

  async #flushPresenceSync(): Promise<void> {
    if (
      this.#playerId === null ||
      this.#statusSnapshot.state === "disposed" ||
      this.#pendingPresenceUpdate === null
    ) {
      return;
    }

    const pendingUpdate = this.#pendingPresenceUpdate;

    this.#pendingPresenceUpdate = null;
    this.#presenceSyncInFlight = true;

    try {
      const serverEvent = await this.#postCommand(
        createMetaverseSyncPresenceCommand({
          playerId: this.#playerId,
          pose: pendingUpdate
        })
      );

      this.#applyServerEvent(serverEvent);
    } catch (error) {
      this.#applyPresenceAccessError(
        error,
        "Metaverse presence sync failed."
      );
    } finally {
      this.#presenceSyncInFlight = false;

      if (this.#pendingPresenceUpdate !== null && !this.#isDisposed()) {
        this.#schedulePresenceSync(this.#resolvePollDelayMs());
      }
    }
  }

  async #pollRosterSnapshot(): Promise<void> {
    if (this.#playerId === null || this.#statusSnapshot.state === "disposed") {
      return;
    }

    try {
      this.#applyServerEvent(
        await this.#transport.pollRosterSnapshot(this.#playerId)
      );
    } catch (error) {
      this.#applyPresenceAccessError(error, "Metaverse presence poll failed.");
    } finally {
      if (
        !this.#isDisposed() &&
        this.#playerId !== null &&
        this.#statusSnapshot.joined
      ) {
        this.#schedulePoll(this.#resolvePollDelayMs());
      }
    }
  }

  async #postCommand(
    command: MetaversePresenceCommand,
    options: NetworkCommandTransportOptions = {}
  ): Promise<MetaversePresenceRosterEvent> {
    return this.#transport.sendCommand(command, options);
  }

  async #postLeaveDuringDispose(playerId: MetaversePlayerId): Promise<void> {
    try {
      await this.#postCommand(
        createMetaverseLeavePresenceCommand({
          playerId
        }),
        {
          deliveryHint: "best-effort-disconnect"
        }
      );
    } catch {
      // Best-effort disconnect signaling should never block disposal.
    } finally {
      this.#transport.dispose?.();
    }
  }

  #applyPresenceAccessError(error: unknown, fallbackMessage: string): void {
    const message = error instanceof Error ? error.message : fallbackMessage;
    const membershipLossMessage = resolveMembershipLossMessage(message);

    if (membershipLossMessage !== null) {
      this.#recoverMembershipLoss(membershipLossMessage);
      return;
    }

    this.#setError(message);
  }

  #recoverMembershipLoss(message: string): void {
    if (this.#statusSnapshot.state === "disposed") {
      return;
    }

    const joinRequest = this.#joinRequest;
    const lastPresencePose = this.#lastPresencePose;

    if (joinRequest === null || lastPresencePose === null) {
      this.#setMembershipLost(message);
      return;
    }

    this.#cancelScheduledPoll();
    this.#cancelScheduledPresenceSync();
    this.#rosterSnapshot = null;
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#playerId,
      "joining",
      false,
      this.#statusSnapshot.lastSnapshotSequence,
      null
    );
    this.#notifyUpdates();

    void this.ensureJoined({
      ...joinRequest,
      pose: lastPresencePose
    }).catch((error) => {
      const nextMessage =
        error instanceof Error ? error.message : message;

      this.#setError(nextMessage);
    });
  }

  #setMembershipLost(message: string): void {
    if (this.#statusSnapshot.state === "disposed") {
      return;
    }

    this.#cancelScheduledPoll();
    this.#cancelScheduledPresenceSync();
    this.#pendingPresenceUpdate = null;
    this.#rosterSnapshot = null;
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#playerId,
      "error",
      false,
      this.#statusSnapshot.lastSnapshotSequence,
      message
    );
    this.#notifyUpdates();
  }

  #resolvePollDelayMs(): number {
    if (this.#rosterSnapshot !== null) {
      return Number(this.#rosterSnapshot.tickIntervalMs);
    }

    return Number(this.#config.defaultPollIntervalMs);
  }

  #setError(message: string): void {
    if (this.#statusSnapshot.state === "disposed") {
      return;
    }

    this.#statusSnapshot = freezeStatusSnapshot(
      this.#playerId,
      "error",
      this.#rosterSnapshot !== null,
      this.#rosterSnapshot?.snapshotSequence ?? null,
      message
    );
    this.#notifyUpdates();
  }

  #assertNotDisposed(): void {
    if (this.#isDisposed()) {
      throw new Error("Metaverse presence client is already disposed.");
    }
  }

  #isDisposed(): boolean {
    return this.#statusSnapshot.state === "disposed";
  }

  #notifyUpdates(): void {
    for (const listener of this.#updateListeners) {
      listener();
    }
  }
}
