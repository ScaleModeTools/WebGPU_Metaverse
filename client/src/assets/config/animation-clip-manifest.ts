import { createAnimationClipId } from "../types/asset-id";
import {
  animationVocabularyIds,
  canonicalAnimationClipNamesByVocabulary,
  defineAnimationClipManifest
} from "../types/animation-clip-manifest";
import type { AnimationVocabularyId } from "../types/animation-clip-manifest";

export const metaverseMannequinCanonicalAnimationPackSourcePath =
  "/models/metaverse/characters/metaverse-mannequin-canonical-animations.glb";

export const mesh2motionHumanoidCanonicalAnimationPackSourcePath =
  "/models/metaverse/characters/mesh2motion-humanoid-canonical-animations.glb";

export const metaverseMannequinIdleAnimationClipId = createAnimationClipId(
  "metaverse-mannequin-idle-v1"
);

export const metaverseMannequinWalkAnimationClipId = createAnimationClipId(
  "metaverse-mannequin-walk-v1"
);

export const metaverseMannequinAimAnimationClipId = createAnimationClipId(
  "metaverse-mannequin-aim-v1"
);

export const metaverseMannequinInteractAnimationClipId = createAnimationClipId(
  "metaverse-mannequin-interact-v1"
);

export const metaverseMannequinSeatedAnimationClipId = createAnimationClipId(
  "metaverse-mannequin-seated-v1"
);

export const mesh2motionHumanoidIdleAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-idle-v1"
);

export const mesh2motionHumanoidWalkAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-walk-v1"
);

export const mesh2motionHumanoidAimAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-aim-v1"
);

export const mesh2motionHumanoidInteractAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-interact-v1"
);

export const mesh2motionHumanoidSeatedAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-seated-v1"
);

const metaverseMannequinAnimationClipIdByVocabulary = Object.freeze({
  idle: metaverseMannequinIdleAnimationClipId,
  walk: metaverseMannequinWalkAnimationClipId,
  aim: metaverseMannequinAimAnimationClipId,
  interact: metaverseMannequinInteractAnimationClipId,
  seated: metaverseMannequinSeatedAnimationClipId
} as const);

const mesh2motionHumanoidAnimationClipIdByVocabulary = Object.freeze({
  idle: mesh2motionHumanoidIdleAnimationClipId,
  walk: mesh2motionHumanoidWalkAnimationClipId,
  aim: mesh2motionHumanoidAimAnimationClipId,
  interact: mesh2motionHumanoidInteractAnimationClipId,
  seated: mesh2motionHumanoidSeatedAnimationClipId
} as const);

const metaverseMannequinLoopModeByVocabulary = Object.freeze({
  idle: "repeat",
  walk: "repeat",
  aim: "repeat",
  interact: "once",
  seated: "repeat"
} as const satisfies Readonly<Record<AnimationVocabularyId, "once" | "repeat">>);

export const animationClipManifest = defineAnimationClipManifest([
  ...animationVocabularyIds.map((vocabulary) => ({
    id: metaverseMannequinAnimationClipIdByVocabulary[vocabulary],
    label: `Metaverse mannequin ${vocabulary}`,
    sourcePath: metaverseMannequinCanonicalAnimationPackSourcePath,
    clipName: canonicalAnimationClipNamesByVocabulary[vocabulary],
    targetSkeleton: "humanoid_v1" as const,
    vocabulary,
    loopMode: metaverseMannequinLoopModeByVocabulary[vocabulary]
  })),
  ...animationVocabularyIds.map((vocabulary) => ({
    id: mesh2motionHumanoidAnimationClipIdByVocabulary[vocabulary],
    label: `Mesh2Motion humanoid ${vocabulary}`,
    sourcePath: mesh2motionHumanoidCanonicalAnimationPackSourcePath,
    clipName: canonicalAnimationClipNamesByVocabulary[vocabulary],
    targetSkeleton: "humanoid_v2" as const,
    vocabulary,
    loopMode: metaverseMannequinLoopModeByVocabulary[vocabulary]
  }))
] as const);
