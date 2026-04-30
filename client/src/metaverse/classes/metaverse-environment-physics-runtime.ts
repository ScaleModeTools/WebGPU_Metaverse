import type { Scene } from "three/webgpu";
import {
  resolveMetaverseDynamicCuboidBodyConfigSnapshotFromSurfaceAsset,
  createMetaverseTraversalColliderMetadataSnapshot,
  resolveMetaverseGroundedBodyColliderTranslationSnapshot,
  shouldConsiderMetaverseWaterborneTraversalCollider,
  type MetaverseTraversalPlayerBodyBlockerSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type {
  MetaverseWorldPlacedSurfaceColliderSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";
import {
  createMetaverseWorldPlacedSurfaceTriMeshSupportSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import {
  MetaverseDynamicCuboidBodyRuntime,
  MetaverseGroundedBodyRuntime,
  RapierPhysicsRuntime,
  type PhysicsVector3Snapshot,
  type RapierColliderHandle,
  type RapierQueryFilterPredicate
} from "@/physics";
import type { SceneAssetLoader } from "../render/webgpu-metaverse-scene";
import type {
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentProofConfig,
  MetaverseVector3Snapshot
} from "../types/metaverse-runtime";
import {
  resolveDynamicEnvironmentCuboidColliders,
  resolveDynamicCollisionTriMeshes,
  resolvePlacedCollisionTriMeshes,
  resolveScaledCollisionTriMeshes,
  type MetaverseTriMeshColliderSnapshot
} from "../states/metaverse-environment-collision";

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
}

const emptyColliderHandleList = Object.freeze([]) as readonly RapierColliderHandle[];

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

function freezeDynamicEnvironmentPoseSnapshot(
  position: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
  yawRadians: number
) {
  return Object.freeze({
    position: freezeVector3(position.x, position.y, position.z),
    yawRadians
  });
}

function createYawQuaternion(yawRadians: number) {
  const halfAngle = toFiniteNumber(yawRadians) * 0.5;

  return Object.freeze({
    x: 0,
    y: Math.sin(halfAngle),
    z: 0,
    w: Math.cos(halfAngle)
  });
}

function resolveEnvironmentCollisionAssetPath(
  environmentAsset: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "collisionPath" | "dynamicBody"
  >
): string | null {
  if (environmentAsset.dynamicBody != null) {
    return null;
  }

  return environmentAsset.collisionPath;
}

function shouldUseCollisionMeshSurfaceSupport(
  environmentAsset: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "collisionPath" | "dynamicBody"
  >
): boolean {
  return (
    environmentAsset.dynamicBody == null &&
    resolveEnvironmentCollisionAssetPath(environmentAsset) !== null
  );
}

class MetaverseDynamicEnvironmentColliderRuntime {
  readonly #environmentAsset: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "environmentAssetId" | "label" | "physicsColliders" | "placement" | "placements"
  >;
  readonly #physicsRuntime: RapierPhysicsRuntime;

  #colliders: RapierColliderHandle[] = [];
  #surfaceColliderSnapshots:
    readonly MetaverseWorldPlacedSurfaceColliderSnapshot[] =
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
    readonly MetaverseWorldPlacedSurfaceColliderSnapshot[] {
    return this.#surfaceColliderSnapshots;
  }

  get colliders(): readonly RapierColliderHandle[] {
    return this.#colliders;
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
      this.dispose();
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

class MetaverseDynamicEnvironmentCollisionMeshRuntime {
  readonly #environmentAssetId: string;
  readonly #label: string;
  readonly #physicsRuntime: RapierPhysicsRuntime;
  readonly #triMeshes: readonly MetaverseTriMeshColliderSnapshot[];

  #colliders: RapierColliderHandle[] = [];
  #surfaceColliderSnapshots:
    readonly MetaverseWorldPlacedSurfaceColliderSnapshot[] = Object.freeze([]);

  constructor(
    environmentAssetId: string,
    label: string,
    triMeshes: readonly MetaverseTriMeshColliderSnapshot[],
    physicsRuntime: RapierPhysicsRuntime
  ) {
    this.#environmentAssetId = environmentAssetId;
    this.#label = label;
    this.#triMeshes = triMeshes;
    this.#physicsRuntime = physicsRuntime;
  }

  get environmentAssetId(): string {
    return this.#environmentAssetId;
  }

  get colliders(): readonly RapierColliderHandle[] {
    return this.#colliders;
  }

  get surfaceColliderSnapshots():
    readonly MetaverseWorldPlacedSurfaceColliderSnapshot[] {
    return this.#surfaceColliderSnapshots;
  }

  syncPose(poseSnapshot: {
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void {
    if (this.#triMeshes.length === 0) {
      this.dispose();
      return;
    }

    const rotation = createYawQuaternion(poseSnapshot.yawRadians);
    this.#surfaceColliderSnapshots = Object.freeze(
      this.#triMeshes.flatMap((triMesh) => {
        const supportSnapshot =
          createMetaverseWorldPlacedSurfaceTriMeshSupportSnapshot(
            this.#environmentAssetId,
            triMesh,
            {
              position: poseSnapshot.position,
              yawRadians: poseSnapshot.yawRadians
            }
          );

        return supportSnapshot === null ? [] : [supportSnapshot];
      })
    );

    if (this.#colliders.length === 0) {
      this.#colliders = this.#triMeshes.map((triMesh) =>
        this.#physicsRuntime.createTriMeshCollider(
          triMesh.vertices,
          triMesh.indices,
          poseSnapshot.position,
          rotation
        )
      );

      return;
    }

    if (this.#colliders.length !== this.#triMeshes.length) {
      throw new Error(
        `Metaverse dynamic environment asset ${this.#label} changed collision mesh count after initialization.`
      );
    }

    for (const collider of this.#colliders) {
      collider.setTranslation(poseSnapshot.position);
      collider.setRotation(rotation);
    }
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
  readonly #createSceneAssetLoader: () => SceneAssetLoader;
  readonly #environmentProofConfig: MetaverseEnvironmentProofConfig | null;
  readonly #groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly #physicsRuntime: RapierPhysicsRuntime;
  readonly #sceneRuntime: MetaverseEnvironmentPhysicsSceneRuntime;
  readonly #staticSurfaceColliderSnapshots:
    MetaverseWorldPlacedSurfaceColliderSnapshot[];
  readonly #surfaceColliderSnapshots:
    MetaverseWorldPlacedSurfaceColliderSnapshot[];

  #environmentColliders: RapierColliderHandle[] = [];
  #environmentCollisionMeshColliders: RapierColliderHandle[] = [];
  #surfaceColliderMetadataByHandle = new Map<
    RapierColliderHandle,
    Pick<
      MetaverseWorldPlacedSurfaceColliderSnapshot,
      "ownerEnvironmentAssetId" | "traversalAffordance"
    >
  >();
  #dynamicEnvironmentColliderRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseDynamicEnvironmentColliderRuntime
  >();
  #dynamicEnvironmentCollisionMeshRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseDynamicEnvironmentCollisionMeshRuntime
  >();
  #dynamicEnvironmentCollisionPosesByEnvironmentAssetId = new Map<
    string,
    {
      readonly position: PhysicsVector3Snapshot;
      readonly yawRadians: number;
    }
  >();
  #dynamicBodyRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseDynamicCuboidBodyRuntime
  >();
  #authoritativeEnvironmentBodyCollisionSyncEnvironmentAssetIds = new Set<string>();
  #remoteCharacterBlockerCollidersByPlayerId = new Map<
    string,
    RapierColliderHandle
  >();
  #remoteCharacterBlockerSnapshotsByPlayerId = new Map<
    string,
    MetaverseTraversalPlayerBodyBlockerSnapshot
  >();

  constructor(
    {
      createSceneAssetLoader,
      environmentProofConfig,
      groundedBodyRuntime,
      physicsRuntime,
      sceneRuntime
    }: MetaverseEnvironmentPhysicsRuntimeDependencies
  ) {
    this.#createSceneAssetLoader = createSceneAssetLoader;
    this.#environmentProofConfig = environmentProofConfig;
    this.#groundedBodyRuntime = groundedBodyRuntime;
    this.#physicsRuntime = physicsRuntime;
    this.#sceneRuntime = sceneRuntime;
    const staticSurfaceColliderSnapshots =
      environmentProofConfig === null
        ? []
        : [...(environmentProofConfig.surfaceColliders ?? [])];

    this.#staticSurfaceColliderSnapshots = staticSurfaceColliderSnapshots;
    this.#surfaceColliderSnapshots = [...this.#staticSurfaceColliderSnapshots];
  }

  get surfaceColliderSnapshots():
    readonly MetaverseWorldPlacedSurfaceColliderSnapshot[] {
    return this.#surfaceColliderSnapshots;
  }

  readDynamicEnvironmentCollisionPose(
    environmentAssetId: string
  ): {
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  } | null {
    return (
      this.#dynamicEnvironmentCollisionPosesByEnvironmentAssetId.get(
        environmentAssetId
      ) ?? null
    );
  }

  resolveGroundedTraversalFilterPredicate(
    excludedColliders: readonly RapierColliderHandle[] = emptyColliderHandleList
  ): RapierQueryFilterPredicate {
    const excludedColliderSet = new Set(excludedColliders);
    const remoteCharacterBlockerColliderSet = new Set(
      this.#remoteCharacterBlockerCollidersByPlayerId.values()
    );

    return (collider) =>
      !excludedColliderSet.has(collider) &&
      !remoteCharacterBlockerColliderSet.has(collider);
  }

  readGroundedTraversalPlayerBlockers():
    readonly MetaverseTraversalPlayerBodyBlockerSnapshot[] {
    return Object.freeze([
      ...this.#remoteCharacterBlockerSnapshotsByPlayerId.values()
    ]);
  }

  resolveWaterborneTraversalFilterPredicate(
    excludedOwnerEnvironmentAssetId: string | null = null,
    excludedColliders: readonly RapierColliderHandle[] = emptyColliderHandleList
  ): RapierQueryFilterPredicate {
    const excludedColliderSet = new Set(excludedColliders);

    return (collider) => {
      if (excludedColliderSet.has(collider)) {
        return false;
      }

      const colliderMetadata = this.#surfaceColliderMetadataByHandle.get(collider);

      if (colliderMetadata === undefined) {
        return true;
      }
      return shouldConsiderMetaverseWaterborneTraversalCollider(
        colliderMetadata,
        excludedOwnerEnvironmentAssetId
      );
    };
  }

  setDynamicEnvironmentPose(
    environmentAssetId: string,
    poseSnapshot: {
      readonly position: MetaverseVector3Snapshot;
      readonly yawRadians: number;
    } | null
  ): void {
    const dynamicEnvironmentColliderRuntime =
      this.#dynamicEnvironmentColliderRuntimesByEnvironmentAssetId.get(
        environmentAssetId
      );
    const dynamicEnvironmentCollisionMeshRuntime =
      this.#dynamicEnvironmentCollisionMeshRuntimesByEnvironmentAssetId.get(
        environmentAssetId
      );

    if (
      dynamicEnvironmentColliderRuntime === undefined &&
      dynamicEnvironmentCollisionMeshRuntime === undefined
    ) {
      return;
    }

    if (dynamicEnvironmentColliderRuntime !== undefined) {
      this.#clearDynamicEnvironmentColliderMetadata(dynamicEnvironmentColliderRuntime);
    }
    if (dynamicEnvironmentCollisionMeshRuntime !== undefined) {
      this.#clearDynamicEnvironmentCollisionMeshMetadata(
        dynamicEnvironmentCollisionMeshRuntime
      );
    }

    if (poseSnapshot === null) {
      this.#dynamicEnvironmentCollisionPosesByEnvironmentAssetId.delete(
        environmentAssetId
      );
      dynamicEnvironmentColliderRuntime?.dispose();
      dynamicEnvironmentCollisionMeshRuntime?.dispose();
      this.#syncSurfaceColliderSnapshots();

      return;
    }

    const normalizedPose = Object.freeze({
      ...freezeDynamicEnvironmentPoseSnapshot(
        poseSnapshot.position,
        poseSnapshot.yawRadians
      )
    });

    this.#dynamicEnvironmentCollisionPosesByEnvironmentAssetId.set(
      environmentAssetId,
      normalizedPose
    );

    dynamicEnvironmentColliderRuntime?.syncPose(normalizedPose);
    dynamicEnvironmentCollisionMeshRuntime?.syncPose(normalizedPose);

    if (dynamicEnvironmentColliderRuntime !== undefined) {
      this.#syncDynamicEnvironmentColliderMetadata(dynamicEnvironmentColliderRuntime);
    }
    if (dynamicEnvironmentCollisionMeshRuntime !== undefined) {
      this.#syncDynamicEnvironmentCollisionMeshMetadata(
        dynamicEnvironmentCollisionMeshRuntime
      );
    }

    this.#syncSurfaceColliderSnapshots();
  }

  beginAuthoritativeEnvironmentBodyCollisionSync(): void {
    this.#authoritativeEnvironmentBodyCollisionSyncEnvironmentAssetIds.clear();
  }

  syncAuthoritativeEnvironmentBodyCollisionPose(
    environmentAssetId: string,
    poseSnapshot: {
      readonly linearVelocity: PhysicsVector3Snapshot;
      readonly position: MetaverseVector3Snapshot;
      readonly yawRadians: number;
    }
  ): void {
    const dynamicBodyRuntime =
      this.#dynamicBodyRuntimesByEnvironmentAssetId.get(environmentAssetId);

    if (dynamicBodyRuntime === undefined) {
      return;
    }

    this.#authoritativeEnvironmentBodyCollisionSyncEnvironmentAssetIds.add(
      environmentAssetId
    );
    const normalizedCollisionPose = Object.freeze({
      linearVelocity: freezeVector3(
        poseSnapshot.linearVelocity.x,
        poseSnapshot.linearVelocity.y,
        poseSnapshot.linearVelocity.z
      ),
      position: freezeVector3(
        poseSnapshot.position.x,
        poseSnapshot.position.y,
        poseSnapshot.position.z
      ),
      yawRadians: poseSnapshot.yawRadians
    });

    dynamicBodyRuntime.syncAuthoritativeState(normalizedCollisionPose);
    this.#dynamicEnvironmentCollisionPosesByEnvironmentAssetId.set(
      environmentAssetId,
      freezeDynamicEnvironmentPoseSnapshot(
        normalizedCollisionPose.position,
        normalizedCollisionPose.yawRadians
      )
    );
  }

  async boot(initialYawRadians: number): Promise<void> {
    await this.#physicsRuntime.init();
    const sceneAssetLoader = this.#createSceneAssetLoader();

    await this.#bootStaticEnvironmentCollision();
    await this.#bootStaticEnvironmentCollisionMeshes(sceneAssetLoader);
    await this.#bootDynamicEnvironmentColliders();
    await this.#bootDynamicEnvironmentCollisionMeshes(sceneAssetLoader);
    await this.#bootDynamicEnvironmentBodies();
    this.#groundedBodyRuntime.syncInteractionSnapshot({
      applyImpulsesToDynamicBodies:
        this.#dynamicBodyRuntimesByEnvironmentAssetId.size > 0
    });
    await this.#groundedBodyRuntime.init(initialYawRadians);
  }

  dispose(): void {
    for (const environmentCollider of this.#environmentColliders) {
      this.#physicsRuntime.removeCollider(environmentCollider);
      this.#surfaceColliderMetadataByHandle.delete(environmentCollider);
    }

    this.#environmentColliders = [];
    for (const collisionMeshCollider of this.#environmentCollisionMeshColliders) {
      this.#physicsRuntime.removeCollider(collisionMeshCollider);
      this.#surfaceColliderMetadataByHandle.delete(collisionMeshCollider);
    }

    this.#environmentCollisionMeshColliders = [];

    for (const dynamicEnvironmentColliderRuntime of this
      .#dynamicEnvironmentColliderRuntimesByEnvironmentAssetId.values()) {
      for (const collider of dynamicEnvironmentColliderRuntime.colliders) {
        this.#surfaceColliderMetadataByHandle.delete(collider);
      }

      dynamicEnvironmentColliderRuntime.dispose();
    }

    this.#dynamicEnvironmentColliderRuntimesByEnvironmentAssetId.clear();
    for (const dynamicEnvironmentCollisionMeshRuntime of this
      .#dynamicEnvironmentCollisionMeshRuntimesByEnvironmentAssetId.values()) {
      this.#clearDynamicEnvironmentCollisionMeshMetadata(
        dynamicEnvironmentCollisionMeshRuntime
      );
      dynamicEnvironmentCollisionMeshRuntime.dispose();
    }

    this.#dynamicEnvironmentCollisionMeshRuntimesByEnvironmentAssetId.clear();
    for (const remoteCharacterBlockerCollider of this
      .#remoteCharacterBlockerCollidersByPlayerId.values()) {
      this.#physicsRuntime.removeCollider(remoteCharacterBlockerCollider);
      this.#surfaceColliderMetadataByHandle.delete(remoteCharacterBlockerCollider);
    }

    this.#remoteCharacterBlockerCollidersByPlayerId.clear();
    this.#remoteCharacterBlockerSnapshotsByPlayerId.clear();
    this.#surfaceColliderSnapshots.length = 0;
    this.#surfaceColliderMetadataByHandle.clear();
    this.#authoritativeEnvironmentBodyCollisionSyncEnvironmentAssetIds.clear();
    this.#dynamicEnvironmentCollisionPosesByEnvironmentAssetId.clear();

    for (const [
      environmentAssetId,
      dynamicBodyRuntime
    ] of this.#dynamicBodyRuntimesByEnvironmentAssetId.entries()) {
      dynamicBodyRuntime.dispose();
      this.#sceneRuntime.setDynamicEnvironmentPose(environmentAssetId, null);
    }

    this.#dynamicBodyRuntimesByEnvironmentAssetId.clear();
    this.#groundedBodyRuntime.syncInteractionSnapshot({
      applyImpulsesToDynamicBodies: false
    });
    this.#groundedBodyRuntime.dispose();
  }

  syncDynamicEnvironmentBodyPresentations(): void {
    for (const [
      environmentAssetId,
      dynamicBodyRuntime
    ] of this.#dynamicBodyRuntimesByEnvironmentAssetId.entries()) {
      const dynamicBodySnapshot = dynamicBodyRuntime.syncSnapshot();
      const dynamicEnvironmentPose = Object.freeze({
        position: dynamicBodySnapshot.position,
        yawRadians: dynamicBodySnapshot.yawRadians
      });

      this.#dynamicEnvironmentCollisionPosesByEnvironmentAssetId.set(
        environmentAssetId,
        dynamicEnvironmentPose
      );
      this.setDynamicEnvironmentPose(environmentAssetId, dynamicEnvironmentPose);
      if (
        this.#authoritativeEnvironmentBodyCollisionSyncEnvironmentAssetIds.has(
          environmentAssetId
        )
      ) {
        continue;
      }

      this.#sceneRuntime.setDynamicEnvironmentPose(
        environmentAssetId,
        dynamicEnvironmentPose
      );
    }
  }

  syncSampledRemotePlayerBlockers(
    remotePlayerBlockers: readonly MetaverseTraversalPlayerBodyBlockerSnapshot[]
  ): void {
    if (!this.#physicsRuntime.isInitialized) {
      return;
    }

    const activePlayerIds = new Set<string>();

    for (const blockerSnapshot of remotePlayerBlockers) {
      activePlayerIds.add(blockerSnapshot.playerId);
      this.#remoteCharacterBlockerSnapshotsByPlayerId.set(
        blockerSnapshot.playerId,
        Object.freeze({
          capsuleHalfHeightMeters: blockerSnapshot.capsuleHalfHeightMeters,
          capsuleRadiusMeters: blockerSnapshot.capsuleRadiusMeters,
          playerId: blockerSnapshot.playerId,
          position: blockerSnapshot.position
        })
      );
      const existingCollider =
        this.#remoteCharacterBlockerCollidersByPlayerId.get(
          blockerSnapshot.playerId
        );
      const blockerTranslation =
        resolveMetaverseGroundedBodyColliderTranslationSnapshot(
          {
            capsuleHalfHeightMeters: blockerSnapshot.capsuleHalfHeightMeters,
            capsuleRadiusMeters: blockerSnapshot.capsuleRadiusMeters
          },
          blockerSnapshot.position
        );

      if (existingCollider === undefined) {
        const blockerCollider = this.#physicsRuntime.createCapsuleCollider(
          blockerSnapshot.capsuleHalfHeightMeters,
          blockerSnapshot.capsuleRadiusMeters,
          blockerTranslation
        );

        this.#remoteCharacterBlockerCollidersByPlayerId.set(
          blockerSnapshot.playerId,
          blockerCollider
        );
      } else {
        existingCollider.setTranslation(blockerTranslation);
      }
    }

    for (const [playerId, collider] of this.#remoteCharacterBlockerCollidersByPlayerId) {
      if (activePlayerIds.has(playerId)) {
        continue;
      }

      this.#physicsRuntime.removeCollider(collider);
      this.#remoteCharacterBlockerCollidersByPlayerId.delete(playerId);
      this.#remoteCharacterBlockerSnapshotsByPlayerId.delete(playerId);
    }
  }

  async #bootStaticEnvironmentCollision(): Promise<void> {
    if (this.#staticSurfaceColliderSnapshots.length === 0) {
      return;
    }

    for (const collider of this.#staticSurfaceColliderSnapshots) {
      const environmentCollider =
        collider.shape === "heightfield" &&
        collider.heightSamples !== undefined &&
        collider.sampleCountX !== undefined &&
        collider.sampleCountZ !== undefined &&
        collider.sampleSpacingMeters !== undefined
          ? this.#physicsRuntime.createHeightfieldCollider(
              collider.sampleCountX,
              collider.sampleCountZ,
              collider.sampleSpacingMeters,
              collider.heightSamples,
              collider.translation,
              collider.rotation
            )
          : collider.shape === "trimesh" &&
              collider.vertices !== undefined &&
              collider.indices !== undefined
            ? this.#physicsRuntime.createTriMeshCollider(
                collider.vertices,
                collider.indices,
                collider.translation,
                collider.rotation
              )
            : this.#physicsRuntime.createFixedCuboidCollider(
                collider.halfExtents,
                collider.translation,
                collider.rotation
              );

      this.#environmentColliders.push(environmentCollider);
      this.#surfaceColliderMetadataByHandle.set(
        environmentCollider,
        createMetaverseTraversalColliderMetadataSnapshot(collider)
      );
    }
  }

  async #bootStaticEnvironmentCollisionMeshes(
    sceneAssetLoader: SceneAssetLoader
  ): Promise<void> {
    if (this.#environmentProofConfig === null) {
      return;
    }

    for (const environmentAsset of this.#environmentProofConfig.assets) {
      if (environmentAsset.placement === "dynamic") {
        continue;
      }

      const collisionAssetPath =
        resolveEnvironmentCollisionAssetPath(environmentAsset);

      if (collisionAssetPath === null) {
        continue;
      }

      const collisionAsset = await sceneAssetLoader.loadAsync(collisionAssetPath);
      const triMeshes = resolvePlacedCollisionTriMeshes(
        environmentAsset,
        collisionAsset.scene
      );
      const supportTriMeshesByPlacement = environmentAsset.placements.map(
        (placement) =>
          resolveScaledCollisionTriMeshes(placement.scale, collisionAsset.scene)
      );

      for (const triMesh of triMeshes) {
        const collider = this.#physicsRuntime.createFixedTriMeshCollider(
          triMesh.vertices,
          triMesh.indices
        );

        this.#environmentCollisionMeshColliders.push(collider);
        this.#surfaceColliderMetadataByHandle.set(collider, {
          ownerEnvironmentAssetId: environmentAsset.environmentAssetId,
          traversalAffordance: "blocker"
        });
      }

      if (!shouldUseCollisionMeshSurfaceSupport(environmentAsset)) {
        continue;
      }

      for (const [placementIndex, placement] of environmentAsset.placements.entries()) {
        const supportTriMeshes = supportTriMeshesByPlacement[placementIndex] ?? [];

        for (const triMesh of supportTriMeshes) {
          const supportSnapshot =
            createMetaverseWorldPlacedSurfaceTriMeshSupportSnapshot(
              environmentAsset.environmentAssetId,
              triMesh,
              {
                position: freezeVector3(
                  placement.position.x,
                  placement.position.y,
                  placement.position.z
                ),
                yawRadians: placement.rotationYRadians
              }
            );

          if (supportSnapshot !== null) {
            this.#staticSurfaceColliderSnapshots.push(supportSnapshot);
          }
        }
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
        shouldUseCollisionMeshSurfaceSupport(environmentAsset) ||
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
      this.#dynamicEnvironmentCollisionPosesByEnvironmentAssetId.set(
        environmentAsset.environmentAssetId,
        freezeDynamicEnvironmentPoseSnapshot(
          environmentAsset.placements[0]!.position,
          environmentAsset.placements[0]!.rotationYRadians
        )
      );
      this.#syncDynamicEnvironmentColliderMetadata(dynamicEnvironmentColliderRuntime);
    }

    this.#syncSurfaceColliderSnapshots();
  }

  async #bootDynamicEnvironmentCollisionMeshes(
    sceneAssetLoader: SceneAssetLoader
  ): Promise<void> {
    if (this.#environmentProofConfig === null) {
      return;
    }

    this.#dynamicEnvironmentCollisionMeshRuntimesByEnvironmentAssetId.clear();

    for (const environmentAsset of this.#environmentProofConfig.assets) {
      if (environmentAsset.placement !== "dynamic") {
        continue;
      }

      if (environmentAsset.placements.length !== 1) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentAsset.label} requires exactly one placement for collision mesh runtime.`
        );
      }

      const collisionAssetPath =
        resolveEnvironmentCollisionAssetPath(environmentAsset);

      if (collisionAssetPath === null) {
        continue;
      }

      const collisionAsset = await sceneAssetLoader.loadAsync(collisionAssetPath);
      const triMeshes = resolveDynamicCollisionTriMeshes(
        environmentAsset,
        collisionAsset.scene
      );

      if (triMeshes.length === 0) {
        continue;
      }

      const collisionMeshRuntime =
        new MetaverseDynamicEnvironmentCollisionMeshRuntime(
          environmentAsset.environmentAssetId,
          environmentAsset.label,
          triMeshes,
          this.#physicsRuntime
        );
      const placement = environmentAsset.placements[0]!;

      collisionMeshRuntime.syncPose(
        freezeDynamicEnvironmentPoseSnapshot(
          placement.position,
          placement.rotationYRadians
        )
      );
      this.#dynamicEnvironmentCollisionMeshRuntimesByEnvironmentAssetId.set(
        collisionMeshRuntime.environmentAssetId,
        collisionMeshRuntime
      );
      this.#dynamicEnvironmentCollisionPosesByEnvironmentAssetId.set(
        environmentAsset.environmentAssetId,
        freezeDynamicEnvironmentPoseSnapshot(
          placement.position,
          placement.rotationYRadians
        )
      );
      this.#syncDynamicEnvironmentCollisionMeshMetadata(collisionMeshRuntime);
    }

    this.#syncSurfaceColliderSnapshots();
  }

  async #bootDynamicEnvironmentBodies(): Promise<void> {
    if (this.#environmentProofConfig === null) {
      return;
    }

    this.#dynamicBodyRuntimesByEnvironmentAssetId.clear();

    for (const environmentAsset of this.#environmentProofConfig.assets) {
      if (environmentAsset.placement !== "dynamic" || environmentAsset.dynamicBody == null) {
        continue;
      }

      if (environmentAsset.placements.length !== 1) {
        throw new Error(
          `Metaverse dynamic environment body asset ${environmentAsset.label} requires exactly one placement.`
        );
      }

      if (environmentAsset.collider === null) {
        throw new Error(
          `Metaverse dynamic environment body asset ${environmentAsset.label} requires collider metadata.`
        );
      }

      const dynamicBodyConfig =
        resolveMetaverseDynamicCuboidBodyConfigSnapshotFromSurfaceAsset(
          environmentAsset
        );

      if (dynamicBodyConfig === null) {
        throw new Error(
          `Metaverse dynamic environment body asset ${environmentAsset.label} requires one fully authored dynamic-body placement.`
        );
      }

      const dynamicBodyRuntime = new MetaverseDynamicCuboidBodyRuntime(
        dynamicBodyConfig,
        this.#physicsRuntime
      );

      await dynamicBodyRuntime.init();
      this.#dynamicBodyRuntimesByEnvironmentAssetId.set(
        environmentAsset.environmentAssetId,
        dynamicBodyRuntime
      );
      const dynamicBodySnapshot = dynamicBodyRuntime.syncSnapshot();
      const dynamicEnvironmentPose = freezeDynamicEnvironmentPoseSnapshot(
        dynamicBodySnapshot.position,
        dynamicBodySnapshot.yawRadians
      );

      this.#dynamicEnvironmentCollisionPosesByEnvironmentAssetId.set(
        environmentAsset.environmentAssetId,
        dynamicEnvironmentPose
      );
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

  #syncDynamicEnvironmentColliderMetadata(
    dynamicEnvironmentColliderRuntime: MetaverseDynamicEnvironmentColliderRuntime
  ): void {
    const colliders = dynamicEnvironmentColliderRuntime.colliders;
    const snapshots = dynamicEnvironmentColliderRuntime.surfaceColliderSnapshots;

    for (const [colliderIndex, collider] of colliders.entries()) {
      const colliderSnapshot = snapshots[colliderIndex];

      if (colliderSnapshot === undefined) {
        this.#surfaceColliderMetadataByHandle.delete(collider);
        continue;
      }

      this.#surfaceColliderMetadataByHandle.set(
        collider,
        createMetaverseTraversalColliderMetadataSnapshot(colliderSnapshot)
      );
    }
  }

  #clearDynamicEnvironmentColliderMetadata(
    dynamicEnvironmentColliderRuntime: MetaverseDynamicEnvironmentColliderRuntime
  ): void {
    for (const collider of dynamicEnvironmentColliderRuntime.colliders) {
      this.#surfaceColliderMetadataByHandle.delete(collider);
    }
  }

  #syncDynamicEnvironmentCollisionMeshMetadata(
    collisionMeshRuntime: MetaverseDynamicEnvironmentCollisionMeshRuntime
  ): void {
    for (const collider of collisionMeshRuntime.colliders) {
      this.#surfaceColliderMetadataByHandle.set(collider, {
        ownerEnvironmentAssetId: collisionMeshRuntime.environmentAssetId,
        traversalAffordance: "blocker"
      });
    }
  }

  #clearDynamicEnvironmentCollisionMeshMetadata(
    collisionMeshRuntime: MetaverseDynamicEnvironmentCollisionMeshRuntime
  ): void {
    for (const collider of collisionMeshRuntime.colliders) {
      this.#surfaceColliderMetadataByHandle.delete(collider);
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

    for (const dynamicEnvironmentCollisionMeshRuntime of this
      .#dynamicEnvironmentCollisionMeshRuntimesByEnvironmentAssetId.values()) {
      this.#surfaceColliderSnapshots.push(
        ...dynamicEnvironmentCollisionMeshRuntime.surfaceColliderSnapshots
      );
    }
  }

}
