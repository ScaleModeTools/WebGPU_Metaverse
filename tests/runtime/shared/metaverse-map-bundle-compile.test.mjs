import assert from "node:assert/strict";
import test from "node:test";

import {
  compileMetaverseMapBundleSemanticWorld,
  metaverseWorldGroundedSpawnPosition,
  parseMetaverseMapBundleSnapshot,
  resolveMetaverseMapBundleCompiledWorldSurfaceColliders,
  resolveMetaverseMapPlayerSpawnSupportPosition,
  stagingGroundMapBundle
} from "@webgpu-metaverse/shared/metaverse/world";

test("semantic terrain patches compile deterministic support heightfields with subsurface blockers", () => {
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(
    Object.freeze({
      compatibilityAssetIds: Object.freeze({
        connectorAssetId: null,
        floorAssetId: null,
        wallAssetId: null
      }),
      connectors: Object.freeze([]),
      edges: Object.freeze([]),
      gameplayVolumes: Object.freeze([]),
      lights: Object.freeze([]),
      modules: Object.freeze([]),
      regions: Object.freeze([]),
      structures: Object.freeze([]),
      surfaces: Object.freeze([]),
      terrainPatches: Object.freeze([
        Object.freeze({
          grid: Object.freeze({
            cellX: 1,
            cellZ: 2,
            cellsX: 1,
            cellsZ: 1,
            layer: 0
          }),
          heightSamples: Object.freeze([0, 1.5, -0.5, 2]),
          label: "Terrain A",
          materialLayers: Object.freeze([
            Object.freeze({
              layerId: "terrain-a:terrain-grass",
              materialId: "terrain-grass",
              weightSamples: Object.freeze([1, 1, 1, 1])
            })
          ]),
          origin: Object.freeze({
            x: 8,
            y: 0,
            z: 12
          }),
          rotationYRadians: 0,
          sampleCountX: 2,
          sampleCountZ: 2,
          sampleSpacingMeters: 4,
          terrainPatchId: "terrain-a",
          waterLevelMeters: null
        })
      ])
    })
  );
  const terrainHeightfields = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.heightfields.filter(
      (heightfield) => heightfield.ownerKind === "terrain-patch"
    )
  );
  const terrainTriMeshes = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.triMeshes.filter(
      (triMesh) => triMesh.ownerKind === "terrain-patch"
    )
  );
  const surfaceColliders =
    resolveMetaverseMapBundleCompiledWorldSurfaceColliders(compiledWorld);

  assert.equal(terrainHeightfields.length, 1);
  assert.equal(terrainHeightfields[0]?.ownerId, "terrain-a");
  assert.equal(terrainHeightfields[0]?.sampleCountX, 2);
  assert.equal(terrainHeightfields[0]?.sampleCountZ, 2);
  assert.equal(terrainHeightfields[0]?.sampleSpacingMeters, 4);
  assert.deepEqual(terrainHeightfields[0]?.heightSamples, [0, 1.5, -0.5, 2]);
  assert.equal(terrainTriMeshes.length, 1);
  assert.equal(terrainTriMeshes[0]?.ownerId, "terrain-a");
  assert.equal(terrainTriMeshes[0]?.traversalAffordance, "blocker");
  assert.equal(terrainTriMeshes[0]?.vertices.length > 0, true);
  assert.equal(terrainTriMeshes[0]?.indices.length > 0, true);
  assert.equal(
    Math.max(...(terrainTriMeshes[0]?.vertices.filter(
      (_value, index) => index % 3 === 1
    ) ?? [])) < 2,
    true
  );
  assert.equal(
    surfaceColliders.filter(
      (collider) =>
        collider.shape === "trimesh" &&
        collider.traversalAffordance === "blocker"
    ).length,
    1
  );
  assert.equal(
    compiledWorld.chunks.some((chunk) =>
      chunk.render.terrainPatchIds.includes("terrain-a")
    ),
    true
  );
});

test("semantic terrain patches fill below walkable interior height changes", () => {
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(
    Object.freeze({
      compatibilityAssetIds: Object.freeze({
        connectorAssetId: null,
        floorAssetId: null,
        wallAssetId: null
      }),
      connectors: Object.freeze([]),
      edges: Object.freeze([]),
      gameplayVolumes: Object.freeze([]),
      lights: Object.freeze([]),
      modules: Object.freeze([]),
      regions: Object.freeze([]),
      structures: Object.freeze([]),
      surfaces: Object.freeze([]),
      terrainPatches: Object.freeze([
        Object.freeze({
          grid: Object.freeze({
            cellX: 0,
            cellZ: 0,
            cellsX: 2,
            cellsZ: 2,
            layer: 0
          }),
          heightSamples: Object.freeze([
            0, 0, 0,
            0, 2, 0,
            0, 0, 0
          ]),
          label: "Terrain Interior Hill",
          materialLayers: Object.freeze([
            Object.freeze({
              layerId: "terrain-interior-hill:terrain-grass",
              materialId: "terrain-grass",
              weightSamples: Object.freeze([
                1, 1, 1,
                1, 1, 1,
                1, 1, 1
              ])
            })
          ]),
          origin: Object.freeze({
            x: 0,
            y: 0,
            z: 0
          }),
          rotationYRadians: 0,
          sampleCountX: 3,
          sampleCountZ: 3,
          sampleSpacingMeters: 4,
          terrainPatchId: "terrain-interior-hill",
          waterLevelMeters: null
        })
      ])
    })
  );
  const terrainHeightfields = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.heightfields.filter(
      (heightfield) => heightfield.ownerKind === "terrain-patch"
    )
  );
  const terrainTriMeshes = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.triMeshes.filter(
      (triMesh) => triMesh.ownerKind === "terrain-patch"
    )
  );

  assert.equal(terrainHeightfields.length, 1);
  assert.equal(terrainHeightfields[0]?.ownerId, "terrain-interior-hill");
  assert.equal(terrainTriMeshes.length, 1);
  assert.equal(terrainTriMeshes[0]?.ownerId, "terrain-interior-hill");
  assert.equal(terrainTriMeshes[0]?.traversalAffordance, "blocker");
  assert.equal(
    Math.max(...(terrainTriMeshes[0]?.vertices.filter(
      (_value, index) => index % 3 === 1
    ) ?? [])) < 2,
    true
  );
});

test("semantic terrain patches emit blockers for unwalkable interior height changes", () => {
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(
    Object.freeze({
      compatibilityAssetIds: Object.freeze({
        connectorAssetId: null,
        floorAssetId: null,
        wallAssetId: null
      }),
      connectors: Object.freeze([]),
      edges: Object.freeze([]),
      gameplayVolumes: Object.freeze([]),
      lights: Object.freeze([]),
      modules: Object.freeze([]),
      regions: Object.freeze([]),
      structures: Object.freeze([]),
      surfaces: Object.freeze([]),
      terrainPatches: Object.freeze([
        Object.freeze({
          grid: Object.freeze({
            cellX: 0,
            cellZ: 0,
            cellsX: 1,
            cellsZ: 1,
            layer: 0
          }),
          heightSamples: Object.freeze([
            0, 0, 0,
            0, 2, 0,
            0, 0, 0
          ]),
          label: "Terrain Interior Cliff",
          materialLayers: Object.freeze([
            Object.freeze({
              layerId: "terrain-interior-cliff:terrain-rock",
              materialId: "terrain-rock",
              weightSamples: Object.freeze([
                1, 1, 1,
                1, 1, 1,
                1, 1, 1
              ])
            })
          ]),
          origin: Object.freeze({
            x: 0,
            y: 0,
            z: 0
          }),
          rotationYRadians: 0,
          sampleCountX: 3,
          sampleCountZ: 3,
          sampleSpacingMeters: 0.5,
          terrainPatchId: "terrain-interior-cliff",
          waterLevelMeters: null
        })
      ])
    })
  );
  const terrainHeightfields = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.heightfields.filter(
      (heightfield) => heightfield.ownerKind === "terrain-patch"
    )
  );
  const terrainTriMeshes = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.triMeshes.filter(
      (triMesh) => triMesh.ownerKind === "terrain-patch"
    )
  );
  const surfaceColliders =
    resolveMetaverseMapBundleCompiledWorldSurfaceColliders(compiledWorld);

  assert.equal(terrainHeightfields.length, 1);
  assert.equal(terrainHeightfields[0]?.ownerId, "terrain-interior-cliff");
  assert.equal(terrainTriMeshes.length, 1);
  assert.equal(terrainTriMeshes[0]?.ownerId, "terrain-interior-cliff");
  assert.equal(terrainTriMeshes[0]?.traversalAffordance, "blocker");
  assert.equal(terrainTriMeshes[0]?.vertices.length > 0, true);
  assert.equal(terrainTriMeshes[0]?.indices.length > 0, true);
  assert.equal(
    surfaceColliders.filter(
      (collider) =>
        collider.shape === "trimesh" &&
        collider.traversalAffordance === "blocker"
    ).length,
    1
  );
});

test("semantic terrain patches block short steep slopes inside the terrain footprint", () => {
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(
    Object.freeze({
      compatibilityAssetIds: Object.freeze({
        connectorAssetId: null,
        floorAssetId: null,
        wallAssetId: null
      }),
      connectors: Object.freeze([]),
      edges: Object.freeze([]),
      gameplayVolumes: Object.freeze([]),
      lights: Object.freeze([]),
      modules: Object.freeze([]),
      regions: Object.freeze([]),
      structures: Object.freeze([]),
      surfaces: Object.freeze([]),
      terrainPatches: Object.freeze([
        Object.freeze({
          grid: Object.freeze({
            cellX: 0,
            cellZ: 0,
            cellsX: 1,
            cellsZ: 1,
            layer: 0
          }),
          heightSamples: Object.freeze([
            0, 0, 0,
            0, 0.2, 0,
            0, 0, 0
          ]),
          label: "Short Steep Terrain",
          materialLayers: Object.freeze([
            Object.freeze({
              layerId: "short-steep-terrain:terrain-rock",
              materialId: "terrain-rock",
              weightSamples: Object.freeze([
                1, 1, 1,
                1, 1, 1,
                1, 1, 1
              ])
            })
          ]),
          origin: Object.freeze({ x: 0, y: 0, z: 0 }),
          rotationYRadians: 0,
          sampleCountX: 3,
          sampleCountZ: 3,
          sampleSpacingMeters: 0.1,
          terrainPatchId: "short-steep-terrain",
          waterLevelMeters: null
        })
      ])
    })
  );
  const terrainTriMeshes = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.triMeshes.filter(
      (triMesh) => triMesh.ownerKind === "terrain-patch"
    )
  );

  assert.equal(terrainTriMeshes.length, 1);
  assert.equal(terrainTriMeshes[0]?.ownerId, "short-steep-terrain");
  assert.equal(terrainTriMeshes[0]?.traversalAffordance, "blocker");
  assert.equal(
    Math.min(...(terrainTriMeshes[0]?.vertices.filter(
      (_value, index) => index % 3 === 1
    ) ?? [])) < 0,
    true
  );
  assert.equal(
    Math.max(...(terrainTriMeshes[0]?.vertices.filter(
      (_value, index) => index % 3 === 1
    ) ?? [])) < 0.2,
    true
  );
  assert.equal(
    Math.max(...(terrainTriMeshes[0]?.vertices.filter(
      (_value, index) => index % 3 === 1
    ) ?? [])) > 0.15,
    true
  );
});

test("compiled world surface colliders keep authored support without compatibility duplicates", () => {
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(
    Object.freeze({
      compatibilityAssetIds: Object.freeze({
        connectorAssetId: null,
        floorAssetId: "compat-floor",
        wallAssetId: null
      }),
      connectors: Object.freeze([]),
      edges: Object.freeze([]),
      gameplayVolumes: Object.freeze([]),
      lights: Object.freeze([]),
      modules: Object.freeze([]),
      regions: Object.freeze([
        Object.freeze({
          holes: Object.freeze([]),
          label: "Terrain Paint Path",
          materialReferenceId: "terrain-path",
          outerLoop: Object.freeze({
            points: Object.freeze([
              Object.freeze({ x: -2, z: -2 }),
              Object.freeze({ x: 2, z: -2 }),
              Object.freeze({ x: 2, z: 2 }),
              Object.freeze({ x: -2, z: 2 })
            ])
          }),
          regionId: "terrain-path-region",
          regionKind: "path",
          rotationYRadians: 0,
          size: Object.freeze({ x: 4, y: 0.25, z: 4 }),
          surfaceId: "terrain-path-surface"
        })
      ]),
      structures: Object.freeze([]),
      surfaces: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 0, z: 0 }),
          elevation: 0,
          kind: "flat-slab",
          label: "Terrain Path Surface",
          rotationYRadians: 0,
          size: Object.freeze({ x: 4, y: 0.25, z: 4 }),
          slopeRiseMeters: 0,
          surfaceId: "terrain-path-surface",
          terrainPatchId: null
        })
      ]),
      terrainPatches: Object.freeze([
        Object.freeze({
          grid: Object.freeze({
            cellX: 0,
            cellZ: 0,
            cellsX: 1,
            cellsZ: 1,
            layer: 0
          }),
          heightSamples: Object.freeze([0, 0, 0, 0]),
          label: "Flat Terrain",
          materialLayers: Object.freeze([
            Object.freeze({
              layerId: "flat-terrain:terrain-grass",
              materialId: "terrain-grass",
              weightSamples: Object.freeze([1, 1, 1, 1])
            })
          ]),
          origin: Object.freeze({ x: 0, y: 0, z: 0 }),
          rotationYRadians: 0,
          sampleCountX: 2,
          sampleCountZ: 2,
          sampleSpacingMeters: 4,
          terrainPatchId: "flat-terrain",
          waterLevelMeters: null
        })
      ])
    })
  );
  const regionCollisionBoxes = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.boxes.filter((box) => box.ownerId === "terrain-path-region")
  );
  const regionCollisionTriMeshes = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.triMeshes.filter(
      (triMesh) => triMesh.ownerId === "terrain-path-region"
    )
  );
  const terrainHeightfields = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.heightfields.filter(
      (heightfield) => heightfield.ownerId === "flat-terrain"
    )
  );
  const surfaceColliders =
    resolveMetaverseMapBundleCompiledWorldSurfaceColliders(compiledWorld);

  assert.equal(regionCollisionBoxes.length, 1);
  assert.equal(regionCollisionTriMeshes.length, 0);
  assert.equal(terrainHeightfields.length, 1);
  assert.equal(
    compiledWorld.compatibilityEnvironmentAssets.some(
      (environmentAsset) => environmentAsset.assetId === "compat-floor"
    ),
    true
  );
  assert.equal(
    surfaceColliders.some(
      (collider) => collider.ownerEnvironmentAssetId === "compat-floor"
    ),
    false
  );
  assert.equal(
    surfaceColliders.filter((collider) => collider.shape === "heightfield")
      .length,
    1
  );
  assert.equal(
    surfaceColliders.filter(
      (collider) =>
        collider.shape === "box" &&
        collider.traversalAffordance === "support" &&
        collider.translation.y + collider.halfExtents.y === 0
    ).length,
    1
  );
  assert.equal(
    compiledWorld.chunks.some((chunk) =>
      chunk.render.regionIds.includes("terrain-path-region")
    ),
    true
  );
});

test("compiled world surface collider resolver leaves dynamic module collision to dynamic runtimes", () => {
  const compiledWorld = Object.freeze({
    chunkSizeMeters: 24,
    compatibilityEnvironmentAssets: Object.freeze([
      Object.freeze({
        assetId: "dynamic-vehicle",
        collisionPath: null,
        collider: null,
        dynamicBody: null,
        entries: null,
        placementMode: "dynamic",
        placements: Object.freeze([
          Object.freeze({
            collisionEnabled: true,
            isVisible: true,
            materialReferenceId: null,
            notes: "",
            placementId: "dynamic-vehicle-placement",
            position: Object.freeze({ x: 0, y: 0, z: 0 }),
            rotationYRadians: 0,
            scale: 1
          })
        ]),
        seats: null,
        surfaceColliders: Object.freeze([]),
        traversalAffordance: "mount"
      }),
      Object.freeze({
        assetId: "static-platform",
        collisionPath: null,
        collider: null,
        dynamicBody: null,
        entries: null,
        placementMode: "static",
        placements: Object.freeze([
          Object.freeze({
            collisionEnabled: true,
            isVisible: true,
            materialReferenceId: null,
            notes: "",
            placementId: "static-platform-placement",
            position: Object.freeze({ x: 10, y: 0, z: 0 }),
            rotationYRadians: 0,
            scale: 1
          })
        ]),
        seats: null,
        surfaceColliders: Object.freeze([]),
        traversalAffordance: "support"
      })
    ]),
    chunks: Object.freeze([
      Object.freeze({
        bounds: Object.freeze({
          center: Object.freeze({ x: 0, y: 0, z: 0 }),
          size: Object.freeze({ x: 24, y: 24, z: 24 })
        }),
        chunkId: "chunk:0:0",
        collision: Object.freeze({
          boxes: Object.freeze([
            Object.freeze({
              center: Object.freeze({ x: 0, y: 0.25, z: 0 }),
              ownerId: "dynamic-vehicle-placement",
              ownerKind: "module",
              rotationYRadians: 0,
              size: Object.freeze({ x: 4, y: 0.5, z: 4 }),
              traversalAffordance: "support"
            }),
            Object.freeze({
              center: Object.freeze({ x: 10, y: 0.25, z: 0 }),
              ownerId: "static-platform-placement",
              ownerKind: "module",
              rotationYRadians: 0,
              size: Object.freeze({ x: 4, y: 0.5, z: 4 }),
              traversalAffordance: "support"
            })
          ]),
          heightfields: Object.freeze([]),
          triMeshes: Object.freeze([])
        }),
        navigation: Object.freeze({
          connectorIds: Object.freeze([]),
          gameplayVolumeIds: Object.freeze([]),
          regionIds: Object.freeze([]),
          surfaceIds: Object.freeze([])
        }),
        render: Object.freeze({
          edgeIds: Object.freeze([]),
          instancedModuleAssetIds: Object.freeze([]),
          lightIds: Object.freeze([]),
          regionIds: Object.freeze([]),
          structureIds: Object.freeze([]),
          terrainPatchIds: Object.freeze([]),
          transparentEntityIds: Object.freeze([])
        })
      })
    ])
  });
  const surfaceColliders =
    resolveMetaverseMapBundleCompiledWorldSurfaceColliders(compiledWorld);

  assert.equal(surfaceColliders.length, 1);
  assert.equal(surfaceColliders[0]?.translation.x, 10);
});

test("semantic collision mesh modules do not also compile box surface colliders", () => {
  const createModule = ({
    assetId,
    collisionPath,
    moduleId,
    position
  }) =>
    Object.freeze({
      assetId,
      collisionEnabled: true,
      collisionPath,
      collider: null,
      dynamicBody: null,
      entries: null,
      isVisible: true,
      label: assetId,
      materialReferenceId: null,
      moduleId,
      notes: "",
      placementMode: "static",
      position,
      rotationYRadians: 0,
      scale: 1,
      seats: null,
      surfaceColliders: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 0.25, z: 0 }),
          size: Object.freeze({ x: 4, y: 0.5, z: 4 }),
          traversalAffordance: "support"
        })
      ]),
      traversalAffordance: "support"
    });
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(
    Object.freeze({
      compatibilityAssetIds: Object.freeze({
        connectorAssetId: null,
        floorAssetId: null,
        wallAssetId: null
      }),
      connectors: Object.freeze([]),
      edges: Object.freeze([]),
      gameplayVolumes: Object.freeze([]),
      lights: Object.freeze([]),
      modules: Object.freeze([
        createModule({
          assetId: "static-mesh-platform",
          collisionPath: "/models/metaverse/environment/static-platform-collision.gltf",
          moduleId: "static-mesh-platform-placement",
          position: Object.freeze({ x: 0, y: 0, z: 0 })
        }),
        createModule({
          assetId: "static-box-platform",
          collisionPath: null,
          moduleId: "static-box-platform-placement",
          position: Object.freeze({ x: 10, y: 0, z: 0 })
        })
      ]),
      regions: Object.freeze([]),
      structures: Object.freeze([]),
      surfaces: Object.freeze([]),
      terrainPatches: Object.freeze([])
    })
  );
  const moduleCollisionBoxes = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.boxes.filter((box) => box.ownerKind === "module")
  );
  const surfaceColliders =
    resolveMetaverseMapBundleCompiledWorldSurfaceColliders(compiledWorld);
  const meshEnvironmentAsset = compiledWorld.compatibilityEnvironmentAssets.find(
    (environmentAsset) => environmentAsset.assetId === "static-mesh-platform"
  );

  assert.deepEqual(
    moduleCollisionBoxes.map((box) => box.ownerId),
    ["static-box-platform-placement"]
  );
  assert.equal(surfaceColliders.length, 1);
  assert.equal(surfaceColliders[0]?.translation.x, 10);
  assert.equal(
    meshEnvironmentAsset?.collisionPath,
    "/models/metaverse/environment/static-platform-collision.gltf"
  );
  assert.equal(meshEnvironmentAsset?.surfaceColliders.length, 1);
});

test("terrain-linked semantic wall compatibility extends blocker walls down to terrain and keeps visuals aligned", () => {
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(
    Object.freeze({
      compatibilityAssetIds: Object.freeze({
        connectorAssetId: null,
        floorAssetId: null,
        wallAssetId: "compat-wall"
      }),
      connectors: Object.freeze([]),
      edges: Object.freeze([
        Object.freeze({
          edgeId: "terrain-wall",
          edgeKind: "wall",
          heightMeters: 4,
          label: "Terrain Wall",
          materialReferenceId: "shell-metal-panel",
          path: Object.freeze([
            Object.freeze({ x: -2, z: 0 }),
            Object.freeze({ x: 2, z: 0 })
          ]),
          surfaceId: "terrain-surface",
          thicknessMeters: 0.5
        })
      ]),
      gameplayVolumes: Object.freeze([]),
      lights: Object.freeze([]),
      modules: Object.freeze([]),
      regions: Object.freeze([]),
      structures: Object.freeze([]),
      surfaces: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 0, z: 0 }),
          elevation: 0,
          kind: "flat-slab",
          label: "Terrain Surface",
          rotationYRadians: 0,
          size: Object.freeze({ x: 4, y: 0.5, z: 4 }),
          slopeRiseMeters: 0,
          surfaceId: "terrain-surface",
          terrainPatchId: "terrain-wall-patch"
        })
      ]),
      terrainPatches: Object.freeze([
        Object.freeze({
          grid: Object.freeze({
            cellX: 0,
            cellZ: 0,
            cellsX: 1,
            cellsZ: 1,
            layer: 0
          }),
          heightSamples: Object.freeze([0, -2, 0, -2]),
          label: "Wall Terrain",
          materialLayers: Object.freeze([
            Object.freeze({
              layerId: "terrain-wall-patch:terrain-rock",
              materialId: "terrain-rock",
              weightSamples: Object.freeze([1, 1, 1, 1])
            })
          ]),
          origin: Object.freeze({ x: 0, y: 0, z: 0 }),
          rotationYRadians: 0,
          sampleCountX: 2,
          sampleCountZ: 2,
          sampleSpacingMeters: 4,
          terrainPatchId: "terrain-wall-patch",
          waterLevelMeters: null
        })
      ])
    })
  );
  const wallBox = compiledWorld.chunks
    .flatMap((chunk) => chunk.collision.boxes)
    .find((box) => box.ownerId === "terrain-wall");
  const wallAsset = compiledWorld.compatibilityEnvironmentAssets.find(
    (environmentAsset) => environmentAsset.assetId === "compat-wall"
  );
  const wallPlacement = wallAsset?.placements[0];
  const wallSurfaceCollider =
    resolveMetaverseMapBundleCompiledWorldSurfaceColliders(compiledWorld).find(
      (collider) =>
        collider.shape === "box" &&
        collider.translation.x === wallBox?.center.x &&
        collider.translation.z === wallBox?.center.z
    );

  assert.notEqual(wallBox, undefined);
  assert.equal(wallBox?.center.y, 1);
  assert.equal(wallBox?.size.y, 6);
  assert.equal(wallSurfaceCollider?.traversalAffordance, "blocker");
  assert.equal(wallSurfaceCollider?.ownerEnvironmentAssetId, null);
  assert.notEqual(wallAsset, undefined);
  assert.equal(wallAsset?.placements.length, 1);
  assert.equal(wallPlacement?.position.y, -2);
  assert.equal(wallPlacement?.materialReferenceId, "shell-metal-panel");
  assert.equal(wallPlacement?.scale.x, 1);
  assert.equal(wallPlacement?.scale.y, 1.5);
  assert.equal(wallPlacement?.scale.z, 1);
});

test("flat semantic floor regions compile support boxes below their authored walkable elevation", () => {
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(
    Object.freeze({
      compatibilityAssetIds: Object.freeze({
        connectorAssetId: null,
        floorAssetId: "compat-floor",
        wallAssetId: null
      }),
      connectors: Object.freeze([]),
      edges: Object.freeze([]),
      gameplayVolumes: Object.freeze([]),
      lights: Object.freeze([]),
      modules: Object.freeze([]),
      regions: Object.freeze([
        Object.freeze({
          holes: Object.freeze([]),
          label: "Basement Ceiling",
          materialReferenceId: "metal",
          outerLoop: Object.freeze({
            points: Object.freeze([
              Object.freeze({ x: -4, z: -4 }),
              Object.freeze({ x: 4, z: -4 }),
              Object.freeze({ x: 4, z: 4 }),
              Object.freeze({ x: -4, z: 4 })
            ])
          }),
          regionId: "basement-ceiling",
          regionKind: "floor",
          rotationYRadians: 0,
          size: Object.freeze({ x: 8, y: 0.5, z: 8 }),
          surfaceId: "ceiling-surface"
        })
      ]),
      structures: Object.freeze([]),
      surfaces: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 3, z: 0 }),
          elevation: 3,
          kind: "flat-slab",
          label: "Ceiling Surface",
          rotationYRadians: 0,
          size: Object.freeze({ x: 8, y: 0.5, z: 8 }),
          slopeRiseMeters: 0,
          surfaceId: "ceiling-surface",
          terrainPatchId: null
        })
      ]),
      terrainPatches: Object.freeze([])
    })
  );
  const supportBox = compiledWorld.chunks
    .flatMap((chunk) => chunk.collision.boxes)
    .find((box) => box.ownerId === "basement-ceiling");
  const floorAsset = compiledWorld.compatibilityEnvironmentAssets.find(
    (environmentAsset) => environmentAsset.assetId === "compat-floor"
  );
  const floorPlacement = floorAsset?.placements[0];

  assert.notEqual(supportBox, undefined);
  assert.equal(supportBox?.center.y, 2.75);
  assert.equal(supportBox?.size.y, 0.5);
  assert.equal((supportBox?.center.y ?? 0) + (supportBox?.size.y ?? 0) * 0.5, 3);
  assert.notEqual(floorAsset, undefined);
  assert.equal(floorPlacement?.position.y, 2.5);
});

test("staging-ground compiled floor support stays aligned with authored grounded spawn height", () => {
  const floorSupportBox = stagingGroundMapBundle.compiledWorld.chunks
    .flatMap((chunk) => chunk.collision.boxes)
    .find(
      (box) =>
        box.ownerKind === "region" &&
        box.ownerId.startsWith("region:metaverse-playground-range-floor-v1")
    );
  const defaultSpawn = stagingGroundMapBundle.playerSpawnNodes.find(
    (spawnNode) => spawnNode.spawnId === "shell-default-spawn"
  );
  const resolvedSpawnSupportPosition =
    resolveMetaverseMapPlayerSpawnSupportPosition({
      compiledWorld: stagingGroundMapBundle.compiledWorld,
      spawnPosition: metaverseWorldGroundedSpawnPosition
    });

  assert.notEqual(floorSupportBox, undefined);
  assert.equal(
    Math.round(
      ((floorSupportBox?.center.y ?? 0) + (floorSupportBox?.size.y ?? 0) * 0.5) *
        1_000
    ) / 1_000,
    metaverseWorldGroundedSpawnPosition.y
  );
  assert.equal(defaultSpawn?.position.y, metaverseWorldGroundedSpawnPosition.y);
  assert.equal(
    resolvedSpawnSupportPosition.y,
    metaverseWorldGroundedSpawnPosition.y
  );
});

test("map bundle parser migrates legacy terrain chunks into terrain patches", () => {
  const parsedBundle = parseMetaverseMapBundleSnapshot({
    ...stagingGroundMapBundle,
    semanticWorld: {
      ...stagingGroundMapBundle.semanticWorld,
      terrainChunks: [
        {
          chunkId: "legacy-terrain",
          heights: [0, 1, 0.5, -0.5],
          origin: {
            x: 4,
            y: 0,
            z: 8
          },
          sampleCountX: 2,
          sampleCountZ: 2,
          sampleStrideMeters: 4,
          waterLevelMeters: null
        }
      ],
      terrainPatches: []
    }
  });

  assert.equal(parsedBundle.semanticWorld.terrainPatches.length, 1);
  assert.equal(
    parsedBundle.semanticWorld.terrainPatches[0]?.terrainPatchId,
    "legacy-terrain"
  );
  assert.equal(
    parsedBundle.semanticWorld.terrainPatches[0]?.materialLayers[0]?.materialId,
    "terrain-grass"
  );
});

test("map bundle parser preserves custom semantic material definitions", () => {
  const parsedBundle = parseMetaverseMapBundleSnapshot({
    ...stagingGroundMapBundle,
    semanticWorld: {
      ...stagingGroundMapBundle.semanticWorld,
      materialDefinitions: [
        {
          accentColorHex: null,
          baseColorHex: "#123456",
          baseMaterialId: "metal",
          label: "Test Panel",
          materialId: "staging-ground:material:test-panel",
          metalness: 0.38,
          opacity: 0.86,
          roughness: 0.52,
          textureBrightness: 1.24,
          textureContrast: 1.16,
          textureImageDataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
          texturePatternStrength: 0.36,
          textureRepeat: 3
        }
      ],
      structures: [
        {
          center: { x: 0, y: 0, z: 0 },
          grid: { cellX: 0, cellZ: 0, cellsX: 1, cellsZ: 1, layer: 0 },
          label: "Test Cover",
          materialId: "metal",
          materialReferenceId: "staging-ground:material:test-panel",
          rotationYRadians: 0,
          size: { x: 4, y: 4, z: 4 },
          structureId: "test-cover",
          structureKind: "cover",
          traversalAffordance: "blocker"
        }
      ]
    }
  });

  assert.equal(parsedBundle.semanticWorld.materialDefinitions.length, 1);
  assert.equal(
    parsedBundle.semanticWorld.materialDefinitions[0]?.baseColorHex,
    "#123456"
  );
  assert.equal(
    parsedBundle.semanticWorld.materialDefinitions[0]?.textureBrightness,
    1.24
  );
  assert.equal(
    parsedBundle.semanticWorld.materialDefinitions[0]?.texturePatternStrength,
    0.36
  );
  assert.equal(
    parsedBundle.semanticWorld.materialDefinitions[0]?.textureRepeat,
    3
  );
  assert.equal(
    parsedBundle.semanticWorld.structures[0]?.materialReferenceId,
    "staging-ground:material:test-panel"
  );
});

test("sloped roof regions round-trip through parsing and compile to exact region tri-mesh support", () => {
  const parsedBundle = parseMetaverseMapBundleSnapshot({
    ...stagingGroundMapBundle,
    semanticWorld: {
      ...stagingGroundMapBundle.semanticWorld,
      regions: Object.freeze([
        Object.freeze({
          holes: Object.freeze([]),
          label: "Test Roof",
          materialReferenceId: "metal",
          outerLoop: Object.freeze({
            points: Object.freeze([
              Object.freeze({ x: -4, z: -4 }),
              Object.freeze({ x: 4, z: -4 }),
              Object.freeze({ x: 0, z: 4 })
            ])
          }),
          regionId: "test-roof-region",
          regionKind: "roof",
          rotationYRadians: 0,
          size: Object.freeze({ x: 8, y: 0.5, z: 8 }),
          surfaceId: "test-roof-surface"
        })
      ]),
      surfaces: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 6, z: 0 }),
          elevation: 6,
          kind: "sloped-plane",
          label: "Test Roof Surface",
          rotationYRadians: 0,
          size: Object.freeze({ x: 8, y: 0.5, z: 8 }),
          slopeRiseMeters: 3,
          surfaceId: "test-roof-surface",
          terrainPatchId: null
        })
      ])
    }
  });
  const parsedSurface = parsedBundle.semanticWorld.surfaces.find(
    (surface) => surface.surfaceId === "test-roof-surface"
  );
  const parsedRegion = parsedBundle.semanticWorld.regions.find(
    (region) => region.regionId === "test-roof-region"
  );
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(
    parsedBundle.semanticWorld
  );
  const regionTriMeshes = compiledWorld.chunks.flatMap((chunk) =>
    chunk.collision.triMeshes.filter(
      (triMesh) => triMesh.ownerKind === "region" && triMesh.ownerId === "test-roof-region"
    )
  );

  assert.equal(parsedSurface?.kind, "sloped-plane");
  assert.equal(parsedSurface?.slopeRiseMeters, 3);
  assert.equal(parsedRegion?.regionKind, "roof");
  assert.equal(regionTriMeshes.length, 1);
  assert.equal(regionTriMeshes[0]?.traversalAffordance, "support");
  assert.ok((regionTriMeshes[0]?.vertices.length ?? 0) >= 9);
});

test("map bundle parser rejects removed room and stair semantic structures", () => {
  const createBundleWithStructureKind = (structureKind) => ({
    ...stagingGroundMapBundle,
    semanticWorld: {
      ...stagingGroundMapBundle.semanticWorld,
      structures: [
        {
          center: { x: 0, y: 0, z: 0 },
          grid: {
            cellX: 0,
            cellZ: 0,
            cellsX: 1,
            cellsZ: 1,
            layer: 0
          },
          label: structureKind,
          materialId: "concrete",
          rotationYRadians: 0,
          size: { x: 4, y: 4, z: 4 },
          structureId: structureKind,
          structureKind,
          traversalAffordance: "support"
        }
      ]
    }
  });

  assert.throws(
    () => parseMetaverseMapBundleSnapshot(createBundleWithStructureKind("room")),
    /Unsupported semantic structure kind/
  );
  assert.throws(
    () => parseMetaverseMapBundleSnapshot(createBundleWithStructureKind("stair")),
    /Unsupported semantic structure kind/
  );
});

test("semantic procedural structures and gameplay volumes compile into deterministic chunk indexes", () => {
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(
    Object.freeze({
      compatibilityAssetIds: Object.freeze({
        connectorAssetId: null,
        floorAssetId: null,
        wallAssetId: null
      }),
      connectors: Object.freeze([]),
      edges: Object.freeze([]),
      gameplayVolumes: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 1.5, z: 0 }),
          label: "Blue Zone",
          priority: 2,
          rotationYRadians: 0,
          routePoints: Object.freeze([]),
          size: Object.freeze({ x: 8, y: 3, z: 8 }),
          tags: Object.freeze(["spawn-support"]),
          teamId: "blue",
          volumeId: "blue-zone",
          volumeKind: "team-zone"
        })
      ]),
      lights: Object.freeze([
        Object.freeze({
          color: Object.freeze([1, 0.8, 0.5]),
          intensity: 2,
          label: "Arena Light",
          lightId: "arena-light",
          lightKind: "point",
          position: Object.freeze({ x: 2, y: 6, z: 2 }),
          rangeMeters: 20,
          rotationYRadians: 0,
          target: null
        })
      ]),
      modules: Object.freeze([]),
      regions: Object.freeze([]),
      structures: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 0, z: 0 }),
          grid: Object.freeze({
            cellX: -1,
            cellZ: -1,
            cellsX: 2,
            cellsZ: 2,
            layer: 0
          }),
          label: "Floor",
          materialId: "concrete",
          rotationYRadians: 0,
          size: Object.freeze({ x: 8, y: 0.5, z: 8 }),
          structureId: "floor-1",
          structureKind: "floor",
          traversalAffordance: "support"
        })
      ]),
      surfaces: Object.freeze([]),
      terrainPatches: Object.freeze([])
    })
  );
  const structureBox = compiledWorld.chunks
    .flatMap((chunk) => chunk.collision.boxes)
    .find((box) => box.ownerId === "floor-1");
  const chunkWithMetadata = compiledWorld.chunks.find((chunk) =>
    chunk.navigation.gameplayVolumeIds.includes("blue-zone")
  );

  assert.notEqual(structureBox, undefined);
  assert.equal(structureBox.ownerKind, "structure");
  assert.equal(structureBox.center.y, 0.25);
  assert.notEqual(chunkWithMetadata, undefined);
  assert.equal(
    chunkWithMetadata.render.structureIds.includes("floor-1"),
    true
  );
  assert.equal(
    chunkWithMetadata.render.lightIds.includes("arena-light"),
    true
  );
});
