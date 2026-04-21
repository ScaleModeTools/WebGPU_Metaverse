import {
  createMetaverseTraversalFacingSnapshot,
  metaverseTraversalActionBufferSeconds,
  queueMetaverseUnmountedTraversalAction,
  type MetaverseTraversalBodyControlSnapshot,
  type MetaverseTraversalFacingSnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  shouldTreatMetaverseMountedOccupancyAsTraversalMounted,
  type MetaversePlayerId,
  type MetaversePresenceMountedOccupancySnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaversePlayerTraversalIntentSnapshot,
  createMetaverseSyncPlayerTraversalIntentCommand,
  doMetaversePlayerTraversalSequencedInputsMatch,
  type MetaversePlayerTraversalActionIntentSnapshot,
  type MetaversePlayerTraversalIntentSnapshot,
  type MetaversePlayerTraversalRecentIntentHistoryEntry,
  type MetaverseSyncPlayerLookIntentCommand,
  type MetaverseSyncPlayerTraversalIntentCommand
} from "@webgpu-metaverse/shared/metaverse/realtime";

export interface MetaverseAuthoritativePlayerTraversalIntentTimelineEntryRuntimeState {
  readonly effectiveAtMs: number;
  readonly intent: MetaversePlayerTraversalIntentSnapshot;
}

export interface MetaverseAuthoritativePlayerTraversalIntentRuntimeState {
  currentIntent: MetaversePlayerTraversalIntentSnapshot;
  pendingIntentTimeline: MetaverseAuthoritativePlayerTraversalIntentTimelineEntryRuntimeState[];
}

export interface MetaverseAuthoritativePlayerTraversalRuntimeState {
  lastProcessedLookSequence: number;
  lastSeenAtMs: number;
  lookPitchRadians: number;
  lookYawRadians: number;
  mountedOccupancy:
    | Pick<
        MetaversePresenceMountedOccupancySnapshot,
        "occupancyKind" | "occupantRole"
      >
    | null;
  realtimeWorldAuthorityActive: boolean;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
}

interface MetaverseAuthoritativePlayerTraversalAuthorityDependencies<
  PlayerRuntime extends MetaverseAuthoritativePlayerTraversalRuntimeState
> {
  readonly incrementSnapshotSequence: () => void;
  readonly playerTraversalIntentsByPlayerId: Map<
    MetaversePlayerId,
    MetaverseAuthoritativePlayerTraversalIntentRuntimeState
  >;
  readonly playersById: ReadonlyMap<MetaversePlayerId, PlayerRuntime>;
  readonly readLastAdvancedAtMs: () => number | null;
  readonly resolveConstrainedPlayerLookIntent: (
    playerRuntime: PlayerRuntime,
    pitchRadians: number,
    yawRadians: number
  ) => {
    readonly pitchRadians: number;
    readonly yawRadians: number;
  };
  readonly syncPlayerTraversalAuthorityState: (
    playerRuntime: PlayerRuntime
  ) => void;
}

function playerTraversalIntentMatches(
  leftIntent: MetaversePlayerTraversalIntentSnapshot,
  rightIntent: Pick<
    MetaversePlayerTraversalIntentSnapshot,
    | "actionIntent"
    | "bodyControl"
    | "facing"
    | "inputSequence"
    | "locomotionMode"
    | "orientationSequence"
  >
): boolean {
  return (
    leftIntent.actionIntent.kind === rightIntent.actionIntent.kind &&
    leftIntent.actionIntent.pressed === rightIntent.actionIntent.pressed &&
    leftIntent.actionIntent.sequence === rightIntent.actionIntent.sequence &&
    leftIntent.bodyControl.boost === rightIntent.bodyControl.boost &&
    leftIntent.bodyControl.moveAxis === rightIntent.bodyControl.moveAxis &&
    leftIntent.bodyControl.strafeAxis === rightIntent.bodyControl.strafeAxis &&
    leftIntent.bodyControl.turnAxis === rightIntent.bodyControl.turnAxis &&
    leftIntent.facing.pitchRadians === rightIntent.facing.pitchRadians &&
    leftIntent.facing.yawRadians === rightIntent.facing.yawRadians &&
    leftIntent.inputSequence === rightIntent.inputSequence &&
    leftIntent.locomotionMode === rightIntent.locomotionMode &&
    leftIntent.orientationSequence === rightIntent.orientationSequence
  );
}

function playerTraversalIntentTimelineMatches(
  leftTimeline:
    | readonly MetaverseAuthoritativePlayerTraversalIntentTimelineEntryRuntimeState[]
    | null,
  rightTimeline: readonly MetaverseAuthoritativePlayerTraversalIntentTimelineEntryRuntimeState[]
): boolean {
  if (leftTimeline === null || leftTimeline.length !== rightTimeline.length) {
    return false;
  }

  return leftTimeline.every((leftEntry, entryIndex) => {
    const rightEntry = rightTimeline[entryIndex];

    return (
      rightEntry !== undefined &&
      leftEntry.effectiveAtMs === rightEntry.effectiveAtMs &&
      playerTraversalIntentMatches(leftEntry.intent, rightEntry.intent)
    );
  });
}

function createConstrainedTraversalIntentSnapshot<
  PlayerRuntime extends MetaverseAuthoritativePlayerTraversalRuntimeState
>(
  playerRuntime: PlayerRuntime,
  resolveConstrainedPlayerLookIntent: MetaverseAuthoritativePlayerTraversalAuthorityDependencies<PlayerRuntime>["resolveConstrainedPlayerLookIntent"],
  inputIntent: MetaversePlayerTraversalIntentSnapshot
): MetaversePlayerTraversalIntentSnapshot {
  const constrainedTraversalFacing = resolveConstrainedPlayerLookIntent(
    playerRuntime,
    inputIntent.facing.pitchRadians,
    inputIntent.facing.yawRadians
  );

  return createMetaversePlayerTraversalIntentSnapshot({
    actionIntent: inputIntent.actionIntent,
    bodyControl: inputIntent.bodyControl,
    facing: constrainedTraversalFacing,
    inputSequence: inputIntent.inputSequence,
    locomotionMode: inputIntent.locomotionMode,
    orientationSequence: inputIntent.orientationSequence,
    sampleId: inputIntent.sampleId
  });
}

function createTraversalIntentTimelineFromRecentHistory<
  PlayerRuntime extends MetaverseAuthoritativePlayerTraversalRuntimeState
>(
  playerRuntime: PlayerRuntime,
  resolveConstrainedPlayerLookIntent: MetaverseAuthoritativePlayerTraversalAuthorityDependencies<PlayerRuntime>["resolveConstrainedPlayerLookIntent"],
  currentIntent: MetaversePlayerTraversalIntentSnapshot,
  recentIntentHistory:
    | readonly MetaversePlayerTraversalRecentIntentHistoryEntry[]
    | undefined,
  timelineEndedAtMs: number
): readonly MetaverseAuthoritativePlayerTraversalIntentTimelineEntryRuntimeState[] {
  const timelineEntries =
    recentIntentHistory === undefined ? [] : recentIntentHistory.slice();
  const nextTimeline = [];
  let cursorMs = Math.max(0, timelineEndedAtMs);

  for (
    let entryIndex = timelineEntries.length - 1;
    entryIndex >= 0;
    entryIndex -= 1
  ) {
    const historyEntry = timelineEntries[entryIndex];

    if (historyEntry === undefined) {
      continue;
    }

    const effectiveAtMs = Math.max(0, cursorMs - historyEntry.durationMs);

    nextTimeline.unshift(
      Object.freeze({
        effectiveAtMs,
        intent: createConstrainedTraversalIntentSnapshot(
          playerRuntime,
          resolveConstrainedPlayerLookIntent,
          historyEntry.intent
        )
      })
    );
    cursorMs = effectiveAtMs;
  }

  const constrainedCurrentIntent = createConstrainedTraversalIntentSnapshot(
    playerRuntime,
    resolveConstrainedPlayerLookIntent,
    currentIntent
  );
  const lastTimelineIntent = nextTimeline.at(-1)?.intent ?? null;

  if (
    lastTimelineIntent === null ||
    !playerTraversalIntentMatches(lastTimelineIntent, constrainedCurrentIntent)
  ) {
    nextTimeline.push(
      Object.freeze({
        effectiveAtMs: Math.max(0, timelineEndedAtMs),
        intent: constrainedCurrentIntent
      })
    );
  }

  return Object.freeze(nextTimeline);
}

function mergeTraversalIntentTimeline(
  existingTimeline:
    | readonly MetaverseAuthoritativePlayerTraversalIntentTimelineEntryRuntimeState[]
    | null,
  incomingTimeline: readonly MetaverseAuthoritativePlayerTraversalIntentTimelineEntryRuntimeState[],
  lastAdvancedAtMs: number | null
): readonly MetaverseAuthoritativePlayerTraversalIntentTimelineEntryRuntimeState[] {
  if (incomingTimeline.length === 0) {
    return existingTimeline ?? Object.freeze([]);
  }

  const minEffectiveAtMs = lastAdvancedAtMs ?? Number.NEGATIVE_INFINITY;
  const filteredIncomingTimeline = incomingTimeline.filter(
    (timelineEntry) => timelineEntry.effectiveAtMs >= minEffectiveAtMs
  );

  if (filteredIncomingTimeline.length === 0) {
    return existingTimeline ?? Object.freeze([]);
  }

  const firstIncomingAtMs = filteredIncomingTimeline[0]?.effectiveAtMs;
  const preservedExistingTimeline =
    existingTimeline?.filter(
      (timelineEntry) =>
        timelineEntry.effectiveAtMs >= minEffectiveAtMs &&
        firstIncomingAtMs !== undefined &&
        timelineEntry.effectiveAtMs < firstIncomingAtMs
    ) ?? [];
  const mergedTimeline = [
    ...preservedExistingTimeline,
    ...filteredIncomingTimeline
  ].filter((timelineEntry, entryIndex, timeline) => {
    const previousEntry = timeline[entryIndex - 1];

    if (previousEntry === undefined) {
      return true;
    }

    return !(
      previousEntry.effectiveAtMs === timelineEntry.effectiveAtMs &&
      playerTraversalIntentMatches(previousEntry.intent, timelineEntry.intent)
    );
  });

  return Object.freeze(mergedTimeline);
}

export class MetaverseAuthoritativePlayerTraversalAuthority<
  PlayerRuntime extends MetaverseAuthoritativePlayerTraversalRuntimeState
> {
  readonly #dependencies: MetaverseAuthoritativePlayerTraversalAuthorityDependencies<
    PlayerRuntime
  >;

  constructor(
    dependencies: MetaverseAuthoritativePlayerTraversalAuthorityDependencies<
      PlayerRuntime
    >
  ) {
    this.#dependencies = dependencies;
  }

  acceptSyncPlayerTraversalIntentCommand(
    command: MetaverseSyncPlayerTraversalIntentCommand,
    nowMs: number
  ): void {
    const normalizedCommand =
      createMetaverseSyncPlayerTraversalIntentCommand(command);
    const playerRuntime = this.#dependencies.playersById.get(
      normalizedCommand.playerId
    );

    if (playerRuntime === undefined) {
      throw new Error(
        `Unknown metaverse player: ${normalizedCommand.playerId}`
      );
    }

    playerRuntime.realtimeWorldAuthorityActive = true;

    if (
      shouldTreatMetaverseMountedOccupancyAsTraversalMounted(
        playerRuntime.mountedOccupancy
      )
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    const existingTraversalIntent =
      this.#dependencies.playerTraversalIntentsByPlayerId.get(
        normalizedCommand.playerId
      );
    const existingCurrentIntent = existingTraversalIntent?.currentIntent;

    if (
      existingCurrentIntent !== undefined &&
      normalizedCommand.intent.inputSequence < existingCurrentIntent.inputSequence
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    if (
      existingCurrentIntent !== undefined &&
      normalizedCommand.intent.inputSequence ===
        existingCurrentIntent.inputSequence &&
      !doMetaversePlayerTraversalSequencedInputsMatch(
        existingCurrentIntent,
        normalizedCommand.intent
      )
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    if (
      existingCurrentIntent !== undefined &&
      normalizedCommand.intent.inputSequence ===
        existingCurrentIntent.inputSequence &&
      normalizedCommand.intent.orientationSequence <
        existingCurrentIntent.orientationSequence
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    const nextTraversalIntent = createConstrainedTraversalIntentSnapshot(
      playerRuntime,
      this.#dependencies.resolveConstrainedPlayerLookIntent,
      normalizedCommand.intent
    );
    const incomingTraversalIntentTimeline =
      createTraversalIntentTimelineFromRecentHistory(
        playerRuntime,
        this.#dependencies.resolveConstrainedPlayerLookIntent,
        normalizedCommand.intent,
        normalizedCommand.recentIntentHistory,
        Math.min(
          nowMs,
          normalizedCommand.estimatedServerTimeMs ?? nowMs
        )
      );
    const nextTraversalIntentTimeline = mergeTraversalIntentTimeline(
      existingTraversalIntent?.pendingIntentTimeline ?? null,
      incomingTraversalIntentTimeline,
      this.#dependencies.readLastAdvancedAtMs()
    );

    if (
      existingCurrentIntent !== undefined &&
      nextTraversalIntent.inputSequence === existingCurrentIntent.inputSequence &&
      nextTraversalIntent.orientationSequence ===
        existingCurrentIntent.orientationSequence &&
      !playerTraversalIntentMatches(existingCurrentIntent, nextTraversalIntent)
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    if (
      existingCurrentIntent !== undefined &&
      playerTraversalIntentMatches(existingCurrentIntent, nextTraversalIntent) &&
      playerTraversalIntentTimelineMatches(
        existingTraversalIntent?.pendingIntentTimeline ?? null,
        nextTraversalIntentTimeline
      )
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    this.#dependencies.playerTraversalIntentsByPlayerId.set(
      normalizedCommand.playerId,
      {
        currentIntent: nextTraversalIntent,
        pendingIntentTimeline: [...nextTraversalIntentTimeline]
      }
    );
    playerRuntime.lookPitchRadians = nextTraversalIntent.facing.pitchRadians;
    playerRuntime.lookYawRadians = nextTraversalIntent.facing.yawRadians;

    if (
      existingCurrentIntent === undefined ||
      nextTraversalIntent.inputSequence > existingCurrentIntent.inputSequence
    ) {
      playerRuntime.unmountedTraversalState =
        queueMetaverseUnmountedTraversalAction(
          playerRuntime.unmountedTraversalState,
          {
            actionIntent: nextTraversalIntent.actionIntent,
            bufferSeconds: metaverseTraversalActionBufferSeconds
          }
        );
    }

    playerRuntime.lastSeenAtMs = nowMs;
    this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
  }

  acceptSyncPlayerLookIntentCommand(
    command: MetaverseSyncPlayerLookIntentCommand,
    nowMs: number
  ): void {
    const normalizedCommand = createMetaverseSyncPlayerLookIntentCommand(command);
    const playerRuntime = this.#dependencies.playersById.get(
      normalizedCommand.playerId
    );

    if (playerRuntime === undefined) {
      throw new Error(
        `Unknown metaverse player: ${normalizedCommand.playerId}`
      );
    }

    playerRuntime.realtimeWorldAuthorityActive = true;
    playerRuntime.lastSeenAtMs = nowMs;

    if (
      !shouldTreatMetaverseMountedOccupancyAsTraversalMounted(
        playerRuntime.mountedOccupancy
      )
    ) {
      return;
    }

    if (
      normalizedCommand.lookSequence <= playerRuntime.lastProcessedLookSequence
    ) {
      return;
    }

    const constrainedLookIntent =
      this.#dependencies.resolveConstrainedPlayerLookIntent(
        playerRuntime,
        normalizedCommand.lookIntent.pitchRadians,
        normalizedCommand.lookIntent.yawRadians
      );

    const lookChanged =
      playerRuntime.lookPitchRadians !== constrainedLookIntent.pitchRadians ||
      playerRuntime.lookYawRadians !== constrainedLookIntent.yawRadians;

    playerRuntime.lastProcessedLookSequence = normalizedCommand.lookSequence;
    playerRuntime.lookPitchRadians = constrainedLookIntent.pitchRadians;
    playerRuntime.lookYawRadians = constrainedLookIntent.yawRadians;

    if (lookChanged) {
      this.#dependencies.incrementSnapshotSequence();
    }
  }
}
