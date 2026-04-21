import type {
  MetaverseRealtimePlayerLookSnapshot,
  MetaverseRealtimePlayerTraversalAuthoritySnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseSyncPlayerLookIntentCommandInput
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import { createMetaverseSyncPlayerLookIntentCommand } from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type PendingPlayerLookIntentCommand = ReturnType<
  typeof createMetaverseSyncPlayerLookIntentCommand
>;
type LocalPlayerLookAckSnapshot = {
  readonly lastProcessedLookSequence: number;
  readonly traversalAuthority?: MetaverseRealtimePlayerTraversalAuthoritySnapshot;
};

export interface MetaverseWorldPlayerLookSyncDependencies {
  readonly acceptWorldEvent: (
    playerId: MetaversePlayerId,
    worldEvent: MetaverseRealtimeWorldEvent
  ) => void;
  readonly applyWorldAccessError: (
    error: unknown,
    fallbackMessage: string
  ) => void;
  readonly clearTimeout: typeof globalThis.clearTimeout;
  readonly readLatestLocalPlayerSnapshot: () => LocalPlayerLookAckSnapshot | null;
  readonly readPlayerId: () => MetaversePlayerId | null;
  readonly readStatusSnapshot: () => MetaverseWorldClientStatusSnapshot;
  readonly resolveCommandDelayMs: () => number;
  readonly sendPlayerLookIntentCommand: (
    command: PendingPlayerLookIntentCommand
  ) => Promise<MetaverseRealtimeWorldEvent | null>;
  readonly setTimeout: typeof globalThis.setTimeout;
}

function playerLookIntentMatches(
  leftIntent: MetaverseRealtimePlayerLookSnapshot | null,
  rightIntent: MetaverseSyncPlayerLookIntentCommandInput["lookIntent"]
): boolean {
  if (leftIntent === null) {
    return false;
  }

  return (
    leftIntent.pitchRadians ===
      (typeof rightIntent.pitchRadians === "number" &&
      Number.isFinite(rightIntent.pitchRadians)
        ? rightIntent.pitchRadians
        : 0) &&
    leftIntent.yawRadians ===
      (typeof rightIntent.yawRadians === "number" &&
      Number.isFinite(rightIntent.yawRadians)
        ? rightIntent.yawRadians
        : 0)
  );
}

export class MetaverseWorldPlayerLookSync {
  readonly #acceptWorldEvent: MetaverseWorldPlayerLookSyncDependencies["acceptWorldEvent"];
  readonly #applyWorldAccessError: MetaverseWorldPlayerLookSyncDependencies["applyWorldAccessError"];
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #readLatestLocalPlayerSnapshot: MetaverseWorldPlayerLookSyncDependencies["readLatestLocalPlayerSnapshot"];
  readonly #readPlayerId: MetaverseWorldPlayerLookSyncDependencies["readPlayerId"];
  readonly #readStatusSnapshot: MetaverseWorldPlayerLookSyncDependencies["readStatusSnapshot"];
  readonly #resolveCommandDelayMs: MetaverseWorldPlayerLookSyncDependencies["resolveCommandDelayMs"];
  readonly #sendPlayerLookIntentCommand: MetaverseWorldPlayerLookSyncDependencies["sendPlayerLookIntentCommand"];
  readonly #setTimeout: typeof globalThis.setTimeout;

  #lastPlayerLookIntent: MetaverseRealtimePlayerLookSnapshot | null = null;
  #lastPlayerLookIntentCommand: PendingPlayerLookIntentCommand | null = null;
  #nextPlayerLookSequence = 0;
  #pendingPlayerLookIntentCommand: PendingPlayerLookIntentCommand | null = null;
  #playerLookInputSyncHandle: TimeoutHandle | null = null;
  #playerLookInputSyncInFlight = false;

  constructor(dependencies: MetaverseWorldPlayerLookSyncDependencies) {
    this.#acceptWorldEvent = dependencies.acceptWorldEvent;
    this.#applyWorldAccessError = dependencies.applyWorldAccessError;
    this.#clearTimeout = dependencies.clearTimeout;
    this.#readLatestLocalPlayerSnapshot = dependencies.readLatestLocalPlayerSnapshot;
    this.#readPlayerId = dependencies.readPlayerId;
    this.#readStatusSnapshot = dependencies.readStatusSnapshot;
    this.#resolveCommandDelayMs = dependencies.resolveCommandDelayMs;
    this.#sendPlayerLookIntentCommand = dependencies.sendPlayerLookIntentCommand;
    this.#setTimeout = dependencies.setTimeout;
  }

  get latestPlayerLookSequence(): number {
    return this.#nextPlayerLookSequence;
  }

  syncFromAuthoritativeWorld(): void {
    this.#rebaseLookCommandSequences(this.#readLatestLocalPlayerSnapshot());
    this.#syncPlayerLookInputSchedule();
  }

  syncPlayerLookIntent(
    commandInput: MetaverseSyncPlayerLookIntentCommandInput | null
  ): void {
    if (commandInput === null) {
      this.#lastPlayerLookIntent = null;
      this.#lastPlayerLookIntentCommand = null;
      this.#pendingPlayerLookIntentCommand = null;
      this.#cancelScheduledPlayerLookInputSync();
      return;
    }

    if (
      playerLookIntentMatches(
        this.#lastPlayerLookIntent,
        commandInput.lookIntent
      )
    ) {
      return;
    }

    this.#nextPlayerLookSequence += 1;
    this.#pendingPlayerLookIntentCommand = createMetaverseSyncPlayerLookIntentCommand(
      {
        lookIntent: commandInput.lookIntent,
        lookSequence: this.#nextPlayerLookSequence,
        playerId: commandInput.playerId
      }
    );
    this.#lastPlayerLookIntentCommand = this.#pendingPlayerLookIntentCommand;
    this.#lastPlayerLookIntent = this.#pendingPlayerLookIntentCommand.lookIntent;

    if (this.#readStatusSnapshot().connected) {
      this.#cancelScheduledPlayerLookInputSync();
      this.#syncPlayerLookInputSchedule();
    }
  }

  dispose(): void {
    this.#cancelScheduledPlayerLookInputSync();
  }

  #schedulePlayerLookInputSync(delayMs: number): void {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();

    if (
      statusSnapshot.state === "disposed" ||
      playerId === null ||
      !statusSnapshot.connected ||
      this.#pendingPlayerLookIntentCommand === null ||
      this.#playerLookInputSyncInFlight ||
      this.#playerLookInputSyncHandle !== null
    ) {
      return;
    }

    this.#playerLookInputSyncHandle = this.#setTimeout(() => {
      this.#playerLookInputSyncHandle = null;
      void this.#flushPlayerLookInputSync();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPlayerLookInputSync(): void {
    if (this.#playerLookInputSyncHandle === null) {
      return;
    }

    this.#clearTimeout(this.#playerLookInputSyncHandle);
    this.#playerLookInputSyncHandle = null;
  }

  #syncPlayerLookInputSchedule(): void {
    const latestProcessedLookSequence =
      this.#readLatestLocalPlayerSnapshot()?.lastProcessedLookSequence ?? null;

    if (
      this.#pendingPlayerLookIntentCommand !== null &&
      latestProcessedLookSequence !== null &&
      latestProcessedLookSequence >=
        this.#pendingPlayerLookIntentCommand.lookSequence
    ) {
      this.#pendingPlayerLookIntentCommand = null;
    }

    if (this.#pendingPlayerLookIntentCommand !== null) {
      this.#schedulePlayerLookInputSync(0);
      return;
    }

    if (this.#shouldResendLatestPlayerLookIntentCommand()) {
      this.#pendingPlayerLookIntentCommand = this.#lastPlayerLookIntentCommand;
      this.#schedulePlayerLookInputSync(this.#resolveCommandDelayMs());
      return;
    }

    this.#cancelScheduledPlayerLookInputSync();
  }

  async #flushPlayerLookInputSync(): Promise<void> {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();

    if (
      playerId === null ||
      statusSnapshot.state === "disposed" ||
      !statusSnapshot.connected ||
      this.#pendingPlayerLookIntentCommand === null
    ) {
      return;
    }

    const pendingCommand = this.#pendingPlayerLookIntentCommand;

    this.#lastPlayerLookIntentCommand = pendingCommand;
    this.#pendingPlayerLookIntentCommand = null;
    this.#playerLookInputSyncInFlight = true;

    try {
      const worldEvent = await this.#sendPlayerLookIntentCommand(pendingCommand);

      if (worldEvent !== null) {
        this.#acceptWorldEvent(playerId, worldEvent);
      }
    } catch (error) {
      this.#applyWorldAccessError(
        error,
        "Metaverse world player look sync failed."
      );
    } finally {
      this.#playerLookInputSyncInFlight = false;

      if (this.#readStatusSnapshot().connected) {
        this.#syncPlayerLookInputSchedule();
      }
    }
  }

  #rebaseLookCommandSequences(
    localPlayerSnapshot: LocalPlayerLookAckSnapshot | null
  ): void {
    if (localPlayerSnapshot === null) {
      return;
    }

    const authoritativeLookSequence =
      localPlayerSnapshot.lastProcessedLookSequence;

    if (authoritativeLookSequence <= this.#nextPlayerLookSequence) {
      return;
    }

    this.#nextPlayerLookSequence = authoritativeLookSequence;

    const pendingCommand = this.#pendingPlayerLookIntentCommand;

    if (pendingCommand !== null) {
      this.#nextPlayerLookSequence += 1;
      this.#pendingPlayerLookIntentCommand = createMetaverseSyncPlayerLookIntentCommand(
        {
          lookIntent: pendingCommand.lookIntent,
          lookSequence: this.#nextPlayerLookSequence,
          playerId: pendingCommand.playerId
        }
      );
      this.#lastPlayerLookIntentCommand = this.#pendingPlayerLookIntentCommand;
      return;
    }

    this.#lastPlayerLookIntent = null;
    this.#lastPlayerLookIntentCommand = null;
  }

  #shouldResendLatestPlayerLookIntentCommand(): boolean {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();
    const latestProcessedLookSequence =
      this.#readLatestLocalPlayerSnapshot()?.lastProcessedLookSequence ?? null;

    if (
      this.#lastPlayerLookIntentCommand === null ||
      playerId === null ||
      statusSnapshot.state === "disposed" ||
      !statusSnapshot.connected
    ) {
      return false;
    }

    return (
      latestProcessedLookSequence === null ||
      latestProcessedLookSequence <
        this.#lastPlayerLookIntentCommand.lookSequence
    );
  }
}
