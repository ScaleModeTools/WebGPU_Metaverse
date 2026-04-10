export const animationVocabularyIds = [
  "idle",
  "walk",
  "aim",
  "interact",
  "seated"
] as const;

export type AnimationVocabularyId = (typeof animationVocabularyIds)[number];

export const canonicalAnimationClipNamesByVocabulary = Object.freeze({
  idle: "idle",
  walk: "walk",
  aim: "aim",
  interact: "interact",
  seated: "seated"
} as const satisfies Readonly<Record<AnimationVocabularyId, string>>);
