import {
  createMetaverseTraversalFacingSnapshot,
  metaverseTraversalActionBufferSeconds,
  queueMetaverseUnmountedTraversalAction,
  type MetaverseTraversalBodyControlSnapshot,
  type MetaverseTraversalFacingSnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  doMetaversePlayerTraversalSequencedInputsMatch,
  type MetaversePlayerTraversalActionIntentSnapshot,
  type MetaversePlayerTraversalIntentLocomotionModeId,
  type MetaversePlayerTraversalIntentSnapshot,
  type MetaverseSyncPlayerLookIntentCommand,
  type MetaverseSyncPlayerTraversalIntentCommand
} from "@webgpu-metaverse/shared/metaverse/realtime";

export interface MetaverseAuthoritativePlayerTraversalIntentRuntimeState {
  readonly actionIntent: MetaversePlayerTraversalActionIntentSnapshot;
  readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
  readonly facing: MetaverseTraversalFacingSnapshot;
  inputSequence: number;
  locomotionMode: MetaversePlayerTraversalIntentLocomotionModeId;
  orientationSequence: number;
}

export interface MetaverseAuthoritativePlayerTraversalRuntimeState {
  lastProcessedLookSequence: number;
  lastSeenAtMs: number;
  lookPitchRadians: number;
  lookYawRadians: number;
  mountedOccupancy: object | null;
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
  leftIntent: MetaverseAuthoritativePlayerTraversalIntentRuntimeState,
  rightIntent: Pick<
    MetaverseAuthoritativePlayerTraversalIntentRuntimeState,
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

    if (playerRuntime.mountedOccupancy !== null) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    const existingTraversalIntent =
      this.#dependencies.playerTraversalIntentsByPlayerId.get(
        normalizedCommand.playerId
      );

    if (
      existingTraversalIntent !== undefined &&
      normalizedCommand.intent.inputSequence < existingTraversalIntent.inputSequence
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    if (
      existingTraversalIntent !== undefined &&
      normalizedCommand.intent.inputSequence ===
        existingTraversalIntent.inputSequence &&
      !doMetaversePlayerTraversalSequencedInputsMatch(
        existingTraversalIntent,
        normalizedCommand.intent
      )
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    if (
      existingTraversalIntent !== undefined &&
      normalizedCommand.intent.inputSequence ===
        existingTraversalIntent.inputSequence &&
      normalizedCommand.intent.orientationSequence <
        existingTraversalIntent.orientationSequence
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    const constrainedTraversalFacing =
      this.#dependencies.resolveConstrainedPlayerLookIntent(
        playerRuntime,
        normalizedCommand.intent.facing.pitchRadians,
        normalizedCommand.intent.facing.yawRadians
      );
    const nextTraversalIntent = {
      actionIntent: normalizedCommand.intent.actionIntent,
      bodyControl: normalizedCommand.intent.bodyControl,
      facing: createMetaverseTraversalFacingSnapshot(constrainedTraversalFacing),
      inputSequence: normalizedCommand.intent.inputSequence,
      locomotionMode: normalizedCommand.intent.locomotionMode,
      orientationSequence: normalizedCommand.intent.orientationSequence
    } satisfies MetaverseAuthoritativePlayerTraversalIntentRuntimeState;

    if (
      existingTraversalIntent !== undefined &&
      nextTraversalIntent.inputSequence === existingTraversalIntent.inputSequence &&
      nextTraversalIntent.orientationSequence ===
        existingTraversalIntent.orientationSequence &&
      !playerTraversalIntentMatches(existingTraversalIntent, nextTraversalIntent)
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    if (
      existingTraversalIntent !== undefined &&
      playerTraversalIntentMatches(existingTraversalIntent, nextTraversalIntent)
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    this.#dependencies.playerTraversalIntentsByPlayerId.set(
      normalizedCommand.playerId,
      nextTraversalIntent
    );
    playerRuntime.lookPitchRadians = constrainedTraversalFacing.pitchRadians;
    playerRuntime.lookYawRadians = constrainedTraversalFacing.yawRadians;

    if (
      existingTraversalIntent === undefined ||
      normalizedCommand.intent.inputSequence > existingTraversalIntent.inputSequence
    ) {
      playerRuntime.unmountedTraversalState =
        queueMetaverseUnmountedTraversalAction(
          playerRuntime.unmountedTraversalState,
          {
            actionIntent: normalizedCommand.intent.actionIntent,
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

    if (playerRuntime.mountedOccupancy === null) {
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
