import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createSkiffMountProofSlice } from "../../metaverse-runtime-proof-slice-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createMetaverseScene mounts remote metaverse presence avatars from shared occupancy state", async () => {
  const [
    { Vector3 },
    { createMetaverseScene },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const {
    characterProofConfig,
    createSceneAssetLoader,
    environmentProofConfig
  } = await createSkiffMountProofSlice();
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    characterProofConfig,
    createSceneAssetLoader,
    environmentProofConfig,
    warn() {}
  });

  await sceneRuntime.boot();

  const cameraSnapshot = {
    lookDirection: { x: 0, y: 0, z: -1 },
    pitchRadians: 0,
    position: { x: 0, y: 1.8, z: 19 },
    yawRadians: Math.PI
  };
  const remoteCharacterPresentation = Object.freeze({
    aimCamera: null,
    characterId: "mesh2motion-humanoid-v1",
    look: Object.freeze({
      pitchRadians: 0,
      yawRadians: 0
    }),
    mountedOccupancy: Object.freeze({
      environmentAssetId: "metaverse-hub-skiff-v1",
      entryId: null,
      occupancyKind: "seat",
      occupantRole: "driver",
      seatId: "driver-seat"
    }),
    playerId: "remote-sailor-2",
    poseSyncMode: "runtime-server-sampled",
    presentation: Object.freeze({
      animationVocabulary: "seated",
      position: Object.freeze({
        x: 0,
        y: 1,
        z: 0
      }),
      yawRadians: 0
    })
  });

  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [remoteCharacterPresentation],
    null
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const remoteCharacterRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_character/mesh2motion-humanoid-v1/remote-sailor-2"
  );
  const remoteSeatAnchor = remoteCharacterRoot?.parent ?? null;
  const remoteSeatSocket = remoteCharacterRoot?.getObjectByName("seat_socket") ?? null;

  assert.ok(remoteCharacterRoot);
  assert.equal(
    remoteSeatAnchor?.name,
    "metaverse_environment_seat_anchor/metaverse-hub-skiff-v1/driver-seat"
  );
  assert.ok(remoteSeatSocket);
  assert.ok(
    remoteSeatAnchor
      .getWorldPosition(new Vector3())
      .distanceTo(remoteSeatSocket.getWorldPosition(new Vector3())) < 0.001
  );

  sceneRuntime.setDynamicEnvironmentPose("metaverse-hub-skiff-v1", {
    position: { x: 0.8, y: 0.12, z: 23.5 },
    yawRadians: 0.55
  });
  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0.016,
    null,
    [remoteCharacterPresentation],
    null
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  assert.ok(
    remoteSeatAnchor
      .getWorldPosition(new Vector3())
      .distanceTo(remoteSeatSocket.getWorldPosition(new Vector3())) < 0.001
  );
});
