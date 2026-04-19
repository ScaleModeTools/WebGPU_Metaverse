import type { PhysicsVector3Snapshot } from "@/physics";
import {
  constrainMetaverseWorldPlanarPositionAgainstBlockers,
  isMetaverseWorldWaterbornePosition,
  resolveMetaverseTraversalStateFromWorldAffordances,
  resolveMetaverseWorldGroundedAutostepHeightMeters,
  resolveMetaverseWorldSurfaceHeightMeters,
  resolveMetaverseWorldWaterSurfaceHeightMeters,
  type MetaverseTraversalStateResolutionDebugSnapshot,
  type MetaverseTraversalStateResolutionSnapshot,
  type MetaverseWorldSurfacePolicyConfig
} from "@webgpu-metaverse/shared";

import type { MetaversePlacedCuboidColliderSnapshot } from "../../states/metaverse-environment-collision";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import type {
  AutomaticSurfaceLocomotionDecision,
  AutomaticSurfaceLocomotionModeId
} from "../types/traversal";

const surfacePolicyConfigByRuntimeConfig = new WeakMap<
  MetaverseRuntimeConfig,
  MetaverseWorldSurfacePolicyConfig
>();

export function readMetaverseSurfacePolicyConfig(
  config: MetaverseRuntimeConfig
): MetaverseWorldSurfacePolicyConfig {
  const cachedConfig = surfacePolicyConfigByRuntimeConfig.get(config);

  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  const surfacePolicyConfig = Object.freeze({
    capsuleHalfHeightMeters: config.groundedBody.capsuleHalfHeightMeters,
    capsuleRadiusMeters: config.groundedBody.capsuleRadiusMeters,
    gravityUnitsPerSecond: config.groundedBody.gravityUnitsPerSecond,
    jumpImpulseUnitsPerSecond: config.groundedBody.jumpImpulseUnitsPerSecond,
    oceanHeightMeters: config.ocean.height,
    stepHeightMeters: config.groundedBody.stepHeightMeters
  } satisfies MetaverseWorldSurfacePolicyConfig);

  surfacePolicyConfigByRuntimeConfig.set(config, surfacePolicyConfig);

  return surfacePolicyConfig;
}

export type AutomaticSurfaceLocomotionDebugSnapshot =
  MetaverseTraversalStateResolutionDebugSnapshot;
export type AutomaticSurfaceLocomotionSnapshot =
  MetaverseTraversalStateResolutionSnapshot;

export function resolveSurfaceHeightMeters(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  x: number,
  z: number,
  excludedOwnerEnvironmentAssetId: string | null = null
): number | null {
  return resolveMetaverseWorldSurfaceHeightMeters(
    readMetaverseSurfacePolicyConfig(config),
    surfaceColliderSnapshots,
    config.waterRegionSnapshots,
    x,
    z,
    excludedOwnerEnvironmentAssetId
  );
}

export function resolveWaterSurfaceHeightMeters(
  config: MetaverseRuntimeConfig,
  position: Pick<PhysicsVector3Snapshot, "x" | "z">,
  paddingMeters = 0
): number | null {
  void config;

  return resolveMetaverseWorldWaterSurfaceHeightMeters(
    config.waterRegionSnapshots,
    position.x,
    position.z,
    paddingMeters
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
  return constrainMetaverseWorldPlanarPositionAgainstBlockers(
    surfaceColliderSnapshots,
    currentPosition,
    nextPosition,
    paddingMeters,
    minHeightMeters,
    maxHeightMeters,
    excludedOwnerEnvironmentAssetId
  );
}

export function resolveGroundedAutostepHeightMeters(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  moveAxis: number,
  strafeAxis: number,
  verticalSpeedUnitsPerSecond = 0,
  jumpRequested = false,
  excludedOwnerEnvironmentAssetId: string | null = null
): number | null {
  return resolveMetaverseWorldGroundedAutostepHeightMeters(
    readMetaverseSurfacePolicyConfig(config),
    surfaceColliderSnapshots,
    position,
    yawRadians,
    moveAxis,
    strafeAxis,
    verticalSpeedUnitsPerSecond,
    jumpRequested,
    excludedOwnerEnvironmentAssetId
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
  jumpRequested = false,
  excludedOwnerEnvironmentAssetId: string | null = null
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
      jumpRequested,
      excludedOwnerEnvironmentAssetId
    ) !== null
  );
}

export function resolveAutomaticSurfaceLocomotionSnapshot(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  currentLocomotionMode: AutomaticSurfaceLocomotionModeId,
  excludedOwnerEnvironmentAssetId: string | null = null
): AutomaticSurfaceLocomotionSnapshot {
  return resolveMetaverseTraversalStateFromWorldAffordances(
    readMetaverseSurfacePolicyConfig(config),
    surfaceColliderSnapshots,
    config.waterRegionSnapshots,
    position,
    yawRadians,
    currentLocomotionMode,
    excludedOwnerEnvironmentAssetId
  );
}

export function resolveAutomaticSurfaceLocomotionMode(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  currentLocomotionMode: AutomaticSurfaceLocomotionModeId,
  excludedOwnerEnvironmentAssetId: string | null = null
): AutomaticSurfaceLocomotionDecision {
  return resolveAutomaticSurfaceLocomotionSnapshot(
    config,
    surfaceColliderSnapshots,
    position,
    yawRadians,
    currentLocomotionMode,
    excludedOwnerEnvironmentAssetId
  ).decision;
}

export function isWaterbornePosition(
  config: MetaverseRuntimeConfig,
  surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[],
  position: PhysicsVector3Snapshot,
  paddingMeters = 0,
  excludedOwnerEnvironmentAssetId: string | null = null
): boolean {
  return isMetaverseWorldWaterbornePosition(
    readMetaverseSurfacePolicyConfig(config),
    surfaceColliderSnapshots,
    config.waterRegionSnapshots,
    position,
    paddingMeters,
    excludedOwnerEnvironmentAssetId
  );
}
