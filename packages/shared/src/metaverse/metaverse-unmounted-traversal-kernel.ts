import type {
  MetaverseTraversalBodyControlSnapshot
} from "./metaverse-traversal-contract.js";
import {
  stepMetaverseGroundedTraversalAction,
  type MetaverseGroundedTraversalBodyIntentSnapshot
} from "./metaverse-grounded-traversal-kernel.js";
import type {
  MetaverseGroundedJumpBodySnapshot
} from "./metaverse-grounded-jump-physics.js";
import type {
  MetaverseSurfaceDriveBodyRuntimeSnapshot
} from "./metaverse-surface-drive-body-contract.js";
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
  MetaverseWorldSurfacePolicyConfig
} from "./metaverse-world-surface-policy.js";
import {
  metaverseWorldAutomaticSurfaceWaterlineThresholdMeters,
  resolveMetaverseWorldGroundedAutostepHeightMeters,
  resolveMetaverseWorldSurfaceHeightMeters
} from "./metaverse-world-surface-policy.js";
import type {
  MetaverseTraversalCapabilityId,
  MetaverseTraversalStateDecision,
  MetaverseTraversalStateResolutionSnapshot
} from "./metaverse-traversal-state-resolver.js";
import {
  resolveMetaverseTraversalStateFromWorldAffordances
} from "./metaverse-traversal-state-resolver.js";
import {
  clamp,
  toFiniteNumber,
  wrapRadians
} from "./metaverse-surface-traversal-simulation.js";

export interface MetaverseUnmountedGroundedBodySnapshot {
  readonly grounded: boolean;
  readonly jumpBody: MetaverseGroundedJumpBodySnapshot;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

export type MetaverseUnmountedSwimBodySnapshot =
  MetaverseSurfaceDriveBodyRuntimeSnapshot;

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
  readonly jumpRequested: boolean;
  readonly locomotionMode: "grounded";
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
  readonly automaticSurfaceSnapshot: MetaverseTraversalStateResolutionSnapshot;
  readonly grounded: boolean;
  readonly locomotionMode: "grounded" | "swim";
  readonly supportHeightMeters: number | null;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly waterlineHeightMeters: number;
}

export interface ResolveMetaverseUnmountedTraversalTransitionInput {
  readonly locomotionOutcome: Pick<
    ResolveMetaverseUnmountedTraversalStepSnapshot,
    "grounded" | "locomotionMode" | "supportHeightMeters" | "waterlineHeightMeters"
  >;
  readonly preparedTraversalStep: Pick<
    MetaversePreparedUnmountedTraversalStepSnapshot,
    "locomotionMode"
  >;
}

export interface MetaverseUnmountedTraversalTransitionSnapshot {
  readonly enteredGrounded: boolean;
  readonly enteredSwim: boolean;
  readonly grounded: boolean;
  readonly locomotionMode: "grounded" | "swim";
  readonly positionYMeters: number | null;
  readonly positionYSource: "none" | "support" | "waterline";
  readonly resetVerticalVelocity: boolean;
}

export interface AdvanceMetaverseUnmountedGroundedBodyStepInput {
  readonly autostepHeightMeters: number | null;
  readonly bodyIntent: MetaverseGroundedTraversalBodyIntentSnapshot;
  readonly preferredLookYawRadians: number | null;
}

export interface AdvanceMetaverseUnmountedSwimBodyStepInput {
  readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
  readonly preferredLookYawRadians: number | null;
  readonly waterlineHeightMeters: number;
}

export interface AdvanceMetaverseUnmountedTraversalBodyStepInput<
  GroundedBodySnapshot extends MetaverseUnmountedGroundedBodySnapshot = MetaverseUnmountedGroundedBodySnapshot,
  SwimBodySnapshot extends MetaverseUnmountedSwimBodySnapshot = MetaverseUnmountedSwimBodySnapshot
>
  extends PrepareMetaverseUnmountedTraversalStepInput {
  readonly advanceGroundedBodySnapshot: (
    input: AdvanceMetaverseUnmountedGroundedBodyStepInput
  ) => GroundedBodySnapshot;
  readonly advanceSwimBodySnapshot: (
    input: AdvanceMetaverseUnmountedSwimBodyStepInput
  ) => SwimBodySnapshot;
}

export interface AdvanceMetaverseUnmountedTraversalBodyStepSnapshot<
  GroundedBodySnapshot extends MetaverseUnmountedGroundedBodySnapshot = MetaverseUnmountedGroundedBodySnapshot,
  SwimBodySnapshot extends MetaverseUnmountedSwimBodySnapshot = MetaverseUnmountedSwimBodySnapshot
> {
  readonly groundedBodySnapshot: GroundedBodySnapshot | null;
  readonly preparedTraversalStep: MetaversePreparedUnmountedTraversalStepSnapshot;
  readonly locomotionOutcome: ResolveMetaverseUnmountedTraversalStepSnapshot;
  readonly swimBodySnapshot: SwimBodySnapshot | null;
  readonly transitionSnapshot: MetaverseUnmountedTraversalTransitionSnapshot;
}

interface PrepareMetaverseUnmountedGroundedTraversalStepInput {
  readonly actionState: MetaverseTraversalActionStateSnapshot;
  readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
  readonly deltaSeconds: number;
  readonly groundedBodyConfig: MetaverseUnmountedGroundedTraversalConfigSnapshot;
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot;
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
  readonly jumpRequested: boolean;
}

interface ResolveMetaverseUnmountedGroundedTraversalOutcomeInput {
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot;
  readonly surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly surfacePolicyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readonly excludedOwnerEnvironmentAssetId?: string | null;
}

interface ResolveMetaverseUnmountedGroundedTraversalOutcomeSnapshot {
  readonly automaticSurfaceSnapshot: MetaverseTraversalStateResolutionSnapshot;
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
  readonly automaticSurfaceSnapshot: MetaverseTraversalStateResolutionSnapshot;
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
  currentLocomotionMode: MetaverseTraversalCapabilityId,
  excludedOwnerEnvironmentAssetId: string | null
): MetaverseTraversalStateResolutionSnapshot {
  return resolveMetaverseTraversalStateFromWorldAffordances(
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
    readMetaverseTraversalWaterSurfaceHeightMeters(
      waterRegionSnapshots,
      position,
      paddingMeters
    ) ?? toFiniteNumber(position.y, 0)
  );
}

export function readMetaverseTraversalWaterSurfaceHeightMeters(
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  position: Pick<MetaverseWorldSurfaceVector3Snapshot, "x" | "z">,
  paddingMeters = 0
): number | null {
  return (
    resolveMetaverseWorldWaterSurfaceHeightMeters(
      waterRegionSnapshots,
      position.x,
      position.z,
      paddingMeters
    ) ?? null
  );
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
  const supportHeightMeters = resolveMetaverseWorldSurfaceHeightMeters(
    surfacePolicyConfig,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    groundedBodySnapshot.position.x,
    groundedBodySnapshot.position.z,
    excludedOwnerEnvironmentAssetId,
    groundedBodySnapshot.position.y
  );
  const waterSurfaceHeightMeters = readMetaverseTraversalWaterSurfaceHeightMeters(
    waterRegionSnapshots,
    groundedBodySnapshot.position
  );
  const currentDirectSupportKeepsGrounded =
    supportHeightMeters !== null &&
    (waterSurfaceHeightMeters === null ||
      supportHeightMeters >
        waterSurfaceHeightMeters +
          metaverseWorldAutomaticSurfaceWaterlineThresholdMeters);
  const traversalActionStep = stepMetaverseGroundedTraversalAction({
    actionState,
    bodyControl,
    deltaSeconds,
    groundedBodyJumpReady: groundedBodySnapshot.jumpBody.jumpReady
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
      groundedBodySnapshot.jumpBody.verticalSpeedUnitsPerSecond,
      traversalActionStep.jumpRequested,
      excludedOwnerEnvironmentAssetId
    ),
    bodyIntent: Object.freeze({
      ...traversalActionStep.bodyIntent,
      snapToGroundOverrideEnabled: currentDirectSupportKeepsGrounded
    }),
    jumpRequested: traversalActionStep.jumpRequested
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
    excludedOwnerEnvironmentAssetId,
    groundedBodySnapshot.position.y
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
  const waterSurfaceHeightMeters = readMetaverseTraversalWaterSurfaceHeightMeters(
    waterRegionSnapshots,
    groundedBodySnapshot.position
  );
  const waterlineHeightMeters =
    waterSurfaceHeightMeters ?? toFiniteNumber(groundedBodySnapshot.position.y, 0);
  const waterlineThresholdMeters =
    waterSurfaceHeightMeters === null
      ? null
      : waterSurfaceHeightMeters +
        metaverseWorldAutomaticSurfaceWaterlineThresholdMeters;
  const directSupportKeepsGrounded =
    resolvedSupportHeightMeters !== null &&
    (waterlineThresholdMeters === null ||
      resolvedSupportHeightMeters > waterlineThresholdMeters);
  const shouldEnterSwim =
    waterlineThresholdMeters !== null &&
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
          reason: "capability-transition-validated",
          resolvedSupportHeightMeters: adjustedResolvedSupportHeightMeters
        }),
        decision: Object.freeze({
          capabilityId: "swim",
          locomotionMode: "swim",
          supportHeightMeters: null
        } satisfies MetaverseTraversalStateDecision)
        } satisfies MetaverseTraversalStateResolutionSnapshot)
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
  const nextLocomotionDecision: MetaverseTraversalStateDecision =
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
      preferredLookYawRadians,
      surfaceColliderSnapshots,
      surfacePolicyConfig,
      waterRegionSnapshots,
      excludedOwnerEnvironmentAssetId
    });

    return Object.freeze({
      autostepHeightMeters: groundedTraversalStep.autostepHeightMeters,
      bodyIntent: groundedTraversalStep.bodyIntent,
      jumpRequested: groundedTraversalStep.jumpRequested,
      locomotionMode: "grounded",
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

export function resolveMetaverseUnmountedTraversalTransition({
  locomotionOutcome,
  preparedTraversalStep
}: ResolveMetaverseUnmountedTraversalTransitionInput): MetaverseUnmountedTraversalTransitionSnapshot {
  const enteredGrounded =
    preparedTraversalStep.locomotionMode === "swim" &&
    locomotionOutcome.locomotionMode === "grounded" &&
    locomotionOutcome.supportHeightMeters !== null;
  const enteredSwim =
    preparedTraversalStep.locomotionMode === "grounded" &&
    locomotionOutcome.locomotionMode === "swim";

  return Object.freeze({
    enteredGrounded,
    enteredSwim,
    grounded:
      locomotionOutcome.locomotionMode === "grounded" &&
      locomotionOutcome.grounded,
    locomotionMode: locomotionOutcome.locomotionMode,
    positionYMeters: enteredGrounded
      ? locomotionOutcome.supportHeightMeters
      : enteredSwim
        ? locomotionOutcome.waterlineHeightMeters
        : null,
    positionYSource: enteredGrounded
      ? "support"
      : enteredSwim
        ? "waterline"
        : "none",
    resetVerticalVelocity: enteredGrounded || enteredSwim
  });
}

export function advanceMetaverseUnmountedTraversalBodyStep<
  GroundedBodySnapshot extends MetaverseUnmountedGroundedBodySnapshot,
  SwimBodySnapshot extends MetaverseUnmountedSwimBodySnapshot
>({
  advanceGroundedBodySnapshot,
  advanceSwimBodySnapshot,
  ...prepareInput
}: AdvanceMetaverseUnmountedTraversalBodyStepInput<
  GroundedBodySnapshot,
  SwimBodySnapshot
>): AdvanceMetaverseUnmountedTraversalBodyStepSnapshot<
  GroundedBodySnapshot,
  SwimBodySnapshot
> {
  const preparedTraversalStep =
    prepareMetaverseUnmountedTraversalStep(prepareInput);

  if (preparedTraversalStep.locomotionMode === "grounded") {
    const groundedBodySnapshot = advanceGroundedBodySnapshot({
      autostepHeightMeters: preparedTraversalStep.autostepHeightMeters,
      bodyIntent: preparedTraversalStep.bodyIntent,
      preferredLookYawRadians: prepareInput.preferredLookYawRadians ?? null
    });
    const locomotionOutcome = resolveMetaverseUnmountedTraversalStep({
      groundedBodySnapshot,
      preparedTraversalStep,
      surfaceColliderSnapshots: prepareInput.surfaceColliderSnapshots,
      surfacePolicyConfig: prepareInput.surfacePolicyConfig,
      swimBodySnapshot: null,
      waterRegionSnapshots: prepareInput.waterRegionSnapshots,
      excludedOwnerEnvironmentAssetId:
        prepareInput.excludedOwnerEnvironmentAssetId ?? null
    });
    const transitionSnapshot = resolveMetaverseUnmountedTraversalTransition({
      locomotionOutcome,
      preparedTraversalStep
    });

    return Object.freeze({
      groundedBodySnapshot,
      preparedTraversalStep,
      locomotionOutcome,
      swimBodySnapshot: null,
      transitionSnapshot
    });
  }

  const swimBodySnapshot = advanceSwimBodySnapshot({
    bodyControl: preparedTraversalStep.bodyControl,
    preferredLookYawRadians: prepareInput.preferredLookYawRadians ?? null,
    waterlineHeightMeters: preparedTraversalStep.waterlineHeightMeters
  });
  const locomotionOutcome = resolveMetaverseUnmountedTraversalStep({
    groundedBodySnapshot: null,
    preparedTraversalStep,
    surfaceColliderSnapshots: prepareInput.surfaceColliderSnapshots,
    surfacePolicyConfig: prepareInput.surfacePolicyConfig,
    swimBodySnapshot,
    waterRegionSnapshots: prepareInput.waterRegionSnapshots,
    excludedOwnerEnvironmentAssetId:
      prepareInput.excludedOwnerEnvironmentAssetId ?? null
  });
  const transitionSnapshot = resolveMetaverseUnmountedTraversalTransition({
    locomotionOutcome,
    preparedTraversalStep
  });

  return Object.freeze({
    groundedBodySnapshot: null,
    preparedTraversalStep,
    locomotionOutcome,
    swimBodySnapshot,
    transitionSnapshot
  });
}
