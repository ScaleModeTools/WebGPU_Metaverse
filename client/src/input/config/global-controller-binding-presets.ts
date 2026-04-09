import type {
  GlobalControllerBindingPresetDefinition,
  GlobalControllerBindingPresetId
} from "../types/global-controller-binding-preset";

export const defaultGlobalControllerBindingPresetId: GlobalControllerBindingPresetId =
  "standard";

export const globalControllerBindingPresets = [
  {
    id: "standard",
    label: "Standard",
    description:
      "Primary actions stay on left click and right trigger, secondary actions stay on right click and left trigger.",
    roleByButtonBindingId: {
      "mouse-left": "primary",
      "mouse-right": "secondary",
      "mouse-auxiliary": "utility-1",
      "gamepad-right-trigger": "primary",
      "gamepad-left-trigger": "secondary",
      "gamepad-right-bumper": "utility-1"
    }
  },
  {
    id: "swap-primary-secondary",
    label: "Swap primary and secondary",
    description:
      "Flip primary and secondary button roles across mouse buttons and gamepad triggers without dropping utility bindings.",
    roleByButtonBindingId: {
      "mouse-left": "secondary",
      "mouse-right": "primary",
      "mouse-auxiliary": "utility-1",
      "gamepad-right-trigger": "secondary",
      "gamepad-left-trigger": "primary",
      "gamepad-right-bumper": "utility-1"
    }
  }
] as const satisfies readonly GlobalControllerBindingPresetDefinition[];

export function resolveGlobalControllerBindingPreset(
  presetId: GlobalControllerBindingPresetId
): GlobalControllerBindingPresetDefinition {
  return (
    globalControllerBindingPresets.find((preset) => preset.id === presetId) ??
    globalControllerBindingPresets[0]
  );
}
