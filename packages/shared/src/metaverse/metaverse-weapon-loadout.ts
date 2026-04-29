export const metaverseWeaponSlotIds = ["primary", "secondary"] as const;

export type MetaverseWeaponSlotId = (typeof metaverseWeaponSlotIds)[number];

export const metaverseWeaponInactiveMountIds = [
  "carry.back",
  "hidden"
] as const;

export type MetaverseWeaponInactiveMountId =
  (typeof metaverseWeaponInactiveMountIds)[number];

export interface MetaverseWeaponLayoutSlotSnapshot {
  readonly attachmentId: string;
  readonly equipped: boolean;
  readonly inactiveMount: MetaverseWeaponInactiveMountId;
  readonly slotId: MetaverseWeaponSlotId;
  readonly weaponId: string;
}

export interface MetaverseWeaponLayoutSnapshot {
  readonly activeSlotId: MetaverseWeaponSlotId | null;
  readonly slots: readonly MetaverseWeaponLayoutSlotSnapshot[];
  readonly weaponLayoutId: string;
}

export function isMetaverseWeaponSlotId(
  value: string | null | undefined
): value is MetaverseWeaponSlotId {
  return (
    value !== null &&
    value !== undefined &&
    metaverseWeaponSlotIds.includes(value as MetaverseWeaponSlotId)
  );
}

function createWeaponLayoutSlotSnapshot(
  input: MetaverseWeaponLayoutSlotSnapshot
): MetaverseWeaponLayoutSlotSnapshot {
  return Object.freeze({
    attachmentId: input.attachmentId,
    equipped: input.equipped,
    inactiveMount: input.inactiveMount,
    slotId: input.slotId,
    weaponId: input.weaponId
  });
}

export const metaverseWeaponLayouts = Object.freeze([
  Object.freeze({
    activeSlotId: "primary",
    slots: Object.freeze([
      createWeaponLayoutSlotSnapshot({
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        inactiveMount: "carry.back",
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2"
      })
    ]),
    weaponLayoutId: "duck-hunt-default-pistol-layout"
  }),
  Object.freeze({
    activeSlotId: "primary",
    slots: Object.freeze([
      createWeaponLayoutSlotSnapshot({
        attachmentId: "metaverse-service-pistol-v2",
        equipped: true,
        inactiveMount: "carry.back",
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v2"
      }),
      createWeaponLayoutSlotSnapshot({
        attachmentId: "metaverse-rocket-launcher-v1",
        equipped: true,
        inactiveMount: "carry.back",
        slotId: "secondary",
        weaponId: "metaverse-rocket-launcher-v1"
      })
    ]),
    weaponLayoutId: "metaverse-tdm-pistol-rocket-layout"
  })
] satisfies readonly MetaverseWeaponLayoutSnapshot[]);

const metaverseWeaponLayoutById: ReadonlyMap<
  string,
  MetaverseWeaponLayoutSnapshot
> = new Map(
  metaverseWeaponLayouts.map((layout) => [layout.weaponLayoutId, layout])
);

export function readMetaverseWeaponLayout(
  weaponLayoutId: string | null | undefined
): MetaverseWeaponLayoutSnapshot | null {
  if (weaponLayoutId === null || weaponLayoutId === undefined) {
    return null;
  }

  const weaponLayout = metaverseWeaponLayoutById.get(weaponLayoutId) ?? null;

  if (weaponLayout === null) {
    throw new Error(`Unknown metaverse weapon layout: ${weaponLayoutId}`);
  }

  return weaponLayout;
}

export function createMetaverseWeaponInstanceId(
  ownerId: string,
  slotId: MetaverseWeaponSlotId,
  weaponId: string
): string {
  return `${ownerId}:${slotId}:${weaponId}`;
}
