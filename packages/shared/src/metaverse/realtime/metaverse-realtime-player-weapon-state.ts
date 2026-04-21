function normalizeRequiredIdentifier(rawValue: string, label: string): string {
  const normalizedValue = rawValue.trim();

  if (normalizedValue.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }

  return normalizedValue;
}

export const metaverseRealtimePlayerWeaponAimModeIds = [
  "hip-fire",
  "ads"
] as const;

export type MetaverseRealtimePlayerWeaponAimModeId =
  (typeof metaverseRealtimePlayerWeaponAimModeIds)[number];

export interface MetaverseRealtimePlayerWeaponStateSnapshot {
  readonly aimMode: MetaverseRealtimePlayerWeaponAimModeId;
  readonly weaponId: string;
}

export interface MetaverseRealtimePlayerWeaponStateSnapshotInput {
  readonly aimMode?: MetaverseRealtimePlayerWeaponAimModeId;
  readonly weaponId: string;
}

function resolveAimMode(
  rawValue: MetaverseRealtimePlayerWeaponStateSnapshotInput["aimMode"]
): MetaverseRealtimePlayerWeaponAimModeId {
  if (
    rawValue !== undefined &&
    metaverseRealtimePlayerWeaponAimModeIds.includes(rawValue)
  ) {
    return rawValue;
  }

  return "hip-fire";
}

export function createMetaverseRealtimePlayerWeaponStateSnapshot(
  input: MetaverseRealtimePlayerWeaponStateSnapshotInput
): MetaverseRealtimePlayerWeaponStateSnapshot {
  return Object.freeze({
    aimMode: resolveAimMode(input.aimMode),
    weaponId: normalizeRequiredIdentifier(
      input.weaponId,
      "Metaverse realtime weaponId"
    )
  });
}
