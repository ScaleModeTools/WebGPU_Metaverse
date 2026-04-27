import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  type MetaverseGroundedBodyConfigSnapshot,
  type MetaverseGroundedBodyRuntimeSnapshot,
  type MetaverseGroundedBodyStepIntentSnapshot,
  createMetaverseGroundedBodyInteractionSnapshot,
  resolveMetaverseGroundedBodyColliderTranslationSnapshot,
  createMetaverseGroundedJumpPhysicsConfigSnapshot,
  createMetaverseGroundedJumpBodySnapshot,
  clamp,
  createMetaverseGroundedBodyStepStateSnapshot,
  createMetaverseSurfaceTraversalVector3Snapshot as freezeVector3,
  prepareMetaverseGroundedBodyStep,
  resolveMetaverseGroundedBodyControllerStep,
  resolveMetaverseTraversalLinearVelocitySnapshot,
  syncMetaverseGroundedBodyStepState,
  toFiniteNumber,
  wrapRadians,
  type MetaverseGroundedBodyStepStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

import { MetaverseAuthoritativeRapierPhysicsRuntime } from "./metaverse-authoritative-rapier-physics-runtime.js";
import type {
  PhysicsVector3Snapshot,
  RapierCharacterControllerHandle,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../types/metaverse-authoritative-rapier.js";

export type MetaverseAuthoritativeGroundedBodyIntentSnapshot =
  MetaverseGroundedBodyStepIntentSnapshot;
export type MetaverseAuthoritativeGroundedBodySnapshot =
  MetaverseGroundedBodyRuntimeSnapshot;
export type MetaverseAuthoritativeGroundedBodyConfig =
  MetaverseGroundedBodyConfigSnapshot;

function sanitizeConfig(
  config: MetaverseAuthoritativeGroundedBodyConfig
): MetaverseAuthoritativeGroundedBodyConfig {
  const groundedJumpPhysics = createMetaverseGroundedJumpPhysicsConfigSnapshot({
    airborneMovementDampingFactor: config.airborneMovementDampingFactor,
    gravityUnitsPerSecond: config.gravityUnitsPerSecond,
    jumpGroundContactGraceSeconds: config.jumpGroundContactGraceSeconds,
    jumpImpulseUnitsPerSecond: config.jumpImpulseUnitsPerSecond
  });

  return Object.freeze({
    accelerationCurveExponent: Math.max(
      0.1,
      toFiniteNumber(config.accelerationCurveExponent, 1.2)
    ),
    accelerationUnitsPerSecondSquared: Math.max(
      0.1,
      toFiniteNumber(config.accelerationUnitsPerSecondSquared, 20)
    ),
    airborneMovementDampingFactor:
      groundedJumpPhysics.airborneMovementDampingFactor,
    baseSpeedUnitsPerSecond: Math.max(
      0,
      toFiniteNumber(config.baseSpeedUnitsPerSecond, 6)
    ),
    boostCurveExponent: Math.max(
      0.1,
      toFiniteNumber(config.boostCurveExponent, 1.1)
    ),
    boostMultiplier: Math.max(1, toFiniteNumber(config.boostMultiplier, 1.65)),
    capsuleHalfHeightMeters: Math.max(
      0.05,
      toFiniteNumber(config.capsuleHalfHeightMeters, 0.48)
    ),
    capsuleRadiusMeters: Math.max(
      0.05,
      toFiniteNumber(config.capsuleRadiusMeters, 0.34)
    ),
    controllerOffsetMeters: Math.max(
      0.001,
      toFiniteNumber(config.controllerOffsetMeters, 0.01)
    ),
    decelerationUnitsPerSecondSquared: Math.max(
      0.1,
      toFiniteNumber(config.decelerationUnitsPerSecondSquared, 26)
    ),
    dragCurveExponent: Math.max(
      0.1,
      toFiniteNumber(config.dragCurveExponent, 1.45)
    ),
    gravityUnitsPerSecond: groundedJumpPhysics.gravityUnitsPerSecond,
    jumpGroundContactGraceSeconds:
      groundedJumpPhysics.jumpGroundContactGraceSeconds,
    jumpImpulseUnitsPerSecond:
      groundedJumpPhysics.jumpImpulseUnitsPerSecond,
    maxSlopeClimbAngleRadians: clamp(
      toFiniteNumber(config.maxSlopeClimbAngleRadians, Math.PI * 0.26),
      0,
      Math.PI * 0.5
    ),
    minSlopeSlideAngleRadians: clamp(
      toFiniteNumber(config.minSlopeSlideAngleRadians, Math.PI * 0.34),
      0,
      Math.PI * 0.5
    ),
    maxTurnSpeedRadiansPerSecond: Math.max(
      0,
      toFiniteNumber(config.maxTurnSpeedRadiansPerSecond, 1.9)
    ),
    snapToGroundDistanceMeters: Math.max(
      0,
      toFiniteNumber(config.snapToGroundDistanceMeters, 0.22)
    ),
    stepHeightMeters: Math.max(
      0,
      toFiniteNumber(config.stepHeightMeters, 0.28)
    ),
    stepWidthMeters: Math.max(
      0.01,
      toFiniteNumber(config.stepWidthMeters, 0.24)
    ),
    spawnPosition: freezeVector3(
      config.spawnPosition.x,
      config.spawnPosition.y,
      config.spawnPosition.z
    ),
    worldRadius: Math.max(1, toFiniteNumber(config.worldRadius, 110))
  });
}

function freezeSnapshot(
  stepState: MetaverseGroundedBodyStepStateSnapshot
): MetaverseAuthoritativeGroundedBodySnapshot {
  const jumpBodySnapshot = createMetaverseGroundedJumpBodySnapshot({
    grounded: stepState.grounded,
    jumpGroundContactGraceSecondsRemaining:
      stepState.jumpGroundContactGraceSecondsRemaining,
    jumpReady: stepState.jumpReady,
    jumpSnapSuppressionActive: stepState.jumpSnapSuppressionActive,
    verticalSpeedUnitsPerSecond: stepState.verticalSpeedUnitsPerSecond
  });
  const linearVelocity = resolveMetaverseTraversalLinearVelocitySnapshot(
    {
      forwardSpeedUnitsPerSecond: stepState.forwardSpeedUnitsPerSecond,
      strafeSpeedUnitsPerSecond: stepState.strafeSpeedUnitsPerSecond,
      verticalSpeedUnitsPerSecond:
        jumpBodySnapshot.verticalSpeedUnitsPerSecond
    },
    stepState.yawRadians
  );

  return createMetaverseGroundedBodyRuntimeSnapshot({
    contact: stepState.contact,
    driveTarget: stepState.driveTarget,
    grounded: jumpBodySnapshot.grounded,
    interaction: stepState.interaction,
    jumpBody: jumpBodySnapshot,
    linearVelocity,
    position: stepState.position,
    yawRadians: wrapRadians(stepState.yawRadians)
  });
}

function resolveRapierControllerSupportNormal(
  controller: RapierCharacterControllerHandle
): PhysicsVector3Snapshot | null {
  const collisionCount = Math.max(
    0,
    Math.floor(toFiniteNumber(controller.numComputedCollisions?.() ?? 0, 0))
  );
  let selectedNormal: PhysicsVector3Snapshot | null = null;
  let selectedY = 0;

  for (let collisionIndex = 0; collisionIndex < collisionCount; collisionIndex += 1) {
    const normal =
      controller.computedCollision?.(collisionIndex)?.normal1 ?? null;

    if (normal === null) {
      continue;
    }

    const x = toFiniteNumber(normal.x, 0);
    const y = toFiniteNumber(normal.y, 0);
    const z = toFiniteNumber(normal.z, 0);
    const magnitude = Math.hypot(x, y, z);

    if (magnitude <= 0.000001) {
      continue;
    }

    const normalizedY = y / magnitude;

    if (normalizedY <= 0 || normalizedY <= selectedY) {
      continue;
    }

    selectedNormal = freezeVector3(
      x / magnitude,
      normalizedY,
      z / magnitude
    );
    selectedY = normalizedY;
  }

  return selectedNormal;
}

export class MetaverseAuthoritativeGroundedBodyRuntime {
  readonly #config: MetaverseAuthoritativeGroundedBodyConfig;
  readonly #physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly #characterController: RapierCharacterControllerHandle;
  readonly #collider: RapierColliderHandle;

  #autostepEnabled = true;
  #autostepHeightMeters: number;
  #stepState: MetaverseGroundedBodyStepStateSnapshot;
  #snapshot: MetaverseAuthoritativeGroundedBodySnapshot;

  constructor(
    config: MetaverseAuthoritativeGroundedBodyConfig,
    physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime
  ) {
    this.#config = sanitizeConfig(config);
    this.#physicsRuntime = physicsRuntime;
    this.#autostepHeightMeters = this.#config.stepHeightMeters;
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: this.#config.spawnPosition
    });
    this.#snapshot = freezeSnapshot(this.#stepState);
    this.#characterController = this.#physicsRuntime.createCharacterController(
      this.#config.controllerOffsetMeters
    );
    this.#characterController.setUp?.(this.#physicsRuntime.createVector3(0, 1, 0));
    this.#characterController.setApplyImpulsesToDynamicBodies(
      this.#snapshot.interaction.applyImpulsesToDynamicBodies
    );
    this.#characterController.setCharacterMass(1);
    this.#syncSnapToGroundConfiguration(true);
    this.#characterController.setMaxSlopeClimbAngle?.(
      this.#config.maxSlopeClimbAngleRadians
    );
    this.#characterController.setMinSlopeSlideAngle?.(
      this.#config.minSlopeSlideAngleRadians
    );
    this.#syncAutostepConfiguration();
    this.#collider = this.#physicsRuntime.createCapsuleCollider(
      this.#config.capsuleHalfHeightMeters,
      this.#config.capsuleRadiusMeters,
      this.#rootToColliderCenter(this.#config.spawnPosition)
    );
  }

  get colliderHandle(): RapierColliderHandle {
    return this.#collider;
  }

  get snapshot(): MetaverseAuthoritativeGroundedBodySnapshot {
    return this.#snapshot;
  }

  syncInteractionSnapshot(snapshot: {
    readonly applyImpulsesToDynamicBodies: boolean;
  }): void {
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      ...this.#stepState,
      interaction: createMetaverseGroundedBodyInteractionSnapshot(snapshot)
    });
    this.#syncSnapshotFromStepState();
    this.#characterController.setApplyImpulsesToDynamicBodies(
      this.#snapshot.interaction.applyImpulsesToDynamicBodies
    );
  }

  setAutostepEnabled(
    enabled: boolean,
    maxHeightMeters = this.#config.stepHeightMeters
  ): void {
    this.#autostepEnabled = enabled;
    this.#autostepHeightMeters = Math.max(
      this.#config.stepHeightMeters,
      toFiniteNumber(maxHeightMeters, this.#config.stepHeightMeters)
    );
    this.#syncAutostepConfiguration();
  }

  syncAuthoritativeState(snapshot: {
    readonly driveTarget?: MetaverseAuthoritativeGroundedBodySnapshot["driveTarget"] | null;
    readonly grounded: boolean;
    readonly interaction?:
      | MetaverseAuthoritativeGroundedBodySnapshot["interaction"]
      | null;
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void {
    const sanitizedPosition = freezeVector3(
      snapshot.position.x,
      snapshot.position.y,
      snapshot.position.z
    );
    this.#collider.setTranslation(this.#rootToColliderCenter(sanitizedPosition));
    this.#stepState = syncMetaverseGroundedBodyStepState(
      this.#stepState,
      {
        driveTarget: snapshot.driveTarget ?? null,
        grounded: snapshot.grounded,
        interaction: snapshot.interaction ?? this.#stepState.interaction,
        linearVelocity: snapshot.linearVelocity,
        position: sanitizedPosition,
        yawRadians: snapshot.yawRadians
      },
      this.#config
    );
    this.#syncSnapshotFromStepState();
  }

  advance(
    intentSnapshot: MetaverseAuthoritativeGroundedBodyIntentSnapshot,
    deltaSeconds: number,
    preferredLookYawRadians: number | null = null,
    filterPredicate?: RapierQueryFilterPredicate,
    resolveBlockedPlanarPosition?: (
      rootPosition: PhysicsVector3Snapshot
    ) => Pick<PhysicsVector3Snapshot, "x" | "y" | "z">
  ): MetaverseAuthoritativeGroundedBodySnapshot {
    if (deltaSeconds <= 0) {
      return this.#snapshot;
    }

    const preparedStep = prepareMetaverseGroundedBodyStep(
      this.#stepState,
      intentSnapshot,
      this.#config,
      deltaSeconds,
      preferredLookYawRadians
    );
    const desiredMovement = this.#physicsRuntime.createVector3(
      preparedStep.desiredMovementDelta.x,
      preparedStep.desiredMovementDelta.y,
      preparedStep.desiredMovementDelta.z
    );
    this.#syncSnapToGroundConfiguration(preparedStep.snapToGroundEnabled);

    this.#characterController.computeColliderMovement(
      this.#collider,
      desiredMovement,
      undefined,
      undefined,
      filterPredicate
    );

    const currentTranslation = this.#collider.translation();
    const computedMovement = this.#characterController.computedMovement();
    const computedRootPosition = this.#colliderCenterToRoot(
      freezeVector3(
        currentTranslation.x + computedMovement.x,
        currentTranslation.y + computedMovement.y,
        currentTranslation.z + computedMovement.z
      )
    );
    const blockedRootPosition =
      resolveBlockedPlanarPosition?.(computedRootPosition) ??
      computedRootPosition;
    const blockedColliderCenter = this.#rootToColliderCenter(
      freezeVector3(
        blockedRootPosition.x,
        blockedRootPosition.y,
        blockedRootPosition.z
      )
    );
    const resolvedStep = resolveMetaverseGroundedBodyControllerStep(
      this.#stepState,
      preparedStep,
      {
        colliderCenterPosition: freezeVector3(
          currentTranslation.x,
          currentTranslation.y,
          currentTranslation.z
        ),
        computedGrounded: this.#characterController.computedGrounded(),
        computedMovementDelta: freezeVector3(
          blockedColliderCenter.x - currentTranslation.x,
          blockedColliderCenter.y - currentTranslation.y,
          blockedColliderCenter.z - currentTranslation.z
        ),
        standingOffsetMeters: this.#standingOffsetMeters,
        supportNormal: resolveRapierControllerSupportNormal(
          this.#characterController
        )
      },
      this.#config,
      deltaSeconds
    );

    this.#stepState = resolvedStep.state;
    this.#collider.setTranslation(this.#rootToColliderCenter(this.#stepState.position));
    this.#syncSnapshotFromStepState();

    return this.#snapshot;
  }

  teleport(position: PhysicsVector3Snapshot, yawRadians: number): void {
    const sanitizedPosition = freezeVector3(position.x, position.y, position.z);

    this.#collider.setTranslation(this.#rootToColliderCenter(sanitizedPosition));
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: sanitizedPosition,
      yawRadians
    });
    this.#syncSnapshotFromStepState();
  }

  dispose(): void {
    this.#physicsRuntime.removeCollider(this.#collider);
    this.#characterController.free?.();
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: this.#config.spawnPosition,
      yawRadians: this.#stepState.yawRadians
    });
    this.#syncSnapshotFromStepState();
  }

  get #standingOffsetMeters(): number {
    return (
      this.#config.capsuleHalfHeightMeters + this.#config.capsuleRadiusMeters
    );
  }

  #syncAutostepConfiguration(): void {
    if (this.#autostepEnabled) {
      this.#characterController.enableAutostep(
        this.#autostepHeightMeters,
        this.#config.stepWidthMeters,
        false
      );
      return;
    }

    this.#characterController.disableAutostep?.();
  }

  #syncSnapToGroundConfiguration(enabled: boolean): void {
    this.#characterController.enableSnapToGround(
      enabled ? this.#config.snapToGroundDistanceMeters : 0
    );
  }

  #syncSnapshotFromStepState(): void {
    this.#snapshot = freezeSnapshot(this.#stepState);
  }

  #rootToColliderCenter(
    rootPosition: PhysicsVector3Snapshot
  ): PhysicsVector3Snapshot {
    return resolveMetaverseGroundedBodyColliderTranslationSnapshot(
      this.#config,
      rootPosition
    );
  }

  #colliderCenterToRoot(
    colliderCenter: PhysicsVector3Snapshot
  ): PhysicsVector3Snapshot {
    return freezeVector3(
      colliderCenter.x,
      colliderCenter.y - this.#standingOffsetMeters,
      colliderCenter.z
    );
  }
}
