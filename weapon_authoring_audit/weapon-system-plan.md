# Full Weapon System Plan

## Core decision

Build a generic `HeldObjectPoseRuntime`, not a pistol runtime and not a weapon-only runtime.

Weapons are just the most demanding held objects. The same system should later support swords, rifles, rocket launchers, tools, shields, keys, cups, torches, build tools, VR-like interaction props, and two-hand objects.

## Runtime layering

```txt
1. Base avatar pose
   - locomotion
   - motion matching
   - emotes
   - traversal
   - deaths/hit reactions

2. Hold pose hint
   - one neutral clip per pose profile when needed
   - examples: sidearm_hold_neutral, rifle_low_ready, shoulder_heavy_ready, sword_one_hand_idle
   - no more required aim-up/aim-down clips for pitch

3. Procedural held-object solver
   - aligns primary hand to grip.primary
   - aligns offhand according to support policy
   - blends clavicle/spine/head based on aim mode
   - drives finger pose profiles
   - resolves ADS camera anchor
   - emits per-bone masks from the avatar rig groups

4. Action overlays
   - fire recoil
   - reload
   - melee swing
   - inspect
   - equip/stow
   - interaction use
   - procedural additive corrections

5. Presentation events
   - muzzle flash
   - casing ejection
   - projectile spawn
   - audio hooks
   - trail VFX
   - collision/hit volumes
```

## Weapon families

### `sidearm`

Examples: pistol, revolver, compact blaster.

Required:

- `grip.primary`
- `trigger.index`
- `projectile.muzzle`
- `camera.ads_anchor`

Optional:

- `grip.secondary` as support-palm hint
- `sight.front`
- `sight.rear`
- `module.optic`
- `module.barrel`
- `magazine.socket`
- `ejection.port`
- `carry.hip`
- `carry.back`

Runtime policy:

- One-hand by default.
- Optional two-hand support pose.
- Default mask: upper body, right arm, optional left arm, fingers.
- Aim pitch/yaw should be procedural.

### `long_gun`

Examples: rifle, shotgun, SMG.

Required:

- `grip.primary`
- `grip.secondary`
- `trigger.index`
- `projectile.muzzle`
- `camera.ads_anchor`
- `body.stock` or `body.shoulder_contact`

Optional:

- `module.optic`
- `module.underbarrel`
- `module.barrel`
- `magazine.socket`
- `ejection.port`
- `sling.front`
- `sling.rear`
- `carry.back`

Runtime policy:

- Two-hand required.
- Shoulder/chest contact matters.
- ADS can be iron-sight or optic-driven.
- Support hand may slide depending on stance, sprint, reload, or animation event.

### `shoulder_heavy`

Examples: rocket launcher, railgun, minigun-like fantasy/heavy weapons.

Required:

- `grip.primary`
- `grip.secondary`
- `trigger.index`
- `projectile.muzzle`
- `camera.ads_anchor`
- `hazard.backblast_cone` for launchers
- `body.shoulder_contact` or `body.chest_contact`

Optional:

- `projectile.exhaust`
- `module.optic`
- `carry.back`
- `ammo.socket`
- `reload.feed_socket`

Runtime policy:

- Two-hand required.
- Larger spine/clavicle influence than sidearms.
- Backblast/exhaust is a first-class presentation/gameplay event.
- Carry/stow needs different offsets than rifles.

### `melee_one_hand`

Examples: sword, dagger, club, baton, hammer.

Required:

- `grip.primary`
- `melee.tip`
- `melee.edge_primary` or `melee.impact_volume`

Optional:

- `trail.start`
- `trail.end`
- `melee.edge_secondary`
- `carry.hip`
- `carry.back`
- `guard.socket`
- `pommel.socket`

Runtime policy:

- Swing animations remain authored.
- IK/procedural layer handles grip correction, wrist alignment, and optional offhand interaction.
- Damage comes from swept volumes/trails, not muzzle sockets.

### `melee_two_hand`

Examples: greatsword, spear, staff, axe.

Required:

- `grip.primary`
- `grip.secondary`
- `melee.tip`

Optional:

- `melee.edge_primary`
- `trail.start`
- `trail.end`
- `carry.back`

Runtime policy:

- Two hands may need sliding grip offsets along the handle.
- Some attacks temporarily release or reposition offhand.
- Support policy should allow authored animation events to override procedural hand locks.

### `tool_or_prop`

Examples: torch, pickaxe, keycard, cup, tablet, build tool.

Required:

- `grip.primary`
- `use.origin` or `interaction.hotspot`

Optional:

- `grip.secondary`
- `carry.hip`
- `carry.back`
- `screen.anchor`
- `pour.origin`
- `light.origin`

Runtime policy:

- Use the same held-object system.
- No weapon assumptions.
- Lets metaverse interactions reuse the same sockets and finger poses.

## Authoring contract

Use meters. Use root-local axes consistently:

```txt
+X = weapon forward / muzzle / blade tip
+Y = weapon up / sight-up
+Z = weapon right
```

Every socket that hands, cameras, modules, carry slots, or VFX attach to must be a full transform, not only a point.

Recommended canonical node naming:

```txt
<assetId>_root

<assetId>__socket__grip_primary
<assetId>__socket__grip_secondary
<assetId>__socket__trigger_index
<assetId>__socket__projectile_muzzle
<assetId>__socket__camera_ads_anchor
<assetId>__socket__sight_front
<assetId>__socket__sight_rear
<assetId>__socket__module_optic
<assetId>__socket__module_underbarrel
<assetId>__socket__carry_back
<assetId>__socket__carry_hip
<assetId>__socket__ejection_port
<assetId>__socket__magazine
<assetId>__socket__hazard_backblast_cone
<assetId>__socket__melee_tip
<assetId>__socket__melee_edge_primary
<assetId>__socket__trail_start
<assetId>__socket__trail_end
```

Do not encode handedness into the canonical socket name. Use manifest fields:

```json
{
  "primaryHandDefault": "right",
  "allowedHands": ["right", "left"],
  "offhandPolicy": "optional_support_palm"
}
```

## Dense external structure

Each weapon pack should ship with:

```txt
weapon-pack.glb
README.md
weapon-pack.manifest.json
weapon-index.csv
socket-index.csv
pose-profile-index.csv
module-slot-index.csv
validation-report.md
```

The README is for artists and designers. The JSON is for runtime and tools. The CSV files are for quick searching and spreadsheet review.

## Suggested TypeScript architecture

```txt
HeldObjectRuntime
  HeldObjectAsset
  HeldObjectManifest
  HoldPoseProfile
  HandTargetSolver
  AimSolver
  AdsSolver
  FingerPoseSolver
  CarrySocketSolver
  ModuleAttachmentSolver
  PresentationEventRouter

WeaponRuntime extends held-object behavior only where needed:
  ProjectileWeaponBehavior
  MeleeWeaponBehavior
  ThrowableBehavior
```

Avoid:

```txt
PistolPoseRuntime
PistolAimUp clip requirement
PistolAimDown clip requirement
asset-id checks like servicePistolOnly
```

Prefer:

```txt
poseProfileId: sidearm.one_hand_optional_support
poseProfileId: long_gun.two_hand_shoulder
poseProfileId: shoulder_heavy.two_hand_shouldered
poseProfileId: melee.one_hand
poseProfileId: melee.two_hand
```

## Migration plan

### Phase 1: lock the contract

- Keep the current pistol and rocket launcher.
- Generate manifests from both.
- Rename conceptual roles in code from pistol-specific to held-object-specific.
- Add validation tests around required sockets and manifest fields.

### Phase 2: generic held-object solver

- Rename `humanoidV2PistolPoseRuntime` to `humanoidV2HeldObjectPoseRuntime`.
- Remove service-pistol asset ID checks.
- Drive aim from `camera.ads_anchor` and `projectile.muzzle`.
- Drive support hand from explicit support policy.
- Keep one optional neutral pose per `poseProfileId`.

### Phase 3: weapon family coverage

- Add one test asset per family: sidearm, long gun, shoulder heavy, one-hand melee, two-hand melee, tool/prop.
- Do not add 30 weapons until the family contracts pass.
- Build artist templates in Blender/gltf for each profile.

### Phase 4: action overlays

- Add fire/recoil overlays.
- Add reload clips and event sockets.
- Add melee trail and damage volumes.
- Add equip/stow transitions.
- Add carry sockets and back/hip visibility switching.

### Phase 5: pack tooling

- Generate README/manifest/index files from the GLTF and authoring manifest.
- Add CI validation: missing sockets, identity socket orientation, duplicate nodes, invalid family requirements, no bounds, wrong axes, stale manifest.
- Only runtime loads GLB. Designers and tests use the external indexes.
