import type { RegistryById, ReticleId } from "@webgpu-metaverse/shared";

import type { AttachmentAssetId } from "./asset-id";
import type { AssetLodGroup } from "./asset-lod";
import type { SkeletonId, SocketId } from "./asset-socket";
import type {
  AttachmentAimBasisOffsetDescriptor,
  AttachmentAssetDescriptor,
  AttachmentMountedHolsterDescriptor,
} from "./attachment-asset-manifest";
import type {
  HeldObjectHoldProfileDescriptor,
  HeldObjectPoseProfileId,
  HeldObjectSocketRoleId,
} from "./held-object-authoring-manifest";

export const weaponFamilyIds = [
  "pistol",
  "smg",
  "battle-rifle",
  "shotgun",
  "sniper",
  "launcher",
] as const;

export type WeaponFamilyId = (typeof weaponFamilyIds)[number];

export const weaponModuleSlotIds = [
  "grip",
  "front-sight",
  "rear-sight",
  "optic",
  "muzzle",
] as const;

export type WeaponModuleSlotId = (typeof weaponModuleSlotIds)[number];

export const weaponPoseProfileIds = [
  "sidearm.one_hand_optional_support",
  "long_gun.two_hand_shoulder",
  "shoulder_heavy.two_hand_shouldered",
  "melee.one_hand",
  "melee.two_hand",
  "tool.one_hand",
] as const;

export type WeaponPoseProfileId =
  | (typeof weaponPoseProfileIds)[number]
  | HeldObjectPoseProfileId;

export type WeaponFireMode =
  | "semi"
  | "auto"
  | "burst-3"
  | "pump"
  | "bolt"
  | "launcher-single";

export type WeaponReloadStyle = "magazine" | "tube";

export type WeaponBallisticsKind = "hitscan" | "pellet" | "tracking-projectile";

export interface WeaponUnlockDescriptor {
  readonly challengeId?: string;
  readonly kind: "starter" | "level" | "challenge";
  readonly label: string;
  readonly requiredPlayerLevel?: number;
  readonly unlockTokenCost?: number;
}

export interface WeaponZoomLevelDescriptor {
  readonly label: string;
  readonly magnification: number;
}

export interface WeaponAimProfileDescriptor {
  readonly adsFovDegrees: number;
  readonly adsCameraTargetOffset?: AttachmentAimBasisOffsetDescriptor | null;
  readonly defaultReticleId: ReticleId;
  readonly poseProfileId: WeaponPoseProfileId;
  readonly reticleStyleId: string;
  readonly zoomLevels: readonly WeaponZoomLevelDescriptor[];
}

export interface WeaponFireControlStatsDescriptor {
  readonly burstIntervalMs: number | null;
  readonly burstSize: number | null;
  readonly mode: WeaponFireMode;
  readonly roundsPerMinute: number;
}

export interface WeaponMagazineStatsDescriptor {
  readonly ammoPerShot: number;
  readonly magazineSize: number;
  readonly maxCarriedAmmo: number;
  readonly perRoundReloadSeconds: number | null;
  readonly reloadSeconds: number;
  readonly reloadStyle: WeaponReloadStyle;
}

export interface WeaponDamageStatsDescriptor {
  readonly body: number;
  readonly canHeadshot: boolean;
  readonly head: number;
  readonly limb: number;
  readonly pelletsPerShot: number;
  readonly shieldMultiplier: number;
  readonly splashInnerRadiusMeters: number | null;
  readonly splashMaxDamage: number | null;
  readonly splashMinDamage: number | null;
  readonly splashOuterRadiusMeters: number | null;
}

export interface WeaponAccuracyStatsDescriptor {
  readonly adsSpreadDegrees: number;
  readonly firstShotAccuracy: boolean;
  readonly hipSpreadDegrees: number;
  readonly movementBloomDegrees: number;
  readonly recoilPitchDegrees: number;
  readonly recoilYawDegrees: number;
}

export interface WeaponRangeStatsDescriptor {
  readonly falloffEndMeters: number;
  readonly falloffStartMeters: number;
  readonly maxMeters: number;
  readonly optimalMeters: number;
}

export interface WeaponBallisticsStatsDescriptor {
  readonly gravityScale: number;
  readonly kind: WeaponBallisticsKind;
  readonly lockOnSupported: boolean;
  readonly maxTrackingDistanceMeters: number | null;
  readonly projectileLifetimeSeconds: number | null;
  readonly projectileVelocityMetersPerSecond: number | null;
  readonly splashSelfDamage: boolean;
  readonly trackingLockConeDegrees: number | null;
  readonly trackingTurnRateDegreesPerSecond: number | null;
}

export interface WeaponHandlingStatsDescriptor {
  readonly adsTransitionSeconds: number;
  readonly equipSeconds: number;
  readonly moveSpeedMultiplier: number;
  readonly readyRecoverySeconds: number;
  readonly sprintOutSeconds: number;
}

export interface WeaponStatBlockDescriptor {
  readonly accuracy: WeaponAccuracyStatsDescriptor;
  readonly ballistics: WeaponBallisticsStatsDescriptor;
  readonly damage: WeaponDamageStatsDescriptor;
  readonly fireControl: WeaponFireControlStatsDescriptor;
  readonly handling: WeaponHandlingStatsDescriptor;
  readonly magazine: WeaponMagazineStatsDescriptor;
  readonly range: WeaponRangeStatsDescriptor;
}

export interface NumericStatModifierDescriptor {
  readonly add?: number;
  readonly clampMax?: number;
  readonly clampMin?: number;
  readonly multiply?: number;
}

export type NumericStatModifiers<TStats> = {
  readonly [TKey in keyof TStats]?: TStats[TKey] extends number | null
    ? NumericStatModifierDescriptor
    : never;
};

export interface WeaponStatModifierDescriptor {
  readonly accuracy?: NumericStatModifiers<WeaponAccuracyStatsDescriptor>;
  readonly ballistics?: NumericStatModifiers<WeaponBallisticsStatsDescriptor>;
  readonly damage?: NumericStatModifiers<WeaponDamageStatsDescriptor>;
  readonly fireControl?: NumericStatModifiers<WeaponFireControlStatsDescriptor>;
  readonly handling?: NumericStatModifiers<WeaponHandlingStatsDescriptor>;
  readonly magazine?: NumericStatModifiers<WeaponMagazineStatsDescriptor>;
  readonly range?: NumericStatModifiers<WeaponRangeStatsDescriptor>;
}

export interface WeaponModuleSocketDescriptor {
  readonly defaultModuleId: string | null;
  readonly required: boolean;
  readonly slotId: WeaponModuleSlotId;
  readonly socketRole: HeldObjectSocketRoleId;
}

export interface WeaponArchetypeDescriptor<
  TId extends AttachmentAssetId = AttachmentAssetId,
> {
  readonly allowedSocketIds: readonly SocketId[];
  readonly compatibleSkeletons: readonly SkeletonId[];
  readonly defaultSocketId: SocketId;
  readonly family: WeaponFamilyId;
  readonly holdProfile: HeldObjectHoldProfileDescriptor;
  readonly id: TId;
  readonly label: string;
  readonly model: AssetLodGroup;
  readonly mountedHolster: AttachmentMountedHolsterDescriptor | null;
  readonly moduleSockets: readonly WeaponModuleSocketDescriptor[];
  readonly stats: WeaponStatBlockDescriptor;
  readonly tags: readonly string[];
  readonly unlock: WeaponUnlockDescriptor | null;
  readonly weaponAimProfile: WeaponAimProfileDescriptor;
}

export interface WeaponModuleAimOverridesDescriptor {
  readonly adsCameraTargetOffset?: AttachmentAimBasisOffsetDescriptor | null;
  readonly adsFovDegrees?: number;
  readonly defaultReticleId?: ReticleId;
  readonly reticleStyleId?: string;
  readonly zoomLevels?: readonly WeaponZoomLevelDescriptor[];
}

export interface WeaponModuleAssetDescriptor {
  readonly aimOverrides?: WeaponModuleAimOverridesDescriptor;
  readonly compatibleFamilies: readonly WeaponFamilyId[];
  readonly defaultForFamilies?: readonly WeaponFamilyId[];
  readonly id: string;
  readonly label: string;
  readonly model: AssetLodGroup;
  readonly slotId: WeaponModuleSlotId;
  readonly statModifiers?: WeaponStatModifierDescriptor;
  readonly tags: readonly string[];
  readonly unlock: WeaponUnlockDescriptor | null;
}

export interface WeaponArchetypeManifest<
  TEntries extends readonly WeaponArchetypeDescriptor[] =
    readonly WeaponArchetypeDescriptor[],
> {
  readonly archetypes: TEntries;
  readonly byId: RegistryById<TEntries>;
}

export interface WeaponModuleManifest<
  TEntries extends readonly WeaponModuleAssetDescriptor[] =
    readonly WeaponModuleAssetDescriptor[],
> {
  readonly byId: RegistryById<TEntries>;
  readonly modules: TEntries;
}

export interface ResolvedWeaponLoadoutDescriptor {
  readonly aimProfile: WeaponAimProfileDescriptor;
  readonly issues: readonly string[];
  readonly modulesBySlot: Readonly<
    Record<WeaponModuleSlotId, WeaponModuleAssetDescriptor | null>
  >;
  readonly stats: WeaponStatBlockDescriptor;
  readonly weapon: WeaponArchetypeDescriptor;
}

export function defineWeaponArchetypeManifest<
  const TEntries extends readonly WeaponArchetypeDescriptor[],
>(archetypes: TEntries): WeaponArchetypeManifest<TEntries> {
  const byId = Object.fromEntries(
    archetypes.map((archetype) => [archetype.id, archetype] as const),
  ) as RegistryById<TEntries>;

  return {
    archetypes,
    byId,
  };
}

export function defineWeaponModuleManifest<
  const TEntries extends readonly WeaponModuleAssetDescriptor[],
>(modules: TEntries): WeaponModuleManifest<TEntries> {
  const byId = Object.fromEntries(
    modules.map((module) => [module.id, module] as const),
  ) as RegistryById<TEntries>;

  return {
    byId,
    modules,
  };
}

export function buildAttachmentAssetFromWeaponArchetype<
  const TWeapon extends WeaponArchetypeDescriptor,
>(weapon: TWeapon): AttachmentAssetDescriptor<TWeapon["id"]> {
  return {
    allowedSocketIds: weapon.allowedSocketIds,
    category: "handheld",
    compatibleSkeletons: weapon.compatibleSkeletons,
    defaultSocketId: weapon.defaultSocketId,
    heldMount: {
      adsCameraTargetOffset:
        weapon.weaponAimProfile.adsCameraTargetOffset ?? null,
      attachmentSocketRole: "grip.primary",
    },
    holdProfile: weapon.holdProfile,
    id: weapon.id,
    label: weapon.label,
    mountedHolster: weapon.mountedHolster,
    renderModel: weapon.model,
  };
}
