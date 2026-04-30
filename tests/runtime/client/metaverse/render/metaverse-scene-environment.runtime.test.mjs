import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { metaverseWorldPlacedWaterRegions } from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("scene environment runtime builds shared water regions and visual atmosphere from config", async () => {
  const [{ createMetaverseSceneEnvironment }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load(
        "/src/metaverse/render/environment/metaverse-scene-environment.ts"
      ),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);
  const environmentRuntime = createMetaverseSceneEnvironment(metaverseRuntimeConfig);

  assert.equal(
    environmentRuntime.waterGroup.children.length,
    metaverseWorldPlacedWaterRegions.length
  );
  assert.equal(
    environmentRuntime.backgroundColor.r,
    metaverseRuntimeConfig.environment.horizonColor[0]
  );
  assert.equal(
    environmentRuntime.backgroundColor.g,
    metaverseRuntimeConfig.environment.horizonColor[1]
  );
  assert.equal(
    environmentRuntime.backgroundColor.b,
    metaverseRuntimeConfig.environment.horizonColor[2]
  );
  assert.equal(environmentRuntime.fog, null);
  assert.equal(environmentRuntime.skyMesh.material.depthWrite, false);
  assert.equal(environmentRuntime.skyMesh.isSkyMesh, true);
  assert.equal(environmentRuntime.skyMesh.geometry.type, "SphereGeometry");
  assert.equal(environmentRuntime.skyMesh.children.length, 1);
  assert.equal(environmentRuntime.skyMesh.children[0]?.name, "metaverse_scene_environment/sky_lower_extension");
  assert.equal(
    environmentRuntime.skyMesh.cloudScale.value,
    metaverseRuntimeConfig.environment.cloudScale
  );
  assert.equal(
    environmentRuntime.skyMesh.cloudSpeed.value,
    metaverseRuntimeConfig.environment.cloudSpeed
  );
  assert.equal(environmentRuntime.sunLight.intensity, 2.2);
  assert.equal(environmentRuntime.hemisphereLight.intensity, 1.65);
});
