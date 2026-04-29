# 2ways.glb rig breakdown

## Asset summary

| Field | Value |
| --- | --- |
| Source file | 2ways.glb |
| Generator | THREE.GLTFExporter r183 |
| Skinned meshes | 1 |
| Skins | 1 |
| Joints in skin | 66 |
| Mesh vertices | 8722 |
| Mesh indices | 41139 |
| Animations | Rest Pose, Walk_Loop |

## Important findings

- The file contains **one skinned mesh**, **one skin**, and **66 joints**.
- The skin skeleton root is `root`.
- The two animations in the uploaded file are `Rest Pose` and `Walk_Loop`; the future 126-animation file should use this same skeleton and bone-name contract.
- Animation tracks target **rotations on 66 bones** plus **pelvis translation**. There are no scale tracks.
- `Rest Pose` is a stepped hold clip with two keyed samples and starts at 0.041667 seconds rather than 0.0 seconds. Normalize starts to 0.0 in your build pipeline if you want clean clip math.
- `Walk_Loop` is 1.666667 seconds long, sampled like a 24 fps / 40-frame loop. It has 41 samples on moving channels and matching first/last pelvis translation values.

## Animation summary

| Clip | Duration s | Channels | Target bones | Target paths | Interpolation | Translation target |
| --- | --- | --- | --- | --- | --- | --- |
| Rest Pose | 0.375000 | 67 | 66 | {"rotation": 66, "translation": 1} | {"STEP": 67} | pelvis |
| Walk_Loop | 1.666667 | 67 | 66 | {"rotation": 66, "translation": 1} | {"STEP": 45, "LINEAR": 22} | pelvis |

## Recommended runtime architecture

Keep a single canonical mesh/rig GLB for the avatar, and keep animation clips in named animation packs. The all-in-one 126-animation GLB is useful as an authoring/source-of-truth file, but production runtime usually benefits from lazy-loaded packs such as `locomotion`, `emotes`, `interactions`, and `hands`. This keeps initial metaverse entry fast while preserving a single manifest-driven API for `getClip("walk_loop")`.

Use this rule: **same skeleton names + same hierarchy = clips can bind by bone name**. Any future animation GLB should be validated against this manifest before it ships.

## Bone nomenclature

| Joint # | Bone | Human alias | Parent | Side | Category | End leaf | Weighted verts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | root | root / scene-scale orientation bone |  | center | root |  | 0 |
| 1 |   pelvis | hips / pelvis driver | root | center | hips |  | 0 |
| 2 |     spine_01 | lower spine | pelvis | center | spine |  | 692 |
| 3 |       spine_02 | mid spine | spine_01 | center | spine |  | 359 |
| 4 |         spine_03 | upper spine / chest | spine_02 | center | spine |  | 169 |
| 5 |           neck_01 | neck | spine_03 | center | head_neck |  | 204 |
| 6 |             head | head | neck_01 | center | head_neck |  | 149 |
| 7 |               head_leaf | head end / head tip | head | center | head_neck | yes | 193 |
| 8 |           clavicle_l | left clavicle / shoulder | spine_03 | left | arm |  | 195 |
| 9 |             upperarm_l | left upper arm | clavicle_l | left | arm |  | 166 |
| 10 |               lowerarm_l | left forearm | upperarm_l | left | arm |  | 116 |
| 11 |                 hand_l | left wrist / hand | lowerarm_l | left | arm |  | 88 |
| 12 |                   index_01_l | left index finger proximal / base | hand_l | left | finger |  | 392 |
| 13 |                     index_02_l | left index finger intermediate / middle | index_01_l | left | finger |  | 283 |
| 14 |                       index_03_l | left index finger distal | index_02_l | left | finger |  | 177 |
| 15 |                         index_04_leaf_l | left index finger tip end | index_03_l | left | finger |  | 29 |
| 16 |                   middle_01_l | left middle finger proximal / base | hand_l | left | finger |  | 387 |
| 17 |                     middle_02_l | left middle finger intermediate / middle | middle_01_l | left | finger |  | 311 |
| 18 |                       middle_03_l | left middle finger distal | middle_02_l | left | finger |  | 185 |
| 19 |                         middle_04_leaf_l | left middle finger tip end | middle_03_l | left | finger |  | 22 |
| 20 |                   pinky_01_l | left pinky finger proximal / base | hand_l | left | finger |  | 414 |
| 21 |                     pinky_02_l | left pinky finger intermediate / middle | pinky_01_l | left | finger |  | 243 |
| 22 |                       pinky_03_l | left pinky finger distal | pinky_02_l | left | finger |  | 162 |
| 23 |                         pinky_04_leaf_l | left pinky finger tip end | pinky_03_l | left | finger |  | 25 |
| 24 |                   ring_01_l | left ring finger proximal / base | hand_l | left | finger |  | 396 |
| 25 |                     ring_02_l | left ring finger intermediate / middle | ring_01_l | left | finger |  | 253 |
| 26 |                       ring_03_l | left ring finger distal | ring_02_l | left | finger |  | 166 |
| 27 |                         ring_04_leaf_l | left ring finger tip end | ring_03_l | left | finger |  | 28 |
| 28 |                   thumb_01_l | left thumb base / CMC-metacarpal | hand_l | left | finger |  | 179 |
| 29 |                     thumb_02_l | left thumb proximal | thumb_01_l | left | finger |  | 263 |
| 30 |                       thumb_03_l | left thumb distal | thumb_02_l | left | finger |  | 139 |
| 31 |                         thumb_04_leaf_l | left thumb tip end | thumb_03_l | left | finger |  | 0 |
| 32 |           clavicle_r | right clavicle / shoulder | spine_03 | right | arm |  | 192 |
| 33 |             upperarm_r | right upper arm | clavicle_r | right | arm |  | 166 |
| 34 |               lowerarm_r | right forearm | upperarm_r | right | arm |  | 116 |
| 35 |                 hand_r | right wrist / hand | lowerarm_r | right | arm |  | 88 |
| 36 |                   index_01_r | right index finger proximal / base | hand_r | right | finger |  | 392 |
| 37 |                     index_02_r | right index finger intermediate / middle | index_01_r | right | finger |  | 283 |
| 38 |                       index_03_r | right index finger distal | index_02_r | right | finger |  | 177 |
| 39 |                         index_04_leaf_r | right index finger tip end | index_03_r | right | finger |  | 29 |
| 40 |                   middle_01_r | right middle finger proximal / base | hand_r | right | finger |  | 387 |
| 41 |                     middle_02_r | right middle finger intermediate / middle | middle_01_r | right | finger |  | 311 |
| 42 |                       middle_03_r | right middle finger distal | middle_02_r | right | finger |  | 185 |
| 43 |                         middle_04_leaf_r | right middle finger tip end | middle_03_r | right | finger |  | 22 |
| 44 |                   pinky_01_r | right pinky finger proximal / base | hand_r | right | finger |  | 414 |
| 45 |                     pinky_02_r | right pinky finger intermediate / middle | pinky_01_r | right | finger |  | 243 |
| 46 |                       pinky_03_r | right pinky finger distal | pinky_02_r | right | finger |  | 161 |
| 47 |                         pinky_04_leaf_r | right pinky finger tip end | pinky_03_r | right | finger |  | 25 |
| 48 |                   ring_01_r | right ring finger proximal / base | hand_r | right | finger |  | 396 |
| 49 |                     ring_02_r | right ring finger intermediate / middle | ring_01_r | right | finger |  | 254 |
| 50 |                       ring_03_r | right ring finger distal | ring_02_r | right | finger |  | 166 |
| 51 |                         ring_04_leaf_r | right ring finger tip end | ring_03_r | right | finger |  | 28 |
| 52 |                   thumb_01_r | right thumb base / CMC-metacarpal | hand_r | right | finger |  | 179 |
| 53 |                     thumb_02_r | right thumb proximal | thumb_01_r | right | finger |  | 263 |
| 54 |                       thumb_03_r | right thumb distal | thumb_02_r | right | finger |  | 139 |
| 55 |                         thumb_04_leaf_r | right thumb tip end | thumb_03_r | right | finger |  | 0 |
| 56 |     thigh_l | left thigh / upper leg | pelvis | left | leg |  | 260 |
| 57 |       calf_l | left calf / lower leg | thigh_l | left | leg |  | 127 |
| 58 |         foot_l | left foot | calf_l | left | leg |  | 157 |
| 59 |           ball_l | left ball / toe base | foot_l | left | leg |  | 40 |
| 60 |             ball_leaf_l | left toe end | ball_l | left | leg |  | 18 |
| 61 |     thigh_r | right thigh / upper leg | pelvis | right | leg |  | 285 |
| 62 |       calf_r | right calf / lower leg | thigh_r | right | leg |  | 127 |
| 63 |         foot_r | right foot | calf_r | right | leg |  | 157 |
| 64 |           ball_r | right ball / toe base | foot_r | right | leg |  | 40 |
| 65 |             ball_leaf_r | right toe end | ball_r | right | leg |  | 18 |

## Bone groups

| Group | Count | Bones |
| --- | --- | --- |
| all | 66 | root, pelvis, spine_01, spine_02, spine_03, neck_01, head, head_leaf, clavicle_l, upperarm_l, lowerarm_l, hand_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, thumb_01_l, thumb_02_l, thumb_03_l, thumb_04_leaf_l, clavicle_r, upperarm_r, lowerarm_r, hand_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, thumb_01_r, thumb_02_r, thumb_03_r, thumb_04_leaf_r, thigh_l, calf_l, foot_l, ball_l, ball_leaf_l, thigh_r, calf_r, foot_r, ball_r, ball_leaf_r |
| weightedJoints | 62 | spine_01, spine_02, spine_03, neck_01, head, head_leaf, clavicle_l, upperarm_l, lowerarm_l, hand_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, thumb_01_l, thumb_02_l, thumb_03_l, clavicle_r, upperarm_r, lowerarm_r, hand_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, thumb_01_r, thumb_02_r, thumb_03_r, thigh_l, calf_l, foot_l, ball_l, ball_leaf_l, thigh_r, calf_r, foot_r, ball_r, ball_leaf_r |
| nonWeightedDrivers | 4 | root, pelvis, thumb_04_leaf_l, thumb_04_leaf_r |
| centerline | 8 | root, pelvis, spine_01, spine_02, spine_03, neck_01, head, head_leaf |
| rootMotion | 2 | root, pelvis |
| hips | 1 | pelvis |
| spine | 3 | spine_01, spine_02, spine_03 |
| torso | 4 | pelvis, spine_01, spine_02, spine_03 |
| neckHead | 3 | neck_01, head, head_leaf |
| lookAt | 2 | neck_01, head |
| upperBody | 53 | spine_02, spine_03, neck_01, head, head_leaf, clavicle_l, upperarm_l, lowerarm_l, hand_l, clavicle_r, upperarm_r, lowerarm_r, hand_r, thumb_01_l, thumb_02_l, thumb_03_l, thumb_04_leaf_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l, thumb_01_r, thumb_02_r, thumb_03_r, thumb_04_leaf_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r |
| upperBodyNoFingers | 13 | spine_02, spine_03, neck_01, head, head_leaf, clavicle_l, upperarm_l, lowerarm_l, hand_l, clavicle_r, upperarm_r, lowerarm_r, hand_r |
| lowerBody | 11 | pelvis, thigh_l, calf_l, foot_l, ball_l, ball_leaf_l, thigh_r, calf_r, foot_r, ball_r, ball_leaf_r |
| leftArm | 4 | clavicle_l, upperarm_l, lowerarm_l, hand_l |
| rightArm | 4 | clavicle_r, upperarm_r, lowerarm_r, hand_r |
| arms | 8 | clavicle_l, upperarm_l, lowerarm_l, hand_l, clavicle_r, upperarm_r, lowerarm_r, hand_r |
| leftLeg | 5 | thigh_l, calf_l, foot_l, ball_l, ball_leaf_l |
| rightLeg | 5 | thigh_r, calf_r, foot_r, ball_r, ball_leaf_r |
| legs | 10 | thigh_l, calf_l, foot_l, ball_l, ball_leaf_l, thigh_r, calf_r, foot_r, ball_r, ball_leaf_r |
| leftHand | 21 | hand_l, thumb_01_l, thumb_02_l, thumb_03_l, thumb_04_leaf_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l |
| rightHand | 21 | hand_r, thumb_01_r, thumb_02_r, thumb_03_r, thumb_04_leaf_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r |
| hands | 42 | hand_l, thumb_01_l, thumb_02_l, thumb_03_l, thumb_04_leaf_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l, hand_r, thumb_01_r, thumb_02_r, thumb_03_r, thumb_04_leaf_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r |
| leftFingers | 20 | thumb_01_l, thumb_02_l, thumb_03_l, thumb_04_leaf_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l |
| rightFingers | 20 | thumb_01_r, thumb_02_r, thumb_03_r, thumb_04_leaf_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r |
| fingers | 40 | thumb_01_l, thumb_02_l, thumb_03_l, thumb_04_leaf_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l, thumb_01_r, thumb_02_r, thumb_03_r, thumb_04_leaf_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r |
| leftFingerDrivers | 15 | thumb_01_l, thumb_02_l, thumb_03_l, index_01_l, index_02_l, index_03_l, middle_01_l, middle_02_l, middle_03_l, ring_01_l, ring_02_l, ring_03_l, pinky_01_l, pinky_02_l, pinky_03_l |
| rightFingerDrivers | 15 | thumb_01_r, thumb_02_r, thumb_03_r, index_01_r, index_02_r, index_03_r, middle_01_r, middle_02_r, middle_03_r, ring_01_r, ring_02_r, ring_03_r, pinky_01_r, pinky_02_r, pinky_03_r |
| fingerDrivers | 30 | thumb_01_l, thumb_02_l, thumb_03_l, index_01_l, index_02_l, index_03_l, middle_01_l, middle_02_l, middle_03_l, ring_01_l, ring_02_l, ring_03_l, pinky_01_l, pinky_02_l, pinky_03_l, thumb_01_r, thumb_02_r, thumb_03_r, index_01_r, index_02_r, index_03_r, middle_01_r, middle_02_r, middle_03_r, ring_01_r, ring_02_r, ring_03_r, pinky_01_r, pinky_02_r, pinky_03_r |
| fingerTips | 10 | thumb_04_leaf_l, index_04_leaf_l, middle_04_leaf_l, ring_04_leaf_l, pinky_04_leaf_l, thumb_04_leaf_r, index_04_leaf_r, middle_04_leaf_r, ring_04_leaf_r, pinky_04_leaf_r |
| fingerBases | 10 | thumb_01_l, index_01_l, middle_01_l, ring_01_l, pinky_01_l, thumb_01_r, index_01_r, middle_01_r, ring_01_r, pinky_01_r |
| fingerMiddles | 10 | thumb_02_l, index_02_l, middle_02_l, ring_02_l, pinky_02_l, thumb_02_r, index_02_r, middle_02_r, ring_02_r, pinky_02_r |
| fingerDistals | 10 | thumb_03_l, index_03_l, middle_03_l, ring_03_l, pinky_03_l, thumb_03_r, index_03_r, middle_03_r, ring_03_r, pinky_03_r |
| leftInteractionArm | 25 | spine_03, clavicle_l, upperarm_l, lowerarm_l, hand_l, thumb_01_l, thumb_02_l, thumb_03_l, thumb_04_leaf_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l |
| rightInteractionArm | 25 | spine_03, clavicle_r, upperarm_r, lowerarm_r, hand_r, thumb_01_r, thumb_02_r, thumb_03_r, thumb_04_leaf_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r |
| twoHandInteraction | 50 | spine_02, spine_03, clavicle_l, upperarm_l, lowerarm_l, hand_l, clavicle_r, upperarm_r, lowerarm_r, hand_r, thumb_01_l, thumb_02_l, thumb_03_l, thumb_04_leaf_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l, thumb_01_r, thumb_02_r, thumb_03_r, thumb_04_leaf_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r |
| locomotionCore | 15 | root, pelvis, spine_01, spine_02, spine_03, thigh_l, calf_l, foot_l, ball_l, ball_leaf_l, thigh_r, calf_r, foot_r, ball_r, ball_leaf_r |
| locomotionNoUpperBody | 12 | root, pelvis, thigh_l, calf_l, foot_l, ball_l, ball_leaf_l, thigh_r, calf_r, foot_r, ball_r, ball_leaf_r |
| headAndHands | 45 | neck_01, head, head_leaf, hand_l, thumb_01_l, thumb_02_l, thumb_03_l, thumb_04_leaf_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l, hand_r, thumb_01_r, thumb_02_r, thumb_03_r, thumb_04_leaf_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r |
