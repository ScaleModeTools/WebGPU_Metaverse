# Mesh2Motion Exported Model Audit

Status: local intake note for the current candidate `exported-model.glb`.

This file records what the current Mesh2Motion export contains and whether it
can enter shipped metaverse manifests without external conditioning.

Current source:

- temporary candidate asset at repo root: `exported-model.glb`
- audit command:

```bash
./tools/audit-metaverse-character-candidate exported-model.glb
```

## Contents

- scenes: `1`
- nodes: `67`
- skins: `1`
- meshes: `1`
- materials: `1`
- animations: `20`

Animation names discovered directly from the GLB:

- `ClimbUp_1m_RM`
- `Death01`
- `Driving_Loop`
- `Hit_Chest`
- `Hit_Head`
- `Hit_Knockback`
- `Hit_Knockback_RM`
- `Jog_Fwd_Loop`
- `Jump_Land`
- `Jump_Loop`
- `Jump_Start`
- `Pistol_Aim_Neutral`
- `Pistol_Aim_Up`
- `Pistol_Idle_Loop`
- `Pistol_Reload`
- `Pistol_Shoot`
- `Sprint_Loop`
- `Swim_Fwd_Loop`
- `Swim_Idle_Loop`
- `Walk_Loop`

## Audit Result

Current verdict: fail.

The candidate is not yet repo-valid for Push 7 because it does not conform to
the current `humanoid_v1` rig truth or the active canonical animation-pack
acceptance gate.

Observed blockers:

- missing canonical bones:
  - `humanoid_root`
  - `hips`
  - `spine`
  - `chest`
  - `neck`
- missing canonical sockets:
  - `hand_r_socket`
  - `hand_l_socket`
  - `head_socket`
  - `hip_socket`
  - `seat_socket`
- scene root is `Skinned Mesh 0`, not the current mannequin-style authored root
- the current skeleton is pelvis/spine/clavicle/hand style authored data, not
  the repo’s locked canonical names
- many nodes still carry explicit `scale` transforms, which violates current
  shipped-asset rules for this slice

Representative node names from the candidate:

- `root`
- `pelvis`
- `spine_01`
- `spine_02`
- `spine_03`
- `neck_01`
- `head`
- `clavicle_l`
- `hand_l`
- `clavicle_r`
- `hand_r`
- `thigh_l`
- `foot_l`
- `thigh_r`
- `foot_r`

## What This Means

- the animation titles do not need to be typed manually; the repo can inspect
  them directly from the GLB
- this file may still be a useful external source asset, because it already
  bundles a broad animation set
- it is not ready to become a shipped metaverse character asset as-is
- Push 7 remains an external conditioning problem first, not a runtime problem

## Next Action

1. Keep `exported-model.glb` outside shipped manifests for now.
2. Use it as an external candidate source asset only.
3. Condition a new exported character outside the repo until it satisfies:
   - canonical `humanoid_v1` bone names
   - canonical socket names and parentage
   - no node `scale` transforms
   - compatibility with the current canonical animation pack acceptance gate
4. Only after that, stage the final shipped render asset and collision proxy
   under `client/public/models/metaverse/characters/`.
