import { useEffectEvent } from "react";
import type { Dispatch } from "react";
import type { ExperienceId } from "@thumbshooter/shared";

import type { GameplayInputModeId } from "../../game";
import type { MetaverseAudioSession } from "../audio";
import type {
  MetaverseShellControllerAction,
  MetaverseShellControllerState
} from "../types/metaverse-shell-controller";

interface MetaverseShellFlowPolicyDependencies {
  readonly audioSession: MetaverseAudioSession;
  readonly dispatch: Dispatch<MetaverseShellControllerAction>;
  readonly state: MetaverseShellControllerState;
}

interface MetaverseShellFlowPolicy {
  readonly onEnterMetaverseRequest: () => void;
  readonly onExperienceLaunchRequest: (experienceId: ExperienceId) => void;
  readonly onInputModeChange: (inputMode: GameplayInputModeId) => void;
  readonly onReturnToMetaverseRequest: () => void;
  readonly onSetupRequest: () => void;
}

export function useMetaverseShellFlowPolicy({
  audioSession,
  dispatch,
  state
}: MetaverseShellFlowPolicyDependencies): MetaverseShellFlowPolicy {
  const onEnterMetaverseRequest = useEffectEvent(() => {
    dispatch({
      type: "metaverseEntryRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-confirm")
    });
  });

  const onExperienceLaunchRequest = useEffectEvent((experienceId: ExperienceId) => {
    dispatch({
      experienceId,
      type: "experienceLaunchRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-confirm")
    });
  });

  const onReturnToMetaverseRequest = useEffectEvent(() => {
    dispatch({
      type: "metaverseReturnRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-menu-close")
    });
  });

  const onSetupRequest = useEffectEvent(() => {
    dispatch({
      type: "setupRequested"
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
    onEnterMetaverseRequest,
    onExperienceLaunchRequest,
    onInputModeChange,
    onReturnToMetaverseRequest,
    onSetupRequest
  };
}
