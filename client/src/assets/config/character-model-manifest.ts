import {
  createCharacterAssetId
} from "../types/asset-id";
import { socketIds } from "../types/asset-socket";
import { defineCharacterAssetManifest } from "../types/character-asset-manifest";
import {
  mesh2motionHumanoidAimAnimationClipId,
  mesh2motionHumanoidIdleAnimationClipId,
  mesh2motionHumanoidInteractAnimationClipId,
  mesh2motionHumanoidJumpDownAnimationClipId,
  mesh2motionHumanoidJumpMidAnimationClipId,
  mesh2motionHumanoidJumpUpAnimationClipId,
  mesh2motionHumanoidSeatedAnimationClipId,
  mesh2motionHumanoidSwimAnimationClipId,
  mesh2motionHumanoidSwimIdleAnimationClipId,
  mesh2motionHumanoidWalkAnimationClipId
} from "./animation-clip-manifest";

export const mesh2motionHumanoidCharacterAssetId = createCharacterAssetId(
  "mesh2motion-humanoid-v1"
);

export const metaverseActiveFullBodyCharacterAssetId =
  mesh2motionHumanoidCharacterAssetId;

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

const mesh2motionHumanoidAnimationClipIds = [
  mesh2motionHumanoidIdleAnimationClipId,
  mesh2motionHumanoidWalkAnimationClipId,
  mesh2motionHumanoidSwimIdleAnimationClipId,
  mesh2motionHumanoidSwimAnimationClipId,
  mesh2motionHumanoidJumpUpAnimationClipId,
  mesh2motionHumanoidJumpMidAnimationClipId,
  mesh2motionHumanoidJumpDownAnimationClipId,
  mesh2motionHumanoidAimAnimationClipId,
  mesh2motionHumanoidInteractAnimationClipId,
  mesh2motionHumanoidSeatedAnimationClipId
] as const;

export const characterModelManifest = defineCharacterAssetManifest([
  {
    id: mesh2motionHumanoidCharacterAssetId,
    label: "Mesh2Motion humanoid",
    skeleton: "humanoid_v2",
    presentationModes: ["first-person-arms", "full-body", "npc"],
    socketIds,
    renderModel: mesh2motionHumanoidRenderModel,
    collisionPath: mesh2motionHumanoidCollisionPath,
    animationClipIds: mesh2motionHumanoidAnimationClipIds
  }
] as const);
