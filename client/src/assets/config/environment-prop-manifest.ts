import { createEnvironmentAssetId } from "../types/asset-id";
import { defineEnvironmentAssetManifest } from "../types/environment-asset-manifest";

export const metaverseHubCrateEnvironmentAssetId = createEnvironmentAssetId(
  "metaverse-hub-crate-v1"
);

export const metaverseHubDockEnvironmentAssetId = createEnvironmentAssetId(
  "metaverse-hub-dock-v1"
);

export const metaverseHubSkiffEnvironmentAssetId = createEnvironmentAssetId(
  "metaverse-hub-skiff-v1"
);

export const environmentPropManifest = defineEnvironmentAssetManifest([
  {
    id: metaverseHubCrateEnvironmentAssetId,
    label: "Metaverse hub crate",
    placement: "instanced",
    renderModel: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/environment/metaverse-hub-crate-high.gltf",
          maxDistanceMeters: 18
        },
        {
          tier: "low",
          modelPath: "/models/metaverse/environment/metaverse-hub-crate-low.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    collider: null,
    collisionPath: null,
    mount: null
  },
  {
    id: metaverseHubDockEnvironmentAssetId,
    label: "Metaverse hub dock",
    placement: "static",
    renderModel: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/environment/metaverse-hub-dock-high.gltf",
          maxDistanceMeters: 28
        },
        {
          tier: "low",
          modelPath: "/models/metaverse/environment/metaverse-hub-dock-low.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    collider: null,
    collisionPath: null,
    mount: null
  },
  {
    id: metaverseHubSkiffEnvironmentAssetId,
    label: "Metaverse hub skiff",
    placement: "dynamic",
    renderModel: {
      defaultTier: "high",
      lods: [
        {
          tier: "high",
          modelPath: "/models/metaverse/environment/metaverse-hub-skiff.gltf",
          maxDistanceMeters: null
        }
      ]
    },
    collider: {
      center: {
        x: 0,
        y: 1.05,
        z: 0
      },
      shape: "box",
      size: {
        x: 5.2,
        y: 2.4,
        z: 2.8
      }
    },
    collisionPath: "/models/metaverse/environment/metaverse-hub-skiff-collision.gltf",
    mount: {
      seatSocketId: "seat_socket"
    }
  }
] as const);
