export const animationVocabularyIds = [
  "idle",
  "walk",
  "swim-idle",
  "swim",
  "jump-up",
  "jump-mid",
  "jump-down",
  "aim",
  "interact",
  "seated"
] as const;

export type AnimationVocabularyId = (typeof animationVocabularyIds)[number];

export const canonicalAnimationClipNamesByVocabulary = Object.freeze({
  idle: "Idle_Loop",
  walk: "walk",
  "swim-idle": "swim-idle",
  swim: "swim",
  "jump-up": "Jump_Start",
  "jump-mid": "Jump_Loop",
  "jump-down": "Jump_Land",
  aim: "aim",
  interact: "interact",
  seated: "seated"
} as const satisfies Readonly<Record<AnimationVocabularyId, string>>);
