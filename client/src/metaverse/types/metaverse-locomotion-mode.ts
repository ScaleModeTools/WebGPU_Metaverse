export const metaverseLocomotionModeIds = ["grounded", "fly"] as const;

export type MetaverseLocomotionModeId =
  (typeof metaverseLocomotionModeIds)[number];

export interface MetaverseLocomotionModeDefinition {
  readonly controlsSummary: readonly string[];
  readonly description: string;
  readonly id: MetaverseLocomotionModeId;
  readonly label: string;
}
