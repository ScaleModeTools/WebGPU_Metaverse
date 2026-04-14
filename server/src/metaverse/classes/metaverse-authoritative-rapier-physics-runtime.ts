import { createRequire } from "node:module";

import type {
  PhysicsQuaternionSnapshot,
  PhysicsVector3Snapshot,
  RapierApiHandle,
  RapierCharacterControllerHandle,
  RapierColliderHandle,
  RapierVectorLike,
  RapierWorldHandle
} from "../types/metaverse-authoritative-rapier.js";

const require = createRequire(import.meta.url);
const RAPIER = require("@dimforge/rapier3d-compat") as RapierApiHandle;

await RAPIER.init();

const defaultGravity = Object.freeze({
  x: 0,
  y: -9.81,
  z: 0
});
const identityQuaternion = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
  w: 1
});

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function sanitizeQuaternion(
  rotation: PhysicsQuaternionSnapshot
): PhysicsQuaternionSnapshot {
  const x = toFiniteNumber(rotation.x);
  const y = toFiniteNumber(rotation.y);
  const z = toFiniteNumber(rotation.z);
  const w = toFiniteNumber(rotation.w, 1);
  const magnitude = Math.hypot(x, y, z, w);

  if (magnitude <= 0.000001) {
    return identityQuaternion;
  }

  return Object.freeze({
    x: x / magnitude,
    y: y / magnitude,
    z: z / magnitude,
    w: w / magnitude
  });
}

export class MetaverseAuthoritativeRapierPhysicsRuntime {
  readonly #world: RapierWorldHandle;

  constructor(
    gravity: PhysicsVector3Snapshot = defaultGravity
  ) {
    this.#world = new RAPIER.World(this.createVector3(gravity.x, gravity.y, gravity.z));
  }

  createVector3(x: number, y: number, z: number): RapierVectorLike {
    return new RAPIER.Vector3(
      toFiniteNumber(x),
      toFiniteNumber(y),
      toFiniteNumber(z)
    );
  }

  createCapsuleCollider(
    halfHeightMeters: number,
    radiusMeters: number,
    translation: PhysicsVector3Snapshot
  ): RapierColliderHandle {
    const colliderDesc = RAPIER.ColliderDesc.capsule(
      Math.max(0, toFiniteNumber(halfHeightMeters)),
      Math.max(0.01, toFiniteNumber(radiusMeters, 0.35))
    );

    colliderDesc.setTranslation(
      toFiniteNumber(translation.x),
      toFiniteNumber(translation.y),
      toFiniteNumber(translation.z)
    );

    return this.#world.createCollider(colliderDesc);
  }

  createCharacterController(
    offsetMeters: number
  ): RapierCharacterControllerHandle {
    return this.#world.createCharacterController(
      Math.max(0.001, toFiniteNumber(offsetMeters, 0.01))
    );
  }

  createCuboidCollider(
    halfExtents: PhysicsVector3Snapshot,
    translation: PhysicsVector3Snapshot,
    rotation: PhysicsQuaternionSnapshot = identityQuaternion
  ): RapierColliderHandle {
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      Math.max(0.01, toFiniteNumber(halfExtents.x, 0.5)),
      Math.max(0.01, toFiniteNumber(halfExtents.y, 0.5)),
      Math.max(0.01, toFiniteNumber(halfExtents.z, 0.5))
    );

    colliderDesc.setTranslation(
      toFiniteNumber(translation.x),
      toFiniteNumber(translation.y),
      toFiniteNumber(translation.z)
    );
    colliderDesc.setRotation(sanitizeQuaternion(rotation));

    return this.#world.createCollider(colliderDesc);
  }

  stepSimulation(deltaSeconds: number): void {
    this.#world.timestep =
      Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 1 / 60;
    this.#world.step();
  }

  removeCollider(collider: RapierColliderHandle): void {
    this.#world.removeCollider(collider, true);
  }
}
