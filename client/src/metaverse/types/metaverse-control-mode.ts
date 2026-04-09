export const metaverseControlModeIds = ["keyboard", "mouse"] as const;

export type MetaverseControlModeId = (typeof metaverseControlModeIds)[number];

export interface MetaverseControlModeDefinition {
  readonly id: MetaverseControlModeId;
  readonly label: string;
  readonly description: string;
  readonly controlsSummary: readonly string[];
}

export interface MetaverseFlightInputSnapshot {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly pitchAxis: number;
  readonly yawAxis: number;
}
