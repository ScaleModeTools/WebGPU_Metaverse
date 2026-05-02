import assert from "node:assert/strict";
import test from "node:test";

import {
  metaverseHubDiveBoatEnvironmentAssetId,
  metaverseHubDockEnvironmentAssetId,
  metaverseHubPushableCrateEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId,
  stagingGroundMapBundle
} from "@webgpu-metaverse/shared/metaverse/world";
import {
  createMetaverseUnmountedTraversalStateSnapshot,
  metaverseGroundedSurfacePolicyConfig
} from "@webgpu-metaverse/shared/metaverse/traversal";

import {
  createMetaverseAuthoritativeWorldBundleInputs
} from "../../../../server/dist/metaverse/world/map-bundles/metaverse-authoritative-world-bundle-inputs.js";
import { loadAuthoritativeMetaverseMapBundle } from "../../../../server/dist/metaverse/world/map-bundles/load-authoritative-metaverse-map-bundle.js";
import {
  MetaverseAuthoritativeWorldSurfaceState
} from "../../../../server/dist/metaverse/authority/traversal/metaverse-authoritative-world-surface-state.js";
import {
  MetaverseAuthoritativeRapierPhysicsRuntime
} from "../../../../server/dist/metaverse/classes/metaverse-authoritative-rapier-physics-runtime.js";

test("authoritative metaverse bootstrap derives bundle, spawn, and authored world state from the shared staging-ground map bundle", () => {
  const loadedBundle = loadAuthoritativeMetaverseMapBundle("staging-ground");
  const bundleInputs =
    createMetaverseAuthoritativeWorldBundleInputs("staging-ground");
  const expectedDefaultSpawnNode = stagingGroundMapBundle.playerSpawnNodes[0];
  const expectedDynamicSeedCount = stagingGroundMapBundle.environmentAssets.filter(
    (environmentAsset) =>
      environmentAsset.placementMode === "dynamic" &&
      !(
        environmentAsset.dynamicBody === null &&
        environmentAsset.collisionPath !== null
      ) &&
      environmentAsset.surfaceColliders.length > 0 &&
      environmentAsset.placements.length > 0
  ).length;
  const expectedStaticCollisionMeshSeedCount = stagingGroundMapBundle.environmentAssets
    .filter(
      (environmentAsset) =>
        (environmentAsset.placementMode === "static" ||
          environmentAsset.placementMode === "instanced") &&
        environmentAsset.collisionPath !== null
    )
    .reduce(
      (placementCount, environmentAsset) =>
        placementCount + environmentAsset.placements.length,
      0
    );
  const expectedDynamicCollisionMeshAssetIds = new Set(
    stagingGroundMapBundle.environmentAssets
      .filter(
        (environmentAsset) =>
          environmentAsset.placementMode === "dynamic" &&
          environmentAsset.collisionPath !== null
      )
      .map((environmentAsset) => environmentAsset.assetId)
  );

  assert.notEqual(expectedDefaultSpawnNode, undefined);
  assert.equal(loadedBundle.bundleId, "staging-ground");
  assert.equal(loadedBundle.bundle.mapId, stagingGroundMapBundle.mapId);
  assert.equal(
    loadedBundle.bundle.playerSpawnNodes.length,
    stagingGroundMapBundle.playerSpawnNodes.length
  );
  assert.equal(
    loadedBundle.bundle.playerSpawnNodes.filter((spawnNode) => spawnNode.teamId === "blue")
      .length,
    2
  );
  assert.equal(
    loadedBundle.bundle.playerSpawnNodes.filter((spawnNode) => spawnNode.teamId === "red")
      .length,
    2
  );
  assert.equal(
    bundleInputs.gameplayProfile.id,
    stagingGroundMapBundle.gameplayProfileId
  );
  assert.equal(
    loadedBundle.bundle.sceneObjects.length,
    stagingGroundMapBundle.sceneObjects.length
  );
  assert.equal(
    bundleInputs.defaultSpawn.spawnId,
    expectedDefaultSpawnNode.spawnId
  );
  assert.deepEqual(
    bundleInputs.defaultSpawn.position,
    expectedDefaultSpawnNode.position
  );
  assert.equal(
    bundleInputs.defaultSpawn.yawRadians,
    expectedDefaultSpawnNode.yawRadians
  );
  assert.equal(
    bundleInputs.waterRegionSnapshots.length,
    stagingGroundMapBundle.waterRegions.length
  );
  assert.equal(
    bundleInputs.dynamicSurfaceSeedSnapshots.length,
    expectedDynamicSeedCount
  );
  assert.equal(
    bundleInputs.staticCollisionMeshSeedSnapshots.length,
    expectedStaticCollisionMeshSeedCount
  );
  assert.deepEqual(
    new Set(
      bundleInputs.dynamicCollisionMeshSeedSnapshots.map(
        (seedSnapshot) => seedSnapshot.environmentAssetId
      )
    ),
    expectedDynamicCollisionMeshAssetIds
  );
  assert.equal(
    bundleInputs.staticCollisionMeshSeedSnapshots.some(
      (seedSnapshot) =>
        seedSnapshot.environmentAssetId === metaverseHubDockEnvironmentAssetId
    ),
    true
  );
  assert.equal(
    bundleInputs.dynamicCollisionMeshSeedSnapshots.some(
      (seedSnapshot) =>
        seedSnapshot.environmentAssetId === metaverseHubSkiffEnvironmentAssetId
    ),
    true
  );
  assert.equal(
    bundleInputs.dynamicCollisionMeshSeedSnapshots.some(
      (seedSnapshot) =>
        seedSnapshot.environmentAssetId === metaverseHubDiveBoatEnvironmentAssetId
    ),
    true
  );
  assert.equal(
    bundleInputs.dynamicSurfaceSeedSnapshots.some(
      (seedSnapshot) =>
        seedSnapshot.environmentAssetId === metaverseHubSkiffEnvironmentAssetId
    ),
    false
  );
  assert.equal(
    bundleInputs.dynamicSurfaceSeedSnapshots.some(
      (seedSnapshot) =>
        seedSnapshot.environmentAssetId === metaverseHubDiveBoatEnvironmentAssetId
    ),
    false
  );
  assert.equal(
    bundleInputs.readSurfaceAsset(metaverseHubDockEnvironmentAssetId)
      ?.surfaceColliders.length,
    1
  );
  assert.equal(
    bundleInputs.readSurfaceAsset(metaverseHubDockEnvironmentAssetId)
      ?.traversalAffordance,
    "support"
  );
  assert.equal(
    bundleInputs.readSurfaceAsset(metaverseHubSkiffEnvironmentAssetId)
      ?.surfaceColliders.length,
    8
  );
  assert.equal(
    bundleInputs.readSurfaceAsset(metaverseHubSkiffEnvironmentAssetId)
      ?.traversalAffordance,
    "mount"
  );
  assert.equal(
    bundleInputs.readSurfaceAsset(metaverseHubSkiffEnvironmentAssetId)?.collider
      ?.size.y,
    2.4
  );
  assert.equal(
    bundleInputs.readSurfaceAsset(metaverseHubDiveBoatEnvironmentAssetId)
      ?.surfaceColliders.length,
    9
  );
  assert.equal(
    bundleInputs.readSurfaceAsset(metaverseHubDiveBoatEnvironmentAssetId)
      ?.traversalAffordance,
    "mount"
  );
  assert.equal(
    bundleInputs.readSurfaceAsset(metaverseHubDiveBoatEnvironmentAssetId)
      ?.collider?.size.y,
    3.8
  );
  assert.equal(
    bundleInputs.readSurfaceAsset(metaverseHubPushableCrateEnvironmentAssetId)
      ?.dynamicBody?.kind,
    "dynamic-rigid-body"
  );
  assert.ok(bundleInputs.staticSurfaceColliders.length > 0);
});

test("authoritative collision mesh assets expose mesh support without duplicate dynamic box seeds", () => {
  const bundleInputs =
    createMetaverseAuthoritativeWorldBundleInputs("staging-ground");
  const physicsRuntime = new MetaverseAuthoritativeRapierPhysicsRuntime();
  const surfaceState = new MetaverseAuthoritativeWorldSurfaceState({
    dynamicCollisionMeshSeedSnapshots:
      bundleInputs.dynamicCollisionMeshSeedSnapshots,
    dynamicSurfaceSeedSnapshots: bundleInputs.dynamicSurfaceSeedSnapshots,
    groundedBodyConfig: metaverseGroundedSurfacePolicyConfig,
    physicsRuntime,
    playerTraversalColliderHandles: new Set(),
    resolveDynamicSurfaceColliders: bundleInputs.resolveDynamicSurfaceColliders,
    staticCollisionMeshSeedSnapshots: bundleInputs.staticCollisionMeshSeedSnapshots,
    staticSurfaceColliders: bundleInputs.staticSurfaceColliders,
    syncUnmountedPlayerToGroundedSupport() {},
    syncUnmountedPlayerToSwimWaterline() {},
    vehicleDriveColliderHandles: new Set(),
    waterRegionSnapshots: bundleInputs.waterRegionSnapshots
  });
  const supportColliders = surfaceState
    .resolveAuthoritativeSurfaceColliders()
    .filter((collider) => collider.traversalAffordance === "support");

  for (const environmentAssetId of [
    metaverseHubDockEnvironmentAssetId,
    metaverseHubSkiffEnvironmentAssetId,
    metaverseHubDiveBoatEnvironmentAssetId
  ]) {
    assert.equal(
      supportColliders.some(
        (collider) =>
          collider.ownerEnvironmentAssetId === environmentAssetId &&
          collider.shape === "trimesh"
      ),
      true
    );
  }
});

test("authoritative surface sync reads active capsule pose", () => {
  const bundleInputs =
    createMetaverseAuthoritativeWorldBundleInputs("staging-ground");
  const physicsRuntime = new MetaverseAuthoritativeRapierPhysicsRuntime();
  let groundedSupportHeight = null;
  let swimWaterlineHeight = null;
  const surfaceState = new MetaverseAuthoritativeWorldSurfaceState({
    dynamicCollisionMeshSeedSnapshots:
      bundleInputs.dynamicCollisionMeshSeedSnapshots,
    dynamicSurfaceSeedSnapshots: bundleInputs.dynamicSurfaceSeedSnapshots,
    groundedBodyConfig: metaverseGroundedSurfacePolicyConfig,
    physicsRuntime,
    playerTraversalColliderHandles: new Set(),
    resolveDynamicSurfaceColliders: bundleInputs.resolveDynamicSurfaceColliders,
    staticCollisionMeshSeedSnapshots: bundleInputs.staticCollisionMeshSeedSnapshots,
    staticSurfaceColliders: bundleInputs.staticSurfaceColliders,
    syncUnmountedPlayerToGroundedSupport(_playerRuntime, supportHeightMeters) {
      groundedSupportHeight = supportHeightMeters;
    },
    syncUnmountedPlayerToSwimWaterline(_playerRuntime, waterlineHeightMeters) {
      swimWaterlineHeight = waterlineHeightMeters;
    },
    vehicleDriveColliderHandles: new Set(),
    waterRegionSnapshots: bundleInputs.waterRegionSnapshots
  });
  const activeBodySnapshot = Object.freeze({
    position: bundleInputs.defaultSpawn.position,
    yawRadians: bundleInputs.defaultSpawn.yawRadians
  });
  const playerRuntime = {
    groundedBodyRuntime: {
      snapshot: activeBodySnapshot
    },
    lastGroundedBodySnapshot: {
      positionYMeters: activeBodySnapshot.position.y
    },
    locomotionMode: "grounded",
    swimBodyRuntime: {
      snapshot: Object.freeze({
        position: Object.freeze({
          x: 999,
          y: -999,
          z: 999
        }),
        yawRadians: 0
      })
    },
    unmountedTraversalState: createMetaverseUnmountedTraversalStateSnapshot({
      locomotionMode: "grounded"
    })
  };

  surfaceState.syncUnmountedPlayerToAuthoritativeSurface(playerRuntime);

  assert.notEqual(groundedSupportHeight, null);
  assert.equal(swimWaterlineHeight, null);
});
