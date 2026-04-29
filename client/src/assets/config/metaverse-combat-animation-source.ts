import { metaverseHumanoidBaseAnimationPackSourcePath } from "./animation-clip-manifest";

export const metaverseHitCombatAnimationSourcePath =
  metaverseHumanoidBaseAnimationPackSourcePath;

type MetaverseCombatAnimationSourceActionId =
  | "hit"
  | "death";

export const metaverseCombatAnimationClipNamesByActionId = Object.freeze({
  hit: "Hit_Knockback",
  death: "Hit_Knockback_RM"
} as const satisfies Readonly<
  Record<MetaverseCombatAnimationSourceActionId, string>
>);

export const metaverseCombatAnimationSourcePathByActionId = Object.freeze({
  hit: metaverseHitCombatAnimationSourcePath,
  death: metaverseHitCombatAnimationSourcePath
} as const satisfies Readonly<
  Record<MetaverseCombatAnimationSourceActionId, string>
>);
