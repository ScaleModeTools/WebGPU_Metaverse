import {
  resolveButtonActionMap,
  type ResolvedButtonActionMap
} from "../types/controller-binding";
import type {
  MetaverseControllerSchemeDefinition,
  MetaverseControllerSchemeId,
  MetaverseDigitalActionId
} from "../types/metaverse-controller-scheme";
import type { ControllerButtonBindingId } from "../types/controller-binding";
import type { GlobalControllerBindingPresetId } from "../types/global-controller-binding-preset";
import { resolveGlobalControllerBindingPreset } from "./global-controller-binding-presets";

export const defaultMetaverseControllerSchemeId: MetaverseControllerSchemeId =
  "keyboard";

export const metaverseControllerSchemes = [
  {
    id: "keyboard",
    family: "mouse-keyboard",
    status: "stable",
    label: "Keyboard",
    description:
      "Digital fly-cam controls. W and S move, A and D pan, Q and E tilt, and Shift boosts.",
    controlsSummary: [
      "W forward, S backward",
      "A pan left, D pan right",
      "Q tilt down, E tilt up",
      "Hold Shift to boost"
    ],
    digitalActionByButtonRoleId: {},
    analogActionByInputId: {
      "keyboard-forward-backward": "move-axis",
      "keyboard-pan": "pan-axis",
      "keyboard-tilt": "tilt-axis"
    }
  },
  {
    id: "mouse",
    family: "mouse-keyboard",
    status: "stable",
    label: "Mouse",
    description:
      "Edge-based hub steering without pointer lock. Global primary and secondary buttons drive forward and backward, while edge look handles pan and tilt.",
    controlsSummary: [
      "Primary button forward, secondary button backward",
      "Move toward left and right edges to pan",
      "Move toward top and bottom edges to tilt",
      "Utility button 1 boosts"
    ],
    digitalActionByButtonRoleId: {
      primary: "move-forward",
      secondary: "move-backward",
      "utility-1": "boost"
    },
    analogActionByInputId: {
      "mouse-edge-pan": "pan-axis",
      "mouse-edge-tilt": "tilt-axis"
    }
  },
  {
    id: "gamepad",
    family: "gamepad",
    status: "planned",
    label: "Gamepad",
    description:
      "Planned hub mapping with trigger-based forward and backward, left-stick pan and forward motion, right-stick tilt and dolly, plus boost on the utility button.",
    controlsSummary: [
      "Right trigger primary action, left trigger secondary action",
      "Left stick forward/back plus pan",
      "Right stick tilt plus dolly",
      "Utility button 1 boosts"
    ],
    digitalActionByButtonRoleId: {
      primary: "move-forward",
      secondary: "move-backward",
      "utility-1": "boost"
    },
    analogActionByInputId: {
      "gamepad-left-stick-x": "pan-axis",
      "gamepad-left-stick-y": "move-axis",
      "gamepad-right-stick-x": "dolly-axis",
      "gamepad-right-stick-y": "tilt-axis"
    }
  }
] as const satisfies readonly MetaverseControllerSchemeDefinition[];

export function resolveMetaverseControllerScheme(
  schemeId: MetaverseControllerSchemeId
): MetaverseControllerSchemeDefinition {
  return (
    metaverseControllerSchemes.find((scheme) => scheme.id === schemeId) ??
    metaverseControllerSchemes[0]
  );
}

export function isStableMetaverseControllerSchemeId(
  schemeId: MetaverseControllerSchemeId
): schemeId is "keyboard" | "mouse" {
  return schemeId === "keyboard" || schemeId === "mouse";
}

export function resolveMetaverseButtonActionMap(
  globalBindingPresetId: GlobalControllerBindingPresetId,
  schemeId: MetaverseControllerSchemeId
): ResolvedButtonActionMap<ControllerButtonBindingId, MetaverseDigitalActionId> {
  const globalBindingPreset = resolveGlobalControllerBindingPreset(
    globalBindingPresetId
  );
  const controllerScheme = resolveMetaverseControllerScheme(schemeId);

  return resolveButtonActionMap(
    globalBindingPreset.roleByButtonBindingId,
    controllerScheme.digitalActionByButtonRoleId
  );
}
