import {
  advanceMetaverseSurfaceTraversalMotion,
  clamp,
  constrainMetaverseSurfaceTraversalPositionToWorldRadius,
  createMetaverseSurfaceTraversalVector3Snapshot as freezeVector3,
  toFiniteNumber,
  wrapRadians,
  type MetaverseSurfaceTraversalConfig
} from "@webgpu-metaverse/shared";

import { RapierPhysicsRuntime } from "./rapier-physics-runtime";
import type {
  PhysicsQuaternionSnapshot,
  PhysicsVector3Snapshot,
  RapierCharacterControllerHandle,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../types/metaverse-grounded-body";

export interface MetaverseSurfaceDriveBodyIntentSnapshot {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly yawAxis: number;
}

type MetaverseSurfaceDriveBodyShapeConfig =
  | {
      readonly kind: "capsule";
      readonly halfHeightMeters: number;
      readonly radiusMeters: number;
    }
  | {
      readonly kind: "cuboid";
      readonly halfExtents: PhysicsVector3Snapshot;
      readonly localCenter: PhysicsVector3Snapshot;
    };

export interface MetaverseSurfaceDriveBodyRuntimeConfig {
  readonly controllerOffsetMeters: number;
  readonly shape: MetaverseSurfaceDriveBodyShapeConfig;
  readonly spawnPosition: PhysicsVector3Snapshot;
  readonly spawnYawRadians: number;
  readonly worldRadius: number;
}

export interface MetaverseSurfaceDriveBodySnapshot {
  readonly linearVelocity: PhysicsVector3Snapshot;
  readonly planarSpeedUnitsPerSecond: number;
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

function freezeSnapshot(
  linearVelocity: PhysicsVector3Snapshot,
  planarSpeedUnitsPerSecond: number,
  position: PhysicsVector3Snapshot,
  yawRadians: number
): MetaverseSurfaceDriveBodySnapshot {
  return Object.freeze({
    linearVelocity,
    planarSpeedUnitsPerSecond: Math.max(0, toFiniteNumber(planarSpeedUnitsPerSecond)),
    position,
    yawRadians: wrapRadians(yawRadians)
  });
}

function rotateVectorAroundYaw(
  vector: PhysicsVector3Snapshot,
  yawRadians: number
): PhysicsVector3Snapshot {
  const sinYaw = Math.sin(yawRadians);
  const cosYaw = Math.cos(yawRadians);

  return freezeVector3(
    vector.x * cosYaw + vector.z * sinYaw,
    vector.y,
    -vector.x * sinYaw + vector.z * cosYaw
  );
}

function quaternionFromYawRadians(yawRadians: number): PhysicsQuaternionSnapshot {
  const halfYawRadians = wrapRadians(yawRadians) * 0.5;

  return Object.freeze({
    x: 0,
    y: Math.sin(halfYawRadians),
    z: 0,
    w: Math.cos(halfYawRadians)
  });
}

export class MetaverseSurfaceDriveBodyRuntime {
  readonly #config: MetaverseSurfaceDriveBodyRuntimeConfig;
  readonly #physicsRuntime: RapierPhysicsRuntime;
  readonly #characterController: RapierCharacterControllerHandle;
  readonly #collider: RapierColliderHandle;

  #forwardSpeedUnitsPerSecond = 0;
  #snapshot: MetaverseSurfaceDriveBodySnapshot;
  #strafeSpeedUnitsPerSecond = 0;

  constructor(
    config: MetaverseSurfaceDriveBodyRuntimeConfig,
    physicsRuntime: RapierPhysicsRuntime
  ) {
    this.#config = Object.freeze({
      controllerOffsetMeters: Math.max(
        0.001,
        toFiniteNumber(config.controllerOffsetMeters, 0.01)
      ),
      shape:
        config.shape.kind === "capsule"
          ? Object.freeze({
              halfHeightMeters: Math.max(
                0.01,
                toFiniteNumber(config.shape.halfHeightMeters, 0.48)
              ),
              kind: "capsule" as const,
              radiusMeters: Math.max(
                0.01,
                toFiniteNumber(config.shape.radiusMeters, 0.34)
              )
            })
          : Object.freeze({
              halfExtents: freezeVector3(
                Math.max(0.01, toFiniteNumber(config.shape.halfExtents.x, 0.5)),
                Math.max(0.01, toFiniteNumber(config.shape.halfExtents.y, 0.5)),
                Math.max(0.01, toFiniteNumber(config.shape.halfExtents.z, 0.5))
              ),
              kind: "cuboid" as const,
              localCenter: freezeVector3(
                config.shape.localCenter.x,
                config.shape.localCenter.y,
                config.shape.localCenter.z
              )
            }),
      spawnPosition: freezeVector3(
        config.spawnPosition.x,
        config.spawnPosition.y,
        config.spawnPosition.z
      ),
      spawnYawRadians: wrapRadians(config.spawnYawRadians),
      worldRadius: Math.max(1, toFiniteNumber(config.worldRadius, 110))
    });
    this.#physicsRuntime = physicsRuntime;
    this.#characterController = this.#physicsRuntime.createCharacterController(
      this.#config.controllerOffsetMeters
    );
    this.#characterController.setUp?.(this.#physicsRuntime.createVector3(0, 1, 0));
    this.#characterController.setCharacterMass(1);
    this.#collider =
      this.#config.shape.kind === "capsule"
        ? this.#physicsRuntime.createCapsuleCollider(
            this.#config.shape.halfHeightMeters,
            this.#config.shape.radiusMeters,
            this.#rootToColliderCenter(
              this.#config.spawnPosition,
              this.#config.spawnYawRadians
            )
          )
        : this.#physicsRuntime.createCuboidCollider(
            this.#config.shape.halfExtents,
            this.#rootToColliderCenter(
              this.#config.spawnPosition,
              this.#config.spawnYawRadians
            ),
            quaternionFromYawRadians(this.#config.spawnYawRadians)
          );
    this.#snapshot = freezeSnapshot(
      freezeVector3(0, 0, 0),
      0,
      this.#config.spawnPosition,
      this.#config.spawnYawRadians
    );
  }

  get colliderHandle(): RapierColliderHandle {
    return this.#collider;
  }

  get snapshot(): MetaverseSurfaceDriveBodySnapshot {
    return this.#snapshot;
  }

  syncAuthoritativeState(snapshot: {
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void {
    const position = freezeVector3(
      snapshot.position.x,
      snapshot.position.y,
      snapshot.position.z
    );
    const yawRadians = wrapRadians(snapshot.yawRadians);
    const linearVelocity = freezeVector3(
      snapshot.linearVelocity.x,
      snapshot.linearVelocity.y,
      snapshot.linearVelocity.z
    );
    const forwardX = Math.sin(yawRadians);
    const forwardZ = -Math.cos(yawRadians);
    const rightX = Math.cos(yawRadians);
    const rightZ = Math.sin(yawRadians);

    this.#collider.setTranslation(this.#rootToColliderCenter(position, yawRadians));

    if (this.#config.shape.kind === "cuboid") {
      this.#collider.setRotation(quaternionFromYawRadians(yawRadians));
    }

    this.#forwardSpeedUnitsPerSecond =
      linearVelocity.x * forwardX + linearVelocity.z * forwardZ;
    this.#strafeSpeedUnitsPerSecond =
      linearVelocity.x * rightX + linearVelocity.z * rightZ;
    this.#snapshot = freezeSnapshot(
      linearVelocity,
      Math.hypot(linearVelocity.x, linearVelocity.z),
      position,
      yawRadians
    );
  }

  advance(
    intentSnapshot: MetaverseSurfaceDriveBodyIntentSnapshot,
    locomotionConfig: MetaverseSurfaceTraversalConfig,
    deltaSeconds: number,
    lockedHeightMeters: number,
    preferredLookYawRadians: number | null = null,
    filterPredicate?: RapierQueryFilterPredicate
  ): MetaverseSurfaceDriveBodySnapshot {
    if (deltaSeconds <= 0) {
      return this.#snapshot;
    }

    this.#physicsRuntime.stepSimulation(deltaSeconds);
    const motionSnapshot = advanceMetaverseSurfaceTraversalMotion(
      this.#snapshot.yawRadians,
      {
        forwardSpeedUnitsPerSecond: this.#forwardSpeedUnitsPerSecond,
        strafeSpeedUnitsPerSecond: this.#strafeSpeedUnitsPerSecond
      },
      {
        boost: intentSnapshot.boost,
        moveAxis: clamp(toFiniteNumber(intentSnapshot.moveAxis, 0), -1, 1),
        strafeAxis: clamp(toFiniteNumber(intentSnapshot.strafeAxis, 0), -1, 1),
        yawAxis: clamp(toFiniteNumber(intentSnapshot.yawAxis, 0), -1, 1)
      },
      locomotionConfig,
      deltaSeconds,
      true,
      1,
      preferredLookYawRadians
    );
    const nextYawRadians = motionSnapshot.yawRadians;
    const desiredMovement = this.#physicsRuntime.createVector3(
      motionSnapshot.velocityX * deltaSeconds,
      0,
      motionSnapshot.velocityZ * deltaSeconds
    );

    if (this.#config.shape.kind === "cuboid") {
      this.#collider.setRotation(quaternionFromYawRadians(nextYawRadians));
    }

    this.#characterController.computeColliderMovement(
      this.#collider,
      desiredMovement,
      undefined,
      undefined,
      filterPredicate
    );

    const currentTranslation = this.#collider.translation();
    const computedMovement = this.#characterController.computedMovement();
    const unclampedRootPosition = this.#colliderCenterToRoot(
      freezeVector3(
        currentTranslation.x + computedMovement.x,
        currentTranslation.y + computedMovement.y,
        currentTranslation.z + computedMovement.z
      ),
      nextYawRadians
    );
    const clampedRootPosition =
      constrainMetaverseSurfaceTraversalPositionToWorldRadius(
        freezeVector3(
          unclampedRootPosition.x,
          lockedHeightMeters,
          unclampedRootPosition.z
        ),
        this.#config.worldRadius
      );
    const appliedDeltaX = clampedRootPosition.x - this.#snapshot.position.x;
    const appliedDeltaY = lockedHeightMeters - this.#snapshot.position.y;
    const appliedDeltaZ = clampedRootPosition.z - this.#snapshot.position.z;
    const forwardX = Math.sin(nextYawRadians);
    const forwardZ = -Math.cos(nextYawRadians);
    const rightX = Math.cos(nextYawRadians);
    const rightZ = Math.sin(nextYawRadians);
    const linearVelocity = freezeVector3(
      appliedDeltaX / deltaSeconds,
      appliedDeltaY / deltaSeconds,
      appliedDeltaZ / deltaSeconds
    );

    this.#collider.setTranslation(
      this.#rootToColliderCenter(clampedRootPosition, nextYawRadians)
    );

    if (this.#config.shape.kind === "cuboid") {
      this.#collider.setRotation(quaternionFromYawRadians(nextYawRadians));
    }

    this.#forwardSpeedUnitsPerSecond =
      (appliedDeltaX * forwardX + appliedDeltaZ * forwardZ) / deltaSeconds;
    this.#strafeSpeedUnitsPerSecond =
      (appliedDeltaX * rightX + appliedDeltaZ * rightZ) / deltaSeconds;
    this.#snapshot = freezeSnapshot(
      linearVelocity,
      Math.hypot(appliedDeltaX, appliedDeltaZ) / deltaSeconds,
      clampedRootPosition,
      nextYawRadians
    );

    return this.#snapshot;
  }

  teleport(position: PhysicsVector3Snapshot, yawRadians: number): void {
    const sanitizedPosition = freezeVector3(position.x, position.y, position.z);
    const wrappedYawRadians = wrapRadians(yawRadians);

    this.#collider.setTranslation(
      this.#rootToColliderCenter(sanitizedPosition, wrappedYawRadians)
    );

    if (this.#config.shape.kind === "cuboid") {
      this.#collider.setRotation(quaternionFromYawRadians(wrappedYawRadians));
    }

    this.#forwardSpeedUnitsPerSecond = 0;
    this.#strafeSpeedUnitsPerSecond = 0;
    this.#snapshot = freezeSnapshot(
      freezeVector3(0, 0, 0),
      0,
      sanitizedPosition,
      wrappedYawRadians
    );
  }

  dispose(): void {
    this.#physicsRuntime.removeCollider(this.#collider);
    this.#characterController.free?.();
  }

  #rootToColliderCenter(
    rootPosition: PhysicsVector3Snapshot,
    yawRadians: number
  ): PhysicsVector3Snapshot {
    if (this.#config.shape.kind === "capsule") {
      return freezeVector3(
        rootPosition.x,
        rootPosition.y +
          this.#config.shape.halfHeightMeters +
          this.#config.shape.radiusMeters,
        rootPosition.z
      );
    }

    const rotatedCenter = rotateVectorAroundYaw(
      this.#config.shape.localCenter,
      yawRadians
    );

    return freezeVector3(
      rootPosition.x + rotatedCenter.x,
      rootPosition.y + rotatedCenter.y,
      rootPosition.z + rotatedCenter.z
    );
  }

  #colliderCenterToRoot(
    colliderCenter: PhysicsVector3Snapshot,
    yawRadians: number
  ): PhysicsVector3Snapshot {
    if (this.#config.shape.kind === "capsule") {
      return freezeVector3(
        colliderCenter.x,
        colliderCenter.y -
          this.#config.shape.halfHeightMeters -
          this.#config.shape.radiusMeters,
        colliderCenter.z
      );
    }

    const rotatedCenter = rotateVectorAroundYaw(
      this.#config.shape.localCenter,
      yawRadians
    );

    return freezeVector3(
      colliderCenter.x - rotatedCenter.x,
      colliderCenter.y - rotatedCenter.y,
      colliderCenter.z - rotatedCenter.z
    );
  }
}
