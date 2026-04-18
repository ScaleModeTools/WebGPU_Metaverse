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

test("MetaverseScenePortalPresentationState syncs focused portal presentation and resets portal scale", async () => {
  const [
    {
      createPortalMeshRuntime,
      createPortalSharedRenderResources
    },
    { MetaverseScenePortalPresentationState }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/render/portals/metaverse-scene-portals.ts"),
    clientLoader.load(
      "/src/metaverse/render/portals/metaverse-scene-portal-presentation-state.ts"
    )
  ]);
  const sharedRenderResources = createPortalSharedRenderResources();
  const duckHuntPortal = createPortalMeshRuntime(
    {
      beamColor: [0.26, 0.72, 0.98],
      experienceId: "duck-hunt",
      label: "Duck Hunt!",
      position: { x: 0, y: 0, z: 0 },
      ringColor: [1, 0.84, 0.3]
    },
    sharedRenderResources
  );
  const slayerPortal = createPortalMeshRuntime(
    {
      beamColor: [0.82, 0.22, 0.18],
      experienceId: "slayer",
      label: "Slayer",
      position: { x: 10, y: 0, z: 0 },
      ringColor: [0.94, 0.32, 0.3]
    },
    sharedRenderResources
  );
  const portalPresentationState = new MetaverseScenePortalPresentationState({
    portalMeshes: [duckHuntPortal, slayerPortal]
  });

  portalPresentationState.syncPresentation(
    {
      distanceFromCamera: 12,
      experienceId: "duck-hunt",
      label: "Duck Hunt!"
    },
    1_500
  );

  assert.equal(duckHuntPortal.anchorGroup.scale.x, 1.06);
  assert.equal(duckHuntPortal.beamOpacityNode.value, 0.92);
  assert.equal(slayerPortal.anchorGroup.scale.x, 1);
  assert.equal(slayerPortal.beamOpacityNode.value, 0.76);

  portalPresentationState.resetPresentation();

  assert.equal(duckHuntPortal.anchorGroup.scale.x, 1);
  assert.equal(slayerPortal.anchorGroup.scale.x, 1);
});
