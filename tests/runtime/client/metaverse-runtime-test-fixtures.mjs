import assert from "node:assert/strict";

import { createFakePhysicsRuntime } from "./fake-rapier-runtime.mjs";
import {
  FakeMetaverseRenderer,
  disabledRuntimeCameraPhaseConfig
} from "./metaverse/runtime/fixtures/fake-renderer.mjs";
import { FakeMetaversePresenceClient } from "./metaverse/runtime/fixtures/fake-presence-client.mjs";
import {
  FakeMetaverseWorldClient,
  createRealtimeWorldSnapshot,
  shippedWaterBayOpenWaterSpawn,
  shippedWaterBaySkiffPlacement,
  shippedWaterBaySkiffYawRadians
} from "./metaverse/runtime/fixtures/fake-world-client.mjs";
import {
  createOpenWaterSpawnRuntimeConfig,
  createSkiffBoardingRuntimeConfig
} from "./metaverse/runtime/fixtures/runtime-config-fixtures.mjs";
import {
  createFakeRuntimeCanvas,
  createInteractiveWindowHarness
} from "./metaverse/runtime/fixtures/runtime-window-harness.mjs";

export {
  FakeMetaversePresenceClient,
  FakeMetaverseRenderer,
  FakeMetaverseWorldClient,
  createInteractiveWindowHarness,
  createOpenWaterSpawnRuntimeConfig,
  createRealtimeWorldSnapshot,
  createSkiffBoardingRuntimeConfig,
  disabledRuntimeCameraPhaseConfig,
  shippedWaterBayOpenWaterSpawn,
  shippedWaterBaySkiffPlacement,
  shippedWaterBaySkiffYawRadians
};

export async function createStartedWebGpuMetaverseRuntimeHarness({
  authoritativePlayerMovementEnabled,
  buildRuntimeConfig,
  clientModuleLoader,
  createMetaversePresenceClient,
  createMetaverseWorldClient,
  localPlayerIdentity,
  proofSliceFactory,
  readNowMs,
  readWallClockMs
} = {}) {
  assert.notEqual(clientModuleLoader, null);
  const [
    { WebGpuMetaverseRuntime },
    { metaverseRuntimeConfig },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientModuleLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientModuleLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientModuleLoader.load("/src/physics/index.ts")
  ]);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowHarness = createInteractiveWindowHarness();
  const proofSlice =
    proofSliceFactory === undefined ? null : await proofSliceFactory();

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  const restoreGlobals = () => {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  };

  try {
    const runtime = new WebGpuMetaverseRuntime(
      buildRuntimeConfig?.(metaverseRuntimeConfig),
      {
        ...(authoritativePlayerMovementEnabled === undefined
          ? {}
          : {
              authoritativePlayerMovementEnabled
            }),
        runtimeCameraPhaseConfig: disabledRuntimeCameraPhaseConfig,
        cancelAnimationFrame:
          globalThis.window.cancelAnimationFrame.bind(globalThis.window),
        ...(proofSlice ?? {}),
        ...(createMetaversePresenceClient === undefined
          ? {}
          : {
              createMetaversePresenceClient
            }),
        ...(createMetaverseWorldClient === undefined
          ? {}
          : {
              createMetaverseWorldClient
            }),
        createRenderer: () => renderer,
        ...(localPlayerIdentity === undefined
          ? {}
          : {
              localPlayerIdentity
            }),
        physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
        ...(readNowMs === undefined
          ? {}
          : {
              readNowMs
            }),
        ...(readWallClockMs === undefined
          ? {}
          : {
              readWallClockMs
            }),
        requestAnimationFrame:
          globalThis.window.requestAnimationFrame.bind(globalThis.window)
      }
    );

    await runtime.start(createFakeRuntimeCanvas(), {
      gpu: {}
    });

    let disposed = false;

    return {
      dispose() {
        if (disposed) {
          return;
        }

        disposed = true;
        runtime.dispose();
        restoreGlobals();
      },
      metaverseRuntimeConfig,
      renderer,
      runtime,
      windowHarness
    };
  } catch (error) {
    restoreGlobals();
    throw error;
  }
}
