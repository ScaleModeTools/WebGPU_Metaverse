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

test("MetaverseScenePresentationLifecycleState boots scenic state once before interactive presentation", async () => {
  const [{ PerspectiveCamera, Scene }, { MetaverseScenePresentationLifecycleState }] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load(
        "/src/metaverse/render/metaverse-scene-presentation-lifecycle-state.ts"
      )
    ]);
  const calls = [];
  const cameraSnapshot = Object.freeze({
    lookDirection: Object.freeze({ x: 0, y: 0, z: -1 }),
    pitchRadians: 0,
    position: Object.freeze({ x: 0, y: 1.62, z: 0 }),
    yawRadians: 0
  });
  const lifecycleState = new MetaverseScenePresentationLifecycleState({
    camera: new PerspectiveCamera(),
    cameraPresentationState: {
      syncSceneInteractionSnapshot(snapshot, mountedEnvironment) {
        calls.push(["scene-interaction-sync", snapshot, mountedEnvironment]);
        return Object.freeze({ mountedEnvironmentAssetId: null });
      }
    },
    createCurrentCameraSnapshot: () => cameraSnapshot,
    environmentProofState: {
      async boot() {
        calls.push("environment-boot");
      }
    },
    interactivePresentationState: {
      async boot() {
        calls.push("interactive-boot");
      }
    },
    localCharacterPresentationState: {
      resetPresentation() {}
    },
    mountInteractionState: {
      resetPresentation() {}
    },
    portalPresentationState: {
      resetPresentation() {}
    },
    remoteCharacterPresentationState: {
      resetPresentation() {}
    },
    scene: new Scene()
  });

  await lifecycleState.boot();

  assert.deepEqual(calls, [
    "environment-boot",
    ["scene-interaction-sync", cameraSnapshot, null],
    "interactive-boot"
  ]);
});

test("MetaverseScenePresentationLifecycleState resets presentation owners and prewarms the current scene only when compileAsync exists", async () => {
  const [{ PerspectiveCamera, Scene }, { MetaverseScenePresentationLifecycleState }] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load(
        "/src/metaverse/render/metaverse-scene-presentation-lifecycle-state.ts"
      )
    ]);
  const camera = new PerspectiveCamera();
  const scene = new Scene();
  const calls = [];
  const lifecycleState = new MetaverseScenePresentationLifecycleState({
    camera,
    cameraPresentationState: {
      syncSceneInteractionSnapshot() {
        return Object.freeze({ mountedEnvironmentAssetId: null });
      }
    },
    createCurrentCameraSnapshot: () =>
      Object.freeze({
        lookDirection: Object.freeze({ x: 0, y: 0, z: -1 }),
        pitchRadians: 0,
        position: Object.freeze({ x: 0, y: 1.62, z: 0 }),
        yawRadians: 0
      }),
    environmentProofState: {
      async boot() {},
      clearDynamicEnvironmentPoseOverrides() {
        calls.push("clear-environment-overrides");
      }
    },
    interactivePresentationState: {
      async boot() {}
    },
    localCharacterPresentationState: {
      resetPresentation() {
        calls.push("reset-local-character-presentation");
      }
    },
    mountInteractionState: {
      resetPresentation() {
        calls.push("reset-mount-presentation");
      }
    },
    portalPresentationState: {
      resetPresentation() {
        calls.push("reset-portal-presentation");
      }
    },
    remoteCharacterPresentationState: {
      resetPresentation() {
        calls.push("reset-remote-character-presentation");
      }
    },
    scene
  });

  lifecycleState.resetPresentation();

  assert.deepEqual(calls, [
    "reset-mount-presentation",
    "reset-local-character-presentation",
    "reset-portal-presentation",
    "clear-environment-overrides",
    "reset-remote-character-presentation"
  ]);

  const compileCalls = [];
  await lifecycleState.prewarm({
    async compileAsync(nextScene, nextCamera) {
      compileCalls.push([nextScene, nextCamera]);
    },
    setPixelRatio() {},
    setSize() {}
  });
  await lifecycleState.prewarm({
    setPixelRatio() {},
    setSize() {}
  });

  assert.deepEqual(compileCalls, [[scene, camera]]);
});
