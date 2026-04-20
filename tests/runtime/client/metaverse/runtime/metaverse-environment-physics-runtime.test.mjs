import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createFakePhysicsRuntimeWithWorld
} from "../../fake-rapier-runtime.mjs";
import {
  createPushableCrateProofSlice,
  createSkiffMountProofSlice
} from "../../metaverse-runtime-proof-slice-fixtures.mjs";
import { FakeMetaverseRenderer } from "./fixtures/fake-renderer.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("WebGpuMetaverseRuntime boots pushable rigid bodies and enables dynamic-body impulses only for that slice", async () => {
  const [{ WebGpuMetaverseRuntime }, { RapierPhysicsRuntime }] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createPushableCrateProofSlice();
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };

  globalThis.window = {
    addEventListener() {},
    cancelAnimationFrame() {},
    devicePixelRatio: 1,
    removeEventListener() {},
    requestAnimationFrame() {
      return 1;
    }
  };

  try {
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createRenderer: () => renderer,
      createSceneAssetLoader,
      environmentProofConfig,
      physicsRuntime,
      requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(world.rigidBodies.length, 1);
    assert.equal(
      world.characterControllers.some(
        (controller) => controller.applyImpulsesToDynamicBodies === true
      ),
      true
    );
    assert.equal(runtime.hudSnapshot.mountedInteraction.focusedMountable, null);

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});

test("MetaverseEnvironmentPhysicsRuntime keeps mountable skiff mesh collision and support snapshots synced to dynamic vehicle pose", async () => {
  const [
    { Group },
    { metaverseRuntimeConfig },
    { MetaverseEnvironmentPhysicsRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/classes/metaverse-environment-physics-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createSkiffMountProofSlice();
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const groundedBodyRuntime = {
    async init() {},
    dispose() {},
    syncInteractionSnapshot() {}
  };
  const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
    metaverseRuntimeConfig,
    {
      createSceneAssetLoader,
      environmentProofConfig,
      groundedBodyRuntime,
      physicsRuntime,
      sceneRuntime: {
        scene: new Group(),
        setDynamicEnvironmentPose() {}
      },
      showPhysicsDebug: false
    }
  );

  await environmentPhysicsRuntime.boot(0);

  assert.equal(world.colliders.length, 1);
  assert.equal(
    world.colliders.filter((candidate) => candidate.shape === "trimesh").length,
    1
  );
  const skiffCollisionMeshCollider = world.colliders.find(
    (candidate) => candidate.shape === "trimesh"
  );

  assert.ok(skiffCollisionMeshCollider);
  environmentPhysicsRuntime.setDynamicEnvironmentPose("metaverse-hub-skiff-v1", {
    position: { x: 4.2, y: 0.25, z: -6.8 },
    yawRadians: Math.PI * 0.25
  });

  const syncedSkiffSupportSnapshot =
    environmentPhysicsRuntime.surfaceColliderSnapshots.find(
      (collider) => collider.ownerEnvironmentAssetId === "metaverse-hub-skiff-v1"
    );

  assert.ok(syncedSkiffSupportSnapshot);
  assert.equal(
    syncedSkiffSupportSnapshot.ownerEnvironmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(syncedSkiffSupportSnapshot.shape, "trimesh");
  assert.ok(syncedSkiffSupportSnapshot.indices instanceof Uint32Array);
  assert.ok(syncedSkiffSupportSnapshot.vertices instanceof Float32Array);
  assert.equal(syncedSkiffSupportSnapshot.translation.x, 4.2);
  assert.equal(syncedSkiffSupportSnapshot.translation.y, 0.25);
  assert.equal(syncedSkiffSupportSnapshot.translation.z, -6.8);
  assert.ok(
    Math.abs(syncedSkiffSupportSnapshot.rotationYRadians - Math.PI * 0.25) <
      0.0001
  );
  assert.equal(skiffCollisionMeshCollider.translation().x, 4.2);
  assert.equal(skiffCollisionMeshCollider.translation().y, 0.25);
  assert.equal(skiffCollisionMeshCollider.translation().z, -6.8);

  environmentPhysicsRuntime.dispose();
});

test("MetaverseEnvironmentPhysicsRuntime clears and restores dynamic skiff colliders when its pose is removed", async () => {
  const [
    { Group },
    { metaverseRuntimeConfig },
    { MetaverseEnvironmentPhysicsRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/classes/metaverse-environment-physics-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createSkiffMountProofSlice();
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const groundedBodyRuntime = {
    async init() {},
    dispose() {},
    syncInteractionSnapshot() {}
  };
  const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
    metaverseRuntimeConfig,
    {
      createSceneAssetLoader,
      environmentProofConfig,
      groundedBodyRuntime,
      physicsRuntime,
      sceneRuntime: {
        scene: new Group(),
        setDynamicEnvironmentPose() {}
      },
      showPhysicsDebug: false
    }
  );

  await environmentPhysicsRuntime.boot(0);

  assert.equal(world.colliders.length, 1);
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots.filter(
      (collider) =>
        collider.ownerEnvironmentAssetId === "metaverse-hub-skiff-v1"
    ).length,
    1
  );

  environmentPhysicsRuntime.setDynamicEnvironmentPose(
    "metaverse-hub-skiff-v1",
    null
  );

  assert.equal(world.colliders.length, 0);
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots.filter(
      (collider) =>
        collider.ownerEnvironmentAssetId === "metaverse-hub-skiff-v1"
    ).length,
    0
  );

  environmentPhysicsRuntime.setDynamicEnvironmentPose("metaverse-hub-skiff-v1", {
    position: { x: -3.4, y: 0.18, z: 11.6 },
    yawRadians: Math.PI * 0.5
  });

  assert.equal(world.colliders.length, 1);
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots.filter(
      (collider) =>
        collider.ownerEnvironmentAssetId === "metaverse-hub-skiff-v1"
    ).length,
    1
  );

  environmentPhysicsRuntime.dispose();
});

test("MetaverseEnvironmentPhysicsRuntime loads proof-authored collision meshes as shared support surfaces", async () => {
  const [
    { BoxGeometry, Group, Mesh, MeshStandardMaterial },
    { metaverseRuntimeConfig },
    { MetaverseEnvironmentPhysicsRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/classes/metaverse-environment-physics-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  let collisionLoadCount = 0;
  const collisionScene = new Group();

  collisionScene.add(
    new Mesh(
      new BoxGeometry(4, 0.5, 3),
      new MeshStandardMaterial({ color: 0xffffff })
    )
  );
  const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
    metaverseRuntimeConfig,
    {
      createSceneAssetLoader: () => ({
        async loadAsync() {
          collisionLoadCount += 1;

          return {
            animations: [],
            scene: collisionScene
          };
        }
      }),
      environmentProofConfig: {
        assets: [
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
                position: { x: -8.45, y: 0, z: -26.2 },
                rotationYRadians: 0,
                scale: 1
              }
            ],
            entries: null,
            orientation: null,
            physicsColliders: [
              {
                center: { x: 0, y: 0.09, z: 3.05 },
                shape: "box",
                size: { x: 2.8, y: 0.18, z: 3.2 },
                traversalAffordance: "support"
              },
              {
                center: { x: 0, y: 0.14, z: 0.25 },
                shape: "box",
                size: { x: 8.2, y: 0.28, z: 5.8 },
                traversalAffordance: "support"
              }
            ],
            seats: null,
            traversalAffordance: "support"
          }
        ]
      },
      groundedBodyRuntime: {
        async init() {},
        dispose() {},
        syncInteractionSnapshot() {}
      },
      physicsRuntime,
      sceneRuntime: {
        scene: new Group(),
        setDynamicEnvironmentPose() {}
      },
      showPhysicsDebug: false
    }
  );

  await environmentPhysicsRuntime.boot(0);

  assert.equal(
    world.colliders.filter((collider) => collider.shape === "cuboid").length,
    0
  );
  assert.equal(
    world.colliders.filter((collider) => collider.shape === "trimesh").length,
    1
  );
  assert.equal(environmentPhysicsRuntime.surfaceColliderSnapshots.length, 1);
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots.every(
      (collider) =>
        collider.ownerEnvironmentAssetId === "metaverse-hub-shoreline-v1"
    ),
    true
  );
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots[0]?.shape,
    "trimesh"
  );
  assert.equal(collisionLoadCount, 1);

  environmentPhysicsRuntime.dispose();
});

test("MetaverseEnvironmentPhysicsRuntime uses proof-authored collisionPath for static mesh support instead of box approximations", async () => {
  const [
    { BoxGeometry, Group, Mesh, MeshStandardMaterial },
    { metaverseRuntimeConfig },
    { MetaverseEnvironmentPhysicsRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/classes/metaverse-environment-physics-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  let collisionLoadCount = 0;
  const collisionScene = new Group();

  collisionScene.add(
    new Mesh(
      new BoxGeometry(8.4, 0.34, 4.2),
      new MeshStandardMaterial({ color: 0xffffff })
    )
  );
  const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
    metaverseRuntimeConfig,
    {
      createSceneAssetLoader: () => ({
        async loadAsync(path) {
          collisionLoadCount += 1;
          assert.equal(path, "/models/metaverse/environment/metaverse-hub-dock-high.gltf");

          return {
            animations: [],
            scene: collisionScene
          };
        }
      }),
      environmentProofConfig: {
        assets: [
          {
            collisionPath: "/models/metaverse/environment/metaverse-hub-dock-high.gltf",
            collider: null,
            dynamicBody: null,
            entries: null,
            environmentAssetId: "metaverse-hub-dock-v1",
            label: "Metaverse hub dock",
            lods: [
              {
                maxDistanceMeters: 28,
                modelPath: "/models/metaverse/environment/metaverse-hub-dock-high.gltf",
                tier: "high"
              },
              {
                maxDistanceMeters: null,
                modelPath: "/models/metaverse/environment/metaverse-hub-dock-low.gltf",
                tier: "low"
              }
            ],
            orientation: null,
            physicsColliders: [
              {
                center: { x: 0, y: 0, z: 0 },
                shape: "box",
                size: { x: 8.4, y: 0.34, z: 4.2 },
                traversalAffordance: "support"
              }
            ],
            placement: "static",
            placements: [
              {
                position: { x: 5, y: 0.43, z: -12 },
                rotationYRadians: Math.PI * 0.5,
                scale: 1
              }
            ],
            seats: null,
            traversalAffordance: "support"
          }
        ]
      },
      groundedBodyRuntime: {
        async init() {},
        dispose() {},
        syncInteractionSnapshot() {}
      },
      physicsRuntime,
      sceneRuntime: {
        scene: new Group(),
        setDynamicEnvironmentPose() {}
      },
      showPhysicsDebug: false
    }
  );

  await environmentPhysicsRuntime.boot(0);

  assert.equal(
    world.colliders.filter((collider) => collider.shape === "cuboid").length,
    0
  );
  assert.equal(
    world.colliders.filter((collider) => collider.shape === "trimesh").length,
    1
  );
  assert.equal(environmentPhysicsRuntime.surfaceColliderSnapshots.length, 1);
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots[0]?.shape,
    "trimesh"
  );
  assert.equal(collisionLoadCount, 1);

  environmentPhysicsRuntime.dispose();
});

test("MetaverseEnvironmentPhysicsRuntime derives static barrier colliders from the active proof placements instead of the legacy world layout", async () => {
  const [
    { Group },
    { metaverseRuntimeConfig },
    { MetaverseEnvironmentPhysicsRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/classes/metaverse-environment-physics-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
    metaverseRuntimeConfig,
    {
      createSceneAssetLoader: () => ({
        async loadAsync() {
          return {
            animations: [],
            scene: new Group()
          };
        }
      }),
      environmentProofConfig: {
        assets: [
          {
            collisionPath: null,
            collider: null,
            entries: null,
            environmentAssetId: "metaverse-playground-range-barrier-v1",
            label: "Moved proof barrier",
            lods: [],
            orientation: null,
            physicsColliders: [
              {
                center: { x: 1, y: 1, z: 0 },
                shape: "box",
                size: { x: 2, y: 4, z: 6 },
                traversalAffordance: "blocker"
              }
            ],
            placement: "static",
            placements: [
              {
                position: { x: 37, y: 2, z: -19 },
                rotationYRadians: Math.PI * 0.5,
                scale: { x: 2, y: 1, z: 0.5 }
              }
            ],
            seats: null,
            traversalAffordance: "blocker"
          }
        ]
      },
      groundedBodyRuntime: {
        async init() {},
        dispose() {},
        syncInteractionSnapshot() {}
      },
      physicsRuntime,
      sceneRuntime: {
        scene: new Group(),
        setDynamicEnvironmentPose() {}
      },
      showPhysicsDebug: false
    }
  );

  await environmentPhysicsRuntime.boot(0);

  assert.equal(world.colliders.length, 1);
  assert.equal(environmentPhysicsRuntime.surfaceColliderSnapshots.length, 1);
  assert.deepEqual(environmentPhysicsRuntime.surfaceColliderSnapshots[0], {
    halfExtents: { x: 2, y: 2, z: 1.5 },
    ownerEnvironmentAssetId: "metaverse-playground-range-barrier-v1",
    rotation: {
      x: 0,
      y: Math.sin(Math.PI * 0.25),
      z: 0,
      w: Math.cos(Math.PI * 0.25)
    },
    rotationYRadians: Math.PI * 0.5,
    shape: "box",
    translation: { x: 37, y: 3, z: -21 },
    traversalAffordance: "blocker"
  });

  assert.equal(world.colliders[0].translation().x, 37);
  assert.equal(world.colliders[0].translation().y, 3);
  assert.equal(world.colliders[0].translation().z, -21);

  environmentPhysicsRuntime.dispose();
});

test("MetaverseEnvironmentPhysicsRuntime keeps authoritative remote player blocker colliders physics-only while preserving traversal collision", async () => {
  const [
    { Group },
    { metaverseRuntimeConfig },
    { MetaverseEnvironmentPhysicsRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/classes/metaverse-environment-physics-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
    metaverseRuntimeConfig,
    {
      createSceneAssetLoader: () => ({
        async loadAsync() {
          return {
            animations: [],
            scene: new Group()
          };
        }
      }),
      environmentProofConfig: null,
      groundedBodyRuntime: {
        async init() {},
        dispose() {},
        syncInteractionSnapshot() {}
      },
      physicsRuntime,
      sceneRuntime: {
        scene: new Group(),
        setDynamicEnvironmentPose() {}
      },
      showPhysicsDebug: false
    }
  );

  await environmentPhysicsRuntime.boot(0);
  assert.equal(world.colliders.length, 0);

  environmentPhysicsRuntime.syncAuthoritativeRemotePlayerBlockers([
    Object.freeze({
      locomotionMode: "grounded",
      mountedOccupancy: null,
      playerId: "remote-deckhand-1",
      position: Object.freeze({ x: 2.4, y: 0.68, z: -5.2 }),
      yawRadians: 0
    }),
    Object.freeze({
      locomotionMode: "swim",
      mountedOccupancy: null,
      playerId: "remote-swimmer-2",
      position: Object.freeze({ x: 4.4, y: 0, z: -8 }),
      yawRadians: 0
    }),
    Object.freeze({
      locomotionMode: "grounded",
      mountedOccupancy: Object.freeze({
        environmentAssetId: "metaverse-hub-skiff-v1",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "passenger",
        seatId: "port-bench-seat"
      }),
      playerId: "remote-passenger-3",
      position: Object.freeze({ x: 1.8, y: 0.8, z: -5.6 }),
      yawRadians: 0
    })
  ]);

  assert.equal(world.colliders.length, 1);
  const remoteBlockerCollider = world.colliders[0];

  assert.ok(remoteBlockerCollider);
  assert.equal(remoteBlockerCollider.shape, "capsule");
  assert.equal(
    environmentPhysicsRuntime.resolveGroundedTraversalFilterPredicate()(
      remoteBlockerCollider
    ),
    true
  );
  assert.equal(
    environmentPhysicsRuntime.resolveWaterborneTraversalFilterPredicate()(
      remoteBlockerCollider
    ),
    true
  );
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots.filter(
      (collider) => collider.traversalAffordance === "blocker"
    ).length,
    0
  );

  environmentPhysicsRuntime.dispose();
});

test("MetaverseEnvironmentPhysicsRuntime keeps authoritative environment-body collision sync separate from scene presentation for the current frame", async () => {
  const [
    { Group },
    { metaverseRuntimeConfig },
    { MetaverseEnvironmentPhysicsRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/classes/metaverse-environment-physics-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createPushableCrateProofSlice();
  const { physicsRuntime } = createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const pushableCrateYawRadians = Math.PI * 0.04;
  const scenePoseCalls = [];
  const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
    metaverseRuntimeConfig,
    {
      createSceneAssetLoader,
      environmentProofConfig,
      groundedBodyRuntime: {
        async init() {},
        dispose() {},
        syncInteractionSnapshot() {}
      },
      physicsRuntime,
      sceneRuntime: {
        scene: new Group(),
        setDynamicEnvironmentPose(environmentAssetId, poseSnapshot) {
          scenePoseCalls.push(
            Object.freeze({
              environmentAssetId,
              poseSnapshot
            })
          );
        }
      },
      showPhysicsDebug: false
    }
  );

  await environmentPhysicsRuntime.boot(0);
  scenePoseCalls.length = 0;

  environmentPhysicsRuntime.beginAuthoritativeEnvironmentBodyCollisionSync();
  environmentPhysicsRuntime.syncAuthoritativeEnvironmentBodyCollisionPose(
    "metaverse-hub-pushable-crate-v1",
    {
      linearVelocity: Object.freeze({
        x: 0.8,
        y: 0,
        z: -0.1
      }),
      position: Object.freeze({
        x: -7.4,
        y: 0.46,
        z: 13.1
      }),
      yawRadians: pushableCrateYawRadians
    }
  );
  environmentPhysicsRuntime.syncDynamicEnvironmentBodyPresentations();

  assert.deepEqual(scenePoseCalls, []);

  environmentPhysicsRuntime.beginAuthoritativeEnvironmentBodyCollisionSync();
  environmentPhysicsRuntime.syncDynamicEnvironmentBodyPresentations();

  assert.deepEqual(scenePoseCalls, [
    Object.freeze({
      environmentAssetId: "metaverse-hub-pushable-crate-v1",
      poseSnapshot: Object.freeze({
        position: Object.freeze({
          x: -7.4,
          y: 0.46,
          z: 13.1
        }),
        yawRadians: pushableCrateYawRadians
      })
    })
  ]);

  environmentPhysicsRuntime.dispose();
});
