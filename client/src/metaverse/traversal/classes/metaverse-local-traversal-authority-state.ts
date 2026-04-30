import {
  createMetaverseTraversalAuthoritySnapshot,
  type MetaverseTraversalActiveActionSnapshot,
  resolveMetaverseTraversalAuthoritySnapshotForActionState,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import {
  createMetaverseIssuedTraversalIntentSnapshot,
  type MetaverseIssuedTraversalIntentInputSnapshot,
  type MetaverseIssuedTraversalIntentSnapshot
} from "../types/traversal";

function createDefaultTraversalAuthoritySnapshot(): MetaverseTraversalAuthoritySnapshot {
  return createMetaverseTraversalAuthoritySnapshot();
}

function normalizeTraversalActionSequence(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }

  return Math.floor(rawValue);
}

function normalizeActiveTraversalAction(
  localActiveTraversalAction:
    | MetaverseTraversalActiveActionSnapshot
    | undefined
): MetaverseTraversalActiveActionSnapshot {
  return (
    localActiveTraversalAction ??
    Object.freeze({
      kind: "none",
      phase: "idle"
    } satisfies MetaverseTraversalActiveActionSnapshot)
  );
}

function resolveAuthorityActiveTraversalAction(
  locomotionMode: MetaverseLocomotionModeId,
  localActiveTraversalAction:
    | MetaverseTraversalActiveActionSnapshot
    | undefined,
  traversalState: MetaverseUnmountedTraversalStateSnapshot
): MetaverseTraversalActiveActionSnapshot {
  const normalizedActiveTraversalAction =
    normalizeActiveTraversalAction(localActiveTraversalAction);

  if (
    locomotionMode === "grounded" &&
    traversalState.actionState.pendingActionKind === "jump" &&
    traversalState.actionState.resolvedActionKind !== "jump" &&
    normalizedActiveTraversalAction.kind === "jump" &&
    normalizedActiveTraversalAction.phase === "falling"
  ) {
    return Object.freeze({
      kind: "none",
      phase: "idle"
    });
  }

  return normalizedActiveTraversalAction;
}

export interface SyncLocalTraversalAuthorityStateInput {
  readonly advanceTick: boolean;
  readonly localActiveTraversalAction: MetaverseTraversalActiveActionSnapshot;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
}

export interface ResolveNextPredictedGroundedTraversalActionSequenceInput {
  readonly actionPressedThisFrame: boolean;
  readonly localActiveTraversalAction:
    | MetaverseTraversalActiveActionSnapshot
    | undefined;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
}

function resolveLatestPredictedGroundedTraversalActionSequence(
  latestIssuedTraversalIntentSnapshot: MetaverseIssuedTraversalIntentSnapshot | null,
  {
    localActiveTraversalAction,
    locomotionMode,
    traversalState
  }: Omit<ResolveNextPredictedGroundedTraversalActionSequenceInput, "actionPressedThisFrame">
): number {
  if (locomotionMode !== "grounded") {
    return 0;
  }

  const latestIssuedTraversalActionSequence =
    latestIssuedTraversalIntentSnapshot?.actionIntent?.kind === "jump"
      ? normalizeTraversalActionSequence(
          latestIssuedTraversalIntentSnapshot.actionIntent.sequence
        )
      : 0;

  if (latestIssuedTraversalActionSequence > 0) {
    return latestIssuedTraversalActionSequence;
  }

  const normalizedActiveTraversalAction =
    normalizeActiveTraversalAction(localActiveTraversalAction);
  const groundedTraversalActionState = traversalState.actionState;
  const pendingActionSequence =
    groundedTraversalActionState.pendingActionKind === "jump"
      ? groundedTraversalActionState.pendingActionSequence
      : 0;
  const resolvedActiveJumpActionSequence =
    groundedTraversalActionState.resolvedActionKind === "jump" &&
    (
      localActiveTraversalAction === undefined ||
      (
        normalizedActiveTraversalAction.kind === "jump" &&
        normalizedActiveTraversalAction.phase !== "idle"
      )
    )
      ? groundedTraversalActionState.resolvedActionSequence
      : 0;

  return Math.max(
    pendingActionSequence,
    resolvedActiveJumpActionSequence
  );
}

export class MetaverseLocalTraversalAuthorityState {
  #snapshot = createDefaultTraversalAuthoritySnapshot();
  #currentTick = 0;
  #latestIssuedTraversalIntentSnapshot: MetaverseIssuedTraversalIntentSnapshot | null =
    null;
  #latestIssuedTraversalSequence = 0;

  get currentTick(): number {
    return this.#currentTick;
  }

  get latestIssuedTraversalIntentSnapshot():
    | MetaverseIssuedTraversalIntentSnapshot
    | null {
    return this.#latestIssuedTraversalIntentSnapshot;
  }

  get latestIssuedTraversalSequence(): number {
    return this.#latestIssuedTraversalSequence;
  }

  get snapshot(): MetaverseTraversalAuthoritySnapshot {
    return this.#snapshot;
  }

  reset(): void {
    this.#snapshot = createDefaultTraversalAuthoritySnapshot();
    this.#currentTick = 0;
    this.#latestIssuedTraversalIntentSnapshot = null;
    this.#latestIssuedTraversalSequence = 0;
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
      activeAction: resolveAuthorityActiveTraversalAction(
        locomotionMode,
        localActiveTraversalAction,
        traversalState
      ),
      actionState: traversalState.actionState,
      currentTick: this.#currentTick,
      locomotionMode: locomotionMode === "swim" ? "swim" : "grounded",
      mounted: locomotionMode === "mounted",
      previousTraversalAuthority: this.#snapshot
    });
  }

  syncIssuedTraversalIntentSnapshot(
    traversalIntentSnapshot: MetaverseIssuedTraversalIntentInputSnapshot | null,
    input: Omit<SyncLocalTraversalAuthorityStateInput, "advanceTick">
  ): void {
    this.#latestIssuedTraversalIntentSnapshot =
      createMetaverseIssuedTraversalIntentSnapshot(traversalIntentSnapshot);
    this.#latestIssuedTraversalSequence =
      traversalIntentSnapshot?.sequence ?? 0;
    this.sync({
      ...input,
      advanceTick: false
    });
  }

  resolveNextPredictedGroundedTraversalActionSequence({
    actionPressedThisFrame,
    localActiveTraversalAction,
    locomotionMode,
    traversalState
  }: ResolveNextPredictedGroundedTraversalActionSequenceInput): number {
    const latestPredictedTraversalActionSequence =
      resolveLatestPredictedGroundedTraversalActionSequence(
        this.#latestIssuedTraversalIntentSnapshot,
        {
          localActiveTraversalAction,
          locomotionMode,
          traversalState
        }
      );

    if (latestPredictedTraversalActionSequence > 0) {
      return latestPredictedTraversalActionSequence;
    }

    if (!actionPressedThisFrame) {
      return 0;
    }

    return latestPredictedTraversalActionSequence + 1;
  }
}
