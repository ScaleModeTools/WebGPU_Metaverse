import { weaponArchetypeManifest } from "./weapon-archetype-manifest";
import { weaponModuleManifest } from "./weapon-module-manifest";

export const weaponProgressionManifest = Object.freeze({
  starterWeaponIds: Object.freeze(
    weaponArchetypeManifest.archetypes
      .filter((weapon) => weapon.unlock?.kind === "starter")
      .map((weapon) => weapon.id)
  ),
  weaponUnlockTrack: Object.freeze([
    {
      level: 1,
      weaponId: "metaverse-service-pistol-v2",
      note: "starter sidearm"
    },
    {
      level: 4,
      weaponId: "metaverse-compact-smg-v1",
      note: "close-quarters unlock"
    },
    {
      level: 6,
      weaponId: "metaverse-battle-rifle-v1",
      note: "mid-range burst unlock"
    },
    {
      level: 8,
      weaponId: "metaverse-breacher-shotgun-v1",
      note: "close-range power unlock"
    },
    {
      level: 12,
      weaponId: "metaverse-longshot-sniper-v1",
      note: "precision unlock"
    },
    {
      level: 15,
      weaponId: "metaverse-rocket-launcher-v1",
      note: "ordnance challenge unlock"
    }
  ]),
  moduleUnlockTrack: Object.freeze(
    weaponModuleManifest.modules.map((module) => ({
      id: module.id,
      slotId: module.slotId,
      unlock: module.unlock ?? null
    }))
  )
});
