# Avatar Rig Kit

This kit contains the skeleton map, bone groups, mask helpers, and animation catalogs for the uploaded humanoid GLBs.

## Current files

- `src/avatarRig.ts` — canonical 66-bone names, parents, aliases, and bone groups.
- `src/threeAnimationMasks.ts` — helper for creating masked Three.js clips by bone group.
- `src/avatarAnimationCatalog124.ts` — compact TypeScript catalog for the 124-animation GLB.
- `animation-packs/124/README.md` — dense human-readable map of every animation in `124.glb`.
- `animation-packs/124/animation-pack.manifest.json` — full parsed metadata.
- `animation-packs/124/animation-index.csv` — compact CSV index.

## Regenerate the 124 pack catalog

```bash
node scripts/build-animation-pack-catalog.mjs /path/to/124.glb /path/to/2ways.glb ./animation-packs/124 .
```

The 124-animation pack currently matches the baseline skeleton by joint names and hierarchy.
