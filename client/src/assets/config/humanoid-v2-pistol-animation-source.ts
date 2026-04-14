export const humanoidV2PistolAimPoseIds = [
  "down",
  "neutral",
  "up"
] as const;

export type HumanoidV2PistolAimPoseId =
  (typeof humanoidV2PistolAimPoseIds)[number];

export const humanoidV2PistolAnimationSourcePath =
  "/models/metaverse/characters/all_pistol_animations.glb";

export const humanoidV2PistolAimClipNamesByPoseId = Object.freeze({
  down: "Pistol_Aim_Down",
  neutral: "Pistol_Aim_Neutral",
  up: "Pistol_Aim_Up"
} as const satisfies Readonly<Record<HumanoidV2PistolAimPoseId, string>>);
