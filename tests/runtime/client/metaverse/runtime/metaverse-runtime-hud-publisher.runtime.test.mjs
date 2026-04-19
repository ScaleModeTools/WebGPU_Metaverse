import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createFakeHudPublisherDependencies,
  createMountedInteractionSnapshot,
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

test("MetaverseRuntimeHudPublisher resolves mounted HUD access copy from one mounted interaction snapshot", async () => {
  const { MetaverseRuntimeHudPublisher } = await clientLoader.load(
    "/src/metaverse/hud/metaverse-runtime-hud-publisher.ts"
  );
  const dependencies = createFakeHudPublisherDependencies(() => 0);
  const publisher = new MetaverseRuntimeHudPublisher(dependencies);

  publisher.publishSnapshot(
    createPublishInput({
      mountedInteraction: createMountedInteractionSnapshot({
        focusedMountable: Object.freeze({
          boardingEntries: Object.freeze([
            Object.freeze({
              entryId: "deck-entry",
              label: "Board deck"
            })
          ]),
          directSeatTargets: Object.freeze([
            Object.freeze({
              label: "Take helm",
              seatId: "driver-seat",
              seatRole: "driver"
            })
          ]),
          distanceFromCamera: 1.25,
          environmentAssetId: "harbor-skiff",
          label: "Harbor Skiff"
        })
      })
    }),
    true,
    0
  );

  assert.equal(publisher.hudSnapshot.mountedInteractionHud.visible, true);
  assert.equal(
    publisher.hudSnapshot.mountedInteractionHud.heading,
    "Harbor Skiff is in range."
  );
  assert.equal(
    publisher.hudSnapshot.mountedInteractionHud.detail,
    "Board the deck first or take a direct seat now."
  );
  assert.equal(
    publisher.hudSnapshot.mountedInteractionHud.boardingEntries.length,
    1
  );
  assert.equal(
    publisher.hudSnapshot.mountedInteractionHud.seatTargetButtonVariant,
    "outline"
  );
  assert.equal(
    publisher.hudSnapshot.mountedInteractionHud.seatTargets.length,
    1
  );
});
