import { createMilliseconds } from "@webgpu-metaverse/shared";

import type { FirstPlayableWeaponId } from "../../../game/types/game-foundation";
import type { WeaponDefinition } from "../../../game/types/weapon-contract";
import { cameraThumbTriggerGestureConfig } from "../../../tracking";

export const duckHuntWeaponManifest = {
  "semiautomatic-pistol": {
    weaponId: "semiautomatic-pistol",
    displayName: "Semiautomatic pistol",
    triggerMode: "single",
    triggerGesture: cameraThumbTriggerGestureConfig,
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
