import type {
  MetaversePlayerId,
  MetaversePlayerTraversalIntentSnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot,
  MetaverseSyncPlayerLookIntentCommandInput,
  MetaverseSyncPlayerTraversalIntentCommandInput
} from "@webgpu-metaverse/shared";

import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";
import { MetaverseWorldPlayerLookSync } from "./metaverse-world-player-look-sync";
import { MetaverseWorldPlayerTraversalIntentSync } from "./metaverse-world-player-traversal-intent-sync";

type LocalPlayerWorldSnapshot = MetaverseRealtimeWorldSnapshot["players"][number];
type LocalPlayerCommandAckSnapshot = Pick<
  LocalPlayerWorldSnapshot,
  | "lastProcessedInputSequence"
  | "lastProcessedLookSequence"
  | "lastProcessedTraversalOrientationSequence"
  | "traversalAuthority"
>;

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
  readonly readStatusSnapshot: () => MetaverseWorldClientStatusSnapshot;
  readonly resolveCommandDelayMs: () => number;
  readonly sendPlayerLookIntentCommand:
    ConstructorParameters<typeof MetaverseWorldPlayerLookSync>[0]["sendPlayerLookIntentCommand"];
  readonly sendPlayerTraversalIntentCommand:
    ConstructorParameters<typeof MetaverseWorldPlayerTraversalIntentSync>[0]["sendPlayerTraversalIntentCommand"];
  readonly setTimeout: typeof globalThis.setTimeout;
}

export class MetaverseWorldPlayerIntentSync {
  readonly #playerLookSync: MetaverseWorldPlayerLookSync;
  readonly #playerTraversalIntentSync: MetaverseWorldPlayerTraversalIntentSync;

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

  get latestPlayerInputSequence(): number {
    return this.#playerTraversalIntentSync.latestPlayerInputSequence;
  }

  get latestPlayerLookSequence(): number {
    return this.#playerLookSync.latestPlayerLookSequence;
  }

  get latestPlayerTraversalIntentSnapshot():
    | MetaversePlayerTraversalIntentSnapshot
    | null {
    return this.#playerTraversalIntentSync.latestPlayerTraversalIntentSnapshot;
  }

  get latestPlayerTraversalOrientationSequence(): number {
    return this.#playerTraversalIntentSync.latestPlayerTraversalOrientationSequence;
  }

  previewPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerTraversalIntentSnapshot | null {
    return this.#playerTraversalIntentSync.previewPlayerTraversalIntent(
      commandInput
    );
  }

  syncFromAuthoritativeWorld(): void {
    this.#playerLookSync.syncFromAuthoritativeWorld();
    this.#playerTraversalIntentSync.syncFromAuthoritativeWorld();
  }

  syncPlayerLookIntent(
    commandInput: MetaverseSyncPlayerLookIntentCommandInput | null
  ): void {
    this.#playerLookSync.syncPlayerLookIntent(commandInput);
  }

  syncPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerTraversalIntentSnapshot | null {
    return this.#playerTraversalIntentSync.syncPlayerTraversalIntent(
      commandInput
    );
  }

  dispose(): void {
    this.#playerLookSync.dispose();
    this.#playerTraversalIntentSync.dispose();
  }
}
