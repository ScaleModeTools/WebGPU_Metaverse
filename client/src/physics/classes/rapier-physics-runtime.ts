import type { Object3D } from "three/webgpu";
import { RapierHelper } from "three/addons/helpers/RapierHelper.js";
import { RapierPhysics } from "three/addons/physics/RapierPhysics.js";

import type {
  PhysicsVector3Snapshot,
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

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

async function createDefaultPhysicsAddon(): Promise<RapierPhysicsAddon> {
  return (await RapierPhysics()) as RapierPhysicsAddon;
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

  createDebugHelper():
    | (Object3D & { dispose?(): void; update?(): void })
    | null {
    return this.#createDebugHelper(this.#requireAddon());
  }

  createFixedCuboidCollider(
    halfExtents: PhysicsVector3Snapshot,
    translation: PhysicsVector3Snapshot
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
