export const navigationStepIds = [
  "login",
  "main-menu",
  "permissions",
  "calibration",
  "metaverse",
  "gameplay",
  "unsupported"
] as const;

export type NavigationStepId = (typeof navigationStepIds)[number];

export interface NavigationStep {
  readonly id: NavigationStepId;
  readonly label: string;
  readonly requiresPrevious?: readonly NavigationStepId[];
}

export interface NavigationFlow {
  readonly initialStep: NavigationStepId;
  readonly steps: readonly NavigationStep[];
}
