import type {
  MetaversePlayerTraversalIntentSnapshot,
  MetaverseRealtimePlayerTraversalAuthoritySnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseSyncPlayerTraversalIntentCommandInput
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaversePlayerTraversalIntentSnapshot,
  createMetaverseSyncPlayerTraversalIntentCommand,
  doMetaversePlayerTraversalSequencedInputsMatch
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  readMetaverseTraversalAuthorityLatestActionSequence
} from "@webgpu-metaverse/shared/metaverse/traversal";

import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type PendingPlayerTraversalIntentCommand = ReturnType<
  typeof createMetaverseSyncPlayerTraversalIntentCommand
>;
type PlayerTraversalIntentHistoryRuntimeState = {
  readonly intent: MetaversePlayerTraversalIntentSnapshot;
  readonly startedAtMs: number;
};
type LocalPlayerTraversalCommandAckSnapshot = {
  readonly lastProcessedInputSequence: number;
  readonly lastProcessedTraversalOrientationSequence: number;
  readonly traversalAuthority: MetaverseRealtimePlayerTraversalAuthoritySnapshot;
};
const metaverseSequencedTraversalActionKind = "jump";
const metaversePlayerTraversalRecentHistoryMaxEntries = 8;
const metaversePlayerTraversalRecentHistoryWindowMs = 250;

export interface MetaverseWorldPlayerTraversalIntentSyncDependencies {
  readonly acceptWorldEvent: (
    playerId: MetaversePlayerId,
    worldEvent: MetaverseRealtimeWorldEvent
  ) => void;
  readonly applyWorldAccessError: (
    error: unknown,
    fallbackMessage: string
  ) => void;
  readonly clearTimeout: typeof globalThis.clearTimeout;
  readonly readEstimatedServerTimeMs?:
    | ((localWallClockMs: number) => number)
    | undefined;
  readonly readLatestLocalPlayerSnapshot:
    () => LocalPlayerTraversalCommandAckSnapshot | null;
  readonly readPlayerId: () => MetaversePlayerId | null;
  readonly readWallClockMs?: () => number;
  readonly readStatusSnapshot: () => MetaverseWorldClientStatusSnapshot;
  readonly resolveCommandDelayMs: () => number;
  readonly sendPlayerTraversalIntentCommand: (
    command: PendingPlayerTraversalIntentCommand
  ) => Promise<MetaverseRealtimeWorldEvent | null>;
  readonly setTimeout: typeof globalThis.setTimeout;
}

function playerTraversalIntentMatches(
  leftIntent: MetaversePlayerTraversalIntentSnapshot | null,
  rightIntent: MetaverseSyncPlayerTraversalIntentCommandInput["intent"]
): boolean {
  if (leftIntent === null) {
    return false;
  }

  const normalizedRightIntent = createMetaversePlayerTraversalIntentSnapshot({
    ...rightIntent,
    inputSequence: leftIntent.inputSequence
  });

  return (
    leftIntent.actionIntent.kind === normalizedRightIntent.actionIntent.kind &&
    leftIntent.actionIntent.pressed ===
      normalizedRightIntent.actionIntent.pressed &&
    leftIntent.actionIntent.sequence ===
      normalizedRightIntent.actionIntent.sequence &&
    leftIntent.bodyControl.boost === normalizedRightIntent.bodyControl.boost &&
    leftIntent.bodyControl.moveAxis ===
      normalizedRightIntent.bodyControl.moveAxis &&
    leftIntent.bodyControl.strafeAxis ===
      normalizedRightIntent.bodyControl.strafeAxis &&
    leftIntent.bodyControl.turnAxis ===
      normalizedRightIntent.bodyControl.turnAxis &&
    leftIntent.facing.pitchRadians === normalizedRightIntent.facing.pitchRadians &&
    leftIntent.facing.yawRadians === normalizedRightIntent.facing.yawRadians &&
    leftIntent.locomotionMode === normalizedRightIntent.locomotionMode &&
    leftIntent.orientationSequence === normalizedRightIntent.orientationSequence
  );
}

function doPlayerTraversalOrientationInputsMatch(
  leftIntent: Pick<
    MetaversePlayerTraversalIntentSnapshot,
    "bodyControl" | "facing"
  > | null,
  rightIntent: Pick<
    MetaversePlayerTraversalIntentSnapshot,
    "bodyControl" | "facing"
  >
): boolean {
  if (leftIntent === null) {
    return false;
  }

  return (
    leftIntent.bodyControl.turnAxis === rightIntent.bodyControl.turnAxis &&
    leftIntent.facing.pitchRadians === rightIntent.facing.pitchRadians &&
    leftIntent.facing.yawRadians === rightIntent.facing.yawRadians
  );
}

export class MetaverseWorldPlayerTraversalIntentSync {
  readonly #acceptWorldEvent: MetaverseWorldPlayerTraversalIntentSyncDependencies["acceptWorldEvent"];
  readonly #applyWorldAccessError: MetaverseWorldPlayerTraversalIntentSyncDependencies["applyWorldAccessError"];
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #readEstimatedServerTimeMs: (localWallClockMs: number) => number;
  readonly #readLatestLocalPlayerSnapshot: MetaverseWorldPlayerTraversalIntentSyncDependencies["readLatestLocalPlayerSnapshot"];
  readonly #readPlayerId: MetaverseWorldPlayerTraversalIntentSyncDependencies["readPlayerId"];
  readonly #readWallClockMs: () => number;
  readonly #readStatusSnapshot: MetaverseWorldPlayerTraversalIntentSyncDependencies["readStatusSnapshot"];
  readonly #resolveCommandDelayMs: MetaverseWorldPlayerTraversalIntentSyncDependencies["resolveCommandDelayMs"];
  readonly #sendPlayerTraversalIntentCommand: MetaverseWorldPlayerTraversalIntentSyncDependencies["sendPlayerTraversalIntentCommand"];
  readonly #setTimeout: typeof globalThis.setTimeout;

  #currentPlayerTraversalIntentStartedAtMs: number | null = null;
  #lastTraversalActionPressed = false;
  #lastPlayerTraversalIntent: MetaversePlayerTraversalIntentSnapshot | null = null;
  #lastPlayerTraversalIntentCommand: PendingPlayerTraversalIntentCommand | null =
    null;
  #nextTraversalActionSequence = 0;
  #nextPlayerInputSequence = 0;
  #nextTraversalSampleId = 0;
  #nextPlayerTraversalOrientationSequence = 0;
  #playerTraversalIntentSyncDirty = false;
  #playerTraversalInputSyncHandle: TimeoutHandle | null = null;
  #playerTraversalInputSyncInFlight = false;
  #recentPlayerTraversalIntentHistory: PlayerTraversalIntentHistoryRuntimeState[] =
    [];

  constructor(
    dependencies: MetaverseWorldPlayerTraversalIntentSyncDependencies
  ) {
    this.#acceptWorldEvent = dependencies.acceptWorldEvent;
    this.#applyWorldAccessError = dependencies.applyWorldAccessError;
    this.#clearTimeout = dependencies.clearTimeout;
    this.#readEstimatedServerTimeMs =
      dependencies.readEstimatedServerTimeMs ??
      ((localWallClockMs) => localWallClockMs);
    this.#readLatestLocalPlayerSnapshot = dependencies.readLatestLocalPlayerSnapshot;
    this.#readPlayerId = dependencies.readPlayerId;
    this.#readWallClockMs = dependencies.readWallClockMs ?? Date.now;
    this.#readStatusSnapshot = dependencies.readStatusSnapshot;
    this.#resolveCommandDelayMs = dependencies.resolveCommandDelayMs;
    this.#sendPlayerTraversalIntentCommand =
      dependencies.sendPlayerTraversalIntentCommand;
    this.#setTimeout = dependencies.setTimeout;
  }

  get latestPlayerInputSequence(): number {
    return this.#nextPlayerInputSequence;
  }

  get latestPlayerTraversalIntentSnapshot():
    | MetaversePlayerTraversalIntentSnapshot
    | null {
    return this.#lastPlayerTraversalIntent;
  }

  get latestPlayerTraversalOrientationSequence(): number {
    return this.#nextPlayerTraversalOrientationSequence;
  }

  previewPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerTraversalIntentSnapshot | null {
    if (commandInput === null) {
      return null;
    }

    return this.#resolveNextPlayerTraversalIntentSnapshot(commandInput)
      .intentSnapshot;
  }

  syncFromAuthoritativeWorld(): void {
    const localPlayerSnapshot = this.#readLatestLocalPlayerSnapshot();

    if (localPlayerSnapshot !== null) {
      this.#rebaseTraversalCommandSequences(localPlayerSnapshot);
    }

    this.#syncPlayerTraversalInputSchedule();
  }

  syncPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerTraversalIntentSnapshot | null {
    if (commandInput === null) {
      this.#currentPlayerTraversalIntentStartedAtMs = null;
      this.#lastTraversalActionPressed = false;
      this.#lastPlayerTraversalIntentCommand = null;
      this.#lastPlayerTraversalIntent = null;
      this.#playerTraversalIntentSyncDirty = false;
      this.#recentPlayerTraversalIntentHistory = [];
      this.#cancelScheduledPlayerTraversalInputSync();
      return null;
    }

    const nowMs = this.#readWallClockMs();
    const {
      intentSnapshot,
      actionPressed,
      traversalIntentChanged
    } = this.#resolveNextPlayerTraversalIntentSnapshot(commandInput);

    this.#lastTraversalActionPressed = actionPressed;

    if (!traversalIntentChanged) {
      return intentSnapshot;
    }

    this.#nextTraversalActionSequence = Math.max(
      this.#nextTraversalActionSequence,
      intentSnapshot.actionIntent.kind === metaverseSequencedTraversalActionKind
        ? intentSnapshot.actionIntent.sequence
        : 0
    );
    this.#nextTraversalSampleId = Math.max(
      this.#nextTraversalSampleId,
      intentSnapshot.sampleId
    );
    this.#nextPlayerInputSequence = intentSnapshot.inputSequence;
    this.#nextPlayerTraversalOrientationSequence =
      intentSnapshot.orientationSequence;
    this.#appendRecentPlayerTraversalIntentHistory(nowMs);
    this.#lastPlayerTraversalIntent =
      intentSnapshot;
    this.#currentPlayerTraversalIntentStartedAtMs = nowMs;
    this.#playerTraversalIntentSyncDirty = true;

    if (this.#readStatusSnapshot().connected) {
      this.#cancelScheduledPlayerTraversalInputSync();
      this.#syncPlayerTraversalInputSchedule();
    }

    return this.#lastPlayerTraversalIntent;
  }

  dispose(): void {
    this.#cancelScheduledPlayerTraversalInputSync();
  }

  #schedulePlayerTraversalInputSync(delayMs: number): void {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();

    if (
      statusSnapshot.state === "disposed" ||
      playerId === null ||
      !statusSnapshot.connected ||
      this.#lastPlayerTraversalIntent === null ||
      (!this.#playerTraversalIntentSyncDirty &&
        !this.#shouldResendLatestPlayerTraversalIntentCommand()) ||
      this.#playerTraversalInputSyncInFlight ||
      this.#playerTraversalInputSyncHandle !== null
    ) {
      return;
    }

    this.#playerTraversalInputSyncHandle = this.#setTimeout(() => {
      this.#playerTraversalInputSyncHandle = null;
      void this.#flushPlayerTraversalInputSync();
    }, Math.max(0, delayMs));
  }

  #cancelScheduledPlayerTraversalInputSync(): void {
    if (this.#playerTraversalInputSyncHandle === null) {
      return;
    }

    this.#clearTimeout(this.#playerTraversalInputSyncHandle);
    this.#playerTraversalInputSyncHandle = null;
  }

  #syncPlayerTraversalInputSchedule(): void {
    const localPlayerSnapshot = this.#readLatestLocalPlayerSnapshot();
    const latestProcessedInputSequence =
      localPlayerSnapshot?.lastProcessedInputSequence ?? null;
    const latestProcessedTraversalOrientationSequence =
      localPlayerSnapshot?.lastProcessedTraversalOrientationSequence ?? null;

    if (
      this.#lastPlayerTraversalIntent !== null &&
      latestProcessedInputSequence !== null &&
      latestProcessedTraversalOrientationSequence !== null &&
      latestProcessedInputSequence >=
        this.#lastPlayerTraversalIntent.inputSequence &&
      latestProcessedTraversalOrientationSequence >=
        this.#lastPlayerTraversalIntent.orientationSequence
    ) {
      this.#playerTraversalIntentSyncDirty = false;
    }

    if (
      this.#lastPlayerTraversalIntentCommand !== null &&
      latestProcessedInputSequence !== null &&
      latestProcessedTraversalOrientationSequence !== null &&
      latestProcessedInputSequence >=
        this.#lastPlayerTraversalIntentCommand.intent.inputSequence &&
      latestProcessedTraversalOrientationSequence >=
        this.#lastPlayerTraversalIntentCommand.intent.orientationSequence
    ) {
      this.#lastPlayerTraversalIntentCommand = null;
    }

    if (
      this.#playerTraversalIntentSyncDirty &&
      this.#lastPlayerTraversalIntent !== null
    ) {
      this.#schedulePlayerTraversalInputSync(0);
      return;
    }

    if (this.#shouldResendLatestPlayerTraversalIntentCommand()) {
      this.#schedulePlayerTraversalInputSync(this.#resolveCommandDelayMs());
      return;
    }

    this.#cancelScheduledPlayerTraversalInputSync();
  }

  async #flushPlayerTraversalInputSync(): Promise<void> {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();
    const pendingCommand =
      playerId === null
        ? null
        : this.#resolvePendingPlayerTraversalIntentCommand(playerId);

    if (
      playerId === null ||
      statusSnapshot.state === "disposed" ||
      !statusSnapshot.connected ||
      pendingCommand === null
    ) {
      return;
    }

    this.#lastPlayerTraversalIntentCommand = pendingCommand;
    this.#playerTraversalIntentSyncDirty = false;
    this.#playerTraversalInputSyncInFlight = true;

    try {
      const worldEvent =
        await this.#sendPlayerTraversalIntentCommand(pendingCommand);

      if (worldEvent !== null) {
        this.#acceptWorldEvent(playerId, worldEvent);
      }
    } catch (error) {
      this.#applyWorldAccessError(
        error,
        "Metaverse world traversal intent sync failed."
      );
    } finally {
      this.#playerTraversalInputSyncInFlight = false;

      if (this.#readStatusSnapshot().connected) {
        this.#syncPlayerTraversalInputSchedule();
      }
    }
  }

  #rebaseTraversalCommandSequences(
    localPlayerSnapshot: LocalPlayerTraversalCommandAckSnapshot
  ): void {
    const authoritativeInputSequence =
      localPlayerSnapshot.lastProcessedInputSequence;
    const authoritativeOrientationSequence =
      localPlayerSnapshot.lastProcessedTraversalOrientationSequence;
    const authoritativeTraversalActionSequence =
      readMetaverseTraversalAuthorityLatestActionSequence(
        localPlayerSnapshot.traversalAuthority,
        metaverseSequencedTraversalActionKind
      );
    const inputSequenceRaised =
      authoritativeInputSequence > this.#nextPlayerInputSequence;
    const orientationSequenceRaised =
      authoritativeOrientationSequence >
      this.#nextPlayerTraversalOrientationSequence;
    const traversalActionSequenceRaised =
      authoritativeTraversalActionSequence > this.#nextTraversalActionSequence;

    if (
      !inputSequenceRaised &&
      !traversalActionSequenceRaised &&
      !orientationSequenceRaised
    ) {
      return;
    }

    this.#nextPlayerInputSequence = Math.max(
      this.#nextPlayerInputSequence,
      authoritativeInputSequence
    );
    this.#nextPlayerTraversalOrientationSequence = Math.max(
      this.#nextPlayerTraversalOrientationSequence,
      authoritativeOrientationSequence
    );
    this.#nextTraversalActionSequence = Math.max(
      this.#nextTraversalActionSequence,
      authoritativeTraversalActionSequence
    );

    const lastPlayerTraversalIntent = this.#lastPlayerTraversalIntent;

    if (lastPlayerTraversalIntent !== null) {
      const nextTraversalActionSequence =
        lastPlayerTraversalIntent.actionIntent.sequence <=
        authoritativeTraversalActionSequence
          ? lastPlayerTraversalIntent.actionIntent.kind ===
              metaverseSequencedTraversalActionKind &&
              this.#lastTraversalActionPressed
            ? this.#nextTraversalActionSequence + 1
            : this.#nextTraversalActionSequence
          : lastPlayerTraversalIntent.actionIntent.sequence;
      const nextInputSequence =
        lastPlayerTraversalIntent.inputSequence <= authoritativeInputSequence
          ? this.#nextPlayerInputSequence + 1
          : lastPlayerTraversalIntent.inputSequence;
      const nextOrientationSequence =
        lastPlayerTraversalIntent.orientationSequence <=
        authoritativeOrientationSequence
          ? this.#nextPlayerTraversalOrientationSequence + 1
          : lastPlayerTraversalIntent.orientationSequence;

      this.#nextTraversalActionSequence = Math.max(
        this.#nextTraversalActionSequence,
        nextTraversalActionSequence
      );
      this.#nextPlayerInputSequence = Math.max(
        this.#nextPlayerInputSequence,
        nextInputSequence
      );
      this.#nextPlayerTraversalOrientationSequence = Math.max(
        this.#nextPlayerTraversalOrientationSequence,
        nextOrientationSequence
      );
      this.#lastPlayerTraversalIntent =
        createMetaversePlayerTraversalIntentSnapshot({
          actionIntent: {
            kind:
              lastPlayerTraversalIntent.actionIntent.kind ===
                metaverseSequencedTraversalActionKind ||
              this.#nextTraversalActionSequence > 0
                ? metaverseSequencedTraversalActionKind
                : "none",
            pressed:
              lastPlayerTraversalIntent.actionIntent.kind ===
                metaverseSequencedTraversalActionKind &&
              lastPlayerTraversalIntent.actionIntent.pressed,
            sequence:
              lastPlayerTraversalIntent.actionIntent.kind ===
                metaverseSequencedTraversalActionKind ||
              this.#nextTraversalActionSequence > 0
                ? this.#nextTraversalActionSequence
                : 0
          },
          bodyControl: lastPlayerTraversalIntent.bodyControl,
          facing: lastPlayerTraversalIntent.facing,
          inputSequence: this.#nextPlayerInputSequence,
          locomotionMode: lastPlayerTraversalIntent.locomotionMode,
          orientationSequence: this.#nextPlayerTraversalOrientationSequence,
          sampleId: this.#nextTraversalSampleId + 1
        });
      this.#nextTraversalSampleId = Math.max(
        this.#nextTraversalSampleId,
        this.#lastPlayerTraversalIntent.sampleId
      );
      this.#currentPlayerTraversalIntentStartedAtMs = this.#readWallClockMs();
      this.#lastPlayerTraversalIntentCommand = null;
      this.#playerTraversalIntentSyncDirty = true;
      this.#recentPlayerTraversalIntentHistory = [];
      return;
    }

    this.#lastPlayerTraversalIntentCommand = null;
    this.#lastPlayerTraversalIntent = null;
  }

  #appendRecentPlayerTraversalIntentHistory(nowMs: number): void {
    if (
      this.#lastPlayerTraversalIntent === null ||
      this.#currentPlayerTraversalIntentStartedAtMs === null
    ) {
      return;
    }

    if (nowMs <= this.#currentPlayerTraversalIntentStartedAtMs) {
      return;
    }

    this.#recentPlayerTraversalIntentHistory.push(
      Object.freeze({
        intent: this.#lastPlayerTraversalIntent,
        startedAtMs: this.#currentPlayerTraversalIntentStartedAtMs
      })
    );

    if (
      this.#recentPlayerTraversalIntentHistory.length >
      metaversePlayerTraversalRecentHistoryMaxEntries
    ) {
      this.#recentPlayerTraversalIntentHistory.splice(
        0,
        this.#recentPlayerTraversalIntentHistory.length -
          metaversePlayerTraversalRecentHistoryMaxEntries
      );
    }
  }

  #buildRecentPlayerTraversalIntentHistory(
    currentIntent: MetaversePlayerTraversalIntentSnapshot,
    nowMs: number
  ): PendingPlayerTraversalIntentCommand["recentIntentHistory"] {
    if (this.#currentPlayerTraversalIntentStartedAtMs === null) {
      return undefined;
    }

    const historyWindowStartMs =
      nowMs - metaversePlayerTraversalRecentHistoryWindowMs;
    const nextHistory = [];

    for (
      let index = 0;
      index < this.#recentPlayerTraversalIntentHistory.length;
      index += 1
    ) {
      const historyEntry = this.#recentPlayerTraversalIntentHistory[index];
      const nextStartedAtMs =
        this.#recentPlayerTraversalIntentHistory[index + 1]?.startedAtMs ??
        this.#currentPlayerTraversalIntentStartedAtMs;

      if (historyEntry === undefined || nextStartedAtMs <= historyWindowStartMs) {
        continue;
      }

      const durationMs = Math.max(
        0,
        Math.floor(
          nextStartedAtMs - Math.max(historyEntry.startedAtMs, historyWindowStartMs)
        )
      );

      if (durationMs <= 0) {
        continue;
      }

      nextHistory.push(
        Object.freeze({
          durationMs,
          intent: historyEntry.intent
        })
      );
    }

    if (nextHistory.length === 0) {
      return undefined;
    }

    const currentDurationMs = Math.max(
      0,
      Math.floor(
        nowMs -
          Math.max(
            this.#currentPlayerTraversalIntentStartedAtMs,
            historyWindowStartMs
          )
      )
    );

    if (currentDurationMs > 0) {
      nextHistory.push(
        Object.freeze({
          durationMs: currentDurationMs,
          intent: currentIntent
        })
      );
    }

    return Object.freeze(nextHistory);
  }

  #createPlayerTraversalIntentCommand(
    playerId: MetaversePlayerId,
    intent: MetaversePlayerTraversalIntentSnapshot
  ): PendingPlayerTraversalIntentCommand {
    const localNowMs = this.#readWallClockMs();
    const recentIntentHistory = this.#buildRecentPlayerTraversalIntentHistory(
      intent,
      localNowMs
    );
    const estimatedServerTimeMs = Math.max(
      0,
      Math.floor(this.#readEstimatedServerTimeMs(localNowMs))
    );

    return createMetaverseSyncPlayerTraversalIntentCommand({
      ...(estimatedServerTimeMs > 0 ? { estimatedServerTimeMs } : {}),
      ...(recentIntentHistory === undefined ? {} : { recentIntentHistory }),
      intent,
      playerId
    });
  }

  #resolvePendingPlayerTraversalIntentCommand(
    playerId: MetaversePlayerId
  ): PendingPlayerTraversalIntentCommand | null {
    if (this.#lastPlayerTraversalIntent === null) {
      return null;
    }

    if (
      !this.#playerTraversalIntentSyncDirty &&
      !this.#shouldResendLatestPlayerTraversalIntentCommand()
    ) {
      return null;
    }

    return this.#createPlayerTraversalIntentCommand(
      playerId,
      this.#lastPlayerTraversalIntent
    );
  }

  #shouldResendLatestPlayerTraversalIntentCommand(): boolean {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();
    const localPlayerSnapshot = this.#readLatestLocalPlayerSnapshot();
    const latestProcessedInputSequence =
      localPlayerSnapshot?.lastProcessedInputSequence ?? null;
    const latestProcessedTraversalOrientationSequence =
      localPlayerSnapshot?.lastProcessedTraversalOrientationSequence ?? null;

    if (
      this.#lastPlayerTraversalIntentCommand === null ||
      playerId === null ||
      statusSnapshot.state === "disposed" ||
      !statusSnapshot.connected
    ) {
      return false;
    }

    return (
      latestProcessedInputSequence === null ||
      latestProcessedTraversalOrientationSequence === null ||
      latestProcessedInputSequence <
        this.#lastPlayerTraversalIntentCommand.intent.inputSequence ||
      latestProcessedTraversalOrientationSequence <
        this.#lastPlayerTraversalIntentCommand.intent.orientationSequence
    );
  }

  #resolveNextPlayerTraversalIntentSnapshot(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput
  ): {
    readonly intentSnapshot: MetaversePlayerTraversalIntentSnapshot;
    readonly actionPressed: boolean;
    readonly traversalIntentChanged: boolean;
  } {
    const actionPressed =
      commandInput.intent.actionIntent?.kind ===
        metaverseSequencedTraversalActionKind &&
      commandInput.intent.actionIntent.pressed === true;
    const nextTraversalActionSequence =
      actionPressed && !this.#lastTraversalActionPressed
        ? this.#nextTraversalActionSequence + 1
        : this.#nextTraversalActionSequence;
    const nextActionKind: "jump" | "none" =
      actionPressed || nextTraversalActionSequence > 0
        ? metaverseSequencedTraversalActionKind
        : "none";
    const nextIntent = {
      ...commandInput.intent,
      actionIntent: {
        kind: nextActionKind,
        pressed: actionPressed,
        sequence:
          nextActionKind === metaverseSequencedTraversalActionKind
            ? nextTraversalActionSequence
            : 0
      }
    };
    const normalizedOrientationIntent =
      createMetaversePlayerTraversalIntentSnapshot({
        ...nextIntent,
        inputSequence: this.#lastPlayerTraversalIntent?.inputSequence ?? 0,
        orientationSequence:
          this.#lastPlayerTraversalIntent?.orientationSequence ?? 0
      });
    const sequencedInputChanged = !doMetaversePlayerTraversalSequencedInputsMatch(
      this.#lastPlayerTraversalIntent,
      normalizedOrientationIntent
    );
    const orientationInputChanged = !doPlayerTraversalOrientationInputsMatch(
      this.#lastPlayerTraversalIntent,
      normalizedOrientationIntent
    );
    const inputSequence = sequencedInputChanged
      ? this.#nextPlayerInputSequence + 1
      : this.#lastPlayerTraversalIntent?.inputSequence ?? 0;
    const orientationSequence = orientationInputChanged
      ? this.#nextPlayerTraversalOrientationSequence + 1
      : this.#lastPlayerTraversalIntent?.orientationSequence ?? 0;
    const stableSampleId = this.#lastPlayerTraversalIntent?.sampleId ?? 0;
    let nextIntentSnapshot = createMetaversePlayerTraversalIntentSnapshot({
      ...nextIntent,
      inputSequence,
      orientationSequence,
      sampleId: stableSampleId
    });
    const traversalIntentChanged = !playerTraversalIntentMatches(
      this.#lastPlayerTraversalIntent,
      nextIntentSnapshot
    );

    if (traversalIntentChanged) {
      nextIntentSnapshot = createMetaversePlayerTraversalIntentSnapshot({
        ...nextIntent,
        inputSequence,
        orientationSequence,
        sampleId: this.#nextTraversalSampleId + 1
      });
    }

    return Object.freeze({
      intentSnapshot: nextIntentSnapshot,
      actionPressed,
      traversalIntentChanged
    });
  }
}
