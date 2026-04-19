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

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function wrapRadians(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let nextValue = rawValue;

  while (nextValue > Math.PI) {
    nextValue -= Math.PI * 2;
  }

  while (nextValue <= -Math.PI) {
    nextValue += Math.PI * 2;
  }

  return nextValue;
}

function freezeVector3(
  x: number,
  y: number,
  z: number
): PhysicsVector3Snapshot {
  return Object.freeze({
    x: toFiniteNumber(x),
    y: toFiniteNumber(y),
    z: toFiniteNumber(z)
  });
}

function createYawQuaternionSnapshot(yawRadians: number): PhysicsQuaternionSnapshot {
  const halfYawRadians = wrapRadians(yawRadians) * 0.5;

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
  return Object.freeze({
    additionalMass: Math.max(0, toFiniteNumber(config.additionalMass)),
    angularDamping: Math.max(0, toFiniteNumber(config.angularDamping)),
    colliderCenter: freezeVector3(
      config.colliderCenter.x,
      config.colliderCenter.y,
      config.colliderCenter.z
    ),
    gravityScale: Math.max(0, toFiniteNumber(config.gravityScale, 1)),
    halfExtents: freezeVector3(
      Math.max(0.01, Math.abs(toFiniteNumber(config.halfExtents.x, 0.5))),
      Math.max(0.01, Math.abs(toFiniteNumber(config.halfExtents.y, 0.5))),
      Math.max(0.01, Math.abs(toFiniteNumber(config.halfExtents.z, 0.5)))
    ),
    linearDamping: Math.max(0, toFiniteNumber(config.linearDamping)),
    lockRotations: config.lockRotations,
    spawnPosition: freezeVector3(
      config.spawnPosition.x,
      config.spawnPosition.y,
      config.spawnPosition.z
    ),
    spawnYawRadians: wrapRadians(config.spawnYawRadians)
  });
}

function freezeDynamicCuboidBodySnapshot(
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  linearVelocity: PhysicsVector3Snapshot
): MetaverseDynamicCuboidBodySnapshot {
  return Object.freeze({
    linearVelocity,
    position,
    yawRadians: wrapRadians(yawRadians)
  });
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
    this.#snapshot = freezeDynamicCuboidBodySnapshot(
      this.#config.spawnPosition,
      this.#config.spawnYawRadians,
      freezeVector3(0, 0, 0)
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
    const position = freezeVector3(
      snapshot.position.x,
      snapshot.position.y,
      snapshot.position.z
    );
    const linearVelocity = freezeVector3(
      snapshot.linearVelocity.x,
      snapshot.linearVelocity.y,
      snapshot.linearVelocity.z
    );

    rigidBody.setTranslation(position, true);
    rigidBody.setLinvel(linearVelocity, true);
    this.#snapshot = freezeDynamicCuboidBodySnapshot(
      position,
      snapshot.yawRadians,
      linearVelocity
    );
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
    this.#snapshot = freezeDynamicCuboidBodySnapshot(
      this.#config.spawnPosition,
      this.#config.spawnYawRadians,
      freezeVector3(0, 0, 0)
    );
  }

  syncSnapshot(): MetaverseDynamicCuboidBodySnapshot {
    const rigidBody = this.#requireRigidBody();
    const translation = rigidBody.translation();
    const linearVelocity = rigidBody.linvel();

    this.#snapshot = freezeDynamicCuboidBodySnapshot(
      freezeVector3(translation.x, translation.y, translation.z),
      this.#config.spawnYawRadians,
      freezeVector3(linearVelocity.x, linearVelocity.y, linearVelocity.z)
    );

    return this.#snapshot;
  }

  dispose(): void {
    if (this.#rigidBody !== null) {
      this.#physicsRuntime.removeRigidBody(this.#rigidBody);
      this.#rigidBody = null;
    }

    this.#snapshot = freezeDynamicCuboidBodySnapshot(
      this.#config.spawnPosition,
      this.#config.spawnYawRadians,
      freezeVector3(0, 0, 0)
    );
  }

  #requireRigidBody(): RapierRigidBodyHandle {
    if (this.#rigidBody === null) {
      throw new Error("Metaverse dynamic cuboid body runtime must be initialized before use.");
    }

    return this.#rigidBody;
  }
}
