import type { GameplayInputModeId } from "@webgpu-metaverse/shared";

import { defaultGlobalControllerBindingPresetId } from "../config/global-controller-binding-presets";
import {
  defaultDuckHuntControllerSchemeId,
  isStableDuckHuntControllerSchemeId,
  resolveDefaultDuckHuntControllerSchemeId
} from "../config/duck-hunt-controller-schemes";
import {
  defaultMetaverseControllerSchemeId,
  isStableMetaverseControllerSchemeId
} from "../config/metaverse-controller-schemes";
import type {
  ControllerConfigurationAction,
  ControllerConfigurationState
} from "../types/controller-configuration";
import type { StableMetaverseControllerSchemeId } from "../types/metaverse-controller-scheme";

export interface ControllerConfigurationInit {
  readonly gameplayInputMode: GameplayInputModeId;
  readonly metaverseControlMode: StableMetaverseControllerSchemeId;
}

export function createInitialControllerConfigurationState({
  gameplayInputMode,
  metaverseControlMode
}: ControllerConfigurationInit): ControllerConfigurationState {
  return {
    globalBindingPresetId: defaultGlobalControllerBindingPresetId,
    duckHuntControllerSchemeId:
      resolveDefaultDuckHuntControllerSchemeId(gameplayInputMode),
    metaverseControllerSchemeId: metaverseControlMode
  };
}

function synchronizeDuckHuntControllerScheme(
  state: ControllerConfigurationState,
  gameplayInputMode: GameplayInputModeId
): ControllerConfigurationState {
  if (!isStableDuckHuntControllerSchemeId(state.duckHuntControllerSchemeId)) {
    return state;
  }

  return {
    ...state,
    duckHuntControllerSchemeId:
      resolveDefaultDuckHuntControllerSchemeId(gameplayInputMode)
  };
}

function synchronizeMetaverseControllerScheme(
  state: ControllerConfigurationState,
  metaverseControlMode: StableMetaverseControllerSchemeId
): ControllerConfigurationState {
  if (
    !isStableMetaverseControllerSchemeId(state.metaverseControllerSchemeId)
  ) {
    return state;
  }

  return {
    ...state,
    metaverseControllerSchemeId: metaverseControlMode
  };
}

export function reduceControllerConfigurationState(
  state: ControllerConfigurationState,
  action: ControllerConfigurationAction
): ControllerConfigurationState {
  switch (action.type) {
    case "globalBindingPresetChanged":
      return action.globalBindingPresetId === state.globalBindingPresetId
        ? state
        : {
            ...state,
            globalBindingPresetId: action.globalBindingPresetId
          };
    case "metaverseControllerSchemeChanged":
      return action.metaverseControllerSchemeId === state.metaverseControllerSchemeId
        ? state
        : {
            ...state,
            metaverseControllerSchemeId: action.metaverseControllerSchemeId
          };
    case "duckHuntControllerSchemeChanged":
      return action.duckHuntControllerSchemeId === state.duckHuntControllerSchemeId
        ? state
        : {
            ...state,
            duckHuntControllerSchemeId: action.duckHuntControllerSchemeId
          };
    case "gameplayInputModeSynchronized":
      return synchronizeDuckHuntControllerScheme(
        state,
        action.gameplayInputMode
      );
    case "metaverseControlModeSynchronized":
      return synchronizeMetaverseControllerScheme(
        state,
        action.metaverseControlMode
      );
  }
}

export function resetControllerConfigurationState(): ControllerConfigurationState {
  return {
    globalBindingPresetId: defaultGlobalControllerBindingPresetId,
    duckHuntControllerSchemeId: defaultDuckHuntControllerSchemeId,
    metaverseControllerSchemeId: defaultMetaverseControllerSchemeId
  };
}
