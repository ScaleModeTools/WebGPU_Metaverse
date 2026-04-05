import type { FormEvent } from "react";
import type { PlayerProfile } from "@thumbshooter/shared";

import type { AudioSessionSnapshot } from "../../audio";
import type { GameplaySignal } from "../../game";
import type { HandTrackingRuntime } from "../../game/classes/hand-tracking-runtime";
import type { WebGpuGameplayCapabilitySnapshot } from "../../game/types/webgpu-capability";
import type {
  ShellNavigationSnapshot,
  WebcamPermissionState
} from "../../navigation";
import type { StoredProfileHydrationResult } from "../../network";

import type { ThumbShooterShellViewModel } from "./thumbshooter-shell";

export interface ThumbShooterShellController {
  readonly capabilityStatus: WebGpuGameplayCapabilitySnapshot["status"];
  readonly handTrackingRuntime: HandTrackingRuntime;
  readonly hydrationSource: StoredProfileHydrationResult["source"];
  readonly isMenuOpen: boolean;
  readonly loginError: string | null;
  readonly navigationSnapshot: ShellNavigationSnapshot;
  readonly permissionError: string | null;
  readonly permissionState: WebcamPermissionState;
  readonly profile: PlayerProfile | null;
  readonly shellView: ThumbShooterShellViewModel;
  readonly usernameDraft: string;
  readonly setUsernameDraft: (value: string) => void;
  readonly onBestScoreChange: (bestScore: number) => void;
  readonly onCalibrationProgress: (
    nextProfile: PlayerProfile,
    progress: "captured" | "completed"
  ) => void;
  readonly onClearProfile: () => void;
  readonly onEditProfile: () => void;
  readonly onGameplaySignal: (signal: GameplaySignal) => void;
  readonly onGameplayMenuOpen: (open: boolean) => void;
  readonly onLoginSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onMusicVolumeChange: (nextValue: number) => void;
  readonly onRecalibrationRequest: () => void;
  readonly onRequestPermission: () => void;
  readonly onRetryCapabilityProbe: () => void;
  readonly onSfxVolumeChange: (nextValue: number) => void;
}

export interface ThumbShooterShellControllerState {
  readonly audioSnapshot: AudioSessionSnapshot;
  readonly capabilitySnapshot: WebGpuGameplayCapabilitySnapshot;
  readonly hasAutoOpenedMenu: boolean;
  readonly hasConfirmedProfile: boolean;
  readonly hydrationSource: StoredProfileHydrationResult["source"];
  readonly isMenuOpen: boolean;
  readonly loginError: string | null;
  readonly permissionError: string | null;
  readonly permissionState: WebcamPermissionState;
  readonly profile: PlayerProfile | null;
  readonly usernameDraft: string;
}

export interface ThumbShooterShellControllerInit {
  readonly audioSnapshot: AudioSessionSnapshot;
  readonly hydratedProfile: StoredProfileHydrationResult;
}

export type ThumbShooterShellControllerAction =
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
      readonly type: "gameplayExited";
    }
  | {
      readonly type: "gameplayMenuAutoOpened";
      readonly audioSnapshot: AudioSessionSnapshot;
    }
  | {
      readonly type: "gameplayMenuSetOpen";
      readonly open: boolean;
    }
  | {
      readonly type: "loginRejected";
      readonly loginError: string;
    }
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
      readonly type: "usernameDraftChanged";
      readonly usernameDraft: string;
    };
