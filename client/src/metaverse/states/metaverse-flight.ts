import type {
  MetaverseFlightInputSnapshot,
  FocusedExperiencePortalSnapshot,
  MetaverseCameraSnapshot,
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

export function advanceMetaversePitchRadians(
  pitchRadians: number,
  pitchAxis: number,
  config: MetaverseRuntimeConfig["orientation"],
  deltaSeconds: number
): number {
  if (deltaSeconds <= 0) {
    return pitchRadians;
  }

  return clamp(
    pitchRadians +
      clamp(pitchAxis, -1, 1) *
        config.maxTurnSpeedRadiansPerSecond *
        deltaSeconds,
    config.minPitchRadians,
    config.maxPitchRadians
  );
}

export function advanceMetaverseYawRadians(
  yawRadians: number,
  yawAxis: number,
  config: MetaverseRuntimeConfig["orientation"],
  deltaSeconds: number
): number {
  if (deltaSeconds <= 0) {
    return yawRadians;
  }

  return wrapRadians(
    yawRadians +
      clamp(yawAxis, -1, 1) *
        config.maxTurnSpeedRadiansPerSecond *
        deltaSeconds
  );
}

export function rotateMetaverseCameraSnapshot(
  cameraSnapshot: MetaverseCameraSnapshot,
  yawAxis: number,
  pitchAxis: number,
  config: MetaverseRuntimeConfig["orientation"],
  deltaSeconds: number
): MetaverseCameraSnapshot {
  if (deltaSeconds <= 0) {
    return cameraSnapshot;
  }

  const yawRadians = advanceMetaverseYawRadians(
    cameraSnapshot.yawRadians,
    yawAxis,
    config,
    deltaSeconds
  );
  const pitchRadians = advanceMetaversePitchRadians(
    cameraSnapshot.pitchRadians,
    pitchAxis,
    config,
    deltaSeconds
  );
  const lookDirection = directionFromYawPitch(yawRadians, pitchRadians);

  return Object.freeze({
    lookDirection,
    pitchRadians,
    position: cameraSnapshot.position,
    yawRadians
  });
}

export function resolveMetaverseMouseLookAxes(
  pointerX: number | null,
  pointerY: number | null,
  viewportWidth: number,
  viewportHeight: number,
  config: MetaverseRuntimeConfig["orientation"]["mouseEdgeTurn"]
): Pick<MetaverseFlightInputSnapshot, "pitchAxis" | "yawAxis"> {
  if (
    pointerX === null ||
    pointerY === null ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return Object.freeze({
      pitchAxis: 0,
      yawAxis: 0
    });
  }

  const centeredX = (pointerX - 0.5) * viewportWidth;
  const centeredY = (0.5 - pointerY) * viewportHeight;
  const offsetDistance = Math.hypot(centeredX, centeredY);
  const halfMinViewportAxis =
    Math.max(1, Math.min(viewportWidth, viewportHeight)) * 0.5;
  const deadZoneRadius =
    halfMinViewportAxis * config.deadZoneViewportFraction;

  if (offsetDistance <= deadZoneRadius) {
    return Object.freeze({
      pitchAxis: 0,
      yawAxis: 0
    });
  }

  const progress = clamp(
    (offsetDistance - deadZoneRadius) /
      Math.max(1, halfMinViewportAxis - deadZoneRadius),
    0,
    1
  );
  const magnitude = Math.pow(progress, config.responseExponent);
  const directionX = centeredX / offsetDistance;
  const directionY = centeredY / offsetDistance;

  return Object.freeze({
    pitchAxis: directionY * magnitude,
    yawAxis: directionX * magnitude
  });
}

export function advanceMetaverseCameraSnapshot(
  cameraSnapshot: MetaverseCameraSnapshot,
  inputSnapshot: MetaverseFlightInputSnapshot,
  config: MetaverseRuntimeConfig,
  deltaSeconds: number
): MetaverseCameraSnapshot {
  if (deltaSeconds <= 0) {
    return cameraSnapshot;
  }

  const rotatedCameraSnapshot = rotateMetaverseCameraSnapshot(
    cameraSnapshot,
    inputSnapshot.yawAxis,
    inputSnapshot.pitchAxis,
    config.orientation,
    deltaSeconds
  );
  const forwardX = Math.sin(rotatedCameraSnapshot.yawRadians);
  const forwardZ = -Math.cos(rotatedCameraSnapshot.yawRadians);
  const moveAxis = clamp(inputSnapshot.moveAxis, -1, 1);
  const normalizedIntent = normalizeVector3(
    forwardX * moveAxis,
    0,
    forwardZ * moveAxis,
    freezeVector3(0, 0, 0)
  );
  const speed =
    config.movement.baseSpeedUnitsPerSecond *
    (inputSnapshot.boost ? config.movement.boostMultiplier : 1);
  const unclampedX =
    rotatedCameraSnapshot.position.x + normalizedIntent.x * speed * deltaSeconds;
  const unclampedY = clamp(
    rotatedCameraSnapshot.position.y,
    config.movement.minAltitude,
    config.movement.maxAltitude
  );
  const unclampedZ =
    rotatedCameraSnapshot.position.z + normalizedIntent.z * speed * deltaSeconds;
  const horizontalDistance = Math.hypot(unclampedX, unclampedZ);
  const radiusScale =
    horizontalDistance <= config.movement.worldRadius
      ? 1
      : config.movement.worldRadius / horizontalDistance;

  return Object.freeze({
    lookDirection: rotatedCameraSnapshot.lookDirection,
    pitchRadians: rotatedCameraSnapshot.pitchRadians,
    position: freezeVector3(
      unclampedX * radiusScale,
      unclampedY,
      unclampedZ * radiusScale
    ),
    yawRadians: rotatedCameraSnapshot.yawRadians
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
