import type { RegistryById } from "@webgpu-metaverse/shared";

import type { AnimationClipId, CharacterAssetId } from "./asset-id";
import type { AssetLodGroup } from "./asset-lod";
import type { SkeletonId, SocketId } from "./asset-socket";

export const characterPresentationModeIds = [
  "first-person-arms",
  "full-body",
  "npc"
] as const;

export type CharacterPresentationModeId =
  (typeof characterPresentationModeIds)[number];

export interface CharacterAssetDescriptor<
  TId extends CharacterAssetId = CharacterAssetId
> {
  readonly id: TId;
  readonly label: string;
  readonly skeleton: SkeletonId;
  readonly presentationModes: readonly CharacterPresentationModeId[];
  readonly socketIds: readonly SocketId[];
  readonly renderModel: AssetLodGroup;
  readonly collisionPath: string | null;
  readonly animationClipIds: readonly AnimationClipId[];
}

export interface CharacterAssetManifest<
  TEntries extends readonly CharacterAssetDescriptor[] =
    readonly CharacterAssetDescriptor[]
> {
  readonly characters: TEntries;
  readonly byId: RegistryById<TEntries>;
}

export function defineCharacterAssetManifest<
  const TEntries extends readonly CharacterAssetDescriptor[]
>(characters: TEntries): CharacterAssetManifest<TEntries> {
  const byId = Object.fromEntries(
    characters.map((character) => [character.id, character] as const)
  ) as RegistryById<TEntries>;

  return {
    characters,
    byId
  };
}
