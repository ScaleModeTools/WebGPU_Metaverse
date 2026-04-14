import {
  advanceMetaverseSurfaceTraversalMotion,
  clamp,
  constrainMetaverseSurfaceTraversalPositionToWorldRadius,
  createMetaverseSurfaceTraversalVector3Snapshot as freezeVector3,
  toFiniteNumber,
  wrapRadians
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeRapierPhysicsRuntime } from "./metaverse-authoritative-rapier-physics-runtime.js";
import type {
  PhysicsVector3Snapshot,
  RapierCharacterControllerHandle,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../types/metaverse-authoritative-rapier.js";

export interface MetaverseAuthoritativeGroundedBodyIntentSnapshot {
  readonly boost: boolean;
  readonly jump: boolean;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly turnAxis: number;
}

export interface MetaverseAuthoritativeGroundedBodySnapshot {
  readonly grounded: boolean;
  readonly jumpReady: boolean;
  readonly planarSpeedUnitsPerSecond: number;
  readonly position: PhysicsVector3Snapshot;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseAuthoritativeGroundedBodyConfig {
  readonly accelerationCurveExponent: number;
  readonly accelerationUnitsPerSecondSquared: number;
  readonly airborneMovementDampingFactor: number;
  readonly baseSpeedUnitsPerSecond: number;
  readonly boostCurveExponent: number;
  readonly boostMultiplier: number;
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly controllerOffsetMeters: number;
  readonly decelerationUnitsPerSecondSquared: number;
  readonly dragCurveExponent: number;
  readonly gravityUnitsPerSecond: number;
  readonly jumpImpulseUnitsPerSecond: number;
  readonly maxSlopeClimbAngleRadians: number;
  readonly minSlopeSlideAngleRadians: number;
  readonly maxTurnSpeedRadiansPerSecond: number;
  readonly snapToGroundDistanceMeters: number;
  readonly stepHeightMeters: number;
  readonly stepWidthMeters: number;
  readonly spawnPosition: PhysicsVector3Snapshot;
  readonly worldRadius: number;
}

function sanitizeConfig(
  config: MetaverseAuthoritativeGroundedBodyConfig
): MetaverseAuthoritativeGroundedBodyConfig {
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
    gravityUnitsPerSecond: Math.max(
      0,
      toFiniteNumber(config.gravityUnitsPerSecond, 18)
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

function freezeSnapshot(
  position: PhysicsVector3Snapshot,
  planarSpeedUnitsPerSecond: number,
  verticalSpeedUnitsPerSecond: number,
  yawRadians: number,
  grounded: boolean
): MetaverseAuthoritativeGroundedBodySnapshot {
  return Object.freeze({
    grounded,
    jumpReady: grounded,
    planarSpeedUnitsPerSecond: Math.max(0, toFiniteNumber(planarSpeedUnitsPerSecond)),
    position,
    verticalSpeedUnitsPerSecond: toFiniteNumber(verticalSpeedUnitsPerSecond),
    yawRadians: wrapRadians(yawRadians)
  });
}

export class MetaverseAuthoritativeGroundedBodyRuntime {
  readonly #config: MetaverseAuthoritativeGroundedBodyConfig;
  readonly #physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly #characterController: RapierCharacterControllerHandle;
  readonly #collider: RapierColliderHandle;

  #autostepEnabled = true;
  #autostepHeightMeters: number;
  #forwardSpeedUnitsPerSecond = 0;
  #snapshot: MetaverseAuthoritativeGroundedBodySnapshot;
  #strafeSpeedUnitsPerSecond = 0;
  #verticalSpeedUnitsPerSecond = 0;

  constructor(
    config: MetaverseAuthoritativeGroundedBodyConfig,
    physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime
  ) {
    this.#config = sanitizeConfig(config);
    this.#physicsRuntime = physicsRuntime;
    this.#autostepHeightMeters = this.#config.stepHeightMeters;
    this.#characterController = this.#physicsRuntime.createCharacterController(
      this.#config.controllerOffsetMeters
    );
    this.#characterController.setUp?.(this.#physicsRuntime.createVector3(0, 1, 0));
    this.#characterController.setCharacterMass(1);
    this.#characterController.enableSnapToGround(
      this.#config.snapToGroundDistanceMeters
    );
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
    this.#snapshot = freezeSnapshot(this.#config.spawnPosition, 0, 0, 0, false);
  }

  get colliderHandle(): RapierColliderHandle {
    return this.#collider;
  }

  get snapshot(): MetaverseAuthoritativeGroundedBodySnapshot {
    return this.#snapshot;
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
    readonly grounded: boolean;
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void {
    const sanitizedPosition = freezeVector3(
      snapshot.position.x,
      snapshot.position.y,
      snapshot.position.z
    );
    const yawRadians = wrapRadians(snapshot.yawRadians);
    const linearVelocityX = toFiniteNumber(snapshot.linearVelocity.x);
    const linearVelocityY = toFiniteNumber(snapshot.linearVelocity.y);
    const linearVelocityZ = toFiniteNumber(snapshot.linearVelocity.z);
    const forwardX = Math.sin(yawRadians);
    const forwardZ = -Math.cos(yawRadians);
    const rightX = Math.cos(yawRadians);
    const rightZ = Math.sin(yawRadians);

    this.#collider.setTranslation(this.#rootToColliderCenter(sanitizedPosition));
    this.#forwardSpeedUnitsPerSecond =
      linearVelocityX * forwardX + linearVelocityZ * forwardZ;
    this.#strafeSpeedUnitsPerSecond =
      linearVelocityX * rightX + linearVelocityZ * rightZ;
    this.#verticalSpeedUnitsPerSecond =
      snapshot.grounded === true ? 0 : linearVelocityY;
    this.#snapshot = freezeSnapshot(
      sanitizedPosition,
      Math.hypot(linearVelocityX, linearVelocityZ),
      this.#verticalSpeedUnitsPerSecond,
      yawRadians,
      snapshot.grounded === true
    );
  }

  advance(
    intentSnapshot: MetaverseAuthoritativeGroundedBodyIntentSnapshot,
    deltaSeconds: number,
    preferredLookYawRadians: number | null = null,
    filterPredicate?: RapierQueryFilterPredicate
  ): MetaverseAuthoritativeGroundedBodySnapshot {
    if (deltaSeconds <= 0) {
      return this.#snapshot;
    }

    const movementDampingFactor =
      this.#snapshot.grounded ? 1 : this.#config.airborneMovementDampingFactor;
    const motionSnapshot = advanceMetaverseSurfaceTraversalMotion(
      this.#snapshot.yawRadians,
      {
        forwardSpeedUnitsPerSecond: this.#forwardSpeedUnitsPerSecond,
        strafeSpeedUnitsPerSecond: this.#strafeSpeedUnitsPerSecond
      },
      {
        boost: intentSnapshot.boost,
        moveAxis: intentSnapshot.moveAxis,
        strafeAxis: intentSnapshot.strafeAxis,
        yawAxis: intentSnapshot.turnAxis
      },
      this.#config,
      deltaSeconds,
      true,
      movementDampingFactor,
      preferredLookYawRadians
    );
    const yawRadians = motionSnapshot.yawRadians;
    const jumpRequested = intentSnapshot.jump === true && this.#snapshot.jumpReady;
    const verticalSpeedUnitsPerSecond =
      (jumpRequested
        ? Math.max(
            this.#verticalSpeedUnitsPerSecond,
            this.#config.jumpImpulseUnitsPerSecond
          )
        : this.#verticalSpeedUnitsPerSecond) -
      this.#config.gravityUnitsPerSecond * deltaSeconds;
    const forwardX = Math.sin(yawRadians);
    const forwardZ = -Math.cos(yawRadians);
    const rightX = Math.cos(yawRadians);
    const rightZ = Math.sin(yawRadians);
    const desiredMovement = this.#physicsRuntime.createVector3(
      motionSnapshot.velocityX * deltaSeconds,
      verticalSpeedUnitsPerSecond * deltaSeconds,
      motionSnapshot.velocityZ * deltaSeconds
    );

    this.#characterController.computeColliderMovement(
      this.#collider,
      desiredMovement,
      undefined,
      undefined,
      filterPredicate
    );

    const currentTranslation = this.#collider.translation();
    const computedMovement = this.#characterController.computedMovement();
    const unclampedRootPosition = freezeVector3(
      currentTranslation.x + computedMovement.x,
      currentTranslation.y + computedMovement.y - this.#standingOffsetMeters,
      currentTranslation.z + computedMovement.z
    );
    const clampedRootPosition =
      constrainMetaverseSurfaceTraversalPositionToWorldRadius(
        unclampedRootPosition,
        this.#config.worldRadius
      );
    const appliedDeltaX = clampedRootPosition.x - this.#snapshot.position.x;
    const appliedDeltaY = clampedRootPosition.y - this.#snapshot.position.y;
    const appliedDeltaZ = clampedRootPosition.z - this.#snapshot.position.z;
    const grounded = this.#characterController.computedGrounded();

    this.#collider.setTranslation(this.#rootToColliderCenter(clampedRootPosition));
    this.#forwardSpeedUnitsPerSecond =
      (appliedDeltaX * forwardX + appliedDeltaZ * forwardZ) / deltaSeconds;
    this.#strafeSpeedUnitsPerSecond =
      (appliedDeltaX * rightX + appliedDeltaZ * rightZ) / deltaSeconds;
    this.#verticalSpeedUnitsPerSecond = grounded
      ? 0
      : appliedDeltaY / deltaSeconds;
    this.#snapshot = freezeSnapshot(
      clampedRootPosition,
      Math.hypot(appliedDeltaX, appliedDeltaZ) / deltaSeconds,
      this.#verticalSpeedUnitsPerSecond,
      yawRadians,
      grounded
    );

    return this.#snapshot;
  }

  teleport(position: PhysicsVector3Snapshot, yawRadians: number): void {
    const sanitizedPosition = freezeVector3(position.x, position.y, position.z);

    this.#collider.setTranslation(this.#rootToColliderCenter(sanitizedPosition));
    this.#forwardSpeedUnitsPerSecond = 0;
    this.#strafeSpeedUnitsPerSecond = 0;
    this.#verticalSpeedUnitsPerSecond = 0;
    this.#snapshot = freezeSnapshot(
      sanitizedPosition,
      0,
      0,
      yawRadians,
      false
    );
  }

  dispose(): void {
    this.#physicsRuntime.removeCollider(this.#collider);
    this.#characterController.free?.();
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
