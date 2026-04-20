import type { MetaverseWorldSurfaceVector3Snapshot } from "./metaverse-world-surface-query.js";
import type {
  MetaverseTraversalBodyControlSnapshot
} from "./metaverse-traversal-contract.js";
import {
  createMetaverseSurfaceTraversalDriveTargetSnapshot,
  createMetaverseSurfaceTraversalVector3Snapshot,
  toFiniteNumber,
  wrapRadians,
  type MetaverseSurfaceTraversalDriveTargetSnapshot
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
import {
  createMetaverseGroundedJumpBodySnapshot,
  resolveMetaverseGroundedJumpContinuationSnapshot,
  resolveMetaverseGroundedJumpSynchronizedState
} from "./metaverse-grounded-jump-physics.js";

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
  extends MetaverseGroundedTraversalConfig {}

export interface MetaverseGroundedBodyStepIntentSnapshot
  extends MetaverseGroundedTraversalIntentSnapshot {
  readonly jumpReadyOverride?: boolean;
  readonly snapToGroundOverrideEnabled?: boolean;
}

export interface MetaverseGroundedBodyContactSnapshot {
  readonly appliedMovementDelta: MetaverseWorldSurfaceVector3Snapshot;
  readonly blockedPlanarMovement: boolean;
  readonly blockedVerticalMovement: boolean;
  readonly desiredMovementDelta: MetaverseWorldSurfaceVector3Snapshot;
  readonly supportingContactDetected: boolean;
}

export interface MetaverseGroundedBodyInteractionSnapshot {
  readonly applyImpulsesToDynamicBodies: boolean;
}

export interface MetaverseGroundedBodyStepStateSnapshot {
  readonly contact: MetaverseGroundedBodyContactSnapshot;
  readonly driveTarget: MetaverseSurfaceTraversalDriveTargetSnapshot;
  readonly forwardSpeedUnitsPerSecond: number;
  readonly grounded: boolean;
  readonly interaction: MetaverseGroundedBodyInteractionSnapshot;
  readonly jumpGroundContactGraceSecondsRemaining: number;
  readonly jumpReady: boolean;
  readonly jumpSnapSuppressionActive: boolean;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly strafeSpeedUnitsPerSecond: number;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseGroundedBodyPreparedStepSnapshot {
  readonly driveTarget: MetaverseSurfaceTraversalDriveTargetSnapshot;
  readonly desiredMovementDelta: MetaverseWorldSurfaceVector3Snapshot;
  readonly jumpRequested: boolean;
  readonly snapToGroundEnabled: boolean;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseGroundedBodyControllerResultSnapshot {
  readonly colliderCenterPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly computedGrounded: boolean;
  readonly computedMovementDelta: MetaverseWorldSurfaceVector3Snapshot;
  readonly standingOffsetMeters: number;
}

export interface MetaverseGroundedBodyResolvedStepSnapshot {
  readonly planarSpeedUnitsPerSecond: number;
  readonly state: MetaverseGroundedBodyStepStateSnapshot;
}

export interface SyncMetaverseGroundedBodyStepStateInput {
  readonly driveTarget?: MetaverseSurfaceTraversalDriveTargetSnapshot | null;
  readonly grounded: boolean;
  readonly interaction?: MetaverseGroundedBodyInteractionSnapshot | null;
  readonly linearVelocity: MetaverseWorldSurfaceVector3Snapshot;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

const groundedBodyContactDeltaEpsilon = 0.000001;

function normalizeFiniteNonNegativeSeconds(value: number): number {
  return Math.max(0, toFiniteNumber(value, 0));
}

function hasGroundedBodyMovementDeltaDivergence(
  desiredDelta: number,
  appliedDelta: number
): boolean {
  return (
    Math.abs(toFiniteNumber(desiredDelta, 0) - toFiniteNumber(appliedDelta, 0)) >
    groundedBodyContactDeltaEpsilon
  );
}

export function createMetaverseGroundedBodyContactSnapshot(
  input: Partial<MetaverseGroundedBodyContactSnapshot> = {}
): MetaverseGroundedBodyContactSnapshot {
  return Object.freeze({
    appliedMovementDelta: createMetaverseSurfaceTraversalVector3Snapshot(
      input.appliedMovementDelta?.x ?? 0,
      input.appliedMovementDelta?.y ?? 0,
      input.appliedMovementDelta?.z ?? 0
    ),
    blockedPlanarMovement: input.blockedPlanarMovement === true,
    blockedVerticalMovement: input.blockedVerticalMovement === true,
    desiredMovementDelta: createMetaverseSurfaceTraversalVector3Snapshot(
      input.desiredMovementDelta?.x ?? 0,
      input.desiredMovementDelta?.y ?? 0,
      input.desiredMovementDelta?.z ?? 0
    ),
    supportingContactDetected: input.supportingContactDetected === true
  });
}

export function createMetaverseGroundedBodyInteractionSnapshot(
  input: Partial<MetaverseGroundedBodyInteractionSnapshot> = {}
): MetaverseGroundedBodyInteractionSnapshot {
  return Object.freeze({
    applyImpulsesToDynamicBodies: input.applyImpulsesToDynamicBodies === true
  });
}

export function resolveMetaverseGroundedBodyControllerContactSnapshot(
  preparedStepSnapshot: MetaverseGroundedBodyPreparedStepSnapshot,
  controllerResultSnapshot: MetaverseGroundedBodyControllerResultSnapshot
): MetaverseGroundedBodyContactSnapshot {
  return createMetaverseGroundedBodyContactSnapshot({
    appliedMovementDelta: controllerResultSnapshot.computedMovementDelta,
    blockedPlanarMovement:
      hasGroundedBodyMovementDeltaDivergence(
        preparedStepSnapshot.desiredMovementDelta.x,
        controllerResultSnapshot.computedMovementDelta.x
      ) ||
      hasGroundedBodyMovementDeltaDivergence(
        preparedStepSnapshot.desiredMovementDelta.z,
        controllerResultSnapshot.computedMovementDelta.z
      ),
    blockedVerticalMovement:
      hasGroundedBodyMovementDeltaDivergence(
        preparedStepSnapshot.desiredMovementDelta.y,
        controllerResultSnapshot.computedMovementDelta.y
      ),
    desiredMovementDelta: preparedStepSnapshot.desiredMovementDelta,
    supportingContactDetected: controllerResultSnapshot.computedGrounded === true
  });
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
  const jumpBodySnapshot = createMetaverseGroundedJumpBodySnapshot({
    grounded: input.grounded === true,
    jumpGroundContactGraceSecondsRemaining:
      input.jumpGroundContactGraceSecondsRemaining ?? 0,
    jumpReady: input.jumpReady === true,
    jumpSnapSuppressionActive: input.jumpSnapSuppressionActive === true,
    verticalSpeedUnitsPerSecond: input.verticalSpeedUnitsPerSecond ?? 0
  });

  return Object.freeze({
    contact: createMetaverseGroundedBodyContactSnapshot(
      input.contact ?? {
        supportingContactDetected: jumpBodySnapshot.grounded
      }
    ),
    driveTarget: createMetaverseSurfaceTraversalDriveTargetSnapshot(
      input.driveTarget ?? {}
    ),
    forwardSpeedUnitsPerSecond: toFiniteNumber(
      input.forwardSpeedUnitsPerSecond ?? 0,
      0
    ),
    grounded: jumpBodySnapshot.grounded,
    interaction: createMetaverseGroundedBodyInteractionSnapshot(
      input.interaction ?? {}
    ),
    jumpGroundContactGraceSecondsRemaining:
      jumpBodySnapshot.jumpGroundContactGraceSecondsRemaining,
    jumpReady: jumpBodySnapshot.jumpReady,
    jumpSnapSuppressionActive:
      jumpBodySnapshot.jumpSnapSuppressionActive,
    position: createMetaverseSurfaceTraversalVector3Snapshot(
      input.position?.x ?? 0,
      input.position?.y ?? 0,
      input.position?.z ?? 0
    ),
    strafeSpeedUnitsPerSecond: toFiniteNumber(
      input.strafeSpeedUnitsPerSecond ?? 0,
      0
    ),
    verticalSpeedUnitsPerSecond:
      jumpBodySnapshot.verticalSpeedUnitsPerSecond,
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
    driveTarget: traversalPreparedStep.driveTarget,
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
  deltaSeconds: number,
  contactSnapshot: MetaverseGroundedBodyContactSnapshot | null = null
): MetaverseGroundedBodyResolvedStepSnapshot {
  const resolvedTraversalStep = resolveMetaverseGroundedTraversalStep(
    stateSnapshot.position,
    resolvedRootPosition,
    preparedStepSnapshot.yawRadians,
    grounded,
    deltaSeconds,
    config.worldRadius
  );
  const jumpContinuationSnapshot =
    resolveMetaverseGroundedJumpContinuationSnapshot({
      config,
      deltaSeconds,
      grounded: resolvedTraversalStep.grounded,
      jumpGroundContactGraceSecondsRemaining:
        stateSnapshot.jumpGroundContactGraceSecondsRemaining,
      jumpRequested: preparedStepSnapshot.jumpRequested,
      jumpSnapSuppressionActive:
        stateSnapshot.jumpSnapSuppressionActive
    });
  const stepState = createMetaverseGroundedBodyStepStateSnapshot({
    contact:
      contactSnapshot ??
      createMetaverseGroundedBodyContactSnapshot({
        appliedMovementDelta: createMetaverseSurfaceTraversalVector3Snapshot(
          resolvedTraversalStep.position.x - stateSnapshot.position.x,
          resolvedTraversalStep.position.y - stateSnapshot.position.y,
          resolvedTraversalStep.position.z - stateSnapshot.position.z
        ),
        desiredMovementDelta: createMetaverseSurfaceTraversalVector3Snapshot(
          resolvedTraversalStep.position.x - stateSnapshot.position.x,
          resolvedTraversalStep.position.y - stateSnapshot.position.y,
          resolvedTraversalStep.position.z - stateSnapshot.position.z
        ),
        supportingContactDetected: resolvedTraversalStep.grounded
      }),
    driveTarget: preparedStepSnapshot.driveTarget,
    forwardSpeedUnitsPerSecond:
      resolvedTraversalStep.forwardSpeedUnitsPerSecond,
    grounded: resolvedTraversalStep.grounded,
    interaction: stateSnapshot.interaction,
    jumpGroundContactGraceSecondsRemaining:
      jumpContinuationSnapshot.jumpGroundContactGraceSecondsRemaining,
    jumpReady: jumpContinuationSnapshot.jumpReady,
    jumpSnapSuppressionActive:
      jumpContinuationSnapshot.jumpSnapSuppressionActive,
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

export function resolveMetaverseGroundedBodyControllerStep(
  stateSnapshot: MetaverseGroundedBodyStepStateSnapshot,
  preparedStepSnapshot: MetaverseGroundedBodyPreparedStepSnapshot,
  controllerResultSnapshot: MetaverseGroundedBodyControllerResultSnapshot,
  config: MetaverseGroundedBodyStepConfig,
  deltaSeconds: number
): MetaverseGroundedBodyResolvedStepSnapshot {
  const standingOffsetMeters = Math.max(
    0,
    toFiniteNumber(controllerResultSnapshot.standingOffsetMeters, 0)
  );
  const contactSnapshot = resolveMetaverseGroundedBodyControllerContactSnapshot(
    preparedStepSnapshot,
    controllerResultSnapshot
  );

  return resolveMetaverseGroundedBodyStep(
    stateSnapshot,
    preparedStepSnapshot,
    createMetaverseSurfaceTraversalVector3Snapshot(
      controllerResultSnapshot.colliderCenterPosition.x +
        controllerResultSnapshot.computedMovementDelta.x,
      controllerResultSnapshot.colliderCenterPosition.y +
        controllerResultSnapshot.computedMovementDelta.y -
        standingOffsetMeters,
      controllerResultSnapshot.colliderCenterPosition.z +
        controllerResultSnapshot.computedMovementDelta.z
    ),
    controllerResultSnapshot.computedGrounded === true,
    config,
    deltaSeconds,
    contactSnapshot
  );
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
  const synchronizedJumpState =
    resolveMetaverseGroundedJumpSynchronizedState({
      config,
      currentJumpSnapSuppressionActive:
        currentStateSnapshot.jumpSnapSuppressionActive,
      grounded: syncInput.grounded === true
    });

  return createMetaverseGroundedBodyStepStateSnapshot({
    contact: createMetaverseGroundedBodyContactSnapshot({
      supportingContactDetected: syncInput.grounded === true
    }),
    driveTarget: createMetaverseSurfaceTraversalDriveTargetSnapshot(
      syncInput.driveTarget ?? currentStateSnapshot.driveTarget
    ),
    forwardSpeedUnitsPerSecond:
      directionalSpeedSnapshot.forwardSpeedUnitsPerSecond,
    grounded: syncInput.grounded,
    interaction:
      syncInput.interaction ?? currentStateSnapshot.interaction,
    jumpGroundContactGraceSecondsRemaining:
      synchronizedJumpState.jumpGroundContactGraceSecondsRemaining,
    jumpReady: synchronizedJumpState.jumpReady,
    jumpSnapSuppressionActive:
      synchronizedJumpState.jumpSnapSuppressionActive,
    position: syncInput.position,
    strafeSpeedUnitsPerSecond:
      directionalSpeedSnapshot.strafeSpeedUnitsPerSecond,
    verticalSpeedUnitsPerSecond:
      directionalSpeedSnapshot.verticalSpeedUnitsPerSecond,
    yawRadians: syncInput.yawRadians
  });
}
