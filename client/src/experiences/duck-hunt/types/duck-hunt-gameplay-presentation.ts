export const gameplayReticleStyledStates = [
  "tracking-unavailable",
  "neutral",
  "targeted",
  "hit",
  "reload-required",
  "reloading",
  "round-paused"
] as const;
export const gameplayReticleVisualStates = [
  "hidden",
  ...gameplayReticleStyledStates
] as const;

export type GameplayReticleStyledState =
  (typeof gameplayReticleStyledStates)[number];
export type GameplayReticleVisualState =
  (typeof gameplayReticleVisualStates)[number];
