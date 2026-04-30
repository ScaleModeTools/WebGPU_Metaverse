import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseIssuePlayerActionCommand,
  createMetaversePlayerId,
  createMetaversePlayerCombatHurtVolumes,
  createMetaverseRealtimePlayerWeaponStateSnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  readMetaverseCombatWeaponProfile,
  resolveMetaverseCombatSemanticWeaponTipFrame
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeCombatAuthority } from "../../../server/dist/metaverse/authority/combat/metaverse-authoritative-combat-authority.js";

function createPlayerRuntimeState(
  playerId,
  teamId,
  position,
  yawRadians = 0,
  weaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    aimMode: "hip-fire",
    weaponId: "metaverse-service-pistol-v2"
  })
) {
  return {
    linearVelocityX: 0,
    linearVelocityY: 0,
    linearVelocityZ: 0,
    locomotionMode: "grounded",
    lookPitchRadians: 0,
    lookYawRadians: yawRadians,
    mountedOccupancy: null,
    playerId,
    positionX: position.x,
    positionY: position.y,
    positionZ: position.z,
    stateSequence: 0,
    teamId,
    unmountedTraversalState: createMetaverseUnmountedTraversalStateSnapshot({
      locomotionMode: "grounded"
    }),
    weaponState,
    yawRadians
  };
}

function createForwardDirection(origin, target) {
  const deltaX = target.x - origin.x;
  const deltaY = target.y - origin.y;
  const deltaZ = target.z - origin.z;
  const length = Math.hypot(deltaX, deltaY, deltaZ);

  return Object.freeze({
    x: deltaX / length,
    y: deltaY / length,
    z: deltaZ / length
  });
}

function resolveWeaponTipOrigin(position, yawRadians, weaponId) {
  const originOffset = readMetaverseCombatWeaponProfile(weaponId)
    .firingOriginOffset;
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);

  return Object.freeze({
    x:
      position.x +
      rightX * originOffset.rightMeters +
      forwardX * originOffset.forwardMeters,
    y: position.y + originOffset.upMeters,
    z:
      position.z +
      rightZ * originOffset.rightMeters +
      forwardZ * originOffset.forwardMeters
  });
}

function resolveSemanticWeaponTipOrigin(position, yawRadians, weaponId, aimForward) {
  const weaponProfile = readMetaverseCombatWeaponProfile(weaponId);

  return resolveMetaverseCombatSemanticWeaponTipFrame({
    actorBodyPosition: position,
    actorBodyYawRadians: yawRadians,
    aimYawInfluence: 1,
    authoredMuzzleFromGrip:
      weaponProfile.projectilePresentation.authoredMuzzleFromGrip,
    firingOriginOffset: weaponProfile.firingOriginOffset,
    objectLocalMuzzleFrame:
      weaponProfile.projectilePresentation.objectLocalMuzzleFrame,
    objectLocalPrimaryGripFrame:
      weaponProfile.projectilePresentation.objectLocalPrimaryGripFrame,
    primaryGripAnchorOffset:
      weaponProfile.projectilePresentation.primaryGripAnchorOffset,
    semanticAimForward: aimForward,
    semanticLaunchOriginOffset:
      weaponProfile.projectilePresentation.semanticLaunchOriginOffset
  }).originWorld;
}

function readHurtRegionCenter(region) {
  if (region.shape === "sphere") {
    return region.sphere.center;
  }

  return Object.freeze({
    x: (region.capsule.start.x + region.capsule.end.x) / 2,
    y: (region.capsule.start.y + region.capsule.end.y) / 2,
    z: (region.capsule.start.z + region.capsule.end.z) / 2
  });
}

function createFireWeaponPlayerActionCommand({
  actionSequence,
  aimMode,
  issuedAtAuthoritativeTimeMs,
  omitRayForwardWorld = false,
  omitRayOriginWorld = false,
  origin,
  playerId,
  rayForwardWorld,
  rayOriginWorld,
  target,
  weaponId
}) {
  const forwardDirection = createForwardDirection(origin, target);
  const planarMagnitude = Math.hypot(forwardDirection.x, forwardDirection.z);

  return createMetaverseIssuePlayerActionCommand({
    action: {
      ...(aimMode === undefined ? {} : { aimMode }),
      actionSequence,
      aimSnapshot: {
        pitchRadians: Math.atan2(forwardDirection.y, planarMagnitude),
        ...(omitRayForwardWorld
          ? {}
          : {
              rayForwardWorld: rayForwardWorld ?? forwardDirection
            }),
        ...(omitRayOriginWorld
          ? {}
          : {
              rayOriginWorld: rayOriginWorld ?? origin
            }),
        yawRadians: Math.atan2(forwardDirection.x, -forwardDirection.z)
      },
      issuedAtAuthoritativeTimeMs,
      kind: "fire-weapon",
      weaponId
    },
    playerId
  });
}

function createSwitchActiveWeaponSlotCommand({
  actionSequence,
  intendedWeaponInstanceId,
  issuedAtAuthoritativeTimeMs,
  playerId,
  requestedActiveSlotId
}) {
  return createMetaverseIssuePlayerActionCommand({
    action: {
      actionSequence,
      ...(intendedWeaponInstanceId === undefined
        ? {}
        : { intendedWeaponInstanceId }),
      issuedAtAuthoritativeTimeMs,
      kind: "switch-active-weapon-slot",
      requestedActiveSlotId
    },
    playerId
  });
}

function createInteractWeaponResourceCommand({
  actionSequence,
  intendedWeaponInstanceId,
  issuedAtAuthoritativeTimeMs,
  playerId,
  requestedActiveSlotId
}) {
  return createMetaverseIssuePlayerActionCommand({
    action: {
      actionSequence,
      ...(intendedWeaponInstanceId === undefined
        ? {}
        : { intendedWeaponInstanceId }),
      issuedAtAuthoritativeTimeMs,
      kind: "interact-weapon-resource",
      requestedActiveSlotId
    },
    playerId
  });
}

function createDualWeaponState(playerId, activeSlotId = "primary") {
  const primaryWeaponInstanceId = `${playerId}:primary:metaverse-service-pistol-v2`;
  const secondaryWeaponInstanceId = `${playerId}:secondary:metaverse-rocket-launcher-v1`;

  return createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId,
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: primaryWeaponInstanceId
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: secondaryWeaponInstanceId
      }
    ],
    weaponId:
      activeSlotId === "secondary"
        ? "metaverse-rocket-launcher-v1"
        : "metaverse-service-pistol-v2"
  });
}

function createBattleRifleWeaponState(playerId, activeSlotId = "primary") {
  const primaryWeaponInstanceId = `${playerId}:primary:metaverse-battle-rifle-v1`;
  const secondaryWeaponInstanceId = `${playerId}:secondary:metaverse-rocket-launcher-v1`;

  return createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId,
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-battle-rifle-v1",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-battle-rifle-v1",
        weaponInstanceId: primaryWeaponInstanceId
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: secondaryWeaponInstanceId
      }
    ],
    weaponId:
      activeSlotId === "secondary"
        ? "metaverse-rocket-launcher-v1"
        : "metaverse-battle-rifle-v1"
  });
}

function createSingleWeaponState(playerId, weaponId) {
  return createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "primary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: weaponId,
        equipped: true,
        slotId: "primary",
        weaponId,
        weaponInstanceId: `${playerId}:primary:${weaponId}`
      }
    ],
    weaponId
  });
}

function createKillFloorVolume({
  centerY = -5,
  sizeX = 64,
  sizeZ = 64
} = {}) {
  return Object.freeze({
    center: Object.freeze({
      x: 0,
      y: centerY,
      z: 0
    }),
    label: "Kill Floor",
    priority: -1,
    rotationYRadians: 0,
    routePoints: Object.freeze([]),
    size: Object.freeze({
      x: sizeX,
      y: 0.5,
      z: sizeZ
    }),
    tags: Object.freeze(["environment", "kill-floor"]),
    teamId: null,
    volumeId: "kill-floor",
    volumeKind: "kill-floor"
  });
}

function createCombatAuthorityForPlayers(playersById) {
  const authorityPlayersById = new Map(playersById);

  if (authorityPlayersById.size < 2) {
    const sparringPlayerId = createMetaversePlayerId("combat-resource-sparring");

    assert.notEqual(sparringPlayerId, null);
    authorityPlayersById.set(
      sparringPlayerId,
      createPlayerRuntimeState(
        sparringPlayerId,
        "blue",
        Object.freeze({
          x: 32,
          y: 0,
          z: 32
        })
      )
    );
  }

  return new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: authorityPlayersById,
    readTickIntervalMs: () => 33,
    resolveRespawnPose() {
      return {
        position: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });
}

function createWeaponPickupResourceSpawn(overrides = {}) {
  return Object.freeze({
    ammoGrantRounds: 48,
    assetId: "metaverse-service-pistol-v2",
    label: "Pistol pickup",
    modeTags: Object.freeze(["team-deathmatch"]),
    pickupRadiusMeters: 1.4,
    position: Object.freeze({
      x: 0,
      y: 0.6,
      z: 0
    }),
    resourceKind: "weapon-pickup",
    respawnCooldownMs: 30_000,
    spawnId: "resource:pistol",
    weaponId: "metaverse-service-pistol-v2",
    yawRadians: 0,
    ...overrides
  });
}

function firePistolRound({
  actionSequence,
  combatAuthority,
  nowMs,
  playerId
}) {
  const origin = resolveWeaponTipOrigin(
    Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    0,
    "metaverse-service-pistol-v2"
  );

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence,
      issuedAtAuthoritativeTimeMs: nowMs,
      origin,
      playerId,
      target: Object.freeze({
        x: 12,
        y: origin.y,
        z: origin.z
      }),
      weaponId: "metaverse-service-pistol-v2"
    }),
    nowMs
  );
}

test("MetaverseAuthoritativeCombatAuthority resolves floor-root body/head hits and respawns players after 3 seconds", () => {
  const redPlayerId = createMetaversePlayerId("combat-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: 0
  });
  const blueRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: -9
  });
  const blueRespawnPosition = Object.freeze({
    x: 12,
    y: 0,
    z: -4
  });
  const blueRespawnYawRadians = Math.PI * 0.25;
  const redMuzzleOrigin = Object.freeze({
    x: 0,
    y: 1.62,
    z: 0
  });
  const blueBodyTarget = Object.freeze({
    x: blueRespawnPosition.x,
    y: 0.95,
    z: blueRespawnPosition.z
  });
  const blueHeadTarget = Object.freeze({
    x: blueRespawnPosition.x,
    y: 1.58,
    z: blueRespawnPosition.z
  });
  const blueRespawnHeadTarget = Object.freeze({
    x: blueRespawnPosition.x,
    y: 1.58,
    z: blueRespawnPosition.z
  });

  const playersById = new Map([
    [
      redPlayerId,
      createPlayerRuntimeState(redPlayerId, "red", redRootPosition)
    ],
    [
      bluePlayerId,
      createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
    ]
  ]);
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById,
    readTickIntervalMs: () => 33,
    resolveRespawnPose(_playerId, teamId) {
      return {
        position: teamId === "red" ? redRootPosition : blueRespawnPosition,
        yawRadians: teamId === "red" ? 0 : blueRespawnYawRadians
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      aimMode: "hip-fire",
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_050,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      aimMode: "hip-fire",
      actionSequence: 2,
      issuedAtAuthoritativeTimeMs: 1_250,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target: blueHeadTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_400
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      aimMode: "hip-fire",
      actionSequence: 3,
      issuedAtAuthoritativeTimeMs: 1_450,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target: blueHeadTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_600
  );

  const preRespawnRedCombatSnapshot =
    combatAuthority.readPlayerCombatSnapshot(redPlayerId);
  const preRespawnBlueCombatSnapshot =
    combatAuthority.readPlayerCombatSnapshot(bluePlayerId);
  const combatMatchSnapshot = combatAuthority.readCombatMatchSnapshot();
  const damageFeedEvents = combatAuthority
    .readCombatFeedSnapshots()
    .filter((eventSnapshot) => eventSnapshot.type === "damage");
  const killFeedEvent = combatAuthority
    .readCombatFeedSnapshots()
    .find((eventSnapshot) => eventSnapshot.type === "kill");

  assert.equal(preRespawnRedCombatSnapshot?.kills, 1);
  assert.equal(preRespawnRedCombatSnapshot?.headshotKills, 1);
  assert.equal(
    preRespawnRedCombatSnapshot?.weaponStats.find(
      (weaponStats) => weaponStats.weaponId === "metaverse-service-pistol-v2"
    )?.shotsHit,
    3
  );
  assert.equal(damageFeedEvents.length, 2);
  assert.equal(damageFeedEvents[0]?.hitZone, "body");
  assert.equal(damageFeedEvents[0]?.sourceActionSequence, 1);
  assert.equal(damageFeedEvents[0]?.sourceProjectileId, null);
  assert.equal(damageFeedEvents[1]?.hitZone, "head");
  assert.equal(damageFeedEvents[1]?.sourceActionSequence, 2);
  assert.equal(damageFeedEvents[1]?.sourceProjectileId, null);
  assert.equal(preRespawnBlueCombatSnapshot?.alive, false);
  assert.equal(preRespawnBlueCombatSnapshot?.deaths, 1);
  assert.equal(preRespawnBlueCombatSnapshot?.health, 0);
  assert.equal(preRespawnBlueCombatSnapshot?.respawnRemainingMs, 3_000);
  assert.equal(combatMatchSnapshot.respawnDelayMs, 3_000);
  assert.equal(combatMatchSnapshot.teams[0]?.score, 1);
  assert.equal(combatMatchSnapshot.teams[1]?.score, 0);
  assert.equal(killFeedEvent?.type, "kill");
  assert.equal(killFeedEvent?.attackerPlayerId, redPlayerId);
  assert.equal(killFeedEvent?.headshot, true);
  assert.equal(killFeedEvent?.sourceActionSequence, 3);
  assert.equal(killFeedEvent?.sourceProjectileId, null);
  assert.equal(killFeedEvent?.targetPlayerId, bluePlayerId);

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      aimMode: "hip-fire",
      actionSequence: 4,
      issuedAtAuthoritativeTimeMs: 1_650,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target: blueHeadTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_800
  );

  assert.equal(
    combatAuthority
      .readPlayerCombatSnapshot(redPlayerId)
      ?.weaponStats.find(
        (weaponStats) => weaponStats.weaponId === "metaverse-service-pistol-v2"
      )?.shotsHit,
    3
  );

  combatAuthority.advanceCombatRuntimes(3.1, 4_700);

  const respawnedBlueCombatSnapshot =
    combatAuthority.readPlayerCombatSnapshot(bluePlayerId);
  const bluePlayerRuntime = playersById.get(bluePlayerId);

  assert.equal(respawnedBlueCombatSnapshot?.alive, true);
  assert.equal(respawnedBlueCombatSnapshot?.health, 100);
  assert.equal(respawnedBlueCombatSnapshot?.respawnRemainingMs, 0);
  assert.equal(respawnedBlueCombatSnapshot?.spawnProtectionRemainingMs, 1_000);
  assert.equal(respawnedBlueCombatSnapshot?.activeWeapon?.ammoInMagazine, 12);
  assert.equal(respawnedBlueCombatSnapshot?.activeWeapon?.ammoInReserve, 48);
  assert.notEqual(bluePlayerRuntime, undefined);
  assert.equal(bluePlayerRuntime?.linearVelocityX, 0);
  assert.equal(bluePlayerRuntime?.linearVelocityY, 0);
  assert.equal(bluePlayerRuntime?.linearVelocityZ, 0);
  assert.equal(bluePlayerRuntime?.locomotionMode, "grounded");
  assert.equal(bluePlayerRuntime?.mountedOccupancy, null);
  assert.equal(bluePlayerRuntime?.lookPitchRadians, 0);
  assert.equal(bluePlayerRuntime?.lookYawRadians, blueRespawnYawRadians);
  assert.equal(bluePlayerRuntime?.positionX, blueRespawnPosition.x);
  assert.equal(bluePlayerRuntime?.positionY, blueRespawnPosition.y);
  assert.equal(bluePlayerRuntime?.positionZ, blueRespawnPosition.z);
  assert.equal(bluePlayerRuntime?.yawRadians, blueRespawnYawRadians);
  assert.ok((bluePlayerRuntime?.stateSequence ?? 0) > 0);

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      aimMode: "hip-fire",
      actionSequence: 5,
      issuedAtAuthoritativeTimeMs: 4_560,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target: blueRespawnHeadTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    4_710
  );

  assert.equal(combatAuthority.readPlayerCombatSnapshot(bluePlayerId)?.health, 100);
  assert.equal(
    combatAuthority
      .readPlayerCombatSnapshot(redPlayerId)
      ?.weaponStats.find(
        (weaponStats) => weaponStats.weaponId === "metaverse-service-pistol-v2"
      )?.shotsHit,
    3
  );
});

test("MetaverseAuthoritativeCombatAuthority uses validated reticle rays for close hitscan truth", () => {
  const redPlayerId = createMetaversePlayerId("combat-reticle-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-reticle-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: 0
  });
  const blueRootPosition = Object.freeze({
    x: 0.8,
    y: 0,
    z: -2
  });
  const firingReferenceOrigin = resolveWeaponTipOrigin(
    redRootPosition,
    0,
    "metaverse-service-pistol-v2"
  );
  const cameraRayOrigin = Object.freeze({
    x: 0.8,
    y: 1.62,
    z: 0
  });
  const blueBodyTarget = Object.freeze({
    x: 0.8,
    y: 0.95,
    z: -2
  });
  const playersById = new Map([
    [
      redPlayerId,
      createPlayerRuntimeState(redPlayerId, "red", redRootPosition)
    ],
    [
      bluePlayerId,
      createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
    ]
  ]);
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    authoritativeCombatRewindEnabled: true,
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById,
    readTickIntervalMs: () => 33,
    resolveRespawnPose(_playerId, teamId) {
      return {
        position: teamId === "red" ? redRootPosition : blueRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_050,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      rayForwardWorld: createForwardDirection(cameraRayOrigin, blueBodyTarget),
      rayOriginWorld: cameraRayOrigin,
      target: {
        x: 0,
        y: 0.95,
        z: -2
      },
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );

  assert.equal(
    combatAuthority
      .readPlayerCombatSnapshot(redPlayerId)
      ?.weaponStats.find(
        (weaponStats) => weaponStats.weaponId === "metaverse-service-pistol-v2"
      )?.shotsHit,
    1
  );
});

test("MetaverseAuthoritativeCombatAuthority registers upper-chest body hits below head volume", () => {
  const redPlayerId = createMetaversePlayerId("combat-upper-body-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-upper-body-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: 0
  });
  const blueRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: -3
  });
  const firingReferenceOrigin = resolveWeaponTipOrigin(
    redRootPosition,
    0,
    "metaverse-service-pistol-v2"
  );
  const blueUpperChestTarget = Object.freeze({
    x: blueRootPosition.x,
    y: 1.34,
    z: blueRootPosition.z
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    authoritativeCombatRewindEnabled: true,
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(redPlayerId, "red", redRootPosition)
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose(_playerId, teamId) {
      return {
        position: teamId === "red" ? redRootPosition : blueRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_050,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      rayForwardWorld: createForwardDirection(
        firingReferenceOrigin,
        blueUpperChestTarget
      ),
      rayOriginWorld: firingReferenceOrigin,
      target: blueUpperChestTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );

  assert.equal(combatAuthority.readPlayerCombatSnapshot(bluePlayerId)?.health, 76);
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(redPlayerId)?.headshotKills,
    0
  );
  assert.equal(
    combatAuthority
      .readCombatFeedSnapshots()
      .find((eventSnapshot) => eventSnapshot.type === "damage")?.hitZone,
    "body"
  );
});

test("MetaverseAuthoritativeCombatAuthority registers humanoid lower-body hurt regions", () => {
  const redPlayerId = createMetaversePlayerId("combat-leg-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-leg-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: 0
  });
  const blueRootPosition = Object.freeze({
    x: 0.35,
    y: 0,
    z: -3
  });
  const firingReferenceOrigin = Object.freeze({
    x: 0,
    y: 1.62,
    z: 0
  });
  const blueHurtVolumes = createMetaversePlayerCombatHurtVolumes({
    activeBodyPosition: blueRootPosition
  });
  const blueFootRegion = blueHurtVolumes.regions.find(
    (region) => region.regionId === "foot_l"
  );

  assert.notEqual(blueFootRegion, undefined);

  const blueFootTarget = readHurtRegionCenter(blueFootRegion);
  const playersById = new Map([
    [
      redPlayerId,
      createPlayerRuntimeState(redPlayerId, "red", redRootPosition)
    ],
    [
      bluePlayerId,
      createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
    ]
  ]);
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    authoritativeCombatRewindEnabled: true,
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById,
    readTickIntervalMs: () => 33,
    resolveRespawnPose(_playerId, teamId) {
      return {
        position: teamId === "red" ? redRootPosition : blueRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_050,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      rayForwardWorld: createForwardDirection(
        firingReferenceOrigin,
        blueFootTarget
      ),
      rayOriginWorld: firingReferenceOrigin,
      target: blueFootTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );

  assert.equal(
    combatAuthority
      .readPlayerCombatSnapshot(redPlayerId)
      ?.weaponStats.find(
        (weaponStats) => weaponStats.weaponId === "metaverse-service-pistol-v2"
      )?.shotsHit,
    1
  );
  assert.equal(combatAuthority.readPlayerCombatSnapshot(bluePlayerId)?.health, 76);
  assert.equal(
    combatAuthority
      .readCombatFeedSnapshots()
      .find((eventSnapshot) => eventSnapshot.type === "damage")?.hitZone,
    "body"
  );
});

test("MetaverseAuthoritativeCombatAuthority rejects invalid reticle ray origin and direction", () => {
  const redPlayerId = createMetaversePlayerId("combat-reticle-red-2");
  const bluePlayerId = createMetaversePlayerId("combat-reticle-blue-2");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: 0
  });
  const blueRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: -9
  });
  const firingReferenceOrigin = Object.freeze({
    x: 0,
    y: 1.62,
    z: 0
  });
  const blueBodyTarget = Object.freeze({
    x: 0,
    y: 0.95,
    z: -9
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    authoritativeCombatRewindEnabled: true,
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(redPlayerId, "red", redRootPosition)
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose(_playerId, teamId) {
      return {
        position: teamId === "red" ? redRootPosition : blueRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_050,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      rayForwardWorld: createForwardDirection(firingReferenceOrigin, blueBodyTarget),
      rayOriginWorld: {
        x: 10,
        y: 1.62,
        z: 0
      },
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 2,
      issuedAtAuthoritativeTimeMs: 1_250,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      rayForwardWorld: {
        x: 0,
        y: 0,
        z: 0
      },
      rayOriginWorld: firingReferenceOrigin,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_300
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 3,
      issuedAtAuthoritativeTimeMs: 1_350,
      omitRayOriginWorld: true,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_400
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 4,
      issuedAtAuthoritativeTimeMs: 1_450,
      omitRayForwardWorld: true,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_500
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 5,
      issuedAtAuthoritativeTimeMs: 1_550,
      omitRayForwardWorld: true,
      omitRayOriginWorld: true,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_600
  );

  const receiptSnapshot =
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId);

  assert.equal(
    receiptSnapshot?.recentPlayerActionReceipts[0]?.rejectionReason,
    "invalid-origin"
  );
  assert.equal(
    receiptSnapshot?.recentPlayerActionReceipts[1]?.rejectionReason,
    "invalid-direction"
  );
  assert.equal(
    receiptSnapshot?.recentPlayerActionReceipts[2]?.rejectionReason,
    "invalid-origin"
  );
  assert.equal(
    receiptSnapshot?.recentPlayerActionReceipts[3]?.rejectionReason,
    "invalid-direction"
  );
  assert.equal(
    receiptSnapshot?.recentPlayerActionReceipts[4]?.rejectionReason,
    "invalid-origin"
  );
  assert.equal(
    receiptSnapshot?.latestShotResolutionTelemetry?.finalReason,
    "rejected-missing-origin"
  );
});

test("MetaverseAuthoritativeCombatAuthority validates camera-ray hits against authoritative firing line of sight", () => {
  const redPlayerId = createMetaversePlayerId("combat-reticle-red-3");
  const bluePlayerId = createMetaversePlayerId("combat-reticle-blue-3");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: 0
  });
  const blueRootPosition = Object.freeze({
    x: 0.8,
    y: 0,
    z: -2
  });
  const firingReferenceOrigin = resolveWeaponTipOrigin(
    redRootPosition,
    0,
    "metaverse-service-pistol-v2"
  );
  const cameraRayOrigin = Object.freeze({
    x: 0.8,
    y: 1.62,
    z: 0
  });
  const blueBodyTarget = Object.freeze({
    x: 0.8,
    y: 0.95,
    z: -2
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    authoritativeCombatRewindEnabled: true,
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay(origin, direction, maxDistanceMeters) {
        if (
          Math.abs(origin.x - firingReferenceOrigin.x) < 0.000001 &&
          Math.abs(origin.z - firingReferenceOrigin.z) < 0.000001
        ) {
          return Object.freeze({
            collider: 42,
            distanceMeters: Math.min(0.5, maxDistanceMeters),
            point: Object.freeze({
              x: origin.x + direction.x * 0.5,
              y: origin.y + direction.y * 0.5,
              z: origin.z + direction.z * 0.5
            })
          });
        }

        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(redPlayerId, "red", redRootPosition)
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose(_playerId, teamId) {
      return {
        position: teamId === "red" ? redRootPosition : blueRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_050,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      rayForwardWorld: createForwardDirection(cameraRayOrigin, blueBodyTarget),
      rayOriginWorld: cameraRayOrigin,
      target: {
        x: 0,
        y: 0.95,
        z: -2
      },
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );

  assert.equal(
    combatAuthority
      .readPlayerCombatSnapshot(redPlayerId)
      ?.weaponStats.find(
        (weaponStats) => weaponStats.weaponId === "metaverse-service-pistol-v2"
      )?.shotsHit,
    0
  );
  assert.equal(
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.latestShotResolutionTelemetry?.finalReason,
    "blocked-by-firing-reference-los"
  );
  assert.equal(
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.latestShotResolutionTelemetry?.lineOfSightBlocked,
    true
  );
});

test("MetaverseAuthoritativeCombatAuthority orders world blockers and player hits on the same semantic ray", () => {
  const redPlayerId = createMetaversePlayerId("combat-hit-order-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-hit-order-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 0, y: 0, z: -3 });
  const firingReferenceOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const blueBodyTarget = Object.freeze({ x: 0, y: 0.95, z: -3 });
  let worldHitDistanceMeters = 0.5;
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    authoritativeCombatRewindEnabled: true,
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay(origin, direction) {
        return Object.freeze({
          collider: 42,
          distanceMeters: worldHitDistanceMeters,
          point: Object.freeze({
            x: origin.x + direction.x * worldHitDistanceMeters,
            y: origin.y + direction.y * worldHitDistanceMeters,
            z: origin.z + direction.z * worldHitDistanceMeters
          })
        });
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [redPlayerId, createPlayerRuntimeState(redPlayerId, "red", redRootPosition)],
      [bluePlayerId, createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose(_playerId, teamId) {
      return {
        position: teamId === "red" ? redRootPosition : blueRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_050,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );

  assert.equal(
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.latestShotResolutionTelemetry?.finalReason,
    "hit-world-before-player"
  );
  assert.equal(
    combatAuthority
      .readPlayerCombatSnapshot(redPlayerId)
      ?.weaponStats.find(
        (weaponStats) => weaponStats.weaponId === "metaverse-service-pistol-v2"
      )?.shotsHit,
    0
  );

  worldHitDistanceMeters = 9;
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 2,
      issuedAtAuthoritativeTimeMs: 1_250,
      origin: firingReferenceOrigin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_500
  );

  assert.equal(
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.latestShotResolutionTelemetry?.finalReason,
    "hit-player"
  );
  assert.equal(combatAuthority.readPlayerCombatSnapshot(bluePlayerId)?.health, 76);
});

test("MetaverseAuthoritativeCombatAuthority publishes exactly-once combat action receipts for accepted and rejected fire commands", () => {
  const redPlayerId = createMetaversePlayerId("combat-receipt-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-receipt-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: 0
  });
  const blueRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: -9
  });
  const redMuzzleOrigin = Object.freeze({
    x: 0,
    y: 1.62,
    z: 0
  });
  const blueBodyTarget = Object.freeze({
    x: 0,
    y: 0.95,
    z: -9
  });
  let snapshotSequence = 0;

  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {
      snapshotSequence += 1;
    },
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(redPlayerId, "red", redRootPosition)
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose(_playerId, teamId) {
      return {
        position: teamId === "red" ? redRootPosition : blueRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  const snapshotSequenceBeforeFirstShot = snapshotSequence;

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_050,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );

  const acceptedReceiptSnapshot =
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId);
  const snapshotSequenceAfterAcceptedShot = snapshotSequence;

  assert.ok(snapshotSequenceAfterAcceptedShot > snapshotSequenceBeforeFirstShot);
  assert.equal(
    acceptedReceiptSnapshot?.highestProcessedPlayerActionSequence,
    1
  );
  assert.equal(
    acceptedReceiptSnapshot?.recentPlayerActionReceipts[0]?.status,
    "accepted"
  );
  assert.equal(
    acceptedReceiptSnapshot?.recentPlayerActionReceipts[0]?.sourceProjectileId,
    null
  );
  assert.equal(combatAuthority.readProjectileSnapshots().length, 0);
  assert.deepEqual(
    combatAuthority
      .readCombatEventSnapshots()
      .map((eventSnapshot) => eventSnapshot.eventKind),
    ["hitscan-resolved"]
  );
  assert.equal(
    combatAuthority.readCombatEventSnapshots()[0]?.shotId,
    `${redPlayerId}:1`
  );

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_150,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_220
  );

  assert.equal(snapshotSequence, snapshotSequenceAfterAcceptedShot);
  assert.equal(
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.recentPlayerActionReceipts[0]?.status,
    "accepted"
  );

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 2,
      issuedAtAuthoritativeTimeMs: 1_250,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_250
  );

  const rejectedReceiptSnapshot =
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId);

  assert.ok(snapshotSequence > snapshotSequenceAfterAcceptedShot);
  assert.equal(
    rejectedReceiptSnapshot?.highestProcessedPlayerActionSequence,
    2
  );
  assert.equal(
    rejectedReceiptSnapshot?.recentPlayerActionReceipts[1]?.status,
    "rejected"
  );
  assert.equal(
    rejectedReceiptSnapshot?.recentPlayerActionReceipts[1]?.rejectionReason,
    "cooldown"
  );
  assert.equal(
    rejectedReceiptSnapshot?.recentPlayerActionReceipts[1]?.sourceProjectileId,
    null
  );
  assert.deepEqual(
    combatAuthority
      .readCombatEventSnapshots()
      .map((eventSnapshot) => eventSnapshot.eventKind),
    ["hitscan-resolved"]
  );
});

test("MetaverseAuthoritativeCombatAuthority rejects inactive pistol and accepts active rocket fire by server slot truth", () => {
  const redPlayerId = createMetaversePlayerId("combat-loadout-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-loadout-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: 0
  });
  const blueRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: -9
  });
  const redMuzzleOrigin = Object.freeze({
    x: 0,
    y: 1.62,
    z: 0
  });
  const target = Object.freeze({
    x: 0,
    y: 1.4,
    z: -10
  });
  const rocketActiveWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "secondary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: "red:primary:metaverse-service-pistol-v2"
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: "red:secondary:metaverse-rocket-launcher-v1"
      }
    ],
    weaponId: "metaverse-rocket-launcher-v1"
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(
          redPlayerId,
          "red",
          redRootPosition,
          0,
          rocketActiveWeaponState
        )
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose() {
      return {
        position: redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_050,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );

  assert.equal(
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.recentPlayerActionReceipts[0]?.rejectionReason,
    "inactive-weapon"
  );

  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 2,
      issuedAtAuthoritativeTimeMs: 1_250,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_250
  );

  assert.equal(
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.recentPlayerActionReceipts[1]?.rejectionReason,
    null
  );
  assert.equal(
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.recentPlayerActionReceipts[1]?.status,
    "accepted"
  );
  assert.equal(combatAuthority.readProjectileSnapshots().length, 1);
  assert.equal(
    combatAuthority.readProjectileSnapshots()[0]?.weaponId,
    "metaverse-rocket-launcher-v1"
  );
  assert.deepEqual(
    combatAuthority
      .readCombatEventSnapshots()
      .map((eventSnapshot) => eventSnapshot.eventKind),
    ["projectile-spawned"]
  );
  assert.equal(
    combatAuthority.readCombatEventSnapshots()[0]?.projectileId,
    `${redPlayerId}:2`
  );
});

test("MetaverseAuthoritativeCombatAuthority applies sequenced weapon slot switches before fire validation", () => {
  const redPlayerId = createMetaversePlayerId("combat-switch-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-switch-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 0, y: 0, z: -9 });
  const redMuzzleOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const target = Object.freeze({ x: 0, y: 1.4, z: -10 });
  const redWeaponState = createDualWeaponState(redPlayerId, "primary");
  const redPlayerRuntime = createPlayerRuntimeState(
    redPlayerId,
    "red",
    redRootPosition,
    0,
    redWeaponState
  );
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [redPlayerId, redPlayerRuntime],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose() {
      return {
        position: redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_100,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_120
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createSwitchActiveWeaponSlotCommand({
      actionSequence: 2,
      intendedWeaponInstanceId:
        redWeaponState.slots[1]?.weaponInstanceId ?? "missing-secondary",
      issuedAtAuthoritativeTimeMs: 1_130,
      playerId: redPlayerId,
      requestedActiveSlotId: "secondary"
    }),
    1_130
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 3,
      issuedAtAuthoritativeTimeMs: 1_250,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_250
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createSwitchActiveWeaponSlotCommand({
      actionSequence: 4,
      intendedWeaponInstanceId: "stale-primary-instance",
      issuedAtAuthoritativeTimeMs: 1_260,
      playerId: redPlayerId,
      requestedActiveSlotId: "primary"
    }),
    1_260
  );

  const receipts =
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.recentPlayerActionReceipts ?? [];

  assert.equal(receipts[0]?.kind, "fire-weapon");
  assert.equal(receipts[0]?.rejectionReason, "inactive-weapon");
  assert.equal(receipts[1]?.kind, "switch-active-weapon-slot");
  assert.equal(receipts[1]?.status, "accepted");
  assert.equal(receipts[1]?.activeSlotId, "secondary");
  assert.equal(receipts[1]?.weaponId, "metaverse-rocket-launcher-v1");
  assert.equal(receipts[2]?.kind, "fire-weapon");
  assert.equal(receipts[2]?.status, "accepted");
  assert.equal(receipts[3]?.kind, "switch-active-weapon-slot");
  assert.equal(receipts[3]?.status, "rejected");
  assert.equal(receipts[3]?.rejectionReason, "stale-weapon-state");
  assert.equal(redPlayerRuntime.weaponState?.activeSlotId, "secondary");
  assert.equal(redPlayerRuntime.weaponState?.aimMode, "hip-fire");
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(redPlayerId)?.activeWeapon?.weaponId,
    "metaverse-rocket-launcher-v1"
  );
  assert.equal(
    combatAuthority
      .readPlayerCombatSnapshot(redPlayerId)
      ?.weaponInventory.some(
        (weaponSnapshot) =>
          weaponSnapshot.weaponId === "metaverse-service-pistol-v2"
      ),
    true
  );
  assert.equal(combatAuthority.readProjectileSnapshots().length, 1);
});

test("MetaverseAuthoritativeCombatAuthority tracks fire cooldown per equipped weapon", () => {
  const redPlayerId = createMetaversePlayerId("combat-switch-cooldown-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-switch-cooldown-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 0, y: 0, z: -9 });
  const redMuzzleOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const target = Object.freeze({ x: 0, y: 1.4, z: -10 });
  const redWeaponState = createDualWeaponState(redPlayerId, "primary");
  const redPlayerRuntime = createPlayerRuntimeState(
    redPlayerId,
    "red",
    redRootPosition,
    0,
    redWeaponState
  );
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [redPlayerId, redPlayerRuntime],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose() {
      return {
        position: redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createSwitchActiveWeaponSlotCommand({
      actionSequence: 2,
      intendedWeaponInstanceId:
        redWeaponState.slots[1]?.weaponInstanceId ?? "missing-secondary",
      issuedAtAuthoritativeTimeMs: 1_210,
      playerId: redPlayerId,
      requestedActiveSlotId: "secondary"
    }),
    1_210
  );
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 3,
      issuedAtAuthoritativeTimeMs: 1_220,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_220
  );

  const receipts =
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.recentPlayerActionReceipts ?? [];

  assert.equal(receipts[0]?.kind, "fire-weapon");
  assert.equal(receipts[0]?.weaponId, "metaverse-service-pistol-v2");
  assert.equal(receipts[0]?.status, "accepted");
  assert.equal(receipts[1]?.kind, "switch-active-weapon-slot");
  assert.equal(receipts[1]?.status, "accepted");
  assert.equal(receipts[2]?.kind, "fire-weapon");
  assert.equal(receipts[2]?.weaponId, "metaverse-rocket-launcher-v1");
  assert.equal(receipts[2]?.status, "accepted");
  assert.equal(receipts[2]?.rejectionReason, null);
  assert.equal(combatAuthority.readProjectileSnapshots().length, 1);
  assert.equal(
    combatAuthority.readProjectileSnapshots()[0]?.weaponId,
    "metaverse-rocket-launcher-v1"
  );
});

test("MetaverseAuthoritativeCombatAuthority publishes one hitscan event per battle rifle burst round", () => {
  const redPlayerId = createMetaversePlayerId("combat-burst-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-burst-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 0, y: 0, z: -18 });
  const redWeaponState = createBattleRifleWeaponState(redPlayerId, "primary");
  const redPlayerRuntime = createPlayerRuntimeState(
    redPlayerId,
    "red",
    redRootPosition,
    0,
    redWeaponState
  );
  const combatAuthority = createCombatAuthorityForPlayers(
    new Map([
      [redPlayerId, redPlayerRuntime],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ])
  );
  const origin = resolveWeaponTipOrigin(
    redRootPosition,
    0,
    "metaverse-battle-rifle-v1"
  );

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin,
      playerId: redPlayerId,
      target: Object.freeze({
        x: 12,
        y: origin.y,
        z: origin.z
      }),
      weaponId: "metaverse-battle-rifle-v1"
    }),
    1_200
  );

  const combatSnapshot = combatAuthority.readPlayerCombatSnapshot(redPlayerId);
  const battleStats = combatSnapshot?.weaponStats.find(
    (weaponStats) => weaponStats.weaponId === "metaverse-battle-rifle-v1"
  ) ?? null;
  const events = combatAuthority.readCombatEventSnapshots();

  assert.equal(combatSnapshot?.activeWeapon?.weaponId, "metaverse-battle-rifle-v1");
  assert.equal(combatSnapshot?.activeWeapon?.ammoInMagazine, 33);
  assert.equal(battleStats?.shotsFired, 3);
  assert.deepEqual(
    events.map((eventSnapshot) => eventSnapshot.eventKind),
    [
      "hitscan-resolved",
      "hitscan-resolved",
      "hitscan-resolved"
    ]
  );
  assert.deepEqual(
    events.map((eventSnapshot) => eventSnapshot.shotId),
    [
      `${redPlayerId}:1`,
      `${redPlayerId}:1:2`,
      `${redPlayerId}:1:3`
    ]
  );
});

test("MetaverseAuthoritativeCombatAuthority resolves shotgun pellets as one ammo spend with multiple hitscan projectiles", () => {
  const redPlayerId = createMetaversePlayerId("combat-shotgun-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-shotgun-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 0, y: 0, z: -9 });
  const blueHurtVolumes = createMetaversePlayerCombatHurtVolumes({
    activeBodyPosition: blueRootPosition
  });
  const blueUpperTorsoRegion = blueHurtVolumes.regions.find(
    (region) => region.regionId === "upper_torso"
  );

  assert.notEqual(blueUpperTorsoRegion, undefined);

  const blueBodyTarget = readHurtRegionCenter(blueUpperTorsoRegion);
  const redWeaponState = createSingleWeaponState(
    redPlayerId,
    "metaverse-breacher-shotgun-v1"
  );
  const redPlayerRuntime = createPlayerRuntimeState(
    redPlayerId,
    "red",
    redRootPosition,
    0,
    redWeaponState
  );
  const bluePlayerRuntime = createPlayerRuntimeState(
    bluePlayerId,
    "blue",
    blueRootPosition
  );
  const combatAuthority = createCombatAuthorityForPlayers(
    new Map([
      [redPlayerId, redPlayerRuntime],
      [bluePlayerId, bluePlayerRuntime]
    ])
  );
  const origin = resolveWeaponTipOrigin(
    redRootPosition,
    0,
    "metaverse-breacher-shotgun-v1"
  );

  combatAuthority.syncCombatState(0);
  bluePlayerRuntime.positionX = blueRootPosition.x;
  bluePlayerRuntime.positionY = blueRootPosition.y;
  bluePlayerRuntime.positionZ = blueRootPosition.z;
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-breacher-shotgun-v1"
    }),
    1_200
  );

  const redCombatSnapshot = combatAuthority.readPlayerCombatSnapshot(redPlayerId);
  const blueCombatSnapshot = combatAuthority.readPlayerCombatSnapshot(bluePlayerId);
  const shotgunStats = redCombatSnapshot?.weaponStats.find(
    (weaponStats) => weaponStats.weaponId === "metaverse-breacher-shotgun-v1"
  ) ?? null;
  const events = combatAuthority.readCombatEventSnapshots();

  assert.equal(
    redCombatSnapshot?.activeWeapon?.weaponId,
    "metaverse-breacher-shotgun-v1"
  );
  assert.equal(redCombatSnapshot?.activeWeapon?.ammoInMagazine, 11);
  assert.equal(shotgunStats?.shotsFired, 12);
  assert.ok((shotgunStats?.shotsHit ?? 0) > 0);
  assert.ok((blueCombatSnapshot?.health ?? 100) < 100);
  assert.deepEqual(
    events.map((eventSnapshot) => eventSnapshot.eventKind),
    Array.from({ length: 12 }, () => "hitscan-resolved")
  );
  assert.deepEqual(
    events.map((eventSnapshot) => eventSnapshot.shotId),
    [
      `${redPlayerId}:1`,
      ...Array.from(
        { length: 11 },
        (_unused, index) => `${redPlayerId}:1:${index + 2}`
      )
    ]
  );
});

test("MetaverseAuthoritativeCombatAuthority swaps picked weapons and drops the active slot", () => {
  const playerId = createMetaversePlayerId("combat-resource-pickup-battle-rifle");

  assert.notEqual(playerId, null);

  const playerRuntime = createPlayerRuntimeState(
    playerId,
    "red",
    Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    0,
    createDualWeaponState(playerId, "primary")
  );
  const combatAuthority = createCombatAuthorityForPlayers(
    new Map([[playerId, playerRuntime]])
  );
  const battleRiflePickup = createWeaponPickupResourceSpawn({
    ammoGrantRounds: 108,
    assetId: "metaverse-battle-rifle-v1",
    label: "Battle rifle pickup",
    spawnId: "resource:battle-rifle",
    weaponId: "metaverse-battle-rifle-v1"
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);

  const pickupResult = combatAuthority.acceptInteractWeaponResourceAction({
    action: createInteractWeaponResourceCommand({
      actionSequence: 1,
      intendedWeaponInstanceId:
        `${playerId}:primary:metaverse-service-pistol-v2`,
      issuedAtAuthoritativeTimeMs: 1_200,
      playerId,
      requestedActiveSlotId: "primary"
    }).action,
    nowMs: 1_200,
    playerRuntime,
    resourceSpawn: battleRiflePickup
  });

  assert.equal(pickupResult.accepted, true);
  assert.equal(pickupResult.consumeResourceSpawn, true);
  assert.equal(pickupResult.droppedResourceSpawn?.weaponId, "metaverse-service-pistol-v2");
  assert.equal(playerRuntime.weaponState?.activeSlotId, "primary");
  assert.equal(playerRuntime.weaponState?.weaponId, "metaverse-battle-rifle-v1");
  assert.equal(
    playerRuntime.weaponState?.slots.find((slot) => slot.slotId === "primary")
      ?.weaponInstanceId,
    `${playerId}:primary:metaverse-battle-rifle-v1`
  );
  assert.deepEqual(
    combatAuthority
      .readPlayerCombatSnapshot(playerId)
      ?.weaponInventory.map((weaponSnapshot) => weaponSnapshot.weaponId)
      .sort(),
    ["metaverse-battle-rifle-v1", "metaverse-rocket-launcher-v1"]
  );

  const dropResult = combatAuthority.acceptInteractWeaponResourceAction({
    action: createInteractWeaponResourceCommand({
      actionSequence: 2,
      intendedWeaponInstanceId:
        `${playerId}:primary:metaverse-battle-rifle-v1`,
      issuedAtAuthoritativeTimeMs: 1_300,
      playerId,
      requestedActiveSlotId: "primary"
    }).action,
    nowMs: 1_300,
    playerRuntime,
    resourceSpawn: null
  });
  const receipts =
    combatAuthority.readPlayerCombatActionObserverSnapshot(playerId)
      ?.recentPlayerActionReceipts ?? [];

  assert.equal(dropResult.accepted, true);
  assert.equal(dropResult.droppedResourceSpawn?.weaponId, "metaverse-battle-rifle-v1");
  assert.equal(playerRuntime.weaponState?.activeSlotId, "secondary");
  assert.equal(playerRuntime.weaponState?.weaponId, "metaverse-rocket-launcher-v1");
  assert.equal(
    playerRuntime.weaponState?.slots.find((slot) => slot.slotId === "primary")
      ?.equipped,
    false
  );
  assert.deepEqual(
    combatAuthority
      .readPlayerCombatSnapshot(playerId)
      ?.weaponInventory.map((weaponSnapshot) => weaponSnapshot.weaponId),
    ["metaverse-rocket-launcher-v1"]
  );
  assert.equal(receipts[0]?.kind, "interact-weapon-resource");
  assert.equal(receipts[0]?.pickedUpWeaponId, "metaverse-battle-rifle-v1");
  assert.equal(receipts[0]?.droppedWeaponId, "metaverse-service-pistol-v2");
  assert.equal(receipts[1]?.kind, "interact-weapon-resource");
  assert.equal(receipts[1]?.pickedUpWeaponId, null);
  assert.equal(receipts[1]?.droppedWeaponId, "metaverse-battle-rifle-v1");
});

test("MetaverseAuthoritativeCombatAuthority tops up resource pickup ammo without exceeding weapon reserve cap", () => {
  const playerId = createMetaversePlayerId("combat-resource-pickup-ammo");

  assert.notEqual(playerId, null);

  const playerRuntime = createPlayerRuntimeState(
    playerId,
    "red",
    Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    0,
    createDualWeaponState(playerId, "primary")
  );
  const combatAuthority = createCombatAuthorityForPlayers(
    new Map([[playerId, playerRuntime]])
  );
  const pickup = createWeaponPickupResourceSpawn({
    ammoGrantRounds: 8
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);

  assert.equal(
    combatAuthority.grantWeaponResourcePickup(playerRuntime, pickup, 1_100),
    false
  );

  let nowMs = 1_200;

  for (let shotIndex = 0; shotIndex < 12; shotIndex += 1) {
    firePistolRound({
      actionSequence: shotIndex + 1,
      combatAuthority,
      nowMs,
      playerId
    });
    nowMs += 200;
  }

  combatAuthority.advanceCombatRuntimes(2, nowMs + 2_000);

  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(playerId)?.activeWeapon
      ?.ammoInMagazine,
    12
  );
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(playerId)?.activeWeapon
      ?.ammoInReserve,
    36
  );
  assert.equal(
    combatAuthority.grantWeaponResourcePickup(playerRuntime, pickup, nowMs + 2_100),
    true
  );
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(playerId)?.activeWeapon
      ?.ammoInReserve,
    44
  );
  assert.equal(
    combatAuthority.grantWeaponResourcePickup(
      playerRuntime,
      createWeaponPickupResourceSpawn({
        ammoGrantRounds: 100
      }),
      nowMs + 2_200
    ),
    true
  );
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(playerId)?.activeWeapon
      ?.ammoInReserve,
    48
  );
  assert.equal(
    combatAuthority.grantWeaponResourcePickup(playerRuntime, pickup, nowMs + 2_300),
    false
  );
});

test("MetaverseAuthoritativeCombatAuthority starts reload when pickup grants ammo to an empty active weapon", () => {
  const playerId = createMetaversePlayerId("combat-resource-pickup-reload");

  assert.notEqual(playerId, null);

  const playerRuntime = createPlayerRuntimeState(
    playerId,
    "red",
    Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    0,
    createDualWeaponState(playerId, "primary")
  );
  const combatAuthority = createCombatAuthorityForPlayers(
    new Map([[playerId, playerRuntime]])
  );
  let nowMs = 1_200;
  let actionSequence = 1;

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);

  for (let magazineIndex = 0; magazineIndex < 5; magazineIndex += 1) {
    for (let shotIndex = 0; shotIndex < 12; shotIndex += 1) {
      firePistolRound({
        actionSequence,
        combatAuthority,
        nowMs,
        playerId
      });
      actionSequence += 1;
      nowMs += 200;
    }

    combatAuthority.advanceCombatRuntimes(2, nowMs + 2_000);
    nowMs += 2_200;
  }

  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(playerId)?.activeWeapon
      ?.ammoInMagazine,
    0
  );
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(playerId)?.activeWeapon
      ?.ammoInReserve,
    0
  );
  assert.equal(
    combatAuthority.grantWeaponResourcePickup(
      playerRuntime,
      createWeaponPickupResourceSpawn({
        ammoGrantRounds: 12
      }),
      nowMs
    ),
    true
  );

  const activeWeapon =
    combatAuthority.readPlayerCombatSnapshot(playerId)?.activeWeapon;

  assert.equal(activeWeapon?.ammoInMagazine, 0);
  assert.equal(activeWeapon?.ammoInReserve, 12);
  assert.ok((activeWeapon?.reloadRemainingMs ?? 0) > 0);
});

test("MetaverseAuthoritativeCombatAuthority resolves rocket direct player impacts from authoritative projectiles", () => {
  const redPlayerId = createMetaversePlayerId("combat-rocket-direct-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-rocket-direct-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 0, y: 0, z: -10 });
  const redMuzzleOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const target = Object.freeze({ x: 0, y: 1.2, z: -10 });
  const rocketActiveWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "secondary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: "red:primary:metaverse-service-pistol-v2"
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: "red:secondary:metaverse-rocket-launcher-v1"
      }
    ],
    weaponId: "metaverse-rocket-launcher-v1"
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(
          redPlayerId,
          "red",
          redRootPosition,
          0,
          rocketActiveWeaponState
        )
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose() {
      return {
        position: redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_200
  );

  assert.equal(
    combatAuthority.readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.recentPlayerActionReceipts[0]?.status,
    "accepted"
  );
  assert.equal(combatAuthority.readProjectileSnapshots().length, 1);
  const spawnedProjectile = combatAuthority.readProjectileSnapshots()[0];
  const expectedWeaponTipOrigin = resolveSemanticWeaponTipOrigin(
    redRootPosition,
    0,
    "metaverse-rocket-launcher-v1",
    createForwardDirection(redMuzzleOrigin, target)
  );

  assert.deepEqual(spawnedProjectile?.position, expectedWeaponTipOrigin);

  combatAuthority.advanceCombatRuntimes(0.25, 1_450);

  const projectileSnapshot = combatAuthority.readProjectileSnapshots()[0];

  assert.equal(projectileSnapshot?.resolution, "hit-player");
  assert.deepEqual(
    combatAuthority
      .readCombatEventSnapshots()
      .map((eventSnapshot) => eventSnapshot.eventKind),
    ["projectile-spawned", "projectile-resolved"]
  );
  assert.equal(
    combatAuthority.readCombatEventSnapshots()[0]?.semanticMuzzleWorld?.z,
    expectedWeaponTipOrigin.z
  );
  assert.equal(
    combatAuthority.readCombatEventSnapshots()[1]?.projectile?.resolutionKind,
    "hit-player"
  );
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(bluePlayerId)?.alive,
    false
  );
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(redPlayerId)?.activeWeapon
      ?.ammoInMagazine,
    1
  );
});

test("MetaverseAuthoritativeCombatAuthority launches no-hit rockets from weapon tips without owner collision", () => {
  const redPlayerId = createMetaversePlayerId("combat-rocket-no-hit-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-rocket-no-hit-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 100, y: 0, z: 100 });
  const redMuzzleOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const target = Object.freeze({ x: 0, y: 1.62, z: -10 });
  const expectedWeaponTipOrigin = resolveSemanticWeaponTipOrigin(
    redRootPosition,
    0,
    "metaverse-rocket-launcher-v1",
    createForwardDirection(redMuzzleOrigin, target)
  );
  const rocketActiveWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "secondary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: "red:primary:metaverse-service-pistol-v2"
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: "red:secondary:metaverse-rocket-launcher-v1"
      }
    ],
    weaponId: "metaverse-rocket-launcher-v1"
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(
          redPlayerId,
          "red",
          redRootPosition,
          0,
          rocketActiveWeaponState
        )
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "red", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose() {
      return {
        position: redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_200
  );

  const spawnedProjectile = combatAuthority.readProjectileSnapshots()[0];

  assert.deepEqual(spawnedProjectile?.position, expectedWeaponTipOrigin);

  combatAuthority.advanceCombatRuntimes(0.05, 1_250);

  assert.equal(combatAuthority.readProjectileSnapshots()[0]?.resolution, "active");
  assert.equal(combatAuthority.readPlayerCombatSnapshot(redPlayerId)?.health, 100);
  assert.equal(combatAuthority.readPlayerCombatSnapshot(bluePlayerId)?.health, 100);
});

test("MetaverseAuthoritativeCombatAuthority resolves zero-distance rocket world raycasts as impacts", () => {
  const redPlayerId = createMetaversePlayerId("combat-rocket-zero-world-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-rocket-zero-world-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 100, y: 0, z: 100 });
  const redMuzzleOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const target = Object.freeze({ x: 0, y: 1.62, z: -10 });
  const expectedWeaponTipOrigin = resolveSemanticWeaponTipOrigin(
    redRootPosition,
    0,
    "metaverse-rocket-launcher-v1",
    createForwardDirection(redMuzzleOrigin, target)
  );
  const rocketActiveWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "secondary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: "red:primary:metaverse-service-pistol-v2"
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: "red:secondary:metaverse-rocket-launcher-v1"
      }
    ],
    weaponId: "metaverse-rocket-launcher-v1"
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay(origin) {
        const originAtRocketTip =
          Math.hypot(
            origin.x - expectedWeaponTipOrigin.x,
            origin.y - expectedWeaponTipOrigin.y,
            origin.z - expectedWeaponTipOrigin.z
          ) < 0.000001;

        return originAtRocketTip
          ? {
              collider: 101,
              distanceMeters: 0,
              point: origin
            }
          : null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(
          redPlayerId,
          "red",
          redRootPosition,
          0,
          rocketActiveWeaponState
        )
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "red", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose() {
      return {
        position: redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_200
  );
  combatAuthority.advanceCombatRuntimes(0.05, 1_250);

  assert.equal(combatAuthority.readProjectileSnapshots()[0]?.resolution, "hit-world");
  assert.equal(
    combatAuthority.readCombatEventSnapshots().at(-1)?.eventKind,
    "projectile-resolved"
  );
  assert.equal(
    combatAuthority.readCombatEventSnapshots().at(-1)?.projectile?.resolutionKind,
    "hit-world"
  );
});

test("MetaverseAuthoritativeCombatAuthority resolves short positive rocket world raycasts", () => {
  const redPlayerId = createMetaversePlayerId("combat-rocket-short-world-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-rocket-short-world-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 100, y: 0, z: 100 });
  const redMuzzleOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const target = Object.freeze({ x: 0, y: 1.62, z: -10 });
  const rocketActiveWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "secondary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: "red:primary:metaverse-service-pistol-v2"
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: "red:secondary:metaverse-rocket-launcher-v1"
      }
    ],
    weaponId: "metaverse-rocket-launcher-v1"
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay(origin, direction, distanceMeters) {
        const projectileAdvanceRay = distanceMeters < 10;

        return projectileAdvanceRay
          ? {
              collider: 101,
              distanceMeters: 0.03,
              point: {
                x: origin.x + direction.x * 0.03,
                y: origin.y + direction.y * 0.03,
                z: origin.z + direction.z * 0.03
              }
            }
          : null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(
          redPlayerId,
          "red",
          redRootPosition,
          0,
          rocketActiveWeaponState
        )
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "red", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose() {
      return {
        position: redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_200
  );
  combatAuthority.advanceCombatRuntimes(0.05, 1_250);

  assert.equal(combatAuthority.readProjectileSnapshots()[0]?.resolution, "hit-world");
  assert.equal(
    combatAuthority.readCombatEventSnapshots().at(-1)?.eventKind,
    "projectile-resolved"
  );
  assert.equal(
    combatAuthority.readCombatEventSnapshots().at(-1)?.projectile?.resolutionKind,
    "hit-world"
  );
});

test("MetaverseAuthoritativeCombatAuthority treats duplicate fire action sequences as gameplay-idempotent", () => {
  const redPlayerId = createMetaversePlayerId("combat-idempotent-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-idempotent-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 0, y: 0, z: -10 });
  const redMuzzleOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const target = Object.freeze({ x: 0, y: 1.2, z: -10 });
  const rocketActiveWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "secondary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: "red:primary:metaverse-service-pistol-v2"
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: "red:secondary:metaverse-rocket-launcher-v1"
      }
    ],
    weaponId: "metaverse-rocket-launcher-v1"
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(
          redPlayerId,
          "red",
          redRootPosition,
          0,
          rocketActiveWeaponState
        )
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose() {
      return {
        position: redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);

  const fireCommand = createFireWeaponPlayerActionCommand({
    actionSequence: 1,
    issuedAtAuthoritativeTimeMs: 1_200,
    origin: redMuzzleOrigin,
    playerId: redPlayerId,
    target,
    weaponId: "metaverse-rocket-launcher-v1"
  });

  combatAuthority.acceptIssuePlayerActionCommand(fireCommand, 1_200);
  combatAuthority.acceptIssuePlayerActionCommand(fireCommand, 1_205);

  assert.equal(combatAuthority.readProjectileSnapshots().length, 1);
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(redPlayerId)?.activeWeapon
      ?.ammoInMagazine,
    1
  );
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(redPlayerId)?.weaponStats.find(
      (weaponStats) =>
        weaponStats.weaponId === "metaverse-rocket-launcher-v1"
    )?.shotsFired,
    1
  );
  assert.deepEqual(
    combatAuthority
      .readPlayerCombatActionObserverSnapshot(redPlayerId)
      ?.recentPlayerActionReceipts.map((receipt) => receipt.actionSequence),
    [1]
  );
  assert.deepEqual(
    combatAuthority
      .readCombatEventSnapshots()
      .map((eventSnapshot) => eventSnapshot.eventKind),
    ["projectile-spawned"]
  );
});

test("MetaverseAuthoritativeCombatAuthority emits one expired projectile resolution event", () => {
  const redPlayerId = createMetaversePlayerId("combat-rocket-expiry-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-rocket-expiry-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 100, y: 0, z: 100 });
  const redMuzzleOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const target = Object.freeze({ x: 0, y: 1.62, z: -10 });
  const rocketActiveWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "secondary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: "red:primary:metaverse-service-pistol-v2"
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: "red:secondary:metaverse-rocket-launcher-v1"
      }
    ],
    weaponId: "metaverse-rocket-launcher-v1"
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(
          redPlayerId,
          "red",
          redRootPosition,
          0,
          rocketActiveWeaponState
        )
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose() {
      return {
        position: redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_200
  );
  combatAuthority.advanceCombatRuntimes(7, 8_200);

  assert.equal(combatAuthority.readProjectileSnapshots()[0]?.resolution, "expired");
  assert.deepEqual(
    combatAuthority
      .readCombatEventSnapshots()
      .map((eventSnapshot) => eventSnapshot.eventKind),
    ["projectile-spawned", "projectile-resolved"]
  );
  assert.equal(
    combatAuthority.readCombatEventSnapshots()[1]?.projectile?.resolutionKind,
    "expired"
  );
});

test("MetaverseAuthoritativeCombatAuthority applies rocket splash around direct impacts without self damage", () => {
  const redPlayerId = createMetaversePlayerId("combat-rocket-splash-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-rocket-splash-blue-1");
  const greenPlayerId = createMetaversePlayerId("combat-rocket-splash-green-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);
  assert.notEqual(greenPlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const blueRootPosition = Object.freeze({ x: 0, y: 0, z: -10 });
  const greenRootPosition = Object.freeze({ x: 6.1, y: 0, z: -10 });
  const redMuzzleOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const target = Object.freeze({ x: 0, y: 1.2, z: -10 });
  const rocketActiveWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "secondary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: "red:primary:metaverse-service-pistol-v2"
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: "red:secondary:metaverse-rocket-launcher-v1"
      }
    ],
    weaponId: "metaverse-rocket-launcher-v1"
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(
          redPlayerId,
          "red",
          redRootPosition,
          0,
          rocketActiveWeaponState
        )
      ],
      [
        bluePlayerId,
        createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
      ],
      [
        greenPlayerId,
        createPlayerRuntimeState(greenPlayerId, "blue", greenRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose(playerId) {
      return {
        position:
          playerId === bluePlayerId
            ? blueRootPosition
            : playerId === greenPlayerId
              ? greenRootPosition
              : redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_200
  );
  combatAuthority.advanceCombatRuntimes(0.25, 1_450);

  const projectileSnapshot = combatAuthority.readProjectileSnapshots()[0];

  assert.equal(projectileSnapshot?.resolution, "hit-player");
  assert.equal(combatAuthority.readPlayerCombatSnapshot(redPlayerId)?.health, 100);
  assert.equal(
    combatAuthority.readPlayerCombatSnapshot(bluePlayerId)?.alive,
    false
  );
  const greenCombatSnapshot =
    combatAuthority.readPlayerCombatSnapshot(greenPlayerId);

  assert.ok((greenCombatSnapshot?.health ?? 100) < 100);
});

test("MetaverseAuthoritativeCombatAuthority applies rocket splash on world impact without self-blocking the impact surface", () => {
  const redPlayerId = createMetaversePlayerId("combat-rocket-world-splash-red-1");
  const greenPlayerId = createMetaversePlayerId("combat-rocket-world-splash-green-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(greenPlayerId, null);

  const redRootPosition = Object.freeze({ x: 0, y: 0, z: 0 });
  const greenRootPosition = Object.freeze({ x: 5.5, y: 0, z: -10 });
  const redMuzzleOrigin = Object.freeze({ x: 0, y: 1.62, z: 0 });
  const impactPoint = Object.freeze({ x: 0, y: 0.05, z: -10 });
  const rocketActiveWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "secondary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: "red:primary:metaverse-service-pistol-v2"
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: "red:secondary:metaverse-rocket-launcher-v1"
      }
    ],
    weaponId: "metaverse-rocket-launcher-v1"
  });
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    physicsRuntime: {
      castRay(origin, direction, distanceMeters) {
        const originAtImpact =
          Math.hypot(
            origin.x - impactPoint.x,
            origin.y - impactPoint.y,
            origin.z - impactPoint.z
          ) < 0.000001;

        if (originAtImpact) {
          return {
            collider: 101,
            distanceMeters: 0,
            point: impactPoint
          };
        }

        const toImpact = {
          x: impactPoint.x - origin.x,
          y: impactPoint.y - origin.y,
          z: impactPoint.z - origin.z
        };
        const projection =
          toImpact.x * direction.x +
          toImpact.y * direction.y +
          toImpact.z * direction.z;

        if (projection <= 0 || projection > distanceMeters) {
          return null;
        }

        const closestPoint = {
          x: origin.x + direction.x * projection,
          y: origin.y + direction.y * projection,
          z: origin.z + direction.z * projection
        };
        const missDistance = Math.hypot(
          closestPoint.x - impactPoint.x,
          closestPoint.y - impactPoint.y,
          closestPoint.z - impactPoint.z
        );

        return missDistance <= 0.05
          ? {
              collider: 101,
              distanceMeters: projection,
              point: impactPoint
            }
          : null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById: new Map([
      [
        redPlayerId,
        createPlayerRuntimeState(
          redPlayerId,
          "red",
          redRootPosition,
          0,
          rocketActiveWeaponState
        )
      ],
      [
        greenPlayerId,
        createPlayerRuntimeState(greenPlayerId, "blue", greenRootPosition)
      ]
    ]),
    readTickIntervalMs: () => 33,
    resolveRespawnPose(playerId) {
      return {
        position:
          playerId === greenPlayerId ? greenRootPosition : redRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target: impactPoint,
      weaponId: "metaverse-rocket-launcher-v1"
    }),
    1_200
  );
  combatAuthority.advanceCombatRuntimes(0.25, 1_450);

  const projectileSnapshot = combatAuthority.readProjectileSnapshots()[0];
  const greenCombatSnapshot =
    combatAuthority.readPlayerCombatSnapshot(greenPlayerId);

  assert.equal(projectileSnapshot?.resolution, "hit-world");
  assert.ok((greenCombatSnapshot?.health ?? 100) < 100);
});

test("MetaverseAuthoritativeCombatAuthority applies kill-floor suicides as deaths with minus one kill and negative team score", () => {
  const redPlayerId = createMetaversePlayerId("combat-kill-floor-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-kill-floor-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const playersById = new Map([
    [
      redPlayerId,
      createPlayerRuntimeState(redPlayerId, "red", Object.freeze({ x: 16, y: 0, z: 0 }))
    ],
    [
      bluePlayerId,
      createPlayerRuntimeState(bluePlayerId, "blue", Object.freeze({ x: 0, y: -6, z: 0 }))
    ]
  ]);
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    killFloorVolumes: Object.freeze([createKillFloorVolume()]),
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById,
    readTickIntervalMs: () => 33,
    resolveRespawnPose(_playerId, teamId) {
      return {
        position: teamId === "red"
          ? Object.freeze({ x: 16, y: 0, z: 0 })
          : Object.freeze({ x: 0, y: 0, z: 0 }),
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  playersById.get(bluePlayerId).positionY = -6;
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);

  const blueCombatSnapshot = combatAuthority.readPlayerCombatSnapshot(bluePlayerId);
  const combatMatchSnapshot = combatAuthority.readCombatMatchSnapshot();
  const killFeedEvent = combatAuthority
    .readCombatFeedSnapshots()
    .find((eventSnapshot) => eventSnapshot.type === "kill");

  assert.equal(blueCombatSnapshot?.alive, false);
  assert.equal(blueCombatSnapshot?.deaths, 1);
  assert.equal(blueCombatSnapshot?.kills, -1);
  assert.equal(killFeedEvent?.type, "kill");
  assert.equal(killFeedEvent?.attackerPlayerId, bluePlayerId);
  assert.equal(killFeedEvent?.targetPlayerId, bluePlayerId);
  assert.equal(killFeedEvent?.weaponId, "metaverse-environment-kill-floor-v1");
  assert.equal(combatMatchSnapshot.teams[0]?.score, 0);
  assert.equal(combatMatchSnapshot.teams[1]?.score, -1);
});

test("MetaverseAuthoritativeCombatAuthority credits prior attacker damage when a player falls into the kill floor", () => {
  const redPlayerId = createMetaversePlayerId("combat-kill-floor-credit-red-1");
  const bluePlayerId = createMetaversePlayerId("combat-kill-floor-credit-blue-1");

  assert.notEqual(redPlayerId, null);
  assert.notEqual(bluePlayerId, null);

  const redRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: 0
  });
  const blueRootPosition = Object.freeze({
    x: 0,
    y: 0,
    z: -9
  });
  const redMuzzleOrigin = Object.freeze({
    x: 0,
    y: 1.62,
    z: 0
  });
  const blueBodyTarget = Object.freeze({
    x: 0,
    y: 0.95,
    z: -9
  });
  const playersById = new Map([
    [
      redPlayerId,
      createPlayerRuntimeState(redPlayerId, "red", redRootPosition)
    ],
    [
      bluePlayerId,
      createPlayerRuntimeState(bluePlayerId, "blue", blueRootPosition)
    ]
  ]);
  const combatAuthority = new MetaverseAuthoritativeCombatAuthority({
    clearDriverVehicleControl() {},
    clearPlayerTraversalIntent() {},
    clearPlayerVehicleOccupancy() {},
    incrementSnapshotSequence() {},
    killFloorVolumes: Object.freeze([createKillFloorVolume()]),
    physicsRuntime: {
      castRay() {
        return null;
      }
    },
    playerTraversalColliderHandles: new Set(),
    playersById,
    readTickIntervalMs: () => 33,
    resolveRespawnPose(_playerId, teamId) {
      return {
        position: teamId === "red" ? redRootPosition : blueRootPosition,
        yawRadians: 0
      };
    },
    syncAuthoritativePlayerLookToCurrentFacing() {},
    syncPlayerTraversalAuthorityState() {},
    syncPlayerTraversalBodyRuntimes() {}
  });

  combatAuthority.syncCombatState(0);
  combatAuthority.advanceCombatRuntimes(1.1, 1_100);
  combatAuthority.acceptIssuePlayerActionCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_050,
      origin: redMuzzleOrigin,
      playerId: redPlayerId,
      target: blueBodyTarget,
      weaponId: "metaverse-service-pistol-v2"
    }),
    1_200
  );
  playersById.get(bluePlayerId).positionY = -6;
  combatAuthority.advanceCombatRuntimes(0.1, 1_300);

  const redCombatSnapshot = combatAuthority.readPlayerCombatSnapshot(redPlayerId);
  const blueCombatSnapshot = combatAuthority.readPlayerCombatSnapshot(bluePlayerId);
  const combatMatchSnapshot = combatAuthority.readCombatMatchSnapshot();
  const killFeedEvent = combatAuthority
    .readCombatFeedSnapshots()
    .findLast((eventSnapshot) => eventSnapshot.type === "kill");

  assert.equal(redCombatSnapshot?.kills, 1);
  assert.equal(blueCombatSnapshot?.alive, false);
  assert.equal(blueCombatSnapshot?.deaths, 1);
  assert.equal(killFeedEvent?.attackerPlayerId, redPlayerId);
  assert.equal(killFeedEvent?.targetPlayerId, bluePlayerId);
  assert.equal(killFeedEvent?.weaponId, "metaverse-environment-kill-floor-v1");
  assert.equal(combatMatchSnapshot.teams[0]?.score, 1);
  assert.equal(combatMatchSnapshot.teams[1]?.score, 0);
});
