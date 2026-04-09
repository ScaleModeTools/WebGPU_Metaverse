import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("WebGpuMetaverseRuntime starts from an idle snapshot and rejects missing navigator.gpu explicitly", async () => {
  const { WebGpuMetaverseRuntime } = await clientLoader.load(
    "/src/metaverse/classes/webgpu-metaverse-runtime.ts"
  );
  const runtime = new WebGpuMetaverseRuntime();

  assert.equal(runtime.hudSnapshot.lifecycle, "idle");
  assert.equal(runtime.hudSnapshot.focusedPortal, null);
  assert.equal(runtime.hudSnapshot.controlMode, "keyboard");

  await assert.rejects(
    () => runtime.start({}, {}),
    /WebGPU is unavailable for the metaverse runtime/
  );
  assert.equal(runtime.hudSnapshot.lifecycle, "failed");
});

test("resolveMetaverseMouseLookAxes keeps the center dead zone quiet and turns toward edges", async () => {
  const { resolveMetaverseMouseLookAxes } = await clientLoader.load(
    "/src/metaverse/states/metaverse-flight.ts"
  );

  assert.deepEqual(
    resolveMetaverseMouseLookAxes(0.5, 0.5, 1280, 720, {
      deadZoneViewportFraction: 0.2,
      responseExponent: 1.55
    }),
    {
      pitchAxis: 0,
      yawAxis: 0
    }
  );

  const rightTurnAxes = resolveMetaverseMouseLookAxes(0.96, 0.5, 1280, 720, {
    deadZoneViewportFraction: 0.2,
    responseExponent: 1.55
  });
  const downwardTiltAxes = resolveMetaverseMouseLookAxes(0.5, 0.96, 1280, 720, {
    deadZoneViewportFraction: 0.2,
    responseExponent: 1.55
  });

  assert.ok(rightTurnAxes.yawAxis > 0);
  assert.equal(rightTurnAxes.pitchAxis, 0);
  assert.ok(downwardTiltAxes.pitchAxis < 0);
  assert.equal(downwardTiltAxes.yawAxis, 0);
});
