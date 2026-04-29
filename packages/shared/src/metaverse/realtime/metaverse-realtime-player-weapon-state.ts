import {
  isMetaverseWeaponSlotId,
  type MetaverseWeaponSlotId
} from "../metaverse-weapon-loadout.js";

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
  readonly activeSlotId: MetaverseWeaponSlotId | null;
  readonly aimMode: MetaverseRealtimePlayerWeaponAimModeId;
  readonly slots: readonly MetaverseRealtimeWeaponSlotSnapshot[];
  readonly weaponId: string;
}

export interface MetaverseRealtimeWeaponSlotSnapshot {
  readonly attachmentId: string;
  readonly equipped: boolean;
  readonly slotId: MetaverseWeaponSlotId;
  readonly weaponId: string;
  readonly weaponInstanceId: string;
}

export interface MetaverseRealtimeWeaponSlotSnapshotInput {
  readonly attachmentId?: string;
  readonly equipped?: boolean;
  readonly slotId: MetaverseWeaponSlotId;
  readonly weaponId: string;
  readonly weaponInstanceId?: string;
}

export interface MetaverseRealtimePlayerWeaponStateSnapshotInput {
  readonly activeSlotId?: MetaverseWeaponSlotId | null;
  readonly aimMode?: MetaverseRealtimePlayerWeaponAimModeId;
  readonly slots?: readonly MetaverseRealtimeWeaponSlotSnapshotInput[];
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

function createDefaultWeaponInstanceId(
  slotId: MetaverseWeaponSlotId,
  weaponId: string
): string {
  return `${slotId}:${weaponId}`;
}

export function createMetaverseRealtimeWeaponSlotSnapshot(
  input: MetaverseRealtimeWeaponSlotSnapshotInput
): MetaverseRealtimeWeaponSlotSnapshot {
  return Object.freeze({
    attachmentId: normalizeRequiredIdentifier(
      input.attachmentId ?? input.weaponId,
      "Metaverse realtime weapon slot attachmentId"
    ),
    equipped: input.equipped ?? true,
    slotId: input.slotId,
    weaponId: normalizeRequiredIdentifier(
      input.weaponId,
      "Metaverse realtime weapon slot weaponId"
    ),
    weaponInstanceId: normalizeRequiredIdentifier(
      input.weaponInstanceId ??
        createDefaultWeaponInstanceId(input.slotId, input.weaponId),
      "Metaverse realtime weapon slot weaponInstanceId"
    )
  });
}

function resolveActiveSlotId(
  input: MetaverseRealtimePlayerWeaponStateSnapshotInput,
  normalizedSlots: readonly MetaverseRealtimeWeaponSlotSnapshot[]
): MetaverseWeaponSlotId | null {
  if (isMetaverseWeaponSlotId(input.activeSlotId ?? null)) {
    const activeSlot = normalizedSlots.find(
      (slot) => slot.slotId === input.activeSlotId
    );

    if (activeSlot !== undefined && activeSlot.equipped) {
      return activeSlot.slotId;
    }
  }

  const matchingSlot = normalizedSlots.find(
    (slot) => slot.weaponId === input.weaponId && slot.equipped
  );

  if (matchingSlot !== undefined) {
    return matchingSlot.slotId;
  }

  return normalizedSlots.find((slot) => slot.equipped)?.slotId ?? null;
}

export function createMetaverseRealtimePlayerWeaponStateSnapshot(
  input: MetaverseRealtimePlayerWeaponStateSnapshotInput
): MetaverseRealtimePlayerWeaponStateSnapshot {
  const normalizedInputWeaponId = normalizeRequiredIdentifier(
    input.weaponId,
    "Metaverse realtime weaponId"
  );
  const normalizedSlots = Object.freeze(
    (input.slots === undefined || input.slots.length === 0
      ? [
          {
            attachmentId: normalizedInputWeaponId,
            equipped: true,
            slotId: input.activeSlotId ?? "primary",
            weaponId: normalizedInputWeaponId
          }
        ]
      : input.slots
    ).map((slot) => createMetaverseRealtimeWeaponSlotSnapshot(slot))
  );
  const activeSlotId = resolveActiveSlotId(input, normalizedSlots);
  const activeSlot =
    activeSlotId === null
      ? null
      : normalizedSlots.find((slot) => slot.slotId === activeSlotId) ?? null;

  return Object.freeze({
    activeSlotId,
    aimMode: resolveAimMode(input.aimMode),
    slots: normalizedSlots,
    weaponId: activeSlot?.weaponId ?? normalizedInputWeaponId
  });
}
