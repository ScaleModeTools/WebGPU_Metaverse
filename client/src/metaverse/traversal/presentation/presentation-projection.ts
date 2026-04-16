import type { PhysicsVector3Snapshot } from "@/physics";

import { freezeVector3, toFiniteNumber } from "../policies/surface-locomotion";

export function projectTraversalPresentationPosition(
  position: PhysicsVector3Snapshot,
  linearVelocity: PhysicsVector3Snapshot,
  predictionSeconds: number
): PhysicsVector3Snapshot {
  const sanitizedPredictionSeconds = Math.max(
    0,
    toFiniteNumber(predictionSeconds, 0)
  );

  if (sanitizedPredictionSeconds <= 0) {
    return position;
  }

  return freezeVector3(
    position.x + linearVelocity.x * sanitizedPredictionSeconds,
    position.y + linearVelocity.y * sanitizedPredictionSeconds,
    position.z + linearVelocity.z * sanitizedPredictionSeconds
  );
}

export function projectGroundedTraversalPresentationPosition(
  position: PhysicsVector3Snapshot,
  linearVelocity: PhysicsVector3Snapshot,
  predictionSeconds: number,
  grounded: boolean,
  gravityUnitsPerSecond: number,
  supportHeightMeters: number | null = null
): PhysicsVector3Snapshot {
  const sanitizedPredictionSeconds = Math.max(
    0,
    toFiniteNumber(predictionSeconds, 0)
  );

  if (sanitizedPredictionSeconds <= 0) {
    return position;
  }

  const projectedX = position.x + linearVelocity.x * sanitizedPredictionSeconds;
  const projectedZ = position.z + linearVelocity.z * sanitizedPredictionSeconds;
  const gravityUnitsPerSecondSanitized = Math.max(
    0,
    toFiniteNumber(gravityUnitsPerSecond, 0)
  );
  let projectedY = grounded
    ? position.y
    : position.y +
        linearVelocity.y * sanitizedPredictionSeconds -
        0.5 *
          gravityUnitsPerSecondSanitized *
          sanitizedPredictionSeconds *
          sanitizedPredictionSeconds;

  if (
    supportHeightMeters !== null &&
    Number.isFinite(supportHeightMeters) &&
    projectedY < supportHeightMeters
  ) {
    projectedY = supportHeightMeters;
  }

  return freezeVector3(projectedX, projectedY, projectedZ);
}
