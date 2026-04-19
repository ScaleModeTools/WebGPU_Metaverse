export interface MetaverseHudProfileSnapshot {
  readonly id: string;
  readonly label: string;
  readonly widgetIds: readonly string[];
}

export const shellDefaultHudProfile = Object.freeze({
  id: "shell-default-hud",
  label: "Shell Default HUD",
  widgetIds: Object.freeze([
    "audio-status",
    "calibration-status",
    "locomotion-status",
    "portal-focus"
  ])
} satisfies MetaverseHudProfileSnapshot);
