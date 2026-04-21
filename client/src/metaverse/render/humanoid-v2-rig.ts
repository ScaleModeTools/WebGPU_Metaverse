export const humanoidV2HeadAnchorNodeNames = Object.freeze({
  head: "head",
  headLeaf: "head_leaf",
  headSocket: "head_socket",
  neck: "neck_01"
} as const);

// The held-weapon IK restores the arm chain before solving, so the authored
// pistol overlay needs upper-torso support on non-driven spine bones.
export const humanoidV2PistolAimOverlayTrackPrefixes = Object.freeze([
  "spine_02",
  "spine_03",
  "clavicle_l",
  "upperarm_l",
  "lowerarm_l",
  "hand_l",
  "clavicle_r",
  "upperarm_r",
  "lowerarm_r",
  "hand_r",
  "thumb_",
  "index_",
  "middle_",
  "ring_",
  "pinky_"
] as const);

function matchesAnimationTrackPrefix(
  trackName: string,
  prefix: string
): boolean {
  return (
    trackName === prefix ||
    trackName.startsWith(prefix) ||
    trackName.includes(`[${prefix}`)
  );
}

export function isHumanoidV2PistolAimOverlayTrack(trackName: string): boolean {
  return humanoidV2PistolAimOverlayTrackPrefixes.some((prefix) =>
    matchesAnimationTrackPrefix(trackName, prefix)
  );
}
