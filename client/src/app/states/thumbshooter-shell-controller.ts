import { useEffect, useReducer, useState } from "react";

import { BrowserAudioSession } from "../../audio";
import { MouseGameplayInput, type GameplaySignal } from "../../game";
import { WebGpuGameplayCapabilityProbe } from "../../game/classes/webgpu-gameplay-capability-probe";
import { HandTrackingRuntime } from "../../game/classes/hand-tracking-runtime";
import { LocalProfileStorage } from "../../network";
import { WebcamPermissionGateway, resolveShellNavigation } from "../../navigation";

import { useThumbShooterShellAudioPolicy } from "./thumbshooter-shell-audio-policy";
import {
  createInitialThumbShooterShellControllerState,
  reduceThumbShooterShellControllerState
} from "./thumbshooter-shell-controller-state";
import { useThumbShooterShellEntryPolicy } from "./thumbshooter-shell-entry-policy";
import { useThumbShooterShellFlowPolicy } from "./thumbshooter-shell-flow-policy";
import { useThumbShooterShellGameplayMenuPolicy } from "./thumbshooter-shell-gameplay-menu-policy";
import { useThumbShooterShellProfilePolicy } from "./thumbshooter-shell-profile-policy";
import { buildThumbShooterShellView, resolveCalibrationShellState } from "./thumbshooter-shell-view";
import type { ThumbShooterShellController } from "../types/thumbshooter-shell-controller";

function readBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useThumbShooterShellController(): ThumbShooterShellController {
  const [browserStorage] = useState(() => readBrowserStorage());
  const [profileStorage] = useState(() => new LocalProfileStorage());
  const [capabilityProbe] = useState(() => new WebGpuGameplayCapabilityProbe());
  const [handTrackingRuntime] = useState(() => new HandTrackingRuntime());
  const [mouseGameplayInput] = useState(() => new MouseGameplayInput());
  const [permissionGateway] = useState(() => new WebcamPermissionGateway());
  const [audioSession] = useState(() => new BrowserAudioSession());
  const [hydratedProfile] = useState(() =>
    profileStorage.loadProfile(browserStorage)
  );
  const [state, dispatch] = useReducer(
    reduceThumbShooterShellControllerState,
    {
      audioSnapshot: audioSession.snapshot,
      hydratedProfile
    },
    createInitialThumbShooterShellControllerState
  );

  useEffect(() => {
    return () => {
      handTrackingRuntime.dispose();
      mouseGameplayInput.dispose();
    };
  }, [handTrackingRuntime, mouseGameplayInput]);

  const calibrationStatus = resolveCalibrationShellState(state.profile);
  const navigationSnapshot = resolveShellNavigation({
    inputMode: state.inputMode,
    hasConfirmedProfile: state.hasConfirmedProfile,
    webcamPermission: state.permissionState,
    gameplayCapability: state.capabilitySnapshot.status,
    calibrationShell: calibrationStatus,
    gameplayShell: state.gameplayShell
  });
  const shellView = buildThumbShooterShellView({
    audioSnapshot: state.audioSnapshot,
    capabilitySnapshot: state.capabilitySnapshot,
    inputMode: state.inputMode,
    profile: state.profile
  });
  const audioPolicy = useThumbShooterShellAudioPolicy({
    audioSession,
    dispatch,
    navigationSnapshot
  });

  const entryPolicy = useThumbShooterShellEntryPolicy({
    audioSession,
    capabilityProbe,
    dispatch,
    permissionGateway,
    state
  });
  const gameplayMenuPolicy = useThumbShooterShellGameplayMenuPolicy({
    audioSession,
    dispatch,
    navigationSnapshot,
    state
  });
  const flowPolicy = useThumbShooterShellFlowPolicy({
    audioSession,
    dispatch,
    state
  });
  const profilePolicy = useThumbShooterShellProfilePolicy({
    audioSession,
    browserStorage,
    dispatch,
    handTrackingRuntime,
    profileStorage,
    state
  });
  const gameplayInputSource =
    state.inputMode === "mouse" ? mouseGameplayInput : handTrackingRuntime;

  useEffect(() => {
    if (
      state.inputMode === "mouse" ||
      (navigationSnapshot.activeStep !== "calibration" &&
        navigationSnapshot.activeStep !== "gameplay")
    ) {
      handTrackingRuntime.dispose();
    }

    if (navigationSnapshot.activeStep !== "gameplay") {
      mouseGameplayInput.dispose();
    }
  }, [
    handTrackingRuntime,
    mouseGameplayInput,
    navigationSnapshot.activeStep,
    state.inputMode
  ]);

  return {
    capabilityStatus: state.capabilitySnapshot.status,
    debugPanelMode: state.debugPanelMode,
    gameplayInputSource,
    handTrackingRuntime,
    hydrationSource: state.hydrationSource,
    inputMode: state.inputMode,
    isMenuOpen: state.isMenuOpen,
    loginError: state.loginError,
    navigationSnapshot,
    permissionError: state.permissionError,
    permissionState: state.permissionState,
    profile: state.profile,
    shellView,
    usernameDraft: state.usernameDraft,
    setUsernameDraft: entryPolicy.setUsernameDraft,
    onBestScoreChange: profilePolicy.onBestScoreChange,
    onCalibrationProgress: profilePolicy.onCalibrationProgress,
    onClearProfile: profilePolicy.onClearProfile,
    onEditProfile: profilePolicy.onEditProfile,
    onGameplayDebugPanelModeChange: (mode) => {
      dispatch({
        mode,
        type: "gameplayDebugPanelModeChanged"
      });
    },
    onGameplaySignal: (signal: GameplaySignal) => {
      audioPolicy.onGameplaySignal(signal);
    },
    onGameplayStartRequest: flowPolicy.onGameplayStartRequest,
    onGameplayMenuOpen: gameplayMenuPolicy.onGameplayMenuOpen,
    onInputModeChange: flowPolicy.onInputModeChange,
    onLoginSubmit: entryPolicy.onLoginSubmit,
    onMainMenuRequest: flowPolicy.onMainMenuRequest,
    onMusicVolumeChange: profilePolicy.onMusicVolumeChange,
    onRecalibrationRequest: profilePolicy.onRecalibrationRequest,
    onRequestPermission: entryPolicy.onRequestPermission,
    onRetryCapabilityProbe: entryPolicy.onRetryCapabilityProbe,
    onSfxVolumeChange: profilePolicy.onSfxVolumeChange
  };
}
