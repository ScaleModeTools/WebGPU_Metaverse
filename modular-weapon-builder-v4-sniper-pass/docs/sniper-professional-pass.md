# Sniper professional pass

This pass intentionally focuses on the longshot sniper base and sniper-adjacent modules.

## What changed

- removed the baked-in scope silhouette from the sniper base so optics are truly modular
- rebuilt the rifle as a chassis/receiver/barrel/rail/stock package with clean module sockets
- added sniper-specific grip, backup iron sights, optics, and muzzle options
- authored reserved optic markers for future eye-box / reticle-plane work

## Reserved optic markers on professional scope modules

- `<optic>_eye_box_anchor`
- `<optic>_reticle_plane`
- `<optic>_ocular_lens_marker`
- `<optic>_objective_lens_marker`
- `<optic>_optic_forward_marker`
- `<optic>_optic_up_marker`

These markers are not required by your current runtime, but they give you a clean next step for true optic-specific ADS work.

## Generated files

- `models/metaverse/attachments/metaverse-longshot-sniper.gltf`
- `models/metaverse/attachments/modules/metaverse-precision-bipod.gltf`
- `models/metaverse/attachments/modules/metaverse-folding-front-sight.gltf`
- `models/metaverse/attachments/modules/metaverse-micro-aperture-rear-sight.gltf`
- `models/metaverse/attachments/modules/metaverse-4x-scope.gltf`
- `models/metaverse/attachments/modules/metaverse-6x-variable-scope.gltf`
- `models/metaverse/attachments/modules/metaverse-10x-precision-scope.gltf`
- `models/metaverse/attachments/modules/metaverse-precision-muzzle-brake.gltf`
- `models/metaverse/attachments/modules/metaverse-long-suppressor.gltf`
