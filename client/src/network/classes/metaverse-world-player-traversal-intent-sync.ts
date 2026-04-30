import type {
  MetaversePlayerTraversalIntentSnapshotInput,
  MetaversePlayerTraversalIntentSnapshot,
  MetaverseRealtimePlayerTraversalAuthoritySnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseSyncPlayerTraversalIntentCommandInput
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaversePlayerTraversalIntentSnapshot,
  createMetaverseSyncPlayerTraversalIntentCommand
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaverseWorldClientStatusSnapshot } from "../types/metaverse-world-client";

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type PendingPlayerTraversalIntentCommand = ReturnType<
  typeof createMetaverseSyncPlayerTraversalIntentCommand
>;
type PlayerTraversalActionIntentInput = NonNullable<
  MetaversePlayerTraversalIntentSnapshotInput["actionIntent"]
>;
type LocalPlayerTraversalCommandAckSnapshot = {
  readonly lastProcessedTraversalSequence: number;
  readonly traversalAuthority: MetaverseRealtimePlayerTraversalAuthoritySnapshot;
};
const metaverseSequencedTraversalActionKind = "jump";
// Keep a bounded unacked input window. Rapid WASD/boost changes can span more
// than two samples while a datagram is in flight, and dropping those edges makes
// authority replay a different path than local prediction.
const metaversePlayerTraversalPendingIntentMaxEntries = 8;

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
  readonly readLatestLocalPlayerSnapshot:
    () => LocalPlayerTraversalCommandAckSnapshot | null;
  readonly readPlayerId: () => MetaversePlayerId | null;
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
    sequence: leftIntent.sequence
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
    leftIntent.sequence === normalizedRightIntent.sequence
  );
}

function playerTraversalContinuousStateMatches(
  leftIntent: MetaversePlayerTraversalIntentSnapshot | null,
  rightIntent: MetaversePlayerTraversalIntentSnapshot
): boolean {
  if (leftIntent === null) {
    return false;
  }

  return (
    leftIntent.bodyControl.boost === rightIntent.bodyControl.boost &&
    leftIntent.bodyControl.moveAxis === rightIntent.bodyControl.moveAxis &&
    leftIntent.bodyControl.strafeAxis === rightIntent.bodyControl.strafeAxis &&
    leftIntent.bodyControl.turnAxis === rightIntent.bodyControl.turnAxis &&
    leftIntent.facing.pitchRadians === rightIntent.facing.pitchRadians &&
    leftIntent.facing.yawRadians === rightIntent.facing.yawRadians &&
    leftIntent.locomotionMode === rightIntent.locomotionMode
  );
}

function createInactivePlayerTraversalActionIntent():
  PlayerTraversalActionIntentInput {
  return {
    kind: "none",
    pressed: false
  };
}

function createSequencedPlayerTraversalActionIntent({
  pressed,
  sequence
}: {
  readonly pressed: boolean;
  readonly sequence: number;
}): PlayerTraversalActionIntentInput {
  return {
    kind: metaverseSequencedTraversalActionKind,
    pressed,
    sequence
  };
}

function createPlayerTraversalIntentSnapshotInput({
  actionIntent,
  baseIntent,
  sequence
}: {
  readonly actionIntent: PlayerTraversalActionIntentInput;
  readonly baseIntent: MetaverseSyncPlayerTraversalIntentCommandInput["intent"];
  readonly sequence: number;
}): MetaversePlayerTraversalIntentSnapshotInput {
  return {
    ...(baseIntent.bodyControl === undefined
      ? {}
      : { bodyControl: baseIntent.bodyControl }),
    ...(baseIntent.facing === undefined ? {} : { facing: baseIntent.facing }),
    ...(baseIntent.locomotionMode === undefined
      ? {}
      : { locomotionMode: baseIntent.locomotionMode }),
    actionIntent,
    sequence
  };
}

function resolveLatestProcessedTraversalSequence(
  localPlayerSnapshot: LocalPlayerTraversalCommandAckSnapshot | null
): number {
  return localPlayerSnapshot?.lastProcessedTraversalSequence ?? 0;
}

export class MetaverseWorldPlayerTraversalIntentSync {
  readonly #acceptWorldEvent: MetaverseWorldPlayerTraversalIntentSyncDependencies["acceptWorldEvent"];
  readonly #applyWorldAccessError: MetaverseWorldPlayerTraversalIntentSyncDependencies["applyWorldAccessError"];
  readonly #clearTimeout: typeof globalThis.clearTimeout;
  readonly #readLatestLocalPlayerSnapshot: MetaverseWorldPlayerTraversalIntentSyncDependencies["readLatestLocalPlayerSnapshot"];
  readonly #readPlayerId: MetaverseWorldPlayerTraversalIntentSyncDependencies["readPlayerId"];
  readonly #readStatusSnapshot: MetaverseWorldPlayerTraversalIntentSyncDependencies["readStatusSnapshot"];
  readonly #resolveCommandDelayMs: MetaverseWorldPlayerTraversalIntentSyncDependencies["resolveCommandDelayMs"];
  readonly #sendPlayerTraversalIntentCommand: MetaverseWorldPlayerTraversalIntentSyncDependencies["sendPlayerTraversalIntentCommand"];
  readonly #setTimeout: typeof globalThis.setTimeout;

  #lastTraversalActionPressed = false;
  #lastIssuedPlayerTraversalIntent: MetaversePlayerTraversalIntentSnapshot | null =
    null;
  #lastPlayerTraversalIntent: MetaversePlayerTraversalIntentSnapshot | null = null;
  #lastPlayerTraversalIntentCommand: PendingPlayerTraversalIntentCommand | null =
    null;
  #nextTraversalSequence = 0;
  #pendingPlayerTraversalIntentSamples: MetaversePlayerTraversalIntentSnapshot[] =
    [];
  #previewPlayerTraversalIntent: MetaversePlayerTraversalIntentSnapshot | null =
    null;
  #playerTraversalIntentSyncDirty = false;
  #playerTraversalInputSyncHandle: TimeoutHandle | null = null;
  #playerTraversalInputSyncInFlight = false;

  constructor(
    dependencies: MetaverseWorldPlayerTraversalIntentSyncDependencies
  ) {
    this.#acceptWorldEvent = dependencies.acceptWorldEvent;
    this.#applyWorldAccessError = dependencies.applyWorldAccessError;
    this.#clearTimeout = dependencies.clearTimeout;
    this.#readLatestLocalPlayerSnapshot = dependencies.readLatestLocalPlayerSnapshot;
    this.#readPlayerId = dependencies.readPlayerId;
    this.#readStatusSnapshot = dependencies.readStatusSnapshot;
    this.#resolveCommandDelayMs = dependencies.resolveCommandDelayMs;
    this.#sendPlayerTraversalIntentCommand =
      dependencies.sendPlayerTraversalIntentCommand;
    this.#setTimeout = dependencies.setTimeout;
  }

  get latestPlayerTraversalSequence(): number {
    return Math.max(
      resolveLatestProcessedTraversalSequence(
        this.#readLatestLocalPlayerSnapshot()
      ),
      this.#lastIssuedPlayerTraversalIntent?.sequence ?? 0
    );
  }

  get latestPlayerTraversalIntentSnapshot():
    | MetaversePlayerTraversalIntentSnapshot
    | null {
    return this.#lastIssuedPlayerTraversalIntent;
  }

  previewPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerTraversalIntentSnapshot | null {
    if (commandInput === null) {
      this.#previewPlayerTraversalIntent = null;
      return null;
    }

    const previewIntentSnapshot =
      this.#resolveNextPlayerTraversalIntentSnapshot(commandInput).intentSnapshot;

    this.#previewPlayerTraversalIntent = previewIntentSnapshot;

    return previewIntentSnapshot;
  }

  syncFromAuthoritativeWorld(): void {
    const localPlayerSnapshot = this.#readLatestLocalPlayerSnapshot();

    if (localPlayerSnapshot !== null) {
      this.#rebaseTraversalCommandSequences(localPlayerSnapshot);
      this.#filterPendingPlayerTraversalIntentSamples(localPlayerSnapshot);
    }

    this.#syncPlayerTraversalInputSchedule();
  }

  syncPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerTraversalIntentSnapshot | null {
    if (commandInput === null) {
      this.#lastIssuedPlayerTraversalIntent = null;
      this.#lastTraversalActionPressed = false;
      this.#lastPlayerTraversalIntentCommand = null;
      this.#lastPlayerTraversalIntent = null;
      this.#pendingPlayerTraversalIntentSamples = [];
      this.#previewPlayerTraversalIntent = null;
      this.#playerTraversalIntentSyncDirty = false;
      this.#cancelScheduledPlayerTraversalInputSync();
      return null;
    }

    const {
      intentSnapshot,
      actionPressed,
      traversalIntentChanged
    } = this.#resolveNextPlayerTraversalIntentSnapshot(commandInput);

    this.#previewPlayerTraversalIntent = null;
    this.#lastTraversalActionPressed = actionPressed;

    if (!traversalIntentChanged) {
      return intentSnapshot;
    }

    this.#nextTraversalSequence = intentSnapshot.sequence;
    if (this.#lastPlayerTraversalIntent?.sequence !== intentSnapshot.sequence) {
      this.#appendPendingPlayerTraversalIntentSample(
        this.#lastPlayerTraversalIntent
      );
    }
    this.#lastPlayerTraversalIntent =
      intentSnapshot;
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
    const latestProcessedTraversalSequence =
      resolveLatestProcessedTraversalSequence(localPlayerSnapshot);

    if (
      this.#lastPlayerTraversalIntent !== null &&
      latestProcessedTraversalSequence >= this.#lastPlayerTraversalIntent.sequence
    ) {
      this.#playerTraversalIntentSyncDirty = false;
    }

    if (
      this.#lastPlayerTraversalIntentCommand !== null &&
      latestProcessedTraversalSequence >=
        this.#lastPlayerTraversalIntentCommand.intent.sequence
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
    this.#lastIssuedPlayerTraversalIntent = pendingCommand.intent;
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
    const authoritativeTraversalSequence =
      resolveLatestProcessedTraversalSequence(localPlayerSnapshot);
    const traversalSequenceRaised =
      authoritativeTraversalSequence > this.#nextTraversalSequence;

    if (!traversalSequenceRaised) {
      return;
    }

    this.#nextTraversalSequence = Math.max(
      this.#nextTraversalSequence,
      authoritativeTraversalSequence
    );

    const lastPlayerTraversalIntent = this.#lastPlayerTraversalIntent;

    if (lastPlayerTraversalIntent !== null) {
      const nextTraversalSequence =
        lastPlayerTraversalIntent.sequence <= authoritativeTraversalSequence
          ? this.#nextTraversalSequence + 1
          : lastPlayerTraversalIntent.sequence;

      this.#nextTraversalSequence = Math.max(
        this.#nextTraversalSequence,
        nextTraversalSequence
      );
      this.#lastPlayerTraversalIntent =
        createMetaversePlayerTraversalIntentSnapshot({
          actionIntent: {
            kind: "none",
            pressed: false
          },
          bodyControl: lastPlayerTraversalIntent.bodyControl,
          facing: lastPlayerTraversalIntent.facing,
          locomotionMode: lastPlayerTraversalIntent.locomotionMode,
          sequence: this.#nextTraversalSequence
        });
      this.#lastPlayerTraversalIntentCommand = null;
      this.#pendingPlayerTraversalIntentSamples = [];
      this.#previewPlayerTraversalIntent = null;
      this.#playerTraversalIntentSyncDirty = true;
      return;
    }

    this.#lastPlayerTraversalIntentCommand = null;
    this.#lastPlayerTraversalIntent = null;
  }

  #appendPendingPlayerTraversalIntentSample(
    intent: MetaversePlayerTraversalIntentSnapshot | null
  ): void {
    if (intent === null) {
      return;
    }

    const latestPendingIntent =
      this.#pendingPlayerTraversalIntentSamples[
        this.#pendingPlayerTraversalIntentSamples.length - 1
      ] ?? null;

    if (playerTraversalIntentMatches(latestPendingIntent, intent)) {
      return;
    }

    this.#pendingPlayerTraversalIntentSamples.push(intent);

    if (
      this.#pendingPlayerTraversalIntentSamples.length >
      metaversePlayerTraversalPendingIntentMaxEntries
    ) {
      this.#pendingPlayerTraversalIntentSamples.splice(
        0,
        this.#pendingPlayerTraversalIntentSamples.length -
          metaversePlayerTraversalPendingIntentMaxEntries
      );
    }
  }

  #filterPendingPlayerTraversalIntentSamples(
    localPlayerSnapshot: LocalPlayerTraversalCommandAckSnapshot | null
  ): PendingPlayerTraversalIntentCommand["pendingIntentSamples"] {
    const latestProcessedTraversalSequence =
      resolveLatestProcessedTraversalSequence(localPlayerSnapshot);

    this.#pendingPlayerTraversalIntentSamples =
      this.#pendingPlayerTraversalIntentSamples.filter(
        (intentSample) => intentSample.sequence > latestProcessedTraversalSequence
      );

    return this.#pendingPlayerTraversalIntentSamples.length > 0
      ? Object.freeze([...this.#pendingPlayerTraversalIntentSamples])
      : undefined;
  }

  #createPlayerTraversalIntentCommand(
    playerId: MetaversePlayerId,
    intent: MetaversePlayerTraversalIntentSnapshot
  ): PendingPlayerTraversalIntentCommand {
    const pendingIntentSamples = this.#filterPendingPlayerTraversalIntentSamples(
      this.#readLatestLocalPlayerSnapshot()
    );

    return createMetaverseSyncPlayerTraversalIntentCommand({
      ...(pendingIntentSamples === undefined ? {} : { pendingIntentSamples }),
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

    const shouldResendLatestCommand =
      this.#shouldResendLatestPlayerTraversalIntentCommand();

    if (
      !this.#playerTraversalIntentSyncDirty &&
      !shouldResendLatestCommand
    ) {
      return null;
    }

    if (
      !this.#playerTraversalIntentSyncDirty &&
      shouldResendLatestCommand &&
      this.#lastPlayerTraversalIntentCommand !== null &&
      this.#lastPlayerTraversalIntentCommand.playerId === playerId
    ) {
      return this.#lastPlayerTraversalIntentCommand;
    }

    return this.#createPlayerTraversalIntentCommand(
      playerId,
      this.#lastPlayerTraversalIntent
    );
  }

  #shouldResendLatestPlayerTraversalIntentCommand(): boolean {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();
    const latestProcessedTraversalSequence =
      resolveLatestProcessedTraversalSequence(
        this.#readLatestLocalPlayerSnapshot()
      );

    if (
      this.#lastPlayerTraversalIntentCommand === null ||
      playerId === null ||
      statusSnapshot.state === "disposed" ||
      !statusSnapshot.connected
    ) {
      return false;
    }

    return (
      latestProcessedTraversalSequence <
      this.#lastPlayerTraversalIntentCommand.intent.sequence
    );
  }

  #resolveNextPlayerTraversalIntentSnapshot(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput
  ): {
    readonly intentSnapshot: MetaversePlayerTraversalIntentSnapshot;
    readonly actionPressed: boolean;
    readonly traversalIntentChanged: boolean;
  } {
    const previousIntent = this.#lastPlayerTraversalIntent;
    const actionPressed =
      commandInput.intent.actionIntent?.kind ===
        metaverseSequencedTraversalActionKind &&
      commandInput.intent.actionIntent.pressed === true;
    const previousActionIntent = previousIntent?.actionIntent ?? null;
    const nextActionIntent: PlayerTraversalActionIntentInput =
      actionPressed
        ? previousActionIntent !== null &&
          previousActionIntent.kind === metaverseSequencedTraversalActionKind &&
          previousActionIntent.sequence > 0
          ? createSequencedPlayerTraversalActionIntent({
              pressed: true,
              sequence: previousActionIntent.sequence
            })
          : createSequencedPlayerTraversalActionIntent({
              pressed: true,
              sequence: this.#nextTraversalSequence + 1
            })
        : previousActionIntent !== null &&
            previousActionIntent.kind === metaverseSequencedTraversalActionKind &&
            previousActionIntent.sequence > 0 &&
            (this.#lastTraversalActionPressed || previousActionIntent.pressed)
          ? createSequencedPlayerTraversalActionIntent({
              pressed: false,
              sequence: previousActionIntent.sequence
            })
          : createInactivePlayerTraversalActionIntent();
    const sameSequenceCandidate = createPlayerTraversalIntentSnapshotInput({
      actionIntent: nextActionIntent,
      baseIntent: commandInput.intent,
      sequence: previousIntent?.sequence ?? this.#nextTraversalSequence + 1
    });
    const sameSequenceIntentSnapshot =
      createMetaversePlayerTraversalIntentSnapshot(sameSequenceCandidate);
    const traversalIntentChanged = !playerTraversalIntentMatches(
      previousIntent,
      sameSequenceIntentSnapshot
    );

    if (!traversalIntentChanged) {
      return Object.freeze({
        intentSnapshot: previousIntent ?? sameSequenceIntentSnapshot,
        actionPressed,
        traversalIntentChanged: false
      });
    }

    const requiresNewTraversalSequence =
      previousIntent === null ||
      !playerTraversalContinuousStateMatches(
        previousIntent,
        sameSequenceIntentSnapshot
      ) ||
      previousIntent.actionIntent.sequence !==
        sameSequenceIntentSnapshot.actionIntent.sequence;
    const nextIntentSnapshot =
      !requiresNewTraversalSequence ||
      sameSequenceIntentSnapshot.sequence === this.#nextTraversalSequence + 1
        ? sameSequenceIntentSnapshot
        : createMetaversePlayerTraversalIntentSnapshot(
            createPlayerTraversalIntentSnapshotInput({
              actionIntent: nextActionIntent,
              baseIntent: commandInput.intent,
              sequence: this.#nextTraversalSequence + 1
            })
          );

    return Object.freeze({
      intentSnapshot: nextIntentSnapshot,
      actionPressed,
      traversalIntentChanged
    });
  }
}
