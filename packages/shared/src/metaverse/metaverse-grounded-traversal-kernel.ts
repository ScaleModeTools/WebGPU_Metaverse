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
  resolveMetaverseGroundedJumpSynchronizedState,
  type MetaverseGroundedJumpBodySnapshot
} from "./metaverse-grounded-jump-physics.js";

export interface MetaverseGroundedTraversalBodyIntentSnapshot
  extends MetaverseTraversalBodyControlSnapshot {
  readonly jump: boolean;
  readonly snapToGroundOverrideEnabled?: boolean;
}

export interface StepMetaverseGroundedTraversalActionInput {
  readonly actionState: MetaverseTraversalActionStateSnapshot;
  readonly bodyControl: MetaverseTraversalBodyControlSnapshot;
  readonly deltaSeconds: number;
  readonly groundedBodyJumpReady: boolean;
}

export interface StepMetaverseGroundedTraversalActionResult {
  readonly actionState: MetaverseTraversalActionStateSnapshot;
  readonly bodyIntent: MetaverseGroundedTraversalBodyIntentSnapshot;
  readonly jumpRequested: boolean;
}

export interface MetaverseGroundedBodyStepConfig
  extends MetaverseGroundedTraversalConfig {}

export interface MetaverseGroundedBodyStepIntentSnapshot
  extends MetaverseGroundedTraversalIntentSnapshot {
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
  readonly supportNormal: MetaverseWorldSurfaceVector3Snapshot;
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

export interface MetaverseGroundedBodyResolvedStepSnapshot {
  readonly planarSpeedUnitsPerSecond: number;
  readonly state: MetaverseGroundedBodyStepStateSnapshot;
}

export interface SyncMetaverseGroundedBodyStepStateInput {
  readonly contact?: MetaverseGroundedBodyContactSnapshot | null;
  readonly driveTarget?: MetaverseSurfaceTraversalDriveTargetSnapshot | null;
  readonly grounded: boolean;
  readonly interaction?: MetaverseGroundedBodyInteractionSnapshot | null;
  readonly jumpBody?: MetaverseGroundedJumpBodySnapshot | null;
  readonly linearVelocity: MetaverseWorldSurfaceVector3Snapshot;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly supportNormal?: MetaverseWorldSurfaceVector3Snapshot | null;
  readonly yawRadians: number;
}

const groundedBodyMinimumJumpNormalY = 0.001;

const metaverseGroundedBodyDefaultSupportNormal =
  createMetaverseSurfaceTraversalVector3Snapshot(0, 1, 0);

function normalizeGroundedBodySupportNormal(
  normal: MetaverseWorldSurfaceVector3Snapshot | null | undefined
): MetaverseWorldSurfaceVector3Snapshot {
  const x = toFiniteNumber(normal?.x ?? 0, 0);
  const y = toFiniteNumber(normal?.y ?? 1, 1);
  const z = toFiniteNumber(normal?.z ?? 0, 0);
  const magnitude = Math.hypot(x, y, z);

  if (magnitude <= 0.000001 || y <= groundedBodyMinimumJumpNormalY) {
    return metaverseGroundedBodyDefaultSupportNormal;
  }

  return createMetaverseSurfaceTraversalVector3Snapshot(
    x / magnitude,
    y / magnitude,
    z / magnitude
  );
}

function resolveGroundedBodyStepSupportNormal(input: {
  readonly contactSupportNormal: MetaverseWorldSurfaceVector3Snapshot | null;
  readonly grounded: boolean;
  readonly jumpReady: boolean;
  readonly jumpRequested: boolean;
  readonly previousSupportNormal: MetaverseWorldSurfaceVector3Snapshot;
}): MetaverseWorldSurfaceVector3Snapshot {
  if (input.grounded) {
    return normalizeGroundedBodySupportNormal(
      input.contactSupportNormal ?? input.previousSupportNormal
    );
  }

  if (input.jumpReady && input.jumpRequested !== true) {
    return normalizeGroundedBodySupportNormal(input.previousSupportNormal);
  }

  return metaverseGroundedBodyDefaultSupportNormal;
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

export function stepMetaverseGroundedTraversalAction({
  actionState,
  bodyControl,
  deltaSeconds,
  groundedBodyJumpReady
}: StepMetaverseGroundedTraversalActionInput): StepMetaverseGroundedTraversalActionResult {
  const nextActionState = advanceMetaverseTraversalActionState(actionState, {
    canConsumePendingAction: groundedBodyJumpReady === true,
    deltaSeconds
  });
  const jumpRequested = nextActionState.actionConsumed;

  return Object.freeze({
    actionState: nextActionState.state,
    bodyIntent: Object.freeze({
      ...bodyControl,
      jump: jumpRequested
    }),
    jumpRequested
  });
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
    supportNormal: normalizeGroundedBodySupportNormal(input.supportNormal),
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
      jumpReady: stateSnapshot.jumpReady,
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

  if (traversalPreparedStep.jumpRequested) {
    const supportNormal = normalizeGroundedBodySupportNormal(
      stateSnapshot.supportNormal
    );
    const jumpImpulseUnitsPerSecond = Math.max(
      0,
      toFiniteNumber(config.jumpImpulseUnitsPerSecond, 0)
    );
    const verticalSpeedUnitsPerSecond =
      Math.max(
        toFiniteNumber(stateSnapshot.verticalSpeedUnitsPerSecond, 0),
        supportNormal.y * jumpImpulseUnitsPerSecond
      ) -
      Math.max(0, toFiniteNumber(config.gravityUnitsPerSecond, 0)) *
        Math.max(0, toFiniteNumber(deltaSeconds, 0));

    return Object.freeze({
      driveTarget: traversalPreparedStep.driveTarget,
      desiredMovementDelta: createMetaverseSurfaceTraversalVector3Snapshot(
        traversalPreparedStep.desiredMovementDelta.x +
          supportNormal.x * jumpImpulseUnitsPerSecond * deltaSeconds,
        verticalSpeedUnitsPerSecond * deltaSeconds,
        traversalPreparedStep.desiredMovementDelta.z +
          supportNormal.z * jumpImpulseUnitsPerSecond * deltaSeconds
      ),
      jumpRequested: traversalPreparedStep.jumpRequested,
      snapToGroundEnabled: false,
      verticalSpeedUnitsPerSecond,
      yawRadians: traversalPreparedStep.yawRadians
    });
  }

  return Object.freeze({
    driveTarget: traversalPreparedStep.driveTarget,
    desiredMovementDelta: traversalPreparedStep.desiredMovementDelta,
    jumpRequested: traversalPreparedStep.jumpRequested,
    snapToGroundEnabled:
      intentSnapshot.snapToGroundOverrideEnabled ??
      (stateSnapshot.jumpSnapSuppressionActive !== true &&
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
  contactSnapshot: MetaverseGroundedBodyContactSnapshot | null = null,
  supportNormalSnapshot: MetaverseWorldSurfaceVector3Snapshot | null = null
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
  const supportNormal = resolveGroundedBodyStepSupportNormal({
    contactSupportNormal: supportNormalSnapshot,
    grounded: resolvedTraversalStep.grounded,
    jumpReady: jumpContinuationSnapshot.jumpReady,
    jumpRequested: preparedStepSnapshot.jumpRequested,
    previousSupportNormal: stateSnapshot.supportNormal
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
    supportNormal,
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
  const synchronizedJumpState =
    syncInput.jumpBody === null || syncInput.jumpBody === undefined
      ? resolveMetaverseGroundedJumpSynchronizedState({
          config,
          currentJumpSnapSuppressionActive:
            currentStateSnapshot.jumpSnapSuppressionActive,
          grounded: syncInput.grounded === true
        })
      : syncInput.jumpBody;

  return createMetaverseGroundedBodyStepStateSnapshot({
    contact:
      syncInput.contact ??
      createMetaverseGroundedBodyContactSnapshot({
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
    supportNormal: syncInput.supportNormal ?? currentStateSnapshot.supportNormal,
    verticalSpeedUnitsPerSecond:
      syncInput.jumpBody === null || syncInput.jumpBody === undefined
        ? directionalSpeedSnapshot.verticalSpeedUnitsPerSecond
        : syncInput.jumpBody.verticalSpeedUnitsPerSecond,
    yawRadians: syncInput.yawRadians
  });
}
