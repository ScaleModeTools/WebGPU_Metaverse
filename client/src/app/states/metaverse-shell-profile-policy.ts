import { startTransition, useEffect, useEffectEvent } from "react";
import type { Dispatch } from "react";

import type { PlayerProfile } from "@webgpu-metaverse/shared";

import { audioFoundationConfig } from "../../audio";
import type { LocalProfileStorage } from "../../network";
import type { HandTrackingRuntime } from "../../tracking";
import type { MetaverseAudioSession } from "../audio";

import type {
  MetaverseShellControllerAction,
  MetaverseShellControllerState
} from "../types/metaverse-shell-controller";

interface MetaverseShellProfilePolicyDependencies {
  readonly audioSession: MetaverseAudioSession;
  readonly browserStorage: Storage | null;
  readonly dispatch: Dispatch<MetaverseShellControllerAction>;
  readonly handTrackingRuntime: HandTrackingRuntime;
  readonly profileStorage: LocalProfileStorage;
  readonly state: MetaverseShellControllerState;
}

interface MetaverseShellProfilePolicy {
  readonly onBestScoreChange: (bestScore: number) => void;
  readonly onCalibrationProgress: (
    nextProfile: PlayerProfile,
    progress: "captured" | "completed"
  ) => void;
  readonly onClearProfile: () => void;
  readonly onEditProfile: () => void;
  readonly onMusicVolumeChange: (nextValue: number) => void;
  readonly onRecalibrationRequest: () => void;
  readonly onSfxVolumeChange: (nextValue: number) => void;
}

export function useMetaverseShellProfilePolicy({
  audioSession,
  browserStorage,
  dispatch,
  handTrackingRuntime,
  profileStorage,
  state
}: MetaverseShellProfilePolicyDependencies): MetaverseShellProfilePolicy {
  useEffect(() => {
    if (state.profile === null) {
      return;
    }

    profileStorage.saveProfile(
      browserStorage,
      state.profile.snapshot,
      state.inputMode
    );
  }, [browserStorage, profileStorage, state.inputMode, state.profile]);

  useEffect(() => {
    if (state.profile === null) {
      return;
    }

    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.syncMix(state.profile.snapshot.audioSettings.mix)
    });
  }, [audioSession, dispatch, state.profile]);

  const onClearProfile = useEffectEvent(() => {
    handTrackingRuntime.dispose();
    profileStorage.clearProfile(browserStorage);

    dispatch({
      type: "profileCleared",
      audioSnapshot: audioSession.syncMix(audioFoundationConfig.defaultMix)
    });
  });

  const onEditProfile = useEffectEvent(() => {
    handTrackingRuntime.dispose();

    startTransition(() => {
      dispatch({
        type: "profileEditRequested"
      });
    });
  });

  const onCalibrationProgress = useEffectEvent(
    (nextProfile: PlayerProfile, progress: "captured" | "completed") => {
      dispatch({
        type: "calibrationProgressRecorded",
        profile: nextProfile
      });
      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue(
          progress === "completed" ? "ui-confirm" : "calibration-shot"
        )
      });
    }
  );

  const onRecalibrationRequest = useEffectEvent(() => {
    startTransition(() => {
      dispatch({
        type: "calibrationResetRequested"
      });
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("calibration-shot")
    });
  });

  const onBestScoreChange = useEffectEvent((nextBestScore: number) => {
    startTransition(() => {
      dispatch({
        type: "bestScoreRaised",
        bestScore: nextBestScore
      });
    });
  });

  const onMusicVolumeChange = useEffectEvent((nextValue: number) => {
    dispatch({
      type: "musicVolumeChanged",
      sliderValue: nextValue
    });
  });

  const onSfxVolumeChange = useEffectEvent((nextValue: number) => {
    dispatch({
      type: "sfxVolumeChanged",
      sliderValue: nextValue
    });
  });

  return {
    onBestScoreChange,
    onCalibrationProgress,
    onClearProfile,
    onEditProfile,
    onMusicVolumeChange,
    onRecalibrationRequest,
    onSfxVolumeChange
  };
}
