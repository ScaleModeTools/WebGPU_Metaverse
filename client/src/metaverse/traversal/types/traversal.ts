import {
  type MetaverseGroundedBodyRuntime,
  type PhysicsVector3Snapshot,
  type RapierColliderHandle,
  type RapierPhysicsRuntime,
  type RapierQueryFilterPredicate
} from "@/physics";
import type {
  MetaverseTraversalPlayerBodyBlockerSnapshot,
  MetaverseSurfaceDriveBodyRuntimeSnapshot as SharedMetaverseSurfaceDriveBodyRuntimeSnapshot,
  MetaverseSurfaceTraversalConfig as SharedMetaverseSurfaceTraversalConfig,
  MetaverseSurfaceTraversalSpeedSnapshot as SharedMetaverseSurfaceTraversalSpeedSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type {
  MetaversePlayerTraversalActionIntentSnapshot,
  MetaversePlayerTraversalBodyControlSnapshot,
  MetaversePlayerTraversalIntentSnapshot,
  MetaverseWorldSurfaceSupportSnapshot
} from "@webgpu-metaverse/shared";

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

export interface MetaverseIssuedTraversalIntentSnapshot {
  readonly actionIntent: MetaversePlayerTraversalActionIntentSnapshot;
  readonly bodyControl: MetaversePlayerTraversalBodyControlSnapshot;
  readonly locomotionMode: "grounded" | "swim";
  readonly sequence: number;
}

export type MetaverseIssuedTraversalIntentInputSnapshot = Pick<
  MetaversePlayerTraversalIntentSnapshot,
  | "actionIntent"
  | "bodyControl"
  | "locomotionMode"
  | "sequence"
>;

export function createMetaverseIssuedTraversalIntentSnapshot(
  snapshot:
    | Pick<
        MetaversePlayerTraversalIntentSnapshot,
        | "actionIntent"
        | "bodyControl"
        | "locomotionMode"
        | "sequence"
      >
    | null
    | undefined
): MetaverseIssuedTraversalIntentSnapshot | null {
  if (snapshot === null || snapshot === undefined) {
    return null;
  }

  return Object.freeze({
    actionIntent: snapshot.actionIntent,
    bodyControl: snapshot.bodyControl,
    locomotionMode: snapshot.locomotionMode,
    sequence: snapshot.sequence
  });
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
  readonly readGroundedTraversalPlayerBlockers?: (() =>
    readonly MetaverseTraversalPlayerBodyBlockerSnapshot[]) | undefined;
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
  readonly support: MetaverseWorldSurfaceSupportSnapshot | null;
  readonly supportHeightMeters: number | null;
}

export type TraversalMountedVehicleSnapshot = MountedVehicleRuntimeSnapshot;

export interface RoutedDriverVehicleControlIntentSnapshot {
  readonly controlIntent: MountedVehicleControlIntent;
  readonly environmentAssetId: string;
}
