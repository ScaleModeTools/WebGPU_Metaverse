import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldSnapshot,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

const weaponId = "metaverse-service-pistol-v2";

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createCameraSnapshot() {
  return Object.freeze({
    lookDirection: Object.freeze({
      x: 0,
      y: 0,
      z: -1
    }),
    pitchRadians: 0,
    position: Object.freeze({
      x: 1,
      y: 1.7,
      z: 2
    }),
    yawRadians: 0
  });
}

function createGroundedBody(position) {
  return Object.freeze({
    linearVelocity: Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    position: Object.freeze(position),
    yawRadians: 0
  });
}

function createCombatSnapshot({
  alive = true,
  combatWeaponId = weaponId,
  shotsFired = 0
} = {}) {
  return Object.freeze({
    activeWeapon: Object.freeze({
      ammoInMagazine: 10,
      ammoInReserve: 40,
      reloadRemainingMs: 0,
      weaponId: combatWeaponId
    }),
    alive,
    health: alive ? 100 : 0,
    weaponStats: Object.freeze([
      Object.freeze({
        shotsFired,
        shotsHit: 0,
        weaponId: combatWeaponId
      })
    ])
  });
}

function createPlayerInput({
  alive = true,
  playerId,
  position,
  shotsFired = 0,
  stateSequence = 1,
  weaponId: combatWeaponId = weaponId,
  username
}) {
  return Object.freeze({
    characterId: "mesh2motion-humanoid-v1",
    combat: createCombatSnapshot({
      alive,
      combatWeaponId,
      shotsFired
    }),
    groundedBody: createGroundedBody(position),
    playerId,
    stateSequence,
    username
  });
}

function createWorldSnapshot({
  combatEvents = [],
  combatFeed = [],
  localAlive = true,
  localPlayerId,
  localStateSequence = 1,
  localUsername,
  observerPlayer = null,
  projectiles = [],
  remoteAlive = true,
  remotePlayerId,
  remoteShotsFired = 0,
  remoteStateSequence = 1,
  remoteWeaponId = weaponId,
  localShotsFired = 0,
  localWeaponId = weaponId,
  remoteUsername,
  snapshotSequence
}) {
  return createMetaverseRealtimeWorldSnapshot({
    combatEvents,
    combatFeed,
    observerPlayer,
    players: [
      createPlayerInput({
        alive: localAlive,
        playerId: localPlayerId,
        position: {
          x: 0,
          y: 0.9,
          z: 0
        },
        shotsFired: localShotsFired,
        stateSequence: localStateSequence,
        weaponId: localWeaponId,
        username: localUsername
      }),
      createPlayerInput({
        alive: remoteAlive,
        playerId: remotePlayerId,
        position: {
          x: 6,
          y: 0.9,
          z: -4
        },
        shotsFired: remoteShotsFired,
        stateSequence: remoteStateSequence,
        weaponId: remoteWeaponId,
        username: remoteUsername
      })
    ],
    projectiles,
    snapshotSequence,
    tick: {
      currentTick: snapshotSequence,
      emittedAtServerTimeMs: 1_000 + snapshotSequence * 50,
      tickIntervalMs: 50
    },
    vehicles: []
});
}

function createHitscanResolvedEvent({
  actionSequence,
  aimTargetWorld,
  eventSequence,
  finalReason = "hit-player",
  hitKind = "player",
  hitNormalWorld = null,
  hitPointWorld = Object.freeze({ x: 0, y: 1.62, z: -8 }),
  hitSurface = null,
  playerId,
  rayForwardWorld = Object.freeze({ x: 0, y: 0, z: -1 }),
  rayOriginWorld = Object.freeze({ x: 0, y: 1.62, z: 0 }),
  semanticMuzzleWorld = Object.freeze({ x: 0.18, y: 1.42, z: -0.55 }),
  targetPlayerId = null,
  timeMs = eventSequence * 50,
  weaponId: eventWeaponId = weaponId
}) {
  return Object.freeze({
    actionSequence,
    aimTargetWorld:
      aimTargetWorld ??
      (hitKind === "miss"
        ? Object.freeze({ x: 0, y: 1.62, z: -48 })
        : hitPointWorld),
    cameraRayForwardWorld: rayForwardWorld,
    cameraRayOriginWorld: rayOriginWorld,
    eventKind: "hitscan-resolved",
    eventSequence,
    hitscan: Object.freeze({
      finalReason,
      hitKind,
      hitNormalWorld,
      hitPointWorld,
      hitSurface,
      regionId: "upper_torso",
      targetPlayerId
    }),
    playerId,
    presentationDeliveryModel: "hitscan-tracer",
    semanticMuzzleWorld,
    shotId: `${playerId}:${actionSequence}`,
    timeMs,
    weaponId: eventWeaponId
  });
}

function createProjectileSpawnedEvent({
  actionSequence,
  aimTargetWorld = null,
  eventSequence,
  launchDirectionWorld = Object.freeze({ x: 0, y: 0, z: -1 }),
  playerId,
  projectileId = `${playerId}:${actionSequence}`,
  semanticMuzzleWorld = Object.freeze({ x: 0.1, y: 1.34, z: -0.95 }),
  timeMs = eventSequence * 50,
  weaponId: eventWeaponId = "metaverse-rocket-launcher-v1"
}) {
  return Object.freeze({
    actionSequence,
    aimTargetWorld,
    cameraRayForwardWorld: launchDirectionWorld,
    cameraRayOriginWorld: Object.freeze({ x: 0, y: 1.62, z: 0 }),
    eventKind: "projectile-spawned",
    eventSequence,
    launchDirectionWorld,
    playerId,
    presentationDeliveryModel: "authoritative-projectile",
    projectileId,
    semanticMuzzleWorld,
    shotId: `${playerId}:${actionSequence}`,
    timeMs,
    weaponId: eventWeaponId
  });
}

function createProjectileResolvedEvent({
  actionSequence,
  eventSequence,
  hitZone = null,
  impactNormalWorld = null,
  impactPointWorld = Object.freeze({ x: 0, y: 1.2, z: -4 }),
  impactSurface = null,
  playerId,
  projectileId = `${playerId}:${actionSequence}`,
  resolutionKind = "hit-world",
  targetPlayerId = null,
  timeMs = eventSequence * 50,
  weaponId: eventWeaponId = "metaverse-rocket-launcher-v1"
}) {
  return Object.freeze({
    actionSequence,
    eventKind: "projectile-resolved",
    eventSequence,
    playerId,
    presentationDeliveryModel: "authoritative-projectile",
    projectile: Object.freeze({
      hitZone,
      impactNormalWorld,
      impactPointWorld,
      impactSurface,
      targetPlayerId,
      resolutionKind
    }),
    projectileId,
    shotId: `${playerId}:${actionSequence}`,
    timeMs,
    weaponId: eventWeaponId
  });
}

function installNavigatorMock(navigatorMock) {
  const originalNavigator = globalThis.navigator;

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorMock,
    writable: true
  });

  return () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
      writable: true
    });
  };
}

function createRenderedMuzzleResolver(
  originByPlayerId,
  forwardByPlayerId = new Map()
) {
  return (query) => {
    const origin = originByPlayerId.get(query.playerId) ?? null;

    if (origin === null) {
      return null;
    }

    return Object.freeze({
      forwardWorld:
        forwardByPlayerId.get(query.playerId) ??
        Object.freeze({ x: 0, y: 0, z: -1 }),
      originWorld: origin,
      playerId: query.playerId,
      sampledAtRenderFrame: 1,
      source: "rendered-projectile-muzzle",
      weaponId: query.weaponId,
      weaponInstanceId: query.weaponInstanceId ?? null
    });
  };
}

function drainQueuedVisualIntents(
  runtime,
  cameraSnapshot,
  originByPlayerId = new Map(),
  forwardByPlayerId = new Map()
) {
  runtime.drainQueuedVisualIntents({
    cameraSnapshot,
    resolveRenderedMuzzle: createRenderedMuzzleResolver(
      originByPlayerId,
      forwardByPlayerId
    )
  });
}

function drainQueuedVisualIntentsWithFallback(runtime, cameraSnapshot) {
  runtime.drainQueuedVisualIntents({
    cameraSnapshot,
    resolveRenderedMuzzle: () => null
  });
  runtime.drainQueuedVisualIntents({
    cameraSnapshot,
    resolveRenderedMuzzle: () => null
  });
  runtime.drainQueuedVisualIntents({
    cameraSnapshot,
    resolveRenderedMuzzle: () => null
  });
}

function capturePostSyncLocalShot(runtime, input) {
  runtime.registerPendingLocalShot(input);
  runtime.capturePendingLocalShotOrigin(input);
}

test("MetaverseCombatHapticsRuntime prefers gamepad rumble and falls back to browser vibration", async () => {
  const { MetaverseCombatHapticsRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-haptics-runtime.ts"
  );
  const playEffects = [];
  const vibrations = [];
  const restoreNavigator = installNavigatorMock({
    getGamepads() {
      return [
        {
          vibrationActuator: {
            playEffect(effectType, params) {
              playEffects.push({
                effectType,
                params
              });
              return Promise.resolve();
            }
          }
        }
      ];
    },
    vibrate(pattern) {
      vibrations.push(pattern);
      return true;
    }
  });

  try {
    const runtime = new MetaverseCombatHapticsRuntime();

    runtime.triggerShot();

    assert.deepEqual(vibrations, []);
    assert.equal(playEffects.length, 1);
    assert.equal(playEffects[0].effectType, "dual-rumble");
    assert.equal(playEffects[0].params.duration, 42);
    assert.equal(playEffects[0].params.strongMagnitude, 0.72);

    restoreNavigator();

    const restoreFallbackNavigator = installNavigatorMock({
      vibrate(pattern) {
        vibrations.push(pattern);
        return true;
      }
    });

    try {
      runtime.triggerHit();
      assert.deepEqual(vibrations, [[48]]);
    } finally {
      restoreFallbackNavigator();
    }
  } finally {
    restoreNavigator();
  }
});

test("MetaverseCombatFeedbackRuntime emits rocket launch and explosion cues from authoritative projectiles", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-rocket-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-rocket-remote");
  const localUsername = createUsername("Rocket Feedback Local");
  const remoteUsername = createUsername("Rocket Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const audioCalls = [];
  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    playAudioCue(cueId, options) {
      audioCalls.push({
        cueId,
        options
      });
    },
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const weaponTipOriginWorld = Object.freeze({ x: 0.1, y: 1.34, z: -0.95 });
  const projectileBase = Object.freeze({
    direction: Object.freeze({ x: 0, y: 0, z: -1 }),
    expiresAtTimeMs: 7_200,
    ownerPlayerId: localPlayerId,
    position: Object.freeze({ x: 0, y: 1.44, z: -2 }),
    projectileId: `${localPlayerId}:12`,
    resolvedAtTimeMs: null,
    resolvedHitZone: null,
    resolvedPlayerId: null,
    sourceActionSequence: 12,
    spawnedAtTimeMs: 1_200,
    velocityMetersPerSecond: 70,
    weaponId: "metaverse-rocket-launcher-v1"
  });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 12,
    directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
    originWorld: Object.freeze({ x: 0, y: 1.44, z: 0 }),
    originSource: "rendered-muzzle-post-sync",
    weaponId: "metaverse-rocket-launcher-v1"
  });
  assert.equal(presentationEvents.length, 0);

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createProjectileSpawnedEvent({
          actionSequence: 12,
          eventSequence: 1,
          playerId: localPlayerId,
          projectileId: `${localPlayerId}:12`,
          semanticMuzzleWorld: weaponTipOriginWorld
        })
      ],
      localPlayerId,
      localUsername,
      projectiles: [
        Object.freeze({
          ...projectileBase,
          resolution: "active"
        })
      ],
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, Object.freeze({ x: 0, y: 1.44, z: 0 })]])
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      projectiles: [
        Object.freeze({
          ...projectileBase,
          position: Object.freeze({ x: 0, y: 1.44, z: -3 }),
          resolution: "active"
        })
      ],
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 3
    }),
    cameraSnapshot
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createProjectileResolvedEvent({
          actionSequence: 12,
          eventSequence: 2,
          hitZone: "body",
          impactNormalWorld: Object.freeze({ x: 0, y: 1, z: 0 }),
          impactPointWorld: Object.freeze({ x: 0, y: 1.44, z: -5 }),
          impactSurface: Object.freeze({
            ownerEnvironmentAssetId: "arena-floor",
            traversalAffordance: "support"
          }),
          playerId: localPlayerId,
          projectileId: `${localPlayerId}:12`,
          targetPlayerId: remotePlayerId,
          timeMs: 1_280
        })
      ],
      localPlayerId,
      localUsername,
      projectiles: [
        Object.freeze({
          ...projectileBase,
          position: Object.freeze({ x: 0, y: 1.44, z: -5 }),
          resolution: "hit-world",
          resolvedAtTimeMs: 1_280
        })
      ],
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 4
    }),
    cameraSnapshot
  );

  assert.deepEqual(
    audioCalls.map((audioCall) => audioCall.cueId),
    ["metaverse-rocket-launch", "metaverse-rocket-explosion"]
  );
  assert.equal(audioCalls[1].options.spatial.position.z, -5);
  assert.deepEqual(audioCalls[0].options.spatial.position, {
    x: 0,
    y: 1.44,
    z: 0
  });
  assert.deepEqual(
    presentationEvents.map((event) => event.kind),
    ["shot", "projectile-impact"]
  );
  assert.equal(presentationEvents[0]?.weaponId, "metaverse-rocket-launcher-v1");
  assert.equal(presentationEvents[0]?.shotFx, "rocket-muzzle");
  assert.equal(presentationEvents[0]?.source, "authoritative-projectile");
  assert.equal(presentationEvents[0]?.projectileId, `${localPlayerId}:12`);
  assert.deepEqual(presentationEvents[0]?.originWorld, {
    x: 0,
    y: 1.44,
    z: 0
  });
  assert.match(presentationEvents[0]?.visualKey ?? "", /authoritative-projectile/);
  assert.equal(presentationEvents[1]?.impactFx, "rocket-explosion");
  assert.equal(presentationEvents[1]?.authoritativeTimeMs, 1_280);
  assert.equal(presentationEvents[1]?.hitZone, "body");
  assert.deepEqual(presentationEvents[1]?.impactNormalWorld, {
    x: 0,
    y: 1,
    z: 0
  });
  assert.deepEqual(presentationEvents[1]?.impactSurface, {
    ownerEnvironmentAssetId: "arena-floor",
    traversalAffordance: "support"
  });
  assert.equal(presentationEvents[1]?.targetPlayerId, remotePlayerId);
});

test("MetaverseCombatFeedbackRuntime keeps unmapped weapon presentation silent", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-unmapped-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-unmapped-remote");
  const localUsername = createUsername("Unmapped Feedback Local");
  const remoteUsername = createUsername("Unmapped Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const audioCalls = [];
  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    playAudioCue(cueId, options) {
      audioCalls.push({
        cueId,
        options
      });
    },
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const unmappedWeaponId = "metaverse-unmapped-test-weapon";

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 1,
          eventSequence: 1,
          hitKind: "world",
          hitPointWorld: Object.freeze({ x: 0, y: 1, z: -4 }),
          playerId: remotePlayerId,
          weaponId: unmappedWeaponId
        }),
        createProjectileSpawnedEvent({
          actionSequence: 2,
          eventSequence: 2,
          playerId: remotePlayerId,
          weaponId: unmappedWeaponId
        }),
        createProjectileResolvedEvent({
          actionSequence: 2,
          eventSequence: 3,
          playerId: remotePlayerId,
          weaponId: unmappedWeaponId
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(runtime, cameraSnapshot, new Map());

  assert.deepEqual(audioCalls, []);
  assert.deepEqual(presentationEvents, []);
});

test("MetaverseCombatFeedbackRuntime bootstraps past pending local pistol events without replaying one-shot FX", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-first-pistol-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-first-pistol-remote");
  const localUsername = createUsername("First Pistol Feedback Local");
  const remoteUsername = createUsername("First Pistol Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const predictedOrigin = Object.freeze({ x: 0.31, y: 1.45, z: -0.16 });
  const drainTimeOrigin = Object.freeze({ x: 1.4, y: 1.92, z: -0.72 });
  const hitPointWorld = Object.freeze({ x: 0, y: 1.62, z: -7 });

  capturePostSyncLocalShot(runtime, {
    actionSequence: 3,
    directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
    originWorld: predictedOrigin,
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 3,
          eventSequence: 1,
          hitPointWorld,
          playerId: localPlayerId,
          targetPlayerId: remotePlayerId
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    createCameraSnapshot()
  );
  drainQueuedVisualIntents(runtime, createCameraSnapshot(), new Map([[localPlayerId, drainTimeOrigin]]));

  const tracerEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-tracer"
  );

  assert.equal(tracerEvents.length, 0);
});

test("MetaverseCombatFeedbackRuntime bootstraps past pending local rocket spawn events without replaying one-shot FX", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-first-rocket-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-first-rocket-remote");
  const localUsername = createUsername("First Rocket Feedback Local");
  const remoteUsername = createUsername("First Rocket Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const audioCalls = [];
  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    playAudioCue(cueId, options) {
      audioCalls.push({
        cueId,
        options
      });
    },
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const renderedMuzzle = Object.freeze({ x: 0.22, y: 1.48, z: -0.12 });
  const drainTimeMuzzle = Object.freeze({ x: 1.1, y: 1.9, z: -0.45 });
  const launchAimTarget = Object.freeze({ x: 0.22, y: 0.05, z: -0.75 });
  const activeProjectilePosition = Object.freeze({
    x: 0.22,
    y: 1.48,
    z: -2
  });
  const projectileId = `${localPlayerId}:6`;

  capturePostSyncLocalShot(runtime, {
    actionSequence: 6,
    directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
    originWorld: renderedMuzzle,
    originSource: "rendered-muzzle-post-sync",
    weaponId: "metaverse-rocket-launcher-v1"
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createProjectileSpawnedEvent({
          actionSequence: 6,
          aimTargetWorld: launchAimTarget,
          eventSequence: 1,
          playerId: localPlayerId,
          projectileId
        })
      ],
      localPlayerId,
      localUsername,
      projectiles: [
        Object.freeze({
          direction: Object.freeze({ x: 0, y: 0, z: -1 }),
          expiresAtTimeMs: 7_000,
          ownerPlayerId: localPlayerId,
          position: activeProjectilePosition,
          projectileId,
          resolution: "active",
          resolvedAtTimeMs: null,
          resolvedHitZone: null,
          resolvedPlayerId: null,
          sourceActionSequence: 6,
          spawnedAtTimeMs: 1_000,
          velocityMetersPerSecond: 70,
          weaponId: "metaverse-rocket-launcher-v1"
        })
      ],
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    createCameraSnapshot()
  );
  drainQueuedVisualIntents(
    runtime,
    createCameraSnapshot(),
    new Map([[localPlayerId, drainTimeMuzzle]])
  );

  const launchEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "rocket-muzzle"
  );

  assert.deepEqual(
    audioCalls.map((audioCall) => audioCall.cueId),
    []
  );
  assert.equal(launchEvents.length, 0);
});

test("MetaverseCombatFeedbackRuntime bootstraps past active rocket spawn events without replaying one-shot FX", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-first-active-rocket-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-first-active-rocket-remote");
  const localUsername = createUsername("First Active Rocket Feedback Local");
  const remoteUsername = createUsername("First Active Rocket Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const projectileId = `${remotePlayerId}:5`;

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createProjectileSpawnedEvent({
          actionSequence: 5,
          eventSequence: 1,
          playerId: remotePlayerId,
          projectileId
        })
      ],
      localPlayerId,
      localUsername,
      projectiles: [
        Object.freeze({
          direction: Object.freeze({ x: 0, y: 0, z: -1 }),
          expiresAtTimeMs: 7_000,
          ownerPlayerId: remotePlayerId,
          position: Object.freeze({ x: 0.1, y: 1.34, z: -2 }),
          projectileId,
          resolution: "active",
          resolvedAtTimeMs: null,
          resolvedHitZone: null,
          resolvedPlayerId: null,
          sourceActionSequence: 5,
          spawnedAtTimeMs: 1_000,
          velocityMetersPerSecond: 70,
          weaponId: "metaverse-rocket-launcher-v1"
        })
      ],
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    createCameraSnapshot()
  );
  drainQueuedVisualIntents(
    runtime,
    createCameraSnapshot(),
    new Map([[remotePlayerId, Object.freeze({ x: 0.1, y: 1.34, z: -0.95 })]])
  );

  const launchEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "rocket-muzzle"
  );

  assert.equal(launchEvents.length, 0);
});

test("MetaverseCombatFeedbackRuntime keeps expired rocket resolutions silent", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-expired-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-expired-remote");
  const localUsername = createUsername("Expired Feedback Local");
  const remoteUsername = createUsername("Expired Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const audioCalls = [];
  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    playAudioCue(cueId, options) {
      audioCalls.push({
        cueId,
        options
      });
    },
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createProjectileResolvedEvent({
          actionSequence: 10,
          eventSequence: 1,
          playerId: remotePlayerId,
          projectileId: `${remotePlayerId}:10`,
          resolutionKind: "expired"
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );

  assert.deepEqual(audioCalls, []);
  assert.deepEqual(presentationEvents, []);
});

test("MetaverseCombatFeedbackRuntime bootstraps retained rocket ground impacts without replaying one-shot FX", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-initial-impact-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-initial-impact-remote");
  const localUsername = createUsername("Initial Impact Feedback Local");
  const remoteUsername = createUsername("Initial Impact Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const audioCalls = [];
  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    playAudioCue(cueId, options) {
      audioCalls.push({
        cueId,
        options
      });
    },
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const projectileId = `${remotePlayerId}:11`;
  const impactPointWorld = Object.freeze({ x: 3, y: 0.08, z: -7 });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createProjectileResolvedEvent({
          actionSequence: 11,
          eventSequence: 4,
          impactPointWorld,
          playerId: remotePlayerId,
          projectileId
        })
      ],
      localPlayerId,
      localUsername,
      projectiles: [
        Object.freeze({
          direction: Object.freeze({ x: 0, y: -0.3, z: -1 }),
          expiresAtTimeMs: 7_200,
          ownerPlayerId: remotePlayerId,
          position: impactPointWorld,
          projectileId,
          resolution: "hit-world",
          resolvedAtTimeMs: 1_280,
          resolvedHitZone: null,
          resolvedPlayerId: null,
          sourceActionSequence: 11,
          spawnedAtTimeMs: 1_200,
          velocityMetersPerSecond: 70,
          weaponId: "metaverse-rocket-launcher-v1"
        })
      ],
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );

  const impactEvents = presentationEvents.filter(
    (event) => event.kind === "projectile-impact"
  );

  assert.deepEqual(
    audioCalls.map((audioCall) => audioCall.cueId),
    []
  );
  assert.equal(impactEvents.length, 0);
});

test("MetaverseCombatFeedbackRuntime emits one impact visual per projectile id", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-impact-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-impact-remote");
  const localUsername = createUsername("Impact Feedback Local");
  const remoteUsername = createUsername("Impact Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const audioCalls = [];
  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    playAudioCue(cueId, options) {
      audioCalls.push({
        cueId,
        options
      });
    },
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const projectileId = `${remotePlayerId}:11`;

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createProjectileResolvedEvent({
          actionSequence: 11,
          eventSequence: 1,
          playerId: remotePlayerId,
          projectileId
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createProjectileResolvedEvent({
          actionSequence: 11,
          eventSequence: 2,
          impactPointWorld: Object.freeze({ x: 1, y: 1.2, z: -5 }),
          playerId: remotePlayerId,
          projectileId
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 3
    }),
    cameraSnapshot
  );

  assert.deepEqual(
    audioCalls.map((audioCall) => audioCall.cueId),
    ["metaverse-rocket-explosion"]
  );
  assert.equal(
    presentationEvents.filter((event) => event.kind === "projectile-impact")
      .length,
    1
  );
});

test("MetaverseCombatFeedbackRuntime suppresses duplicate local predicted fire for one action sequence", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-local-dedupe");

  assert.notEqual(localPlayerId, null);

  const audioCalls = [];
  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    playAudioCue(cueId, options) {
      audioCalls.push({
        cueId,
        options
      });
    },
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });

  capturePostSyncLocalShot(runtime, {
    actionSequence: 31,
    originWorld: Object.freeze({ x: 0.2, y: 1.4, z: -0.2 }),
    weaponId
  });
  capturePostSyncLocalShot(runtime, {
    actionSequence: 31,
    originWorld: Object.freeze({ x: 0.2, y: 1.4, z: -0.2 }),
    weaponId
  });

  assert.deepEqual(
    audioCalls.map((audioCall) => audioCall.cueId),
    []
  );
  assert.equal(presentationEvents.length, 0);
});

test("MetaverseCombatFeedbackRuntime does not replay observer shot-count when local id is temporarily unavailable", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-observer-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-observer-remote");
  const localUsername = createUsername("Observer Feedback Local");
  const remoteUsername = createUsername("Observer Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const audioCalls = [];
  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    playAudioCue(cueId, options) {
      audioCalls.push({
        cueId,
        options
      });
    },
    readLocalPlayerId: () => null,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localShotsFired: 0,
      localUsername,
      observerPlayer: {
        highestProcessedPlayerActionSequence: 1,
        playerId: localPlayerId,
        recentPlayerActionReceipts: []
      },
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localShotsFired: 1,
      localUsername,
      observerPlayer: {
        highestProcessedPlayerActionSequence: 1,
        playerId: localPlayerId,
        recentPlayerActionReceipts: []
      },
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );

  assert.deepEqual(audioCalls, []);
  assert.deepEqual(presentationEvents, []);
});

test("MetaverseCombatFeedbackRuntime ignores remote rocket shot-count replay", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-rocket-count-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-rocket-count-remote");
  const localUsername = createUsername("Rocket Count Feedback Local");
  const remoteUsername = createUsername("Rocket Count Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const audioCalls = [];
  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    playAudioCue(cueId, options) {
      audioCalls.push({
        cueId,
        options
      });
    },
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteShotsFired: 0,
      remoteUsername,
      remoteWeaponId: "metaverse-rocket-launcher-v1",
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteShotsFired: 1,
      remoteUsername,
      remoteWeaponId: "metaverse-rocket-launcher-v1",
      snapshotSequence: 2
    }),
    cameraSnapshot
  );

  assert.deepEqual(audioCalls, []);
  assert.deepEqual(presentationEvents, []);
});

test("MetaverseCombatFeedbackRuntime ignores aggregate remote pistol shot-count catch-up", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-count-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-count-remote");
  const localUsername = createUsername("Count Feedback Local");
  const remoteUsername = createUsername("Count Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteShotsFired: 0,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteShotsFired: 4,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );

  const remoteShotEvents = presentationEvents.filter(
    (event) =>
      event.kind === "shot" && event.playerId === remotePlayerId
  );

  assert.equal(remoteShotEvents.length, 0);
});

test("MetaverseCombatFeedbackRuntime renders remote pistol fire from combat events", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-remote-pistol-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-remote-pistol-remote");
  const localUsername = createUsername("Remote Pistol Feedback Local");
  const remoteUsername = createUsername("Remote Pistol Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const audioCalls = [];
  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    playAudioCue(cueId) {
      audioCalls.push(cueId);
    },
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const remoteMuzzle = Object.freeze({ x: 6.18, y: 2.32, z: -4.55 });
  const remoteHitPoint = Object.freeze({ x: 0, y: 1.62, z: -8 });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 9,
          eventSequence: 1,
          hitPointWorld: remoteHitPoint,
          playerId: remotePlayerId,
          semanticMuzzleWorld: remoteMuzzle,
          targetPlayerId: localPlayerId
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[remotePlayerId, remoteMuzzle]])
  );

  const remoteTracerEvents = presentationEvents.filter(
    (event) =>
      event.kind === "shot" &&
      event.playerId === remotePlayerId &&
      event.shotFx === "pistol-tracer"
  );

  assert.deepEqual(audioCalls, ["metaverse-pistol-shot"]);
  assert.equal(remoteTracerEvents.length, 1);
  assert.deepEqual(remoteTracerEvents[0]?.originWorld, remoteMuzzle);
  assert.deepEqual(remoteTracerEvents[0]?.endWorld, remoteHitPoint);
});

test("MetaverseCombatFeedbackRuntime emits one authoritative pistol tracer per shot resolution", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-tracer-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-tracer-remote");
  const localUsername = createUsername("Tracer Feedback Local");
  const remoteUsername = createUsername("Tracer Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const predictedOrigin = Object.freeze({ x: 0.24, y: 1.36, z: -0.18 });
  const postSyncFireActionDirection = Object.freeze({ x: 1, y: 0, z: 0 });
  const authoritativeHitPoint = Object.freeze({ x: 0, y: 1.62, z: -8 });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 14,
    directionWorld: postSyncFireActionDirection,
    originWorld: predictedOrigin,
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 14,
          eventSequence: 1,
          hitPointWorld: authoritativeHitPoint,
          playerId: localPlayerId,
          targetPlayerId: remotePlayerId
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, predictedOrigin]])
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 3
    }),
    cameraSnapshot
  );

  const shotEvents = presentationEvents.filter((event) => event.kind === "shot");
  const tracerEvents = shotEvents.filter(
    (event) => event.shotFx === "pistol-tracer"
  );

  assert.equal(shotEvents.length, 1);
  assert.equal(tracerEvents.length, 1);
  assert.equal(tracerEvents[0]?.source, "authoritative-shot-resolution");
  assert.deepEqual(tracerEvents[0]?.originWorld, predictedOrigin);
  assert.deepEqual(tracerEvents[0]?.directionWorld, {
    x: 0,
    y: 0,
    z: -1
  });
  assert.deepEqual(tracerEvents[0]?.endWorld, authoritativeHitPoint);
});

test("MetaverseCombatFeedbackRuntime sends pistol miss tracers to the authoritative camera ray endpoint", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-miss-tracer-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-miss-tracer-remote");
  const localUsername = createUsername("Miss Tracer Feedback Local");
  const remoteUsername = createUsername("Miss Tracer Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const renderedMuzzle = Object.freeze({ x: 0.24, y: 1.36, z: -0.18 });
  const cameraRayOriginWorld = Object.freeze({ x: 1, y: 1.62, z: 0 });
  const cameraRayForwardWorld = Object.freeze({ x: 0, y: 0, z: -1 });
  const authoritativeMissEnd = Object.freeze({ x: 1, y: 1.62, z: -1_800 });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 15,
    directionWorld: cameraRayForwardWorld,
    originWorld: renderedMuzzle,
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 15,
          aimTargetWorld: authoritativeMissEnd,
          eventSequence: 1,
          finalReason: "miss-no-hurtbox",
          hitKind: "miss",
          hitPointWorld: null,
          playerId: localPlayerId,
          rayForwardWorld: cameraRayForwardWorld,
          rayOriginWorld: cameraRayOriginWorld,
          targetPlayerId: null
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, renderedMuzzle]])
  );

  const tracerEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-tracer"
  );

  assert.equal(tracerEvents.length, 1);
  assert.deepEqual(tracerEvents[0]?.originWorld, renderedMuzzle);
  assert.deepEqual(tracerEvents[0]?.endWorld, authoritativeMissEnd);
});

test("MetaverseCombatFeedbackRuntime renders far pistol world hits as tracer plus impact", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-world-far-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-world-far-remote");
  const localUsername = createUsername("World Far Feedback Local");
  const remoteUsername = createUsername("World Far Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const renderedMuzzle = Object.freeze({ x: 0.24, y: 1.36, z: -0.18 });
  const worldHitPoint = Object.freeze({ x: 0, y: 1.62, z: -3 });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 16,
    directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
    originWorld: renderedMuzzle,
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 16,
          eventSequence: 1,
          finalReason: "hit-world",
          hitKind: "world",
          hitPointWorld: worldHitPoint,
          playerId: localPlayerId,
          targetPlayerId: null
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, renderedMuzzle]])
  );

  const tracerEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-tracer"
  );
  const impactEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-world-impact"
  );

  assert.equal(tracerEvents.length, 1);
  assert.deepEqual(tracerEvents[0]?.originWorld, renderedMuzzle);
  assert.deepEqual(tracerEvents[0]?.endWorld, worldHitPoint);
  assert.equal(impactEvents.length, 1);
  assert.deepEqual(impactEvents[0]?.originWorld, worldHitPoint);
});

test("MetaverseCombatFeedbackRuntime renders close pistol world hits as tracer plus impact", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-world-close-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-world-close-remote");
  const localUsername = createUsername("World Close Feedback Local");
  const remoteUsername = createUsername("World Close Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const renderedMuzzle = Object.freeze({ x: 0.02, y: 1.62, z: -0.2 });
  const closeWorldHitPoint = Object.freeze({ x: 0, y: 1.62, z: -0.8 });
  const expectedTracerEnd = Object.freeze({ x: 0.02, y: 1.62, z: -1.4 });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 17,
    directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
    originWorld: renderedMuzzle,
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 17,
          eventSequence: 1,
          finalReason: "hit-world",
          hitKind: "world",
          hitPointWorld: closeWorldHitPoint,
          playerId: localPlayerId,
          targetPlayerId: null
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, renderedMuzzle]])
  );

  const tracerEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-tracer"
  );
  const impactEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-world-impact"
  );

  assert.equal(tracerEvents.length, 1);
  assert.deepEqual(tracerEvents[0]?.originWorld, renderedMuzzle);
  assert.deepEqual(tracerEvents[0]?.endWorld, expectedTracerEnd);
  assert.equal(impactEvents.length, 1);
  assert.deepEqual(impactEvents[0]?.originWorld, closeWorldHitPoint);
});

test("MetaverseCombatFeedbackRuntime trusts finite diagnostic off-ray pistol world endpoints", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-world-invalid-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-world-invalid-remote");
  const localUsername = createUsername("World Invalid Feedback Local");
  const remoteUsername = createUsername("World Invalid Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const renderedMuzzle = Object.freeze({ x: 0.24, y: 1.36, z: -0.18 });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 19,
    directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
    originWorld: renderedMuzzle,
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 19,
          eventSequence: 1,
          finalReason: "hit-world",
          hitKind: "world",
          hitPointWorld: Object.freeze({ x: 1, y: 1.62, z: -3 }),
          playerId: localPlayerId,
          targetPlayerId: null
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, renderedMuzzle]])
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 20,
    directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
    originWorld: renderedMuzzle,
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 20,
          eventSequence: 2,
          finalReason: "hit-world",
          hitKind: "world",
          hitPointWorld: Object.freeze({ x: 2, y: 1.62, z: -3 }),
          playerId: localPlayerId,
          targetPlayerId: null
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 3
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, renderedMuzzle]])
  );

  assert.deepEqual(
    presentationEvents
      .filter((event) => event.kind === "shot")
      .map((event) => `${event.actionSequence}:${event.shotFx}`),
    [
      "19:pistol-world-impact",
      "19:pistol-tracer",
      "20:pistol-world-impact",
      "20:pistol-tracer"
    ]
  );
});

test("MetaverseCombatFeedbackRuntime keeps close behind-muzzle world impacts authoritative while drawing tracers forward", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-world-backward-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-world-backward-remote");
  const localUsername = createUsername("World Backward Feedback Local");
  const remoteUsername = createUsername("World Backward Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const renderedMuzzle = Object.freeze({ x: 0, y: 1.4, z: 0 });
  const backwardWorldHitPoint = Object.freeze({ x: 0, y: 1.1, z: 0.45 });
  const shotDirection = Object.freeze({ x: 0, y: -0.5, z: -1 });
  const shotDirectionLength = Math.hypot(
    shotDirection.x,
    shotDirection.y,
    shotDirection.z
  );
  const expectedTracerEnd = Object.freeze({
    x: renderedMuzzle.x + (shotDirection.x / shotDirectionLength) * 1.2,
    y: renderedMuzzle.y + (shotDirection.y / shotDirectionLength) * 1.2,
    z: renderedMuzzle.z + (shotDirection.z / shotDirectionLength) * 1.2
  });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 23,
    directionWorld: shotDirection,
    originWorld: renderedMuzzle,
    originForwardWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 23,
          eventSequence: 1,
          finalReason: "hit-world",
          hitKind: "world",
          hitPointWorld: backwardWorldHitPoint,
          playerId: localPlayerId,
          rayForwardWorld: shotDirection,
          targetPlayerId: null
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, renderedMuzzle]]),
    new Map([[localPlayerId, Object.freeze({ x: 0, y: 0, z: -1 })]])
  );

  const tracerEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-tracer"
  );
  const impactEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-world-impact"
  );

  assert.equal(tracerEvents.length, 1);
  assert.deepEqual(tracerEvents[0]?.originWorld, renderedMuzzle);
  assert.ok(
    Math.abs(Number(tracerEvents[0]?.endWorld?.x) - expectedTracerEnd.x) <
      0.000001
  );
  assert.ok(
    Math.abs(Number(tracerEvents[0]?.endWorld?.y) - expectedTracerEnd.y) <
      0.000001
  );
  assert.ok(
    Math.abs(Number(tracerEvents[0]?.endWorld?.z) - expectedTracerEnd.z) <
      0.000001
  );
  assert.equal(impactEvents.length, 1);
  assert.deepEqual(impactEvents[0]?.originWorld, backwardWorldHitPoint);
});

test("MetaverseCombatFeedbackRuntime suppresses missing pistol world endpoints", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-world-missing-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-world-missing-remote");
  const localUsername = createUsername("World Missing Feedback Local");
  const remoteUsername = createUsername("World Missing Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const renderedMuzzle = Object.freeze({ x: 0.24, y: 1.36, z: -0.18 });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 22,
    directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
    originWorld: renderedMuzzle,
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 22,
          eventSequence: 1,
          finalReason: "hit-world",
          hitKind: "world",
          hitPointWorld: null,
          playerId: localPlayerId,
          targetPlayerId: null
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, renderedMuzzle]])
  );

  assert.equal(
    presentationEvents.filter(
      (event) =>
        event.kind === "shot" &&
        (event.shotFx === "pistol-tracer" ||
          event.shotFx === "pistol-world-impact")
    ).length,
    0
  );
});

test("MetaverseCombatFeedbackRuntime falls back to semantic muzzle without rendered muzzle", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-semantic-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-semantic-remote");
  const localUsername = createUsername("Semantic Feedback Local");
  const remoteUsername = createUsername("Semantic Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const expectedSemanticTip = Object.freeze({
    x: 0.18,
    y: 2.32,
    z: -0.55
  });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 18,
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 18,
          eventSequence: 1,
          playerId: localPlayerId,
          semanticMuzzleWorld: expectedSemanticTip,
          targetPlayerId: remotePlayerId
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntentsWithFallback(runtime, cameraSnapshot);

  const tracerEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-tracer"
  );

  assert.equal(tracerEvents.length, 1);
  assert.deepEqual(tracerEvents[0]?.originWorld, expectedSemanticTip);
});

test("MetaverseCombatFeedbackRuntime uses drain-time rendered muzzle when action capture is missing", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-missing-capture-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-missing-capture-remote");
  const localUsername = createUsername("Missing Capture Feedback Local");
  const remoteUsername = createUsername("Missing Capture Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();
  const drainTimeMuzzle = Object.freeze({ x: 9, y: 9, z: 9 });

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 42,
          eventSequence: 1,
          playerId: localPlayerId,
          targetPlayerId: remotePlayerId
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, drainTimeMuzzle]])
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, drainTimeMuzzle]])
  );

  const tracerEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-tracer"
  );

  assert.equal(tracerEvents.length, 1);
  assert.deepEqual(tracerEvents[0]?.originWorld, drainTimeMuzzle);
});

test("MetaverseCombatFeedbackRuntime preserves two quick authoritative pistol tracer events", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-two-shot-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-two-shot-remote");
  const localUsername = createUsername("Two Shot Feedback Local");
  const remoteUsername = createUsername("Two Shot Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const presentationEvents = [];
  const runtime = new MetaverseCombatFeedbackRuntime({
    readLocalPlayerId: () => localPlayerId,
    triggerPresentationEvent(event) {
      presentationEvents.push(event);
    }
  });
  const cameraSnapshot = createCameraSnapshot();

  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 1
    }),
    cameraSnapshot
  );
  capturePostSyncLocalShot(runtime, {
    actionSequence: 20,
    originWorld: Object.freeze({ x: 0.2, y: 1.4, z: -0.2 }),
    weaponId
  });
  capturePostSyncLocalShot(runtime, {
    actionSequence: 21,
    originWorld: Object.freeze({ x: 0.22, y: 1.38, z: -0.28 }),
    weaponId
  });
  runtime.syncAuthoritativeWorld(
    createWorldSnapshot({
      combatEvents: [
        createHitscanResolvedEvent({
          actionSequence: 20,
          eventSequence: 1,
          hitPointWorld: Object.freeze({ x: 0, y: 1.62, z: -6 }),
          playerId: localPlayerId,
          targetPlayerId: remotePlayerId
        }),
        createHitscanResolvedEvent({
          actionSequence: 21,
          eventSequence: 2,
          hitPointWorld: Object.freeze({ x: 0, y: 1.62, z: -7 }),
          playerId: localPlayerId,
          targetPlayerId: remotePlayerId
        })
      ],
      localPlayerId,
      localUsername,
      remotePlayerId,
      remoteUsername,
      snapshotSequence: 2
    }),
    cameraSnapshot
  );
  drainQueuedVisualIntents(
    runtime,
    cameraSnapshot,
    new Map([[localPlayerId, Object.freeze({ x: 0.2, y: 1.4, z: -0.2 })]])
  );

  const tracerEvents = presentationEvents.filter(
    (event) => event.kind === "shot" && event.shotFx === "pistol-tracer"
  );

  assert.equal(tracerEvents.length, 2);
  assert.deepEqual(
    tracerEvents.map((event) => event.actionSequence),
    [20, 21]
  );
});

test("MetaverseCombatFeedbackRuntime emits local, spatial remote, hit, and death feedback without duplicate deaths", async () => {
  const { MetaverseCombatFeedbackRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-combat-feedback-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("combat-feedback-local");
  const remotePlayerId = createMetaversePlayerId("combat-feedback-remote");
  const localUsername = createUsername("Combat Feedback Local");
  const remoteUsername = createUsername("Combat Feedback Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const audioCalls = [];
  const presentationEvents = [];
  const vibrations = [];
  const restoreNavigator = installNavigatorMock({
    vibrate(pattern) {
      vibrations.push(pattern);
      return true;
    }
  });

  try {
    const runtime = new MetaverseCombatFeedbackRuntime({
      playAudioCue(cueId, options) {
        audioCalls.push({
          cueId,
          options
        });
      },
      readLocalPlayerId: () => localPlayerId,
      triggerPresentationEvent(event) {
        presentationEvents.push(event);
      }
    });
    const cameraSnapshot = createCameraSnapshot();

    capturePostSyncLocalShot(runtime, {
      weaponId
    });

    runtime.syncAuthoritativeWorld(
      createWorldSnapshot({
        localPlayerId,
        localUsername,
        remotePlayerId,
        remoteShotsFired: 0,
        remoteUsername,
        snapshotSequence: 1
      }),
      cameraSnapshot
    );

    runtime.syncAuthoritativeWorld(
      createWorldSnapshot({
        combatEvents: [
          createHitscanResolvedEvent({
            actionSequence: 8,
            eventSequence: 1,
            hitPointWorld: Object.freeze({ x: 0, y: 1.62, z: -8 }),
            playerId: remotePlayerId,
            semanticMuzzleWorld: Object.freeze({
              x: 6.18,
              y: 2.32,
              z: -4.55
            }),
            targetPlayerId: localPlayerId
          })
        ],
        combatFeed: [
          {
            attackerPlayerId: remotePlayerId,
            damage: 37,
            hitZone: "body",
            sequence: 1,
            sourceActionSequence: 8,
            sourceProjectileId: "feedback-projectile-1",
            targetPlayerId: localPlayerId,
            timeMs: 1_080,
            type: "damage",
            weaponId
          },
          {
            attackerPlayerId: remotePlayerId,
            headshot: false,
            sequence: 2,
            sourceActionSequence: 8,
            sourceProjectileId: "feedback-projectile-1",
            targetPlayerId: localPlayerId,
            timeMs: 1_090,
            type: "kill",
            weaponId
          }
        ],
        localAlive: false,
        localPlayerId,
        localStateSequence: 6,
        localUsername,
        remotePlayerId,
        remoteShotsFired: 1,
        remoteUsername,
        snapshotSequence: 2
      }),
      cameraSnapshot
    );
    drainQueuedVisualIntents(
      runtime,
      cameraSnapshot,
      new Map([[remotePlayerId, Object.freeze({ x: 6.18, y: 2.32, z: -4.55 })]])
    );

    assert.deepEqual(
      audioCalls.map((audioCall) => audioCall.cueId),
      [
        "metaverse-armor-hit",
        "metaverse-pistol-shot"
      ]
    );
    assert.equal(audioCalls[0].options.spatial.position.x, 0);
    assert.equal(audioCalls[0].options.spatial.position.z, 0);
    assert.equal(audioCalls[0].options.spatial.maxDistanceMeters, 36);
    assert.equal(audioCalls[0].options.spatial.refDistanceMeters, 0.95);
    assert.equal(audioCalls[0].options.spatial.rolloffFactor, 1.85);
    assert.equal(audioCalls[1].options.spatial.position.x, 6.18);
    assert.equal(audioCalls[1].options.spatial.position.z, -4.55);
    assert.equal(audioCalls[1].options.spatial.listener.position.x, 1);
    assert.equal(audioCalls[1].options.spatial.maxDistanceMeters, 118);
    assert.equal(audioCalls[1].options.spatial.refDistanceMeters, 5.4);
    assert.equal(audioCalls[1].options.spatial.rolloffFactor, 0.68);
    assert.ok(
      audioCalls[1].options.spatial.refDistanceMeters >
        audioCalls[0].options.spatial.refDistanceMeters
    );
    assert.ok(
      audioCalls[1].options.spatial.rolloffFactor <
        audioCalls[0].options.spatial.rolloffFactor
    );
    assert.deepEqual(vibrations, [[34], [48]]);
    assert.deepEqual(
      presentationEvents.map((event) => `${event.kind}:${event.playerId}`),
      [
        `hit:${localPlayerId}`,
        `death:${localPlayerId}`,
        `shot:${remotePlayerId}`
      ]
    );
    assert.equal(presentationEvents[0].damageAmount, 37);
    assert.equal(presentationEvents[0].hitZone, "body");
    assert.deepEqual(presentationEvents[0].damageSourceDirectionWorld, {
      x: 6 / Math.hypot(6, -4),
      y: 0,
      z: -4 / Math.hypot(6, -4)
    });
    assert.deepEqual(presentationEvents[1].damageSourceDirectionWorld, {
      x: 6 / Math.hypot(6, -4),
      y: 0,
      z: -4 / Math.hypot(6, -4)
    });

    runtime.syncAuthoritativeWorld(
      createWorldSnapshot({
        localAlive: false,
        localPlayerId,
        localStateSequence: 7,
        localUsername,
        remotePlayerId,
        remoteShotsFired: 1,
        remoteUsername,
        snapshotSequence: 3
      }),
      cameraSnapshot
    );

    assert.equal(
      presentationEvents.filter((event) => event.kind === "death").length,
      1
    );
  } finally {
    restoreNavigator();
  }
});
