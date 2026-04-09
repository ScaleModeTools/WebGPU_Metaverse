import type {
  FocusedExperiencePortalSnapshot,
  MetaverseCameraSnapshot,
  MetaverseMovementInputSnapshot,
  MetaversePortalConfig,
  MetaverseRuntimeConfig,
  MetaverseVector3Snapshot
} from "../types/metaverse-runtime";

function freezeVector3(
  x: number,
  y: number,
  z: number
): MetaverseVector3Snapshot {
  return Object.freeze({
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0
  });
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function wrapRadians(rawValue: number): number {
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

function normalizeVector3(
  x: number,
  y: number,
  z: number,
  fallback: MetaverseVector3Snapshot = freezeVector3(0, 0, -1)
): MetaverseVector3Snapshot {
  const magnitude = Math.hypot(x, y, z);

  if (magnitude <= 0.0001) {
    return fallback;
  }

  return freezeVector3(x / magnitude, y / magnitude, z / magnitude);
}

export function createMetaverseCameraSnapshot(
  config: MetaverseRuntimeConfig["camera"]
): MetaverseCameraSnapshot {
  const lookDirection = directionFromYawPitch(
    config.initialYawRadians,
    config.initialPitchRadians
  );

  return Object.freeze({
    lookDirection,
    pitchRadians: config.initialPitchRadians,
    position: freezeVector3(
      config.spawnPosition.x,
      config.spawnPosition.y,
      config.spawnPosition.z
    ),
    yawRadians: config.initialYawRadians
  });
}

export function directionFromYawPitch(
  yawRadians: number,
  pitchRadians: number
): MetaverseVector3Snapshot {
  const horizontalScale = Math.cos(pitchRadians);

  return normalizeVector3(
    Math.sin(yawRadians) * horizontalScale,
    Math.sin(pitchRadians),
    -Math.cos(yawRadians) * horizontalScale
  );
}

export function rotateMetaverseCameraSnapshot(
  cameraSnapshot: MetaverseCameraSnapshot,
  movementX: number,
  movementY: number,
  config: MetaverseRuntimeConfig["movement"]
): MetaverseCameraSnapshot {
  const yawRadians = wrapRadians(
    cameraSnapshot.yawRadians - movementX * config.lookSensitivityRadiansPerPixel
  );
  const pitchRadians = clamp(
    cameraSnapshot.pitchRadians - movementY * config.lookSensitivityRadiansPerPixel,
    config.minPitchRadians,
    config.maxPitchRadians
  );
  const lookDirection = directionFromYawPitch(yawRadians, pitchRadians);

  return Object.freeze({
    lookDirection,
    pitchRadians,
    position: cameraSnapshot.position,
    yawRadians
  });
}

export function advanceMetaverseCameraSnapshot(
  cameraSnapshot: MetaverseCameraSnapshot,
  inputSnapshot: MetaverseMovementInputSnapshot,
  config: MetaverseRuntimeConfig,
  deltaSeconds: number
): MetaverseCameraSnapshot {
  if (deltaSeconds <= 0) {
    return cameraSnapshot;
  }

  const forwardX = Math.sin(cameraSnapshot.yawRadians);
  const forwardZ = -Math.cos(cameraSnapshot.yawRadians);
  const rightX = Math.cos(cameraSnapshot.yawRadians);
  const rightZ = Math.sin(cameraSnapshot.yawRadians);
  const intentX =
    (inputSnapshot.moveForward ? forwardX : 0) -
    (inputSnapshot.moveBackward ? forwardX : 0) +
    (inputSnapshot.strafeRight ? rightX : 0) -
    (inputSnapshot.strafeLeft ? rightX : 0);
  const intentY =
    (inputSnapshot.ascend ? 1 : 0) - (inputSnapshot.descend ? 1 : 0);
  const intentZ =
    (inputSnapshot.moveForward ? forwardZ : 0) -
    (inputSnapshot.moveBackward ? forwardZ : 0) +
    (inputSnapshot.strafeRight ? rightZ : 0) -
    (inputSnapshot.strafeLeft ? rightZ : 0);
  const normalizedIntent = normalizeVector3(intentX, intentY, intentZ, freezeVector3(0, 0, 0));
  const speed =
    config.movement.baseSpeedUnitsPerSecond *
    (inputSnapshot.boost ? config.movement.boostMultiplier : 1);
  const unclampedX = cameraSnapshot.position.x + normalizedIntent.x * speed * deltaSeconds;
  const unclampedY = clamp(
    cameraSnapshot.position.y + normalizedIntent.y * speed * deltaSeconds,
    config.movement.minAltitude,
    config.movement.maxAltitude
  );
  const unclampedZ = cameraSnapshot.position.z + normalizedIntent.z * speed * deltaSeconds;
  const horizontalDistance = Math.hypot(unclampedX, unclampedZ);
  const radiusScale =
    horizontalDistance <= config.movement.worldRadius
      ? 1
      : config.movement.worldRadius / horizontalDistance;

  return Object.freeze({
    lookDirection: cameraSnapshot.lookDirection,
    pitchRadians: cameraSnapshot.pitchRadians,
    position: freezeVector3(
      unclampedX * radiusScale,
      unclampedY,
      unclampedZ * radiusScale
    ),
    yawRadians: cameraSnapshot.yawRadians
  });
}

export function resolveFocusedPortalSnapshot(
  cameraSnapshot: MetaverseCameraSnapshot,
  portals: readonly MetaversePortalConfig[]
): FocusedExperiencePortalSnapshot | null {
  let nearestPortal: FocusedExperiencePortalSnapshot | null = null;

  for (const portal of portals) {
    const distanceFromCamera = Math.hypot(
      cameraSnapshot.position.x - portal.position.x,
      cameraSnapshot.position.y - portal.position.y,
      cameraSnapshot.position.z - portal.position.z
    );

    if (distanceFromCamera > portal.interactionRadius) {
      continue;
    }

    if (
      nearestPortal === null ||
      distanceFromCamera < nearestPortal.distanceFromCamera
    ) {
      nearestPortal = Object.freeze({
        distanceFromCamera,
        experienceId: portal.experienceId,
        label: portal.label
      });
    }
  }

  return nearestPortal;
}
