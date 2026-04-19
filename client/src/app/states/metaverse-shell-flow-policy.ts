import { useEffectEvent } from "react";
import type { Dispatch } from "react";
import type {
  ExperienceId,
  GameplayInputModeId
} from "@webgpu-metaverse/shared";

import type { MetaverseAudioSession } from "../audio";
import type {
  DuckHuntControllerSchemeId,
  GlobalControllerBindingPresetId,
  MetaverseControllerSchemeId
} from "../../input";
import type { MetaverseControlModeId } from "../../metaverse";
import type { MetaverseWorldPreviewLaunchSelectionSnapshot } from "../../metaverse/world/map-bundles";
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
  readonly onDuckHuntControllerSchemeChange: (
    duckHuntControllerSchemeId: DuckHuntControllerSchemeId
  ) => void;
  readonly onCloseToolRequest: () => void;
  readonly onEnterMetaverseRequest: () => void;
  readonly onExperienceLaunchRequest: (experienceId: ExperienceId) => void;
  readonly onGlobalControllerBindingPresetChange: (
    globalBindingPresetId: GlobalControllerBindingPresetId
  ) => void;
  readonly onInputModeChange: (inputMode: GameplayInputModeId) => void;
  readonly onOpenToolRequest: () => void;
  readonly onRunToolPreviewRequest: (
    launchSelection: MetaverseWorldPreviewLaunchSelectionSnapshot
  ) => void;
  readonly onMetaverseControlModeChange: (
    controlMode: MetaverseControlModeId
  ) => void;
  readonly onMetaverseControllerSchemeChange: (
    metaverseControllerSchemeId: MetaverseControllerSchemeId
  ) => void;
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

  const onGlobalControllerBindingPresetChange = useEffectEvent(
    (globalBindingPresetId: GlobalControllerBindingPresetId) => {
      if (
        globalBindingPresetId ===
        state.controllerConfiguration.globalBindingPresetId
      ) {
        return;
      }

      dispatch({
        type: "globalBindingPresetChanged",
        globalBindingPresetId
      });
      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue("ui-confirm")
      });
    }
  );

  const onMetaverseControlModeChange = useEffectEvent(
    (controlMode: MetaverseControlModeId) => {
      if (controlMode === state.metaverseControlMode) {
        return;
      }

      dispatch({
        controlMode,
        type: "metaverseControlModeChanged"
      });

      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue("ui-confirm")
      });
    }
  );

  const onMetaverseControllerSchemeChange = useEffectEvent(
    (metaverseControllerSchemeId: MetaverseControllerSchemeId) => {
      if (
        metaverseControllerSchemeId ===
        state.controllerConfiguration.metaverseControllerSchemeId
      ) {
        return;
      }

      dispatch({
        type: "metaverseControllerSchemeChanged",
        metaverseControllerSchemeId
      });
      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue("ui-confirm")
      });
    }
  );

  const onDuckHuntControllerSchemeChange = useEffectEvent(
    (duckHuntControllerSchemeId: DuckHuntControllerSchemeId) => {
      if (
        duckHuntControllerSchemeId ===
        state.controllerConfiguration.duckHuntControllerSchemeId
      ) {
        return;
      }

      dispatch({
        type: "duckHuntControllerSchemeChanged",
        duckHuntControllerSchemeId
      });
      dispatch({
        type: "audioSnapshotChanged",
        audioSnapshot: audioSession.playCue("ui-confirm")
      });
    }
  );

  const onOpenToolRequest = useEffectEvent(() => {
    dispatch({
      type: "toolEditorRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-confirm")
    });
  });

  const onCloseToolRequest = useEffectEvent(() => {
    dispatch({
      type: "toolEditorExited"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-menu-close")
    });
  });

  const onRunToolPreviewRequest = useEffectEvent(
    (launchSelection: MetaverseWorldPreviewLaunchSelectionSnapshot) => {
    dispatch({
      launchSelection,
      type: "toolPreviewRequested"
    });
    dispatch({
      type: "audioSnapshotChanged",
      audioSnapshot: audioSession.playCue("ui-confirm")
    });
    }
  );

  return {
    onDuckHuntControllerSchemeChange,
    onCloseToolRequest,
    onEnterMetaverseRequest,
    onExperienceLaunchRequest,
    onGlobalControllerBindingPresetChange,
    onInputModeChange,
    onOpenToolRequest,
    onRunToolPreviewRequest,
    onMetaverseControlModeChange,
    onMetaverseControllerSchemeChange,
    onReturnToMetaverseRequest,
    onSetupRequest
  };
}
