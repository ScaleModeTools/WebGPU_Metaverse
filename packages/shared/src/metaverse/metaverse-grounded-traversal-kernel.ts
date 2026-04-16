import type { MetaverseWorldSurfaceVector3Snapshot } from "./metaverse-world-surface-query.js";
import type {
  MetaverseTraversalBodyControlSnapshot
} from "./metaverse-traversal-contract.js";
import {
  createMetaverseSurfaceTraversalVector3Snapshot,
  toFiniteNumber,
  wrapRadians
} from "./metaverse-surface-traversal-simulation.js";
import {
  advanceMetaverseTraversalActionState,
  type MetaverseTraversalActionStateSnapshot
} from "./metaverse-traversal-action-kernel.js";
import {
  prepareMetaverseGroundedTraversalStep,
  resolveMetaverseGroundedTraversalDirectionalSpeeds,
  resolveMetaverseGroundedTraversalStep,
  type MetaverseGroundedTraversalConfig,
  type MetaverseGroundedTraversalIntentSnapshot
} from "./metaverse-grounded-traversal-simulation.js";

export interface MetaverseGroundedTraversalBodyIntentSnapshot
  extends MetaverseTraversalBodyControlSnapshot {
  readonly jump: boolean;
  readonly jumpReadyOverride: boolean;
  readonly snapToGroundOverrideEnabled?: boolean;
}

export interface StepMetaverseGroundedTraversalActionInput {
  readonly actionState: MetaverseTraversalActionStateSnapshot;
  readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
  readonly deltaSeconds: number;
  readonly groundedBodyJumpReady: boolean;
  readonly surfaceJumpSupported: boolean;
}

export interface StepMetaverseGroundedTraversalActionResult {
  readonly actionState: MetaverseTraversalActionStateSnapshot;
  readonly bodyIntent: MetaverseGroundedTraversalBodyIntentSnapshot;
  readonly groundedJumpSupported: boolean;
  readonly jumpRequested: boolean;
}

export interface MetaverseGroundedTraversalSurfaceJumpSupportInput {
  readonly controllerOffsetMeters: number;
  readonly positionY: number;
  readonly snapToGroundDistanceMeters: number;
  readonly supportHeightMeters: number | null;
  readonly verticalSpeedTolerance: number;
  readonly verticalSpeedUnitsPerSecond: number;
}

export interface MetaverseGroundedBodyStepConfig
  extends MetaverseGroundedTraversalConfig {
  readonly jumpGroundContactGraceSeconds?: number;
}

export interface MetaverseGroundedBodyStepIntentSnapshot
  extends MetaverseGroundedTraversalIntentSnapshot {
  readonly jumpReadyOverride?: boolean;
  readonly snapToGroundOverrideEnabled?: boolean;
}

export interface MetaverseGroundedBodyStepStateSnapshot {
  readonly forwardSpeedUnitsPerSecond: number;
  readonly grounded: boolean;
  readonly jumpGroundContactGraceSecondsRemaining: number;
  readonly jumpReady: boolean;
  readonly jumpSnapSuppressionActive: boolean;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly strafeSpeedUnitsPerSecond: number;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseGroundedBodyPreparedStepSnapshot {
  readonly desiredMovementDelta: MetaverseWorldSurfaceVector3Snapshot;
  readonly jumpRequested: boolean;
  readonly snapToGroundEnabled: boolean;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseGroundedBodyResolvedStepSnapshot {
  readonly planarSpeedUnitsPerSecond: number;
  readonly state: MetaverseGroundedBodyStepStateSnapshot;
}

export interface SyncMetaverseGroundedBodyStepStateInput {
  readonly grounded: boolean;
  readonly linearVelocity: MetaverseWorldSurfaceVector3Snapshot;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

function normalizeFiniteNonNegativeSeconds(value: number): number {
  return Math.max(0, toFiniteNumber(value, 0));
}

export function stepMetaverseGroundedTraversalAction({
  actionState,
  bodyControl,
  deltaSeconds,
  groundedBodyJumpReady,
  surfaceJumpSupported
}: StepMetaverseGroundedTraversalActionInput): StepMetaverseGroundedTraversalActionResult {
  const groundedJumpSupported =
    groundedBodyJumpReady === true || surfaceJumpSupported === true;
  const nextActionState = advanceMetaverseTraversalActionState(actionState, {
    canConsumePendingAction: groundedJumpSupported,
    deltaSeconds
  });
  const jumpRequested = nextActionState.actionConsumed;

  return Object.freeze({
    actionState: nextActionState.state,
    bodyIntent: Object.freeze({
      ...bodyControl,
      jump: jumpRequested,
      jumpReadyOverride: groundedJumpSupported
    }),
    groundedJumpSupported,
    jumpRequested
  });
}

export function isMetaverseGroundedTraversalSurfaceJumpSupported({
  controllerOffsetMeters,
  positionY,
  snapToGroundDistanceMeters,
  supportHeightMeters,
  verticalSpeedTolerance,
  verticalSpeedUnitsPerSecond
}: MetaverseGroundedTraversalSurfaceJumpSupportInput): boolean {
  if (
    supportHeightMeters === null ||
    !Number.isFinite(supportHeightMeters) ||
    toFiniteNumber(verticalSpeedUnitsPerSecond, 0) >
      Math.max(0, toFiniteNumber(verticalSpeedTolerance, 0))
  ) {
    return false;
  }

  return (
    Math.abs(toFiniteNumber(positionY, 0) - supportHeightMeters) <=
    Math.max(0, toFiniteNumber(snapToGroundDistanceMeters, 0)) +
      Math.max(0, toFiniteNumber(controllerOffsetMeters, 0))
  );
}

export function createMetaverseGroundedBodyStepStateSnapshot(
  input: Partial<MetaverseGroundedBodyStepStateSnapshot> = {}
): MetaverseGroundedBodyStepStateSnapshot {
  const grounded = input.grounded === true;
  const jumpGroundContactGraceSecondsRemaining =
    grounded
      ? Math.max(
          normalizeFiniteNonNegativeSeconds(
            input.jumpGroundContactGraceSecondsRemaining ?? 0
          ),
          0
        )
      : normalizeFiniteNonNegativeSeconds(
          input.jumpGroundContactGraceSecondsRemaining ?? 0
        );
  const jumpReady =
    grounded ||
    jumpGroundContactGraceSecondsRemaining > 0 ||
    input.jumpReady === true;

  return Object.freeze({
    forwardSpeedUnitsPerSecond: toFiniteNumber(
      input.forwardSpeedUnitsPerSecond ?? 0,
      0
    ),
    grounded,
    jumpGroundContactGraceSecondsRemaining,
    jumpReady,
    jumpSnapSuppressionActive:
      grounded === true ? false : input.jumpSnapSuppressionActive === true,
    position: createMetaverseSurfaceTraversalVector3Snapshot(
      input.position?.x ?? 0,
      input.position?.y ?? 0,
      input.position?.z ?? 0
    ),
    strafeSpeedUnitsPerSecond: toFiniteNumber(
      input.strafeSpeedUnitsPerSecond ?? 0,
      0
    ),
    verticalSpeedUnitsPerSecond: grounded
      ? 0
      : toFiniteNumber(input.verticalSpeedUnitsPerSecond ?? 0, 0),
    yawRadians: wrapRadians(input.yawRadians ?? 0)
  });
}

export function prepareMetaverseGroundedBodyStep(
  stateSnapshot: MetaverseGroundedBodyStepStateSnapshot,
  intentSnapshot: MetaverseGroundedBodyStepIntentSnapshot,
  config: MetaverseGroundedBodyStepConfig,
  deltaSeconds: number,
  preferredLookYawRadians: number | null = null
): MetaverseGroundedBodyPreparedStepSnapshot {
  const traversalPreparedStep = prepareMetaverseGroundedTraversalStep(
    {
      forwardSpeedUnitsPerSecond: stateSnapshot.forwardSpeedUnitsPerSecond,
      grounded: stateSnapshot.grounded,
      jumpReady: intentSnapshot.jumpReadyOverride ?? stateSnapshot.jumpReady,
      position: stateSnapshot.position,
      strafeSpeedUnitsPerSecond: stateSnapshot.strafeSpeedUnitsPerSecond,
      verticalSpeedUnitsPerSecond: stateSnapshot.verticalSpeedUnitsPerSecond,
      yawRadians: stateSnapshot.yawRadians
    },
    {
      boost: intentSnapshot.boost,
      jump: intentSnapshot.jump,
      moveAxis: intentSnapshot.moveAxis,
      strafeAxis: intentSnapshot.strafeAxis,
      turnAxis: intentSnapshot.turnAxis
    },
    config,
    deltaSeconds,
    preferredLookYawRadians
  );

  return Object.freeze({
    desiredMovementDelta: traversalPreparedStep.desiredMovementDelta,
    jumpRequested: traversalPreparedStep.jumpRequested,
    snapToGroundEnabled:
      intentSnapshot.snapToGroundOverrideEnabled ??
      (stateSnapshot.jumpSnapSuppressionActive !== true &&
        traversalPreparedStep.jumpRequested !== true &&
        traversalPreparedStep.verticalSpeedUnitsPerSecond <= 0),
    verticalSpeedUnitsPerSecond:
      traversalPreparedStep.verticalSpeedUnitsPerSecond,
    yawRadians: traversalPreparedStep.yawRadians
  });
}

export function resolveMetaverseGroundedBodyStep(
  stateSnapshot: MetaverseGroundedBodyStepStateSnapshot,
  preparedStepSnapshot: MetaverseGroundedBodyPreparedStepSnapshot,
  resolvedRootPosition: MetaverseWorldSurfaceVector3Snapshot,
  grounded: boolean,
  config: MetaverseGroundedBodyStepConfig,
  deltaSeconds: number
): MetaverseGroundedBodyResolvedStepSnapshot {
  const resolvedTraversalStep = resolveMetaverseGroundedTraversalStep(
    stateSnapshot.position,
    resolvedRootPosition,
    preparedStepSnapshot.yawRadians,
    grounded,
    deltaSeconds,
    config.worldRadius
  );
  const jumpGroundContactGraceSecondsRemaining =
    preparedStepSnapshot.jumpRequested === true
      ? 0
      : resolvedTraversalStep.grounded
        ? normalizeFiniteNonNegativeSeconds(
            config.jumpGroundContactGraceSeconds ?? 0
          )
        : Math.max(
            0,
            stateSnapshot.jumpGroundContactGraceSecondsRemaining -
              Math.max(0, toFiniteNumber(deltaSeconds, 0))
          );
  const stepState = createMetaverseGroundedBodyStepStateSnapshot({
    forwardSpeedUnitsPerSecond:
      resolvedTraversalStep.forwardSpeedUnitsPerSecond,
    grounded: resolvedTraversalStep.grounded,
    jumpGroundContactGraceSecondsRemaining,
    jumpReady:
      resolvedTraversalStep.grounded ||
      jumpGroundContactGraceSecondsRemaining > 0,
    jumpSnapSuppressionActive: resolvedTraversalStep.grounded
      ? false
      : stateSnapshot.jumpSnapSuppressionActive === true ||
          preparedStepSnapshot.jumpRequested === true,
    position: resolvedTraversalStep.position,
    strafeSpeedUnitsPerSecond:
      resolvedTraversalStep.strafeSpeedUnitsPerSecond,
    verticalSpeedUnitsPerSecond:
      resolvedTraversalStep.verticalSpeedUnitsPerSecond,
    yawRadians: resolvedTraversalStep.yawRadians
  });

  return Object.freeze({
    planarSpeedUnitsPerSecond: resolvedTraversalStep.planarSpeedUnitsPerSecond,
    state: stepState
  });
}

export function syncMetaverseGroundedBodyStepState(
  currentStateSnapshot: MetaverseGroundedBodyStepStateSnapshot,
  syncInput: SyncMetaverseGroundedBodyStepStateInput,
  config: MetaverseGroundedBodyStepConfig
): MetaverseGroundedBodyStepStateSnapshot {
  const directionalSpeedSnapshot =
    resolveMetaverseGroundedTraversalDirectionalSpeeds(
      syncInput.linearVelocity,
      syncInput.yawRadians,
      syncInput.grounded === true
    );

  return createMetaverseGroundedBodyStepStateSnapshot({
    forwardSpeedUnitsPerSecond:
      directionalSpeedSnapshot.forwardSpeedUnitsPerSecond,
    grounded: syncInput.grounded,
    jumpGroundContactGraceSecondsRemaining:
      syncInput.grounded === true
        ? normalizeFiniteNonNegativeSeconds(
            config.jumpGroundContactGraceSeconds ?? 0
          )
        : 0,
    jumpReady: syncInput.grounded === true,
    jumpSnapSuppressionActive:
      syncInput.grounded === true
        ? false
        : currentStateSnapshot.jumpSnapSuppressionActive,
    position: syncInput.position,
    strafeSpeedUnitsPerSecond:
      directionalSpeedSnapshot.strafeSpeedUnitsPerSecond,
    verticalSpeedUnitsPerSecond:
      directionalSpeedSnapshot.verticalSpeedUnitsPerSecond,
    yawRadians: syncInput.yawRadians
  });
}
