import type {
  MetaverseTraversalActionKindId,
  MetaverseTraversalAuthoritySnapshot,
  MetaverseTraversalAuthoritySnapshotInput,
  MetaverseTraversalJumpAuthorityStateId,
  MetaverseTraversalLocomotionModeId,
  MetaverseTraversalActionResolutionStateId
} from "./metaverse-traversal-contract.js";
import {
  createMetaverseTraversalAuthoritySnapshot
} from "./metaverse-traversal-contract.js";

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

interface TraversalAuthorityJumpSnapshotLike
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

export type MetaverseTraversalAuthorityIssuedJumpResolutionId =
  | "none"
  | "pending-or-active"
  | "accepted"
  | "rejected";

export interface MetaverseTraversalAuthorityIssuedJumpResolutionSnapshot {
  readonly jumpActionSequence: number;
  readonly resolution: MetaverseTraversalAuthorityIssuedJumpResolutionId;
}

export interface MetaverseTraversalAuthorityResolutionInput {
  readonly currentTick: number;
  readonly jumpAuthorityState: MetaverseTraversalJumpAuthorityStateId;
  readonly locomotionMode: MetaverseTraversalLocomotionModeId;
  readonly mounted: boolean;
  readonly pendingActionKind: MetaverseTraversalActionKindId;
  readonly pendingActionSequence: number;
  readonly previousTraversalAuthority?: TraversalAuthoritySnapshotLike | null;
  readonly resolvedActionKind: MetaverseTraversalActionKindId;
  readonly resolvedActionSequence: number;
  readonly resolvedActionState: MetaverseTraversalActionResolutionStateId;
}

function normalizeFiniteNonNegativeInteger(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }

  return Math.floor(rawValue);
}

function jumpActionSequenceMatches(
  currentActionSequence: number,
  jumpActionSequence: number
): boolean {
  const normalizedJumpActionSequence =
    normalizeFiniteNonNegativeInteger(jumpActionSequence);

  return (
    normalizedJumpActionSequence === 0 ||
    normalizeFiniteNonNegativeInteger(currentActionSequence) >=
      normalizedJumpActionSequence
  );
}

export function isMetaverseTraversalAuthorityJumpPendingOrActive(
  traversalAuthority: TraversalAuthorityJumpSnapshotLike,
  jumpActionSequence = 0
): boolean {
  return (
    traversalAuthority.currentActionKind === "jump" &&
    jumpActionSequenceMatches(
      traversalAuthority.currentActionSequence,
      jumpActionSequence
    )
  );
}

export function isMetaverseTraversalAuthorityJumpAirborne(
  traversalAuthority: TraversalAuthorityJumpSnapshotLike,
  jumpActionSequence = 0
): boolean {
  return (
    isMetaverseTraversalAuthorityJumpPendingOrActive(
      traversalAuthority,
      jumpActionSequence
    ) &&
    (traversalAuthority.currentActionPhase === "rising" ||
      traversalAuthority.currentActionPhase === "falling")
  );
}

export function hasMetaverseTraversalAuthorityConsumedJump(
  traversalAuthority: TraversalAuthorityJumpSnapshotLike,
  jumpActionSequence: number
): boolean {
  const normalizedJumpActionSequence =
    normalizeFiniteNonNegativeInteger(jumpActionSequence);

  return (
    normalizedJumpActionSequence > 0 &&
    traversalAuthority.lastConsumedActionKind === "jump" &&
    jumpActionSequenceMatches(
      traversalAuthority.lastConsumedActionSequence,
      normalizedJumpActionSequence
    )
  );
}

export function hasMetaverseTraversalAuthorityRejectedJump(
  traversalAuthority: TraversalAuthorityJumpSnapshotLike,
  jumpActionSequence: number
): boolean {
  const normalizedJumpActionSequence =
    normalizeFiniteNonNegativeInteger(jumpActionSequence);

  return (
    normalizedJumpActionSequence > 0 &&
    traversalAuthority.lastRejectedActionKind === "jump" &&
    jumpActionSequenceMatches(
      traversalAuthority.lastRejectedActionSequence,
      normalizedJumpActionSequence
    )
  );
}

export function readMetaverseTraversalAuthorityLatestJumpActionSequence(
  traversalAuthority: TraversalAuthorityJumpSnapshotLike
): number {
  const currentJumpActionSequence =
    traversalAuthority.currentActionKind === "jump"
      ? normalizeFiniteNonNegativeInteger(
          traversalAuthority.currentActionSequence
        )
      : 0;
  const consumedJumpActionSequence =
    traversalAuthority.lastConsumedActionKind === "jump"
      ? normalizeFiniteNonNegativeInteger(
          traversalAuthority.lastConsumedActionSequence
        )
      : 0;
  const rejectedJumpActionSequence =
    traversalAuthority.lastRejectedActionKind === "jump"
      ? normalizeFiniteNonNegativeInteger(
          traversalAuthority.lastRejectedActionSequence
        )
      : 0;

  return Math.max(
    currentJumpActionSequence,
    consumedJumpActionSequence,
    rejectedJumpActionSequence
  );
}

export function resolveMetaverseTraversalAuthorityIssuedJumpResolution(
  traversalAuthority: TraversalAuthorityJumpSnapshotLike,
  jumpActionSequence: number,
  lastResolvedJumpActionSequence = 0
): MetaverseTraversalAuthorityIssuedJumpResolutionSnapshot {
  const normalizedJumpActionSequence =
    normalizeFiniteNonNegativeInteger(jumpActionSequence);
  const normalizedLastResolvedJumpActionSequence =
    normalizeFiniteNonNegativeInteger(lastResolvedJumpActionSequence);
  const unresolvedJumpActionSequence =
    normalizedJumpActionSequence > normalizedLastResolvedJumpActionSequence
      ? normalizedJumpActionSequence
      : 0;

  if (unresolvedJumpActionSequence <= 0) {
    return {
      jumpActionSequence: 0,
      resolution: "none"
    };
  }

  if (
    isMetaverseTraversalAuthorityJumpPendingOrActive(
      traversalAuthority,
      unresolvedJumpActionSequence
    )
  ) {
    return {
      jumpActionSequence: unresolvedJumpActionSequence,
      resolution: "pending-or-active"
    };
  }

  if (
    hasMetaverseTraversalAuthorityConsumedJump(
      traversalAuthority,
      unresolvedJumpActionSequence
    )
  ) {
    return {
      jumpActionSequence: unresolvedJumpActionSequence,
      resolution: "accepted"
    };
  }

  if (
    hasMetaverseTraversalAuthorityRejectedJump(
      traversalAuthority,
      unresolvedJumpActionSequence
    )
  ) {
    return {
      jumpActionSequence: unresolvedJumpActionSequence,
      resolution: "rejected"
    };
  }

  return {
    jumpActionSequence: unresolvedJumpActionSequence,
    resolution: "none"
  };
}

export function resolveMetaverseTraversalAuthoritySnapshotInput({
  currentTick,
  jumpAuthorityState,
  locomotionMode,
  mounted,
  pendingActionKind,
  pendingActionSequence,
  previousTraversalAuthority = null,
  resolvedActionKind,
  resolvedActionSequence,
  resolvedActionState
}: MetaverseTraversalAuthorityResolutionInput): MetaverseTraversalAuthoritySnapshot {
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
  const previousConsumedJumpActionSequence =
    previousTraversalAuthority?.lastConsumedActionKind === "jump"
      ? normalizeFiniteNonNegativeInteger(
          previousTraversalAuthority.lastConsumedActionSequence
        )
      : 0;
  const previousRejectedJumpActionSequence =
    previousTraversalAuthority?.lastRejectedActionKind === "jump"
      ? normalizeFiniteNonNegativeInteger(
          previousTraversalAuthority.lastRejectedActionSequence
        )
      : 0;
  const previousCurrentJumpActionSequence =
    previousTraversalAuthority?.currentActionKind === "jump"
      ? normalizeFiniteNonNegativeInteger(
          previousTraversalAuthority.currentActionSequence
        )
      : 0;
  const acceptedThisTick =
    normalizedResolvedActionKind === "jump" &&
    resolvedActionState === "accepted" &&
    normalizedResolvedActionSequence > 0;
  const rejectedThisTick =
    normalizedResolvedActionKind === "jump" &&
    resolvedActionState === "rejected-buffer-expired" &&
    normalizedResolvedActionSequence > 0;
  const lastConsumedActionSequence = acceptedThisTick
    ? Math.max(
        previousConsumedJumpActionSequence,
        normalizedResolvedActionSequence
      )
    : previousConsumedJumpActionSequence;
  const lastConsumedActionKind = lastConsumedActionSequence > 0 ? "jump" : "none";
  const lastRejectedActionSequence = rejectedThisTick
    ? Math.max(
        previousRejectedJumpActionSequence,
        normalizedResolvedActionSequence
      )
    : previousRejectedJumpActionSequence;
  const lastRejectedActionKind = lastRejectedActionSequence > 0 ? "jump" : "none";
  const startupBlockedJumpActionSequence = Math.max(
    lastConsumedActionSequence,
    lastRejectedActionSequence
  );
  const startupJumpActionSequence =
    normalizedPendingActionKind === "jump" &&
      normalizedPendingActionSequence > startupBlockedJumpActionSequence
      ? normalizedPendingActionSequence
      : 0;

  let currentActionKind: MetaverseTraversalAuthoritySnapshotInput["currentActionKind"] =
    "none";
  let currentActionPhase: MetaverseTraversalAuthoritySnapshotInput["currentActionPhase"] =
    "idle";
  let currentActionSequence = 0;

  if (canOwnTraversalAction) {
    if (startupJumpActionSequence > 0) {
      currentActionKind = "jump";
      currentActionPhase = "startup";
      currentActionSequence = startupJumpActionSequence;
    } else if (jumpAuthorityState === "rising") {
      currentActionKind = "jump";
      currentActionPhase = "rising";
      currentActionSequence =
        lastConsumedActionSequence > 0
          ? lastConsumedActionSequence
          : previousCurrentJumpActionSequence;
    } else if (jumpAuthorityState === "falling") {
      currentActionKind = "jump";
      currentActionPhase = "falling";
      currentActionSequence =
        lastConsumedActionSequence > 0
          ? lastConsumedActionSequence
          : previousCurrentJumpActionSequence;
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

  const previousLastRejectedActionKind =
    previousTraversalAuthority?.lastRejectedActionKind ?? "none";
  const previousLastRejectedActionReason =
    previousTraversalAuthority?.lastRejectedActionReason ?? "none";
  const previousLastRejectedActionSequence = normalizeFiniteNonNegativeInteger(
    previousTraversalAuthority?.lastRejectedActionSequence ?? 0
  );
  const lastRejectedActionKindResolved = rejectedThisTick
    ? "jump"
    : previousLastRejectedActionKind;
  const lastRejectedActionReason = rejectedThisTick
    ? "buffer-expired"
    : previousLastRejectedActionReason;
  const lastRejectedActionSequenceResolved = rejectedThisTick
    ? normalizedResolvedActionSequence
    : previousLastRejectedActionSequence;

  return createMetaverseTraversalAuthoritySnapshot({
    currentActionKind,
    currentActionPhase,
    currentActionSequence,
    lastConsumedActionKind,
    lastConsumedActionSequence,
    lastRejectedActionKind:
      lastRejectedActionKindResolved === "none" ? "none" : lastRejectedActionKind,
    lastRejectedActionReason,
    lastRejectedActionSequence:
      lastRejectedActionKindResolved === "none"
        ? 0
        : lastRejectedActionSequenceResolved,
    phaseStartedAtTick
  });
}
