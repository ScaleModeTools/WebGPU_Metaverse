import { createAttachmentAssetId } from "../types/asset-id";
import {
  buildAttachmentAssetFromWeaponArchetype,
  defineWeaponArchetypeManifest,
  type WeaponArchetypeDescriptor
} from "../types/weapon-builder-manifest";

const unzoomedIronSights = Object.freeze([
  Object.freeze({
    label: "1x",
    magnification: 1
  })
]);

const sidearmZoomLevels = Object.freeze([
  Object.freeze({
    label: "1.5x",
    magnification: 1.5
  })
]);

const twoTimesZoom = Object.freeze([
  Object.freeze({
    label: "2x",
    magnification: 2
  })
]);

const sniperZoomLevels = Object.freeze([
  Object.freeze({
    label: "5x",
    magnification: 5
  }),
  Object.freeze({
    label: "10x",
    magnification: 10
  })
]);


function createWeaponBase<
  TId extends ReturnType<typeof createAttachmentAssetId>
>(input: WeaponArchetypeDescriptor<TId>): WeaponArchetypeDescriptor<TId> {
  return Object.freeze(input);
}

export const metaverseServicePistolV2WeaponAssetId = createAttachmentAssetId(
  "metaverse-service-pistol-v2"
);
export const metaverseCompactSmgWeaponAssetId = createAttachmentAssetId(
  "metaverse-compact-smg-v1"
);
export const metaverseBattleRifleWeaponAssetId = createAttachmentAssetId(
  "metaverse-battle-rifle-v1"
);
export const metaverseBreacherShotgunWeaponAssetId = createAttachmentAssetId(
  "metaverse-breacher-shotgun-v1"
);
export const metaverseLongshotSniperWeaponAssetId = createAttachmentAssetId(
  "metaverse-longshot-sniper-v1"
);
export const metaverseRocketLauncherWeaponAssetId = createAttachmentAssetId(
  "metaverse-rocket-launcher-v1"
);

export const weaponArchetypeManifest = defineWeaponArchetypeManifest([
  createWeaponBase({
    id: metaverseServicePistolV2WeaponAssetId,
    label: "Metaverse service pistol v2",
    family: "pistol",
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["sidearm", "starter", "two-hand-capable"],
    unlock: {
      kind: "starter",
      label: "Starter sidearm"
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    mountedHolster: {
      attachmentSocketNodeName: "metaverse_service_pistol_back_socket",
      socketName: "back_socket"
    },
    supportPoint: {
      supportPointId: "pistol-support-left",
      authoringNodeName: "metaverse_service_pistol_support_grip_marker",
      localPosition: {
        x: 0.04,
        y: -0.01,
        z: 0.025
      }
    },
    nodes: {
      adsCameraAnchorNodeName: "metaverse_service_pistol_ads_camera_anchor",
      forwardReferenceNodeName: "metaverse_service_pistol_forward_marker",
      frontSightNodeName: "metaverse_service_pistol_front_sight_socket",
      muzzleSocketNodeName: "metaverse_service_pistol_muzzle_socket",
      opticMountNodeName: "metaverse_service_pistol_optic_mount_socket",
      rearSightNodeName: "metaverse_service_pistol_rear_sight_socket",
      rightHandGripSocketNodeName: "metaverse_service_pistol_grip_hand_r_socket",
      triggerMarkerNodeName: "metaverse_service_pistol_trigger_marker",
      upReferenceNodeName: "metaverse_service_pistol_up_marker"
    },
    moduleSockets: [
      {
        slotId: "front-sight",
        socketNodeName: "metaverse_service_pistol_front_sight_socket",
        defaultModuleId: "metaverse-low-profile-front-sight-v1",
        required: true
      },
      {
        slotId: "rear-sight",
        socketNodeName: "metaverse_service_pistol_rear_sight_socket",
        defaultModuleId: "metaverse-notch-rear-sight-v1",
        required: true
      },
      {
        slotId: "optic",
        socketNodeName: "metaverse_service_pistol_optic_mount_socket",
        defaultModuleId: null,
        required: false
      },
      {
        slotId: "muzzle",
        socketNodeName: "metaverse_service_pistol_muzzle_socket",
        defaultModuleId: "metaverse-pistol-compensator-v1",
        required: false
      }
    ],
    stats: {
      fireControl: {
        mode: "semi",
        roundsPerMinute: 420,
        burstSize: null,
        burstIntervalMs: null
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 12,
        maxCarriedAmmo: 48,
        reloadStyle: "magazine",
        reloadSeconds: 1.45,
        perRoundReloadSeconds: null
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
        splashMinDamage: null
      },
      accuracy: {
        hipSpreadDegrees: 1.6,
        adsSpreadDegrees: 0.35,
        movementBloomDegrees: 0.55,
        recoilPitchDegrees: 1.2,
        recoilYawDegrees: 0.55,
        firstShotAccuracy: true
      },
      range: {
        optimalMeters: 22,
        falloffStartMeters: 26,
        falloffEndMeters: 52,
        maxMeters: 90
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
        splashSelfDamage: false
      },
      handling: {
        adsTransitionSeconds: 0.12,
        equipSeconds: 0.36,
        sprintOutSeconds: 0.18,
        moveSpeedMultiplier: 1,
        readyRecoverySeconds: 0.12
      }
    },
    weaponAimProfile: {
      poseProfileId: "sidearm",
      adsFovDegrees: 44,
      defaultReticleId: "default-ring",
      reticleStyleId: "pistol-ring",
      zoomLevels: sidearmZoomLevels
    }
  }),
  createWeaponBase({
    id: metaverseCompactSmgWeaponAssetId,
    label: "Metaverse compact SMG",
    family: "smg",
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["long-gun", "close-quarters"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 4",
      requiredPlayerLevel: 4,
      unlockTokenCost: 400
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/metaverse-compact-smg.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    mountedHolster: {
      attachmentSocketNodeName: "metaverse_compact_smg_back_socket",
      socketName: "back_socket"
    },
    supportPoint: {
      supportPointId: "smg-support-left",
      authoringNodeName: "metaverse_compact_smg_support_grip_marker",
      localPosition: {
        x: 0.23,
        y: -0.025,
        z: 0.03
      }
    },
    nodes: {
      adsCameraAnchorNodeName: "metaverse_compact_smg_ads_camera_anchor",
      forwardReferenceNodeName: "metaverse_compact_smg_forward_marker",
      frontSightNodeName: "metaverse_compact_smg_front_sight_socket",
      muzzleSocketNodeName: "metaverse_compact_smg_muzzle_socket",
      opticMountNodeName: "metaverse_compact_smg_optic_mount_socket",
      rearSightNodeName: "metaverse_compact_smg_rear_sight_socket",
      rightHandGripSocketNodeName: "metaverse_compact_smg_grip_hand_r_socket",
      triggerMarkerNodeName: "metaverse_compact_smg_trigger_marker",
      upReferenceNodeName: "metaverse_compact_smg_up_marker"
    },
    moduleSockets: [
      {
        slotId: "grip",
        socketNodeName: "metaverse_compact_smg_grip_module_socket",
        defaultModuleId: "metaverse-vertical-foregrip-v1",
        required: false
      },
      {
        slotId: "front-sight",
        socketNodeName: "metaverse_compact_smg_front_sight_socket",
        defaultModuleId: "metaverse-low-profile-front-sight-v1",
        required: true
      },
      {
        slotId: "rear-sight",
        socketNodeName: "metaverse_compact_smg_rear_sight_socket",
        defaultModuleId: "metaverse-notch-rear-sight-v1",
        required: true
      },
      {
        slotId: "optic",
        socketNodeName: "metaverse_compact_smg_optic_mount_socket",
        defaultModuleId: "metaverse-micro-red-dot-v1",
        required: false
      },
      {
        slotId: "muzzle",
        socketNodeName: "metaverse_compact_smg_muzzle_socket",
        defaultModuleId: "metaverse-rifle-suppressor-v1",
        required: false
      }
    ],
    stats: {
      fireControl: {
        mode: "auto",
        roundsPerMinute: 780,
        burstSize: null,
        burstIntervalMs: null
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 32,
        maxCarriedAmmo: 160,
        reloadStyle: "magazine",
        reloadSeconds: 1.9,
        perRoundReloadSeconds: null
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
        splashMinDamage: null
      },
      accuracy: {
        hipSpreadDegrees: 2.3,
        adsSpreadDegrees: 0.8,
        movementBloomDegrees: 0.9,
        recoilPitchDegrees: 1.8,
        recoilYawDegrees: 0.9,
        firstShotAccuracy: false
      },
      range: {
        optimalMeters: 16,
        falloffStartMeters: 20,
        falloffEndMeters: 35,
        maxMeters: 60
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
        splashSelfDamage: false
      },
      handling: {
        adsTransitionSeconds: 0.16,
        equipSeconds: 0.42,
        sprintOutSeconds: 0.2,
        moveSpeedMultiplier: 0.98,
        readyRecoverySeconds: 0.14
      }
    },
    weaponAimProfile: {
      poseProfileId: "long-gun",
      adsFovDegrees: 57,
      defaultReticleId: "precision-ring",
      reticleStyleId: "smg-dot",
      zoomLevels: unzoomedIronSights
    }
  }),
  createWeaponBase({
    id: metaverseBattleRifleWeaponAssetId,
    label: "Metaverse battle rifle",
    family: "battle-rifle",
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["long-gun", "burst", "mid-range", "halo-anchor"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 6",
      requiredPlayerLevel: 6,
      unlockTokenCost: 600
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/metaverse-battle-rifle.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    mountedHolster: {
      attachmentSocketNodeName: "metaverse_battle_rifle_back_socket",
      socketName: "back_socket"
    },
    supportPoint: {
      supportPointId: "battle-rifle-support-left",
      authoringNodeName: "metaverse_battle_rifle_support_grip_marker",
      localPosition: {
        x: 0.31,
        y: -0.022,
        z: 0.028
      }
    },
    nodes: {
      adsCameraAnchorNodeName: "metaverse_battle_rifle_ads_camera_anchor",
      forwardReferenceNodeName: "metaverse_battle_rifle_forward_marker",
      frontSightNodeName: "metaverse_battle_rifle_front_sight_socket",
      muzzleSocketNodeName: "metaverse_battle_rifle_muzzle_socket",
      opticMountNodeName: "metaverse_battle_rifle_optic_mount_socket",
      rearSightNodeName: "metaverse_battle_rifle_rear_sight_socket",
      rightHandGripSocketNodeName: "metaverse_battle_rifle_grip_hand_r_socket",
      triggerMarkerNodeName: "metaverse_battle_rifle_trigger_marker",
      upReferenceNodeName: "metaverse_battle_rifle_up_marker"
    },
    moduleSockets: [
      {
        slotId: "grip",
        socketNodeName: "metaverse_battle_rifle_grip_module_socket",
        defaultModuleId: "metaverse-barricade-handstop-v1",
        required: false
      },
      {
        slotId: "front-sight",
        socketNodeName: "metaverse_battle_rifle_front_sight_socket",
        defaultModuleId: "metaverse-low-profile-front-sight-v1",
        required: true
      },
      {
        slotId: "rear-sight",
        socketNodeName: "metaverse_battle_rifle_rear_sight_socket",
        defaultModuleId: "metaverse-notch-rear-sight-v1",
        required: true
      },
      {
        slotId: "optic",
        socketNodeName: "metaverse_battle_rifle_optic_mount_socket",
        defaultModuleId: "metaverse-2x-combat-optic-v1",
        required: true
      },
      {
        slotId: "muzzle",
        socketNodeName: "metaverse_battle_rifle_muzzle_socket",
        defaultModuleId: "metaverse-battle-rifle-brake-v1",
        required: false
      }
    ],
    stats: {
      fireControl: {
        mode: "burst-3",
        roundsPerMinute: 720,
        burstSize: 3,
        burstIntervalMs: 180
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 36,
        maxCarriedAmmo: 108,
        reloadStyle: "magazine",
        reloadSeconds: 2.1,
        perRoundReloadSeconds: null
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
        splashMinDamage: null
      },
      accuracy: {
        hipSpreadDegrees: 1.9,
        adsSpreadDegrees: 0.25,
        movementBloomDegrees: 0.4,
        recoilPitchDegrees: 1.25,
        recoilYawDegrees: 0.6,
        firstShotAccuracy: true
      },
      range: {
        optimalMeters: 30,
        falloffStartMeters: 40,
        falloffEndMeters: 75,
        maxMeters: 120
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
        splashSelfDamage: false
      },
      handling: {
        adsTransitionSeconds: 0.14,
        equipSeconds: 0.48,
        sprintOutSeconds: 0.22,
        moveSpeedMultiplier: 0.97,
        readyRecoverySeconds: 0.18
      }
    },
    weaponAimProfile: {
      poseProfileId: "long-gun",
      adsFovDegrees: 50,
      defaultReticleId: "precision-ring",
      reticleStyleId: "battle-rifle-dot",
      zoomLevels: twoTimesZoom
    }
  }),
  createWeaponBase({
    id: metaverseBreacherShotgunWeaponAssetId,
    label: "Metaverse breacher shotgun",
    family: "shotgun",
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["long-gun", "close-quarters", "pump"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 8",
      requiredPlayerLevel: 8,
      unlockTokenCost: 650
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/metaverse-breacher-shotgun.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    mountedHolster: {
      attachmentSocketNodeName: "metaverse_breacher_shotgun_back_socket",
      socketName: "back_socket"
    },
    supportPoint: {
      supportPointId: "shotgun-support-left",
      authoringNodeName: "metaverse_breacher_shotgun_support_grip_marker",
      localPosition: {
        x: 0.29,
        y: -0.03,
        z: 0.03
      }
    },
    nodes: {
      adsCameraAnchorNodeName: "metaverse_breacher_shotgun_ads_camera_anchor",
      forwardReferenceNodeName: "metaverse_breacher_shotgun_forward_marker",
      frontSightNodeName: "metaverse_breacher_shotgun_front_sight_socket",
      muzzleSocketNodeName: "metaverse_breacher_shotgun_muzzle_socket",
      opticMountNodeName: "metaverse_breacher_shotgun_optic_mount_socket",
      rearSightNodeName: "metaverse_breacher_shotgun_rear_sight_socket",
      rightHandGripSocketNodeName: "metaverse_breacher_shotgun_grip_hand_r_socket",
      triggerMarkerNodeName: "metaverse_breacher_shotgun_trigger_marker",
      upReferenceNodeName: "metaverse_breacher_shotgun_up_marker"
    },
    moduleSockets: [
      {
        slotId: "grip",
        socketNodeName: "metaverse_breacher_shotgun_grip_module_socket",
        defaultModuleId: "metaverse-heavy-stability-grip-v1",
        required: false
      },
      {
        slotId: "front-sight",
        socketNodeName: "metaverse_breacher_shotgun_front_sight_socket",
        defaultModuleId: "metaverse-fiber-front-sight-v1",
        required: true
      },
      {
        slotId: "rear-sight",
        socketNodeName: "metaverse_breacher_shotgun_rear_sight_socket",
        defaultModuleId: "metaverse-ghost-ring-rear-sight-v1",
        required: false
      },
      {
        slotId: "optic",
        socketNodeName: "metaverse_breacher_shotgun_optic_mount_socket",
        defaultModuleId: null,
        required: false
      },
      {
        slotId: "muzzle",
        socketNodeName: "metaverse_breacher_shotgun_muzzle_socket",
        defaultModuleId: "metaverse-full-choke-v1",
        required: false
      }
    ],
    stats: {
      fireControl: {
        mode: "pump",
        roundsPerMinute: 80,
        burstSize: null,
        burstIntervalMs: null
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 12,
        maxCarriedAmmo: 36,
        reloadStyle: "tube",
        reloadSeconds: 0,
        perRoundReloadSeconds: 0.55
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
        splashMinDamage: null
      },
      accuracy: {
        hipSpreadDegrees: 7.5,
        adsSpreadDegrees: 5.8,
        movementBloomDegrees: 1.1,
        recoilPitchDegrees: 5.5,
        recoilYawDegrees: 1.2,
        firstShotAccuracy: false
      },
      range: {
        optimalMeters: 6,
        falloffStartMeters: 8,
        falloffEndMeters: 18,
        maxMeters: 28
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
        splashSelfDamage: false
      },
      handling: {
        adsTransitionSeconds: 0.15,
        equipSeconds: 0.52,
        sprintOutSeconds: 0.24,
        moveSpeedMultiplier: 0.94,
        readyRecoverySeconds: 0.24
      }
    },
    weaponAimProfile: {
      poseProfileId: "long-gun",
      adsFovDegrees: 62,
      defaultReticleId: "default-ring",
      reticleStyleId: "shotgun-spread",
      zoomLevels: unzoomedIronSights
    }
  }),
  createWeaponBase({
    id: metaverseLongshotSniperWeaponAssetId,
    label: "Metaverse longshot sniper",
    family: "sniper",
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["long-gun", "precision", "magnified", "chassis"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 12",
      requiredPlayerLevel: 12,
      unlockTokenCost: 1000
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/metaverse-longshot-sniper.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    mountedHolster: {
      attachmentSocketNodeName: "metaverse_longshot_sniper_back_socket",
      socketName: "back_socket"
    },
    supportPoint: {
      supportPointId: "sniper-support-left",
      authoringNodeName: "metaverse_longshot_sniper_support_grip_marker",
      localPosition: {
        x: 0.57,
        y: -0.018,
        z: 0.03
      }
    },
    nodes: {
      adsCameraAnchorNodeName: "metaverse_longshot_sniper_ads_camera_anchor",
      forwardReferenceNodeName: "metaverse_longshot_sniper_forward_marker",
      frontSightNodeName: "metaverse_longshot_sniper_front_sight_socket",
      muzzleSocketNodeName: "metaverse_longshot_sniper_muzzle_socket",
      opticMountNodeName: "metaverse_longshot_sniper_optic_mount_socket",
      rearSightNodeName: "metaverse_longshot_sniper_rear_sight_socket",
      rightHandGripSocketNodeName: "metaverse_longshot_sniper_grip_hand_r_socket",
      triggerMarkerNodeName: "metaverse_longshot_sniper_trigger_marker",
      upReferenceNodeName: "metaverse_longshot_sniper_up_marker"
    },
    moduleSockets: [
      {
        slotId: "grip",
        socketNodeName: "metaverse_longshot_sniper_grip_module_socket",
        defaultModuleId: "metaverse-precision-bipod-v1",
        required: false
      },
      {
        slotId: "front-sight",
        socketNodeName: "metaverse_longshot_sniper_front_sight_socket",
        defaultModuleId: null,
        required: false
      },
      {
        slotId: "rear-sight",
        socketNodeName: "metaverse_longshot_sniper_rear_sight_socket",
        defaultModuleId: null,
        required: false
      },
      {
        slotId: "optic",
        socketNodeName: "metaverse_longshot_sniper_optic_mount_socket",
        defaultModuleId: "metaverse-10x-precision-scope-v1",
        required: true
      },
      {
        slotId: "muzzle",
        socketNodeName: "metaverse_longshot_sniper_muzzle_socket",
        defaultModuleId: "metaverse-precision-muzzle-brake-v1",
        required: false
      }
    ],
    stats: {
      fireControl: {
        mode: "bolt",
        roundsPerMinute: 46,
        burstSize: null,
        burstIntervalMs: null
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 5,
        maxCarriedAmmo: 25,
        reloadStyle: "magazine",
        reloadSeconds: 2.75,
        perRoundReloadSeconds: null
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
        splashMinDamage: null
      },
      accuracy: {
        hipSpreadDegrees: 1.8,
        adsSpreadDegrees: 0.04,
        movementBloomDegrees: 0.38,
        recoilPitchDegrees: 3.9,
        recoilYawDegrees: 0.42,
        firstShotAccuracy: true
      },
      range: {
        optimalMeters: 90,
        falloffStartMeters: 110,
        falloffEndMeters: 180,
        maxMeters: 300
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
        splashSelfDamage: false
      },
      handling: {
        adsTransitionSeconds: 0.26,
        equipSeconds: 0.62,
        sprintOutSeconds: 0.3,
        moveSpeedMultiplier: 0.88,
        readyRecoverySeconds: 0.38
      }
    },
    weaponAimProfile: {
      poseProfileId: "long-gun",
      adsFovDegrees: 36,
      defaultReticleId: "precision-ring",
      reticleStyleId: "sniper-mil-dot",
      zoomLevels: sniperZoomLevels
    }
  }),
  createWeaponBase({
    id: metaverseRocketLauncherWeaponAssetId,
    label: "Metaverse rocket launcher",
    family: "launcher",
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v2"],
    tags: ["long-gun", "ordnance", "tracking", "vehicle-counter", "halo-anchor"],
    unlock: {
      kind: "challenge",
      label: "Unlock after heavy ordnance challenge",
      requiredPlayerLevel: 15,
      unlockTokenCost: 1600,
      challengeId: "ordnance-demo-01"
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/metaverse-rocket-launcher.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    mountedHolster: {
      attachmentSocketNodeName: "metaverse_rocket_launcher_back_socket",
      socketName: "back_socket"
    },
    supportPoint: {
      supportPointId: "rocket-launcher-support-left",
      authoringNodeName: "metaverse_rocket_launcher_support_grip_marker",
      localPosition: {
        x: 0.41,
        y: -0.04,
        z: 0.035
      }
    },
    nodes: {
      adsCameraAnchorNodeName: "metaverse_rocket_launcher_ads_camera_anchor",
      forwardReferenceNodeName: "metaverse_rocket_launcher_forward_marker",
      frontSightNodeName: "metaverse_rocket_launcher_front_sight_socket",
      muzzleSocketNodeName: "metaverse_rocket_launcher_muzzle_socket",
      opticMountNodeName: "metaverse_rocket_launcher_optic_mount_socket",
      rearSightNodeName: "metaverse_rocket_launcher_rear_sight_socket",
      rightHandGripSocketNodeName: "metaverse_rocket_launcher_grip_hand_r_socket",
      triggerMarkerNodeName: "metaverse_rocket_launcher_trigger_marker",
      upReferenceNodeName: "metaverse_rocket_launcher_up_marker"
    },
    moduleSockets: [
      {
        slotId: "grip",
        socketNodeName: "metaverse_rocket_launcher_grip_module_socket",
        defaultModuleId: "metaverse-heavy-stability-grip-v1",
        required: false
      },
      {
        slotId: "front-sight",
        socketNodeName: "metaverse_rocket_launcher_front_sight_socket",
        defaultModuleId: null,
        required: false
      },
      {
        slotId: "rear-sight",
        socketNodeName: "metaverse_rocket_launcher_rear_sight_socket",
        defaultModuleId: null,
        required: false
      },
      {
        slotId: "optic",
        socketNodeName: "metaverse_rocket_launcher_optic_mount_socket",
        defaultModuleId: "metaverse-smart-link-launcher-optic-v1",
        required: true
      },
      {
        slotId: "muzzle",
        socketNodeName: "metaverse_rocket_launcher_muzzle_socket",
        defaultModuleId: "metaverse-guidance-shroud-v1",
        required: false
      }
    ],
    stats: {
      fireControl: {
        mode: "launcher-single",
        roundsPerMinute: 42,
        burstSize: null,
        burstIntervalMs: null
      },
      magazine: {
        ammoPerShot: 1,
        magazineSize: 2,
        maxCarriedAmmo: 6,
        reloadStyle: "magazine",
        reloadSeconds: 3.6,
        perRoundReloadSeconds: null
      },
      damage: {
        body: 180,
        head: 180,
        limb: 180,
        pelletsPerShot: 1,
        canHeadshot: false,
        shieldMultiplier: 1.2,
        splashInnerRadiusMeters: 1.5,
        splashOuterRadiusMeters: 5.5,
        splashMaxDamage: 170,
        splashMinDamage: 55
      },
      accuracy: {
        hipSpreadDegrees: 1,
        adsSpreadDegrees: 0.2,
        movementBloomDegrees: 0.3,
        recoilPitchDegrees: 8,
        recoilYawDegrees: 1.5,
        firstShotAccuracy: true
      },
      range: {
        optimalMeters: 40,
        falloffStartMeters: 80,
        falloffEndMeters: 120,
        maxMeters: 140
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
        splashSelfDamage: true
      },
      handling: {
        adsTransitionSeconds: 0.18,
        equipSeconds: 0.7,
        sprintOutSeconds: 0.35,
        moveSpeedMultiplier: 0.86,
        readyRecoverySeconds: 0.5
      }
    },
    weaponAimProfile: {
      poseProfileId: "long-gun",
      adsFovDegrees: 48,
      defaultReticleId: "default-ring",
      reticleStyleId: "rocket-lock-bracket",
      zoomLevels: twoTimesZoom
    }
  })
] as const);

export const weaponAttachmentDescriptors = Object.freeze(
  weaponArchetypeManifest.archetypes.map((weapon) =>
    buildAttachmentAssetFromWeaponArchetype(weapon)
  )
);
