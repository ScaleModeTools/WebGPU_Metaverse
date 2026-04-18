import type {
  MetaverseTraversalActionIntentSnapshot,
  MetaverseTraversalActionKindId,
  MetaverseTraversalActionResolutionStateId
} from "./metaverse-traversal-contract.js";
import { toFiniteNumber } from "./metaverse-surface-traversal-simulation.js";

export interface MetaverseTraversalActionStateSnapshot {
  readonly pendingActionBufferSecondsRemaining: number;
  readonly pendingActionKind: MetaverseTraversalActionKindId;
  readonly pendingActionSequence: number;
  readonly resolvedActionKind: MetaverseTraversalActionKindId;
  readonly resolvedActionSequence: number;
  readonly resolvedActionState: MetaverseTraversalActionResolutionStateId;
}

export interface QueueMetaverseTraversalActionInput {
  readonly actionIntent: MetaverseTraversalActionIntentSnapshot;
  readonly bufferSeconds: number;
}

export interface AdvanceMetaverseTraversalActionStateInput {
  readonly canConsumePendingAction: boolean;
  readonly deltaSeconds: number;
}

export interface AdvanceMetaverseTraversalActionStateResult {
  readonly actionConsumed: boolean;
  readonly state: MetaverseTraversalActionStateSnapshot;
}

export interface SyncMetaverseTraversalActionStateFromAcceptedActionSequenceInput {
  readonly acceptedActionKind: MetaverseTraversalActionKindId;
  readonly acceptedActionSequence: number;
}

export const metaverseTraversalActionBufferSeconds = 0.2;

function normalizeFiniteNonNegativeInteger(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }

  return Math.floor(rawValue);
}

function normalizeFiniteNonNegativeSeconds(rawValue: number): number {
  return Math.max(0, toFiniteNumber(rawValue, 0));
}

function resolveNormalizedActionKind(
  rawValue: MetaverseTraversalActionKindId | undefined,
  actionSequence: number
): MetaverseTraversalActionKindId {
  if (actionSequence <= 0 || rawValue === undefined || rawValue === "none") {
    return "none";
  }

  return rawValue;
}

export function createMetaverseTraversalActionStateSnapshot(
  input: Partial<MetaverseTraversalActionStateSnapshot> = {}
): MetaverseTraversalActionStateSnapshot {
  const resolvedActionSequence = normalizeFiniteNonNegativeInteger(
    input.resolvedActionSequence ?? 0
  );
  const resolvedActionState =
    resolvedActionSequence > 0
      ? (input.resolvedActionState ?? "none")
      : "none";
  const resolvedActionKind = resolveNormalizedActionKind(
    input.resolvedActionKind,
    resolvedActionSequence
  );
  const pendingActionSequence = normalizeFiniteNonNegativeInteger(
    input.pendingActionSequence ?? 0
  );
  const pendingActionBufferSecondsRemaining =
    pendingActionSequence > resolvedActionSequence
      ? normalizeFiniteNonNegativeSeconds(
          input.pendingActionBufferSecondsRemaining ?? 0
        )
      : 0;
  const pendingActionKind = resolveNormalizedActionKind(
    input.pendingActionKind,
    pendingActionSequence
  );

  return Object.freeze({
    pendingActionBufferSecondsRemaining,
    pendingActionKind:
      pendingActionBufferSecondsRemaining > 0 ? pendingActionKind : "none",
    pendingActionSequence:
      pendingActionBufferSecondsRemaining > 0 ? pendingActionSequence : 0,
    resolvedActionKind,
    resolvedActionSequence,
    resolvedActionState
  });
}

export function queueMetaverseTraversalAction(
  state: MetaverseTraversalActionStateSnapshot,
  { actionIntent, bufferSeconds }: QueueMetaverseTraversalActionInput
): MetaverseTraversalActionStateSnapshot {
  const normalizedActionSequence = normalizeFiniteNonNegativeInteger(
    actionIntent.sequence
  );
  const normalizedActionKind = resolveNormalizedActionKind(
    actionIntent.kind,
    normalizedActionSequence
  );
  const latestKnownActionSequence = Math.max(
    state.pendingActionSequence,
    state.resolvedActionSequence
  );

  if (
    actionIntent.pressed !== true ||
    normalizedActionKind === "none" ||
    normalizedActionSequence <= latestKnownActionSequence
  ) {
    return state;
  }

  return createMetaverseTraversalActionStateSnapshot({
    pendingActionBufferSecondsRemaining: bufferSeconds,
    pendingActionKind: normalizedActionKind,
    pendingActionSequence: normalizedActionSequence,
    resolvedActionKind: state.resolvedActionKind,
    resolvedActionSequence: state.resolvedActionSequence,
    resolvedActionState: state.resolvedActionState
  });
}

export function clearMetaverseTraversalPendingActions(
  state: MetaverseTraversalActionStateSnapshot
): MetaverseTraversalActionStateSnapshot {
  return createMetaverseTraversalActionStateSnapshot({
    resolvedActionKind: state.resolvedActionKind,
    resolvedActionSequence: state.resolvedActionSequence,
    resolvedActionState: state.resolvedActionState
  });
}

export function syncMetaverseTraversalActionStateFromAcceptedActionSequence(
  state: MetaverseTraversalActionStateSnapshot,
  {
    acceptedActionKind,
    acceptedActionSequence
  }: SyncMetaverseTraversalActionStateFromAcceptedActionSequenceInput
): MetaverseTraversalActionStateSnapshot {
  const normalizedAcceptedActionSequence = normalizeFiniteNonNegativeInteger(
    acceptedActionSequence
  );
  const normalizedAcceptedActionKind = resolveNormalizedActionKind(
    acceptedActionKind,
    normalizedAcceptedActionSequence
  );

  if (
    normalizedAcceptedActionKind === "none" ||
    normalizedAcceptedActionSequence <= 0
  ) {
    return state;
  }

  const currentResolvedActionSequence = normalizeFiniteNonNegativeInteger(
    state.resolvedActionSequence
  );
  const shouldPreservePendingAction =
    state.pendingActionKind !== "none" &&
    normalizeFiniteNonNegativeInteger(state.pendingActionSequence) >
      normalizedAcceptedActionSequence;
  const shouldRewriteResolvedAction =
    normalizedAcceptedActionSequence > currentResolvedActionSequence ||
    (normalizedAcceptedActionSequence === currentResolvedActionSequence &&
      (state.resolvedActionKind !== normalizedAcceptedActionKind ||
        state.resolvedActionState !== "accepted"));
  const nextPendingActionBufferSecondsRemaining = shouldPreservePendingAction
    ? state.pendingActionBufferSecondsRemaining
    : 0;
  const nextPendingActionKind = shouldPreservePendingAction
    ? state.pendingActionKind
    : "none";
  const nextPendingActionSequence = shouldPreservePendingAction
    ? state.pendingActionSequence
    : 0;
  const nextResolvedActionKind = shouldRewriteResolvedAction
    ? normalizedAcceptedActionKind
    : state.resolvedActionKind;
  const nextResolvedActionSequence = shouldRewriteResolvedAction
    ? normalizedAcceptedActionSequence
    : state.resolvedActionSequence;
  const nextResolvedActionState = shouldRewriteResolvedAction
    ? "accepted"
    : state.resolvedActionState;

  if (
    nextPendingActionBufferSecondsRemaining ===
      state.pendingActionBufferSecondsRemaining &&
    nextPendingActionKind === state.pendingActionKind &&
    nextPendingActionSequence === state.pendingActionSequence &&
    nextResolvedActionKind === state.resolvedActionKind &&
    nextResolvedActionSequence === state.resolvedActionSequence &&
    nextResolvedActionState === state.resolvedActionState
  ) {
    return state;
  }

  return createMetaverseTraversalActionStateSnapshot({
    pendingActionBufferSecondsRemaining:
      nextPendingActionBufferSecondsRemaining,
    pendingActionKind: nextPendingActionKind,
    pendingActionSequence: nextPendingActionSequence,
    resolvedActionKind: nextResolvedActionKind,
    resolvedActionSequence: nextResolvedActionSequence,
    resolvedActionState: nextResolvedActionState
  });
}

export function readMetaverseTraversalPendingActionBufferAgeMs(
  state: Pick<
    MetaverseTraversalActionStateSnapshot,
    | "pendingActionBufferSecondsRemaining"
    | "pendingActionKind"
    | "pendingActionSequence"
  >,
  bufferSeconds: number,
  actionKind: MetaverseTraversalActionKindId = "jump"
): number | null {
  if (
    state.pendingActionKind !== actionKind ||
    normalizeFiniteNonNegativeInteger(state.pendingActionSequence) <= 0
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.round(
      (normalizeFiniteNonNegativeSeconds(bufferSeconds) -
        normalizeFiniteNonNegativeSeconds(
          state.pendingActionBufferSecondsRemaining
        )) *
        1_000
    )
  );
}

export function advanceMetaverseTraversalActionState(
  state: MetaverseTraversalActionStateSnapshot,
  { canConsumePendingAction, deltaSeconds }: AdvanceMetaverseTraversalActionStateInput
): AdvanceMetaverseTraversalActionStateResult {
  const pendingActionActive =
    state.pendingActionKind !== "none" && state.pendingActionSequence > 0;

  if (!pendingActionActive) {
    return Object.freeze({
      actionConsumed: false,
      state
    });
  }

  if (canConsumePendingAction) {
    return Object.freeze({
      actionConsumed: true,
      state: createMetaverseTraversalActionStateSnapshot({
        pendingActionBufferSecondsRemaining: 0,
        pendingActionKind: "none",
        pendingActionSequence: 0,
        resolvedActionKind: state.pendingActionKind,
        resolvedActionSequence: state.pendingActionSequence,
        resolvedActionState: "accepted"
      })
    });
  }

  const nextPendingActionBufferSecondsRemaining = Math.max(
    0,
    state.pendingActionBufferSecondsRemaining -
      normalizeFiniteNonNegativeSeconds(deltaSeconds)
  );

  if (nextPendingActionBufferSecondsRemaining > 0) {
    return Object.freeze({
      actionConsumed: false,
      state: createMetaverseTraversalActionStateSnapshot({
        pendingActionBufferSecondsRemaining:
          nextPendingActionBufferSecondsRemaining,
        pendingActionKind: state.pendingActionKind,
        pendingActionSequence: state.pendingActionSequence,
        resolvedActionKind: state.resolvedActionKind,
        resolvedActionSequence: state.resolvedActionSequence,
        resolvedActionState: state.resolvedActionState
      })
    });
  }

  return Object.freeze({
    actionConsumed: false,
    state: createMetaverseTraversalActionStateSnapshot({
      pendingActionBufferSecondsRemaining: 0,
      pendingActionKind: "none",
      pendingActionSequence: 0,
      resolvedActionKind: state.pendingActionKind,
      resolvedActionSequence: state.pendingActionSequence,
      resolvedActionState: "rejected-buffer-expired"
    })
  });
}
