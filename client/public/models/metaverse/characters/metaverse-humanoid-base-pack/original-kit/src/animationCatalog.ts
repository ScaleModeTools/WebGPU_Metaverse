// Auto-generated from /mnt/data/2ways.glb.
// This is the seed catalog for the uploaded two-animation GLB. Run scripts/inspect-glb.mjs
// against the future 126-animation GLB and replace/extend this data.

export const TWO_WAYS_ANIMATION_CATALOG = [
  {
    "id": "rest_pose",
    "clipName": "Rest Pose",
    "durationSeconds": 0.375,
    "loop": false,
    "defaultMask": "all",
    "tags": [
      "pose",
      "rest"
    ],
    "translationTargets": [
      "pelvis"
    ],
    "targetPathCounts": {
      "rotation": 66,
      "translation": 1
    },
    "interpolationCounts": {
      "STEP": 67
    }
  },
  {
    "id": "walk_loop",
    "clipName": "Walk_Loop",
    "durationSeconds": 1.666667,
    "loop": true,
    "defaultMask": "locomotionCore",
    "tags": [
      "locomotion",
      "walk",
      "loop"
    ],
    "translationTargets": [
      "pelvis"
    ],
    "targetPathCounts": {
      "rotation": 66,
      "translation": 1
    },
    "interpolationCounts": {
      "STEP": 45,
      "LINEAR": 22
    }
  }
] as const;

export type TwoWaysAnimationId = typeof TWO_WAYS_ANIMATION_CATALOG[number]["id"];

export const TWO_WAYS_ANIMATION_BY_ID = Object.fromEntries(
  TWO_WAYS_ANIMATION_CATALOG.map((clip) => [clip.id, clip])
) as Record<TwoWaysAnimationId, typeof TWO_WAYS_ANIMATION_CATALOG[number]>;

export function getTwoWaysClipName(id: TwoWaysAnimationId): string {
  return TWO_WAYS_ANIMATION_BY_ID[id].clipName;
}
