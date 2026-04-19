import {
  resolveMetaverseMountedOccupancyPresentationStateSnapshot,
  type MetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";
import type { MountedEnvironmentSnapshot } from "../../types/metaverse-runtime";

export interface MetaverseSceneMountedPresentationSnapshot {
  readonly mountedEnvironment: MountedEnvironmentSnapshot | null;
  readonly mountedOccupancyPresentationState:
    | MetaverseMountedOccupancyPresentationStateSnapshot
    | null;
}

export function createMetaverseSceneMountedPresentationSnapshot(
  mountedEnvironment: MountedEnvironmentSnapshot | null = null
): MetaverseSceneMountedPresentationSnapshot {
  return Object.freeze({
    mountedEnvironment,
    mountedOccupancyPresentationState:
      resolveMetaverseMountedOccupancyPresentationStateSnapshot(
        mountedEnvironment
      )
  });
}
