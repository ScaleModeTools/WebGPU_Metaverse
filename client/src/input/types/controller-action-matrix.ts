import type {
  ControllerButtonBindingId,
  ResolvedButtonActionMap
} from "./controller-binding";
import type { ControllerConfigurationState } from "./controller-configuration";
import type {
  DuckHuntAnalogActionId,
  DuckHuntAnalogInputId,
  DuckHuntControllerSchemeDefinition,
  DuckHuntDigitalActionId
} from "./duck-hunt-controller-scheme";
import type { GlobalControllerBindingPresetDefinition } from "./global-controller-binding-preset";
import type {
  MetaverseAnalogActionId,
  MetaverseAnalogInputId,
  MetaverseControllerSchemeDefinition,
  MetaverseDigitalActionId
} from "./metaverse-controller-scheme";

export interface MetaverseControllerActionMatrix {
  readonly scheme: MetaverseControllerSchemeDefinition;
  readonly buttonActionByBindingId: ResolvedButtonActionMap<
    ControllerButtonBindingId,
    MetaverseDigitalActionId
  >;
  readonly analogActionByInputId: Readonly<
    Partial<Record<MetaverseAnalogInputId, MetaverseAnalogActionId>>
  >;
}

export interface DuckHuntControllerActionMatrix {
  readonly scheme: DuckHuntControllerSchemeDefinition;
  readonly buttonActionByBindingId: ResolvedButtonActionMap<
    ControllerButtonBindingId,
    DuckHuntDigitalActionId
  >;
  readonly analogActionByInputId: Readonly<
    Partial<Record<DuckHuntAnalogInputId, DuckHuntAnalogActionId>>
  >;
}

export interface ControllerActionMatrix {
  readonly configuration: ControllerConfigurationState;
  readonly globalBindingPreset: GlobalControllerBindingPresetDefinition;
  readonly metaverse: MetaverseControllerActionMatrix;
  readonly duckHunt: DuckHuntControllerActionMatrix;
}
