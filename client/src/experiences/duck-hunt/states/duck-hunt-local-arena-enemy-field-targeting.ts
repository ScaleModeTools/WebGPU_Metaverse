import type {
  GameplayVector3Snapshot
} from "../types/duck-hunt-gameplay-runtime";
import type {
  LocalArenaSimulationConfig
} from "../types/duck-hunt-local-arena-simulation";
import type {
  LocalArenaEnemyRuntimeState
} from "../types/duck-hunt-local-arena-enemy-field";
import {
  createDistanceSquaredFromRay,
  wrapRadians
} from "./duck-hunt-gameplay-space";

function resolveScatterDirection(value: number, fallback: number): number {
  if (Math.abs(value) > 0.0001) {
    return Math.sign(value);
  }

  if (Math.abs(fallback) > 0.0001) {
    return Math.sign(fallback);
  }

  return 1;
}

function setEnemyScatter(
  enemyState: LocalArenaEnemyRuntimeState,
  config: LocalArenaSimulationConfig,
  shotOrigin: GameplayVector3Snapshot,
  shotDirection: GameplayVector3Snapshot,
  rayDistance: number
): void {
  const shotAzimuth = Math.atan2(shotDirection.x, -shotDirection.z);
  const altitudeTarget = shotOrigin.y + shotDirection.y * Math.max(rayDistance, 0);
  const azimuthDelta = wrapRadians(enemyState.azimuthRadians - shotAzimuth);
  const altitudeDelta = enemyState.altitude - altitudeTarget;

  enemyState.behaviorRemainingMs = config.movement.scatterDurationMs;
  enemyState.angularVelocity =
    resolveScatterDirection(azimuthDelta, enemyState.homeAngularVelocity) *
    config.movement.scatterAngularSpeed;
  enemyState.altitudeVelocity =
    resolveScatterDirection(altitudeDelta, enemyState.homeAltitudeVelocity) *
    config.movement.scatterAltitudeSpeed;
  enemyState.renderState.behavior = "scatter";
  enemyState.renderState.scale = enemyState.scatterScale;
}

export function findNearestEnemyState(
  enemyRuntimeStates: readonly LocalArenaEnemyRuntimeState[],
  shotOrigin: GameplayVector3Snapshot,
  shotDirection: GameplayVector3Snapshot,
  radius: number
): LocalArenaEnemyRuntimeState | null {
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let bestEnemy: LocalArenaEnemyRuntimeState | null = null;

  for (const enemyState of enemyRuntimeStates) {
    if (enemyState.renderState.behavior === "downed") {
      continue;
    }

    const thresholdRadius = enemyState.renderState.radius + radius;
    const distanceToRay = createDistanceSquaredFromRay(
      shotOrigin,
      shotDirection,
      {
        x: enemyState.renderState.positionX,
        y: enemyState.renderState.positionY,
        z: enemyState.renderState.positionZ
      }
    );

    if (
      distanceToRay.distanceSquared <= thresholdRadius * thresholdRadius &&
      distanceToRay.distanceSquared < bestDistanceSquared
    ) {
      bestDistanceSquared = distanceToRay.distanceSquared;
      bestEnemy = enemyState;
    }
  }

  return bestEnemy;
}

export function applyReticleScatter(
  enemyRuntimeStates: readonly LocalArenaEnemyRuntimeState[],
  config: LocalArenaSimulationConfig,
  shotOrigin: GameplayVector3Snapshot,
  shotDirection: GameplayVector3Snapshot
): void {
  for (const enemyState of enemyRuntimeStates) {
    if (
      enemyState.renderState.behavior === "downed" ||
      enemyState.renderState.behavior === "scatter"
    ) {
      continue;
    }

    const thresholdRadius = enemyState.renderState.radius + config.targeting.reticleScatterRadius;
    const distanceToRay = createDistanceSquaredFromRay(
      shotOrigin,
      shotDirection,
      {
        x: enemyState.renderState.positionX,
        y: enemyState.renderState.positionY,
        z: enemyState.renderState.positionZ
      }
    );

    if (distanceToRay.distanceSquared <= thresholdRadius * thresholdRadius) {
      setEnemyScatter(
        enemyState,
        config,
        shotOrigin,
        shotDirection,
        distanceToRay.rayDistance
      );
    }
  }
}

export function scatterEnemiesFromShot(
  enemyRuntimeStates: readonly LocalArenaEnemyRuntimeState[],
  config: LocalArenaSimulationConfig,
  shotOrigin: GameplayVector3Snapshot,
  shotDirection: GameplayVector3Snapshot
): void {
  for (const enemyState of enemyRuntimeStates) {
    if (enemyState.renderState.behavior === "downed") {
      continue;
    }

    const thresholdRadius = enemyState.renderState.radius + config.targeting.shotScatterRadius;
    const distanceToRay = createDistanceSquaredFromRay(
      shotOrigin,
      shotDirection,
      {
        x: enemyState.renderState.positionX,
        y: enemyState.renderState.positionY,
        z: enemyState.renderState.positionZ
      }
    );

    if (distanceToRay.distanceSquared <= thresholdRadius * thresholdRadius) {
      setEnemyScatter(
        enemyState,
        config,
        shotOrigin,
        shotDirection,
        distanceToRay.rayDistance
      );
    }
  }
}
