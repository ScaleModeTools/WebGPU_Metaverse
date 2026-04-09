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

test("WebGpuMetaverseCapabilityProbe reports missing navigator.gpu as unsupported", async () => {
  const { WebGpuMetaverseCapabilityProbe } = await clientLoader.load(
    "/src/metaverse/classes/webgpu-metaverse-capability-probe.ts"
  );
  const probe = new WebGpuMetaverseCapabilityProbe();

  const snapshot = await probe.probe({});

  assert.deepEqual(snapshot, {
    status: "unsupported",
    reason: "navigator-gpu-missing"
  });
});

test("WebGpuMetaverseCapabilityProbe reports ready adapters as supported", async () => {
  const { WebGpuMetaverseCapabilityProbe } = await clientLoader.load(
    "/src/metaverse/classes/webgpu-metaverse-capability-probe.ts"
  );
  const probe = new WebGpuMetaverseCapabilityProbe();
  let deviceRequestCount = 0;

  const snapshot = await probe.probe({
    gpu: {
      async requestAdapter() {
        return {
          async requestDevice() {
            deviceRequestCount += 1;
            return {};
          }
        };
      }
    }
  });

  assert.deepEqual(snapshot, {
    status: "supported",
    reason: "adapter-ready"
  });
  assert.equal(deviceRequestCount, 0);
});

test("WebGpuMetaverseCapabilityProbe reports probe failures cleanly", async () => {
  const { WebGpuMetaverseCapabilityProbe } = await clientLoader.load(
    "/src/metaverse/classes/webgpu-metaverse-capability-probe.ts"
  );
  const probe = new WebGpuMetaverseCapabilityProbe();

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

test("WebGpuMetaverseCapabilityProbe reports missing adapters cleanly", async () => {
  const { WebGpuMetaverseCapabilityProbe } = await clientLoader.load(
    "/src/metaverse/classes/webgpu-metaverse-capability-probe.ts"
  );
  const probe = new WebGpuMetaverseCapabilityProbe();

  const snapshot = await probe.probe({
    gpu: {
      async requestAdapter() {
        return null;
      }
    }
  });

  assert.deepEqual(snapshot, {
    status: "unsupported",
    reason: "adapter-unavailable"
  });
});
