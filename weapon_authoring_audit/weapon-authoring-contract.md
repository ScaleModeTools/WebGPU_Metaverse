# Weapon Authoring Contract v0.1

## Goal

Make every held asset readable by artists, designers, runtime code, and tests without hard-coding a specific weapon such as the service pistol.

## Coordinate system

```txt
Units: meters
+X: forward / muzzle / blade tip
+Y: up / sight-up
+Z: right
```

## GLTF requirements

- One root node named after the asset.
- Visual meshes may be multiple nodes.
- Socket nodes should be empty nodes.
- Sockets must have meaningful position and rotation.
- Mesh nodes should have stable names.
- Production assets should export normals.
- Runtime assets should generally be `.glb`; source scenes can remain `.blend`, `.gltf`, or other DCC formats.

## Required external metadata

Every weapon should have an external manifest containing:

```json
{
  "assetId": "metaverse_service_pistol",
  "family": "sidearm",
  "poseProfileId": "sidearm.one_hand_optional_support",
  "coordinateSystem": {
    "units": "meters",
    "weaponForward": "+X",
    "weaponUp": "+Y",
    "weaponRight": "+Z"
  },
  "holdProfile": {
    "primaryHandDefault": "right",
    "allowedHands": ["right", "left"],
    "offhandPolicy": "optional_support_palm",
    "adsReference": "camera.ads_anchor",
    "projectileOrigin": "projectile.muzzle"
  },
  "sockets": []
}
```

## Socket role vocabulary

Use these roles in manifests. Node names can vary as long as the manifest maps them.

### Basis

- `basis.forward`
- `basis.up`

### Hands

- `grip.primary`
- `grip.secondary`
- `grip.secondary.optional`
- `trigger.index`
- `finger.thumb_rest`
- `finger.index_rest`

### Projectiles and firing

- `projectile.muzzle`
- `projectile.exhaust`
- `ejection.port`
- `magazine.socket`
- `ammo.socket`
- `reload.feed_socket`

### Aim and optics

- `camera.ads_anchor`
- `sight.front`
- `sight.rear`
- `module.optic`
- `module.barrel`
- `module.underbarrel`
- `module.stock`

### Carry

- `carry.hip`
- `carry.back`
- `carry.chest`
- `sling.front`
- `sling.rear`

### Body contacts

- `body.stock`
- `body.shoulder_contact`
- `body.chest_contact`
- `body.forearm_contact`

### Melee

- `melee.tip`
- `melee.edge_primary`
- `melee.edge_secondary`
- `melee.impact_volume`
- `trail.start`
- `trail.end`

### Interaction props/tools

- `use.origin`
- `interaction.hotspot`
- `screen.anchor`
- `light.origin`
- `pour.origin`

### Hazards

- `hazard.backblast_cone`
- `hazard.heat_zone`
- `hazard.blade_edge`

## Support policy vocabulary

- `none`
- `optional_support_palm`
- `optional_secondary_grip`
- `required_support_grip`
- `required_two_hand`
- `animation_event_controlled`

## ADS policy vocabulary

- `none`
- `muzzle_forward`
- `iron_sights`
- `optic_anchor`
- `shouldered_heavy`
- `third_person_hint_only`

## Carry policy vocabulary

- `none`
- `hip`
- `back`
- `chest`
- `sling`
- `hand_only`
