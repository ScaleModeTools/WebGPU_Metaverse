import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseCombatMatchSnapshot,
  createMetaversePlayerActionReceiptSnapshot,
  createMetaversePlayerActionSnapshot,
  createMetaversePlayerCombatSnapshot,
  createMetaversePlayerCombatHurtVolumes,
  readMetaverseCombatWeaponProfile,
  resolveMetaverseCombatClosestHurtVolumePoint,
  resolveMetaverseCombatSemanticWeaponTipFrame,
  resolveMetaverseCombatHitForSegment
} from "@webgpu-metaverse/shared";

function readCapsuleCenter(capsule) {
  return {
    x: (capsule.start.x + capsule.end.x) / 2,
    y: (capsule.start.y + capsule.end.y) / 2,
    z: (capsule.start.z + capsule.end.z) / 2
  };
}

function readRegionCenter(region) {
  return region.shape === "sphere"
    ? region.sphere.center
    : readCapsuleCenter(region.capsule);
}

function assertAlmostEqual(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ${expected}, received ${actual}`
  );
}

test("shared metaverse combat match defaults to a 3 second respawn delay", () => {
  const combatMatchSnapshot = createMetaverseCombatMatchSnapshot();

  assert.equal(combatMatchSnapshot.respawnDelayMs, 3_000);
});

test("shared metaverse combat normalizes switch weapon slot actions and receipts", () => {
  const actionSnapshot = createMetaversePlayerActionSnapshot({
    actionSequence: 12,
    intendedWeaponInstanceId: "player-1:secondary:metaverse-rocket-launcher-v1",
    issuedAtAuthoritativeTimeMs: 4_500,
    kind: "switch-active-weapon-slot",
    requestedActiveSlotId: "secondary"
  });
  const acceptedReceipt = createMetaversePlayerActionReceiptSnapshot({
    actionSequence: 12,
    activeSlotId: "secondary",
    intendedWeaponInstanceId: "player-1:secondary:metaverse-rocket-launcher-v1",
    kind: "switch-active-weapon-slot",
    processedAtTimeMs: 4_520,
    requestedActiveSlotId: "secondary",
    status: "accepted",
    weaponId: "metaverse-rocket-launcher-v1",
    weaponInstanceId: "player-1:secondary:metaverse-rocket-launcher-v1"
  });
  const rejectedReceipt = createMetaversePlayerActionReceiptSnapshot({
    actionSequence: 13,
    kind: "switch-active-weapon-slot",
    processedAtTimeMs: 4_560,
    rejectionReason: "stale-weapon-state",
    requestedActiveSlotId: "secondary",
    status: "rejected"
  });

  assert.equal(actionSnapshot.kind, "switch-active-weapon-slot");
  assert.equal(actionSnapshot.requestedActiveSlotId, "secondary");
  assert.equal(
    actionSnapshot.intendedWeaponInstanceId,
    "player-1:secondary:metaverse-rocket-launcher-v1"
  );
  assert.equal(acceptedReceipt.status, "accepted");
  assert.equal(acceptedReceipt.rejectionReason, null);
  assert.equal(acceptedReceipt.activeSlotId, "secondary");
  assert.equal(acceptedReceipt.weaponId, "metaverse-rocket-launcher-v1");
  assert.equal(rejectedReceipt.status, "rejected");
  assert.equal(rejectedReceipt.rejectionReason, "stale-weapon-state");
  assert.equal(rejectedReceipt.activeSlotId, null);
});

test("shared metaverse combat snapshots preserve negative suicide kills and team scores", () => {
  const playerCombatSnapshot = createMetaversePlayerCombatSnapshot({
    kills: -1.9,
    weaponInventory: [
      {
        ammoInMagazine: 1.8,
        ammoInReserve: 3.2,
        weaponId: "metaverse-rocket-launcher-v1"
      }
    ]
  });
  const combatMatchSnapshot = createMetaverseCombatMatchSnapshot({
    teams: [
      {
        playerIds: [],
        score: -2.8,
        teamId: "red"
      },
      {
        playerIds: [],
        score: 3.4,
        teamId: "blue"
      }
    ]
  });

  assert.equal(playerCombatSnapshot.kills, -1);
  assert.equal(playerCombatSnapshot.weaponInventory[0]?.ammoInMagazine, 1);
  assert.equal(
    playerCombatSnapshot.weaponInventory[0]?.weaponId,
    "metaverse-rocket-launcher-v1"
  );
  assert.equal(combatMatchSnapshot.teams[0]?.score, -2);
  assert.equal(combatMatchSnapshot.teams[1]?.score, 3);
});

test("shared metaverse weapon profiles expose projectile presentation contracts", () => {
  const pistolProfile = readMetaverseCombatWeaponProfile(
    "metaverse-service-pistol-v2"
  );
  const rocketProfile = readMetaverseCombatWeaponProfile(
    "metaverse-rocket-launcher-v1"
  );

  assert.equal(pistolProfile.presentationDeliveryModel, "hitscan-tracer");
  assert.equal(
    rocketProfile.presentationDeliveryModel,
    "authoritative-projectile"
  );
  assert.deepEqual(pistolProfile.projectilePresentation.objectLocalMuzzleFrame, {
    forwardMeters: 0.312,
    rightMeters: 0,
    role: "projectile.muzzle",
    rotation: {
      w: 1,
      x: 0,
      y: 0,
      z: 0
    },
    source: "weapon-manifest-socket",
    upMeters: 0.03
  });
  assert.deepEqual(
    pistolProfile.projectilePresentation.objectLocalPrimaryGripFrame,
    {
      forwardMeters: 0.079,
      rightMeters: 0,
      role: "grip.primary",
      rotation: {
        w: 1,
        x: 0,
        y: 0,
        z: 0
      },
      source: "weapon-manifest-socket",
      upMeters: -0.048
    }
  );
  assert.deepEqual(pistolProfile.projectilePresentation.authoredMuzzleFromGrip, {
    forwardMeters: 0.233,
    rightMeters: 0,
    upMeters: 0.078
  });
  assert.deepEqual(pistolProfile.projectilePresentation.primaryGripAnchorOffset, {
    forwardMeters: 0.317,
    rightMeters: 0.18,
    upMeters: 1.342
  });
  assert.deepEqual(rocketProfile.projectilePresentation.objectLocalMuzzleFrame, {
    forwardMeters: 1.01,
    rightMeters: 0,
    role: "projectile.muzzle",
    rotation: {
      w: 1,
      x: 0,
      y: 0,
      z: 0
    },
    source: "weapon-manifest-socket",
    upMeters: 0.08
  });
  assert.deepEqual(rocketProfile.projectilePresentation.authoredMuzzleFromGrip, {
    forwardMeters: 0.83,
    rightMeters: 0,
    upMeters: 0.09
  });
  assert.deepEqual(rocketProfile.projectilePresentation.primaryGripAnchorOffset, {
    forwardMeters: 0.12,
    rightMeters: 0.1,
    upMeters: 1.25
  });
  assert.deepEqual(
    rocketProfile.projectilePresentation.authoredSocketFrames.map(
      (frame) => frame.role
    ),
    [
      "grip.primary",
      "projectile.muzzle",
      "projectile.exhaust",
      "hazard.backblast_cone",
      "body.shoulder_contact"
    ]
  );
  assert.deepEqual(
    pistolProfile.projectilePresentation.semanticLaunchOriginOffset,
    pistolProfile.firingOriginOffset
  );
  assert.deepEqual(
    rocketProfile.projectilePresentation.semanticLaunchOriginOffset,
    rocketProfile.firingOriginOffset
  );
});

test("shared metaverse semantic weapon-tip resolver maps server-safe offsets deterministically", () => {
  const rocketProfile = readMetaverseCombatWeaponProfile(
    "metaverse-rocket-launcher-v1"
  );
  const frame = resolveMetaverseCombatSemanticWeaponTipFrame({
    actorBodyPosition: {
      x: 2,
      y: 0.5,
      z: 3
    },
    actorBodyYawRadians: 0,
    aimYawInfluence: 1,
    authoredMuzzleFromGrip:
      rocketProfile.projectilePresentation.authoredMuzzleFromGrip,
    firingOriginOffset: rocketProfile.firingOriginOffset,
    objectLocalMuzzleFrame:
      rocketProfile.projectilePresentation.objectLocalMuzzleFrame,
    objectLocalPrimaryGripFrame:
      rocketProfile.projectilePresentation.objectLocalPrimaryGripFrame,
    primaryGripAnchorOffset:
      rocketProfile.projectilePresentation.primaryGripAnchorOffset,
    semanticAimForward: {
      x: 1,
      y: 0,
      z: 0
    },
    semanticLaunchOriginOffset:
      rocketProfile.projectilePresentation.semanticLaunchOriginOffset
  });

  assertAlmostEqual(frame.originWorld.x, 2.95, "origin x");
  assertAlmostEqual(frame.originWorld.y, 1.84, "origin y");
  assertAlmostEqual(frame.originWorld.z, 3.1, "origin z");
  assertAlmostEqual(frame.primaryGripWorld.x, 2.12, "primary grip x");
  assertAlmostEqual(frame.primaryGripWorld.y, 1.75, "primary grip y");
  assertAlmostEqual(frame.primaryGripWorld.z, 3.1, "primary grip z");
  assert.deepEqual(frame.authoredMuzzleFromGrip, {
    forwardMeters: 0.83,
    rightMeters: 0,
    upMeters: 0.09
  });
  assert.deepEqual(frame.aimForwardWorld, {
    x: 1,
    y: 0,
    z: 0
  });
  assert.deepEqual(frame.aimRightWorld, {
    x: 0,
    y: 0,
    z: 1
  });
  assert.equal(frame.source, "shared-semantic-weapon-tip");
});

test("shared metaverse combat hurt volumes resolve a floor-root standing body shot", () => {
  const hurtVolumes = createMetaversePlayerCombatHurtVolumes({
    activeBodyPosition: {
      x: 0,
      y: 0,
      z: 0
    }
  });
  const hitResolution = resolveMetaverseCombatHitForSegment(
    {
      x: 0,
      y: 0.95,
      z: -8
    },
    {
      x: 0,
      y: 0.95,
      z: 8
    },
    hurtVolumes
  );

  assert.notEqual(hitResolution, null);
  assert.equal(hitResolution?.hitZone, "body");
  assert.equal(hitResolution?.regionId, "upper_torso");
});

test("shared metaverse combat hurt volumes expose closest surface point for splash damage", () => {
  const hurtVolumes = createMetaversePlayerCombatHurtVolumes({
    activeBodyPosition: {
      x: 0,
      y: 0,
      z: 0
    }
  });
  const bodyCenter = readCapsuleCenter(hurtVolumes.bodyCapsule);
  const queryPoint = {
    x: bodyCenter.x + hurtVolumes.bodyCapsule.radiusMeters + 0.5,
    y: bodyCenter.y,
    z: bodyCenter.z
  };
  const closestPoint = resolveMetaverseCombatClosestHurtVolumePoint(
    queryPoint,
    hurtVolumes
  );

  assert.notEqual(closestPoint, null);
  assert.ok(
    closestPoint.distanceMeters > 0 &&
      closestPoint.distanceMeters < queryPoint.x - bodyCenter.x,
    `expected closest surface distance below center distance, received ${closestPoint.distanceMeters}`
  );
});

test("shared metaverse combat hurt volumes cover the upper chest below the head", () => {
  const hurtVolumes = createMetaversePlayerCombatHurtVolumes({
    activeBodyPosition: {
      x: 0,
      y: 0,
      z: 0
    }
  });
  const hitResolution = resolveMetaverseCombatHitForSegment(
    {
      x: 0,
      y: 1.34,
      z: -8
    },
    {
      x: 0,
      y: 1.34,
      z: 8
    },
    hurtVolumes
  );

  assert.notEqual(hitResolution, null);
  assert.equal(hitResolution?.hitZone, "body");
  assert.equal(hitResolution?.regionId, "upper_torso");
});

test("shared metaverse combat hurt volumes resolve a floor-root lower body shot", () => {
  const hurtVolumes = createMetaversePlayerCombatHurtVolumes({
    activeBodyPosition: {
      x: 0,
      y: 0,
      z: 0
    }
  });
  const lowerLegRegion = hurtVolumes.regions.find(
    (region) => region.regionId === "lower_leg_l"
  );

  assert.equal(lowerLegRegion?.shape, "capsule");

  const lowerLegCenter = readCapsuleCenter(lowerLegRegion.capsule);
  const hitResolution = resolveMetaverseCombatHitForSegment(
    {
      x: lowerLegCenter.x,
      y: lowerLegCenter.y,
      z: lowerLegCenter.z - 8
    },
    {
      x: lowerLegCenter.x,
      y: lowerLegCenter.y,
      z: lowerLegCenter.z + 8
    },
    hurtVolumes
  );

  assert.notEqual(hitResolution, null);
  assert.equal(hitResolution?.hitZone, "body");
  assert.equal(hitResolution?.regionId, "lower_leg_l");
});

test("shared metaverse combat hurt volumes resolve a floor-root standing head shot", () => {
  const hurtVolumes = createMetaversePlayerCombatHurtVolumes({
    activeBodyPosition: {
      x: 0,
      y: 0,
      z: 0
    }
  });
  const hitResolution = resolveMetaverseCombatHitForSegment(
    {
      x: 0,
      y: 1.58,
      z: -8
    },
    {
      x: 0,
      y: 1.58,
      z: 8
    },
    hurtVolumes
  );

  assert.notEqual(hitResolution, null);
  assert.equal(hitResolution?.hitZone, "head");
  assert.equal(hitResolution?.regionId, "head");
});

test("shared metaverse combat hurt volumes expose lower-body humanoid regions", () => {
  const hurtVolumes = createMetaversePlayerCombatHurtVolumes({
    activeBodyPosition: {
      x: 0,
      y: 0,
      z: 0
    }
  });
  const regionsById = new Map(
    hurtVolumes.regions.map((region) => [region.regionId, region])
  );

  for (const regionId of [
    "upper_leg_l",
    "lower_leg_l",
    "foot_l",
    "upper_leg_r",
    "lower_leg_r",
    "foot_r"
  ]) {
    const region = regionsById.get(regionId);

    assert.equal(region?.shape, "capsule");

    const center = readCapsuleCenter(region.capsule);
    const hitResolution = resolveMetaverseCombatHitForSegment(
      {
        x: center.x,
        y: center.y,
        z: center.z - 8
      },
      {
        x: center.x,
        y: center.y,
        z: center.z + 8
      },
      hurtVolumes
    );

    assert.notEqual(hitResolution, null);
    assert.equal(hitResolution?.hitZone, "body");
    assert.equal(hitResolution?.regionId, regionId);
  }
});

test("shared metaverse combat hurt regions rotate lower-body offsets with body yaw", () => {
  const baselineHurtVolumes = createMetaversePlayerCombatHurtVolumes({
    activeBodyPosition: {
      x: 0,
      y: 0,
      z: 0
    }
  });

  for (const yawRadians of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const hurtVolumes = createMetaversePlayerCombatHurtVolumes({
      activeBodyPosition: {
        x: 0,
        y: 0,
        z: 0
      },
      activeBodyYawRadians: yawRadians
    });

    for (const regionId of [
      "upper_leg_l",
      "lower_leg_l",
      "foot_l",
      "upper_leg_r",
      "lower_leg_r",
      "foot_r"
    ]) {
      const region = hurtVolumes.regions.find(
        (candidateRegion) => candidateRegion.regionId === regionId
      );
      const baselineRegion = baselineHurtVolumes.regions.find(
        (candidateRegion) => candidateRegion.regionId === regionId
      );

      assert.notEqual(region, undefined);
      assert.notEqual(baselineRegion, undefined);

      const center = readRegionCenter(region);
      const baselineCenter = readRegionCenter(baselineRegion);
      const expectedCenter = {
        x:
          baselineCenter.x * Math.cos(yawRadians) -
          baselineCenter.z * Math.sin(yawRadians),
        y: baselineCenter.y,
        z:
          baselineCenter.x * Math.sin(yawRadians) +
          baselineCenter.z * Math.cos(yawRadians)
      };

      assertAlmostEqual(center.x, expectedCenter.x, `${regionId} center.x`);
      assertAlmostEqual(center.y, expectedCenter.y, `${regionId} center.y`);
      assertAlmostEqual(center.z, expectedCenter.z, `${regionId} center.z`);
    }
  }
});

test("shared metaverse combat hurt regions miss rays outside the humanoid", () => {
  const hurtVolumes = createMetaversePlayerCombatHurtVolumes({
    activeBodyPosition: {
      x: 0,
      y: 0,
      z: 0
    }
  });
  const hitResolution = resolveMetaverseCombatHitForSegment(
    {
      x: 2,
      y: 0.45,
      z: -8
    },
    {
      x: 2,
      y: 0.45,
      z: 8
    },
    hurtVolumes
  );

  assert.equal(hitResolution, null);
});
