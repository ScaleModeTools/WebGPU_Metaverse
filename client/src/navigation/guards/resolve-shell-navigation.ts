import { resolveGameplayInputMode } from "@thumbshooter/shared";
import type {
  ShellNavigationProgress,
  ShellNavigationSnapshot
} from "../types/shell-navigation";

export function resolveShellNavigation(
  progress: ShellNavigationProgress
): ShellNavigationSnapshot {
  const inputMode = resolveGameplayInputMode(progress.inputMode);

  if (!progress.hasConfirmedProfile) {
    return {
      activeStep: "login",
      canAdvanceFromPermissions: false,
      canEnterGameplayShell: false,
      isUnsupportedRoute: false
    };
  }

  if (
    inputMode.requiresWebcamPermission &&
    progress.webcamPermission !== "granted"
  ) {
    return {
      activeStep: "permissions",
      canAdvanceFromPermissions: false,
      canEnterGameplayShell: false,
      isUnsupportedRoute: false
    };
  }

  if (progress.gameplayCapability === "unsupported") {
    return {
      activeStep: "unsupported",
      canAdvanceFromPermissions: false,
      canEnterGameplayShell: false,
      isUnsupportedRoute: true
    };
  }

  if (
    inputMode.requiresWebcamPermission &&
    progress.gameplayCapability !== "supported"
  ) {
    return {
      activeStep: "permissions",
      canAdvanceFromPermissions: false,
      canEnterGameplayShell: false,
      isUnsupportedRoute: false
    };
  }

  if (progress.gameplayCapability !== "supported") {
    return {
      activeStep: "main-menu",
      canAdvanceFromPermissions: true,
      canEnterGameplayShell: false,
      isUnsupportedRoute: false
    };
  }

  if (
    inputMode.requiresCalibration &&
    progress.calibrationShell !== "reviewed"
  ) {
    return {
      activeStep: "calibration",
      canAdvanceFromPermissions: true,
      canEnterGameplayShell: false,
      isUnsupportedRoute: false
    };
  }

  if (progress.gameplayShell === "main-menu") {
    return {
      activeStep: "main-menu",
      canAdvanceFromPermissions: true,
      canEnterGameplayShell: progress.gameplayCapability === "supported",
      isUnsupportedRoute: false
    };
  }

  return {
    activeStep: "gameplay",
    canAdvanceFromPermissions: true,
    canEnterGameplayShell: progress.gameplayCapability === "supported",
    isUnsupportedRoute: false
  };
}
