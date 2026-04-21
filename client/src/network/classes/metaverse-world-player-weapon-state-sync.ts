import type {
  MetaverseRealtimePlayerWeaponStateSnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseSyncPlayerWeaponStateCommandInput
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseRealtimePlayerWeaponStateSnapshot,
  createMetaverseSyncPlayerWeaponStateCommand
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type PendingPlayerWeaponStateCommand = ReturnType<
  typeof createMetaverseSyncPlayerWeaponStateCommand
>;
type LocalPlayerWeaponAckSnapshot = {
  readonly lastProcessedWeaponSequence: number;
};

export interface MetaverseWorldPlayerWeaponStateSyncDependencies {
  readonly acceptWorldEvent: (
    playerId: MetaversePlayerId,
    worldEvent: MetaverseRealtimeWorldEvent
  ) => void;
  readonly applyWorldAccessError: (
    error: unknown,
    fallbackMessage: string
  ) => void;
  readonly clearTimeout: typeof globalThis.clearTimeout;
  readonly readLatestLocalPlayerSnapshot: () => LocalPlayerWeaponAckSnapshot | null;
  readonly readPlayerId: () => MetaversePlayerId | null;
  readonly readStatusSnapshot: () => MetaverseWorldClientStatusSnapshot;
  readonly resolveCommandDelayMs: () => number;
  readonly sendPlayerWeaponStateCommand: (
    command: PendingPlayerWeaponStateCommand
  ) => Promise<MetaverseRealtimeWorldEvent | null>;
  readonly setTimeout: typeof globalThis.setTimeout;
}

function playerWeaponStateMatches(
  leftState: MetaverseRealtimePlayerWeaponStateSnapshot | null,
  rightState: MetaverseSyncPlayerWeaponStateCommandInput["weaponState"]
): boolean {
  if (leftState === null || rightState === null) {
    return leftState === rightState;
  }

  const normalizedRightState =
    createMetaverseRealtimePlayerWeaponStateSnapshot(rightState);

  return (
    leftState.aimMode === normalizedRightState.aimMode &&
    leftState.weaponId === normalizedRightState.weaponId
  );
}

export class MetaverseWorldPlayerWeaponStateSync {
  readonly #acceptWorldEvent: MetaverseWorldPlayerWeaponStateSyncDependencies["acceptWorldEvent"];
  readonly #applyWorldAccessError: MetaverseWorldPlayerWeaponStateSyncDependencies["applyWorldAccessError"];
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #readLatestLocalPlayerSnapshot: MetaverseWorldPlayerWeaponStateSyncDependencies["readLatestLocalPlayerSnapshot"];
  readonly #readPlayerId: MetaverseWorldPlayerWeaponStateSyncDependencies["readPlayerId"];
  readonly #readStatusSnapshot: MetaverseWorldPlayerWeaponStateSyncDependencies["readStatusSnapshot"];
  readonly #resolveCommandDelayMs: MetaverseWorldPlayerWeaponStateSyncDependencies["resolveCommandDelayMs"];
  readonly #sendPlayerWeaponStateCommand: MetaverseWorldPlayerWeaponStateSyncDependencies["sendPlayerWeaponStateCommand"];
  readonly #setTimeout: typeof globalThis.setTimeout;

  #lastPlayerWeaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null = null;
  #lastPlayerWeaponStateCommand: PendingPlayerWeaponStateCommand | null = null;
  #nextPlayerWeaponSequence = 0;
  #pendingPlayerWeaponStateCommand: PendingPlayerWeaponStateCommand | null = null;
  #playerWeaponStateSyncHandle: TimeoutHandle | null = null;
  #playerWeaponStateSyncInFlight = false;

  constructor(dependencies: MetaverseWorldPlayerWeaponStateSyncDependencies) {
    this.#acceptWorldEvent = dependencies.acceptWorldEvent;
    this.#applyWorldAccessError = dependencies.applyWorldAccessError;
    this.#clearTimeout = dependencies.clearTimeout;
    this.#readLatestLocalPlayerSnapshot = dependencies.readLatestLocalPlayerSnapshot;
    this.#readPlayerId = dependencies.readPlayerId;
    this.#readStatusSnapshot = dependencies.readStatusSnapshot;
    this.#resolveCommandDelayMs = dependencies.resolveCommandDelayMs;
    this.#sendPlayerWeaponStateCommand =
      dependencies.sendPlayerWeaponStateCommand;
    this.#setTimeout = dependencies.setTimeout;
  }

  get latestPlayerWeaponSequence(): number {
    return this.#nextPlayerWeaponSequence;
  }

  syncFromAuthoritativeWorld(): void {
    this.#rebaseWeaponStateCommandSequences(this.#readLatestLocalPlayerSnapshot());
    this.#syncPlayerWeaponStateSchedule();
  }

  syncPlayerWeaponState(
    commandInput: MetaverseSyncPlayerWeaponStateCommandInput | null
  ): void {
    if (commandInput === null) {
      this.#lastPlayerWeaponState = null;
      this.#lastPlayerWeaponStateCommand = null;
      this.#pendingPlayerWeaponStateCommand = null;
      this.#cancelScheduledPlayerWeaponStateSync();
      return;
    }

    if (
      playerWeaponStateMatches(
        this.#lastPlayerWeaponState,
        commandInput.weaponState
      )
    ) {
      return;
    }

    this.#nextPlayerWeaponSequence += 1;
    this.#pendingPlayerWeaponStateCommand =
      createMetaverseSyncPlayerWeaponStateCommand({
        playerId: commandInput.playerId,
        weaponSequence: this.#nextPlayerWeaponSequence,
        weaponState: commandInput.weaponState
      });
    this.#lastPlayerWeaponStateCommand = this.#pendingPlayerWeaponStateCommand;
    this.#lastPlayerWeaponState =
      this.#pendingPlayerWeaponStateCommand.weaponState;

    if (this.#readStatusSnapshot().connected) {
      this.#cancelScheduledPlayerWeaponStateSync();
      this.#syncPlayerWeaponStateSchedule();
    }
  }

  dispose(): void {
    this.#cancelScheduledPlayerWeaponStateSync();
  }

  #schedulePlayerWeaponStateSync(delayMs: number): void {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();

    if (
      statusSnapshot.state === "disposed" ||
      playerId === null ||
      !statusSnapshot.connected ||
      this.#pendingPlayerWeaponStateCommand === null ||
      this.#playerWeaponStateSyncInFlight ||
      this.#playerWeaponStateSyncHandle !== null
    ) {
      return;
    }

    this.#playerWeaponStateSyncHandle = this.#setTimeout(() => {
      this.#playerWeaponStateSyncHandle = null;
      void this.#flushPlayerWeaponStateSync();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPlayerWeaponStateSync(): void {
    if (this.#playerWeaponStateSyncHandle === null) {
      return;
    }

    this.#clearTimeout(this.#playerWeaponStateSyncHandle);
    this.#playerWeaponStateSyncHandle = null;
  }

  #syncPlayerWeaponStateSchedule(): void {
    const latestProcessedWeaponSequence =
      this.#readLatestLocalPlayerSnapshot()?.lastProcessedWeaponSequence ?? null;

    if (
      this.#pendingPlayerWeaponStateCommand !== null &&
      latestProcessedWeaponSequence !== null &&
      latestProcessedWeaponSequence >=
        this.#pendingPlayerWeaponStateCommand.weaponSequence
    ) {
      this.#pendingPlayerWeaponStateCommand = null;
    }

    if (this.#pendingPlayerWeaponStateCommand !== null) {
      this.#schedulePlayerWeaponStateSync(0);
      return;
    }

    if (this.#shouldResendLatestPlayerWeaponStateCommand()) {
      this.#pendingPlayerWeaponStateCommand = this.#lastPlayerWeaponStateCommand;
      this.#schedulePlayerWeaponStateSync(this.#resolveCommandDelayMs());
      return;
    }

    this.#cancelScheduledPlayerWeaponStateSync();
  }

  async #flushPlayerWeaponStateSync(): Promise<void> {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();

    if (
      playerId === null ||
      statusSnapshot.state === "disposed" ||
      !statusSnapshot.connected ||
      this.#pendingPlayerWeaponStateCommand === null
    ) {
      return;
    }

    const pendingCommand = this.#pendingPlayerWeaponStateCommand;

    this.#lastPlayerWeaponStateCommand = pendingCommand;
    this.#pendingPlayerWeaponStateCommand = null;
    this.#playerWeaponStateSyncInFlight = true;

    try {
      const worldEvent =
        await this.#sendPlayerWeaponStateCommand(pendingCommand);

      if (worldEvent !== null) {
        this.#acceptWorldEvent(playerId, worldEvent);
      }
    } catch (error) {
      this.#applyWorldAccessError(
        error,
        "Metaverse world player weapon-state sync failed."
      );
    } finally {
      this.#playerWeaponStateSyncInFlight = false;

      if (this.#readStatusSnapshot().connected) {
        this.#syncPlayerWeaponStateSchedule();
      }
    }
  }

  #rebaseWeaponStateCommandSequences(
    localPlayerSnapshot: LocalPlayerWeaponAckSnapshot | null
  ): void {
    if (localPlayerSnapshot === null) {
      return;
    }

    const authoritativeWeaponSequence =
      localPlayerSnapshot.lastProcessedWeaponSequence;

    if (authoritativeWeaponSequence <= this.#nextPlayerWeaponSequence) {
      return;
    }

    this.#nextPlayerWeaponSequence = authoritativeWeaponSequence;

    const pendingCommand = this.#pendingPlayerWeaponStateCommand;

    if (pendingCommand !== null) {
      this.#nextPlayerWeaponSequence += 1;
      this.#pendingPlayerWeaponStateCommand =
        createMetaverseSyncPlayerWeaponStateCommand({
          playerId: pendingCommand.playerId,
          weaponSequence: this.#nextPlayerWeaponSequence,
          weaponState: pendingCommand.weaponState
        });
      this.#lastPlayerWeaponStateCommand = this.#pendingPlayerWeaponStateCommand;
      return;
    }

    this.#lastPlayerWeaponState = null;
    this.#lastPlayerWeaponStateCommand = null;
  }

  #shouldResendLatestPlayerWeaponStateCommand(): boolean {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();
    const latestProcessedWeaponSequence =
      this.#readLatestLocalPlayerSnapshot()?.lastProcessedWeaponSequence ?? null;

    if (
      this.#lastPlayerWeaponStateCommand === null ||
      playerId === null ||
      statusSnapshot.state === "disposed" ||
      !statusSnapshot.connected
    ) {
      return false;
    }

    return (
      latestProcessedWeaponSequence === null ||
      latestProcessedWeaponSequence <
        this.#lastPlayerWeaponStateCommand.weaponSequence
    );
  }
}
