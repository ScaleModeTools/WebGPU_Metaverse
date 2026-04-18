import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createHeldWeaponProofSlice } from "../../metaverse-runtime-proof-slice-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createMetaverseScene keeps the local grounded first-person camera in front of the animated head socket", async () => {
  const [{ Quaternion, Vector3 }, { createMetaverseScene }, { metaverseRuntimeConfig }] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);
  const {
    attachmentProofConfig,
    characterProofConfig,
    createSceneAssetLoader
  } = await createHeldWeaponProofSlice();
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    attachmentProofConfig,
    characterProofConfig,
    createSceneAssetLoader,
    warn() {}
  });

  await sceneRuntime.boot();

  const rawCameraSnapshot = Object.freeze({
    lookDirection: Object.freeze({
      x: 0,
      y: 0,
      z: -1
    }),
    pitchRadians: 0,
    position: Object.freeze({
      x: 0,
      y: 1.62,
      z: -0.02
    }),
    yawRadians: 0
  });
  const characterPresentation = Object.freeze({
    animationVocabulary: "walk",
    position: Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    yawRadians: 0
  });

  sceneRuntime.syncPresentation(
    rawCameraSnapshot,
    null,
    16,
    1 / 60,
    characterPresentation,
    []
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const headSocketNode = sceneRuntime.scene.getObjectByName("head_socket");

  assert.ok(headSocketNode);
  assert.ok(
    sceneRuntime.camera.position.z <
      rawCameraSnapshot.position.z -
        metaverseRuntimeConfig.bodyPresentation
          .groundedFirstPersonHeadClearanceMeters *
          0.5,
    `Expected rendered camera z ${sceneRuntime.camera.position.z.toFixed(4)} to move ahead of raw traversal z ${rawCameraSnapshot.position.z.toFixed(4)} when the head intrudes.`
  );

  const renderedLookDirection = new Vector3(0, 0, -1).applyQuaternion(
    sceneRuntime.camera.quaternion.clone()
  );
  const renderedCameraPosition = sceneRuntime.camera.position.clone();
  const headForwardDistanceMeters = headSocketNode
    .getWorldPosition(new Vector3())
    .sub(renderedCameraPosition)
    .dot(renderedLookDirection);

  assert.ok(
    headForwardDistanceMeters <=
      -metaverseRuntimeConfig.bodyPresentation
        .groundedFirstPersonHeadClearanceMeters +
        0.000001,
    `Expected rendered camera to stay at least ${metaverseRuntimeConfig.bodyPresentation.groundedFirstPersonHeadClearanceMeters.toFixed(3)}m ahead of the head socket, but forward distance was ${headForwardDistanceMeters.toFixed(4)}.`
  );
  assert.ok(
    sceneRuntime.camera.quaternion.angleTo(new Quaternion()) < 0.000001,
    "Expected first-person head clearance to preserve camera orientation."
  );
});
