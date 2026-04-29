import type {
  MetaverseIssuePlayerActionCommandInput,
  MetaversePlayerActionReceiptSnapshot,
  MetaversePlayerId,
  MetaverseRealtimePlayerTraversalAuthoritySnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseSyncPlayerLookIntentCommandInput,
  MetaverseSyncPlayerWeaponStateCommandInput,
  MetaverseSyncPlayerTraversalIntentCommandInput
} from "@webgpu-metaverse/shared";

import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";
import type { MetaversePlayerIssuedTraversalIntentSnapshot } from "../types/metaverse-player-issued-traversal-intent";
import { MetaverseWorldPlayerActionSync } from "./metaverse-world-player-action-sync";
import { MetaverseWorldPlayerIntentSync } from "./metaverse-world-player-intent-sync";

type LocalPlayerCommandAckSnapshot = {
  readonly highestProcessedPlayerActionSequence: number;
  readonly lastProcessedLookSequence: number;
  readonly lastProcessedTraversalSequence: number;
  readonly lastProcessedWeaponSequence: number;
  readonly recentPlayerActionReceipts:
    readonly MetaversePlayerActionReceiptSnapshot[];
  readonly traversalAuthority: MetaverseRealtimePlayerTraversalAuthoritySnapshot;
};

interface MetaverseWorldPlayerSyncDependencies {
  readonly acceptWorldEvent: (
    playerId: MetaversePlayerId,
    worldEvent: MetaverseRealtimeWorldEvent
  ) => void;
  readonly applyWorldAccessError: (
    error: unknown,
    fallbackMessage: string
  ) => void;
  readonly clearTimeout: typeof globalThis.clearTimeout;
  readonly readLatestLocalPlayerSnapshot: () => LocalPlayerCommandAckSnapshot | null;
  readonly readPlayerId: () => MetaversePlayerId | null;
  readonly readWallClockMs: () => number;
  readonly readStatusSnapshot: () => MetaverseWorldClientStatusSnapshot;
  readonly resolveCommandDelayMs: () => number;
  readonly sendIssuePlayerActionCommand:
    ConstructorParameters<typeof MetaverseWorldPlayerActionSync>[0]["sendIssuePlayerActionCommand"];
  readonly sendPlayerLookIntentCommand:
    ConstructorParameters<typeof MetaverseWorldPlayerIntentSync>[0]["sendPlayerLookIntentCommand"];
  readonly sendPlayerTraversalIntentCommand:
    ConstructorParameters<typeof MetaverseWorldPlayerIntentSync>[0]["sendPlayerTraversalIntentCommand"];
  readonly sendPlayerWeaponStateCommand:
    ConstructorParameters<typeof MetaverseWorldPlayerIntentSync>[0]["sendPlayerWeaponStateCommand"];
  readonly setTimeout: typeof globalThis.setTimeout;
}

export class MetaverseWorldPlayerSync {
  readonly #playerActionSync: MetaverseWorldPlayerActionSync;
  readonly #playerIntentSync: MetaverseWorldPlayerIntentSync;

  constructor(dependencies: MetaverseWorldPlayerSyncDependencies) {
    this.#playerActionSync = new MetaverseWorldPlayerActionSync({
      acceptWorldEvent: dependencies.acceptWorldEvent,
      applyWorldAccessError: dependencies.applyWorldAccessError,
      clearTimeout: dependencies.clearTimeout,
      readLatestLocalPlayerSnapshot: dependencies.readLatestLocalPlayerSnapshot,
      readPlayerId: dependencies.readPlayerId,
      readStatusSnapshot: dependencies.readStatusSnapshot,
      readWallClockMs: dependencies.readWallClockMs,
      resolveCommandDelayMs: dependencies.resolveCommandDelayMs,
      sendIssuePlayerActionCommand: dependencies.sendIssuePlayerActionCommand,
      setTimeout: dependencies.setTimeout
    });
    this.#playerIntentSync = new MetaverseWorldPlayerIntentSync({
      acceptWorldEvent: dependencies.acceptWorldEvent,
      applyWorldAccessError: dependencies.applyWorldAccessError,
      clearTimeout: dependencies.clearTimeout,
      readLatestLocalPlayerSnapshot: dependencies.readLatestLocalPlayerSnapshot,
      readPlayerId: dependencies.readPlayerId,
      readWallClockMs: dependencies.readWallClockMs,
      readStatusSnapshot: dependencies.readStatusSnapshot,
      resolveCommandDelayMs: dependencies.resolveCommandDelayMs,
      sendPlayerLookIntentCommand: dependencies.sendPlayerLookIntentCommand,
      sendPlayerTraversalIntentCommand:
        dependencies.sendPlayerTraversalIntentCommand,
      sendPlayerWeaponStateCommand: dependencies.sendPlayerWeaponStateCommand,
      setTimeout: dependencies.setTimeout
    });
  }

  get latestPlayerTraversalSequence(): number {
    return this.#playerIntentSync.latestPlayerTraversalSequence;
  }

  get latestPlayerLookSequence(): number {
    return this.#playerIntentSync.latestPlayerLookSequence;
  }

  get latestPlayerWeaponSequence(): number {
    return this.#playerIntentSync.latestPlayerWeaponSequence;
  }

  get latestPlayerIssuedTraversalIntentSnapshot():
    | MetaversePlayerIssuedTraversalIntentSnapshot
    | null {
    return this.#playerIntentSync.latestPlayerIssuedTraversalIntentSnapshot;
  }

  previewPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerIssuedTraversalIntentSnapshot | null {
    return this.#playerIntentSync.previewPlayerTraversalIntent(commandInput);
  }

  syncFromAuthoritativeWorld(): void {
    this.#playerActionSync.syncFromAuthoritativeWorld();
    this.#playerIntentSync.syncFromAuthoritativeWorld();
  }

  issuePlayerAction(
    commandInput: MetaverseIssuePlayerActionCommandInput
  ): number | null {
    return this.#playerActionSync.issuePlayerAction(commandInput);
  }

  syncPlayerLookIntent(
    commandInput: MetaverseSyncPlayerLookIntentCommandInput | null
  ): void {
    this.#playerIntentSync.syncPlayerLookIntent(commandInput);
  }

  syncPlayerWeaponState(
    commandInput: MetaverseSyncPlayerWeaponStateCommandInput | null
  ): void {
    this.#playerIntentSync.syncPlayerWeaponState(commandInput);
  }

  syncPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerIssuedTraversalIntentSnapshot | null {
    return this.#playerIntentSync.syncPlayerTraversalIntent(commandInput);
  }

  dispose(): void {
    this.#playerActionSync.dispose();
    this.#playerIntentSync.dispose();
  }
}
