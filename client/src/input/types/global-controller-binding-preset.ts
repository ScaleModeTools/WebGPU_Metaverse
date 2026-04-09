import type {
  ButtonRoleBindingMap,
  ControllerButtonBindingId,
  ControllerButtonRoleId
} from "./controller-binding";

export const globalControllerBindingPresetIds = [
  "standard",
  "swap-primary-secondary"
] as const;

export type GlobalControllerBindingPresetId =
  (typeof globalControllerBindingPresetIds)[number];

export interface GlobalControllerBindingPresetDefinition {
  readonly id: GlobalControllerBindingPresetId;
  readonly label: string;
  readonly description: string;
  readonly roleByButtonBindingId: ButtonRoleBindingMap<
    ControllerButtonBindingId,
    ControllerButtonRoleId
  >;
}
