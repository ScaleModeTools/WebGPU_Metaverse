import {
  createDegrees,
  createMilliseconds
} from "@thumbshooter/shared";

import type { FirstPlayableWeaponId } from "../../../game/types/game-foundation";
import type { WeaponDefinition } from "../../../game/types/weapon-contract";

export const duckHuntWeaponManifest = {
  "semiautomatic-pistol": {
    weaponId: "semiautomatic-pistol",
    displayName: "Semiautomatic pistol",
    triggerMode: "single",
    triggerGesture: {
      pressAxisAngleDegrees: createDegrees(68),
      pressEngagementRatio: 0.72,
      releaseAxisAngleDegrees: createDegrees(72),
      releaseEngagementRatio: 0.95,
      calibration: {
        pressAxisWindowFraction: 0.4,
        pressEngagementWindowFraction: 0.4,
        releaseAxisWindowFraction: 0.82,
        releaseEngagementWindowFraction: 0.82
      }
    },
    cadence: {
      shotIntervalMs: createMilliseconds(260)
    },
    reload: {
      clipCapacity: 6,
      durationMs: createMilliseconds(420),
      rule: "reticle-offscreen"
    },
    spread: {
      baseRadius: 0,
      maxRadius: 0.02,
      sprayGrowthPerShot: 0.0025,
      sprayRecoveryPerSecond: 6
    }
  }
} as const satisfies Record<FirstPlayableWeaponId, WeaponDefinition>;

export const duckHuntFirstPlayableWeaponDefinition =
  duckHuntWeaponManifest["semiautomatic-pistol"];
