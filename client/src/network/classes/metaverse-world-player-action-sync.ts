import type {
  MetaverseIssuePlayerActionCommandInput,
  MetaversePlayerActionReceiptSnapshot,
  MetaverseRealtimeWorldEvent
} from "@webgpu-metaverse/shared";
import {
  createMetaverseIssuePlayerActionCommand
} from "@webgpu-metaverse/shared";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";

import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type PendingPlayerActionCommand = ReturnType<
  typeof createMetaverseIssuePlayerActionCommand
>;
type LocalPlayerActionAckSnapshot = {
  readonly highestProcessedPlayerActionSequence: number;
  readonly recentPlayerActionReceipts:
    readonly MetaversePlayerActionReceiptSnapshot[];
};
type PendingPlayerAction = {
  readonly command: PendingPlayerActionCommand;
  inFlight: boolean;
  lastSentAtMs: number | null;
  sendCount: number;
};

const metaversePlayerActionOutstandingWindowMaxEntries = 4;
const metaversePlayerActionPendingQueueMaxEntries = 8;

export interface MetaverseWorldPlayerActionSyncDependencies {
  readonly acceptWorldEvent: (
    playerId: MetaversePlayerId,
    worldEvent: MetaverseRealtimeWorldEvent
  ) => void;
  readonly applyWorldAccessError: (
    error: unknown,
    fallbackMessage: string
  ) => void;
  readonly clearTimeout: typeof globalThis.clearTimeout;
  readonly readLatestLocalPlayerSnapshot:
    () => LocalPlayerActionAckSnapshot | null;
  readonly readPlayerId: () => MetaversePlayerId | null;
  readonly readStatusSnapshot: () => MetaverseWorldClientStatusSnapshot;
  readonly readWallClockMs: () => number;
  readonly resolveCommandDelayMs: () => number;
  readonly sendIssuePlayerActionCommand: (
    command: PendingPlayerActionCommand
  ) => Promise<MetaverseRealtimeWorldEvent | null>;
  readonly setTimeout: typeof globalThis.setTimeout;
}

export class MetaverseWorldPlayerActionSync {
  readonly #acceptWorldEvent: MetaverseWorldPlayerActionSyncDependencies["acceptWorldEvent"];
  readonly #applyWorldAccessError: MetaverseWorldPlayerActionSyncDependencies["applyWorldAccessError"];
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #readLatestLocalPlayerSnapshot:
    MetaverseWorldPlayerActionSyncDependencies["readLatestLocalPlayerSnapshot"];
  readonly #readPlayerId: MetaverseWorldPlayerActionSyncDependencies["readPlayerId"];
  readonly #readStatusSnapshot:
    MetaverseWorldPlayerActionSyncDependencies["readStatusSnapshot"];
  readonly #readWallClockMs: MetaverseWorldPlayerActionSyncDependencies["readWallClockMs"];
  readonly #resolveCommandDelayMs:
    MetaverseWorldPlayerActionSyncDependencies["resolveCommandDelayMs"];
  readonly #sendIssuePlayerActionCommand:
    MetaverseWorldPlayerActionSyncDependencies["sendIssuePlayerActionCommand"];
  readonly #setTimeout: typeof globalThis.setTimeout;

  #nextPlayerActionSequence = 0;
  #pendingPlayerActions: PendingPlayerAction[] = [];
  #playerActionSyncHandle: TimeoutHandle | null = null;

  constructor(dependencies: MetaverseWorldPlayerActionSyncDependencies) {
    this.#acceptWorldEvent = dependencies.acceptWorldEvent;
    this.#applyWorldAccessError = dependencies.applyWorldAccessError;
    this.#clearTimeout = dependencies.clearTimeout;
    this.#readLatestLocalPlayerSnapshot = dependencies.readLatestLocalPlayerSnapshot;
    this.#readPlayerId = dependencies.readPlayerId;
    this.#readStatusSnapshot = dependencies.readStatusSnapshot;
    this.#readWallClockMs = dependencies.readWallClockMs;
    this.#resolveCommandDelayMs = dependencies.resolveCommandDelayMs;
    this.#sendIssuePlayerActionCommand = dependencies.sendIssuePlayerActionCommand;
    this.#setTimeout = dependencies.setTimeout;
  }

  syncFromAuthoritativeWorld(): void {
    this.#retireAcknowledgedPlayerActions();
    this.#rebasePlayerActionSequenceCounter();
    this.#syncPlayerActionSchedule();
  }

  issuePlayerAction(
    commandInput: MetaverseIssuePlayerActionCommandInput
  ): number | null {
    this.#retireAcknowledgedPlayerActions();
    this.#rebasePlayerActionSequenceCounter();

    if (
      this.#pendingPlayerActions.length >=
      metaversePlayerActionPendingQueueMaxEntries
    ) {
      return null;
    }

    this.#nextPlayerActionSequence += 1;
    const actionSequence = this.#nextPlayerActionSequence;
    this.#pendingPlayerActions.push({
      command: createMetaverseIssuePlayerActionCommand({
        action: {
          ...commandInput.action,
          actionSequence
        },
        playerId: commandInput.playerId
      }),
      inFlight: false,
      lastSentAtMs: null,
      sendCount: 0
    });

    if (this.#readStatusSnapshot().connected) {
      this.#cancelScheduledPlayerActionSync();
      this.#syncPlayerActionSchedule();
    }

    return actionSequence;
  }

  dispose(): void {
    this.#cancelScheduledPlayerActionSync();
  }

  #schedulePlayerActionSync(delayMs: number): void {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();

    if (
      statusSnapshot.state === "disposed" ||
      playerId === null ||
      !statusSnapshot.connected ||
      this.#pendingPlayerActions.length === 0 ||
      this.#playerActionSyncHandle !== null
    ) {
      return;
    }

    this.#playerActionSyncHandle = this.#setTimeout(() => {
      this.#playerActionSyncHandle = null;
      this.#flushPlayerActionSync();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPlayerActionSync(): void {
    if (this.#playerActionSyncHandle === null) {
      return;
    }

    this.#clearTimeout(this.#playerActionSyncHandle);
    this.#playerActionSyncHandle = null;
  }

  #syncPlayerActionSchedule(): void {
    this.#retireAcknowledgedPlayerActions();

    if (this.#pendingPlayerActions.length === 0) {
      this.#cancelScheduledPlayerActionSync();
      return;
    }

    const outstandingWindow = this.#readOutstandingWindow();
    const unsentAction = outstandingWindow.find(
      (pendingAction) => pendingAction.sendCount === 0 && !pendingAction.inFlight
    );

    if (unsentAction !== undefined) {
      this.#schedulePlayerActionSync(0);
      return;
    }

    const resendDelayMs = Math.max(0, this.#resolveCommandDelayMs());
    const nowMs = this.#readWallClockMs();
    let nextDelayMs = resendDelayMs;

    for (const pendingAction of outstandingWindow) {
      if (pendingAction.inFlight || pendingAction.lastSentAtMs === null) {
        continue;
      }

      const remainingDelayMs =
        pendingAction.lastSentAtMs + resendDelayMs - nowMs;

      if (remainingDelayMs <= 0) {
        nextDelayMs = 0;
        break;
      }

      nextDelayMs = Math.min(nextDelayMs, remainingDelayMs);
    }

    this.#schedulePlayerActionSync(nextDelayMs);
  }

  #flushPlayerActionSync(): void {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();

    if (
      playerId === null ||
      statusSnapshot.state === "disposed" ||
      !statusSnapshot.connected
    ) {
      return;
    }

    this.#retireAcknowledgedPlayerActions();

    const outstandingWindow = this.#readOutstandingWindow();
    const resendDelayMs = Math.max(0, this.#resolveCommandDelayMs());
    const nowMs = this.#readWallClockMs();
    let sentAction = false;

    for (const pendingAction of outstandingWindow) {
      if (pendingAction.inFlight || pendingAction.sendCount > 0) {
        continue;
      }

      this.#sendPendingPlayerAction(playerId, pendingAction);
      sentAction = true;
    }

    if (!sentAction) {
      for (const pendingAction of outstandingWindow) {
        if (
          pendingAction.inFlight ||
          pendingAction.lastSentAtMs === null ||
          nowMs - pendingAction.lastSentAtMs < resendDelayMs
        ) {
          continue;
        }

        this.#sendPendingPlayerAction(playerId, pendingAction);
        sentAction = true;
      }
    }

    this.#syncPlayerActionSchedule();
  }

  #sendPendingPlayerAction(
    playerId: MetaversePlayerId,
    pendingAction: PendingPlayerAction
  ): void {
    pendingAction.inFlight = true;
    pendingAction.lastSentAtMs = this.#readWallClockMs();
    pendingAction.sendCount += 1;

    void this.#sendIssuePlayerActionCommand(pendingAction.command)
      .then((worldEvent) => {
        if (worldEvent !== null) {
          this.#acceptWorldEvent(playerId, worldEvent);
        }
      })
      .catch((error) => {
        this.#applyWorldAccessError(
          error,
          "Metaverse world player-action sync failed."
        );
      })
      .finally(() => {
        pendingAction.inFlight = false;

        if (this.#readStatusSnapshot().connected) {
          this.#syncPlayerActionSchedule();
        }
      });
  }

  #readOutstandingWindow(): readonly PendingPlayerAction[] {
    const firstSwitchActionIndex = this.#pendingPlayerActions.findIndex(
      (pendingAction) =>
        pendingAction.command.action.kind === "switch-active-weapon-slot"
    );

    if (firstSwitchActionIndex < 0) {
      return this.#pendingPlayerActions.slice(
        0,
        metaversePlayerActionOutstandingWindowMaxEntries
      );
    }

    if (firstSwitchActionIndex === 0) {
      return this.#pendingPlayerActions.slice(0, 1);
    }

    return this.#pendingPlayerActions.slice(
      0,
      Math.min(
        firstSwitchActionIndex,
        metaversePlayerActionOutstandingWindowMaxEntries
      )
    );
  }

  #retireAcknowledgedPlayerActions(): void {
    const recentPlayerActionReceipts =
      this.#readLatestLocalPlayerSnapshot()?.recentPlayerActionReceipts ?? [];

    if (recentPlayerActionReceipts.length === 0) {
      return;
    }

    const acknowledgedActionSequences = new Set(
      recentPlayerActionReceipts.map((receiptSnapshot) => receiptSnapshot.actionSequence)
    );

    this.#pendingPlayerActions = this.#pendingPlayerActions.filter(
      (pendingAction) =>
        !acknowledgedActionSequences.has(pendingAction.command.action.actionSequence)
    );
  }

  #rebasePlayerActionSequenceCounter(): void {
    const localPlayerSnapshot = this.#readLatestLocalPlayerSnapshot();

    if (localPlayerSnapshot === null) {
      return;
    }

    let highestIssuedActionSequence =
      localPlayerSnapshot.highestProcessedPlayerActionSequence;

    for (const pendingAction of this.#pendingPlayerActions) {
      highestIssuedActionSequence = Math.max(
        highestIssuedActionSequence,
        pendingAction.command.action.actionSequence
      );
    }

    if (highestIssuedActionSequence > this.#nextPlayerActionSequence) {
      this.#nextPlayerActionSequence = highestIssuedActionSequence;
    }
  }
}
