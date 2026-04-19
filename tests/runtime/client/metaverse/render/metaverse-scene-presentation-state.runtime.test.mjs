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

test("MetaverseScenePresentationState resets presentation state and syncs a null-character scene without inventing presentation owners", async () => {
  const [
    { Scene },
    { MetaverseScenePresentationState },
    { createMetaverseSceneMountedPresentationSnapshot }
  ] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load("/src/metaverse/render/metaverse-scene-presentation-state.ts"),
      clientLoader.load(
        "/src/metaverse/render/mounts/metaverse-scene-mounted-presentation-snapshot.ts"
      )
    ]);
  const calls = [];
  const cameraSnapshot = Object.freeze({
    lookDirection: Object.freeze({ x: 0, y: 0, z: -1 }),
    pitchRadians: 0.1,
    position: Object.freeze({ x: 1, y: 2, z: 3 }),
    yawRadians: 0.2
  });
  const mountedEnvironment = Object.freeze({
    environmentAssetId: "metaverse-hub-skiff-v1",
    entryId: null,
    occupancyKind: "seat",
    occupantRole: "driver",
    seatId: "driver_seat"
  });
  const sceneInteractionSnapshot = Object.freeze({
    focusedMountable: null
  });
  const mountedPresentationSnapshot =
    createMetaverseSceneMountedPresentationSnapshot(mountedEnvironment);
  const presentationState = new MetaverseScenePresentationState({
    cameraPresentationState: {
      syncPresentedCamera(snapshot, nowMs) {
        calls.push(["sync-camera-presentation", snapshot, nowMs]);
      },
      syncSceneInteractionSnapshot(snapshot, nextMountedEnvironment) {
        calls.push(["sync-scene-interaction", snapshot, nextMountedEnvironment]);
        return sceneInteractionSnapshot;
      }
    },
    lifecycleState: {
      async boot() {},
      async bootInteractivePresentation() {},
      async bootScenicEnvironment() {},
      async prewarm() {},
      resetPresentation() {
        calls.push("reset-presentation-lifecycle");
      }
    },
    localCharacterPresentationState: {
      syncPresentation(
        snapshot,
        deltaSeconds,
        nextCharacterPresentation,
        nextMountedEnvironment
      ) {
        calls.push([
          "sync-local-character-presentation",
          snapshot,
          deltaSeconds,
          nextCharacterPresentation,
          nextMountedEnvironment
        ]);
        return snapshot;
      }
    },
    portalPresentationState: {
      syncPresentation(focusedPortal, nowMs) {
        calls.push(["sync-portal-presentation", focusedPortal, nowMs]);
      }
    },
    remoteCharacterPresentationState: {
      syncPresentation(remoteCharacterPresentations, deltaSeconds) {
        calls.push([
          "sync-remote-character-presentation",
          remoteCharacterPresentations,
          deltaSeconds
        ]);
      }
    },
    scene: new Scene()
  });

  const returnedInteractionSnapshot = presentationState.syncPresentation(
    cameraSnapshot,
    null,
    123,
    1 / 60,
    null,
    [],
    mountedEnvironment
  );

  assert.equal(returnedInteractionSnapshot, sceneInteractionSnapshot);
  assert.deepEqual(calls, [
    [
      "sync-local-character-presentation",
      cameraSnapshot,
      1 / 60,
      null,
      mountedPresentationSnapshot
    ],
    ["sync-camera-presentation", cameraSnapshot, 123],
    ["sync-remote-character-presentation", [], 1 / 60],
    ["sync-portal-presentation", null, 123],
    ["sync-scene-interaction", cameraSnapshot, mountedPresentationSnapshot]
  ]);
  presentationState.resetPresentation();

  assert.deepEqual(calls.slice(5), ["reset-presentation-lifecycle"]);
});

test("MetaverseScenePresentationState delegates lifecycle entrypoints to the presentation lifecycle owner", async () => {
  const [{ Scene }, { MetaverseScenePresentationState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/metaverse-scene-presentation-state.ts")
  ]);
  const calls = [];
  const presentationState = new MetaverseScenePresentationState({
    cameraPresentationState: {
      syncPresentedCamera() {},
      syncSceneInteractionSnapshot() {
        return Object.freeze({ focusedMountable: null });
      }
    },
    lifecycleState: {
      async boot() {
        calls.push("boot");
      },
      async bootInteractivePresentation() {
        calls.push("boot-interactive-presentation");
      },
      async bootScenicEnvironment() {
        calls.push("boot-scenic-environment");
      },
      async prewarm(renderer) {
        calls.push(["prewarm", renderer]);
      },
      resetPresentation() {
        calls.push("reset-presentation");
      }
    },
    localCharacterPresentationState: {
      syncPresentation(snapshot) {
        return snapshot;
      }
    },
    portalPresentationState: {
      syncPresentation() {}
    },
    remoteCharacterPresentationState: {
      syncPresentation() {}
    }
  });
  const renderer = Object.freeze({
    setPixelRatio() {},
    setSize() {}
  });

  await presentationState.bootScenicEnvironment();
  await presentationState.bootInteractivePresentation();
  await presentationState.boot();
  presentationState.resetPresentation();
  await presentationState.prewarm(renderer);

  assert.deepEqual(calls, [
    "boot-scenic-environment",
    "boot-interactive-presentation",
    "boot",
    "reset-presentation",
    ["prewarm", renderer]
  ]);
});
