import {
  createMetaverseDynamicCuboidBodyConfigSnapshot,
  createMetaverseDynamicCuboidBodyRuntimeSnapshot,
  type MetaverseDynamicCuboidBodyConfigSnapshot,
  type MetaverseDynamicCuboidBodyRuntimeSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

import { MetaverseAuthoritativeRapierPhysicsRuntime } from "./metaverse-authoritative-rapier-physics-runtime.js";
import type {
  PhysicsQuaternionSnapshot,
  RapierRigidBodyHandle
} from "../types/metaverse-authoritative-rapier.js";

export type MetaverseAuthoritativeDynamicCuboidBodyConfig =
  MetaverseDynamicCuboidBodyConfigSnapshot;
export type MetaverseAuthoritativeDynamicCuboidBodySnapshot =
  MetaverseDynamicCuboidBodyRuntimeSnapshot;

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
  config: MetaverseAuthoritativeDynamicCuboidBodyConfig
): MetaverseAuthoritativeDynamicCuboidBodyConfig {
  return createMetaverseDynamicCuboidBodyConfigSnapshot(config);
}

export class MetaverseAuthoritativeDynamicCuboidBodyRuntime {
  readonly #config: MetaverseAuthoritativeDynamicCuboidBodyConfig;
  readonly #physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;

  #rigidBody: RapierRigidBodyHandle | null = null;
  #snapshot: MetaverseAuthoritativeDynamicCuboidBodySnapshot;

  constructor(
    config: MetaverseAuthoritativeDynamicCuboidBodyConfig,
    physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime
  ) {
    this.#config = sanitizeConfig(config);
    this.#physicsRuntime = physicsRuntime;
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

  get snapshot(): MetaverseAuthoritativeDynamicCuboidBodySnapshot {
    return this.#snapshot;
  }

  syncSnapshot(): MetaverseAuthoritativeDynamicCuboidBodySnapshot {
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
      throw new Error("Metaverse authoritative dynamic cuboid body runtime must be initialized before use.");
    }

    return this.#rigidBody;
  }
}
