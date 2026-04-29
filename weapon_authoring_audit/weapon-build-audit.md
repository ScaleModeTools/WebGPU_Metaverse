# Weapon Build Audit

Source files reviewed:

- `metaverse-service-pistol.gltf`
- `metaverse-rocket-launcher.gltf`

## Verdict

These are intelligent prototype builds. They are not just loose meshes: both weapons have a stable root, explicit forward/up markers, grip/trigger/muzzle/sight/ADS/carry nodes, and separated visual parts. That is the right foundation for a reusable held-object system.

The main problem is not the geometry. The main problem is that too much runtime meaning currently lives in ad-hoc node names and pistol-specific code. The next step should be to make sockets, hold profiles, support policy, ADS, module mounts, hazards, and carry behavior explicit in a dense external manifest.

## At a glance

| Asset                     | Family         | Pose profile                       | Length X | Height Y | Width Z | Tris | Sockets | Warnings |
| ------------------------- | -------------- | ---------------------------------- | -------- | -------- | ------- | ---- | ------- | -------- |
| metaverse_service_pistol  | sidearm        | sidearm.one_hand_optional_support  | 0.316    | 0.204    | 0.035   | 156  | 11      | 8        |
| metaverse_rocket_launcher | shoulder_heavy | shoulder_heavy.two_hand_shouldered | 1.185    | 0.353    | 0.140   | 156  | 12      | 7        |

## Socket map

| Asset                     | Role                    | Node                                          | X     | Y      | Z      |
| ------------------------- | ----------------------- | --------------------------------------------- | ----- | ------ | ------ |
| metaverse_service_pistol  | basis.forward           | metaverse_service_pistol_forward_marker       | 1.000 | 0.000  | 0.000  |
| metaverse_service_pistol  | basis.up                | metaverse_service_pistol_up_marker            | 0.000 | 1.000  | 0.000  |
| metaverse_service_pistol  | grip.primary.right_hint | metaverse_service_pistol_grip_hand_r_socket   | 0.079 | -0.048 | 0.000  |
| metaverse_service_pistol  | trigger.index           | metaverse_service_pistol_trigger_marker       | 0.082 | -0.061 | -0.008 |
| metaverse_service_pistol  | grip.secondary.optional | metaverse_service_pistol_support_marker       | 0.018 | -0.137 | 0.000  |
| metaverse_service_pistol  | sight.front             | metaverse_service_pistol_front_sight_socket   | 0.286 | 0.064  | 0.000  |
| metaverse_service_pistol  | sight.rear              | metaverse_service_pistol_rear_sight_socket    | 0.082 | 0.061  | 0.000  |
| metaverse_service_pistol  | module.optic            | metaverse_service_pistol_optic_mount_socket   | 0.145 | 0.061  | 0.000  |
| metaverse_service_pistol  | projectile.muzzle       | metaverse_service_pistol_muzzle_socket        | 0.312 | 0.030  | 0.000  |
| metaverse_service_pistol  | camera.ads_anchor       | metaverse_service_pistol_ads_camera_anchor    | 0.016 | 0.059  | 0.000  |
| metaverse_service_pistol  | carry.back              | metaverse_service_pistol_back_socket          | 0.072 | 0.012  | 0.000  |
| metaverse_rocket_launcher | basis.forward           | metaverse_rocket_launcher_forward_marker      | 1.000 | 0.000  | 0.000  |
| metaverse_rocket_launcher | basis.up                | metaverse_rocket_launcher_up_marker           | 0.000 | 1.000  | 0.000  |
| metaverse_rocket_launcher | grip.primary.right_hint | metaverse_rocket_launcher_grip_hand_r_socket  | 0.180 | -0.010 | 0.000  |
| metaverse_rocket_launcher | trigger.index           | metaverse_rocket_launcher_trigger_marker      | 0.240 | 0.020  | 0.000  |
| metaverse_rocket_launcher | grip.secondary.required | metaverse_rocket_launcher_support_grip_marker | 0.410 | -0.040 | 0.035  |
| metaverse_rocket_launcher | module.underbarrel_grip | metaverse_rocket_launcher_grip_module_socket  | 0.410 | -0.065 | 0.000  |
| metaverse_rocket_launcher | sight.front             | metaverse_rocket_launcher_front_sight_socket  | 0.880 | 0.170  | 0.000  |
| metaverse_rocket_launcher | sight.rear              | metaverse_rocket_launcher_rear_sight_socket   | 0.180 | 0.170  | 0.000  |
| metaverse_rocket_launcher | module.optic            | metaverse_rocket_launcher_optic_mount_socket  | 0.260 | 0.200  | 0.000  |
| metaverse_rocket_launcher | projectile.muzzle       | metaverse_rocket_launcher_muzzle_socket       | 1.010 | 0.080  | 0.000  |
| metaverse_rocket_launcher | camera.ads_anchor       | metaverse_rocket_launcher_ads_camera_anchor   | 0.020 | 0.190  | 0.000  |
| metaverse_rocket_launcher | carry.back              | metaverse_rocket_launcher_back_socket         | 0.180 | 0.080  | 0.000  |

## Service pistol notes

**What is good**

- Clean root: `metaverse_service_pistol_root`.
- Consistent basis markers: +X forward, +Y up.
- Good socket coverage for a sidearm prototype: grip, trigger, support, front/rear sight, optic mount, muzzle, ADS anchor, back carry.
- Separated mesh pieces: slide, barrel, frame, grip, trigger guard, mag floorplate.
- No accidental skeleton, skins, or animation clips.

**Production issues**

- `grip_hand_r_socket` bakes right-handedness into the node name. Canonical asset sockets should be hand-agnostic: `grip.primary`. The manifest should say right hand is the default.
- `support_marker` should not be treated as a real second grip. For a pistol, it is an optional support-palm hint.
- No orientation frames on sockets. The runtime can infer position now, but hands, optics, holsters, swords, and long guns need socket rotations.
- No material table, normals, or UVs. Fine for blockout/vertex-color prototypes, but not enough for production rendering/customization.
- No ejection port, magazine socket/body, or slide-cycle metadata yet.

## Rocket launcher notes

**What is good**

- It already demonstrates the scalable path beyond pistols: primary grip, support grip marker, grip module socket, sight/optic sockets, muzzle, ADS anchor, and back carry.
- The dimensions and socket placement are plausible for a shoulder-heavy weapon.
- The support grip marker and module socket are separated, which is the right idea.

**Production issues**

- A rocket launcher needs `projectile.exhaust` and `hazard.backblast_cone` metadata. Muzzle-only is not enough.
- The support point must be an explicit required secondary hand target, not a generic marker.
- Add body-contact metadata such as shoulder/chest contact, because heavy weapons need more than hand IK.
- Socket rotations are identity; heavy/shouldered ADS depends heavily on orientation.
- No reload/ammo/projectile/warhead sockets yet.

## Biggest structural recommendation

Stop treating this as a “pistol runtime.” Treat it as a **held object presentation layer**:

```txt
base locomotion / motion matching
  → animation clip pose
  → generic held-object pose profile
  → weapon-specific sockets + manifest
  → procedural aim / ADS / support hand / fingers
  → optional firing, reload, melee, or interaction overlays
```

The GLTF should carry geometry and transforms. The manifest should carry meaning.
