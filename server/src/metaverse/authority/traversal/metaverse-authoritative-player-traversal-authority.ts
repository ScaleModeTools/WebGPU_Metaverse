import {
  createMetaverseTraversalFacingSnapshot,
  metaverseTraversalActionBufferSeconds,
  queueMetaverseUnmountedTraversalAction,
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
  type MetaversePlayerTraversalIntentSnapshot,
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
  weaponState?: { readonly weaponId: string } | null;
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
  readonly readTickIntervalMs: () => number;
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

function resolveTraversalIntentSequence(
  intent: Pick<
    MetaversePlayerTraversalIntentSnapshot,
    "sequence"
  >
): number {
  return intent.sequence;
}

function playerTraversalIntentMatches(
  leftIntent: MetaversePlayerTraversalIntentSnapshot,
  rightIntent: Pick<
    MetaversePlayerTraversalIntentSnapshot,
    | "actionIntent"
    | "bodyControl"
    | "facing"
    | "locomotionMode"
    | "sequence"
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
    leftIntent.locomotionMode === rightIntent.locomotionMode &&
    resolveTraversalIntentSequence(leftIntent) ===
      resolveTraversalIntentSequence(rightIntent)
  );
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
  const traversalSequence = resolveTraversalIntentSequence(inputIntent);

  return createMetaversePlayerTraversalIntentSnapshot({
    actionIntent: inputIntent.actionIntent,
    bodyControl: inputIntent.bodyControl,
    facing: constrainedTraversalFacing,
    locomotionMode: inputIntent.locomotionMode,
    sequence: traversalSequence
  });
}

function createIdleTraversalIntentSnapshot<
  PlayerRuntime extends MetaverseAuthoritativePlayerTraversalRuntimeState
>(
  playerRuntime: PlayerRuntime
): MetaversePlayerTraversalIntentSnapshot {
  return createMetaversePlayerTraversalIntentSnapshot({
    actionIntent: {
      kind: "none",
      pressed: false,
      sequence: 0
    },
    bodyControl: {
      boost: false,
      moveAxis: 0,
      strafeAxis: 0,
      turnAxis: 0
    },
    facing: createMetaverseTraversalFacingSnapshot({
      pitchRadians: playerRuntime.lookPitchRadians,
      yawRadians: playerRuntime.lookYawRadians
    }),
    locomotionMode:
      playerRuntime.unmountedTraversalState.locomotionMode === "swim"
        ? "swim"
        : "grounded",
    sequence: 0
  });
}

function shouldRejectTraversalIntentAfterBaseline(
  baselineIntent: MetaversePlayerTraversalIntentSnapshot,
  nextIntent: MetaversePlayerTraversalIntentSnapshot
): boolean {
  const baselineTraversalSequence =
    resolveTraversalIntentSequence(baselineIntent);
  const nextTraversalSequence = resolveTraversalIntentSequence(nextIntent);

  return (
    nextTraversalSequence < baselineTraversalSequence ||
    (nextTraversalSequence === baselineTraversalSequence &&
      !playerTraversalIntentMatches(baselineIntent, nextIntent))
  );
}

function resolveNextTraversalIntentActivationAtMs(
  nowMs: number,
  lastAdvancedAtMs: number | null,
  tickIntervalMs: number
): number {
  const normalizedTickIntervalMs = Math.max(1, Math.floor(tickIntervalMs));
  const normalizedLastAdvancedAtMs = Math.max(0, lastAdvancedAtMs ?? 0);

  if (nowMs <= normalizedLastAdvancedAtMs) {
    return normalizedLastAdvancedAtMs;
  }

  const elapsedSinceLastAdvanceMs = nowMs - normalizedLastAdvancedAtMs;
  const elapsedTickCount = Math.ceil(
    elapsedSinceLastAdvanceMs / normalizedTickIntervalMs
  );

  return (
    normalizedLastAdvancedAtMs + elapsedTickCount * normalizedTickIntervalMs
  );
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
    const tickIntervalMs = Math.max(
      1,
      Math.floor(this.#dependencies.readTickIntervalMs())
    );
    const existingCurrentIntent =
      existingTraversalIntent?.currentIntent ??
      createIdleTraversalIntentSnapshot(playerRuntime);
    const nextTraversalIntentTimeline = [
      ...(existingTraversalIntent?.pendingIntentTimeline ?? [])
    ];
    const firstQueuedActivationAtMs = resolveNextTraversalIntentActivationAtMs(
      nowMs,
      this.#dependencies.readLastAdvancedAtMs(),
      tickIntervalMs
    );
    let latestComparableIntent =
      nextTraversalIntentTimeline[nextTraversalIntentTimeline.length - 1]?.intent ??
      existingCurrentIntent;
    let nextEffectiveAtMs = Math.max(
      firstQueuedActivationAtMs,
      (nextTraversalIntentTimeline[nextTraversalIntentTimeline.length - 1]
        ?.effectiveAtMs ?? firstQueuedActivationAtMs - tickIntervalMs) +
        tickIntervalMs
    );
    let acceptedTraversalIntent = false;

    for (const intentSample of [
      ...(normalizedCommand.pendingIntentSamples ?? []),
      normalizedCommand.intent
    ]) {
      const nextTraversalIntent = createConstrainedTraversalIntentSnapshot(
        playerRuntime,
        this.#dependencies.resolveConstrainedPlayerLookIntent,
        intentSample
      );

      if (
        playerTraversalIntentMatches(
          latestComparableIntent,
          nextTraversalIntent
        )
      ) {
        continue;
      }

      if (
        shouldRejectTraversalIntentAfterBaseline(
          latestComparableIntent,
          nextTraversalIntent
        )
      ) {
        continue;
      }

      nextTraversalIntentTimeline.push(
        Object.freeze({
          effectiveAtMs: nextEffectiveAtMs,
          intent: nextTraversalIntent
        })
      );

      if (
        nextEffectiveAtMs <= nowMs &&
        nextTraversalIntent.actionIntent.kind !== "none" &&
        nextTraversalIntent.actionIntent.pressed
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

      latestComparableIntent = nextTraversalIntent;
      acceptedTraversalIntent = true;
      nextEffectiveAtMs += tickIntervalMs;
    }

    if (!acceptedTraversalIntent) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    this.#dependencies.playerTraversalIntentsByPlayerId.set(
      normalizedCommand.playerId,
      {
        currentIntent: existingCurrentIntent,
        pendingIntentTimeline: [...nextTraversalIntentTimeline]
      }
    );

    playerRuntime.lookPitchRadians = latestComparableIntent.facing.pitchRadians;
    playerRuntime.lookYawRadians = latestComparableIntent.facing.yawRadians;
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

    const mountedLookAllowed = shouldTreatMetaverseMountedOccupancyAsTraversalMounted(
      playerRuntime.mountedOccupancy
    );
    const armedUnmountedLookAllowed =
      !mountedLookAllowed && playerRuntime.weaponState != null;

    if (!mountedLookAllowed && !armedUnmountedLookAllowed) {
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
