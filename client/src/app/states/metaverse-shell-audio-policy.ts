import { useEffect, useEffectEvent } from "react";
import type { Dispatch } from "react";

import type { GameplaySignal } from "../../game";
import type { ShellNavigationSnapshot } from "../../navigation";
import {
  metaverseShellBackgroundTrackId,
  type MetaverseAudioCueId,
  type MetaverseAudioSession,
  type MetaverseAudioTrackId
} from "../audio";
import {
  duckHuntBackgroundTrackId,
  resolveDuckHuntGameplaySignalCue
} from "../../experiences/duck-hunt/audio";

import type { MetaverseShellControllerAction } from "../types/metaverse-shell-controller";

interface MetaverseShellAudioPolicyDependencies {
  readonly audioSession: MetaverseAudioSession;
  readonly dispatch: Dispatch<MetaverseShellControllerAction>;
  readonly navigationSnapshot: ShellNavigationSnapshot;
}

interface MetaverseShellAudioPolicy {
  readonly onGameplaySignal: (signal: GameplaySignal) => void;
}

export function resolveShellBackgroundTrack(
  activeStep: ShellNavigationSnapshot["activeStep"]
): MetaverseAudioTrackId {
  return activeStep === "gameplay"
    ? duckHuntBackgroundTrackId
    : metaverseShellBackgroundTrackId;
}

export function resolveGameplaySignalCue(
  signal: GameplaySignal
): MetaverseAudioCueId | null {
  return resolveDuckHuntGameplaySignalCue(signal);
}

export function useMetaverseShellAudioPolicy({
  audioSession,
  dispatch,
  navigationSnapshot
}: MetaverseShellAudioPolicyDependencies): MetaverseShellAudioPolicy {
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
