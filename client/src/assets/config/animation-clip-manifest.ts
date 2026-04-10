import { createAnimationClipId } from "../types/asset-id";
import {
  canonicalAnimationClipNamesByVocabulary,
  defineAnimationClipManifest
} from "../types/animation-clip-manifest";

export const metaverseMannequinIdleAnimationClipId = createAnimationClipId(
  "metaverse-mannequin-idle-v1"
);

export const animationClipManifest = defineAnimationClipManifest([
  {
    id: metaverseMannequinIdleAnimationClipId,
    label: "Metaverse mannequin idle",
    sourcePath: "/models/metaverse/characters/metaverse-mannequin.gltf",
    clipName: canonicalAnimationClipNamesByVocabulary.idle,
    targetSkeleton: "humanoid_v1",
    vocabulary: "idle",
    loopMode: "repeat"
  }
] as const);
