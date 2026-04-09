import { createRadians } from "@webgpu-metaverse/shared";

import type {
  LocalArenaArenaSnapshot,
  LocalArenaEnemyRenderState,
  LocalArenaSimulationConfig
} from "../types/local-arena-simulation";
import type {
  LocalArenaEnemyRuntimeState,
  LocalArenaEnemySeed
} from "../types/local-arena-enemy-field";
import {
  computeFlightHeadingRadians,
  createWorldPositionFromOrbit
} from "./gameplay-space";

function freezeArenaSnapshot(
  liveEnemyCount: number,
  scatterEnemyCount: number,
  downedEnemyCount: number
): LocalArenaArenaSnapshot {
  return Object.freeze({
    downedEnemyCount,
    liveEnemyCount,
    scatterEnemyCount
  });
}

function createEnemyRuntimeState(
  seed: LocalArenaEnemySeed
): LocalArenaEnemyRuntimeState {
  const worldPosition = createWorldPositionFromOrbit(
    seed.spawn.azimuthRadians,
    seed.spawn.altitude,
    seed.orbitRadius
  );

  return {
    altitude: seed.spawn.altitude,
    altitudeVelocity: seed.glideVelocity.altitudeUnitsPerSecond,
    angularVelocity: seed.glideVelocity.azimuthRadiansPerSecond,
    azimuthRadians: seed.spawn.azimuthRadians,
    behaviorRemainingMs: 0,
    downedScale: seed.scale * 0.82,
    downedVelocityX: 0,
    downedVelocityY: 0,
    downedVelocityZ: 0,
    glideScale: seed.scale,
    homeAltitudeVelocity: seed.glideVelocity.altitudeUnitsPerSecond,
    homeAngularVelocity: seed.glideVelocity.azimuthRadiansPerSecond,
    orbitRadius: seed.orbitRadius,
    renderState: {
      behavior: "glide",
      headingRadians: createRadians(
        computeFlightHeadingRadians(
          seed.glideVelocity.azimuthRadiansPerSecond,
          seed.glideVelocity.altitudeUnitsPerSecond,
          seed.orbitRadius
        )
      ),
      id: seed.id,
      label: seed.label,
      positionX: worldPosition.x,
      positionY: worldPosition.y,
      positionZ: worldPosition.z,
      radius: seed.radius,
      scale: seed.scale,
      visible: true,
      wingPhase: 0
    },
    scatterScale: seed.scale * 1.08,
    wingSpeed: seed.wingSpeed
  };
}

export function createEnemyField(
  config: LocalArenaSimulationConfig
): {
  readonly enemyRenderStates: readonly LocalArenaEnemyRenderState[];
  readonly enemyRuntimeStates: LocalArenaEnemyRuntimeState[];
} {
  const enemyRuntimeStates = config.enemySeeds.map((seed) =>
    createEnemyRuntimeState(seed)
  );

  return {
    enemyRenderStates: enemyRuntimeStates.map(
      (enemyState) => enemyState.renderState
    ),
    enemyRuntimeStates
  };
}

export function summarizeEnemyField(
  enemyRuntimeStates: readonly LocalArenaEnemyRuntimeState[]
): LocalArenaArenaSnapshot {
  let liveEnemyCount = 0;
  let scatterEnemyCount = 0;
  let downedEnemyCount = 0;

  for (const enemyState of enemyRuntimeStates) {
    if (enemyState.renderState.behavior === "downed") {
      downedEnemyCount += 1;
      continue;
    }

    liveEnemyCount += 1;

    if (enemyState.renderState.behavior === "scatter") {
      scatterEnemyCount += 1;
    }
  }

  return freezeArenaSnapshot(liveEnemyCount, scatterEnemyCount, downedEnemyCount);
}

export function countDownedEnemies(
  enemyRuntimeStates: readonly LocalArenaEnemyRuntimeState[]
): number {
  let downedEnemyCount = 0;

  for (const enemyState of enemyRuntimeStates) {
    if (enemyState.renderState.behavior === "downed") {
      downedEnemyCount += 1;
    }
  }

  return downedEnemyCount;
}

export function resetEnemyField(
  enemyRuntimeStates: readonly LocalArenaEnemyRuntimeState[],
  config: LocalArenaSimulationConfig
): void {
  for (let index = 0; index < enemyRuntimeStates.length; index += 1) {
    const enemyState = enemyRuntimeStates[index]!;
    const seed = config.enemySeeds[index]!;
    const worldPosition = createWorldPositionFromOrbit(
      seed.spawn.azimuthRadians,
      seed.spawn.altitude,
      seed.orbitRadius
    );

    enemyState.altitude = seed.spawn.altitude;
    enemyState.altitudeVelocity = enemyState.homeAltitudeVelocity;
    enemyState.angularVelocity = enemyState.homeAngularVelocity;
    enemyState.azimuthRadians = seed.spawn.azimuthRadians;
    enemyState.behaviorRemainingMs = 0;
    enemyState.downedVelocityX = 0;
    enemyState.downedVelocityY = 0;
    enemyState.downedVelocityZ = 0;
    enemyState.renderState.behavior = "glide";
    enemyState.renderState.headingRadians = createRadians(
      computeFlightHeadingRadians(
        enemyState.homeAngularVelocity,
        enemyState.homeAltitudeVelocity,
        enemyState.orbitRadius
      )
    );
    enemyState.renderState.positionX = worldPosition.x;
    enemyState.renderState.positionY = worldPosition.y;
    enemyState.renderState.positionZ = worldPosition.z;
    enemyState.renderState.scale = enemyState.glideScale;
    enemyState.renderState.visible = true;
    enemyState.renderState.wingPhase = 0;
  }
}
