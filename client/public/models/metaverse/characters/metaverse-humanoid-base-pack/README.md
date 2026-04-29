# Metaverse Humanoid Base Pack Provenance

This folder preserves the useful source information from the temporary root
`avatar_rig_kit` import so the root kit folder can be removed after integration.
It lives next to the shipped model for the same reason: model provenance should
be easy to find from the model folder. The shipped runtime binary lives at:

- `client/public/models/metaverse/characters/metaverse-humanoid-base-pack.glb`

Runtime-facing metadata extracted from the kit lives in:

- `client/src/assets/types/humanoid-v2-avatar-rig.ts`
- `client/src/assets/types/humanoid-v2-rig-descriptors.ts`
- `client/src/assets/config/metaverse-humanoid-base-animation-catalog.ts`
- `client/src/assets/types/asset-socket.ts`
- `client/src/metaverse/render/humanoid-v2-rig.ts`

The preserved original kit documents, manifests, helper sources, and generation
script live under `original-kit/`. The GLB is intentionally not duplicated here;
the repo-owned runtime copy is the public base-pack GLB listed above.

## Preserved Original Kit Files

- `original-kit/README.md`
- `original-kit/src/avatarRig.ts`
- `original-kit/src/threeAnimationMasks.ts`
- `original-kit/src/avatarAnimationCatalog124.ts`
- `original-kit/src/animationCatalog.ts`
- `original-kit/scripts/build-animation-pack-catalog.mjs`
- `original-kit/manifests/2ways-rig-manifest.json`
- `original-kit/manifests/2ways-rig-report.md`
- `original-kit/manifests/2ways-bone-nomenclature.csv`
- `original-kit/animation-packs/124/README.md`
- `original-kit/animation-packs/124/animation-pack.manifest.json`
- `original-kit/animation-packs/124/category-index.json`
- `original-kit/animation-packs/124/animation-index.csv`
- `original-kit/animation-packs/124/animation-index.compact.md`

## Runtime Integration Notes

- The base pack contains one skinned humanoid mesh, one 66-joint skin, and 124
  embedded animation clips.
- The skeleton matches the previous humanoid skeleton by joint names and
  hierarchy, but the new GLB does not author the old socket nodes.
- `asset-socket.ts` preserves the socket parentage and local transforms from
  the previous shipped humanoid so the existing attachment/socket system keeps
  working.
- `metaverse-scene-character-proof-runtime.ts` synthesizes the canonical socket
  nodes at load time when the rig omits them.
- The animation catalog keeps categories, load packs, playback kinds, root
  motion metadata, finger activity, active bone groups, and clip tags available
  for future pack splitting and editor/runtime expansion.
