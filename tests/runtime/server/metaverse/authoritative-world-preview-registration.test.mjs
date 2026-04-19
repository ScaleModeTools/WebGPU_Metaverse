import assert from "node:assert/strict";
import test from "node:test";

import { stagingGroundMapBundle } from "@webgpu-metaverse/shared/metaverse/world";

import { MetaverseWorldPreviewHttpAdapter } from "../../../../server/dist/metaverse/adapters/metaverse-world-preview-http-adapter.js";
import { MetaverseAuthoritativeWorldRuntimeHost } from "../../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime-host.js";
import { createMetaverseAuthoritativeWorldBundleInputs } from "../../../../server/dist/metaverse/world/map-bundles/metaverse-authoritative-world-bundle-inputs.js";
import {
  loadAuthoritativeMetaverseMapBundle,
  registerAuthoritativeMetaverseMapBundlePreview
} from "../../../../server/dist/metaverse/world/map-bundles/load-authoritative-metaverse-map-bundle.js";

function createPreviewBundle(mapId) {
  return Object.freeze({
    ...stagingGroundMapBundle,
    gameplayProfileId: "shell-arcade-gameplay",
    label: `Preview ${mapId}`,
    mapId,
    playerSpawnNodes: Object.freeze(
      stagingGroundMapBundle.playerSpawnNodes.map((spawnNode, spawnIndex) =>
        spawnIndex === 0
          ? Object.freeze({
              ...spawnNode,
              position: Object.freeze({
                ...spawnNode.position,
                x: spawnNode.position.x + 18
              })
            })
          : spawnNode
      )
    ),
    waterRegions: Object.freeze(
      stagingGroundMapBundle.waterRegions.map((waterRegion, waterRegionIndex) =>
        waterRegionIndex === 0
          ? Object.freeze({
              ...waterRegion,
              center: Object.freeze({
                ...waterRegion.center,
                z: waterRegion.center.z + 12
              })
            })
          : waterRegion
      )
    )
  });
}

function createResponseCapture() {
  let body = "";
  let statusCode = null;

  return {
    end(chunk = "") {
      body = String(chunk);
    },
    get json() {
      return body.length === 0 ? null : JSON.parse(body);
    },
    get statusCode() {
      return statusCode;
    },
    setHeader() {},
    writeHead(nextStatusCode) {
      statusCode = nextStatusCode;
    }
  };
}

function createJsonRequest(payload) {
  return {
    method: "POST",
    on(eventName, listener) {
      if (eventName === "data") {
        listener(JSON.stringify(payload));
      }

      if (eventName === "end") {
        listener();
      }
    }
  };
}

test("authoritative preview registration derives spawn and water inputs from the registered bundle instead of the shipped staging-ground defaults", () => {
  const previewBundle = createPreviewBundle("server-preview-registration-test");
  const previewEntry = registerAuthoritativeMetaverseMapBundlePreview(
    previewBundle,
    "staging-ground"
  );
  const loadedPreviewBundle = loadAuthoritativeMetaverseMapBundle(
    "server-preview-registration-test"
  );
  const previewInputs = createMetaverseAuthoritativeWorldBundleInputs(
    "server-preview-registration-test"
  );

  assert.equal(previewEntry.bundleId, "server-preview-registration-test");
  assert.equal(previewEntry.sourceBundleId, "staging-ground");
  assert.equal(loadedPreviewBundle.bundle.label, "Preview server-preview-registration-test");
  assert.equal(previewInputs.gameplayProfile.id, "shell-arcade-gameplay");
  assert.deepEqual(
    previewInputs.defaultSpawn.position,
    previewBundle.playerSpawnNodes[0].position
  );
  assert.equal(
    previewInputs.waterRegionSnapshots[0]?.translation.z,
    previewBundle.waterRegions[0]?.center.z
  );
});

test("MetaverseWorldPreviewHttpAdapter registers and activates preview bundles on the authoritative host", async () => {
  const host = new MetaverseAuthoritativeWorldRuntimeHost();
  const adapter = new MetaverseWorldPreviewHttpAdapter(host);
  const previewBundle = createPreviewBundle("server-preview-http-adapter-test");
  const response = createResponseCapture();
  const handled = await adapter.handleRequest(
    createJsonRequest({
      bundle: previewBundle,
      sourceBundleId: "staging-ground"
    }),
    response,
    new URL("http://127.0.0.1:3210/metaverse/world/preview-bundles")
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.status, "registered");
  assert.equal(response.json.bundleId, "server-preview-http-adapter-test");
  assert.equal(response.json.sourceBundleId, "staging-ground");
  assert.equal(host.activeBundleId, "server-preview-http-adapter-test");
  assert.equal(
    loadAuthoritativeMetaverseMapBundle("server-preview-http-adapter-test").bundle
      .mapId,
    "server-preview-http-adapter-test"
  );
});
