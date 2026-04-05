import type {
  ShellNavigationProgress,
  ShellNavigationSnapshot
} from "../types/shell-navigation";

export function resolveShellNavigation(
  progress: ShellNavigationProgress
): ShellNavigationSnapshot {
  if (!progress.hasConfirmedProfile) {
    return {
      activeStep: "login",
      canAdvanceFromPermissions: false,
      canEnterGameplayShell: false,
      isUnsupportedRoute: false
    };
  }

  if (progress.webcamPermission !== "granted") {
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

  if (progress.gameplayCapability !== "supported") {
    return {
      activeStep: "permissions",
      canAdvanceFromPermissions: false,
      canEnterGameplayShell: false,
      isUnsupportedRoute: false
    };
  }

  if (progress.calibrationShell !== "reviewed") {
    return {
      activeStep: "calibration",
      canAdvanceFromPermissions: true,
      canEnterGameplayShell: false,
      isUnsupportedRoute: false
    };
  }

  return {
    activeStep: "gameplay",
    canAdvanceFromPermissions: true,
    canEnterGameplayShell: true,
    isUnsupportedRoute: false
  };
}
