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

test("metaverse world authoring document round-trips the shipped shared surface and water data", async () => {
  const {
    createMetaverseWorldSurfaceAuthoringDocument,
    metaverseWorldAuthoringSourcePath,
    parseMetaverseWorldSurfaceAuthoringDocument,
    serializeMetaverseWorldSurfaceAuthoringDataModule,
    summarizeMetaverseWorldSurfaceAuthoring
  } = await clientLoader.load("/src/metaverse/states/metaverse-world-authoring.ts");

  const documentText = createMetaverseWorldSurfaceAuthoringDocument();
  const document = parseMetaverseWorldSurfaceAuthoringDocument(documentText);
  const summary = summarizeMetaverseWorldSurfaceAuthoring(document);
  const generatedSource =
    serializeMetaverseWorldSurfaceAuthoringDataModule(document);

  assert.equal(metaverseWorldAuthoringSourcePath.includes("packages/shared"), true);
  assert.equal(summary.assetCount, 6);
  assert.equal(summary.placementCount, 12);
  assert.equal(summary.surfaceColliderCount, 20);
  assert.equal(summary.waterRegionCount, 1);
  assert.match(
    generatedSource,
    /export const metaverseWorldSurfaceAssets = Object\.freeze\(\[/
  );
  assert.match(
    generatedSource,
    /export const metaverseWorldWaterRegions = Object\.freeze\(\[/
  );
  assert.match(
    generatedSource,
    /export const metaverseHubDockEnvironmentAssetId = "metaverse-hub-dock-v1";/
  );
  assert.match(
    generatedSource,
    /const metaverseHubPushableCrateSurfaceColliders = Object\.freeze\(\s*\[\s*\]\s*\) as readonly MetaverseWorldSurfaceColliderAuthoring\[];/
  );
});

test("metaverse world authoring document rejects unsupported environment asset ids", async () => {
  const {
    createMetaverseWorldSurfaceAuthoringDocument,
    parseMetaverseWorldSurfaceAuthoringDocument
  } = await clientLoader.load("/src/metaverse/states/metaverse-world-authoring.ts");

  const parsedDocument = JSON.parse(createMetaverseWorldSurfaceAuthoringDocument());

  parsedDocument.surfaceAssets[0].environmentAssetId = "custom-world-asset-v1";

  assert.throws(
    () =>
      parseMetaverseWorldSurfaceAuthoringDocument(
        JSON.stringify(parsedDocument, null, 2)
      ),
    /must match a shipped metaverse asset id/
  );
});
