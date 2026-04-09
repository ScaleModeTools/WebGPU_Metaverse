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
export const shellStageStates = ["main-menu", "metaverse", "gameplay"] as const;
export const metaverseEntryStepIds = [
  "permissions",
  "calibration",
  "metaverse"
] as const;

export type WebcamPermissionState = (typeof webcamPermissionStates)[number];
export type GameplayCapabilityState = (typeof gameplayCapabilityStates)[number];
export type CalibrationShellState = (typeof calibrationShellStates)[number];
export type ShellStageState = (typeof shellStageStates)[number];
export type MetaverseEntryStepId = (typeof metaverseEntryStepIds)[number];

export interface ShellNavigationProgress {
  readonly hasConfirmedProfile: boolean;
  readonly inputMode: GameplayInputModeId;
  readonly webcamPermission: WebcamPermissionState;
  readonly gameplayCapability: GameplayCapabilityState;
  readonly calibrationShell: CalibrationShellState;
  readonly shellStage: ShellStageState;
}

export interface ShellNavigationSnapshot {
  readonly activeStep: NavigationStepId;
  readonly canAdvanceFromPermissions: boolean;
  readonly canEnterMetaverse: boolean;
  readonly isUnsupportedRoute: boolean;
  readonly nextMetaverseStep: MetaverseEntryStepId | null;
}
