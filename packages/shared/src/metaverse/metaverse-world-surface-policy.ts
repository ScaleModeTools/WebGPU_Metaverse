import type {
  MetaverseWorldPlacedSurfaceColliderSnapshot,
  MetaverseWorldPlacedWaterRegionSnapshot,
  MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";
import { resolveMetaverseWorldWaterSurfaceHeightMeters } from "./metaverse-world-surface-query.js";

export interface MetaverseWorldSurfacePolicyConfig {
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly gravityUnitsPerSecond: number;
  readonly jumpImpulseUnitsPerSecond: number;
  readonly oceanHeightMeters: number;
  readonly stepHeightMeters: number;
}

export const metaverseWorldAutomaticSurfaceDecisionReasonIds = [
  "grounded-hold",
  "water-entry",
  "shoreline-exit-blocked",
  "shoreline-exit-success"
] as const;

export type MetaverseWorldAutomaticSurfaceDecisionReasonId =
  (typeof metaverseWorldAutomaticSurfaceDecisionReasonIds)[number];

export interface MetaverseWorldSurfaceLocomotionDecision {
  readonly locomotionMode: "grounded" | "swim";
  readonly supportHeightMeters: number | null;
}

export interface MetaverseWorldAutomaticSurfaceLocomotionDebugSnapshot {
  readonly blockerOverlap: boolean;
  readonly centerStepBlocked: boolean;
  readonly centerStepSupportHeightMeters: number | null;
  readonly forwardStepBlocked: boolean;
  readonly forwardStepSupportHeightMeters: number | null;
  readonly reason: MetaverseWorldAutomaticSurfaceDecisionReasonId;
  readonly resolvedSupportHeightMeters: number;
  readonly stepSupportedProbeCount: number;
}

export interface MetaverseWorldAutomaticSurfaceLocomotionSnapshot {
  readonly debug: MetaverseWorldAutomaticSurfaceLocomotionDebugSnapshot;
  readonly decision: MetaverseWorldSurfaceLocomotionDecision;
}

export const metaverseWorldAutomaticSurfaceWaterlineThresholdMeters = 0.05;
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

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function freezeVector3(
  x: number,
  y: number,
  z: number
): MetaverseWorldSurfaceVector3Snapshot {
  return Object.freeze({
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0
  });
}

function rotatePlanarPoint(
  x: number,
  z: number,
  yawRadians: number
): MetaverseWorldSurfaceVector3Snapshot {
  const sine = Math.sin(yawRadians);
  const cosine = Math.cos(yawRadians);

  return freezeVector3(x * cosine + z * sine, 0, -x * sine + z * cosine);
}

function resolvePlanarProbeOffset(
  forwardMeters: number,
  lateralMeters: number,
  yawRadians: number
): MetaverseWorldSurfaceVector3Snapshot {
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);

  return freezeVector3(
    forwardX * forwardMeters + rightX * lateralMeters,
    0,
    forwardZ * forwardMeters + rightZ * lateralMeters
  );
}

function isPlanarPositionInsideCollider(
  collider: MetaverseWorldPlacedSurfaceColliderSnapshot,
  x: number,
  z: number,
  paddingMeters: number
): boolean {
  const localOffset = rotatePlanarPoint(
    x - collider.translation.x,
    z - collider.translation.z,
    -collider.rotationYRadians
  );

  return (
    Math.abs(localOffset.x) <= collider.halfExtents.x + paddingMeters &&
    Math.abs(localOffset.z) <= collider.halfExtents.z + paddingMeters
  );
}

function resolveSurfaceSupportHeightMeters(
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
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

    if (!isPlanarPositionInsideCollider(collider, x, z, paddingMeters)) {
      continue;
    }

    const surfaceY = collider.translation.y + collider.halfExtents.y;

    if (highestSurfaceY === null || surfaceY > highestSurfaceY) {
      highestSurfaceY = surfaceY;
    }
  }

  return highestSurfaceY;
}

function isPlanarPositionBlocked(
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
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

function resolveAutomaticSurfaceProbeSupport(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  x: number,
  z: number,
  paddingMeters = 0,
  excludedOwnerEnvironmentAssetId: string | null = null
): AutomaticSurfaceProbeSupportSnapshot {
  let highestStepSupportHeightMeters: number | null = null;
  let highestSupportHeightMeters: number | null = null;
  const highestStepRiseAboveWaterMeters =
    config.stepHeightMeters + automaticSurfaceStepHeightLeewayMeters;
  const localWaterSurfaceHeightMeters =
    resolveMetaverseWorldWaterSurfaceHeightMeters(
      waterRegionSnapshots,
      x,
      z,
      paddingMeters
    );

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

    if (!isPlanarPositionInsideCollider(collider, x, z, paddingMeters)) {
      continue;
    }

    const surfaceY = collider.translation.y + collider.halfExtents.y;
    if (localWaterSurfaceHeightMeters === null) {
      if (
        highestSupportHeightMeters === null ||
        surfaceY > highestSupportHeightMeters
      ) {
        highestSupportHeightMeters = surfaceY;
      }

      if (
        highestStepSupportHeightMeters === null ||
        surfaceY > highestStepSupportHeightMeters
      ) {
        highestStepSupportHeightMeters = surfaceY;
      }

      continue;
    }

    const riseAboveWaterMeters = surfaceY - localWaterSurfaceHeightMeters;

    if (
      riseAboveWaterMeters >
      metaverseWorldAutomaticSurfaceWaterlineThresholdMeters
    ) {
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
  }

  return {
    stepSupportHeightMeters: highestStepSupportHeightMeters,
    supportHeightMeters: highestSupportHeightMeters
  };
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

function sampleAutomaticSurfaceSupport(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  position: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number,
  paddingMeters: number,
  excludedOwnerEnvironmentAssetId: string | null = null
): AutomaticSurfaceSupportSnapshot {
  const probeForwardDistanceMeters =
    config.capsuleRadiusMeters * automaticSurfaceProbeForwardDistanceFactor;
  const probeLateralDistanceMeters =
    config.capsuleRadiusMeters * automaticSurfaceProbeLateralDistanceFactor;
  const centerProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position.x,
    position.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId
  );
  const forwardProbeOffset = resolvePlanarProbeOffset(
    probeForwardDistanceMeters,
    0,
    yawRadians
  );
  const forwardProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position.x + forwardProbeOffset.x,
    position.z + forwardProbeOffset.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId
  );
  const forwardLeftProbeOffset = resolvePlanarProbeOffset(
    probeForwardDistanceMeters * 0.72,
    -probeLateralDistanceMeters,
    yawRadians
  );
  const forwardLeftProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position.x + forwardLeftProbeOffset.x,
    position.z + forwardLeftProbeOffset.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId
  );
  const forwardRightProbeOffset = resolvePlanarProbeOffset(
    probeForwardDistanceMeters * 0.72,
    probeLateralDistanceMeters,
    yawRadians
  );
  const forwardRightProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position.x + forwardRightProbeOffset.x,
    position.z + forwardRightProbeOffset.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId
  );
  const rearProbeOffset = resolvePlanarProbeOffset(
    -probeForwardDistanceMeters * 0.48,
    0,
    yawRadians
  );
  const rearProbeSupport = resolveAutomaticSurfaceProbeSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position.x + rearProbeOffset.x,
    position.z + rearProbeOffset.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId
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

export function resolveMetaverseWorldSurfaceHeightMeters(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  x: number,
  z: number,
  excludedOwnerEnvironmentAssetId: string | null = null
): number | null {
  const supportHeightMeters = resolveSurfaceSupportHeightMeters(
    surfaceColliderSnapshots,
    x,
    z,
    config.capsuleRadiusMeters,
    excludedOwnerEnvironmentAssetId
  );
  const waterSurfaceHeightMeters = resolveMetaverseWorldWaterSurfaceHeightMeters(
    waterRegionSnapshots,
    x,
    z,
    config.capsuleRadiusMeters
  );

  if (
    supportHeightMeters !== null &&
    waterSurfaceHeightMeters !== null
  ) {
    return Math.max(waterSurfaceHeightMeters, supportHeightMeters);
  }

  return supportHeightMeters ?? waterSurfaceHeightMeters;
}

export function constrainMetaverseWorldPlanarPositionAgainstBlockers(
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  currentPosition: MetaverseWorldSurfaceVector3Snapshot,
  nextPosition: MetaverseWorldSurfaceVector3Snapshot,
  paddingMeters: number,
  minHeightMeters: number,
  maxHeightMeters: number,
  excludedOwnerEnvironmentAssetId: string | null = null
): MetaverseWorldSurfaceVector3Snapshot {
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

export function resolveMetaverseWorldGroundedAutostepHeightMeters(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  position: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number,
  moveAxis: number,
  strafeAxis: number,
  verticalSpeedUnitsPerSecond = 0,
  jumpRequested = false,
  excludedOwnerEnvironmentAssetId: string | null = null
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
    jumpRequested ? config.jumpImpulseUnitsPerSecond : 0
  );
  const maxJumpRiseMeters =
    effectiveUpwardSpeedUnitsPerSecond <= 0
      ? 0
      : (effectiveUpwardSpeedUnitsPerSecond *
          effectiveUpwardSpeedUnitsPerSecond) /
        Math.max(0.001, config.gravityUnitsPerSecond * 2);
  const maxEligibleStepRiseMeters = Math.max(
    config.stepHeightMeters + automaticSurfaceStepHeightLeewayMeters,
    maxJumpRiseMeters + automaticSurfaceStepHeightLeewayMeters
  );
  const probeForwardDistanceMeters =
    config.capsuleRadiusMeters * automaticSurfaceProbeForwardDistanceFactor;
  const probeLateralDistanceMeters =
    config.capsuleRadiusMeters * automaticSurfaceProbeLateralDistanceFactor;
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
      position.z + probeOffset.z,
      0,
      excludedOwnerEnvironmentAssetId
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
    : Math.max(config.stepHeightMeters, highestEligibleStepRiseMeters);
}

export function resolveMetaverseWorldAutomaticSurfaceLocomotion(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  position: MetaverseWorldSurfaceVector3Snapshot,
  yawRadians: number,
  currentLocomotionMode: "grounded" | "swim",
  excludedOwnerEnvironmentAssetId: string | null = null
): MetaverseWorldAutomaticSurfaceLocomotionSnapshot {
  const supportSnapshot = sampleAutomaticSurfaceSupport(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position,
    yawRadians,
    currentLocomotionMode === "grounded"
      ? config.capsuleRadiusMeters * automaticSurfaceGroundedHoldPaddingFactor
      : 0,
    excludedOwnerEnvironmentAssetId
  );
  const resolvedSupportHeightMeters =
    resolveMetaverseWorldSurfaceHeightMeters(
      config,
      surfaceColliderSnapshots,
      waterRegionSnapshots,
      position.x,
      position.z,
      excludedOwnerEnvironmentAssetId
    ) ?? position.y;
  const waterbornePosition = isMetaverseWorldWaterbornePosition(
    config,
    surfaceColliderSnapshots,
    waterRegionSnapshots,
    position,
    0,
    excludedOwnerEnvironmentAssetId
  );

  if (currentLocomotionMode === "grounded") {
    const shouldStayGrounded =
      supportSnapshot.centerStepSupportHeightMeters !== null ||
      supportSnapshot.stepSupportedProbeCount >=
        automaticSurfaceGroundedHoldProbeCount ||
      !waterbornePosition;
    const decision = shouldStayGrounded
      ? Object.freeze({
          locomotionMode: "grounded",
          supportHeightMeters:
            supportSnapshot.centerStepSupportHeightMeters ??
            supportSnapshot.highestStepSupportHeightMeters
        } satisfies MetaverseWorldSurfaceLocomotionDecision)
      : Object.freeze({
          locomotionMode: "swim",
          supportHeightMeters: null
        } satisfies MetaverseWorldSurfaceLocomotionDecision);

    return Object.freeze({
      debug: Object.freeze({
        blockerOverlap: false,
        centerStepBlocked: supportSnapshot.centerStepBlocked,
        centerStepSupportHeightMeters:
          supportSnapshot.centerStepSupportHeightMeters,
        forwardStepBlocked: supportSnapshot.forwardStepBlocked,
        forwardStepSupportHeightMeters:
          supportSnapshot.forwardStepSupportHeightMeters,
        reason: shouldStayGrounded ? "grounded-hold" : "water-entry",
        resolvedSupportHeightMeters,
        stepSupportedProbeCount: supportSnapshot.stepSupportedProbeCount
      }),
      decision
    });
  }

  const canExitWater =
    supportSnapshot.centerStepSupportHeightMeters !== null &&
    !supportSnapshot.centerStepBlocked &&
    supportSnapshot.forwardStepSupportHeightMeters !== null &&
    !supportSnapshot.forwardStepBlocked &&
    supportSnapshot.stepSupportedProbeCount >= automaticSurfaceExitSupportProbeCount;
  const decision = canExitWater
    ? Object.freeze({
        locomotionMode: "grounded",
        supportHeightMeters:
          supportSnapshot.centerStepSupportHeightMeters ??
          supportSnapshot.highestStepSupportHeightMeters
      } satisfies MetaverseWorldSurfaceLocomotionDecision)
    : Object.freeze({
        locomotionMode: "swim",
        supportHeightMeters: null
      } satisfies MetaverseWorldSurfaceLocomotionDecision);

  return Object.freeze({
    debug: Object.freeze({
      blockerOverlap:
        supportSnapshot.centerStepBlocked || supportSnapshot.forwardStepBlocked,
      centerStepBlocked: supportSnapshot.centerStepBlocked,
      centerStepSupportHeightMeters: supportSnapshot.centerStepSupportHeightMeters,
      forwardStepBlocked: supportSnapshot.forwardStepBlocked,
      forwardStepSupportHeightMeters:
        supportSnapshot.forwardStepSupportHeightMeters,
      reason: canExitWater
        ? "shoreline-exit-success"
        : "shoreline-exit-blocked",
      resolvedSupportHeightMeters,
      stepSupportedProbeCount: supportSnapshot.stepSupportedProbeCount
    }),
    decision
  });
}

export function isMetaverseWorldWaterbornePosition(
  config: MetaverseWorldSurfacePolicyConfig,
  surfaceColliderSnapshots: readonly MetaverseWorldPlacedSurfaceColliderSnapshot[],
  waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[],
  position: MetaverseWorldSurfaceVector3Snapshot,
  paddingMeters = 0,
  excludedOwnerEnvironmentAssetId: string | null = null
): boolean {
  const waterSurfaceHeightMeters = resolveMetaverseWorldWaterSurfaceHeightMeters(
    waterRegionSnapshots,
    position.x,
    position.z,
    paddingMeters
  );

  if (
    waterSurfaceHeightMeters === null
  ) {
    return false;
  }

  const supportHeight = resolveSurfaceSupportHeightMeters(
    surfaceColliderSnapshots,
    position.x,
    position.z,
    paddingMeters,
    excludedOwnerEnvironmentAssetId
  );

  return (
    supportHeight === null ||
    supportHeight <=
      waterSurfaceHeightMeters +
        metaverseWorldAutomaticSurfaceWaterlineThresholdMeters
  );
}
