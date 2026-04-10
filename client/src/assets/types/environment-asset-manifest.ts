import type { RegistryById } from "@webgpu-metaverse/shared";

import type { EnvironmentAssetId } from "./asset-id";
import type { AssetLodGroup } from "./asset-lod";
import type { SocketId } from "./asset-socket";

export const environmentAssetPlacements = [
  "instanced",
  "static",
  "dynamic"
] as const;

export type EnvironmentAssetPlacement =
  (typeof environmentAssetPlacements)[number];

export interface EnvironmentColliderVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface EnvironmentBoxColliderDescriptor {
  readonly center: EnvironmentColliderVector3;
  readonly shape: "box";
  readonly size: EnvironmentColliderVector3;
}

export interface EnvironmentMountDescriptor {
  readonly seatSocketId: SocketId;
}

export interface EnvironmentAssetDescriptor<
  TId extends EnvironmentAssetId = EnvironmentAssetId
> {
  readonly id: TId;
  readonly label: string;
  readonly placement: EnvironmentAssetPlacement;
  readonly physicsColliders: readonly EnvironmentBoxColliderDescriptor[] | null;
  readonly renderModel: AssetLodGroup;
  readonly collider: EnvironmentBoxColliderDescriptor | null;
  readonly collisionPath: string | null;
  readonly mount: EnvironmentMountDescriptor | null;
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
