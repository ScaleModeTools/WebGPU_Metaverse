import type {
  MetaverseVector3Snapshot,
  MountedEnvironmentSnapshot
} from "../../types/metaverse-runtime";
import type { MountedEnvironmentAnchorSnapshot } from "../../traversal/types/traversal";
import { resolveMountableEnvironmentRuntimeById } from "../mounts/metaverse-scene-mount-runtime-resolution";
import { resolveMountedEnvironmentAnchorSnapshot } from "../mounts/metaverse-scene-mount-snapshots";
import {
  resolveDynamicEnvironmentBasePose,
  syncDynamicEnvironmentSimulationPose,
  type DynamicEnvironmentPoseSnapshot,
  type MetaverseEnvironmentDynamicAssetRuntime,
  type MetaverseEnvironmentProofRuntime
} from "./metaverse-scene-environment-proof-runtime";

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

export class MetaverseSceneDynamicEnvironmentPoseState {
  readonly #dynamicEnvironmentPoseOverrides = new Map<
    string,
    DynamicEnvironmentPoseSnapshot
  >();

  get dynamicEnvironmentPoseOverrides(): ReadonlyMap<
    string,
    DynamicEnvironmentPoseSnapshot
  > {
    return this.#dynamicEnvironmentPoseOverrides;
  }

  clear(): void {
    this.#dynamicEnvironmentPoseOverrides.clear();
  }

  readDynamicEnvironmentPose(
    environmentProofRuntime: MetaverseEnvironmentProofRuntime | null,
    environmentAssetId: string
  ): DynamicEnvironmentPoseSnapshot | null {
    if (environmentProofRuntime === null) {
      return null;
    }

    const dynamicEnvironment = environmentProofRuntime.dynamicAssets.find(
      (candidate) => candidate.environmentAssetId === environmentAssetId
    );

    if (dynamicEnvironment === undefined) {
      return null;
    }

    return resolveDynamicEnvironmentBasePose(
      dynamicEnvironment,
      this.#dynamicEnvironmentPoseOverrides
    );
  }

  readMountedEnvironmentAnchorSnapshot(
    environmentProofRuntime: MetaverseEnvironmentProofRuntime | null,
    mountedEnvironment: MountedEnvironmentSnapshot
  ): MountedEnvironmentAnchorSnapshot | null {
    const environmentAsset = resolveMountableEnvironmentRuntimeById(
      environmentProofRuntime,
      mountedEnvironment.environmentAssetId
    );

    if (environmentAsset === null) {
      return null;
    }

    return resolveMountedEnvironmentAnchorSnapshot(
      environmentAsset,
      mountedEnvironment,
      {
        createPositionSnapshot: freezeVector3,
        syncDynamicEnvironmentSimulationPose: (
          dynamicEnvironment: MetaverseEnvironmentDynamicAssetRuntime
        ) => {
          syncDynamicEnvironmentSimulationPose(
            dynamicEnvironment,
            this.#dynamicEnvironmentPoseOverrides
          );
        }
      }
    );
  }

  setDynamicEnvironmentPose(
    environmentAssetId: string,
    poseSnapshot: DynamicEnvironmentPoseSnapshot | null
  ): void {
    if (poseSnapshot === null) {
      this.#dynamicEnvironmentPoseOverrides.delete(environmentAssetId);
      return;
    }

    this.#dynamicEnvironmentPoseOverrides.set(
      environmentAssetId,
      Object.freeze({
        position: freezeVector3(
          poseSnapshot.position.x,
          poseSnapshot.position.y,
          poseSnapshot.position.z
        ),
        yawRadians: wrapRadians(poseSnapshot.yawRadians)
      })
    );
  }
}
