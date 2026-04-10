import {
  createCharacterAssetId
} from "../types/asset-id";
import { socketIds } from "../types/asset-socket";
import { defineCharacterAssetManifest } from "../types/character-asset-manifest";
import { metaverseMannequinIdleAnimationClipId } from "./animation-clip-manifest";

export const metaverseMannequinCharacterAssetId = createCharacterAssetId(
  "metaverse-mannequin-v1"
);

export const metaverseMannequinArmsCharacterAssetId = createCharacterAssetId(
  "metaverse-mannequin-arms-v1"
);

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

const metaverseMannequinAnimationClipIds = [
  metaverseMannequinIdleAnimationClipId
] as const;

export const characterModelManifest = defineCharacterAssetManifest([
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
