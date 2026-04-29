export const heldObjectFamilyIds = [
  "sidearm",
  "long_gun",
  "shoulder_heavy",
  "melee_one_hand",
  "melee_two_hand",
  "tool_or_prop",
  "throwable",
] as const;

export type HeldObjectFamilyId = (typeof heldObjectFamilyIds)[number];

export const heldObjectPoseProfileIds = [
  "sidearm.one_hand_optional_support",
  "long_gun.two_hand_shoulder",
  "shoulder_heavy.two_hand_shouldered",
  "melee.one_hand",
  "melee.two_hand",
  "tool.one_hand",
] as const;

export type HeldObjectPoseProfileId = (typeof heldObjectPoseProfileIds)[number];

export const heldObjectHandIds = ["right", "left"] as const;

export type HeldObjectHandId = (typeof heldObjectHandIds)[number];

export const heldObjectPrimaryHandIds = ["right", "left", "either"] as const;

export type HeldObjectPrimaryHandId = (typeof heldObjectPrimaryHandIds)[number];

export const heldObjectOffhandPolicyIds = [
  "none",
  "optional_support_palm",
  "optional_secondary_grip",
  "required_support_grip",
  "required_two_hand",
  "animation_event_controlled",
] as const;

export type HeldObjectOffhandPolicyId =
  (typeof heldObjectOffhandPolicyIds)[number];

export const heldObjectAdsPolicyIds = [
  "none",
  "muzzle_forward",
  "iron_sights",
  "optic_anchor",
  "shouldered_heavy",
  "third_person_hint_only",
] as const;

export type HeldObjectAdsPolicyId = (typeof heldObjectAdsPolicyIds)[number];

export const heldObjectSocketRoleIds = [
  "basis.forward",
  "basis.up",
  "grip.primary",
  "grip.secondary",
  "trigger.index",
  "finger.thumb_rest",
  "finger.index_rest",
  "projectile.muzzle",
  "projectile.exhaust",
  "ejection.port",
  "magazine.socket",
  "ammo.socket",
  "reload.feed_socket",
  "camera.ads_anchor",
  "sight.front",
  "sight.rear",
  "module.optic",
  "module.barrel",
  "module.underbarrel",
  "module.underbarrel_grip",
  "module.stock",
  "carry.hip",
  "carry.back",
  "carry.chest",
  "sling.front",
  "sling.rear",
  "body.stock",
  "body.shoulder_contact",
  "body.chest_contact",
  "body.forearm_contact",
  "melee.tip",
  "melee.edge_primary",
  "melee.edge_secondary",
  "melee.impact_volume",
  "trail.start",
  "trail.end",
  "use.origin",
  "interaction.hotspot",
  "screen.anchor",
  "light.origin",
  "pour.origin",
  "hazard.backblast_cone",
  "hazard.heat_zone",
  "hazard.blade_edge",
] as const;

export type HeldObjectSocketRoleId = (typeof heldObjectSocketRoleIds)[number];

export const heldObjectSocketOrientationPolicyIds = [
  "identity_in_current_build",
  "authored_full_transform",
] as const;

export type HeldObjectSocketOrientationPolicyId =
  (typeof heldObjectSocketOrientationPolicyIds)[number];

export interface HeldObjectSocketDescriptor {
  readonly role: HeldObjectSocketRoleId;
  readonly nodeName: string;
  readonly orientationPolicy?: HeldObjectSocketOrientationPolicyId;
}

export interface HeldObjectFingerPoseHintDescriptor {
  readonly primary?: string;
  readonly secondary?: string;
}

export interface HeldObjectHoldProfileDescriptor {
  readonly adsPolicy: HeldObjectAdsPolicyId;
  readonly adsReferenceRole?: HeldObjectSocketRoleId | null;
  readonly allowedHands: readonly HeldObjectHandId[];
  readonly bodyContactRoles?: readonly HeldObjectSocketRoleId[];
  readonly dominantGripRole: "grip.primary";
  readonly family: HeldObjectFamilyId;
  readonly fingerPoseHints?: HeldObjectFingerPoseHintDescriptor | null;
  readonly hazardRoles?: readonly HeldObjectSocketRoleId[];
  readonly offhandPolicy: HeldObjectOffhandPolicyId;
  readonly poseProfileId: HeldObjectPoseProfileId;
  readonly primaryHandDefault: HeldObjectPrimaryHandId;
  readonly projectileOriginRole?: HeldObjectSocketRoleId | null;
  readonly recommendedNeutralPose?: string | null;
  readonly sockets: readonly HeldObjectSocketDescriptor[];
}

export const heldObjectCoreSocketRolesByFamily = Object.freeze({
  sidearm: Object.freeze([
    "grip.primary",
    "trigger.index",
    "projectile.muzzle",
    "camera.ads_anchor",
  ]),
  long_gun: Object.freeze([
    "grip.primary",
    "grip.secondary",
    "trigger.index",
    "projectile.muzzle",
    "camera.ads_anchor",
  ]),
  shoulder_heavy: Object.freeze([
    "grip.primary",
    "grip.secondary",
    "trigger.index",
    "projectile.muzzle",
    "camera.ads_anchor",
  ]),
  melee_one_hand: Object.freeze(["grip.primary", "melee.tip"]),
  melee_two_hand: Object.freeze([
    "grip.primary",
    "grip.secondary",
    "melee.tip",
  ]),
  tool_or_prop: Object.freeze(["grip.primary"]),
  throwable: Object.freeze(["grip.primary"]),
} as const satisfies Readonly<
  Record<HeldObjectFamilyId, readonly HeldObjectSocketRoleId[]>
>);
