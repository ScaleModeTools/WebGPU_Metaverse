import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createFakeHudPublisherDependencies,
  createPublishInput
} from "./fixtures/metaverse-runtime-hud-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRuntimeHudPublisher derives boot phases and throttles unforced UI updates", async () => {
  const { MetaverseRuntimeHudPublisher } = await clientLoader.load(
    "/src/metaverse/hud/metaverse-runtime-hud-publisher.ts"
  );
  let nowMs = 0;
  const dependencies = createFakeHudPublisherDependencies(() => nowMs);
  const publisher = new MetaverseRuntimeHudPublisher(dependencies);
  let updateCount = 0;

  publisher.subscribeUiUpdates(() => {
    updateCount += 1;
  });

  publisher.publishSnapshot(
    createPublishInput({
      bootRendererInitialized: false,
      bootScenePrewarmed: false,
      lifecycle: "booting"
    }),
    true,
    nowMs
  );

  assert.equal(updateCount, 1);
  assert.equal(publisher.hudSnapshot.boot.phase, "renderer-init");

  dependencies.presenceRuntime.isJoined = true;
  nowMs = 50;
  publisher.publishSnapshot(
    createPublishInput({
      lifecycle: "booting"
    }),
    false,
    nowMs
  );

  assert.equal(updateCount, 1);
  assert.equal(publisher.hudSnapshot.boot.phase, "world-connecting");

  dependencies.remoteWorldRuntime.isConnected = true;
  nowMs = 250;
  publisher.publishSnapshot(
    createPublishInput({
      lifecycle: "booting"
    }),
    false,
    nowMs
  );

  assert.equal(updateCount, 2);
  assert.equal(publisher.hudSnapshot.boot.phase, "ready");
});
