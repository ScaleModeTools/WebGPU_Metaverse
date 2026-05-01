import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  type MetaverseGroundedBodyConfigSnapshot,
  type MetaverseGroundedBodyRuntimeSnapshot,
  createMetaverseGroundedBodyInteractionSnapshot,
  resolveMetaverseGroundedBodyColliderTranslationSnapshot,
  createMetaverseGroundedJumpPhysicsConfigSnapshot,
  createMetaverseGroundedJumpBodySnapshot,
  clamp,
  createMetaverseGroundedBodyStepStateSnapshot,
  createMetaverseSurfaceTraversalVector3Snapshot as freezeVector3,
  resolveMetaverseTraversalLinearVelocitySnapshot,
  syncMetaverseGroundedBodyStepState,
  toFiniteNumber,
  wrapRadians,
  type MetaverseGroundedBodyStepStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

import { MetaverseAuthoritativeRapierPhysicsRuntime } from "./metaverse-authoritative-rapier-physics-runtime.js";
import type {
  PhysicsVector3Snapshot,
  RapierColliderHandle
} from "../types/metaverse-authoritative-rapier.js";

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

export class MetaverseAuthoritativeGroundedBodyRuntime {
  readonly #config: MetaverseAuthoritativeGroundedBodyConfig;
  readonly #physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly #collider: RapierColliderHandle;

  #stepState: MetaverseGroundedBodyStepStateSnapshot;
  #snapshot: MetaverseAuthoritativeGroundedBodySnapshot;

  constructor(
    config: MetaverseAuthoritativeGroundedBodyConfig,
    physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime
  ) {
    this.#config = sanitizeConfig(config);
    this.#physicsRuntime = physicsRuntime;
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: this.#config.spawnPosition
    });
    this.#snapshot = freezeSnapshot(this.#stepState);
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
  }

  syncAuthoritativeState(snapshot: {
    readonly contact?: MetaverseAuthoritativeGroundedBodySnapshot["contact"] | null;
    readonly driveTarget?: MetaverseAuthoritativeGroundedBodySnapshot["driveTarget"] | null;
    readonly grounded: boolean;
    readonly interaction?:
      | MetaverseAuthoritativeGroundedBodySnapshot["interaction"]
      | null;
    readonly jumpBody?: MetaverseAuthoritativeGroundedBodySnapshot["jumpBody"] | null;
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly supportNormal?: PhysicsVector3Snapshot | null;
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
    this.#stepState = createMetaverseGroundedBodyStepStateSnapshot({
      position: this.#config.spawnPosition,
      yawRadians: this.#stepState.yawRadians
    });
    this.#syncSnapshotFromStepState();
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
}
