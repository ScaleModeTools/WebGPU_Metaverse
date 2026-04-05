import type { AudioChannelId } from "@thumbshooter/shared";

export const gameMenuSectionIds = [
  "controls",
  "calibration",
  "audio"
] as const;
export const gameMenuEntryActions = ["escape-key", "menu-button"] as const;

export type GameMenuSectionId = (typeof gameMenuSectionIds)[number];
export type GameMenuEntryAction = (typeof gameMenuEntryActions)[number];

export interface GameMenuSectionDefinition {
  readonly id: GameMenuSectionId;
  readonly label: string;
}

export interface GameMenuPlan {
  readonly placement: "center-modal";
  readonly entryActions: readonly GameMenuEntryAction[];
  readonly sections: readonly GameMenuSectionDefinition[];
  readonly controlsSummary: readonly string[];
  readonly recalibrationAction: "restart-nine-point-calibration";
  readonly audioControls: readonly AudioChannelId[];
}
