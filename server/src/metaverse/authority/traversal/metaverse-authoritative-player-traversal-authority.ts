import {
  createMetaverseTraversalFacingSnapshot,
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

function resolveTraversalIntentActivationTimeline(
  nowMs: number,
  lastAdvancedAtMs: number | null,
  tickIntervalMs: number,
  sampleCount: number
): readonly number[] {
  const normalizedSampleCount =
    Number.isFinite(sampleCount) && sampleCount > 0
      ? Math.floor(sampleCount)
      : 0;

  if (normalizedSampleCount <= 0) {
    return Object.freeze([]);
  }

  const normalizedNowMs = Math.max(0, nowMs);

  if (normalizedSampleCount === 1) {
    return Object.freeze([normalizedNowMs]);
  }

  const normalizedTickIntervalMs = Math.max(1, Math.floor(tickIntervalMs));
  const boundedLastAdvancedAtMs = Math.min(
    normalizedNowMs,
    Math.max(0, lastAdvancedAtMs ?? normalizedNowMs)
  );
  const replayStartAtMs = Math.max(
    0,
    boundedLastAdvancedAtMs,
    normalizedNowMs -
      normalizedTickIntervalMs * (normalizedSampleCount - 1)
  );
  const replayDurationMs = Math.max(0, normalizedNowMs - replayStartAtMs);
  const replayStepMs = replayDurationMs / (normalizedSampleCount - 1);
  const activationTimeline: number[] = [];

  for (let sampleIndex = 0; sampleIndex < normalizedSampleCount; sampleIndex += 1) {
    activationTimeline.push(
      sampleIndex === normalizedSampleCount - 1
        ? normalizedNowMs
        : replayStartAtMs + replayStepMs * sampleIndex
    );
  }

  return Object.freeze(activationTimeline);
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
    let latestComparableIntent =
      nextTraversalIntentTimeline[nextTraversalIntentTimeline.length - 1]?.intent ??
      existingCurrentIntent;
    const acceptedTraversalIntents: MetaversePlayerTraversalIntentSnapshot[] = [];

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

      acceptedTraversalIntents.push(nextTraversalIntent);
      latestComparableIntent = nextTraversalIntent;
    }

    if (acceptedTraversalIntents.length <= 0) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    const activationTimeline = resolveTraversalIntentActivationTimeline(
      nowMs,
      this.#dependencies.readLastAdvancedAtMs(),
      tickIntervalMs,
      acceptedTraversalIntents.length
    );

    for (
      let intentIndex = 0;
      intentIndex < acceptedTraversalIntents.length;
      intentIndex += 1
    ) {
      const acceptedTraversalIntent = acceptedTraversalIntents[intentIndex];
      const effectiveAtMs = activationTimeline[intentIndex];

      if (
        acceptedTraversalIntent === undefined ||
        effectiveAtMs === undefined
      ) {
        continue;
      }

      nextTraversalIntentTimeline.push(
        Object.freeze({
          effectiveAtMs,
          intent: acceptedTraversalIntent
        })
      );
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
