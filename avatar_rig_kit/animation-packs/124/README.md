# 124 Animation GLB Pack

Source: `124.glb`

This README is the external map for the animation pack so the GLB does not need to be parsed every time just to know what it contains. It is generated from the GLB channels, targets, timings, and bone activity heuristics.

## At-a-glance

| Metric | Value |
|---|---:|
| Clips | 124 |
| Rig joints | 66 |
| Rig matches 2ways baseline | yes |
| Clips with root translation/root-motion track | 7 |
| Total animation duration | 220.875s |
| Longest clip | Dance Body Roll (6.5s) |
| Duplicate clip names | none |

## Recommended runtime layout

Keep one authoring/source-of-truth GLB containing all 124 clips, but publish smaller runtime packs so avatar spawn does not force every user to download every emote/combat/action. The catalog files in this folder keep the API simple even if the binary payloads are split later.

| Runtime pack | Clips | Purpose |
|---|---:|---|
| combat | 35 | Combat, weapon, hit-reaction, and death library. |
| core-locomotion | 14 | Early-load pack for spawn and normal traversal. |
| idles | 12 | Idle variety pack, good candidate for lazy loading after spawn. |
| locomotion-transitions | 13 | Load when traversal states are enabled. |
| magic-dance-fitness | 14 | High-expression extras: magic, dance, fitness. |
| posture-states | 11 | Sit/sleep/kneel/meditate/crouch states. |
| reference | 2 | Small editor/runtime QA pack. |
| social-emotes | 9 | Player expression and social interactions. |
| vehicle-prop-states | 1 | Vehicle/prop stance and carry/drive states. |
| world-interactions | 13 | Object/world interaction library. |

## Category counts

| Category | Clips | Notes |
|---|---:|---|
| combat_unarmed | 9 | Unarmed fighting, punches, jabs, and melee-style actions. |
| combat_weapon | 21 | Weapon-specific stance, aim, reload, attack, block, dash, and combo clips. |
| damage_death | 5 | Hit reactions, knockback, and death. |
| dance | 4 | Dance loops/one-shots. |
| fitness | 2 | Exercise/fitness loops or actions. |
| idle_state | 12 | Standing idles and prop/context idles for ambient avatar state. |
| interaction_world | 13 | World/object interactions such as pickup, consume, farm, chop, throw, push, fix, and chest use. |
| locomotion | 14 | Playable movement loops and movement states. Most are good candidates for lower-body/locomotionCore masking. |
| locomotion_transition | 13 | Jumps, rolls, climb, slide, acrobatic entries/exits, and root-motion traversal beats. |
| magic_power | 8 | Spell, levitation, power-up, and blast actions. |
| posture_state | 11 | Seated, crouched, kneeling, sleeping, meditative, or tired body states. |
| reference_pose | 2 | Bind/reference poses used for rig QA, retargeting checks, and editor resets. |
| social_emote | 9 | Player-facing emotes, affirmations, greetings, and reactions. |
| vehicle_prop_state | 1 | Vehicle/prop stance loops. |

## Playback kinds

| Playback kind | Clips | Meaning |
|---|---:|---|
| loop | 37 | Name/usage indicates a looping state. |
| loop_candidate | 5 | No explicit Loop suffix, but endpoint pose appears loop-compatible. |
| one_shot | 65 | One-shot action/emote. |
| pose | 2 | Reference/rest pose. |
| transition | 15 | State transition such as start, land, enter, exit, or recovery. |

## Root motion clips

Root-motion clips have an extra `root.translation` track in addition to the normal `pelvis.translation` track. Raw deltas are in the GLB's local coordinate basis.

| Clip | Duration | Playback | Root Δ XYZ | Root distance | Suggested mask |
|---|---:|---|---:|---:|---|
| ClimbUp_1m_RM | 0.666667s | one_shot | 0.000, 1.000, 1.676 | 1.952 | all |
| Crawl RM | 1.708333s | loop_candidate | 0.000, 0.000, 1.305 | 1.305 | locomotionCore |
| Hit_Knockback_RM | 0.833333s | transition | 0.000, 0.000, -3.000 | 3.000 | all |
| Roll_RM | 1.833333s | one_shot | 0.000, 0.000, 4.991 | 4.991 | all |
| Shield_Dash_RM | 1.083333s | one_shot | 0.000, 0.000, 1.000 | 1.000 | all |
| Sword_Attack_RM | 1.916667s | one_shot | 0.000, 0.000, 1.501 | 1.501 | all |
| Sword_Dash_RM | 1.541667s | one_shot | 0.000, 0.000, 3.692 | 3.692 | all |

## How to read the dense index

**Groups** shows the bone groups that move beyond a small threshold: Root, Pelvis, Spine, Head, LArm/RArm, LFing/RFing, LLeg/RLeg. Because the exporter writes most rotations for every clip, group activity is more useful than raw track presence. **Mask** is a runtime suggestion, not a destructive edit.

## Finger-detail clips

These clips have detectable finger rotation beyond the activity threshold. This is useful for interaction polish, grip/pose overrides, and deciding where hand/finger masks matter.

| Clip | Category | Finger side | L max deg | R max deg | Suggested mask | Tags |
|---|---|---|---:|---:|---|---|
| Dance Body Roll | dance/dance | both | 150.24 | 95.65 | all | dance, fingers_active, one_shot |
| ClimbUp_1m_RM | locomotion_transition/climb | both | 121.74 | 68.07 | all | climb, fingers_active, locomotion_transition, one_shot, root_motion, root_motion_named |
| Confused | social_emote/confused | right | 0 | 116.65 | all | confused, fingers_active, one_shot, right_hand_detail, social_emote |
| Spell_Simple_Enter | magic_power/spell | both | 115.76 | 95.6 | upperBody | enter, fingers_active, magic_power, spell, transition |
| Spell_Simple_Exit | magic_power/spell | both | 115.76 | 95.6 | upperBody | exit, fingers_active, magic_power, spell, transition |
| Reject | social_emote/reject | both | 108.3 | 108.3 | upperBody | fingers_active, one_shot, reject, social_emote |
| Sword_Dash_RM | combat_weapon/sword | left | 98.45 | 0 | all | combat_weapon, fingers_active, left_hand_detail, one_shot, root_motion, root_motion_named, sword |
| Sword_Regular_Combo | combat_weapon/sword | left | 98.44 | 0 | all | combat_weapon, fingers_active, left_hand_detail, one_shot, sword |
| Roll | locomotion_transition/roll | both | 78.04 | 97.71 | all | fingers_active, locomotion_transition, one_shot, roll |
| Roll_RM | locomotion_transition/roll | both | 78.04 | 97.71 | all | fingers_active, locomotion_transition, one_shot, roll, root_motion, root_motion_named |
| Sword_Regular_C | combat_weapon/sword | left | 97.46 | 0 | all | combat_weapon, fingers_active, left_hand_detail, one_shot, sword |
| Jump_Land | locomotion_transition/jump | both | 86.82 | 95.6 | all | fingers_active, jump, land, locomotion_transition, transition |
| Jump_Start | locomotion_transition/jump | both | 86.82 | 95.6 | all | fingers_active, jump, locomotion_transition, start, transition |
| Sitting_Enter | posture_state/sitting | both | 86.82 | 95.18 | all | enter, fingers_active, posture_state, sitting, transition |
| Sword_Regular_B_Rec | combat_weapon/sword | left | 91.46 | 0 | all | combat_weapon, fingers_active, left_hand_detail, sword, transition |
| Greeting | social_emote/greeting | both | 90.08 | 68.44 | upperBody | fingers_active, greeting, one_shot, social_emote |
| Death01 | damage_death/death | both | 86.82 | 89.73 | all | damage_death, death, fingers_active, one_shot |
| Farm_Harvest | interaction_world/farming | right | 0 | 86.82 | upperBody | farm, farming, fingers_active, interaction_world, one_shot, right_hand_detail |
| Idle_Rail_Call | idle_state/rail | right | 0 | 86.82 | all | fingers_active, idle, idle_state, one_shot, rail, right_hand_detail |
| NinjaJump_Land | locomotion_transition/jump | left | 86.82 | 0 | all | fingers_active, jump, land, left_hand_detail, locomotion_transition, transition |
| NinjaJump_Start | locomotion_transition/jump | left | 86.82 | 0 | all | fingers_active, jump, left_hand_detail, locomotion_transition, start, transition |
| Yes | social_emote/affirmation | left | 86.82 | 0 | neckHead | affirmation, fingers_active, left_hand_detail, one_shot, social_emote |
| Slide_Exit | locomotion_transition/slide | left | 86.68 | 0 | all | exit, fingers_active, left_hand_detail, locomotion_transition, slide, transition |
| Farm_PlantSeed | interaction_world/farming | right | 0 | 86.54 | upperBody | farm, farming, fingers_active, interaction_world, one_shot, right_hand_detail |
| Chest_Open | interaction_world/container | left | 86.43 | 0 | upperBody | container, fingers_active, interaction_world, left_hand_detail, one_shot |
| Consume | interaction_world/consume | left | 86.17 | 0 | upperBody | consume, fingers_active, interaction_world, left_hand_detail, one_shot |
| Slide_Start | locomotion_transition/slide | left | 83.21 | 0 | all | fingers_active, left_hand_detail, locomotion_transition, slide, start, transition |
| Sitting_Exit | posture_state/sitting | both | 81.02 | 79.62 | all | exit, fingers_active, posture_state, sitting, transition |
| Fixing_Kneeling | interaction_world/fixing | both | 80.03 | 80.04 | all | fingers_active, fixing, interaction_world, one_shot |
| PickUp_Table | interaction_world/pickup | left | 80.03 | 0 | upperBody | fingers_active, interaction_world, left_hand_detail, one_shot, pickup |
| Interact | interaction_world/world | left | 78.42 | 0 | upperBody | fingers_active, interaction_world, left_hand_detail, one_shot, world |
| Idle_TalkingPhone_Loop | idle_state/phone | left | 77.12 | 0 | upperBody | fingers_active, idle, idle_state, left_hand_detail, loop, phone |
| Idle_Talking_Loop | idle_state/idle | both | 77.12 | 46.87 | upperBody | fingers_active, idle, idle_state, loop |
| Sitting_Talking_Loop | posture_state/sitting | both | 77.12 | 46.87 | all | fingers_active, loop, posture_state, sitting |
| Throw Object | interaction_world/throw | right | 0 | 74.75 | upperBody | fingers_active, interaction_world, one_shot, right_hand_detail, throw |
| Victory Fist Pump | social_emote/victory | right | 0 | 73.93 | all | fingers_active, one_shot, right_hand_detail, social_emote, victory |
| Slide_Loop | locomotion_transition/slide | right | 0 | 68.07 | all | fingers_active, locomotion_transition, loop, right_hand_detail, slide |
| Sword_Block | combat_weapon/sword | left | 67.75 | 0 | all | combat_weapon, fingers_active, left_hand_detail, one_shot, sword |
| LayToIdle | idle_state/idle | both | 65.38 | 65.36 | all | fingers_active, idle, idle_state, loop |
| Hit_Knockback | damage_death/hit_reaction | both | 64.31 | 64.31 | all | damage_death, fingers_active, hit_reaction, transition |
| Hit_Knockback_RM | damage_death/hit_reaction | both | 64.31 | 64.31 | all | damage_death, fingers_active, hit_reaction, root_motion, root_motion_named, transition |
| OverhandThrow | interaction_world/throw | both | 56.26 | 59.85 | upperBody | fingers_active, interaction_world, one_shot, throw |
| Sword_Regular_A | combat_weapon/sword | left | 58.91 | 0 | all | combat_weapon, fingers_active, left_hand_detail, one_shot, sword |
| Sword_Regular_A_Rec | combat_weapon/sword | left | 58.91 | 0 | all | combat_weapon, fingers_active, left_hand_detail, sword, transition |
| Crawl | locomotion/crawl | both | 53.12 | 39.91 | locomotionCore | crawl, fingers_active, locomotion, loop_candidate |
| Crawl RM | locomotion/crawl | both | 53.12 | 39.91 | locomotionCore | crawl, fingers_active, locomotion, loop_candidate, root_motion, root_motion_named |
| Pistol_Reload | combat_weapon/pistol | left | 47.5 | 0 | upperBody | combat_weapon, fingers_active, left_hand_detail, one_shot, pistol, reload |
| TreeChopping_Loop | interaction_world/tooling | left | 47.41 | 0 | upperBody | fingers_active, interaction_world, left_hand_detail, loop, tooling |
| Sword_Regular_B | combat_weapon/sword | left | 43.53 | 0 | all | combat_weapon, fingers_active, left_hand_detail, one_shot, sword |
| Zombie_Scratch | combat_unarmed/zombie_attack | both | 37.59 | 26.78 | all | combat_unarmed, fingers_active, one_shot, zombie_attack |
| Hit_Chest | damage_death/hit_reaction | both | 32.85 | 32.85 | all | damage_death, fingers_active, hit_reaction, one_shot |
| Hit_Head | damage_death/hit_reaction | both | 32.85 | 32.85 | all | damage_death, fingers_active, hit_reaction, one_shot |
| Dance Reach Hip | dance/dance | both | 26.07 | 29.06 | all | dance, fingers_active, one_shot |
| Zombie_Idle_Loop | idle_state/zombie | both | 21.01 | 21.01 | all | fingers_active, idle, idle_state, loop, zombie |
| Dizzy | posture_state/posture | left | 20.42 | 0 | all | fingers_active, left_hand_detail, one_shot, posture, posture_state |
| Spell_Simple_Shoot | magic_power/spell | left | 17.76 | 4.77 | upperBody | fingers_active, left_hand_detail, magic_power, one_shot, shoot, spell |
| Swim_Idle_Loop | locomotion/swim | both | 9.99 | 14.93 | locomotionCore | fingers_active, idle, locomotion, loop, swim |
| Jumping Jacks | fitness/jumping_jacks | right | 3.48 | 14.3 | all | fingers_active, fitness, jump, jumping_jacks, one_shot, right_hand_detail |

## Dense animation index

### Combat Unarmed (9)

Unarmed fighting, punches, jabs, and melee-style actions.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 17 | Defend | `defend` | defense | 0.958333 | one_shot | combat | all |  | RLeg | combat_unarmed, defense, one_shot |
| 23 | Fighting Idle | `fighting_idle` | fighting_idle | 1.708333 | loop | combat | all |  | LArm RArm LLeg RLeg | combat_unarmed, fighting_idle, idle, loop |
| 24 | Fighting Left Jab | `fighting_left_jab` | jab | 0.916667 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LLeg RLeg | combat_unarmed, jab, one_shot |
| 25 | Fighting Right Jab | `fighting_right_jab` | jab | 0.916667 | one_shot | combat | all |  | Pelvis Head LArm RArm LLeg RLeg | combat_unarmed, jab, one_shot |
| 58 | Melee_Hook | `melee_hook` | melee | 0.458333 | one_shot | combat | upperBody |  | Pelvis Spine Head LArm RArm LLeg RLeg | combat_unarmed, melee, one_shot |
| 59 | Melee_Hook_Rec | `melee_hook_rec` | melee | 0.583333 | transition | combat | upperBody |  | Pelvis Spine Head LArm RArm LLeg RLeg | combat_unarmed, melee, transition |
| 72 | Punch_Cross | `punch_cross` | punch | 1.25 | one_shot | combat | upperBody |  | Pelvis Spine Head LArm RArm LLeg RLeg | combat_unarmed, one_shot, punch |
| 73 | Punch_Jab | `punch_jab` | jab | 1.083333 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LLeg RLeg | combat_unarmed, jab, one_shot |
| 122 | Zombie_Scratch | `zombie_scratch` | zombie_attack | 1.791667 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | combat_unarmed, fingers_active, one_shot, zombie_attack |

### Combat Weapon (21)

Weapon-specific stance, aim, reload, attack, block, dash, and combo clips.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 42 | Idle_Shield_Break | `idle_shield_break` | shield | 1.041667 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LLeg RLeg | combat_weapon, idle, one_shot, shield |
| 43 | Idle_Shield_Loop | `idle_shield_loop` | shield | 2.5 | loop | combat | all |  | RLeg | combat_weapon, idle, loop, shield |
| 65 | Pistol_Aim_Down | `pistol_aim_down` | pistol | 0.208333 | one_shot | combat | upperBody |  |  | aim, combat_weapon, one_shot, pistol |
| 66 | Pistol_Aim_Neutral | `pistol_aim_neutral` | pistol | 0.208333 | one_shot | combat | upperBody |  |  | aim, combat_weapon, one_shot, pistol |
| 67 | Pistol_Aim_Up | `pistol_aim_up` | pistol | 0.208333 | one_shot | combat | upperBody |  |  | aim, combat_weapon, one_shot, pistol |
| 68 | Pistol_Idle_Loop | `pistol_idle_loop` | pistol | 2.083333 | loop | combat | upperBody |  | RArm | combat_weapon, idle, loop, pistol |
| 69 | Pistol_Reload | `pistol_reload` | pistol | 2.083333 | one_shot | combat | upperBody |  | LArm RArm LFing | combat_weapon, fingers_active, left_hand_detail, one_shot, pistol, reload |
| 70 | Pistol_Shoot | `pistol_shoot` | pistol | 0.791667 | one_shot | combat | upperBody |  | LArm RArm | combat_weapon, one_shot, pistol, shoot |
| 81 | Shield_Dash_RM | `shield_dash_rm` | shield | 1.083333 | one_shot | combat | all | yes | Root Pelvis Spine Head LArm RArm LLeg RLeg | combat_weapon, one_shot, root_motion, root_motion_named, shield |
| 82 | Shield_OneShot | `shield_one_shot` | shield | 0.833333 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LLeg RLeg | combat_weapon, one_shot, shield |
| 99 | Sword_Attack | `sword_attack` | sword | 1.916667 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LLeg RLeg | attack, combat_weapon, one_shot, sword |
| 100 | Sword_Attack_RM | `sword_attack_rm` | sword | 1.916667 | one_shot | combat | all | yes | Root Pelvis Spine Head LArm RArm LLeg RLeg | attack, combat_weapon, one_shot, root_motion, root_motion_named, sword |
| 101 | Sword_Block | `sword_block` | sword | 1.208333 | one_shot | combat | all |  | Spine Head LArm RArm LFing LLeg RLeg | combat_weapon, fingers_active, left_hand_detail, one_shot, sword |
| 102 | Sword_Dash_RM | `sword_dash_rm` | sword | 1.541667 | one_shot | combat | all | yes | Root Pelvis Spine Head LArm RArm LFing LLeg RLeg | combat_weapon, fingers_active, left_hand_detail, one_shot, root_motion, root_motion_named, sword |
| 103 | Sword_Idle | `sword_idle` | sword | 2.083333 | loop | combat | all |  | RArm | combat_weapon, idle, loop, sword |
| 104 | Sword_Regular_A | `sword_regular_a` | sword | 0.416667 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | combat_weapon, fingers_active, left_hand_detail, one_shot, sword |
| 105 | Sword_Regular_A_Rec | `sword_regular_a_rec` | sword | 0.958333 | transition | combat | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | combat_weapon, fingers_active, left_hand_detail, sword, transition |
| 106 | Sword_Regular_B | `sword_regular_b` | sword | 0.5 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | combat_weapon, fingers_active, left_hand_detail, one_shot, sword |
| 107 | Sword_Regular_B_Rec | `sword_regular_b_rec` | sword | 1 | transition | combat | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | combat_weapon, fingers_active, left_hand_detail, sword, transition |
| 108 | Sword_Regular_C | `sword_regular_c` | sword | 2 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | combat_weapon, fingers_active, left_hand_detail, one_shot, sword |
| 109 | Sword_Regular_Combo | `sword_regular_combo` | sword | 3 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | combat_weapon, fingers_active, left_hand_detail, one_shot, sword |

### Damage Death (5)

Hit reactions, knockback, and death.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 16 | Death01 | `death01` | death | 3 | one_shot | combat | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | damage_death, death, fingers_active, one_shot |
| 31 | Hit_Chest | `hit_chest` | hit_reaction | 0.416667 | one_shot | combat | all |  | Pelvis Spine LArm RArm LFing RFing RLeg | damage_death, fingers_active, hit_reaction, one_shot |
| 32 | Hit_Head | `hit_head` | hit_reaction | 0.541667 | one_shot | combat | all |  | Head LArm RArm LFing RFing | damage_death, fingers_active, hit_reaction, one_shot |
| 33 | Hit_Knockback | `hit_knockback` | hit_reaction | 0.833333 | transition | combat | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | damage_death, fingers_active, hit_reaction, transition |
| 34 | Hit_Knockback_RM | `hit_knockback_rm` | hit_reaction | 0.833333 | transition | combat | all | yes | Root Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | damage_death, fingers_active, hit_reaction, root_motion, root_motion_named, transition |

### Dance (4)

Dance loops/one-shots.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 12 | Dance Body Roll | `dance_body_roll` | dance | 6.5 | one_shot | magic-dance-fitness | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | dance, fingers_active, one_shot |
| 13 | Dance Charleston | `dance_charleston` | dance | 2.333333 | one_shot | magic-dance-fitness | all |  | Pelvis Spine Head LArm RArm LLeg RLeg | dance, one_shot |
| 14 | Dance Reach Hip | `dance_reach_hip` | dance | 2.541667 | one_shot | magic-dance-fitness | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | dance, fingers_active, one_shot |
| 15 | Dance_Loop | `dance_loop` | dance | 1.25 | loop | magic-dance-fitness | all |  | Pelvis Spine LArm RArm LLeg RLeg | dance, loop |

### Fitness (2)

Exercise/fitness loops or actions.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 52 | Jumping Jacks | `jumping_jacks` | jumping_jacks | 1.25 | one_shot | magic-dance-fitness | all |  | LArm RArm RFing LLeg RLeg | fingers_active, fitness, jump, jumping_jacks, one_shot, right_hand_detail |
| 75 | Pushup | `pushup` | pushup | 1.541667 | one_shot | magic-dance-fitness | all |  | Pelvis Spine Head LArm RArm LLeg RLeg | fitness, one_shot, pushup |

### Idle State (12)

Standing idles and prop/context idles for ambient avatar state.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 35 | Idle Listening | `idle_listening` | idle | 1.708333 | one_shot | idles | all |  | LArm | idle, idle_state, one_shot |
| 36 | Idle_FoldArms_Loop | `idle_fold_arms_loop` | idle | 2.5 | loop | idles | all |  | LLeg RLeg | idle, idle_state, loop |
| 37 | Idle_Lantern_Loop | `idle_lantern_loop` | lantern | 2.5 | loop | idles | all |  | RLeg | idle, idle_state, lantern, loop |
| 38 | Idle_Loop | `idle_loop` | idle | 3.125 | loop | idles | all |  | RLeg | idle, idle_state, loop |
| 39 | Idle_No_Loop | `idle_no_loop` | idle | 2.5 | loop | idles | all |  | Head RLeg | idle, idle_state, loop |
| 40 | Idle_Rail_Call | `idle_rail_call` | rail | 2.5 | one_shot | idles | all |  | RArm RFing RLeg | fingers_active, idle, idle_state, one_shot, rail, right_hand_detail |
| 41 | Idle_Rail_Loop | `idle_rail_loop` | rail | 2.5 | loop | idles | all |  | RLeg | idle, idle_state, loop, rail |
| 45 | Idle_Talking_Loop | `idle_talking_loop` | idle | 3.666667 | loop | idles | upperBody |  | LArm RArm LFing RFing | fingers_active, idle, idle_state, loop |
| 44 | Idle_TalkingPhone_Loop | `idle_talking_phone_loop` | phone | 2.916667 | loop | idles | upperBody |  | LArm RArm LFing | fingers_active, idle, idle_state, left_hand_detail, loop, phone |
| 46 | Idle_Torch_Loop | `idle_torch_loop` | torch | 1.583333 | loop | idles | all |  | LArm RLeg | idle, idle_state, loop, torch |
| 54 | LayToIdle | `lay_to_idle` | idle | 1.5 | loop | idles | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | fingers_active, idle, idle_state, loop |
| 121 | Zombie_Idle_Loop | `zombie_idle_loop` | zombie | 1.333333 | loop | idles | all |  | LArm RArm LFing RFing LLeg RLeg | fingers_active, idle, idle_state, loop, zombie |

### Interaction World (13)

World/object interactions such as pickup, consume, farm, chop, throw, push, fix, and chest use.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 3 | Chest_Open | `chest_open` | container | 1.333333 | one_shot | world-interactions | upperBody |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | container, fingers_active, interaction_world, left_hand_detail, one_shot |
| 6 | Consume | `consume` | consume | 1.333333 | one_shot | world-interactions | upperBody |  | Pelvis Head LArm RArm LFing LLeg RLeg | consume, fingers_active, interaction_world, left_hand_detail, one_shot |
| 7 | Consume Item | `consume_item` | consume | 4.166667 | one_shot | world-interactions | upperBody |  | Pelvis Spine Head LArm RArm LLeg RLeg | consume, interaction_world, one_shot |
| 20 | Farm_Harvest | `farm_harvest` | farming | 2.5 | one_shot | world-interactions | upperBody |  | Pelvis Spine Head LArm RArm RFing LLeg RLeg | farm, farming, fingers_active, interaction_world, one_shot, right_hand_detail |
| 21 | Farm_PlantSeed | `farm_plant_seed` | farming | 2.75 | one_shot | world-interactions | upperBody |  | Pelvis Spine Head LArm RArm RFing LLeg RLeg | farm, farming, fingers_active, interaction_world, one_shot, right_hand_detail |
| 22 | Farm_Watering | `farm_watering` | farming | 3.791667 | one_shot | world-interactions | upperBody |  | Pelvis Spine Head RArm LLeg RLeg | farm, farming, interaction_world, one_shot |
| 26 | Fixing_Kneeling | `fixing_kneeling` | fixing | 6.5 | one_shot | world-interactions | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | fingers_active, fixing, interaction_world, one_shot |
| 47 | Interact | `interact` | world | 2.5 | one_shot | world-interactions | upperBody |  | LArm LFing RLeg | fingers_active, interaction_world, left_hand_detail, one_shot, world |
| 63 | OverhandThrow | `overhand_throw` | throw | 1.333333 | one_shot | world-interactions | upperBody |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | fingers_active, interaction_world, one_shot, throw |
| 64 | PickUp_Table | `pick_up_table` | pickup | 1.041667 | one_shot | world-interactions | upperBody |  | Pelvis Spine Head LArm LFing LLeg RLeg | fingers_active, interaction_world, left_hand_detail, one_shot, pickup |
| 74 | Push_Loop | `push_loop` | push | 3.333333 | loop | world-interactions | all |  | LArm RArm LLeg RLeg | interaction_world, loop, push |
| 111 | Throw Object | `throw_object` | throw | 1.875 | one_shot | world-interactions | upperBody |  | Pelvis Spine Head LArm RArm RFing LLeg RLeg | fingers_active, interaction_world, one_shot, right_hand_detail, throw |
| 113 | TreeChopping_Loop | `tree_chopping_loop` | tooling | 0.958333 | loop | world-interactions | upperBody |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | fingers_active, interaction_world, left_hand_detail, loop, tooling |

### Locomotion (14)

Playable movement loops and movement states. Most are good candidates for lower-body/locomotionCore masking.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 8 | Crawl | `crawl` | crawl | 1.708333 | loop_candidate | core-locomotion | locomotionCore |  | LArm RArm LFing RFing LLeg RLeg | crawl, fingers_active, locomotion, loop_candidate |
| 9 | Crawl RM | `crawl_rm` | crawl | 1.708333 | loop_candidate | core-locomotion | locomotionCore | yes | Root LArm RArm LFing RFing LLeg RLeg | crawl, fingers_active, locomotion, loop_candidate, root_motion, root_motion_named |
| 10 | Crouch_Fwd_Loop | `crouch_fwd_loop` | crouch_move | 2.5 | loop | core-locomotion | locomotionCore |  | Pelvis Spine LLeg RLeg | crouch_move, locomotion, loop |
| 27 | Flying Forward | `flying_forward` | fly | 0.5 | loop_candidate | core-locomotion | locomotionCore |  |  | fly, locomotion, loop_candidate |
| 28 | Flying Forward Super | `flying_forward_super` | fly | 0.5 | loop_candidate | core-locomotion | locomotionCore |  | LArm RArm | fly, locomotion, loop_candidate |
| 48 | Jog_Fwd_Loop | `jog_fwd_loop` | jog | 1.166667 | loop | core-locomotion | locomotionCore |  | Pelvis Spine Head LArm RArm LLeg RLeg | jog, locomotion, loop |
| 80 | Run Anime | `run_anime` | run | 0.541667 | loop_candidate | core-locomotion | locomotionCore |  | Pelvis Spine Head LArm RArm LLeg RLeg | locomotion, loop_candidate, run |
| 96 | Sprint_Loop | `sprint_loop` | sprint | 0.833333 | loop | core-locomotion | locomotionCore |  | Pelvis Spine Head LArm RArm LLeg RLeg | locomotion, loop, sprint |
| 97 | Swim_Fwd_Loop | `swim_fwd_loop` | swim | 1.666667 | loop | core-locomotion | locomotionCore |  | Spine LArm RArm LLeg RLeg | locomotion, loop, swim |
| 98 | Swim_Idle_Loop | `swim_idle_loop` | swim | 4.166667 | loop | core-locomotion | locomotionCore |  | LArm RArm LFing RFing LLeg RLeg | fingers_active, idle, locomotion, loop, swim |
| 117 | Walk_Carry_Loop | `walk_carry_loop` | walk | 2 | loop | core-locomotion | locomotionCore |  | Spine Head LLeg RLeg | locomotion, loop, walk |
| 118 | Walk_Formal_Loop | `walk_formal_loop` | walk | 1.666667 | loop | core-locomotion | locomotionCore |  | LArm RArm LLeg RLeg | locomotion, loop, walk |
| 119 | Walk_Loop | `walk_loop` | walk | 1.666667 | loop | core-locomotion | locomotionCore |  | Spine LArm RArm LLeg RLeg | locomotion, loop, walk |
| 123 | Zombie_Walk_Fwd_Loop | `zombie_walk_fwd_loop` | walk | 1.333333 | loop | core-locomotion | locomotionCore |  | Spine LArm RArm LLeg RLeg | locomotion, loop, walk |

### Locomotion Transition (13)

Jumps, rolls, climb, slide, acrobatic entries/exits, and root-motion traversal beats.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 1 | Backflip | `backflip` | acrobatics | 2.5 | one_shot | locomotion-transitions | all |  | Pelvis Spine Head LArm RArm LLeg RLeg | acrobatics, locomotion_transition, one_shot |
| 4 | ClimbUp_1m_RM | `climb_up_1m_rm` | climb | 0.666667 | one_shot | locomotion-transitions | all | yes | Root Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | climb, fingers_active, locomotion_transition, one_shot, root_motion, root_motion_named |
| 49 | Jump_Land | `jump_land` | jump | 1.583333 | transition | locomotion-transitions | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | fingers_active, jump, land, locomotion_transition, transition |
| 50 | Jump_Loop | `jump_loop` | jump | 3.125 | loop | locomotion-transitions | all |  | LArm RArm LLeg RLeg | jump, locomotion_transition, loop |
| 51 | Jump_Start | `jump_start` | jump | 1.666667 | transition | locomotion-transitions | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | fingers_active, jump, locomotion_transition, start, transition |
| 60 | NinjaJump_Idle_Loop | `ninja_jump_idle_loop` | jump | 2 | loop | locomotion-transitions | all |  | LLeg | idle, jump, locomotion_transition, loop |
| 61 | NinjaJump_Land | `ninja_jump_land` | jump | 1.25 | transition | locomotion-transitions | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | fingers_active, jump, land, left_hand_detail, locomotion_transition, transition |
| 62 | NinjaJump_Start | `ninja_jump_start` | jump | 0.958333 | transition | locomotion-transitions | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | fingers_active, jump, left_hand_detail, locomotion_transition, start, transition |
| 78 | Roll | `roll` | roll | 1.833333 | one_shot | locomotion-transitions | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | fingers_active, locomotion_transition, one_shot, roll |
| 79 | Roll_RM | `roll_rm` | roll | 1.833333 | one_shot | locomotion-transitions | all | yes | Root Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | fingers_active, locomotion_transition, one_shot, roll, root_motion, root_motion_named |
| 89 | Slide_Exit | `slide_exit` | slide | 0.5 | transition | locomotion-transitions | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | exit, fingers_active, left_hand_detail, locomotion_transition, slide, transition |
| 90 | Slide_Loop | `slide_loop` | slide | 2 | loop | locomotion-transitions | all |  | Spine LArm RArm RFing LLeg RLeg | fingers_active, locomotion_transition, loop, right_hand_detail, slide |
| 91 | Slide_Start | `slide_start` | slide | 0.833333 | transition | locomotion-transitions | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | fingers_active, left_hand_detail, locomotion_transition, slide, start, transition |

### Magic Power (8)

Spell, levitation, power-up, and blast actions.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 55 | Levitate Entrance | `levitate_entrance` | levitate | 2 | one_shot | magic-dance-fitness | all |  | LArm LLeg | levitate, magic_power, one_shot |
| 56 | Levitate Idle | `levitate_idle` | levitate | 2 | loop | magic-dance-fitness | all |  | LArm RArm LLeg RLeg | idle, levitate, loop, magic_power |
| 71 | Power Up | `power_up` | power_up | 0.75 | one_shot | magic-dance-fitness | upperBody |  | LArm RArm | magic_power, one_shot, power_up |
| 92 | Spell_Simple_Enter | `spell_simple_enter` | spell | 0.666667 | transition | magic-dance-fitness | upperBody |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | enter, fingers_active, magic_power, spell, transition |
| 93 | Spell_Simple_Exit | `spell_simple_exit` | spell | 0.541667 | transition | magic-dance-fitness | upperBody |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | exit, fingers_active, magic_power, spell, transition |
| 94 | Spell_Simple_Idle_Loop | `spell_simple_idle_loop` | spell | 2.625 | loop | magic-dance-fitness | upperBody |  | LArm RArm | idle, loop, magic_power, spell |
| 95 | Spell_Simple_Shoot | `spell_simple_shoot` | spell | 0.625 | one_shot | magic-dance-fitness | upperBody |  | Spine LArm LFing | fingers_active, left_hand_detail, magic_power, one_shot, shoot, spell |
| 114 | Two-hand Blast | `two_hand_blast` | blast | 0.458333 | one_shot | magic-dance-fitness | upperBody |  | LArm RArm | blast, magic_power, one_shot |

### Posture State (11)

Seated, crouched, kneeling, sleeping, meditative, or tired body states.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 11 | Crouch_Idle_Loop | `crouch_idle_loop` | crouch_idle | 3.666667 | loop | posture-states | all |  | LArm RArm RLeg | crouch_idle, idle, loop, posture_state |
| 18 | Dizzy | `dizzy` | posture | 2.416667 | one_shot | posture-states | all |  | Pelvis Spine Head LArm RArm LFing LLeg RLeg | fingers_active, left_hand_detail, one_shot, posture, posture_state |
| 53 | Kneeling Tired | `kneeling_tired` | kneeling | 0.833333 | one_shot | posture-states | all |  | LArm | kneeling, one_shot, posture_state |
| 57 | Meditate | `meditate` | meditation | 1.5 | loop | posture-states | all |  |  | loop, meditation, posture_state |
| 83 | Shivering | `shivering` | posture | 0.25 | one_shot | posture-states | all |  | LArm | one_shot, posture, posture_state |
| 84 | Sitting_Enter | `sitting_enter` | sitting | 1.625 | transition | posture-states | all |  | Pelvis LArm RArm LFing RFing LLeg RLeg | enter, fingers_active, posture_state, sitting, transition |
| 85 | Sitting_Exit | `sitting_exit` | sitting | 1.291667 | transition | posture-states | all |  | Pelvis Spine Head LArm RArm LFing RFing LLeg RLeg | exit, fingers_active, posture_state, sitting, transition |
| 86 | Sitting_Idle_Loop | `sitting_idle_loop` | sitting | 2.083333 | loop | posture-states | all |  |  | idle, loop, posture_state, sitting |
| 87 | Sitting_Talking_Loop | `sitting_talking_loop` | sitting | 3.666667 | loop | posture-states | all |  | LArm RArm LFing RFing RLeg | fingers_active, loop, posture_state, sitting |
| 88 | Sleeping | `sleeping` | sleeping | 1.666667 | loop | posture-states | all |  |  | loop, posture_state, sleeping |
| 112 | Tired Hunched | `tired_hunched` | posture | 1.041667 | one_shot | posture-states | all |  | Head LArm | one_shot, posture, posture_state |

### Reference Pose (2)

Bind/reference poses used for rig QA, retargeting checks, and editor resets.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 77 | Rest Pose | `rest_pose` | rest_pose | 0.416667 | pose | reference | all |  |  | pose, reference_pose, rest_pose |
| 110 | TPose | `tpose` | t_pose | 2.5 | pose | reference | all |  |  | pose, reference_pose, t_pose |

### Social Emote (9)

Player-facing emotes, affirmations, greetings, and reactions.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 0 | Angry | `angry` | anger | 0.833333 | one_shot | social-emotes | all |  | Pelvis Spine Head LArm RArm LLeg RLeg | anger, one_shot, social_emote |
| 2 | Bow | `bow` | bow | 3.75 | one_shot | social-emotes | upperBody |  | Spine LArm RArm | bow, one_shot, social_emote |
| 5 | Confused | `confused` | confused | 2.916667 | one_shot | social-emotes | all |  | Pelvis Spine Head LArm RArm RFing LLeg RLeg | confused, fingers_active, one_shot, right_hand_detail, social_emote |
| 29 | Greeting | `greeting` | greeting | 4.833333 | one_shot | social-emotes | upperBody |  | Head LArm RArm LFing RFing RLeg | fingers_active, greeting, one_shot, social_emote |
| 30 | Head Nod | `head_nod` | affirmation | 0.875 | one_shot | social-emotes | neckHead |  |  | affirmation, one_shot, social_emote |
| 76 | Reject | `reject` | reject | 3.791667 | one_shot | social-emotes | upperBody |  | Head LArm RArm LFing RFing | fingers_active, one_shot, reject, social_emote |
| 115 | Victory | `victory` | victory | 1.666667 | one_shot | social-emotes | all |  | Pelvis Spine Head LArm RArm LLeg RLeg | one_shot, social_emote, victory |
| 116 | Victory Fist Pump | `victory_fist_pump` | victory | 2.25 | one_shot | social-emotes | all |  | Pelvis Spine Head LArm RArm RFing LLeg RLeg | fingers_active, one_shot, right_hand_detail, social_emote, victory |
| 120 | Yes | `yes` | affirmation | 2.5 | one_shot | social-emotes | neckHead |  | LArm RArm LFing LLeg RLeg | affirmation, fingers_active, left_hand_detail, one_shot, social_emote |

### Vehicle Prop State (1)

Vehicle/prop stance loops.

| # | Clip | ID | Subcategory | Sec | Kind | Pack | Mask | RM | Groups | Tags |
|---:|---|---|---|---:|---|---|---|:---:|---|---|
| 19 | Driving_Loop | `driving_loop` | driving | 2.083333 | loop | vehicle-prop-states | all |  |  | driving, loop, vehicle_prop_state |

## Track conventions observed

- Standard clips: 67 channels: 66 bone rotation tracks plus `pelvis.translation`.
- Root-motion clips: 68 channels: the standard 67 channels plus `root.translation`.
- No scale animation tracks were found in this pack.
- All clips target the same 66-joint skeleton as the baseline `2ways.glb`.

## Catalog files

- `animation-pack.manifest.json`: full machine-readable metadata, including root/pelvis deltas and bone-group activity.
- `animation-index.csv`: compact spreadsheet-friendly index.
- `category-index.json`: clips grouped by category, runtime pack, and playback kind.
- `../../src/avatarAnimationCatalog124.ts`: TypeScript catalog for app/runtime imports.
