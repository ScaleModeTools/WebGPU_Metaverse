import type {
  MetaverseTraversalCapabilityId
} from "./metaverse-traversal-contract.js";
import type {
  MetaverseWorldPlacedSurfaceColliderSnapshot,
  MetaverseWorldPlacedWaterRegionSnapshot,
  MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";
import type {
  MetaverseWorldAutomaticSurfaceLocomotionDebugSnapshot,
  MetaverseWorldSurfacePolicyConfig
} from "./metaverse-world-surface-policy.js";
import {
  resolveMetaverseWorldAutomaticSurfaceLocomotion
} from "./metaverse-world-surface-policy.js";

export type {
  MetaverseTraversalCapabilityId
} from "./metaverse-traversal-contract.js";

export const metaverseTraversalStateResolutionReasonIds = [
  "capability-maintained",
  "capability-transition-blocked",
  "capability-transition-validated"
] as const;

export type MetaverseTraversalStateResolutionReasonId =
  (typeof metaverseTraversalStateResolutionReasonIds)[number];

export interface MetaverseTraversalStateDecision {
  readonly capabilityId: MetaverseTraversalCapabilityId;
  readonly locomotionMode: MetaverseTraversalCapabilityId;
  readonly supportHeightMeters: number | null;
}

export interface MetaverseTraversalStateResolutionDebugSnapshot {
  readonly blockingAffordanceDetected: boolean;
  readonly reason: MetaverseTraversalStateResolutionReasonId;
  readonly resolvedSupportHeightMeters: number;
  readonly supportingAffordanceSampleCount: number;
}

export interface MetaverseTraversalStateResolutionSnapshot {
  readonly debug: MetaverseTraversalStateResolutionDebugSnapshot;
  readonly decision: MetaverseTraversalStateDecision;
}

function resolveTraversalStateResolutionReason(
  currentCapabilityId: MetaverseTraversalCapabilityId,
  automaticSurfaceDebugSnapshot: MetaverseWorldAutomaticSurfaceLocomotionDebugSnapshot,
  resolvedCapabilityId: MetaverseTraversalCapabilityId
): MetaverseTraversalStateResolutionReasonId {
  if (resolvedCapabilityId !== currentCapabilityId) {
    return "capability-transition-validated";
  }

  if (
    currentCapabilityId === "swim" &&
    (automaticSurfaceDebugSnapshot.blockerOverlap ||
      automaticSurfaceDebugSnapshot.stepSupportedProbeCount > 0)
  ) {
    return "capability-transition-blocked";
  }

  return "capability-maintained";
}

export function resolveMetaverseTraversalStateFromWorldAffordances(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  position: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number,
  currentCapabilityId: MetaverseTraversalCapabilityId,
  excludedOwnerEnvironmentAssetId: string | null = null
): MetaverseTraversalStateResolutionSnapshot {
  const automaticSurfaceSnapshot = resolveMetaverseWorldAutomaticSurfaceLocomotion(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position,
    yawRadians,
    currentCapabilityId,
    excludedOwnerEnvironmentAssetId
  );
  const resolvedCapabilityId = automaticSurfaceSnapshot.decision.locomotionMode;
  const resolutionReason = resolveTraversalStateResolutionReason(
    currentCapabilityId,
    automaticSurfaceSnapshot.debug,
    resolvedCapabilityId
  );

  return Object.freeze({
    debug: Object.freeze({
      blockingAffordanceDetected:
        automaticSurfaceSnapshot.debug.blockerOverlap,
      reason: resolutionReason,
      resolvedSupportHeightMeters:
        automaticSurfaceSnapshot.debug.resolvedSupportHeightMeters,
      supportingAffordanceSampleCount:
        automaticSurfaceSnapshot.debug.stepSupportedProbeCount
    }),
    decision: Object.freeze({
      capabilityId: resolvedCapabilityId,
      locomotionMode: resolvedCapabilityId,
      supportHeightMeters: automaticSurfaceSnapshot.decision.supportHeightMeters
    })
  });
}
