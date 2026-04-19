import { resolveMetaverseWorldSurfaceScaleVector } from "@webgpu-metaverse/shared/metaverse/world";
import {
  Group,
  Quaternion,
  Vector3
} from "three/webgpu";

import type {
  MetaverseCameraSnapshot,
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentColliderProofConfig,
  MetaverseEnvironmentPlacementProofConfig,
  MetaverseVector3Snapshot
} from "../../types/metaverse-runtime";
import {
  resolveEnvironmentRenderYawFromSimulationYaw,
  resolveEnvironmentSimulationYawFromRenderYaw
} from "../../traversal/presentation/mount-presentation";
import { markMetaverseSceneBundleGroupsDirty } from "../metaverse-scene-bundle-groups";
import {
  type MetaverseSceneDynamicEnvironmentRuntime,
  type MetaverseSceneEnvironmentProofRuntime,
  type MetaverseSceneMountableEnvironmentEntryRuntime,
  type MetaverseSceneMountableEnvironmentRuntime,
  type MetaverseSceneMountableEnvironmentSeatRuntime
} from "../mounts/metaverse-scene-mounts";
export { loadMetaverseEnvironmentProofRuntime } from "./metaverse-scene-environment-proof-loader";

export interface SceneAssetLoaderLike {
  loadAsync(path: string): Promise<{
    readonly scene: Group;
  }>;
}

interface MetaverseEnvironmentLodObjectRuntime {
  readonly maxDistanceMeters: number | null;
  readonly object: Group;
  readonly tier: string;
}

interface MetaverseEnvironmentStaticPlacementRuntime {
  activeLodIndex: number;
  lastLodSwitchAtMs: number;
  readonly lods: readonly MetaverseEnvironmentLodObjectRuntime[];
  readonly placement: MetaverseEnvironmentPlacementProofConfig;
}

interface MetaverseEnvironmentInstancedAssetRuntime {
  activeLodIndex: number;
  lastLodSwitchAtMs: number;
  readonly lods: readonly MetaverseEnvironmentLodObjectRuntime[];
  readonly placements: readonly MetaverseEnvironmentPlacementProofConfig[];
}

export interface MetaverseEnvironmentDynamicAssetRuntime
  extends MetaverseSceneDynamicEnvironmentRuntime {
  readonly anchorGroup: Group;
  readonly basePlacement: MetaverseEnvironmentPlacementProofConfig;
  readonly collider: MetaverseEnvironmentColliderProofConfig;
  readonly entries: readonly MetaverseSceneMountableEnvironmentEntryRuntime[] | null;
  readonly environmentAssetId: string;
  readonly label: string;
  readonly motionPhase: number;
  readonly orientation: MetaverseEnvironmentAssetProofConfig["orientation"];
  readonly presentationGroup: Group;
  readonly scene: Group;
  readonly seats: readonly MetaverseSceneMountableEnvironmentSeatRuntime[] | null;
  readonly traversalAffordance: MetaverseEnvironmentAssetProofConfig["traversalAffordance"];
}

export interface MetaverseMountableEnvironmentDynamicAssetRuntime
  extends MetaverseEnvironmentDynamicAssetRuntime,
    MetaverseSceneMountableEnvironmentRuntime {
  readonly entries: readonly MetaverseSceneMountableEnvironmentEntryRuntime[] | null;
  readonly seats: readonly MetaverseSceneMountableEnvironmentSeatRuntime[];
  readonly traversalAffordance: "mount";
}

export interface MetaverseEnvironmentProofRuntime
  extends MetaverseSceneEnvironmentProofRuntime<MetaverseEnvironmentDynamicAssetRuntime> {
  readonly anchorGroup: Group;
  readonly dynamicAssets: readonly MetaverseEnvironmentDynamicAssetRuntime[];
  readonly instancedAssets: readonly MetaverseEnvironmentInstancedAssetRuntime[];
  readonly staticPlacements: readonly MetaverseEnvironmentStaticPlacementRuntime[];
}

export interface DynamicEnvironmentPoseSnapshot {
  readonly position: MetaverseVector3Snapshot;
  readonly yawRadians: number;
}

const environmentLodSwitchHysteresisMeters = 1.25;
const environmentLodSwitchCooldownMs = 180;
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

function resolveEnvironmentLodIndexForDistance(
  lods: readonly MetaverseEnvironmentLodObjectRuntime[],
  distanceMeters: number
): number {
  for (let lodIndex = 0; lodIndex < lods.length; lodIndex += 1) {
    const maxDistanceMeters = lods[lodIndex]?.maxDistanceMeters;

    if (maxDistanceMeters === undefined) {
      continue;
    }

    if (maxDistanceMeters === null) {
      return lodIndex;
    }

    if (distanceMeters <= maxDistanceMeters) {
      return lodIndex;
    }
  }

  return Math.max(0, lods.length - 1);
}

function resolveEnvironmentLodIndex(
  lods: readonly MetaverseEnvironmentLodObjectRuntime[],
  activeLodIndex: number,
  distanceSquared: number,
  nowMs: number,
  lastLodSwitchAtMs: number
): number {
  const distanceMeters = Math.sqrt(distanceSquared);
  const distanceBasedLodIndex = resolveEnvironmentLodIndexForDistance(
    lods,
    distanceMeters
  );

  if (
    activeLodIndex < 0 ||
    activeLodIndex >= lods.length ||
    distanceBasedLodIndex === activeLodIndex
  ) {
    return distanceBasedLodIndex;
  }

  if (nowMs - lastLodSwitchAtMs < environmentLodSwitchCooldownMs) {
    return activeLodIndex;
  }

  const movingCloser = distanceBasedLodIndex < activeLodIndex;

  if (!movingCloser) {
    const activeMaxDistanceMeters = lods[activeLodIndex]?.maxDistanceMeters;

    if (
      activeMaxDistanceMeters === undefined ||
      activeMaxDistanceMeters === null
    ) {
      return activeLodIndex;
    }

    if (
      distanceMeters <
      activeMaxDistanceMeters + environmentLodSwitchHysteresisMeters
    ) {
      return activeLodIndex;
    }

    return distanceBasedLodIndex;
  }

  const previousMaxDistanceMeters =
    lods[activeLodIndex - 1]?.maxDistanceMeters;

  if (
    previousMaxDistanceMeters !== undefined &&
    previousMaxDistanceMeters !== null &&
    distanceMeters >
      previousMaxDistanceMeters - environmentLodSwitchHysteresisMeters
  ) {
    return activeLodIndex;
  }

  return distanceBasedLodIndex;
}

function setEnvironmentLodVisibility(
  lods: readonly MetaverseEnvironmentLodObjectRuntime[],
  lodIndex: number
): void {
  for (let index = 0; index < lods.length; index += 1) {
    const lodObject = lods[index]!.object;
    const nextVisible = index === lodIndex;

    if (lodObject.visible === nextVisible) {
      continue;
    }

    lodObject.visible = nextVisible;
    markMetaverseSceneBundleGroupsDirty(lodObject);
  }
}

function measurePlacementDistanceSquared(
  cameraSnapshot: MetaverseCameraSnapshot,
  placement: MetaverseEnvironmentPlacementProofConfig
): number {
  const dx = cameraSnapshot.position.x - placement.position.x;
  const dy = cameraSnapshot.position.y - placement.position.y;
  const dz = cameraSnapshot.position.z - placement.position.z;

  return dx * dx + dy * dy + dz * dz;
}

export function resolveDynamicEnvironmentBasePose(
  dynamicAssetRuntime: MetaverseEnvironmentDynamicAssetRuntime,
  dynamicEnvironmentPoseOverrides: ReadonlyMap<string, DynamicEnvironmentPoseSnapshot>
): DynamicEnvironmentPoseSnapshot {
  const overriddenPose = dynamicEnvironmentPoseOverrides.get(
    dynamicAssetRuntime.environmentAssetId
  );

  if (overriddenPose !== undefined) {
    return overriddenPose;
  }

  return Object.freeze({
    position: freezeVector3(
      dynamicAssetRuntime.basePlacement.position.x,
      dynamicAssetRuntime.basePlacement.position.y,
      dynamicAssetRuntime.basePlacement.position.z
    ),
    yawRadians: resolveEnvironmentSimulationYawFromRenderYaw(
      dynamicAssetRuntime,
      dynamicAssetRuntime.basePlacement.rotationYRadians
    )
  });
}

export function syncDynamicEnvironmentSimulationPose(
  dynamicAssetRuntime: MetaverseEnvironmentDynamicAssetRuntime,
  dynamicEnvironmentPoseOverrides: ReadonlyMap<string, DynamicEnvironmentPoseSnapshot>
): void {
  const basePose = resolveDynamicEnvironmentBasePose(
    dynamicAssetRuntime,
    dynamicEnvironmentPoseOverrides
  );
  const renderYawRadians = resolveEnvironmentRenderYawFromSimulationYaw(
    dynamicAssetRuntime,
    basePose.yawRadians
  );

  dynamicAssetRuntime.anchorGroup.position.set(
    basePose.position.x,
    basePose.position.y,
    basePose.position.z
  );
  dynamicAssetRuntime.anchorGroup.rotation.set(0, renderYawRadians, 0);
  const scaleVector = resolveMetaverseWorldSurfaceScaleVector(
    dynamicAssetRuntime.basePlacement.scale
  );

  dynamicAssetRuntime.anchorGroup.scale.set(
    scaleVector.x,
    scaleVector.y,
    scaleVector.z
  );
}

export function syncEnvironmentProofRuntime(
  environmentProofRuntime: MetaverseEnvironmentProofRuntime,
  cameraSnapshot: MetaverseCameraSnapshot,
  nowMs: number,
  dynamicEnvironmentPoseOverrides: ReadonlyMap<string, DynamicEnvironmentPoseSnapshot> =
    new Map()
): void {
  for (const staticPlacementRuntime of environmentProofRuntime.staticPlacements) {
    const lodIndex = resolveEnvironmentLodIndex(
      staticPlacementRuntime.lods,
      staticPlacementRuntime.activeLodIndex,
      measurePlacementDistanceSquared(
        cameraSnapshot,
        staticPlacementRuntime.placement
      ),
      nowMs,
      staticPlacementRuntime.lastLodSwitchAtMs
    );

    if (lodIndex !== staticPlacementRuntime.activeLodIndex) {
      setEnvironmentLodVisibility(staticPlacementRuntime.lods, lodIndex);
      staticPlacementRuntime.activeLodIndex = lodIndex;
      staticPlacementRuntime.lastLodSwitchAtMs = nowMs;
    }
  }

  for (const instancedAssetRuntime of environmentProofRuntime.instancedAssets) {
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;

    for (const placement of instancedAssetRuntime.placements) {
      const distanceSquared = measurePlacementDistanceSquared(
        cameraSnapshot,
        placement
      );

      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
      }
    }

    const lodIndex = resolveEnvironmentLodIndex(
      instancedAssetRuntime.lods,
      instancedAssetRuntime.activeLodIndex,
      nearestDistanceSquared,
      nowMs,
      instancedAssetRuntime.lastLodSwitchAtMs
    );

    if (lodIndex !== instancedAssetRuntime.activeLodIndex) {
      setEnvironmentLodVisibility(instancedAssetRuntime.lods, lodIndex);
      instancedAssetRuntime.activeLodIndex = lodIndex;
      instancedAssetRuntime.lastLodSwitchAtMs = nowMs;
    }
  }

  for (const dynamicAssetRuntime of environmentProofRuntime.dynamicAssets) {
    syncDynamicEnvironmentSimulationPose(
      dynamicAssetRuntime,
      dynamicEnvironmentPoseOverrides
    );

    if (dynamicAssetRuntime.traversalAffordance === "mount") {
      dynamicAssetRuntime.presentationGroup.position.set(
        0,
        Math.sin(nowMs * 0.0014 + dynamicAssetRuntime.motionPhase) * 0.18,
        0
      );
      dynamicAssetRuntime.presentationGroup.rotation.set(
        Math.sin(nowMs * 0.001 + dynamicAssetRuntime.motionPhase) * 0.03,
        0,
        Math.sin(nowMs * 0.0011 + dynamicAssetRuntime.motionPhase) * 0.04
      );
    } else {
      dynamicAssetRuntime.presentationGroup.position.set(0, 0, 0);
      dynamicAssetRuntime.presentationGroup.rotation.set(0, 0, 0);
    }
    dynamicAssetRuntime.presentationGroup.scale.setScalar(1);
    dynamicAssetRuntime.anchorGroup.updateMatrixWorld(true);
  }
}
