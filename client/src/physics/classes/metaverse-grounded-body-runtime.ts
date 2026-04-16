import {
  clamp,
  createMetaverseGroundedBodyStepStateSnapshot,
  createMetaverseSurfaceTraversalVector3Snapshot as freezeVector3,
  prepareMetaverseGroundedBodyStep,
  resolveMetaverseGroundedBodyStep,
  syncMetaverseGroundedBodyStepState,
  toFiniteNumber,
  wrapRadians,
  type MetaverseGroundedBodyStepStateSnapshot
} from "@webgpu-metaverse/shared";

import { RapierPhysicsRuntime } from "./rapier-physics-runtime";
import type {
  MetaverseGroundedBodyConfig,
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
  return Object.freeze({
    accelerationCurveExponent: Math.max(
      0.1,
      toFiniteNumber(config.accelerationCurveExponent, 1.2)
    ),
    accelerationUnitsPerSecondSquared: Math.max(
      0.1,
      toFiniteNumber(config.accelerationUnitsPerSecondSquared, 20)
    ),
    airborneMovementDampingFactor: clamp(
      toFiniteNumber(config.airborneMovementDampingFactor, 0.42),
      0,
      1
    ),
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
    gravityUnitsPerSecond: Math.max(
      0,
      toFiniteNumber(config.gravityUnitsPerSecond, 18)
    ),
    jumpGroundContactGraceSeconds: Math.max(
      0,
      toFiniteNumber(config.jumpGroundContactGraceSeconds ?? 0.2, 0.2)
    ),
    jumpImpulseUnitsPerSecond: Math.max(
      0,
      toFiniteNumber(config.jumpImpulseUnitsPerSecond, 6.8)
    ),
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
  stepState: MetaverseGroundedBodyStepStateSnapshot,
  planarSpeedUnitsPerSecond: number,
): MetaverseGroundedBodySnapshot {
  return Object.freeze({
    capsuleHalfHeightMeters: config.capsuleHalfHeightMeters,
    capsuleRadiusMeters: config.capsuleRadiusMeters,
    eyeHeightMeters: config.eyeHeightMeters,
    grounded: stepState.grounded,
    jumpReady: stepState.jumpReady,
    planarSpeedUnitsPerSecond: Math.max(0, toFiniteNumber(planarSpeedUnitsPerSecond)),
    position: stepState.position,
    verticalSpeedUnitsPerSecond: toFiniteNumber(
      stepState.verticalSpeedUnitsPerSecond
    ),
    yawRadians: wrapRadians(stepState.yawRadians)
  });
}

export class MetaverseGroundedBodyRuntime {
  readonly #config: MetaverseGroundedBodyConfig;
  readonly #physicsRuntime: RapierPhysicsRuntime;

  #autostepEnabled = true;
  #autostepHeightMeters: number;
  #characterController: RapierCharacterControllerHandle | null = null;
  #collider: RapierColliderHandle | null = null;
  #applyImpulsesToDynamicBodies = false;
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
      this.#stepState,
      0
    );
  }

  get isInitialized(): boolean {
    return this.#characterController !== null && this.#collider !== null;
  }

  get snapshot(): MetaverseGroundedBodySnapshot {
    return this.#snapshot;
  }

  get linearVelocitySnapshot(): PhysicsVector3Snapshot {
    const yawRadians = this.#stepState.yawRadians;
    const forwardX = Math.sin(yawRadians);
    const forwardZ = -Math.cos(yawRadians);
    const rightX = Math.cos(yawRadians);
    const rightZ = Math.sin(yawRadians);

    return freezeVector3(
      this.#stepState.forwardSpeedUnitsPerSecond * forwardX +
        this.#stepState.strafeSpeedUnitsPerSecond * rightX,
      this.#stepState.verticalSpeedUnitsPerSecond,
      this.#stepState.forwardSpeedUnitsPerSecond * forwardZ +
        this.#stepState.strafeSpeedUnitsPerSecond * rightZ
    );
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
    this.#syncSnapshotFromStepState(
      Math.hypot(
        snapshot.stepState.forwardSpeedUnitsPerSecond,
        snapshot.stepState.strafeSpeedUnitsPerSecond
      )
    );
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
      this.#applyImpulsesToDynamicBodies
    );
    controller.setCharacterMass(1);
    this.#syncAutostepConfiguration(controller);
    this.#syncSnapToGroundConfiguration(controller, true);
    controller.setMaxSlopeClimbAngle?.(this.#config.maxSlopeClimbAngleRadians);
    controller.setMinSlopeSlideAngle?.(this.#config.minSlopeSlideAngleRadians);

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
    this.#syncSnapshotFromStepState(0);
  }

  setApplyImpulsesToDynamicBodies(enabled: boolean): void {
    this.#applyImpulsesToDynamicBodies = enabled;
    this.#characterController?.setApplyImpulsesToDynamicBodies(enabled);
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
    readonly grounded: boolean;
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
        grounded: snapshot.grounded,
        linearVelocity: snapshot.linearVelocity,
        position: sanitizedPosition,
        yawRadians: snapshot.yawRadians
      },
      this.#config
    );
    this.#syncSnapshotFromStepState(Math.hypot(snapshot.linearVelocity.x, snapshot.linearVelocity.z));
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
    const resolvedStep = resolveMetaverseGroundedBodyStep(
      this.#stepState,
      preparedStep,
      freezeVector3(
        currentTranslation.x + computedMovement.x,
        currentTranslation.y + computedMovement.y - this.#standingOffsetMeters,
        currentTranslation.z + computedMovement.z
      ),
      controller.computedGrounded(),
      this.#config,
      deltaSeconds
    );

    this.#stepState = resolvedStep.state;
    collider.setTranslation(this.#rootToColliderCenter(this.#stepState.position));
    this.#syncSnapshotFromStepState(resolvedStep.planarSpeedUnitsPerSecond);

    return this.#snapshot;
  }

  dispose(): void {
    if (this.#collider !== null) {
      this.#physicsRuntime.removeCollider(this.#collider);
      this.#collider = null;
    }

    this.#characterController?.free?.();
    this.#characterController = null;
    this.#applyImpulsesToDynamicBodies = false;
    this.#autostepEnabled = true;
    this.#autostepHeightMeters = this.#config.stepHeightMeters;
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: this.#config.spawnPosition,
      yawRadians: this.#stepState.yawRadians
    });
    this.#syncSnapshotFromStepState(0);
  }

  teleport(position: PhysicsVector3Snapshot, yawRadians: number): void {
    const collider = this.#requireCollider();
    const sanitizedPosition = freezeVector3(position.x, position.y, position.z);

    collider.setTranslation(this.#rootToColliderCenter(sanitizedPosition));
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: sanitizedPosition,
      yawRadians
    });
    this.#syncSnapshotFromStepState(0);
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

  #syncSnapshotFromStepState(planarSpeedUnitsPerSecond: number): void {
    this.#snapshot = freezeGroundedBodySnapshot(
      this.#config,
      this.#stepState,
      planarSpeedUnitsPerSecond
    );
  }

  #rootToColliderCenter(
    rootPosition: PhysicsVector3Snapshot
  ): PhysicsVector3Snapshot {
    return freezeVector3(
      rootPosition.x,
      rootPosition.y + this.#standingOffsetMeters,
      rootPosition.z
    );
  }
}
