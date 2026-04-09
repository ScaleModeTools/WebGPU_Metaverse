import type { GameplayInputModeId } from "@webgpu-metaverse/shared";

import type { GlobalControllerBindingPresetId } from "./global-controller-binding-preset";
import type { DuckHuntControllerSchemeId } from "./duck-hunt-controller-scheme";
import type {
  MetaverseControllerSchemeId,
  StableMetaverseControllerSchemeId
} from "./metaverse-controller-scheme";

export interface ControllerConfigurationState {
  readonly globalBindingPresetId: GlobalControllerBindingPresetId;
  readonly metaverseControllerSchemeId: MetaverseControllerSchemeId;
  readonly duckHuntControllerSchemeId: DuckHuntControllerSchemeId;
}

export type ControllerConfigurationAction =
  | {
      readonly type: "globalBindingPresetChanged";
      readonly globalBindingPresetId: GlobalControllerBindingPresetId;
    }
  | {
      readonly type: "metaverseControllerSchemeChanged";
      readonly metaverseControllerSchemeId: MetaverseControllerSchemeId;
    }
  | {
      readonly type: "duckHuntControllerSchemeChanged";
      readonly duckHuntControllerSchemeId: DuckHuntControllerSchemeId;
    }
  | {
      readonly type: "gameplayInputModeSynchronized";
      readonly gameplayInputMode: GameplayInputModeId;
    }
  | {
      readonly type: "metaverseControlModeSynchronized";
      readonly metaverseControlMode: StableMetaverseControllerSchemeId;
    };
