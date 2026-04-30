import { createRequire } from "node:module";

import type {
  PhysicsQuaternionSnapshot,
  PhysicsVector3Snapshot,
  RapierApiHandle,
  RapierCharacterControllerHandle,
  RapierColliderHandle,
  RapierRigidBodyHandle,
  RapierVectorLike,
  RapierWorldHandle
} from "../types/metaverse-authoritative-rapier.js";

const require = createRequire(import.meta.url);
const RAPIER = require("@dimforge/rapier3d-compat") as RapierApiHandle;
const rapierDeprecatedInitWarning =
  "using deprecated parameters for the initialization function; pass a single object instead";

async function initializeRapier(): Promise<void> {
  const originalWarn = console.warn;

  console.warn = (...data: Parameters<typeof console.warn>): void => {
    if (data.length === 1 && data[0] === rapierDeprecatedInitWarning) {
      return;
    }

    originalWarn(...data);
  };

  try {
    await RAPIER.init();
  } finally {
    console.warn = originalWarn;
  }
}

await initializeRapier();

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
const zeroVector = Object.freeze({
  x: 0,
  y: 0,
  z: 0
});

interface DynamicCuboidBodyOptions {
  readonly additionalMass?: number;
  readonly angularDamping?: number;
  readonly colliderTranslation?: PhysicsVector3Snapshot;
  readonly gravityScale?: number;
  readonly linearDamping?: number;
  readonly lockRotations?: boolean;
  readonly rotation?: PhysicsQuaternionSnapshot;
}

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function readRayHitDistanceMeters(input: {
  readonly timeOfImpact?: number;
  readonly toi?: number;
}): number | null {
  const distanceMeters =
    input.timeOfImpact === undefined ? input.toi : input.timeOfImpact;

  return distanceMeters !== undefined &&
    Number.isFinite(distanceMeters) &&
    distanceMeters >= 0
    ? distanceMeters
    : null;
}

function readRayHitNormal(input: { readonly normal?: RapierVectorLike }): PhysicsVector3Snapshot | null {
  const normal = input.normal;

  if (
    normal === undefined ||
    !Number.isFinite(normal.x) ||
    !Number.isFinite(normal.y) ||
    !Number.isFinite(normal.z)
  ) {
    return null;
  }

  const length = Math.hypot(normal.x, normal.y, normal.z);

  if (length <= 0.000001) {
    return null;
  }

  return Object.freeze({
    x: normal.x / length,
    y: normal.y / length,
    z: normal.z / length
  });
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

function createRapierHeightfieldSamples(
  sampleCountX: number,
  sampleCountZ: number,
  heightSamples: ArrayLike<number>
): Float32Array {
  const width = Math.max(2, Math.round(toFiniteNumber(sampleCountX, 2)));
  const depth = Math.max(2, Math.round(toFiniteNumber(sampleCountZ, 2)));
  const samples = new Float32Array(width * depth);

  for (let sampleX = 0; sampleX < width; sampleX += 1) {
    for (let sampleZ = 0; sampleZ < depth; sampleZ += 1) {
      const sourceIndex = sampleZ * width + sampleX;
      const targetIndex = sampleX * depth + sampleZ;

      samples[targetIndex] = toFiniteNumber(heightSamples[sourceIndex] ?? 0);
    }
  }

  return samples;
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

  createHeightfieldCollider(
    sampleCountX: number,
    sampleCountZ: number,
    sampleSpacingMeters: number,
    heightSamples: ArrayLike<number>,
    translation: PhysicsVector3Snapshot,
    rotation: PhysicsQuaternionSnapshot = identityQuaternion
  ): RapierColliderHandle {
    const width = Math.max(2, Math.round(toFiniteNumber(sampleCountX, 2)));
    const depth = Math.max(2, Math.round(toFiniteNumber(sampleCountZ, 2)));
    const spacing = Math.max(0.01, toFiniteNumber(sampleSpacingMeters, 1));
    const colliderDesc = RAPIER.ColliderDesc.heightfield(
      width - 1,
      depth - 1,
      createRapierHeightfieldSamples(width, depth, heightSamples),
      this.createVector3((width - 1) * spacing, 1, (depth - 1) * spacing)
    );

    colliderDesc.setTranslation(
      toFiniteNumber(translation.x),
      toFiniteNumber(translation.y),
      toFiniteNumber(translation.z)
    );
    colliderDesc.setRotation(sanitizeQuaternion(rotation));

    return this.#world.createCollider(colliderDesc);
  }

  createTriMeshCollider(
    vertices: Float32Array,
    indices: Uint32Array,
    translation: PhysicsVector3Snapshot = zeroVector,
    rotation: PhysicsQuaternionSnapshot = identityQuaternion
  ): RapierColliderHandle {
    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);

    colliderDesc.setTranslation(
      toFiniteNumber(translation.x),
      toFiniteNumber(translation.y),
      toFiniteNumber(translation.z)
    );
    colliderDesc.setRotation(sanitizeQuaternion(rotation));

    return this.#world.createCollider(colliderDesc);
  }

  createDynamicCuboidBody(
    halfExtents: PhysicsVector3Snapshot,
    translation: PhysicsVector3Snapshot,
    options: DynamicCuboidBodyOptions = {}
  ): {
    readonly body: RapierRigidBodyHandle;
    readonly collider: RapierColliderHandle;
  } {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();

    rigidBodyDesc.setTranslation(
      toFiniteNumber(translation.x),
      toFiniteNumber(translation.y),
      toFiniteNumber(translation.z)
    );
    rigidBodyDesc.setRotation(
      sanitizeQuaternion(options.rotation ?? identityQuaternion)
    );
    rigidBodyDesc.setGravityScale(
      Math.max(0, toFiniteNumber(options.gravityScale ?? 1))
    );
    rigidBodyDesc.setAdditionalMass(
      Math.max(0, toFiniteNumber(options.additionalMass ?? 0))
    );
    rigidBodyDesc.setLinearDamping(
      Math.max(0, toFiniteNumber(options.linearDamping ?? 0))
    );
    rigidBodyDesc.setAngularDamping(
      Math.max(0, toFiniteNumber(options.angularDamping ?? 0))
    );

    if (options.lockRotations ?? false) {
      rigidBodyDesc.lockRotations();
    }

    const body = this.#world.createRigidBody(rigidBodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      Math.max(0.01, toFiniteNumber(halfExtents.x, 0.5)),
      Math.max(0.01, toFiniteNumber(halfExtents.y, 0.5)),
      Math.max(0.01, toFiniteNumber(halfExtents.z, 0.5))
    );
    const colliderTranslation = options.colliderTranslation;

    if (colliderTranslation !== undefined) {
      colliderDesc.setTranslation(
        toFiniteNumber(colliderTranslation.x),
        toFiniteNumber(colliderTranslation.y),
        toFiniteNumber(colliderTranslation.z)
      );
    }

    return Object.freeze({
      body,
      collider: this.#world.createCollider(colliderDesc, body)
    });
  }

  castRay(
    origin: PhysicsVector3Snapshot,
    direction: PhysicsVector3Snapshot,
    maxDistanceMeters: number,
    filterPredicate?: (
      collider: RapierColliderHandle
    ) => boolean
  ): {
    readonly collider: RapierColliderHandle;
    readonly distanceMeters: number;
    readonly normal: PhysicsVector3Snapshot | null;
    readonly point: PhysicsVector3Snapshot;
  } | null {
    const normalizedMaxDistance =
      Number.isFinite(maxDistanceMeters) && maxDistanceMeters > 0
        ? maxDistanceMeters
        : 0;

    if (normalizedMaxDistance <= 0) {
      return null;
    }

    const ray = new RAPIER.Ray(
      this.createVector3(origin.x, origin.y, origin.z),
      this.createVector3(direction.x, direction.y, direction.z)
    );
    const rayHit = this.#world.castRayAndGetNormal(
      ray,
      normalizedMaxDistance,
      true,
      undefined,
      undefined,
      null,
      null,
      filterPredicate
    );

    if (rayHit === null) {
      return null;
    }

    const distanceMeters = readRayHitDistanceMeters(rayHit);
    const normal = readRayHitNormal(rayHit);

    if (distanceMeters === null) {
      return null;
    }

    const point = Object.freeze({
      x: origin.x + direction.x * distanceMeters,
      y: origin.y + direction.y * distanceMeters,
      z: origin.z + direction.z * distanceMeters
    });

    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !Number.isFinite(point.z)
    ) {
      return null;
    }

    return Object.freeze({
      collider: rayHit.collider,
      distanceMeters,
      normal,
      point
    });
  }

  stepSimulation(deltaSeconds: number): void {
    this.#world.timestep =
      Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 1 / 60;
    this.#world.step();
  }

  removeCollider(collider: RapierColliderHandle): void {
    this.#world.removeCollider(collider, true);
  }

  removeRigidBody(body: RapierRigidBodyHandle): void {
    this.#world.removeRigidBody(body);
  }
}
