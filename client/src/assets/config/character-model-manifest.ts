import {
  createCharacterAssetId
} from "../types/asset-id";
import { socketIds } from "../types/asset-socket";
import { defineCharacterAssetManifest } from "../types/character-asset-manifest";
import {
  mesh2motionHumanoidAimAnimationClipId,
  mesh2motionHumanoidIdleAnimationClipId,
  mesh2motionHumanoidInteractAnimationClipId,
  mesh2motionHumanoidSeatedAnimationClipId,
  mesh2motionHumanoidWalkAnimationClipId,
  metaverseMannequinAimAnimationClipId,
  metaverseMannequinIdleAnimationClipId,
  metaverseMannequinInteractAnimationClipId,
  metaverseMannequinSeatedAnimationClipId,
  metaverseMannequinWalkAnimationClipId
} from "./animation-clip-manifest";

export const metaverseMannequinCharacterAssetId = createCharacterAssetId(
  "metaverse-mannequin-v1"
);

export const metaverseMannequinArmsCharacterAssetId = createCharacterAssetId(
  "metaverse-mannequin-arms-v1"
);

export const mesh2motionHumanoidCharacterAssetId = createCharacterAssetId(
  "mesh2motion-humanoid-v1"
);

export const metaverseActiveFullBodyCharacterAssetId =
  mesh2motionHumanoidCharacterAssetId;

const metaverseMannequinRenderModel = Object.freeze({
  defaultTier: "high",
  lods: [
    {
      tier: "high",
      modelPath: "/models/metaverse/characters/metaverse-mannequin.gltf",
      maxDistanceMeters: null
    }
  ]
} as const);

const metaverseMannequinCollisionPath =
  "/models/metaverse/characters/metaverse-mannequin-collision.gltf";

const mesh2motionHumanoidRenderModel = Object.freeze({
  defaultTier: "high",
  lods: [
    {
      tier: "high",
      modelPath: "/models/metaverse/characters/mesh2motion-humanoid.glb",
      maxDistanceMeters: null
    }
  ]
} as const);

const mesh2motionHumanoidCollisionPath =
  "/models/metaverse/characters/mesh2motion-humanoid-collision.glb";

const metaverseMannequinAnimationClipIds = [
  metaverseMannequinIdleAnimationClipId,
  metaverseMannequinWalkAnimationClipId,
  metaverseMannequinAimAnimationClipId,
  metaverseMannequinInteractAnimationClipId,
  metaverseMannequinSeatedAnimationClipId
] as const;

const mesh2motionHumanoidAnimationClipIds = [
  mesh2motionHumanoidIdleAnimationClipId,
  mesh2motionHumanoidWalkAnimationClipId,
  mesh2motionHumanoidAimAnimationClipId,
  mesh2motionHumanoidInteractAnimationClipId,
  mesh2motionHumanoidSeatedAnimationClipId
] as const;

export const characterModelManifest = defineCharacterAssetManifest([
  {
    id: mesh2motionHumanoidCharacterAssetId,
    label: "Mesh2Motion humanoid",
    skeleton: "humanoid_v2",
    presentationModes: ["full-body", "npc"],
    socketIds,
    renderModel: mesh2motionHumanoidRenderModel,
    collisionPath: mesh2motionHumanoidCollisionPath,
    animationClipIds: mesh2motionHumanoidAnimationClipIds
  },
  {
    id: metaverseMannequinCharacterAssetId,
    label: "Metaverse mannequin",
    skeleton: "humanoid_v1",
    presentationModes: ["first-person-arms", "full-body", "npc"],
    socketIds,
    renderModel: metaverseMannequinRenderModel,
    collisionPath: metaverseMannequinCollisionPath,
    animationClipIds: metaverseMannequinAnimationClipIds
  },
  {
    id: metaverseMannequinArmsCharacterAssetId,
    label: "Metaverse mannequin arms proof",
    skeleton: "humanoid_v1",
    presentationModes: ["first-person-arms"],
    socketIds,
    renderModel: metaverseMannequinRenderModel,
    collisionPath: metaverseMannequinCollisionPath,
    animationClipIds: metaverseMannequinAnimationClipIds
  }
] as const);
