import type {
  NumericStatModifierDescriptor,
  ResolvedWeaponLoadoutDescriptor,
  WeaponAimProfileDescriptor,
  WeaponArchetypeDescriptor,
  WeaponModuleAssetDescriptor,
  WeaponModuleSlotId,
  WeaponStatBlockDescriptor,
  WeaponStatModifierDescriptor
} from "../types/weapon-builder-manifest";

type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K];
};

function cloneWeaponStats(
  stats: WeaponStatBlockDescriptor
): Mutable<WeaponStatBlockDescriptor> {
  return {
    accuracy: { ...stats.accuracy },
    ballistics: { ...stats.ballistics },
    damage: { ...stats.damage },
    fireControl: { ...stats.fireControl },
    handling: { ...stats.handling },
    magazine: { ...stats.magazine },
    range: { ...stats.range }
  };
}

function cloneAimProfile(
  aimProfile: WeaponAimProfileDescriptor
): Mutable<WeaponAimProfileDescriptor> {
  return {
    ...aimProfile,
    zoomLevels: aimProfile.zoomLevels.map((zoomLevel) => ({ ...zoomLevel }))
  } as Mutable<WeaponAimProfileDescriptor>;
}

function applyNumericModifier(
  baseValue: number | null,
  modifier: NumericStatModifierDescriptor | undefined
): number | null {
  if (baseValue === null || modifier === undefined) {
    return baseValue;
  }

  let nextValue = baseValue;

  if (modifier.multiply !== undefined) {
    nextValue *= modifier.multiply;
  }

  if (modifier.add !== undefined) {
    nextValue += modifier.add;
  }

  if (modifier.clampMin !== undefined) {
    nextValue = Math.max(modifier.clampMin, nextValue);
  }

  if (modifier.clampMax !== undefined) {
    nextValue = Math.min(modifier.clampMax, nextValue);
  }

  return Number(nextValue.toFixed(6));
}

function applyStatModifiers(
  stats: WeaponStatBlockDescriptor,
  modifier: WeaponStatModifierDescriptor | null | undefined
): WeaponStatBlockDescriptor {
  if (modifier == null) {
    return stats;
  }

  const nextStats = cloneWeaponStats(stats);

  if (modifier.fireControl !== undefined) {
    nextStats.fireControl.roundsPerMinute =
      applyNumericModifier(
        nextStats.fireControl.roundsPerMinute,
        modifier.fireControl.roundsPerMinute
      ) ?? nextStats.fireControl.roundsPerMinute;
    nextStats.fireControl.burstIntervalMs =
      applyNumericModifier(
        nextStats.fireControl.burstIntervalMs,
        modifier.fireControl.burstIntervalMs
      ) ?? nextStats.fireControl.burstIntervalMs;
  }

  if (modifier.magazine !== undefined) {
    nextStats.magazine.magazineSize =
      applyNumericModifier(
        nextStats.magazine.magazineSize,
        modifier.magazine.magazineSize
      ) ?? nextStats.magazine.magazineSize;
    nextStats.magazine.maxCarriedAmmo =
      applyNumericModifier(
        nextStats.magazine.maxCarriedAmmo,
        modifier.magazine.maxCarriedAmmo
      ) ?? nextStats.magazine.maxCarriedAmmo;
    nextStats.magazine.reloadSeconds =
      applyNumericModifier(
        nextStats.magazine.reloadSeconds,
        modifier.magazine.reloadSeconds
      ) ?? nextStats.magazine.reloadSeconds;
    nextStats.magazine.perRoundReloadSeconds =
      applyNumericModifier(
        nextStats.magazine.perRoundReloadSeconds,
        modifier.magazine.perRoundReloadSeconds
      ) ?? nextStats.magazine.perRoundReloadSeconds;
  }

  if (modifier.damage !== undefined) {
    nextStats.damage.body =
      applyNumericModifier(nextStats.damage.body, modifier.damage.body) ??
      nextStats.damage.body;
    nextStats.damage.head =
      applyNumericModifier(nextStats.damage.head, modifier.damage.head) ??
      nextStats.damage.head;
    nextStats.damage.limb =
      applyNumericModifier(nextStats.damage.limb, modifier.damage.limb) ??
      nextStats.damage.limb;
    nextStats.damage.pelletsPerShot =
      applyNumericModifier(
        nextStats.damage.pelletsPerShot,
        modifier.damage.pelletsPerShot
      ) ?? nextStats.damage.pelletsPerShot;
    nextStats.damage.splashInnerRadiusMeters =
      applyNumericModifier(
        nextStats.damage.splashInnerRadiusMeters,
        modifier.damage.splashInnerRadiusMeters
      ) ?? nextStats.damage.splashInnerRadiusMeters;
    nextStats.damage.splashOuterRadiusMeters =
      applyNumericModifier(
        nextStats.damage.splashOuterRadiusMeters,
        modifier.damage.splashOuterRadiusMeters
      ) ?? nextStats.damage.splashOuterRadiusMeters;
    nextStats.damage.splashMaxDamage =
      applyNumericModifier(
        nextStats.damage.splashMaxDamage,
        modifier.damage.splashMaxDamage
      ) ?? nextStats.damage.splashMaxDamage;
    nextStats.damage.splashMinDamage =
      applyNumericModifier(
        nextStats.damage.splashMinDamage,
        modifier.damage.splashMinDamage
      ) ?? nextStats.damage.splashMinDamage;
  }

  if (modifier.accuracy !== undefined) {
    nextStats.accuracy.hipSpreadDegrees =
      applyNumericModifier(
        nextStats.accuracy.hipSpreadDegrees,
        modifier.accuracy.hipSpreadDegrees
      ) ?? nextStats.accuracy.hipSpreadDegrees;
    nextStats.accuracy.adsSpreadDegrees =
      applyNumericModifier(
        nextStats.accuracy.adsSpreadDegrees,
        modifier.accuracy.adsSpreadDegrees
      ) ?? nextStats.accuracy.adsSpreadDegrees;
    nextStats.accuracy.movementBloomDegrees =
      applyNumericModifier(
        nextStats.accuracy.movementBloomDegrees,
        modifier.accuracy.movementBloomDegrees
      ) ?? nextStats.accuracy.movementBloomDegrees;
    nextStats.accuracy.recoilPitchDegrees =
      applyNumericModifier(
        nextStats.accuracy.recoilPitchDegrees,
        modifier.accuracy.recoilPitchDegrees
      ) ?? nextStats.accuracy.recoilPitchDegrees;
    nextStats.accuracy.recoilYawDegrees =
      applyNumericModifier(
        nextStats.accuracy.recoilYawDegrees,
        modifier.accuracy.recoilYawDegrees
      ) ?? nextStats.accuracy.recoilYawDegrees;
  }

  if (modifier.range !== undefined) {
    nextStats.range.optimalMeters =
      applyNumericModifier(
        nextStats.range.optimalMeters,
        modifier.range.optimalMeters
      ) ?? nextStats.range.optimalMeters;
    nextStats.range.falloffStartMeters =
      applyNumericModifier(
        nextStats.range.falloffStartMeters,
        modifier.range.falloffStartMeters
      ) ?? nextStats.range.falloffStartMeters;
    nextStats.range.falloffEndMeters =
      applyNumericModifier(
        nextStats.range.falloffEndMeters,
        modifier.range.falloffEndMeters
      ) ?? nextStats.range.falloffEndMeters;
    nextStats.range.maxMeters =
      applyNumericModifier(
        nextStats.range.maxMeters,
        modifier.range.maxMeters
      ) ?? nextStats.range.maxMeters;
  }

  if (modifier.ballistics !== undefined) {
    nextStats.ballistics.projectileVelocityMetersPerSecond =
      applyNumericModifier(
        nextStats.ballistics.projectileVelocityMetersPerSecond,
        modifier.ballistics.projectileVelocityMetersPerSecond
      ) ?? nextStats.ballistics.projectileVelocityMetersPerSecond;
    nextStats.ballistics.gravityScale =
      applyNumericModifier(
        nextStats.ballistics.gravityScale,
        modifier.ballistics.gravityScale
      ) ?? nextStats.ballistics.gravityScale;
    nextStats.ballistics.maxTrackingDistanceMeters =
      applyNumericModifier(
        nextStats.ballistics.maxTrackingDistanceMeters,
        modifier.ballistics.maxTrackingDistanceMeters
      ) ?? nextStats.ballistics.maxTrackingDistanceMeters;
    nextStats.ballistics.trackingLockConeDegrees =
      applyNumericModifier(
        nextStats.ballistics.trackingLockConeDegrees,
        modifier.ballistics.trackingLockConeDegrees
      ) ?? nextStats.ballistics.trackingLockConeDegrees;
    nextStats.ballistics.trackingTurnRateDegreesPerSecond =
      applyNumericModifier(
        nextStats.ballistics.trackingTurnRateDegreesPerSecond,
        modifier.ballistics.trackingTurnRateDegreesPerSecond
      ) ?? nextStats.ballistics.trackingTurnRateDegreesPerSecond;
  }

  if (modifier.handling !== undefined) {
    nextStats.handling.adsTransitionSeconds =
      applyNumericModifier(
        nextStats.handling.adsTransitionSeconds,
        modifier.handling.adsTransitionSeconds
      ) ?? nextStats.handling.adsTransitionSeconds;
    nextStats.handling.equipSeconds =
      applyNumericModifier(
        nextStats.handling.equipSeconds,
        modifier.handling.equipSeconds
      ) ?? nextStats.handling.equipSeconds;
    nextStats.handling.sprintOutSeconds =
      applyNumericModifier(
        nextStats.handling.sprintOutSeconds,
        modifier.handling.sprintOutSeconds
      ) ?? nextStats.handling.sprintOutSeconds;
    nextStats.handling.moveSpeedMultiplier =
      applyNumericModifier(
        nextStats.handling.moveSpeedMultiplier,
        modifier.handling.moveSpeedMultiplier
      ) ?? nextStats.handling.moveSpeedMultiplier;
    nextStats.handling.readyRecoverySeconds =
      applyNumericModifier(
        nextStats.handling.readyRecoverySeconds,
        modifier.handling.readyRecoverySeconds
      ) ?? nextStats.handling.readyRecoverySeconds;
  }

  return nextStats;
}

function applyAimOverrides(
  baseAimProfile: Mutable<WeaponAimProfileDescriptor>,
  module: WeaponModuleAssetDescriptor
): Mutable<WeaponAimProfileDescriptor> {
  const aimOverrides = module.aimOverrides;

  if (aimOverrides == null) {
    return baseAimProfile;
  }

  return {
    adsFovDegrees: aimOverrides.adsFovDegrees ?? baseAimProfile.adsFovDegrees,
    defaultReticleId:
      aimOverrides.defaultReticleId !== undefined
        ? aimOverrides.defaultReticleId
        : baseAimProfile.defaultReticleId,
    poseProfileId: baseAimProfile.poseProfileId,
    reticleStyleId:
      aimOverrides.reticleStyleId ?? baseAimProfile.reticleStyleId,
    zoomLevels:
      aimOverrides.zoomLevels?.map((zoomLevel) => ({ ...zoomLevel })) ??
      baseAimProfile.zoomLevels
  } as Mutable<WeaponAimProfileDescriptor>;
}

export function readDefaultWeaponModuleIds(
  weapon: WeaponArchetypeDescriptor
): readonly string[] {
  return weapon.moduleSockets
    .map((socket) => socket.defaultModuleId ?? null)
    .filter((moduleId): moduleId is string => moduleId !== null);
}

function createEmptyModulesBySlot(): Readonly<Record<WeaponModuleSlotId, WeaponModuleAssetDescriptor | null>> {
  return {
    grip: null,
    "front-sight": null,
    "rear-sight": null,
    optic: null,
    muzzle: null
  };
}

export function resolveWeaponLoadout(input: {
  readonly equippedModules: readonly WeaponModuleAssetDescriptor[];
  readonly weapon: WeaponArchetypeDescriptor;
}): ResolvedWeaponLoadoutDescriptor {
  const issues: string[] = [];
  const modulesBySlot: Record<WeaponModuleSlotId, WeaponModuleAssetDescriptor | null> =
    { ...createEmptyModulesBySlot() };
  let nextStats = cloneWeaponStats(input.weapon.stats);
  let nextAimProfile = cloneAimProfile(input.weapon.weaponAimProfile);

  for (const module of input.equippedModules) {
    let compatibleSocketFound = false;

    for (const socket of input.weapon.moduleSockets) {
      if (socket.slotId === module.slotId) {
        compatibleSocketFound = true;
        break;
      }
    }

    if (!compatibleSocketFound) {
      issues.push(
        `${module.id} does not have a matching socket on ${input.weapon.id}.`
      );
      continue;
    }

    let familyCompatible = false;

    for (const family of module.compatibleFamilies) {
      if (family === input.weapon.family) {
        familyCompatible = true;
        break;
      }
    }

    if (!familyCompatible) {
      issues.push(
        `${module.id} is not compatible with ${input.weapon.family}.`
      );
      continue;
    }

    if (modulesBySlot[module.slotId] !== null) {
      issues.push(
        `${module.slotId} already has ${modulesBySlot[module.slotId]?.id}; replacing with ${module.id}.`
      );
    }

    modulesBySlot[module.slotId] = module;
    nextStats = applyStatModifiers(nextStats, module.statModifiers);
    nextAimProfile = applyAimOverrides(nextAimProfile, module);
  }

  return Object.freeze({
    aimProfile: Object.freeze({
      ...nextAimProfile,
      zoomLevels: Object.freeze(
        nextAimProfile.zoomLevels.map((zoomLevel) => Object.freeze({ ...zoomLevel }))
      )
    }),
    issues: Object.freeze(issues),
    modulesBySlot: Object.freeze({ ...modulesBySlot }),
    stats: Object.freeze({
      accuracy: Object.freeze({ ...nextStats.accuracy }),
      ballistics: Object.freeze({ ...nextStats.ballistics }),
      damage: Object.freeze({ ...nextStats.damage }),
      fireControl: Object.freeze({ ...nextStats.fireControl }),
      handling: Object.freeze({ ...nextStats.handling }),
      magazine: Object.freeze({ ...nextStats.magazine }),
      range: Object.freeze({ ...nextStats.range })
    }),
    weapon: input.weapon
  });
}
