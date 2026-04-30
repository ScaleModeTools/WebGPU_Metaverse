import {
  createMetaverseTraversalColliderMetadataSnapshot,
  resolveMetaverseTraversalStateFromWorldAffordances,
  createMetaverseUnmountedTraversalStateSnapshot,
  resolveMetaverseTraversalWaterlineHeightMeters,
  shouldConsiderMetaverseWaterborneTraversalCollider,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  createMetaverseWorldPlacedSurfaceTriMeshSupportSnapshot,
  type MetaverseWorldSurfacePolicyConfig
} from "@webgpu-metaverse/shared/metaverse/world";
import type {
  MetaverseRealtimePlayerSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import {
  type MetaverseAuthoritativeCollisionMeshSeedSnapshot,
  type MetaverseAuthoritativeDynamicSurfaceSeedSnapshot,
  type MetaverseAuthoritativeSurfaceColliderSnapshot
} from "../../world/map-bundles/metaverse-authoritative-world-bundle-inputs.js";
import { MetaverseAuthoritativeDynamicSurfaceColliderRuntime } from "../../classes/metaverse-authoritative-dynamic-surface-collider-runtime.js";
import { MetaverseAuthoritativeRapierPhysicsRuntime } from "../../classes/metaverse-authoritative-rapier-physics-runtime.js";
import type {
  PhysicsVector3Snapshot,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../../types/metaverse-authoritative-rapier.js";

interface MetaverseAuthoritativeSurfaceStatePlayerRuntime {
  lastGroundedBodySnapshot: {
    readonly positionYMeters: number;
  };
  locomotionMode: MetaverseRealtimePlayerSnapshot["locomotionMode"];
  positionX: number;
  positionY: number;
  positionZ: number;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  yawRadians: number;
}

interface MetaverseAuthoritativeDynamicSurfaceRuntime {
  readonly environmentAssetId: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  yawRadians: number;
}

interface MetaverseAuthoritativeWorldSurfaceStateDependencies<
  PlayerRuntime extends MetaverseAuthoritativeSurfaceStatePlayerRuntime
> {
  readonly dynamicCollisionMeshSeedSnapshots:
    readonly MetaverseAuthoritativeCollisionMeshSeedSnapshot[];
  readonly dynamicSurfaceSeedSnapshots:
    readonly MetaverseAuthoritativeDynamicSurfaceSeedSnapshot[];
  readonly groundedBodyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly playerTraversalColliderHandles: ReadonlySet<RapierColliderHandle>;
  readonly resolveDynamicSurfaceColliders: (
    environmentAssetId: string,
    poseSnapshot: {
      readonly position: PhysicsVector3Snapshot;
      readonly yawRadians: number;
    }
  ) => readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];
  readonly staticSurfaceColliders:
    readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];
  readonly staticCollisionMeshSeedSnapshots:
    readonly MetaverseAuthoritativeCollisionMeshSeedSnapshot[];
  readonly syncUnmountedPlayerToGroundedSupport: (
    playerRuntime: PlayerRuntime,
    supportHeightMeters: number
) => void;
  readonly syncUnmountedPlayerToSwimWaterline: (
    playerRuntime: PlayerRuntime,
    waterlineHeightMeters: number
  ) => void;
  readonly vehicleDriveColliderHandles: ReadonlySet<RapierColliderHandle>;
  readonly waterRegionSnapshots: readonly {
    readonly halfExtents: PhysicsVector3Snapshot;
    readonly rotationYRadians: number;
    readonly translation: PhysicsVector3Snapshot;
    readonly waterRegionId: string;
  }[];
}

function createPhysicsVector3Snapshot(
  x: number,
  y: number,
  z: number
): PhysicsVector3Snapshot {
  return Object.freeze({
    x,
    y,
    z
  });
}

function createYawQuaternion(yawRadians: number) {
  const halfAngle = yawRadians * 0.5;

  return Object.freeze({
    x: 0,
    y: Math.sin(halfAngle),
    z: 0,
    w: Math.cos(halfAngle)
  });
}

class MetaverseAuthoritativeDynamicSurfaceCollisionMeshRuntime {
  readonly #environmentAssetId: string;
  readonly #physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly #resolveDynamicSurfaceColliders: (
    environmentAssetId: string,
    poseSnapshot: {
      readonly position: PhysicsVector3Snapshot;
      readonly yawRadians: number;
    }
  ) => readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];
  readonly #triMeshes: MetaverseAuthoritativeCollisionMeshSeedSnapshot["triMeshes"];

  #colliders: RapierColliderHandle[] = [];
  #semanticColliders: RapierColliderHandle[] = [];
  #semanticColliderSnapshots:
    readonly MetaverseAuthoritativeSurfaceColliderSnapshot[] = Object.freeze([]);
  #surfaceColliderSnapshots:
    readonly MetaverseAuthoritativeSurfaceColliderSnapshot[] = Object.freeze([]);

  constructor(
    seedSnapshot: MetaverseAuthoritativeCollisionMeshSeedSnapshot,
    physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime,
    resolveDynamicSurfaceColliders: (
      environmentAssetId: string,
      poseSnapshot: {
        readonly position: PhysicsVector3Snapshot;
        readonly yawRadians: number;
      }
    ) => readonly MetaverseAuthoritativeSurfaceColliderSnapshot[]
  ) {
    this.#environmentAssetId = seedSnapshot.environmentAssetId;
    this.#triMeshes = seedSnapshot.triMeshes;
    this.#physicsRuntime = physicsRuntime;
    this.#resolveDynamicSurfaceColliders = resolveDynamicSurfaceColliders;
  }

  get colliders(): readonly RapierColliderHandle[] {
    return this.#colliders;
  }

  get environmentAssetId(): string {
    return this.#environmentAssetId;
  }

  get surfaceColliderSnapshots():
    readonly MetaverseAuthoritativeSurfaceColliderSnapshot[] {
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
    const semanticSurfaceColliderSnapshots =
      this.#resolveDynamicSurfaceColliders(
        this.#environmentAssetId,
        poseSnapshot
      );
    const semanticSupportColliderSnapshots =
      semanticSurfaceColliderSnapshots.filter(
        (colliderSnapshot) =>
          colliderSnapshot.shape === "box" &&
          colliderSnapshot.traversalAffordance === "support"
      );
    const meshSupportSnapshots = this.#triMeshes.flatMap((triMesh) => {
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
    });

    this.#semanticColliderSnapshots = Object.freeze(
      semanticSupportColliderSnapshots
    );
    this.#surfaceColliderSnapshots = Object.freeze([
      ...semanticSurfaceColliderSnapshots,
      ...meshSupportSnapshots
    ]);

    this.#syncSemanticSupportColliders();

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
        `Metaverse authoritative dynamic collision mesh count drifted for ${this.#environmentAssetId}.`
      );
    }

    for (const collider of this.#colliders) {
      collider.setTranslation(
        this.#physicsRuntime.createVector3(
          poseSnapshot.position.x,
          poseSnapshot.position.y,
          poseSnapshot.position.z
        )
      );
      collider.setRotation(rotation);
    }
  }

  dispose(): void {
    for (const collider of this.#colliders) {
      this.#physicsRuntime.removeCollider(collider);
    }

    for (const collider of this.#semanticColliders) {
      this.#physicsRuntime.removeCollider(collider);
    }

    this.#colliders = [];
    this.#semanticColliders = [];
    this.#semanticColliderSnapshots = Object.freeze([]);
    this.#surfaceColliderSnapshots = Object.freeze([]);
  }

  get semanticColliders(): readonly RapierColliderHandle[] {
    return this.#semanticColliders;
  }

  get semanticColliderSnapshots():
    readonly MetaverseAuthoritativeSurfaceColliderSnapshot[] {
    return this.#semanticColliderSnapshots;
  }

  #syncSemanticSupportColliders(): void {
    if (this.#semanticColliderSnapshots.length === 0) {
      for (const collider of this.#semanticColliders) {
        this.#physicsRuntime.removeCollider(collider);
      }

      this.#semanticColliders = [];
      return;
    }

    if (this.#semanticColliders.length === 0) {
      this.#semanticColliders = this.#semanticColliderSnapshots.map(
        (colliderSnapshot) =>
          this.#physicsRuntime.createCuboidCollider(
            colliderSnapshot.halfExtents,
            colliderSnapshot.translation,
            colliderSnapshot.rotation
          )
      );
      return;
    }

    if (this.#semanticColliders.length !== this.#semanticColliderSnapshots.length) {
      throw new Error(
        `Metaverse authoritative dynamic support collider count drifted for ${this.#environmentAssetId}.`
      );
    }

    for (const [colliderIndex, collider] of this.#semanticColliders.entries()) {
      const colliderSnapshot = this.#semanticColliderSnapshots[colliderIndex];

      if (colliderSnapshot === undefined) {
        continue;
      }

      collider.setTranslation(colliderSnapshot.translation);
      collider.setRotation(colliderSnapshot.rotation);
    }
  }
}

export class MetaverseAuthoritativeWorldSurfaceState<
  PlayerRuntime extends MetaverseAuthoritativeSurfaceStatePlayerRuntime,
  DynamicSurfaceRuntime extends MetaverseAuthoritativeDynamicSurfaceRuntime
> {
  readonly #dependencies:
    MetaverseAuthoritativeWorldSurfaceStateDependencies<PlayerRuntime>;
  readonly #dynamicSurfaceCollisionMeshRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseAuthoritativeDynamicSurfaceCollisionMeshRuntime
  >();
  readonly #dynamicSurfaceColliderRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseAuthoritativeDynamicSurfaceColliderRuntime
  >();
  readonly #staticSurfaceColliderSnapshots:
    MetaverseAuthoritativeSurfaceColliderSnapshot[];
  readonly #surfaceColliderMetadataByHandle = new Map<
    RapierColliderHandle,
    ReturnType<typeof createMetaverseTraversalColliderMetadataSnapshot>
  >();

  constructor(
    dependencies: MetaverseAuthoritativeWorldSurfaceStateDependencies<PlayerRuntime>
  ) {
    this.#dependencies = dependencies;
    this.#staticSurfaceColliderSnapshots = [
      ...this.#dependencies.staticSurfaceColliders
    ];

    for (const staticSurfaceCollider of this.#dependencies.staticSurfaceColliders) {
      const collider =
        staticSurfaceCollider.shape === "heightfield" &&
        staticSurfaceCollider.heightSamples !== undefined &&
        staticSurfaceCollider.sampleCountX !== undefined &&
        staticSurfaceCollider.sampleCountZ !== undefined &&
        staticSurfaceCollider.sampleSpacingMeters !== undefined
          ? this.#dependencies.physicsRuntime.createHeightfieldCollider(
              staticSurfaceCollider.sampleCountX,
              staticSurfaceCollider.sampleCountZ,
              staticSurfaceCollider.sampleSpacingMeters,
              staticSurfaceCollider.heightSamples,
              staticSurfaceCollider.translation,
              staticSurfaceCollider.rotation
            )
          : staticSurfaceCollider.shape === "trimesh" &&
              staticSurfaceCollider.vertices !== undefined &&
              staticSurfaceCollider.indices !== undefined
            ? this.#dependencies.physicsRuntime.createTriMeshCollider(
                staticSurfaceCollider.vertices,
                staticSurfaceCollider.indices,
                staticSurfaceCollider.translation,
                staticSurfaceCollider.rotation
              )
            : this.#dependencies.physicsRuntime.createCuboidCollider(
                staticSurfaceCollider.halfExtents,
                staticSurfaceCollider.translation,
                staticSurfaceCollider.rotation
              );

      this.#surfaceColliderMetadataByHandle.set(
        collider,
        createMetaverseTraversalColliderMetadataSnapshot(staticSurfaceCollider)
      );
    }

    this.#bootStaticCollisionMeshColliders();
    this.#bootDynamicSurfaceColliderRuntimes();
    this.#bootDynamicCollisionMeshRuntimes();
  }

  createWaterborneTraversalColliderPredicate(
    excludedOwnerEnvironmentAssetId: string | null = null,
    excludedColliders: readonly RapierColliderHandle[] = Object.freeze([])
  ): RapierQueryFilterPredicate {
    const excludedColliderSet = new Set<RapierColliderHandle>([
      ...this.#dependencies.vehicleDriveColliderHandles,
      ...excludedColliders
    ]);

    return (collider) => {
      if (excludedColliderSet.has(collider)) {
        return false;
      }

      return shouldConsiderMetaverseWaterborneTraversalCollider(
        this.#surfaceColliderMetadataByHandle.get(collider) ?? null,
        excludedOwnerEnvironmentAssetId
      );
    };
  }

  resolveAuthoritativeSurfaceColliders():
    readonly MetaverseAuthoritativeSurfaceColliderSnapshot[] {
    const surfaceColliders: MetaverseAuthoritativeSurfaceColliderSnapshot[] = [
      ...this.#staticSurfaceColliderSnapshots
    ];

    for (const colliderRuntime of this
      .#dynamicSurfaceColliderRuntimesByEnvironmentAssetId.values()) {
      surfaceColliders.push(...colliderRuntime.surfaceColliderSnapshots);
    }

    for (const collisionMeshRuntime of this
      .#dynamicSurfaceCollisionMeshRuntimesByEnvironmentAssetId.values()) {
      surfaceColliders.push(...collisionMeshRuntime.surfaceColliderSnapshots);
    }

    return surfaceColliders;
  }

  shouldConsiderTraversalCollider(collider: RapierColliderHandle): boolean {
    return !this.#dependencies.vehicleDriveColliderHandles.has(collider);
  }

  syncUnmountedPlayerToAuthoritativeSurface(
    playerRuntime: PlayerRuntime,
    surfaceColliders: readonly MetaverseAuthoritativeSurfaceColliderSnapshot[] =
      this.resolveAuthoritativeSurfaceColliders(),
    excludedOwnerEnvironmentAssetId: string | null = null
  ): void {
    const filteredSurfaceColliders =
      excludedOwnerEnvironmentAssetId === null
        ? surfaceColliders
        : surfaceColliders.filter(
            (surfaceCollider) =>
              surfaceCollider.ownerEnvironmentAssetId !==
              excludedOwnerEnvironmentAssetId
          );
    const waterlineHeightMeters = resolveMetaverseTraversalWaterlineHeightMeters(
      this.#dependencies.waterRegionSnapshots,
      {
        x: playerRuntime.positionX,
        y: playerRuntime.positionY,
        z: playerRuntime.positionZ
      }
    );
    const preferredSupport =
      playerRuntime.locomotionMode === "grounded"
        ? playerRuntime.unmountedTraversalState.groundedSupport
        : null;
    const locomotionDecision = resolveMetaverseTraversalStateFromWorldAffordances(
      this.#dependencies.groundedBodyConfig,
      filteredSurfaceColliders,
      this.#dependencies.waterRegionSnapshots,
      {
        x: playerRuntime.positionX,
        y: playerRuntime.positionY,
        z: playerRuntime.positionZ
      },
      playerRuntime.yawRadians,
      playerRuntime.locomotionMode === "swim" ? "swim" : "grounded",
      excludedOwnerEnvironmentAssetId,
      preferredSupport
    ).decision;

    if (
      locomotionDecision.locomotionMode === "grounded" &&
      locomotionDecision.supportHeightMeters !== null
    ) {
      playerRuntime.locomotionMode = "grounded";
      playerRuntime.unmountedTraversalState =
        createMetaverseUnmountedTraversalStateSnapshot({
          actionState: playerRuntime.unmountedTraversalState.actionState,
          groundedSupport: locomotionDecision.support,
          locomotionMode: "grounded"
        });
      this.#dependencies.syncUnmountedPlayerToGroundedSupport(
        playerRuntime,
        locomotionDecision.supportHeightMeters
      );
      return;
    }

    playerRuntime.locomotionMode = "swim";
    playerRuntime.unmountedTraversalState =
      createMetaverseUnmountedTraversalStateSnapshot({
        actionState: playerRuntime.unmountedTraversalState.actionState,
        locomotionMode: "swim"
      });
    this.#dependencies.syncUnmountedPlayerToSwimWaterline(
      playerRuntime,
      waterlineHeightMeters
    );
  }

  syncDynamicSurfaceColliders(dynamicSurfaceRuntime: DynamicSurfaceRuntime): void {
    const colliderRuntime =
      this.#dynamicSurfaceColliderRuntimesByEnvironmentAssetId.get(
        dynamicSurfaceRuntime.environmentAssetId
      );

    if (colliderRuntime === undefined) {
      const collisionMeshRuntime =
        this.#dynamicSurfaceCollisionMeshRuntimesByEnvironmentAssetId.get(
          dynamicSurfaceRuntime.environmentAssetId
        );

      if (collisionMeshRuntime === undefined) {
        return;
      }
    }

    const poseSnapshot = Object.freeze({
      position: createPhysicsVector3Snapshot(
        dynamicSurfaceRuntime.positionX,
        dynamicSurfaceRuntime.positionY,
        dynamicSurfaceRuntime.positionZ
      ),
      yawRadians: dynamicSurfaceRuntime.yawRadians
    });

    colliderRuntime?.syncPose(poseSnapshot);

    if (colliderRuntime !== undefined) {
      this.#syncDynamicSurfaceColliderMetadata(colliderRuntime);
    }

    const collisionMeshRuntime =
      this.#dynamicSurfaceCollisionMeshRuntimesByEnvironmentAssetId.get(
        dynamicSurfaceRuntime.environmentAssetId
      );

    collisionMeshRuntime?.syncPose(poseSnapshot);

    if (collisionMeshRuntime !== undefined) {
      this.#syncDynamicCollisionMeshMetadata(collisionMeshRuntime);
    }
  }

  #bootStaticCollisionMeshColliders(): void {
    for (const seedSnapshot of this.#dependencies.staticCollisionMeshSeedSnapshots) {
      const rotation = createYawQuaternion(seedSnapshot.yawRadians);

      for (const triMesh of seedSnapshot.triMeshes) {
        const supportSnapshot =
          createMetaverseWorldPlacedSurfaceTriMeshSupportSnapshot(
            seedSnapshot.environmentAssetId,
            triMesh,
            {
              position: seedSnapshot.position,
              yawRadians: seedSnapshot.yawRadians
            }
          );

        if (supportSnapshot !== null) {
          this.#staticSurfaceColliderSnapshots.push(supportSnapshot);
        }

        const collider = this.#dependencies.physicsRuntime.createTriMeshCollider(
          triMesh.vertices,
          triMesh.indices,
          seedSnapshot.position,
          rotation
        );

        this.#surfaceColliderMetadataByHandle.set(collider, {
          ownerEnvironmentAssetId: seedSnapshot.environmentAssetId,
          traversalAffordance: "blocker"
        });
      }
    }
  }

  #bootDynamicSurfaceColliderRuntimes(): void {
    for (const seedSnapshot of this.#dependencies.dynamicSurfaceSeedSnapshots) {
      const colliderRuntime =
        new MetaverseAuthoritativeDynamicSurfaceColliderRuntime(
          seedSnapshot.environmentAssetId,
          this.#dependencies.physicsRuntime,
          this.#dependencies.resolveDynamicSurfaceColliders
        );

      colliderRuntime.syncPose({
        position: seedSnapshot.position,
        yawRadians: seedSnapshot.yawRadians
      });
      this.#dynamicSurfaceColliderRuntimesByEnvironmentAssetId.set(
        colliderRuntime.environmentAssetId,
        colliderRuntime
      );
      this.#syncDynamicSurfaceColliderMetadata(colliderRuntime);
    }
  }

  #bootDynamicCollisionMeshRuntimes(): void {
    for (const seedSnapshot of this
      .#dependencies.dynamicCollisionMeshSeedSnapshots) {
      const collisionMeshRuntime =
        new MetaverseAuthoritativeDynamicSurfaceCollisionMeshRuntime(
          seedSnapshot,
          this.#dependencies.physicsRuntime,
          this.#dependencies.resolveDynamicSurfaceColliders
        );

      collisionMeshRuntime.syncPose({
        position: seedSnapshot.position,
        yawRadians: seedSnapshot.yawRadians
      });
      this.#dynamicSurfaceCollisionMeshRuntimesByEnvironmentAssetId.set(
        collisionMeshRuntime.environmentAssetId,
        collisionMeshRuntime
      );
      this.#syncDynamicCollisionMeshMetadata(collisionMeshRuntime);
    }
  }

  #syncDynamicSurfaceColliderMetadata(
    colliderRuntime: MetaverseAuthoritativeDynamicSurfaceColliderRuntime
  ): void {
    for (const [colliderIndex, collider] of colliderRuntime.colliders.entries()) {
      const colliderSnapshot =
        colliderRuntime.surfaceColliderSnapshots[colliderIndex] ?? null;

      if (colliderSnapshot === null) {
        this.#surfaceColliderMetadataByHandle.delete(collider);
        continue;
      }

      this.#surfaceColliderMetadataByHandle.set(
        collider,
        createMetaverseTraversalColliderMetadataSnapshot(colliderSnapshot)
      );
    }
  }

  #syncDynamicCollisionMeshMetadata(
    collisionMeshRuntime: MetaverseAuthoritativeDynamicSurfaceCollisionMeshRuntime
  ): void {
    for (const collider of collisionMeshRuntime.colliders) {
      this.#surfaceColliderMetadataByHandle.set(collider, {
        ownerEnvironmentAssetId: collisionMeshRuntime.environmentAssetId,
        traversalAffordance: "blocker"
      });
    }

    for (const [
      colliderIndex,
      collider
    ] of collisionMeshRuntime.semanticColliders.entries()) {
      const colliderSnapshot =
        collisionMeshRuntime.semanticColliderSnapshots[colliderIndex] ?? null;

      if (colliderSnapshot === null) {
        this.#surfaceColliderMetadataByHandle.delete(collider);
        continue;
      }

      this.#surfaceColliderMetadataByHandle.set(
        collider,
        createMetaverseTraversalColliderMetadataSnapshot(colliderSnapshot)
      );
    }
  }
}
