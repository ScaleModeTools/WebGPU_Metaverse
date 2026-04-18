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
    assert.equal(runtime.hudSnapshot.focusedMountable, null);

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});

test("MetaverseEnvironmentPhysicsRuntime keeps mountable skiff colliders and support snapshots synced to dynamic vehicle pose", async () => {
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
    setApplyImpulsesToDynamicBodies() {}
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

  assert.equal(world.colliders.length, 8);
  const portBenchSupportCollider = world.colliders.find(
    (candidate) =>
      candidate.shape === "cuboid" &&
      Math.abs((candidate.payload.halfExtentX ?? 0) - 1.3) < 0.0001 &&
      Math.abs((candidate.payload.halfExtentZ ?? 0) - 0.26) < 0.0001
  );

  assert.ok(portBenchSupportCollider);
  environmentPhysicsRuntime.setDynamicEnvironmentPose("metaverse-hub-skiff-v1", {
    position: { x: 4.2, y: 0.25, z: -6.8 },
    yawRadians: Math.PI * 0.25
  });

  const syncedPortBenchColliderTranslation = portBenchSupportCollider.translation();
  const expectedPortBenchOffsetX =
    0 * Math.cos(Math.PI * 0.25) + -0.74 * Math.sin(Math.PI * 0.25);
  const expectedPortBenchOffsetZ =
    -(0) * Math.sin(Math.PI * 0.25) + -0.74 * Math.cos(Math.PI * 0.25);

  assert.ok(
    Math.abs(
      syncedPortBenchColliderTranslation.x - (4.2 + expectedPortBenchOffsetX)
    ) < 0.0001
  );
  assert.ok(
    Math.abs(syncedPortBenchColliderTranslation.y - (0.25 + 0.92)) < 0.0001
  );
  assert.ok(
    Math.abs(
      syncedPortBenchColliderTranslation.z - (-6.8 + expectedPortBenchOffsetZ)
    ) < 0.0001
  );
  const syncedPortBenchSupportSnapshot =
    environmentPhysicsRuntime.surfaceColliderSnapshots.find(
      (collider) =>
        collider.traversalAffordance === "support" &&
        Math.abs(collider.halfExtents.x - 1.3) < 0.0001 &&
        Math.abs(collider.halfExtents.z - 0.26) < 0.0001
    );

  assert.ok(syncedPortBenchSupportSnapshot);
  assert.equal(
    syncedPortBenchSupportSnapshot.ownerEnvironmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.ok(
    Math.abs(
      syncedPortBenchSupportSnapshot.translation.x -
        syncedPortBenchColliderTranslation.x
    ) < 0.0001
  );
  assert.ok(
    Math.abs(
      syncedPortBenchSupportSnapshot.translation.z -
        syncedPortBenchColliderTranslation.z
    ) < 0.0001
  );

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
    setApplyImpulsesToDynamicBodies() {}
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

  assert.equal(world.colliders.length, 8);
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots.filter(
      (collider) =>
        collider.ownerEnvironmentAssetId === "metaverse-hub-skiff-v1"
    ).length,
    8
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

  assert.equal(world.colliders.length, 8);
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots.filter(
      (collider) =>
        collider.ownerEnvironmentAssetId === "metaverse-hub-skiff-v1"
    ).length,
    8
  );

  environmentPhysicsRuntime.dispose();
});

test("MetaverseEnvironmentPhysicsRuntime ignores legacy shoreline proof assets that are no longer part of the shipped environment slice", async () => {
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
  let collisionLoadCount = 0;
  const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
    metaverseRuntimeConfig,
    {
      createSceneAssetLoader: () => ({
        async loadAsync() {
          collisionLoadCount += 1;

          return {
            animations: [],
            scene: new Group()
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
        setApplyImpulsesToDynamicBodies() {}
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
    0
  );
  assert.equal(environmentPhysicsRuntime.surfaceColliderSnapshots.length, 0);
  assert.equal(collisionLoadCount, 0);

  environmentPhysicsRuntime.dispose();
});

test("MetaverseEnvironmentPhysicsRuntime syncs remote standing players into blocker colliders without turning swimmers or seated occupants into land", async () => {
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
        setApplyImpulsesToDynamicBodies() {}
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

  environmentPhysicsRuntime.syncRemoteCharacterBlockers([
    Object.freeze({
      characterId: "metaverse-mannequin-v1",
      look: Object.freeze({
        pitchRadians: 0,
        yawRadians: 0
      }),
      mountedOccupancy: null,
      playerId: "remote-deckhand-1",
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationVocabulary: "idle",
        position: Object.freeze({ x: 2.4, y: 0.68, z: -5.2 }),
        yawRadians: 0
      })
    }),
    Object.freeze({
      characterId: "metaverse-mannequin-v1",
      look: Object.freeze({
        pitchRadians: 0,
        yawRadians: 0
      }),
      mountedOccupancy: null,
      playerId: "remote-swimmer-2",
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationVocabulary: "swim",
        position: Object.freeze({ x: 4.4, y: 0, z: -8 }),
        yawRadians: 0
      })
    }),
    Object.freeze({
      characterId: "metaverse-mannequin-v1",
      look: Object.freeze({
        pitchRadians: 0.2,
        yawRadians: 0.4
      }),
      mountedOccupancy: Object.freeze({
        environmentAssetId: "metaverse-hub-skiff-v1",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "passenger",
        seatId: "port-bench-seat"
      }),
      playerId: "remote-passenger-3",
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationVocabulary: "seated",
        position: Object.freeze({ x: 1.8, y: 0.8, z: -5.6 }),
        yawRadians: 0
      })
    })
  ]);

  assert.equal(world.colliders.length, 1);
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots.filter(
      (collider) => collider.traversalAffordance === "blocker"
    ).length,
    1
  );
  const remoteBlockerSnapshot =
    environmentPhysicsRuntime.surfaceColliderSnapshots.find(
      (collider) =>
        collider.traversalAffordance === "blocker" &&
        collider.ownerEnvironmentAssetId === null
    );

  assert.ok(remoteBlockerSnapshot);
  assert.ok(
    Math.abs((remoteBlockerSnapshot?.translation.x ?? 0) - 2.4) < 0.0001
  );
  assert.ok(
    Math.abs(
      (remoteBlockerSnapshot?.translation.y ?? 0) -
        (0.68 +
          metaverseRuntimeConfig.groundedBody.capsuleHalfHeightMeters +
          metaverseRuntimeConfig.groundedBody.capsuleRadiusMeters)
    ) < 0.0001
  );

  environmentPhysicsRuntime.dispose();
});
