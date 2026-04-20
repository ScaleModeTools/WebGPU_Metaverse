import {
  metaverseBattleRifleWeaponAssetId,
  metaverseBreacherShotgunWeaponAssetId,
  metaverseCompactSmgWeaponAssetId,
  metaverseLongshotSniperWeaponAssetId,
  metaverseRocketLauncherWeaponAssetId,
  metaverseServicePistolV2WeaponAssetId,
  weaponArchetypeManifest
} from "./weapon-archetype-manifest";
import { defineAttachmentAssetManifest } from "../types/attachment-asset-manifest";
import { buildAttachmentAssetFromWeaponArchetype } from "../types/weapon-builder-manifest";

export const metaverseServicePistolAttachmentAssetId =
  metaverseServicePistolV2WeaponAssetId;
export const metaverseCompactSmgAttachmentAssetId =
  metaverseCompactSmgWeaponAssetId;
export const metaverseBattleRifleAttachmentAssetId =
  metaverseBattleRifleWeaponAssetId;
export const metaverseBreacherShotgunAttachmentAssetId =
  metaverseBreacherShotgunWeaponAssetId;
export const metaverseLongshotSniperAttachmentAssetId =
  metaverseLongshotSniperWeaponAssetId;
export const metaverseRocketLauncherAttachmentAssetId =
  metaverseRocketLauncherWeaponAssetId;

export const attachmentModelManifest = defineAttachmentAssetManifest(
  weaponArchetypeManifest.archetypes.map(buildAttachmentAssetFromWeaponArchetype)
);
