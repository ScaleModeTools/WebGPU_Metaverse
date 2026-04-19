import type { RegistryById } from "@webgpu-metaverse/shared";
import type { VehicleOrientationDescriptor } from "@webgpu-metaverse/shared";

import type { EnvironmentAssetId } from "./asset-id";
import type { AssetLodDescriptor, LodTierId } from "./asset-lod";
import type {
  MountedVehicleCameraPolicyId,
  MountedVehicleControlRoutingPolicyId,
  MountedVehicleLookLimitPolicyId,
  MountedVehicleOccupancyAnimationId,
  MountedVehicleSeatRoleId
} from "./environment-seat";

export const environmentAssetPlacements = [
  "instanced",
  "static",
  "dynamic"
] as const;

export type EnvironmentAssetPlacement =
  (typeof environmentAssetPlacements)[number];

export const environmentTraversalAffordanceIds = [
  "support",
  "blocker",
  "mount"
] as const;

export type EnvironmentTraversalAffordanceId =
  (typeof environmentTraversalAffordanceIds)[number];

export const environmentPhysicsColliderTraversalAffordanceIds = [
  "support",
  "blocker"
] as const;

export type EnvironmentPhysicsColliderTraversalAffordanceId =
  (typeof environmentPhysicsColliderTraversalAffordanceIds)[number];

export interface EnvironmentVector3Descriptor {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type EnvironmentColliderVector3 = EnvironmentVector3Descriptor;

export const environmentProceduralMaterialPresetIds = [
  "training-range-surface",
  "training-range-accent"
] as const;

export type EnvironmentProceduralMaterialPresetId =
  (typeof environmentProceduralMaterialPresetIds)[number];

export interface EnvironmentProceduralBoxLodDescriptor {
  readonly kind: "procedural-box";
  readonly materialPreset: EnvironmentProceduralMaterialPresetId;
  readonly maxDistanceMeters: number | null;
  readonly size: EnvironmentVector3Descriptor;
  readonly tier: LodTierId;
}

export type EnvironmentRenderLodDescriptor =
  | AssetLodDescriptor
  | EnvironmentProceduralBoxLodDescriptor;

export interface EnvironmentRenderLodGroup {
  readonly defaultTier: LodTierId;
  readonly lods: readonly EnvironmentRenderLodDescriptor[];
}

export interface EnvironmentBoxColliderDescriptor {
  readonly center: EnvironmentVector3Descriptor;
  readonly shape: "box";
  readonly size: EnvironmentVector3Descriptor;
}

export interface EnvironmentPhysicsBoxColliderDescriptor
  extends EnvironmentBoxColliderDescriptor {
  readonly traversalAffordance: EnvironmentPhysicsColliderTraversalAffordanceId;
}

export interface EnvironmentDynamicBodyDescriptor {
  readonly additionalMass: number;
  readonly angularDamping: number;
  readonly gravityScale: number;
  readonly kind: "dynamic-rigid-body";
  readonly linearDamping: number;
  readonly lockRotations: boolean;
}

export interface EnvironmentSeatDescriptor {
  readonly cameraPolicyId: MountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MountedVehicleControlRoutingPolicyId;
  readonly directEntryEnabled: boolean;
  readonly dismountOffset: EnvironmentVector3Descriptor;
  readonly label: string;
  readonly lookLimitPolicyId: MountedVehicleLookLimitPolicyId;
  readonly occupancyAnimationId: MountedVehicleOccupancyAnimationId;
  readonly seatId: string;
  readonly seatNodeName: string;
  readonly seatRole: MountedVehicleSeatRoleId;
}

export interface EnvironmentEntryDescriptor {
  readonly cameraPolicyId: MountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MountedVehicleControlRoutingPolicyId;
  readonly dismountOffset: EnvironmentVector3Descriptor;
  readonly entryId: string;
  readonly entryNodeName: string;
  readonly label: string;
  readonly lookLimitPolicyId: MountedVehicleLookLimitPolicyId;
  readonly occupancyAnimationId: MountedVehicleOccupancyAnimationId;
  readonly occupantRole: MountedVehicleSeatRoleId;
}

export interface EnvironmentAssetDescriptor<
  TId extends EnvironmentAssetId = EnvironmentAssetId
> {
  readonly id: TId;
  readonly label: string;
  readonly placement: EnvironmentAssetPlacement;
  readonly dynamicBody?: EnvironmentDynamicBodyDescriptor | null;
  readonly physicsColliders:
    | readonly EnvironmentPhysicsBoxColliderDescriptor[]
    | null;
  readonly renderModel: EnvironmentRenderLodGroup;
  readonly orientation: VehicleOrientationDescriptor | null;
  readonly collider: EnvironmentBoxColliderDescriptor | null;
  readonly collisionPath: string | null;
  readonly entries: readonly EnvironmentEntryDescriptor[] | null;
  readonly seats: readonly EnvironmentSeatDescriptor[] | null;
  readonly traversalAffordance: EnvironmentTraversalAffordanceId;
}

export interface EnvironmentAssetManifest<
  TEntries extends readonly EnvironmentAssetDescriptor[] =
    readonly EnvironmentAssetDescriptor[]
> {
  readonly environmentAssets: TEntries;
  readonly byId: RegistryById<TEntries>;
}

export function defineEnvironmentAssetManifest<
  const TEntries extends readonly EnvironmentAssetDescriptor[]
>(environmentAssets: TEntries): EnvironmentAssetManifest<TEntries> {
  const byId = Object.fromEntries(
    environmentAssets.map((environmentAsset) => [
      environmentAsset.id,
      environmentAsset
    ] as const)
  ) as RegistryById<TEntries>;

  return {
    environmentAssets,
    byId
  };
}
