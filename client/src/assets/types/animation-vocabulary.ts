export const animationVocabularyIds = [
  "idle",
  "walk",
  "swim-idle",
  "swim",
  "jump-up",
  "jump-mid",
  "jump-down",
  "interact",
  "seated"
] as const;

export type AnimationVocabularyId = (typeof animationVocabularyIds)[number];

export const canonicalAnimationClipNamesByVocabulary = Object.freeze({
  idle: "Idle_Loop",
  walk: "Walk_Loop",
  "swim-idle": "Swim_Idle_Loop",
  swim: "Swim_Fwd_Loop",
  "jump-up": "Jump_Start",
  "jump-mid": "Jump_Loop",
  "jump-down": "Jump_Land",
  interact: "Interact",
  seated: "Sitting_Idle_Loop"
} as const satisfies Readonly<Record<AnimationVocabularyId, string>>);
