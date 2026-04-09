import { defaultGameplayInputMode } from "../../game";
import type { GameplaySessionMode } from "@thumbshooter/shared";
import { AudioSettings } from "@thumbshooter/shared";

import type { WebGpuGameplayCapabilitySnapshot } from "../../game/types/webgpu-capability";
import { defaultDuckHuntCoopRoomId } from "../../experiences/duck-hunt/network";

import type {
  MetaverseShellControllerAction,
  MetaverseShellControllerInit,
  MetaverseShellControllerState
} from "../types/metaverse-shell-controller";

export const initialCapabilitySnapshot = Object.freeze({
  status: "checking",
  reason: "pending"
}) satisfies WebGpuGameplayCapabilitySnapshot;
const defaultSessionMode: GameplaySessionMode = "single-player";

function resolveNextShellStageAfterModeChange(
  state: MetaverseShellControllerState
): MetaverseShellControllerState["shellStage"] {
  return state.shellStage === "main-menu" ? "main-menu" : "metaverse";
}

function withMusicVolume(
  state: MetaverseShellControllerState,
  sliderValue: number
): MetaverseShellControllerState {
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
  state: MetaverseShellControllerState,
  sliderValue: number
): MetaverseShellControllerState {
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

export function createInitialMetaverseShellControllerState({
  audioSnapshot,
  hydratedProfile
}: MetaverseShellControllerInit): MetaverseShellControllerState {
  return {
    activeExperienceId: null,
    audioSnapshot,
    capabilitySnapshot: initialCapabilitySnapshot,
    coopRoomIdDraft: defaultDuckHuntCoopRoomId,
    debugPanelMode: "hidden",
    hasConfirmedProfile: false,
    hydrationSource: hydratedProfile.source,
    inputMode: hydratedProfile.inputMode,
    isMenuOpen: false,
    loginError: null,
    permissionError: null,
    permissionState: "prompt",
    profile: hydratedProfile.profile,
    sessionMode: defaultSessionMode,
    shellStage: "main-menu",
    usernameDraft: hydratedProfile.profile?.snapshot.username ?? ""
  };
}

export function reduceMetaverseShellControllerState(
  state: MetaverseShellControllerState,
  action: MetaverseShellControllerAction
): MetaverseShellControllerState {
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
            activeExperienceId: null,
            isMenuOpen: false
          }
        : {
            ...state,
            activeExperienceId: null,
            isMenuOpen: false,
            profile: state.profile.resetCalibration(),
            shellStage: "metaverse"
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
    case "coopRoomIdDraftChanged":
      return action.coopRoomIdDraft === state.coopRoomIdDraft
        ? state
        : {
            ...state,
            coopRoomIdDraft: action.coopRoomIdDraft
          };
    case "experienceLaunchRequested":
      return state.shellStage === "gameplay" &&
        state.activeExperienceId === action.experienceId
        ? state
        : {
            ...state,
            activeExperienceId: action.experienceId,
            debugPanelMode: "hidden",
            isMenuOpen: false,
            shellStage: "gameplay"
          };
    case "metaverseEntryRequested":
      return state.shellStage === "metaverse" && state.activeExperienceId === null
        ? state
        : {
            ...state,
            activeExperienceId: null,
            debugPanelMode: "hidden",
            isMenuOpen: false,
            shellStage: "metaverse"
          };
    case "sessionModeChanged":
      return action.sessionMode === state.sessionMode &&
        state.shellStage === "main-menu" &&
        !state.isMenuOpen
        ? state
        : {
            ...state,
            activeExperienceId: null,
            debugPanelMode: "hidden",
            isMenuOpen: false,
            sessionMode: action.sessionMode,
            shellStage: resolveNextShellStageAfterModeChange(state)
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
    case "gameplayMenuSetOpen":
      return action.open === state.isMenuOpen
        ? state
        : {
            ...state,
            isMenuOpen: action.open
          };
    case "inputModeChanged":
      return action.inputMode === state.inputMode &&
        state.shellStage === "main-menu" &&
        !state.isMenuOpen
        ? state
        : {
            ...state,
            activeExperienceId: null,
            debugPanelMode: "hidden",
            inputMode: action.inputMode,
            isMenuOpen: false,
            shellStage: resolveNextShellStageAfterModeChange(state)
          };
    case "loginRejected":
      return {
        ...state,
        loginError: action.loginError
      };
    case "metaverseReturnRequested":
      return state.shellStage === "metaverse" &&
        state.activeExperienceId === null &&
        !state.isMenuOpen
        ? state
        : {
            ...state,
            activeExperienceId: null,
            debugPanelMode: "hidden",
            isMenuOpen: false,
            shellStage: "metaverse"
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
        activeExperienceId: null,
        audioSnapshot: action.audioSnapshot,
        hasConfirmedProfile: false,
        hydrationSource: "empty",
        inputMode: defaultGameplayInputMode,
        isMenuOpen: false,
        loginError: null,
        permissionError: null,
        permissionState: "prompt",
        profile: null,
        sessionMode: defaultSessionMode,
        coopRoomIdDraft: defaultDuckHuntCoopRoomId,
        shellStage: "main-menu",
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
        activeExperienceId: null,
        debugPanelMode: "hidden",
        hasConfirmedProfile: false,
        isMenuOpen: false,
        shellStage: "main-menu"
      };
    case "sfxVolumeChanged":
      return withSfxVolume(state, action.sliderValue);
    case "setupRequested":
      return state.shellStage === "main-menu" &&
        state.activeExperienceId === null &&
        !state.isMenuOpen
        ? state
        : {
            ...state,
            activeExperienceId: null,
            debugPanelMode: "hidden",
            isMenuOpen: false,
            shellStage: "main-menu"
          };
    case "usernameDraftChanged":
      return {
        ...state,
        usernameDraft: action.usernameDraft
      };
  }
}
