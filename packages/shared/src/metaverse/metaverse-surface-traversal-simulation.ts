import type { MetaverseWorldSurfaceVector3Snapshot } from "./metaverse-world-surface-query.js";

export interface MetaverseSurfaceTraversalConfig {
  readonly accelerationCurveExponent: number;
  readonly accelerationUnitsPerSecondSquared: number;
  readonly baseSpeedUnitsPerSecond: number;
  readonly boostCurveExponent: number;
  readonly boostMultiplier: number;
  readonly decelerationUnitsPerSecondSquared: number;
  readonly dragCurveExponent: number;
  readonly maxTurnSpeedRadiansPerSecond: number;
}

export interface MetaverseSurfaceTraversalInputSnapshot {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly yawAxis: number;
}

export interface MetaverseSurfaceTraversalSpeedSnapshot {
  readonly forwardSpeedUnitsPerSecond: number;
  readonly strafeSpeedUnitsPerSecond: number;
}

export interface MetaverseSurfaceTraversalDriveTargetSnapshot {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly movementMagnitude: number;
  readonly strafeAxis: number;
  readonly targetForwardSpeedUnitsPerSecond: number;
  readonly targetPlanarSpeedUnitsPerSecond: number;
  readonly targetStrafeSpeedUnitsPerSecond: number;
}

export interface MetaverseSurfaceTraversalSnapshot {
  readonly planarSpeedUnitsPerSecond: number;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseSurfaceTraversalMotionSnapshot {
  readonly driveTarget: MetaverseSurfaceTraversalDriveTargetSnapshot;
  readonly forwardSpeedUnitsPerSecond: number;
  readonly strafeSpeedUnitsPerSecond: number;
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly yawRadians: number;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function approach(current: number, target: number, maxDelta: number): number {
  if (maxDelta <= 0) {
    return current;
  }

  const delta = target - current;

  if (Math.abs(delta) <= maxDelta) {
    return target;
  }

  return current + Math.sign(delta) * maxDelta;
}

function shapeSignedAxis(value: number, exponent: number): number {
  const sanitizedValue = clamp(value, -1, 1);
  const magnitude = Math.pow(
    clamp01(Math.abs(sanitizedValue)),
    Math.max(0.1, toFiniteNumber(exponent, 1))
  );

  return Math.sign(sanitizedValue) * magnitude;
}

function resolveBoostMultiplier(
  boost: boolean,
  movementMagnitude: number,
  config: MetaverseSurfaceTraversalConfig
): number {
  if (!boost) {
    return 1;
  }

  const shapedBoostAmount = Math.pow(
    clamp01(Math.abs(clamp(movementMagnitude, 0, 1))),
    Math.max(0.1, toFiniteNumber(config.boostCurveExponent, 1))
  );

  return 1 + (config.boostMultiplier - 1) * shapedBoostAmount;
}

function resolveShapedDragScale(
  currentSpeedUnitsPerSecond: number,
  config: MetaverseSurfaceTraversalConfig
): number {
  const normalizedSpeed = clamp01(
    Math.abs(currentSpeedUnitsPerSecond) /
      Math.max(0.001, config.baseSpeedUnitsPerSecond)
  );

  return Math.max(
    0.18,
    Math.pow(
      normalizedSpeed,
      Math.max(0.1, toFiniteNumber(config.dragCurveExponent, 1))
    )
  );
}

export function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
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

export function createMetaverseSurfaceTraversalVector3Snapshot(
  x: number,
  y: number,
  z: number
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x: toFiniteNumber(x),
    y: toFiniteNumber(y),
    z: toFiniteNumber(z)
  });
}

export function createMetaverseSurfaceTraversalDriveTargetSnapshot(
  input: Partial<MetaverseSurfaceTraversalDriveTargetSnapshot> = {}
): MetaverseSurfaceTraversalDriveTargetSnapshot {
  const moveAxis = clamp(toFiniteNumber(input.moveAxis ?? 0, 0), -1, 1);
  const strafeAxis = clamp(toFiniteNumber(input.strafeAxis ?? 0, 0), -1, 1);
  const targetForwardSpeedUnitsPerSecond = toFiniteNumber(
    input.targetForwardSpeedUnitsPerSecond ?? 0,
    0
  );
  const targetStrafeSpeedUnitsPerSecond = toFiniteNumber(
    input.targetStrafeSpeedUnitsPerSecond ?? 0,
    0
  );

  return Object.freeze({
    boost: input.boost === true,
    moveAxis,
    movementMagnitude: clamp(
      toFiniteNumber(
        input.movementMagnitude ?? Math.hypot(moveAxis, strafeAxis),
        Math.hypot(moveAxis, strafeAxis)
      ),
      0,
      1
    ),
    strafeAxis,
    targetForwardSpeedUnitsPerSecond,
    targetPlanarSpeedUnitsPerSecond: Math.max(
      0,
      toFiniteNumber(
        input.targetPlanarSpeedUnitsPerSecond ??
          Math.hypot(
            targetForwardSpeedUnitsPerSecond,
            targetStrafeSpeedUnitsPerSecond
          ),
        Math.hypot(
          targetForwardSpeedUnitsPerSecond,
          targetStrafeSpeedUnitsPerSecond
        )
      )
    ),
    targetStrafeSpeedUnitsPerSecond
  });
}

export function createMetaverseSurfaceTraversalSnapshot(
  position: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number
): MetaverseSurfaceTraversalSnapshot {
  return Object.freeze({
    planarSpeedUnitsPerSecond: 0,
    position: createMetaverseSurfaceTraversalVector3Snapshot(
      position.x,
      position.y,
      position.z
    ),
    yawRadians: wrapRadians(yawRadians)
  });
}

export function constrainMetaverseSurfaceTraversalPositionToWorldRadius(
  position: MetaverseWorldSurfaceVector3Snapshot,
  worldRadius: number
): MetaverseWorldSurfaceVector3Snapshot {
  const radialDistance = Math.hypot(position.x, position.z);
  const normalizedWorldRadius = Math.max(1, toFiniteNumber(worldRadius, 1));
  const radiusScale =
    radialDistance <= normalizedWorldRadius
      ? 1
      : normalizedWorldRadius / Math.max(1, radialDistance);

  return createMetaverseSurfaceTraversalVector3Snapshot(
    position.x * radiusScale,
    position.y,
    position.z * radiusScale
  );
}

export function advanceMetaverseYawRadiansTowardTarget(
  currentYawRadians: number,
  targetYawRadians: number,
  maxTurnSpeedRadiansPerSecond: number,
  deltaSeconds: number
): number {
  const maxDeltaRadians =
    Math.max(0, toFiniteNumber(maxTurnSpeedRadiansPerSecond, 0)) *
    Math.max(0, toFiniteNumber(deltaSeconds, 0));
  const yawDeltaRadians = wrapRadians(targetYawRadians - currentYawRadians);

  if (maxDeltaRadians <= 0 || Math.abs(yawDeltaRadians) <= maxDeltaRadians) {
    return wrapRadians(targetYawRadians);
  }

  return wrapRadians(
    currentYawRadians + Math.sign(yawDeltaRadians) * maxDeltaRadians
  );
}

export function resolveMetaverseSurfaceTraversalDriveTargetSnapshot(
  movementInput: Pick<
    MetaverseSurfaceTraversalInputSnapshot,
    "boost" | "moveAxis" | "strafeAxis"
  >,
  config: MetaverseSurfaceTraversalConfig,
  movementEnabled = true
): MetaverseSurfaceTraversalDriveTargetSnapshot {
  const moveAxis = movementEnabled
    ? clamp(toFiniteNumber(movementInput.moveAxis, 0), -1, 1)
    : 0;
  const strafeAxis = movementEnabled
    ? clamp(toFiniteNumber(movementInput.strafeAxis, 0), -1, 1)
    : 0;
  const movementMagnitude = clamp01(Math.hypot(moveAxis, strafeAxis));
  const boost = movementEnabled && movementInput.boost === true;
  const boostScale = resolveBoostMultiplier(boost, movementMagnitude, config);

  return createMetaverseSurfaceTraversalDriveTargetSnapshot({
    boost,
    moveAxis,
    movementMagnitude,
    strafeAxis,
    targetForwardSpeedUnitsPerSecond:
      config.baseSpeedUnitsPerSecond *
      shapeSignedAxis(moveAxis, config.accelerationCurveExponent) *
      boostScale,
    targetStrafeSpeedUnitsPerSecond:
      config.baseSpeedUnitsPerSecond *
      shapeSignedAxis(strafeAxis, config.accelerationCurveExponent) *
      boostScale
  });
}

export function advanceMetaverseSurfaceTraversalMotion(
  currentYawRadians: number,
  speedSnapshot: MetaverseSurfaceTraversalSpeedSnapshot,
  movementInput: Pick<
    MetaverseSurfaceTraversalInputSnapshot,
    "boost" | "moveAxis" | "strafeAxis" | "yawAxis"
  >,
  config: MetaverseSurfaceTraversalConfig,
  deltaSeconds: number,
  movementEnabled = true,
  movementDampingFactor = 1,
  yawTargetRadians: number | null = null
): MetaverseSurfaceTraversalMotionSnapshot {
  const clampedDeltaSeconds = Math.max(0, toFiniteNumber(deltaSeconds, 0));
  const effectiveMovementDampingFactor = clamp(
    toFiniteNumber(movementDampingFactor, 1),
    0,
    1
  );
  const yawRadians =
    yawTargetRadians === null
      ? wrapRadians(
          currentYawRadians +
            clamp(toFiniteNumber(movementInput.yawAxis, 0), -1, 1) *
              config.maxTurnSpeedRadiansPerSecond *
              clampedDeltaSeconds
        )
      : wrapRadians(yawTargetRadians);
  const driveTarget = resolveMetaverseSurfaceTraversalDriveTargetSnapshot(
    movementInput,
    config,
    movementEnabled
  );
  const resolveAxisSpeedUnitsPerSecond = (
    currentSpeedUnitsPerSecond: number,
    targetSpeedUnitsPerSecond: number,
    inputAxis: number
  ): number => {
    const shapedInputMagnitude = Math.abs(
      shapeSignedAxis(inputAxis, config.accelerationCurveExponent)
    );

    return inputAxis === 0
      ? approach(
          currentSpeedUnitsPerSecond,
          0,
          config.decelerationUnitsPerSecondSquared *
            resolveShapedDragScale(currentSpeedUnitsPerSecond, config) *
            Math.max(0.35, effectiveMovementDampingFactor) *
            clampedDeltaSeconds
        )
      : approach(
          currentSpeedUnitsPerSecond,
          targetSpeedUnitsPerSecond,
          config.accelerationUnitsPerSecondSquared *
            Math.max(0.2, shapedInputMagnitude) *
            Math.max(0.25, effectiveMovementDampingFactor) *
            clampedDeltaSeconds
        );
  };
  const forwardSpeedUnitsPerSecond = resolveAxisSpeedUnitsPerSecond(
    speedSnapshot.forwardSpeedUnitsPerSecond,
    driveTarget.targetForwardSpeedUnitsPerSecond,
    driveTarget.moveAxis
  );
  const strafeSpeedUnitsPerSecond = resolveAxisSpeedUnitsPerSecond(
    speedSnapshot.strafeSpeedUnitsPerSecond,
    driveTarget.targetStrafeSpeedUnitsPerSecond,
    driveTarget.strafeAxis
  );
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);

  return Object.freeze({
    driveTarget,
    forwardSpeedUnitsPerSecond,
    strafeSpeedUnitsPerSecond,
    velocityX:
      forwardX * forwardSpeedUnitsPerSecond +
      rightX * strafeSpeedUnitsPerSecond,
    velocityZ:
      forwardZ * forwardSpeedUnitsPerSecond +
      rightZ * strafeSpeedUnitsPerSecond,
    yawRadians
  });
}

export function advanceMetaverseSurfaceTraversalSnapshot(
  snapshot: MetaverseSurfaceTraversalSnapshot,
  speedSnapshot: MetaverseSurfaceTraversalSpeedSnapshot,
  movementInput: Pick<
    MetaverseSurfaceTraversalInputSnapshot,
    "boost" | "moveAxis" | "strafeAxis" | "yawAxis"
  >,
  config: MetaverseSurfaceTraversalConfig,
  deltaSeconds: number,
  worldRadius: number,
  fixedHeightMeters: number,
  movementEnabled = true,
  movementDampingFactor = 1,
  yawTargetRadians: number | null = null
): {
  readonly speedSnapshot: MetaverseSurfaceTraversalSpeedSnapshot;
  readonly snapshot: MetaverseSurfaceTraversalSnapshot;
} {
  if (deltaSeconds <= 0) {
    return Object.freeze({
      speedSnapshot,
      snapshot
    });
  }

  const motionSnapshot = advanceMetaverseSurfaceTraversalMotion(
    snapshot.yawRadians,
    speedSnapshot,
    movementInput,
    config,
    deltaSeconds,
    movementEnabled,
    movementDampingFactor,
    yawTargetRadians
  );
  const unclampedPosition = createMetaverseSurfaceTraversalVector3Snapshot(
    snapshot.position.x + motionSnapshot.velocityX * deltaSeconds,
    fixedHeightMeters,
    snapshot.position.z + motionSnapshot.velocityZ * deltaSeconds
  );
  const position = constrainMetaverseSurfaceTraversalPositionToWorldRadius(
    unclampedPosition,
    worldRadius
  );
  const deltaX = position.x - snapshot.position.x;
  const deltaZ = position.z - snapshot.position.z;
  const forwardX = Math.sin(motionSnapshot.yawRadians);
  const forwardZ = -Math.cos(motionSnapshot.yawRadians);
  const rightX = Math.cos(motionSnapshot.yawRadians);
  const rightZ = Math.sin(motionSnapshot.yawRadians);

  return Object.freeze({
    speedSnapshot: Object.freeze({
      forwardSpeedUnitsPerSecond:
        (deltaX * forwardX + deltaZ * forwardZ) / deltaSeconds,
      strafeSpeedUnitsPerSecond:
        (deltaX * rightX + deltaZ * rightZ) / deltaSeconds
    }),
    snapshot: Object.freeze({
      planarSpeedUnitsPerSecond: Math.hypot(deltaX, deltaZ) / deltaSeconds,
      position,
      yawRadians: motionSnapshot.yawRadians
    })
  });
}
