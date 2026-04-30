import {
  AudioSettings,
  type MetaverseMatchModeId,
  PlayerProfile,
  createUsername,
  defaultGameplayInputMode
} from "@webgpu-metaverse/shared";

import { defaultDuckHuntCoopRoomId } from "../../experiences/duck-hunt/network";
import {
  createInitialControllerConfigurationState,
  reduceControllerConfigurationState,
  resetControllerConfigurationState
} from "../../input";
import { defaultMetaverseControlMode } from "../../metaverse/config/metaverse-control-modes";
import {
  readMetaverseWorldBundleRegistryEntry,
  resolveDefaultMetaverseWorldBundleId
} from "../../metaverse/world/bundle-registry";
import {
  defaultMetaverseMapLaunchPlaylistSnapshot,
  resolveMetaverseMapLaunchSelection
} from "../../metaverse/world/playlists";
import type { WebGpuMetaverseCapabilitySnapshot } from "../../metaverse/types/webgpu-capability";

import type {
  MetaverseShellControllerAction,
  MetaverseShellControllerInit,
  MetaverseShellControllerState
} from "../types/metaverse-shell-controller";

export const initialCapabilitySnapshot = Object.freeze({
  status: "checking",
  reason: "pending"
}) satisfies WebGpuMetaverseCapabilitySnapshot;
const defaultMatchMode: MetaverseMatchModeId = "team-deathmatch";
const guestShellUsername = createUsername("Unknown")!;

function resolveActiveMetaverseBundleId(bundleId: string): string {
  return readMetaverseWorldBundleRegistryEntry(bundleId) === null
    ? resolveDefaultMetaverseWorldBundleId()
    : bundleId;
}

function resolveNextShellStageAfterModeChange(
  state: MetaverseShellControllerState
): MetaverseShellControllerState["shellStage"] {
  if (state.shellStage === "tool" || state.shellStage === "playlists") {
    return state.shellStage;
  }

  return state.shellStage === "main-menu" ? "main-menu" : "metaverse";
}

function resolveConfirmedShellProfile(
  state: MetaverseShellControllerState
) {
  if (state.profile !== null) {
    return state.profile;
  }

  return PlayerProfile.create({
    username: createUsername(state.usernameDraft) ?? guestShellUsername
  });
}

function resolveStandardMetaverseLaunchSelection(
  matchMode: MetaverseMatchModeId
): {
  readonly bundleId: string;
  readonly variationId: string;
} {
  const launchSelection = resolveMetaverseMapLaunchSelection(
    defaultMetaverseMapLaunchPlaylistSnapshot,
    matchMode
  );

  return Object.freeze({
    bundleId: launchSelection.bundleId,
    variationId: launchSelection.launchVariationId
  });
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
    activeMetaverseBundleId: resolveDefaultMetaverseWorldBundleId(),
    activeMetaverseLaunchVariationId: null,
    audioSnapshot,
    capabilitySnapshot: initialCapabilitySnapshot,
    coopRoomIdDraft: defaultDuckHuntCoopRoomId,
    controllerConfiguration: createInitialControllerConfigurationState({
      gameplayInputMode: hydratedProfile.inputMode,
      metaverseControlMode: defaultMetaverseControlMode
    }),
    hasConfirmedProfile: hydratedProfile.profile !== null,
    hydrationSource: hydratedProfile.source,
    inputMode: hydratedProfile.inputMode,
    isMenuOpen: false,
    loginError: null,
    metaverseControlMode: defaultMetaverseControlMode,
    permissionError: null,
    permissionState: "prompt",
    profile: hydratedProfile.profile,
    matchMode: defaultMatchMode,
    shellStage: "main-menu",
    usernameDraft: hydratedProfile.profile?.snapshot.username ?? ""
  };
}

export function reduceMetaverseShellControllerState(
  state: MetaverseShellControllerState,
  action: MetaverseShellControllerAction
): MetaverseShellControllerState {
  switch (action.type) {
    case "duckHuntControllerSchemeChanged":
    case "globalBindingPresetChanged":
    case "metaverseControllerSchemeChanged":
      return {
        ...state,
        controllerConfiguration: reduceControllerConfigurationState(
          state.controllerConfiguration,
          action
        )
      };
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
      return {
        ...state,
        activeExperienceId: null,
        hasConfirmedProfile: true,
        isMenuOpen: false,
        profile: resolveConfirmedShellProfile(state).resetCalibration(),
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
            isMenuOpen: false,
            shellStage: "gameplay"
          };
    case "toolPreviewRequested":
      return {
        ...state,
        activeExperienceId: null,
        activeMetaverseBundleId: action.launchSelection.bundleId,
        activeMetaverseLaunchVariationId: action.launchSelection.variationId,
        hasConfirmedProfile: true,
        isMenuOpen: false,
        matchMode: action.launchSelection.matchMode ?? "free-roam",
        profile: resolveConfirmedShellProfile(state),
        shellStage: "metaverse"
      };
    case "toolEditorRequested":
      return state.shellStage === "tool" && !state.isMenuOpen
        ? state
        : {
            ...state,
            activeExperienceId: null,
            isMenuOpen: false,
            shellStage: "tool"
          };
    case "gamePlaylistsRequested":
      return state.shellStage === "playlists" && !state.isMenuOpen
        ? state
        : {
            ...state,
            activeExperienceId: null,
            isMenuOpen: false,
            shellStage: "playlists"
          };
    case "toolEditorExited":
      return (
        state.shellStage === "tool" ||
        state.shellStage === "playlists"
      ) && !state.isMenuOpen
        ? {
            ...state,
            shellStage: "main-menu"
          }
        : state;
    case "metaverseEntryRequested":
      {
        const nextMatchMode = action.matchMode ?? state.matchMode;
        const standardLaunchSelection =
          resolveStandardMetaverseLaunchSelection(nextMatchMode);
        const actionLaunchSelection =
          action.bundleId === undefined
            ? null
            : Object.freeze({
                bundleId: action.bundleId,
                variationId: action.launchVariationId ?? null
              });
        const shouldUseStandardLaunchSelection =
          actionLaunchSelection !== null ||
          action.matchMode !== undefined ||
          state.shellStage === "main-menu" ||
          state.activeMetaverseLaunchVariationId === null;
        const requestedBundleId = shouldUseStandardLaunchSelection
          ? actionLaunchSelection?.bundleId ?? standardLaunchSelection.bundleId
          : state.activeMetaverseBundleId;
        const activeMetaverseBundleId =
          resolveActiveMetaverseBundleId(requestedBundleId);
        const activeMetaverseLaunchVariationId = shouldUseStandardLaunchSelection
          ? activeMetaverseBundleId ===
            (actionLaunchSelection?.bundleId ?? standardLaunchSelection.bundleId)
            ? actionLaunchSelection?.variationId ??
              standardLaunchSelection.variationId
            : null
          : activeMetaverseBundleId === state.activeMetaverseBundleId
            ? state.activeMetaverseLaunchVariationId
            : null;

        return state.shellStage === "metaverse" &&
          state.activeExperienceId === null &&
          state.activeMetaverseBundleId === activeMetaverseBundleId &&
          state.activeMetaverseLaunchVariationId ===
            activeMetaverseLaunchVariationId &&
          state.matchMode === nextMatchMode
          ? state
          : {
              ...state,
              activeExperienceId: null,
              activeMetaverseBundleId,
              activeMetaverseLaunchVariationId,
              hasConfirmedProfile: true,
              isMenuOpen: false,
              matchMode: nextMatchMode,
              profile: resolveConfirmedShellProfile(state),
              shellStage: "metaverse"
            };
      }
    case "matchModeChanged":
      return action.matchMode === state.matchMode &&
        state.shellStage === "main-menu" &&
        !state.isMenuOpen
        ? state
        : {
            ...state,
            activeExperienceId: null,
            isMenuOpen: false,
            matchMode: action.matchMode,
            shellStage: resolveNextShellStageAfterModeChange(state)
          };
    case "gameplayExited":
      return state.isMenuOpen
        ? {
            ...state,
            isMenuOpen: false
          }
        : state;
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
            controllerConfiguration: reduceControllerConfigurationState(
              state.controllerConfiguration,
              {
                type: "gameplayInputModeSynchronized",
                gameplayInputMode: action.inputMode
              }
            ),
            inputMode: action.inputMode,
            isMenuOpen: false,
            shellStage: resolveNextShellStageAfterModeChange(state)
          };
    case "metaverseControlModeChanged":
      return action.controlMode === state.metaverseControlMode
        ? state
        : {
            ...state,
            controllerConfiguration: reduceControllerConfigurationState(
              state.controllerConfiguration,
              {
                type: "metaverseControlModeSynchronized",
                metaverseControlMode: action.controlMode
              }
            ),
            metaverseControlMode: action.controlMode
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
        activeMetaverseBundleId: resolveDefaultMetaverseWorldBundleId(),
        activeMetaverseLaunchVariationId: null,
        audioSnapshot: action.audioSnapshot,
        hasConfirmedProfile: false,
        hydrationSource: "empty",
        inputMode: defaultGameplayInputMode,
        isMenuOpen: false,
        loginError: null,
        metaverseControlMode: defaultMetaverseControlMode,
        controllerConfiguration: resetControllerConfigurationState(),
        permissionError: null,
        permissionState: "prompt",
        profile: null,
        matchMode: defaultMatchMode,
        coopRoomIdDraft: defaultDuckHuntCoopRoomId,
        shellStage: "main-menu",
        usernameDraft: ""
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
