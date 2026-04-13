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

export interface AttachmentVector3Descriptor {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface AttachmentSocketGripAlignmentDescriptor {
  readonly attachmentGripMarkerNodeName?: string | null;
  readonly attachmentGripMarkerNodeNameBySocketId?: Partial<
    Record<SocketId, string | null>
  >;
  readonly socketForwardAxis: AttachmentVector3Descriptor;
  readonly socketOffset: AttachmentVector3Descriptor;
  readonly socketUpAxis: AttachmentVector3Descriptor;
}

export interface AttachmentGripAlignmentAxisDescriptor
  extends AttachmentSocketGripAlignmentDescriptor {
  readonly attachmentForwardAxis: AttachmentVector3Descriptor;
  readonly attachmentUpAxis: AttachmentVector3Descriptor;
}

export interface AttachmentGripAlignmentMarkerDescriptor
  extends AttachmentSocketGripAlignmentDescriptor {
  readonly attachmentForwardMarkerNodeName: string;
  readonly attachmentUpMarkerNodeName: string;
}

export type AttachmentGripAlignmentDescriptor =
  | AttachmentGripAlignmentAxisDescriptor
  | AttachmentGripAlignmentMarkerDescriptor;

export interface AttachmentSupportPointDescriptor {
  readonly localPosition: AttachmentVector3Descriptor;
  readonly supportPointId: string;
}

export interface AttachmentMountedHolsterDescriptor {
  readonly gripAlignment: AttachmentGripAlignmentDescriptor;
  readonly socketName: string;
}

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
  readonly gripAlignment: AttachmentGripAlignmentDescriptor;
  readonly mountedHolster: AttachmentMountedHolsterDescriptor | null;
  readonly supportPoints: readonly AttachmentSupportPointDescriptor[] | null;
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
