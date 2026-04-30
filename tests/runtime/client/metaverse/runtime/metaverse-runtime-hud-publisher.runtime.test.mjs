import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseRealtimeWorldSnapshot,
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
  nowMs = 10;
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
  nowMs = 30;
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

test("MetaverseRuntimeHudPublisher keeps in-range radar contacts live from smoothed remote presentations", async () => {
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
  const enemySnapshotMid = createMetaverseRealtimePlayerSnapshot({
    characterId: "mesh2motion-humanoid-v1",
    groundedBody: {
      linearVelocity: {
        x: 0,
        y: 0,
        z: 0
      },
      position: {
        x: -20,
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
  let remotePresentations = Object.freeze([
    Object.freeze({
      aimCamera: null,
      characterId: friendlySnapshotNear.characterId,
      look: Object.freeze({
        pitchRadians: friendlySnapshotNear.look.pitchRadians,
        yawRadians: friendlySnapshotNear.look.yawRadians
      }),
      mountedOccupancy: friendlySnapshotNear.mountedOccupancy,
      playerId: friendlySnapshotNear.playerId,
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationPlaybackRateMultiplier: 1,
        animationVocabulary: "idle",
        position: friendlySnapshotNear.groundedBody.position,
        yawRadians: 0
      }),
      teamId: friendlySnapshotNear.teamId,
      username: friendlySnapshotNear.username,
      weaponState: friendlySnapshotNear.weaponState
    }),
    Object.freeze({
      aimCamera: null,
      characterId: enemySnapshotNear.characterId,
      look: Object.freeze({
        pitchRadians: enemySnapshotNear.look.pitchRadians,
        yawRadians: enemySnapshotNear.look.yawRadians
      }),
      mountedOccupancy: enemySnapshotNear.mountedOccupancy,
      playerId: enemySnapshotNear.playerId,
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationPlaybackRateMultiplier: 1,
        animationVocabulary: "idle",
        position: enemySnapshotNear.groundedBody.position,
        yawRadians: 0
      }),
      teamId: enemySnapshotNear.teamId,
      username: enemySnapshotNear.username,
      weaponState: enemySnapshotNear.weaponState
    })
  ]);

  dependencies.remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot =
    () => localSnapshot;
  dependencies.remoteWorldRuntime.remoteCharacterPresentations = remotePresentations;

  const publisher = new MetaverseRuntimeHudPublisher(dependencies);

  publisher.publishSnapshot(createPublishInput(), true, nowMs);
  const initialFriendlyX = publisher.hudSnapshot.radar.friendlyContacts[0]?.radarX;
  const initialEnemyX = publisher.hudSnapshot.radar.enemyContacts[0]?.radarX;
  assert.equal(publisher.hudSnapshot.radar.rangeMeters, 25);
  assert.equal(publisher.hudSnapshot.radar.friendlyContacts[0]?.clamped, false);
  assert.equal(publisher.hudSnapshot.radar.enemyContacts[0]?.clamped, false);

  remotePresentations = Object.freeze([
    Object.freeze({
      aimCamera: null,
      characterId: friendlySnapshotFar.characterId,
      look: Object.freeze({
        pitchRadians: friendlySnapshotFar.look.pitchRadians,
        yawRadians: friendlySnapshotFar.look.yawRadians
      }),
      mountedOccupancy: friendlySnapshotFar.mountedOccupancy,
      playerId: friendlySnapshotFar.playerId,
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationPlaybackRateMultiplier: 1,
        animationVocabulary: "idle",
        position: friendlySnapshotFar.groundedBody.position,
        yawRadians: 0
      }),
      teamId: friendlySnapshotFar.teamId,
      username: friendlySnapshotFar.username,
      weaponState: friendlySnapshotFar.weaponState
    }),
    Object.freeze({
      aimCamera: null,
      characterId: enemySnapshotMid.characterId,
      look: Object.freeze({
        pitchRadians: enemySnapshotMid.look.pitchRadians,
        yawRadians: enemySnapshotMid.look.yawRadians
      }),
      mountedOccupancy: enemySnapshotMid.mountedOccupancy,
      playerId: enemySnapshotMid.playerId,
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationPlaybackRateMultiplier: 1,
        animationVocabulary: "idle",
        position: enemySnapshotMid.groundedBody.position,
        yawRadians: 0
      }),
      teamId: enemySnapshotMid.teamId,
      username: enemySnapshotMid.username,
      weaponState: enemySnapshotMid.weaponState
    })
  ]);
  dependencies.remoteWorldRuntime.remoteCharacterPresentations = remotePresentations;
  nowMs = 3_000;
  publisher.publishSnapshot(createPublishInput(), true, nowMs);

  assert.equal(publisher.hudSnapshot.radar.available, true);
  assert.ok((publisher.hudSnapshot.radar.friendlyContacts[0]?.radarX ?? 0) > (initialFriendlyX ?? 0));
  assert.ok(
    (publisher.hudSnapshot.radar.enemyContacts[0]?.radarX ?? 0) <
      (initialEnemyX ?? 0)
  );
  assert.equal(publisher.hudSnapshot.radar.enemyContacts[0]?.clamped, false);

  remotePresentations = Object.freeze([
    Object.freeze({
      aimCamera: null,
      characterId: friendlySnapshotFar.characterId,
      look: Object.freeze({
        pitchRadians: friendlySnapshotFar.look.pitchRadians,
        yawRadians: friendlySnapshotFar.look.yawRadians
      }),
      mountedOccupancy: friendlySnapshotFar.mountedOccupancy,
      playerId: friendlySnapshotFar.playerId,
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationPlaybackRateMultiplier: 1,
        animationVocabulary: "idle",
        position: friendlySnapshotFar.groundedBody.position,
        yawRadians: 0
      }),
      teamId: friendlySnapshotFar.teamId,
      username: friendlySnapshotFar.username,
      weaponState: friendlySnapshotFar.weaponState
    }),
    Object.freeze({
      aimCamera: null,
      characterId: enemySnapshotFar.characterId,
      look: Object.freeze({
        pitchRadians: enemySnapshotFar.look.pitchRadians,
        yawRadians: enemySnapshotFar.look.yawRadians
      }),
      mountedOccupancy: enemySnapshotFar.mountedOccupancy,
      playerId: enemySnapshotFar.playerId,
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationPlaybackRateMultiplier: 1,
        animationVocabulary: "idle",
        position: enemySnapshotFar.groundedBody.position,
        yawRadians: 0
      }),
      teamId: enemySnapshotFar.teamId,
      username: enemySnapshotFar.username,
      weaponState: enemySnapshotFar.weaponState
    })
  ]);
  dependencies.remoteWorldRuntime.remoteCharacterPresentations = remotePresentations;
  nowMs = 6_000;
  publisher.publishSnapshot(createPublishInput(), true, nowMs);

  assert.equal(publisher.hudSnapshot.radar.enemyContacts.length, 0);
});

test("MetaverseRuntimeHudPublisher displays optimistic selected weapon inventory", async () => {
  const { MetaverseRuntimeHudPublisher } = await clientLoader.load(
    "/src/metaverse/hud/metaverse-runtime-hud-publisher.ts"
  );
  const localPlayerId = createMetaversePlayerId("hud-weapon-switch-local");
  const localUsername = createUsername("Hud Weapon Local");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(localUsername, null);

  const dependencies = createFakeHudPublisherDependencies(() => 0);
  dependencies.presenceRuntime.isJoined = true;
  dependencies.remoteWorldRuntime.isConnected = true;
  dependencies.weaponPresentationRuntime = Object.freeze({
    hudSnapshot: Object.freeze({
      adsTransitionMs: 140,
      aimMode: "hip-fire",
      reticleColor: "white",
      reticleId: "default-ring",
      reticleStyleId: "rocket-crosshair",
      visible: true,
      weaponId: "metaverse-rocket-launcher-v1",
      weaponLabel: "Rocket Launcher"
    })
  });

  const localPlayerSnapshot = Object.freeze({
    ...createMetaverseRealtimePlayerSnapshot({
      characterId: "mesh2motion-humanoid-v1",
      combat: {
        activeWeapon: {
          ammoInMagazine: 11,
          ammoInReserve: 44,
          reloadRemainingMs: 0,
          weaponId: "metaverse-service-pistol-v2"
        },
        alive: true,
        health: 100,
        weaponInventory: [
          {
            ammoInMagazine: 11,
            ammoInReserve: 44,
            reloadRemainingMs: 0,
            weaponId: "metaverse-service-pistol-v2"
          },
          {
            ammoInMagazine: 1,
            ammoInReserve: 3,
            reloadRemainingMs: 0,
            weaponId: "metaverse-rocket-launcher-v1"
          }
        ],
        weaponStats: [
          {
            shotsFired: 0,
            shotsHit: 0,
            weaponId: "metaverse-rocket-launcher-v1"
          }
        ]
      },
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
      playerId: localPlayerId,
      teamId: "blue",
      username: localUsername
    }),
    lastProcessedLookSequence: 0,
    lastProcessedTraversalSequence: 0,
    lastProcessedWeaponSequence: 0
  });
  const worldSnapshot = createMetaverseRealtimeWorldSnapshot({
    observerPlayer: {
      highestProcessedPlayerActionSequence: 1,
      playerId: localPlayerId,
      recentPlayerActionReceipts: []
    },
    players: [localPlayerSnapshot],
    snapshotSequence: 1,
    tick: {
      currentTick: 1,
      emittedAtServerTimeMs: 1_000,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  dependencies.remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot =
    () => localPlayerSnapshot;
  dependencies.remoteWorldRuntime.readFreshAuthoritativeWorldSnapshot =
    () => worldSnapshot;

  const publisher = new MetaverseRuntimeHudPublisher(dependencies);

  publisher.publishSnapshot(createPublishInput(), true, 0);

  assert.equal(
    publisher.hudSnapshot.combat.weaponId,
    "metaverse-rocket-launcher-v1"
  );
  assert.equal(publisher.hudSnapshot.combat.ammoInMagazine, 1);
  assert.equal(publisher.hudSnapshot.combat.ammoInReserve, 3);
});
