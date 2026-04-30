import type { GameMenuPlan } from "../types/duck-hunt-game-menu-plan";

export const gameMenuPlan = {
  placement: "center-modal",
  entryActions: ["escape-key", "menu-button"],
  sections: [
    { id: "controls", label: "Controls" },
    { id: "input", label: "Input" },
    { id: "audio", label: "Audio" },
    { id: "calibration", label: "Calibration" }
  ],
  mainMenuAction: "return-to-main-menu",
  recalibrationAction: "restart-nine-point-calibration",
  audioControls: ["music", "sfx"]
} as const satisfies GameMenuPlan;
