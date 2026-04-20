import type {
  MetaverseTraversalActiveActionSnapshot,
  MetaverseTraversalActionKindId,
  MetaverseTraversalAuthoritySnapshot,
  MetaverseTraversalAuthoritySnapshotInput,
  MetaverseTraversalLocomotionModeId,
  MetaverseTraversalActionResolutionStateId
} from "./metaverse-traversal-contract.js";
import {
  createMetaverseTraversalActiveActionSnapshot,
  createMetaverseTraversalAuthoritySnapshot
} from "./metaverse-traversal-contract.js";
import {
  resolveMetaverseGroundedJumpBodyTraversalActionSnapshot
} from "./metaverse-grounded-jump-physics.js";
import type {
  MetaverseTraversalActionStateSnapshot
} from "./metaverse-traversal-action-kernel.js";
import {
  createMetaverseTraversalActionStateSnapshot,
  syncMetaverseTraversalActionStateFromAcceptedActionSequence
} from "./metaverse-traversal-action-kernel.js";

interface TraversalAuthoritySnapshotLike
  extends Pick<
    MetaverseTraversalAuthoritySnapshot,
    | "currentActionKind"
    | "currentActionPhase"
    | "currentActionSequence"
    | "lastConsumedActionKind"
    | "lastConsumedActionSequence"
    | "lastRejectedActionKind"
    | "lastRejectedActionReason"
    | "lastRejectedActionSequence"
    | "phaseStartedAtTick"
  > {}

interface TraversalAuthorityActionSnapshotLike
  extends Pick<
    MetaverseTraversalAuthoritySnapshot,
    | "currentActionKind"
    | "currentActionPhase"
    | "currentActionSequence"
    | "lastConsumedActionKind"
    | "lastConsumedActionSequence"
    | "lastRejectedActionKind"
    | "lastRejectedActionSequence"
  > {}

export type MetaverseTraversalAuthorityIssuedActionResolutionId =
  | "none"
  | "pending-or-active"
  | "accepted"
  | "rejected";

export interface MetaverseTraversalAuthorityIssuedActionResolutionSnapshot {
  readonly actionSequence: number;
  readonly resolution: MetaverseTraversalAuthorityIssuedActionResolutionId;
}

export interface MetaverseTraversalAuthorityResolutionInput {
  readonly activeAction: Pick<MetaverseTraversalActiveActionSnapshot, "kind" | "phase">;
  readonly currentTick: number;
  readonly locomotionMode: MetaverseTraversalLocomotionModeId;
  readonly mounted: boolean;
  readonly pendingActionKind: MetaverseTraversalActionKindId;
  readonly pendingActionSequence: number;
  readonly previousTraversalAuthority?: TraversalAuthoritySnapshotLike | null;
  readonly resolvedActionKind: MetaverseTraversalActionKindId;
  readonly resolvedActionSequence: number;
  readonly resolvedActionState: MetaverseTraversalActionResolutionStateId;
}

export interface ResolveMetaverseTraversalAuthoritySnapshotForActionStateInput {
  readonly activeAction: Pick<MetaverseTraversalActiveActionSnapshot, "kind" | "phase">;
  readonly actionState: Pick<
    MetaverseTraversalActionStateSnapshot,
    | "pendingActionKind"
    | "pendingActionSequence"
    | "resolvedActionKind"
    | "resolvedActionSequence"
    | "resolvedActionState"
  >;
  readonly currentTick: number;
  readonly locomotionMode: MetaverseTraversalLocomotionModeId;
  readonly mounted: boolean;
  readonly previousTraversalAuthority?: TraversalAuthoritySnapshotLike | null;
}

export interface ResolveMetaverseTraversalAuthoritySnapshotForIssuedActionInput {
  readonly activeAction: Pick<MetaverseTraversalActiveActionSnapshot, "kind" | "phase">;
  readonly actionState: Pick<
    MetaverseTraversalActionStateSnapshot,
    | "pendingActionKind"
    | "pendingActionSequence"
    | "resolvedActionKind"
    | "resolvedActionSequence"
    | "resolvedActionState"
  >;
  readonly currentTick: number;
  readonly issuedActionKind: MetaverseTraversalActionKindId;
  readonly issuedActionSequence: number;
  readonly locomotionMode: MetaverseTraversalLocomotionModeId;
  readonly mounted: boolean;
  readonly previousTraversalAuthority: MetaverseTraversalAuthoritySnapshot;
}

export interface HasMetaverseTraversalAuthorityLocallyPredictedIssuedActionInput
  extends ResolveMetaverseTraversalAuthoritySnapshotForIssuedActionInput {}

export interface MetaverseTraversalKinematicActionInput {
  readonly grounded: boolean;
  readonly locomotionMode: MetaverseTraversalLocomotionModeId;
  readonly mounted: boolean;
  readonly verticalSpeedUnitsPerSecond: number;
}

export interface MetaverseTraversalAuthorityGroundedLocomotionInput {
  readonly locomotionMode: MetaverseTraversalLocomotionModeId;
  readonly mounted: boolean;
  readonly traversalAuthority: TraversalAuthorityActionSnapshotLike;
}

function normalizeFiniteNonNegativeInteger(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }

  return Math.floor(rawValue);
}

function actionSequenceMatches(
  currentActionSequence: number,
  actionSequence: number
): boolean {
  const normalizedActionSequence =
    normalizeFiniteNonNegativeInteger(actionSequence);

  return (
    normalizedActionSequence === 0 ||
    normalizeFiniteNonNegativeInteger(currentActionSequence) >=
      normalizedActionSequence
  );
}

export function resolveMetaverseTraversalKinematicActionSnapshot({
  grounded,
  locomotionMode,
  mounted,
  verticalSpeedUnitsPerSecond
}: MetaverseTraversalKinematicActionInput): MetaverseTraversalActiveActionSnapshot {
  if (mounted || locomotionMode !== "grounded") {
    return createMetaverseTraversalActiveActionSnapshot();
  }

  return resolveMetaverseGroundedJumpBodyTraversalActionSnapshot({
    grounded,
    verticalSpeedUnitsPerSecond
  });
}

export function isMetaverseTraversalAuthorityActionPendingOrActive(
  traversalAuthority: TraversalAuthorityActionSnapshotLike,
  actionKind: MetaverseTraversalActionKindId,
  actionSequence = 0
): boolean {
  return (
    actionKind !== "none" &&
    traversalAuthority.currentActionKind === actionKind &&
    actionSequenceMatches(
      traversalAuthority.currentActionSequence,
      actionSequence
    )
  );
}

export function isMetaverseTraversalAuthorityActionAirborne(
  traversalAuthority: TraversalAuthorityActionSnapshotLike,
  actionKind: MetaverseTraversalActionKindId,
  actionSequence = 0
): boolean {
  return (
    isMetaverseTraversalAuthorityActionPendingOrActive(
      traversalAuthority,
      actionKind,
      actionSequence
    ) &&
    (traversalAuthority.currentActionPhase === "rising" ||
      traversalAuthority.currentActionPhase === "falling")
  );
}

export function isMetaverseTraversalAuthorityGroundedLocomotion({
  locomotionMode,
  mounted,
  traversalAuthority
}: MetaverseTraversalAuthorityGroundedLocomotionInput): boolean {
  return (
    !mounted &&
    locomotionMode === "grounded" &&
    traversalAuthority.currentActionPhase !== "rising" &&
    traversalAuthority.currentActionPhase !== "falling"
  );
}

export function hasMetaverseTraversalAuthorityConsumedAction(
  traversalAuthority: TraversalAuthorityActionSnapshotLike,
  actionKind: MetaverseTraversalActionKindId,
  actionSequence: number
): boolean {
  const normalizedActionSequence =
    normalizeFiniteNonNegativeInteger(actionSequence);

  return (
    actionKind !== "none" &&
    normalizedActionSequence > 0 &&
    traversalAuthority.lastConsumedActionKind === actionKind &&
    actionSequenceMatches(
      traversalAuthority.lastConsumedActionSequence,
      normalizedActionSequence
    )
  );
}

export function hasMetaverseTraversalAuthorityRejectedAction(
  traversalAuthority: TraversalAuthorityActionSnapshotLike,
  actionKind: MetaverseTraversalActionKindId,
  actionSequence: number
): boolean {
  const normalizedActionSequence =
    normalizeFiniteNonNegativeInteger(actionSequence);

  return (
    actionKind !== "none" &&
    normalizedActionSequence > 0 &&
    traversalAuthority.lastRejectedActionKind === actionKind &&
    actionSequenceMatches(
      traversalAuthority.lastRejectedActionSequence,
      normalizedActionSequence
    )
  );
}

export function readMetaverseTraversalAuthorityLatestActionSequence(
  traversalAuthority: TraversalAuthorityActionSnapshotLike,
  actionKind: MetaverseTraversalActionKindId
): number {
  if (actionKind === "none") {
    return 0;
  }

  const currentActionSequence =
    traversalAuthority.currentActionKind === actionKind
      ? normalizeFiniteNonNegativeInteger(
          traversalAuthority.currentActionSequence
        )
      : 0;
  const consumedActionSequence =
    traversalAuthority.lastConsumedActionKind === actionKind
      ? normalizeFiniteNonNegativeInteger(
          traversalAuthority.lastConsumedActionSequence
        )
      : 0;
  const rejectedActionSequence =
    traversalAuthority.lastRejectedActionKind === actionKind
      ? normalizeFiniteNonNegativeInteger(
          traversalAuthority.lastRejectedActionSequence
        )
      : 0;

  return Math.max(
    currentActionSequence,
    consumedActionSequence,
    rejectedActionSequence
  );
}

export function resolveMetaverseTraversalAuthorityIssuedActionResolution(
  traversalAuthority: TraversalAuthorityActionSnapshotLike,
  actionKind: MetaverseTraversalActionKindId,
  actionSequence: number,
  lastResolvedActionSequence = 0
): MetaverseTraversalAuthorityIssuedActionResolutionSnapshot {
  const normalizedActionSequence =
    normalizeFiniteNonNegativeInteger(actionSequence);
  const normalizedLastResolvedActionSequence =
    normalizeFiniteNonNegativeInteger(lastResolvedActionSequence);
  const unresolvedActionSequence =
    normalizedActionSequence > normalizedLastResolvedActionSequence
      ? normalizedActionSequence
      : 0;

  if (actionKind === "none" || unresolvedActionSequence <= 0) {
    return {
      actionSequence: 0,
      resolution: "none"
    };
  }

  if (
    isMetaverseTraversalAuthorityActionPendingOrActive(
      traversalAuthority,
      actionKind,
      unresolvedActionSequence
    )
  ) {
    return {
      actionSequence: unresolvedActionSequence,
      resolution: "pending-or-active"
    };
  }

  if (
    hasMetaverseTraversalAuthorityConsumedAction(
      traversalAuthority,
      actionKind,
      unresolvedActionSequence
    )
  ) {
    return {
      actionSequence: unresolvedActionSequence,
      resolution: "accepted"
    };
  }

  if (
    hasMetaverseTraversalAuthorityRejectedAction(
      traversalAuthority,
      actionKind,
      unresolvedActionSequence
    )
  ) {
    return {
      actionSequence: unresolvedActionSequence,
      resolution: "rejected"
    };
  }

  return {
    actionSequence: unresolvedActionSequence,
    resolution: "none"
  };
}

export function resolveMetaverseTraversalAuthoritySnapshotInput({
  activeAction,
  currentTick,
  locomotionMode,
  mounted,
  pendingActionKind,
  pendingActionSequence,
  previousTraversalAuthority = null,
  resolvedActionKind,
  resolvedActionSequence,
  resolvedActionState
}: MetaverseTraversalAuthorityResolutionInput): MetaverseTraversalAuthoritySnapshot {
  const normalizedActiveAction =
    createMetaverseTraversalActiveActionSnapshot(activeAction);
  const normalizedCurrentTick = normalizeFiniteNonNegativeInteger(currentTick);
  const normalizedPendingActionSequence =
    normalizeFiniteNonNegativeInteger(pendingActionSequence);
  const normalizedResolvedActionSequence =
    normalizeFiniteNonNegativeInteger(resolvedActionSequence);
  const normalizedPendingActionKind =
    normalizedPendingActionSequence > 0 ? pendingActionKind : "none";
  const normalizedResolvedActionKind =
    normalizedResolvedActionSequence > 0 ? resolvedActionKind : "none";
  const canOwnTraversalAction = !mounted && locomotionMode === "grounded";
  const previousLastConsumedActionKind =
    previousTraversalAuthority?.lastConsumedActionKind ?? "none";
  const previousLastConsumedActionSequence =
    normalizeFiniteNonNegativeInteger(
      previousTraversalAuthority?.lastConsumedActionSequence ?? 0
    );
  const previousLastRejectedActionKind =
    previousTraversalAuthority?.lastRejectedActionKind ?? "none";
  const previousLastRejectedActionReason =
    previousTraversalAuthority?.lastRejectedActionReason ?? "none";
  const previousLastRejectedActionSequence =
    normalizeFiniteNonNegativeInteger(
      previousTraversalAuthority?.lastRejectedActionSequence ?? 0
    );
  const acceptedThisTick =
    normalizedResolvedActionKind !== "none" &&
    resolvedActionState === "accepted" &&
    normalizedResolvedActionSequence > 0;
  const rejectedThisTick =
    normalizedResolvedActionKind !== "none" &&
    resolvedActionState === "rejected-buffer-expired" &&
    normalizedResolvedActionSequence > 0;
  const previousConsumedResolvedActionSequence =
    previousLastConsumedActionKind === normalizedResolvedActionKind
      ? previousLastConsumedActionSequence
      : 0;
  const previousRejectedResolvedActionSequence =
    previousLastRejectedActionKind === normalizedResolvedActionKind
      ? previousLastRejectedActionSequence
      : 0;
  const lastConsumedActionKind = acceptedThisTick
    ? normalizedResolvedActionKind
    : previousLastConsumedActionKind;
  const lastConsumedActionSequence = acceptedThisTick
    ? Math.max(
        previousConsumedResolvedActionSequence,
        normalizedResolvedActionSequence
      )
    : previousLastConsumedActionSequence;
  const lastRejectedActionKind = rejectedThisTick
    ? normalizedResolvedActionKind
    : previousLastRejectedActionKind;
  const lastRejectedActionReason = rejectedThisTick
    ? "buffer-expired"
    : previousLastRejectedActionReason;
  const lastRejectedActionSequence = rejectedThisTick
    ? Math.max(
        previousRejectedResolvedActionSequence,
        normalizedResolvedActionSequence
      )
    : previousLastRejectedActionSequence;
  const startupBlockedActionSequence = Math.max(
    lastConsumedActionKind === normalizedPendingActionKind
      ? lastConsumedActionSequence
      : 0,
    lastRejectedActionKind === normalizedPendingActionKind
      ? lastRejectedActionSequence
      : 0
  );
  const startupActionSequence =
    normalizedPendingActionKind !== "none" &&
      normalizedPendingActionSequence > startupBlockedActionSequence
      ? normalizedPendingActionSequence
      : 0;
  const currentResolvedActionSequence =
    normalizedActiveAction.kind === "none"
      ? 0
      : lastConsumedActionKind === normalizedActiveAction.kind
        ? lastConsumedActionSequence
        : 0;
  const previousCurrentResolvedActionSequence =
    previousTraversalAuthority?.currentActionKind === normalizedActiveAction.kind
      ? normalizeFiniteNonNegativeInteger(
          previousTraversalAuthority.currentActionSequence
        )
      : 0;

  let currentActionKind: MetaverseTraversalAuthoritySnapshotInput["currentActionKind"] =
    "none";
  let currentActionPhase: MetaverseTraversalAuthoritySnapshotInput["currentActionPhase"] =
    "idle";
  let currentActionSequence = 0;

  if (canOwnTraversalAction) {
    if (
      normalizedActiveAction.kind !== "none" &&
      normalizedActiveAction.phase !== "idle"
    ) {
      currentActionKind = normalizedActiveAction.kind;
      currentActionPhase = normalizedActiveAction.phase;
      currentActionSequence =
        currentResolvedActionSequence > 0
          ? currentResolvedActionSequence
          : previousCurrentResolvedActionSequence;
    } else if (startupActionSequence > 0) {
      currentActionKind = normalizedPendingActionKind;
      currentActionPhase = "startup";
      currentActionSequence = startupActionSequence;
    }
  }

  const phaseStartedAtTick =
    currentActionKind === "none"
      ? 0
      : previousTraversalAuthority !== null &&
          previousTraversalAuthority.currentActionKind === currentActionKind &&
          previousTraversalAuthority.currentActionPhase === currentActionPhase &&
          previousTraversalAuthority.currentActionSequence ===
            currentActionSequence
        ? normalizeFiniteNonNegativeInteger(
            previousTraversalAuthority.phaseStartedAtTick
          )
        : normalizedCurrentTick;

  return createMetaverseTraversalAuthoritySnapshot({
    currentActionKind,
    currentActionPhase,
    currentActionSequence,
    lastConsumedActionKind,
    lastConsumedActionSequence,
    lastRejectedActionKind,
    lastRejectedActionReason,
    lastRejectedActionSequence,
    phaseStartedAtTick
  });
}

export function resolveMetaverseTraversalAuthoritySnapshotForActionState({
  activeAction,
  actionState,
  currentTick,
  locomotionMode,
  mounted,
  previousTraversalAuthority = null
}: ResolveMetaverseTraversalAuthoritySnapshotForActionStateInput): MetaverseTraversalAuthoritySnapshot {
  return resolveMetaverseTraversalAuthoritySnapshotInput({
    activeAction,
    currentTick,
    locomotionMode,
    mounted,
    pendingActionKind: actionState.pendingActionKind,
    pendingActionSequence: actionState.pendingActionSequence,
    previousTraversalAuthority,
    resolvedActionKind: actionState.resolvedActionKind,
    resolvedActionSequence: actionState.resolvedActionSequence,
    resolvedActionState: actionState.resolvedActionState
  });
}

export function resolveMetaverseTraversalAuthoritySnapshotForIssuedAction({
  activeAction,
  actionState,
  currentTick,
  issuedActionKind,
  issuedActionSequence,
  locomotionMode,
  mounted,
  previousTraversalAuthority
}: ResolveMetaverseTraversalAuthoritySnapshotForIssuedActionInput): MetaverseTraversalAuthoritySnapshot {
  const normalizedIssuedActionSequence =
    normalizeFiniteNonNegativeInteger(issuedActionSequence);
  const normalizedIssuedActionKind =
    normalizedIssuedActionSequence > 0 ? issuedActionKind : "none";

  if (normalizedIssuedActionKind === "none") {
    return previousTraversalAuthority;
  }

  const normalizedActiveAction =
    createMetaverseTraversalActiveActionSnapshot(activeAction);
  const issuedActionResolution =
    resolveMetaverseTraversalAuthorityIssuedActionResolution(
      previousTraversalAuthority,
      normalizedIssuedActionKind,
      normalizedIssuedActionSequence
    );
  const activeIssuedAction =
    normalizedActiveAction.kind === normalizedIssuedActionKind &&
    normalizedActiveAction.phase !== "idle";

  if (
    issuedActionResolution.resolution === "pending-or-active" ||
    (issuedActionResolution.resolution === "accepted" && !activeIssuedAction)
  ) {
    return previousTraversalAuthority;
  }

  const normalizedActionState =
    createMetaverseTraversalActionStateSnapshot(actionState);
  const nextActionState =
    activeIssuedAction
      ? syncMetaverseTraversalActionStateFromAcceptedActionSequence(
          normalizedActionState,
          {
            acceptedActionKind: normalizedIssuedActionKind,
            acceptedActionSequence: normalizedIssuedActionSequence
          }
        )
      : normalizedActionState;

  return resolveMetaverseTraversalAuthoritySnapshotForActionState({
    activeAction: normalizedActiveAction,
    actionState: nextActionState,
    currentTick,
    locomotionMode,
    mounted,
    previousTraversalAuthority
  });
}

export function hasMetaverseTraversalAuthorityLocallyPredictedIssuedAction({
  activeAction,
  actionState,
  currentTick,
  issuedActionKind,
  issuedActionSequence,
  locomotionMode,
  mounted,
  previousTraversalAuthority
}: HasMetaverseTraversalAuthorityLocallyPredictedIssuedActionInput): boolean {
  const normalizedActiveAction =
    createMetaverseTraversalActiveActionSnapshot(activeAction);
  const traversalAuthorityForIssuedAction =
    resolveMetaverseTraversalAuthoritySnapshotForIssuedAction({
      activeAction: normalizedActiveAction,
      actionState,
      currentTick,
      issuedActionKind,
      issuedActionSequence,
      locomotionMode,
      mounted,
      previousTraversalAuthority
    });
  const issuedActionResolution =
    resolveMetaverseTraversalAuthorityIssuedActionResolution(
      traversalAuthorityForIssuedAction,
      issuedActionKind,
      issuedActionSequence
    ).resolution;

  return (
    issuedActionResolution === "pending-or-active" ||
    (issuedActionResolution === "accepted" &&
      normalizedActiveAction.kind === issuedActionKind &&
      normalizedActiveAction.phase !== "idle")
  );
}
