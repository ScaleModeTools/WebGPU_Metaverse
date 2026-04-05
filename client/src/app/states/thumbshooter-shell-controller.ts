import { useEffect, useReducer, useState } from "react";

import { BrowserAudioSession } from "../../audio";
import type { GameplaySignal } from "../../game";
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
    };
  }, [handTrackingRuntime]);

  const calibrationStatus = resolveCalibrationShellState(state.profile);
  const navigationSnapshot = resolveShellNavigation({
    hasConfirmedProfile: state.hasConfirmedProfile,
    webcamPermission: state.permissionState,
    gameplayCapability: state.capabilitySnapshot.status,
    calibrationShell: calibrationStatus
  });
  const shellView = buildThumbShooterShellView({
    audioSnapshot: state.audioSnapshot,
    capabilitySnapshot: state.capabilitySnapshot,
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
  const profilePolicy = useThumbShooterShellProfilePolicy({
    audioSession,
    browserStorage,
    dispatch,
    handTrackingRuntime,
    profileStorage,
    state
  });

  return {
    capabilityStatus: state.capabilitySnapshot.status,
    handTrackingRuntime,
    hydrationSource: state.hydrationSource,
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
    onGameplaySignal: (signal: GameplaySignal) => {
      audioPolicy.onGameplaySignal(signal);
    },
    onGameplayMenuOpen: gameplayMenuPolicy.onGameplayMenuOpen,
    onLoginSubmit: entryPolicy.onLoginSubmit,
    onMusicVolumeChange: profilePolicy.onMusicVolumeChange,
    onRecalibrationRequest: profilePolicy.onRecalibrationRequest,
    onRequestPermission: entryPolicy.onRequestPermission,
    onRetryCapabilityProbe: entryPolicy.onRetryCapabilityProbe,
    onSfxVolumeChange: profilePolicy.onSfxVolumeChange
  };
}
