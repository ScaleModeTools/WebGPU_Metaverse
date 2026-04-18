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

test("MetaverseSceneCameraPresentationState syncs environment, camera, and interaction snapshots from the presented view", async () => {
  const [{ PerspectiveCamera }, { MetaverseSceneCameraPresentationState }] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load(
        "/src/metaverse/render/camera/metaverse-scene-camera-presentation-state.ts"
      )
    ]);
  const camera = new PerspectiveCamera();
  const calls = [];
  const cameraSnapshot = Object.freeze({
    lookDirection: Object.freeze({ x: 0, y: 0.25, z: -0.75 }),
    pitchRadians: 0.25,
    position: Object.freeze({ x: 4, y: 5, z: 6 }),
    yawRadians: 0.1
  });
  const mountedEnvironment = Object.freeze({
    environmentAssetId: "metaverse-hub-skiff-v1",
    entryId: null,
    occupancyKind: "seat",
    occupantRole: "driver",
    seatId: "driver_seat"
  });
  const interactionSnapshot = Object.freeze({
    mountedEnvironmentAssetId: "metaverse-hub-skiff-v1"
  });
  const cameraPresentationState = new MetaverseSceneCameraPresentationState({
    camera,
    environmentProofState: {
      syncPresentation(snapshot, nowMs) {
        calls.push(["sync-environment", snapshot, nowMs]);
      }
    },
    mountInteractionState: {
      syncSceneInteractionSnapshot(snapshot, nextMountedEnvironment) {
        calls.push([
          "sync-scene-interaction",
          snapshot,
          nextMountedEnvironment
        ]);
        return interactionSnapshot;
      }
    }
  });

  cameraPresentationState.syncPresentedCamera(cameraSnapshot, 456);
  const returnedInteractionSnapshot =
    cameraPresentationState.syncSceneInteractionSnapshot(
      cameraSnapshot,
      mountedEnvironment
    );

  assert.equal(returnedInteractionSnapshot, interactionSnapshot);
  assert.deepEqual(calls, [
    ["sync-environment", cameraSnapshot, 456],
    ["sync-scene-interaction", cameraSnapshot, mountedEnvironment]
  ]);
  assert.ok(Math.abs(camera.position.x - cameraSnapshot.position.x) < 0.000001);
  assert.ok(Math.abs(camera.position.y - cameraSnapshot.position.y) < 0.000001);
  assert.ok(Math.abs(camera.position.z - cameraSnapshot.position.z) < 0.000001);
});
