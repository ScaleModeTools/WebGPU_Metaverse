import type { RegistryById } from "@webgpu-metaverse/shared";

import type { AttachmentAssetId } from "./asset-id";
import type { AssetLodGroup } from "./asset-lod";
import type { SkeletonId, SocketId } from "./asset-socket";

export const attachmentCategoryIds = [
  "handheld",
  "wearable",
  "hip-mounted"
] as const;

export type AttachmentCategoryId = (typeof attachmentCategoryIds)[number];

export interface AttachmentAssetDescriptor<
  TId extends AttachmentAssetId = AttachmentAssetId
> {
  readonly id: TId;
  readonly label: string;
  readonly category: AttachmentCategoryId;
  readonly renderModel: AssetLodGroup;
  readonly defaultSocketId: SocketId;
  readonly allowedSocketIds: readonly SocketId[];
  readonly compatibleSkeletons: readonly SkeletonId[];
}

export interface AttachmentAssetManifest<
  TEntries extends readonly AttachmentAssetDescriptor[] =
    readonly AttachmentAssetDescriptor[]
> {
  readonly attachments: TEntries;
  readonly byId: RegistryById<TEntries>;
}

export function defineAttachmentAssetManifest<
  const TEntries extends readonly AttachmentAssetDescriptor[]
>(attachments: TEntries): AttachmentAssetManifest<TEntries> {
  const byId = Object.fromEntries(
    attachments.map((attachment) => [attachment.id, attachment] as const)
  ) as RegistryById<TEntries>;

  return {
    attachments,
    byId
  };
}
