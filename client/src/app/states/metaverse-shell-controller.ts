import { useEffect, useReducer, useState } from "react";

import { BrowserAudioSession } from "../../audio";
import type { GameplaySignal } from "../../experiences/duck-hunt";
import { resolveControllerActionMatrix } from "../../input";
import { WebGpuMetaverseCapabilityProbe } from "../../metaverse/classes/webgpu-metaverse-capability-probe";
import { LocalProfileStorage } from "../../network";
import { WebcamPermissionGateway, resolveShellNavigation } from "../../navigation";
import { HandTrackingRuntime, MouseGameplayInput } from "../../tracking";

import { metaverseAudioSessionConfig } from "../audio";
import { useMetaverseShellAudioPolicy } from "./metaverse-shell-audio-policy";
import {
  createInitialMetaverseShellControllerState,
  reduceMetaverseShellControllerState
} from "./metaverse-shell-controller-state";
import { useMetaverseShellEntryPolicy } from "./metaverse-shell-entry-policy";
import { useMetaverseShellFlowPolicy } from "./metaverse-shell-flow-policy";
import { useMetaverseShellGameplayMenuPolicy } from "./metaverse-shell-gameplay-menu-policy";
import { useMetaverseShellProfilePolicy } from "./metaverse-shell-profile-policy";
import { buildMetaverseShellView, resolveCalibrationShellState } from "./metaverse-shell-view";
import type { MetaverseShellController } from "../types/metaverse-shell-controller";

function readBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useMetaverseShellController(): MetaverseShellController {
  const [browserStorage] = useState(() => readBrowserStorage());
  const [profileStorage] = useState(() => new LocalProfileStorage());
  const [capabilityProbe] = useState(() => new WebGpuMetaverseCapabilityProbe());
  const [handTrackingRuntime] = useState(() => new HandTrackingRuntime());
  const [mouseGameplayInput] = useState(() => new MouseGameplayInput());
  const [permissionGateway] = useState(() => new WebcamPermissionGateway());
  const [audioSession] = useState(
    () => new BrowserAudioSession(metaverseAudioSessionConfig)
  );
  const [hydratedProfile] = useState(() =>
    profileStorage.loadProfile(browserStorage)
  );
  const [state, dispatch] = useReducer(
    reduceMetaverseShellControllerState,
    {
      audioSnapshot: audioSession.snapshot,
      hydratedProfile
    },
    createInitialMetaverseShellControllerState
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
    shellStage: state.shellStage
  });
  const shellView = buildMetaverseShellView({
    audioSnapshot: state.audioSnapshot,
    capabilitySnapshot: state.capabilitySnapshot,
    inputMode: state.inputMode,
    metaverseControlMode: state.metaverseControlMode,
    profile: state.profile
  });
  const controllerActionMatrix = resolveControllerActionMatrix(
    state.controllerConfiguration
  );
  const audioPolicy = useMetaverseShellAudioPolicy({
    audioSession,
    dispatch,
    navigationSnapshot
  });

  const entryPolicy = useMetaverseShellEntryPolicy({
    audioSession,
    capabilityProbe,
    dispatch,
    permissionGateway,
    state
  });
  const gameplayMenuPolicy = useMetaverseShellGameplayMenuPolicy({
    audioSession,
    dispatch,
    navigationSnapshot,
    state
  });
  const flowPolicy = useMetaverseShellFlowPolicy({
    audioSession,
    dispatch,
    state
  });
  const profilePolicy = useMetaverseShellProfilePolicy({
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
    activeExperienceId: state.activeExperienceId,
    activeMetaverseBundleId: state.activeMetaverseBundleId,
    activeMetaverseLaunchVariationId: state.activeMetaverseLaunchVariationId,
    capabilityStatus: state.capabilitySnapshot.status,
    coopRoomIdDraft: state.coopRoomIdDraft,
    controllerActionMatrix,
    controllerConfiguration: state.controllerConfiguration,
    debugPanelMode: state.debugPanelMode,
    gameplayInputSource,
    handTrackingRuntime,
    hydrationSource: state.hydrationSource,
    inputMode: state.inputMode,
    isMenuOpen: state.isMenuOpen,
    loginError: state.loginError,
    metaverseControlMode: state.metaverseControlMode,
    navigationSnapshot,
    permissionError: state.permissionError,
    permissionState: state.permissionState,
    profile: state.profile,
    sessionMode: state.sessionMode,
    shellView,
    usernameDraft: state.usernameDraft,
    setUsernameDraft: entryPolicy.setUsernameDraft,
    onBestScoreChange: profilePolicy.onBestScoreChange,
    onCalibrationProgress: profilePolicy.onCalibrationProgress,
    onCoopRoomIdDraftChange: (coopRoomIdDraft: string) => {
      dispatch({
        coopRoomIdDraft,
        type: "coopRoomIdDraftChanged"
      });
    },
    onClearProfile: profilePolicy.onClearProfile,
    onDuckHuntControllerSchemeChange:
      flowPolicy.onDuckHuntControllerSchemeChange,
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
    onEnterMetaverseRequest: flowPolicy.onEnterMetaverseRequest,
    onExperienceLaunchRequest: flowPolicy.onExperienceLaunchRequest,
    onGameplayMenuOpen: gameplayMenuPolicy.onGameplayMenuOpen,
    onGlobalControllerBindingPresetChange:
      flowPolicy.onGlobalControllerBindingPresetChange,
    onInputModeChange: flowPolicy.onInputModeChange,
    onOpenToolRequest: flowPolicy.onOpenToolRequest,
    onCloseToolRequest: flowPolicy.onCloseToolRequest,
    onRunToolPreviewRequest: flowPolicy.onRunToolPreviewRequest,
    onMetaverseControlModeChange: flowPolicy.onMetaverseControlModeChange,
    onMetaverseControllerSchemeChange:
      flowPolicy.onMetaverseControllerSchemeChange,
    onLoginSubmit: entryPolicy.onLoginSubmit,
    onMusicVolumeChange: profilePolicy.onMusicVolumeChange,
    onRecalibrationRequest: profilePolicy.onRecalibrationRequest,
    onRequestPermission: entryPolicy.onRequestPermission,
    onReturnToMetaverseRequest: flowPolicy.onReturnToMetaverseRequest,
    onRetryCapabilityProbe: entryPolicy.onRetryCapabilityProbe,
    onSessionModeChange: (sessionMode) => {
      dispatch({
        sessionMode,
        type: "sessionModeChanged"
      });
    },
    onSetupRequest: flowPolicy.onSetupRequest,
    onSfxVolumeChange: profilePolicy.onSfxVolumeChange
  };
}
