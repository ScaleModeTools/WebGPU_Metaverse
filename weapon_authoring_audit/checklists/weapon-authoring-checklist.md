# Weapon Authoring Checklist

## Geometry

- [ ] Asset is modeled in meters.
- [ ] +X points forward / muzzle / blade tip.
- [ ] +Y points upward.
- [ ] +Z points to weapon right.
- [ ] Mesh part names are stable and readable.
- [ ] Production asset has normals.
- [ ] Production asset has named materials.
- [ ] UVs exist if texture customization, decals, skins, or camos are needed.

## Root and sockets

- [ ] Root node exists and has stable name.
- [ ] Primary grip socket exists.
- [ ] Grip sockets have meaningful rotation, not just position.
- [ ] Trigger/index marker exists when relevant.
- [ ] Muzzle/projectile origin exists for firing weapons.
- [ ] ADS/camera anchor exists if aim-down-sights is supported.
- [ ] Carry socket exists if the item can be stowed.
- [ ] Socket names do not hard-code right/left hand unless they are intentionally side-specific variants.
- [ ] Module sockets are separate from hand support points.
- [ ] Moving-part sockets are parented to moving parts.

## Weapon-family requirements

### Sidearm

- [ ] `grip.primary`
- [ ] `trigger.index`
- [ ] `projectile.muzzle`
- [ ] `camera.ads_anchor`
- [ ] optional `grip.secondary` is marked optional support-palm

### Long gun

- [ ] `grip.primary`
- [ ] `grip.secondary`
- [ ] `trigger.index`
- [ ] `projectile.muzzle`
- [ ] `camera.ads_anchor`
- [ ] `body.stock` or `body.shoulder_contact`

### Shoulder-heavy

- [ ] `grip.primary`
- [ ] `grip.secondary`
- [ ] `trigger.index`
- [ ] `projectile.muzzle`
- [ ] `camera.ads_anchor`
- [ ] `projectile.exhaust`
- [ ] `hazard.backblast_cone`
- [ ] `body.shoulder_contact` or `body.chest_contact`

### Melee

- [ ] `grip.primary`
- [ ] `melee.tip`
- [ ] `melee.edge_primary` or `melee.impact_volume`
- [ ] optional trail sockets for VFX
- [ ] optional secondary grip for two-hand melee

## Manifest

- [ ] External manifest exists.
- [ ] README/index was regenerated.
- [ ] Family and pose profile are explicit.
- [ ] Hold profile is explicit.
- [ ] Support policy is explicit.
- [ ] ADS policy is explicit.
- [ ] Module slots are explicit.
- [ ] Warnings are reviewed.
