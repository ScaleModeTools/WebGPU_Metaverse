import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldSnapshot,
  resolveMetaverseTraversalAuthoritySnapshotInput,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createRealtimeWorldSnapshot } from "../../metaverse-runtime-test-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

async function createPresentationState() {
  const [{ MetaverseRemoteWorldPresentationState }, { metaverseRuntimeConfig }] =
    await Promise.all([
      clientLoader.load(
        "/src/metaverse/remote-world/metaverse-remote-world-presentation-state.ts"
      ),
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
    ]);

  return new MetaverseRemoteWorldPresentationState(metaverseRuntimeConfig);
}

function createSampledFrame({
  alpha = 0,
  baseSnapshot,
  extrapolationSeconds = 0,
  nextSnapshot = null
}) {
  return Object.freeze({
    alpha,
    baseSnapshot,
    extrapolationSeconds,
    nextSnapshot
  });
}

function createTestWeaponState(weaponId, aimMode = "hip-fire") {
  return Object.freeze({
    activeSlotId: "primary",
    aimMode,
    slots: Object.freeze([
      Object.freeze({
        attachmentId: weaponId,
        equipped: true,
        slotId: "primary",
        weaponId,
        weaponInstanceId: `test-player:primary:${weaponId}`
      })
    ]),
    weaponId
  });
}

test("MetaverseRemoteWorldPresentationState interpolates remote character, vehicle, and environment-body presentation from authoritative samples", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const baseSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    environmentBodyX: 4,
    environmentBodyYawRadians: -0.2,
    includeEnvironmentBody: true,
    localPlayerId,
    localUsername,
    remoteLookPitchRadians: -0.3,
    remoteLookYawRadians: 0.2,
    remotePlayerAngularVelocityRadiansPerSecond: 1,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_000,
    snapshotSequence: 1,
    vehicleX: 8,
    yawRadians: 0
  });
  const nextSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    environmentBodyX: 7,
    environmentBodyYawRadians: 0.2,
    includeEnvironmentBody: true,
    localPlayerId,
    localUsername,
    remoteLookPitchRadians: 0.1,
    remoteLookYawRadians: 0.6,
    remotePlayerId,
    remotePlayerX: 11,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 2,
    vehicleX: 11,
    yawRadians: 0.2
  });

  const extrapolationMs = presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    remoteCharacterRootFrame: createSampledFrame({
      alpha: 1,
      baseSnapshot,
      nextSnapshot
    }),
    sampledFrame: createSampledFrame({
      alpha: 0.5,
      baseSnapshot,
      nextSnapshot
    })
  });

  assert.equal(extrapolationMs, 0);
  assert.equal(presentationState.remoteCharacterPresentations.length, 1);
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.poseSyncMode,
    "runtime-server-sampled"
  );
  assert.ok(
    Math.abs(
      presentationState.remoteCharacterPresentations[0]?.presentation.position.x -
        11
    ) < 0.000001
  );
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.look.pitchRadians ?? 0) +
        0.1
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.look.yawRadians ?? 0) -
        0.4
    ) < 0.000001
  );
  assert.equal(presentationState.remoteVehiclePresentations.length, 1);
  assert.ok(
    Math.abs(
      presentationState.remoteVehiclePresentations[0]?.position.x - 9.5
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      presentationState.remoteVehiclePresentations[0]?.yawRadians - 0.1
    ) < 0.000001
  );
  assert.equal(presentationState.remoteEnvironmentBodyPresentations.length, 1);
  assert.ok(
    Math.abs(
      presentationState.remoteEnvironmentBodyPresentations[0]?.position.x - 5.5
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      presentationState.remoteEnvironmentBodyPresentations[0]?.yawRadians
    ) < 0.000001
  );
});

test("MetaverseRemoteWorldPresentationState keeps remote character root on freshest authority while sampled look stays smoothed", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const latestSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteLookPitchRadians: -0.25,
    remoteLookYawRadians: 0.4,
    remotePlayerAngularVelocityRadiansPerSecond: 1,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_000,
    snapshotSequence: 1,
    yawRadians: 0
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.06,
    localPlayerId,
    remoteCharacterRootFrame: createSampledFrame({
      baseSnapshot: latestSnapshot
    }),
    sampledFrame: createSampledFrame({
      baseSnapshot: latestSnapshot,
      extrapolationSeconds: 0.06
    })
  });

  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation.position.x,
    8
  );
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.look.pitchRadians,
    -0.25
  );
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.look.yawRadians,
    0.4
  );
});

test("MetaverseRemoteWorldPresentationState keeps dead remote players presented for ragdoll death and restores them on respawn", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-respawn-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Respawn Remote");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const aliveSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteCombat: {
      alive: true,
      health: 100
    },
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_000,
    snapshotSequence: 1,
    vehicleSeatOccupantPlayerId: null,
    yawRadians: 0
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: aliveSnapshot
    })
  });

  assert.equal(presentationState.remoteCharacterPresentations.length, 1);
  assert.equal(presentationState.remotePlayerBodyBlockers.length, 1);
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation.position.x,
    8
  );

  const deadSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteCombat: {
      alive: false,
      health: 0,
      respawnRemainingMs: 3_000
    },
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 2,
    vehicleSeatOccupantPlayerId: null,
    yawRadians: 0
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: deadSnapshot
    })
  });

  assert.equal(presentationState.remoteCharacterPresentations.length, 1);
  assert.equal(presentationState.remotePlayerBodyBlockers.length, 0);
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.combatAlive,
    false
  );

  const respawnedSnapshot = createRealtimeWorldSnapshot({
    currentTick: 12,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteCombat: {
      alive: true,
      health: 100,
      spawnProtectionRemainingMs: 1_000
    },
    remotePlayerId,
    remotePlayerX: 19,
    remotePlayerZ: 7,
    remoteUsername,
    serverTimeMs: 1_100,
    snapshotSequence: 3,
    vehicleSeatOccupantPlayerId: null,
    yawRadians: Math.PI * 0.25
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: respawnedSnapshot
    })
  });

  assert.equal(presentationState.remoteCharacterPresentations.length, 1);
  assert.equal(presentationState.remotePlayerBodyBlockers.length, 1);
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.combatAlive,
    true
  );
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.presentation.position.x ??
        0) - 19
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.presentation.position.z ??
        0) - 7
    ) < 0.000001
  );
});

test("MetaverseRemoteWorldPresentationState extrapolates remote airborne roots between authoritative snapshots", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-airborne-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Airborne");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const airborneSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 0,
            y: 1.62,
            z: 24
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: localPlayerId,
        username: localUsername
      },
      {
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          jumpBody: {
            grounded: false,
            verticalSpeedUnitsPerSecond: 4
          },
          linearVelocity: {
            x: 1.25,
            y: 4,
            z: 0
          },
          position: {
            x: 8,
            y: 0.7,
            z: 18
          },
          yawRadians: 0.2
        },
        locomotionMode: "grounded",
        look: {
          pitchRadians: -0.1,
          yawRadians: 0.2
        },
        playerId: remotePlayerId,
        username: remoteUsername
      }
    ],
    snapshotSequence: 1,
    tick: {
      currentTick: 10,
      serverTimeMs: 1_000,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: airborneSnapshot,
      extrapolationSeconds: 0.1
    })
  });

  const remotePresentation =
    presentationState.remoteCharacterPresentations[0]?.presentation ?? null;

  assert.notEqual(remotePresentation, null);
  assert.ok((remotePresentation?.position.x ?? 0) > 8);
  assert.ok((remotePresentation?.position.y ?? 0) > 0.7);
});

test("MetaverseRemoteWorldPresentationState derives remote grounded walk pose from authoritative presentation intent", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-dock-runner-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Dock Runner");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const idleSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteLinearVelocity: {
      x: 0.1,
      y: 0,
      z: 0
    },
    remoteLocomotionMode: "grounded",
    remoteObservedMoveAxis: 0,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_000,
    snapshotSequence: 1,
    vehicleSeatOccupantPlayerId: null,
    vehicleX: 8,
    yawRadians: 0
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: idleSnapshot
    })
  });

  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation
      .animationVocabulary,
    "idle"
  );

  const walkSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteLinearVelocity: {
      x: 0.1,
      y: 0,
      z: 0
    },
    remoteLocomotionMode: "grounded",
    remoteObservedMoveAxis: 1,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 2,
    vehicleSeatOccupantPlayerId: null,
    vehicleX: 8,
    yawRadians: 0
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: walkSnapshot
    })
  });

  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation
      .animationVocabulary,
    "walk"
  );
});

test("MetaverseRemoteWorldPresentationState restarts remote grounded walk cycles from collider-grounded direction flips", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-strafer-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Strafer");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const leftStrafeSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          jumpBody: {
            grounded: true
          },
          linearVelocity: {
            x: 0.35,
            y: 0,
            z: 0
          },
          position: {
            x: 0,
            y: 1.62,
            z: 24
          },
          yawRadians: 0
        },
        playerId: localPlayerId,
        presentationIntent: {
          moveAxis: 0,
          strafeAxis: 0
        },
        username: localUsername
      },
      {
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          jumpBody: {
            grounded: true
          },
          linearVelocity: {
            x: 0.4,
            y: 0,
            z: 0
          },
          position: {
            x: 8,
            y: 1.62,
            z: 18
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        look: {
          pitchRadians: 0,
          yawRadians: 0
        },
        playerId: remotePlayerId,
        presentationIntent: {
          moveAxis: 0,
          strafeAxis: -1
        },
        traversalAuthority: resolveMetaverseTraversalAuthoritySnapshotInput({
          activeAction: {
            kind: "jump",
            phase: "up"
          },
          currentTick: 10,
          locomotionMode: "grounded",
          mounted: false,
          pendingActionKind: "jump",
          pendingActionSequence: 7,
          resolvedActionKind: "jump",
          resolvedActionSequence: 7,
          resolvedActionState: "accepted"
        }),
        username: remoteUsername
      }
    ],
    snapshotSequence: 1,
    tick: {
      currentTick: 10,
      serverTimeMs: 1_000,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: leftStrafeSnapshot
    })
  });

  const leftBurstPresentation =
    presentationState.remoteCharacterPresentations[0]?.presentation ?? null;
  const leftBurstCycleId = leftBurstPresentation?.animationCycleId ?? 0;

  assert.equal(leftBurstPresentation?.animationVocabulary, "walk");
  assert.equal(typeof leftBurstPresentation?.animationCycleId, "number");

  const rightStrafeSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          jumpBody: {
            grounded: true
          },
          linearVelocity: {
            x: 0.35,
            y: 0,
            z: 0
          },
          position: {
            x: 0,
            y: 1.62,
            z: 24
          },
          yawRadians: 0
        },
        playerId: localPlayerId,
        presentationIntent: {
          moveAxis: 0,
          strafeAxis: 0
        },
        username: localUsername
      },
      {
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          jumpBody: {
            grounded: true
          },
          linearVelocity: {
            x: 0.4,
            y: 0,
            z: 0
          },
          position: {
            x: 8,
            y: 1.62,
            z: 18
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        look: {
          pitchRadians: 0,
          yawRadians: 0
        },
        playerId: remotePlayerId,
        presentationIntent: {
          moveAxis: 0,
          strafeAxis: 1
        },
        traversalAuthority: resolveMetaverseTraversalAuthoritySnapshotInput({
          activeAction: {
            kind: "jump",
            phase: "up"
          },
          currentTick: 11,
          locomotionMode: "grounded",
          mounted: false,
          pendingActionKind: "jump",
          pendingActionSequence: 7,
          resolvedActionKind: "jump",
          resolvedActionSequence: 7,
          resolvedActionState: "accepted"
        }),
        username: remoteUsername
      }
    ],
    snapshotSequence: 2,
    tick: {
      currentTick: 11,
      serverTimeMs: 1_050,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: rightStrafeSnapshot
    })
  });

  const rightBurstPresentation =
    presentationState.remoteCharacterPresentations[0]?.presentation ?? null;

  assert.equal(rightBurstPresentation?.animationVocabulary, "walk");
  assert.ok(
    (rightBurstPresentation?.animationCycleId ?? 0) >
      leftBurstCycleId
  );
});

test("MetaverseRemoteWorldPresentationState orients unmounted remote character root and aim from explicit look", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-lookout-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Lookout");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const facingSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteLinearVelocity: {
      x: 0,
      y: 0,
      z: 0
    },
    remoteLocomotionMode: "grounded",
    remoteLookPitchRadians: -0.35,
    remoteLookYawRadians: Math.PI * 0.5,
    remotePlayerId,
    remoteWeaponState: createTestWeaponState(
      "metaverse-service-pistol-v1",
      "ads"
    ),
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: 1_000,
    snapshotSequence: 1,
    vehicleSeatOccupantPlayerId: null,
    vehicleX: 8,
    yawRadians: 0
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: facingSnapshot
    })
  });

  assert.equal(presentationState.remoteCharacterPresentations.length, 1);
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.presentation
        .yawRadians ?? 0) -
        Math.PI * 0.5
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.look.pitchRadians ?? 0) +
        0.35
    ) < 0.000001
  );
  assert.ok(
    Math.abs(
      (presentationState.remoteCharacterPresentations[0]?.look.yawRadians ?? 0) -
        Math.PI * 0.5
    ) < 0.000001
  );
  assert.ok(presentationState.remoteCharacterPresentations[0]?.aimCamera);
});

test("MetaverseRemoteWorldPresentationState starts remote grounded jump presentation from traversal authority before legacy jump-body lift arrives", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const jumpStartupSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        animationVocabulary: "idle",
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 0,
            y: 1.62,
            z: 24
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: localPlayerId,
        username: localUsername
      },
      {
        animationVocabulary: "idle",
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          jumpBody: {
            grounded: true,
            verticalSpeedUnitsPerSecond: 0
          },
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 8,
            y: 0.6,
            z: 18
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: remotePlayerId,
        traversalAuthority: resolveMetaverseTraversalAuthoritySnapshotInput({
          activeAction: {
            kind: "jump",
            phase: "startup"
          },
          currentTick: 11,
          locomotionMode: "grounded",
          mounted: false,
          pendingActionKind: "jump",
          pendingActionSequence: 2,
          resolvedActionKind: "none",
          resolvedActionSequence: 0,
          resolvedActionState: "none"
        }),
        username: remoteUsername,
        weaponState: createTestWeaponState("metaverse-service-pistol-v1")
      }
    ],
    snapshotSequence: 2,
    tick: {
      currentTick: 11,
      serverTimeMs: 1_050,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: jumpStartupSnapshot
    })
  });

  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation
      .animationVocabulary,
    "jump-up"
  );
});

test("MetaverseRemoteWorldPresentationState keeps a remote held-weapon pose camera available during grounded hip-fire", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sidearm-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sidearm");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const facingSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    includeVehicle: false,
    localPlayerId,
    localUsername,
    remoteLookPitchRadians: -0.2,
    remoteLookYawRadians: 0.35,
    remoteLocomotionMode: "grounded",
    remotePlayerId,
    remoteWeaponState: createTestWeaponState("metaverse-service-pistol-v1"),
    remotePlayerX: 6,
    remoteUsername,
    serverTimeMs: 1_000,
    snapshotSequence: 1,
    vehicleSeatOccupantPlayerId: null,
    vehicleX: 8,
    yawRadians: 0.1
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: facingSnapshot
    })
  });

  const remotePresentation =
    presentationState.remoteCharacterPresentations[0] ?? null;

  assert.notEqual(remotePresentation, null);
  assert.ok(remotePresentation?.aimCamera);
  assert.equal(remotePresentation?.aimCamera?.pitchRadians, -0.2);
  assert.ok(
    Math.abs((remotePresentation?.aimCamera?.yawRadians ?? 0) - 0.35) <
      0.000001
  );
});

test("MetaverseRemoteWorldPresentationState keeps remote jump loop airborne and lands on ground contact", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const risingSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        animationVocabulary: "idle",
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 0,
            y: 1.62,
            z: 24
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: localPlayerId,
        username: localUsername
      },
      {
        animationVocabulary: "idle",
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          jumpBody: {
            grounded: false,
            verticalSpeedUnitsPerSecond: 3.4
          },
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 8,
            y: 0.7,
            z: 18
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: remotePlayerId,
        traversalAuthority: resolveMetaverseTraversalAuthoritySnapshotInput({
          activeAction: {
            kind: "jump",
            phase: "rising"
          },
          currentTick: 11,
          locomotionMode: "grounded",
          mounted: false,
          pendingActionKind: "none",
          pendingActionSequence: 0,
          resolvedActionKind: "jump",
          resolvedActionSequence: 1,
          resolvedActionState: "accepted"
        }),
        username: remoteUsername,
        weaponState: createTestWeaponState(
          "metaverse-service-pistol-v1",
          "ads"
        )
      }
    ],
    snapshotSequence: 2,
    tick: {
      currentTick: 11,
      serverTimeMs: 1_050,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: risingSnapshot
    })
  });

  assert.equal(presentationState.remoteCharacterPresentations.length, 1);
  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation
      .animationVocabulary,
    "jump-up"
  );

  const apexSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        animationVocabulary: "idle",
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 0,
            y: 1.62,
            z: 24
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: localPlayerId,
        username: localUsername
      },
      {
        animationVocabulary: "idle",
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          jumpBody: {
            grounded: false,
            verticalSpeedUnitsPerSecond: 0.1
          },
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 8,
            y: 1.25,
            z: 18
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: remotePlayerId,
        traversalAuthority: resolveMetaverseTraversalAuthoritySnapshotInput({
          activeAction: {
            kind: "jump",
            phase: "rising"
          },
          currentTick: 12,
          locomotionMode: "grounded",
          mounted: false,
          pendingActionKind: "none",
          pendingActionSequence: 0,
          resolvedActionKind: "jump",
          resolvedActionSequence: 1,
          resolvedActionState: "accepted"
        }),
        username: remoteUsername,
        weaponState: createTestWeaponState(
          "metaverse-service-pistol-v1",
          "ads"
        )
      }
    ],
    snapshotSequence: 3,
    tick: {
      currentTick: 12,
      serverTimeMs: 1_100,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: apexSnapshot
    })
  });

  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation
      .animationVocabulary,
    "jump-mid"
  );

  const fallingSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        animationVocabulary: "idle",
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 0,
            y: 1.62,
            z: 24
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: localPlayerId,
        username: localUsername
      },
      {
        animationVocabulary: "idle",
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          jumpBody: {
            grounded: false,
            verticalSpeedUnitsPerSecond: -2.4
          },
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 8,
            y: 0.95,
            z: 18
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: remotePlayerId,
        traversalAuthority: resolveMetaverseTraversalAuthoritySnapshotInput({
          activeAction: {
            kind: "jump",
            phase: "falling"
          },
          currentTick: 13,
          locomotionMode: "grounded",
          mounted: false,
          pendingActionKind: "none",
          pendingActionSequence: 0,
          resolvedActionKind: "jump",
          resolvedActionSequence: 1,
          resolvedActionState: "accepted"
        }),
        username: remoteUsername,
        weaponState: createTestWeaponState(
          "metaverse-service-pistol-v1",
          "ads"
        )
      }
    ],
    snapshotSequence: 4,
    tick: {
      currentTick: 13,
      serverTimeMs: 1_150,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: fallingSnapshot
    })
  });

  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation
      .animationVocabulary,
    "jump-mid"
  );

  const landingSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        animationVocabulary: "idle",
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 0,
            y: 1.62,
            z: 24
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: localPlayerId,
        username: localUsername
      },
      {
        animationVocabulary: "idle",
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          jumpBody: {
            grounded: true,
            verticalSpeedUnitsPerSecond: 0
          },
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 8,
            y: 0.7,
            z: 18
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId: remotePlayerId,
        traversalAuthority: resolveMetaverseTraversalAuthoritySnapshotInput({
          activeAction: {
            kind: "none",
            phase: "idle"
          },
          currentTick: 14,
          locomotionMode: "grounded",
          mounted: false,
          pendingActionKind: "none",
          pendingActionSequence: 0,
          resolvedActionKind: "jump",
          resolvedActionSequence: 1,
          resolvedActionState: "accepted"
        }),
        username: remoteUsername,
        weaponState: createTestWeaponState(
          "metaverse-service-pistol-v1",
          "ads"
        )
      }
    ],
    snapshotSequence: 5,
    tick: {
      currentTick: 14,
      serverTimeMs: 1_200,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: landingSnapshot
    })
  });

  assert.equal(
    presentationState.remoteCharacterPresentations[0]?.presentation
      .animationVocabulary,
    "idle"
  );
  assert.ok(
    (presentationState.remoteCharacterPresentations[0]?.presentation.position.y ??
      0) > 0.45
  );
});


test("MetaverseRemoteWorldPresentationState reuses owner snapshots and drops stale remote entities across samples", async () => {
  const presentationState = await createPresentationState();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: createRealtimeWorldSnapshot({
        currentTick: 10,
        environmentBodyX: 4,
        includeEnvironmentBody: true,
        localPlayerId,
        localUsername,
        remotePlayerAngularVelocityRadiansPerSecond: 1,
        remotePlayerId,
        remotePlayerX: 8,
        remoteUsername,
        serverTimeMs: 1_000,
        snapshotSequence: 1,
        vehicleX: 8,
        yawRadians: 0
      })
    })
  });

  const initialCharacterPresentations =
    presentationState.remoteCharacterPresentations;
  const initialVehiclePresentations =
    presentationState.remoteVehiclePresentations;
  const initialEnvironmentBodyPresentations =
    presentationState.remoteEnvironmentBodyPresentations;
  const initialCharacterPresentation =
    initialCharacterPresentations[0] ?? null;
  const initialCharacterPosition =
    initialCharacterPresentation?.presentation.position ?? null;
  const initialVehiclePresentation =
    initialVehiclePresentations[0] ?? null;
  const initialVehiclePosition =
    initialVehiclePresentation?.position ?? null;
  const initialEnvironmentBodyPresentation =
    initialEnvironmentBodyPresentations[0] ?? null;
  const initialEnvironmentBodyPosition =
    initialEnvironmentBodyPresentation?.position ?? null;

  assert.notEqual(initialCharacterPresentation, null);
  assert.notEqual(initialCharacterPosition, null);
  assert.notEqual(initialVehiclePresentation, null);
  assert.notEqual(initialVehiclePosition, null);
  assert.notEqual(initialEnvironmentBodyPresentation, null);
  assert.notEqual(initialEnvironmentBodyPosition, null);

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.06,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: createRealtimeWorldSnapshot({
        currentTick: 11,
        environmentBodyX: 4,
        includeEnvironmentBody: true,
        localPlayerId,
        localUsername,
        remotePlayerAngularVelocityRadiansPerSecond: 1,
        remotePlayerId,
        remotePlayerX: 8,
        remoteUsername,
        serverTimeMs: 1_060,
        snapshotSequence: 2,
        vehicleX: 8,
        yawRadians: 0
      }),
      extrapolationSeconds: 0.06
    })
  });

  assert.strictEqual(
    presentationState.remoteCharacterPresentations,
    initialCharacterPresentations
  );
  assert.strictEqual(
    presentationState.remoteCharacterPresentations[0],
    initialCharacterPresentation
  );
  assert.strictEqual(
    presentationState.remoteCharacterPresentations[0]?.presentation.position,
    initialCharacterPosition
  );
  assert.strictEqual(
    presentationState.remoteVehiclePresentations,
    initialVehiclePresentations
  );
  assert.strictEqual(
    presentationState.remoteVehiclePresentations[0],
    initialVehiclePresentation
  );
  assert.strictEqual(
    presentationState.remoteVehiclePresentations[0]?.position,
    initialVehiclePosition
  );
  assert.strictEqual(
    presentationState.remoteEnvironmentBodyPresentations,
    initialEnvironmentBodyPresentations
  );
  assert.strictEqual(
    presentationState.remoteEnvironmentBodyPresentations[0],
    initialEnvironmentBodyPresentation
  );
  assert.strictEqual(
    presentationState.remoteEnvironmentBodyPresentations[0]?.position,
    initialEnvironmentBodyPosition
  );

  presentationState.syncAuthoritativeSample({
    deltaSeconds: 0.05,
    localPlayerId,
    sampledFrame: createSampledFrame({
      baseSnapshot: createRealtimeWorldSnapshot({
        currentTick: 12,
        includeEnvironmentBody: false,
        includeRemotePlayer: false,
        includeVehicle: false,
        localPlayerId,
        localUsername,
        remotePlayerId,
        remotePlayerX: 11,
        remoteUsername,
        serverTimeMs: 1_100,
        snapshotSequence: 3,
        vehicleX: 11
      })
    })
  });

  assert.equal(presentationState.remoteCharacterPresentations.length, 0);
  assert.equal(presentationState.remoteVehiclePresentations.length, 0);
  assert.equal(presentationState.remoteEnvironmentBodyPresentations.length, 0);
});
