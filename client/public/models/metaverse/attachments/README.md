# Metaverse Attachment Authoring

This folder contains runtime attachment GLTFs and the working contract for held
objects. The GLTF stores visual nodes and transforms. The TypeScript manifests in
`client/src/assets` store semantic meaning so runtime code does not need to
guess from node names.

## Current Reference Assets

| Asset                            | Runtime id                     | Held-object family | Pose profile                         |
| -------------------------------- | ------------------------------ | ------------------ | ------------------------------------ |
| `metaverse-service-pistol.gltf`  | `metaverse-service-pistol-v2`  | `sidearm`          | `sidearm.one_hand_optional_support`  |
| `metaverse-rocket-launcher.gltf` | `metaverse-rocket-launcher-v1` | `shoulder_heavy`   | `shoulder_heavy.two_hand_shouldered` |

## Contract

Use meters and the same root-local basis for all held objects:

```txt
+X = forward / muzzle / blade tip
+Y = up / sight-up
+Z = weapon right
```

Use canonical semantic roles in manifests, even when the current GLTF node names
are older asset-specific names:

```txt
basis.forward
basis.up
grip.primary
grip.secondary
trigger.index
projectile.muzzle
camera.ads_anchor
sight.front
sight.rear
module.optic
module.underbarrel_grip
carry.back
body.shoulder_contact
projectile.exhaust
hazard.backblast_cone
```

Do not encode handedness into semantic roles. The manifest owns handedness:

```json
{
  "primaryHandDefault": "right",
  "allowedHands": ["right", "left"],
  "offhandPolicy": "optional_support_palm"
}
```

## Runtime Direction

The target stack is:

```txt
base locomotion / motion matching
  -> optional neutral hold pose by poseProfileId
  -> generic held-object procedural layer
  -> action overlays: fire, reload, melee, inspect, equip, stow
  -> presentation events: muzzle flash, trail, casing, projectile, sound
```

The runtime path is now profile-driven. `metaverseAttachmentProofConfigs`
exports the reference sidearm and rocket launcher proofs, while
`metaverseAttachmentProofConfig` remains the default sidearm compatibility
export. The scene loads attachment proofs into an `attachmentId` map and selects
the active presentation from `weaponState.weaponId`.

The old pistol-specific pose runtime has been removed. Product held-object
presentation now uses normal traversal as the sampled body base, captures local
TRS for driven bones after animation sampling, restores that sampled TRS before
solving, and then applies semantic IK, finger poses, and ADS correction.
`poseProfileId` selects procedural solver parameters, not a required animation
clip.

## Synthesized Humanoid Presentation Sockets

The humanoid rig may synthesize presentation sockets from canonical hand/body
bones before an attachment is mounted:

```txt
grip_r_socket
grip_l_socket
palm_r_socket
palm_l_socket
support_l_socket
support_r_socket
back_socket
```

Attachment GLTFs still own object-local sockets such as `grip.primary`,
`grip.secondary`, `camera.ads_anchor`, and `projectile.muzzle`. The runtime maps
those semantic roles through `holdProfile.sockets` instead of inferring meaning
from asset-specific node names.

Off-hand policy is explicit:

```txt
none                  -> no off-hand target
optional_support_palm -> soft palm hint, not a hard secondary grip
required_support_grip -> hard secondary grip target
required_two_hand     -> hard two-hand target
```

ADS is also profile-owned: `iron_sights`, `optic_anchor`, and
`shouldered_heavy` use `camera.ads_anchor` when ADS is active or blending.

## Implementation Tracking

- Done: reference pistol and rocket launcher have typed hold profiles in
  `weapon-archetype-manifest.ts`.
- Done: attachment/proof configs carry the held-object profile forward.
- Done: tests validate that semantic socket roles map to real GLTF node names.
- Done: render runtime carries `holdProfile`, socket-role lookup, off-hand
  target kind, and generic ADS-anchor diagnostics.
- Done: scene runtime loads plural attachment proofs and selects the active
  attachment from `weaponState.weaponId`.
- Done: traversal remains the animation base; held-object runtime captures and
  restores sampled local TRS before semantic IK and finger solving.
- Done: `poseProfileId` drives procedural held-object solver profiles for the
  sidearm and shoulder-heavy reference assets.
- Done: dev equip can select the rocket launcher with
  `?metaverseWeaponId=metaverse-rocket-launcher-v1`; local fire commands stay
  suppressed until a shared combat profile exists.
- Next: add rocket launcher production sockets for `projectile.exhaust`,
  `hazard.backblast_cone`, and `body.shoulder_contact`.
- Next: add optional style/prepose layers per profile only after semantic IK is
  stable; missing style clips must not disable held-object solving.
