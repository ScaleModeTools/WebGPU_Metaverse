export const metaversePrimaryLocomotionModeIds = [
  "grounded",
  "swim",
  "fly"
] as const;

export const metaverseCompatibilityLocomotionModeIds = [
  ...metaversePrimaryLocomotionModeIds,
  "mounted"
] as const;

export const metaverseLocomotionModeIds =
  metaverseCompatibilityLocomotionModeIds;

export type MetaversePrimaryLocomotionModeId =
  (typeof metaversePrimaryLocomotionModeIds)[number];
export type MetaverseCompatibilityLocomotionModeId =
  (typeof metaverseCompatibilityLocomotionModeIds)[number];
export type MetaverseLocomotionModeId =
  MetaverseCompatibilityLocomotionModeId;

export interface MetaverseLocomotionModeDefinition {
  readonly controlsSummary: readonly string[];
  readonly description: string;
  readonly id: MetaverseLocomotionModeId;
  readonly label: string;
}

export function isMetaversePrimaryLocomotionMode(
  locomotionMode: MetaverseLocomotionModeId
): locomotionMode is MetaversePrimaryLocomotionModeId {
  return locomotionMode !== "mounted";
}

export function isMetaverseMountedCompatibilityLocomotionMode(
  locomotionMode: MetaverseLocomotionModeId
): locomotionMode is "mounted" {
  return locomotionMode === "mounted";
}
