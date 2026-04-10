# Decision: Mesh2Motion Intake

Role: decision record. Explains how Mesh2Motion source assets enter the repo.

Status: accepted after Push 8.

## Decision

Treat Mesh2Motion as an external offline authoring intermediate. The repo
stores source GLBs only as localdev intake evidence and ships only conditioned
artifacts that satisfy local repo contracts.

Do not create one generic Mesh2Motion runtime skeleton. Grow by explicit
runtime families only when a current consumer earns each family.

## Why

The imported source set proves that Mesh2Motion outputs are not one universal
runtime family. The current set includes humanoid, quadruped, avian,
winged-creature, multi-leg creature, and serpentine shapes with materially
different naming and topology.

One catch-all contract would either be too vague to validate or would force
runtime-specific rescue logic into loading and animation paths. The repo needs
stable local contracts and manifest-owned resolution instead.

## Source Asset Location

External source GLBs live under:

```text
docs/localdev/source-assets/mesh2motion/
```

Current source files:

| Source file | Role |
| --- | --- |
| `mesh2motion-humanoid-source.glb` | source for shipped `humanoid_v2` proof |
| `mesh2motion-bird-source.glb` | avian evidence, not active |
| `mesh2motion-dragon-source.glb` | winged-creature evidence, not active |
| `mesh2motion-fox-source.glb` | quadruped evidence, not active |
| `mesh2motion-kaiju-source.glb` | large creature evidence, not active |
| `mesh2motion-snake-source.glb` | serpentine evidence, not active |
| `mesh2motion-spider-source.glb` | multi-leg creature evidence, not active |

These source files are not manifest delivery assets.

## Shipped Push 8 Output

The former `exported-model.glb` source was renamed to
`mesh2motion-humanoid-source.glb`. Its conditioned shipped derivatives are:

- `client/public/models/metaverse/characters/mesh2motion-humanoid.glb`
- `client/public/models/metaverse/characters/mesh2motion-humanoid-canonical-animations.glb`
- `client/public/models/metaverse/characters/mesh2motion-humanoid-collision.glb`

The conditioning result:

- adds required repo socket bones
- removes explicit near-identity node `scale` transforms
- ships a separate simple collision proxy
- maps selected source animation clips into canonical repo clip names
- keeps runtime loading free of source-name aliases

## Intake Rules

- source assets do not define contract truth by themselves
- shipped files must live under `client/public/models/metaverse/<family>/`
- manifests must reference only shipped `.glb` or `.gltf` artifacts
- filenames stay lowercase kebab-case and unversioned
- runtime must not rewrite asset paths or compensate for missing authored data
- non-humanoid source files stay deferred until a concrete runtime consumer
  earns one explicit family

## Later Family Order

1. keep `humanoid_v2` stable
2. choose one non-humanoid family only after a runtime consumer exists
3. add more creature families only when each has its own consumer and
   validation truth

## Canonical References

- asset packaging rules:
  `docs/localdev/metaverse-asset-delivery-rules.md`
- rig and socket rules:
  `docs/localdev/metaverse-canonical-rig.md`
- active plan surface:
  `docs/localdev/metaverse-next-push-plan.md`
