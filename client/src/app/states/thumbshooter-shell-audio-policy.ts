import { useEffect, useEffectEvent } from "react";
import type { Dispatch } from "react";

import type {
  AudioCueId,
  AudioTrackId,
  BrowserAudioSession
} from "../../audio";
import { audioFoundationConfig } from "../../audio";
import type { GameplaySignal } from "../../game";
import type { ShellNavigationSnapshot } from "../../navigation";

import type { ThumbShooterShellControllerAction } from "../types/thumbshooter-shell-controller";

interface ThumbShooterShellAudioPolicyDependencies {
  readonly audioSession: BrowserAudioSession;
  readonly dispatch: Dispatch<ThumbShooterShellControllerAction>;
  readonly navigationSnapshot: ShellNavigationSnapshot;
}

interface ThumbShooterShellAudioPolicy {
  readonly onGameplaySignal: (signal: GameplaySignal) => void;
}

export function resolveShellBackgroundTrack(
  activeStep: ShellNavigationSnapshot["activeStep"]
): AudioTrackId {
  return activeStep === "gameplay"
    ? audioFoundationConfig.music.gameplayTrack
    : audioFoundationConfig.music.shellTrack;
}

export function resolveGameplaySignalCue(
  signal: GameplaySignal
): AudioCueId | null {
  switch (signal.type) {
    case "enemy-hit-confirmed":
      return "enemy-hit";
    case "weapon-fired":
      return signal.weaponId === "semiautomatic-pistol"
        ? "weapon-pistol-shot"
        : null;
    case "weapon-reloaded":
      return "weapon-reload";
  }
}

export function useThumbShooterShellAudioPolicy({
  audioSession,
  dispatch,
  navigationSnapshot
}: ThumbShooterShellAudioPolicyDependencies): ThumbShooterShellAudioPolicy {
  useEffect(() => {
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.syncBackgroundTrack(
        resolveShellBackgroundTrack(navigationSnapshot.activeStep)
      )
    });
  }, [audioSession, dispatch, navigationSnapshot.activeStep]);

  const onGameplaySignal = useEffectEvent((signal: GameplaySignal) => {
    const cueId = resolveGameplaySignalCue(signal);

    if (cueId === null) {
      return;
    }

    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue(cueId)
    });
  });

  return {
    onGameplaySignal
  };
}
