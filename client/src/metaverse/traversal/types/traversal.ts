import {
  type MetaverseGroundedBodyRuntime,
  type PhysicsVector3Snapshot,
  type RapierColliderHandle,
  type RapierPhysicsRuntime,
  type RapierQueryFilterPredicate
} from "@/physics";
import type {
  MetaverseSurfaceDriveBodyRuntimeSnapshot as SharedMetaverseSurfaceDriveBodyRuntimeSnapshot,
  MetaverseSurfaceTraversalConfig as SharedMetaverseSurfaceTraversalConfig,
  MetaverseSurfaceTraversalSpeedSnapshot as SharedMetaverseSurfaceTraversalSpeedSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

import type {
  MountedEnvironmentSnapshot
} from "../../types/mounted";
import type { MetaverseEnvironmentAssetProofConfig } from "../../types/proof";
import type { MetaversePlacedCuboidColliderSnapshot } from "../../states/metaverse-environment-collision";
import type {
  MountedVehicleControlIntent,
  MountedVehicleRuntimeSnapshot
} from "../../vehicles";

export type SurfaceLocomotionConfig = SharedMetaverseSurfaceTraversalConfig;

export type SurfaceLocomotionSnapshot =
  SharedMetaverseSurfaceDriveBodyRuntimeSnapshot;

export type SurfaceLocomotionSpeedSnapshot =
  SharedMetaverseSurfaceTraversalSpeedSnapshot;

export interface DynamicEnvironmentPoseSnapshot {
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

export interface MountedEnvironmentAnchorSnapshot {
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseTraversalRuntimeDependencies {
  readonly groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly physicsRuntime: RapierPhysicsRuntime;
  readonly readWallClockMs?: (() => number) | undefined;
  readonly readDynamicEnvironmentCollisionPose: (
    environmentAssetId: string
  ) => DynamicEnvironmentPoseSnapshot | null;
  readonly readMountedEnvironmentAnchorSnapshot: (
    mountedEnvironment: MountedEnvironmentSnapshot
  ) => MountedEnvironmentAnchorSnapshot | null;
  readonly readMountableEnvironmentConfig: (
    environmentAssetId: string
  ) => Pick<
    MetaverseEnvironmentAssetProofConfig,
    "collider" | "entries" | "environmentAssetId" | "label" | "seats"
  > | null;
  readonly resolveGroundedTraversalFilterPredicate: (
    excludedColliders?: readonly RapierColliderHandle[]
  ) => RapierQueryFilterPredicate;
  readonly resolveWaterborneTraversalFilterPredicate: (
    excludedOwnerEnvironmentAssetId?: string | null,
    excludedColliders?: readonly RapierColliderHandle[]
  ) => RapierQueryFilterPredicate;
  readonly setDynamicEnvironmentPose: (
    environmentAssetId: string,
    poseSnapshot: DynamicEnvironmentPoseSnapshot | null
  ) => void;
  readonly surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];
}

export type AutomaticSurfaceLocomotionModeId = "grounded" | "swim";

export interface AutomaticSurfaceLocomotionDecision {
  readonly locomotionMode: AutomaticSurfaceLocomotionModeId;
  readonly supportHeightMeters: number | null;
}

export type TraversalMountedVehicleSnapshot = MountedVehicleRuntimeSnapshot;

export interface RoutedDriverVehicleControlIntentSnapshot {
  readonly controlIntent: MountedVehicleControlIntent;
  readonly environmentAssetId: string;
}
