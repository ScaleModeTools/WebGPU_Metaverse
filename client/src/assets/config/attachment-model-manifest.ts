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
    compatibleSkeletons: ["humanoid_v1", "humanoid_v2"],
    gripAlignment: {
      attachmentForwardMarkerNodeName: "metaverse_service_pistol_forward_marker",
      attachmentGripMarkerNodeNameBySocketId: {
        hand_l_socket: "metaverse_service_pistol_grip_left_marker",
        hand_r_socket: "metaverse_service_pistol_grip_right_marker"
      },
      attachmentUpMarkerNodeName: "metaverse_service_pistol_up_marker",
      socketForwardAxis: {
        x: 1,
        y: 0,
        z: 0
      },
      socketOffset: {
        x: 0,
        y: 0,
        z: 0
      },
      socketUpAxis: {
        x: 0,
        y: -1,
        z: 0
      }
    },
    mountedHolster: {
      socketName: "back_socket",
      gripAlignment: {
        attachmentForwardMarkerNodeName:
          "metaverse_service_pistol_forward_marker",
        attachmentGripMarkerNodeName:
          "metaverse_service_pistol_holster_marker",
        attachmentUpMarkerNodeName: "metaverse_service_pistol_up_marker",
        socketForwardAxis: {
          x: 0,
          y: -1,
          z: 0
        },
        socketOffset: {
          x: 0.16,
          y: -0.02,
          z: -0.04
        },
        socketUpAxis: {
          x: 0,
          y: 0,
          z: -1
        }
      }
    },
    supportPoints: null
  }
] as const);
