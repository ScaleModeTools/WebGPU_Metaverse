import { resolveGameplayInputMode } from "@thumbshooter/shared";
import type {
  MetaverseEntryStepId,
  ShellNavigationProgress,
  ShellNavigationSnapshot
} from "../types/shell-navigation";

function resolveNextMetaverseStep(
  progress: ShellNavigationProgress
): MetaverseEntryStepId | null {
  const inputMode = resolveGameplayInputMode(progress.inputMode);

  if (progress.gameplayCapability !== "supported") {
    return null;
  }

  if (
    inputMode.requiresWebcamPermission &&
    progress.webcamPermission !== "granted"
  ) {
    return "permissions";
  }

  if (
    inputMode.requiresCalibration &&
    progress.calibrationShell !== "reviewed"
  ) {
    return "calibration";
  }

  return "metaverse";
}

export function resolveShellNavigation(
  progress: ShellNavigationProgress
): ShellNavigationSnapshot {
  if (!progress.hasConfirmedProfile) {
    return {
      activeStep: "login",
      canAdvanceFromPermissions: false,
      canEnterMetaverse: false,
      isUnsupportedRoute: false,
      nextMetaverseStep: null
    };
  }

  if (progress.gameplayCapability === "unsupported") {
    return {
      activeStep: "unsupported",
      canAdvanceFromPermissions: false,
      canEnterMetaverse: false,
      isUnsupportedRoute: true,
      nextMetaverseStep: null
    };
  }

  const nextMetaverseStep = resolveNextMetaverseStep(progress);

  if (
    progress.shellStage === "main-menu" ||
    nextMetaverseStep === null
  ) {
    return {
      activeStep: "main-menu",
      canAdvanceFromPermissions: true,
      canEnterMetaverse: nextMetaverseStep === "metaverse",
      isUnsupportedRoute: false,
      nextMetaverseStep
    };
  }

  if (progress.shellStage === "metaverse") {
    return {
      activeStep: nextMetaverseStep,
      canAdvanceFromPermissions: true,
      canEnterMetaverse: nextMetaverseStep === "metaverse",
      isUnsupportedRoute: false,
      nextMetaverseStep
    };
  }

  return {
    activeStep:
      nextMetaverseStep === "metaverse" ? "gameplay" : nextMetaverseStep,
    canAdvanceFromPermissions: true,
    canEnterMetaverse: nextMetaverseStep === "metaverse",
    isUnsupportedRoute: false,
    nextMetaverseStep
  };
}
