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

export interface AttachmentMountSocketDescriptor {
  readonly adsCameraAnchorNodeName?: string | null;
  readonly attachmentSocketNodeName?: string | null;
  readonly attachmentSocketNodeNameBySocketId?: Partial<
    Record<SocketId, string | null>
  >;
  readonly forwardReferenceNodeName?: string | null;
  readonly triggerMarkerNodeName?: string | null;
  readonly upReferenceNodeName?: string | null;
}

export interface AttachmentSupportPointDescriptor {
  readonly authoringNodeName?: string | null;
  readonly localPosition: AttachmentVector3Descriptor;
  readonly supportPointId: string;
}

export type AttachmentOffHandSupportPointIdBySocketId = Partial<
  Record<SocketId, string | null>
>;

export type AttachmentMountTargetSocketName =
  | SocketId
  | "back_socket"
  | "grip_l_socket"
  | "grip_r_socket"
  | "palm_l_socket"
  | "palm_r_socket";

export interface AttachmentMountedHolsterDescriptor {
  readonly attachmentSocketNodeName: string;
  readonly socketName: AttachmentMountTargetSocketName;
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
  readonly heldMount: AttachmentMountSocketDescriptor;
  readonly mountedHolster: AttachmentMountedHolsterDescriptor | null;
  readonly offHandSupportPointIdBySocketId?:
    | AttachmentOffHandSupportPointIdBySocketId
    | null;
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
