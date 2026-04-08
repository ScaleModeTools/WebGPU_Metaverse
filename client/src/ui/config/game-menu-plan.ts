import type { GameMenuPlan } from "../types/game-menu-plan";

export const gameMenuPlan = {
  placement: "center-modal",
  entryActions: ["escape-key", "menu-button"],
  sections: [
    { id: "controls", label: "Controls" },
    { id: "input", label: "Input" },
    { id: "audio", label: "Audio" },
    { id: "debug", label: "Debug" },
    { id: "calibration", label: "Calibration" }
  ],
  debugModes: [
    {
      description: "Hide prototype telemetry and aim probes.",
      label: "Off",
      mode: "hidden"
    },
    {
      description: "Show sampled frame, worker, and reticle telemetry.",
      label: "Telemetry",
      mode: "telemetry"
    },
    {
      description: "Overlay raw pose and calibrated aim markers for tuning.",
      label: "Aim inspector",
      mode: "aim-inspector"
    }
  ],
  mainMenuAction: "return-to-main-menu",
  recalibrationAction: "restart-nine-point-calibration",
  audioControls: ["music", "sfx"]
} as const satisfies GameMenuPlan;
