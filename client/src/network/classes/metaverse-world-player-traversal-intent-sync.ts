import type {
  MetaversePlayerTraversalIntentSnapshot,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot,
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
type LocalPlayerTraversalCommandAckSnapshot = Pick<
  MetaverseRealtimeWorldSnapshot["players"][number],
  | "lastProcessedInputSequence"
  | "lastProcessedTraversalOrientationSequence"
  | "traversalAuthority"
>;
const metaverseSequencedTraversalActionKind = "jump";

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
  readonly #readLatestLocalPlayerSnapshot: MetaverseWorldPlayerTraversalIntentSyncDependencies["readLatestLocalPlayerSnapshot"];
  readonly #readPlayerId: MetaverseWorldPlayerTraversalIntentSyncDependencies["readPlayerId"];
  readonly #readStatusSnapshot: MetaverseWorldPlayerTraversalIntentSyncDependencies["readStatusSnapshot"];
  readonly #resolveCommandDelayMs: MetaverseWorldPlayerTraversalIntentSyncDependencies["resolveCommandDelayMs"];
  readonly #sendPlayerTraversalIntentCommand: MetaverseWorldPlayerTraversalIntentSyncDependencies["sendPlayerTraversalIntentCommand"];
  readonly #setTimeout: typeof globalThis.setTimeout;

  #lastTraversalActionPressed = false;
  #lastPlayerTraversalIntent: MetaversePlayerTraversalIntentSnapshot | null = null;
  #lastPlayerTraversalIntentCommand: PendingPlayerTraversalIntentCommand | null =
    null;
  #nextTraversalActionSequence = 0;
  #nextPlayerInputSequence = 0;
  #nextPlayerTraversalOrientationSequence = 0;
  #pendingPlayerTraversalIntentCommand: PendingPlayerTraversalIntentCommand | null =
    null;
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
      this.#lastTraversalActionPressed = false;
      this.#lastPlayerTraversalIntentCommand = null;
      this.#lastPlayerTraversalIntent = null;
      this.#pendingPlayerTraversalIntentCommand = null;
      this.#cancelScheduledPlayerTraversalInputSync();
      return null;
    }

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
    this.#nextPlayerInputSequence = intentSnapshot.inputSequence;
    this.#nextPlayerTraversalOrientationSequence =
      intentSnapshot.orientationSequence;
    this.#pendingPlayerTraversalIntentCommand =
      createMetaverseSyncPlayerTraversalIntentCommand({
        intent: intentSnapshot,
        playerId: commandInput.playerId
      });
    this.#lastPlayerTraversalIntentCommand =
      this.#pendingPlayerTraversalIntentCommand;
    this.#lastPlayerTraversalIntent =
      this.#pendingPlayerTraversalIntentCommand.intent;

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
      this.#pendingPlayerTraversalIntentCommand === null ||
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
      this.#pendingPlayerTraversalIntentCommand !== null &&
      latestProcessedInputSequence !== null &&
      latestProcessedTraversalOrientationSequence !== null &&
      latestProcessedInputSequence >=
        this.#pendingPlayerTraversalIntentCommand.intent.inputSequence &&
      latestProcessedTraversalOrientationSequence >=
        this.#pendingPlayerTraversalIntentCommand.intent.orientationSequence
    ) {
      this.#pendingPlayerTraversalIntentCommand = null;
    }

    if (this.#pendingPlayerTraversalIntentCommand !== null) {
      this.#schedulePlayerTraversalInputSync(0);
      return;
    }

    if (this.#shouldResendLatestPlayerTraversalIntentCommand()) {
      this.#pendingPlayerTraversalIntentCommand =
        this.#lastPlayerTraversalIntentCommand;
      this.#schedulePlayerTraversalInputSync(this.#resolveCommandDelayMs());
      return;
    }

    this.#cancelScheduledPlayerTraversalInputSync();
  }

  async #flushPlayerTraversalInputSync(): Promise<void> {
    const playerId = this.#readPlayerId();
    const statusSnapshot = this.#readStatusSnapshot();

    if (
      playerId === null ||
      statusSnapshot.state === "disposed" ||
      !statusSnapshot.connected ||
      this.#pendingPlayerTraversalIntentCommand === null
    ) {
      return;
    }

    const pendingCommand = this.#pendingPlayerTraversalIntentCommand;

    this.#lastPlayerTraversalIntentCommand = pendingCommand;
    this.#pendingPlayerTraversalIntentCommand = null;
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

    const pendingCommand = this.#pendingPlayerTraversalIntentCommand;

    if (pendingCommand !== null) {
      const nextTraversalActionSequence =
        pendingCommand.intent.actionIntent.sequence <=
        authoritativeTraversalActionSequence
          ? pendingCommand.intent.actionIntent.kind ===
              metaverseSequencedTraversalActionKind &&
              this.#lastTraversalActionPressed
            ? this.#nextTraversalActionSequence + 1
            : this.#nextTraversalActionSequence
          : pendingCommand.intent.actionIntent.sequence;
      const nextInputSequence =
        pendingCommand.intent.inputSequence <= authoritativeInputSequence
          ? this.#nextPlayerInputSequence + 1
          : pendingCommand.intent.inputSequence;
      const nextOrientationSequence =
        pendingCommand.intent.orientationSequence <=
        authoritativeOrientationSequence
          ? this.#nextPlayerTraversalOrientationSequence + 1
          : pendingCommand.intent.orientationSequence;

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
      this.#pendingPlayerTraversalIntentCommand =
        createMetaverseSyncPlayerTraversalIntentCommand({
          intent: {
            actionIntent: {
              kind:
                pendingCommand.intent.actionIntent.kind ===
                  metaverseSequencedTraversalActionKind ||
                this.#nextTraversalActionSequence > 0
                  ? metaverseSequencedTraversalActionKind
                  : "none",
              pressed:
                pendingCommand.intent.actionIntent.kind ===
                  metaverseSequencedTraversalActionKind &&
                pendingCommand.intent.actionIntent.pressed,
              sequence:
                pendingCommand.intent.actionIntent.kind ===
                  metaverseSequencedTraversalActionKind ||
                this.#nextTraversalActionSequence > 0
                  ? this.#nextTraversalActionSequence
                  : 0
            },
            bodyControl: pendingCommand.intent.bodyControl,
            facing: pendingCommand.intent.facing,
            inputSequence: this.#nextPlayerInputSequence,
            locomotionMode: pendingCommand.intent.locomotionMode,
            orientationSequence: this.#nextPlayerTraversalOrientationSequence
          },
          playerId: pendingCommand.playerId
        });
      this.#lastPlayerTraversalIntentCommand =
        this.#pendingPlayerTraversalIntentCommand;
      this.#lastPlayerTraversalIntent =
        this.#pendingPlayerTraversalIntentCommand.intent;
      return;
    }

    this.#lastPlayerTraversalIntentCommand = null;
    this.#lastPlayerTraversalIntent = null;
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
    const nextIntentSnapshot = createMetaversePlayerTraversalIntentSnapshot({
      ...nextIntent,
      inputSequence,
      orientationSequence
    });
    const traversalIntentChanged = !playerTraversalIntentMatches(
      this.#lastPlayerTraversalIntent,
      nextIntentSnapshot
    );

    return Object.freeze({
      intentSnapshot: nextIntentSnapshot,
      actionPressed,
      traversalIntentChanged
    });
  }
}
