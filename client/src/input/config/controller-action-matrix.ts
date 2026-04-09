import {
  resolveDuckHuntButtonActionMap,
  resolveDuckHuntControllerScheme
} from "./duck-hunt-controller-schemes";
import { resolveGlobalControllerBindingPreset } from "./global-controller-binding-presets";
import {
  resolveMetaverseButtonActionMap,
  resolveMetaverseControllerScheme
} from "./metaverse-controller-schemes";
import type { ControllerConfigurationState } from "../types/controller-configuration";
import type { ControllerActionMatrix } from "../types/controller-action-matrix";

export function resolveControllerActionMatrix(
  configuration: ControllerConfigurationState
): ControllerActionMatrix {
  const globalBindingPreset = resolveGlobalControllerBindingPreset(
    configuration.globalBindingPresetId
  );
  const metaverseScheme = resolveMetaverseControllerScheme(
    configuration.metaverseControllerSchemeId
  );
  const duckHuntScheme = resolveDuckHuntControllerScheme(
    configuration.duckHuntControllerSchemeId
  );

  return Object.freeze({
    configuration,
    globalBindingPreset,
    metaverse: Object.freeze({
      scheme: metaverseScheme,
      buttonActionByBindingId: resolveMetaverseButtonActionMap(
        configuration.globalBindingPresetId,
        configuration.metaverseControllerSchemeId
      ),
      analogActionByInputId: metaverseScheme.analogActionByInputId
    }),
    duckHunt: Object.freeze({
      scheme: duckHuntScheme,
      buttonActionByBindingId: resolveDuckHuntButtonActionMap(
        configuration.globalBindingPresetId,
        configuration.duckHuntControllerSchemeId
      ),
      analogActionByInputId: duckHuntScheme.analogActionByInputId
    })
  });
}
