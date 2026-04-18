import {
  createMetaverseTraversalAuthoritySnapshot,
  type MetaverseTraversalActiveActionSnapshot,
  resolveMetaverseTraversalAuthoritySnapshotForActionState,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type {
  MetaversePlayerTraversalIntentSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";

function createDefaultTraversalAuthoritySnapshot(): MetaverseTraversalAuthoritySnapshot {
  return createMetaverseTraversalAuthoritySnapshot();
}

function normalizeTraversalActionSequence(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }

  return Math.floor(rawValue);
}

export interface SyncLocalTraversalAuthorityStateInput {
  readonly advanceTick: boolean;
  readonly localActiveTraversalAction: MetaverseTraversalActiveActionSnapshot;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
}

export interface ResolveLatestPredictedGroundedTraversalActionSequenceInput {
  readonly localActiveTraversalAction: MetaverseTraversalActiveActionSnapshot;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
}

export interface ResolveNextPredictedGroundedTraversalActionSequenceInput
  extends ResolveLatestPredictedGroundedTraversalActionSequenceInput {
  readonly actionPressedThisFrame: boolean;
}

export class MetaverseLocalTraversalAuthorityState {
  #snapshot = createDefaultTraversalAuthoritySnapshot();
  #currentTick = 0;
  #latestIssuedTraversalIntentSnapshot: MetaversePlayerTraversalIntentSnapshot | null =
    null;

  get currentTick(): number {
    return this.#currentTick;
  }

  get latestIssuedTraversalIntentSnapshot():
    | MetaversePlayerTraversalIntentSnapshot
    | null {
    return this.#latestIssuedTraversalIntentSnapshot;
  }

  get snapshot(): MetaverseTraversalAuthoritySnapshot {
    return this.#snapshot;
  }

  reset(): void {
    this.#snapshot = createDefaultTraversalAuthoritySnapshot();
    this.#currentTick = 0;
    this.#latestIssuedTraversalIntentSnapshot = null;
  }

  sync({
    advanceTick,
    localActiveTraversalAction,
    locomotionMode,
    traversalState
  }: SyncLocalTraversalAuthorityStateInput): void {
    if (advanceTick) {
      this.#currentTick += 1;
    }

    this.#snapshot = resolveMetaverseTraversalAuthoritySnapshotForActionState({
      activeAction: localActiveTraversalAction,
      actionState: traversalState.actionState,
      currentTick: this.#currentTick,
      locomotionMode: locomotionMode === "swim" ? "swim" : "grounded",
      mounted: locomotionMode === "mounted",
      previousTraversalAuthority: this.#snapshot
    });
  }

  syncIssuedTraversalIntentSnapshot(
    traversalIntentSnapshot: MetaversePlayerTraversalIntentSnapshot | null,
    input: Omit<SyncLocalTraversalAuthorityStateInput, "advanceTick">
  ): void {
    this.#latestIssuedTraversalIntentSnapshot = traversalIntentSnapshot;
    this.sync({
      ...input,
      advanceTick: false
    });
  }

  resolveLatestPredictedGroundedTraversalActionSequence({
    localActiveTraversalAction,
    locomotionMode,
    traversalState
  }: ResolveLatestPredictedGroundedTraversalActionSequenceInput): number {
    if (locomotionMode !== "grounded") {
      return 0;
    }

    const latestIssuedTraversalActionSequence =
      this.#latestIssuedTraversalIntentSnapshot?.actionIntent?.kind === "jump"
        ? normalizeTraversalActionSequence(
            this.#latestIssuedTraversalIntentSnapshot.actionIntent.sequence
          )
        : 0;

    if (latestIssuedTraversalActionSequence > 0) {
      return latestIssuedTraversalActionSequence;
    }

    const groundedTraversalActionState = traversalState.actionState;
    const pendingActionSequence =
      groundedTraversalActionState.pendingActionKind === "jump"
        ? groundedTraversalActionState.pendingActionSequence
        : 0;
    const resolvedActiveJumpActionSequence =
      groundedTraversalActionState.resolvedActionKind === "jump" &&
      localActiveTraversalAction.kind === "jump" &&
      localActiveTraversalAction.phase !== "idle"
        ? groundedTraversalActionState.resolvedActionSequence
        : 0;

    return Math.max(
      pendingActionSequence,
      resolvedActiveJumpActionSequence
    );
  }

  resolveNextPredictedGroundedTraversalActionSequence({
    actionPressedThisFrame,
    localActiveTraversalAction,
    locomotionMode,
    traversalState
  }: ResolveNextPredictedGroundedTraversalActionSequenceInput): number {
    const latestPredictedTraversalActionSequence =
      this.resolveLatestPredictedGroundedTraversalActionSequence({
        localActiveTraversalAction,
        locomotionMode,
        traversalState
      });

    if (latestPredictedTraversalActionSequence > 0) {
      return latestPredictedTraversalActionSequence;
    }

    if (!actionPressedThisFrame) {
      return 0;
    }

    return latestPredictedTraversalActionSequence + 1;
  }
}
