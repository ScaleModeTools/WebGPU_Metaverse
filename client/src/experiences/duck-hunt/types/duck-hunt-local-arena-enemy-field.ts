import type { Radians } from "@webgpu-metaverse/shared";

import type {
  LocalArenaEnemyBehaviorState,
  LocalArenaSimulationConfig
} from "./duck-hunt-local-arena-simulation";

export interface MutableEnemyRenderState {
  behavior: LocalArenaEnemyBehaviorState;
  headingRadians: Radians;
  id: string;
  label: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  radius: number;
  scale: number;
  visible: boolean;
  wingPhase: number;
}

export interface LocalArenaEnemyRuntimeState {
  readonly downedScale: number;
  readonly glideScale: number;
  readonly homeAltitudeVelocity: number;
  readonly homeAngularVelocity: number;
  readonly orbitRadius: number;
  readonly renderState: MutableEnemyRenderState;
  readonly scatterScale: number;
  readonly wingSpeed: number;
  altitude: number;
  altitudeVelocity: number;
  angularVelocity: number;
  azimuthRadians: number;
  behaviorRemainingMs: number;
  downedVelocityX: number;
  downedVelocityY: number;
  downedVelocityZ: number;
}

export type LocalArenaEnemySeed =
  LocalArenaSimulationConfig["enemySeeds"][number];
