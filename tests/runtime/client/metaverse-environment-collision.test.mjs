import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

function measureBounds(vertices) {
  const bounds = {
    max: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY },
    min: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY }
  };

  for (let index = 0; index < vertices.length; index += 3) {
    bounds.min.x = Math.min(bounds.min.x, vertices[index]);
    bounds.min.y = Math.min(bounds.min.y, vertices[index + 1]);
    bounds.min.z = Math.min(bounds.min.z, vertices[index + 2]);
    bounds.max.x = Math.max(bounds.max.x, vertices[index]);
    bounds.max.y = Math.max(bounds.max.y, vertices[index + 1]);
    bounds.max.z = Math.max(bounds.max.z, vertices[index + 2]);
  }

  return bounds;
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("resolvePlacedCuboidColliders applies placement translation rotation and scale", async () => {
  const { resolvePlacedCuboidColliders } = await clientLoader.load(
    "/src/metaverse/states/metaverse-environment-collision.ts"
  );

  const colliders = resolvePlacedCuboidColliders({
    collisionPath: null,
    collider: null,
    environmentAssetId: "metaverse-hub-dock-v1",
    label: "Metaverse hub dock",
    lods: [],
    placement: "static",
    placements: [
      {
        position: { x: 10, y: 0, z: 20 },
        rotationYRadians: Math.PI * 0.5,
        scale: 2
      }
    ],
    entries: null,
    seats: null,
    traversalAffordance: "support",
    physicsColliders: [
      {
        center: { x: 1, y: 0.5, z: -2 },
        shape: "box",
        size: { x: 2, y: 1, z: 4 },
        traversalAffordance: "support"
      }
    ]
  });

  assert.equal(colliders.length, 1);
  assert.equal(colliders[0]?.ownerEnvironmentAssetId, "metaverse-hub-dock-v1");
  assert.equal(colliders[0]?.traversalAffordance, "support");
  assert.deepEqual(colliders[0]?.halfExtents, {
    x: 2,
    y: 1,
    z: 4
  });
  assert.deepEqual(colliders[0]?.translation, {
    x: 6,
    y: 1,
    z: 18
  });
  assert.ok(Math.abs(colliders[0]?.rotationYRadians - Math.PI * 0.5) < 0.00001);
  assert.ok(Math.abs(colliders[0]?.rotation.y - Math.SQRT1_2) < 0.00001);
  assert.ok(Math.abs(colliders[0]?.rotation.w - Math.SQRT1_2) < 0.00001);
});

test("resolveDynamicEnvironmentCuboidColliders applies runtime pose while preserving collider affordance", async () => {
  const { resolveDynamicEnvironmentCuboidColliders } = await clientLoader.load(
    "/src/metaverse/states/metaverse-environment-collision.ts"
  );

  const colliders = resolveDynamicEnvironmentCuboidColliders(
    {
      environmentAssetId: "metaverse-hub-skiff-v1",
      physicsColliders: [
        {
          center: { x: 1, y: 0.5, z: -2 },
          shape: "box",
          size: { x: 2, y: 1, z: 4 },
          traversalAffordance: "support"
        },
        {
          center: { x: -0.5, y: 0.2, z: 0.25 },
          shape: "box",
          size: { x: 1, y: 0.5, z: 0.75 },
          traversalAffordance: "blocker"
        }
      ],
      placement: "dynamic",
      placements: [
        {
          position: { x: 0, y: 0.12, z: 24 },
          rotationYRadians: Math.PI,
          scale: 2
        }
      ]
    },
    {
      position: { x: 12, y: 0.25, z: -4 },
      yawRadians: Math.PI * 0.5
    }
  );

  assert.equal(colliders.length, 2);
  assert.equal(colliders[0]?.ownerEnvironmentAssetId, "metaverse-hub-skiff-v1");
  assert.equal(colliders[1]?.ownerEnvironmentAssetId, "metaverse-hub-skiff-v1");
  assert.equal(colliders[0]?.traversalAffordance, "support");
  assert.equal(colliders[1]?.traversalAffordance, "blocker");
  assert.deepEqual(colliders[0]?.halfExtents, {
    x: 2,
    y: 1,
    z: 4
  });
  assert.deepEqual(colliders[0]?.translation, {
    x: 8,
    y: 1.25,
    z: -6
  });
  assert.ok(Math.abs(colliders[0]?.rotationYRadians - Math.PI * 0.5) < 0.00001);
  assert.ok(Math.abs(colliders[0]?.rotation.y - Math.SQRT1_2) < 0.00001);
  assert.ok(Math.abs(colliders[0]?.rotation.w - Math.SQRT1_2) < 0.00001);
});

test("resolvePlacedCollisionTriMeshes bakes placement transforms into world-space vertices", async () => {
  const [{ BoxGeometry, Group, Mesh, MeshStandardMaterial }, { resolvePlacedCollisionTriMeshes }] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load("/src/metaverse/states/metaverse-environment-collision.ts")
    ]);
  const collisionScene = new Group();
  const collisionMesh = new Mesh(
    new BoxGeometry(2, 1, 4),
    new MeshStandardMaterial({ color: 0xffffff })
  );

  collisionScene.add(collisionMesh);
  collisionScene.updateMatrixWorld(true);

  const triMeshes = resolvePlacedCollisionTriMeshes(
    {
      collisionPath: "/models/metaverse/environment/metaverse-hub-dock-collision.gltf",
      collider: null,
      environmentAssetId: "metaverse-hub-dock-v1",
      label: "Metaverse hub dock",
      lods: [],
      placement: "static",
      placements: [
        {
          position: { x: 5, y: 0, z: 3 },
          rotationYRadians: Math.PI * 0.5,
          scale: 2
        }
      ],
      entries: null,
      seats: null,
      traversalAffordance: "blocker",
      physicsColliders: null
    },
    collisionScene
  );

  assert.equal(triMeshes.length, 1);
  assert.ok(triMeshes[0].vertices.length > 0);
  assert.ok(triMeshes[0].indices.length > 0);

  const bounds = measureBounds(triMeshes[0].vertices);

  assert.deepEqual(bounds.min, {
    x: 1,
    y: -1,
    z: 1
  });
  assert.deepEqual(bounds.max, {
    x: 9,
    y: 1,
    z: 5
  });
});

test("resolvePlacedCollisionTriMeshes keeps static contact meshes when semantic physics colliders are also authored", async () => {
  const [{ BoxGeometry, Group, Mesh, MeshStandardMaterial }, { resolvePlacedCollisionTriMeshes }] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load("/src/metaverse/states/metaverse-environment-collision.ts")
    ]);
  const collisionScene = new Group();
  const collisionMesh = new Mesh(
    new BoxGeometry(4, 0.5, 3),
    new MeshStandardMaterial({ color: 0xffffff })
  );

  collisionScene.add(collisionMesh);
  collisionScene.updateMatrixWorld(true);

  const triMeshes = resolvePlacedCollisionTriMeshes(
    {
      collisionPath:
        "/models/metaverse/environment/metaverse-hub-shoreline-collision.gltf",
      collider: null,
      environmentAssetId: "metaverse-hub-shoreline-v1",
      label: "Metaverse hub shoreline",
      lods: [],
      placement: "static",
      placements: [
        {
          position: { x: -4, y: 0, z: 6 },
          rotationYRadians: 0,
          scale: 1
        }
      ],
      entries: null,
      seats: null,
      traversalAffordance: "support",
      physicsColliders: [
        {
          center: { x: 0, y: 0.09, z: 3.05 },
          shape: "box",
          size: { x: 2.8, y: 0.18, z: 3.2 },
          traversalAffordance: "support"
        }
      ]
    },
    collisionScene
  );

  assert.equal(triMeshes.length, 1);
  assert.ok(triMeshes[0].vertices.length > 0);
  assert.ok(triMeshes[0].indices.length > 0);
});

test("resolveDynamicCollisionTriMeshes preserves local mesh shape while baking authored scale for moving assets", async () => {
  const [{ BoxGeometry, Group, Mesh, MeshStandardMaterial }, { resolveDynamicCollisionTriMeshes }] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load("/src/metaverse/states/metaverse-environment-collision.ts")
    ]);
  const collisionScene = new Group();
  const collisionMesh = new Mesh(
    new BoxGeometry(2, 1, 4),
    new MeshStandardMaterial({ color: 0xffffff })
  );

  collisionScene.add(collisionMesh);
  collisionScene.updateMatrixWorld(true);

  const triMeshes = resolveDynamicCollisionTriMeshes(
    {
      placement: "dynamic",
      placements: [
        {
          position: { x: 12, y: 3, z: -8 },
          rotationYRadians: Math.PI * 0.5,
          scale: 2
        }
      ]
    },
    collisionScene
  );

  assert.equal(triMeshes.length, 1);
  assert.ok(triMeshes[0].vertices.length > 0);
  assert.ok(triMeshes[0].indices.length > 0);

  const bounds = measureBounds(triMeshes[0].vertices);

  assert.deepEqual(bounds.min, {
    x: -2,
    y: -1,
    z: -4
  });
  assert.deepEqual(bounds.max, {
    x: 2,
    y: 1,
    z: 4
  });
});
