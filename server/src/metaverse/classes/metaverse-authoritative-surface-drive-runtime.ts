import {
  advanceMetaverseSurfaceTraversalMotion,
  clamp,
  constrainMetaverseSurfaceTraversalPositionToWorldRadius,
  createMetaverseSurfaceTraversalVector3Snapshot as freezeVector3,
  toFiniteNumber,
  wrapRadians,
  type MetaverseSurfaceTraversalConfig
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type {
  MetaverseWorldPlacedSurfaceColliderSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";
import {
  constrainMetaverseWorldPlanarPositionAgainstBlockers
} from "@webgpu-metaverse/shared/metaverse/world";

import { MetaverseAuthoritativeRapierPhysicsRuntime } from "./metaverse-authoritative-rapier-physics-runtime.js";
import type {
  PhysicsQuaternionSnapshot,
  PhysicsVector3Snapshot,
  RapierCharacterControllerHandle,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../types/metaverse-authoritative-rapier.js";

interface MetaverseAuthoritativeSurfaceDriveIntentSnapshot {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly yawAxis: number;
}

type MetaverseAuthoritativeSurfaceDriveShapeConfig =
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

export interface MetaverseAuthoritativeSurfaceDriveRuntimeConfig {
  readonly controllerOffsetMeters: number;
  readonly shape: MetaverseAuthoritativeSurfaceDriveShapeConfig;
  readonly spawnPosition: PhysicsVector3Snapshot;
  readonly spawnYawRadians: number;
  readonly worldRadius: number;
}

export interface MetaverseAuthoritativeSurfaceDriveSnapshot {
  readonly linearVelocity: PhysicsVector3Snapshot;
  readonly planarSpeedUnitsPerSecond: number;
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseAuthoritativeSurfaceDriveBlockerResolutionOptions {
  readonly excludedOwnerEnvironmentAssetId?: string | null;
  readonly surfaceColliderSnapshots:
    readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
}

const identityQuaternion = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
  w: 1
});

function freezeSnapshot(
  linearVelocity: PhysicsVector3Snapshot,
  planarSpeedUnitsPerSecond: number,
  position: PhysicsVector3Snapshot,
  yawRadians: number
): MetaverseAuthoritativeSurfaceDriveSnapshot {
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

export class MetaverseAuthoritativeSurfaceDriveRuntime {
  readonly #config: MetaverseAuthoritativeSurfaceDriveRuntimeConfig;
  readonly #physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly #characterController: RapierCharacterControllerHandle;
  readonly #collider: RapierColliderHandle;

  #forwardSpeedUnitsPerSecond = 0;
  #snapshot: MetaverseAuthoritativeSurfaceDriveSnapshot;
  #strafeSpeedUnitsPerSecond = 0;

  constructor(
    config: MetaverseAuthoritativeSurfaceDriveRuntimeConfig,
    physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime
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

  get snapshot(): MetaverseAuthoritativeSurfaceDriveSnapshot {
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
    intentSnapshot: MetaverseAuthoritativeSurfaceDriveIntentSnapshot,
    locomotionConfig: MetaverseSurfaceTraversalConfig,
    deltaSeconds: number,
    lockedHeightMeters: number,
    preferredLookYawRadians: number | null = null,
    filterPredicate?: RapierQueryFilterPredicate,
    blockerResolution?: MetaverseAuthoritativeSurfaceDriveBlockerResolutionOptions
  ): MetaverseAuthoritativeSurfaceDriveSnapshot {
    if (deltaSeconds <= 0) {
      return this.#snapshot;
    }

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
    const desiredDeltaX = motionSnapshot.velocityX * deltaSeconds;
    const desiredDeltaZ = motionSnapshot.velocityZ * deltaSeconds;
    const desiredMovement = this.#physicsRuntime.createVector3(
      desiredDeltaX,
      0,
      desiredDeltaZ
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
    const resolvedRootPosition =
      blockerResolution === undefined
        ? clampedRootPosition
        : this.#constrainPlanarPositionAgainstSharedBlockers(
            clampedRootPosition,
            blockerResolution
          );
    const appliedDeltaX = resolvedRootPosition.x - this.#snapshot.position.x;
    const appliedDeltaY = lockedHeightMeters - this.#snapshot.position.y;
    const appliedDeltaZ = resolvedRootPosition.z - this.#snapshot.position.z;
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
      this.#rootToColliderCenter(resolvedRootPosition, nextYawRadians)
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
      resolvedRootPosition,
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

  #constrainPlanarPositionAgainstSharedBlockers(
    nextPosition: PhysicsVector3Snapshot,
    blockerResolution: MetaverseAuthoritativeSurfaceDriveBlockerResolutionOptions
  ): PhysicsVector3Snapshot {
    const currentHeightRange = this.#resolveCollisionHeightRangeMeters(
      this.#snapshot.position.y
    );
    const nextHeightRange = this.#resolveCollisionHeightRangeMeters(
      nextPosition.y
    );

    return constrainMetaverseWorldPlanarPositionAgainstBlockers(
      blockerResolution.surfaceColliderSnapshots,
      this.#snapshot.position,
      nextPosition,
      this.#planarCollisionPaddingMeters,
      Math.min(currentHeightRange.minHeightMeters, nextHeightRange.minHeightMeters),
      Math.max(currentHeightRange.maxHeightMeters, nextHeightRange.maxHeightMeters),
      blockerResolution.excludedOwnerEnvironmentAssetId ?? null
    );
  }

  #resolveCollisionHeightRangeMeters(rootPositionY: number): {
    readonly maxHeightMeters: number;
    readonly minHeightMeters: number;
  } {
    if (this.#config.shape.kind === "capsule") {
      const standingOffsetMeters =
        this.#config.shape.halfHeightMeters + this.#config.shape.radiusMeters;

      return Object.freeze({
        maxHeightMeters: rootPositionY + standingOffsetMeters * 2,
        minHeightMeters: rootPositionY
      });
    }

    return Object.freeze({
      maxHeightMeters:
        rootPositionY +
        this.#config.shape.localCenter.y +
        this.#config.shape.halfExtents.y,
      minHeightMeters:
        rootPositionY +
        this.#config.shape.localCenter.y -
        this.#config.shape.halfExtents.y
    });
  }

  get #planarCollisionPaddingMeters(): number {
    return this.#config.shape.kind === "capsule"
      ? this.#config.shape.radiusMeters
      : Math.max(
          this.#config.shape.halfExtents.x,
          this.#config.shape.halfExtents.z
        );
  }
}
