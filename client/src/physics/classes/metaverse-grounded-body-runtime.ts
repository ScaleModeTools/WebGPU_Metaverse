import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaverseGroundedJumpPhysicsConfigSnapshot,
  createMetaverseGroundedJumpBodySnapshot,
  createMetaverseGroundedBodyInteractionSnapshot,
  resolveMetaverseGroundedBodyColliderTranslationSnapshot,
  clamp,
  createMetaverseGroundedBodyStepStateSnapshot,
  createMetaverseSurfaceTraversalVector3Snapshot as freezeVector3,
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
  MetaverseGroundedBodySnapshot,
  PhysicsVector3Snapshot,
  RapierColliderHandle
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
      toFiniteNumber(config.baseSpeedUnitsPerSecond, 5.4)
    ),
    boostCurveExponent: Math.max(
      0.1,
      toFiniteNumber(config.boostCurveExponent, 1.1)
    ),
    boostMultiplier: Math.max(1, toFiniteNumber(config.boostMultiplier, 1.2)),
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

  #collider: RapierColliderHandle | null = null;
  #stepState: MetaverseGroundedBodyStepStateSnapshot;
  #snapshot: MetaverseGroundedBodySnapshot;

  constructor(
    config: MetaverseGroundedBodyConfig,
    physicsRuntime: RapierPhysicsRuntime
  ) {
    this.#config = sanitizeConfig(config);
    this.#physicsRuntime = physicsRuntime;
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: this.#config.spawnPosition
    });
    this.#snapshot = freezeGroundedBodySnapshot(
      this.#config,
      this.#stepState
    );
  }

  get isInitialized(): boolean {
    return this.#collider !== null;
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
    readonly stepState: MetaverseGroundedBodyStepStateSnapshot;
  } {
    return Object.freeze({
      stepState: this.#stepState
    });
  }

  restoreStateSnapshot(snapshot: {
    readonly stepState: MetaverseGroundedBodyStepStateSnapshot;
  }): void {
    const collider = this.#requireCollider();

    this.#stepState = snapshot.stepState;
    collider.setTranslation(
      this.#rootToColliderCenter(snapshot.stepState.position)
    );
    this.#syncSnapshotFromStepState();
  }

  async init(initialYawRadians = 0): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.#physicsRuntime.init();

    const collider = this.#physicsRuntime.createCapsuleCollider(
      this.#config.capsuleHalfHeightMeters,
      this.#config.capsuleRadiusMeters,
      this.#rootToColliderCenter(this.#config.spawnPosition)
    );

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
  }

  syncAuthoritativeState(snapshot: {
    readonly contact?: MetaverseGroundedBodySnapshot["contact"] | null;
    readonly driveTarget?: MetaverseGroundedBodySnapshot["driveTarget"] | null;
    readonly grounded: boolean;
    readonly interaction?:
      | MetaverseGroundedBodySnapshot["interaction"]
      | null;
    readonly jumpBody?: MetaverseGroundedBodySnapshot["jumpBody"] | null;
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly supportNormal?: PhysicsVector3Snapshot | null;
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
        contact: snapshot.contact ?? null,
        driveTarget: snapshot.driveTarget ?? null,
        grounded: snapshot.grounded,
        interaction: snapshot.interaction ?? this.#stepState.interaction,
        jumpBody: snapshot.jumpBody ?? null,
        linearVelocity: snapshot.linearVelocity,
        position: sanitizedPosition,
        supportNormal: snapshot.supportNormal ?? null,
        yawRadians: snapshot.yawRadians
      },
      this.#config
    );
    this.#syncSnapshotFromStepState();
  }

  dispose(): void {
    if (this.#collider !== null) {
      this.#physicsRuntime.removeCollider(this.#collider);
      this.#collider = null;
    }

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

  #requireCollider(): RapierColliderHandle {
    if (this.#collider === null) {
      throw new Error("Metaverse grounded body runtime must be initialized before use.");
    }

    return this.#collider;
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
