import { createRadians } from "@webgpu-metaverse/shared";

import type { LocalArenaSimulationConfig } from "../types/local-arena-simulation";
import type { LocalArenaEnemyRuntimeState } from "../types/local-arena-enemy-field";
import {
  clamp,
  computeFlightHeadingRadians,
  createWorldPositionFromOrbit,
  wrapRadians
} from "./gameplay-space";

function restoreEnemyGlide(enemyState: LocalArenaEnemyRuntimeState): void {
  enemyState.behaviorRemainingMs = 0;
  enemyState.angularVelocity = enemyState.homeAngularVelocity;
  enemyState.altitudeVelocity = enemyState.homeAltitudeVelocity;
  enemyState.renderState.behavior = "glide";
  enemyState.renderState.headingRadians = createRadians(
    computeFlightHeadingRadians(
      enemyState.homeAngularVelocity,
      enemyState.homeAltitudeVelocity,
      enemyState.orbitRadius
    )
  );
  enemyState.renderState.scale = enemyState.glideScale;
}

function settleEnemyDowned(enemyState: LocalArenaEnemyRuntimeState): void {
  enemyState.behaviorRemainingMs = 0;
  enemyState.downedVelocityX = 0;
  enemyState.downedVelocityY = 0;
  enemyState.downedVelocityZ = 0;
}

export function setEnemyDowned(
  enemyState: LocalArenaEnemyRuntimeState,
  config: LocalArenaSimulationConfig
): void {
  const tangentialVelocityX =
    Math.cos(enemyState.azimuthRadians) *
    enemyState.orbitRadius *
    enemyState.angularVelocity;
  const tangentialVelocityZ =
    Math.sin(enemyState.azimuthRadians) *
    enemyState.orbitRadius *
    enemyState.angularVelocity;
  const tangentialMagnitude = Math.hypot(
    tangentialVelocityX,
    tangentialVelocityZ
  );
  const driftScale =
    tangentialMagnitude <= 0.0001
      ? 0
      : config.movement.downedDriftSpeed / tangentialMagnitude;

  enemyState.behaviorRemainingMs = config.movement.downedDurationMs;
  enemyState.downedVelocityX = tangentialVelocityX * driftScale;
  enemyState.downedVelocityY = -config.movement.downedFallSpeed;
  enemyState.downedVelocityZ = tangentialVelocityZ * driftScale;
  enemyState.renderState.behavior = "downed";
  enemyState.renderState.scale = enemyState.downedScale;
}

export function stepEnemyField(
  enemyRuntimeStates: readonly LocalArenaEnemyRuntimeState[],
  config: LocalArenaSimulationConfig,
  deltaMs: number
): void {
  const deltaSeconds = deltaMs / 1000;

  if (deltaSeconds <= 0) {
    return;
  }

  for (const enemyState of enemyRuntimeStates) {
    enemyState.renderState.wingPhase += enemyState.wingSpeed * deltaSeconds;

    if (enemyState.renderState.behavior === "downed") {
      if (enemyState.behaviorRemainingMs > 0) {
        enemyState.behaviorRemainingMs = Math.max(
          0,
          enemyState.behaviorRemainingMs - deltaMs
        );
        enemyState.renderState.positionX += enemyState.downedVelocityX * deltaSeconds;
        enemyState.renderState.positionY += enemyState.downedVelocityY * deltaSeconds;
        enemyState.renderState.positionZ += enemyState.downedVelocityZ * deltaSeconds;
        enemyState.renderState.headingRadians = createRadians(
          wrapRadians(enemyState.renderState.headingRadians + deltaSeconds * 2.8)
        );

        if (enemyState.behaviorRemainingMs === 0) {
          settleEnemyDowned(enemyState);
        }
      }

      continue;
    }

    enemyState.azimuthRadians = wrapRadians(
      enemyState.azimuthRadians + enemyState.angularVelocity * deltaSeconds
    );
    enemyState.altitude += enemyState.altitudeVelocity * deltaSeconds;

    if (
      enemyState.altitude < config.birdAltitudeBounds.min ||
      enemyState.altitude > config.birdAltitudeBounds.max
    ) {
      enemyState.altitudeVelocity *= -1;
      enemyState.altitude = clamp(
        enemyState.altitude,
        config.birdAltitudeBounds.min,
        config.birdAltitudeBounds.max
      );
    }

    const worldPosition = createWorldPositionFromOrbit(
      enemyState.azimuthRadians,
      enemyState.altitude,
      enemyState.orbitRadius
    );

    enemyState.renderState.positionX = worldPosition.x;
    enemyState.renderState.positionY = worldPosition.y;
    enemyState.renderState.positionZ = worldPosition.z;
    enemyState.renderState.headingRadians = createRadians(
      computeFlightHeadingRadians(
        enemyState.angularVelocity,
        enemyState.altitudeVelocity,
        enemyState.orbitRadius
      )
    );

    if (enemyState.renderState.behavior === "scatter") {
      enemyState.behaviorRemainingMs -= deltaMs;

      if (enemyState.behaviorRemainingMs <= 0) {
        restoreEnemyGlide(enemyState);
      }
    }
  }
}
