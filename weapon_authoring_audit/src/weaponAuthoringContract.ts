// Weapon authoring contract v0.1
// Data-only types and current prototype summaries. Intended for runtime, editor tooling, and tests.

export type WeaponFamily =
  | "sidearm"
  | "long_gun"
  | "shoulder_heavy"
  | "melee_one_hand"
  | "melee_two_hand"
  | "tool_or_prop"
  | "throwable";

export type WeaponSocketRole =
  | "basis.forward"
  | "basis.up"
  | "grip.primary"
  | "grip.primary.right_hint"
  | "grip.secondary"
  | "grip.secondary.optional"
  | "grip.secondary.required"
  | "trigger.index"
  | "projectile.muzzle"
  | "projectile.exhaust"
  | "ejection.port"
  | "magazine.socket"
  | "ammo.socket"
  | "reload.feed_socket"
  | "camera.ads_anchor"
  | "sight.front"
  | "sight.rear"
  | "module.optic"
  | "module.barrel"
  | "module.underbarrel"
  | "module.underbarrel_grip"
  | "module.stock"
  | "carry.hip"
  | "carry.back"
  | "carry.chest"
  | "sling.front"
  | "sling.rear"
  | "body.stock"
  | "body.shoulder_contact"
  | "body.chest_contact"
  | "body.forearm_contact"
  | "melee.tip"
  | "melee.edge_primary"
  | "melee.edge_secondary"
  | "melee.impact_volume"
  | "trail.start"
  | "trail.end"
  | "use.origin"
  | "interaction.hotspot"
  | "screen.anchor"
  | "light.origin"
  | "pour.origin"
  | "hazard.backblast_cone"
  | "hazard.heat_zone"
  | "hazard.blade_edge";

export type SupportPolicy =
  | "none"
  | "optional_support_palm"
  | "optional_secondary_grip"
  | "required_support_grip"
  | "required_two_hand"
  | "animation_event_controlled";

export type AdsPolicy =
  | "none"
  | "muzzle_forward"
  | "iron_sights"
  | "optic_anchor"
  | "shouldered_heavy"
  | "third_person_hint_only";

export interface WeaponSocketManifest {
  role: WeaponSocketRole;
  nodeName: string;
  position: readonly [number, number, number];
  rotationPolicy?: "identity_in_current_build" | "authored_full_transform";
  orientationContract?: string;
}

export interface WeaponHoldProfile {
  primaryHandDefault: "right" | "left" | "either";
  allowedHands: readonly ("right" | "left")[];
  dominantGripRole: "grip.primary";
  offhandPolicy: SupportPolicy;
  poseProfileId: string;
  recommendedNeutralPose?: string;
  aimModel?: string;
  adsReference?: WeaponSocketRole;
  projectileOrigin?: WeaponSocketRole;
  bodyContacts?: readonly string[];
  hazards?: readonly string[];
  fingerPoseHints?: {
    primary?: string;
    secondary?: string;
  };
}

export interface WeaponAssetManifest {
  schemaVersion: "weapon-asset-manifest.v0.1";
  assetId: string;
  sourceFile: string;
  family: WeaponFamily;
  poseProfileId: string;
  recommendedRuntimePack: string;
  coordinateSystem: {
    units: "meters";
    weaponForward: "+X";
    weaponUp: "+Y";
    weaponRight: "+Z";
  };
  holdProfile: WeaponHoldProfile;
  sockets: readonly WeaponSocketManifest[];
}

export const WEAPON_POSE_PROFILES = {
  SIDEARM_ONE_HAND_OPTIONAL_SUPPORT: "sidearm.one_hand_optional_support",
  LONG_GUN_TWO_HAND_SHOULDER: "long_gun.two_hand_shoulder",
  SHOULDER_HEAVY_TWO_HAND_SHOULDERED: "shoulder_heavy.two_hand_shouldered",
  MELEE_ONE_HAND: "melee.one_hand",
  MELEE_TWO_HAND: "melee.two_hand",
  TOOL_ONE_HAND: "tool.one_hand",
} as const;

export const CURRENT_WEAPON_AUDIT_SUMMARY = [
  {
    assetId: "metaverse_service_pistol",
    family: "sidearm",
    poseProfileId: "sidearm.one_hand_optional_support",
    boundsMeters: { x: 0.316, y: 0.203587, z: 0.035 },
    verdict: "good prototype; needs explicit manifest and full socket orientation",
  },
  {
    assetId: "metaverse_rocket_launcher",
    family: "shoulder_heavy",
    poseProfileId: "shoulder_heavy.two_hand_shouldered",
    boundsMeters: { x: 1.185, y: 0.352595, z: 0.14 },
    verdict: "good scalable prototype; add required support/body/backblast semantics",
  },
] as const;

export function isTwoHandFamily(family: WeaponFamily): boolean {
  return family === "long_gun" || family === "shoulder_heavy" || family === "melee_two_hand";
}

export function requiresProjectileSockets(family: WeaponFamily): boolean {
  return family === "sidearm" || family === "long_gun" || family === "shoulder_heavy";
}

export function requiresMeleeSockets(family: WeaponFamily): boolean {
  return family === "melee_one_hand" || family === "melee_two_hand";
}
