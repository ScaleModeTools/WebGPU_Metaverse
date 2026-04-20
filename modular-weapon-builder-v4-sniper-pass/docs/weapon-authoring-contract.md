# Modular weapon builder v2 for humanoid_v2

> Standalone bundle note: this package includes lightweight local stub versions of `asset-id.ts`, `asset-lod.ts`, `attachment-asset-manifest.ts`, and `asset-socket.ts` only so the bundle typechecks by itself outside your repo. When you merge this into your project, keep your real repo versions of those files.

This version expands the starter bundle into a real weapon-system foundation:

- **base weapon archetype** defines sockets, ADS profile, damage, range, accuracy, magazine, handling, and unlock rule
- **module slots** stay clean and predictable: grip, front sight, rear sight, optic, muzzle
- **modules can modify stats** and optionally override ADS / zoom / reticle presentation
- **unlock metadata** exists on both weapons and modules so you can hang XP / progression / challenge systems off the same manifests
- the runtime helper `resolve-weapon-loadout.ts` resolves equipped modules into a derived stat block

## Why this is still compatible with your current character fix

The bridge to your current runtime still emits `AttachmentAssetDescriptor`, and the held mount still resolves from a **dedicated right-hand grip socket**.

That means your fixed character/weapon alignment work stays the same:

- right hand grips `*_grip_hand_r_socket`
- trigger marker stays separate for later finger IK
- left hand still uses a support point
- ADS lines up from `*_ads_camera_anchor`

## New weapon families in this bundle

- service pistol v2
- compact SMG
- battle rifle
- breacher shotgun
- longshot sniper
- rocket launcher

## New system pieces

### `weapon-builder-manifest.ts`

Adds:

- richer weapon families
- stat blocks
- unlock metadata
- aim profiles with zoom levels
- module stat modifiers
- a resolved-loadout type

### `resolve-weapon-loadout.ts`

Applies module modifiers to a base weapon and returns:

- derived stats
- derived aim profile
- module-by-slot mapping
- validation issues for bad module/family/socket combinations

### `weapon-progression-manifest.ts`

A starter unlock ordering so you can wire player progression without inventing a second schema.

## Weapon GLTF node contract

Every weapon should still expose these nodes:

### Required

- `<weapon>_root`
- `<weapon>_forward_marker`
- `<weapon>_up_marker`
- `<weapon>_grip_hand_r_socket`
- `<weapon>_muzzle_socket`
- `<weapon>_ads_camera_anchor`

### Strongly recommended

- `<weapon>_trigger_marker`
- `<weapon>_front_sight_socket`
- `<weapon>_rear_sight_socket`
- `<weapon>_optic_mount_socket`
- `<weapon>_support_grip_marker`
- `<weapon>_back_socket`

### Optional module sockets

- `<weapon>_grip_module_socket`
- `<weapon>_front_sight_socket`
- `<weapon>_rear_sight_socket`
- `<weapon>_optic_mount_socket`
- `<weapon>_muzzle_socket`

## Design note on ADS and animations

This bundle keeps pose profiles broad (`sidearm` and `long-gun`) on purpose.

Your current runtime still has a pistol-specific upper-body overlay path, so this authoring pass stops at the correct abstraction boundary:

- weapon assets are now clean and modular
- pose selection is broad enough to wire in now
- a later runtime pass can split `long-gun` into rifle / shotgun / launcher / sniper animation sets if you want

## Suggested next runtime tasks

1. Generalize pistol-only pose runtime into a weapon pose-profile selector.
2. Read `weaponAimProfile.zoomLevels` to drive staged ADS zoom.
3. Read `ballistics.lockOnSupported` + tracking stats for launcher lock-on.
4. Read `weaponProgressionManifest` and the per-item `unlock` fields into player progression / inventory.
5. Add authored GLTF nodes for each new weapon family before balance tuning.

## Sniper professional pass notes

The updated longshot sniper intentionally no longer bakes a scope into the base mesh.
That was working against the modular builder because the optic slot and the rifle silhouette were fighting each other.

For the sniper family, the clean split is now:

- **base rifle** owns the chassis, receiver, barrel, stock, grip socket, support point, module sockets, and ADS baseline
- **optic module** owns the scope body and the future optic-specific markers for eye box / reticle plane work
- **backup sight modules** are optional and sit on the front / rear sight sockets only when equipped

This is a better fit for the way you want to build premium sniper variants first and then solve final hand/socket transforms against `humanoid_v2` afterward.

