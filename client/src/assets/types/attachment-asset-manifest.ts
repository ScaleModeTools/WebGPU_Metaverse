import type { RegistryById } from "@webgpu-metaverse/shared";

import type { AttachmentAssetId } from "./asset-id";
import type { AssetLodGroup } from "./asset-lod";
import type { SkeletonId, SocketId } from "./asset-socket";
import type {
  HeldObjectHoldProfileDescriptor,
  HeldObjectSocketRoleId,
} from "./held-object-authoring-manifest";

export const attachmentCategoryIds = [
  "handheld",
  "wearable",
  "hip-mounted",
] as const;

export type AttachmentCategoryId = (typeof attachmentCategoryIds)[number];

export interface AttachmentVector3Descriptor {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface AttachmentMountSocketDescriptor {
  readonly adsCameraTargetOffset?: AttachmentAimBasisOffsetDescriptor | null;
  readonly attachmentSocketRole: HeldObjectSocketRoleId;
}

export interface AttachmentAimBasisOffsetDescriptor {
  readonly across: number;
  readonly forward: number;
  readonly up: number;
}

export type AttachmentMountTargetSocketName =
  | SocketId
  | "back_socket"
  | "grip_l_socket"
  | "grip_r_socket"
  | "palm_l_socket"
  | "palm_r_socket";

export interface AttachmentMountedHolsterDescriptor {
  readonly attachmentSocketRole: HeldObjectSocketRoleId;
  readonly socketName: AttachmentMountTargetSocketName;
}

export interface AttachmentAssetDescriptor<
  TId extends AttachmentAssetId = AttachmentAssetId,
> {
  readonly id: TId;
  readonly label: string;
  readonly category: AttachmentCategoryId;
  readonly renderModel: AssetLodGroup;
  readonly defaultSocketId: SocketId;
  readonly allowedSocketIds: readonly SocketId[];
  readonly compatibleSkeletons: readonly SkeletonId[];
  readonly heldMount: AttachmentMountSocketDescriptor;
  readonly holdProfile: HeldObjectHoldProfileDescriptor;
  readonly mountedHolster: AttachmentMountedHolsterDescriptor | null;
}

export interface AttachmentAssetManifest<
  TEntries extends readonly AttachmentAssetDescriptor[] =
    readonly AttachmentAssetDescriptor[],
> {
  readonly attachments: TEntries;
  readonly byId: RegistryById<TEntries>;
}

export function defineAttachmentAssetManifest<
  const TEntries extends readonly AttachmentAssetDescriptor[],
>(attachments: TEntries): AttachmentAssetManifest<TEntries> {
  const byId = Object.fromEntries(
    attachments.map((attachment) => [attachment.id, attachment] as const),
  ) as RegistryById<TEntries>;

  return {
    attachments,
    byId,
  };
}
