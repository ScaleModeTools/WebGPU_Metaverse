import type { Object3D } from "three/webgpu";
import { RapierHelper } from "three/addons/helpers/RapierHelper.js";

import type {
  PhysicsQuaternionSnapshot,
  PhysicsVector3Snapshot,
  RapierApiHandle,
  RapierCharacterControllerHandle,
  RapierColliderHandle,
  RapierPhysicsAddon
} from "../types/metaverse-grounded-body";

interface RapierPhysicsRuntimeDependencies {
  readonly createDebugHelper?: (
    addon: RapierPhysicsAddon
  ) => (Object3D & { dispose?(): void; update?(): void }) | null;
  readonly createPhysicsAddon?: () => Promise<RapierPhysicsAddon>;
}

const defaultGravity = Object.freeze({
  x: 0,
  y: -9.81,
  z: 0
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
    return Object.freeze({
      x: 0,
      y: 0,
      z: 0,
      w: 1
    });
  }

  return Object.freeze({
    x: x / magnitude,
    y: y / magnitude,
    z: z / magnitude,
    w: w / magnitude
  });
}

async function createDefaultPhysicsAddon(): Promise<RapierPhysicsAddon> {
  const rapierModule = (await import("@dimforge/rapier3d")) as unknown as
    RapierApiHandle;

  return {
    RAPIER: rapierModule,
    world: new rapierModule.World(defaultGravity)
  } satisfies RapierPhysicsAddon;
}

function createDefaultDebugHelper(
  addon: RapierPhysicsAddon
): Object3D & { dispose?(): void; update?(): void } {
  const world = addon.world as unknown as ConstructorParameters<
    typeof RapierHelper
  >[0];

  return new RapierHelper(world) as Object3D & {
    dispose?(): void;
    update?(): void;
  };
}

export class RapierPhysicsRuntime {
  readonly #createDebugHelper: NonNullable<
    RapierPhysicsRuntimeDependencies["createDebugHelper"]
  >;
  readonly #createPhysicsAddon: NonNullable<
    RapierPhysicsRuntimeDependencies["createPhysicsAddon"]
  >;

  #addon: RapierPhysicsAddon | null = null;
  #initPromise: Promise<RapierPhysicsAddon> | null = null;

  constructor(dependencies: RapierPhysicsRuntimeDependencies = {}) {
    this.#createDebugHelper =
      dependencies.createDebugHelper ?? createDefaultDebugHelper;
    this.#createPhysicsAddon =
      dependencies.createPhysicsAddon ?? createDefaultPhysicsAddon;
  }

  get isInitialized(): boolean {
    return this.#addon !== null;
  }

  async init(): Promise<void> {
    await this.#ensureAddon();
  }

  createCapsuleCollider(
    halfHeightMeters: number,
    radiusMeters: number,
    translation: PhysicsVector3Snapshot
  ): RapierColliderHandle {
    const addon = this.#requireAddon();
    const colliderDesc = addon.RAPIER.ColliderDesc.capsule(
      Math.max(0, toFiniteNumber(halfHeightMeters)),
      Math.max(0.01, toFiniteNumber(radiusMeters, 0.35))
    );

    colliderDesc.setTranslation(
      toFiniteNumber(translation.x),
      toFiniteNumber(translation.y),
      toFiniteNumber(translation.z)
    );

    return addon.world.createCollider(colliderDesc);
  }

  createCharacterController(
    offsetMeters: number
  ): RapierCharacterControllerHandle {
    return this.#requireAddon().world.createCharacterController(
      Math.max(0.001, toFiniteNumber(offsetMeters, 0.01))
    );
  }

  stepSimulation(deltaSeconds: number): void {
    const world = this.#requireAddon().world;
    const timestepSeconds = toFiniteNumber(deltaSeconds, 1 / 60);

    world.timestep =
      timestepSeconds > 0 ? timestepSeconds : 1 / 60;
    world.step();
  }

  createDebugHelper():
    | (Object3D & { dispose?(): void; update?(): void })
    | null {
    return this.#createDebugHelper(this.#requireAddon());
  }

  createFixedCuboidCollider(
    halfExtents: PhysicsVector3Snapshot,
    translation: PhysicsVector3Snapshot,
    rotation: PhysicsQuaternionSnapshot = Object.freeze({
      x: 0,
      y: 0,
      z: 0,
      w: 1
    })
  ): RapierColliderHandle {
    const addon = this.#requireAddon();
    const colliderDesc = addon.RAPIER.ColliderDesc.cuboid(
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

    return addon.world.createCollider(colliderDesc);
  }

  createFixedTriMeshCollider(
    vertices: Float32Array,
    indices: Uint32Array
  ): RapierColliderHandle {
    const addon = this.#requireAddon();
    const colliderDesc = addon.RAPIER.ColliderDesc.trimesh(vertices, indices);

    return addon.world.createCollider(colliderDesc);
  }

  createVector3(
    x: number,
    y: number,
    z: number
  ): InstanceType<NonNullable<RapierPhysicsAddon["RAPIER"]["Vector3"]>> {
    const addon = this.#requireAddon();

    return new addon.RAPIER.Vector3(
      toFiniteNumber(x),
      toFiniteNumber(y),
      toFiniteNumber(z)
    ) as InstanceType<NonNullable<RapierPhysicsAddon["RAPIER"]["Vector3"]>>;
  }

  removeCollider(collider: RapierColliderHandle): void {
    this.#requireAddon().world.removeCollider(collider, false);
  }

  async #ensureAddon(): Promise<RapierPhysicsAddon> {
    if (this.#addon !== null) {
      return this.#addon;
    }

    if (this.#initPromise !== null) {
      return this.#initPromise;
    }

    const initPromise = this.#createPhysicsAddon().then((addon) => {
      this.#addon = addon;

      return addon;
    });

    this.#initPromise = initPromise;

    try {
      return await initPromise;
    } finally {
      if (this.#initPromise === initPromise) {
        this.#initPromise = null;
      }
    }
  }

  #requireAddon(): RapierPhysicsAddon {
    if (this.#addon === null) {
      throw new Error(
        "Rapier physics runtime must be initialized before creating controllers or colliders."
      );
    }

    return this.#addon;
  }
}
