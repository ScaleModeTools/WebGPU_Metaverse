import type {
  MetaverseTraversalBodyControlSnapshot
} from "./metaverse-traversal-contract.js";
import {
  isMetaverseGroundedTraversalSurfaceJumpSupported,
  stepMetaverseGroundedTraversalAction,
  type MetaverseGroundedTraversalBodyIntentSnapshot
} from "./metaverse-grounded-traversal-kernel.js";
import {
  advanceMetaverseTraversalActionState,
  clearMetaverseTraversalPendingActions,
  createMetaverseTraversalActionStateSnapshot,
  queueMetaverseTraversalAction,
  type QueueMetaverseTraversalActionInput,
  type MetaverseTraversalActionStateSnapshot
} from "./metaverse-traversal-action-kernel.js";
import type {
  MetaverseWorldPlacedSurfaceColliderSnapshot,
  MetaverseWorldPlacedWaterRegionSnapshot,
  MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";
import {
  resolveMetaverseWorldWaterSurfaceHeightMeters
} from "./metaverse-world-surface-query.js";
import type {
  MetaverseWorldAutomaticSurfaceLocomotionSnapshot,
  MetaverseWorldSurfaceLocomotionDecision,
  MetaverseWorldSurfacePolicyConfig
} from "./metaverse-world-surface-policy.js";
import {
  metaverseWorldAutomaticSurfaceWaterlineThresholdMeters,
  resolveMetaverseWorldAutomaticSurfaceLocomotion,
  resolveMetaverseWorldGroundedAutostepHeightMeters,
  resolveMetaverseWorldSurfaceHeightMeters
} from "./metaverse-world-surface-policy.js";
import {
  clamp,
  toFiniteNumber,
  wrapRadians
} from "./metaverse-surface-traversal-simulation.js";

export interface MetaverseUnmountedGroundedBodySnapshot {
  readonly grounded: boolean;
  readonly jumpReady: boolean;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseUnmountedSwimBodySnapshot {
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseUnmountedGroundedJumpSupportSnapshot {
  readonly groundedJumpSupported: boolean;
  readonly supportHeightMeters: number | null;
  readonly surfaceJumpSupported: boolean;
}

export interface MetaverseUnmountedGroundedTraversalConfigSnapshot {
  readonly controllerOffsetMeters: number;
  readonly maxTurnSpeedRadiansPerSecond: number;
  readonly snapToGroundDistanceMeters: number;
}

export interface MetaverseUnmountedTraversalStateSnapshot {
  readonly actionState: MetaverseTraversalActionStateSnapshot;
  readonly locomotionMode: "grounded" | "swim";
}

export function createMetaverseUnmountedTraversalStateSnapshot(
  input: Partial<MetaverseUnmountedTraversalStateSnapshot> = {}
): MetaverseUnmountedTraversalStateSnapshot {
  return Object.freeze({
    actionState: createMetaverseTraversalActionStateSnapshot(
      input.actionState ?? {}
    ),
    locomotionMode: input.locomotionMode === "swim" ? "swim" : "grounded"
  });
}

export function queueMetaverseUnmountedTraversalAction(
  traversalState: MetaverseUnmountedTraversalStateSnapshot,
  input: QueueMetaverseTraversalActionInput
): MetaverseUnmountedTraversalStateSnapshot {
  return Object.freeze({
    actionState: queueMetaverseTraversalAction(
      traversalState.actionState,
      input
    ),
    locomotionMode: traversalState.locomotionMode
  });
}

export function clearMetaverseUnmountedTraversalPendingActions(
  traversalState: MetaverseUnmountedTraversalStateSnapshot
): MetaverseUnmountedTraversalStateSnapshot {
  return Object.freeze({
    actionState: clearMetaverseTraversalPendingActions(
      traversalState.actionState
    ),
    locomotionMode: traversalState.locomotionMode
  });
}

export interface PrepareMetaverseUnmountedTraversalStepInput {
  readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
  readonly deltaSeconds: number;
  readonly groundedBodyConfig: MetaverseUnmountedGroundedTraversalConfigSnapshot;
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot | null;
  readonly jumpSupportVerticalSpeedTolerance: number;
  readonly preferredLookYawRadians?: number | null;
  readonly surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly surfacePolicyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly swimBodySnapshot: MetaverseUnmountedSwimBodySnapshot | null;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readonly excludedOwnerEnvironmentAssetId?: string | null;
}

export interface MetaversePreparedUnmountedGroundedTraversalStepSnapshot {
  readonly autostepHeightMeters: number | null;
  readonly bodyIntent: MetaverseGroundedTraversalBodyIntentSnapshot;
  readonly groundedJumpSupported: boolean;
  readonly jumpRequested: boolean;
  readonly locomotionMode: "grounded";
  readonly surfaceJumpSupported: boolean;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
}

export interface MetaversePreparedUnmountedSwimTraversalStepSnapshot {
  readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
  readonly locomotionMode: "swim";
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly waterlineHeightMeters: number;
}

export type MetaversePreparedUnmountedTraversalStepSnapshot =
  | MetaversePreparedUnmountedGroundedTraversalStepSnapshot
  | MetaversePreparedUnmountedSwimTraversalStepSnapshot;

export interface ResolveMetaverseUnmountedTraversalStepInput {
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot | null;
  readonly preparedTraversalStep: MetaversePreparedUnmountedTraversalStepSnapshot;
  readonly surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly surfacePolicyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly swimBodySnapshot: MetaverseUnmountedSwimBodySnapshot | null;
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readonly excludedOwnerEnvironmentAssetId?: string | null;
}

export interface ResolveMetaverseUnmountedTraversalStepSnapshot {
  readonly automaticSurfaceSnapshot: MetaverseWorldAutomaticSurfaceLocomotionSnapshot;
  readonly grounded: boolean;
  readonly locomotionMode: "grounded" | "swim";
  readonly supportHeightMeters: number | null;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly waterlineHeightMeters: number;
}

interface PrepareMetaverseUnmountedGroundedTraversalStepInput {
  readonly actionState: MetaverseTraversalActionStateSnapshot;
  readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
  readonly deltaSeconds: number;
  readonly groundedBodyConfig: MetaverseUnmountedGroundedTraversalConfigSnapshot;
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot;
  readonly jumpSupportVerticalSpeedTolerance: number;
  readonly preferredLookYawRadians?: number | null;
  readonly surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly surfacePolicyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readonly excludedOwnerEnvironmentAssetId?: string | null;
}

interface PrepareMetaverseUnmountedGroundedTraversalStepResult {
  readonly actionState: MetaverseTraversalActionStateSnapshot;
  readonly autostepHeightMeters: number | null;
  readonly bodyIntent: MetaverseGroundedTraversalBodyIntentSnapshot;
  readonly groundedJumpSupported: boolean;
  readonly jumpRequested: boolean;
  readonly surfaceJumpSupported: boolean;
}

interface ResolveMetaverseUnmountedGroundedTraversalOutcomeInput {
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot;
  readonly surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly surfacePolicyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readonly excludedOwnerEnvironmentAssetId?: string | null;
}

interface ResolveMetaverseUnmountedGroundedTraversalOutcomeSnapshot {
  readonly automaticSurfaceSnapshot: MetaverseWorldAutomaticSurfaceLocomotionSnapshot;
  readonly grounded: boolean;
  readonly locomotionMode: "grounded" | "swim";
  readonly supportHeightMeters: number | null;
  readonly waterlineHeightMeters: number;
}

interface ResolveMetaverseUnmountedSwimTraversalOutcomeInput {
  readonly surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly surfacePolicyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly swimBodySnapshot: MetaverseUnmountedSwimBodySnapshot;
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readonly excludedOwnerEnvironmentAssetId?: string | null;
}

interface ResolveMetaverseUnmountedSwimTraversalOutcomeSnapshot {
  readonly automaticSurfaceSnapshot: MetaverseWorldAutomaticSurfaceLocomotionSnapshot;
  readonly grounded: boolean;
  readonly locomotionMode: "grounded" | "swim";
  readonly supportHeightMeters: number | null;
  readonly waterlineHeightMeters: number;
}

function resolveAutomaticSurfaceSnapshot(
  surfacePolicyConfig: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  position: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number,
  currentLocomotionMode: "grounded" | "swim",
  excludedOwnerEnvironmentAssetId: string | null
): MetaverseWorldAutomaticSurfaceLocomotionSnapshot {
  return resolveMetaverseWorldAutomaticSurfaceLocomotion(
    surfacePolicyConfig,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position,
    yawRadians,
    currentLocomotionMode,
    excludedOwnerEnvironmentAssetId
  );
}

export function resolveMetaverseTraversalWaterlineHeightMeters(
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  position: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "y" | "z">,
  paddingMeters = 0
): number {
  return (
    resolveMetaverseWorldWaterSurfaceHeightMeters(
      waterRegionSnapshots,
      position.x,
      position.z,
      paddingMeters
    ) ?? toFiniteNumber(position.y, 0)
  );
}

export function resolveMetaverseUnmountedGroundedJumpSupport({
  controllerOffsetMeters,
  groundedBodySnapshot,
  jumpSupportVerticalSpeedTolerance,
  snapToGroundDistanceMeters,
  surfaceColliderSnapshots,
  surfacePolicyConfig,
  waterRegionSnapshots,
  excludedOwnerEnvironmentAssetId = null
}: {
  readonly controllerOffsetMeters: number;
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot;
  readonly jumpSupportVerticalSpeedTolerance: number;
  readonly snapToGroundDistanceMeters: number;
  readonly surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly surfacePolicyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readonly excludedOwnerEnvironmentAssetId?: string | null;
}): MetaverseUnmountedGroundedJumpSupportSnapshot {
  const supportHeightMeters = resolveMetaverseWorldSurfaceHeightMeters(
    surfacePolicyConfig,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    groundedBodySnapshot.position.x,
    groundedBodySnapshot.position.z,
    excludedOwnerEnvironmentAssetId
  );
  const surfaceJumpSupported = isMetaverseGroundedTraversalSurfaceJumpSupported(
    {
      controllerOffsetMeters,
      positionY: groundedBodySnapshot.position.y,
      snapToGroundDistanceMeters,
      supportHeightMeters,
      verticalSpeedTolerance: jumpSupportVerticalSpeedTolerance,
      verticalSpeedUnitsPerSecond:
        groundedBodySnapshot.verticalSpeedUnitsPerSecond
    }
  );

  return Object.freeze({
    groundedJumpSupported:
      groundedBodySnapshot.jumpReady === true || surfaceJumpSupported === true,
    supportHeightMeters,
    surfaceJumpSupported
  });
}

function resolveMetaverseUnmountedGroundedAutostepProbeYawRadians(
  groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot,
  bodyControl: MetaverseTraversalBodyControlSnapshot,
  groundedBodyConfig: MetaverseUnmountedGroundedTraversalConfigSnapshot,
  deltaSeconds: number,
  preferredLookYawRadians: number | null
): number {
  if (preferredLookYawRadians !== null) {
    return wrapRadians(preferredLookYawRadians);
  }

  return wrapRadians(
    groundedBodySnapshot.yawRadians +
      clamp(toFiniteNumber(bodyControl.turnAxis, 0), -1, 1) *
        groundedBodyConfig.maxTurnSpeedRadiansPerSecond *
        Math.max(0, toFiniteNumber(deltaSeconds, 0))
  );
}

function prepareMetaverseUnmountedGroundedTraversalStep({
  actionState,
  bodyControl,
  deltaSeconds,
  groundedBodySnapshot,
  groundedBodyConfig,
  jumpSupportVerticalSpeedTolerance,
  preferredLookYawRadians,
  surfaceColliderSnapshots,
  surfacePolicyConfig,
  waterRegionSnapshots,
  excludedOwnerEnvironmentAssetId = null
}: Omit<
  PrepareMetaverseUnmountedGroundedTraversalStepInput,
  "swimBodySnapshot" | "traversalState"
> & {
  readonly actionState: MetaverseTraversalActionStateSnapshot;
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot;
}): PrepareMetaverseUnmountedGroundedTraversalStepResult {
  const groundedJumpSupport = resolveMetaverseUnmountedGroundedJumpSupport({
    controllerOffsetMeters: groundedBodyConfig.controllerOffsetMeters,
    groundedBodySnapshot,
    jumpSupportVerticalSpeedTolerance,
    snapToGroundDistanceMeters:
      groundedBodyConfig.snapToGroundDistanceMeters,
    surfaceColliderSnapshots,
    surfacePolicyConfig,
    waterRegionSnapshots,
    excludedOwnerEnvironmentAssetId
  });
  const waterlineHeightMeters = resolveMetaverseTraversalWaterlineHeightMeters(
    waterRegionSnapshots,
    groundedBodySnapshot.position
  );
  const currentDirectSupportKeepsGrounded =
    groundedJumpSupport.supportHeightMeters !== null &&
    groundedJumpSupport.supportHeightMeters >
      waterlineHeightMeters +
        metaverseWorldAutomaticSurfaceWaterlineThresholdMeters;
  const traversalActionStep = stepMetaverseGroundedTraversalAction({
    actionState,
    bodyControl,
    deltaSeconds,
    groundedBodyJumpReady: groundedBodySnapshot.jumpReady,
    surfaceJumpSupported: groundedJumpSupport.surfaceJumpSupported
  });

  return Object.freeze({
    actionState: traversalActionStep.actionState,
    autostepHeightMeters: resolveMetaverseWorldGroundedAutostepHeightMeters(
      surfacePolicyConfig,
      surfaceColliderSnapshots,
      groundedBodySnapshot.position,
      resolveMetaverseUnmountedGroundedAutostepProbeYawRadians(
        groundedBodySnapshot,
        bodyControl,
        groundedBodyConfig,
        deltaSeconds,
        preferredLookYawRadians ?? null
      ),
      bodyControl.moveAxis,
      bodyControl.strafeAxis,
      groundedBodySnapshot.verticalSpeedUnitsPerSecond,
      traversalActionStep.jumpRequested,
      excludedOwnerEnvironmentAssetId
    ),
    bodyIntent: Object.freeze({
      ...traversalActionStep.bodyIntent,
      snapToGroundOverrideEnabled: currentDirectSupportKeepsGrounded
    }),
    groundedJumpSupported: groundedJumpSupport.groundedJumpSupported,
    jumpRequested: traversalActionStep.jumpRequested,
    surfaceJumpSupported: groundedJumpSupport.surfaceJumpSupported
  });
}

function resolveMetaverseUnmountedGroundedTraversalOutcome({
  groundedBodySnapshot,
  surfaceColliderSnapshots,
  surfacePolicyConfig,
  waterRegionSnapshots,
  excludedOwnerEnvironmentAssetId = null
}: ResolveMetaverseUnmountedGroundedTraversalOutcomeInput): ResolveMetaverseUnmountedGroundedTraversalOutcomeSnapshot {
  const resolvedSupportHeightMeters = resolveMetaverseWorldSurfaceHeightMeters(
    surfacePolicyConfig,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    groundedBodySnapshot.position.x,
    groundedBodySnapshot.position.z,
    excludedOwnerEnvironmentAssetId
  );
  const automaticSurfaceSnapshot = resolveAutomaticSurfaceSnapshot(
    surfacePolicyConfig,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    groundedBodySnapshot.position,
    groundedBodySnapshot.yawRadians,
    "grounded",
    excludedOwnerEnvironmentAssetId
  );
  const waterlineHeightMeters = resolveMetaverseTraversalWaterlineHeightMeters(
    waterRegionSnapshots,
    groundedBodySnapshot.position
  );
  const waterlineThresholdMeters =
    waterlineHeightMeters +
    metaverseWorldAutomaticSurfaceWaterlineThresholdMeters;
  const directSupportKeepsGrounded =
    resolvedSupportHeightMeters !== null &&
    resolvedSupportHeightMeters > waterlineThresholdMeters;
  const shouldEnterSwim =
    directSupportKeepsGrounded === false &&
    groundedBodySnapshot.position.y <= waterlineThresholdMeters;
  const adjustedResolvedSupportHeightMeters =
    resolvedSupportHeightMeters === null
      ? automaticSurfaceSnapshot.debug.resolvedSupportHeightMeters
      : resolvedSupportHeightMeters;
  const nextAutomaticSurfaceSnapshot = shouldEnterSwim
    ? Object.freeze({
        debug: Object.freeze({
          ...automaticSurfaceSnapshot.debug,
          reason: "water-entry",
          resolvedSupportHeightMeters: adjustedResolvedSupportHeightMeters
        }),
        decision: Object.freeze({
          locomotionMode: "swim",
          supportHeightMeters: null
        } satisfies MetaverseWorldSurfaceLocomotionDecision)
      } satisfies MetaverseWorldAutomaticSurfaceLocomotionSnapshot)
    : automaticSurfaceSnapshot;

  return Object.freeze({
    automaticSurfaceSnapshot: nextAutomaticSurfaceSnapshot,
    grounded: shouldEnterSwim ? false : groundedBodySnapshot.grounded,
    locomotionMode: shouldEnterSwim ? "swim" : "grounded",
    supportHeightMeters:
      shouldEnterSwim
        ? null
        : resolvedSupportHeightMeters ??
          automaticSurfaceSnapshot.decision.supportHeightMeters,
    waterlineHeightMeters
  });
}

function resolveMetaverseUnmountedSwimTraversalOutcome({
  surfaceColliderSnapshots,
  surfacePolicyConfig,
  swimBodySnapshot,
  waterRegionSnapshots,
  excludedOwnerEnvironmentAssetId = null
}: ResolveMetaverseUnmountedSwimTraversalOutcomeInput): ResolveMetaverseUnmountedSwimTraversalOutcomeSnapshot {
  const waterlineHeightMeters = resolveMetaverseTraversalWaterlineHeightMeters(
    waterRegionSnapshots,
    swimBodySnapshot.position
  );
  const automaticSurfaceSnapshot = resolveAutomaticSurfaceSnapshot(
    surfacePolicyConfig,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    {
      x: swimBodySnapshot.position.x,
      y: waterlineHeightMeters,
      z: swimBodySnapshot.position.z
    },
    swimBodySnapshot.yawRadians,
    "swim",
    excludedOwnerEnvironmentAssetId
  );
  const nextLocomotionDecision: MetaverseWorldSurfaceLocomotionDecision =
    automaticSurfaceSnapshot.decision;
  const grounded =
    nextLocomotionDecision.locomotionMode === "grounded" &&
    nextLocomotionDecision.supportHeightMeters !== null;

  return Object.freeze({
    automaticSurfaceSnapshot,
    grounded,
    locomotionMode: grounded ? "grounded" : "swim",
    supportHeightMeters: nextLocomotionDecision.supportHeightMeters,
    waterlineHeightMeters
  });
}

export function prepareMetaverseUnmountedTraversalStep({
  bodyControl,
  deltaSeconds,
  groundedBodyConfig,
  groundedBodySnapshot,
  jumpSupportVerticalSpeedTolerance,
  preferredLookYawRadians = null,
  surfaceColliderSnapshots,
  surfacePolicyConfig,
  swimBodySnapshot,
  traversalState,
  waterRegionSnapshots,
  excludedOwnerEnvironmentAssetId = null
}: PrepareMetaverseUnmountedTraversalStepInput): MetaversePreparedUnmountedTraversalStepSnapshot {
  if (traversalState.locomotionMode === "grounded") {
    if (groundedBodySnapshot === null) {
      throw new Error(
        "prepareMetaverseUnmountedTraversalStep requires a grounded body snapshot while grounded"
      );
    }

    const groundedTraversalStep = prepareMetaverseUnmountedGroundedTraversalStep({
      actionState: traversalState.actionState,
      bodyControl,
      deltaSeconds,
      groundedBodyConfig,
      groundedBodySnapshot,
      jumpSupportVerticalSpeedTolerance,
      preferredLookYawRadians,
      surfaceColliderSnapshots,
      surfacePolicyConfig,
      waterRegionSnapshots,
      excludedOwnerEnvironmentAssetId
    });

    return Object.freeze({
      autostepHeightMeters: groundedTraversalStep.autostepHeightMeters,
      bodyIntent: groundedTraversalStep.bodyIntent,
      groundedJumpSupported: groundedTraversalStep.groundedJumpSupported,
      jumpRequested: groundedTraversalStep.jumpRequested,
      locomotionMode: "grounded",
      surfaceJumpSupported: groundedTraversalStep.surfaceJumpSupported,
      traversalState: Object.freeze({
        actionState: groundedTraversalStep.actionState,
        locomotionMode: "grounded"
      })
    });
  }

  if (swimBodySnapshot === null) {
    throw new Error(
      "prepareMetaverseUnmountedTraversalStep requires a swim body snapshot while swimming"
    );
  }

  return Object.freeze({
    bodyControl: Object.freeze({
      boost: bodyControl.boost,
      moveAxis: bodyControl.moveAxis,
      strafeAxis: bodyControl.strafeAxis,
      turnAxis: bodyControl.turnAxis
    }),
    locomotionMode: "swim",
    traversalState: Object.freeze({
      actionState: advanceMetaverseTraversalActionState(
        traversalState.actionState,
        {
          canConsumePendingAction: false,
          deltaSeconds
        }
      ).state,
      locomotionMode: "swim"
    }),
    waterlineHeightMeters: resolveMetaverseTraversalWaterlineHeightMeters(
      waterRegionSnapshots,
      swimBodySnapshot.position
    )
  });
}

export function resolveMetaverseUnmountedTraversalStep({
  groundedBodySnapshot,
  preparedTraversalStep,
  surfaceColliderSnapshots,
  surfacePolicyConfig,
  swimBodySnapshot,
  waterRegionSnapshots,
  excludedOwnerEnvironmentAssetId = null
}: ResolveMetaverseUnmountedTraversalStepInput): ResolveMetaverseUnmountedTraversalStepSnapshot {
  if (preparedTraversalStep.locomotionMode === "grounded") {
    if (groundedBodySnapshot === null) {
      throw new Error(
        "resolveMetaverseUnmountedTraversalStep requires a grounded body snapshot while grounded"
      );
    }

    const locomotionOutcome = resolveMetaverseUnmountedGroundedTraversalOutcome({
      groundedBodySnapshot,
      surfaceColliderSnapshots,
      surfacePolicyConfig,
      waterRegionSnapshots,
      excludedOwnerEnvironmentAssetId
    });

    return Object.freeze({
      automaticSurfaceSnapshot: locomotionOutcome.automaticSurfaceSnapshot,
      grounded: locomotionOutcome.grounded,
      locomotionMode: locomotionOutcome.locomotionMode,
      supportHeightMeters: locomotionOutcome.supportHeightMeters,
      traversalState: Object.freeze({
        actionState: preparedTraversalStep.traversalState.actionState,
        locomotionMode: locomotionOutcome.locomotionMode
      }),
      waterlineHeightMeters: locomotionOutcome.waterlineHeightMeters
    });
  }

  if (swimBodySnapshot === null) {
    throw new Error(
      "resolveMetaverseUnmountedTraversalStep requires a swim body snapshot while swimming"
    );
  }

  const locomotionOutcome = resolveMetaverseUnmountedSwimTraversalOutcome({
    surfaceColliderSnapshots,
    surfacePolicyConfig,
    swimBodySnapshot,
    waterRegionSnapshots,
    excludedOwnerEnvironmentAssetId
  });

  return Object.freeze({
    automaticSurfaceSnapshot: locomotionOutcome.automaticSurfaceSnapshot,
    grounded: locomotionOutcome.grounded,
    locomotionMode: locomotionOutcome.locomotionMode,
    supportHeightMeters: locomotionOutcome.supportHeightMeters,
    traversalState: Object.freeze({
      actionState: preparedTraversalStep.traversalState.actionState,
      locomotionMode: locomotionOutcome.locomotionMode
    }),
    waterlineHeightMeters: locomotionOutcome.waterlineHeightMeters
  });
}
