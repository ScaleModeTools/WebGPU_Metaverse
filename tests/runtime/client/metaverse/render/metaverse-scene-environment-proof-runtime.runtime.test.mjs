import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createSkiffMountProofSlice
} from "../../metaverse-runtime-proof-slice-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function findNamedNode(scene, nodeName, label) {
  const node = scene.getObjectByName(nodeName);

  assert.ok(node, `${label} should include node ${nodeName}.`);

  return node;
}

test("loadMetaverseEnvironmentProofRuntime does not create a scene asset loader for fully procedural support assets", async () => {
  const { loadMetaverseEnvironmentProofRuntime } = await clientLoader.load(
    "/src/metaverse/render/environment/metaverse-scene-environment-proof-loader.ts"
  );
  let sceneAssetLoaderCreated = false;

  const runtime = await loadMetaverseEnvironmentProofRuntime(
    {
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
    () => {
      sceneAssetLoaderCreated = true;
      throw new Error("Procedural support assets should not create a scene asset loader.");
    },
    () => {
      throw new Error("Static procedural support assets should not resolve authored nodes.");
    },
    false
  );

  assert.equal(sceneAssetLoaderCreated, false);
  assert.equal(runtime.staticPlacements.length, 1);
  assert.equal(runtime.dynamicAssets.length, 0);
  assert.equal(runtime.instancedAssets.length, 0);
});

test("syncEnvironmentProofRuntime applies dynamic pose overrides through the loaded mount runtime", async () => {
  const [
    { loadMetaverseEnvironmentProofRuntime },
    { syncEnvironmentProofRuntime },
    { resolveEnvironmentRenderYawFromSimulationYaw }
  ] = await Promise.all([
    clientLoader.load(
      "/src/metaverse/render/environment/metaverse-scene-environment-proof-loader.ts"
    ),
    clientLoader.load(
      "/src/metaverse/render/environment/metaverse-scene-environment-proof-runtime.ts"
    ),
    clientLoader.load(
      "/src/metaverse/traversal/presentation/mount-presentation.ts"
    )
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createSkiffMountProofSlice();
  const runtime = await loadMetaverseEnvironmentProofRuntime(
    environmentProofConfig,
    createSceneAssetLoader,
    findNamedNode,
    false
  );
  const skiffRuntime = runtime.dynamicAssets.find(
    (candidate) => candidate.environmentAssetId === "metaverse-hub-skiff-v1"
  );

  assert.ok(skiffRuntime);
  assert.ok((skiffRuntime.entries?.length ?? 0) >= 1);
  assert.ok((skiffRuntime.seats?.length ?? 0) >= 1);

  syncEnvironmentProofRuntime(
    runtime,
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 1.62, z: 28 },
      yawRadians: 0
    },
    1_000,
    new Map([
      [
        "metaverse-hub-skiff-v1",
        Object.freeze({
          position: Object.freeze({ x: 0, y: 0.12, z: 24 }),
          yawRadians: 0.4
        })
      ]
    ])
  );

  assert.equal(skiffRuntime.anchorGroup.position.x, 0);
  assert.equal(skiffRuntime.anchorGroup.position.y, 0.12);
  assert.equal(skiffRuntime.anchorGroup.position.z, 24);
  assert.ok(
    Math.abs(
      skiffRuntime.anchorGroup.rotation.y -
        resolveEnvironmentRenderYawFromSimulationYaw(skiffRuntime, 0.4)
    ) < 0.0001
  );
  assert.notEqual(skiffRuntime.presentationGroup.position.y, 0);
});
