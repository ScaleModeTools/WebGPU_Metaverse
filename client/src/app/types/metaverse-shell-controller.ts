import type { FormEvent } from "react";
import type {
  ExperienceId,
  GameplaySessionMode,
  PlayerProfile
} from "@thumbshooter/shared";

import type { AudioSessionSnapshot } from "../../audio";
import type {
  GameplayDebugPanelMode,
  GameplayInputModeId,
  GameplayInputSource,
  GameplaySignal
} from "../../game";
import type { HandTrackingRuntime } from "../../game/classes/hand-tracking-runtime";
import type { WebGpuGameplayCapabilitySnapshot } from "../../game/types/webgpu-capability";
import type {
  ShellStageState,
  ShellNavigationSnapshot,
  WebcamPermissionState
} from "../../navigation";
import type { StoredProfileHydrationResult } from "../../network";

import type { MetaverseShellViewModel } from "./metaverse-shell";

export interface MetaverseShellController {
  readonly activeExperienceId: ExperienceId | null;
  readonly capabilityStatus: WebGpuGameplayCapabilitySnapshot["status"];
  readonly coopRoomIdDraft: string;
  readonly debugPanelMode: GameplayDebugPanelMode;
  readonly gameplayInputSource: GameplayInputSource;
  readonly handTrackingRuntime: HandTrackingRuntime;
  readonly hydrationSource: StoredProfileHydrationResult["source"];
  readonly inputMode: GameplayInputModeId;
  readonly isMenuOpen: boolean;
  readonly loginError: string | null;
  readonly navigationSnapshot: ShellNavigationSnapshot;
  readonly permissionError: string | null;
  readonly permissionState: WebcamPermissionState;
  readonly profile: PlayerProfile | null;
  readonly sessionMode: GameplaySessionMode;
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
  readonly onEditProfile: () => void;
  readonly onGameplaySignal: (signal: GameplaySignal) => void;
  readonly onGameplayDebugPanelModeChange: (
    mode: GameplayDebugPanelMode
  ) => void;
  readonly onEnterMetaverseRequest: () => void;
  readonly onExperienceLaunchRequest: (experienceId: ExperienceId) => void;
  readonly onGameplayMenuOpen: (open: boolean) => void;
  readonly onInputModeChange: (inputMode: GameplayInputModeId) => void;
  readonly onLoginSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onMusicVolumeChange: (nextValue: number) => void;
  readonly onRecalibrationRequest: () => void;
  readonly onRequestPermission: () => void;
  readonly onReturnToMetaverseRequest: () => void;
  readonly onRetryCapabilityProbe: () => void;
  readonly onSessionModeChange: (mode: GameplaySessionMode) => void;
  readonly onSetupRequest: () => void;
  readonly onSfxVolumeChange: (nextValue: number) => void;
}

export interface MetaverseShellControllerState {
  readonly activeExperienceId: ExperienceId | null;
  readonly audioSnapshot: AudioSessionSnapshot;
  readonly capabilitySnapshot: WebGpuGameplayCapabilitySnapshot;
  readonly coopRoomIdDraft: string;
  readonly debugPanelMode: GameplayDebugPanelMode;
  readonly hasConfirmedProfile: boolean;
  readonly hydrationSource: StoredProfileHydrationResult["source"];
  readonly inputMode: GameplayInputModeId;
  readonly isMenuOpen: boolean;
  readonly loginError: string | null;
  readonly permissionError: string | null;
  readonly permissionState: WebcamPermissionState;
  readonly profile: PlayerProfile | null;
  readonly sessionMode: GameplaySessionMode;
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
      readonly capabilitySnapshot: WebGpuGameplayCapabilitySnapshot;
    }
  | {
      readonly type: "coopRoomIdDraftChanged";
      readonly coopRoomIdDraft: string;
    }
  | {
      readonly type: "experienceLaunchRequested";
      readonly experienceId: ExperienceId;
    }
  | {
      readonly type: "metaverseEntryRequested";
    }
  | {
      readonly type: "sessionModeChanged";
      readonly sessionMode: GameplaySessionMode;
    }
  | {
      readonly type: "gameplayExited";
    }
  | {
      readonly mode: GameplayDebugPanelMode;
      readonly type: "gameplayDebugPanelModeChanged";
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
