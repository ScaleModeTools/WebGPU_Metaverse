import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimePlayerSnapshot,
  createUsername
} from "@webgpu-metaverse/shared";

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

test("MetaverseRuntimeHudPublisher keeps friendly radar contacts live while enemy contacts refresh on the 5s ping cadence", async () => {
  const { MetaverseRuntimeHudPublisher } = await clientLoader.load(
    "/src/metaverse/hud/metaverse-runtime-hud-publisher.ts"
  );
  const localPlayerId = createMetaversePlayerId("radar-local-player");
  const friendlyPlayerId = createMetaversePlayerId("radar-friendly-player");
  const enemyPlayerId = createMetaversePlayerId("radar-enemy-player");
  const localUsername = createUsername("Radar Local");
  const friendlyUsername = createUsername("Radar Friendly");
  const enemyUsername = createUsername("Radar Enemy");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(friendlyPlayerId, null);
  assert.notEqual(enemyPlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(friendlyUsername, null);
  assert.notEqual(enemyUsername, null);

  let nowMs = 0;
  const dependencies = createFakeHudPublisherDependencies(() => nowMs);
  dependencies.remoteWorldRuntime.isConnected = true;
  dependencies.presenceRuntime.isJoined = true;
  dependencies.presenceRuntime.localTeamId = "blue";

  const localSnapshot = Object.freeze({
    ...createMetaverseRealtimePlayerSnapshot({
      characterId: "mesh2motion-humanoid-v1",
      groundedBody: {
        linearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        position: {
          x: 0,
          y: 0,
          z: 0
        },
        yawRadians: 0
      },
      look: {
        pitchRadians: 0,
        yawRadians: 0
      },
      playerId: localPlayerId,
      teamId: "blue",
      username: localUsername
    }),
    jumpDebug: Object.freeze({
      pendingActionBufferAgeMs: null,
      pendingActionSequence: 0,
      resolvedActionSequence: 0,
      resolvedActionState: "none"
    }),
    lastProcessedLookSequence: 0,
    lastProcessedTraversalSequence: 0,
    lastProcessedWeaponSequence: 0
  });
  const friendlySnapshotNear = createMetaverseRealtimePlayerSnapshot({
    characterId: "mesh2motion-humanoid-v1",
    groundedBody: {
      linearVelocity: {
        x: 0,
        y: 0,
        z: 0
      },
      position: {
        x: 10,
        y: 0,
        z: 0
      },
      yawRadians: 0
    },
    look: {
      pitchRadians: 0,
      yawRadians: 0
    },
    playerId: friendlyPlayerId,
    teamId: "blue",
    username: friendlyUsername
  });
  const friendlySnapshotFar = createMetaverseRealtimePlayerSnapshot({
    characterId: "mesh2motion-humanoid-v1",
    groundedBody: {
      linearVelocity: {
        x: 0,
        y: 0,
        z: 0
      },
      position: {
        x: 20,
        y: 0,
        z: 0
      },
      yawRadians: 0
    },
    look: {
      pitchRadians: 0,
      yawRadians: 0
    },
    playerId: friendlyPlayerId,
    teamId: "blue",
    username: friendlyUsername
  });
  const enemySnapshotNear = createMetaverseRealtimePlayerSnapshot({
    characterId: "mesh2motion-humanoid-v1",
    groundedBody: {
      linearVelocity: {
        x: 0,
        y: 0,
        z: 0
      },
      position: {
        x: -10,
        y: 0,
        z: 0
      },
      yawRadians: 0
    },
    look: {
      pitchRadians: 0,
      yawRadians: 0
    },
    playerId: enemyPlayerId,
    teamId: "red",
    username: enemyUsername
  });
  const enemySnapshotFar = createMetaverseRealtimePlayerSnapshot({
    characterId: "mesh2motion-humanoid-v1",
    groundedBody: {
      linearVelocity: {
        x: 0,
        y: 0,
        z: 0
      },
      position: {
        x: -30,
        y: 0,
        z: 0
      },
      yawRadians: 0
    },
    look: {
      pitchRadians: 0,
      yawRadians: 0
    },
    playerId: enemyPlayerId,
    teamId: "red",
    username: enemyUsername
  });
  let remoteSnapshots = Object.freeze([friendlySnapshotNear, enemySnapshotNear]);

  dependencies.remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot =
    () => localSnapshot;
  dependencies.remoteWorldRuntime.readFreshAuthoritativeRemotePlayerSnapshots =
    () => remoteSnapshots;

  const publisher = new MetaverseRuntimeHudPublisher(dependencies);

  publisher.publishSnapshot(createPublishInput(), true, nowMs);
  const initialFriendlyX = publisher.hudSnapshot.radar.friendlyContacts[0]?.radarX;
  const initialEnemyX = publisher.hudSnapshot.radar.enemyContacts[0]?.radarX;

  remoteSnapshots = Object.freeze([friendlySnapshotFar, enemySnapshotFar]);
  nowMs = 3_000;
  publisher.publishSnapshot(createPublishInput(), true, nowMs);

  assert.equal(publisher.hudSnapshot.radar.available, true);
  assert.ok((publisher.hudSnapshot.radar.friendlyContacts[0]?.radarX ?? 0) > (initialFriendlyX ?? 0));
  assert.equal(publisher.hudSnapshot.radar.enemyContacts[0]?.radarX, initialEnemyX);

  nowMs = 6_000;
  publisher.publishSnapshot(createPublishInput(), true, nowMs);

  assert.ok(
    (publisher.hudSnapshot.radar.enemyContacts[0]?.radarX ?? 0) <
      (initialEnemyX ?? 0)
  );
  assert.equal(publisher.hudSnapshot.radar.enemyPingAgeMs, 0);
});
