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

test("portal render runtime keeps material nodes stable across presentation syncs", async () => {
  const {
    createPortalMeshRuntime,
    createPortalSharedRenderResources,
    syncPortalPresentation
  } = await clientLoader.load("/src/metaverse/render/portals/metaverse-scene-portals.ts");
  const portalSharedRenderResources = createPortalSharedRenderResources();
  const portalRuntime = createPortalMeshRuntime(
    {
      beamColor: [0.26, 0.72, 0.98],
      experienceId: "duck-hunt",
      label: "Duck Hunt!",
      position: {
        x: 0,
        y: 0,
        z: 0
      },
      ringColor: [1, 0.84, 0.3]
    },
    portalSharedRenderResources
  );
  const ringMesh = portalRuntime.anchorGroup.getObjectByName("metaverse_portal/duck-hunt/ring");
  const beamMesh = portalRuntime.anchorGroup.getObjectByName("metaverse_portal/duck-hunt/beam");

  assert.ok(ringMesh);
  assert.ok(beamMesh);

  const initialRingColorNode = ringMesh.material.colorNode;
  const initialRingEmissiveNode = ringMesh.material.emissiveNode;
  const initialBeamColorNode = beamMesh.material.colorNode;
  const initialBeamEmissiveNode = beamMesh.material.emissiveNode;
  const initialBeamOpacityNode = beamMesh.material.opacityNode;

  syncPortalPresentation(portalRuntime, null, 500);
  syncPortalPresentation(
    portalRuntime,
    {
      distanceFromCamera: 12,
      experienceId: "duck-hunt",
      label: "Duck Hunt!"
    },
    1_500
  );

  assert.equal(ringMesh.material.colorNode, initialRingColorNode);
  assert.equal(ringMesh.material.emissiveNode, initialRingEmissiveNode);
  assert.equal(beamMesh.material.colorNode, initialBeamColorNode);
  assert.equal(beamMesh.material.emissiveNode, initialBeamEmissiveNode);
  assert.equal(beamMesh.material.opacityNode, initialBeamOpacityNode);
  assert.equal(beamMesh.material.opacityNode.value, 0.92);

  syncPortalPresentation(portalRuntime, null, 2_200);

  assert.equal(beamMesh.material.opacityNode.value, 0.76);
});
