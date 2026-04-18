import {
  createMetaverseTraversalColliderMetadataSnapshot,
  resolveMetaverseTraversalStateFromWorldAffordances,
  createMetaverseUnmountedTraversalStateSnapshot,
  resolveMetaverseTraversalWaterlineHeightMeters,
  shouldConsiderMetaverseWaterborneTraversalCollider,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  type MetaverseWorldSurfacePolicyConfig
} from "@webgpu-metaverse/shared/metaverse/world";
import type {
  MetaverseRealtimePlayerSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import {
  metaverseAuthoritativeDynamicSurfaceSeedSnapshots,
  metaverseAuthoritativeStaticSurfaceColliders,
  metaverseAuthoritativeWaterRegionSnapshots,
  type MetaverseAuthoritativeSurfaceColliderSnapshot
} from "../../config/metaverse-authoritative-world-surface.js";
import { MetaverseAuthoritativeDynamicSurfaceColliderRuntime } from "../../classes/metaverse-authoritative-dynamic-surface-collider-runtime.js";
import { MetaverseAuthoritativeRapierPhysicsRuntime } from "../../classes/metaverse-authoritative-rapier-physics-runtime.js";
import type {
  PhysicsVector3Snapshot,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../../types/metaverse-authoritative-rapier.js";

interface MetaverseAuthoritativeSurfaceStatePlayerRuntime {
  lastGroundedPositionY: number;
  locomotionMode: MetaverseRealtimePlayerSnapshot["locomotionMode"];
  positionX: number;
  positionY: number;
  positionZ: number;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  yawRadians: number;
}

interface MetaverseAuthoritativeSurfaceStateVehicleRuntime {
  readonly environmentAssetId: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  yawRadians: number;
}

interface MetaverseAuthoritativeWorldSurfaceStateDependencies<
  PlayerRuntime extends MetaverseAuthoritativeSurfaceStatePlayerRuntime
> {
  readonly groundedBodyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly playerTraversalColliderHandles: ReadonlySet<RapierColliderHandle>;
  readonly syncPlayerTraversalBodyRuntimes: (
    playerRuntime: PlayerRuntime,
    grounded: boolean
  ) => void;
  readonly vehicleDriveColliderHandles: ReadonlySet<RapierColliderHandle>;
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

export class MetaverseAuthoritativeWorldSurfaceState<
  PlayerRuntime extends MetaverseAuthoritativeSurfaceStatePlayerRuntime,
  VehicleRuntime extends MetaverseAuthoritativeSurfaceStateVehicleRuntime
> {
  readonly #dependencies:
    MetaverseAuthoritativeWorldSurfaceStateDependencies<PlayerRuntime>;
  readonly #dynamicSurfaceColliderRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseAuthoritativeDynamicSurfaceColliderRuntime
  >();
  readonly #surfaceColliderMetadataByHandle = new Map<
    RapierColliderHandle,
    ReturnType<typeof createMetaverseTraversalColliderMetadataSnapshot>
  >();

  constructor(
    dependencies: MetaverseAuthoritativeWorldSurfaceStateDependencies<PlayerRuntime>
  ) {
    this.#dependencies = dependencies;

    for (const staticSurfaceCollider of metaverseAuthoritativeStaticSurfaceColliders) {
      const collider = this.#dependencies.physicsRuntime.createCuboidCollider(
        staticSurfaceCollider.halfExtents,
        staticSurfaceCollider.translation,
        staticSurfaceCollider.rotation
      );

      this.#surfaceColliderMetadataByHandle.set(
        collider,
        createMetaverseTraversalColliderMetadataSnapshot(staticSurfaceCollider)
      );
    }

    this.#bootDynamicSurfaceColliderRuntimes();
  }

  createWaterborneTraversalColliderPredicate(
    excludedOwnerEnvironmentAssetId: string | null = null,
    excludedColliders: readonly RapierColliderHandle[] = Object.freeze([])
  ): RapierQueryFilterPredicate {
    const excludedColliderSet = new Set<RapierColliderHandle>([
      ...this.#dependencies.playerTraversalColliderHandles,
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
      ...metaverseAuthoritativeStaticSurfaceColliders
    ];

    for (const colliderRuntime of this
      .#dynamicSurfaceColliderRuntimesByEnvironmentAssetId.values()) {
      surfaceColliders.push(...colliderRuntime.surfaceColliderSnapshots);
    }

    return surfaceColliders;
  }

  shouldConsiderTraversalCollider(collider: RapierColliderHandle): boolean {
    return (
      !this.#dependencies.playerTraversalColliderHandles.has(collider) &&
      !this.#dependencies.vehicleDriveColliderHandles.has(collider)
    );
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
      metaverseAuthoritativeWaterRegionSnapshots,
      {
        x: playerRuntime.positionX,
        y: playerRuntime.positionY,
        z: playerRuntime.positionZ
      }
    );
    const locomotionDecision = resolveMetaverseTraversalStateFromWorldAffordances(
      this.#dependencies.groundedBodyConfig,
      filteredSurfaceColliders,
      metaverseAuthoritativeWaterRegionSnapshots,
      {
        x: playerRuntime.positionX,
        y: playerRuntime.positionY,
        z: playerRuntime.positionZ
      },
      playerRuntime.yawRadians,
      playerRuntime.locomotionMode === "swim" ? "swim" : "grounded",
      excludedOwnerEnvironmentAssetId
    ).decision;

    if (
      locomotionDecision.locomotionMode === "grounded" &&
      locomotionDecision.supportHeightMeters !== null
    ) {
      playerRuntime.positionY = locomotionDecision.supportHeightMeters;
      playerRuntime.lastGroundedPositionY =
        locomotionDecision.supportHeightMeters;
      playerRuntime.locomotionMode = "grounded";
      playerRuntime.unmountedTraversalState =
        createMetaverseUnmountedTraversalStateSnapshot({
          actionState: playerRuntime.unmountedTraversalState.actionState,
          locomotionMode: "grounded"
        });
      this.#dependencies.syncPlayerTraversalBodyRuntimes(playerRuntime, true);
      return;
    }

    playerRuntime.positionY = waterlineHeightMeters;
    playerRuntime.locomotionMode = "swim";
    playerRuntime.unmountedTraversalState =
      createMetaverseUnmountedTraversalStateSnapshot({
        actionState: playerRuntime.unmountedTraversalState.actionState,
        locomotionMode: "swim"
      });
    this.#dependencies.syncPlayerTraversalBodyRuntimes(playerRuntime, false);
  }

  syncVehicleDynamicSurfaceColliders(vehicleRuntime: VehicleRuntime): void {
    const colliderRuntime =
      this.#dynamicSurfaceColliderRuntimesByEnvironmentAssetId.get(
        vehicleRuntime.environmentAssetId
      );

    if (colliderRuntime === undefined) {
      return;
    }

    colliderRuntime.syncPose({
      position: createPhysicsVector3Snapshot(
        vehicleRuntime.positionX,
        vehicleRuntime.positionY,
        vehicleRuntime.positionZ
      ),
      yawRadians: vehicleRuntime.yawRadians
    });
    this.#syncDynamicSurfaceColliderMetadata(colliderRuntime);
  }

  #bootDynamicSurfaceColliderRuntimes(): void {
    for (const seedSnapshot of metaverseAuthoritativeDynamicSurfaceSeedSnapshots) {
      const colliderRuntime =
        new MetaverseAuthoritativeDynamicSurfaceColliderRuntime(
          seedSnapshot.environmentAssetId,
          this.#dependencies.physicsRuntime
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
}
