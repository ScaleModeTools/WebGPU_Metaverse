export const lodTierIds = ["high", "medium", "low"] as const;

export type LodTierId = (typeof lodTierIds)[number];

export interface AssetLodDescriptor {
  readonly tier: LodTierId;
  readonly modelPath: string;
  readonly maxDistanceMeters: number | null;
}

export interface AssetLodGroup {
  readonly defaultTier: LodTierId;
  readonly lods: readonly AssetLodDescriptor[];
}
