import type {
  ButtonRoleActionMap,
  ControllerButtonRoleId,
  ControllerFamilyId,
  ControllerSchemeStatus
} from "./controller-binding";

export const metaverseControllerSchemeIds = [
  "keyboard",
  "mouse",
  "gamepad"
] as const;
export const metaverseDigitalActionIds = [
  "move-forward",
  "move-backward",
  "boost"
] as const;
export const metaverseAnalogInputIds = [
  "keyboard-forward-backward",
  "keyboard-pan",
  "keyboard-tilt",
  "mouse-edge-pan",
  "mouse-edge-tilt",
  "gamepad-left-stick-x",
  "gamepad-left-stick-y",
  "gamepad-right-stick-x",
  "gamepad-right-stick-y"
] as const;
export const metaverseAnalogActionIds = [
  "move-axis",
  "pan-axis",
  "tilt-axis",
  "dolly-axis"
] as const;
export const stableMetaverseControllerSchemeIds = [
  "keyboard",
  "mouse"
] as const;

export type MetaverseControllerSchemeId =
  (typeof metaverseControllerSchemeIds)[number];
export type MetaverseDigitalActionId =
  (typeof metaverseDigitalActionIds)[number];
export type MetaverseAnalogInputId = (typeof metaverseAnalogInputIds)[number];
export type MetaverseAnalogActionId =
  (typeof metaverseAnalogActionIds)[number];
export type StableMetaverseControllerSchemeId =
  (typeof stableMetaverseControllerSchemeIds)[number];

export interface MetaverseControllerSchemeDefinition {
  readonly id: MetaverseControllerSchemeId;
  readonly family: ControllerFamilyId;
  readonly status: ControllerSchemeStatus;
  readonly label: string;
  readonly description: string;
  readonly controlsSummary: readonly string[];
  readonly digitalActionByButtonRoleId: ButtonRoleActionMap<
    ControllerButtonRoleId,
    MetaverseDigitalActionId
  >;
  readonly analogActionByInputId: Readonly<
    Partial<Record<MetaverseAnalogInputId, MetaverseAnalogActionId>>
  >;
}
