import type { AudioChannelId } from "@webgpu-metaverse/shared";
import type { GameplayDebugPanelMode } from "../../game";

export const gameMenuSectionIds = [
  "controls",
  "input",
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
  readonly debugModes: readonly GameMenuDebugModeDefinition[];
  readonly mainMenuAction: "return-to-main-menu";
  readonly recalibrationAction: "restart-nine-point-calibration";
  readonly audioControls: readonly AudioChannelId[];
}
