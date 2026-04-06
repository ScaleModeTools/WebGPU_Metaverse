import type { GameMenuPlan } from "../types/game-menu-plan";

export const gameMenuPlan = {
  placement: "center-modal",
  entryActions: ["escape-key", "menu-button"],
  sections: [
    { id: "controls", label: "Controls" },
    { id: "audio", label: "Audio" },
    { id: "debug", label: "Debug" },
    { id: "calibration", label: "Calibration" }
  ],
  controlsSummary: [
    "Aim with the thumb-gun pose",
    "Shoot by dropping the thumb relative to the index finger",
    "Reset by lifting the thumb before the next shot"
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
  recalibrationAction: "restart-nine-point-calibration",
  audioControls: ["music", "sfx"]
} as const satisfies GameMenuPlan;
