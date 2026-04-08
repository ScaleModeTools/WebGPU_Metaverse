export const gameplayInputModeIds = [
  "camera-thumb-shooter",
  "mouse"
] as const;

export type GameplayInputModeId = (typeof gameplayInputModeIds)[number];

export interface GameplayInputModeHudCopy {
  readonly trackingLost: string;
  readonly trackingUnavailable: string;
  readonly triggerResetRequired: string;
}

export interface GameplayInputModeDefinition {
  readonly id: GameplayInputModeId;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly controlsSummary: readonly string[];
  readonly requiresWebcamPermission: boolean;
  readonly requiresCalibration: boolean;
  readonly hudCopy: GameplayInputModeHudCopy;
}

export const defaultGameplayInputMode: GameplayInputModeId =
  "camera-thumb-shooter";

export const gameplayInputModes = [
  {
    id: "camera-thumb-shooter",
    label: "Thumb shooter",
    shortLabel: "Camera",
    description:
      "Worker-first hand tracking with webcam permission, nine-point calibration, and thumb-drop firing.",
    controlsSummary: [
      "Aim with the thumb-gun pose",
      "Shoot by dropping the thumb relative to the index finger",
      "Release the thumb before the next shot"
    ],
    requiresWebcamPermission: true,
    requiresCalibration: true,
    hudCopy: {
      trackingLost: "Tracking lost",
      trackingUnavailable: "Awaiting tracked hand",
      triggerResetRequired: "Release thumb to reset"
    }
  },
  {
    id: "mouse",
    label: "Mouse",
    shortLabel: "Mouse",
    description:
      "Direct cursor aim with click-to-fire input. Webcam permission and MediaPipe stay off in this mode.",
    controlsSummary: [
      "Aim with the mouse cursor",
      "Shoot with the left mouse button",
      "Release click before the next shot"
    ],
    requiresWebcamPermission: false,
    requiresCalibration: false,
    hudCopy: {
      trackingLost: "Cursor outside arena",
      trackingUnavailable: "Move cursor into the arena",
      triggerResetRequired: "Release click to reset"
    }
  }
] as const satisfies readonly GameplayInputModeDefinition[];

export function resolveGameplayInputMode(
  inputMode: GameplayInputModeId
): GameplayInputModeDefinition {
  return (
    gameplayInputModes.find((candidate) => candidate.id === inputMode) ??
    gameplayInputModes[0]
  );
}
