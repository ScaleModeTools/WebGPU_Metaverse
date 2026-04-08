import type { GameplayInputModeId } from "@thumbshooter/shared";
import type { NavigationStepId } from "./navigation-flow";

export const webcamPermissionStates = [
  "prompt",
  "requesting",
  "granted",
  "denied",
  "unsupported"
] as const;
export const gameplayCapabilityStates = [
  "checking",
  "supported",
  "unsupported"
] as const;
export const calibrationShellStates = ["pending", "reviewed"] as const;
export const gameplayShellStates = ["main-menu", "gameplay"] as const;

export type WebcamPermissionState = (typeof webcamPermissionStates)[number];
export type GameplayCapabilityState = (typeof gameplayCapabilityStates)[number];
export type CalibrationShellState = (typeof calibrationShellStates)[number];
export type GameplayShellState = (typeof gameplayShellStates)[number];

export interface ShellNavigationProgress {
  readonly hasConfirmedProfile: boolean;
  readonly inputMode: GameplayInputModeId;
  readonly webcamPermission: WebcamPermissionState;
  readonly gameplayCapability: GameplayCapabilityState;
  readonly calibrationShell: CalibrationShellState;
  readonly gameplayShell: GameplayShellState;
}

export interface ShellNavigationSnapshot {
  readonly activeStep: NavigationStepId;
  readonly canAdvanceFromPermissions: boolean;
  readonly canEnterGameplayShell: boolean;
  readonly isUnsupportedRoute: boolean;
}
