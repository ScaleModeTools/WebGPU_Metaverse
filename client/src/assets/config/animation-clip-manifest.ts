import { createAnimationClipId } from "../types/asset-id";
import {
  animationVocabularyIds,
  canonicalAnimationClipNamesByVocabulary,
  defineAnimationClipManifest
} from "../types/animation-clip-manifest";
import type { AnimationVocabularyId } from "../types/animation-clip-manifest";

export const mesh2motionHumanoidCanonicalAnimationPackSourcePath =
  "/models/metaverse/characters/mesh2motion-humanoid-canonical-animations.glb";

export const mesh2motionHumanoidUnarmedIdleAnimationPackSourcePath =
  "/models/metaverse/characters/mesh2motion-humanoid-unarmed-idle.glb";

export const mesh2motionHumanoidIdleAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-idle-v1"
);

export const mesh2motionHumanoidWalkAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-walk-v1"
);

export const mesh2motionHumanoidJumpUpAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-jump-up-v1"
);

export const mesh2motionHumanoidJumpMidAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-jump-mid-v1"
);

export const mesh2motionHumanoidJumpDownAnimationClipId =
  createAnimationClipId("mesh2motion-humanoid-jump-down-v1");

export const mesh2motionHumanoidSwimIdleAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-swim-idle-v1"
);

export const mesh2motionHumanoidSwimAnimationClipId = createAnimationClipId(
  "mesh2motion-humanoid-swim-v1"
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

const mesh2motionHumanoidAnimationClipIdByVocabulary = Object.freeze({
  idle: mesh2motionHumanoidIdleAnimationClipId,
  walk: mesh2motionHumanoidWalkAnimationClipId,
  "swim-idle": mesh2motionHumanoidSwimIdleAnimationClipId,
  swim: mesh2motionHumanoidSwimAnimationClipId,
  "jump-up": mesh2motionHumanoidJumpUpAnimationClipId,
  "jump-mid": mesh2motionHumanoidJumpMidAnimationClipId,
  "jump-down": mesh2motionHumanoidJumpDownAnimationClipId,
  aim: mesh2motionHumanoidAimAnimationClipId,
  interact: mesh2motionHumanoidInteractAnimationClipId,
  seated: mesh2motionHumanoidSeatedAnimationClipId
} as const);

const mesh2motionHumanoidLoopModeByVocabulary = Object.freeze({
  idle: "repeat",
  walk: "repeat",
  "swim-idle": "repeat",
  swim: "repeat",
  "jump-up": "once",
  "jump-mid": "repeat",
  "jump-down": "once",
  aim: "repeat",
  interact: "once",
  seated: "repeat"
} as const satisfies Readonly<Record<AnimationVocabularyId, "once" | "repeat">>);

const mesh2motionHumanoidAnimationClipSourcePathByVocabulary = Object.freeze({
  idle: mesh2motionHumanoidUnarmedIdleAnimationPackSourcePath,
  walk: mesh2motionHumanoidCanonicalAnimationPackSourcePath,
  "swim-idle": mesh2motionHumanoidCanonicalAnimationPackSourcePath,
  swim: mesh2motionHumanoidCanonicalAnimationPackSourcePath,
  "jump-up": mesh2motionHumanoidCanonicalAnimationPackSourcePath,
  "jump-mid": mesh2motionHumanoidCanonicalAnimationPackSourcePath,
  "jump-down": mesh2motionHumanoidCanonicalAnimationPackSourcePath,
  aim: mesh2motionHumanoidCanonicalAnimationPackSourcePath,
  interact: mesh2motionHumanoidCanonicalAnimationPackSourcePath,
  seated: mesh2motionHumanoidCanonicalAnimationPackSourcePath
} as const satisfies Readonly<Record<AnimationVocabularyId, string>>);

export const animationClipManifest = defineAnimationClipManifest([
  ...animationVocabularyIds.map((vocabulary) => ({
    id: mesh2motionHumanoidAnimationClipIdByVocabulary[vocabulary],
    label: `Mesh2Motion humanoid ${vocabulary}`,
    sourcePath: mesh2motionHumanoidAnimationClipSourcePathByVocabulary[vocabulary],
    clipName: canonicalAnimationClipNamesByVocabulary[vocabulary],
    targetSkeleton: "humanoid_v2" as const,
    vocabulary,
    loopMode: mesh2motionHumanoidLoopModeByVocabulary[vocabulary]
  }))
] as const);
