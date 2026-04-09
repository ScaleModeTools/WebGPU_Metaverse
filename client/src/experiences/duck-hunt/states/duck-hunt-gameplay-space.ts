import type {
  Degrees,
  NormalizedViewportPoint
} from "@webgpu-metaverse/shared";
import { createRadians } from "@webgpu-metaverse/shared";

import type {
  GameplayCameraSnapshot,
  GameplayVector3Snapshot,
  GameplayViewportSnapshot
} from "../types/duck-hunt-gameplay-runtime";
import type {
  LocalArenaSimulationConfig
} from "../types/duck-hunt-local-arena-simulation";

function freezeVector3(
  x: number,
  y: number,
  z: number
): GameplayVector3Snapshot {
  return Object.freeze({
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0
  });
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

export function wrapRadians(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let nextValue = rawValue;

  while (nextValue > Math.PI) {
    nextValue -= Math.PI * 2;
  }

  while (nextValue <= -Math.PI) {
    nextValue += Math.PI * 2;
  }

  return nextValue;
}

export function normalizeVector3(
  x: number,
  y: number,
  z: number,
  fallback: GameplayVector3Snapshot = freezeVector3(0, 0, -1)
): GameplayVector3Snapshot {
  const magnitude = Math.hypot(x, y, z);

  if (magnitude <= 0.0001) {
    return fallback;
  }

  return freezeVector3(x / magnitude, y / magnitude, z / magnitude);
}

export function directionFromYawPitch(
  yawRadians: number,
  pitchRadians: number
): GameplayVector3Snapshot {
  const horizontalScale = Math.cos(pitchRadians);

  return normalizeVector3(
    Math.sin(yawRadians) * horizontalScale,
    Math.sin(pitchRadians),
    -Math.cos(yawRadians) * horizontalScale
  );
}

export function createWorldPositionFromOrbit(
  azimuthRadians: number,
  altitude: number,
  orbitRadius: number
): GameplayVector3Snapshot {
  return freezeVector3(
    Math.sin(azimuthRadians) * orbitRadius,
    altitude,
    -Math.cos(azimuthRadians) * orbitRadius
  );
}

export function computeFlightHeadingRadians(
  angularVelocity: number,
  altitudeVelocity: number,
  orbitRadius: number
): number {
  return Math.atan2(altitudeVelocity, angularVelocity * orbitRadius);
}

export function createGameplayCameraSnapshot(
  config: LocalArenaSimulationConfig["camera"]
): GameplayCameraSnapshot {
  const lookDirection = directionFromYawPitch(
    config.initialYawRadians,
    config.initialPitchRadians
  );

  return Object.freeze({
    aimDirection: lookDirection,
    lookDirection,
    pitchRadians: config.initialPitchRadians,
    position: freezeVector3(
      config.position.x,
      config.position.y,
      config.position.z
    ),
    yawRadians: config.initialYawRadians
  });
}

function computeWorldUpDirection(
  lookDirection: GameplayVector3Snapshot,
  yawRadians: number
): GameplayVector3Snapshot {
  const rightDirection = freezeVector3(
    Math.cos(yawRadians),
    0,
    Math.sin(yawRadians)
  );

  return normalizeVector3(
    rightDirection.y * lookDirection.z - rightDirection.z * lookDirection.y,
    rightDirection.z * lookDirection.x - rightDirection.x * lookDirection.z,
    rightDirection.x * lookDirection.y - rightDirection.y * lookDirection.x,
    freezeVector3(0, 1, 0)
  );
}

export function computeAimDirectionFromViewportPoint(
  cameraSnapshot: GameplayCameraSnapshot,
  aimPoint: NormalizedViewportPoint,
  viewportSnapshot: GameplayViewportSnapshot,
  fieldOfViewDegrees: Degrees
): GameplayVector3Snapshot {
  const viewportWidth = Math.max(1, viewportSnapshot.width);
  const viewportHeight = Math.max(1, viewportSnapshot.height);
  const halfVerticalTan =
    Math.tan((Number(fieldOfViewDegrees) * Math.PI) / 360);
  const aspect = viewportWidth / viewportHeight;
  const centeredX = (aimPoint.x - 0.5) * 2;
  const centeredY = (0.5 - aimPoint.y) * 2;
  const rightDirection = freezeVector3(
    Math.cos(cameraSnapshot.yawRadians),
    0,
    Math.sin(cameraSnapshot.yawRadians)
  );
  const upDirection = computeWorldUpDirection(
    cameraSnapshot.lookDirection,
    cameraSnapshot.yawRadians
  );

  return normalizeVector3(
    cameraSnapshot.lookDirection.x +
      rightDirection.x * centeredX * halfVerticalTan * aspect +
      upDirection.x * centeredY * halfVerticalTan,
    cameraSnapshot.lookDirection.y +
      rightDirection.y * centeredX * halfVerticalTan * aspect +
      upDirection.y * centeredY * halfVerticalTan,
    cameraSnapshot.lookDirection.z +
      rightDirection.z * centeredX * halfVerticalTan * aspect +
      upDirection.z * centeredY * halfVerticalTan
  );
}

export function advanceGameplayCameraSnapshot(
  cameraSnapshot: GameplayCameraSnapshot,
  aimPoint: NormalizedViewportPoint | null,
  viewportSnapshot: GameplayViewportSnapshot,
  fieldOfViewDegrees: Degrees,
  cameraConfig: LocalArenaSimulationConfig["camera"],
  deltaSeconds: number
): GameplayCameraSnapshot {
  let yawRadians: number = cameraSnapshot.yawRadians;
  let pitchRadians: number = cameraSnapshot.pitchRadians;

  if (
    aimPoint !== null &&
    deltaSeconds > 0 &&
    viewportSnapshot.width > 0 &&
    viewportSnapshot.height > 0
  ) {
    const centeredX = (aimPoint.x - 0.5) * viewportSnapshot.width;
    const centeredY = (0.5 - aimPoint.y) * viewportSnapshot.height;
    const offsetDistance = Math.hypot(centeredX, centeredY);
    const halfMinViewportAxis =
      Math.max(1, Math.min(viewportSnapshot.width, viewportSnapshot.height)) *
      0.5;
    const deadZoneRadius =
      halfMinViewportAxis * cameraConfig.lookMotion.deadZoneViewportFraction;

    if (offsetDistance > deadZoneRadius) {
      const progress = clamp(
        (offsetDistance - deadZoneRadius) /
          Math.max(1, halfMinViewportAxis - deadZoneRadius),
        0,
        1
      );
      const turnSpeed =
        cameraConfig.lookMotion.maxSpeedRadiansPerSecond *
        Math.pow(progress, cameraConfig.lookMotion.responseExponent);
      const directionX = centeredX / offsetDistance;
      const directionY = centeredY / offsetDistance;

      yawRadians = wrapRadians(yawRadians + directionX * turnSpeed * deltaSeconds);
      pitchRadians = clamp(
        pitchRadians + directionY * turnSpeed * deltaSeconds,
        cameraConfig.lookBounds.minPitchRadians,
        cameraConfig.lookBounds.maxPitchRadians
      );
    }
  }

  const lookDirection = directionFromYawPitch(yawRadians, pitchRadians);
  const nextCameraSnapshot = Object.freeze({
    aimDirection:
      aimPoint === null
        ? lookDirection
        : computeAimDirectionFromViewportPoint(
            Object.freeze({
              ...cameraSnapshot,
              lookDirection,
              pitchRadians: createRadians(pitchRadians),
              yawRadians: createRadians(yawRadians)
            }),
            aimPoint,
            viewportSnapshot,
            fieldOfViewDegrees
          ),
    lookDirection,
    pitchRadians: createRadians(pitchRadians),
    position: cameraSnapshot.position,
    yawRadians: createRadians(yawRadians)
  });

  return nextCameraSnapshot;
}

export function createDistanceSquaredFromRay(
  origin: GameplayVector3Snapshot,
  direction: GameplayVector3Snapshot,
  point: GameplayVector3Snapshot
): {
  readonly distanceSquared: number;
  readonly rayDistance: number;
} {
  const offsetX = point.x - origin.x;
  const offsetY = point.y - origin.y;
  const offsetZ = point.z - origin.z;
  const rayDistance = offsetX * direction.x + offsetY * direction.y + offsetZ * direction.z;

  if (rayDistance <= 0) {
    return Object.freeze({
      distanceSquared: Number.POSITIVE_INFINITY,
      rayDistance
    });
  }

  const nearestX = origin.x + direction.x * rayDistance;
  const nearestY = origin.y + direction.y * rayDistance;
  const nearestZ = origin.z + direction.z * rayDistance;
  const deltaX = point.x - nearestX;
  const deltaY = point.y - nearestY;
  const deltaZ = point.z - nearestZ;

  return Object.freeze({
    distanceSquared: deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ,
    rayDistance
  });
}
