import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoopJoinRoomCommand,
  createCoopPlayerId,
  createCoopRoomId,
  createCoopRoomSnapshotEvent,
  createCoopSessionId,
  createCoopSyncPlayerPresenceCommand,
  createDuckHuntCoopRoomWebTransportCommandRequest,
  createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram,
  createDuckHuntCoopRoomWebTransportServerEventMessage,
  createDuckHuntCoopRoomWebTransportSnapshotRequest,
  createMetaverseCombatActionReceiptSnapshot,
  createMetaverseCombatAimSnapshot,
  createMetaverseDriverVehicleControlIntentSnapshot,
  createMetaverseGameplayTraversalIntentSnapshotInput,
  createMetaverseIssuePlayerActionCommand,
  createMetaverseJoinPresenceCommand,
  createMetaverseMountedOccupancyIdentityKey,
  createMetaversePlayerId,
  createMetaversePresenceMountedOccupancySnapshot,
  createMetaversePresenceRosterSnapshot,
  createMetaverseRoomId,
  createMetaversePresenceWebTransportCommandRequest,
  createMetaversePresenceWebTransportRosterRequest,
  createMetaversePresenceWebTransportServerEventMessage,
  createMetaverseRealtimePlayerWeaponStateSnapshot,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerTraversalIntentCommand as createRawMetaverseSyncPlayerTraversalIntentCommand,
  createMetaverseRealtimeWorldSnapshot,
  createMetaverseRealtimeWorldEvent,
  createMetaverseRealtimeWorldWebTransportCommandRequest,
  createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram,
  createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram,
  createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram,
  createMetaverseRealtimeWorldWebTransportServerEventMessage,
  createMetaverseRealtimeWorldWebTransportSnapshotRequest,
  createMetaverseSessionSnapshot,
  createMetaverseVehicleId,
  createPortalLaunchSelectionSnapshot,
  createUsername,
  defaultMetaverseGameplayProfileId,
  defaultMetaverseMountedLookLimitPolicyId,
  experienceCatalog,
  isMetaversePresenceMountedCompatibilityLocomotionMode,
  isMetaversePresencePrimaryLocomotionMode,
  metaverseMountedLookLimitPolicyIds,
  metaversePresenceCompatibilityLocomotionModeIds,
  metaversePresencePrimaryLocomotionModeIds,
  metaverseUnmountedPlayerLookConstraintBounds,
  parseMetaverseMapBundleSnapshot,
  readMetaverseWeaponLayout,
  readMetaverseCombatWeaponProfile,
  readExperienceCatalogEntry,
  readExperienceTickOwner,
  resolveMetaverseCombatSemanticWeaponTipOrigin,
  resolveMetaverseMountedLookConstraintBounds,
  resolveMetaverseMountedOccupantRoleLookConstraintBounds,
  shouldKeepMetaverseMountedOccupancyFreeRoam,
  shouldTreatMetaversePlayerPoseAsTraversalBlocker,
  shellArcadeGameplayProfile,
  stagingGroundMapBundle
} from "@webgpu-metaverse/shared";

function createMetaverseSyncPlayerTraversalIntentCommand(input) {
  const nextIntent = input.intent;
  const normalizedFacing =
    nextIntent.facing ?? {
      pitchRadians: nextIntent.pitchRadians ?? 0,
      yawRadians:
        nextIntent.bodyYawRadians ??
        nextIntent.lookYawRadians ??
        nextIntent.yawRadians ??
        0
    };

  if ("bodyControl" in nextIntent || "actionIntent" in nextIntent) {
    return createRawMetaverseSyncPlayerTraversalIntentCommand({
      ...input,
      intent: {
        ...nextIntent,
        facing: normalizedFacing
      }
    });
  }

  return createRawMetaverseSyncPlayerTraversalIntentCommand({
    ...input,
    intent: {
      actionIntent: {
        kind: nextIntent.jump === true ? "jump" : "none",
        pressed: nextIntent.jump === true,
        ...(nextIntent.jumpActionSequence === undefined
          ? {}
          : { sequence: nextIntent.jumpActionSequence })
      },
      bodyControl: {
        boost: nextIntent.boost,
        moveAxis: nextIntent.moveAxis,
        strafeAxis: nextIntent.strafeAxis,
        turnAxis: nextIntent.yawAxis
      },
      facing: normalizedFacing,
      locomotionMode: nextIntent.locomotionMode,
      sequence: nextIntent.sequence
    }
  });
}

test("metaverse weapon loadout contracts resolve pistol-only and pistol-rocket slot states", () => {
  const pistolLayout = readMetaverseWeaponLayout("duck-hunt-default-pistol-layout");
  const tdmLayout = readMetaverseWeaponLayout("metaverse-tdm-pistol-rocket-layout");

  assert.equal(pistolLayout?.slots.length, 1);
  assert.equal(pistolLayout?.slots[0]?.weaponId, "metaverse-service-pistol-v2");
  assert.equal(tdmLayout?.activeSlotId, "primary");
  assert.deepEqual(
    tdmLayout?.slots.map((slot) => [slot.slotId, slot.weaponId]),
    [
      ["primary", "metaverse-service-pistol-v2"],
      ["secondary", "metaverse-rocket-launcher-v1"]
    ]
  );

  const legacyState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    aimMode: "ads",
    weaponId: "metaverse-service-pistol-v2"
  });

  assert.equal(legacyState.activeSlotId, "primary");
  assert.equal(legacyState.weaponId, "metaverse-service-pistol-v2");
  assert.equal(legacyState.slots.length, 1);
  assert.equal(legacyState.slots[0]?.slotId, "primary");

  const fullState = createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: "secondary",
    aimMode: "hip-fire",
    slots: [
      {
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2",
        weaponInstanceId: "player:primary:metaverse-service-pistol-v2"
      },
      {
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1",
        weaponInstanceId: "player:secondary:metaverse-rocket-launcher-v1"
      }
    ],
    weaponId: "metaverse-service-pistol-v2"
  });

  assert.equal(fullState.activeSlotId, "secondary");
  assert.equal(fullState.weaponId, "metaverse-rocket-launcher-v1");
  assert.equal(
    fullState.slots[1]?.weaponInstanceId,
    "player:secondary:metaverse-rocket-launcher-v1"
  );
});

test("metaverse rocket combat profile resolves projectile and splash values", () => {
  const rocketProfile = readMetaverseCombatWeaponProfile(
    "metaverse-rocket-launcher-v1"
  );

  assert.equal(rocketProfile.deliveryModel, "projectile");
  assert.equal(rocketProfile.fireMode, "semi");
  assert.equal(rocketProfile.roundsPerMinute, 42);
  assert.equal(rocketProfile.accuracy.projectileVelocityMetersPerSecond, 70);
  assert.equal(rocketProfile.accuracy.projectileLifetimeMs, 6_000);
  assert.equal(rocketProfile.accuracy.gravityUnitsPerSecondSquared, 0);
  assert.equal(rocketProfile.magazine.magazineCapacity, 2);
  assert.equal(rocketProfile.magazine.reserveCapacity, 6);
  assert.equal(rocketProfile.magazine.reloadDurationMs, 3_600);
  assert.equal(rocketProfile.damage.body, 180);
  assert.equal(rocketProfile.damage.head, 180);
  assert.deepEqual(rocketProfile.firingOriginOffset, {
    forwardMeters: 0.95,
    rightMeters: 0.1,
    upMeters: 1.34
  });
  assert.notEqual(rocketProfile.areaDamage, null);
  assert.equal(rocketProfile.areaDamage?.innerRadiusMeters, 2);
  assert.equal(rocketProfile.areaDamage?.outerRadiusMeters, 6);
  assert.equal(rocketProfile.areaDamage?.maxDamage, 100);
  assert.equal(rocketProfile.areaDamage?.minDamage, 20);
  assert.equal(rocketProfile.areaDamage?.lineOfSightRequired, true);
  assert.equal(rocketProfile.areaDamage?.affectsOwner, false);
  assert.equal(rocketProfile.areaDamage?.affectsTeammates, false);
});

test("metaverse semantic weapon-tip origin follows aim yaw for side and forward offsets", () => {
  const rocketProfile = readMetaverseCombatWeaponProfile(
    "metaverse-rocket-launcher-v1"
  );
  const origin = resolveMetaverseCombatSemanticWeaponTipOrigin({
    actorBodyPosition: { x: 0, y: 0, z: 0 },
    actorBodyYawRadians: 0,
    aimYawInfluence: 1,
    firingOriginOffset: rocketProfile.firingOriginOffset,
    semanticAimForward: { x: 1, y: 0, z: 0 }
  });

  assert.deepEqual(origin, {
    x: 0.95,
    y: 1.34,
    z: 0.1
  });
});

function createFireWeaponPlayerActionCommand({
  actionSequence,
  aimMode,
  issuedAtAuthoritativeTimeMs,
  playerId,
  weaponId,
  yawRadians = 0,
  pitchRadians = 0
}) {
  return createMetaverseIssuePlayerActionCommand({
    action: {
      ...(aimMode === undefined ? {} : { aimMode }),
      actionSequence,
      aimSnapshot: {
        pitchRadians,
        yawRadians
      },
      issuedAtAuthoritativeTimeMs,
      kind: "fire-weapon",
      weaponId
    },
    playerId
  });
}

test("experienceCatalog exposes Duck Hunt as the first metaverse-ready experience", () => {
  assert.equal(experienceCatalog.length, 1);

  const duckHuntEntry = readExperienceCatalogEntry("duck-hunt");

  assert.equal(duckHuntEntry.id, "duck-hunt");
  assert.equal(duckHuntEntry.label, "Duck Hunt!");
  assert.equal(duckHuntEntry.defaultInputMode, "mouse");
  assert.deepEqual(duckHuntEntry.supportedSessionModes, [
    "single-player",
    "co-op"
  ]);
  assert.equal(readExperienceTickOwner("duck-hunt", "single-player"), "client");
  assert.equal(readExperienceTickOwner("duck-hunt", "co-op"), "server");
});

test("createPortalLaunchSelectionSnapshot resolves the authority model from the shared catalog", () => {
  const singlePlayerLaunch = createPortalLaunchSelectionSnapshot({
    experienceId: "duck-hunt",
    inputMode: "mouse",
    matchMode: "free-roam"
  });
  const coopLaunch = createPortalLaunchSelectionSnapshot({
    experienceId: "duck-hunt",
    inputMode: "camera-thumb-trigger",
    matchMode: "team-deathmatch"
  });

  assert.equal(singlePlayerLaunch.tickOwner, "client");
  assert.equal(coopLaunch.tickOwner, "server");
});

test("createMetaverseSessionSnapshot freezes the available experience ids", () => {
  const inputExperienceIds = ["duck-hunt"];
  const sessionSnapshot = createMetaverseSessionSnapshot({
    activeExperienceId: null,
    availableExperienceIds: inputExperienceIds,
    selectedMatchMode: "team-deathmatch",
    tickOwner: "server"
  });

  inputExperienceIds.push("duck-hunt");

  assert.deepEqual(sessionSnapshot.availableExperienceIds, ["duck-hunt"]);
  assert.ok(Object.isFrozen(sessionSnapshot.availableExperienceIds));
});

test("shared metaverse look constraint policy keeps mounted look limits aligned across client and server owners", () => {
  assert.deepEqual(metaverseMountedLookLimitPolicyIds, [
    "driver-forward",
    "passenger-bench",
    "turret-arc"
  ]);
  assert.equal(defaultMetaverseMountedLookLimitPolicyId, "driver-forward");
  assert.deepEqual(metaverseUnmountedPlayerLookConstraintBounds, {
    maxPitchRadians: 0.6,
    maxYawOffsetRadians: null,
    minPitchRadians: -0.6
  });
  assert.deepEqual(
    resolveMetaverseMountedLookConstraintBounds("driver-forward"),
    {
      maxPitchRadians: 0.6,
      maxYawOffsetRadians: 0,
      minPitchRadians: -0.6
    }
  );
  assert.deepEqual(
    resolveMetaverseMountedLookConstraintBounds("passenger-bench"),
    resolveMetaverseMountedOccupantRoleLookConstraintBounds("passenger")
  );
  assert.deepEqual(
    resolveMetaverseMountedLookConstraintBounds("turret-arc"),
    resolveMetaverseMountedOccupantRoleLookConstraintBounds("turret")
  );
  assert.deepEqual(
    resolveMetaverseMountedLookConstraintBounds("driver-forward"),
    resolveMetaverseMountedOccupantRoleLookConstraintBounds("driver")
  );
});

test("shared metaverse presence locomotion keeps mounted as an explicit compatibility mode", () => {
  assert.deepEqual(metaversePresencePrimaryLocomotionModeIds, ["grounded", "swim"]);
  assert.deepEqual(metaversePresenceCompatibilityLocomotionModeIds, [
    "grounded",
    "swim",
    "mounted"
  ]);
  assert.equal(isMetaversePresencePrimaryLocomotionMode("grounded"), true);
  assert.equal(isMetaversePresencePrimaryLocomotionMode("mounted"), false);
  assert.equal(
    isMetaversePresenceMountedCompatibilityLocomotionMode("mounted"),
    true
  );
  assert.equal(
    isMetaversePresenceMountedCompatibilityLocomotionMode("swim"),
    false
  );
});

test("shared metaverse presence blocker policy keeps player collision truth aligned across client and server", () => {
  assert.equal(shouldKeepMetaverseMountedOccupancyFreeRoam(null), false);
  assert.equal(
    shouldKeepMetaverseMountedOccupancyFreeRoam({
      occupancyKind: "entry",
      occupantRole: "passenger"
    }),
    true
  );
  assert.equal(
    shouldKeepMetaverseMountedOccupancyFreeRoam({
      occupancyKind: "seat",
      occupantRole: "passenger"
    }),
    false
  );
  assert.equal(
    shouldTreatMetaversePlayerPoseAsTraversalBlocker("grounded", null),
    true
  );
  assert.equal(
    shouldTreatMetaversePlayerPoseAsTraversalBlocker("swim", null),
    false
  );
  assert.equal(
    shouldTreatMetaversePlayerPoseAsTraversalBlocker("grounded", {
      occupancyKind: "entry",
      occupantRole: "passenger"
    }),
    true
  );
  assert.equal(
    shouldTreatMetaversePlayerPoseAsTraversalBlocker("grounded", {
      occupancyKind: "seat",
      occupantRole: "passenger"
    }),
    false
  );
});

test("shared metaverse world bundles carry validated gameplay profile ids", () => {
  assert.equal(
    stagingGroundMapBundle.gameplayProfileId,
    defaultMetaverseGameplayProfileId
  );
  assert.equal(shellArcadeGameplayProfile.id, "shell-arcade-gameplay");
  assert.equal(
    shellArcadeGameplayProfile.vehicleTraversal.waterContactProbeRadiusMeters,
    1.75
  );
  assert.equal(
    shellArcadeGameplayProfile.vehicleTraversal.waterlineHeightMeters,
    0.12
  );

  const parsedBundle = parseMetaverseMapBundleSnapshot({
    ...stagingGroundMapBundle,
    gameplayProfileId: shellArcadeGameplayProfile.id
  });

  assert.equal(parsedBundle.gameplayProfileId, shellArcadeGameplayProfile.id);
  assert.throws(
    () =>
      parseMetaverseMapBundleSnapshot({
        ...stagingGroundMapBundle,
        gameplayProfileId: "missing-gameplay-profile"
      }),
    /Unsupported metaverse gameplay profile/
  );
});

test("shared metaverse world bundles preserve authored environment presentation snapshots", () => {
  const parsedBundle = parseMetaverseMapBundleSnapshot({
    ...stagingGroundMapBundle,
    environmentPresentation: {
      environment: {
        cloudCoverage: 0.42,
        cloudDensity: 0.33,
        cloudElevation: 0.58,
        cloudScale: 0.00019,
        cloudSpeed: 0.00007,
        domeRadius: 420,
        fogColor: [0.6, 0.7, 0.8],
        fogDensity: 0.0018,
        fogEnabled: true,
        groundColor: [0.18, 0.22, 0.28],
        groundFalloff: 1.3,
        horizonColor: [0.84, 0.78, 0.7],
        horizonSoftness: 0.26,
        mieCoefficient: 0.006,
        mieDirectionalG: 0.81,
        rayleigh: 2.6,
        skyExposure: 0.33,
        skyExposureCurve: 0.8,
        sunAzimuthDegrees: 148,
        sunColor: [1, 0.88, 0.72],
        sunElevationDegrees: 18,
        toneMappingExposure: 0.31,
        turbidity: 11
      },
      ocean: {
        emissiveColor: [0.1, 0.2, 0.3],
        farColor: [0.08, 0.16, 0.22],
        height: 0,
        nearColor: [0.16, 0.3, 0.44],
        planeDepth: 72,
        planeWidth: 72,
        roughness: 0.18,
        segmentCount: 96,
        waveAmplitude: 0.24,
        waveFrequencies: {
          primary: 0.11,
          ripple: 0.32,
          secondary: 0.19
        },
        waveSpeeds: {
          primary: 0.52,
          ripple: 0.94,
          secondary: 0.71
        }
      }
    }
  });

  assert.equal(parsedBundle.environmentPresentation?.environment.fogEnabled, true);
  assert.equal(parsedBundle.environmentPresentation?.environment.turbidity, 11);
  assert.equal(parsedBundle.environmentPresentation?.environment.cloudScale, 0.00019);
  assert.equal(parsedBundle.environmentPresentation?.environment.cloudSpeed, 0.00007);
  assert.equal(parsedBundle.environmentPresentation?.environment.groundFalloff, 1.3);
  assert.equal(parsedBundle.environmentPresentation?.environment.horizonSoftness, 0.26);
  assert.equal(parsedBundle.environmentPresentation?.environment.skyExposure, 0.33);
  assert.equal(
    parsedBundle.environmentPresentation?.environment.skyExposureCurve,
    0.8
  );
  assert.deepEqual(parsedBundle.environmentPresentation?.environment.fogColor, [
    0.6,
    0.7,
    0.8
  ]);
  assert.deepEqual(parsedBundle.environmentPresentation?.environment.groundColor, [
    0.18,
    0.22,
    0.28
  ]);
  assert.deepEqual(parsedBundle.environmentPresentation?.environment.horizonColor, [
    0.84,
    0.78,
    0.7
  ]);
});

test("shared metaverse world bundles default legacy environment cloud motion fields", () => {
  const parsedBundle = parseMetaverseMapBundleSnapshot({
    ...stagingGroundMapBundle,
    environmentPresentation: {
      environment: {
        cloudCoverage: 0.3,
        cloudDensity: 0.2,
        cloudElevation: 0.5,
        domeRadius: 360,
        fogColor: [0.63, 0.76, 0.88],
        fogDensity: 0.0023,
        fogEnabled: false,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.8,
        rayleigh: 2.1,
        sunAzimuthDegrees: 132,
        sunColor: [1, 0.91, 0.74],
        sunElevationDegrees: 28,
        toneMappingExposure: 0.42,
        turbidity: 9.5
      },
      ocean: {
        emissiveColor: [0.08, 0.28, 0.37],
        farColor: [0.05, 0.22, 0.34],
        height: 0,
        nearColor: [0.12, 0.45, 0.58],
        planeDepth: 72,
        planeWidth: 72,
        roughness: 0.16,
        segmentCount: 96,
        waveAmplitude: 0.32,
        waveFrequencies: {
          primary: 0.11,
          ripple: 0.38,
          secondary: 0.18
        },
        waveSpeeds: {
          primary: 0.62,
          ripple: 1.28,
          secondary: 0.87
        }
      }
    }
  });

  assert.equal(parsedBundle.environmentPresentation?.environment.cloudScale, 0.0002);
  assert.equal(parsedBundle.environmentPresentation?.environment.cloudSpeed, 0.0001);
  assert.equal(parsedBundle.environmentPresentation?.environment.groundFalloff, 1.2);
  assert.equal(parsedBundle.environmentPresentation?.environment.horizonSoftness, 0.22);
  assert.equal(parsedBundle.environmentPresentation?.environment.skyExposure, 0.42);
  assert.equal(
    parsedBundle.environmentPresentation?.environment.skyExposureCurve,
    1
  );
  assert.deepEqual(parsedBundle.environmentPresentation?.environment.groundColor, [
    0.05,
    0.22,
    0.34
  ]);
  assert.deepEqual(parsedBundle.environmentPresentation?.environment.horizonColor, [
    0.63,
    0.76,
    0.88
  ]);
});

test("shared gameplay profiles expose one grounded jump physics snapshot", () => {
  assert.deepEqual(shellArcadeGameplayProfile.groundedJumpPhysics, {
    airborneMovementDampingFactor:
      shellArcadeGameplayProfile.groundedBodyTraversal.airborneMovementDampingFactor,
    gravityUnitsPerSecond:
      shellArcadeGameplayProfile.groundedBodyTraversal.gravityUnitsPerSecond,
    jumpGroundContactGraceSeconds:
      shellArcadeGameplayProfile.groundedBodyTraversal.jumpGroundContactGraceSeconds,
    jumpImpulseUnitsPerSecond:
      shellArcadeGameplayProfile.groundedBodyTraversal.jumpImpulseUnitsPerSecond
  });
});

test("shared metaverse world bundles preserve mounted seat and entry authoring", () => {
  const parsedBundle = parseMetaverseMapBundleSnapshot(stagingGroundMapBundle);
  const barrierAsset = parsedBundle.environmentAssets.find(
    (environmentAsset) =>
      environmentAsset.assetId === "metaverse-playground-range-barrier-v1"
  );
  const dockAsset = parsedBundle.environmentAssets.find(
    (environmentAsset) => environmentAsset.assetId === "metaverse-hub-dock-v1"
  );
  const skiffAsset = parsedBundle.environmentAssets.find(
    (environmentAsset) => environmentAsset.assetId === "metaverse-hub-skiff-v1"
  );
  const diveBoatAsset = parsedBundle.environmentAssets.find(
    (environmentAsset) => environmentAsset.assetId === "metaverse-hub-dive-boat-v1"
  );
  const pushableCrateAsset = parsedBundle.environmentAssets.find(
    (environmentAsset) =>
      environmentAsset.assetId === "metaverse-hub-pushable-crate-v1"
  );

  assert.equal(barrierAsset, undefined);
  assert.notEqual(dockAsset, undefined);
  assert.notEqual(skiffAsset, undefined);
  assert.notEqual(diveBoatAsset, undefined);
  assert.notEqual(pushableCrateAsset, undefined);
  assert.equal(dockAsset?.traversalAffordance, "support");
  assert.equal(dockAsset?.placements[0]?.position.y, 0.26);
  assert.equal(dockAsset?.surfaceColliders.length, 1);
  assert.equal(dockAsset?.surfaceColliders[0]?.center.y, 0.17);
  assert.ok(
    Math.abs(
      (dockAsset?.placements[0]?.position.y ?? 0) +
        (dockAsset?.surfaceColliders[0]?.center.y ?? 0) +
        (dockAsset?.surfaceColliders[0]?.size.y ?? 0) * 0.5 -
        0.6
    ) < 0.000001
  );
  assert.equal(dockAsset?.collider, null);
  assert.notEqual(skiffAsset?.collider, null);
  assert.equal(skiffAsset?.dynamicBody, null);
  assert.equal(skiffAsset?.entries?.[0]?.entryId, "deck-entry");
  assert.equal(skiffAsset?.surfaceColliders.length, 8);
  assert.equal(skiffAsset?.seats?.[0]?.seatId, "driver-seat");
  assert.equal(
    skiffAsset?.seats?.[0]?.controlRoutingPolicyId,
    "vehicle-surface-drive"
  );
  assert.equal(skiffAsset?.traversalAffordance, "mount");
  assert.equal(skiffAsset?.collider?.size.y, 2.4);
  assert.notEqual(diveBoatAsset?.collider, null);
  assert.equal(diveBoatAsset?.dynamicBody, null);
  assert.equal(diveBoatAsset?.surfaceColliders.length, 9);
  assert.equal(diveBoatAsset?.traversalAffordance, "mount");
  assert.equal(diveBoatAsset?.collider?.size.y, 3.8);
  assert.equal(pushableCrateAsset?.traversalAffordance, "blocker");
  assert.equal(pushableCrateAsset?.dynamicBody?.kind, "dynamic-rigid-body");
});

test("metaverse presence contracts freeze roster and normalize ids", () => {
  const playerId = createMetaversePlayerId(" harbor-pilot-1 ");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const rosterInput = [
    {
      characterId: " mesh2motion-humanoid-v1 ",
      playerId,
      pose: {
        animationVocabulary: "walk",
        look: {
          pitchRadians: -0.25,
          yawRadians: 0.75
        },
        locomotionMode: "swim",
        mountedOccupancy: {
          environmentAssetId: " metaverse-hub-skiff-v1 ",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "passenger",
          seatId: " port-bench-seat "
        },
        position: {
          x: 2,
          y: 0.5,
          z: -4
        },
        stateSequence: 3.8,
        yawRadians: Math.PI * 3
      },
      username
    }
  ];
  const rosterSnapshot = createMetaversePresenceRosterSnapshot({
    players: rosterInput,
    snapshotSequence: 5.9,
    tickIntervalMs: 120
  });
  const joinCommand = createMetaverseJoinPresenceCommand({
    characterId: " mesh2motion-humanoid-v1 ",
    playerId,
    pose: {
      position: {
        x: 2,
        y: 0.5,
        z: -4
      },
      mountedOccupancy: {
        environmentAssetId: " metaverse-hub-skiff-v1 ",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "passenger",
        seatId: " port-bench-seat "
      },
      yawRadians: Math.PI * 3
    },
    username
  });

  rosterInput.push(rosterInput[0]);

  assert.equal(rosterSnapshot.players.length, 1);
  assert.equal(rosterSnapshot.players[0]?.characterId, "mesh2motion-humanoid-v1");
  assert.equal(rosterSnapshot.players[0]?.pose.stateSequence, 3);
  assert.equal(rosterSnapshot.players[0]?.pose.look.pitchRadians, -0.25);
  assert.equal(rosterSnapshot.players[0]?.pose.look.yawRadians, 0.75);
  assert.equal(rosterSnapshot.players[0]?.pose.yawRadians, Math.PI * 3);
  assert.equal(
    rosterSnapshot.players[0]?.pose.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(
    rosterSnapshot.players[0]?.pose.mountedOccupancy?.seatId,
    "port-bench-seat"
  );
  assert.equal(rosterSnapshot.snapshotSequence, 5);
  assert.ok(Object.isFrozen(rosterSnapshot.players));
  assert.ok(Object.isFrozen(rosterSnapshot.players[0]));
  assert.ok(Object.isFrozen(rosterSnapshot.players[0]?.pose.mountedOccupancy));
  assert.equal(joinCommand.playerId, "harbor-pilot-1");
  assert.equal(joinCommand.pose.animationVocabulary, "idle");
  assert.equal(joinCommand.pose.look.pitchRadians, 0);
  assert.equal(joinCommand.pose.look.yawRadians, Math.PI * 3);
  assert.equal(joinCommand.pose.locomotionMode, "grounded");
  assert.equal(joinCommand.pose.mountedOccupancy?.occupancyKind, "seat");
});

test("metaverse realtime world contracts freeze snapshots and derive seated occupancy from vehicle truth", () => {
  const playerId = createMetaversePlayerId(" harbor-pilot-1 ");
  const vehicleId = createMetaverseVehicleId(" harbor-skiff-1 ");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(vehicleId, null);
  assert.notEqual(username, null);

  const playerInputs = [
    {
      angularVelocityRadiansPerSecond: 1.25,
      characterId: " mesh2motion-humanoid-v1 ",
      groundedBody: {
        linearVelocity: {
          x: 0,
          y: 0,
          z: -1.5
        },
        position: {
          x: 2,
          y: 0.5,
          z: -4
        },
        yawRadians: Math.PI * 3
      },
      playerId,
      stateSequence: 7.8,
      username
    }
  ];
  const worldSnapshot = createMetaverseRealtimeWorldSnapshot({
    environmentBodies: [
      {
        environmentAssetId: " metaverse-hub-pushable-crate-v1 ",
        linearVelocity: {
          x: 0.2,
          y: 0,
          z: -0.4
        },
        position: {
          x: -8,
          y: 0.46,
          z: 14
        },
        yawRadians: Math.PI * -2.08
      }
    ],
    observerPlayer: {
      lastProcessedTraversalSequence: 9.3,
      playerId
    },
    players: playerInputs,
    snapshotSequence: 9.6,
    tick: {
      currentTick: 42.9,
      emittedAtServerTimeMs: 7_650.75,
      simulationTimeMs: 7_500.25,
      tickIntervalMs: 100
    },
    vehicles: [
      {
        angularVelocityRadiansPerSecond: 0.6,
        environmentAssetId: " metaverse-hub-skiff-v1 ",
        linearVelocity: {
          x: 0,
          y: 0,
          z: -1.5
        },
        position: {
          x: 2,
          y: 0,
          z: -4
        },
        seats: [
          {
            occupantPlayerId: playerId,
            occupantRole: "driver",
            seatId: " driver-seat "
          }
        ],
        vehicleId,
        yawRadians: Math.PI
      }
    ]
  });

  playerInputs.push(playerInputs[0]);

  assert.equal(worldSnapshot.snapshotSequence, 9);
  assert.equal(worldSnapshot.tick.currentTick, 42);
  assert.equal(worldSnapshot.tick.emittedAtServerTimeMs, 7_650.75);
  assert.equal(worldSnapshot.tick.serverTimeMs, 7_650.75);
  assert.equal(worldSnapshot.tick.simulationTimeMs, 7_500.25);
  assert.equal(worldSnapshot.players.length, 1);
  assert.equal(worldSnapshot.players[0]?.characterId, "mesh2motion-humanoid-v1");
  assert.equal(worldSnapshot.players[0]?.angularVelocityRadiansPerSecond, 1.25);
  assert.equal(
    worldSnapshot.observerPlayer?.lastProcessedTraversalSequence,
    9
  );
  assert.equal(worldSnapshot.players[0]?.stateSequence, 7);
  assert.equal(worldSnapshot.players[0]?.mountedOccupancy?.vehicleId, vehicleId);
  assert.equal(
    worldSnapshot.players[0]?.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(worldSnapshot.players[0]?.mountedOccupancy?.seatId, "driver-seat");
  assert.equal(
    worldSnapshot.players[0]?.mountedOccupancy?.occupantRole,
    "driver"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionKind,
    "none"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionPhase,
    "idle"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.lastConsumedActionKind,
    "none"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.lastRejectedActionKind,
    "none"
  );
  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, 0);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, Math.PI * 3);
  assert.equal(
    worldSnapshot.players[0]?.presentationIntent.moveAxis,
    0
  );
  assert.equal(
    worldSnapshot.players[0]?.presentationIntent.strafeAxis,
    0
  );
  assert.equal(
    worldSnapshot.players[0]?.groundedBody.contact.supportingContactDetected,
    true
  );
  assert.equal(worldSnapshot.players[0]?.groundedBody.driveTarget.boost, false);
  assert.equal(worldSnapshot.players[0]?.groundedBody.driveTarget.moveAxis, 0);
  assert.equal(
    worldSnapshot.players[0]?.groundedBody.driveTarget
      .targetPlanarSpeedUnitsPerSecond,
    0
  );
  assert.equal(
    worldSnapshot.players[0]?.groundedBody.interaction
      .applyImpulsesToDynamicBodies,
    false
  );
  assert.equal(worldSnapshot.players[0]?.swimBody, null);
  assert.equal(
    worldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    playerId
  );
  assert.equal(
    worldSnapshot.environmentBodies[0]?.environmentAssetId,
    "metaverse-hub-pushable-crate-v1"
  );
  assert.equal(worldSnapshot.environmentBodies[0]?.linearVelocity.z, -0.4);
  assert.equal(worldSnapshot.environmentBodies[0]?.yawRadians, Math.PI * -2.08);
  assert.ok(Object.isFrozen(worldSnapshot.players));
  assert.ok(Object.isFrozen(worldSnapshot.environmentBodies));
  assert.ok(Object.isFrozen(worldSnapshot.vehicles));
  assert.ok(Object.isFrozen(worldSnapshot.players[0]?.mountedOccupancy));
});

test("metaverse realtime world contracts keep combat action receipts observer-local and correlate projectile outcomes", () => {
  const playerId = createMetaversePlayerId("combat-observer-pilot");
  const username = createUsername("Combat Observer Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const worldSnapshot = createMetaverseRealtimeWorldSnapshot({
    combatEvents: [
      {
        actionSequence: 3.4,
        cameraRayForwardWorld: {
          x: 0,
          y: 0,
          z: -1
        },
        cameraRayOriginWorld: {
          x: 0,
          y: 1.62,
          z: 0
        },
        eventKind: "hitscan-resolved",
        eventSequence: 7.2,
        hitscan: {
          finalReason: "hit-player",
          hitKind: "player",
          hitPointWorld: {
            x: 0,
            y: 1.62,
            z: -6
          },
          regionId: "head",
          targetPlayerId: playerId
        },
        playerId,
        presentationDeliveryModel: "hitscan-tracer",
        semanticMuzzleWorld: {
          x: 0.18,
          y: 1.42,
          z: -0.55
        },
        serverTick: 24.8,
        weaponId: " metaverse-service-pistol-v2 "
      }
    ],
    combatFeed: [
      {
        attackerPlayerId: playerId,
        damageAmount: 42,
        hitZone: "head",
        sequence: 5.9,
        sourceActionSequence: 3.4,
        sourceProjectileId: " projectile-3 ",
        targetPlayerId: playerId,
        timeMs: 1_250.4,
        type: "damage",
        weaponId: " metaverse-service-pistol-v2 "
      },
      {
        attackerPlayerId: playerId,
        headshot: true,
        sequence: 6.2,
        sourceActionSequence: 3.4,
        sourceProjectileId: " projectile-3 ",
        targetPlayerId: playerId,
        timeMs: 1_260.1,
        type: "kill",
        weaponId: " metaverse-service-pistol-v2 "
      }
    ],
    observerPlayer: {
      highestProcessedPlayerActionSequence: 3.8,
      playerId,
      recentPlayerActionReceipts: [
        createMetaverseCombatActionReceiptSnapshot({
          actionSequence: 3.4,
          kind: "fire-weapon",
          processedAtTimeMs: 1_240.9,
          projectileId: " projectile-3 ",
          status: "accepted",
          weaponId: " metaverse-service-pistol-v2 "
        })
      ]
    },
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
            z: 0
          },
          yawRadians: 0
        },
        playerId,
        stateSequence: 2,
        username
      }
    ],
    projectiles: [
      {
        direction: {
          x: 0,
          y: 0,
          z: -1
        },
        ownerPlayerId: playerId,
        position: {
          x: 0,
          y: 1.62,
          z: 0
        },
        projectileId: " projectile-3 ",
        sourceActionSequence: 3.4,
        spawnedAtTimeMs: 1_240.2,
        velocityMetersPerSecond: 900,
        weaponId: " metaverse-service-pistol-v2 "
      }
    ],
    snapshotSequence: 8,
    tick: {
      currentTick: 24,
      emittedAtServerTimeMs: 1_250,
      tickIntervalMs: 50
    },
    vehicles: []
  });

  assert.equal(
    worldSnapshot.observerPlayer?.highestProcessedPlayerActionSequence,
    3
  );
  assert.equal(
    worldSnapshot.observerPlayer?.recentPlayerActionReceipts[0]?.actionSequence,
    3
  );
  assert.equal(
    worldSnapshot.observerPlayer?.recentPlayerActionReceipts[0]?.sourceProjectileId,
    "projectile-3"
  );
  assert.equal(worldSnapshot.projectiles[0]?.sourceActionSequence, 3);
  assert.equal(worldSnapshot.combatEvents[0]?.eventSequence, 7);
  assert.equal(worldSnapshot.combatEvents[0]?.shotId, `${playerId}:3`);
  assert.equal(
    worldSnapshot.combatEvents[0]?.presentationDeliveryModel,
    "hitscan-tracer"
  );
  assert.equal(worldSnapshot.combatEvents[0]?.hitscan?.hitKind, "player");
  assert.equal(worldSnapshot.combatFeed[0]?.type, "damage");
  assert.equal(worldSnapshot.combatFeed[0]?.sourceActionSequence, 3);
  assert.equal(worldSnapshot.combatFeed[0]?.sourceProjectileId, "projectile-3");
  assert.equal(worldSnapshot.combatFeed[1]?.type, "kill");
  assert.equal(worldSnapshot.combatFeed[1]?.sourceActionSequence, 3);
  assert.equal(worldSnapshot.combatFeed[1]?.sourceProjectileId, "projectile-3");
});

test("metaverse issue-player-action fire commands normalize actionSequence instead of fireSequence", () => {
  const playerId = createMetaversePlayerId("combat-command-pilot");

  assert.notEqual(playerId, null);

  const fireWeaponCommand = createFireWeaponPlayerActionCommand({
    actionSequence: 4.9,
    issuedAtAuthoritativeTimeMs: 1_200.6,
    playerId,
    weaponId: " metaverse-service-pistol-v2 "
  });

  assert.equal(fireWeaponCommand.action.actionSequence, 4);
  assert.equal(fireWeaponCommand.action.weaponId, "metaverse-service-pistol-v2");
  assert.equal(fireWeaponCommand.action.aimSnapshot.yawRadians, 0);
  assert.equal(fireWeaponCommand.type, "issue-player-action");
});

test("metaverse fire aim snapshots preserve semantic reticle ray fields", () => {
  const aimSnapshot = createMetaverseCombatAimSnapshot({
    pitchRadians: Math.PI * 0.125,
    rayForwardWorld: {
      x: 0.25,
      y: 0.5,
      z: -0.82915619758885
    },
    rayOriginWorld: {
      x: 1.25,
      y: 1.72,
      z: -3.5
    },
    yawRadians: Math.PI * 0.25
  });
  assert.deepEqual(aimSnapshot.rayOriginWorld, {
    x: 1.25,
    y: 1.72,
    z: -3.5
  });
  assert.deepEqual(aimSnapshot.rayForwardWorld, {
    x: 0.25,
    y: 0.5,
    z: -0.82915619758885
  });

  const legacyAimSnapshot = createMetaverseCombatAimSnapshot();

  assert.equal(legacyAimSnapshot.rayOriginWorld, null);
  assert.equal(legacyAimSnapshot.rayForwardWorld, null);
});

test("metaverse realtime world contracts preserve explicit traversal authority from accepted jump resolution", () => {
  const playerId = createMetaversePlayerId("jump-authority-pilot");
  const username = createUsername("Jump Authority Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const worldSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          linearVelocity: {
            x: 0,
            y: 3.2,
            z: 0
          },
          position: {
            x: 0,
            y: 1.4,
            z: 0
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId,
        traversalAuthority: {
          currentActionKind: "jump",
          currentActionPhase: "rising",
          currentActionSequence: 7,
          lastConsumedActionKind: "jump",
          lastConsumedActionSequence: 7
        },
        username
      }
    ],
    tick: {
      currentTick: 3,
      emittedAtServerTimeMs: 360,
      simulationTimeMs: 300,
      tickIntervalMs: 100
    },
    vehicles: []
  });

  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionKind,
    "jump"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionPhase,
    "rising"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionSequence,
    7
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.lastConsumedActionKind,
    "jump"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    7
  );
});

test("metaverse realtime world contracts keep free-roam mounted entry occupancy on grounded jump-body authority", () => {
  const playerId = createMetaversePlayerId("deck-entry-jump-authority-pilot");
  const username = createUsername("Deck Entry Jump Authority Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const worldSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          jumpBody: {
            grounded: false,
            jumpGroundContactGraceSecondsRemaining: 0,
            jumpReady: false,
            jumpSnapSuppressionActive: true,
            verticalSpeedUnitsPerSecond: 4.2
          },
          position: {
            x: 0,
            y: 1.4,
            z: 0
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: "deck-entry",
          occupancyKind: "entry",
          occupantRole: "passenger",
          seatId: null,
          vehicleId: createMetaverseVehicleId("harbor-skiff-deck")
        },
        playerId,
        username
      }
    ],
    tick: {
      currentTick: 5,
      emittedAtServerTimeMs: 500,
      simulationTimeMs: 500,
      tickIntervalMs: 100
    },
    vehicles: [
      {
        angularVelocityRadiansPerSecond: 0,
        environmentAssetId: "metaverse-hub-skiff-v1",
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
        seats: [],
        vehicleId: createMetaverseVehicleId("harbor-skiff-deck"),
        yawRadians: 0
      }
    ]
  });

  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionKind,
    "jump"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionPhase,
    "rising"
  );
});

test("metaverse realtime world contracts preserve explicit traversal authority while shared jump body owns capsule truth", () => {
  const playerId = createMetaversePlayerId("jump-body-authority-pilot");
  const username = createUsername("Jump Body Authority Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const worldSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        characterId: "mesh2motion-humanoid-v1",
        groundedBody: {
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          jumpBody: {
            grounded: false,
            jumpGroundContactGraceSecondsRemaining: 0,
            jumpReady: false,
            jumpSnapSuppressionActive: true,
            verticalSpeedUnitsPerSecond: 4.2
          },
          position: {
            x: 0,
            y: 1.4,
            z: 0
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId,
        traversalAuthority: {
          currentActionKind: "jump",
          currentActionPhase: "rising",
          currentActionSequence: 9
        },
        username
      }
    ],
    tick: {
      currentTick: 5,
      emittedAtServerTimeMs: 500,
      simulationTimeMs: 500,
      tickIntervalMs: 100
    },
    vehicles: []
  });

  assert.equal(
    worldSnapshot.players[0]?.groundedBody.jumpBody.verticalSpeedUnitsPerSecond,
    4.2
  );
  assert.equal(
    worldSnapshot.players[0]?.groundedBody.contact.supportingContactDetected,
    false
  );
  assert.equal(
    worldSnapshot.players[0]?.groundedBody.interaction
      .applyImpulsesToDynamicBodies,
    false
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionKind,
    "jump"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionPhase,
    "rising"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionSequence,
    9
  );
});

test("metaverse realtime world contracts preserve explicit traversal startup authority", () => {
  const playerId = createMetaversePlayerId("jump-startup-pilot");
  const username = createUsername("Jump Startup Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const worldSnapshot = createMetaverseRealtimeWorldSnapshot({
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
            y: 0.6,
            z: 0
          },
          yawRadians: 0
        },
        locomotionMode: "grounded",
        playerId,
        traversalAuthority: {
          currentActionKind: "jump",
          currentActionPhase: "startup",
          currentActionSequence: 4,
          phaseStartedAtTick: 11
        },
        username
      }
    ],
    tick: {
      currentTick: 11,
      emittedAtServerTimeMs: 1_100,
      simulationTimeMs: 1_100,
      tickIntervalMs: 100
    },
    vehicles: []
  });

  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionKind,
    "jump"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionPhase,
    "startup"
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.currentActionSequence,
    4
  );
  assert.equal(
    worldSnapshot.players[0]?.traversalAuthority.phaseStartedAtTick,
    11
  );
});

test("metaverse realtime world contracts carry a shared swim body owner for swim locomotion", () => {
  const playerId = createMetaversePlayerId("swim-body-pilot");
  const username = createUsername("Swim Body Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const worldSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        characterId: "mesh2motion-humanoid-v1",
        swimBody: {
          linearVelocity: {
            x: 1.5,
            y: 0,
            z: -6
          },
          position: {
            x: 4,
            y: 0,
            z: 18
          },
          yawRadians: 0.25
        },
        locomotionMode: "swim",
        playerId,
        username
      }
    ],
    tick: {
      currentTick: 13,
      emittedAtServerTimeMs: 1_300,
      simulationTimeMs: 1_300,
      tickIntervalMs: 100
    },
    vehicles: []
  });

  assert.deepEqual(worldSnapshot.players[0]?.swimBody?.linearVelocity, {
    x: 1.5,
    y: 0,
    z: -6
  });
  assert.deepEqual(worldSnapshot.players[0]?.swimBody?.position, {
    x: 4,
    y: 0,
    z: 18
  });
  assert.equal(worldSnapshot.players[0]?.swimBody?.yawRadians, 0.25);
});

test("metaverse realtime world contracts reject seat occupancy that disagrees with the vehicle tick", () => {
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const vehicleId = createMetaverseVehicleId("harbor-skiff-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(vehicleId, null);
  assert.notEqual(username, null);

  assert.throws(
    () =>
      createMetaverseRealtimeWorldSnapshot({
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
                y: 0,
                z: 0
              },
              yawRadians: 0
            },
            mountedOccupancy: {
              environmentAssetId: "metaverse-hub-skiff-v1",
              occupancyKind: "seat",
              occupantRole: "passenger",
              seatId: "port-bench-seat",
              vehicleId
            },
            playerId,
            username
          }
        ],
        tick: {
          currentTick: 3,
          emittedAtServerTimeMs: 360,
          simulationTimeMs: 300,
          tickIntervalMs: 100
        },
        vehicles: [
          {
            angularVelocityRadiansPerSecond: 0,
            environmentAssetId: "metaverse-hub-skiff-v1",
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
            seats: [
              {
                occupantPlayerId: playerId,
                occupantRole: "driver",
                seatId: "driver-seat"
              }
            ],
            vehicleId,
            yawRadians: 0
          }
        ]
      }),
    /seat occupancy must match/
  );
});

test("metaverse realtime world contracts reject duplicate environment body ids", () => {
  assert.throws(
    () =>
      createMetaverseRealtimeWorldSnapshot({
        environmentBodies: [
          {
            environmentAssetId: "metaverse-hub-pushable-crate-v1",
            linearVelocity: {
              x: 0,
              y: 0,
              z: 0
            },
            position: {
              x: -8,
              y: 0.46,
              z: 14
            },
            yawRadians: 0
          },
          {
            environmentAssetId: "metaverse-hub-pushable-crate-v1",
            linearVelocity: {
              x: 0,
              y: 0,
              z: 0
            },
            position: {
              x: -7,
              y: 0.46,
              z: 14
            },
            yawRadians: 0
          }
        ],
        players: [],
        tick: {
          currentTick: 1,
          emittedAtServerTimeMs: 100,
          simulationTimeMs: 100,
          tickIntervalMs: 100
        },
        vehicles: []
      }),
    /duplicate environment body environmentAssetId/
  );
});

test("metaverse realtime world driver control commands normalize explicit intent for transport", () => {
  const playerId = createMetaversePlayerId(" harbor-pilot-1 ");

  assert.notEqual(playerId, null);

  const controlIntent = createMetaverseDriverVehicleControlIntentSnapshot({
    boost: true,
    environmentAssetId: " metaverse-hub-skiff-v1 ",
    moveAxis: 2.4,
    strafeAxis: -4,
    yawAxis: 0.5
  });
  const command = createMetaverseSyncDriverVehicleControlCommand({
    controlIntent,
    controlSequence: 3.9,
    playerId
  });
  const webTransportRequest =
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command
    });

  assert.equal(controlIntent.environmentAssetId, "metaverse-hub-skiff-v1");
  assert.equal(controlIntent.moveAxis, 1);
  assert.equal(controlIntent.strafeAxis, -1);
  assert.equal(command.type, "sync-driver-vehicle-control");
  assert.equal(command.controlSequence, 3);
  assert.equal(webTransportRequest.type, "world-command-request");
  assert.equal(
    webTransportRequest.command.controlIntent.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
});

test("metaverse realtime world traversal intent commands normalize explicit transport inputs", () => {
  const playerId = createMetaversePlayerId(" harbor-pilot-1 ");

  assert.notEqual(playerId, null);

  const command = createMetaverseSyncPlayerTraversalIntentCommand({
    intent: {
      boost: true,
      jump: true,
      locomotionMode: "swim",
      moveAxis: 2.4,
      sequence: 8.2,
      strafeAxis: -4,
      yawAxis: 0.5
    },
    playerId
  });
  const webTransportRequest =
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command
  });

  assert.equal(command.type, "sync-player-traversal-intent");
  assert.equal(command.intent.locomotionMode, "swim");
  assert.equal(command.intent.sequence, 8);
  assert.equal(command.intent.bodyControl.moveAxis, 1);
  assert.equal(command.intent.bodyControl.strafeAxis, -1);
  assert.equal(command.intent.actionIntent.kind, "jump");
  assert.equal(webTransportRequest.type, "world-command-request");
  assert.equal(
    webTransportRequest.command.type,
    "sync-player-traversal-intent"
  );
  assert.equal(webTransportRequest.command.intent.sequence, 8);
});

test("metaverse realtime world traversal intent commands normalize explicit pending intent samples without traversal timestamps", () => {
  const playerId = createMetaversePlayerId(" harbor-pilot-history-1 ");

  assert.notEqual(playerId, null);

  const command = createMetaverseSyncPlayerTraversalIntentCommand({
    intent: {
      boost: false,
      jump: false,
      locomotionMode: "grounded",
      moveAxis: 0,
      sequence: 2,
      strafeAxis: 1,
      yawAxis: 0.5
    },
    pendingIntentSamples: [
      {
        actionIntent: {
          kind: "none",
          pressed: false
        },
        bodyControl: {
          boost: false,
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0
        },
        facing: {
          pitchRadians: 0,
          yawRadians: 0
        },
        locomotionMode: "grounded",
        sequence: 1
      }
    ],
    playerId
  });

  assert.deepEqual(command.pendingIntentSamples, [
    {
      actionIntent: {
        kind: "none",
        pressed: false,
        sequence: 0
      },
      bodyControl: {
        boost: false,
        moveAxis: 1,
        strafeAxis: 0,
        turnAxis: 0
      },
      facing: {
        pitchRadians: 0,
        yawRadians: 0
      },
      locomotionMode: "grounded",
      sequence: 1
    }
  ]);
});

test("metaverse gameplay traversal intent snapshots normalize supported locomotion and drop unsupported routing", () => {
  const groundedIntent = createMetaverseGameplayTraversalIntentSnapshotInput({
    boost: false,
    jump: false,
    locomotionMode: "grounded",
    moveAxis: 1,
    pitchRadians: 0.25,
    strafeAxis: -1,
    turnAxis: 0.5,
    yawRadians: 1.5
  });

  const unsupportedIntent = createMetaverseGameplayTraversalIntentSnapshotInput({
    boost: true,
    jump: true,
    locomotionMode: "mounted",
    moveAxis: 1,
    pitchRadians: 0.25,
    strafeAxis: -1,
    turnAxis: 0.5,
    yawRadians: 1.5
  });

  assert.deepEqual(groundedIntent, {
    actionIntent: {
      kind: "none",
      pressed: false,
      sequence: 0
    },
    bodyControl: {
      boost: false,
      moveAxis: 1,
      strafeAxis: -1,
      turnAxis: 0.5
    },
    facing: {
      pitchRadians: 0.25,
      yawRadians: 1.5
    },
    locomotionMode: "grounded"
  });
  assert.equal(unsupportedIntent, null);
});

test("metaverse gameplay traversal intent snapshots gate jump to grounded locomotion only", () => {
  const groundedIntent = createMetaverseGameplayTraversalIntentSnapshotInput({
    boost: true,
    jump: true,
    locomotionMode: "grounded",
    moveAxis: 2.4,
    pitchRadians: Math.PI * 0.25,
    strafeAxis: -4,
    turnAxis: 0.5,
    yawRadians: -Math.PI * 0.5
  });
  const swimIntent = createMetaverseGameplayTraversalIntentSnapshotInput({
    boost: true,
    jump: true,
    locomotionMode: "swim",
    moveAxis: 2.4,
    pitchRadians: 0.1,
    strafeAxis: -4,
    turnAxis: 0.5,
    yawRadians: 0.25
  });
  const unsupportedIntent = createMetaverseGameplayTraversalIntentSnapshotInput({
    boost: true,
    jump: true,
    locomotionMode: null,
    moveAxis: 1,
    pitchRadians: 0,
    strafeAxis: 0,
    turnAxis: 0,
    yawRadians: 0
  });

  assert.equal(groundedIntent?.actionIntent?.kind, "jump");
  assert.equal(groundedIntent?.bodyControl?.moveAxis, 1);
  assert.equal(groundedIntent?.bodyControl?.strafeAxis, -1);
  assert.equal(swimIntent?.actionIntent?.kind, "none");
  assert.equal(swimIntent?.bodyControl?.moveAxis, 1);
  assert.equal(unsupportedIntent, null);
});

test("metaverse realtime world look intent commands normalize explicit transport inputs", () => {
  const playerId = createMetaversePlayerId(" harbor-pilot-1 ");

  assert.notEqual(playerId, null);

  const command = createMetaverseSyncPlayerLookIntentCommand({
    lookIntent: {
      pitchRadians: Math.PI * 4.5,
      yawRadians: -Math.PI * 3.25
    },
    lookSequence: 6.8,
    playerId
  });
  const webTransportRequest =
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command
    });

  assert.equal(command.type, "sync-player-look-intent");
  assert.equal(command.lookSequence, 6);
  assert.equal(command.lookIntent.pitchRadians, Math.PI * 4.5);
  assert.equal(command.lookIntent.yawRadians, -Math.PI * 3.25);
  assert.equal(webTransportRequest.type, "world-command-request");
  assert.equal(webTransportRequest.command.type, "sync-player-look-intent");
  assert.equal(webTransportRequest.command.lookSequence, 6);
});

test("metaverse realtime world mounted occupancy commands normalize explicit reliable transitions", () => {
  const playerId = createMetaversePlayerId(" harbor-pilot-1 ");

  assert.notEqual(playerId, null);

  const command = createMetaverseSyncMountedOccupancyCommand({
    mountedOccupancy: {
      environmentAssetId: " metaverse-hub-skiff-v1 ",
      entryId: null,
      occupancyKind: "seat",
      occupantRole: "driver",
      seatId: " driver-seat "
    },
    playerId
  });
  const webTransportRequest =
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command
    });

  assert.equal(command.type, "sync-mounted-occupancy");
  assert.equal(
    command.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(command.mountedOccupancy?.seatId, "driver-seat");
  assert.equal(webTransportRequest.type, "world-command-request");
  assert.equal(webTransportRequest.command.type, "sync-mounted-occupancy");
  assert.equal(
    webTransportRequest.command.mountedOccupancy?.seatId,
    "driver-seat"
  );
});

test("shared metaverse mounted occupancy identity keys stay aligned across command and authority seams", () => {
  const entryKey = createMetaverseMountedOccupancyIdentityKey({
    environmentAssetId: "harbor-skiff-1",
    entryId: "boarding-port",
    occupancyKind: "entry",
    seatId: null
  });
  const seatKey = createMetaverseMountedOccupancyIdentityKey(
    createMetaversePresenceMountedOccupancySnapshot({
      environmentAssetId: " harbor-skiff-1 ",
      entryId: null,
      occupancyKind: "seat",
      occupantRole: "driver",
      seatId: " driver-seat "
    })
  );

  assert.equal(entryKey, "harbor-skiff-1:entry:boarding-port:");
  assert.equal(seatKey, "harbor-skiff-1:seat::driver-seat");
  assert.equal(createMetaverseMountedOccupancyIdentityKey(null), null);
});

test("webtransport shared contracts wrap presence, world, and Duck Hunt room messages with explicit domain names", () => {
  const metaversePlayerId = createMetaversePlayerId("harbor-pilot-1");
  const metaverseRoomId = createMetaverseRoomId("metaverse-room-test");
  const metaverseVehicleId = createMetaverseVehicleId("harbor-skiff-1");
  const coopPlayerId = createCoopPlayerId("coop-pilot-1");
  const coopRoomId = createCoopRoomId("co-op-harbor");
  const coopSessionId = createCoopSessionId("co-op-harbor-session-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(metaversePlayerId, null);
  assert.notEqual(metaverseRoomId, null);
  assert.notEqual(metaverseVehicleId, null);
  assert.notEqual(coopPlayerId, null);
  assert.notEqual(coopRoomId, null);
  assert.notEqual(coopSessionId, null);
  assert.notEqual(username, null);

  const presenceServerMessage = createMetaversePresenceWebTransportServerEventMessage({
    event: {
      roster: createMetaversePresenceRosterSnapshot({
        players: [
          {
            characterId: "mesh2motion-humanoid-v1",
            playerId: metaversePlayerId,
            pose: {
              position: {
                x: 0,
                y: 1.62,
                z: 24
              },
              yawRadians: 0
            },
            username
          }
        ],
        snapshotSequence: 3,
        tickIntervalMs: 150
      }),
      type: "presence-roster"
    }
  });
  const worldServerMessage = createMetaverseRealtimeWorldWebTransportServerEventMessage({
    event: createMetaverseRealtimeWorldEvent({
      world: {
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
            playerId: metaversePlayerId,
            stateSequence: 2,
            username
          }
        ],
        snapshotSequence: 4,
        tick: {
          currentTick: 12,
          emittedAtServerTimeMs: 1_920,
          simulationTimeMs: 1_800,
          tickIntervalMs: 150
        },
        vehicles: [
          {
            angularVelocityRadiansPerSecond: 0,
            environmentAssetId: "metaverse-hub-skiff-v1",
            linearVelocity: {
              x: 0,
              y: 0,
              z: 0
            },
            position: {
              x: 8,
              y: 0.4,
              z: 12
            },
            seats: [],
            vehicleId: metaverseVehicleId,
            yawRadians: 0
          }
        ]
      }
    })
  });
  const coopServerMessage = createDuckHuntCoopRoomWebTransportServerEventMessage({
    event: createCoopRoomSnapshotEvent(
      {
      birds: [],
      capacity: 4,
      players: [],
      roomId: coopRoomId,
      session: {
        birdsCleared: 0,
        birdsRemaining: 1,
        requiredReadyPlayerCount: 1,
        sessionId: coopSessionId,
        teamHitsLanded: 0,
        teamShotsFired: 0
      },
      tick: {
        currentTick: 0,
        tickIntervalMs: 50
      }
      }
    )
  });

  const presenceCommandRequest = createMetaversePresenceWebTransportCommandRequest({
    roomId: metaverseRoomId,
    command: createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId: metaversePlayerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        yawRadians: 0
      },
      username
    })
  });
  const presenceRosterRequest = createMetaversePresenceWebTransportRosterRequest({
    observerPlayerId: metaversePlayerId,
    roomId: metaverseRoomId
  });
  const worldSnapshotRequest =
    createMetaverseRealtimeWorldWebTransportSnapshotRequest({
      observerPlayerId: metaversePlayerId,
      roomId: metaverseRoomId
    });
  const coopCommandRequest = createDuckHuntCoopRoomWebTransportCommandRequest({
    command: createCoopJoinRoomCommand({
      playerId: coopPlayerId,
      ready: false,
      roomId: coopRoomId,
      username
    })
  });
  const coopSnapshotRequest = createDuckHuntCoopRoomWebTransportSnapshotRequest({
    observerPlayerId: coopPlayerId,
    roomId: coopRoomId
  });

  assert.equal(presenceServerMessage.type, "presence-server-event");
  assert.equal(presenceServerMessage.event.type, "presence-roster");
  assert.ok(Object.isFrozen(presenceServerMessage));
  assert.equal(presenceCommandRequest.type, "presence-command-request");
  assert.equal(presenceCommandRequest.command.type, "join-presence");
  assert.equal(presenceCommandRequest.roomId, metaverseRoomId);
  assert.equal(presenceRosterRequest.type, "presence-roster-request");
  assert.equal(presenceRosterRequest.roomId, metaverseRoomId);
  assert.equal(worldServerMessage.type, "world-server-event");
  assert.equal(worldServerMessage.event.type, "world-snapshot");
  assert.equal(worldSnapshotRequest.type, "world-snapshot-request");
  assert.equal(worldSnapshotRequest.roomId, metaverseRoomId);
  assert.equal(coopServerMessage.type, "coop-room-server-event");
  assert.equal(coopServerMessage.event.type, "room-snapshot");
  assert.equal(coopCommandRequest.type, "coop-room-command-request");
  assert.equal(coopCommandRequest.command.type, "join-room");
  assert.equal(coopSnapshotRequest.type, "coop-room-snapshot-request");
});

test("webtransport datagram shared contracts wrap latest-wins channels with explicit domain names", () => {
  const metaversePlayerId = createMetaversePlayerId("harbor-pilot-1");
  const metaverseRoomId = createMetaverseRoomId("tdm-harbor");
  const coopPlayerId = createCoopPlayerId("coop-pilot-1");
  const coopRoomId = createCoopRoomId("co-op-harbor");

  assert.notEqual(metaversePlayerId, null);
  assert.notEqual(metaverseRoomId, null);
  assert.notEqual(coopPlayerId, null);
  assert.notEqual(coopRoomId, null);

  const driverVehicleControlDatagram =
    createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram({
      command: createMetaverseSyncDriverVehicleControlCommand({
        controlIntent: {
          boost: true,
          environmentAssetId: " metaverse-hub-skiff-v1 ",
          moveAxis: 2.5,
          strafeAxis: -3,
          yawAxis: 0.75
        },
        controlSequence: 8.2,
        playerId: metaversePlayerId
      }),
      roomId: metaverseRoomId
    });
  const playerTraversalIntentDatagram =
    createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram({
      command: createMetaverseSyncPlayerTraversalIntentCommand({
        intent: {
          boost: true,
          jump: false,
          locomotionMode: "grounded",
          moveAxis: 1.5,
          sequence: 11.7,
          strafeAxis: -0.25,
          yawAxis: 0.8
        },
        playerId: metaversePlayerId
      }),
      roomId: metaverseRoomId
    });
  const playerLookIntentDatagram =
    createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram({
      command: createMetaverseSyncPlayerLookIntentCommand({
        lookIntent: {
          pitchRadians: 0.45,
          yawRadians: -1.2
        },
        lookSequence: 9.4,
        playerId: metaversePlayerId
      }),
      roomId: metaverseRoomId
    });
  const playerPresenceDatagram =
    createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram({
      command: createCoopSyncPlayerPresenceCommand({
        aimDirection: {
          x: 0,
          y: 0.2,
          z: -1
        },
        pitchRadians: 0.4,
        playerId: coopPlayerId,
        position: {
          x: 1,
          y: 1.35,
          z: 2
        },
        roomId: coopRoomId,
        stateSequence: 5.7,
        weaponId: " semiautomatic-pistol ",
        yawRadians: 0.8
      })
    });

  assert.equal(
    driverVehicleControlDatagram.type,
    "world-driver-vehicle-control-datagram"
  );
  assert.equal(
    driverVehicleControlDatagram.command.type,
    "sync-driver-vehicle-control"
  );
  assert.equal(driverVehicleControlDatagram.roomId, metaverseRoomId);
  assert.equal(
    driverVehicleControlDatagram.command.controlSequence,
    8
  );
  assert.equal(
    driverVehicleControlDatagram.command.controlIntent.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.ok(Object.isFrozen(driverVehicleControlDatagram));
  assert.equal(
    playerTraversalIntentDatagram.type,
    "world-player-traversal-intent-datagram"
  );
  assert.equal(
    playerTraversalIntentDatagram.command.type,
    "sync-player-traversal-intent"
  );
  assert.equal(
    playerTraversalIntentDatagram.command.intent.sequence,
    11
  );
  assert.equal(
    playerTraversalIntentDatagram.command.intent.locomotionMode,
    "grounded"
  );
  assert.equal(
    playerTraversalIntentDatagram.command.intent.bodyControl.moveAxis,
    1
  );
  assert.ok(Object.isFrozen(playerTraversalIntentDatagram));
  assert.equal(
    playerLookIntentDatagram.type,
    "world-player-look-intent-datagram"
  );
  assert.equal(
    playerLookIntentDatagram.command.type,
    "sync-player-look-intent"
  );
  assert.equal(playerLookIntentDatagram.command.lookSequence, 9);
  assert.equal(playerLookIntentDatagram.command.lookIntent.pitchRadians, 0.45);
  assert.equal(playerLookIntentDatagram.command.lookIntent.yawRadians, -1.2);
  assert.ok(Object.isFrozen(playerLookIntentDatagram));

  assert.equal(
    playerPresenceDatagram.type,
    "coop-room-player-presence-datagram"
  );
  assert.equal(
    playerPresenceDatagram.command.type,
    "sync-player-presence"
  );
  assert.equal(playerPresenceDatagram.command.stateSequence, 5);
  assert.equal(
    playerPresenceDatagram.command.weaponId,
    "semiautomatic-pistol"
  );
  assert.ok(Object.isFrozen(playerPresenceDatagram));
});
