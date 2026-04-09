import type {
  ButtonRoleActionMap,
  ControllerButtonRoleId,
  ControllerFamilyId,
  ControllerSchemeStatus
} from "./controller-binding";

export const duckHuntControllerSchemeIds = [
  "mouse",
  "camera-thumb-trigger",
  "gamepad-left-stick-aim",
  "gamepad-right-stick-aim"
] as const;
export const duckHuntDigitalActionIds = ["fire", "reload"] as const;
export const duckHuntAnalogInputIds = [
  "mouse-aim-2d",
  "camera-aim-2d",
  "gamepad-left-stick-aim-2d",
  "gamepad-right-stick-aim-2d"
] as const;
export const duckHuntAnalogActionIds = ["aim-axis"] as const;
export const stableDuckHuntControllerSchemeIds = [
  "mouse",
  "camera-thumb-trigger"
] as const;

export type DuckHuntControllerSchemeId =
  (typeof duckHuntControllerSchemeIds)[number];
export type DuckHuntDigitalActionId =
  (typeof duckHuntDigitalActionIds)[number];
export type DuckHuntAnalogInputId = (typeof duckHuntAnalogInputIds)[number];
export type DuckHuntAnalogActionId = (typeof duckHuntAnalogActionIds)[number];
export type StableDuckHuntControllerSchemeId =
  (typeof stableDuckHuntControllerSchemeIds)[number];

export interface DuckHuntControllerSchemeDefinition {
  readonly id: DuckHuntControllerSchemeId;
  readonly family: ControllerFamilyId;
  readonly status: ControllerSchemeStatus;
  readonly label: string;
  readonly description: string;
  readonly controlsSummary: readonly string[];
  readonly digitalActionByButtonRoleId: ButtonRoleActionMap<
    ControllerButtonRoleId,
    DuckHuntDigitalActionId
  >;
  readonly analogActionByInputId: Readonly<
    Partial<Record<DuckHuntAnalogInputId, DuckHuntAnalogActionId>>
  >;
}
