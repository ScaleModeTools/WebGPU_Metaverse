import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createPushableCrateProofSlice,
  createSkiffMountProofSlice
} from "../../metaverse-runtime-proof-slice-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createMetaverseScene syncs pushable dynamic assets from exact pose overrides without exposing mount focus", async () => {
  const [{ createMetaverseScene }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createPushableCrateProofSlice();
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    createSceneAssetLoader,
    environmentProofConfig,
    warn() {}
  });

  await sceneRuntime.boot();

  const initialInteractionSnapshot = sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: -3.8, y: 1.2, z: -14.4 },
      yawRadians: 0
    },
    null,
    0,
    0
  );

  assert.equal(initialInteractionSnapshot.focusedMountable, null);

  sceneRuntime.setDynamicEnvironmentPose("metaverse-hub-pushable-crate-v1", {
    position: { x: -2.4, y: 0.46, z: -13.2 },
    yawRadians: 0.6
  });
  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: -2.4, y: 1.2, z: -13.2 },
      yawRadians: 0
    },
    null,
    1000,
    1 / 60
  );

  const pushableRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_asset/metaverse-hub-pushable-crate-v1"
  );

  assert.ok(pushableRoot);
  assert.ok(Math.abs(pushableRoot.position.x - -2.4) < 0.0001);
  assert.ok(Math.abs(pushableRoot.position.y - 0.46) < 0.0001);
  assert.ok(Math.abs(pushableRoot.position.z - -13.2) < 0.0001);
  assert.ok(Math.abs(pushableRoot.rotation.y - 0.6) < 0.0001);
});

test("createMetaverseScene keeps the canonical procedural floor scene-owned so it can render immediately at boot", async () => {
  const [{ createMetaverseScene }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    characterProofConfig: null,
    environmentProofConfig: {
      assets: [
        {
          collisionPath: null,
          collider: null,
          entries: null,
          environmentAssetId: "metaverse-playground-range-floor-v1",
          label: "Metaverse playground range floor",
          lods: [
            {
              kind: "procedural-box",
              materialPreset: "training-range-surface",
              maxDistanceMeters: null,
              size: { x: 72, y: 0.6, z: 82 },
              tier: "high"
            }
          ],
          orientation: null,
          physicsColliders: null,
          placement: "static",
          placements: [
            {
              position: { x: 0, y: 0, z: 0 },
              rotationYRadians: 0,
              scale: 1
            }
          ],
          seats: null,
          traversalAffordance: "support"
        }
      ]
    },
    warn() {}
  });

  await sceneRuntime.boot();

  const floorBundle = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_static/metaverse-playground-range-floor-v1/0/high"
  );

  assert.ok(floorBundle);
  assert.notEqual(floorBundle.isBundleGroup, true);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: {
        x: metaverseRuntimeConfig.camera.spawnPosition.x,
        y: metaverseRuntimeConfig.camera.spawnPosition.y,
        z: metaverseRuntimeConfig.camera.spawnPosition.z
      },
      yawRadians: metaverseRuntimeConfig.camera.initialYawRadians
    },
    null,
    250,
    0
  );

  assert.equal(floorBundle.visible, true);
});

test("createMetaverseScene maps skiff simulation yaw onto its forward-authored render yaw", async () => {
  const [
    { createMetaverseScene },
    { metaverseRuntimeConfig },
    { Quaternion, Vector3 }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    import("three/webgpu")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createSkiffMountProofSlice();
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    createSceneAssetLoader,
    environmentProofConfig,
    warn() {}
  });

  await sceneRuntime.boot();

  sceneRuntime.setDynamicEnvironmentPose("metaverse-hub-skiff-v1", {
    position: { x: 0, y: 0.12, z: 24 },
    yawRadians: 0.4
  });
  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 1.62, z: 28 },
      yawRadians: 0
    },
    null,
    1000,
    0
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const skiffRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_asset/metaverse-hub-skiff-v1"
  );

  assert.ok(skiffRoot);
  assert.ok(Math.abs(skiffRoot.rotation.y - (Math.PI * 0.5 - 0.4)) < 0.0001);
  assert.equal(skiffRoot.position.y, 0.12);
  const skiffPresentationRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_presentation/metaverse-hub-skiff-v1"
  );

  assert.ok(skiffPresentationRoot);
  assert.ok(Math.abs(skiffPresentationRoot.position.y) > 0.001);

  const mountedAnchorSnapshot = sceneRuntime.readMountedEnvironmentAnchorSnapshot({
    cameraPolicyId: "vehicle-follow",
    controlRoutingPolicyId: "vehicle-surface-drive",
    directSeatTargets: [],
    entryId: null,
    environmentAssetId: "metaverse-hub-skiff-v1",
    label: "Metaverse hub skiff",
    lookLimitPolicyId: "driver-forward",
    occupancyAnimationId: "seated",
    occupancyKind: "seat",
    occupantLabel: "Take helm",
    occupantRole: "driver",
    seatId: "driver-seat",
    seatTargets: []
  });

  assert.ok(mountedAnchorSnapshot);
  assert.equal(mountedAnchorSnapshot.position.y > 0.1, true);
  const mountedYawQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    mountedAnchorSnapshot.yawRadians
  );

  assert.ok(Number.isFinite(mountedYawQuaternion.angleTo(new Quaternion())));
});
