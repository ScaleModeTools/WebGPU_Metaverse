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

test("WebGpuGameplayCapabilityProbe reports missing navigator.gpu as unsupported", async () => {
  const { WebGpuGameplayCapabilityProbe } = await clientLoader.load(
    "/src/game/classes/webgpu-gameplay-capability-probe.ts"
  );
  const probe = new WebGpuGameplayCapabilityProbe();

  const snapshot = await probe.probe({});

  assert.deepEqual(snapshot, {
    status: "unsupported",
    reason: "navigator-gpu-missing"
  });
});

test("WebGpuGameplayCapabilityProbe reports ready adapters as supported", async () => {
  const { WebGpuGameplayCapabilityProbe } = await clientLoader.load(
    "/src/game/classes/webgpu-gameplay-capability-probe.ts"
  );
  const probe = new WebGpuGameplayCapabilityProbe();

  const snapshot = await probe.probe({
    gpu: {
      async requestAdapter() {
        return {};
      }
    }
  });

  assert.deepEqual(snapshot, {
    status: "supported",
    reason: "adapter-ready"
  });
});

test("WebGpuGameplayCapabilityProbe reports probe failures cleanly", async () => {
  const { WebGpuGameplayCapabilityProbe } = await clientLoader.load(
    "/src/game/classes/webgpu-gameplay-capability-probe.ts"
  );
  const probe = new WebGpuGameplayCapabilityProbe();

  const snapshot = await probe.probe({
    gpu: {
      async requestAdapter() {
        throw new Error("boom");
      }
    }
  });

  assert.deepEqual(snapshot, {
    status: "unsupported",
    reason: "probe-failed"
  });
});
