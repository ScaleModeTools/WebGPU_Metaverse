import { Group, Object3D, Quaternion, Vector3 } from "three/webgpu";
import type {
  MetaverseWorldMountedOccupancyPolicySnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import type {
  FocusedMountableSnapshot,
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentColliderProofConfig,
  MetaverseEnvironmentEntryProofConfig,
  MetaverseEnvironmentSeatProofConfig,
  MountedEnvironmentSnapshot
} from "../../types/metaverse-runtime";

export interface MetaverseSceneMountableEnvironmentEntryRuntime {
  readonly anchorGroup: Object3D;
  readonly entry: MetaverseEnvironmentEntryProofConfig;
}

export interface MetaverseSceneMountableEnvironmentSeatRuntime {
  readonly anchorGroup: Object3D;
  readonly seat: MetaverseEnvironmentSeatProofConfig;
}

export interface MetaverseSceneDynamicEnvironmentRuntime {
  readonly anchorGroup: Group;
  readonly collider: MetaverseEnvironmentColliderProofConfig;
  readonly entries: readonly MetaverseSceneMountableEnvironmentEntryRuntime[] | null;
  readonly environmentAssetId: string;
  readonly label: string;
  readonly seats: readonly MetaverseSceneMountableEnvironmentSeatRuntime[] | null;
  readonly traversalAffordance: MetaverseEnvironmentAssetProofConfig["traversalAffordance"];
}

export interface MetaverseSceneEnvironmentProofRuntime<
  TDynamicEnvironmentRuntime extends MetaverseSceneDynamicEnvironmentRuntime = MetaverseSceneDynamicEnvironmentRuntime
> {
  readonly dynamicAssets: readonly TDynamicEnvironmentRuntime[];
}

export interface MetaverseSceneMountableEnvironmentRuntime
  extends MetaverseSceneDynamicEnvironmentRuntime {
  readonly entries: readonly MetaverseSceneMountableEnvironmentEntryRuntime[] | null;
  readonly seats: readonly MetaverseSceneMountableEnvironmentSeatRuntime[];
  readonly traversalAffordance: "mount";
}

export interface MetaverseSceneMountedCharacterPresentationRuntime {
  readonly anchorGroup: Group;
  readonly seatSocketNode: Object3D;
}

export interface ResolvedMountedEnvironmentSelection
  extends MetaverseWorldMountedOccupancyPolicySnapshot {
  readonly anchorGroup: Object3D;
}

export interface MountedCharacterRuntime<
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime = MetaverseSceneMountableEnvironmentRuntime
> {
  readonly cameraPolicyId: MountedEnvironmentSnapshot["cameraPolicyId"];
  readonly controlRoutingPolicyId: MountedEnvironmentSnapshot["controlRoutingPolicyId"];
  readonly entryId: string | null;
  readonly environmentAsset: TEnvironmentRuntime;
  readonly lookLimitPolicyId: MountedEnvironmentSnapshot["lookLimitPolicyId"];
  readonly occupancyAnimationId: MountedEnvironmentSnapshot["occupancyAnimationId"];
  readonly occupancyKind: MountedEnvironmentSnapshot["occupancyKind"];
  readonly occupiedAnchorGroup: Object3D;
  readonly occupantLabel: MountedEnvironmentSnapshot["occupantLabel"];
  readonly occupantRole: MountedEnvironmentSnapshot["occupantRole"];
  readonly previousParent: Object3D;
  readonly previousPosition: Vector3;
  readonly previousQuaternion: Quaternion;
  readonly previousScale: Vector3;
  readonly seatId: string | null;
}

export interface MountedEnvironmentSelectionReference {
  readonly environmentAssetId: string;
  readonly entryId: string | null;
  readonly occupancyKind: MountedEnvironmentSnapshot["occupancyKind"];
  readonly occupantRole: MountedEnvironmentSnapshot["occupantRole"];
  readonly seatId: string | null;
}

export interface MetaverseSceneInteractionSnapshot {
  readonly focusedMountable: FocusedMountableSnapshot | null;
}

export interface FocusedMountableEnvironmentRuntime<
  TEnvironmentRuntime extends MetaverseSceneMountableEnvironmentRuntime
> {
  readonly distanceFromCamera: number;
  readonly environmentAsset: TEnvironmentRuntime;
}

export function isMetaverseSceneMountableEnvironmentRuntime<
  TDynamicEnvironmentRuntime extends MetaverseSceneDynamicEnvironmentRuntime
>(
  environmentAsset: TDynamicEnvironmentRuntime
): environmentAsset is TDynamicEnvironmentRuntime &
  MetaverseSceneMountableEnvironmentRuntime {
  return (
    environmentAsset.traversalAffordance === "mount" &&
    environmentAsset.seats !== null &&
    environmentAsset.seats.length > 0
  );
}
