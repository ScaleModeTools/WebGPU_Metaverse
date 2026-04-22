export const humanoidV2HeadAnchorNodeNames = Object.freeze({
  head: "head",
  headLeaf: "head_leaf",
  headSocket: "head_socket",
  neck: "neck_01"
} as const);

// Held-weapon presentation restores the sampled pistol pose before solving, so
// the pistol overlay owns only the neutral torso/clavicle/finger hold while
// the IK runtime owns the arm chain.
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

// Held-weapon aiming now keeps the authored pistol overlay on its neutral hold
// and lets IK own pitch response for the arm chain.
export const humanoidV2PistolPitchDrivenTrackPrefixes = Object.freeze([] as const);

export const humanoidV2PistolLowerBodyTrackPrefixes = Object.freeze([
  "root",
  "pelvis",
  "spine_01",
  "thigh_l",
  "calf_l",
  "foot_l",
  "ball_l",
  "ball_leaf_l",
  "thigh_r",
  "calf_r",
  "foot_r",
  "ball_r",
  "ball_leaf_r"
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

export function isHumanoidV2PistolPitchDrivenTrack(
  trackName: string
): boolean {
  return humanoidV2PistolPitchDrivenTrackPrefixes.some((prefix) =>
    matchesAnimationTrackPrefix(trackName, prefix)
  );
}

export function isHumanoidV2PistolLowerBodyTrack(trackName: string): boolean {
  return humanoidV2PistolLowerBodyTrackPrefixes.some((prefix) =>
    matchesAnimationTrackPrefix(trackName, prefix)
  );
}
