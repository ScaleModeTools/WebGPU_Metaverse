import type { GameMenuPlan } from "../types/game-menu-plan";

export const gameMenuPlan = {
  placement: "center-modal",
  entryActions: ["escape-key", "menu-button"],
  sections: [
    { id: "controls", label: "Controls" },
    { id: "calibration", label: "Calibration" },
    { id: "audio", label: "Audio" }
  ],
  controlsSummary: [
    "Aim with the thumb-gun pose",
    "Shoot by dropping the thumb relative to the index finger",
    "Reset by lifting the thumb before the next shot"
  ],
  recalibrationAction: "restart-nine-point-calibration",
  audioControls: ["music", "sfx"]
} as const satisfies GameMenuPlan;
