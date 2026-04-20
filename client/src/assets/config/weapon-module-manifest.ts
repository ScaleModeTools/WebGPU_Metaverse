import { defineWeaponModuleManifest } from "../types/weapon-builder-manifest";

export const weaponModuleManifest = defineWeaponModuleManifest([
  {
    id: "metaverse-vertical-foregrip-v1",
    label: "Vertical foregrip",
    slotId: "grip",
    compatibleFamilies: ["smg", "battle-rifle", "sniper"],
    defaultForFamilies: ["smg"],
    unlock: {
      kind: "starter",
      label: "Starter underbarrel control grip"
    },
    tags: ["control", "close-quarters"],
    statModifiers: {
      accuracy: {
        hipSpreadDegrees: { multiply: 0.9, clampMin: 0.05 },
        recoilPitchDegrees: { multiply: 0.9, clampMin: 0.05 },
        recoilYawDegrees: { multiply: 0.88, clampMin: 0.05 }
      },
      handling: {
        adsTransitionSeconds: { add: 0.01, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-vertical-foregrip.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-angled-foregrip-v1",
    label: "Angled foregrip",
    slotId: "grip",
    compatibleFamilies: ["smg", "battle-rifle", "sniper"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 5",
      requiredPlayerLevel: 5,
      unlockTokenCost: 250
    },
    tags: ["control", "hybrid"],
    statModifiers: {
      accuracy: {
        recoilPitchDegrees: { multiply: 0.94, clampMin: 0.05 },
        movementBloomDegrees: { multiply: 0.92, clampMin: 0.05 }
      },
      handling: {
        adsTransitionSeconds: { multiply: 0.88, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-angled-foregrip.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-barricade-handstop-v1",
    label: "Barricade handstop",
    slotId: "grip",
    compatibleFamilies: ["battle-rifle", "smg", "shotgun"],
    defaultForFamilies: ["battle-rifle"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 7",
      requiredPlayerLevel: 7,
      unlockTokenCost: 325
    },
    tags: ["agile", "mid-range"],
    statModifiers: {
      handling: {
        moveSpeedMultiplier: { add: 0.02, clampMax: 1.05 },
        adsTransitionSeconds: { multiply: 0.92, clampMin: 0.05 }
      },
      accuracy: {
        recoilYawDegrees: { multiply: 0.94, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-barricade-handstop.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-heavy-stability-grip-v1",
    label: "Heavy stability grip",
    slotId: "grip",
    compatibleFamilies: ["shotgun", "launcher"],
    defaultForFamilies: ["shotgun", "launcher"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 9",
      requiredPlayerLevel: 9,
      unlockTokenCost: 420
    },
    tags: ["heavy", "control"],
    statModifiers: {
      handling: {
        moveSpeedMultiplier: { add: -0.03, clampMin: 0.75 }
      },
      accuracy: {
        recoilPitchDegrees: { multiply: 0.86, clampMin: 0.05 },
        recoilYawDegrees: { multiply: 0.84, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-heavy-stability-grip.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-low-profile-front-sight-v1",
    label: "Low-profile front sight",
    slotId: "front-sight",
    compatibleFamilies: ["pistol", "smg", "battle-rifle", "sniper"],
    defaultForFamilies: ["pistol", "smg", "battle-rifle"],
    unlock: {
      kind: "starter",
      label: "Starter front sight"
    },
    tags: ["irons"],
    statModifiers: {
      accuracy: {
        adsSpreadDegrees: { multiply: 0.96, clampMin: 0.01 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-low-profile-front-sight.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-fiber-front-sight-v1",
    label: "Fiber front sight",
    slotId: "front-sight",
    compatibleFamilies: ["pistol", "shotgun"],
    defaultForFamilies: ["shotgun"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 3",
      requiredPlayerLevel: 3,
      unlockTokenCost: 120
    },
    tags: ["irons", "close-quarters"],
    statModifiers: {
      accuracy: {
        hipSpreadDegrees: { multiply: 0.94, clampMin: 0.05 }
      },
      handling: {
        adsTransitionSeconds: { multiply: 0.95, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-fiber-front-sight.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-notch-rear-sight-v1",
    label: "Notch rear sight",
    slotId: "rear-sight",
    compatibleFamilies: ["pistol", "smg", "battle-rifle"],
    defaultForFamilies: ["pistol", "smg", "battle-rifle"],
    unlock: {
      kind: "starter",
      label: "Starter rear sight"
    },
    tags: ["irons"],
    statModifiers: {
      accuracy: {
        adsSpreadDegrees: { multiply: 0.95, clampMin: 0.01 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-notch-rear-sight.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-ghost-ring-rear-sight-v1",
    label: "Ghost ring rear sight",
    slotId: "rear-sight",
    compatibleFamilies: ["shotgun", "battle-rifle"],
    defaultForFamilies: ["shotgun"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 6",
      requiredPlayerLevel: 6,
      unlockTokenCost: 260
    },
    tags: ["irons", "tracking"],
    statModifiers: {
      accuracy: {
        adsSpreadDegrees: { multiply: 0.9, clampMin: 0.01 },
        hipSpreadDegrees: { multiply: 0.97, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-ghost-ring-rear-sight.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-micro-red-dot-v1",
    label: "Micro red dot",
    slotId: "optic",
    compatibleFamilies: ["pistol", "smg"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 4",
      requiredPlayerLevel: 4,
      unlockTokenCost: 220
    },
    tags: ["optic", "precision"],
    aimOverrides: {
      adsFovDegrees: 60,
      defaultReticleId: "precision-ring",
      reticleStyleId: "red-dot",
      zoomLevels: [
        {
          label: "1.15x",
          magnification: 1.15
        }
      ]
    },
    statModifiers: {
      accuracy: {
        adsSpreadDegrees: { multiply: 0.88, clampMin: 0.01 },
        hipSpreadDegrees: { multiply: 0.96, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-micro-red-dot.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-2x-combat-optic-v1",
    label: "2x combat optic",
    slotId: "optic",
    compatibleFamilies: ["battle-rifle", "smg"],
    defaultForFamilies: ["battle-rifle"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 6",
      requiredPlayerLevel: 6,
      unlockTokenCost: 350
    },
    tags: ["optic", "magnified"],
    aimOverrides: {
      adsFovDegrees: 50,
      defaultReticleId: "precision-ring",
      reticleStyleId: "combat-2x",
      zoomLevels: [
        {
          label: "2x",
          magnification: 2
        }
      ]
    },
    statModifiers: {
      accuracy: {
        adsSpreadDegrees: { multiply: 0.82, clampMin: 0.01 }
      },
      range: {
        optimalMeters: { add: 4 },
        falloffStartMeters: { add: 5 }
      },
      handling: {
        adsTransitionSeconds: { add: 0.02, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-2x-combat-optic.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-4x-scope-v1",
    label: "4x scope",
    slotId: "optic",
    compatibleFamilies: ["battle-rifle", "sniper"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 10",
      requiredPlayerLevel: 10,
      unlockTokenCost: 550
    },
    tags: ["optic", "magnified"],
    aimOverrides: {
      adsFovDegrees: 42,
      defaultReticleId: "precision-ring",
      reticleStyleId: "scope-4x",
      zoomLevels: [
        {
          label: "4x",
          magnification: 4
        }
      ]
    },
    statModifiers: {
      accuracy: {
        adsSpreadDegrees: { multiply: 0.7, clampMin: 0.01 }
      },
      range: {
        optimalMeters: { add: 8 },
        falloffStartMeters: { add: 10 },
        falloffEndMeters: { add: 12 }
      },
      handling: {
        adsTransitionSeconds: { add: 0.04, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-4x-scope.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-6x-variable-scope-v1",
    label: "6x variable scope",
    slotId: "optic",
    compatibleFamilies: ["sniper"],
    defaultForFamilies: ["sniper"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 14",
      requiredPlayerLevel: 14,
      unlockTokenCost: 780
    },
    tags: ["optic", "magnified", "variable"],
    aimOverrides: {
      adsFovDegrees: 34,
      defaultReticleId: "precision-ring",
      reticleStyleId: "scope-6x-variable",
      zoomLevels: [
        {
          label: "3x",
          magnification: 3
        },
        {
          label: "6x",
          magnification: 6
        }
      ]
    },
    statModifiers: {
      accuracy: {
        adsSpreadDegrees: { multiply: 0.62, clampMin: 0.01 }
      },
      range: {
        optimalMeters: { add: 12 },
        falloffStartMeters: { add: 15 },
        falloffEndMeters: { add: 18 }
      },
      handling: {
        adsTransitionSeconds: { add: 0.06, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-6x-variable-scope.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-smart-link-launcher-optic-v1",
    label: "Smart-link launcher optic",
    slotId: "optic",
    compatibleFamilies: ["launcher"],
    defaultForFamilies: ["launcher"],
    unlock: {
      kind: "challenge",
      label: "Unlock with ordnance tracking challenge",
      requiredPlayerLevel: 15,
      unlockTokenCost: 900,
      challengeId: "launcher-lock-challenge"
    },
    tags: ["optic", "launcher", "tracking"],
    aimOverrides: {
      adsFovDegrees: 48,
      defaultReticleId: "default-ring",
      reticleStyleId: "smart-link-lock",
      zoomLevels: [
        {
          label: "2x",
          magnification: 2
        }
      ]
    },
    statModifiers: {
      ballistics: {
        maxTrackingDistanceMeters: { add: 10 },
        trackingLockConeDegrees: { add: 1 },
        trackingTurnRateDegreesPerSecond: { add: 18 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-smart-link-launcher-optic.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-pistol-compensator-v1",
    label: "Pistol compensator",
    slotId: "muzzle",
    compatibleFamilies: ["pistol"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 2",
      requiredPlayerLevel: 2,
      unlockTokenCost: 90
    },
    tags: ["muzzle", "recoil-control"],
    statModifiers: {
      accuracy: {
        recoilPitchDegrees: { multiply: 0.84, clampMin: 0.05 },
        recoilYawDegrees: { multiply: 0.88, clampMin: 0.05 }
      },
      handling: {
        readyRecoverySeconds: { multiply: 0.9, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-pistol-compensator.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-rifle-suppressor-v1",
    label: "Rifle suppressor",
    slotId: "muzzle",
    compatibleFamilies: ["smg", "battle-rifle", "sniper"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 8",
      requiredPlayerLevel: 8,
      unlockTokenCost: 480
    },
    tags: ["muzzle", "suppressed"],
    statModifiers: {
      range: {
        falloffStartMeters: { add: -4 },
        falloffEndMeters: { add: -5, clampMin: 5 }
      },
      accuracy: {
        recoilPitchDegrees: { multiply: 0.92, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-rifle-suppressor.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-battle-rifle-brake-v1",
    label: "Battle rifle brake",
    slotId: "muzzle",
    compatibleFamilies: ["battle-rifle", "smg"],
    defaultForFamilies: ["battle-rifle"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 7",
      requiredPlayerLevel: 7,
      unlockTokenCost: 340
    },
    tags: ["muzzle", "control"],
    statModifiers: {
      accuracy: {
        recoilPitchDegrees: { multiply: 0.8, clampMin: 0.05 },
        recoilYawDegrees: { multiply: 0.82, clampMin: 0.05 }
      },
      handling: {
        readyRecoverySeconds: { multiply: 0.92, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-battle-rifle-brake.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-full-choke-v1",
    label: "Full choke",
    slotId: "muzzle",
    compatibleFamilies: ["shotgun"],
    defaultForFamilies: ["shotgun"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 9",
      requiredPlayerLevel: 9,
      unlockTokenCost: 380
    },
    tags: ["muzzle", "shotgun", "tight-spread"],
    statModifiers: {
      accuracy: {
        hipSpreadDegrees: { multiply: 0.78, clampMin: 0.05 },
        adsSpreadDegrees: { multiply: 0.72, clampMin: 0.05 }
      },
      range: {
        optimalMeters: { add: 2 },
        falloffStartMeters: { add: 2 },
        falloffEndMeters: { add: 3 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-full-choke.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-breacher-choke-v1",
    label: "Breacher choke",
    slotId: "muzzle",
    compatibleFamilies: ["shotgun"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 11",
      requiredPlayerLevel: 11,
      unlockTokenCost: 420
    },
    tags: ["muzzle", "shotgun", "breach"],
    statModifiers: {
      accuracy: {
        hipSpreadDegrees: { multiply: 1.08, clampMin: 0.05 },
        adsSpreadDegrees: { multiply: 1.05, clampMin: 0.05 }
      },
      damage: {
        body: { add: 1.25 },
        head: { add: 1.5 }
      },
      handling: {
        readyRecoverySeconds: { multiply: 0.9, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-breacher-choke.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-guidance-shroud-v1",
    label: "Guidance shroud",
    slotId: "muzzle",
    compatibleFamilies: ["launcher"],
    defaultForFamilies: ["launcher"],
    unlock: {
      kind: "challenge",
      label: "Unlock with launcher calibration challenge",
      requiredPlayerLevel: 15,
      unlockTokenCost: 850,
      challengeId: "launcher-guidance-01"
    },
    tags: ["muzzle", "launcher", "tracking"],
    statModifiers: {
      ballistics: {
        projectileVelocityMetersPerSecond: { add: 8 },
        trackingTurnRateDegreesPerSecond: { add: 12 },
        maxTrackingDistanceMeters: { add: 8 }
      },
      damage: {
        splashOuterRadiusMeters: { add: 0.4 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-guidance-shroud.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-precision-bipod-v1",
    label: "Precision bipod",
    slotId: "grip",
    compatibleFamilies: ["sniper"],
    defaultForFamilies: ["sniper"],
    unlock: {
      kind: "starter",
      label: "Included with longshot sniper"
    },
    tags: ["control", "precision", "bipod"],
    statModifiers: {
      accuracy: {
        movementBloomDegrees: { multiply: 0.72, clampMin: 0.05 },
        recoilPitchDegrees: { multiply: 0.86, clampMin: 0.05 },
        recoilYawDegrees: { multiply: 0.84, clampMin: 0.05 }
      },
      handling: {
        adsTransitionSeconds: { add: 0.03, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-precision-bipod.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-folding-front-sight-v1",
    label: "Folding front sight",
    slotId: "front-sight",
    compatibleFamilies: ["sniper"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 12",
      requiredPlayerLevel: 12,
      unlockTokenCost: 180
    },
    tags: ["irons", "backup", "precision"],
    statModifiers: {
      accuracy: {
        adsSpreadDegrees: { multiply: 0.97, clampMin: 0.01 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-folding-front-sight.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-micro-aperture-rear-sight-v1",
    label: "Micro aperture rear sight",
    slotId: "rear-sight",
    compatibleFamilies: ["sniper"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 12",
      requiredPlayerLevel: 12,
      unlockTokenCost: 200
    },
    tags: ["irons", "backup", "precision"],
    statModifiers: {
      accuracy: {
        adsSpreadDegrees: { multiply: 0.94, clampMin: 0.01 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-micro-aperture-rear-sight.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-10x-precision-scope-v1",
    label: "10x precision scope",
    slotId: "optic",
    compatibleFamilies: ["sniper"],
    defaultForFamilies: ["sniper"],
    unlock: {
      kind: "starter",
      label: "Included with longshot sniper"
    },
    tags: ["optic", "magnified", "precision"],
    aimOverrides: {
      adsFovDegrees: 30,
      defaultReticleId: "precision-ring",
      reticleStyleId: "sniper-mil-dot",
      zoomLevels: [
        {
          label: "5x",
          magnification: 5
        },
        {
          label: "10x",
          magnification: 10
        }
      ]
    },
    statModifiers: {
      accuracy: {
        adsSpreadDegrees: { multiply: 0.52, clampMin: 0.01 }
      },
      range: {
        optimalMeters: { add: 18 },
        falloffStartMeters: { add: 24 },
        falloffEndMeters: { add: 30 }
      },
      handling: {
        adsTransitionSeconds: { add: 0.08, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-10x-precision-scope.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-precision-muzzle-brake-v1",
    label: "Precision muzzle brake",
    slotId: "muzzle",
    compatibleFamilies: ["sniper"],
    defaultForFamilies: ["sniper"],
    unlock: {
      kind: "starter",
      label: "Included with longshot sniper"
    },
    tags: ["muzzle", "precision", "control"],
    statModifiers: {
      accuracy: {
        recoilPitchDegrees: { multiply: 0.78, clampMin: 0.05 },
        recoilYawDegrees: { multiply: 0.8, clampMin: 0.05 }
      },
      handling: {
        readyRecoverySeconds: { multiply: 0.9, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-precision-muzzle-brake.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  },
  {
    id: "metaverse-long-suppressor-v1",
    label: "Long suppressor",
    slotId: "muzzle",
    compatibleFamilies: ["sniper"],
    unlock: {
      kind: "level",
      label: "Unlock at player level 13",
      requiredPlayerLevel: 13,
      unlockTokenCost: 640
    },
    tags: ["muzzle", "suppressed", "precision"],
    statModifiers: {
      range: {
        falloffStartMeters: { add: -3 },
        falloffEndMeters: { add: -4, clampMin: 5 }
      },
      accuracy: {
        recoilPitchDegrees: { multiply: 0.9, clampMin: 0.05 },
        recoilYawDegrees: { multiply: 0.92, clampMin: 0.05 }
      },
      handling: {
        adsTransitionSeconds: { add: 0.02, clampMin: 0.05 }
      }
    },
    model: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/modules/metaverse-long-suppressor.gltf",
          maxDistanceMeters: null
        }
      ]
    }
  }

] as const);
