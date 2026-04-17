export interface MetaverseWorldGroundedSpawnSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const metaverseWorldInitialYawRadians = Math.PI * 0.06;

export const metaverseWorldGroundedSpawnPosition = Object.freeze({
  x: -8.2,
  y: 0.6,
  z: -14.8
} satisfies MetaverseWorldGroundedSpawnSnapshot);
