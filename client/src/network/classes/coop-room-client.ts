import type {
  CoopPlayerId,
  CoopPlayerPresenceSnapshotInput,
  CoopRoomServerEvent,
  CoopRoomSnapshot,
  CoopVector3SnapshotInput
} from "@webgpu-metaverse/shared";
import {
  createCoopFireShotCommand,
  createCoopJoinRoomCommand,
  createCoopKickPlayerCommand,
  createCoopLeaveRoomCommand,
  createCoopSetPlayerReadyCommand,
  createCoopStartSessionCommand,
  createCoopSyncPlayerPresenceCommand
} from "@webgpu-metaverse/shared";

import {
  parseCoopRoomErrorMessage,
  parseCoopRoomServerEvent,
  resolveCoopRoomCommandUrl,
  resolveCoopRoomSnapshotUrl,
  serializeCoopRoomClientCommand
} from "../codecs/coop-room-client-http";
import type {
  CoopRoomClientConfig,
  CoopRoomClientStatusSnapshot,
  CoopRoomJoinRequest
} from "../types/coop-room-client";

interface CoopRoomClientDependencies {
  readonly clearTimeout?: typeof globalThis.clearTimeout;
  readonly fetch?: typeof globalThis.fetch;
  readonly setTimeout?: typeof globalThis.setTimeout;
}

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

type PendingPlayerPresenceUpdate = Omit<
  CoopPlayerPresenceSnapshotInput,
  "lastUpdatedTick" | "stateSequence"
> & {
  readonly stateSequence: number;
};

function freezeStatusSnapshot(
  roomId: CoopRoomClientStatusSnapshot["roomId"],
  playerId: CoopRoomClientStatusSnapshot["playerId"],
  state: CoopRoomClientStatusSnapshot["state"],
  joined: boolean,
  lastSnapshotTick: number | null,
  lastError: string | null
): CoopRoomClientStatusSnapshot {
  return Object.freeze({
    joined,
    lastError,
    lastSnapshotTick,
    playerId,
    roomId,
    state
  });
}

function findPlayerAckSequence(
  roomSnapshot: CoopRoomSnapshot,
  playerId: CoopPlayerId | null
): number {
  if (playerId === null) {
    return 0;
  }

  const playerSnapshot = roomSnapshot.players.find(
    (candidate) => candidate.playerId === playerId
  );

  return playerSnapshot?.activity.lastAcknowledgedShotSequence ?? 0;
}

function hasPlayerMembership(
  roomSnapshot: CoopRoomSnapshot,
  playerId: CoopPlayerId | null
): boolean {
  if (playerId === null) {
    return true;
  }

  return roomSnapshot.players.some(
    (candidate) => candidate.playerId === playerId
  );
}

function resolveMembershipLossMessage(message: string): string | null {
  if (message.startsWith("Unknown co-op room:")) {
    return "The co-op room is no longer available.";
  }

  if (message.startsWith("Unknown co-op player:")) {
    return "You are no longer in the co-op room.";
  }

  return null;
}

function parseRoomSessionOrder(
  sessionId: CoopRoomSnapshot["session"]["sessionId"]
): {
  readonly bootSequence: number;
  readonly ordinal: number;
} | null {
  const matchedSessionOrder = /-session-(?:(\d+)-)?(\d+)$/.exec(sessionId);

  if (matchedSessionOrder === null) {
    return null;
  }

  const bootSequence =
    matchedSessionOrder[1] === undefined
      ? 0
      : Number.parseInt(matchedSessionOrder[1], 10);
  const ordinal = Number.parseInt(matchedSessionOrder[2] ?? "", 10);

  if (
    !Number.isFinite(bootSequence) ||
    !Number.isFinite(ordinal) ||
    bootSequence < 0 ||
    ordinal < 0
  ) {
    return null;
  }

  return Object.freeze({
    bootSequence,
    ordinal
  });
}

function isNewerRoomSession(
  currentSnapshot: CoopRoomSnapshot,
  nextSnapshot: CoopRoomSnapshot
): boolean {
  if (currentSnapshot.session.sessionId === nextSnapshot.session.sessionId) {
    return false;
  }

  const currentSessionOrder = parseRoomSessionOrder(currentSnapshot.session.sessionId);
  const nextSessionOrder = parseRoomSessionOrder(nextSnapshot.session.sessionId);

  if (currentSessionOrder === null || nextSessionOrder === null) {
    return false;
  }

  if (nextSessionOrder.bootSequence !== currentSessionOrder.bootSequence) {
    return nextSessionOrder.bootSequence > currentSessionOrder.bootSequence;
  }

  return nextSessionOrder.ordinal > currentSessionOrder.ordinal;
}

function resolveFetchDependency(
  fetchDependency: typeof globalThis.fetch | undefined
): typeof globalThis.fetch {
  if (fetchDependency !== undefined) {
    return fetchDependency;
  }

  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }

  throw new Error("Fetch API is unavailable for the co-op room client.");
}

export class CoopRoomClient {
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #config: CoopRoomClientConfig;
  readonly #fetch: typeof globalThis.fetch;
  readonly #setTimeout: typeof globalThis.setTimeout;
  readonly #updateListeners = new Set<() => void>();

  #joinPromise: Promise<CoopRoomSnapshot> | null = null;
  #nextClientShotSequence = 0;
  #nextPlayerPresenceSequence = 0;
  #playerId: CoopPlayerId | null = null;
  #playerPresenceSyncHandle: TimeoutHandle | null = null;
  #pendingPlayerPresenceUpdate: PendingPlayerPresenceUpdate | null = null;
  #playerPresenceSyncInFlight = false;
  #pollHandle: TimeoutHandle | null = null;
  #roomSnapshot: CoopRoomSnapshot | null = null;
  #statusSnapshot: CoopRoomClientStatusSnapshot;

  constructor(
    config: CoopRoomClientConfig,
    dependencies: CoopRoomClientDependencies = {}
  ) {
    this.#config = config;
    this.#fetch = resolveFetchDependency(dependencies.fetch);
    this.#setTimeout = dependencies.setTimeout ?? globalThis.setTimeout.bind(globalThis);
    this.#clearTimeout =
      dependencies.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
    this.#statusSnapshot = freezeStatusSnapshot(
      config.roomId,
      null,
      "idle",
      false,
      null,
      null
    );
  }

  get roomSnapshot(): CoopRoomSnapshot | null {
    return this.#roomSnapshot;
  }

  get roomId(): CoopRoomClientConfig["roomId"] {
    return this.#config.roomId;
  }

  get statusSnapshot(): CoopRoomClientStatusSnapshot {
    return this.#statusSnapshot;
  }

  subscribeUpdates(listener: () => void): () => void {
    this.#updateListeners.add(listener);

    return () => {
      this.#updateListeners.delete(listener);
    };
  }

  async ensureJoined(request: CoopRoomJoinRequest): Promise<CoopRoomSnapshot> {
    this.#assertNotDisposed();

    if (this.#playerId !== null && this.#playerId !== request.playerId) {
      throw new Error("Co-op room client already joined with a different player.");
    }

    if (
      this.#roomSnapshot !== null &&
      this.#playerId === request.playerId &&
      this.#statusSnapshot.joined
    ) {
      return this.#roomSnapshot;
    }

    if (this.#joinPromise !== null) {
      return this.#joinPromise;
    }

    this.#playerId = request.playerId;
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#config.roomId,
      request.playerId,
      "joining",
      false,
      this.#statusSnapshot.lastSnapshotTick,
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

  async setPlayerReady(ready: boolean): Promise<CoopRoomSnapshot> {
    this.#assertNotDisposed();

    if (this.#playerId === null || !this.#statusSnapshot.joined) {
      throw new Error("Co-op room client must join before updating readiness.");
    }

    try {
      const serverEvent = await this.#postCommand(
        createCoopSetPlayerReadyCommand({
          playerId: this.#playerId,
          ready,
          roomId: this.#config.roomId
        })
      );

      this.#applyServerEvent(serverEvent);

      return serverEvent.room;
    } catch (error) {
      this.#applyRoomAccessError(error, "Co-op room readiness update failed.");
      throw error;
    }
  }

  async startSession(): Promise<CoopRoomSnapshot> {
    this.#assertNotDisposed();

    if (this.#playerId === null || !this.#statusSnapshot.joined) {
      throw new Error("Co-op room client must join before starting the session.");
    }

    try {
      const serverEvent = await this.#postCommand(
        createCoopStartSessionCommand({
          playerId: this.#playerId,
          roomId: this.#config.roomId
        })
      );

      this.#applyServerEvent(serverEvent);

      return serverEvent.room;
    } catch (error) {
      this.#applyRoomAccessError(error, "Co-op session start failed.");
      throw error;
    }
  }

  async kickPlayer(targetPlayerId: CoopPlayerId): Promise<CoopRoomSnapshot> {
    this.#assertNotDisposed();

    if (this.#playerId === null || !this.#statusSnapshot.joined) {
      throw new Error("Co-op room client must join before removing a player.");
    }

    try {
      const serverEvent = await this.#postCommand(
        createCoopKickPlayerCommand({
          playerId: this.#playerId,
          roomId: this.#config.roomId,
          targetPlayerId
        })
      );

      this.#applyServerEvent(serverEvent);

      return serverEvent.room;
    } catch (error) {
      this.#applyRoomAccessError(error, "Co-op player removal failed.");
      throw error;
    }
  }

  fireShot(
    origin: CoopVector3SnapshotInput,
    aimDirection: CoopVector3SnapshotInput
  ): void {
    if (
      this.#playerId === null ||
      this.#statusSnapshot.state === "disposed" ||
      !this.#statusSnapshot.joined
    ) {
      return;
    }

    this.#nextClientShotSequence += 1;
    const command = createCoopFireShotCommand({
      aimDirection,
      clientShotSequence: this.#nextClientShotSequence,
      origin,
      playerId: this.#playerId,
      roomId: this.#config.roomId
    });

    void this.#postCommand(command)
      .then((serverEvent) => {
        this.#applyServerEvent(serverEvent);
      })
      .catch((error: unknown) => {
        this.#applyRoomAccessError(error, "Co-op fire-shot command failed.");
      });
  }

  syncPlayerPresence(
    presence: Omit<CoopPlayerPresenceSnapshotInput, "lastUpdatedTick" | "stateSequence">
  ): void {
    if (
      this.#playerId === null ||
      this.#statusSnapshot.state === "disposed" ||
      !this.#statusSnapshot.joined
    ) {
      return;
    }

    this.#nextPlayerPresenceSequence += 1;
    this.#pendingPlayerPresenceUpdate = {
      ...presence,
      stateSequence: this.#nextPlayerPresenceSequence
    };
    this.#schedulePlayerPresenceSync(this.#resolvePollDelayMs());
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
    this.#cancelScheduledPlayerPresenceSync();
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#config.roomId,
      this.#playerId,
      "disposed",
      false,
      this.#statusSnapshot.lastSnapshotTick,
      null
    );
    this.#notifyUpdates();

    if (playerIdToLeave !== null) {
      void this.#postLeaveRoomDuringDispose(playerIdToLeave);
    }
  }

  async #ensureJoinedInternal(
    request: CoopRoomJoinRequest
  ): Promise<CoopRoomSnapshot> {
    try {
      const serverEvent = await this.#postCommand(
        createCoopJoinRoomCommand({
          playerId: request.playerId,
          ready: request.ready,
          roomId: this.#config.roomId,
          username: request.username
        })
      );

      this.#applyServerEvent(serverEvent);

      if (!this.#isDisposed()) {
        this.#schedulePoll(0);
      }

      return serverEvent.room;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Co-op room join failed.";

      this.#setError(message);
      throw error;
    }
  }

  #applyServerEvent(serverEvent: CoopRoomServerEvent): void {
    if (this.#isDisposed()) {
      return;
    }

    if (!hasPlayerMembership(serverEvent.room, this.#playerId)) {
      this.#setMembershipLost("You are no longer in the co-op room.");
      return;
    }

    if (!this.#shouldAcceptRoomSnapshot(serverEvent.room)) {
      return;
    }

    this.#roomSnapshot = serverEvent.room;
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#config.roomId,
      this.#playerId,
      "connected",
      true,
      serverEvent.room.tick.currentTick,
      null
    );
    this.#notifyUpdates();
  }

  #shouldAcceptRoomSnapshot(nextSnapshot: CoopRoomSnapshot): boolean {
    if (this.#roomSnapshot === null) {
      return true;
    }

    if (this.#roomSnapshot.session.sessionId !== nextSnapshot.session.sessionId) {
      return isNewerRoomSession(this.#roomSnapshot, nextSnapshot);
    }

    const currentTick = this.#roomSnapshot.tick.currentTick;
    const nextTick = nextSnapshot.tick.currentTick;

    if (nextTick > currentTick) {
      return true;
    }

    if (nextTick < currentTick) {
      return false;
    }

    return (
      findPlayerAckSequence(nextSnapshot, this.#playerId) >=
      findPlayerAckSequence(this.#roomSnapshot, this.#playerId)
    );
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
      void this.#pollRoomSnapshot();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPoll(): void {
    if (this.#pollHandle === null) {
      return;
    }

    this.#clearTimeout(this.#pollHandle);
    this.#pollHandle = null;
  }

  #schedulePlayerPresenceSync(delayMs: number): void {
    if (
      this.#playerId === null ||
      this.#statusSnapshot.state === "disposed" ||
      this.#pendingPlayerPresenceUpdate === null
    ) {
      return;
    }

    if (this.#playerPresenceSyncInFlight || this.#playerPresenceSyncHandle !== null) {
      return;
    }

    this.#playerPresenceSyncHandle = this.#setTimeout(() => {
      this.#playerPresenceSyncHandle = null;
      void this.#flushPlayerPresenceSync();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPlayerPresenceSync(): void {
    if (this.#playerPresenceSyncHandle === null) {
      return;
    }

    this.#clearTimeout(this.#playerPresenceSyncHandle);
    this.#playerPresenceSyncHandle = null;
  }

  async #flushPlayerPresenceSync(): Promise<void> {
    if (
      this.#playerId === null ||
      this.#statusSnapshot.state === "disposed" ||
      this.#pendingPlayerPresenceUpdate === null
    ) {
      return;
    }

    const pendingUpdate = this.#pendingPlayerPresenceUpdate;

    this.#pendingPlayerPresenceUpdate = null;
    this.#playerPresenceSyncInFlight = true;

    try {
      const serverEvent = await this.#postCommand(
        createCoopSyncPlayerPresenceCommand({
          ...pendingUpdate,
          weaponId: pendingUpdate.weaponId ?? "semiautomatic-pistol",
          playerId: this.#playerId,
          roomId: this.#config.roomId
        })
      );

      this.#applyServerEvent(serverEvent);
    } catch (error) {
      this.#setError(
        error instanceof Error
          ? error.message
          : "Co-op player presence sync failed."
      );
    } finally {
      this.#playerPresenceSyncInFlight = false;

      if (this.#pendingPlayerPresenceUpdate !== null && !this.#isDisposed()) {
        this.#schedulePlayerPresenceSync(this.#resolvePollDelayMs());
      }
    }
  }

  async #pollRoomSnapshot(): Promise<void> {
    if (this.#playerId === null || this.#statusSnapshot.state === "disposed") {
      return;
    }

    try {
      const response = await this.#fetch(
        resolveCoopRoomSnapshotUrl(
          this.#config.serverOrigin,
          this.#config.roomCollectionPath,
          this.#config.roomId,
          this.#playerId
        ),
        {
          cache: "no-store"
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          parseCoopRoomErrorMessage(payload, "Co-op room snapshot poll failed.")
        );
      }

      this.#applyServerEvent(parseCoopRoomServerEvent(payload));
    } catch (error) {
      this.#applyRoomAccessError(error, "Co-op room snapshot poll failed.");
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
    command:
      | ReturnType<typeof createCoopJoinRoomCommand>
      | ReturnType<typeof createCoopSetPlayerReadyCommand>
      | ReturnType<typeof createCoopStartSessionCommand>
      | ReturnType<typeof createCoopKickPlayerCommand>
      | ReturnType<typeof createCoopLeaveRoomCommand>
      | ReturnType<typeof createCoopFireShotCommand>
      | ReturnType<typeof createCoopSyncPlayerPresenceCommand>,
    requestInit: RequestInit = {}
  ): Promise<CoopRoomServerEvent> {
    const response = await this.#fetch(
      resolveCoopRoomCommandUrl(
        this.#config.serverOrigin,
        this.#config.roomCollectionPath,
        this.#config.roomId
      ),
      {
        body: serializeCoopRoomClientCommand(command),
        headers: {
          "content-type": "application/json"
        },
        method: "POST",
        ...requestInit
      }
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        parseCoopRoomErrorMessage(payload, "Co-op room command failed.")
      );
    }

    return parseCoopRoomServerEvent(payload);
  }

  async #postLeaveRoomDuringDispose(playerId: CoopPlayerId): Promise<void> {
    try {
      await this.#postCommand(
        createCoopLeaveRoomCommand({
          playerId,
          roomId: this.#config.roomId
        }),
        {
          keepalive: true
        }
      );
    } catch {
      // Best-effort disconnect signaling should never block disposal.
    }
  }

  #applyRoomAccessError(error: unknown, fallbackMessage: string): void {
    const message =
      error instanceof Error ? error.message : fallbackMessage;
    const membershipLossMessage = resolveMembershipLossMessage(message);

    if (membershipLossMessage !== null) {
      this.#setMembershipLost(membershipLossMessage);
      return;
    }

    this.#setError(message);
  }

  #setMembershipLost(message: string): void {
    if (this.#statusSnapshot.state === "disposed") {
      return;
    }

    this.#cancelScheduledPoll();
    this.#cancelScheduledPlayerPresenceSync();
    this.#pendingPlayerPresenceUpdate = null;
    this.#roomSnapshot = null;
    this.#statusSnapshot = freezeStatusSnapshot(
      this.#config.roomId,
      this.#playerId,
      "error",
      false,
      this.#statusSnapshot.lastSnapshotTick,
      message
    );
    this.#notifyUpdates();
  }

  #resolvePollDelayMs(): number {
    if (this.#roomSnapshot !== null) {
      return Number(this.#roomSnapshot.tick.tickIntervalMs);
    }

    return Number(this.#config.defaultPollIntervalMs);
  }

  #setError(message: string): void {
    if (this.#statusSnapshot.state === "disposed") {
      return;
    }

    this.#statusSnapshot = freezeStatusSnapshot(
      this.#config.roomId,
      this.#playerId,
      "error",
      this.#roomSnapshot !== null,
      this.#roomSnapshot?.tick.currentTick ?? null,
      message
    );
    this.#notifyUpdates();
  }

  #assertNotDisposed(): void {
    if (this.#isDisposed()) {
      throw new Error("Co-op room client is already disposed.");
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
