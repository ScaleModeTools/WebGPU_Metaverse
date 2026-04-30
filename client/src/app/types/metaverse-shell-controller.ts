import type { FormEvent } from "react";
import type {
  ExperienceId,
  GameplayInputModeId,
  MetaverseMatchModeId,
  MetaverseRoomAssignmentSnapshot,
  PlayerProfile
} from "@webgpu-metaverse/shared";

import type {
  AudioCuePlaybackOptions,
  AudioSessionSnapshot
} from "../../audio";
import type {
  GameplaySignal
} from "../../experiences/duck-hunt";
import type {
  ControllerActionMatrix,
  ControllerConfigurationState,
  DuckHuntControllerSchemeId,
  GlobalControllerBindingPresetId,
  MetaverseControllerSchemeId
} from "../../input";
import type { MetaverseControlModeId } from "../../metaverse";
import type { MetaverseCombatAudioCueId } from "../../metaverse/audio";
import type { MetaverseWorldPreviewLaunchSelectionSnapshot } from "../../metaverse/world/map-bundles";
import type { WebGpuMetaverseCapabilitySnapshot } from "../../metaverse";
import type {
  ShellStageState,
  ShellNavigationSnapshot,
  WebcamPermissionState
} from "../../navigation";
import type { StoredProfileHydrationResult } from "../../network";
import type {
  GameplayInputSource,
  HandTrackingRuntime
} from "../../tracking";

import type { MetaverseShellViewModel } from "./metaverse-shell";

export interface MetaverseShellController {
  readonly activeExperienceId: ExperienceId | null;
  readonly activeMetaverseBundleId: string;
  readonly activeMetaverseLaunchVariationId: string | null;
  readonly activeMetaverseRoomAssignment: MetaverseRoomAssignmentSnapshot | null;
  readonly capabilityStatus: WebGpuMetaverseCapabilitySnapshot["status"];
  readonly coopRoomIdDraft: string;
  readonly controllerActionMatrix: ControllerActionMatrix;
  readonly controllerConfiguration: ControllerConfigurationState;
  readonly gameplayInputSource: GameplayInputSource;
  readonly metaverseControlMode: MetaverseControlModeId;
  readonly metaverseLaunchError: string | null;
  readonly metaverseLaunchPending: boolean;
  readonly metaverseRoomIdDraft: string;
  readonly handTrackingRuntime: HandTrackingRuntime;
  readonly hydrationSource: StoredProfileHydrationResult["source"];
  readonly inputMode: GameplayInputModeId;
  readonly isMenuOpen: boolean;
  readonly loginError: string | null;
  readonly navigationSnapshot: ShellNavigationSnapshot;
  readonly permissionError: string | null;
  readonly permissionState: WebcamPermissionState;
  readonly profile: PlayerProfile | null;
  readonly matchMode: MetaverseMatchModeId;
  readonly shellView: MetaverseShellViewModel;
  readonly usernameDraft: string;
  readonly setUsernameDraft: (value: string) => void;
  readonly onBestScoreChange: (bestScore: number) => void;
  readonly onCalibrationProgress: (
    nextProfile: PlayerProfile,
    progress: "captured" | "completed"
  ) => void;
  readonly onCoopRoomIdDraftChange: (coopRoomIdDraft: string) => void;
  readonly onClearProfile: () => void;
  readonly onDuckHuntControllerSchemeChange: (
    duckHuntControllerSchemeId: DuckHuntControllerSchemeId
  ) => void;
  readonly onEditProfile: () => void;
  readonly onGameplaySignal: (signal: GameplaySignal) => void;
  readonly onMetaverseCombatAudioCue: (
    cueId: MetaverseCombatAudioCueId,
    options?: AudioCuePlaybackOptions
  ) => void;
  readonly onGlobalControllerBindingPresetChange: (
    globalBindingPresetId: GlobalControllerBindingPresetId
  ) => void;
  readonly onEnterMetaverseRequest: (
    matchMode?: MetaverseMatchModeId
  ) => void;
  readonly onExperienceLaunchRequest: (experienceId: ExperienceId) => void;
  readonly onGameplayMenuOpen: (open: boolean) => void;
  readonly onInputModeChange: (inputMode: GameplayInputModeId) => void;
  readonly onOpenToolRequest: () => void;
  readonly onOpenGamePlaylistsRequest: () => void;
  readonly onCloseToolRequest: () => void;
  readonly onRunToolPreviewRequest: (
    launchSelection: MetaverseWorldPreviewLaunchSelectionSnapshot
  ) => void;
  readonly onMetaverseControlModeChange: (
    controlMode: MetaverseControlModeId
  ) => void;
  readonly onMetaverseControllerSchemeChange: (
    metaverseControllerSchemeId: MetaverseControllerSchemeId
  ) => void;
  readonly onLoginSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onMusicVolumeChange: (nextValue: number) => void;
  readonly onRecalibrationRequest: () => void;
  readonly onRequestPermission: () => void;
  readonly onReturnToMetaverseRequest: () => void;
  readonly onRetryCapabilityProbe: () => void;
  readonly onMatchModeChange: (mode: MetaverseMatchModeId) => void;
  readonly onMetaverseRoomIdDraftChange: (metaverseRoomIdDraft: string) => void;
  readonly onSetupRequest: () => void;
  readonly onSfxVolumeChange: (nextValue: number) => void;
}

export interface MetaverseShellControllerState {
  readonly activeExperienceId: ExperienceId | null;
  readonly activeMetaverseBundleId: string;
  readonly activeMetaverseLaunchVariationId: string | null;
  readonly audioSnapshot: AudioSessionSnapshot;
  readonly capabilitySnapshot: WebGpuMetaverseCapabilitySnapshot;
  readonly coopRoomIdDraft: string;
  readonly controllerConfiguration: ControllerConfigurationState;
  readonly hasConfirmedProfile: boolean;
  readonly hydrationSource: StoredProfileHydrationResult["source"];
  readonly inputMode: GameplayInputModeId;
  readonly isMenuOpen: boolean;
  readonly loginError: string | null;
  readonly metaverseControlMode: MetaverseControlModeId;
  readonly permissionError: string | null;
  readonly permissionState: WebcamPermissionState;
  readonly profile: PlayerProfile | null;
  readonly matchMode: MetaverseMatchModeId;
  readonly shellStage: ShellStageState;
  readonly usernameDraft: string;
}

export interface MetaverseShellControllerInit {
  readonly audioSnapshot: AudioSessionSnapshot;
  readonly hydratedProfile: StoredProfileHydrationResult;
}

export type MetaverseShellControllerAction =
  | {
      readonly type: "audioSnapshotChanged";
      readonly audioSnapshot: AudioSessionSnapshot;
    }
  | {
      readonly type: "bestScoreRaised";
      readonly bestScore: number;
    }
  | {
      readonly type: "calibrationProgressRecorded";
      readonly profile: PlayerProfile;
    }
  | {
      readonly type: "calibrationResetRequested";
    }
  | {
      readonly type: "capabilityProbeStarted";
    }
  | {
      readonly type: "capabilitySnapshotReceived";
      readonly capabilitySnapshot: WebGpuMetaverseCapabilitySnapshot;
    }
  | {
      readonly type: "coopRoomIdDraftChanged";
      readonly coopRoomIdDraft: string;
    }
  | {
      readonly type: "duckHuntControllerSchemeChanged";
      readonly duckHuntControllerSchemeId: DuckHuntControllerSchemeId;
    }
  | {
      readonly type: "experienceLaunchRequested";
      readonly experienceId: ExperienceId;
    }
  | {
      readonly type: "toolEditorRequested";
    }
  | {
      readonly type: "gamePlaylistsRequested";
    }
  | {
      readonly type: "toolEditorExited";
    }
  | {
      readonly launchSelection: MetaverseWorldPreviewLaunchSelectionSnapshot;
      readonly type: "toolPreviewRequested";
    }
  | {
      readonly type: "metaverseEntryRequested";
      readonly bundleId?: string;
      readonly launchVariationId?: string | null;
      readonly matchMode?: MetaverseMatchModeId;
    }
  | {
      readonly type: "matchModeChanged";
      readonly matchMode: MetaverseMatchModeId;
    }
  | {
      readonly type: "gameplayExited";
    }
  | {
      readonly type: "globalBindingPresetChanged";
      readonly globalBindingPresetId: GlobalControllerBindingPresetId;
    }
  | {
      readonly type: "gameplayMenuSetOpen";
      readonly open: boolean;
    }
  | {
      readonly type: "inputModeChanged";
      readonly inputMode: GameplayInputModeId;
    }
  | {
      readonly controlMode: MetaverseControlModeId;
      readonly type: "metaverseControlModeChanged";
    }
  | {
      readonly metaverseControllerSchemeId: MetaverseControllerSchemeId;
      readonly type: "metaverseControllerSchemeChanged";
    }
  | {
      readonly type: "loginRejected";
      readonly loginError: string;
    }
  | { readonly type: "metaverseReturnRequested" }
  | {
      readonly type: "musicVolumeChanged";
      readonly sliderValue: number;
    }
  | {
      readonly type: "permissionRequestStarted";
    }
  | {
      readonly type: "permissionResolved";
      readonly permissionError: string | null;
      readonly permissionState: WebcamPermissionState;
    }
  | {
      readonly type: "profileCleared";
      readonly audioSnapshot: AudioSessionSnapshot;
    }
  | {
      readonly type: "profileConfirmed";
      readonly profile: PlayerProfile;
    }
  | {
      readonly type: "profileEditRequested";
    }
  | {
      readonly type: "sfxVolumeChanged";
      readonly sliderValue: number;
    }
  | {
      readonly type: "setupRequested";
    }
  | {
      readonly type: "usernameDraftChanged";
      readonly usernameDraft: string;
    };
