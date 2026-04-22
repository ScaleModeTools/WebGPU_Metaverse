import type {
  MetaversePlayerId,
  MetaverseRealtimePlayerTraversalAuthoritySnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseSyncPlayerLookIntentCommandInput,
  MetaverseSyncPlayerWeaponStateCommandInput,
  MetaverseSyncPlayerTraversalIntentCommandInput
} from "@webgpu-metaverse/shared";

import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";
import {
  createMetaversePlayerIssuedTraversalIntentSnapshot,
  type MetaversePlayerIssuedTraversalIntentSnapshot
} from "../types/metaverse-player-issued-traversal-intent";
import { MetaverseWorldPlayerLookSync } from "./metaverse-world-player-look-sync";
import { MetaverseWorldPlayerTraversalIntentSync } from "./metaverse-world-player-traversal-intent-sync";
import { MetaverseWorldPlayerWeaponStateSync } from "./metaverse-world-player-weapon-state-sync";

type LocalPlayerCommandAckSnapshot = {
  readonly lastProcessedLookSequence: number;
  readonly lastProcessedTraversalSequence: number;
  readonly lastProcessedWeaponSequence: number;
  readonly traversalAuthority: MetaverseRealtimePlayerTraversalAuthoritySnapshot;
};

interface MetaverseWorldPlayerIntentSyncDependencies {
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
  readonly sendPlayerLookIntentCommand:
    ConstructorParameters<typeof MetaverseWorldPlayerLookSync>[0]["sendPlayerLookIntentCommand"];
  readonly sendPlayerWeaponStateCommand:
    ConstructorParameters<typeof MetaverseWorldPlayerWeaponStateSync>[0]["sendPlayerWeaponStateCommand"];
  readonly sendPlayerTraversalIntentCommand:
    ConstructorParameters<typeof MetaverseWorldPlayerTraversalIntentSync>[0]["sendPlayerTraversalIntentCommand"];
  readonly setTimeout: typeof globalThis.setTimeout;
}

export class MetaverseWorldPlayerIntentSync {
  readonly #playerLookSync: MetaverseWorldPlayerLookSync;
  readonly #playerTraversalIntentSync: MetaverseWorldPlayerTraversalIntentSync;
  readonly #playerWeaponStateSync: MetaverseWorldPlayerWeaponStateSync;

  constructor(dependencies: MetaverseWorldPlayerIntentSyncDependencies) {
    this.#playerLookSync = new MetaverseWorldPlayerLookSync({
      acceptWorldEvent: dependencies.acceptWorldEvent,
      applyWorldAccessError: dependencies.applyWorldAccessError,
      clearTimeout: dependencies.clearTimeout,
      readLatestLocalPlayerSnapshot: dependencies.readLatestLocalPlayerSnapshot,
      readPlayerId: dependencies.readPlayerId,
      readStatusSnapshot: dependencies.readStatusSnapshot,
      resolveCommandDelayMs: dependencies.resolveCommandDelayMs,
      sendPlayerLookIntentCommand: dependencies.sendPlayerLookIntentCommand,
      setTimeout: dependencies.setTimeout
    });
    this.#playerWeaponStateSync = new MetaverseWorldPlayerWeaponStateSync({
      acceptWorldEvent: dependencies.acceptWorldEvent,
      applyWorldAccessError: dependencies.applyWorldAccessError,
      clearTimeout: dependencies.clearTimeout,
      readLatestLocalPlayerSnapshot: dependencies.readLatestLocalPlayerSnapshot,
      readPlayerId: dependencies.readPlayerId,
      readStatusSnapshot: dependencies.readStatusSnapshot,
      resolveCommandDelayMs: dependencies.resolveCommandDelayMs,
      sendPlayerWeaponStateCommand: dependencies.sendPlayerWeaponStateCommand,
      setTimeout: dependencies.setTimeout
    });
    this.#playerTraversalIntentSync = new MetaverseWorldPlayerTraversalIntentSync({
      acceptWorldEvent: dependencies.acceptWorldEvent,
      applyWorldAccessError: dependencies.applyWorldAccessError,
      clearTimeout: dependencies.clearTimeout,
      readLatestLocalPlayerSnapshot: dependencies.readLatestLocalPlayerSnapshot,
      readPlayerId: dependencies.readPlayerId,
      readStatusSnapshot: dependencies.readStatusSnapshot,
      resolveCommandDelayMs: dependencies.resolveCommandDelayMs,
      sendPlayerTraversalIntentCommand:
        dependencies.sendPlayerTraversalIntentCommand,
      setTimeout: dependencies.setTimeout
    });
  }

  get latestPlayerTraversalSequence(): number {
    return this.#playerTraversalIntentSync.latestPlayerTraversalSequence;
  }

  get latestPlayerLookSequence(): number {
    return this.#playerLookSync.latestPlayerLookSequence;
  }

  get latestPlayerWeaponSequence(): number {
    return this.#playerWeaponStateSync.latestPlayerWeaponSequence;
  }

  get latestPlayerIssuedTraversalIntentSnapshot():
    | MetaversePlayerIssuedTraversalIntentSnapshot
    | null {
    return createMetaversePlayerIssuedTraversalIntentSnapshot(
      this.#playerTraversalIntentSync.latestPlayerTraversalIntentSnapshot
    );
  }

  previewPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerIssuedTraversalIntentSnapshot | null {
    return createMetaversePlayerIssuedTraversalIntentSnapshot(
      this.#playerTraversalIntentSync.previewPlayerTraversalIntent(commandInput)
    );
  }

  syncFromAuthoritativeWorld(): void {
    this.#playerLookSync.syncFromAuthoritativeWorld();
    this.#playerWeaponStateSync.syncFromAuthoritativeWorld();
    this.#playerTraversalIntentSync.syncFromAuthoritativeWorld();
  }

  syncPlayerLookIntent(
    commandInput: MetaverseSyncPlayerLookIntentCommandInput | null
  ): void {
    this.#playerLookSync.syncPlayerLookIntent(commandInput);
  }

  syncPlayerWeaponState(
    commandInput: MetaverseSyncPlayerWeaponStateCommandInput | null
  ): void {
    this.#playerWeaponStateSync.syncPlayerWeaponState(commandInput);
  }

  syncPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerIssuedTraversalIntentSnapshot | null {
    return createMetaversePlayerIssuedTraversalIntentSnapshot(
      this.#playerTraversalIntentSync.syncPlayerTraversalIntent(commandInput)
    );
  }

  dispose(): void {
    this.#playerLookSync.dispose();
    this.#playerWeaponStateSync.dispose();
    this.#playerTraversalIntentSync.dispose();
  }
}
