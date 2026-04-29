import {
  createCharacterAssetId
} from "../types/asset-id";
import { socketIds } from "../types/asset-socket";
import { defineCharacterAssetManifest } from "../types/character-asset-manifest";
import {
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

export const metaverseHumanoidCharacterAssetId = createCharacterAssetId(
  "mesh2motion-humanoid-v1"
);

export const mesh2motionHumanoidCharacterAssetId =
  metaverseHumanoidCharacterAssetId;

export const metaverseActiveFullBodyCharacterAssetId =
  metaverseHumanoidCharacterAssetId;

const mesh2motionHumanoidRenderModel = Object.freeze({
  defaultTier: "high",
  lods: [
    {
      tier: "high",
      modelPath: "/models/metaverse/characters/metaverse-humanoid-base-pack.glb",
      maxDistanceMeters: null
    }
  ]
} as const);

const mesh2motionHumanoidAnimationClipIds = [
  mesh2motionHumanoidIdleAnimationClipId,
  mesh2motionHumanoidWalkAnimationClipId,
  mesh2motionHumanoidSwimIdleAnimationClipId,
  mesh2motionHumanoidSwimAnimationClipId,
  mesh2motionHumanoidJumpUpAnimationClipId,
  mesh2motionHumanoidJumpMidAnimationClipId,
  mesh2motionHumanoidJumpDownAnimationClipId,
  mesh2motionHumanoidInteractAnimationClipId,
  mesh2motionHumanoidSeatedAnimationClipId
] as const;

export const characterModelManifest = defineCharacterAssetManifest([
  {
    id: metaverseHumanoidCharacterAssetId,
    label: "Metaverse humanoid",
    skeleton: "humanoid_v2",
    presentationModes: ["first-person-arms", "full-body", "npc"],
    socketIds,
    renderModel: mesh2motionHumanoidRenderModel,
    collisionPath: null,
    animationClipIds: mesh2motionHumanoidAnimationClipIds
  }
] as const);
