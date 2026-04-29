import { AnimationClip, KeyframeTrack } from "three";
import { AVATAR_BONE_GROUPS, AvatarBoneGroupName, AvatarBoneName } from "./avatarRig";

/**
 * Extracts a bone name from common Three.js GLTFLoader track formats:
 * - pelvis.position
 * - spine_03.quaternion
 * - SomeArmature.bones[spine_03].quaternion
 * - SomeArmature.skeleton.bones[spine_03].quaternion
 */
export function getBoneNameFromTrackName(trackName: string): string | null {
  const bracketMatch = trackName.match(/\.bones\[([^\]]+)\]\.(position|quaternion|scale)$/);
  if (bracketMatch) return bracketMatch[1];

  const directMatch = trackName.match(/^(.+)\.(position|quaternion|scale)$/);
  if (!directMatch) return null;

  // GLTFLoader sanitizes names, but this rig's names are simple and safe.
  return directMatch[1];
}

export type MaskedClipOptions = {
  /**
   * Most upper-body overlays should not include position tracks.
   * Locomotion clips can set this true to keep pelvis.position.
   */
  includePositionTracks?: boolean;

  /**
   * Scale tracks are not present in 2ways.glb, but this keeps future imports safe.
   */
  includeScaleTracks?: boolean;

  name?: string;
};

/**
 * Three.js does not have built-in bone masks for AnimationMixer. The common solution
 * is to make a derived AnimationClip that only contains tracks for the bones in a mask.
 */
export function createMaskedClip(
  clip: AnimationClip,
  bones: Iterable<AvatarBoneName | string>,
  options: MaskedClipOptions = {}
): AnimationClip {
  const boneSet = new Set([...bones].map(String));

  const tracks = clip.tracks.filter((track: KeyframeTrack) => {
    const boneName = getBoneNameFromTrackName(track.name);
    if (!boneName || !boneSet.has(boneName)) return false;
    if (!options.includePositionTracks && track.name.endsWith(".position")) return false;
    if (!options.includeScaleTracks && track.name.endsWith(".scale")) return false;
    return true;
  });

  return new AnimationClip(options.name ?? `${clip.name}__masked`, clip.duration, tracks);
}

export function createMaskedClipFromGroup(
  clip: AnimationClip,
  groupName: AvatarBoneGroupName,
  options: MaskedClipOptions = {}
): AnimationClip {
  return createMaskedClip(clip, AVATAR_BONE_GROUPS[groupName], {
    name: options.name ?? `${clip.name}__${groupName}`,
    ...options,
  });
}

export function listClipTargetBones(clip: AnimationClip): string[] {
  const names = new Set<string>();
  for (const track of clip.tracks) {
    const boneName = getBoneNameFromTrackName(track.name);
    if (boneName) names.add(boneName);
  }
  return [...names].sort();
}
