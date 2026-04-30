import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseSceneScenicState installs atmosphere, portals, and viewport dirtying", async () => {
  const [
    { BundleGroup, PerspectiveCamera, Scene },
    { MetaverseSceneScenicState },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/metaverse-scene-scenic-state.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const scenicState = new MetaverseSceneScenicState({
    camera,
    config: metaverseRuntimeConfig,
    scene
  });
  const bundleGroup = new BundleGroup();

  bundleGroup.name = "viewport_bundle";
  scene.add(bundleGroup);

  assert.equal(scene.background?.r, metaverseRuntimeConfig.environment.horizonColor[0]);
  assert.equal(scene.fog, null);
  assert.equal(scenicState.portalMeshes.length, metaverseRuntimeConfig.portals.length);

  for (const portalMesh of scenicState.portalMeshes) {
    assert.equal(portalMesh.anchorGroup.parent, scene);
  }

  const renderer = {
    setPixelRatio() {},
    setSize() {}
  };

  scenicState.syncViewport(
    renderer,
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    1
  );

  const initialBundleVersion = bundleGroup.version;

  scenicState.syncViewport(
    renderer,
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    1
  );

  assert.equal(bundleGroup.version, initialBundleVersion);

  scenicState.syncViewport(
    renderer,
    {
      clientHeight: 900,
      clientWidth: 1440
    },
    1
  );

  assert.equal(bundleGroup.version, initialBundleVersion + 1);
});
