import type { TypeBrand } from "@webgpu-metaverse/shared";

export type CharacterAssetId<TValue extends string = string> = TypeBrand<
  TValue,
  "CharacterAssetId"
>;

export type AnimationClipId<TValue extends string = string> = TypeBrand<
  TValue,
  "AnimationClipId"
>;

export type AttachmentAssetId<TValue extends string = string> = TypeBrand<
  TValue,
  "AttachmentAssetId"
>;

export type EnvironmentAssetId<TValue extends string = string> = TypeBrand<
  TValue,
  "EnvironmentAssetId"
>;

export function createCharacterAssetId<const TValue extends string>(
  value: TValue
): CharacterAssetId<TValue> {
  return value as CharacterAssetId<TValue>;
}

export function createAnimationClipId<const TValue extends string>(
  value: TValue
): AnimationClipId<TValue> {
  return value as AnimationClipId<TValue>;
}

export function createAttachmentAssetId<const TValue extends string>(
  value: TValue
): AttachmentAssetId<TValue> {
  return value as AttachmentAssetId<TValue>;
}

export function createEnvironmentAssetId<const TValue extends string>(
  value: TValue
): EnvironmentAssetId<TValue> {
  return value as EnvironmentAssetId<TValue>;
}
