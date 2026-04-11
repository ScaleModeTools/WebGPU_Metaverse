import type { Object3D, Scene } from "three/webgpu";

import {
  MetaverseDynamicCuboidBodyRuntime,
  MetaverseGroundedBodyRuntime,
  RapierPhysicsRuntime,
  type PhysicsVector3Snapshot,
  type RapierColliderHandle
} from "@/physics";
import type { SceneAssetLoader } from "../render/webgpu-metaverse-scene";
import {
  resolvePlacedCollisionTriMeshes,
  resolvePlacedCuboidColliders,
  type MetaversePlacedCuboidColliderSnapshot
} from "../states/metaverse-environment-collision";
import type {
  MetaverseEnvironmentProofConfig,
  MetaverseRuntimeConfig,
  MetaverseVector3Snapshot
} from "../types/metaverse-runtime";

interface MetaverseEnvironmentPhysicsSceneRuntime {
  readonly scene: Scene;
  setDynamicEnvironmentPose(
    environmentAssetId: string,
    poseSnapshot: {
      readonly position: MetaverseVector3Snapshot;
      readonly yawRadians: number;
    } | null
  ): void;
}

interface MetaverseEnvironmentPhysicsRuntimeDependencies {
  readonly createSceneAssetLoader: () => SceneAssetLoader;
  readonly environmentProofConfig: MetaverseEnvironmentProofConfig | null;
  readonly groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly physicsRuntime: RapierPhysicsRuntime;
  readonly sceneRuntime: MetaverseEnvironmentPhysicsSceneRuntime;
  readonly showPhysicsDebug: boolean;
}

type MetaversePhysicsDebugObject = Object3D & {
  dispose?(): void;
  update?(): void;
};

const metaversePushableBodyAdditionalMass = 12;
const metaversePushableBodyAngularDamping = 10;
const metaversePushableBodyGravityScale = 1;
const metaversePushableBodyLinearDamping = 4.5;

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
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

export class MetaverseEnvironmentPhysicsRuntime {
  readonly #config: MetaverseRuntimeConfig;
  readonly #createSceneAssetLoader: () => SceneAssetLoader;
  readonly #environmentProofConfig: MetaverseEnvironmentProofConfig | null;
  readonly #groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly #physicsRuntime: RapierPhysicsRuntime;
  readonly #sceneRuntime: MetaverseEnvironmentPhysicsSceneRuntime;
  readonly #showPhysicsDebug: boolean;
  readonly #surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];

  #environmentColliders: RapierColliderHandle[] = [];
  #groundCollider: RapierColliderHandle | null = null;
  #physicsDebugObject: MetaversePhysicsDebugObject | null = null;
  #pushableBodyRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseDynamicCuboidBodyRuntime
  >();

  constructor(
    config: MetaverseRuntimeConfig,
    {
      createSceneAssetLoader,
      environmentProofConfig,
      groundedBodyRuntime,
      physicsRuntime,
      sceneRuntime,
      showPhysicsDebug
    }: MetaverseEnvironmentPhysicsRuntimeDependencies
  ) {
    this.#config = config;
    this.#createSceneAssetLoader = createSceneAssetLoader;
    this.#environmentProofConfig = environmentProofConfig;
    this.#groundedBodyRuntime = groundedBodyRuntime;
    this.#physicsRuntime = physicsRuntime;
    this.#sceneRuntime = sceneRuntime;
    this.#showPhysicsDebug = showPhysicsDebug;
    this.#surfaceColliderSnapshots =
      environmentProofConfig === null
        ? Object.freeze([])
        : Object.freeze(
            environmentProofConfig.assets.flatMap((environmentAsset) =>
              resolvePlacedCuboidColliders(environmentAsset)
            )
          );
  }

  get surfaceColliderSnapshots(): readonly MetaversePlacedCuboidColliderSnapshot[] {
    return this.#surfaceColliderSnapshots;
  }

  async boot(initialYawRadians: number): Promise<void> {
    await this.#physicsRuntime.init();
    this.#groundCollider ??= this.#physicsRuntime.createFixedCuboidCollider(
      freezeVector3(
        Math.max(
          this.#config.movement.worldRadius,
          this.#config.ocean.planeWidth * 0.5
        ),
        0.5,
        Math.max(
          this.#config.movement.worldRadius,
          this.#config.ocean.planeDepth * 0.5
        )
      ),
      freezeVector3(0, this.#config.ocean.height - 0.5, 0)
    );
    await this.#bootStaticEnvironmentCollision();
    await this.#bootPushableEnvironmentBodies();
    this.#groundedBodyRuntime.setApplyImpulsesToDynamicBodies(
      this.#pushableBodyRuntimesByEnvironmentAssetId.size > 0
    );
    await this.#groundedBodyRuntime.init(initialYawRadians);

    if (this.#showPhysicsDebug && this.#physicsDebugObject === null) {
      const physicsDebugObject = this.#physicsRuntime.createDebugHelper();

      if (physicsDebugObject !== null) {
        this.#physicsDebugObject = physicsDebugObject;
        this.#sceneRuntime.scene.add(physicsDebugObject);
      }
    }
  }

  dispose(): void {
    if (this.#physicsDebugObject !== null) {
      this.#physicsDebugObject.parent?.remove(this.#physicsDebugObject);
      this.#physicsDebugObject.dispose?.();
      this.#physicsDebugObject = null;
    }

    if (this.#groundCollider !== null) {
      this.#physicsRuntime.removeCollider(this.#groundCollider);
      this.#groundCollider = null;
    }

    for (const environmentCollider of this.#environmentColliders) {
      this.#physicsRuntime.removeCollider(environmentCollider);
    }

    this.#environmentColliders = [];

    for (const [
      environmentAssetId,
      pushableBodyRuntime
    ] of this.#pushableBodyRuntimesByEnvironmentAssetId.entries()) {
      pushableBodyRuntime.dispose();
      this.#sceneRuntime.setDynamicEnvironmentPose(environmentAssetId, null);
    }

    this.#pushableBodyRuntimesByEnvironmentAssetId.clear();
    this.#groundedBodyRuntime.setApplyImpulsesToDynamicBodies(false);
    this.#groundedBodyRuntime.dispose();
  }

  syncPushableBodyPresentations(): void {
    for (const [
      environmentAssetId,
      pushableBodyRuntime
    ] of this.#pushableBodyRuntimesByEnvironmentAssetId.entries()) {
      const pushableBodySnapshot = pushableBodyRuntime.syncSnapshot();

      this.#sceneRuntime.setDynamicEnvironmentPose(
        environmentAssetId,
        Object.freeze({
          position: pushableBodySnapshot.position,
          yawRadians: pushableBodySnapshot.yawRadians
        })
      );
    }
  }

  syncDebugPresentation(): void {
    this.#physicsDebugObject?.update?.();
  }

  async #bootStaticEnvironmentCollision(): Promise<void> {
    if (this.#environmentProofConfig === null) {
      return;
    }

    const sceneAssetLoader = this.#createSceneAssetLoader();
    const collisionAssetsByPath = new Map<
      string,
      Awaited<ReturnType<SceneAssetLoader["loadAsync"]>>
    >();

    for (const environmentAsset of this.#environmentProofConfig.assets) {
      for (const collider of resolvePlacedCuboidColliders(environmentAsset)) {
        this.#environmentColliders.push(
          this.#physicsRuntime.createFixedCuboidCollider(
            collider.halfExtents,
            collider.translation,
            collider.rotation
          )
        );
      }

      if (
        environmentAsset.placement === "dynamic" ||
        environmentAsset.physicsColliders !== null ||
        environmentAsset.collisionPath === null
      ) {
        continue;
      }

      let collisionAsset = collisionAssetsByPath.get(
        environmentAsset.collisionPath
      );

      if (collisionAsset === undefined) {
        collisionAsset = await sceneAssetLoader.loadAsync(
          environmentAsset.collisionPath
        );
        collisionAssetsByPath.set(environmentAsset.collisionPath, collisionAsset);
      }

      for (const triMeshCollider of resolvePlacedCollisionTriMeshes(
        environmentAsset,
        collisionAsset.scene
      )) {
        this.#environmentColliders.push(
          this.#physicsRuntime.createFixedTriMeshCollider(
            triMeshCollider.vertices,
            triMeshCollider.indices
          )
        );
      }
    }
  }

  async #bootPushableEnvironmentBodies(): Promise<void> {
    if (this.#environmentProofConfig === null) {
      return;
    }

    this.#pushableBodyRuntimesByEnvironmentAssetId.clear();

    for (const environmentAsset of this.#environmentProofConfig.assets) {
      if (
        environmentAsset.placement !== "dynamic" ||
        environmentAsset.traversalAffordance !== "pushable"
      ) {
        continue;
      }

      if (environmentAsset.placements.length !== 1) {
        throw new Error(
          `Metaverse pushable environment asset ${environmentAsset.label} requires exactly one placement.`
        );
      }

      if (environmentAsset.collider === null) {
        throw new Error(
          `Metaverse pushable environment asset ${environmentAsset.label} requires collider metadata.`
        );
      }

      const placement = environmentAsset.placements[0]!;
      const collider = environmentAsset.collider;
      const pushableBodyRuntime = new MetaverseDynamicCuboidBodyRuntime(
        {
          additionalMass: metaversePushableBodyAdditionalMass,
          angularDamping: metaversePushableBodyAngularDamping,
          colliderCenter: freezeVector3(
            collider.center.x * placement.scale,
            collider.center.y * placement.scale,
            collider.center.z * placement.scale
          ),
          gravityScale: metaversePushableBodyGravityScale,
          halfExtents: freezeVector3(
            Math.abs(collider.size.x * placement.scale) * 0.5,
            Math.abs(collider.size.y * placement.scale) * 0.5,
            Math.abs(collider.size.z * placement.scale) * 0.5
          ),
          linearDamping: metaversePushableBodyLinearDamping,
          lockRotations: true,
          spawnPosition: freezeVector3(
            placement.position.x,
            placement.position.y,
            placement.position.z
          ),
          spawnYawRadians: placement.rotationYRadians
        },
        this.#physicsRuntime
      );

      await pushableBodyRuntime.init();
      this.#pushableBodyRuntimesByEnvironmentAssetId.set(
        environmentAsset.environmentAssetId,
        pushableBodyRuntime
      );
      const pushableBodySnapshot = pushableBodyRuntime.syncSnapshot();

      this.#sceneRuntime.setDynamicEnvironmentPose(
        environmentAsset.environmentAssetId,
        Object.freeze({
          position: pushableBodySnapshot.position,
          yawRadians: pushableBodySnapshot.yawRadians
        })
      );
    }
  }
}
