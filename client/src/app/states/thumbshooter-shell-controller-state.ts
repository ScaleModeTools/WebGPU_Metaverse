import { AudioSettings } from "@thumbshooter/shared";

import type { WebGpuGameplayCapabilitySnapshot } from "../../game/types/webgpu-capability";

import type {
  ThumbShooterShellControllerAction,
  ThumbShooterShellControllerInit,
  ThumbShooterShellControllerState
} from "../types/thumbshooter-shell-controller";

export const initialCapabilitySnapshot = Object.freeze({
  status: "checking",
  reason: "pending"
}) satisfies WebGpuGameplayCapabilitySnapshot;

function withMusicVolume(
  state: ThumbShooterShellControllerState,
  sliderValue: number
): ThumbShooterShellControllerState {
  if (state.profile === null) {
    return state;
  }

  return {
    ...state,
    profile: state.profile.withAudioSettings(
      AudioSettings.fromSnapshot(state.profile.snapshot.audioSettings)
        .withMusicVolume(sliderValue / 100)
        .snapshot
    )
  };
}

function withSfxVolume(
  state: ThumbShooterShellControllerState,
  sliderValue: number
): ThumbShooterShellControllerState {
  if (state.profile === null) {
    return state;
  }

  return {
    ...state,
    profile: state.profile.withAudioSettings(
      AudioSettings.fromSnapshot(state.profile.snapshot.audioSettings)
        .withSfxVolume(sliderValue / 100)
        .snapshot
    )
  };
}

export function createInitialThumbShooterShellControllerState({
  audioSnapshot,
  hydratedProfile
}: ThumbShooterShellControllerInit): ThumbShooterShellControllerState {
  return {
    audioSnapshot,
    capabilitySnapshot: initialCapabilitySnapshot,
    debugPanelMode: "hidden",
    hasAutoOpenedMenu: false,
    hasConfirmedProfile: false,
    hydrationSource: hydratedProfile.source,
    isMenuOpen: false,
    loginError: null,
    permissionError: null,
    permissionState: "prompt",
    profile: hydratedProfile.profile,
    usernameDraft: hydratedProfile.profile?.snapshot.username ?? ""
  };
}

export function reduceThumbShooterShellControllerState(
  state: ThumbShooterShellControllerState,
  action: ThumbShooterShellControllerAction
): ThumbShooterShellControllerState {
  switch (action.type) {
    case "audioSnapshotChanged":
      return {
        ...state,
        audioSnapshot: action.audioSnapshot
      };
    case "bestScoreRaised":
      return state.profile === null
        ? state
        : {
            ...state,
            profile: state.profile.withRaisedBestScore(action.bestScore)
          };
    case "calibrationProgressRecorded":
      return {
        ...state,
        profile: action.profile
      };
    case "calibrationResetRequested":
      return state.profile === null
        ? {
            ...state,
            isMenuOpen: false
          }
        : {
            ...state,
            isMenuOpen: false,
            profile: state.profile.resetCalibration()
          };
    case "capabilityProbeStarted":
      return {
        ...state,
        capabilitySnapshot: initialCapabilitySnapshot
      };
    case "capabilitySnapshotReceived":
      return {
        ...state,
        capabilitySnapshot: action.capabilitySnapshot
      };
    case "gameplayExited":
      return state.isMenuOpen
        ? {
            ...state,
            isMenuOpen: false
          }
        : state;
    case "gameplayDebugPanelModeChanged":
      return action.mode === state.debugPanelMode
        ? state
        : {
            ...state,
            debugPanelMode: action.mode
          };
    case "gameplayMenuAutoOpened":
      return {
        ...state,
        audioSnapshot: action.audioSnapshot,
        hasAutoOpenedMenu: true,
        isMenuOpen: true
      };
    case "gameplayMenuSetOpen":
      return action.open === state.isMenuOpen
        ? state
        : {
            ...state,
            isMenuOpen: action.open
          };
    case "loginRejected":
      return {
        ...state,
        loginError: action.loginError
      };
    case "musicVolumeChanged":
      return withMusicVolume(state, action.sliderValue);
    case "permissionRequestStarted":
      return {
        ...state,
        permissionError: null,
        permissionState: "requesting"
      };
    case "permissionResolved":
      return {
        ...state,
        permissionError: action.permissionError,
        permissionState: action.permissionState
      };
    case "profileCleared":
      return {
        ...state,
        audioSnapshot: action.audioSnapshot,
        hasAutoOpenedMenu: false,
        hasConfirmedProfile: false,
        hydrationSource: "empty",
        isMenuOpen: false,
        loginError: null,
        permissionError: null,
        permissionState: "prompt",
        profile: null,
        usernameDraft: "",
        debugPanelMode: "hidden"
      };
    case "profileConfirmed":
      return {
        ...state,
        hasConfirmedProfile: true,
        hydrationSource: "profile-record",
        loginError: null,
        profile: action.profile
      };
    case "profileEditRequested":
      return {
        ...state,
        debugPanelMode: "hidden",
        hasConfirmedProfile: false,
        isMenuOpen: false
      };
    case "sfxVolumeChanged":
      return withSfxVolume(state, action.sliderValue);
    case "usernameDraftChanged":
      return {
        ...state,
        usernameDraft: action.usernameDraft
      };
  }
}
