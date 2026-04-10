import type { PhysicsVector3Snapshot } from "./metaverse-grounded-body";

export interface MetaverseDynamicCuboidBodyConfig {
  readonly additionalMass: number;
  readonly angularDamping: number;
  readonly colliderCenter: PhysicsVector3Snapshot;
  readonly gravityScale: number;
  readonly halfExtents: PhysicsVector3Snapshot;
  readonly linearDamping: number;
  readonly lockRotations: boolean;
  readonly spawnPosition: PhysicsVector3Snapshot;
  readonly spawnYawRadians: number;
}

export interface MetaverseDynamicCuboidBodySnapshot {
  readonly linearVelocity: PhysicsVector3Snapshot;
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}
