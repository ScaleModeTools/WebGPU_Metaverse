export interface MetaverseCharacterPresentationProfileSnapshot {
  readonly accentColorToken: string;
  readonly id: string;
  readonly label: string;
  readonly locomotionPresentationId: string;
}

export const shellDefaultCharacterPresentationProfile = Object.freeze({
  accentColorToken: "shell-default",
  id: "shell-default-character-presentation",
  label: "Shell Default Character Presentation",
  locomotionPresentationId: "grounded-shell-default"
} satisfies MetaverseCharacterPresentationProfileSnapshot);
