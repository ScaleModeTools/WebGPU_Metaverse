import { createAttachmentAssetId } from "../types/asset-id";
import {
  buildAttachmentAssetFromWeaponArchetype,
  defineWeaponArchetypeManifest,
  type WeaponArchetypeDescriptor,
} from "../types/weapon-builder-manifest";
import type {
  HeldObjectHoldProfileDescriptor,
  HeldObjectSocketDescriptor,
  HeldObjectSocketRoleId,
} from "../types/held-object-authoring-manifest";

const unzoomedIronSights = Object.freeze([
  Object.freeze({
    label: "1x",
    magnification: 1,
  }),
]);

const sidearmZoomLevels = Object.freeze([
  Object.freeze({
    label: "1.5x",
    magnification: 1.5,
  }),
]);

const twoTimesZoom = Object.freeze([
  Object.freeze({
    label: "2x",
    magnification: 2,
  }),
]);

const sniperZoomLevels = Object.freeze([
  Object.freeze({
    label: "5x",
    magnification: 5,
  }),
  Object.freeze({
    label: "10x",
    magnification: 10,
  }),
]);

function createWeaponBase<
  TId extends ReturnType<typeof createAttachmentAssetId>,
>(input: WeaponArchetypeDescriptor<TId>): WeaponArchetypeDescriptor<TId> {
  return Object.freeze(input);
}

function createHeldObjectSocket(
  role: HeldObjectSocketRoleId,
  nodeName: string,
): HeldObjectSocketDescriptor {
  return Object.freeze({
    nodeName,
    orientationPolicy: "identity_in_current_build",
    role,
  });
}

function createHeldObjectHoldProfile(
  input: Omit<HeldObjectHoldProfileDescriptor, "dominantGripRole">,
): HeldObjectHoldProfileDescriptor {
  return Object.freeze({
    dominantGripRole: "grip.primary",
    ...input,
  });
}

export const metaverseServicePistolV2WeaponAssetId = createAttachmentAssetId(
  "metaverse-service-pistol-v2",
);
export const metaverseCompactSmgWeaponAssetId = createAttachmentAssetId(
  "metaverse-compact-smg-v1",
);
export const metaverseBattleRifleWeaponAssetId = createAttachmentAssetId(
  "metaverse-battle-rifle-v1",
);
export const metaverseBreacherShotgunWeaponAssetId = createAttachmentAssetId(
  "metaverse-breacher-shotgun-v1",
);
export const metaverseLongshotSniperWeaponAssetId = createAttachmentAssetId(
  "metaverse-longshot-sniper-v1",
);
export const metaverseRocketLauncherWeaponAssetId = createAttachmentAssetId(
  "metaverse-rocket-launcher-v1",
);

export const weaponArchetypeManifest = defineWeaponArchetypeManifest([
  createWeaponBase({
    id: metaverseServicePistolV2WeaponAssetId,
    label: "Metaverse service pistol v2",
    family: "pistol",
    holdProfile: createHeldObjectHoldProfile({
      adsPolicy: "iron_sights",
      adsReferenceRole: "camera.ads_anchor",
      allowedHands: ["right", "left"],
      family: "sidearm",
      fingerPoseHints: {
        primary: "pistol_grip_trigger_index",
        secondary: "support_palm_optional",
      },
      offhandPolicy: "optional_support_palm",
      poseProfileId: "sidearm.one_hand_optional_support",
      primaryHandDefault: "right",
      projectileOriginRole: "projectile.muzzle",
      recommendedNeutralPose: "sidearm_hold_neutral",
      sockets: [
        createHeldObjectSocket(
          "basis.forward",
          "metaverse_service_pistol_forward_marker",
        ),
        createHeldObjectSocket(
          "basis.up",
          "metaverse_service_pistol_up_marker",
        ),
        createHeldObjectSocket(
          "grip.primary",
          "metaverse_service_pistol_grip_hand_r_socket",
        ),
        createHeldObjectSocket(
          "trigger.index",
          "metaverse_service_pistol_trigger_marker",
        ),
        createHeldObjectSocket(
          "grip.secondary",
          "metaverse_service_pistol_support_marker",
        ),
        createHeldObjectSocket(
          "sight.front",
          "metaverse_service_pistol_front_sight_socket",
        ),
        createHeldObjectSocket(
          "sight.rear",
          "metaverse_service_pistol_rear_sight_socket",
        ),
        createHeldObjectSocket(
          "module.optic",
          "metaverse_service_pistol_optic_mount_socket",
        ),
        createHeldObjectSocket(
          "projectile.muzzle",
          "metaverse_service_pistol_muzzle_socket",
        ),
        createHeldObjectSocket(
          "camera.ads_anchor",
          "metaverse_service_pistol_ads_camera_anchor",
        ),
        createHeldObjectSocket(
          "carry.back",
          "metaverse_service_pistol_back_socket",
        ),
      ],
    }),
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["sidearm", "starter", "two-hand-capable"],
    unlock: {
      kind: "starter",
      label: "Starter sidearm",
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath:
            "/models/metaverse/attachments/metaverse-service-pistol.gltf",
          maxDistanceMeters: null,
        },
      ],
    },
    mountedHolster: {
      attachmentSocketRole: "carry.back",
      socketName: "back_socket",
    },
    moduleSockets: [
      {
        slotId: "front-sight",
        socketRole: "sight.front",
        defaultModuleId: "metaverse-low-profile-front-sight-v1",
        required: true,
      },
      {
        slotId: "rear-sight",
        socketRole: "sight.rear",
        defaultModuleId: "metaverse-notch-rear-sight-v1",
        required: true,
      },
      {
        slotId: "optic",
        socketRole: "module.optic",
        defaultModuleId: null,
        required: false,
      },
      {
        slotId: "muzzle",
        socketRole: "projectile.muzzle",
        defaultModuleId: "metaverse-pistol-compensator-v1",
        required: false,
      },
    ],
    stats: {
      fireControl: {
        mode: "semi",
        roundsPerMinute: 420,
        burstSize: null,
        burstIntervalMs: null,
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 12,
        maxCarriedAmmo: 48,
        reloadStyle: "magazine",
        reloadSeconds: 1.45,
        perRoundReloadSeconds: null,
      },
      damage: {
        body: 24,
        head: 42,
        limb: 20,
        pelletsPerShot: 1,
        canHeadshot: true,
        shieldMultiplier: 1,
        splashInnerRadiusMeters: null,
        splashOuterRadiusMeters: null,
        splashMaxDamage: null,
        splashMinDamage: null,
      },
      accuracy: {
        hipSpreadDegrees: 1.6,
        adsSpreadDegrees: 0.35,
        movementBloomDegrees: 0.55,
        recoilPitchDegrees: 1.2,
        recoilYawDegrees: 0.55,
        firstShotAccuracy: true,
      },
      range: {
        optimalMeters: 22,
        falloffStartMeters: 26,
        falloffEndMeters: 52,
        maxMeters: 90,
      },
      ballistics: {
        kind: "hitscan",
        projectileVelocityMetersPerSecond: null,
        gravityScale: 0,
        projectileLifetimeSeconds: null,
        lockOnSupported: false,
        maxTrackingDistanceMeters: null,
        trackingLockConeDegrees: null,
        trackingTurnRateDegreesPerSecond: null,
        splashSelfDamage: false,
      },
      handling: {
        adsTransitionSeconds: 0.12,
        equipSeconds: 0.36,
        sprintOutSeconds: 0.18,
        moveSpeedMultiplier: 1,
        readyRecoverySeconds: 0.12,
      },
    },
    weaponAimProfile: {
      poseProfileId: "sidearm.one_hand_optional_support",
      adsFovDegrees: 44,
      adsCameraTargetOffset: {
        across: 0.0,
        forward: 0.1,
        up: -0.05,
      },
      defaultReticleId: "default-ring",
      reticleStyleId: "pistol-ring",
      zoomLevels: sidearmZoomLevels,
    },
  }),
  createWeaponBase({
    id: metaverseCompactSmgWeaponAssetId,
    label: "Metaverse compact SMG",
    family: "smg",
    holdProfile: createHeldObjectHoldProfile({
      adsPolicy: "optic_anchor",
      adsReferenceRole: "camera.ads_anchor",
      allowedHands: ["right"],
      family: "long_gun",
      fingerPoseHints: {
        primary: "long_gun_trigger_grip",
        secondary: "foregrip_support",
      },
      offhandPolicy: "required_support_grip",
      poseProfileId: "long_gun.two_hand_shoulder",
      primaryHandDefault: "right",
      projectileOriginRole: "projectile.muzzle",
      recommendedNeutralPose: "long_gun_low_ready",
      sockets: [
        createHeldObjectSocket(
          "basis.forward",
          "metaverse_compact_smg_forward_marker",
        ),
        createHeldObjectSocket("basis.up", "metaverse_compact_smg_up_marker"),
        createHeldObjectSocket(
          "grip.primary",
          "metaverse_compact_smg_grip_hand_r_socket",
        ),
        createHeldObjectSocket(
          "trigger.index",
          "metaverse_compact_smg_trigger_marker",
        ),
        createHeldObjectSocket(
          "grip.secondary",
          "metaverse_compact_smg_support_grip_marker",
        ),
        createHeldObjectSocket(
          "module.underbarrel_grip",
          "metaverse_compact_smg_grip_module_socket",
        ),
        createHeldObjectSocket(
          "sight.front",
          "metaverse_compact_smg_front_sight_socket",
        ),
        createHeldObjectSocket(
          "sight.rear",
          "metaverse_compact_smg_rear_sight_socket",
        ),
        createHeldObjectSocket(
          "module.optic",
          "metaverse_compact_smg_optic_mount_socket",
        ),
        createHeldObjectSocket(
          "projectile.muzzle",
          "metaverse_compact_smg_muzzle_socket",
        ),
        createHeldObjectSocket(
          "camera.ads_anchor",
          "metaverse_compact_smg_ads_camera_anchor",
        ),
        createHeldObjectSocket(
          "carry.back",
          "metaverse_compact_smg_back_socket",
        ),
      ],
    }),
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["long-gun", "close-quarters"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 4",
      requiredPlayerLevel: 4,
      unlockTokenCost: 400,
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/metaverse-compact-smg.gltf",
          maxDistanceMeters: null,
        },
      ],
    },
    mountedHolster: {
      attachmentSocketRole: "carry.back",
      socketName: "back_socket",
    },
    moduleSockets: [
      {
        slotId: "grip",
        socketRole: "module.underbarrel_grip",
        defaultModuleId: "metaverse-vertical-foregrip-v1",
        required: false,
      },
      {
        slotId: "front-sight",
        socketRole: "sight.front",
        defaultModuleId: "metaverse-low-profile-front-sight-v1",
        required: true,
      },
      {
        slotId: "rear-sight",
        socketRole: "sight.rear",
        defaultModuleId: "metaverse-notch-rear-sight-v1",
        required: true,
      },
      {
        slotId: "optic",
        socketRole: "module.optic",
        defaultModuleId: "metaverse-micro-red-dot-v1",
        required: false,
      },
      {
        slotId: "muzzle",
        socketRole: "projectile.muzzle",
        defaultModuleId: "metaverse-rifle-suppressor-v1",
        required: false,
      },
    ],
    stats: {
      fireControl: {
        mode: "auto",
        roundsPerMinute: 780,
        burstSize: null,
        burstIntervalMs: null,
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 32,
        maxCarriedAmmo: 160,
        reloadStyle: "magazine",
        reloadSeconds: 1.9,
        perRoundReloadSeconds: null,
      },
      damage: {
        body: 18,
        head: 24,
        limb: 16,
        pelletsPerShot: 1,
        canHeadshot: true,
        shieldMultiplier: 1,
        splashInnerRadiusMeters: null,
        splashOuterRadiusMeters: null,
        splashMaxDamage: null,
        splashMinDamage: null,
      },
      accuracy: {
        hipSpreadDegrees: 2.3,
        adsSpreadDegrees: 0.8,
        movementBloomDegrees: 0.9,
        recoilPitchDegrees: 1.8,
        recoilYawDegrees: 0.9,
        firstShotAccuracy: false,
      },
      range: {
        optimalMeters: 16,
        falloffStartMeters: 20,
        falloffEndMeters: 35,
        maxMeters: 60,
      },
      ballistics: {
        kind: "hitscan",
        projectileVelocityMetersPerSecond: null,
        gravityScale: 0,
        projectileLifetimeSeconds: null,
        lockOnSupported: false,
        maxTrackingDistanceMeters: null,
        trackingLockConeDegrees: null,
        trackingTurnRateDegreesPerSecond: null,
        splashSelfDamage: false,
      },
      handling: {
        adsTransitionSeconds: 0.16,
        equipSeconds: 0.42,
        sprintOutSeconds: 0.2,
        moveSpeedMultiplier: 0.98,
        readyRecoverySeconds: 0.14,
      },
    },
    weaponAimProfile: {
      poseProfileId: "long_gun.two_hand_shoulder",
      adsFovDegrees: 57,
      defaultReticleId: "precision-ring",
      reticleStyleId: "smg-dot",
      zoomLevels: unzoomedIronSights,
    },
  }),
  createWeaponBase({
    id: metaverseBattleRifleWeaponAssetId,
    label: "Metaverse battle rifle",
    family: "battle-rifle",
    holdProfile: createHeldObjectHoldProfile({
      adsPolicy: "optic_anchor",
      adsReferenceRole: "camera.ads_anchor",
      allowedHands: ["right"],
      family: "long_gun",
      fingerPoseHints: {
        primary: "long_gun_trigger_grip",
        secondary: "foregrip_support",
      },
      offhandPolicy: "required_support_grip",
      poseProfileId: "long_gun.two_hand_shoulder",
      primaryHandDefault: "right",
      projectileOriginRole: "projectile.muzzle",
      recommendedNeutralPose: "long_gun_low_ready",
      sockets: [
        createHeldObjectSocket(
          "basis.forward",
          "metaverse_battle_rifle_forward_marker",
        ),
        createHeldObjectSocket("basis.up", "metaverse_battle_rifle_up_marker"),
        createHeldObjectSocket(
          "grip.primary",
          "metaverse_battle_rifle_grip_hand_r_socket",
        ),
        createHeldObjectSocket(
          "trigger.index",
          "metaverse_battle_rifle_trigger_marker",
        ),
        createHeldObjectSocket(
          "grip.secondary",
          "metaverse_battle_rifle_support_grip_marker",
        ),
        createHeldObjectSocket(
          "module.underbarrel_grip",
          "metaverse_battle_rifle_grip_module_socket",
        ),
        createHeldObjectSocket(
          "sight.front",
          "metaverse_battle_rifle_front_sight_socket",
        ),
        createHeldObjectSocket(
          "sight.rear",
          "metaverse_battle_rifle_rear_sight_socket",
        ),
        createHeldObjectSocket(
          "module.optic",
          "metaverse_battle_rifle_optic_mount_socket",
        ),
        createHeldObjectSocket(
          "projectile.muzzle",
          "metaverse_battle_rifle_muzzle_socket",
        ),
        createHeldObjectSocket(
          "camera.ads_anchor",
          "metaverse_battle_rifle_ads_camera_anchor",
        ),
        createHeldObjectSocket(
          "carry.back",
          "metaverse_battle_rifle_back_socket",
        ),
      ],
    }),
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["long-gun", "burst", "mid-range", "halo-anchor"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 6",
      requiredPlayerLevel: 6,
      unlockTokenCost: 600,
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath:
            "/models/metaverse/attachments/metaverse-battle-rifle.gltf",
          maxDistanceMeters: null,
        },
      ],
    },
    mountedHolster: {
      attachmentSocketRole: "carry.back",
      socketName: "back_socket",
    },
    moduleSockets: [
      {
        slotId: "grip",
        socketRole: "module.underbarrel_grip",
        defaultModuleId: "metaverse-barricade-handstop-v1",
        required: false,
      },
      {
        slotId: "front-sight",
        socketRole: "sight.front",
        defaultModuleId: "metaverse-low-profile-front-sight-v1",
        required: true,
      },
      {
        slotId: "rear-sight",
        socketRole: "sight.rear",
        defaultModuleId: "metaverse-notch-rear-sight-v1",
        required: true,
      },
      {
        slotId: "optic",
        socketRole: "module.optic",
        defaultModuleId: "metaverse-2x-combat-optic-v1",
        required: true,
      },
      {
        slotId: "muzzle",
        socketRole: "projectile.muzzle",
        defaultModuleId: "metaverse-battle-rifle-brake-v1",
        required: false,
      },
    ],
    stats: {
      fireControl: {
        mode: "burst-3",
        roundsPerMinute: 720,
        burstSize: 3,
        burstIntervalMs: 180,
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 36,
        maxCarriedAmmo: 108,
        reloadStyle: "magazine",
        reloadSeconds: 2.1,
        perRoundReloadSeconds: null,
      },
      damage: {
        body: 15,
        head: 24,
        limb: 13,
        pelletsPerShot: 1,
        canHeadshot: true,
        shieldMultiplier: 1,
        splashInnerRadiusMeters: null,
        splashOuterRadiusMeters: null,
        splashMaxDamage: null,
        splashMinDamage: null,
      },
      accuracy: {
        hipSpreadDegrees: 1.9,
        adsSpreadDegrees: 0.25,
        movementBloomDegrees: 0.4,
        recoilPitchDegrees: 1.25,
        recoilYawDegrees: 0.6,
        firstShotAccuracy: true,
      },
      range: {
        optimalMeters: 30,
        falloffStartMeters: 40,
        falloffEndMeters: 75,
        maxMeters: 120,
      },
      ballistics: {
        kind: "hitscan",
        projectileVelocityMetersPerSecond: null,
        gravityScale: 0,
        projectileLifetimeSeconds: null,
        lockOnSupported: false,
        maxTrackingDistanceMeters: null,
        trackingLockConeDegrees: null,
        trackingTurnRateDegreesPerSecond: null,
        splashSelfDamage: false,
      },
      handling: {
        adsTransitionSeconds: 0.14,
        equipSeconds: 0.48,
        sprintOutSeconds: 0.22,
        moveSpeedMultiplier: 0.97,
        readyRecoverySeconds: 0.18,
      },
    },
    weaponAimProfile: {
      poseProfileId: "long_gun.two_hand_shoulder",
      adsFovDegrees: 50,
      defaultReticleId: "precision-ring",
      reticleStyleId: "battle-rifle-dot",
      zoomLevels: twoTimesZoom,
    },
  }),
  createWeaponBase({
    id: metaverseBreacherShotgunWeaponAssetId,
    label: "Metaverse breacher shotgun",
    family: "shotgun",
    holdProfile: createHeldObjectHoldProfile({
      adsPolicy: "iron_sights",
      adsReferenceRole: "camera.ads_anchor",
      allowedHands: ["right"],
      family: "long_gun",
      fingerPoseHints: {
        primary: "long_gun_trigger_grip",
        secondary: "foregrip_support",
      },
      offhandPolicy: "required_support_grip",
      poseProfileId: "long_gun.two_hand_shoulder",
      primaryHandDefault: "right",
      projectileOriginRole: "projectile.muzzle",
      recommendedNeutralPose: "long_gun_low_ready",
      sockets: [
        createHeldObjectSocket(
          "basis.forward",
          "metaverse_breacher_shotgun_forward_marker",
        ),
        createHeldObjectSocket(
          "basis.up",
          "metaverse_breacher_shotgun_up_marker",
        ),
        createHeldObjectSocket(
          "grip.primary",
          "metaverse_breacher_shotgun_grip_hand_r_socket",
        ),
        createHeldObjectSocket(
          "trigger.index",
          "metaverse_breacher_shotgun_trigger_marker",
        ),
        createHeldObjectSocket(
          "grip.secondary",
          "metaverse_breacher_shotgun_support_grip_marker",
        ),
        createHeldObjectSocket(
          "module.underbarrel_grip",
          "metaverse_breacher_shotgun_grip_module_socket",
        ),
        createHeldObjectSocket(
          "sight.front",
          "metaverse_breacher_shotgun_front_sight_socket",
        ),
        createHeldObjectSocket(
          "sight.rear",
          "metaverse_breacher_shotgun_rear_sight_socket",
        ),
        createHeldObjectSocket(
          "module.optic",
          "metaverse_breacher_shotgun_optic_mount_socket",
        ),
        createHeldObjectSocket(
          "projectile.muzzle",
          "metaverse_breacher_shotgun_muzzle_socket",
        ),
        createHeldObjectSocket(
          "camera.ads_anchor",
          "metaverse_breacher_shotgun_ads_camera_anchor",
        ),
        createHeldObjectSocket(
          "carry.back",
          "metaverse_breacher_shotgun_back_socket",
        ),
      ],
    }),
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["long-gun", "close-quarters", "pump"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 8",
      requiredPlayerLevel: 8,
      unlockTokenCost: 650,
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath:
            "/models/metaverse/attachments/metaverse-breacher-shotgun.gltf",
          maxDistanceMeters: null,
        },
      ],
    },
    mountedHolster: {
      attachmentSocketRole: "carry.back",
      socketName: "back_socket",
    },
    moduleSockets: [
      {
        slotId: "grip",
        socketRole: "module.underbarrel_grip",
        defaultModuleId: "metaverse-heavy-stability-grip-v1",
        required: false,
      },
      {
        slotId: "front-sight",
        socketRole: "sight.front",
        defaultModuleId: "metaverse-fiber-front-sight-v1",
        required: true,
      },
      {
        slotId: "rear-sight",
        socketRole: "sight.rear",
        defaultModuleId: "metaverse-ghost-ring-rear-sight-v1",
        required: false,
      },
      {
        slotId: "optic",
        socketRole: "module.optic",
        defaultModuleId: null,
        required: false,
      },
      {
        slotId: "muzzle",
        socketRole: "projectile.muzzle",
        defaultModuleId: "metaverse-full-choke-v1",
        required: false,
      },
    ],
    stats: {
      fireControl: {
        mode: "pump",
        roundsPerMinute: 80,
        burstSize: null,
        burstIntervalMs: null,
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 12,
        maxCarriedAmmo: 36,
        reloadStyle: "tube",
        reloadSeconds: 0,
        perRoundReloadSeconds: 0.55,
      },
      damage: {
        body: 11,
        head: 13,
        limb: 9,
        pelletsPerShot: 12,
        canHeadshot: false,
        shieldMultiplier: 1,
        splashInnerRadiusMeters: null,
        splashOuterRadiusMeters: null,
        splashMaxDamage: null,
        splashMinDamage: null,
      },
      accuracy: {
        hipSpreadDegrees: 7.5,
        adsSpreadDegrees: 5.8,
        movementBloomDegrees: 1.1,
        recoilPitchDegrees: 5.5,
        recoilYawDegrees: 1.2,
        firstShotAccuracy: false,
      },
      range: {
        optimalMeters: 6,
        falloffStartMeters: 8,
        falloffEndMeters: 18,
        maxMeters: 28,
      },
      ballistics: {
        kind: "pellet",
        projectileVelocityMetersPerSecond: null,
        gravityScale: 0,
        projectileLifetimeSeconds: null,
        lockOnSupported: false,
        maxTrackingDistanceMeters: null,
        trackingLockConeDegrees: null,
        trackingTurnRateDegreesPerSecond: null,
        splashSelfDamage: false,
      },
      handling: {
        adsTransitionSeconds: 0.15,
        equipSeconds: 0.52,
        sprintOutSeconds: 0.24,
        moveSpeedMultiplier: 0.94,
        readyRecoverySeconds: 0.24,
      },
    },
    weaponAimProfile: {
      poseProfileId: "long_gun.two_hand_shoulder",
      adsFovDegrees: 62,
      defaultReticleId: "default-ring",
      reticleStyleId: "shotgun-spread",
      zoomLevels: unzoomedIronSights,
    },
  }),
  createWeaponBase({
    id: metaverseLongshotSniperWeaponAssetId,
    label: "Metaverse longshot sniper",
    family: "sniper",
    holdProfile: createHeldObjectHoldProfile({
      adsPolicy: "optic_anchor",
      adsReferenceRole: "camera.ads_anchor",
      allowedHands: ["right"],
      family: "long_gun",
      fingerPoseHints: {
        primary: "long_gun_trigger_grip",
        secondary: "foregrip_support",
      },
      offhandPolicy: "required_support_grip",
      poseProfileId: "long_gun.two_hand_shoulder",
      primaryHandDefault: "right",
      projectileOriginRole: "projectile.muzzle",
      recommendedNeutralPose: "long_gun_low_ready",
      sockets: [
        createHeldObjectSocket(
          "basis.forward",
          "metaverse_longshot_sniper_forward_marker",
        ),
        createHeldObjectSocket(
          "basis.up",
          "metaverse_longshot_sniper_up_marker",
        ),
        createHeldObjectSocket(
          "grip.primary",
          "metaverse_longshot_sniper_grip_hand_r_socket",
        ),
        createHeldObjectSocket(
          "trigger.index",
          "metaverse_longshot_sniper_trigger_marker",
        ),
        createHeldObjectSocket(
          "grip.secondary",
          "metaverse_longshot_sniper_support_grip_marker",
        ),
        createHeldObjectSocket(
          "module.underbarrel_grip",
          "metaverse_longshot_sniper_grip_module_socket",
        ),
        createHeldObjectSocket(
          "sight.front",
          "metaverse_longshot_sniper_front_sight_socket",
        ),
        createHeldObjectSocket(
          "sight.rear",
          "metaverse_longshot_sniper_rear_sight_socket",
        ),
        createHeldObjectSocket(
          "module.optic",
          "metaverse_longshot_sniper_optic_mount_socket",
        ),
        createHeldObjectSocket(
          "projectile.muzzle",
          "metaverse_longshot_sniper_muzzle_socket",
        ),
        createHeldObjectSocket(
          "camera.ads_anchor",
          "metaverse_longshot_sniper_ads_camera_anchor",
        ),
        createHeldObjectSocket(
          "carry.back",
          "metaverse_longshot_sniper_back_socket",
        ),
      ],
    }),
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["long-gun", "precision", "magnified", "chassis"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 12",
      requiredPlayerLevel: 12,
      unlockTokenCost: 1000,
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath:
            "/models/metaverse/attachments/metaverse-longshot-sniper.gltf",
          maxDistanceMeters: null,
        },
      ],
    },
    mountedHolster: {
      attachmentSocketRole: "carry.back",
      socketName: "back_socket",
    },
    moduleSockets: [
      {
        slotId: "grip",
        socketRole: "module.underbarrel_grip",
        defaultModuleId: "metaverse-precision-bipod-v1",
        required: false,
      },
      {
        slotId: "front-sight",
        socketRole: "sight.front",
        defaultModuleId: null,
        required: false,
      },
      {
        slotId: "rear-sight",
        socketRole: "sight.rear",
        defaultModuleId: null,
        required: false,
      },
      {
        slotId: "optic",
        socketRole: "module.optic",
        defaultModuleId: "metaverse-10x-precision-scope-v1",
        required: true,
      },
      {
        slotId: "muzzle",
        socketRole: "projectile.muzzle",
        defaultModuleId: "metaverse-precision-muzzle-brake-v1",
        required: false,
      },
    ],
    stats: {
      fireControl: {
        mode: "bolt",
        roundsPerMinute: 46,
        burstSize: null,
        burstIntervalMs: null,
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 5,
        maxCarriedAmmo: 25,
        reloadStyle: "magazine",
        reloadSeconds: 2.75,
        perRoundReloadSeconds: null,
      },
      damage: {
        body: 92,
        head: 180,
        limb: 78,
        pelletsPerShot: 1,
        canHeadshot: true,
        shieldMultiplier: 1.05,
        splashInnerRadiusMeters: null,
        splashOuterRadiusMeters: null,
        splashMaxDamage: null,
        splashMinDamage: null,
      },
      accuracy: {
        hipSpreadDegrees: 1.8,
        adsSpreadDegrees: 0.04,
        movementBloomDegrees: 0.38,
        recoilPitchDegrees: 3.9,
        recoilYawDegrees: 0.42,
        firstShotAccuracy: true,
      },
      range: {
        optimalMeters: 90,
        falloffStartMeters: 110,
        falloffEndMeters: 180,
        maxMeters: 300,
      },
      ballistics: {
        kind: "hitscan",
        projectileVelocityMetersPerSecond: null,
        gravityScale: 0,
        projectileLifetimeSeconds: null,
        lockOnSupported: false,
        maxTrackingDistanceMeters: null,
        trackingLockConeDegrees: null,
        trackingTurnRateDegreesPerSecond: null,
        splashSelfDamage: false,
      },
      handling: {
        adsTransitionSeconds: 0.26,
        equipSeconds: 0.62,
        sprintOutSeconds: 0.3,
        moveSpeedMultiplier: 0.88,
        readyRecoverySeconds: 0.38,
      },
    },
    weaponAimProfile: {
      poseProfileId: "long_gun.two_hand_shoulder",
      adsFovDegrees: 36,
      defaultReticleId: "precision-ring",
      reticleStyleId: "sniper-mil-dot",
      zoomLevels: sniperZoomLevels,
    },
  }),
  createWeaponBase({
    id: metaverseRocketLauncherWeaponAssetId,
    label: "Metaverse rocket launcher",
    family: "launcher",
    holdProfile: createHeldObjectHoldProfile({
      adsPolicy: "shouldered_heavy",
      adsReferenceRole: "camera.ads_anchor",
      allowedHands: ["right"],
      family: "shoulder_heavy",
      fingerPoseHints: {
        primary: "heavy_trigger_grip",
        secondary: "support_handle_grip",
      },
      hazardRoles: ["hazard.backblast_cone"],
      offhandPolicy: "required_support_grip",
      poseProfileId: "shoulder_heavy.two_hand_shouldered",
      primaryHandDefault: "right",
      projectileOriginRole: "projectile.muzzle",
      recommendedNeutralPose: "shoulder_heavy_ready_neutral",
      sockets: [
        createHeldObjectSocket(
          "basis.forward",
          "metaverse_rocket_launcher_forward_marker",
        ),
        createHeldObjectSocket(
          "basis.up",
          "metaverse_rocket_launcher_up_marker",
        ),
        createHeldObjectSocket(
          "grip.primary",
          "metaverse_rocket_launcher_grip_hand_r_socket",
        ),
        createHeldObjectSocket(
          "trigger.index",
          "metaverse_rocket_launcher_trigger_marker",
        ),
        createHeldObjectSocket(
          "grip.secondary",
          "metaverse_rocket_launcher_support_grip_marker",
        ),
        createHeldObjectSocket(
          "module.underbarrel_grip",
          "metaverse_rocket_launcher_grip_module_socket",
        ),
        createHeldObjectSocket(
          "sight.front",
          "metaverse_rocket_launcher_front_sight_socket",
        ),
        createHeldObjectSocket(
          "sight.rear",
          "metaverse_rocket_launcher_rear_sight_socket",
        ),
        createHeldObjectSocket(
          "module.optic",
          "metaverse_rocket_launcher_optic_mount_socket",
        ),
        createHeldObjectSocket(
          "projectile.muzzle",
          "metaverse_rocket_launcher_muzzle_socket",
        ),
        createHeldObjectSocket(
          "projectile.exhaust",
          "metaverse_rocket_launcher_exhaust_socket",
        ),
        createHeldObjectSocket(
          "camera.ads_anchor",
          "metaverse_rocket_launcher_ads_camera_anchor",
        ),
        createHeldObjectSocket(
          "hazard.backblast_cone",
          "metaverse_rocket_launcher_backblast_cone_socket",
        ),
        createHeldObjectSocket(
          "carry.back",
          "metaverse_rocket_launcher_back_socket",
        ),
      ],
    }),
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: [
      "long-gun",
      "ordnance",
      "tracking",
      "vehicle-counter",
      "halo-anchor",
    ],
    unlock: {
      kind: "challenge",
      label: "Unlock after heavy ordnance challenge",
      requiredPlayerLevel: 15,
      unlockTokenCost: 1600,
      challengeId: "ordnance-demo-01",
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath:
            "/models/metaverse/attachments/metaverse-rocket-launcher.gltf",
          maxDistanceMeters: null,
        },
      ],
    },
    mountedHolster: {
      attachmentSocketRole: "carry.back",
      socketName: "back_socket",
    },
    moduleSockets: [
      {
        slotId: "grip",
        socketRole: "module.underbarrel_grip",
        defaultModuleId: "metaverse-heavy-stability-grip-v1",
        required: false,
      },
      {
        slotId: "front-sight",
        socketRole: "sight.front",
        defaultModuleId: null,
        required: false,
      },
      {
        slotId: "rear-sight",
        socketRole: "sight.rear",
        defaultModuleId: null,
        required: false,
      },
      {
        slotId: "optic",
        socketRole: "module.optic",
        defaultModuleId: "metaverse-smart-link-launcher-optic-v1",
        required: true,
      },
      {
        slotId: "muzzle",
        socketRole: "projectile.muzzle",
        defaultModuleId: "metaverse-guidance-shroud-v1",
        required: false,
      },
    ],
    stats: {
      fireControl: {
        mode: "launcher-single",
        roundsPerMinute: 42,
        burstSize: null,
        burstIntervalMs: null,
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 2,
        maxCarriedAmmo: 6,
        reloadStyle: "magazine",
        reloadSeconds: 3.6,
        perRoundReloadSeconds: null,
      },
      damage: {
        body: 180,
        head: 180,
        limb: 180,
        pelletsPerShot: 1,
        canHeadshot: false,
        shieldMultiplier: 1.2,
        splashInnerRadiusMeters: 2,
        splashOuterRadiusMeters: 6,
        splashMaxDamage: 100,
        splashMinDamage: 20,
      },
      accuracy: {
        hipSpreadDegrees: 1,
        adsSpreadDegrees: 0.2,
        movementBloomDegrees: 0.3,
        recoilPitchDegrees: 8,
        recoilYawDegrees: 1.5,
        firstShotAccuracy: true,
      },
      range: {
        optimalMeters: 40,
        falloffStartMeters: 80,
        falloffEndMeters: 120,
        maxMeters: 140,
      },
      ballistics: {
        kind: "tracking-projectile",
        projectileVelocityMetersPerSecond: 70,
        gravityScale: 0.15,
        projectileLifetimeSeconds: 6,
        lockOnSupported: true,
        maxTrackingDistanceMeters: 110,
        trackingLockConeDegrees: 4,
        trackingTurnRateDegreesPerSecond: 140,
        splashSelfDamage: false,
      },
      handling: {
        adsTransitionSeconds: 0.18,
        equipSeconds: 0.7,
        sprintOutSeconds: 0.35,
        moveSpeedMultiplier: 0.86,
        readyRecoverySeconds: 0.5,
      },
    },
    weaponAimProfile: {
      poseProfileId: "shoulder_heavy.two_hand_shouldered",
      adsFovDegrees: 48,
      defaultReticleId: "default-ring",
      reticleStyleId: "rocket-lock-bracket",
      zoomLevels: twoTimesZoom,
    },
  }),
] as const);

export const weaponAttachmentDescriptors = Object.freeze(
  weaponArchetypeManifest.archetypes.map((weapon) =>
    buildAttachmentAssetFromWeaponArchetype(weapon),
  ),
);
