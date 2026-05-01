import type {
  MetaverseTraversalBodyControlSnapshot
} from "./metaverse-traversal-contract.js";
import {
  createMetaverseGroundedBodyContactSnapshot,
  createMetaverseGroundedBodyStepStateSnapshot,
  prepareMetaverseGroundedBodyStep,
  resolveMetaverseGroundedBodyStep,
  type MetaverseGroundedBodyStepStateSnapshot,
  stepMetaverseGroundedTraversalAction,
  type MetaverseGroundedTraversalBodyIntentSnapshot
} from "./metaverse-grounded-traversal-kernel.js";
import {
  createMetaverseGroundedJumpBodySnapshot
} from "./metaverse-grounded-jump-physics.js";
import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  type MetaverseGroundedBodyConfigSnapshot,
  type MetaverseGroundedBodyRuntimeSnapshot
} from "./metaverse-grounded-body-contract.js";
import {
  resolveMetaverseGroundedTraversalDirectionalSpeeds
} from "./metaverse-grounded-traversal-simulation.js";
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
  MetaverseWorldSurfaceSupportSnapshot,
  MetaverseWorldSurfacePolicyConfig
} from "./metaverse-world-surface-policy.js";
import {
  metaverseWorldAutomaticSurfaceWaterlineThresholdMeters,
  metaverseWorldSurfaceStepHeightLeewayMeters,
  constrainMetaverseWorldPlanarPositionAgainstBlockers,
  resolveMetaverseWorldGroundedAutostepHeightMeters,
  resolveMetaverseWorldSurfaceSupportSnapshot
} from "./metaverse-world-surface-policy.js";
import {
  constrainMetaverseTraversalPlayerBodyBlockers,
  type MetaverseTraversalPlayerBodyBlockerSnapshot
} from "./metaverse-player-body-blocker-kernel.js";
import {
  resolveMetaverseTraversalLinearVelocitySnapshot
} from "./metaverse-traversal-kinematics.js";
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
  createMetaverseSurfaceTraversalVector3Snapshot,
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
  readonly groundedSupport: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly locomotionMode: "grounded" | "swim";
}

export function createMetaverseUnmountedTraversalStateSnapshot(
  input: Partial<MetaverseUnmountedTraversalStateSnapshot> = {}
): MetaverseUnmountedTraversalStateSnapshot {
  return Object.freeze({
    actionState: createMetaverseTraversalActionStateSnapshot(
      input.actionState ?? {}
    ),
    groundedSupport:
      input.locomotionMode === "swim" ? null : input.groundedSupport ?? null,
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
    groundedSupport: traversalState.groundedSupport,
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
    groundedSupport: traversalState.groundedSupport,
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
  readonly support: MetaverseWorldSurfaceSupportSnapshot | null;
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
  readonly groundedBodyConfig: MetaverseUnmountedGroundedTraversalConfigSnapshot;
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
  readonly support: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly supportHeightMeters: number | null;
  readonly traversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly waterlineHeightMeters: number;
}

export interface ResolveMetaverseUnmountedTraversalTransitionInput {
  readonly locomotionOutcome: Pick<
    ResolveMetaverseUnmountedTraversalStepSnapshot,
    | "grounded"
    | "locomotionMode"
    | "supportHeightMeters"
    | "waterlineHeightMeters"
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

export interface AdvanceMetaverseDeterministicUnmountedGroundedBodyStepInput {
  readonly autostepHeightMeters: number | null;
  readonly bodyIntent: MetaverseGroundedTraversalBodyIntentSnapshot;
  readonly currentGroundedBodySnapshot: MetaverseGroundedBodyRuntimeSnapshot;
  readonly deltaSeconds: number;
  readonly excludedOwnerEnvironmentAssetId?: string | null;
  readonly groundedBodyConfig: MetaverseGroundedBodyConfigSnapshot;
  readonly playerBlockers?: readonly MetaverseTraversalPlayerBodyBlockerSnapshot[];
  readonly preferredLookYawRadians: number | null;
  readonly preferredSupport?: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly surfacePolicyConfig: MetaverseWorldSurfacePolicyConfig;
}

export interface SyncResolvedMetaverseUnmountedGroundedBodySnapshotInput<
  GroundedBodySnapshot extends MetaverseUnmountedGroundedBodySnapshot = MetaverseUnmountedGroundedBodySnapshot
> {
  readonly grounded: boolean;
  readonly groundedBodySnapshot: GroundedBodySnapshot;
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
  readonly syncResolvedGroundedBodySnapshot: (
    input: SyncResolvedMetaverseUnmountedGroundedBodySnapshotInput<GroundedBodySnapshot>
  ) => GroundedBodySnapshot;
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
  readonly groundedSupport: MetaverseWorldSurfaceSupportSnapshot | null;
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
  readonly support: MetaverseWorldSurfaceSupportSnapshot | null;
}

interface ResolveMetaverseUnmountedGroundedTraversalOutcomeInput {
  readonly groundedBodyConfig: MetaverseUnmountedGroundedTraversalConfigSnapshot;
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot;
  readonly preferredSupport?: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly surfacePolicyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
  readonly excludedOwnerEnvironmentAssetId?: string | null;
}

interface ResolveMetaverseUnmountedGroundedTraversalOutcomeSnapshot {
  readonly automaticSurfaceSnapshot: MetaverseTraversalStateResolutionSnapshot;
  readonly grounded: boolean;
  readonly locomotionMode: "grounded" | "swim";
  readonly support: MetaverseWorldSurfaceSupportSnapshot | null;
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
  readonly support: MetaverseWorldSurfaceSupportSnapshot | null;
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
  excludedOwnerEnvironmentAssetId: string | null,
  preferredSupport: MetaverseWorldSurfaceSupportSnapshot | null = null
): MetaverseTraversalStateResolutionSnapshot {
  return resolveMetaverseTraversalStateFromWorldAffordances(
    surfacePolicyConfig,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position,
    yawRadians,
    currentLocomotionMode,
    excludedOwnerEnvironmentAssetId,
    preferredSupport
  );
}

const deterministicGroundedBodyContactDeltaToleranceMeters = 0.01;
const deterministicGroundedBodySupportToleranceMeters = 0.001;
const emptyMetaverseTraversalPlayerBodyBlockers =
  Object.freeze([]) as readonly MetaverseTraversalPlayerBodyBlockerSnapshot[];

function createMetaverseGroundedBodyStepStateFromRuntimeSnapshot(
  runtimeSnapshot: MetaverseGroundedBodyRuntimeSnapshot,
  supportNormal: MetaverseWorldSurfaceVector3Snapshot | null
): MetaverseGroundedBodyStepStateSnapshot {
  const directionalSpeeds =
    resolveMetaverseGroundedTraversalDirectionalSpeeds(
      runtimeSnapshot.linearVelocity,
      runtimeSnapshot.yawRadians,
      runtimeSnapshot.grounded
    );
  const stepStateInput = {
    contact: runtimeSnapshot.contact,
    driveTarget: runtimeSnapshot.driveTarget,
    forwardSpeedUnitsPerSecond:
      directionalSpeeds.forwardSpeedUnitsPerSecond,
    grounded: runtimeSnapshot.grounded,
    interaction: runtimeSnapshot.interaction,
    jumpGroundContactGraceSecondsRemaining:
      runtimeSnapshot.jumpBody.jumpGroundContactGraceSecondsRemaining,
    jumpReady: runtimeSnapshot.jumpBody.jumpReady,
    jumpSnapSuppressionActive:
      runtimeSnapshot.jumpBody.jumpSnapSuppressionActive,
    position: runtimeSnapshot.position,
    strafeSpeedUnitsPerSecond:
      directionalSpeeds.strafeSpeedUnitsPerSecond,
    verticalSpeedUnitsPerSecond:
      runtimeSnapshot.jumpBody.verticalSpeedUnitsPerSecond,
    yawRadians: runtimeSnapshot.yawRadians
  };

  return createMetaverseGroundedBodyStepStateSnapshot(
    supportNormal === null
      ? stepStateInput
      : Object.freeze({
          ...stepStateInput,
          supportNormal
        })
  );
}

function createMetaverseGroundedBodyRuntimeSnapshotFromStepState(
  stepState: MetaverseGroundedBodyStepStateSnapshot
): MetaverseGroundedBodyRuntimeSnapshot {
  const jumpBodySnapshot = createMetaverseGroundedJumpBodySnapshot({
    grounded: stepState.grounded,
    jumpGroundContactGraceSecondsRemaining:
      stepState.jumpGroundContactGraceSecondsRemaining,
    jumpReady: stepState.jumpReady,
    jumpSnapSuppressionActive: stepState.jumpSnapSuppressionActive,
    verticalSpeedUnitsPerSecond: stepState.verticalSpeedUnitsPerSecond
  });

  return createMetaverseGroundedBodyRuntimeSnapshot({
    contact: stepState.contact,
    driveTarget: stepState.driveTarget,
    grounded: jumpBodySnapshot.grounded,
    interaction: stepState.interaction,
    jumpBody: jumpBodySnapshot,
    linearVelocity: resolveMetaverseTraversalLinearVelocitySnapshot(
      {
        forwardSpeedUnitsPerSecond: stepState.forwardSpeedUnitsPerSecond,
        strafeSpeedUnitsPerSecond: stepState.strafeSpeedUnitsPerSecond,
        verticalSpeedUnitsPerSecond:
          jumpBodySnapshot.verticalSpeedUnitsPerSecond
      },
      stepState.yawRadians
    ),
    position: stepState.position,
    yawRadians: stepState.yawRadians
  });
}

function resolveMetaverseDeterministicGroundedMaxStepRiseMeters(
  input: Pick<
    AdvanceMetaverseDeterministicUnmountedGroundedBodyStepInput,
    "autostepHeightMeters" | "groundedBodyConfig" | "surfacePolicyConfig"
  >
): number {
  return (
    Math.max(
      0,
      toFiniteNumber(input.autostepHeightMeters ?? 0, 0),
      toFiniteNumber(input.groundedBodyConfig.stepHeightMeters, 0),
      toFiniteNumber(input.surfacePolicyConfig.stepHeightMeters, 0)
    ) + metaverseWorldSurfaceStepHeightLeewayMeters
  );
}

function resolveMetaverseDeterministicGroundedCapsuleHeightMeters(
  input: Pick<
    AdvanceMetaverseDeterministicUnmountedGroundedBodyStepInput,
    "groundedBodyConfig" | "surfacePolicyConfig"
  >
): number {
  return (
    (Math.max(
      0,
      toFiniteNumber(
        input.groundedBodyConfig.capsuleHalfHeightMeters,
        input.surfacePolicyConfig.capsuleHalfHeightMeters
      )
    ) +
      Math.max(
        0,
        toFiniteNumber(
          input.groundedBodyConfig.capsuleRadiusMeters,
          input.surfacePolicyConfig.capsuleRadiusMeters
        )
      )) *
    2
  );
}

function resolveMetaverseDeterministicGroundedPlanarPosition(input: {
  readonly currentPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly maxStepRiseMeters: number;
  readonly nextPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly stepInput: AdvanceMetaverseDeterministicUnmountedGroundedBodyStepInput;
}): MetaverseWorldSurfaceVector3Snapshot {
  const controllerOffsetMeters = Math.max(
    0,
    toFiniteNumber(input.stepInput.groundedBodyConfig.controllerOffsetMeters, 0)
  );
  const bodyRadiusMeters = Math.max(
    0,
    toFiniteNumber(
      input.stepInput.groundedBodyConfig.capsuleRadiusMeters,
      input.stepInput.surfacePolicyConfig.capsuleRadiusMeters
    )
  );
  const capsuleHeightMeters =
    resolveMetaverseDeterministicGroundedCapsuleHeightMeters(input.stepInput);
  const minHeightMeters = Math.min(
    input.currentPosition.y,
    input.nextPosition.y
  );
  const maxHeightMeters =
    Math.max(input.currentPosition.y, input.nextPosition.y) +
    capsuleHeightMeters;
  const worldBlockedPosition =
    constrainMetaverseWorldPlanarPositionAgainstBlockers(
      input.stepInput.surfaceColliderSnapshots,
      input.currentPosition,
      input.nextPosition,
      bodyRadiusMeters + controllerOffsetMeters,
      minHeightMeters,
      maxHeightMeters,
      input.stepInput.excludedOwnerEnvironmentAssetId ?? null,
      Object.freeze({
        currentRootHeightMeters: input.currentPosition.y,
        maxStepRiseMeters: input.maxStepRiseMeters,
        nextRootHeightMeters: input.nextPosition.y
      })
    );

  return constrainMetaverseTraversalPlayerBodyBlockers({
    blockers:
      input.stepInput.playerBlockers ??
      emptyMetaverseTraversalPlayerBodyBlockers,
    capsuleHalfHeightMeters:
      input.stepInput.groundedBodyConfig.capsuleHalfHeightMeters,
    capsuleRadiusMeters:
      input.stepInput.groundedBodyConfig.capsuleRadiusMeters,
    controllerOffsetMeters,
    currentPosition: input.currentPosition,
    nextPosition: worldBlockedPosition
  });
}

function hasDeterministicGroundedBodyMovementDeltaDivergence(
  desiredDelta: number,
  appliedDelta: number
): boolean {
  return (
    Math.abs(toFiniteNumber(desiredDelta, 0) - toFiniteNumber(appliedDelta, 0)) >
    deterministicGroundedBodyContactDeltaToleranceMeters
  );
}

function hasDeterministicGroundedBodyVerticalMovementDivergence(
  desiredDelta: number,
  appliedDelta: number,
  supportingContactDetected: boolean
): boolean {
  const sanitizedDesiredDelta = toFiniteNumber(desiredDelta, 0);
  const sanitizedAppliedDelta = toFiniteNumber(appliedDelta, 0);

  if (
    supportingContactDetected &&
    sanitizedDesiredDelta <= 0 &&
    sanitizedAppliedDelta >= 0
  ) {
    return false;
  }

  return hasDeterministicGroundedBodyMovementDeltaDivergence(
    sanitizedDesiredDelta,
    sanitizedAppliedDelta
  );
}

function shouldAcceptMetaverseDeterministicGroundedSupport(input: {
  readonly currentPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly maxStepRiseMeters: number;
  readonly preparedStep: ReturnType<typeof prepareMetaverseGroundedBodyStep>;
  readonly resolvedPlanarPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly snapToGroundDistanceMeters: number;
  readonly support: MetaverseWorldSurfaceSupportSnapshot | null;
}): boolean {
  if (input.support === null) {
    return false;
  }

  const supportHeightMeters = input.support.supportHeightMeters;

  if (
    supportHeightMeters >
    input.currentPosition.y + input.maxStepRiseMeters
  ) {
    return false;
  }

  if (
    input.preparedStep.verticalSpeedUnitsPerSecond > 0 &&
    input.resolvedPlanarPosition.y >
      supportHeightMeters + deterministicGroundedBodySupportToleranceMeters
  ) {
    return false;
  }

  if (
    input.resolvedPlanarPosition.y <=
    supportHeightMeters + deterministicGroundedBodySupportToleranceMeters
  ) {
    return true;
  }

  return (
    input.preparedStep.snapToGroundEnabled === true &&
    input.resolvedPlanarPosition.y - supportHeightMeters <=
      input.snapToGroundDistanceMeters + metaverseWorldSurfaceStepHeightLeewayMeters
  );
}

export function advanceMetaverseDeterministicUnmountedGroundedBodyStep(
  input: AdvanceMetaverseDeterministicUnmountedGroundedBodyStepInput
): MetaverseGroundedBodyRuntimeSnapshot {
  const deltaSeconds = Math.max(0, toFiniteNumber(input.deltaSeconds, 0));

  if (deltaSeconds <= 0) {
    return input.currentGroundedBodySnapshot;
  }

  const currentPosition = input.currentGroundedBodySnapshot.position;
  const currentStepState =
    createMetaverseGroundedBodyStepStateFromRuntimeSnapshot(
      input.currentGroundedBodySnapshot,
      input.preferredSupport?.supportNormal ?? null
    );
  const preparedStep = prepareMetaverseGroundedBodyStep(
    currentStepState,
    input.bodyIntent,
    input.groundedBodyConfig,
    deltaSeconds,
    input.preferredLookYawRadians
  );
  const desiredRootPosition = createMetaverseSurfaceTraversalVector3Snapshot(
    currentPosition.x + preparedStep.desiredMovementDelta.x,
    currentPosition.y + preparedStep.desiredMovementDelta.y,
    currentPosition.z + preparedStep.desiredMovementDelta.z
  );
  const maxStepRiseMeters =
    resolveMetaverseDeterministicGroundedMaxStepRiseMeters(input);
  const resolvedPlanarPosition =
    resolveMetaverseDeterministicGroundedPlanarPosition({
      currentPosition,
      maxStepRiseMeters,
      nextPosition: desiredRootPosition,
      stepInput: input
    });
  const support = resolveMetaverseWorldSurfaceSupportSnapshot(
    input.surfacePolicyConfig,
    input.surfaceColliderSnapshots,
    resolvedPlanarPosition.x,
    resolvedPlanarPosition.z,
    Math.max(
      0,
      toFiniteNumber(
        input.groundedBodyConfig.capsuleRadiusMeters,
        input.surfacePolicyConfig.capsuleRadiusMeters
      ),
      toFiniteNumber(input.surfacePolicyConfig.capsuleRadiusMeters, 0)
    ) +
      Math.max(
        0,
        toFiniteNumber(input.groundedBodyConfig.controllerOffsetMeters, 0)
      ),
    input.excludedOwnerEnvironmentAssetId ?? null,
    Math.max(currentPosition.y, resolvedPlanarPosition.y) + maxStepRiseMeters,
    input.preferredSupport ?? null
  );
  const grounded = shouldAcceptMetaverseDeterministicGroundedSupport({
    currentPosition,
    maxStepRiseMeters,
    preparedStep,
    resolvedPlanarPosition,
    snapToGroundDistanceMeters: Math.max(
      0,
      toFiniteNumber(input.groundedBodyConfig.snapToGroundDistanceMeters, 0)
    ),
    support
  });
  const resolvedRootPosition = createMetaverseSurfaceTraversalVector3Snapshot(
    resolvedPlanarPosition.x,
    grounded && support !== null
      ? support.supportHeightMeters
      : resolvedPlanarPosition.y,
    resolvedPlanarPosition.z
  );
  const appliedMovementDelta = createMetaverseSurfaceTraversalVector3Snapshot(
    resolvedRootPosition.x - currentPosition.x,
    resolvedRootPosition.y - currentPosition.y,
    resolvedRootPosition.z - currentPosition.z
  );
  const contactSnapshot = createMetaverseGroundedBodyContactSnapshot({
    appliedMovementDelta,
    blockedPlanarMovement:
      hasDeterministicGroundedBodyMovementDeltaDivergence(
        preparedStep.desiredMovementDelta.x,
        appliedMovementDelta.x
      ) ||
      hasDeterministicGroundedBodyMovementDeltaDivergence(
        preparedStep.desiredMovementDelta.z,
        appliedMovementDelta.z
      ),
    blockedVerticalMovement:
      hasDeterministicGroundedBodyVerticalMovementDivergence(
        preparedStep.desiredMovementDelta.y,
        appliedMovementDelta.y,
        grounded
      ),
    desiredMovementDelta: preparedStep.desiredMovementDelta,
    supportingContactDetected: grounded
  });
  const resolvedStep = resolveMetaverseGroundedBodyStep(
    currentStepState,
    preparedStep,
    resolvedRootPosition,
    grounded,
    input.groundedBodyConfig,
    deltaSeconds,
    contactSnapshot,
    grounded ? support?.supportNormal ?? null : null
  );

  return createMetaverseGroundedBodyRuntimeSnapshotFromStepState(
    resolvedStep.state
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

function canConsumeMetaverseUnmountedGroundedJumpFromDirectSupport(input: {
  readonly currentDirectSupportKeepsGrounded: boolean;
  readonly groundedBodyConfig: MetaverseUnmountedGroundedTraversalConfigSnapshot;
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot;
  readonly supportHeightMeters: number | null;
}): boolean {
  if (input.groundedBodySnapshot.jumpBody.jumpReady === true) {
    return true;
  }

  if (
    input.currentDirectSupportKeepsGrounded !== true ||
    input.supportHeightMeters === null
  ) {
    return false;
  }

  if (input.groundedBodySnapshot.jumpBody.jumpSnapSuppressionActive === true) {
    return false;
  }

  if (
    toFiniteNumber(
      input.groundedBodySnapshot.jumpBody.verticalSpeedUnitsPerSecond,
      0
    ) > 0
  ) {
    return false;
  }

  const supportGapMeters =
    toFiniteNumber(input.groundedBodySnapshot.position.y, 0) -
    input.supportHeightMeters;

  return (
    supportGapMeters <=
    Math.max(
      0,
      toFiniteNumber(input.groundedBodyConfig.snapToGroundDistanceMeters, 0)
    )
  );
}

function shouldKeepMetaverseUnmountedGroundedBodySupported(input: {
  readonly directSupportKeepsGrounded: boolean;
  readonly groundedBodyConfig: MetaverseUnmountedGroundedTraversalConfigSnapshot;
  readonly groundedBodySnapshot: MetaverseUnmountedGroundedBodySnapshot;
  readonly supportHeightMeters: number | null;
}): boolean {
  if (input.groundedBodySnapshot.grounded === true) {
    return true;
  }

  if (
    input.directSupportKeepsGrounded !== true ||
    input.supportHeightMeters === null
  ) {
    return false;
  }

  if (input.groundedBodySnapshot.jumpBody.jumpSnapSuppressionActive === true) {
    return false;
  }

  if (
    toFiniteNumber(
      input.groundedBodySnapshot.jumpBody.verticalSpeedUnitsPerSecond,
      0
    ) > 0
  ) {
    return false;
  }

  const supportGapMeters =
    toFiniteNumber(input.groundedBodySnapshot.position.y, 0) -
    input.supportHeightMeters;

  return (
    supportGapMeters <=
    Math.max(
      0,
      toFiniteNumber(input.groundedBodyConfig.snapToGroundDistanceMeters, 0)
    )
  );
}

function prepareMetaverseUnmountedGroundedTraversalStep({
  actionState,
  bodyControl,
  deltaSeconds,
  groundedBodySnapshot,
  groundedBodyConfig,
  groundedSupport,
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
  const supportSnapshot = resolveMetaverseWorldSurfaceSupportSnapshot(
    surfacePolicyConfig,
    surfaceColliderSnapshots,
    groundedBodySnapshot.position.x,
    groundedBodySnapshot.position.z,
    surfacePolicyConfig.capsuleRadiusMeters,
    excludedOwnerEnvironmentAssetId,
    groundedBodySnapshot.position.y,
    groundedSupport
  );
  const supportHeightMeters = supportSnapshot?.supportHeightMeters ?? null;
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
    groundedBodyJumpReady:
      canConsumeMetaverseUnmountedGroundedJumpFromDirectSupport({
        currentDirectSupportKeepsGrounded,
        groundedBodyConfig,
        groundedBodySnapshot,
        supportHeightMeters
      })
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
    jumpRequested: traversalActionStep.jumpRequested,
    support: supportSnapshot
  });
}

function resolveMetaverseUnmountedGroundedTraversalOutcome({
  groundedBodyConfig,
  groundedBodySnapshot,
  preferredSupport = null,
  surfaceColliderSnapshots,
  surfacePolicyConfig,
  waterRegionSnapshots,
  excludedOwnerEnvironmentAssetId = null
}: ResolveMetaverseUnmountedGroundedTraversalOutcomeInput): ResolveMetaverseUnmountedGroundedTraversalOutcomeSnapshot {
  const resolvedSupport = resolveMetaverseWorldSurfaceSupportSnapshot(
    surfacePolicyConfig,
    surfaceColliderSnapshots,
    groundedBodySnapshot.position.x,
    groundedBodySnapshot.position.z,
    surfacePolicyConfig.capsuleRadiusMeters,
    excludedOwnerEnvironmentAssetId,
    groundedBodySnapshot.position.y,
    preferredSupport
  );
  const resolvedSupportHeightMeters =
    resolvedSupport?.supportHeightMeters ?? null;
  const automaticSurfaceSnapshot = resolveAutomaticSurfaceSnapshot(
    surfacePolicyConfig,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    groundedBodySnapshot.position,
    groundedBodySnapshot.yawRadians,
    "grounded",
    excludedOwnerEnvironmentAssetId,
    resolvedSupport ?? preferredSupport
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
  const grounded =
    shouldEnterSwim === false &&
    shouldKeepMetaverseUnmountedGroundedBodySupported({
      directSupportKeepsGrounded,
      groundedBodyConfig,
      groundedBodySnapshot,
      supportHeightMeters: resolvedSupportHeightMeters
    });
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
          support: null,
          supportHeightMeters: null
        } satisfies MetaverseTraversalStateDecision)
        } satisfies MetaverseTraversalStateResolutionSnapshot)
    : automaticSurfaceSnapshot;
  return Object.freeze({
    automaticSurfaceSnapshot: nextAutomaticSurfaceSnapshot,
    grounded,
    locomotionMode: shouldEnterSwim ? "swim" : "grounded",
    support:
      shouldEnterSwim === true
        ? null
        : resolvedSupport ?? automaticSurfaceSnapshot.decision.support,
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
    support: grounded ? nextLocomotionDecision.support : null,
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
      groundedSupport: traversalState.groundedSupport,
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
      support: groundedTraversalStep.support,
      traversalState: Object.freeze({
        actionState: groundedTraversalStep.actionState,
        groundedSupport: groundedTraversalStep.support,
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
      groundedSupport: null,
      locomotionMode: "swim"
    }),
    waterlineHeightMeters: resolveMetaverseTraversalWaterlineHeightMeters(
      waterRegionSnapshots,
      swimBodySnapshot.position
    )
  });
}

export function resolveMetaverseUnmountedTraversalStep({
  groundedBodyConfig,
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
      groundedBodyConfig,
      groundedBodySnapshot,
      preferredSupport: preparedTraversalStep.support,
      surfaceColliderSnapshots,
      surfacePolicyConfig,
      waterRegionSnapshots,
      excludedOwnerEnvironmentAssetId
    });

    return Object.freeze({
      automaticSurfaceSnapshot: locomotionOutcome.automaticSurfaceSnapshot,
      grounded: locomotionOutcome.grounded,
      locomotionMode: locomotionOutcome.locomotionMode,
      support: locomotionOutcome.support,
      supportHeightMeters: locomotionOutcome.supportHeightMeters,
      traversalState: Object.freeze({
        actionState: preparedTraversalStep.traversalState.actionState,
        groundedSupport:
          locomotionOutcome.locomotionMode === "grounded"
            ? locomotionOutcome.support
            : null,
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
    support: locomotionOutcome.support,
    supportHeightMeters: locomotionOutcome.supportHeightMeters,
    traversalState: Object.freeze({
      actionState: preparedTraversalStep.traversalState.actionState,
      groundedSupport:
        locomotionOutcome.locomotionMode === "grounded"
          ? locomotionOutcome.support
          : null,
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
  syncResolvedGroundedBodySnapshot,
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
      groundedBodyConfig: prepareInput.groundedBodyConfig,
      groundedBodySnapshot,
      preparedTraversalStep,
      surfaceColliderSnapshots: prepareInput.surfaceColliderSnapshots,
      surfacePolicyConfig: prepareInput.surfacePolicyConfig,
      swimBodySnapshot: null,
      waterRegionSnapshots: prepareInput.waterRegionSnapshots,
      excludedOwnerEnvironmentAssetId:
        prepareInput.excludedOwnerEnvironmentAssetId ?? null
    });
    const resolvedGroundedBodySnapshot =
      locomotionOutcome.locomotionMode === "grounded" &&
      groundedBodySnapshot.grounded !== locomotionOutcome.grounded
        ? syncResolvedGroundedBodySnapshot({
            grounded: locomotionOutcome.grounded,
            groundedBodySnapshot
          })
        : groundedBodySnapshot;
    const transitionSnapshot = resolveMetaverseUnmountedTraversalTransition({
      locomotionOutcome,
      preparedTraversalStep
    });

    return Object.freeze({
      groundedBodySnapshot: resolvedGroundedBodySnapshot,
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
    groundedBodyConfig: prepareInput.groundedBodyConfig,
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
