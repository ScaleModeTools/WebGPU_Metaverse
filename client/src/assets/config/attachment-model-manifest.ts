import { createAttachmentAssetId } from "../types/asset-id";
import { defineAttachmentAssetManifest } from "../types/attachment-asset-manifest";

export const metaverseServicePistolAttachmentAssetId = createAttachmentAssetId(
  "metaverse-service-pistol-v1"
);

export const attachmentModelManifest = defineAttachmentAssetManifest([
  {
    id: metaverseServicePistolAttachmentAssetId,
    label: "Metaverse service pistol",
    category: "handheld",
    renderModel: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    defaultSocketId: "hand_r_socket",
    allowedSocketIds: ["hand_r_socket", "hand_l_socket", "hip_socket"],
    compatibleSkeletons: ["humanoid_v1"]
  }
] as const);
