import type { PhysicsVector3Snapshot } from "@/physics";

import type { MetaversePlacedCuboidColliderSnapshot } from "../../states/metaverse-environment-collision";
import type { MetaverseRuntimeConfig } from "../../types/metaverse-runtime";
import {
  clamp,
  freezeVector3,
  resolvePlanarProbeOffset,
  toFiniteNumber
} from "./surface-locomotion";
import type {
  AutomaticSurfaceLocomotionDecision,
  AutomaticSurfaceLocomotionModeId
} from "../types/traversal";

const automaticSurfaceWaterlineThresholdMeters = 0.05;
const automaticSurfaceExitSupportProbeCount = 3;
const automaticSurfaceGroundedHoldProbeCount = 2;
const automaticSurfaceGroundedHoldPaddingFactor = 0.45;
const automaticSurfaceProbeForwardDistanceFactor = 0.88;
const automaticSurfaceProbeLateralDistanceFactor = 0.72;
const automaticSurfaceStepHeightLeewayMeters = 0.04;
const automaticSurfaceBlockingHeightToleranceMeters = 0.01;

interface AutomaticSurfaceSupportSnapshot {
  readonly centerStepBlocked: boolean;
  readonly centerStepSupportHeightMeters: number | null;
  readonly forwardStepBlocked: boolean;
  readonly forwardStepSupportHeightMeters: number | null;
  readonly highestStepSupportHeightMeters: number | null;
  readonly stepSupportedProbeCount: number;
}

interface AutomaticSurfaceProbeSupportSnapshot {
  readonly stepSupportHeightMeters: number | null;
  readonly supportHeightMeters: number | null;
}

function rotateVectorByQuaternion(
  x: number,
  y: number,
  z: number,
  qx: number,
  qy: number,
  qz: number,
  qw: number
): PhysicsVector3Snapshot {
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);

  return freezeVector3(
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx)
  );
}

function hasBlockingSupport(
  probeSupport: AutomaticSurfaceProbeSupportSnapshot
): boolean {
  return (
    probeSupport.supportHeightMeters !== null &&
    (probeSupport.stepSupportHeightMeters === null ||
      probeSupport.supportHeightMeters >
        probeSupport.stepSupportHeightMeters +
          automaticSurfaceBlockingHeightToleranceMeters)
  );
}

function resolveSurfaceSupportHeightMeters(
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  x: number,
  z: number,
  paddingMeters = 0,
  excludedOwnerEnvironmentAssetId: string | null = null
): number | null {
  let highestSurfaceY: number | null = null;

  for (const collider of surfaceColliderSnapshots) {
    if (collider.traversalAffordance !== "support") {
      continue;
    }

    if (
      excludedOwnerEnvironmentAssetId !== null &&
      collider.ownerEnvironmentAssetId === excludedOwnerEnvironmentAssetId
    ) {
      continue;
    }

    const localOffset = rotateVectorByQuaternion(
      x - collider.translation.x,
      0,
      z - collider.translation.z,
      -collider.rotation.x,
      -collider.rotation.y,
      -collider.rotation.z,
      collider.rotation.w
    );

    if (
      Math.abs(localOffset.x) > collider.halfExtents.x + paddingMeters ||
      Math.abs(localOffset.z) > collider.halfExtents.z + paddingMeters
    ) {
      continue;
    }

    const surfaceY = collider.translation.y + collider.halfExtents.y;

    if (highestSurfaceY === null || surfaceY > highestSurfaceY) {
      highestSurfaceY = surfaceY;
    }
  }

  return highestSurfaceY;
}

function isPlanarPositionInsideCollider(
  collider: MetaversePlacedCuboidColliderSnapshot,
  x: number,
  z: number,
  paddingMeters: number
): boolean {
  const localOffset = rotateVectorByQuaternion(
    x - collider.translation.x,
    0,
    z - collider.translation.z,
    -collider.rotation.x,
    -collider.rotation.y,
    -collider.rotation.z,
    collider.rotation.w
  );

  return (
    Math.abs(localOffset.x) <= collider.halfExtents.x + paddingMeters &&
    Math.abs(localOffset.z) <= collider.halfExtents.z + paddingMeters
  );
}

function isPlanarPositionBlocked(
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  x: number,
  z: number,
  paddingMeters: number,
  minHeightMeters: number,
  maxHeightMeters: number,
  excludedOwnerEnvironmentAssetId: string | null = null
): boolean {
  for (const collider of surfaceColliderSnapshots) {
    if (collider.traversalAffordance !== "blocker") {
      continue;
    }

    if (
      excludedOwnerEnvironmentAssetId !== null &&
      collider.ownerEnvironmentAssetId === excludedOwnerEnvironmentAssetId
    ) {
      continue;
    }

    const blockerMinHeightMeters =
      collider.translation.y - collider.halfExtents.y;
    const blockerMaxHeightMeters =
      collider.translation.y + collider.halfExtents.y;

    if (
      blockerMaxHeightMeters < minHeightMeters ||
      blockerMinHeightMeters > maxHeightMeters
    ) {
      continue;
    }

    if (isPlanarPositionInsideCollider(collider, x, z, paddingMeters)) {
      return true;
    }
  }

  return false;
}

export function resolveSurfaceHeightMeters(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  x: number,
  z: number
): number {
  return Math.max(
    config.ocean.height,
    resolveSurfaceSupportHeightMeters(
      surfaceColliderSnapshots,
      x,
      z,
      config.groundedBody.capsuleRadiusMeters
    ) ?? config.ocean.height
  );
}

export function constrainPlanarPositionAgainstBlockers(
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  currentPosition: PhysicsVector3Snapshot,
  nextPosition: PhysicsVector3Snapshot,
  paddingMeters: number,
  minHeightMeters: number,
  maxHeightMeters: number,
  excludedOwnerEnvironmentAssetId: string | null = null
): PhysicsVector3Snapshot {
  if (
    !isPlanarPositionBlocked(
      surfaceColliderSnapshots,
      nextPosition.x,
      nextPosition.z,
      paddingMeters,
      minHeightMeters,
      maxHeightMeters,
      excludedOwnerEnvironmentAssetId
    )
  ) {
    return freezeVector3(nextPosition.x, nextPosition.y, nextPosition.z);
  }

  const deltaX = nextPosition.x - currentPosition.x;
  const deltaZ = nextPosition.z - currentPosition.z;
  const axisOrder =
    Math.abs(deltaX) >= Math.abs(deltaZ)
      ? (["x", "z"] as const)
      : (["z", "x"] as const);
  let constrainedPosition = freezeVector3(
    currentPosition.x,
    nextPosition.y,
    currentPosition.z
  );

  for (const axis of axisOrder) {
    const candidate =
      axis === "x"
        ? freezeVector3(nextPosition.x, nextPosition.y, constrainedPosition.z)
        : freezeVector3(constrainedPosition.x, nextPosition.y, nextPosition.z);

    if (
      isPlanarPositionBlocked(
        surfaceColliderSnapshots,
        candidate.x,
        candidate.z,
        paddingMeters,
        minHeightMeters,
        maxHeightMeters,
        excludedOwnerEnvironmentAssetId
      )
    ) {
      continue;
    }

    constrainedPosition = candidate;
  }

  return constrainedPosition;
}

export function resolveGroundedAutostepHeightMeters(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  moveAxis: number,
  strafeAxis: number,
  verticalSpeedUnitsPerSecond = 0,
  jumpRequested = false
): number | null {
  const clampedMoveAxis = clamp(toFiniteNumber(moveAxis, 0), -1, 1);
  const clampedStrafeAxis = clamp(toFiniteNumber(strafeAxis, 0), -1, 1);
  const inputMagnitude = Math.hypot(clampedMoveAxis, clampedStrafeAxis);

  if (inputMagnitude <= 0.0001) {
    return null;
  }

  const normalizedMoveAxis = clampedMoveAxis / inputMagnitude;
  const normalizedStrafeAxis = clampedStrafeAxis / inputMagnitude;
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);
  const movementDirectionX =
    forwardX * normalizedMoveAxis + rightX * normalizedStrafeAxis;
  const movementDirectionZ =
    forwardZ * normalizedMoveAxis + rightZ * normalizedStrafeAxis;
  const movementYawRadians = Math.atan2(movementDirectionX, -movementDirectionZ);
  const currentSupportHeightMeters = position.y;
  const effectiveUpwardSpeedUnitsPerSecond = Math.max(
    0,
    toFiniteNumber(verticalSpeedUnitsPerSecond, 0),
    jumpRequested ? config.groundedBody.jumpImpulseUnitsPerSecond : 0
  );
  const maxJumpRiseMeters =
    effectiveUpwardSpeedUnitsPerSecond <= 0
      ? 0
      : (effectiveUpwardSpeedUnitsPerSecond *
          effectiveUpwardSpeedUnitsPerSecond) /
        Math.max(0.001, config.groundedBody.gravityUnitsPerSecond * 2);
  const maxEligibleStepRiseMeters = Math.max(
    config.groundedBody.stepHeightMeters + automaticSurfaceStepHeightLeewayMeters,
    maxJumpRiseMeters + automaticSurfaceStepHeightLeewayMeters
  );
  const probeForwardDistanceMeters =
    config.groundedBody.capsuleRadiusMeters *
    automaticSurfaceProbeForwardDistanceFactor;
  const probeLateralDistanceMeters =
    config.groundedBody.capsuleRadiusMeters *
    automaticSurfaceProbeLateralDistanceFactor;
  let highestEligibleStepRiseMeters: number | null = null;

  for (const probeOffset of [
    resolvePlanarProbeOffset(probeForwardDistanceMeters, 0, movementYawRadians),
    resolvePlanarProbeOffset(
      probeForwardDistanceMeters * 0.72,
      -probeLateralDistanceMeters,
      movementYawRadians
    ),
    resolvePlanarProbeOffset(
      probeForwardDistanceMeters * 0.72,
      probeLateralDistanceMeters,
      movementYawRadians
    )
  ]) {
    const supportHeightMeters = resolveSurfaceSupportHeightMeters(
      surfaceColliderSnapshots,
      position.x + probeOffset.x,
      position.z + probeOffset.z
    );

    if (supportHeightMeters === null) {
      continue;
    }

    const supportRiseMeters = supportHeightMeters - currentSupportHeightMeters;

    if (
      supportRiseMeters > automaticSurfaceBlockingHeightToleranceMeters &&
      supportRiseMeters <= maxEligibleStepRiseMeters &&
      (highestEligibleStepRiseMeters === null ||
        supportRiseMeters > highestEligibleStepRiseMeters)
    ) {
      highestEligibleStepRiseMeters = supportRiseMeters;
    }
  }

  return highestEligibleStepRiseMeters === null
    ? null
    : Math.max(
        config.groundedBody.stepHeightMeters,
        highestEligibleStepRiseMeters
      );
}

export function shouldEnableGroundedAutostep(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  moveAxis: number,
  strafeAxis: number,
  verticalSpeedUnitsPerSecond = 0,
  jumpRequested = false
): boolean {
  return (
    resolveGroundedAutostepHeightMeters(
      config,
      surfaceColliderSnapshots,
      position,
      yawRadians,
      moveAxis,
      strafeAxis,
      verticalSpeedUnitsPerSecond,
      jumpRequested
    ) !== null
  );
}

function sampleAutomaticSurfaceSupport(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  paddingMeters: number
): AutomaticSurfaceSupportSnapshot {
  const probeForwardDistanceMeters =
    config.groundedBody.capsuleRadiusMeters *
    automaticSurfaceProbeForwardDistanceFactor;
  const probeLateralDistanceMeters =
    config.groundedBody.capsuleRadiusMeters *
    automaticSurfaceProbeLateralDistanceFactor;
  const centerProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    position.x,
    position.z,
    paddingMeters
  );
  const forwardProbeOffset = resolvePlanarProbeOffset(
    probeForwardDistanceMeters,
    0,
    yawRadians
  );
  const forwardProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    position.x + forwardProbeOffset.x,
    position.z + forwardProbeOffset.z,
    paddingMeters
  );
  const forwardLeftProbeOffset = resolvePlanarProbeOffset(
    probeForwardDistanceMeters * 0.72,
    -probeLateralDistanceMeters,
    yawRadians
  );
  const forwardLeftProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    position.x + forwardLeftProbeOffset.x,
    position.z + forwardLeftProbeOffset.z,
    paddingMeters
  );
  const forwardRightProbeOffset = resolvePlanarProbeOffset(
    probeForwardDistanceMeters * 0.72,
    probeLateralDistanceMeters,
    yawRadians
  );
  const forwardRightProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    position.x + forwardRightProbeOffset.x,
    position.z + forwardRightProbeOffset.z,
    paddingMeters
  );
  const rearProbeOffset = resolvePlanarProbeOffset(
    -probeForwardDistanceMeters * 0.48,
    0,
    yawRadians
  );
  const rearProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    position.x + rearProbeOffset.x,
    position.z + rearProbeOffset.z,
    paddingMeters
  );
  let highestStepSupportHeightMeters: number | null = null;
  let stepSupportedProbeCount = 0;

  for (const probeSupport of [
    centerProbeSupport,
    forwardProbeSupport,
    forwardLeftProbeSupport,
    forwardRightProbeSupport,
    rearProbeSupport
  ]) {
    if (probeSupport.stepSupportHeightMeters === null) {
      continue;
    }

    stepSupportedProbeCount += 1;
    if (
      highestStepSupportHeightMeters === null ||
      probeSupport.stepSupportHeightMeters > highestStepSupportHeightMeters
    ) {
      highestStepSupportHeightMeters = probeSupport.stepSupportHeightMeters;
    }
  }

  return {
    centerStepBlocked: hasBlockingSupport(centerProbeSupport),
    centerStepSupportHeightMeters: centerProbeSupport.stepSupportHeightMeters,
    forwardStepBlocked: hasBlockingSupport(forwardProbeSupport),
    forwardStepSupportHeightMeters: forwardProbeSupport.stepSupportHeightMeters,
    highestStepSupportHeightMeters,
    stepSupportedProbeCount
  };
}

function resolveAutomaticSurfaceProbeSupport(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  x: number,
  z: number,
  paddingMeters = 0
): AutomaticSurfaceProbeSupportSnapshot {
  let highestStepSupportHeightMeters: number | null = null;
  let highestSupportHeightMeters: number | null = null;
  const highestStepRiseAboveWaterMeters =
    config.groundedBody.stepHeightMeters + automaticSurfaceStepHeightLeewayMeters;

  for (const collider of surfaceColliderSnapshots) {
    if (collider.traversalAffordance !== "support") {
      continue;
    }

    const localOffset = rotateVectorByQuaternion(
      x - collider.translation.x,
      0,
      z - collider.translation.z,
      -collider.rotation.x,
      -collider.rotation.y,
      -collider.rotation.z,
      collider.rotation.w
    );

    if (
      Math.abs(localOffset.x) > collider.halfExtents.x + paddingMeters ||
      Math.abs(localOffset.z) > collider.halfExtents.z + paddingMeters
    ) {
      continue;
    }

    const surfaceY = collider.translation.y + collider.halfExtents.y;
    const riseAboveWaterMeters = surfaceY - config.ocean.height;

    if (riseAboveWaterMeters <= automaticSurfaceWaterlineThresholdMeters) {
      continue;
    }

    if (
      highestSupportHeightMeters === null ||
      surfaceY > highestSupportHeightMeters
    ) {
      highestSupportHeightMeters = surfaceY;
    }

    if (
      riseAboveWaterMeters <= highestStepRiseAboveWaterMeters &&
      (highestStepSupportHeightMeters === null ||
        surfaceY > highestStepSupportHeightMeters)
    ) {
      highestStepSupportHeightMeters = surfaceY;
    }
  }

  return {
    stepSupportHeightMeters: highestStepSupportHeightMeters,
    supportHeightMeters: highestSupportHeightMeters
  };
}

export function resolveAutomaticSurfaceLocomotionMode(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  currentLocomotionMode: AutomaticSurfaceLocomotionModeId
): AutomaticSurfaceLocomotionDecision {
  const supportSnapshot = sampleAutomaticSurfaceSupport(
    config,
    surfaceColliderSnapshots,
    position,
    yawRadians,
    currentLocomotionMode === "grounded"
      ? config.groundedBody.capsuleRadiusMeters *
          automaticSurfaceGroundedHoldPaddingFactor
      : 0
  );

  if (currentLocomotionMode === "grounded") {
    const shouldStayGrounded =
      supportSnapshot.centerStepSupportHeightMeters !== null ||
      supportSnapshot.stepSupportedProbeCount >=
        automaticSurfaceGroundedHoldProbeCount;

    return shouldStayGrounded
      ? {
          locomotionMode: "grounded",
          supportHeightMeters:
            supportSnapshot.centerStepSupportHeightMeters ??
            supportSnapshot.highestStepSupportHeightMeters
        }
      : {
          locomotionMode: "swim",
          supportHeightMeters: null
        };
  }

  const canExitWater =
    supportSnapshot.centerStepSupportHeightMeters !== null &&
    !supportSnapshot.centerStepBlocked &&
    supportSnapshot.forwardStepSupportHeightMeters !== null &&
    !supportSnapshot.forwardStepBlocked &&
    supportSnapshot.stepSupportedProbeCount >= automaticSurfaceExitSupportProbeCount;

  return canExitWater
    ? {
        locomotionMode: "grounded",
        supportHeightMeters:
          supportSnapshot.centerStepSupportHeightMeters ??
          supportSnapshot.highestStepSupportHeightMeters
      }
    : {
        locomotionMode: "swim",
        supportHeightMeters: null
      };
}

export function isWaterbornePosition(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  position: PhysicsVector3Snapshot,
  paddingMeters = 0,
  excludedOwnerEnvironmentAssetId: string | null = null
): boolean {
  const supportHeight = resolveSurfaceSupportHeightMeters(
    surfaceColliderSnapshots,
    position.x,
    position.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId
  );

  return (
    supportHeight === null ||
    supportHeight <= config.ocean.height + automaticSurfaceWaterlineThresholdMeters
  );
}
