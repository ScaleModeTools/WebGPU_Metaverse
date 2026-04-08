import { useEffectEvent } from "react";
import type { Dispatch } from "react";

import type {
  BrowserAudioSession
} from "../../audio";
import type { GameplayInputModeId } from "../../game";
import type {
  ThumbShooterShellControllerAction,
  ThumbShooterShellControllerState
} from "../types/thumbshooter-shell-controller";

interface ThumbShooterShellFlowPolicyDependencies {
  readonly audioSession: BrowserAudioSession;
  readonly dispatch: Dispatch<ThumbShooterShellControllerAction>;
  readonly state: ThumbShooterShellControllerState;
}

interface ThumbShooterShellFlowPolicy {
  readonly onGameplayStartRequest: () => void;
  readonly onInputModeChange: (inputMode: GameplayInputModeId) => void;
  readonly onMainMenuRequest: () => void;
}

export function useThumbShooterShellFlowPolicy({
  audioSession,
  dispatch,
  state
}: ThumbShooterShellFlowPolicyDependencies): ThumbShooterShellFlowPolicy {
  const onGameplayStartRequest = useEffectEvent(() => {
    dispatch({
      type: "gameplayStartRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-confirm")
    });
  });

  const onMainMenuRequest = useEffectEvent(() => {
    dispatch({
      type: "mainMenuRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-menu-close")
    });
  });

  const onInputModeChange = useEffectEvent((inputMode: GameplayInputModeId) => {
    if (inputMode === state.inputMode) {
      return;
    }

    dispatch({
      type: "inputModeChanged",
      inputMode
    });

    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-confirm")
    });
  });

  return {
    onGameplayStartRequest,
    onInputModeChange,
    onMainMenuRequest
  };
}
