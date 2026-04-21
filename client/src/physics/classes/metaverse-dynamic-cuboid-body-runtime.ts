import {
  createMetaverseDynamicCuboidBodyConfigSnapshot,
  createMetaverseDynamicCuboidBodyRuntimeSnapshot
} from "@webgpu-metaverse/shared";

import { RapierPhysicsRuntime } from "./rapier-physics-runtime";
import type {
  MetaverseDynamicCuboidBodyConfig,
  MetaverseDynamicCuboidBodySnapshot
} from "../types/metaverse-dynamic-body";
import type {
  PhysicsQuaternionSnapshot,
  PhysicsVector3Snapshot,
  RapierRigidBodyHandle
} from "../types/metaverse-grounded-body";

function createYawQuaternionSnapshot(yawRadians: number): PhysicsQuaternionSnapshot {
  const halfYawRadians = yawRadians * 0.5;

  return Object.freeze({
    x: 0,
    y: Math.sin(halfYawRadians),
    z: 0,
    w: Math.cos(halfYawRadians)
  });
}

function sanitizeConfig(
  config: MetaverseDynamicCuboidBodyConfig
): MetaverseDynamicCuboidBodyConfig {
  return createMetaverseDynamicCuboidBodyConfigSnapshot(config);
}

export class MetaverseDynamicCuboidBodyRuntime {
  readonly #config: MetaverseDynamicCuboidBodyConfig;
  readonly #physicsRuntime: RapierPhysicsRuntime;

  #rigidBody: RapierRigidBodyHandle | null = null;
  #snapshot: MetaverseDynamicCuboidBodySnapshot;

  constructor(
    config: MetaverseDynamicCuboidBodyConfig,
    physicsRuntime: RapierPhysicsRuntime
  ) {
    this.#config = sanitizeConfig(config);
    this.#physicsRuntime = physicsRuntime;
    this.#snapshot = createMetaverseDynamicCuboidBodyRuntimeSnapshot(
      {
        position: this.#config.spawnPosition,
        yawRadians: this.#config.spawnYawRadians
      }
    );
  }

  get isInitialized(): boolean {
    return this.#rigidBody !== null;
  }

  get snapshot(): MetaverseDynamicCuboidBodySnapshot {
    return this.#snapshot;
  }

  syncAuthoritativeState(snapshot: {
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void {
    const rigidBody = this.#requireRigidBody();
    const nextSnapshot = createMetaverseDynamicCuboidBodyRuntimeSnapshot({
      linearVelocity: snapshot.linearVelocity,
      position: snapshot.position,
      yawRadians: snapshot.yawRadians
    });

    rigidBody.setTranslation(nextSnapshot.position, true);
    rigidBody.setLinvel(nextSnapshot.linearVelocity, true);
    this.#snapshot = nextSnapshot;
  }

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.#physicsRuntime.init();
    this.#rigidBody = this.#physicsRuntime.createDynamicCuboidBody(
      this.#config.halfExtents,
      this.#config.spawnPosition,
      {
        additionalMass: this.#config.additionalMass,
        angularDamping: this.#config.angularDamping,
        colliderTranslation: this.#config.colliderCenter,
        gravityScale: this.#config.gravityScale,
        linearDamping: this.#config.linearDamping,
        lockRotations: this.#config.lockRotations,
        rotation: createYawQuaternionSnapshot(this.#config.spawnYawRadians)
      }
    ).body;
    this.#snapshot = createMetaverseDynamicCuboidBodyRuntimeSnapshot(
      {
        position: this.#config.spawnPosition,
        yawRadians: this.#config.spawnYawRadians
      }
    );
  }

  syncSnapshot(): MetaverseDynamicCuboidBodySnapshot {
    const rigidBody = this.#requireRigidBody();
    const translation = rigidBody.translation();
    const linearVelocity = rigidBody.linvel();

    this.#snapshot = createMetaverseDynamicCuboidBodyRuntimeSnapshot({
      linearVelocity,
      position: translation,
      yawRadians: this.#config.spawnYawRadians
    });

    return this.#snapshot;
  }

  dispose(): void {
    if (this.#rigidBody !== null) {
      this.#physicsRuntime.removeRigidBody(this.#rigidBody);
      this.#rigidBody = null;
    }

    this.#snapshot = createMetaverseDynamicCuboidBodyRuntimeSnapshot(
      {
        position: this.#config.spawnPosition,
        yawRadians: this.#config.spawnYawRadians
      }
    );
  }

  #requireRigidBody(): RapierRigidBodyHandle {
    if (this.#rigidBody === null) {
      throw new Error("Metaverse dynamic cuboid body runtime must be initialized before use.");
    }

    return this.#rigidBody;
  }
}
