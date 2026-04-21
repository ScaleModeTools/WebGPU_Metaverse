import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaverseGroundedJumpPhysicsConfigSnapshot,
  createMetaverseGroundedJumpBodySnapshot,
  createMetaverseGroundedBodyInteractionSnapshot,
  resolveMetaverseGroundedBodyColliderTranslationSnapshot,
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
} from "@webgpu-metaverse/shared";

import { RapierPhysicsRuntime } from "./rapier-physics-runtime";
import type {
  MetaverseGroundedBodyConfig,
  MetaverseGroundedBodyInteractionSyncSnapshot,
  MetaverseGroundedBodyIntentSnapshot,
  MetaverseGroundedBodySnapshot,
  PhysicsVector3Snapshot,
  RapierCharacterControllerHandle,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../types/metaverse-grounded-body";

function sanitizeConfig(
  config: MetaverseGroundedBodyConfig
): MetaverseGroundedBodyConfig {
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
    eyeHeightMeters: Math.max(0.4, toFiniteNumber(config.eyeHeightMeters, 1.62)),
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

function freezeGroundedBodySnapshot(
  config: MetaverseGroundedBodyConfig,
  stepState: MetaverseGroundedBodyStepStateSnapshot
): MetaverseGroundedBodySnapshot {
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
  const groundedBodyRuntimeSnapshot =
    createMetaverseGroundedBodyRuntimeSnapshot({
      contact: stepState.contact,
      driveTarget: stepState.driveTarget,
      grounded: jumpBodySnapshot.grounded,
      interaction: stepState.interaction,
      jumpBody: jumpBodySnapshot,
      linearVelocity,
      position: stepState.position,
      yawRadians: stepState.yawRadians
    });

  return Object.freeze({
    ...groundedBodyRuntimeSnapshot,
    capsuleHalfHeightMeters: config.capsuleHalfHeightMeters,
    capsuleRadiusMeters: config.capsuleRadiusMeters,
    eyeHeightMeters: config.eyeHeightMeters,
    yawRadians: wrapRadians(groundedBodyRuntimeSnapshot.yawRadians)
  });
}

export class MetaverseGroundedBodyRuntime {
  readonly #config: MetaverseGroundedBodyConfig;
  readonly #physicsRuntime: RapierPhysicsRuntime;

  #autostepEnabled = true;
  #autostepHeightMeters: number;
  #characterController: RapierCharacterControllerHandle | null = null;
  #collider: RapierColliderHandle | null = null;
  #stepState: MetaverseGroundedBodyStepStateSnapshot;
  #snapshot: MetaverseGroundedBodySnapshot;

  constructor(
    config: MetaverseGroundedBodyConfig,
    physicsRuntime: RapierPhysicsRuntime
  ) {
    this.#config = sanitizeConfig(config);
    this.#physicsRuntime = physicsRuntime;
    this.#autostepHeightMeters = this.#config.stepHeightMeters;
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: this.#config.spawnPosition
    });
    this.#snapshot = freezeGroundedBodySnapshot(
      this.#config,
      this.#stepState
    );
  }

  get isInitialized(): boolean {
    return this.#characterController !== null && this.#collider !== null;
  }

  get snapshot(): MetaverseGroundedBodySnapshot {
    return this.#snapshot;
  }

  get linearVelocitySnapshot(): PhysicsVector3Snapshot {
    return this.#snapshot.linearVelocity;
  }

  get colliderHandle(): RapierColliderHandle | null {
    return this.#collider;
  }

  captureStateSnapshot(): {
    readonly autostepEnabled: boolean;
    readonly autostepHeightMeters: number;
    readonly stepState: MetaverseGroundedBodyStepStateSnapshot;
  } {
    return Object.freeze({
      autostepEnabled: this.#autostepEnabled,
      autostepHeightMeters: this.#autostepHeightMeters,
      stepState: this.#stepState
    });
  }

  restoreStateSnapshot(snapshot: {
    readonly autostepEnabled: boolean;
    readonly autostepHeightMeters: number;
    readonly stepState: MetaverseGroundedBodyStepStateSnapshot;
  }): void {
    const collider = this.#requireCollider();

    this.#stepState = snapshot.stepState;
    collider.setTranslation(
      this.#rootToColliderCenter(snapshot.stepState.position)
    );
    this.#syncSnapshotFromStepState();
    this.setAutostepEnabled(
      snapshot.autostepEnabled,
      snapshot.autostepHeightMeters
    );
  }

  async init(initialYawRadians = 0): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.#physicsRuntime.init();

    const controller = this.#physicsRuntime.createCharacterController(
      this.#config.controllerOffsetMeters
    );

    controller.setUp?.(this.#physicsRuntime.createVector3(0, 1, 0));
    controller.setApplyImpulsesToDynamicBodies(
      this.#snapshot.interaction.applyImpulsesToDynamicBodies
    );
    controller.setCharacterMass(1);
    this.#syncSnapToGroundConfiguration(controller, true);
    controller.setMaxSlopeClimbAngle?.(this.#config.maxSlopeClimbAngleRadians);
    controller.setMinSlopeSlideAngle?.(this.#config.minSlopeSlideAngleRadians);
    this.#syncAutostepConfiguration(controller);

    const collider = this.#physicsRuntime.createCapsuleCollider(
      this.#config.capsuleHalfHeightMeters,
      this.#config.capsuleRadiusMeters,
      this.#rootToColliderCenter(this.#config.spawnPosition)
    );

    this.#characterController = controller;
    this.#collider = collider;
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: this.#config.spawnPosition,
      yawRadians: initialYawRadians
    });
    this.#syncSnapshotFromStepState();
  }

  syncInteractionSnapshot(
    snapshot: MetaverseGroundedBodyInteractionSyncSnapshot
  ): void {
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      ...this.#stepState,
      interaction: createMetaverseGroundedBodyInteractionSnapshot(snapshot)
    });
    this.#syncSnapshotFromStepState();
    this.#characterController?.setApplyImpulsesToDynamicBodies(
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
    const controller = this.#characterController;

    if (controller === null) {
      return;
    }

    this.#syncAutostepConfiguration(controller);
  }

  syncAuthoritativeState(snapshot: {
    readonly driveTarget?: MetaverseGroundedBodySnapshot["driveTarget"] | null;
    readonly grounded: boolean;
    readonly interaction?:
      | MetaverseGroundedBodySnapshot["interaction"]
      | null;
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void {
    const collider = this.#requireCollider();
    const sanitizedPosition = freezeVector3(
      snapshot.position.x,
      snapshot.position.y,
      snapshot.position.z
    );
    collider.setTranslation(this.#rootToColliderCenter(sanitizedPosition));
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
    intentSnapshot: MetaverseGroundedBodyIntentSnapshot,
    deltaSeconds: number,
    filterPredicate?: RapierQueryFilterPredicate,
    preferredLookYawRadians: number | null = null
  ): MetaverseGroundedBodySnapshot {
    const collider = this.#requireCollider();
    const controller = this.#requireCharacterController();

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
    this.#syncSnapToGroundConfiguration(
      controller,
      preparedStep.snapToGroundEnabled
    );

    controller.computeColliderMovement(
      collider,
      desiredMovement,
      undefined,
      undefined,
      filterPredicate
    );

    const currentTranslation = collider.translation();
    const computedMovement = controller.computedMovement();
    const resolvedStep = resolveMetaverseGroundedBodyControllerStep(
      this.#stepState,
      preparedStep,
      {
        colliderCenterPosition: freezeVector3(
          currentTranslation.x,
          currentTranslation.y,
          currentTranslation.z
        ),
        computedGrounded: controller.computedGrounded(),
        computedMovementDelta: freezeVector3(
          computedMovement.x,
          computedMovement.y,
          computedMovement.z
        ),
        standingOffsetMeters: this.#standingOffsetMeters
      },
      this.#config,
      deltaSeconds
    );

    this.#stepState = resolvedStep.state;
    collider.setTranslation(this.#rootToColliderCenter(this.#stepState.position));
    this.#syncSnapshotFromStepState();

    return this.#snapshot;
  }

  dispose(): void {
    if (this.#collider !== null) {
      this.#physicsRuntime.removeCollider(this.#collider);
      this.#collider = null;
    }

    this.#characterController?.free?.();
    this.#characterController = null;
    this.#autostepEnabled = true;
    this.#autostepHeightMeters = this.#config.stepHeightMeters;
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: this.#config.spawnPosition,
      yawRadians: this.#stepState.yawRadians
    });
    this.#syncSnapshotFromStepState();
  }

  teleport(position: PhysicsVector3Snapshot, yawRadians: number): void {
    const collider = this.#requireCollider();
    const sanitizedPosition = freezeVector3(position.x, position.y, position.z);

    collider.setTranslation(this.#rootToColliderCenter(sanitizedPosition));
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: sanitizedPosition,
      yawRadians
    });
    this.#syncSnapshotFromStepState();
  }

  get #standingOffsetMeters(): number {
    return (
      this.#config.capsuleHalfHeightMeters + this.#config.capsuleRadiusMeters
    );
  }

  #requireCharacterController(): RapierCharacterControllerHandle {
    if (this.#characterController === null) {
      throw new Error("Metaverse grounded body runtime must be initialized before use.");
    }

    return this.#characterController;
  }

  #requireCollider(): RapierColliderHandle {
    if (this.#collider === null) {
      throw new Error("Metaverse grounded body runtime must be initialized before use.");
    }

    return this.#collider;
  }

  #syncAutostepConfiguration(
    controller: RapierCharacterControllerHandle
  ): void {
    if (this.#autostepEnabled) {
      controller.enableAutostep(
        this.#autostepHeightMeters,
        this.#config.stepWidthMeters,
        false
      );
      return;
    }

    controller.disableAutostep?.();
  }

  #syncSnapToGroundConfiguration(
    controller: RapierCharacterControllerHandle,
    enabled: boolean
  ): void {
    controller.enableSnapToGround(
      enabled ? this.#config.snapToGroundDistanceMeters : 0
    );
  }

  #syncSnapshotFromStepState(): void {
    this.#snapshot = freezeGroundedBodySnapshot(
      this.#config,
      this.#stepState
    );
  }

  #rootToColliderCenter(
    rootPosition: PhysicsVector3Snapshot
  ): PhysicsVector3Snapshot {
    return resolveMetaverseGroundedBodyColliderTranslationSnapshot(
      this.#config,
      rootPosition
    );
  }
}
