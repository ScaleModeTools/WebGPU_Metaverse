import type { RegistryById } from "@webgpu-metaverse/shared";

import type { AnimationClipId } from "./asset-id";
import type { SkeletonId } from "./asset-socket";
import type { AnimationVocabularyId } from "./animation-vocabulary";
export {
  animationVocabularyIds,
  canonicalAnimationClipNamesByVocabulary
} from "./animation-vocabulary";
export type { AnimationVocabularyId } from "./animation-vocabulary";

export const animationClipLoopModes = ["once", "repeat"] as const;

export type AnimationClipLoopMode = (typeof animationClipLoopModes)[number];

export interface AnimationClipDescriptor<
  TId extends AnimationClipId = AnimationClipId
> {
  readonly id: TId;
  readonly label: string;
  readonly sourcePath: string;
  readonly clipName: string;
  readonly targetSkeleton: SkeletonId;
  readonly vocabulary: AnimationVocabularyId;
  readonly loopMode: AnimationClipLoopMode;
}

export interface AnimationClipManifest<
  TEntries extends readonly AnimationClipDescriptor[] =
    readonly AnimationClipDescriptor[]
> {
  readonly clips: TEntries;
  readonly byId: RegistryById<TEntries>;
}

export function defineAnimationClipManifest<
  const TEntries extends readonly AnimationClipDescriptor[]
>(clips: TEntries): AnimationClipManifest<TEntries> {
  const byId = Object.fromEntries(
    clips.map((clip) => [clip.id, clip] as const)
  ) as RegistryById<TEntries>;

  return {
    clips,
    byId
  };
}
