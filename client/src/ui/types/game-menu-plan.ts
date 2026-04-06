import type { AudioChannelId } from "@thumbshooter/shared";
import type { GameplayDebugPanelMode } from "../../game";

export const gameMenuSectionIds = [
  "controls",
  "audio",
  "debug",
  "calibration"
] as const;
export const gameMenuEntryActions = ["escape-key", "menu-button"] as const;

export type GameMenuSectionId = (typeof gameMenuSectionIds)[number];
export type GameMenuEntryAction = (typeof gameMenuEntryActions)[number];

export interface GameMenuSectionDefinition {
  readonly id: GameMenuSectionId;
  readonly label: string;
}

export interface GameMenuDebugModeDefinition {
  readonly description: string;
  readonly label: string;
  readonly mode: GameplayDebugPanelMode;
}

export interface GameMenuPlan {
  readonly placement: "center-modal";
  readonly entryActions: readonly GameMenuEntryAction[];
  readonly sections: readonly GameMenuSectionDefinition[];
  readonly controlsSummary: readonly string[];
  readonly debugModes: readonly GameMenuDebugModeDefinition[];
  readonly recalibrationAction: "restart-nine-point-calibration";
  readonly audioControls: readonly AudioChannelId[];
}
