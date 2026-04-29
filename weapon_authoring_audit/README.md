# Metaverse Weapon Authoring Audit Kit

This package reviews the current service pistol and rocket launcher GLTF builds and proposes a scalable held-object/weapon authoring plan.

## Files

- `weapon-build-audit.md` — direct audit of the two attached GLTF files.
- `weapon-system-plan.md` — full plan for pistols, long guns, rocket launchers, melee weapons, tools, and props.
- `weapon-authoring-contract.md` — proposed socket vocabulary and authoring contract.
- `checklists/weapon-authoring-checklist.md` — artist checklist.
- `manifests/weapon-pack.manifest.json` — dense pack-level manifest.
- `manifests/*.weapon.json` — generated per-asset manifests.
- `manifests/weapon-index.csv` — quick weapon table.
- `manifests/socket-index.csv` — quick socket table.
- `src/weaponAuthoringContract.ts` — TypeScript contract seed.
- `scripts/inspect-weapon-gltf.mjs` — small no-dependency inspector for future weapon GLTF files.

## Current verdict

The builds are a strong prototype foundation. They should not be thrown away. The next step is to formalize their socket and pose semantics so the runtime can become generic instead of service-pistol-specific.

## Command

```bash
node scripts/inspect-weapon-gltf.mjs metaverse-service-pistol.gltf
node scripts/inspect-weapon-gltf.mjs metaverse-rocket-launcher.gltf
```
