import type { Object3D, Scene } from "three/webgpu";

import {
  MetaverseDynamicCuboidBodyRuntime,
  MetaverseGroundedBodyRuntime,
  RapierPhysicsRuntime,
  type PhysicsVector3Snapshot,
  type RapierColliderHandle
} from "@/physics";
import type { SceneAssetLoader } from "../render/webgpu-metaverse-scene";
import { shouldKeepMountedOccupancyFreeRoam } from "../states/mounted-occupancy";
import {
  resolvePlacedCollisionTriMeshes,
  resolveDynamicEnvironmentCuboidColliders,
  resolvePlacedCuboidColliders,
  type MetaversePlacedCuboidColliderSnapshot
} from "../states/metaverse-environment-collision";
import type {
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentProofConfig,
  MetaverseRemoteCharacterPresentationSnapshot,
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
const identityQuaternion = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
  w: 1
});

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

class MetaverseDynamicEnvironmentColliderRuntime {
  readonly #environmentAsset: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "environmentAssetId" | "label" | "physicsColliders" | "placement" | "placements"
  >;
  readonly #physicsRuntime: RapierPhysicsRuntime;

  #colliders: RapierColliderHandle[] = [];
  #surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[] =
    Object.freeze([]);

  constructor(
    environmentAsset: Pick<
      MetaverseEnvironmentAssetProofConfig,
      "environmentAssetId" | "label" | "physicsColliders" | "placement" | "placements"
    >,
    physicsRuntime: RapierPhysicsRuntime
  ) {
    this.#environmentAsset = environmentAsset;
    this.#physicsRuntime = physicsRuntime;
  }

  get environmentAssetId(): string {
    return this.#environmentAsset.environmentAssetId;
  }

  get surfaceColliderSnapshots():
    readonly MetaversePlacedCuboidColliderSnapshot[] {
    return this.#surfaceColliderSnapshots;
  }

  async init(): Promise<void> {
    if (
      this.#environmentAsset.placement !== "dynamic" ||
      this.#environmentAsset.placements.length !== 1
    ) {
      throw new Error(
        `Metaverse dynamic environment asset ${this.#environmentAsset.label} requires exactly one placement for runtime collision.`
      );
    }

    await this.#physicsRuntime.init();
    const placement = this.#environmentAsset.placements[0]!;

    this.syncPose(
      Object.freeze({
        position: freezeVector3(
          placement.position.x,
          placement.position.y,
          placement.position.z
        ),
        yawRadians: placement.rotationYRadians
      })
    );
  }

  syncPose(poseSnapshot: {
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void {
    const nextColliderSnapshots = resolveDynamicEnvironmentCuboidColliders(
      this.#environmentAsset,
      poseSnapshot
    );

    if (nextColliderSnapshots.length === 0) {
      this.#surfaceColliderSnapshots = Object.freeze([]);
      return;
    }

    if (this.#colliders.length === 0) {
      this.#colliders = nextColliderSnapshots.map((colliderSnapshot) =>
        this.#physicsRuntime.createFixedCuboidCollider(
          colliderSnapshot.halfExtents,
          colliderSnapshot.translation,
          colliderSnapshot.rotation
        )
      );
    } else if (this.#colliders.length !== nextColliderSnapshots.length) {
      throw new Error(
        `Metaverse dynamic environment asset ${this.#environmentAsset.label} changed collider count after initialization.`
      );
    } else {
      for (const [colliderIndex, colliderSnapshot] of nextColliderSnapshots.entries()) {
        const collider = this.#colliders[colliderIndex]!;

        collider.setTranslation(colliderSnapshot.translation);
        collider.setRotation(colliderSnapshot.rotation);
      }
    }

    this.#surfaceColliderSnapshots = nextColliderSnapshots;
  }

  dispose(): void {
    for (const collider of this.#colliders) {
      this.#physicsRuntime.removeCollider(collider);
    }

    this.#colliders = [];
    this.#surfaceColliderSnapshots = Object.freeze([]);
  }
}

export class MetaverseEnvironmentPhysicsRuntime {
  readonly #config: MetaverseRuntimeConfig;
  readonly #createSceneAssetLoader: () => SceneAssetLoader;
  readonly #environmentProofConfig: MetaverseEnvironmentProofConfig | null;
  readonly #groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly #physicsRuntime: RapierPhysicsRuntime;
  readonly #sceneRuntime: MetaverseEnvironmentPhysicsSceneRuntime;
  readonly #showPhysicsDebug: boolean;
  readonly #staticSurfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];
  readonly #surfaceColliderSnapshots: MetaversePlacedCuboidColliderSnapshot[];

  #environmentColliders: RapierColliderHandle[] = [];
  #dynamicEnvironmentColliderRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseDynamicEnvironmentColliderRuntime
  >();
  #groundCollider: RapierColliderHandle | null = null;
  #physicsDebugObject: MetaversePhysicsDebugObject | null = null;
  #pushableBodyRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseDynamicCuboidBodyRuntime
  >();
  #remoteCharacterBlockerCollidersByPlayerId = new Map<
    string,
    RapierColliderHandle
  >();
  #remoteCharacterBlockerSnapshotsByPlayerId = new Map<
    string,
    MetaversePlacedCuboidColliderSnapshot
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
    this.#staticSurfaceColliderSnapshots =
      environmentProofConfig === null
        ? Object.freeze([])
        : Object.freeze(
            environmentProofConfig.assets.flatMap((environmentAsset) =>
              environmentAsset.placement === "dynamic"
                ? []
                : resolvePlacedCuboidColliders(environmentAsset)
            )
          );
    this.#surfaceColliderSnapshots = [...this.#staticSurfaceColliderSnapshots];
  }

  get surfaceColliderSnapshots(): readonly MetaversePlacedCuboidColliderSnapshot[] {
    return this.#surfaceColliderSnapshots;
  }

  setDynamicEnvironmentPose(
    environmentAssetId: string,
    poseSnapshot: {
      readonly position: MetaverseVector3Snapshot;
      readonly yawRadians: number;
    } | null
  ): void {
    if (poseSnapshot === null) {
      return;
    }

    const dynamicEnvironmentColliderRuntime =
      this.#dynamicEnvironmentColliderRuntimesByEnvironmentAssetId.get(
        environmentAssetId
      );

    if (dynamicEnvironmentColliderRuntime === undefined) {
      return;
    }

    dynamicEnvironmentColliderRuntime.syncPose(
      Object.freeze({
        position: freezeVector3(
          poseSnapshot.position.x,
          poseSnapshot.position.y,
          poseSnapshot.position.z
        ),
        yawRadians: poseSnapshot.yawRadians
      })
    );
    this.#syncSurfaceColliderSnapshots();
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
    await this.#bootDynamicEnvironmentColliders();
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

    for (const dynamicEnvironmentColliderRuntime of this
      .#dynamicEnvironmentColliderRuntimesByEnvironmentAssetId.values()) {
      dynamicEnvironmentColliderRuntime.dispose();
    }

    this.#dynamicEnvironmentColliderRuntimesByEnvironmentAssetId.clear();
    for (const remoteCharacterBlockerCollider of this
      .#remoteCharacterBlockerCollidersByPlayerId.values()) {
      this.#physicsRuntime.removeCollider(remoteCharacterBlockerCollider);
    }

    this.#remoteCharacterBlockerCollidersByPlayerId.clear();
    this.#remoteCharacterBlockerSnapshotsByPlayerId.clear();
    this.#surfaceColliderSnapshots.length = 0;

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
      const dynamicEnvironmentPose = Object.freeze({
        position: pushableBodySnapshot.position,
        yawRadians: pushableBodySnapshot.yawRadians
      });

      this.setDynamicEnvironmentPose(environmentAssetId, dynamicEnvironmentPose);
      this.#sceneRuntime.setDynamicEnvironmentPose(
        environmentAssetId,
        dynamicEnvironmentPose
      );
    }
  }

  syncRemoteCharacterBlockers(
    remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[]
  ): void {
    if (!this.#physicsRuntime.isInitialized) {
      return;
    }

    const activePlayerIds = new Set<string>();

    for (const remoteCharacterPresentation of remoteCharacterPresentations) {
      const blockerSnapshot = this.#createRemoteCharacterBlockerSnapshot(
        remoteCharacterPresentation
      );

      if (blockerSnapshot === null) {
        continue;
      }

      activePlayerIds.add(remoteCharacterPresentation.playerId);
      const existingCollider =
        this.#remoteCharacterBlockerCollidersByPlayerId.get(
          remoteCharacterPresentation.playerId
        );

      if (existingCollider === undefined) {
        this.#remoteCharacterBlockerCollidersByPlayerId.set(
          remoteCharacterPresentation.playerId,
          this.#physicsRuntime.createFixedCuboidCollider(
            blockerSnapshot.halfExtents,
            blockerSnapshot.translation,
            blockerSnapshot.rotation
          )
        );
      } else {
        existingCollider.setTranslation(blockerSnapshot.translation);
        existingCollider.setRotation(blockerSnapshot.rotation);
      }

      this.#remoteCharacterBlockerSnapshotsByPlayerId.set(
        remoteCharacterPresentation.playerId,
        blockerSnapshot
      );
    }

    for (const [playerId, collider] of this.#remoteCharacterBlockerCollidersByPlayerId) {
      if (activePlayerIds.has(playerId)) {
        continue;
      }

      this.#physicsRuntime.removeCollider(collider);
      this.#remoteCharacterBlockerCollidersByPlayerId.delete(playerId);
      this.#remoteCharacterBlockerSnapshotsByPlayerId.delete(playerId);
    }

    this.#syncSurfaceColliderSnapshots();
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

  async #bootDynamicEnvironmentColliders(): Promise<void> {
    if (this.#environmentProofConfig === null) {
      return;
    }

    this.#dynamicEnvironmentColliderRuntimesByEnvironmentAssetId.clear();

    for (const environmentAsset of this.#environmentProofConfig.assets) {
      if (
        environmentAsset.placement !== "dynamic" ||
        environmentAsset.traversalAffordance !== "mount" ||
        environmentAsset.physicsColliders === null ||
        environmentAsset.physicsColliders.length === 0
      ) {
        continue;
      }

      const dynamicEnvironmentColliderRuntime =
        new MetaverseDynamicEnvironmentColliderRuntime(
          environmentAsset,
          this.#physicsRuntime
        );

      await dynamicEnvironmentColliderRuntime.init();
      this.#dynamicEnvironmentColliderRuntimesByEnvironmentAssetId.set(
        dynamicEnvironmentColliderRuntime.environmentAssetId,
        dynamicEnvironmentColliderRuntime
      );
    }

    this.#syncSurfaceColliderSnapshots();
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
      const dynamicEnvironmentPose = Object.freeze({
        position: pushableBodySnapshot.position,
        yawRadians: pushableBodySnapshot.yawRadians
      });

      this.setDynamicEnvironmentPose(
        environmentAsset.environmentAssetId,
        dynamicEnvironmentPose
      );
      this.#sceneRuntime.setDynamicEnvironmentPose(
        environmentAsset.environmentAssetId,
        dynamicEnvironmentPose
      );
    }
  }

  #syncSurfaceColliderSnapshots(): void {
    this.#surfaceColliderSnapshots.length = 0;
    this.#surfaceColliderSnapshots.push(...this.#staticSurfaceColliderSnapshots);

    for (const dynamicEnvironmentColliderRuntime of this
      .#dynamicEnvironmentColliderRuntimesByEnvironmentAssetId.values()) {
      this.#surfaceColliderSnapshots.push(
        ...dynamicEnvironmentColliderRuntime.surfaceColliderSnapshots
      );
    }

    this.#surfaceColliderSnapshots.push(
      ...this.#remoteCharacterBlockerSnapshotsByPlayerId.values()
    );
  }

  #createRemoteCharacterBlockerSnapshot(
    remoteCharacterPresentation: MetaverseRemoteCharacterPresentationSnapshot
  ): MetaversePlacedCuboidColliderSnapshot | null {
    const mountedOccupancy = remoteCharacterPresentation.mountedOccupancy;
    const animationVocabulary =
      remoteCharacterPresentation.presentation.animationVocabulary;

    if (
      animationVocabulary === "swim" ||
      animationVocabulary === "swim-idle" ||
      (mountedOccupancy !== null &&
        !shouldKeepMountedOccupancyFreeRoam(mountedOccupancy))
    ) {
      return null;
    }

    const halfHeightMeters =
      this.#config.groundedBody.capsuleHalfHeightMeters +
      this.#config.groundedBody.capsuleRadiusMeters;
    const planarHalfExtentMeters =
      this.#config.groundedBody.capsuleRadiusMeters * 0.92;
    const presentationPosition = remoteCharacterPresentation.presentation.position;

    return Object.freeze({
      halfExtents: freezeVector3(
        planarHalfExtentMeters,
        halfHeightMeters,
        planarHalfExtentMeters
      ),
      ownerEnvironmentAssetId: null,
      rotation: identityQuaternion,
      translation: freezeVector3(
        presentationPosition.x,
        presentationPosition.y + halfHeightMeters,
        presentationPosition.z
      ),
      traversalAffordance: "blocker"
    });
  }
}
