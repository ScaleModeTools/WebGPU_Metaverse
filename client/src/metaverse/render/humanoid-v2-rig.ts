import { AnimationClip, type KeyframeTrack } from "three/webgpu";

import { humanoidV2BoneGroups } from "@/assets/types/asset-socket";
import type {
  HumanoidV2BoneGroupName,
  HumanoidV2BoneName
} from "@/assets/types/asset-socket";

export const humanoidV2HeadAnchorNodeNames = Object.freeze({
  head: "head",
  headLeaf: "head_leaf",
  headSocket: "head_socket",
  neck: "neck_01"
} as const);

export function getHumanoidV2BoneNameFromTrackName(
  trackName: string
): string | null {
  const bracketMatch = trackName.match(
    /\.bones\[([^\]]+)\]\.(position|quaternion|rotation|scale)$/
  );

  if (bracketMatch !== null) {
    return bracketMatch[1] ?? null;
  }

  const directMatch = trackName.match(
    /^(.+)\.(position|quaternion|rotation|scale)$/
  );

  return directMatch?.[1] ?? null;
}

export interface HumanoidV2MaskedClipOptions {
  readonly includePositionTracks?: boolean;
  readonly includeScaleTracks?: boolean;
  readonly name?: string;
}

export function createHumanoidV2MaskedClip(
  clip: AnimationClip,
  boneNames: Iterable<HumanoidV2BoneName | string>,
  options: HumanoidV2MaskedClipOptions = {}
): AnimationClip {
  const boneNameSet = new Set([...boneNames].map(String));
  const tracks = clip.tracks.filter((track: KeyframeTrack) => {
    const boneName = getHumanoidV2BoneNameFromTrackName(track.name);

    if (boneName === null || !boneNameSet.has(boneName)) {
      return false;
    }

    if (options.includePositionTracks !== true && track.name.endsWith(".position")) {
      return false;
    }

    if (options.includeScaleTracks !== true && track.name.endsWith(".scale")) {
      return false;
    }

    return true;
  });

  return new AnimationClip(
    options.name ?? `${clip.name}__masked`,
    clip.duration,
    tracks,
    clip.blendMode
  );
}

export function createHumanoidV2MaskedClipFromGroup(
  clip: AnimationClip,
  groupName: HumanoidV2BoneGroupName,
  options: HumanoidV2MaskedClipOptions = {}
): AnimationClip {
  return createHumanoidV2MaskedClip(clip, humanoidV2BoneGroups[groupName], {
    name: options.name ?? `${clip.name}__${groupName}`,
    ...options
  });
}

export function listHumanoidV2ClipTargetBones(clip: AnimationClip): string[] {
  const targetBones = new Set<string>();

  for (const track of clip.tracks) {
    const boneName = getHumanoidV2BoneNameFromTrackName(track.name);

    if (boneName !== null) {
      targetBones.add(boneName);
    }
  }

  return [...targetBones].sort();
}
