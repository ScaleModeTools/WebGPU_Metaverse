import {
  createMetaverseSurfaceDriveBodyConfigSnapshot,
  createMetaverseSurfaceDriveBodyRuntimeSnapshot,
  constrainMetaverseWorldPlanarPositionAgainstBlockers,
  resolveMetaverseSurfaceDriveBodyStep,
  createMetaverseSurfaceTraversalVector3Snapshot as freezeVector3,
  toFiniteNumber,
  wrapRadians,
  type MetaverseSurfaceDriveBodyConfigSnapshot,
  type MetaverseSurfaceTraversalConfig,
  type MetaverseSurfaceDriveBodyIntentSnapshot,
  type MetaverseSurfaceDriveBodyRuntimeSnapshot,
  type MetaverseWorldPlacedSurfaceColliderSnapshot
} from "@webgpu-metaverse/shared";

import { RapierPhysicsRuntime } from "./rapier-physics-runtime";
import type {
  PhysicsQuaternionSnapshot,
  PhysicsVector3Snapshot,
  RapierCharacterControllerHandle,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../types/metaverse-grounded-body";

export type { MetaverseSurfaceDriveBodyIntentSnapshot } from "@webgpu-metaverse/shared";

export type MetaverseSurfaceDriveBodyRuntimeConfig =
  MetaverseSurfaceDriveBodyConfigSnapshot;

export type MetaverseSurfaceDriveBodySnapshot =
  MetaverseSurfaceDriveBodyRuntimeSnapshot;

export interface MetaverseSurfaceDriveBodyBlockerResolutionOptions {
  readonly excludedOwnerEnvironmentAssetId?: string | null;
  readonly surfaceColliderSnapshots:
    readonly MetaverseWorldPlacedSurfaceColliderSnapshot[];
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

  #snapshot: MetaverseSurfaceDriveBodySnapshot;

  constructor(
    config: MetaverseSurfaceDriveBodyRuntimeConfig,
    physicsRuntime: RapierPhysicsRuntime
  ) {
    this.#config = createMetaverseSurfaceDriveBodyConfigSnapshot(config);
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
    this.#snapshot = createMetaverseSurfaceDriveBodyRuntimeSnapshot({
      linearVelocity: freezeVector3(0, 0, 0),
      position: this.#config.spawnPosition,
      yawRadians: this.#config.spawnYawRadians
    });
  }

  get colliderHandle(): RapierColliderHandle {
    return this.#collider;
  }

  get snapshot(): MetaverseSurfaceDriveBodySnapshot {
    return this.#snapshot;
  }

  captureStateSnapshot(): MetaverseSurfaceDriveBodySnapshot {
    return this.#snapshot;
  }

  restoreStateSnapshot(snapshot: MetaverseSurfaceDriveBodySnapshot): void {
    this.#collider.setTranslation(
      this.#rootToColliderCenter(
        snapshot.position,
        snapshot.yawRadians
      )
    );

    if (this.#config.shape.kind === "cuboid") {
      this.#collider.setRotation(
        quaternionFromYawRadians(snapshot.yawRadians)
      );
    }

    this.#snapshot = snapshot;
  }

  syncAuthoritativeState(snapshot: {
    readonly contact?: MetaverseSurfaceDriveBodyRuntimeSnapshot["contact"] | null;
    readonly driveTarget?: MetaverseSurfaceDriveBodyRuntimeSnapshot["driveTarget"] | null;
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

    this.#collider.setTranslation(this.#rootToColliderCenter(position, yawRadians));

    if (this.#config.shape.kind === "cuboid") {
      this.#collider.setRotation(quaternionFromYawRadians(yawRadians));
    }

    this.#snapshot = createMetaverseSurfaceDriveBodyRuntimeSnapshot({
      contact: snapshot.contact ?? this.#snapshot.contact,
      driveTarget: snapshot.driveTarget ?? this.#snapshot.driveTarget,
      linearVelocity,
      position,
      yawRadians
    });
  }

  advance(
    intentSnapshot: MetaverseSurfaceDriveBodyIntentSnapshot,
    locomotionConfig: MetaverseSurfaceTraversalConfig,
    deltaSeconds: number,
    lockedHeightMeters: number,
    preferredLookYawRadians: number | null = null,
    filterPredicate?: RapierQueryFilterPredicate,
    blockerResolution?: MetaverseSurfaceDriveBodyBlockerResolutionOptions
  ): MetaverseSurfaceDriveBodySnapshot {
    if (deltaSeconds <= 0) {
      return this.#snapshot;
    }

    this.#physicsRuntime.stepSimulation(deltaSeconds);
    const nextBodyStep = resolveMetaverseSurfaceDriveBodyStep({
      currentSnapshot: this.#snapshot,
      deltaSeconds,
      intentSnapshot,
      lockedHeightMeters,
      locomotionConfig,
      preferredLookYawRadians,
      resolveUnclampedRootPosition: ({
        desiredDeltaX,
        desiredDeltaZ,
        nextYawRadians
      }) => {
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

        return this.#colliderCenterToRoot(
          freezeVector3(
            currentTranslation.x + computedMovement.x,
            currentTranslation.y + computedMovement.y,
            currentTranslation.z + computedMovement.z
          ),
          nextYawRadians
        );
      },
      ...(blockerResolution === undefined
        ? {}
        : {
            resolveBlockedPlanarPosition: (
              rootPosition: PhysicsVector3Snapshot
            ) =>
              this.#constrainPlanarPositionAgainstSharedBlockers(
                rootPosition,
                blockerResolution
              )
          }),
      worldRadius: this.#config.worldRadius
    });
    this.#snapshot = nextBodyStep.nextSnapshot;

    this.#collider.setTranslation(
      this.#rootToColliderCenter(
        nextBodyStep.resolvedRootPosition,
        nextBodyStep.nextYawRadians
      )
    );

    if (this.#config.shape.kind === "cuboid") {
      this.#collider.setRotation(
        quaternionFromYawRadians(nextBodyStep.nextYawRadians)
      );
    }

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

    this.#snapshot = createMetaverseSurfaceDriveBodyRuntimeSnapshot({
      linearVelocity: freezeVector3(0, 0, 0),
      position: sanitizedPosition,
      yawRadians: wrappedYawRadians
    });
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
    blockerResolution: MetaverseSurfaceDriveBodyBlockerResolutionOptions
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
