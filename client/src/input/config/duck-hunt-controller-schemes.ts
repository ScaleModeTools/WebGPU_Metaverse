import type { GameplayInputModeId } from "@webgpu-metaverse/shared";

import {
  resolveButtonActionMap,
  type ResolvedButtonActionMap
} from "../types/controller-binding";
import type { ControllerButtonBindingId } from "../types/controller-binding";
import type {
  DuckHuntControllerSchemeDefinition,
  DuckHuntControllerSchemeId,
  DuckHuntDigitalActionId
} from "../types/duck-hunt-controller-scheme";
import type { GlobalControllerBindingPresetId } from "../types/global-controller-binding-preset";
import { resolveGlobalControllerBindingPreset } from "./global-controller-binding-presets";

export const defaultDuckHuntControllerSchemeId: DuckHuntControllerSchemeId =
  "mouse";

export const duckHuntControllerSchemes = [
  {
    id: "mouse",
    family: "mouse-keyboard",
    status: "stable",
    label: "Mouse",
    description:
      "Direct cursor aim with the global primary button used for firing.",
    controlsSummary: [
      "Aim with the mouse cursor",
      "Primary button fires",
      "Release before the next shot"
    ],
    digitalActionByButtonRoleId: {
      primary: "fire"
    },
    analogActionByInputId: {
      "mouse-aim-2d": "aim-axis"
    }
  },
  {
    id: "camera-thumb-trigger",
    family: "computer-vision",
    status: "stable",
    label: "Camera thumb trigger",
    description:
      "Worker-first tracked aim with a thumb-drop trigger gesture and shared calibration.",
    controlsSummary: [
      "Aim with the tracked hand pose",
      "Drop the thumb to fire",
      "Release the thumb before the next shot"
    ],
    digitalActionByButtonRoleId: {},
    analogActionByInputId: {
      "camera-aim-2d": "aim-axis"
    }
  },
  {
    id: "gamepad-left-stick-aim",
    family: "gamepad",
    status: "planned",
    label: "Gamepad left-stick aim",
    description:
      "Planned gamepad layout with the left stick aiming, primary trigger fire, and utility button 1 reload.",
    controlsSummary: [
      "Aim with the left stick",
      "Primary button fires",
      "Utility button 1 reloads"
    ],
    digitalActionByButtonRoleId: {
      primary: "fire",
      "utility-1": "reload"
    },
    analogActionByInputId: {
      "gamepad-left-stick-aim-2d": "aim-axis"
    }
  },
  {
    id: "gamepad-right-stick-aim",
    family: "gamepad",
    status: "planned",
    label: "Gamepad right-stick aim",
    description:
      "Planned gamepad layout with the right stick aiming, primary trigger fire, and utility button 1 reload.",
    controlsSummary: [
      "Aim with the right stick",
      "Primary button fires",
      "Utility button 1 reloads"
    ],
    digitalActionByButtonRoleId: {
      primary: "fire",
      "utility-1": "reload"
    },
    analogActionByInputId: {
      "gamepad-right-stick-aim-2d": "aim-axis"
    }
  }
] as const satisfies readonly DuckHuntControllerSchemeDefinition[];

export function resolveDuckHuntControllerScheme(
  schemeId: DuckHuntControllerSchemeId
): DuckHuntControllerSchemeDefinition {
  return (
    duckHuntControllerSchemes.find((scheme) => scheme.id === schemeId) ??
    duckHuntControllerSchemes[0]
  );
}

export function isStableDuckHuntControllerSchemeId(
  schemeId: DuckHuntControllerSchemeId
): schemeId is "mouse" | "camera-thumb-trigger" {
  return schemeId === "mouse" || schemeId === "camera-thumb-trigger";
}

export function resolveDefaultDuckHuntControllerSchemeId(
  inputMode: GameplayInputModeId
): DuckHuntControllerSchemeId {
  return inputMode === "camera-thumb-trigger"
    ? "camera-thumb-trigger"
    : "mouse";
}

export function resolveDuckHuntButtonActionMap(
  globalBindingPresetId: GlobalControllerBindingPresetId,
  schemeId: DuckHuntControllerSchemeId
): ResolvedButtonActionMap<ControllerButtonBindingId, DuckHuntDigitalActionId> {
  const globalBindingPreset = resolveGlobalControllerBindingPreset(
    globalBindingPresetId
  );
  const controllerScheme = resolveDuckHuntControllerScheme(schemeId);

  return resolveButtonActionMap(
    globalBindingPreset.roleByButtonBindingId,
    controllerScheme.digitalActionByButtonRoleId
  );
}
