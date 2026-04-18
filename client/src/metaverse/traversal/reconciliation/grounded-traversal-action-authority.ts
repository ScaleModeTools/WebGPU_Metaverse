import {
  createMetaverseUnmountedTraversalStateSnapshot,
  hasMetaverseTraversalAuthorityConsumedAction,
  isMetaverseTraversalAuthorityActionPendingOrActive,
  syncMetaverseTraversalActionStateFromAcceptedActionSequence,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

function normalizeTraversalActionSequence(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }

  return Math.floor(rawValue);
}

export function syncPredictedGroundedTraversalActionStateFromAuthoritativeTraversal(
  traversalState: MetaverseUnmountedTraversalStateSnapshot,
  authoritativeTraversalAuthority: MetaverseTraversalAuthoritySnapshot,
  latestIssuedTraversalActionSequence: number
): MetaverseUnmountedTraversalStateSnapshot {
  const normalizedTraversalActionSequence =
    normalizeTraversalActionSequence(latestIssuedTraversalActionSequence);

  if (normalizedTraversalActionSequence <= 0) {
    return traversalState;
  }

  const authoritativeJumpAcceptedOrActive =
    isMetaverseTraversalAuthorityActionPendingOrActive(
      authoritativeTraversalAuthority,
      "jump",
      normalizedTraversalActionSequence
    ) ||
    hasMetaverseTraversalAuthorityConsumedAction(
      authoritativeTraversalAuthority,
      "jump",
      normalizedTraversalActionSequence
    );

  if (!authoritativeJumpAcceptedOrActive) {
    return traversalState;
  }

  const nextActionState =
    syncMetaverseTraversalActionStateFromAcceptedActionSequence(
      traversalState.actionState,
      {
        acceptedActionKind: "jump",
        acceptedActionSequence: normalizedTraversalActionSequence
      }
    );

  if (nextActionState === traversalState.actionState) {
    return traversalState;
  }

  return createMetaverseUnmountedTraversalStateSnapshot({
    actionState: nextActionState,
    locomotionMode: traversalState.locomotionMode
  });
}
